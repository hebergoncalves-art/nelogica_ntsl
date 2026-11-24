# 05 — Exibir EQH e EQL

Status: ready-for-human

## Aceitação

- [x] A detecção respeita a janela independente, os pivôs anteriores do mesmo tipo, o aquecimento do ATR e a tolerância estrita. O teste local cobre os [casos de referência](../casos.md#eqheql).
- [x] A comparação local preserva a lógica dos sinais de swing, da estrutura interna e dos Order Blocks. O ATR produz os mesmos valores com EQH/EQL ligado ou desligado quando os blocos estão ativos.
- [ ] O usuário compila a revisão no Editor de Estratégias do Profit e vê EQH em vermelho e EQL em verde no candle de confirmação e no preço do segundo pivô.
- [ ] Em candles fechados com OHLC comum desde a inicialização, compare com o LuxAlgo em `Historical` ao menos um EQH, um EQL e um par fora da tolerância. Confira as origens dos dois pivôs, os preços e o candle de confirmação. Recarregue o gráfico e confira se os rótulos se repetem nos mesmos candles.

## Evidência

SHA-256 do fonte verificado com `./scripts/verificar-indicador.ps1 -Indicador smc`: `e1f85fc84981bff4ba1884416e92d3c144b65c9b235b398a532dbdcb7b85eea4`.

O teste local traduziu os trechos de ATR e EQH/EQL do fonte para JavaScript e executou sequências sintéticas. Conferiu os rótulos e seus preços, a tolerância estrita nos dois sentidos, o aquecimento, os empates, a prioridade do topo, os limites dos parâmetros e a reavaliação do mesmo candle. O teste também conferiu a semente do ATR e a inclusão de gaps no True Range. A comparação estática isolou as adições e verificou que a lógica original de swing, estrutura interna e Order Blocks coincide com a revisão anterior.

A terceira faixa de swing e a mitigação da faixa continuam pendentes de conferência visual na revisão de referência da [tarefa 04](04-order-blocks.md). A compilação e a comparação de EQH/EQL no Profit e no TradingView também estão pendentes.

Registre o SHA-256 do fonte, a versão do Profit, ativo, período, sessão, fuso, início do histórico, parâmetros e resultados esperados e observados. A comparação dos sinais usa o candle de confirmação mesmo quando o TradingView posiciona o desenho entre os pivôs.
