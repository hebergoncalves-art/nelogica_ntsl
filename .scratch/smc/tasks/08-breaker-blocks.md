# 08 — Exibir Breaker Blocks de swing

Status: ready-for-human

Depende da detecção de [Order Blocks](04-order-blocks.md) e [FVG](06-fvg.md).

## Aceitação

- [x] Exercitar os [casos de referência](../casos.md#breaker-blocks-de-swing) para as duas direções, repique, confluência, limites, publicação, invalidação, quantidade e recálculo.
- [x] Conferir a seleção nos modos 1 e 2 e verificar a equivalência do código anterior com a opção desligada.
- [ ] Compilar no Profit e usar Replay para ver a primeira aparição das faixas, um repique rejeitado, a virada da sessão e a remoção após invalidação.
- [ ] Conferir nos modos 1 e 2 a faixa cinza-claro com um único rótulo `Breaker`, inclusive quando atravessar sessões.

## Evidência

SHA-256 verificado com `./scripts/verificar-indicador.ps1 -Indicador smc`: `4fe9c039fed96f1eb7574295a328610d00a1c173a0e2cc97322386c4b0d123c0`.

O teste local executou em JavaScript os trechos do fonte que capturam a remoção do OB, detectam o FVG e mantêm os Breakers. Usou OBs pré-configurados e chamadas de desenho simuladas. Conferiu as duas direções, a publicação na abertura seguinte, repique, toque sem sobreposição, filtro automático, remoção por máxima/mínima ou por fechamento, invalidação por fechamento, seleção por ordem, capacidade e recálculo sem duplicação. A comparação estática isolou a nova camada e conferiu a preservação da lógica anterior.

A revisão `adb3ce8479a06291df0eb32ce4bddd15dc2ee3919d296cdd54be5ce45ec6ab94` passou no verificador e na conferência estática de `clLtGray` nos dois trechos e do rótulo `Breaker` apenas no trecho inicial.

Faltam a compilação e o Replay no Profit, incluindo a convivência com a faixa de OB, a troca de sessão e a remoção do desenho. Os quadros de recálculo guardam estados recentes. Saltar para um candle fora desses quadros exige reprocessar o histórico. Registrar versão do Profit, ativo, período, sessão, parâmetros, candles A–C e limites observados.
