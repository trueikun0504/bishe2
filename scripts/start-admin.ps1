$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$runtimeDir = Join-Path $root ".runtime"
$pidFile = Join-Path $runtimeDir "admin.pid"
$outLog = Join-Path $runtimeDir "admin.out.log"
$errLog = Join-Path $runtimeDir "admin.err.log"
$adminEntry = Join-Path $root "admin\server.js"

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

if (-not (Test-Path $runtimeDir)) {
  New-Item -Path $runtimeDir -ItemType Directory | Out-Null
}

if (Test-Path $pidFile) {
  $existingPid = (Get-Content $pidFile -Raw).Trim()
  if ($existingPid -match "^\d+$" -and (Test-AdminProcess $existingPid)) {
    Write-Output "Admin service is already running on PID $existingPid"
    exit 0
  }

  Remove-Item $pidFile -Force -ErrorAction SilentlyContinue
}

$portProcess = Get-NetTCPConnection -LocalPort 3001 -ErrorAction SilentlyContinue |
  Select-Object -First 1 -ExpandProperty OwningProcess

if ($portProcess) {
  if (Test-AdminProcess $portProcess) {
    Set-Content -Path $pidFile -Value $portProcess -NoNewline
    Write-Output "Admin service is already listening on port 3001 with PID $portProcess"
    exit 0
  }

  throw "Port 3001 is already occupied by PID $portProcess. Stop that process first."
}

$process = Start-Process -FilePath "node.exe" `
  -ArgumentList "admin/server.js" `
  -WorkingDirectory $root `
  -RedirectStandardOutput $outLog `
  -RedirectStandardError $errLog `
  -PassThru

Set-Content -Path $pidFile -Value $process.Id -NoNewline

Start-Sleep -Seconds 3

if (-not (Test-AdminProcess $process.Id)) {
  throw "Admin service failed to start. Check $errLog"
}

Write-Output "Admin service started on http://localhost:3001 with PID $($process.Id)"
