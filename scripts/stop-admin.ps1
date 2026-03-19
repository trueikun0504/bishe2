$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$runtimeDir = Join-Path $root ".runtime"
$pidFile = Join-Path $runtimeDir "admin.pid"

function Test-AdminProcess($processId) {
  try {
    $process = Get-CimInstance Win32_Process -Filter "ProcessId = $processId"
    if (-not $process) {
      return $false
    }

    return [string]$process.CommandLine -like "*admin/server.js*"
  } catch {
    return $false
  }
}

$targetPid = $null

if (Test-Path $pidFile) {
  $filePid = (Get-Content $pidFile -Raw).Trim()
  if ($filePid -match "^\d+$" -and (Test-AdminProcess $filePid)) {
    $targetPid = [int]$filePid
  }
}

if (-not $targetPid) {
  $portPid = Get-NetTCPConnection -LocalPort 3001 -ErrorAction SilentlyContinue |
    Select-Object -First 1 -ExpandProperty OwningProcess

  if ($portPid -and (Test-AdminProcess $portPid)) {
    $targetPid = [int]$portPid
  }
}

if (-not $targetPid) {
  Remove-Item $pidFile -Force -ErrorAction SilentlyContinue
  Write-Output "Admin service is not running"
  exit 0
}

Stop-Process -Id $targetPid -Force
Remove-Item $pidFile -Force -ErrorAction SilentlyContinue
Write-Output "Admin service stopped (PID $targetPid)"
