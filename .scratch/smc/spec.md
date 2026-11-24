# Especificação — SMC Swing e Estrutura Interna

## Referência

Pine v6 `Smart Money Concepts`, © LuxAlgo, revisão fornecida pelo usuário neste projeto. A adaptação cobre `leg` e as chamadas de swing e estrutura interna de `getCurrentStructure` e `displayStructure`. A referência tem licença CC BY-NC-SA 4.0. Validar no TradingView em `Historical` e com `All` nos dois sentidos da estrutura sob teste. Para isolar a comparação, desative os demais recursos visuais.

## Regras por candle

- **Entrada.** `PeriodoSwing` tem padrão 50. Valores abaixo de 10 usam 10. `MostrarPivos` tem padrão desligado e só afeta a exibição. A NTSL usa máxima, mínima e fechamento do ativo e período do gráfico.
- **Perna e pivô.** Começar com perna de baixa. A partir do candle de índice `n`, comparar a máxima de `n` barras atrás com a maior máxima dos `n` candles seguintes, incluindo o candle em avaliação. Se for estritamente maior, a perna passa a baixa. Senão, se a mínima candidata for estritamente menor que todas as mínimas da janela, a perna passa a alta. Empates com os extremos da janela não qualificam. Se as duas condições forem verdadeiras, prevalece a máxima. Sem condição, conservar a perna anterior.
- **Confirmação.** Registrar fundo na transição para alta e topo na transição para baixa. O preço é o do candle candidato, e a confirmação ocorre `n` candles depois. O pivô substitui o nível anterior do mesmo lado e pode ser rompido uma vez. Os dois lados têm estados independentes.
- **Cruzamento.** Atualizar os pivôs antes de avaliar o fechamento. Para alta, o fechamento atual deve superar o nível de topo atual, e o fechamento anterior deve ser menor ou igual ao nível de topo anterior. Para baixa, o fechamento atual deve ficar abaixo do nível de fundo atual, e o fechamento anterior deve ser maior ou igual ao nível de fundo anterior. Exigir que o nível exista nos dois candles e que o pivô atual ainda não tenha sido rompido. Avaliar alta antes de baixa, como no Pine.
- **Classificação.** Começar com viés neutro. Um cruzamento vira CHoCH se o viés anterior for oposto à direção do evento. O primeiro cruzamento e os cruzamentos a favor do viés são BOS. Consumir o pivô e atualizar o viés para a direção do evento.
- **Apresentação.** Usar texto no preço do evento e no candle do rompimento. O primeiro plot contém o nível dos rompimentos de alta e o segundo contém o de baixa, apenas nos candles de evento. Com `MostrarPivos` ligado, os rótulos ficam acima ou abaixo do candle de confirmação. As linhas vermelha (topo) e verde (fundo) mostram o preço de cada último pivô a partir da confirmação, inclusive após o rompimento, até o próximo pivô do mesmo lado. Na referência Pine, o rótulo BOS/CHoCH pode ficar entre o pivô e o rompimento. Para comparar, use o candle do rompimento, identificado pelo fim do segmento ou pelos dados do evento. A aceitação cobre candles fechados.

## Teste de aceitação

Compare tipo, direção, horário e preço com a referência no TradingView. Registre o ativo, período, sessão, fuso, início do histórico, revisão NTSL, versão do Profit e parâmetros. Use janelas com OHLC idêntico desde a inicialização, pois os primeiros candles influenciam a perna, os níveis e o viés. Recarregue o gráfico com o mesmo histórico e confira se os eventos permanecem iguais.

[Sequência de referência](casos.md) · [Script original](https://www.tradingview.com/script/CnB3fSph-Smart-Money-Concepts-SMC-LuxAlgo/) · [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/) · [Manual NTSL](https://downloadserver-cdn.nelogica.com.br/content/profit/manual_ntsl/ManualNTSL.pdf)

## Estrutura interna

- `MostrarEstruturaInterna` e `FiltroConfluenciaInterna` começam desligados. A janela interna é fixa em 5 candles. Com a estrutura interna ligada, os dois sentidos e tipos de rompimento ficam visíveis.
- A estrutura interna aplica as regras de perna, confirmação e cruzamento da seção anterior com seus próprios níveis, viés e estado de consumo. Atualiza os pivôs após o swing e avalia os rompimentos internos antes dos rompimentos de swing. Para cada lado, exige que o nível correspondente do swing já exista e seja diferente do nível interno atual.
- Com o filtro ativo, compara `High - Max(Close, Open)` com `Min(Close, Open - Low)`. O primeiro valor deve ser maior para alta e menor para baixa. A igualdade bloqueia os dois sentidos. Um cruzamento bloqueado pelo filtro não consome o pivô nem altera o viés.
- O texto interno leva o prefixo de tipo `BOS` ou `CHoCH`, a palavra `interno` e a direção. Ele fica no candle do rompimento e no preço do nível interno. [Tarefa de validação da estrutura interna](tasks/03-estrutura-interna.md)

## Order Blocks

- `MostrarBlocosInternos` e `MostrarBlocosSwing` começam desligados. `QuantidadeBlocosInternos` e `QuantidadeBlocosSwing` têm padrão 5. No modo 0, os valores são limitados a 1–20 por grupo e cada faixa tem uma chamada de desenho própria. A quantidade real depende de quantos blocos ativos existem, somando alta e baixa. Os rompimentos internos são calculados quando os blocos internos estão ligados, mesmo com os rótulos internos ocultos.
- O filtro padrão é ATR de Wilder de 200 candles. Desligar `UsarATRBlocos` usa a média cumulativa do True Range desde o segundo candle. Uma amplitude maior ou igual a duas vezes a medida de volatilidade inverte a máxima e a mínima analisadas, como no Pine. Durante o aquecimento, usam-se os extremos brutos.
- Em cada rompimento, examinar do candle do pivô até o anterior ao rompimento. Um bloco de alta usa o candle com a menor mínima analisada. Um bloco de baixa usa o candle com a maior máxima analisada. O primeiro candle da janela vence empates, e seus dois limites analisados formam o bloco.
- O padrão de mitigação usa a mínima para blocos de alta e a máxima para os de baixa. Com `MitigarPorFechamento` ligado, ambos usam o fechamento. Cruzar estritamente o limite correspondente remove o bloco, e tocar o limite mantém o bloco. Se vários limites forem cruzados no mesmo candle, a adaptação remove todos os blocos atingidos naquele candle.
- Cada grupo retém até os 100 blocos mais recentes durante o cálculo. Exibir os blocos ativos mais recentes como faixas independentes, azuis para alta e vermelhas para baixa. `HorizontalLineCustom` recebe o ponto médio, metade da distância entre os limites e o dia de origem. A faixa se estende à direita sem restrição de horário. Em gráficos intradiários, o início visual é definido pela data da origem. Quando um grupo habilitado estiver vazio, marcar o último candle com a informação de que não há bloco ativo. [Tarefa de validação de Order Blocks](tasks/04-order-blocks.md) · [Manual NTSL](https://downloadserver-cdn.nelogica.com.br/content/profit/manual_ntsl/ManualNTSL.pdf)
- Use uma instância por faixa com `ModoFaixaOB` igual a `1` (swing alta), `2` (swing baixa), `3` (interno alta) ou `4` (interno baixa). `OrdemFaixaOB = 1` escolhe o mais recente ativo da direção e `2` o seguinte. Com `AncorarFaixaOB` ligado, a instância desenha somente o bloco selecionado no último candle. Usa a hora de origem apenas na data de origem e os mesmos limites sem restrição de horário a partir da data seguinte. Com o parâmetro desligado, a instância volta aos dois plots para preenchimento, que começam na detecção e deixam uma lacuna na troca de bloco. O modo `0` exibe a estrutura principal. [Configuração de preenchimento do Profit](https://ajuda.nelogica.com.br/hc/pt-br/articles/4411546027163-TrendCloud-e-TrendSniper-na-plataforma-Profit)

## EQH/EQL

- `MostrarEQHEQL` vem desligado e habilita a detecção apenas no modo `0`. `BarrasConfirmacaoEQ` tem padrão 3 e mínimo 1. `LimiarEQ` tem padrão 0,1 e é limitado ao intervalo de 0 a 0,5.
- A janela, a perna e o último pivô de cada lado são próprios de EQH/EQL. Começar com perna de baixa e aplicar as mesmas regras de extremo estrito, prioridade do topo e transição usadas no swing. A cada recálculo, recuperar o estado do candle anterior.
- Na confirmação, comparar o preço candidato ao último pivô confirmado do mesmo tipo. Com ATR disponível e diferença absoluta estritamente menor que `LimiarEQ × ATR(200)`, exibir `EQH` em vermelho ou `EQL` em verde, no preço do candidato e no candle de confirmação. Guardar todo pivô confirmado, inclusive durante o aquecimento e quando o par ficar fora da tolerância.
- Compartilhar o ATR de Wilder usado pelos Order Blocks, inclusive quando somente EQH/EQL estiver ligado. O primeiro True Range é máxima menos mínima e entra na média inicial de 200 candles. Usar o ATR do candle de confirmação independentemente do filtro de volatilidade dos blocos.
- Comparar em candles fechados com o LuxAlgo em `Historical`. Identificar a origem dos dois pivôs e contar a janela de confirmação a partir do segundo. No Profit, o rótulo é ancorado nessa confirmação. [Casos de referência](casos.md#eqheql) · [Tarefa de validação](tasks/05-eqh-eql.md)

## Fair Value Gaps

- `MostrarFVG(False)` habilita a camada no modo 0. `FiltroAutomaticoFVG(True)`, `ExtensaoFVG(1)`, `CorFVGAlta(clGreen)` e `CorFVGBaixa(clRed)` controlam filtro, extensão e cores. A extensão tem mínimo zero.
- Para A, B e C consecutivos, avaliar em C. Alta exige mínima de C e fechamento de B acima da máxima de A e retorno positivo de B acima do limiar. A faixa vai da máxima de A à mínima de C. Baixa exige máxima de C e fechamento de B abaixo da mínima de A e retorno negativo de B com módulo acima do limiar. A faixa vai da máxima de C à mínima de A. Todas as comparações são estritas.
- O retorno de B é `(Close[1] - Open[1]) / Open[1]`. Somar os módulos desde o índice 1, inclusive em candles sem gap. O limiar automático é duas vezes a soma dividida pelo índice de C. Com o filtro desligado, o limiar é zero. Abertura zero contribui com zero e impede a formação em C.
- Remover todos os gaps anteriores de alta se a mínima atravessar a borda inferior e os de baixa se a máxima atravessar a borda superior, antes de inserir um novo gap. Toque exato e preenchimento parcial conservam a faixa. Limitar a lista aos 100 gaps ativos mais recentes depois da mitigação e da inserção. Reavaliar o candle a partir do estado anterior.
- Desenhar os cinco ativos mais recentes, somando os dois sentidos. Usar data e hora reais de B e de C mais a extensão, limitando a borda direita ao último candle enquanto faltarem candles para completar a faixa. A faixa mantém a borda final depois disso e continua sujeita à mitigação. [Casos de referência](casos.md#fair-value-gaps) · [Tarefa de validação](tasks/06-fvg.md)

## Zonas Premium, Equilibrium e Discount

- `MostrarZonasPD(False)` habilita as zonas no modo 0. `CorZonaPremium(clRed)`, `CorZonaEquilibrium(clGray)` e `CorZonaDiscount(clTeal)` definem as cores.
- Usar os pivôs de `PeriodoSwing` e manter os extremos das zonas em séries próprias. A partir do estado da barra anterior, atualizar o topo com a maior máxima e o fundo com a menor mínima, cada lado após sua primeira confirmação. Desenhar com esse estado. Depois do desenho, cada nova confirmação substitui apenas seu extremo e define a origem comum no candle do pivô. A redefinição passa a valer no desenho do candle seguinte.
- Desenhar quando os dois extremos estiverem disponíveis e o topo superar o fundo. Medidos a partir do fundo, os limites de Premium são 95% e 100%, os de Equilibrium são 47,5% e 52,5% e os de Discount são 0% e 5%.
- Exibir somente o conjunto atual, da origem até o último candle disponível. Ancorar data e hora das bordas por sessão e exibir um rótulo no primeiro trecho de cada zona. [Casos de referência](casos.md#zonas-premium-equilibrium-e-discount) · [Tarefa de validação](tasks/07-zonas-premium-discount.md)

## Breaker Blocks de swing

- `MostrarBreakerBlocks(False)` atua no modo 1 para demanda que vira oferta e no modo 2 para oferta que vira demanda. `OrdemFaixaOB` escolhe a posição nos Breakers ativos separadamente dos OBs ativos. A faixa do Breaker é sempre ancorada.
- Para os candles A, B e C do FVG, o OB de swing precisa estar ativo antes de A e ser removido por rompimento em A, B ou C pelas regras atuais dos OBs. Usar os mesmos limites da faixa de OB. Para baixa, a abertura de A deve superar a borda superior e o fechamento de C deve ficar abaixo da inferior. O primeiro candle cuja mínima alcance a borda superior inicia a travessia. Desse candle até C, qualquer fechamento acima da borda superior rejeita a formação. Para alta, espelhar as condições pela borda inferior e pela máxima.
- Usar a detecção e o filtro automático dos FVGs do gráfico, inclusive com as faixas FVG ocultas. Exigir direção igual à da travessia e largura positiva na interseção com o OB. Usar o intervalo completo do OB no Breaker. BOS, CHoCH e varredura são contexto visual.
- Ao chegar o candle posterior a C, publicar o Breaker ancorado na data e hora de C. Conservar até 100 ativos por direção. No empate de confirmação, priorizar o OB removido mais recentemente e, no mesmo candle de remoção, o OB criado mais recentemente.
- Retirar um Breaker de baixa no primeiro fechamento acima da borda superior e um de alta no primeiro fechamento abaixo da inferior. Mostrar a atualização ao chegar o candle seguinte. Um fechamento exatamente na borda preserva o Breaker. Reconstruir a lista a partir da barra anterior a cada reavaliação.
- Desenhar a faixa selecionada da confirmação em diante com chamadas próprias, em cinza-claro nos dois sentidos. Exibir o rótulo `Breaker` apenas no trecho inicial. [Casos de referência](casos.md#breaker-blocks-de-swing) · [Tarefa de validação](tasks/08-breaker-blocks.md)
