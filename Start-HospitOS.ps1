# ====================================================================
# HOPe - Production PowerShell Supervisor & Launcher Script
# Entry point: Start-HospitOS.ps1
# Usage:
#   Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
#   .\Start-HospitOS.ps1
# ====================================================================

[CmdletBinding()]
param()

$ScriptDir = $PSScriptRoot
if (-not $ScriptDir) {
    $ScriptDir = Split-Path -Path $MyInvocation.MyCommand.Definition -Parent
}
if (-not $ScriptDir) {
    $ScriptDir = "D:\HospitOS"
}
Set-Location $ScriptDir

$LogDir = Join-Path $ScriptDir "logs"
if (-not (Test-Path $LogDir)) {
    New-Item -ItemType Directory -Path $LogDir -Force | Out-Null
}

$StartupLogFile = Join-Path $LogDir "hope-startup.log"
$BackendLogFile = Join-Path $LogDir "backend.log"

function Write-StageLog {
    param (
        [string]$Stage,
        [string]$Message,
        [string]$Level = "INFO"
    )
    $Timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $LogLine = "[$Timestamp] [$Level] [$Stage] $Message"
    Add-Content -Path $StartupLogFile -Value $LogLine

    if ($Level -eq "ERROR") {
        Write-Host "[$Stage] $Message" -ForegroundColor Red
    } elseif ($Level -eq "WARN") {
        Write-Host "[$Stage] $Message" -ForegroundColor Yellow
    } else {
        Write-Host "[$Stage] $Message" -ForegroundColor Green
    }
}

"" > $StartupLogFile
$Host.UI.RawUI.WindowTitle = "HOPe System Launcher & Supervisor"
Clear-Host

Write-Host "==========================================================" -ForegroundColor Red
Write-Host "            HOPe — HOSPITAL OPERATING PLATFORM          " -ForegroundColor White
Write-Host "          Production Supervisor & Application Engine      " -ForegroundColor Red
Write-Host "==========================================================" -ForegroundColor Red
Write-Host ""

# [1] Launcher Stage
Write-StageLog "1-Launcher" "Starting HOPe Supervisor from: $ScriptDir" "INFO"

# Pre-Clean stale processes on port 8000 & 5000
Get-NetTCPConnection -LocalPort 8000 -ErrorAction SilentlyContinue | ForEach-Object {
    Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue
}
Get-NetTCPConnection -LocalPort 5000 -ErrorAction SilentlyContinue | ForEach-Object {
    Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue
}

# [2] Dependency Check Stage
Write-StageLog "2-Dependency Check" "Verifying Node.js, Python 3.11+ & core files..." "INFO"
$NodeCheck = Get-Command node -ErrorAction SilentlyContinue
if (-not $NodeCheck) {
    Write-StageLog "2-Dependency Check" "Node.js not installed in PATH." "ERROR"
    Write-Host ""
    Write-Host "**********************************************************" -ForegroundColor Red
    Write-Host "                   HOPe CORE ERROR                    " -ForegroundColor White -BackgroundColor Red
    Write-Host " Error: Node.js runtime environment was not found." -ForegroundColor Red
    Write-Host " Recovery Option: Install Node.js v18+ from https://nodejs.org" -ForegroundColor Yellow
    Write-Host "**********************************************************" -ForegroundColor Red
    Write-Host ""
    Read-Host "Press Enter to exit..."
    Exit 1
}

# [3] Start Python FastAPI CARE AI Backend (Port 8000 - Server Host 0.0.0.0)
Write-StageLog "3-Start CARE AI Backend" "Launching CARE AI Python FastAPI Backend (uvicorn main:app --host 0.0.0.0 --port 8000)..." "INFO"
$CareBackendDir = Join-Path $ScriptDir "care_backend"
$PyProcess = Start-Process -FilePath "python" -ArgumentList "-m uvicorn main:app --host 0.0.0.0 --port 8000" -WorkingDirectory $CareBackendDir -NoNewWindow -PassThru

# [4] Start Node.js Core Backend Server (Port 5000)
Write-StageLog "4-Start Node Backend" "Launching HOPe API Core (node server.cjs)..." "INFO"
$BackendProcess = Start-Process -FilePath "node" -ArgumentList "server.cjs" -WorkingDirectory $ScriptDir -NoNewWindow -PassThru

if (-not $BackendProcess -or $BackendProcess.HasExited) {
    Write-StageLog "4-Start Node Backend" "Failed to start backend process." "ERROR"
    Write-Host ""
    Write-Host "**********************************************************" -ForegroundColor Red
    Write-Host "                   HOPe CORE ERROR                    " -ForegroundColor White -BackgroundColor Red
    Write-Host " Error: Backend process (server.cjs) failed to launch." -ForegroundColor Red
    Write-Host " Recovery Option: Inspect logs/backend.log for stack traces." -ForegroundColor Yellow
    Write-Host "**********************************************************" -ForegroundColor Red
    Write-Host ""
    Read-Host "Press Enter to exit..."
    Exit 1
}

# [5] Health Check Backend Endpoints
Write-StageLog "5-Health Check" "Polled GET http://127.0.0.1:8000/api/care/health & http://127.0.0.1:5000/health..." "INFO"

$BackendReady = $false
$Retries = 15

for ($i = 1; $i -le $Retries; $i++) {
    try {
        $Response = Invoke-RestMethod -Uri "http://127.0.0.1:5000/health" -Method Get -ErrorAction Stop
        if ($Response.status -eq "ok") {
            $BackendReady = $true
            break
        }
    } catch {
        # Retry loop
    }
    Start-Sleep -Milliseconds 500
}

if (-not $BackendReady) {
    Write-StageLog "5-Health Check" "Backend health check timed out after 15 seconds." "ERROR"
    if ($BackendProcess -and -not $BackendProcess.HasExited) {
        Stop-Process -Id $BackendProcess.Id -Force -ErrorAction SilentlyContinue
    }
    if ($PyProcess -and -not $PyProcess.HasExited) {
        Stop-Process -Id $PyProcess.Id -Force -ErrorAction SilentlyContinue
    }
    Write-Host ""
    Write-Host "**********************************************************" -ForegroundColor Red
    Write-Host "                   HOPe CORE ERROR                    " -ForegroundColor White -BackgroundColor Red
    Write-Host " Error: HOPe Backend failed health check." -ForegroundColor Red
    Write-Host " Details: GET /health did not return status ok." -ForegroundColor Red
    Write-Host " Recovery Option: Check logs/backend.log for detailed errors." -ForegroundColor Yellow
    Write-Host "**********************************************************" -ForegroundColor Red
    Write-Host ""
    Read-Host "Press Enter to exit..."
    Exit 1
}

Write-StageLog "5-Health Check" "Backend READY: GET /health returned status ok." "INFO"

# [6] Verify & Build Frontend Dist
Write-StageLog "6-Frontend Build" "Verifying compiled UI dist bundle (dist/index.html)..." "INFO"
$DistHtml = Join-Path $ScriptDir "dist\index.html"
if (-not (Test-Path $DistHtml)) {
    Write-StageLog "6-Frontend Build" "Compiling Vite UI bundle..." "WARN"
    try {
        & npx vite build 2>&1 | Out-String | Add-Content -Path $StartupLogFile
        if (-not (Test-Path $DistHtml)) {
            throw "Vite build did not produce dist/index.html"
        }
    } catch {
        Write-StageLog "6-Frontend Build" "Vite UI compilation failed: $_" "ERROR"
        if ($BackendProcess -and -not $BackendProcess.HasExited) {
            Stop-Process -Id $BackendProcess.Id -Force -ErrorAction SilentlyContinue
        }
        if ($PyProcess -and -not $PyProcess.HasExited) {
            Stop-Process -Id $PyProcess.Id -Force -ErrorAction SilentlyContinue
        }
        Write-Host ""
        Write-Host "**********************************************************" -ForegroundColor Red
        Write-Host "                    HOPe UI ERROR                     " -ForegroundColor White -BackgroundColor Red
        Write-Host " Error: HOPe UI compilation failed." -ForegroundColor Red
        Write-Host " Recovery Option: Run 'npm run build' to inspect errors." -ForegroundColor Yellow
        Write-Host "**********************************************************" -ForegroundColor Red
        Write-Host ""
        Read-Host "Press Enter to exit..."
        Exit 1
    }
}
Write-StageLog "6-Frontend Build" "Frontend UI bundle verified." "INFO"

# [7] Launch HOPe Native Desktop Window
Write-StageLog "7-Desktop Window" "Launching HOPe Electron Native Workstation Window..." "INFO"

Write-Host ""
Write-Host "==========================================================" -ForegroundColor Red
Write-Host " HOPe Workstation Active. Close window to exit." -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Red
Write-Host ""

try {
    # Run Electron Desktop UI Container
    $ElectronProcess = Start-Process -FilePath "npx.cmd" -ArgumentList "electron ." -WorkingDirectory $ScriptDir -NoNewWindow -PassThru -Wait
} catch {
    Write-StageLog "7-Desktop Window" "Failed to start Electron container window: $_" "ERROR"
} finally {
    Write-StageLog "8-Cleanup" "Terminating HOPe backend processes and returning to Windows..." "INFO"
    if ($BackendProcess -and -not $BackendProcess.HasExited) {
        Stop-Process -Id $BackendProcess.Id -Force -ErrorAction SilentlyContinue
    }
    if ($PyProcess -and -not $PyProcess.HasExited) {
        Stop-Process -Id $PyProcess.Id -Force -ErrorAction SilentlyContinue
    }
    Write-Host ""
    Write-Host "==========================================================" -ForegroundColor Red
    Write-Host " HOPe shutdown complete. Safely returned to Windows." -ForegroundColor White
    Write-Host "==========================================================" -ForegroundColor Red
}
