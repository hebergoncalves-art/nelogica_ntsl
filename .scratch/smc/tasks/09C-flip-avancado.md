# 09C — Flip avançado

Status: ready-for-human

Dependência aceita em [09B](09B-flip-poi.md). Escopo da [seção B3](../SPEC_evolucao.md#b3-avançado-09c).

| Caso | Resultado esperado |
| --- | --- |
| A01 | O modo estrito mantém a 09B. O modo EQ aceita igualdade dentro da tolerância. O modo sweep admite penetração de pelo menos um tick com recuperação no candle do extremo de reação. |
| A02 | Displacement exige ATR anterior ao início, corpo líquido, faixa de fechamento e candles direcionais. Volume usa a média anterior de `Volume`, excluindo o candle avaliado. SCORE registra evidência e REQUIRED exige qualificação. |
| A03 | O detector existente pode qualificar um Flip sem FVG visível. Evidência tardia no prazo publica apenas na barra seguinte à qualificação. Retorno ao nível, OHLC inválido e prazo esgotado impedem ativação. |
| A04 | Fibonacci congela no candle B, espelha compra e venda e usa critérios de centro, faixa inteira ou interseção. O filtro seleciona o POI e preserva o registro do Flip. |
| A05 | Extreme POI exige origem causal no extremo. Continuation POI exige ruptura causal após correção formada depois do Flip. Ambas as zonas seguem a gestão da 09B. |
| A06 | Defaults preservam os eventos, zonas e desenhos da 09B. Reavaliação intrabar e recarga não duplicam eventos. |

## Revisão e resultado local

- SHA-256 do fonte `be082bb10c7ba9be248710e194e15e07b987af03a160a166829ba64a7e72b415`, conferido por `./scripts/verificar-indicador.ps1 -Indicador smc`.
- `node scripts/testar-regressao-smc.cjs` passou nos 34 cenários, de B01–B12, F01–F09, P01–P07 e A01–A06. Os casos da 09C verificaram compra e venda, FVG oculto, qualificação no último candle do prazo, limites Fibonacci congelados, rejeição de Extreme sem origem causal e confirmação de Continuation somente após uma quebra elegível.
- `flipEventoConfirmacao` conserva o candle da quebra estrutural B. `flipEventoQualBarra` e `flipEventoQualPublicacao` registram o fechamento que completou a qualificação e sua publicação. Cada evidência tem o próprio timestamp. `flipEventoNota` conta evidências presentes na qualificação, de 0 a 3. O score integrado pertence à entrega 13.
- O prazo `MaxBarrasFVGFlip` vale para os filtros obrigatórios de displacement, FVG e volume e inclui o último candle. Foi usada a série `Volume` do Profit, que representa volume financeiro, com média das barras anteriores. As bandas HALF, PREFERRED e EXTREME usam seus limiares mínimos até 100%. [Manual NTSL](https://downloadserver-cdn.nelogica.com.br/content/profit/manual_ntsl/ManualNTSL.pdf)

## Validação no Profit Pro

Compilação, Replay, renderização e aceite da 09C estão pendentes.

1. Compilar a revisão acima. Usar `ModoFaixaOB=0`, `HabilitarFlip=True`, `MostrarFlip=True` e `MostrarFaixasFlip=True`. Conferir a equivalência com a 09B com os parâmetros novos nos defaults.
2. Testar separadamente `ModoFalhaFlip=1` para EQ e `ModoFalhaFlip=2` para sweep local. Ativar `MostrarFibFlip`, `MostrarExtremeFlip` e `MostrarContinuationFlip` e conferir as âncoras em compra e venda.
3. Testar cada filtro com `1` para registrar evidência e com `2` para exigir qualificação. Para FVG obrigatório, deixar `MostrarFVG=False` e conferir que a publicação ocorre na barra seguinte ao fechamento que completou os filtros.
4. Registrar SHA-256, versão do Profit, ativo, período, sessão, tick, parâmetros e resultado observado.
