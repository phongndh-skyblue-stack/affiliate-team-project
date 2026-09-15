[CmdletBinding()]
param(
    [switch]$NoBrowser,
    [switch]$Visible,
    [switch]$DryRun,
    [ValidateRange(0, 300)]
    [int]$StartupDelaySeconds = 0
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$projectRoot = $PSScriptRoot
$serverDirectory = Join-Path $projectRoot "server"
$clientDirectory = Join-Path $projectRoot "client"
$pythonPath = Join-Path $serverDirectory ".venv\Scripts\python.exe"
$nextScriptPath = Join-Path $clientDirectory "node_modules\next\dist\bin\next"
$workerModulePath = Join-Path $serverDirectory "app\api\search_ads\tasks.py"
$botModulePath = Join-Path $serverDirectory "bot\main.py"
$runtimeDirectory = Join-Path $projectRoot ".runtime"
$logDirectory = Join-Path $runtimeDirectory "logs"
$pidDirectory = Join-Path $runtimeDirectory "pids"

function Get-EnvValue {
    param(
        [Parameter(Mandatory = $true)][string]$Path,
        [Parameter(Mandatory = $true)][string]$Name,
        [Parameter(Mandatory = $true)][string]$DefaultValue
    )

    if (-not (Test-Path -LiteralPath $Path)) {
        return $DefaultValue
    }

    foreach ($line in Get-Content -LiteralPath $Path) {
        if ($line -match "^\s*$([regex]::Escape($Name))\s*=\s*(.*?)\s*$") {
            return $matches[1].Trim('"', "'")
        }
    }

    return $DefaultValue
}

function Test-PortListening {
    param([Parameter(Mandatory = $true)][int]$Port)

    try {
        return [System.Net.NetworkInformation.IPGlobalProperties]::GetIPGlobalProperties().GetActiveTcpListeners().Port -contains $Port
    }
    catch {
        return $false
    }
}

function Get-SavedProcess {
    param([Parameter(Mandatory = $true)][string]$Name)

    $pidPath = Join-Path $pidDirectory "$Name.pid"
    if (-not (Test-Path -LiteralPath $pidPath)) {
        return $null
    }

    $savedPid = 0
    if (-not [int]::TryParse((Get-Content -LiteralPath $pidPath -Raw).Trim(), [ref]$savedPid)) {
        Remove-Item -LiteralPath $pidPath -Force -ErrorAction SilentlyContinue
        return $null
    }

    $process = Get-Process -Id $savedPid -ErrorAction SilentlyContinue
    if ($null -eq $process) {
        Remove-Item -LiteralPath $pidPath -Force -ErrorAction SilentlyContinue
    }
    return $process
}

function Start-ManagedProcess {
    param(
        [Parameter(Mandatory = $true)][string]$Name,
        [Parameter(Mandatory = $true)][string]$DisplayName,
        [Parameter(Mandatory = $true)][string]$FilePath,
        [Parameter(Mandatory = $true)][string[]]$ArgumentList,
        [Parameter(Mandatory = $true)][string]$WorkingDirectory,
        [int]$Port = 0
    )

    if ($Port -gt 0 -and (Test-PortListening -Port $Port)) {
        Write-Host "[SKIP] $DisplayName is already listening on port $Port."
        return
    }

    $existingProcess = Get-SavedProcess -Name $Name
    if ($null -ne $existingProcess) {
        Write-Host "[SKIP] $DisplayName is already running (PID $($existingProcess.Id))."
        return
    }

    $stdoutPath = Join-Path $logDirectory "$Name.out.log"
    $stderrPath = Join-Path $logDirectory "$Name.err.log"
    $windowStyle = if ($Visible) { "Normal" } else { "Hidden" }
    $process = Start-Process `
        -FilePath $FilePath `
        -ArgumentList $ArgumentList `
        -WorkingDirectory $WorkingDirectory `
        -WindowStyle $windowStyle `
        -RedirectStandardOutput $stdoutPath `
        -RedirectStandardError $stderrPath `
        -PassThru

    Set-Content -LiteralPath (Join-Path $pidDirectory "$Name.pid") -Value $process.Id -Encoding ASCII
    Write-Host "[STARTED] $DisplayName (PID $($process.Id))."
}

function Get-RedisService {
    return Get-Service -ErrorAction SilentlyContinue | Where-Object {
        $_.Name -match 'redis|memurai' -or $_.DisplayName -match 'redis|memurai'
    } | Select-Object -First 1
}

function Initialize-Redis {
    param([Parameter(Mandatory = $true)][int]$Port)

    if (Test-PortListening -Port $Port) {
        Write-Host "[READY] Redis is listening on port $Port."
        return
    }

    $redisService = Get-RedisService

    if ($null -ne $redisService) {
        try {
            Start-Service -InputObject $redisService -ErrorAction Stop
            $redisService.WaitForStatus([System.ServiceProcess.ServiceControllerStatus]::Running, [TimeSpan]::FromSeconds(10))
            Write-Host "[STARTED] Redis service '$($redisService.Name)'."
            return
        }
        catch {
            Write-Warning "Redis service exists but could not be started: $($_.Exception.Message)"
        }
    }

    $redisCommand = Get-Command "redis-server.exe" -ErrorAction SilentlyContinue
    if ($null -ne $redisCommand) {
        Start-ManagedProcess -Name "redis" -DisplayName "Redis" -FilePath $redisCommand.Source -ArgumentList @("--port", "$Port") -WorkingDirectory $projectRoot -Port $Port
        return
    }

    Write-Warning "Redis is not listening on port $Port and redis-server.exe was not found. Backend can start, but ARQ jobs require Redis."
}

function Wait-ForHttp {
    param(
        [Parameter(Mandatory = $true)][string]$Url,
        [int]$TimeoutSeconds = 45
    )

    $deadline = [DateTime]::UtcNow.AddSeconds($TimeoutSeconds)
    while ([DateTime]::UtcNow -lt $deadline) {
        try {
            $response = Invoke-WebRequest -UseBasicParsing -Uri $Url -TimeoutSec 3
            if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 500) {
                return $true
            }
        }
        catch {
            Start-Sleep -Seconds 1
        }
    }
    return $false
}

$serverEnvPath = Join-Path $serverDirectory ".env"
$clientEnvPath = Join-Path $clientDirectory ".env"
$backendPort = [int](Get-EnvValue -Path $serverEnvPath -Name "APP_PORT" -DefaultValue "4050")
$frontendPort = [int](Get-EnvValue -Path $clientEnvPath -Name "PORT" -DefaultValue "4000")
$redisPort = [int](Get-EnvValue -Path $serverEnvPath -Name "REDIS_PORT" -DefaultValue "6379")
$frontendUrl = "http://localhost:$frontendPort"
$backendUrl = "http://localhost:$backendPort"

$requiredPaths = @(
    @{ Label = "Python virtual environment"; Path = $pythonPath },
    @{ Label = "Next.js launcher"; Path = $nextScriptPath },
    @{ Label = "ARQ worker module"; Path = $workerModulePath },
    @{ Label = "Bot module"; Path = $botModulePath }
)

foreach ($requirement in $requiredPaths) {
    if (-not (Test-Path -LiteralPath $requirement.Path)) {
        throw "$($requirement.Label) was not found at '$($requirement.Path)'. Run the project setup before using this launcher."
    }
}

$nodeCommand = Get-Command "node.exe" -ErrorAction SilentlyContinue
if ($null -eq $nodeCommand) {
    throw "node.exe was not found in PATH. Install Node.js or add it to PATH."
}

$nextMode = if (Test-Path -LiteralPath (Join-Path $clientDirectory ".next\BUILD_ID")) { "start" } else { "dev" }
$nextScriptArgument = ".\node_modules\next\dist\bin\next"
$nextArguments = if ($nextMode -eq "start") {
    @($nextScriptArgument, "start", "-p", "$frontendPort")
}
else {
    @($nextScriptArgument, "dev", "--webpack", "-p", "$frontendPort")
}

Write-Host "Affiliate Team Project startup"
Write-Host "  Backend : $backendUrl"
Write-Host "  Frontend: $frontendUrl ($nextMode mode)"
Write-Host "  Redis   : localhost:$redisPort"

if ($DryRun) {
    $detectedRedisService = Get-RedisService
    if ($null -ne $detectedRedisService) {
        Write-Host "[DRY RUN] Redis-compatible service -> $($detectedRedisService.Name) ($($detectedRedisService.Status))"
    }
    else {
        Write-Host "[DRY RUN] Redis-compatible service -> not installed as a Windows service"
    }
    Write-Host "[DRY RUN] Backend -> $pythonPath -m uvicorn app.main:app --port $backendPort"
    Write-Host "[DRY RUN] Frontend -> $($nodeCommand.Source) $($nextArguments -join ' ')"
    Write-Host "[DRY RUN] ARQ worker -> $pythonPath -m arq app.api.search_ads.tasks.WorkerSettings"
    Write-Host "[DRY RUN] Bot -> $pythonPath -m bot.main"
    Write-Host "Dry-run completed. No process was started."
    exit 0
}

if ($StartupDelaySeconds -gt 0) {
    Write-Host "Waiting $StartupDelaySeconds seconds for Windows startup..."
    Start-Sleep -Seconds $StartupDelaySeconds
}

New-Item -ItemType Directory -Path $logDirectory -Force | Out-Null
New-Item -ItemType Directory -Path $pidDirectory -Force | Out-Null

Initialize-Redis -Port $redisPort

$env:NEXT_PUBLIC_API_URL = "$backendUrl/api"
$env:PORT = "$frontendPort"

Start-ManagedProcess -Name "backend" -DisplayName "Backend" -FilePath $pythonPath -ArgumentList @("-m", "uvicorn", "app.main:app", "--port", "$backendPort") -WorkingDirectory $serverDirectory -Port $backendPort
Start-ManagedProcess -Name "frontend" -DisplayName "Frontend" -FilePath $nodeCommand.Source -ArgumentList $nextArguments -WorkingDirectory $clientDirectory -Port $frontendPort
Start-ManagedProcess -Name "arq-worker" -DisplayName "ARQ worker" -FilePath $pythonPath -ArgumentList @("-m", "arq", "app.api.search_ads.tasks.WorkerSettings") -WorkingDirectory $serverDirectory
Start-ManagedProcess -Name "bot" -DisplayName "Bot" -FilePath $pythonPath -ArgumentList @("-m", "bot.main") -WorkingDirectory $serverDirectory

if (Wait-ForHttp -Url "$backendUrl/api/health") {
    Write-Host "[READY] Backend is responding."
}
else {
    Write-Warning "Backend did not respond within 45 seconds. Check '$logDirectory\backend.err.log'."
}

if (Wait-ForHttp -Url $frontendUrl) {
    Write-Host "[READY] Frontend is responding at $frontendUrl."
    if (-not $NoBrowser) {
        Start-Process $frontendUrl | Out-Null
    }
}
else {
    Write-Warning "Frontend did not respond within 45 seconds. Check '$logDirectory\frontend.err.log'."
}

Write-Host "Startup sequence completed. Logs: $logDirectory"
