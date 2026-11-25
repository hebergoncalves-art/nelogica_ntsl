# 12A — Compatibilidade do Breaker e candidatos a OB

Status: ready-for-human

Depende do aceite da [11C](11C-liquidez-avancada.md). Cobre o Breaker legado e a preparação das fontes de OB descritos nas seções E1 e E2 da [spec](../SPEC_evolucao.md#e-breaker-block--entrega-12).

| Caso | Resultado esperado e observado no simulador | Status local |
| --- | --- | --- |
| D01 | Faixas da 11C idênticas em ambos os sentidos e ordens, com e sem mitigação por fechamento, FVG oculto e virada de sessão. `MostrarBBLegacy=False` oculta a faixa. | PASS |
| D02 | As duas fontes qualificam em compra e venda, no interno e no swing, e publicam uma vez em `u+1`. A remoção por pavio preserva a faixa LuxAlgo. Recarga, reavaliação e debug oculto mantêm os registros. | PASS |
| D03 | Doji ICT, alvo conhecido tarde, OHLC inválido, falha antes de `u` e deslocamento insuficiente impedem a qualificação. A barra extra, o deslocamento combinado, o buffer posterior e `LUX_SOURCE` seguem a spec. | PASS |
| D04 | As duas fontes produzem candidatos ao processar OHLC pelos detectores do indicador. Os cinco modos legados mantêm os desenhos da 11C. O adaptador calcula com os OBs e o debug ocultos. | PASS |

## Configuração

- `ModoBB=0` vem com os candidatos desligados. Os modos 1, 2 e 3 calculam a fundação comum. `MostrarBBLegacy=True` mantém a faixa existente subordinada a `MostrarBreakerBlocks` nos modos de faixa 1 e 2.
- `FonteOBBB=0` seleciona ICT e `FonteOBBB=1` seleciona o adaptador LuxAlgo. `EscalaBB=0/1/2` seleciona interna, swing ou ambas. O padrão é ambas.
- A busca ICT usa `MaxBuscaOrigemOBBB=20`. O deslocamento usa `DispATRBB=1.0`, `CorpoMinBB=0.65` e `MaxCandlesDispBB=3`. `MaxIdadeOBBB=150` limita a idade do registro.

## Revisão local

- Baseline 11C no commit `6fad88b`. SHA-256 do fonte 12A `028c8001e0d5c0b6a7b48092c5a595a2092316b37b2c0e7047d191364ddee2ad`.
- Verificação com `./scripts/verificar-indicador.ps1 -Indicador smc`. O simulador `node scripts/testar-regressao-smc.cjs` cobre 74 cenários, incluindo os 70 da 11C.
- Mediana de três execuções locais sobre 1.200 candles com debug desligado. A 11C levou 68,0 ms, a 12A em LEGACY 67,8 ms, ICT 317,9 ms e LuxAlgo 233,9 ms. A medição é do simulador JavaScript.
- Em 4.800 candles, ICT alocou 832 IDs ao longo do histórico e reteve no máximo 100 registros por escala e direção. O cenário teve reciclagem e nenhuma rejeição por falta de vaga, tanto com idade ilimitada quanto com limite de 20 barras.

## Validação no Profit Pro

Compilação e Replay pendentes.

1. Compilar a revisão 12A. Com `ModoBB=0`, `MostrarBreakerBlocks=True` e `MostrarFVG=False`, comparar os modos de faixa 1 e 2 com a revisão aceita da 11C. Conferir as ordens 1 e 2, a ancoragem em C, a virada de sessão e a retirada por fechamento.
2. Com `ModoBB=1`, `ModoFaixaOB=0` e `DebugSMC=True`, testar `FonteOBBB=0` e `1` no mesmo histórico. Conferir a origem do OB, as evidências de qualificação e o marcador na barra seguinte. Repetir com os desenhos de OB ocultos. Conferir barras com confirmações simultâneas.
3. Alternar `MostrarBBLegacy` e `DebugSMC` separadamente. Conferir a cópia do OB LuxAlgo após retirada por pavio e repetir com fechamento além da borda.
4. Registrar SHA-256, versão do Profit, ativo, período, tick, parâmetros e resultado observado de D01–D04. O aceite libera a 12B.
