# 13 — Integração final do SMC_Hebim

Status: ready-for-human

Base aceita da 12C: `86d7cf7`, SHA-256 `5f4d48907bbf0ffba490d63e91889e5f66ba61669957083403d83ef278d7e817`. Consulte a [especificação](../SPEC_evolucao.md#h-integração-e-score-13) e os [casos combinados](../casos.md#integração-13).

## Aceite

| Caso | Resultado esperado | Profit Pro |
| --- | --- | --- |
| M01 | Unicorn de alta e baixa com interseção mínima de um tick. Âncora na confirmação do Unicorn, fim por mitigação do FVG ou encerramento do Breaker e histórico igual após recarga. Com disponibilidade dispensada, FVG já fechado gera só marcador. | Pendente |
| M02 | Filtro FVG opcional mantém a ativação original. FVG obrigatório aguarda até o último fechamento elegível. Prazo vencido e perda dos níveis bloqueiam a ativação. Flip e IDM respeitam causalidade com a exibição desligada. | Pendente |
| M03 | Volume usa a média das 20 barras anteriores. Fibonacci usa a perna congelada. Scores permanecem fixos e alertas aparecem uma vez por confirmação nova, incluindo eventos simultâneos e recálculo intrabar. | Pendente |
| M04 | FVG e Unicorn preservam registros abertos e reciclam encerrados primeiro. Saturação gera `CAPACITY_FULL`. Comparar o tempo de carga na 12C e na 13, com os novos recursos ligados e desligados. | Pendente |
| M05 | Uma captura IDM compartilhada pode atender ao filtro obrigatório e só uma captura distinta pontua. | Pendente |

## Verificação local

SHA-256 do fonte: `2129f5384ebf1f362c7bbf6b8c8d7927878d7e751f9074f3334b73979c71104d`.

A suíte local passou em 89 cenários, incluindo M01–M05. Na medição com 1.310 candles, a mediana de três execuções foi de 374,9 ms na 12C, 346,8 ms na 13 com recursos novos desligados e 502,1 ms com Unicorn, score e filtros opcionais ligados. As duas variantes foram exportadas e conferidas pelo hash e pela presença de `Alert` apenas na variante Alarme.

## Alerta de formação de FVG

`AlertasFVG=True` habilita o alerta de FVG por padrão e funciona com `AlertasSMC=False` e `MostrarFVG=False`. O detector respeita `FiltroAutomaticoFVG`. Quando o terceiro candle fecha confirmando o FVG, o sinal é publicado na primeira avaliação do candle seguinte, em verde para alta e em vermelho para baixa. Carga do histórico, toque e mitigação ficam sem aviso.

## Roteiro de validação

1. Compile `src/indicadores/smc.ntsl` no Editor de Estratégias. Aplique como indicador e confira a paridade com os presets da 12C no painel e nos slots 1–4 e 9–12.
2. No painel (`ModoFaixaOB=0`), use `ModoBB=3`, `MostrarBBEstrutural=True` e `MostrarUnicorn=True`. Compare o mesmo trecho com `MostrarFVG=False` e `True`. Ative `MostrarScoreSMC` e confira as notas e os timestamps em Replay, antes e depois de recarregar o gráfico.
3. Repita em alta e baixa, com FVG obrigatório e opcional. Varie o prazo entre 1 e 2 barras e use `DebugSMC=True` para ver o motivo quando o Breaker for recusado. Confira o limite de capacidade quando houver histórico adequado.
4. Teste alertas em tempo real com `AlertasSMC=True` e os módulos desejados habilitados. O primeiro candle novo depois da carga é o primeiro elegível. Para validar a liquidez, habilite `HabilitarCapturasLiquidez`. Se o Editor separar os tipos Indicador e Alarme, exporte duas variantes do mesmo fonte e crie uma regra no Gerenciador de Alarmes em **Ao satisfazer condição**. Use os mesmos parâmetros, ativo e periodicidade no gráfico e na regra. Valide a quantidade de notificações quando dois eventos caírem no mesmo candle. [Estratégias de Alarme](https://ajuda.nelogica.com.br/hc/pt-br/articles/4407277046171-Estrat%C3%A9gias-de-Alarme)

```powershell
./scripts/exportar-smc-profit.ps1 -Tipo Indicador -Destino ./smc-indicador.ntsl
./scripts/exportar-smc-profit.ps1 -Tipo Alarme -Destino ./smc-alarme.ntsl
```

Registre versão do Profit, ativo, período, tick, parâmetros, hash e resultados esperados e observados. O simulador local avalia chamadas de desenho e de alerta. O aceite exige conferir o efeito dessas chamadas no Profit.
