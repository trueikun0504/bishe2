$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$runtimeDir = Join-Path $root ".runtime"
$pidFile = Join-Path $runtimeDir "admin.pid"

function Get-AdminProcess($processId) {
  try {
    $process = Get-CimInstance Win32_Process -Filter "ProcessId = $processId"
    if (-not $process) {
      return $null
    }

    if ([string]$process.CommandLine -like "*admin/server.js*") {
      return $process
    }

    return $null
  } catch {
    return $null
  }
}

$process = $null

if (Test-Path $pidFile) {
  $filePid = (Get-Content $pidFile -Raw).Trim()
  if ($filePid -match "^\d+$") {
    $process = Get-AdminProcess $filePid
  }
}

if (-not $process) {
  $portPid = Get-NetTCPConnection -LocalPort 3001 -ErrorAction SilentlyContinue |
    Select-Object -First 1 -ExpandProperty OwningProcess

  if ($portPid) {
    $process = Get-AdminProcess $portPid
  }
}

if (-not $process) {
  Write-Output "Admin service is not running"
  exit 0
}

Write-Output "Admin service is running"
Write-Output "PID: $($process.ProcessId)"
Write-Output "URL: http://localhost:3001"
Write-Output "Command: $($process.CommandLine)"
