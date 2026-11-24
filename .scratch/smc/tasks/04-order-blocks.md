# 04 — Exibir Order Blocks internos e de swing

Status: ready-for-human

Depende dos rompimentos de [swing](02-bos-choch-swing.md) e [estrutura interna](03-estrutura-interna.md).

## Aceitação

- [x] O teste local cobre os dois grupos, seleção do candle de origem, ambos os filtros de volatilidade e ambas as fontes de mitigação. A quantidade exibida pode ser ajustada por grupo.
- [x] O teste local confirma os rótulos anteriores com os blocos ligados ou desligados e calcula blocos internos mesmo com rótulos internos ocultos.
- [ ] Compilar no Profit e conferir os dois limites, o candle de origem e a remoção ou retenção após mitigação. Confirmar que as faixas acompanham o último candle sem acumular desenhos obsoletos.
- [ ] Com o mesmo OHLC nas duas plataformas, comparar pelo menos um bloco interno e um de swing com o LuxAlgo. Conferir preço superior, preço inferior, candle de origem e candle de mitigação. Rodar primeiro com ATR e `High/Low`, depois com média cumulativa e fechamento.

## Evidência

O teste local traduziu o fluxo do fonte para Python e comparou os segmentos produzidos com um modelo de seleção e mitigação. Usou 750 candles sintéticos, com 24 combinações de grupo, filtro, mitigação e quantidade. A sequência gerou 16 blocos internos e 11 de swing. A comparação no Profit Pro e no TradingView está pendente.

SHA-256 da revisão testada `ba4c72f1fe809a582356fa440eaf5ec1948da5707a29772e195f48791e8fa738`.

O Editor de Estratégias indicou redeclaração dos nomes `Maxima` e `Minima` na função `BlocoMitigado`. Ambos foram substituídos por nomes específicos dos limites do bloco. A compilação da revisão corrigida está pendente.

Ao executar a revisão seguinte, o Profit informou `Erro desconhecido na linha 406`, no final do laço de mitigação. A revisão `7204fead7894f7f02de19018e2d3d21ad1701fd6f2d459cf76f82b53faa7b732` valida o deslocamento da origem, armazena os limites quando o bloco entra na lista e usa esses valores durante a mitigação. A renderização só acessa a lista quando há blocos para desenhar. O teste local passou nas 24 combinações e em dois históricos sem blocos. A causa exata e a execução da nova revisão no Profit ainda precisam ser confirmadas.

O Debug detalhou a interrupção como `Código com um possível loop infinito` na mitigação e marcou `Date[...]` e `Time[...]` com avisos de contexto posicional. A revisão `cc898911c69fca85e484ac09ab2417d0cb0d12c7c1ca1dbb7346a288c7a2de8f` atualiza as listas por candle, guarda três estados recentes para recálculo e registra data e hora em séries próprias. Uma reavaliação que salte para fora desse histórico recente exige reprocessar a série para reconstruir blocos antigos. O teste local repetiu os 24 cenários, históricos sem blocos e reavaliação de cada candle; a execução no Profit está pendente.

O usuário informou que os blocos de swing não apareciam com o grupo swing habilitado, os blocos internos desabilitados, filtro de média cumulativa e mitigação por máxima/mínima. O período informado de 9 é ajustado para 10 pelo indicador. A revisão `b9c4ce543efcef130a62f6e140feef6d8aed9167e1c905652676c89410b6ecab` usa faixas com `HorizontalLineCustom` e explicita a lista vazia no último candle. O teste local conferiu novamente as 24 combinações, inclusive o grupo swing isolado, os limites das faixas e a mensagem sem bloco ativo. A origem do problema visual e o resultado no Profit estão pendentes.

As capturas seguintes mostram só os rótulos de estrutura no gráfico e as linhas 1 a 4 em Aparência. Na revisão `79b9fc76e70450e21b8134b337a5becc2dfa992886c6fe1337d2eaf3b530d179`, os plots adicionais exibem os limites do bloco mais recente ativo em cada candle, além das faixas dos blocos atuais. A verificação local passou nas 24 combinações e confirmou as duas séries no modo somente swing, inclusive no histórico. A exibição no Profit continua pendente.

O usuário confirmou que os plots de limite apareciam como linhas laranja contínuas e pediu faixas vermelhas e azuis. A revisão `ec0ee94936cd8756eb88cae62e8d18a6c5b3ff65b4a1698c2d545157b2107ca9` remove os plots auxiliares, usa azul para alta e vermelho para baixa e desenha cada bloco independente a partir do dia de origem sem janela de horário. As 24 combinações locais passaram, incluindo as cores, limites e parâmetros enviados à função de desenho. A renderização deve ser conferida no Profit.

O usuário confirmou que `HorizontalLineCustom` não exibiu as faixas. Na revisão `e163418ce4d9ffaa7cd5107e2a60f87a067f7919abaca954ca85951b308c2f19`, os modos de faixa emitem dois plots para usar o preenchimento entre linhas nas propriedades da instância. Os testes locais passaram nas 24 combinações anteriores e nos quatro modos novos com as ordens 1 e 2, verificando limites, cores e a lacuna na troca de bloco. Falta testar o preenchimento no gráfico do Profit.

Para conferir as duas cores de swing, adicionar duas instâncias do SMC diretamente no gráfico com `ModoFaixaOB = 1` e `2`, ambas com `OrdemFaixaOB = 1` e os mesmos parâmetros de cálculo. Nas propriedades de cada instância, habilitar **Preenchimento** e selecionar **Preenchimento com Cor**. Selecionar azul na primeira e vermelho na segunda. Manter a instância principal no modo 0 e desligar nela os grupos de blocos para evitar sobreposição com o desenho nativo.

O usuário confirmou que o preenchimento entre plots apareceu, com lacunas e início no candle de detecção. A revisão `06d69a51f8fe4196b1b39b9b7a3c5e44e23019da716018b8a04ff3944cffc300` adiciona `AncorarFaixaOB`, ligado por padrão. Cada instância passa a desenhar o bloco ativo selecionado a partir da data e hora de origem. Para blocos que atravessam sessões, o trecho intradiário é aplicado só no dia de origem e a faixa continua desde o início dos dias seguintes. O teste local conferiu oito cenários ancorados, com e sem troca de dia. O teste real deve verificar a borda esquerda, a continuidade na virada da sessão e a remoção após mitigação. A opção de preencher entre linhas aplica-se ao modo com `AncorarFaixaOB` desligado.

A captura posterior confirma uma faixa azul e uma vermelha estendidas à direita no Profit. Nos modos de faixa, cada instância seleciona um único bloco ativo da direção configurada. Para mostrar também os segundos blocos de alta e baixa, mantenha as instâncias de ordem 1 e acrescente duas com os mesmos parâmetros e `OrdemFaixaOB = 2`, uma para cada direção. A ordem é contada por direção, do bloco ativo mais recente ao mais antigo.

No modo 0, o usuário observou que aumentar `QuantidadeBlocosSwing` de 1 para 2 mudou a faixa de posição. A revisão piloto `d80cbbc02dc4185e5f808872214c07a60a456ea542e80619a7dd53ba89c7a417` seleciona até duas faixas por grupo e usa chamadas separadas fora do laço. O teste local `1 → 2 → 1` confirmou que a primeira chamada mantém os mesmos parâmetros e que a segunda tem preço e nome distintos. O preenchimento no Profit precisa ser verificado sem instâncias de faixa sobrepostas. Se o Profit mostrar ambas e ocultar só a segunda ao voltar para 1, estender o padrão até 20 faixas por grupo. Se continuar substituindo desenhos, registrar o comportamento e usar os modos ancorados. [Relato na comunidade da Nelogica](https://ajuda.nelogica.com.br/hc/pt-br/community/posts/24126139135771-HorizintalLine-Custom-em-for-loop)

A captura seguinte mostrou duas faixas e o usuário confirmou o limite de duas no piloto. A revisão `bef933a1d7e15ad8c59eb7548b1866ef9023fc469cc244643ca2e77c6369dc00` amplia o desenho independente até 20 faixas por grupo. O teste local conferiu os pedidos 1, 2, 3, 20 e 25, inclusive a permanência dos preços das faixas anteriores ao aumentar a quantidade. A terceira faixa e os limites maiores ainda precisam de confirmação no gráfico do Profit com blocos ativos suficientes.
