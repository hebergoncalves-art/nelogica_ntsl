# 03 — Exibir BOS e CHoCH internos

Status: ready-for-human

## Entrega

Exibir a estrutura interna de 5 candles da referência Pine e permitir alternar o filtro de confluência sem mudar os sinais de swing. O cálculo interno usa os níveis de swing disponíveis no mesmo candle. A investigação do HL de 11/08/2026 continua na [tarefa dos pivôs](01-pivos-confirmados.md).

## Aceitação

- [x] No teste local da lógica, a sequência de swing produz os mesmos eventos e plots com a estrutura interna ligada ou desligada.
- [x] No teste local da lógica, aparecem BOS e CHoCH internos nos dois sentidos. Um nível interno já consumido não volta a emitir sinal quando o preço permanece além do nível ou cruza novamente.
- [x] No teste local da lógica, um nível de swing indisponível ou igual ao interno bloqueia o sinal. O teste cobre os dois sentidos com confluência ativa, incluindo empate e cruzamento bloqueado.
- [ ] Compila no Editor de Estratégias do Profit Pro. As marcações de swing e internas são visíveis, inclusive quando coincidem no mesmo candle.
- [ ] No histórico OHLC comum, confirme no Profit e no LuxAlgo em `Historical` o mesmo tipo, direção, pregão e nível interno. Compare primeiro com o filtro desligado e depois ligado.

## Evidência

O teste local executou o fluxo do [fonte NTSL](../../../src/indicadores/smc.ntsl) traduzido para Python e comparou seus sinais internos com um modelo das regras do Pine. Usou a sequência de swing de 41 candles e 1.600 candles sintéticos gerados com `random.Random(26)`, rodando as janelas de swing 10 e 50. As quatro categorias internas e os casos de bloqueio foram observados. O compilador e a renderização do Profit ainda precisam ser conferidos.

SHA-256 da revisão testada `f1dc469bc1d89f64d108c7610a6aa54cbfcd6de867abfe520c0def99fe6ce2a5`.

O usuário informou que os testes da estrutura interna passaram e solicitou a próxima entrega. O retorno não detalhou quais casos foram conferidos nas plataformas.

Para o teste nas plataformas, registre o SHA-256, versão do Profit, ativo, período, sessão, início do histórico e configuração do filtro. Use a extremidade direita do segmento do LuxAlgo para identificar o candle de rompimento. Confira os níveis de swing e o OHLC quando houver divergência em um sinal interno.
