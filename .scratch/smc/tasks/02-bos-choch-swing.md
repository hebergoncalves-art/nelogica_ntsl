# 02 — Exibir BOS e CHoCH de swing

Status: ready-for-human

Depende de [01 — Pivôs confirmados](01-pivos-confirmados.md).

## Entrega

Exibir os quatro eventos de swing na direção, no nível e no candle de rompimento, mantendo as marcações históricas.

## Aceitação

- [x] Os quatro rompimentos da [sequência de referência](../casos.md) têm os resultados esperados no teste local da lógica, incluindo ausência de sinais repetidos.
- [ ] No histórico comum das plataformas, tipo, direção, horário e nível do rompimento coincidem. A comparação inclui trechos sem rompimento e candles sucessivos além de um nível rompido.
- [ ] Recarregar o gráfico com os mesmos dados e parâmetros mantém os eventos históricos.

## Evidência

Na mesma revisão do [teste de pivôs](01-pivos-confirmados.md#evidência), o fluxo do fonte traduzido para Python emitiu os quatro rótulos e os quatro valores de plot esperados. O teste cobriu `MostrarPivos` ligado e desligado.

Na comparação visual em WIN diário com janela de 50, o Profit não apresenta marcações de rompimento no recorte. O TradingView mostra o LuxAlgo em `Present` com outras camadas ligadas. As capturas não identificam um rompimento de swing em duas séries OHLC alinhadas, então a paridade segue pendente.

Repita com uma instância visível do LuxAlgo em `Historical`, só com estrutura de swing e `All` em ambos os sentidos. No Profit, habilite `MostrarPivos` e capture o gráfico após aplicar. Compare `High`, `Low` e `Close` nos mesmos pregões e verifique o ajuste da série contínua e o início do histórico. Para o primeiro rompimento de swing, anote o pregão do fim do segmento, a direção e o nível. Registre SHA-256, versão do Profit, símbolo, período, sessão, fuso e parâmetros.

A captura posterior do Profit em WINFUT diário com swing de 50 mostra as quatro categorias de rompimento (`BOS alta`, `BOS baixa`, `CHoCH alta` e `CHoCH baixa`). Ela confirma a exibição no histórico do Profit. A comparação por pregão e nível e a conferência após recarregar o gráfico seguem pendentes.
