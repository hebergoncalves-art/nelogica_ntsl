# 11C — Liquidez avançada e integração com Flip e IDM

Status: aceita

Depende do aceite da [11B](11B-recuperacao-liquidez.md) e cobre a [seção D3](../SPEC_evolucao.md#d3-fontes-e-integrações-11c).

| Caso | Resultado esperado |
| --- | --- |
| C01 | EQH/EQL usa os dois pivôs do detector legado e o extremo em ticks. Ocultar o rótulo preserva a fonte. Penetração até a confirmação invalida a fonte. |
| C02 | Sessão com cobertura completa ativa os extremos no fechamento da última barra, inclusive após meia-noite. Sessão parcial encerra as fontes anteriores sem criar novas. |
| C03 | Modos 0, 1 e 2 preservam o padrão físico. Reação posterior, alvo interno causal, prazo inclusivo e OHLC inválido determinam o desfecho separado. |
| C04 | Filtros local, LG e LG/SW/SH respeitam a janela de B. A recuperação depois de B pode qualificar o Flip dentro do prazo. A referência permanece conhecida se a geração for reciclada durante a espera. A mesma tomada mantém referência comum entre Flip, IDM e LQ. |
| C05 | O modo genérico de varredura exige captura do preço exato de H0/L0 no lado esperado. |
| C06 | As opções novas desligadas preservam o gráfico da revisão aceita da 11B, com o motor LQ ligado ou desligado. |

## Configuração

- `FonteEQH_EQL` e `FonteSessaoAnterior` vêm desligadas. Para sessão anterior, use o horário do gráfico em `InicioSessaoLQ` e `FimSessaoLQ` no formato HHMM. Informe `IntervaloSessaoLQ` em minutos. Os três campos iniciam em zero, combinação que deixa a fonte indisponível. A abertura é inclusiva e o fim é exclusivo. A duração deve ser múltipla do intervalo. A fonte exige todos os candles esperados e válidos.
- `ModoConfirmacaoLQ=0` desliga o desfecho opcional. O modo 1 exige reação por fechamento depois da recuperação. O modo 2 acrescenta quebra interna causal. `ReacaoPosCapturaATR=0.5` usa o ATR anterior à tomada e `MaxBarrasConfirmacaoLQ=30` conta a partir da recuperação. O ID e a classificação LG, SW ou SH permanecem registrados.
- `FiltroIDMFlip=0` e `FiltroSweepFlip=0` vêm desligados. O modo 1 registra evidência disponível, o modo 2 a exige e ambos preservam a pontuação atual. `ModoCapturaFlip=0` usa evidência local, 1 aceita LG e 2 aceita LG, SW e SH. O prazo de qualificação usa `MaxBarrasFVGFlip`. `lqCalculoOculto` sinaliza execução por dependência com a exibição geral desligada.

## Revisão local

- SHA-256 `8d93849770f15ebbe24825ece1989732bb7ad6c951774659efc7d9b3e4e4c76d`, conferido por `./scripts/verificar-indicador.ps1 -Indicador smc`.
- `node scripts/testar-regressao-smc.cjs` passou nos 70 cenários locais, incluindo C01–C06 e as 64 regressões anteriores.

## Validação no Profit Pro

O usuário informou em 24/11/2026 que os testes da 11C passaram e autorizou a 12A. O aceite se refere ao commit `6fad88b` e ao SHA-256 acima. Versão do Profit, ativo, período, parâmetros e resultados individuais não foram informados.

1. Compilar a revisão acima e aplicar com `ModoFaixaOB=0`. Ligar a liquidez e `FonteEQH_EQL`, mantendo o rótulo legado oculto. Conferir a confirmação do par, o nível selecionado e a publicação do padrão.
2. Ligar `FonteSessaoAnterior` e informar início, fim e intervalo do gráfico intradiário. Conferir uma sessão completa, uma parcial e a virada de data para um horário que cruze meia-noite.
3. Comparar os três modos de confirmação e os três modos de captura do Flip. Conferir que a recuperação tardia dentro do prazo qualifica na barra seguinte e que uma tomada coincidente mantém o mesmo ID de captura.
4. Registrar revisão, versão do Profit, ativo, período, tick, sessão, parâmetros e resultados observados de C01–C06.
