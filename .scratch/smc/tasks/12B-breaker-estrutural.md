# 12B — Breaker Block estrutural

Status: aceita

Depende do aceite da [12A](12A-breaker-compatibilidade.md). Cobre ICT Strict e SMC Flexible das seções E3 e E4 da [spec](../SPEC_evolucao.md#e-breaker-block--entrega-12).

| Caso | Resultado no simulador | Status local |
| --- | --- | --- |
| E01 | Flexible sem captura nas duas fontes, escalas e direções. Faixa original e publicação em `a+1` com debug desligado. | PASS |
| E02 | Strict com LG, SW e SH, tomada no fechamento de qualificação do OB, recuperação junto da quebra, alvo protegido com buffer e faixa única em BOTH. | PASS |
| E03 | Falha e quebra nas duas ordens, prazos inclusivos, gap, ambiguidade, OHLC inválido, fresh e remoção LuxAlgo por pavio. | PASS |
| E04 | Filtros opcionais e obrigatórios. Confirmações ICT e LuxAlgo produzidas a partir de OHLC sem injeção de eventos. | PASS |
| E05 | Desenhos da 12A idênticos nos cinco modos legados. Dependência de liquidez oculta mantém os registros públicos e reutiliza seu ID quando a tomada coincide. | PASS |
| E06 | Ordens 1 e 2 escolhem zonas de preços e datas diferentes. Recarga e virada de sessão mantêm faixa e âncora. | PASS |

## Configuração e validação no Profit Pro

O usuário informou em 25/11/2026 que os testes da 12B passaram e autorizou a 12C. O aceite se refere ao commit `b214fd3` e ao SHA-256 abaixo. Um dos prints mostra `BB+ I Strict` no Profit. Versão do Profit, ativo, período e resultados individuais do Replay não foram informados.

1. Compilar o fonte. Com `DebugSMC=False`, ligar `MostrarBBEstrutural` e selecionar `ModoBB=1` para Strict, `2` para Flexible ou `3` para ambos. Usar `FonteOBBB=0` para ICT ou `1` para LuxAlgo.
2. Selecionar `ModoFaixaOB=9/10/11/12` para swing comprador, swing vendedor, interno comprador ou interno vendedor. Comparar o mesmo trecho entre modelos, alternar `OrdemFaixaSMC` e conferir publicação na próxima barra, faixa inteira e âncora.
3. No Replay, conferir captura, falha e quebra nos [casos de referência](../casos.md#breaker-estrutural-confirmado). Alternar `TipoQuebraBB=0` e `1`. Repetir com a liquidez visual desligada e comparar forma e horário da faixa. No modo legado, comparar a faixa cinza com a revisão aceita da 12A.
4. Registrar revisão, versão do Profit, ativo, período, tick, parâmetros e resultados de E01–E06. O aceite libera a 12C.

## Revisão local

- Referência aceita da 12A em `d8cf9f7`. SHA-256 da 12B `5e1702dacab7050bbad1a69ecf91514fd4801315d77e2a97fbf59f406a13fb40`.
- O verificador `./scripts/verificar-indicador.ps1 -Indicador smc` conferiu o SHA-256. A suíte `node scripts/testar-regressao-smc.cjs` passou nos 80 cenários, incluindo as 74 regressões da 12A.
- No simulador JavaScript, as medianas de três medições sobre 1.200 candles com debug desligado foram 22,2 ms na 12A legada, 252,7 ms na 12A com candidatos, 25,7 ms na 12B legada, 404,7 ms no Strict e 315,6 ms no Flexible.
