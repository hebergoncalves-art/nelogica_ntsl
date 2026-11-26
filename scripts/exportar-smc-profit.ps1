[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [ValidateSet('Indicador', 'Alarme')]
    [string] $Tipo,

    [Parameter(Mandatory = $true)]
    [string] $Destino
)

$ErrorActionPreference = 'Stop'
$fonte = Join-Path (Split-Path -Parent $PSScriptRoot) 'src/indicadores/smc.ntsl'
$conteudo = [IO.File]::ReadAllText($fonte)
if ($Tipo -eq 'Indicador') {
    # Mantem a sintaxe dos blocos condicionais ao retirar a chamada de alarme.
    $conteudo = $conteudo -creplace '\bAlert\(cl(?:Green|Red)\)', 'integracaoAlertar := False'
}

$caminho = $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($Destino)
$bytes = [Text.Encoding]::UTF8.GetBytes($conteudo)
$arquivo = [IO.File]::Open($caminho, [IO.FileMode]::CreateNew, [IO.FileAccess]::Write)
try {
    $arquivo.Write($bytes, 0, $bytes.Length)
}
finally {
    $arquivo.Dispose()
}
Get-FileHash -LiteralPath $caminho -Algorithm SHA256
