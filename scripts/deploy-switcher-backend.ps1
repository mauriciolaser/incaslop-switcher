param(
  [string]$ServerHost = '159.198.65.35',
  [int]$Port = 22,
  [string]$User = '',
  [string]$RemoteBaseDir = '/home/mauri',
  [string]$RemoteServiceDir = '/home/mauri/switcher',
  [string]$RemoteTempDir = '/tmp',
  [string]$FtpHost = '',
  [string]$FtpUser = '',
  [string]$FtpPassword = '',
  [string]$FtpDestination = '',
  [switch]$SkipDashboard,
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

function Escape-BashSingleQuoted {
  param([string]$Value)
  return $Value.Replace("'", "'""'""'")
}

function Get-CredentialsFromFile {
  param([string]$Path)
  if (-not (Test-Path $Path)) { return @{} }
  $raw = Get-Content -Raw $Path
  $cred = @{
    users = @{}
    kv = @{}
  }
  $currentUser = ''
  foreach ($line in ($raw -split "`r?`n")) {
    if ($line -match '^\s*([A-Za-z0-9_]+)\s*:\s*(.+?)\s*$') {
      $k = $Matches[1].Trim().ToLowerInvariant()
      $v = $Matches[2].Trim()
      $cred.kv[$k] = $v
    }
    if ($line -match '^\s*user\s*:\s*(.+?)\s*$') {
      $currentUser = $Matches[1].Trim()
      if (-not $cred.users.ContainsKey($currentUser)) {
        $cred.users[$currentUser] = @{}
      }
      continue
    }
    if ($line -match '^\s*pass\s*:\s*(.+?)\s*$' -and $currentUser) {
      $cred.users[$currentUser]['pass'] = $Matches[1].Trim()
    }
  }
  return $cred
}

function Invoke-FtpUpload {
  param(
    [string]$FtpHost,
    [string]$User,
    [string]$Password,
    [string]$Destination,
    [string]$LocalPath
  )

  $dest = $Destination.Trim()
  if (-not $dest.EndsWith('/')) { $dest = "$dest/" }
  $url = "ftp://$FtpHost/$dest"

  & curl.exe --silent --show-error --fail `
    --user "${User}:${Password}" `
    --ftp-create-dirs `
    -T $LocalPath `
    $url
  if ($LASTEXITCODE -ne 0) {
    Fail-Step "Fallo FTP subiendo: $LocalPath"
  }
}

function Invoke-Remote {
  param(
    [string]$Password,
    [int]$Port,
    [string]$User,
    [string]$ServerHost,
    [string]$Command,
    [bool]$UseSudo
  )

  $cmdEscaped = Escape-BashSingleQuoted $Command
  if ($UseSudo) {
    $remoteCmd = "sudo -S -p '' bash -lc '$cmdEscaped'"
    $sudoInput = "$Password`n"
    $sudoInput | & plink -batch -pw $Password -P $Port "${User}@${ServerHost}" $remoteCmd
  } else {
    $remoteCmd = "bash -lc '$cmdEscaped'"
    & plink -batch -pw $Password -P $Port "${User}@${ServerHost}" $remoteCmd
  }
  if ($LASTEXITCODE -ne 0) {
    Fail-Step "Fallo comando remoto: $Command"
  }
}

Require-Cmd tar
Require-Cmd plink
Require-Cmd pscp
Require-Cmd node
Require-Cmd curl.exe

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
$switcherDir = Join-Path $repoRoot 'switcher'
if (-not (Test-Path $switcherDir)) {
  Fail-Step "No se encontro carpeta switcher en: $switcherDir"
}

if ([string]::IsNullOrWhiteSpace($User) -or [string]::IsNullOrWhiteSpace($Password)) {
  $credFile = Join-Path $repoRoot 'credenciales.txt'
  $fileCred = Get-CredentialsFromFile $credFile
  if ([string]::IsNullOrWhiteSpace($User)) {
    if ($fileCred.users.ContainsKey('root')) {
      $User = 'root'
      $RemoteBaseDir = '/home/mauri'
      $RemoteServiceDir = '/home/mauri/switcher'
    } elseif ($fileCred.users.ContainsKey('mauri')) {
      $User = 'mauri'
    }
  }
  if ([string]::IsNullOrWhiteSpace($Password) -and $fileCred.users.ContainsKey($User)) {
    $Password = $fileCred.users[$User]['pass']
  }

  if ([string]::IsNullOrWhiteSpace($FtpHost) -and $fileCred.kv.ContainsKey('frontend_ftp_host')) {
    $FtpHost = $fileCred.kv['frontend_ftp_host']
  }
  if ([string]::IsNullOrWhiteSpace($FtpUser) -and $fileCred.kv.ContainsKey('frontend_ftp_user')) {
    $FtpUser = $fileCred.kv['frontend_ftp_user']
  }
  if ([string]::IsNullOrWhiteSpace($FtpPassword) -and $fileCred.kv.ContainsKey('frontend_ftp_pass')) {
    $FtpPassword = $fileCred.kv['frontend_ftp_pass']
  }
  if ([string]::IsNullOrWhiteSpace($FtpDestination) -and $fileCred.kv.ContainsKey('frontend_ftp_destination')) {
    $FtpDestination = $fileCred.kv['frontend_ftp_destination']
  }
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

if ([string]::IsNullOrWhiteSpace($User)) {
  Fail-Step 'Usuario SSH vacio.'
}

$useSudo = $User -ne 'root'
$dashboardDir = Join-Path $repoRoot 'dashboard'

if (-not $SkipDashboard) {
  if (-not (Test-Path (Join-Path $dashboardDir 'index.html'))) { Fail-Step 'Falta dashboard/index.html' }
  if (-not (Test-Path (Join-Path $dashboardDir 'config.js'))) { Fail-Step 'Falta dashboard/config.js' }
  if (-not (Test-Path (Join-Path $dashboardDir '.htaccess'))) { Fail-Step 'Falta dashboard/.htaccess' }
  if ([string]::IsNullOrWhiteSpace($FtpHost) -or [string]::IsNullOrWhiteSpace($FtpUser) -or [string]::IsNullOrWhiteSpace($FtpPassword) -or [string]::IsNullOrWhiteSpace($FtpDestination)) {
    Fail-Step 'Faltan credenciales FTP para dashboard (host/user/pass/destination).'
  }
}

# Quick syntax check before shipping files
Write-Host 'Validando sintaxis Node...'
& node --check (Join-Path $switcherDir 'server.js')
& node --check (Join-Path $switcherDir 'user-service.js')
& node --check (Join-Path $switcherDir 'stream-manager.js')
& node --check (Join-Path $switcherDir 'playlist-manager.js')
& node --check (Join-Path $switcherDir 'audio-loop-manager.js')
& node --check (Join-Path $switcherDir 'settings-manager.js')
& node --check (Join-Path $switcherDir 'named-playlist-store.js')
& node --check (Join-Path $switcherDir 'schedule-manager.js')
& node --check (Join-Path $switcherDir 'log-manager.js')
& node --check (Join-Path $switcherDir 'telegram-notifier.js')

$timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$archiveLocal = Join-Path $env:TEMP "switcher-deploy-$timestamp.tgz"
$archiveRemote = "$RemoteTempDir/switcher-deploy-$timestamp.tgz"

try {
  Write-Host 'Empaquetando backend + audios...'
  Push-Location $repoRoot
  try {
    & tar -czf $archiveLocal `
      switcher/server.js `
      switcher/user-service.js `
      switcher/stream-manager.js `
      switcher/playlist-manager.js `
      switcher/audio-loop-manager.js `
      switcher/settings-manager.js `
      switcher/named-playlist-store.js `
      switcher/schedule-manager.js `
      switcher/log-manager.js `
      switcher/telegram-notifier.js `
      switcher/package.json `
      switcher/ecosystem.config.cjs `
      switcher/audio `
      switcher/audio-playlist `
      switcher/video-playlist `
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
  & pscp -batch -pw $Password -P $Port $archiveLocal "${User}@${ServerHost}:${archiveRemote}"
  if ($LASTEXITCODE -ne 0) {
    Fail-Step 'Fallo al subir el paquete con pscp.'
  }

  Write-Host 'Aplicando paquete en servidor...'
  Invoke-Remote -Password $Password -Port $Port -User $User -ServerHost $ServerHost -UseSudo $useSudo -Command "set -e; mkdir -p '$RemoteServiceDir/audio' '$RemoteServiceDir/audio-playlist' '$RemoteServiceDir/video-playlist' '$RemoteServiceDir/data'"
  Invoke-Remote -Password $Password -Port $Port -User $User -ServerHost $ServerHost -UseSudo $useSudo -Command "set -e; tar -xzf '$archiveRemote' -C '$RemoteBaseDir'"
  Invoke-Remote -Password $Password -Port $Port -User $User -ServerHost $ServerHost -UseSudo $useSudo -Command "set -e; rm -f '$archiveRemote'"
  Invoke-Remote -Password $Password -Port $Port -User $User -ServerHost $ServerHost -UseSudo $useSudo -Command "set -e; cd '$RemoteServiceDir'; npm install --omit=dev"

  Write-Host 'Reiniciando PM2...'
  Invoke-Remote -Password $Password -Port $Port -User $User -ServerHost $ServerHost -UseSudo $useSudo -Command "set -e; pm2 restart all || pm2 start '$RemoteServiceDir/ecosystem.config.cjs'"
  Invoke-Remote -Password $Password -Port $Port -User $User -ServerHost $ServerHost -UseSudo $useSudo -Command "set -e; pm2 list"

  if (-not $SkipDashboard) {
    Write-Host 'Subiendo dashboard por FTP...'
    Invoke-FtpUpload -FtpHost $FtpHost -User $FtpUser -Password $FtpPassword -Destination $FtpDestination -LocalPath (Join-Path $dashboardDir 'index.html')
    Invoke-FtpUpload -FtpHost $FtpHost -User $FtpUser -Password $FtpPassword -Destination $FtpDestination -LocalPath (Join-Path $dashboardDir 'config.js')
    Invoke-FtpUpload -FtpHost $FtpHost -User $FtpUser -Password $FtpPassword -Destination $FtpDestination -LocalPath (Join-Path $dashboardDir '.htaccess')
    Write-Host 'Deploy dashboard completado.'
  }

  Write-Host 'Deploy switcher completado.'
} finally {
  if (Test-Path $archiveLocal) {
    Remove-Item -LiteralPath $archiveLocal -Force
  }
}
