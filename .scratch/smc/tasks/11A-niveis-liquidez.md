# 11A — Níveis de liquidez e Liquidity Grab

Status: aceita

Depende do aceite da [10C](10C-modelos-idm.md) e cobre a [seção D1](../SPEC_evolucao.md#d1-níveis-e-lg-11a).

| Caso | Resultado esperado | Resultado local |
| --- | --- | --- |
| L01 | BSL e SSL sobrevivem ao toque exato e publicam LG na barra seguinte à primeira penetração com recuperação. | PASS |
| L02 | Gap completo, tomada abaixo do mínimo, fechamento além, buffer insuficiente e pavio insuficiente consomem a geração sem LG. OHLC inválido encerra sem tomada. Os limites exatos qualificam. | PASS |
| L03 | Penetração anterior ou no candle de confirmação bloqueia a fonte. Preços iguais agrupam fontes, preços adjacentes permanecem separados e eventos dos dois lados podem ocorrer no mesmo candle. Nova origem pode criar nova geração após a tomada. | PASS |
| L04 | IDM estrutural e POST_BOS são fontes quando ativos. Expiração retira o IDM sem retirar o pivô associado. Tomada simultânea à perda de contexto preserva o fato físico. FLIP_LOCAL e IDM desligado não fornecem níveis. | PASS |
| L05 | O limite é 100 gerações e 600 vínculos por lado. O histórico terminal mais antigo libera espaço e níveis ativos são preservados. | PASS |
| L06 | Até 20 linhas ativas e até 20 capturas podem aparecer com seleção independente. Linha, rótulo, fonte e marcador curto preservam o histórico. | PASS |
| L07 | Com liquidez desligada, os cinco modos de faixa reproduzem a revisão aceita da 10C. Com a fonte interna ligada, o OHLC produz LG mesmo com a estrutura interna oculta. | PASS |

## Parâmetros e registros

- `HabilitarCapturasLiquidez=False` controla o cálculo. `FonteIDM`, `FonteSwingInterno` e `FonteSwingExterno` vêm ligadas. A fonte IDM usa apenas registros ativos de um módulo IDM habilitado.
- `MinCapturaTicks=1` exige pelo menos um tick. `BufferRecuperacaoTicks=0` aceita recuperação exatamente no nível. Ambos são inteiros. `MinPavioGrab=0` desliga o filtro e aceita proporções de 0 a 1.
- `MostrarCapturasLiquidez=False` e `MostrarNiveisLiquidez=False` controlam os dois grupos de desenho. `MostrarBSL`, `MostrarSSL`, `MostrarLiquidityGrab`, `MostrarLinhaCaptura`, `MostrarRotuloLQ` e `MostrarFonteLQ` vêm ligados. `MaxCapturasLQVisiveis=20` pode reduzir a seleção até zero. As linhas ativas têm limite fixo de 20.
- A geração retém sua primeira origem e data de ativação. Os vínculos retêm origem, referência, ativação, encerramento e participação na tomada. A captura usa o ID da geração e guarda o extremo, a profundidade em ticks e os horários de tomada e publicação. `BREAK_STARTED` termina a geração nesta entrega. A recuperação posterior pertence à 11B.

## Revisão local

- SHA-256 do fonte `7b885e3c948ebf4abe58346b916abe77daa7599d1ad2620f53bff6f1fe253ed3`.
- `./scripts/verificar-indicador.ps1 -Indicador smc` conferiu a estrutura. `node scripts/testar-regressao-smc.cjs` passou nos 58 cenários, incluindo os 51 anteriores.

## Validação no Profit Pro

O usuário informou em 24/11/2026 que os testes da 11A passaram e autorizou a 11B. O aceite se refere à revisão `11b5e1b` com o SHA-256 acima. Versão do Profit, ativo, período, parâmetros e resultados individuais não foram informados.

1. Compilar a revisão acima e aplicar com `ModoFaixaOB=0`, `HabilitarCapturasLiquidez=True`, `MostrarCapturasLiquidez=True` e `MostrarNiveisLiquidez=True`.
2. Em Replay, conferir toque, tomada e recuperação de BSL e SSL. Verificar que a captura só aparece na barra seguinte e que a linha termina no candle da tomada, incluindo a passagem entre sessões.
3. Alternar linha, rótulo, fonte e lado. Quando apenas o rótulo estiver ligado, conferir o marcador curto entre a tomada e a publicação. Repetir com a estrutura interna invisível e com uma fonte IDM ativa.
4. Registrar SHA-256, versão do Profit, ativo, período, tick, sessão, parâmetros e resultados observados de L01–L07.
