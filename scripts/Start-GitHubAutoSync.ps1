[CmdletBinding()]
param(
  [ValidateRange(30, 3600)]
  [int]$IntervalSeconds = 60
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Continue"

$SyncScript = Join-Path $PSScriptRoot "Sync-ToGitHub.ps1"
Write-Host "Automatic GitHub saving is active every $IntervalSeconds seconds."

while ($true) {
  try {
    & $SyncScript
  } catch {
    Write-Warning $_.Exception.Message
  }

  Start-Sleep -Seconds $IntervalSeconds
}
