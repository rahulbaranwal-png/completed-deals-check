[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$ProjectRoot = $PSScriptRoot
$WorkDirectory = Join-Path $ProjectRoot "work"
$AutoSyncScript = Join-Path $ProjectRoot "scripts\Start-GitHubAutoSync.ps1"
$SyncOutputLog = Join-Path $WorkDirectory "github-auto-sync.log"
$SyncErrorLog = Join-Path $WorkDirectory "github-auto-sync.error.log"

if (-not (Test-Path -LiteralPath $WorkDirectory)) {
  New-Item -ItemType Directory -Path $WorkDirectory | Out-Null
}

$PowerShellExe = (Get-Command powershell.exe -ErrorAction Stop).Source
$AutoSyncArguments = "-NoProfile -ExecutionPolicy Bypass -File `"$AutoSyncScript`""
$AutoSyncProcess = Start-Process -FilePath $PowerShellExe -ArgumentList $AutoSyncArguments -WorkingDirectory $ProjectRoot -WindowStyle Hidden -RedirectStandardOutput $SyncOutputLog -RedirectStandardError $SyncErrorLog -PassThru

$NodeCommand = Get-Command node.exe -ErrorAction SilentlyContinue
$NodeExe = if ($NodeCommand) {
  $NodeCommand.Source
} else {
  Join-Path $env:USERPROFILE ".cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
}

if (-not (Test-Path -LiteralPath $NodeExe)) {
  Stop-Process -Id $AutoSyncProcess.Id -Force -ErrorAction SilentlyContinue
  throw "Node.js was not found. Open the project in Codex once or install Node.js 22.13 or later."
}

$VinextCli = Join-Path $ProjectRoot "node_modules\vinext\dist\cli.js"
if (-not (Test-Path -LiteralPath $VinextCli)) {
  Stop-Process -Id $AutoSyncProcess.Id -Force -ErrorAction SilentlyContinue
  throw "The app dependencies are missing. Run pnpm install in the project folder once."
}

$NetworkAddresses = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
  Where-Object { $_.IPAddress -notlike "127.*" -and $_.IPAddress -ne "0.0.0.0" -and $_.AddressState -eq "Preferred" } |
  Select-Object -ExpandProperty IPAddress -Unique

Write-Host ""
Write-Host "Completed deals check is starting."
foreach ($Address in $NetworkAddresses) {
  Write-Host "Open on your local network: http://$($Address):3000/"
}
Write-Host "Automatic private GitHub saving is running in the background."
Write-Host "Keep this window open while using the app."
Write-Host ""

try {
  Push-Location $ProjectRoot
  & $NodeExe $VinextCli dev --hostname 0.0.0.0
  if ($LASTEXITCODE -ne 0) { throw "The local server stopped with an error." }
} finally {
  Pop-Location
  Stop-Process -Id $AutoSyncProcess.Id -Force -ErrorAction SilentlyContinue
}
