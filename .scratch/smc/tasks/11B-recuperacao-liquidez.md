# 11B — Sweep e Stop Hunt

Status: ready-for-human

Depende do aceite da [11A](11A-niveis-liquidez.md) e cobre a [seção D2](../SPEC_evolucao.md#d2-swsh-11b).

| Caso | Resultado esperado |
| --- | --- |
| R01 | BSL e SSL classificam a primeira recuperação em t0+1 como Sweep. A tomada, o extremo original e a publicação permanecem registrados. |
| R02 | O buffer impede confirmação na banda intermediária. A primeira recuperação até o último candle do prazo classifica Stop Hunt e inclui o extremo desse candle. Retorno tardio preserva a expiração. Recarga reproduz registros e âncoras. |
| R03 | Gaps preservam o fato original e só entram em espera se permitidos e se atingirem o mínimo. OHLC inválido encerra a espera sem alterar a tomada. |
| R04 | Esperas BSL e SSL coexistem. A ordem visual segue a data da recuperação, com desempate pelo ID da geração. |
| R05 | A capacidade preserva a geração pendente e permite reciclagem depois do encerramento. |
| R06 | Com liquidez desligada, os cinco modos de faixa reproduzem o gráfico da revisão aceita da 11A. |

## Configuração e registros

- `MaxBarrasStopHunt=5` define a janela inclusiva após a tomada e exige inteiro maior ou igual a 2. `PermitirGapPadraoLQ=False` deixa o gap completo como tomada física sem espera. A espera usa o mesmo buffer de recuperação da 11A e mantém o filtro de pavio restrito ao LG.
- `MostrarSweep=True` e `MostrarStopHunt=True` habilitam a exibição dos padrões confirmados. `MostrarRupturaPendente=False` e `MostrarBreakSemRecuperacao=False` controlam as rupturas em espera e as encerradas por prazo. Esses controles compartilham o limite visual de capturas da 11A.
- O registro conserva t0, classe física, extremo inicial e fontes. Guarda o extremo acumulado e o desfecho separadamente. Após recuperação, expiração ou dados inválidos, a reciclagem usa o candle do desfecho. A perda de contexto de um IDM associado não cancela a espera.

## Revisão local

- SHA-256 do fonte `b04e993c1e9eddaf20c53805d2fed5f93f3970dfadb894475ad29eef2ad5f35c`.
- `./scripts/verificar-indicador.ps1 -Indicador smc` conferiu a estrutura.
- `node scripts/testar-regressao-smc.cjs` passou nos 64 cenários locais, incluindo R01–R06 e as 58 regressões anteriores.

## Validação no Profit Pro

Compilação e Replay pendentes.

1. Compilar a revisão acima e aplicar com `ModoFaixaOB=0`, `HabilitarCapturasLiquidez=True` e `MostrarCapturasLiquidez=True`.
2. Conferir SW na primeira barra após a tomada, SH nas barras seguintes e recuperação no limite do prazo. Certificar que o gráfico publica o padrão apenas na barra seguinte à recuperação e que a linha termina no fechamento que recuperou o nível.
3. Alternar os parâmetros de gap, ruptura pendente, ruptura sem recuperação e linha. Em modo somente rótulo, verificar que o marcador começa no candle da recuperação. Repetir com níveis dos dois lados e atravessando sessões.
4. Registrar SHA-256, versão do Profit, ativo, período, tick, sessão, parâmetros e resultados observados de R01–R06.
