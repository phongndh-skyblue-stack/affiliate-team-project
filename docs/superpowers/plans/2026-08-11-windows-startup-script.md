# Windows Startup Script Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a safe PowerShell launcher suitable for Windows Task Scheduler.

**Architecture:** A single repository-root script validates local dependencies, discovers ports from existing environment files, and starts each component as an independent hidden process. PID and log files live under a Git-ignored runtime directory; `-DryRun` exercises validation without side effects.

**Tech Stack:** Windows PowerShell 5.1+, FastAPI/Uvicorn, Next.js, ARQ.

## Global Constraints

- Do not install software or change Windows services permanently.
- Do not start duplicate application processes.
- All paths must be repository-relative and support spaces.

---

### Task 1: Startup launcher

**Files:**
- Create: `start-app.ps1`
- Create: `tests/start-app.Tests.ps1`
- Modify: `.gitignore`

**Interfaces:**
- Consumes: `client/.env`, `server/.env`, `server/.venv/Scripts/python.exe`, and `client/node_modules/.bin/next.cmd`.
- Produces: `start-app.ps1 [-NoBrowser] [-Visible] [-DryRun] [-StartupDelaySeconds N]`.

- [ ] **Step 1: Write the failing integration test**

Invoke `start-app.ps1 -DryRun -NoBrowser`, require exit code zero, require the four component names in output, and require that `.runtime` remains absent.

- [ ] **Step 2: Verify the test fails**

Run: `powershell -NoProfile -ExecutionPolicy Bypass -File tests/start-app.Tests.ps1`

Expected: FAIL because `start-app.ps1` does not exist.

- [ ] **Step 3: Implement the launcher**

Add dependency validation, environment port parsing, PID/port duplicate protection, hidden process startup, Redis best-effort startup, logging, health waiting, and browser opening.

- [ ] **Step 4: Verify the test passes**

Run: `powershell -NoProfile -ExecutionPolicy Bypass -File tests/start-app.Tests.ps1`

Expected: PASS with no application processes started.

- [ ] **Step 5: Run syntax and repository checks**

Parse the script with PowerShell's parser and run `git diff --check`.
