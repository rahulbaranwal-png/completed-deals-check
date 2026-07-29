[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$ProjectRoot = $PSScriptRoot
$WorkDirectory = Join-Path $ProjectRoot "work"
$SyncScript = Join-Path $ProjectRoot "scripts\Sync-ToGitHub.ps1"
$SyncOutputLog = Join-Path $WorkDirectory "github-auto-sync.log"
$SyncErrorLog = Join-Path $WorkDirectory "github-auto-sync.error.log"
$AppPort = 3000
$ComputerName = [System.Net.Dns]::GetHostName()
$StableUrl = "http://$($ComputerName):$AppPort/"
$LoopbackUrl = "http://127.0.0.1:$AppPort/"

if (-not (Test-Path -LiteralPath $WorkDirectory)) {
  New-Item -ItemType Directory -Path $WorkDirectory | Out-Null
}

function Test-CompletedDealsCheckEndpoint {
  try {
    $Response = Invoke-WebRequest -Uri $LoopbackUrl -UseBasicParsing -TimeoutSec 3
    return $Response.StatusCode -eq 200 -and $Response.Content -match "Completed deals check"
  } catch {
    return $false
  }
}

if (Test-CompletedDealsCheckEndpoint) {
  Write-Host "Completed deals check is already running at $StableUrl"
  exit 0
}

$ExistingListener = Get-NetTCPConnection -LocalPort $AppPort -State Listen -ErrorAction SilentlyContinue |
  Select-Object -First 1

if ($ExistingListener) {
  throw "Port $AppPort is already being used by another program. The app will retry automatically when the port is free."
}

$AutoSyncJob = Start-Job -ScriptBlock {
  param($SyncScriptPath, $OutputLogPath, $ErrorLogPath)

  while ($true) {
    & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $SyncScriptPath 1>> $OutputLogPath 2>> $ErrorLogPath
    Start-Sleep -Seconds 60
  }
} -ArgumentList $SyncScript, $SyncOutputLog, $SyncErrorLog

$NodeCommand = Get-Command node.exe -ErrorAction SilentlyContinue
$NodeExe = if ($NodeCommand) {
  $NodeCommand.Source
} else {
  Join-Path $env:USERPROFILE ".cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
}

if (-not (Test-Path -LiteralPath $NodeExe)) {
  Stop-Job -Job $AutoSyncJob -ErrorAction SilentlyContinue
  Remove-Job -Job $AutoSyncJob -Force -ErrorAction SilentlyContinue
  throw "Node.js was not found. Open the project in Codex once or install Node.js 22.13 or later."
}

$VinextCli = Join-Path $ProjectRoot "node_modules\vinext\dist\cli.js"
if (-not (Test-Path -LiteralPath $VinextCli)) {
  Stop-Job -Job $AutoSyncJob -ErrorAction SilentlyContinue
  Remove-Job -Job $AutoSyncJob -Force -ErrorAction SilentlyContinue
  throw "The app dependencies are missing. Run pnpm install in the project folder once."
}

$NetworkAddresses = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
  Where-Object { $_.IPAddress -notlike "127.*" -and $_.IPAddress -ne "0.0.0.0" -and $_.AddressState -eq "Preferred" } |
  Select-Object -ExpandProperty IPAddress -Unique

Write-Host ""
Write-Host "Completed deals check is starting."
Write-Host "Stable link on this computer: $StableUrl"
foreach ($Address in $NetworkAddresses) {
  Write-Host "Current network IP link: http://$($Address):$AppPort/"
}
Write-Host "Automatic private GitHub saving is running in the background."
Write-Host "Keep this window open while using the app."
Write-Host ""

try {
  Push-Location $ProjectRoot
  & $NodeExe $VinextCli dev --hostname 0.0.0.0 --port $AppPort --strictPort
  throw "The local server stopped unexpectedly and will be restarted automatically."
} finally {
  Pop-Location
  Stop-Job -Job $AutoSyncJob -ErrorAction SilentlyContinue
  Remove-Job -Job $AutoSyncJob -Force -ErrorAction SilentlyContinue
}
