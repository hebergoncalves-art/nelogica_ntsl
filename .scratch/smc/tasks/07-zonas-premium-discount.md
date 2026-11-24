# 07 — Exibir zonas Premium, Equilibrium e Discount

Status: ready-for-human

## Aceitação

- [x] Conferir os seis limites, o aquecimento, intervalo de amplitude zero, a expansão, a substituição de cada extremo e o recálculo da mesma barra nos [casos de referência](../casos.md#zonas-premium-equilibrium-e-discount).
- [x] A comparação estática confirmou que a camada preserva o código de swing, estrutura interna, EQH/EQL, Order Blocks e FVG.
- [ ] Compilar no Profit. Conferir as três faixas simultâneas, os rótulos na virada de sessão e a substituição do conjunto quando o intervalo mudar.
- [ ] Comparar em candles fechados com o LuxAlgo, usando o mesmo histórico OHLC e `PeriodoSwing`. Conferir origem, limites e o candle em que o novo pivô muda o desenho.

## Evidência

SHA-256 da revisão verificada com `./scripts/verificar-indicador.ps1 -Indicador smc`: `6e36705eef8a956490c97a0212c8d342cf0029c85539cba1c883d7418472830c`.

O teste local traduziu para JavaScript o bloco de desenho das zonas e o trecho de confirmação de swing. Checou os limites da tabela, a ausência de faixas no aquecimento e com amplitude zero, a expansão, a redefinição dos dois extremos, a ancoragem no candle do pivô, o recálculo e a ocultação nos modos de faixa de Order Block. As chamadas de desenho simuladas confirmaram as coordenadas e um rótulo por faixa na passagem entre sessões.

Faltam a compilação no Editor de Estratégias e a conferência visual no Profit e no LuxAlgo, inclusive a substituição das faixas anteriores após mudança do intervalo. Registrar versão do Profit, ativo, período gráfico, início do histórico, sessão, fuso, parâmetros e resultados esperados e observados.
