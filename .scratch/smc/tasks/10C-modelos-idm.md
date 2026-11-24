# 10C — FLIP_LOCAL e POST_BOS

Status: ready-for-human

Depende do aceite da [10B](10B-gestao-idm.md) e cobre a [seção C3](../SPEC_evolucao.md#c3-outros-modelos-10c).

| Caso | Resultado esperado | Resultado local |
| --- | --- | --- |
| J01 | POST_BOS espelhado, do candidato à ativação do primeiro pullback elegível. A próxima ruptura swing e a tomada prévia impedem a ativação. | PASS |
| J02 | FLIP_LOCAL aceita sweep antes ou em B, exige pivô previamente confirmado e aparece somente após a qualificação do Flip. O cálculo independe da exibição de Flip. | PASS |
| J03 | Os cinco filtros usam evidências da direção e da perna até a decisão. Evidência opcional não bloqueia. Filtro obrigatório sem evidência bloqueia. Um alvo rompido antes da associação deixa a confirmação indisponível. | PASS |
| J04 | As partições retêm 100 registros por lado e modelo. A reciclagem preserva confirmações pendentes. ALL consolida o desenho de níveis ou tomadas coincidentes e mantém seus históricos. | PASS |
| J05 | Em empate na tomada, vence o pivô confirmado mais recentemente. O histórico é estável após recarga e com desenho oculto. O modo ALL preserva a saída estrutural do modo 0. | PASS |

## Configuração e regras

- `ModoIDM` usa `0` para STRUCTURAL, `1` para FLIP_LOCAL, `2` para POST_BOS e `3` para ALL. O padrão é `0`. `MostrarIDMCandidatos` é booleano e vem desligado. Mostra o pullback em avaliação ou o sweep associado a um Flip que aguarda qualificação.
- FLIP_LOCAL usa a perna de H2/L2 até B, inclusive, conforme o critério local acordado. Qualifica a primeira penetração de cada pivô interno pelo mínimo de ticks e pela recuperação no mesmo fechamento. Entre os elegíveis, seleciona a tomada mais recente. O registro conserva a data da tomada. O marcador sai em T+1, ancorado no fechamento T que qualificou o Flip. A reação é avaliada depois de T, com o ATR anterior à tomada. No modo 2, o alvo congelado deve estar intacto até T.
- POST_BOS exige pivô interno originado após a qualificação do BOS swing. A proteção da busca fica congelada. A reação do pullback deve ser conhecida antes da próxima ruptura swing causal. A linha ativa é publicada na barra seguinte à confirmação do pullback e a gestão segue a 10B.
- Todos os cinco filtros são inteiros de `0` a `2` e vêm desligados. O modo `1` registra o critério que passou. O modo `2` também o exige. A faixa Fibonacci usa a metade inferior para compra e a metade superior para venda. POI usa a faixa primária vigente. FVG usa o detector existente. Displacement e volume usam os limiares da 09C. Os pesos do IDM ficam para a integração final.
- O cálculo de Flip e FVG pode rodar como dependência dos modelos ou dos filtros, com a exibição desses módulos controlada pelos próprios parâmetros.

## Revisão local

- SHA-256 do fonte `66948ea8cd7091e03cd24da5c98830afca6b66d853643baa086cd047c4051e19`.
- O Profit rejeitou a revisão anterior na linha 3840. O laço de displacement agora usa um limite inteiro explícito. A verificação local rejeita chamadas diretas a `Min` ou `Max` nos limites de `for`.
- `./scripts/verificar-indicador.ps1 -Indicador smc` conferiu a estrutura. `node scripts/testar-regressao-smc.cjs` passou nos 51 cenários do simulador local.

## Validação no Profit Pro

Compilação e Replay pendentes.

1. Compilar a revisão acima e aplicar com `ModoFaixaOB=0`, `HabilitarIDM=True` e `MostrarIDM=True`.
2. No modo `1`, conferir compra e venda e anotar os candles do pivô confirmado, da tomada e da associação. Repetir com `HabilitarFlip=False` para conferir a dependência oculta. Alternar `ModoConfirmacaoIDM` entre 1 e 2 para checar reação após a associação e alvo já rompido.
3. No modo `2`, conferir a origem após o BOS, a confirmação do primeiro pullback elegível e o início do monitoramento no candle seguinte. Alternar `MostrarIDMCandidatos` para conferir a distinção no gráfico.
4. No modo `3`, conferir a consolidação do desenho e a estabilidade após recarga. Ligar os filtros individualmente nos modos 1 e 2 para verificar o efeito de evidência ausente.
5. Registrar versão do Profit, revisão, ativo, período, tick, sessão, parâmetros e resultado observado de J01–J05.
