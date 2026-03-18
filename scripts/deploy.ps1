param(
  [string]$branch = 'main',
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

$remoteUrl = git remote get-url origin 2>$null
if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($remoteUrl)) {
  Fail-Step "No se pudo obtener el remote 'origin'."
}

$resolvedBranch = git rev-parse --verify $branch 2>$null
if ($LASTEXITCODE -ne 0) {
  Fail-Step "La rama o ref '$branch' no existe localmente."
}

Write-Host "== Deploy context =="
Write-Host "Repo remoto: $remoteUrl"
Write-Host "Ref solicitada: $branch"
Write-Host "Commit local: $resolvedBranch"
Write-Host "Modo debug: $DebugDeploy"

$workflowArgs = @("workflow", "run", "Deploy", "--ref", $branch)
if ($DebugDeploy) {
  $workflowArgs += @("-f", "debug=true")
}

Write-Host "Lanzando workflow de despliegue..."
& gh @workflowArgs

if ($LASTEXITCODE -ne 0) {
  Fail-Step "GitHub CLI no pudo lanzar el workflow 'Deploy'."
}

Write-Host "Workflow enviado correctamente."
