# Especificação — Indicador Fechamento

- **Tipo no Profit Pro** é Estratégia de Indicadores.
- **Fonte** está em [`src/indicadores/fechamento.ntsl`](../../src/indicadores/fechamento.ntsl).
- **Entrada** é a série `Close` do ativo e do período do gráfico. O indicador não tem parâmetros configuráveis.
- **Saída** é uma série. Em cada candle, `Plot(Close)` recebe o valor de `Close` do próprio candle.
- **Conferência** usa três candles já fechados. O valor mostrado no plot e o fechamento do candle devem coincidir na precisão exibida pelo Profit.

[Manual NTSL](https://downloadserver-cdn.nelogica.com.br/content/profit/manual_ntsl/ManualNTSL.pdf) · [Estratégia de Indicadores](https://ajuda.nelogica.com.br/hc/pt-br/articles/4407276903579-Estrat%C3%A9gia-de-Indicadores)
