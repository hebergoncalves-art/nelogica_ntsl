# 10A — IDM estrutural

Status: ready-for-human

Dependência aceita em [09C](09C-flip-avancado.md). A entrega aplica a [seção C1](../SPEC_evolucao.md#c1-structural-10a).

| Caso | Resultado esperado | Resultado local |
| --- | --- | --- |
| I01 | BOS swing causal confirma IDM LOW ou HIGH com nível congelado, linha tracejada desde B e publicação em B+1. | PASS. Os dois lados publicaram os preços esperados com as âncoras e o estilo previstos. |
| I02 | Fluxo consolidado em B e buffer tardio são elegíveis. BOS neutro, proteção ausente e pivô confirmado em B impedem a ativação. | PASS. O cruzamento bruto em 16 com buffer posterior ativou em 17. Sem proteção nova, o nível anterior permaneceu ativo. |
| I03 | Distância em ticks, ATR e janela selecionam o P elegível. Penetração prévia ou OHLC inválido rejeitam o candidato. A busca pode recuar para o anterior. | PASS. O P mais recente foi descartado quando tomado em B. Com toque exato em B, esse P foi selecionado. |
| I04 | Primeiro toque exato preserva o IDM. Penetração por candle fechado encerra o nível, inclusive se um novo BOS ocorrer no mesmo candle. | PASS. A primeira tomada encerrou a linha no candle correspondente, antes de processar a nova ativação. |
| I05 | Substituir ou manter múltiplos conforme o parâmetro. Um BOS sem candidato mantém o ativo. Reuso vincula o BOS ao nível original. | PASS. Dois BOS no mesmo nível ativo apontaram para o mesmo ID e mantiveram B original. |
| I06 | Reter 100 registros por lado. Reciclar o terminal mais antigo e preservar todos os ativos ao atingir a capacidade. | PASS. A partição cheia retornou `CAPACITY_FULL`. O gráfico limitou a seleção a dez linhas. |
| I07 | O histórico e o desenho são determinísticos. As opções visuais não alteram o cálculo. IDM desligado preserva a revisão aceita da 09C. | PASS. Registros e desenho preservados nos cinco modos. Dois IDMs foram gerados diretamente do OHLC com Flip e desenho interno desligados. |

## Revisão verificada

- SHA-256 `9d219d7487000e4e6669ec83fa40558c53dca5eaffc4b8b664e16e00d85b065f`, conferido por `./scripts/verificar-indicador.ps1 -Indicador smc`.
- `node scripts/testar-regressao-smc.cjs` passou nos 41 cenários B01–B12, F01–F09, P01–P07, A01–A06 e I01–I07.
- O módulo guarda IDs, proteção, pivô, preço e datas de ativação, publicação e encerramento. Os vínculos a BOS têm histórico circular de 100 por lado. A 10A registra a tomada física. A classificação e a reação posterior pertencem à 10B.

## Validação no Profit Pro

Compilação, conferência visual em Replay e aceite estão pendentes.

1. Compilar o fonte acima. Aplicar com `ModoFaixaOB=0`, `ModoIDM=0`, `HabilitarIDM=True` e `MostrarIDM=True`. Manter `MostrarIDMLow=True` e `MostrarIDMHigh=True`.
2. Em Replay, conferir preço congelado, publicação somente em B+1, âncora em B, linha tracejada entre sessões e término no candle fechado da primeira penetração. Testar toque exato e os dois valores de `PoliticaNovoBOS`.
3. Registrar SHA-256, versão do Profit, ativo, período, tick, sessão, parâmetros e resultados observados.
