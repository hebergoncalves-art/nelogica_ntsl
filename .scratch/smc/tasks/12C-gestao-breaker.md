# 12C — Gestão e exibição dos Breaker Blocks

Status: ready-for-human

Depende do aceite da [12B](12B-breaker-estrutural.md). Cobre geometria, ciclo de vida e desenho do Breaker estrutural. [Especificação](../SPEC_evolucao.md#f-ciclo-de-vida-comum-das-zonas-09b12c)

| Caso | Resultado do simulador | Status local |
| --- | --- | --- |
| K01 | FULL, REFINED, BODY e BASE com as duas fontes, escalas e direções. A faixa escolhida governa tanto a falha quanto o desenho. | PASS |
| K02 | A visita começa no toque da proximal. Os marcos de 50% e 100% são persistidos. Gap, lado de aproximação, idade, visitas e políticas de exibição seguem a spec. | PASS |
| K03 | Os dois modos de reteste publicam na barra seguinte à confirmação. O alvo já existe antes do toque e a invalidação prevalece sobre reteste e expiração. | PASS |
| K04 | Painel e slots compartilham o ranking. Guias, rótulos, limite visual e cores são configuráveis. A confirmação FULL e os desenhos legados foram comparados com a 12B. | PASS |

## Configuração e validação no Profit Pro

Compilação e Replay pendentes.

1. Compilar o fonte. Na instância principal, usar `ModoFaixaOB=0`, `ModoBB=3` e `MostrarBBEstrutural=True`. Manter `DebugSMC=False`. Conferir várias zonas com `MaxBBVisiveis` e comparar uma faixa isolada no slot 9, 10, 11 ou 12 com a zona correspondente do painel.
2. Em Replay, comparar as quatro geometrias e conferir a barra de confirmação. A faixa selecionada determina a falha e permanece fixa após a publicação. Alternar rótulo, guia do meio, guia de origem, cor e marcadores de candidatos.
3. Conferir toque, mitigação, gap, reteste e fim da faixa nos [casos de referência](../casos.md#gestão-da-zona-confirmada). Alternar as três políticas de exibição da invalidação. Verificar a ancoragem do trecho histórico após recarga e virada de sessão.
4. Registrar revisão, versão do Profit, ativo, período, tick, parâmetros e resultados de K01–K04. O aceite libera a entrega 13.

## Revisão local

- Referência aceita da 12B em `b214fd3`. SHA-256 da 12C `5f4d48907bbf0ffba490d63e91889e5f66ba61669957083403d83ef278d7e817`.
- O verificador `./scripts/verificar-indicador.ps1 -Indicador smc` confirmou o SHA-256. A suíte `node scripts/testar-regressao-smc.cjs` passou em 84 cenários, incluindo as 80 regressões da 12B.
- No simulador, em 1.310 candles e com debug desligado, a mediana de três execuções foi de 29,3 ms na 12B legada e 28,2 ms na 12C legada. Com cálculo estrutural habilitado, a mediana foi de 389,7 ms no slot da 12B, 618,2 ms no slot da 12C e 556,4 ms no painel da 12C.
