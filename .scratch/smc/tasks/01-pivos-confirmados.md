# 01 — Detectar e exibir pivôs de swing confirmados

Status: ready-for-human

## Entrega

Conferir no Profit topos e fundos de swing com a janela e as transições da referência Pine. Exibir opcionalmente o rótulo no candle de confirmação e uma linha no nível do último pivô de cada lado.

## Aceitação

- [x] Roda como indicador no gráfico do Profit Pro, conforme a captura da versão com as linhas de pivô.
- [x] Os quatro pivôs da [sequência de referência](../casos.md) aparecem nos índices e níveis previstos no teste local da lógica.
- [ ] Com o mesmo histórico e `MostrarPivos` ligado, as confirmações batem com a referência, considerando a diferença de posição entre o rótulo original e a confirmação.

## Evidência

O teste local traduziu o fluxo do [fonte NTSL](../../../src/indicadores/smc.ntsl) para Python e verificou as quatro confirmações e o efeito de `MostrarPivos`. SHA-256 do fonte testado `24ecba029555632817d87980b78b1c4ae355eeb9c75b3242ee4695c4d1463ea1`.

O usuário executou a versão básica no Profit. A captura do gráfico mostra `SMC_Hebim [50 Falso]` em `WINFUT - WINZ26`, no diário, sem marcações do indicador visíveis no recorte. A captura de parâmetros mostra `MostrarPivos` ligado, porém não traz o gráfico após essa configuração. A aplicação do indicador foi observada. O hash da versão compilada e a conferência dos pivôs continuam pendentes.

Registre versão do Profit, hash do fonte, início do histórico, sessão, fuso e os horários e níveis dos pivôs observados com `MostrarPivos` ligado.

Na nova captura, o indicador está aplicado ao WINFUT diário como `SMC_Hebim [50 Verdadeiro]` e os pivôs continuam sem marcações visíveis. A revisão seguinte passa a exibir os níveis confirmados com `Plot3` e `Plot4` e coloca os rótulos junto ao candle de confirmação. A conferência dessa revisão no Profit está pendente.

O teste local da lógica na revisão `cae95d010604782ef6fbe844810bf7a1f7c0dcf5402c7ebce756d4972d5c789b` verificou as duas linhas desde a confirmação, sua atualização nos pivôs seguintes e a ausência das linhas e dos rótulos com `MostrarPivos` desligado. Os quatro rompimentos continuaram a ocorrer nos candles esperados.

A captura seguinte confirma a exibição das linhas e dos rótulos `Topo swing` e `Fundo swing` no WINFUT (`WINZ26`), diário, com `SMC_Hebim [50 Verdadeiro]`. Os últimos níveis exibidos são `216.718` (topo) e `156.533` (fundo). A captura não comprova a revisão do código carregado nem o alinhamento com o TradingView.

Na comparação visual de setembro a novembro de 2026, o recorte do TradingView mostra círculos azuis em intervalos regulares. No Pine fornecido, `Show Swings Points` identifica os pivôs de swing com os textos `HH`, `LH`, `HL` e `LL`. Use esses rótulos para recolher direção, data de origem e nível do pivô. O Pine ancora o rótulo na barra de origem. No Profit, a marca e a alteração da linha são exibidas 50 candles depois, na confirmação. Verifique o nível na máxima ou mínima da barra de origem e inclua candles posteriores para observar a confirmação de candidatos recentes. Para cada comparação, confira a série e o ajuste e registre data de origem, data de confirmação e preço.

O TradingView mostrou um `HL` com origem em **11/08/2026**. Em uma série diária com um candle por pregão, o 50º candle seguinte cai em **22/10/2026**, contando a partir de 12/08 e excluindo os feriados de 07/09 e 12/10. No Profit, procure o rótulo `Fundo swing` ou confira o nível da linha verde no candle de confirmação. O nível esperado é a mínima de 11/08, cujo valor exato não aparece na captura. [Calendário de negociação da B3](https://www.b3.com.br/pt_br/noticias/calendario-de-negociacao-da-b3-confira-o-funcionamento-da-bolsa-em-2026.htm)

O usuário informou que o fundo esperado não apareceu no Profit. A captura cobre a região de confirmação, mas o resumo aberto é de **21/08/2026** e mostra mínima de `174.724`. O candle de origem de 11/08 ficou fora do recorte. A causa segue em aberto. Compare o histórico diário das plataformas desde antes do pivô anterior até 22/10/2026, incluindo a configuração de ajuste. Se as séries coincidirem, confira no Profit se a mínima candidata de 11/08 é estritamente inferior às 50 seguintes e se a perna anterior à confirmação é de baixa.
