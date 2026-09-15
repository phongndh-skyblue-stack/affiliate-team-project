$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$launcher = Join-Path $repoRoot "start-app.ps1"
$runtimeDirectory = Join-Path $repoRoot ".runtime"

if (Test-Path -LiteralPath $runtimeDirectory) {
    throw "Precondition failed: .runtime already exists; move it temporarily before running this test."
}

$output = & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $launcher -DryRun -NoBrowser 2>&1
if ($LASTEXITCODE -ne 0) {
    throw "Launcher dry-run failed with exit code $LASTEXITCODE.`n$($output -join [Environment]::NewLine)"
}

$renderedOutput = $output -join [Environment]::NewLine
if ($renderedOutput -notmatch 'Backend\s*: http://localhost:4050') {
    throw "Launcher did not use backend port 4050.`n$renderedOutput"
}
if ($renderedOutput -notmatch 'Frontend\s*: http://localhost:4000') {
    throw "Launcher did not use frontend port 4000.`n$renderedOutput"
}
foreach ($component in @("Backend", "Frontend", "ARQ worker", "Bot")) {
    if ($renderedOutput -notmatch [regex]::Escape($component)) {
        throw "Dry-run output did not include component '$component'."
    }
}

$localRedisService = Get-Service -ErrorAction SilentlyContinue | Where-Object {
    $_.Name -match 'redis|memurai' -or $_.DisplayName -match 'redis|memurai'
} | Select-Object -First 1
if ($null -ne $localRedisService -and $renderedOutput -notmatch [regex]::Escape($localRedisService.Name)) {
    throw "Dry-run did not detect the installed Redis-compatible service '$($localRedisService.Name)'."
}

if (Test-Path -LiteralPath $runtimeDirectory) {
    throw "Dry-run created .runtime and therefore was not side-effect free."
}

Write-Host "PASS: start-app.ps1 validates all components without side effects."
