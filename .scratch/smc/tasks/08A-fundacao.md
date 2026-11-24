# 08A — Auditoria e fundação do SMC_Hebim

Status: aceito pelo usuário

Entrega limitada à fundação da [SPEC de evolução](../SPEC_evolucao.md). O aceite desta revisão precede a 09A. B01–B12 são a matriz reconstruída a partir da SPEC, dos [casos existentes](../casos.md) e do fonte, conforme autorizado. O checkout contém a tarefa 08 do Breaker. A tarefa 08A original e os anexos de `referencias/` citados no pacote estão ausentes.

## Baseline e revisão

| Campo | Registro |
| --- | --- |
| Commit de referência | `53f8560259735e7cbf537636a3bd438b519f8ca3` |
| SHA-256 da referência | `adb3ce8479a06291df0eb32ce4bddd15dc2ee3919d296cdd54be5ce45ec6ab94` |
| SHA-256 do candidato | `37b2bd0f549b2073a811141725aabc369a78d75da5775d5bbb434493858b7e51` |
| Profit Pro | Usuário informou funcionamento normal com `DebugSMC=True` e confirmou que os testes 08A estão OK. |
| Versão do Profit e evidência por caso | Versão, configuração de Replay e capturas não informadas. |
| Commit e tag 08A | Fonte em `acc5ffb`, referência da tag `smc-08a`. |

O verificador de estrutura e hash é `./scripts/verificar-indicador.ps1 -Indicador smc`. O [harness](../../../scripts/testar-regressao-smc.cjs) roda com `node scripts/testar-regressao-smc.cjs` na raiz. Lê a referência via Git e o candidato do workspace, interpreta o subconjunto NTSL usado nas duas revisões e compara as chamadas de desenho por barra. Alguns cenários injetam estado conhecido para alcançar limites ou isolar um produtor. A simulação local cobre preços, índices, ordens e argumentos de desenho. A renderização, o desempenho e o recálculo efetivos da plataforma exigem execução no Profit.

## Diagnóstico

| Área | Implementação e restrições observadas |
| --- | --- |
| Execução | Um indicador com séries da barra anterior e arrays unidimensionais. Swing avalia pivôs, depois PD lê os extremos anteriores. A estrutura interna classifica antes da swing. ATR200 alimenta EQ e OB. O detector FVG alimenta suas faixas e o Breaker. |
| Swing e interna | LuxAlgo por transições de perna. Extremos precisam superar estritamente a janela à frente do candidato. Topo tem prioridade quando ambos qualificam. Swing usa a janela configurável, mínimo 10. Interna usa 5, exige nível swing do lado correspondente presente e diferente, e mantém seu próprio viés e consumo. Filtro interno compara `High-Max(Close,Open)` e `Min(Close,Open-Low)`. O cruzamento legado usa níveis diferentes no fechamento atual e anterior quando ocorre substituição de pivô. O viés anterior determina BOS ou CHoCH. |
| Order Blocks | A menor mínima analisada (alta) ou maior máxima analisada (baixa) escolhe a origem do pivô até a barra anterior ao rompimento. A origem mais antiga vence empates. Usa Wilder 200 ou TR cumulativo desde a segunda barra. Amplitudes de pelo menos duas vezes a volatilidade invertem os limites analisados. Aplica limite de 100 por grupo antes da mitigação por máxima/mínima ou fechamento. O código também rejeita um candidato mitigado na própria barra de criação. Os limites invertidos podem permanecer no estado analisado interno e são normalizados no desenho exclusivo e no snapshot LEGACY, conforme o fonte atual. São até 20 faixas por grupo no modo 0. Os slots 1–4 escolhem por grupo, direção e ordem, com ancoragem ou dois plots e uma lacuna na troca. |
| EQH/EQL | Usa perna e janela independentes. Compara o último pivô confirmado do lado com o atual, em diferença estritamente inferior à fração do ATR200 na confirmação. O rótulo coincide com o preço do segundo pivô e o candle de confirmação. |
| FVG | Usa máxima/mínima de A/C, fechamento e retorno de B e filtro cumulativo opcional. A borda oposta cruzada estritamente remove o gap. Retém até 100 ativos e desenha até cinco, com extensão em candles e trechos por sessão. |
| Premium, Equilibrium e Discount | Usam extremos dinâmicos do swing, com faixas de 95–100%, 47,5–52,5% e 0–5%. A redefinição por pivô confirmado passa a valer para o desenho da barra seguinte. |
| Breaker LEGACY | Modos 1/2, sentido definido pela direção do OB original. Exige OB ativo antes de A, remoção em A/B/C, FVG compatível e com interseção positiva, travessia do OB inteiro e sem repique por fechamento. Ordena pela remoção e criação mais recentes quando a confirmação coincide. Mostra o intervalo integral original em cinza a partir de C, na chegada de C+1. Invalida por fechamento estrito e publica a retirada na barra seguinte. |
| Armazenamento e gráfico | OB/FVG/Breaker usam três quadros recentes e o Breaker usa cinco quadros de remoções dos OBs selecionados. Saltar além dessa memória requer reprocessar desde o início. `HorizontalLineCustom` usa chamadas próprias para cada faixa e, quando necessário, primeira sessão, sessões intermediárias e última sessão. Preenchimento entre dois plots depende da propriedade da instância. Data e hora do desenho vêm de séries por candle. Capacidade gráfica, vida útil de objetos e limites efetivos do compilador permanecem para a validação da versão alvo. |

O preset citado no PRD de evolução usa `PeriodoSwing=10`, `BarrasConfirmacaoEQ=1` e `LimiarEQ=0.09`. A lista abaixo registra os defaults efetivos. Os históricos e relatórios das tarefas 01–08 referem-se em parte a revisões anteriores. A [tarefa 08](08-breaker-blocks.md) registra verificação estática no hash de referência atual e deixa a compilação e o Replay desse hash em aberto.

| Inputs legados em ordem | Defaults na mesma ordem |
| --- | --- |
| `PeriodoSwing`, `MostrarPivos`, `MostrarEstruturaInterna`, `FiltroConfluenciaInterna` | 50, False, False, False |
| `MostrarBlocosInternos`, `MostrarBlocosSwing`, `QuantidadeBlocosInternos`, `QuantidadeBlocosSwing`, `UsarATRBlocos`, `MitigarPorFechamento` | False, False, 5, 5, True, False |
| `ModoFaixaOB`, `OrdemFaixaOB`, `AncorarFaixaOB` | 0, 1, True |
| `MostrarEQHEQL`, `BarrasConfirmacaoEQ`, `LimiarEQ` | False, 3, 0.1 |
| `MostrarFVG`, `FiltroAutomaticoFVG`, `ExtensaoFVG`, `CorFVGAlta`, `CorFVGBaixa` | False, True, 1, clGreen, clRed |
| `MostrarZonasPD`, `CorZonaPremium`, `CorZonaEquilibrium`, `CorZonaDiscount`, `MostrarBreakerBlocks` | False, clRed, clGray, clTeal, False |

## Contrato da fundação

| Input novo | Default | Domínio e efeito |
| --- | --- | --- |
| `PeriodoATRSMC` | 14 | Inteiro em barras, mínimo 2. Wilder com semente SMA da sequência válida. |
| `ToleranciaSMCTicks` | 1 | Inteiro não negativo em ticks. Faixa de igualdade no histórico auxiliar. |
| `BufferRupturaSMCTicks` | 1 | Inteiro não negativo em ticks. Mesmo com 0, o cruzamento auxiliar exige fechamento estrito. |
| `DebugSMC` | False | Booleano. Ativa coleta e inspeção no depurador, inclusive dos produtores ocultos. Os predicados originais continuam controlando o desenho. |

O motor recebe as decisões dos detectores do [fonte](../../../src/indicadores/smc.ntsl). Durante a formação de `t`, seu lote é refeito a cada cálculo. Na chegada de `t+1`, o lote de `t` é fechado e publicado uma vez, com índice, data e hora de confirmação, e índice de publicação distinto. O estado auxiliar só muda nesse ponto. `smcOrigemPublicada` identifica o último fechamento consumido. O lote confirmado usa `Mod(smcOrigemPublicada, 2)` e seus registros iniciam em `quadro * SMCLote`. A quantidade está em `smcLotes[quadro]`. Se a sequência fechar com salto, `smcLoteAusente` sinaliza a necessidade de recarregar o histórico para reconstituir o estado.

A chave local de registros é `(faixa,nascimento)` na instância do ativo e do período. Para exportar, prefixar ativo e período. Remoções e qualificações posteriores referenciam a mesma chave, com barra, etapa e motivo próprios. `smcEventoDadosValidos` marca a disponibilidade dos dados de origem aplicáveis ao fato e `smcEventoATRValido` marca o aquecimento do ATR congelado na confirmação. Um OHLC inválido ou tick indisponível impede decisões auxiliares dependentes e reinicia a sequência de ATR. A proteção e as comparações auxiliares usam preços quantizados pelo tick, preservando o preço original no registro.

| Faixa | Registro e vínculo |
| --- | --- |
| 1–4 | `Pivot`. Interna alta/baixa e swing alta/baixa, nessa ordem. Nascimento é a confirmação. `Ref` aponta à confirmação anterior do mesmo lado. `Origem` e `Lo` guardam barra e preço. |
| 5–8 | `Break`. Mesma ordem de escala e lado. `Ref` aponta à confirmação do pivô e `Lo` guarda o nível. `BrutoLo/Hi` guardam viés anterior/novo. CHoCH legado ocorre quando o viés anterior é oposto ao novo. |
| 9–12 | `OB`. Mesma ordem de escala e lado. Nascimento é a barra da ruptura na faixa correspondente de `Break`. `Origem` é o candle selecionado e `Ref` é a origem do pivô rompido. `Lo/Hi` guardam limites analisados e `BrutoLo/Hi` guardam mínima/máxima originais. |
| 13–14 | `FVG` de alta/baixa. `Ref/Origem/Nascimento` correspondem a A/B/C. `Lo/Hi` são os limites. |
| 15–16 | `EQH/EQL`. `Ref/Origem` são as origens do primeiro e segundo pivôs. `Lo/Hi` registram seus preços nessa ordem. |
| 17 | `PD`. Snapshot dos extremos efetivos usados para calcular as bandas. |
| 18–19 | `FlowSnapshot` interno/swing. `BrutoLo/Hi` registram fluxo anterior e novo (neutro 0, alta 1, baixa -1, transição 2). `Ref/Origem/Lo` identificam confirmação, origem e nível da proteção quando disponível. `Hi` guarda o extremo de retorno durante transição quando conhecido. |

O histórico alternado de cada escala aceita extremos de mesmo lado pelo mais extremo, com empate pelo último. Registros brutos continuam acessíveis pelo seu ID até reciclagem. Uma ruptura legada na própria confirmação recebe `TARGET_NOT_PREKNOWN` na camada auxiliar. Buffer maior que um tick aguarda a qualificação até a centésima barra seguinte, inclusive. Retorno ao nível, substituição do alvo, perda de contexto, dados inválidos e expiração encerram a espera. O histórico de ruptura guarda o resultado em `smcEventoQualificacao` e a barra em que foi obtido em `smcEventoBarraQualificacao`.

O fluxo confirma com dois pares alternados coerentes e ruptura causal sobre um alvo do histórico alternado. A proteção vem do pivô oposto já confirmado e com origem dentro da perna. A perda por fechamento inicia transição. Para consolidar, a fundação exige alvo originado após a perda, pivô corretivo posterior a esse alvo e ruptura causal na direção oposta. O retorno além do extremo anterior cancela a transição. `PROTECTION_UNKNOWN` indica que a ruptura confirmou ou manteve o fluxo sem estabelecer proteção. O fluxo interno tem estado próprio e não altera o externo.

Cada partição do arquivo usa até 100 registros. Os lotes de 320 posições comportam o máximo derivado de 315 observações por barra. O arquivo recicla primeiro o terminal mais antigo, preserva registros ativos e rupturas em espera e sinaliza `CAPACITY_FULL` quando a partição não tem vaga. `smcReciclados`, `smcRejeitadosCapacidade` e `smcMaiorLote` são observáveis no depurador. As terminações de OB/FVG preservam a confirmação original e registram a saída por mitigação, descarte por capacidade ou rejeição na criação, conforme aplicável. A capacidade é por instância e o histórico terminal é limitado.

As interfaces reservadas seguem a SPEC. `Flip` e `Zone` usam pivôs, ruptura, contexto e faixas congeladas. `IDM` usa o pivô de pullback, proteção e BOS. `LQLevel` e `Capture` usam IDs das fontes e tempos de ativação, tomada e recuperação. `BBCandidate` usa o snapshot de OB, a referência estrutural e a sequência causal da captura à quebra. `OrdemFaixaSMC`, `ModoContextoSMC`, slots 5–12 e `ModoBB` ficam reservados para as entregas que os usam.

## B01–B12

| Caso | Esperado | Observado local | Local | Profit |
| --- | --- | --- | --- | --- |
| B01 · Revisão e presets | Referência identificada, 26 inputs e constantes preservados, ambas as revisões compilam como Indicador. | Hash, ordem, valores padrão e constantes conferidos. | PASS | PENDENTE |
| B02 · Swing | Mesmos quatro pivôs e quatro rompimentos, sem reemissão. | Índices, níveis e rótulos dos oito eventos iguais. | PASS | PENDENTE |
| B03 · Interna | Quatro categorias, bloqueios nos dois sentidos e swing independente. | Janelas 10/50, filtro, empate, ausência e igualdade com swing conferidos. | PASS | PENDENTE |
| B04 · OB | Mesma origem, geometria, ordem, mitigação e descarte. | Quatro combinações ATR/cumulativo e máxima-mínima/fechamento. Máximos da série de seis internos e doze swing. Fixture cobriu rejeição imediata e capacidade 100. | PASS | PENDENTE |
| B05 · Faixas 0–4 | Mesma seleção, geometria, cor e lacuna. | 16 configurações exclusivas, limite de 20 por grupo no modo 0, troca de faixa e virada de sessão iguais. | PASS | PENDENTE |
| B06 · EQ | Par, preço, tolerância estrita e configuração visual equivalentes. | EQH/EQL simétricos, limiar zero, âncora do segundo pivô e saída oculta conferidos. | PASS | PENDENTE |
| B07 · FVG | Mesmo A/B/C, filtro, toque, mitigação, extensão e limites. | Ambos os lados, filtro automático, extensão 0/1 entre sessões e capacidades 5/100 conferidos. | PASS | PENDENTE |
| B08 · PD | Mesmos seis limites, faixa atual, origem e troca de sessão. | Limites 195–200, 147,5–152,5 e 100–105 no fixture 100–200, um rótulo por zona e troca de origem de t para t+1. | PASS | PENDENTE |
| B09 · Breaker LEGACY | Mesmas faixas e ordem com FVG visual oculto. | Modos 1/2 e ordens 1/2. Repique e sobreposição nula rejeitados. Cor, publicação C+1 e invalidação no candle seguinte iguais. | PASS | PENDENTE |
| B10 · Fundação | Causalidade, vínculo, buffer, fluxo simétrico, proteção e ATR independente. | Alvo recém-confirmado rejeitado apenas no auxiliar. Buffer 0/1/3, prazo inclusivo 100, cancelamentos, transição simétrica e ATR disponível após o 14º candle válido. | PASS | PENDENTE |
| B11 · Reavaliação | Reexecutar preserva fatos, IDs, ordem e desenho. | 410 barras com dois ticks por barra. As 19 partições coincidiram com o estado após a carga histórica. Salto de histórico diagnosticado. | PASS | PENDENTE |
| B12 · Capacidade e tempo | 100 por partição, terminais reciclados antes dos ativos, rejeição explícita e tempos comparáveis. | Limites, reciclagem e rejeição `CAPACITY_FULL` conferidos. Medianas locais em 850 candles, três execuções por configuração, com referência 45,4 ms, candidato OFF 45,3 ms e ON 261,1 ms. | PASS | PENDENTE |

Na coluna Profit, `PENDENTE` indica que o resultado por caso ainda está sem evidência detalhada no repositório. O usuário confirmou o aceite geral da 08A. A coluna local registra a execução dos dois fontes pelo simulador e testes adicionais da nova fundação. A inspeção do diff confirmou que as expressões legadas de pivô, cruzamento, viés, seleção de OB e Breaker LEGACY foram preservadas.

## Roteiro no Profit Pro

1. Colar cada revisão em uma Estratégia de Indicador separada usando o Editor local. Usar o hash acima para identificar a cópia. Compilar as duas e salvar o resultado textual, a versão do Profit e eventuais avisos de contexto. Conferir presets, opções do painel e modos 0–4.
2. Fixar WINFUT no diário e uma janela intradiária de 5 minutos com virada de sessão. Para ambas as revisões, registrar ativo e contrato, ajuste, tick, fuso, sessão, recorte e primeiro candle carregado, histórico OHLC e parâmetros. Usar instâncias separadas por revisão para evitar sobreposição. Rodar o candidato com `DebugSMC` desligado e ligado.
3. Para B02–B09, escolher amostras correspondentes no mesmo OHLC. Anotar índice e data/hora, preço, lado, tipo, geometria e diferenças. Conferir `OrdemFaixaOB` 1/2, ancoragem e preenchimento, FVG oculto com Breaker ativo, virada de sessão e sumiço após mitigação ou invalidação. Anexar capturas comparáveis. Se um caso sintético não puder ser reproduzido no histórico disponível, manter a verificação correspondente pendente.
4. Para B10–B11, acompanhar `smcOrigemPublicada`, o lote confirmado, `smcEventoQualificacao` e os snapshots no depurador durante o Replay. Conferir fechamento, publicação em t+1 e ausência de duplicação. Recarregar desde o mesmo início e repetir com os mesmos parâmetros.
5. Para B12, medir a carga do mesmo histórico três vezes para cada configuração (referência, candidato OFF e candidato ON) e comparar as medianas. Anotar a origem da medição, o tamanho do histórico, a capacidade observada e os contadores do depurador. Registrar qualquer limite ou degradação observado.
6. Atualizar o observado e o status por caso, com as evidências e a revisão testada. Registrar commit e tag após compilação e regressão aprovadas. Aguardar aceite explícito para iniciar 09A.

[Manual NTSL da Nelogica](https://downloadserver-cdn.nelogica.com.br/content/profit/manual_ntsl/ManualNTSL.pdf) · [Editor de Estratégias](https://ajuda.nelogica.com.br/hc/pt-br/articles/9165042993691-Editor-de-Estrat%C3%A9gias-Crie-estrat%C3%A9gias-pr%C3%B3prias-atrav%C3%A9s-do-Profit)
