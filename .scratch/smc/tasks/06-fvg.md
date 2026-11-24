# 06 — Exibir Fair Value Gaps no período do gráfico

Status: ready-for-human

## Aceitação

- [x] Conferir formação nos dois sentidos, limiar, igualdade, mitigação, capacidade e recálculo nos [casos de referência](../casos.md#fair-value-gaps).
- [x] A comparação estática confirmou que a camada preserva o código de swing, estrutura interna, EQH/EQL e Order Blocks.
- [ ] Compilar no Profit. Pilotar duas faixas simultâneas, conferir extensão 0 e 1 e verificar que a faixa atravessa a virada de sessão e é removida após mitigação. Depois conferir a exibição de até cinco faixas. Se o preenchimento falhar, testar as bordas com `LineSegment` e registrar o resultado.
- [ ] Comparar em candles fechados com o LuxAlgo em `Historical`, usando o mesmo OHLC desde o início. Conferir ao menos um FVG de alta e um de baixa quanto ao candle de formação, limites e candle de mitigação.
- [ ] No Profit, conferir um único rótulo `FVG` por faixa de alta e de baixa, inclusive quando a faixa atravessa sessões. Conferir que o rótulo desaparece com a faixa após mitigação.

## Evidência

SHA-256 da revisão verificada com `./scripts/verificar-indicador.ps1 -Indicador smc`: `88addbfda623175ebe7aca5e24aa1d0ce419b2e79f6563faebbfaad377f13d0d`.

O teste local executou o trecho FVG do fonte traduzido para JavaScript, com chamadas de desenho simuladas. Cobriu formação nos dois sentidos, abertura zero, filtro cumulativo, igualdade, preenchimento parcial, mitigação simultânea, recálculo da mesma barra, retenção de 100 gaps e seleção das cinco faixas mais recentes. Verificou também os argumentos de duas faixas simultâneas e as bordas para extensão 0 e 1, inclusive na virada de sessão.

O Profit compilou a revisão inicial e exibiu avisos de contexto posicional nas linhas 850 e 851, nos acessos diretos a `Date[1]` e `Time[1]`. A revisão `015b358880a200e31506af3159dcc85b3a74c4319cb2e4f31359038bac9d6c62` registra data e hora nas séries de cada candle antes das condições. A verificação local confirmou que a origem usa o candle anterior, a borda direita usa o candle atual e o fonte ficou sem acessos históricos diretos a `Date` e `Time`. Falta recompilar essa revisão e verificar o desenho e a remoção das faixas no Profit.

A lista de FVG usa três quadros recentes. Um salto de recálculo para fora desses quadros exige reprocessar o histórico.

A revisão `bb65d95d1952f5c41feec94702a773f3478e0f71e2bcf230a181f35919fe9878`, verificada com `./scripts/verificar-indicador.ps1 -Indicador smc`, inclui o texto `FVG`. A conferência estática confirmou um rótulo no trecho inicial de cada uma das cinco faixas e texto vazio nos trechos de continuação. A verificação visual dessa revisão no Profit está pendente.

Na validação nas plataformas, registrar versão do Profit, ativo, período gráfico, início do histórico, sessão, fuso, parâmetros e resultados esperados e observados.
