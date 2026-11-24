# 09B — Zonas de oferta e demanda do Flip

Status: ready-for-human

A entrega aplica as seções B2, F e G da [especificação](../SPEC_evolucao.md) ao Flip confirmado na [09A](09A-flip-estrutural.md). A referência da 09A é o commit `cbcf1d71ffd014f7908030f25c81f1d3f2c3de5e`.

| Caso | Resultado esperado | Resultado local |
| --- | --- | --- |
| P01 | Compra e venda nas duas escalas produzem faixa e meio a partir de B, publicados em B+1. FULL, REFINED e BASE congelam os limites. | PASS. Coordenadas, largura, meio e prazos conferidos. |
| P02 | Janela, fallback, arredondamento e disponibilidade do ATR determinam a zona. Origem ausente ou zona rejeitada preserva o Flip. | PASS. Limites arredondados para fora, BASE de um a três candles e motivo de rejeição conferidos. |
| P03 | WAIT_EXIT passa a FRESH na saída. Retorno após a saída até B marca PRE_MITIGATED. ExigirFreshFlip aceita WAIT_EXIT e rejeita PRE_MITIGATED. | PASS. A saída posterior preservou a zona. Retorno anterior e fechamento além distal acionaram as rejeições esperadas. |
| P04 | Toque, 50% e 100% guardam profundidade máxima. Candles consecutivos na faixa formam uma visita. Um gap sem interseção pode invalidar sem visita. | PASS. Dois sentidos, toque distal, retorno pelo lado errado, limites de visita e opções de mitigação conferidos. |
| P05 | Invalidação prevalece sobre reteste e expiração. Reteste usa reação posterior ao toque e, no modo 2, ruptura causal do pivô interno congelado. | PASS. Reteste confirmado com alvo anterior, indisponível com alvo tardio e encerrado quando a invalidação prevaleceu. |
| P06 | Zonas idênticas compartilham ID. Capacidade cheia recicla o terminal mais antigo e preserva todos os ativos. | PASS. Partição cheia preservou 100 IDs ativos e retornou `CAPACITY_FULL`. Ordem e limite visual conferidos. |
| P07 | Reavaliação e recarga preservam estado e geometria. Faixas ocultas e modos 1–4 preservam o desenho da 09A. | PASS. Registros idênticos após recarga e reavaliação, desenho segmentado em três sessões e equivalência com a 09A nos cinco modos. |

## Revisão verificada

- SHA-256 do fonte `2e009a4711a6995d2fca378ff9efce8f3f5bea551d8614f7171ed084f8f8e676`, conferido por `./scripts/verificar-indicador.ps1 -Indicador smc`.
- `node scripts/testar-regressao-smc.cjs` passou nos 28 cenários B01–B12, F01–F09 e P01–P07. O simulador avalia o fonte e registra as chamadas de desenho.
- A zona tem ID próprio e cada Flip guarda esse vínculo em `flipEventoZonaID`. O diagnóstico de zona indisponível fica em `flipEventoZonaMotivo`, com causas de origem, OHLC, largura, distal, fresh, configuração e capacidade. O reteste tem campo e estado próprios.

## Validação no Profit Pro

A revisão `e0c5dd8b9517f190f28953c6ffc030e3dffb558c8d372ca92d5b96bc2751c7cf` retornou erros de sintaxe no Profit. O primeiro erro, em `Parser[2551,19]`, apontou para o `and` do teste de interseção entre candle e zona. A revisão atual agrupa cada comparação inteira entre parênteses, seguindo o padrão das demais expressões booleanas do indicador. A versão do Profit usada nessa tentativa não foi informada.

Compilação da revisão corrigida, Replay, renderização e aceite da 09B estão pendentes.

1. Compilar a revisão acima e aplicar o indicador com `ModoFaixaOB=0`, `HabilitarFlip=True`, `MostrarFlip=True` e `MostrarFaixasFlip=True`. Conferir em Replay se a faixa ancora em B e surge em B+1. Comparar FULL, REFINED e BASE em compra e venda, nas escalas interna e swing.
2. Conferir o meio opcional, a extensão entre sessões e o término das invalidadas no candle correspondente. Testar a opção cinza e o desenho com faixas ocultas nos modos exclusivos.
3. Conferir saída, retorno, mitigação, reteste e invalidação nos casos acima. Registrar versão do Profit, ativo, período, tick, sessão, parâmetros, resultado observado e aceite para o SHA-256 testado.
