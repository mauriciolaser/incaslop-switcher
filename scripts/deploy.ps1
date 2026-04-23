param(
  [string]$branch = 'main',
  [bool]$DeployDashboard = $true,
  [bool]$DeploySwitcher = $true,
  [string]$Repo = 'mauriciolaser/incaslop-switcher',
  [switch]$DebugDeploy
)

function Fail-Step {
  param([string]$Message)
  Write-Error $Message
  exit 1
}

if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
  Fail-Step "GitHub CLI ('gh') no esta instalado o no esta en PATH."
}

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
  Fail-Step "Git no esta instalado o no esta en PATH."
}

# Verifica que estes autenticado en GH CLI
gh auth status 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) {
  gh auth login
  if ($LASTEXITCODE -ne 0) {
    Fail-Step "No se pudo completar la autenticacion con GitHub CLI."
  }
}

$resolvedBranch = git rev-parse --verify $branch 2>$null
if ($LASTEXITCODE -ne 0) {
  Fail-Step "La rama o ref '$branch' no existe localmente."
}

Write-Host "== Deploy context =="
Write-Host "Repo objetivo: $Repo"
Write-Host "Ref solicitada: $branch"
Write-Host "Commit local: $resolvedBranch"
Write-Host "Deploy dashboard: $DeployDashboard"
Write-Host "Deploy switcher: $DeploySwitcher"
Write-Host "Modo debug: $DebugDeploy"

$debugValue = if ($DebugDeploy) { 'true' } else { 'false' }
$workflowArgs = @(
  "workflow", "run", "Deploy Switcher",
  "-R", $Repo,
  "--ref", $branch,
  "-f", "deploy_dashboard=$($DeployDashboard.ToString().ToLowerInvariant())",
  "-f", "deploy_switcher=$($DeploySwitcher.ToString().ToLowerInvariant())",
  "-f", "debug=$debugValue"
)

Write-Host "Lanzando workflow de despliegue..."
& gh @workflowArgs

if ($LASTEXITCODE -ne 0) {
  Fail-Step "GitHub CLI no pudo lanzar el workflow 'Deploy Switcher'."
}

Write-Host "Workflow enviado correctamente."
