# Cleanup script for obsolete TERRA360-AI branches with a full local recovery bundle.
# REQUIRES: GitHub CLI (gh auth login), git. Does not delete main, David or open-PR branches.
[CmdletBinding()]
param(
    [string]$Workspace = (Join-Path $env:USERPROFILE 'Documents\BIOTEX-github-release'),
    [switch]$Execute
)
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$Repo = Join-Path $Workspace 'TERRA360-AI'
if (-not (Test-Path (Join-Path $Repo '.git'))) { throw 'Ejecuta primero publish_current_repo.ps1.' }
Push-Location $Repo
try {
    & gh auth status 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'Inicia sesión con gh auth login antes de limpiar ramas.' }
    $remote = (& git remote get-url origin).Trim()
    if ($remote -notmatch 'Wilder-reyes/TERRA360-AI(\.git)?$') { throw 'Repositorio remoto inesperado.' }
    & git fetch origin '+refs/heads/*:refs/remotes/origin/*' --prune
    if ($LASTEXITCODE -ne 0) { throw 'No se pudieron descargar todas las ramas remotas.' }
    $mainSha = (& git rev-parse origin/main).Trim()
    & git cat-file -e 'origin/main:docs/BIOTEX_STAGE_4_TO_8_DELIVERY.md'
    if ($LASTEXITCODE -ne 0) { throw 'main todavía no tiene la entrega BIOTEX 0–8.' }
    $prs = & gh api --paginate 'repos/Wilder-reyes/TERRA360-AI/pulls?state=open&per_page=100' --jq '.[].head.ref'
    if ($LASTEXITCODE -ne 0) { throw 'No puedo revisar los PR abiertos; se cancela el borrado.' }
    $protected = @('main','David') + @($prs)
    $branches = @(& git for-each-ref '--format=%(refname:strip=3)' 'refs/remotes/origin')
    if ($LASTEXITCODE -ne 0) { throw 'No se pudieron enumerar las ramas.' }
    $candidates = @($branches | Where-Object { $_ -ne 'HEAD' -and $_ -notin $protected -and $_ -notlike 'release/*' })
    Write-Host "main: $mainSha | Ramas candidatas: $($candidates.Count)"
    Write-Host "Protegidas: $($protected -join ', ')"
    $candidates | ForEach-Object { Write-Host " - $_" }
    if (-not $Execute) { Write-Host 'Solo vista previa. Ejecuta -Execute para crear un backup y borrar las ramas listadas.'; exit 0 }
    if ($candidates.Count -eq 0) { Write-Host 'No hay ramas candidatas.'; exit 0 }
    $backupDir = Join-Path $Workspace 'branch-backups'
    New-Item -ItemType Directory -Path $backupDir -Force | Out-Null
    $bundle = Join-Path $backupDir ('TERRA360-AI-branches-' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '.bundle')
    & git bundle create $bundle --all
    if ($LASTEXITCODE -ne 0) { throw 'No se pudo crear el respaldo: no se borrará ninguna rama.' }
    & git bundle verify $bundle
    if ($LASTEXITCODE -ne 0) { throw 'El respaldo no se pudo verificar: se cancela.' }
    Write-Host "Backup verificable de todas las refs: $bundle"
    $deleted = @(); $failures = @()
    foreach ($branch in $candidates) {
        & git push origin --delete $branch
        if ($LASTEXITCODE -eq 0) { $deleted += $branch } else { $failures += $branch }
    }
    Write-Host "Ramas eliminadas: $($deleted.Count); errores: $($failures.Count)"
    if ($failures.Count -gt 0) { Write-Warning "Ramas no eliminadas: $($failures -join ', ')" }
    Write-Host 'main, David y ramas de PR abiertos han sido protegidas.'
} finally { Pop-Location }
