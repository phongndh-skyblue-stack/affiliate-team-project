# Windows Startup Script Design

## Goal

Provide a repository-local `start-app.ps1` that can be called by Windows Task Scheduler to start the affiliate application after user logon.

## Behavior

- Resolve every path relative to the repository containing the script.
- Read the frontend and backend ports from `client/.env` and `server/.env`, falling back to 4000 and 4050.
- Start FastAPI, Next.js, the ARQ worker, and the bot as hidden background processes.
- Treat Redis as an external prerequisite: use an existing listener on port 6379, attempt to start an installed Windows Redis service, and otherwise warn without installing software.
- Do not start another managed process when its configured port or saved PID is already active.
- Write process output and PID files beneath `.runtime`, which is ignored by Git.
- Support `-DryRun` for safe validation and `-NoBrowser` for Task Scheduler usage without automatically opening the UI.
- Open the local frontend only after it becomes reachable unless `-NoBrowser` or `-DryRun` is supplied.

## Error handling

Missing Python, Next.js, worker, or bot files are fatal before anything starts. A missing Redis installation is reported clearly because installing or changing system services is outside this script's scope.

## Verification

A PowerShell integration test executes `start-app.ps1 -DryRun -NoBrowser`, asserts successful validation, confirms all four managed components are planned, and confirms no runtime directory is created.
