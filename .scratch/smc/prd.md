# PRD — SMC Swing e Estrutura Interna

## Objetivo

Exibir no Profit Pro os rompimentos BOS e CHoCH da estrutura de swing da referência LuxAlgo. Quem usa o indicador deve conseguir conferir no gráfico a direção, o tipo, o candle e o nível de cada evento.

## Primeira entrega

- Detectar topos e fundos de swing confirmados e permitir exibir seus níveis para conferência.
- Exibir BOS e CHoCH de alta e de baixa no gráfico, com as marcações históricas.
- Comparar as duas plataformas em candles fechados com o mesmo histórico OHLC desde a inicialização.

## Segunda entrega

- Exibir BOS e CHoCH internos de alta e baixa com janela de 5 candles e filtro de confluência opcional.
- Usar a estrutura interna e a de swing no mesmo gráfico, com rótulos distintos e classificação independente.

## Terceira entrega

- Exibir os limites dos Order Blocks internos e de swing, com controles independentes de visibilidade e quantidade.
- Escolher o candle de origem e retirar blocos mitigados conforme os limites e a fonte de preço configurada.

## Quarta entrega

- Identificar topos e fundos confirmados de preços próximos com janela e sensibilidade próprias.
- Exibir `EQH` e `EQL` no candle de confirmação, no preço do segundo pivô.
- Conferir os pares e o candle de confirmação contra o LuxAlgo em candles fechados com o mesmo histórico OHLC.

## Quinta entrega

- Detectar Fair Value Gaps de alta e de baixa no período do gráfico, com filtro automático opcional.
- Exibir as cinco faixas ativas mais recentes, em verde para alta e vermelho para baixa. Ancorar a borda esquerda no candle central e a direita no candle de formação mais a extensão configurada.
- Remover a faixa quando o preço atravessar a borda oposta. Comparar direção, candle de formação, limites e candle de mitigação com o LuxAlgo.

## Sexta entrega

- Mostrar as zonas Premium, Equilibrium e Discount do intervalo de swing atual com rótulos e cores configuráveis.
- Atualizar os limites conforme surgem novos extremos e pivôs de swing.
- Comparar limites, origem e candle da atualização com o LuxAlgo.

## Sétima entrega

- Mostrar Breaker Blocks de swing nos modos de faixa 1 e 2 quando um Order Block romper em até três candles com um FVG sobreposto e sem repique na travessia.
- Marcar a inversão com os limites do Order Block original a partir do candle que confirma o FVG e retirar a faixa se o preço fechar além do limite na direção contrária.

FVG em outro período e níveis de outros períodos ficam para entregas posteriores.

[Especificação](spec.md) · [LuxAlgo SMC](https://www.luxalgo.com/library/indicator/smart-money-concepts-smc/)
