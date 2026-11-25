# Casos de referência — SMC Swing

Sequência sintética para `PeriodoSwing = 10`. Os índices começam em zero. Para completar o OHLC, a abertura pode ser igual ao fechamento. A tabela de resultados é derivada das regras do Pine fornecido e serve de referência para testes locais da lógica. A conferência no Profit e no TradingView usa histórico comum das plataformas.

| Candles | Máxima | Mínima | Fechamento |
| --- | ---: | ---: | ---: |
| 0 | 110 | 80 | 95 |
| 1 | 120 | 90 | 95 |
| 2–11 | 110 | 90 | 95 |
| 12 | 123 | 90 | 121 |
| 13 | 124 | 90 | 122 |
| 14 | 100 | 70 | 80 |
| 15 | 100 | 74 | 75 |
| 16–24 | 100 | 90 | 95 |
| 25 | 100 | 68 | 69 |
| 26 | 110 | 67 | 90 |
| 27–36 | 100 | 90 | 95 |
| 37 | 112 | 90 | 111 |
| 38 | 113 | 90 | 112 |
| 39 | 110 | 90 | 109 |
| 40 | 113 | 90 | 111 |

| Candle da confirmação ou do evento | Saída | Preço | Candle original do pivô |
| ---: | --- | ---: | ---: |
| 10 | Fundo confirmado | 80 | 0 |
| 11 | Topo confirmado | 120 | 1 |
| 12 | BOS de alta | 120 | 1 |
| 15 | CHoCH de baixa | 80 | 0 |
| 24 | Fundo confirmado | 70 | 14 |
| 25 | BOS de baixa | 70 | 14 |
| 36 | Topo confirmado | 110 | 26 |
| 37 | CHoCH de alta | 110 | 26 |

Os demais candles não produzem pivô ou rompimento. O candle 14 só toca o nível com o fechamento. Os candles 13 e 38 permanecem além de um nível já rompido. No candle 40 há novo cruzamento do topo consumido no candle 37. No candle 36 os dois extremos candidatos qualificam e a máxima prevalece.

## EQH/EQL

Com ATR de 10 no candle de confirmação e limiar de 0,1, a tolerância é 1. Aplique a tabela aos dois tipos de pivô.

| Diferença absoluta | Saída |
| ---: | --- |
| 0 | EQH ou EQL |
| 0,5 | EQH ou EQL |
| 1 | Sem rótulo |
| 1,5 | Sem rótulo |

- O primeiro pivô de cada tipo é guardado sem emitir rótulo. Um pivô confirmado antes do candle de índice 199 pode servir de referência depois do aquecimento. Com limiar zero, até preços idênticos ficam sem rótulo.
- Com janela 3, o candidato do índice 200 é avaliado no índice 203. Empate com um extremo dos três candles seguintes desqualifica o lado correspondente. Quando ambos os lados qualificam, prevalece o topo.
- Para topos confirmados sucessivamente em 100, 102 e 102,5, o par 100/102 fica sem rótulo e o par 102/102,5 gera EQH. Use a mesma lógica para fundos. Reavaliar o mesmo candle deve manter o resultado obtido a partir do candle anterior.
- Com EQH/EQL desligado ou em um modo exclusivo de faixa de Order Block, os rótulos EQH/EQL ficam ocultos. Com a camada ligada, as saídas anteriores devem coincidir com as obtidas com a camada desligada.

## Fair Value Gaps

Use A = `100/105/95/100` (abertura/máxima/mínima/fechamento). Com filtro automático desligado, B e C abaixo formam gaps opostos.

| B | C | Faixa esperada |
| --- | --- | --- |
| 101/111/100/110 | 111/114/108/112 | Alta, 105 a 108 |
| 99/100/89/90 | 89/92/86/88 | Baixa, 92 a 95 |

- Para alta, mudar a mínima de C para 105 ou o fechamento de B para 105 impede a formação. Para baixa, mudar a máxima de C para 95 ou o fechamento de B para 95 impede a formação. Retorno zero, direção contrária e abertura zero também impedem a formação.
- Com limiar automático, uma sequência de retornos absolutos anteriores iguais a zero deve aceitar um deslocamento de B que supere duas vezes a média atual. Se o deslocamento igualar o limiar, o candidato é rejeitado. Inclua candles sem candidato na média e compare o resultado com o filtro desligado.
- O FVG de alta permanece quando a mínima seguinte é 107 ou 105 e sai quando é 104. O FVG de baixa permanece quando a máxima é 93 ou 95 e sai quando é 96. Um único candle que atravesse as bordas de vários gaps remove todos os atingidos.
- A extensão 0 termina em C. A extensão 1 termina no candle seguinte observado, inclusive se ele abrir em outra sessão. No último candle, antes de o próximo existir, a faixa termina em C. Reavaliar C com o mesmo OHLC deve produzir um único gap com os mesmos limites.
- Ao acumular mais de 100 gaps ativos, descartar os mais antigos. A seleção visual deve mostrar até cinco, dos mais recentes para os mais antigos. Alternar a camada ou usar os modos exclusivos de Order Block preserva as saídas das demais camadas.

## Zonas Premium, Equilibrium e Discount

| Fundo | Topo | Premium | Equilibrium | Discount |
| ---: | ---: | --- | --- | --- |
| 100 | 200 | 195 a 200 | 147,5 a 152,5 | 100 a 105 |
| 90 | 220 | 213,5 a 220 | 151,75 a 158,25 | 90 a 96,5 |

- Sem os dois pivôs confirmados anteriormente, ou com topo igual ao fundo, não desenhar. Depois de ambas as confirmações, uma máxima de 220 e uma mínima de 90 expandem o intervalo 100–200 conforme a segunda linha.
- Se o intervalo 90–220 receber um topo confirmado em 210, o desenho no candle de confirmação continua com o topo 220, desde que sua máxima seja menor. No candle seguinte, com máxima de até 210, usar o topo 210 e ancorar no candle de origem desse pivô. Se depois confirmar fundo em 100, aplicar o mesmo encadeamento no lado inferior.
- Reavaliar o candle de confirmação com o mesmo OHLC produz os mesmos limites e a mesma origem. A virada de sessão preserva as horas de início e fim e deixa um único rótulo por zona.
- Desligar a camada ou selecionar um modo exclusivo de Order Block oculta as zonas. Alternar a camada preserva as saídas das demais.

## Breaker Blocks de swing

Com um OB de demanda ativo entre 100 e 110 e filtro automático de FVG desligado, usar o seguinte OHLC.

| Candle | Abertura | Máxima | Mínima | Fechamento |
| --- | ---: | ---: | ---: | ---: |
| A | 116 | 120 | 106 | 108 |
| B | 108 | 109 | 101 | 103 |
| C | 102 | 102 | 97 | 99 |

O FVG de baixa vai de 102 a 106 e o Breaker de baixa de 100 a 110. A faixa aparece no candle seguinte e começa em C. Para espelhar o caso, subtrair cada preço de 210 e trocar máxima pela mínima na tabela. O Breaker então é de alta.

- Se A tocar o OB e fechar novamente acima de 110, rejeitar o caso de baixa, mesmo com FVG. Rejeitar também FVG de direção contrária, FVG sem sobreposição ou apenas com toque, OB criado em A ou depois, mitigação anterior a A e C fechando em 100 ou acima dela.
- Um fechamento posterior em 110 mantém o Breaker de baixa. Um fechamento acima de 110 retira a faixa na abertura da próxima barra. Aplicar a regra inversa ao Breaker de alta. Reavaliar um mesmo candle preserva a quantidade e a ordem.
- Com mais de 100 Breakers ativos de uma direção, reter os 100 mais recentes. Conferir as ordens 1 e 2 e a seleção pela direção original do OB nos modos 1 e 2.

## Candidatos a OB do Breaker estrutural

Com tick 1, considere um topo em 115 confirmado na barra 2 e um fundo intermediário originado na barra 4 e confirmado na 7. A barra 4 abre em 106 e fecha em 102, com máxima 107 e mínima 100. A barra 5 fecha em 108. A barra 6 abre em 108 e fecha em 123, com máxima 124 e mínima 107. Com deslocamento válido e ruptura causal de 115 na barra 6, o candidato ICT congela 100–107, qualifica na 7 e publica o marcador na 8. Espelhar preços em torno de 120 e repetir nas duas escalas.

- Se a barra 4 for doji e não houver outra vela contrária elegível, o ICT fica sem candidato. Com um OB legado de 101–106 criado pela ruptura da barra 6, o adaptador publica o marcador com `LUX_SOURCE` se a vela de origem for doji.
- Se a barra 8 atingir 99 e fechar em 121, a remoção por pavio do OB legado preserva o registro qualificado com limites 101–106. Se fechar em 100, registrar remoção por fechamento. Se o OB for retirado antes de qualificar, o adaptador não publica marcador.
- Um fechamento anterior a `u` abaixo da faixa rejeita o candidato. Um fechamento dentro da faixa preserva a saída anterior como evidência enquanto a borda oposta estiver intacta.
- Com `DebugSMC=False`, conferir que os registros são produzidos e os marcadores ficam ocultos. Com `ModoBB=0`, comparar a faixa legada com a revisão aceita da 11C. [Tarefa 12A](tasks/12A-breaker-compatibilidade.md)

## Breaker estrutural confirmado

Considere fluxo swing de baixa, fundo de referência em 100, topo intermediário em 127 e OB vendedor LuxAlgo de 119–125 confirmado na barra 20. Com tick 1, uma mínima de 98 e fechamento em 102 na barra 21 fazem um LG em 100. Na barra 22, uma máxima e fechamento em 126 confirmam a falha do OB e preservam o topo intermediário. Na barra 23, o fechamento em 134 confirma a quebra de 127. Se o deslocamento de reversão qualificar, o Strict publica a faixa compradora 119–125 na barra 24, ancorada na barra 23.

- Para inverter a ordem, usar buffer da falha de 7 ticks e fechamento em 128 na barra 22. A quebra estrutural vem primeiro e a falha ocorre no fechamento em 134. Com o prazo entre quebras de 1 barra, os dois arranjos são válidos.
- Para SW ou SH, deixar a barra 20 confirmar o OB e fechar abaixo de 100. Recuperar 100 na barra 21 ou 22. No SH, a recuperação e a quebra de 127 podem acontecer na mesma barra.
- Sem tomada de 100, o Flexible com filtros desligados pode publicar após falha e quebra. Em BOTH, quando os dois modelos confirmam juntos, a faixa é única e o rótulo diz Strict.
- Com o debug desligado, executar nos slots 9 a 12 e alternar a ordem 1/2 quando houver duas zonas na mesma escala e direção. Conferir a faixa, a âncora e o rótulo após recarga e virada de sessão. [Tarefa 12B](tasks/12B-breaker-estrutural.md)

## Gestão da zona confirmada

Para uma faixa compradora de 119–127 ativada na barra 23, considere as seguintes barras fechadas, com tick 1.

| Barra | Máxima | Mínima | Fechamento | Resultado |
| --- | ---: | ---: | ---: | --- |
| 24 | 135 | 127 | 132 | Primeiro toque, 0%, visita 1 |
| 25 | 134 | 123 | 130 | 50% dentro da mesma visita |
| 26 | 136 | 129 | 135 | Barra inteira fora da faixa |
| 27 | 136 | 119 | 130 | 100%, visita 2, zona preservada |
| 28 | 118 | 110 | 113 | Gap abaixo da distal invalida e preserva a contagem de duas visitas |

- Com `OcultarMitigadasBB=50`, a faixa some após o fechamento da barra 25 e o registro continua acompanhando as barras até a invalidação em 28. Com `EncerrarAposMitigacaoBB=50`, a faixa termina na barra 25.
- Com `MostrarInvalidadasBB=1`, o trecho mantém a cor original até a barra 28. O valor 2 pinta o trecho encerrado em cinza e 0 o oculta. Espelhar o exemplo para uma faixa vendedora.
- No reteste, se o primeiro toque tiver mínima 125 e o alvo interno de alta 136 já estiver confirmado, um candle posterior com máxima 138 e fechamento 137 pode qualificar a reação e a quebra, desde que cumpra o ATR exigido. Em modo 2, um alvo conhecido só no candle do toque fica indisponível para esse reteste. [Tarefa 12C](tasks/12C-gestao-breaker.md)
