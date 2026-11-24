# 10B — Gestão do IDM

Status: aceita

Depende do aceite da [10A](10A-idm-estrutural.md) e cobre a [seção C2](../SPEC_evolucao.md#c2-estados-10b).

| Caso | Resultado esperado |
| --- | --- |
| G01 | Toque exato mantém o nível. A primeira penetração encerra o nível nos dois lados. Fechamento recuperado classifica sweep, fechamento além classifica rompimento e penetração abaixo do mínimo registra tomada sem qualificação. Gap completo do lado rompido classifica pelo fechamento. |
| G02 | Nova proteção igual ao IDM promove o nível. Proteção que deixa o IDM fora da faixa interna encerra o nível. Na perda de fluxo com tomada simultânea, a classificação física é registrada antes da falha de confirmação. A expiração respeita a janela inclusiva. |
| G03 | Modo 0 desliga a confirmação. Modo 1 exige reação em fechamento posterior à tomada. Modo 2 sem alvo retorna indisponível. O último candle do prazo ainda pode confirmar. |
| G04 | Ambos os lados congelam o alvo swing conhecido antes da tomada. O buffer pode ser atingido em fechamento posterior ao cruzamento inicial. O marcador aparece em Replay na barra seguinte à confirmação e permanece ancorado no fechamento que confirmou. |
| G05 | Dois níveis independentes podem ser tomados pelo mesmo candle. Visibilidade, preço e limite de desenho não mudam o histórico. Candle inválido não gera tomada. Perda de contexto encerra confirmação pendente. |

## Decisões de implementação

- A reação mede a distância do nível IDM ao fechamento favorável de um candle posterior à tomada. O limiar é o maior entre um tick e `ReacaoPosIDMATR` vezes o ATR disponível no fechamento anterior à tomada.
- O alvo do modo 2 é o pivô swing direcional mais recente admitido pelo motor auxiliar, no lado favorável do IDM. O alvo deve ser conhecido antes da tomada e permanecer sem fechamento além até o candle da tomada. Se o alvo estiver indisponível ou romper na tomada, o resultado fica indisponível. Depois de congelado, o alvo usa `BufferRupturaSMCTicks` e permanece o mesmo mesmo que outro pivô seja admitido.
- Com fluxo preservado e proteção momentaneamente indeterminada, permanece a regra da 10A de conservar o nível. Se a capacidade de 100 por lado for atingida, podem ser reciclados registros encerrados com resultado resolvido. Níveis ativos e confirmações pendentes permanecem na memória.
- `MostrarIDMCapturados` controla sweeps e tomadas abaixo do mínimo. `MostrarIDMRompidos` controla rompimentos. `MostrarIDMExpirados` controla apenas expiração. `MaxIDMsVisiveis` aceita de 0 a 10 no desenho e prioriza os níveis ativos mais recentes.

## Revisão local

- SHA-256 `5705a0fcb37cbf5549b74c52af91287d223f9d27d5c5a44a1499ced18812349e`, obtido com `./scripts/verificar-indicador.ps1 -Indicador smc`.
- `node scripts/testar-regressao-smc.cjs` passou nos 46 cenários do simulador local, incluindo G01–G05 e as 41 regressões anteriores.

## Validação no Profit Pro

O usuário informou em 24/11/2026 que os testes da 10B passaram e autorizou a próxima entrega. O aceite se refere ao SHA-256 acima. A versão do Profit, o ativo, o período, os parâmetros e os resultados individuais não foram informados.

1. Compilar o fonte da revisão acima e aplicar com `ModoFaixaOB=0`, `ModoIDM=0`, `HabilitarIDM=True` e `MostrarIDM=True`.
2. Em Replay, conferir os casos G01–G05. Para comparar reação e quebra no mesmo histórico, alternar `ModoConfirmacaoIDM` entre 1 e 2. Checar também os rótulos de sweep, rompimento, preço e confirmação com as opções visuais ligadas e desligadas.
3. Registrar a versão do Profit, a revisão, o ativo, o período gráfico, o tick, a sessão, os parâmetros e os resultados observados.
