param(
  [string]$ServerHost = '159.198.65.35',
  [int]$Port = 22,
  [string]$User = 'mauri',
  [string]$RemoteBaseDir = '/home/mauri',
  [string]$RemoteServiceDir = '/home/mauri/switcher',
  [string]$Password
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Fail-Step {
  param([string]$Message)
  Write-Error $Message
  exit 1
}

function Require-Cmd {
  param([string]$Name)
  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    Fail-Step "No se encontro '$Name' en PATH."
  }
}

Require-Cmd tar
Require-Cmd plink
Require-Cmd pscp
Require-Cmd node

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
$switcherDir = Join-Path $repoRoot 'switcher'
if (-not (Test-Path $switcherDir)) {
  Fail-Step "No se encontro carpeta switcher en: $switcherDir"
}

if (-not $Password) {
  $secure = Read-Host -Prompt "Password SSH/sudo para $User@$ServerHost" -AsSecureString
  $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  try {
    $Password = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
  } finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
  }
}

if ([string]::IsNullOrWhiteSpace($Password)) {
  Fail-Step 'Password vacia.'
}

# Quick syntax check before shipping files
Write-Host 'Validando sintaxis Node...'
& node --check (Join-Path $switcherDir 'server.js')
& node --check (Join-Path $switcherDir 'stream-manager.js')
& node --check (Join-Path $switcherDir 'playlist-manager.js')
& node --check (Join-Path $switcherDir 'audio-loop-manager.js')

$timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$archiveLocal = Join-Path $env:TEMP "switcher-deploy-$timestamp.tgz"
$archiveRemote = "/home/$User/switcher-deploy-$timestamp.tgz"

try {
  Write-Host 'Empaquetando backend + audios...'
  Push-Location $repoRoot
  try {
    & tar -czf $archiveLocal `
      switcher/server.js `
      switcher/stream-manager.js `
      switcher/playlist-manager.js `
      switcher/audio-loop-manager.js `
      switcher/package.json `
      switcher/ecosystem.config.cjs `
      switcher/audio `
      switcher/.env.example
    if ($LASTEXITCODE -ne 0) {
      Fail-Step 'Fallo al crear el paquete tar.'
    }
  } finally {
    Pop-Location
  }

  if (-not (Test-Path $archiveLocal)) {
    Fail-Step 'No se pudo generar el paquete de deploy.'
  }

  Write-Host 'Subiendo paquete al servidor...'
  & pscp -pw $Password -P $Port $archiveLocal "${User}@${ServerHost}:${archiveRemote}"
  if ($LASTEXITCODE -ne 0) {
    Fail-Step 'Fallo al subir el paquete con pscp.'
  }

  $remoteScript = @(
    "set -e",
    "mkdir -p '$RemoteServiceDir/audio'",
    "tar -xzf '$archiveRemote' -C '$RemoteBaseDir'",
    "rm -f '$archiveRemote'",
    "pm2 restart all",
    "pm2 list"
  ) -join '; '
  $remoteScriptEscaped = $remoteScript.Replace('"', '\"')
  $sudoCmd = "sudo -S -p '' bash -lc ""$remoteScriptEscaped"""

  Write-Host 'Aplicando paquete y reiniciando PM2...'
  $sudoInput = "$Password`n"
  $sudoInput | & plink -pw $Password -P $Port "${User}@${ServerHost}" $sudoCmd
  if ($LASTEXITCODE -ne 0) {
    Fail-Step 'Fallo al aplicar deploy remoto.'
  }

  Write-Host 'Deploy backend completado.'
} finally {
  if (Test-Path $archiveLocal) {
    Remove-Item -LiteralPath $archiveLocal -Force
  }
}
