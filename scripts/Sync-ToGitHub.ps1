[CmdletBinding()]
param(
  [string]$CommitMessage
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$ProjectRoot = Split-Path -Parent $PSScriptRoot
$GitDirectory = Join-Path $ProjectRoot "work\github-git"
$PrivateKey = Join-Path $ProjectRoot "work\github-deploy-key"
$KnownHosts = Join-Path $ProjectRoot "work\github-known-hosts"
$RemoteUrl = "ssh://git@ssh.github.com:443/rahulbaranwal-png/completed-deals-check.git"

if (-not (Test-Path -LiteralPath $GitDirectory)) {
  throw "The local Git history is missing from work\github-git."
}

if (-not (Test-Path -LiteralPath $PrivateKey)) {
  throw "The private GitHub sync key is missing from work\github-deploy-key."
}

$GitCommand = Get-Command git.exe -ErrorAction SilentlyContinue
$GitExe = if ($GitCommand) {
  $GitCommand.Source
} else {
  Join-Path $env:USERPROFILE ".cache\codex-runtimes\codex-primary-runtime\dependencies\native\git\cmd\git.exe"
}

if (-not (Test-Path -LiteralPath $GitExe)) {
  throw "Git was not found. Open this project in Codex once or install Git for Windows."
}

$GitRoot = Split-Path -Parent (Split-Path -Parent $GitExe)
$BundledSsh = Join-Path $GitRoot "usr\bin\ssh.exe"
$SshCommand = Get-Command ssh.exe -ErrorAction SilentlyContinue
$SshExe = if (Test-Path -LiteralPath $BundledSsh) {
  $BundledSsh
} elseif ($SshCommand) {
  $SshCommand.Source
} else {
  throw "SSH was not found. Install Git for Windows with its SSH tools."
}

$GitBaseArguments = @("--git-dir=$GitDirectory", "--work-tree=$ProjectRoot")
$PreviousSshCommand = $env:GIT_SSH_COMMAND
$env:GIT_SSH_COMMAND = ('"{0}" -i "{1}" -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new -o UserKnownHostsFile="{2}"' -f $SshExe, $PrivateKey, $KnownHosts)

try {
  & $GitExe @GitBaseArguments config user.name "Rahul Baranwal"
  if ($LASTEXITCODE -ne 0) { throw "Could not set the local Git author name." }

  & $GitExe @GitBaseArguments config user.email "rahul.baranwal@gain.ai"
  if ($LASTEXITCODE -ne 0) { throw "Could not set the local Git author email." }

  & $GitExe @GitBaseArguments remote get-url origin *> $null
  if ($LASTEXITCODE -eq 0) {
    & $GitExe @GitBaseArguments remote set-url origin $RemoteUrl
  } else {
    & $GitExe @GitBaseArguments remote add origin $RemoteUrl
  }
  if ($LASTEXITCODE -ne 0) { throw "Could not configure the GitHub repository." }

  & $GitExe @GitBaseArguments add --all
  if ($LASTEXITCODE -ne 0) { throw "Could not prepare the project changes for saving." }

  & $GitExe @GitBaseArguments diff --cached --quiet
  $DiffExitCode = $LASTEXITCODE
  if ($DiffExitCode -notin @(0, 1)) { throw "Could not inspect the pending project changes." }

  if ($DiffExitCode -eq 1) {
    if ([string]::IsNullOrWhiteSpace($CommitMessage)) {
      $CommitMessage = "Auto-save: $((Get-Date).ToString('yyyy-MM-dd HH:mm:ss zzz'))"
    }

    & $GitExe @GitBaseArguments commit -m $CommitMessage
    if ($LASTEXITCODE -ne 0) { throw "Could not create the automatic save point." }
    Write-Host "Saved project changes locally."
  } else {
    Write-Host "No new project changes to commit."
  }

  & $GitExe @GitBaseArguments push -u origin main
  if ($LASTEXITCODE -ne 0) { throw "Could not upload the project to GitHub. The local save point is still safe and will be retried." }
  Write-Host "GitHub is up to date."
} finally {
  $env:GIT_SSH_COMMAND = $PreviousSshCommand
}
