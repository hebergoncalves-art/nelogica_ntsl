# 09A — Flip estrutural do SMC_Hebim

Status: accepted

## Referência e escopo

A [08A](08A-fundacao.md) foi aceita pelo usuário e congelada na tag `smc-08a`, commit `acc5ffb6df32353b3fbc3d29b8b0e99c1ceb0291`, SHA-256 do fonte `37b2bd0f549b2073a811141725aabc369a78d75da5775d5bbb434493858b7e51`. O relato de funcionamento no Profit refere-se à 08A. A versão do Profit e as evidências individuais dessa execução ficaram sem registro.

A 09A entrega o Flip estrutural estrito da [seção B1](../SPEC_evolucao.md#b1-núcleo-09a) com desenho no modo 0. A [entrega 09B](../SPEC_evolucao.md#b2-poi-09b) cobre faixas de oferta e demanda. Igualdade, sweep local e `ModoFalhaFlip` ficam na 09C.

| Revisão 09A | Evidência |
| --- | --- |
| SHA-256 do candidato | `47120dbc93447d109d7e13446b6321b1075febb2a18be36532bcf5a566714247` |
| Profit Pro, compilação, Replay e renderização | Versão, ativo, período, parâmetros e resultados individuais não informados |
| Aceite 09A | Usuário informou que os testes 09A estão OK e autorizou a próxima entrega |

## Configuração e arquitetura

| Parâmetro novo | Padrão | Efeito |
| --- | --- | --- |
| `HabilitarFlip` | False | Habilita o cálculo e aciona a parte estrutural da 08A mesmo com `DebugSMC=False`. |
| `MostrarFlip` | False | Desenha Flips confirmados no modo 0. |
| `EscalaFlip` | 2 | 0 interna, 1 swing, 2 ambas. |
| `ReacaoMinFlipATR` | 0.5 | Multiplicador real não negativo do ATR no pivô intermediário. Zero mantém o mínimo de um tick e permite operar durante o aquecimento. |
| `MaxBarrasFlip` | 100 | Inteiro não negativo, contado desde a confirmação do pivô intermediário. Prazo inclusivo. Zero é ilimitado. |
| `PermitirGapFlip` | True | Permite atravessar o nível por gap completo com os três pivôs conhecidos. |
| `MostrarCandidatosFlip` | False | Desenha uma guia tracejada dos candidatos armados no modo 0. |

O módulo lê o lote fechado da 08A, com o fluxo anterior à barra, pivôs admitidos no histórico alternado, rupturas legadas e perda causal de proteção. Há uma sequência por escala e direção em formação. Ao confirmar L1/H1, a sequência congela o extremo anterior, o preço do nível e o ATR. O fluxo da escala precisa estar confirmado antes desse fechamento. Para venda, H2 precisa ficar abaixo de H0 fora da tolerância e reagir acima de L1 por pelo menos o mínimo. Para compra, a regra é espelhada.

A barra fechada primeiro avalia as sequências existentes. Só depois pode fornecer um pivô para uma sequência nova ou completar uma reação. O fechamento B valida pelo nível congelado, com a tolerância em ticks da fundação para comparar pivôs e o buffer configurado para a ruptura. Uma ruptura LuxAlgo do mesmo pivô é vinculada quando disponível. O primeiro cruzamento bruto permanece como referência quando o buffer é atingido depois. O Flip usa a confirmação em B e publicação em B+1.

Terminam a sequência a perda antecipada por fechamento, o fechamento além do extremo original na direção antiga, a dupla penetração sem ordem conhecida, um gap completo bloqueado, o retorno ao nível durante a espera do buffer, expiração ou dados inválidos. Igualdade e pavio isolado preservam a sequência. `flipMotivo` e `flipBarraMotivo` expõem o motivo mais recente por escala e direção. `flipConfigValida` informa se os parâmetros da 09A são válidos.

O registro do Flip guarda as confirmações e origens dos três pivôs, níveis congelados, ATR, primeiro cruzamento, B e B+1. A chave local é escala, direção e B. `flipEventoContexto` usa `1`, `-1` e `0` para interno alinhado, contrário e neutro. `flipEventoReversao` indica Flip swing com perda da proteção externa no próprio B. `flipEventoContinuacao` e `flipEventoFalha` guardam eventos posteriores distintos, com barra de publicação correspondente na chegada da próxima barra. A falha tem prioridade e transforma o registro em terminal. Cada escala e direção tem até 100 registros. A alocação recicla o terminal mais antigo ou informa `CAPACITY_FULL` em `flipSemVagaTotal` se todos estiverem ativos.

O desenho usa `LineSegment` sem extensão, com a etiqueta na extremidade de B e a outra ponta na confirmação do nível. Os quatro sentidos/escalas usam chamadas distintas. Cada publicação usa coordenadas fixas. A permanência de vários segmentos e a remoção de guias provisórias dependem de verificação visual no Profit. Se a versão alvo rejeitar `LineSegment`, aplicar o caminho de compatibilidade com `HorizontalLineCustom`: faixa zero, início e fim nos timestamps congelados, primeiro e último trechos restritos ao horário de cada sessão, dias intermediários sem restrição de hora e texto apenas no último trecho. A compatibilidade também exige recompilação e Replay. [Documentação de LineSegment](https://ajuda.nelogica.com.br/hc/pt-br/community/posts/13442294857499-Notas-de-Atualiza%25C3%25A7%25C3%25A3o-NTSL-Automa%25C3%25A7%25C3%25A3o-e-Editor-de-Estrat%C3%A9gias)

## Resultado dos testes

Executar `node scripts/testar-regressao-smc.cjs` e `./scripts/verificar-indicador.ps1 -Indicador smc`. O harness roda o subconjunto NTSL usado pelo indicador, registra os argumentos gráficos e compara dois commits de referência com o candidato. Algumas fixtures injetam fatos fechados no lote da 08A para controlar a ordem e os preços. F09 também exercita os produtores e o Flip juntos em OHLC gerado.

| Caso | Esperado | Observado no simulador | Local | Profit |
| --- | --- | --- | --- | --- |
| B01–B12 | Regressão da [matriz 08A](08A-fundacao.md#b01b12). | Doze verificações concluídas. O fixture do Breaker LEGACY produziu a mesma sequência de desenhos nos modos 1/2 com Flip ligado e desligado. | PASS | PENDENTE |
| F01 · Núcleo | Compra e venda nas duas escalas, IDs e segmento a partir da confirmação do nível. | Origens 9/11/13, confirmações 10/12/14, B=15 e publicação em 16. Coordenadas, rótulos I/S e cores conferidos. | PASS | PENDENTE |
| F02 · Elegibilidade | Fluxo anterior à confirmação, tolerância estrita e reação mínima baseada no ATR congelado. | Candidatos bloqueados com ATR indisponível, reação insuficiente, diferença dentro da tolerância e fluxo surgindo na própria confirmação. Com multiplicador zero, a sequência qualificou durante o aquecimento. | PASS | PENDENTE |
| F03 · Nível congelado | Rejeitar perda precoce, preservar toque/pavio e manter nível após substituição. | Reação na própria barra de perda rejeitada. Toque e pavio preservaram o candidato. O nível antigo qualificou após substituição e o vínculo CHoCH foi registrado quando disponível. | PASS | PENDENTE |
| F04 · Buffer e prazo | Separar primeiro cruzamento e qualificação, respeitar retorno e prazo inclusivo. | Cruzamento em 15 e qualificação em 17 com três ticks. Buffer zero preservou a exigência de cruzamento estrito. Retorno e prazo de duas barras cancelaram. O limite inclusivo de três barras e o prazo ilimitado qualificaram. | PASS | PENDENTE |
| F05 · Invalidações | Tratar gap, extremos simultâneos, OHLC inválido e fechamento além do extremo. | Gap qualificou com a opção ligada. Gap bloqueado, dupla penetração, OHLC inválido e fechamento além do extremo geraram motivos distintos. | PASS | PENDENTE |
| F06 · Contexto e eventos posteriores | Classificar contexto interno e reversão swing. Continuação e falha preservam a geometria original. | Contextos -1/0/+1, perda protegida, continuação em 20 e falha em 22. Dois Flips da mesma escala e direção mantiveram segmentos distintos. | PASS | PENDENTE |
| F07 · Capacidade | Limite 100, reciclagem do terminal e rejeição quando cheio de ativos. | Partição cheia preservou ativos e emitiu `CAPACITY_FULL`. A presença de um terminal permitiu gravar o novo Flip. | PASS | PENDENTE |
| F08 · Visual e recálculo | Alterar desenho e reexecutar preservam registros. Modos exclusivos ocultam Flip. | Registros e coordenadas iguais em reavaliação e recarga. As opções de desenho e o modo exclusivo alteraram somente as chamadas gráficas. | PASS | PENDENTE |
| F09 · Baseline 08A | Equivalência dos registros com Flip OFF e dos desenhos legados com Flip OFF e ON. | Em 850 barras, cinco modos e os dois estados de `DebugSMC`, o fluxo completo do fonte gerou Flips e preservou todas as chamadas legadas no simulador. A fundação com Flip desligado manteve as 19 partições da 08A. | PASS | PENDENTE |

## Validação no Profit Pro

O usuário aceitou a 09A. O roteiro abaixo fica como referência para recuperar as evidências individuais da execução.

1. Compilar a 09A e registrar hash, versão do Profit, ativo, período, sessão, tick e parâmetros. A linha e a etiqueta de cada Flip devem aparecer somente depois de fechada a barra B.
2. Aplicar uma instância no modo 0 com `HabilitarFlip=True` e `MostrarFlip=True`. Em Replay, localizar exemplos de compra e venda, interna e swing. Conferir que a linha liga a confirmação de L1/H1 ao fechamento de B e que a etiqueta distingue I de S. Testar dois Flips históricos da mesma escala e direção e um segmento que atravesse duas sessões.
3. Comparar recarga e Replay. Conferir que uma guia de candidato some após cancelamento, que confirmação mantém a geometria e que alternar as opções de desenho preserva os registros. No modo Debug, usar `flipEventoConfirmacao`, `flipEventoPublicacao`, `flipEventoNivel` e `flipMotivo` como referência.
4. Comparar com a 08A usando o mesmo OHLC e os mesmos parâmetros legados, incluindo uma instância LEGACY nos modos 1 ou 2. Registrar esperado, observado, evidência e estado por caso.
5. Registrar a versão do Profit usada na validação e associar as evidências ao commit `cbcf1d71ffd014f7908030f25c81f1d3f2c3de5e`.
