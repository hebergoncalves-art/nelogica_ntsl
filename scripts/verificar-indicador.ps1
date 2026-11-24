[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [ValidatePattern('\A[a-z0-9]+(?:-[a-z0-9]+)*\z', Options = 'None')]
    [string] $Indicador
)

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
$sourcePath = Join-Path $repoRoot "src/indicadores/$Indicador.ntsl"
$featurePath = Join-Path $repoRoot ".scratch/$Indicador"
$tasksPath = Join-Path $featurePath 'tasks'

$missing = foreach ($path in @($sourcePath, (Join-Path $featurePath 'prd.md'), (Join-Path $featurePath 'spec.md'))) {
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
        $path
    }
}

$firstTask = if (Test-Path -LiteralPath $tasksPath -PathType Container) {
    Get-ChildItem -LiteralPath $tasksPath -Filter '*.md' -File | Select-Object -First 1
}
if (-not $firstTask) {
    $missing += "$(Join-Path $tasksPath '*.md') (ao menos uma tarefa)"
}

if ($missing) {
    throw ("Arquivos ausentes para '{0}':`n - {1}" -f $Indicador, ($missing -join "`n - "))
}

$hash = (Get-FileHash -LiteralPath $sourcePath -Algorithm SHA256).Hash.ToLowerInvariant()
Write-Output "SHA-256 $hash"
