# BIOTEX current-repository publisher (Windows PowerShell 5.1+ / PowerShell 7).
# Run from an extracted, trusted BIOTEX release archive. Never overwrites Git history.
[CmdletBinding()]
param(
    [string]$RepositoryUrl = 'https://github.com/Wilder-reyes/TERRA360-AI.git',
    [string]$Workspace = (Join-Path $env:USERPROFILE 'Documents\BIOTEX-github-release'),
    [string]$ExpectedBaseSha = '28359f896e305e1656884e99cef664b92a775b3b',
    [switch]$Publish,
    [switch]$RunBackendTests,
    [switch]$RunBrowserTests
)
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

function Invoke-Checked {
    param([string]$Exe, [string[]]$Arguments)
    & $Exe @Arguments
    if ($LASTEXITCODE -ne 0) { throw "Falló ($LASTEXITCODE): $Exe $($Arguments -join ' ')" }
}

$Source = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$Checkout = Join-Path $Workspace 'TERRA360-AI'
if ((Test-Path (Join-Path $Source '.git')) -and (Test-Path (Join-Path $Source 'frontend\package.json'))) {
    Write-Host 'Advertencia: el origen contiene .git; ese directorio siempre se excluye.'
}
if (-not (Test-Path (Join-Path $Source 'docs\BIOTEX_STAGE_4_TO_8_DELIVERY.md'))) {
    throw 'Este paquete no contiene todas las etapas 0 a 8.'
}
if (-not (Test-Path (Join-Path $Source 'frontend\vercel.json'))) {
    throw 'Falta la configuración frontend/vercel.json.'
}

New-Item -ItemType Directory -Path $Workspace -Force | Out-Null
if (Test-Path $Checkout) {
    if (-not (Test-Path (Join-Path $Checkout '.git'))) {
        throw "La ruta $Checkout existe y no es un checkout Git. Elige otro Workspace."
    }
    Push-Location $Checkout
    try {
        $origin = (& git remote get-url origin).Trim()
        if ($LASTEXITCODE -ne 0 -or $origin -notmatch 'Wilder-reyes/TERRA360-AI(\.git)?$') {
            throw 'El checkout de destino no corresponde a Wilder-reyes/TERRA360-AI.'
        }
        if ((& git status --porcelain).Count -gt 0) {
            throw 'Hay cambios locales en el checkout de destino. No los sobrescribiré.'
        }
        Invoke-Checked 'git' @('fetch','origin','main')
        Invoke-Checked 'git' @('switch','main')
        Invoke-Checked 'git' @('pull','--ff-only','origin','main')
    } finally { Pop-Location }
} else {
    Invoke-Checked 'git' @('clone','--single-branch','--branch','main',$RepositoryUrl,$Checkout)
}

Push-Location $Checkout
try {
    $headBefore = (& git rev-parse HEAD).Trim()
    $remoteBefore = (& git ls-remote origin refs/heads/main) -split '\s+' | Select-Object -First 1
    if ($LASTEXITCODE -ne 0 -or $headBefore -ne $remoteBefore) {
        throw 'El HEAD local no coincide con origin/main; no sobrescribiré cambios remotos.'
    }
    if ($ExpectedBaseSha -and $headBefore -ne $ExpectedBaseSha) {
        throw "main ha avanzado desde la versión revisada ($ExpectedBaseSha -> $headBefore). No se sobrescribirá trabajo de terceros. Revisa los cambios antes de actualizar ExpectedBaseSha."
    }
    Write-Host "Base de GitHub main: $headBefore"

    # Only copy release-package files; delete tracked legacy files not in this package.
    # Never touch .git, secrets, virtualenvs, node_modules or caches.
    $blockedParts = @('.git','.venv','venv','node_modules','dist','__pycache__','.cache','.vercel')
    $sourceRel = @{}
    $sourceFiles = Get-ChildItem -LiteralPath $Source -File -Recurse -Force
    foreach ($file in $sourceFiles) {
        $rel = $file.FullName.Substring($Source.Length).TrimStart('\','/').Replace('\','/')
        $pieces = $rel -split '/'
        if ($pieces | Where-Object { $blockedParts -contains $_ }) { continue }
        if ($file.Name -eq '.env' -or ($file.Name -like '.env.*' -and $file.Name -notin @('.env.example','.env.production.example'))) { continue }
        if ($rel -match '\.(pyc|log)$' -or $rel -match '\.tsbuildinfo$') { continue }
        $sourceRel[$rel] = $file.FullName
    }
    if ($sourceRel.Count -lt 300) { throw "Paquete incompleto: solo $($sourceRel.Count) archivos admitidos." }
    # The remote main gained a reviewed *commit* with a new NASA IMERG seed
    # after the archive base; preserve that scientific dataset on publish.
    $protectedRemotePaths = @('backend/app/data/imerg_basin_seed.json')
    $tracked = @(& git ls-files)
    if ($LASTEXITCODE -ne 0) { throw 'No se pudieron enumerar archivos versionados.' }
    foreach ($rel in $tracked) {
        if (-not $sourceRel.ContainsKey($rel) -and $rel -notin $protectedRemotePaths) {
            $dest = Join-Path $Checkout ($rel -replace '/', [IO.Path]::DirectorySeparatorChar)
            if (Test-Path -LiteralPath $dest -PathType Leaf) { Remove-Item -LiteralPath $dest -Force }
        }
    }
    foreach ($rel in $sourceRel.Keys) {
        $dest = Join-Path $Checkout ($rel -replace '/', [IO.Path]::DirectorySeparatorChar)
        $parent = Split-Path -Parent $dest
        if (-not (Test-Path $parent)) { New-Item -ItemType Directory -Path $parent -Force | Out-Null }
        Copy-Item -LiteralPath $sourceRel[$rel] -Destination $dest -Force
    }
    foreach ($path in $protectedRemotePaths) {
        if (-not (Test-Path -LiteralPath (Join-Path $Checkout $path))) { throw "Falta el dataset remoto que debe conservarse: $path" }
    }
    Invoke-Checked 'git' @('add','-A')
    # Existing historical modules include CRLF/trailing spaces; only reject tab/indent anomalies here.
    # The full source audit separately checks imports, Python syntax, and common secrets.
    Invoke-Checked 'git' @('-c','core.whitespace=-blank-at-eol,-blank-at-eof','diff','--cached','--check')
    $staged = @(& git diff --cached --name-only)
    Write-Host "Archivos cambiados respecto a GitHub: $($staged.Count)"
    & git diff --cached --stat

    # Mandatory offline scientific proof and frontend build before any push.
    Invoke-Checked 'python' @('scripts/reproduce_field_shift_ai.py','--check')
    Invoke-Checked 'python' @('docs/audit/reproduce_classification.py')
    Push-Location (Join-Path $Checkout 'frontend')
    try {
        Invoke-Checked 'npm.cmd' @('ci')
        Invoke-Checked 'npm.cmd' @('test')
        Invoke-Checked 'npm.cmd' @('run','build')
        if ($RunBrowserTests) {
            Invoke-Checked 'npx.cmd' @('playwright','install','chromium')
            Invoke-Checked 'npm.cmd' @('run','test:e2e')
        }
    } finally { Pop-Location }
    if ($RunBackendTests) {
        $venvDir = Join-Path $Checkout '.venv'
        if (-not (Test-Path $venvDir)) { Invoke-Checked 'python' @('-m','venv',$venvDir) }
        $py = Join-Path $venvDir 'Scripts\python.exe'
        Invoke-Checked $py @('-m','pip','install','-r','backend/requirements.txt')
        $env:PYTHONPATH = 'backend'
        try { Invoke-Checked $py @('-m','unittest','discover','-s','tests','-p','test_*.py','-v') }
        finally { Remove-Item Env:PYTHONPATH -ErrorAction SilentlyContinue }
    }
    if (-not $Publish) {
        Write-Host 'Verificación local terminada. No se publicó nada. Ejecuta con -Publish para subir a main.'
        exit 0
    }
    if ($staged.Count -eq 0) { Write-Host 'GitHub ya tiene los mismos archivos. No hay commit que crear.'; exit 0 }
    Invoke-Checked 'git' @('commit','-m','feat(biotex): integrate stages 0-8 as Vercel preview candidate')
    Invoke-Checked 'git' @('push','origin','main')
    $local = (& git rev-parse HEAD).Trim()
    $remote = (& git ls-remote origin refs/heads/main) -split '\s+' | Select-Object -First 1
    if ($LASTEXITCODE -ne 0 -or $local -ne $remote) { throw 'Push posiblemente incompleto: verificar estado de GitHub.' }
    Write-Host "Publicado en GitHub: https://github.com/Wilder-reyes/TERRA360-AI/commit/$local"
    Write-Host 'No se creó ningún Vercel; los checks remotos GitHub Actions aún deben verificarse.'
} finally { Pop-Location }
