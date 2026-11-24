# Compilar e validar o indicador Fechamento

Status: ready-for-human

[PRD](../prd.md) · [Especificação](../spec.md) · [Fonte NTSL](../../../src/indicadores/fechamento.ntsl)

## Procedimento

1. No Editor de Estratégias, crie uma **Estratégia de Indicadores** chamada `Fechamento` e cole o conteúdo do fonte NTSL.
2. Compile e registre o resultado do menu de compilação. Se houver erro, anote a linha e a mensagem antes de corrigir o fonte e repetir.
3. Aplique o indicador a um gráfico com histórico disponível. Escolha três candles fechados e compare, em cada um, o valor do plot com o preço de fechamento na precisão exibida pelo Profit.
4. Preencha a evidência e marque a tarefa como validada após a compilação bem-sucedida e as três conferências.

Na raiz do projeto, obtenha a revisão do fonte com `./scripts/verificar-indicador.ps1 -Indicador fechamento`.

## Evidência

| Campo | Registro |
| --- | --- |
| Revisão do fonte (SHA-256) | `3f4f20a69e085d88cd1aa91a6bd2b652a7d789dea64dc419d3671a9f5f5840ad` |
| Versão do Profit Pro | `5.0.4.37` |
| Ativo | Pendente |
| Período gráfico | Pendente |
| Resultado da compilação | O editor exibiu `Código compilado*` na aba de edição. Falta confirmar a compilação como Estratégia de Indicadores. |

| Data e horário do candle no gráfico | Fechamento | Valor plotado | Coincide? |
| --- | --- | --- | --- |
| Pendente | — | — | — |
| Pendente | — | — | — |
| Pendente | — | — | — |

A interação com o Profit foi interrompida após aparecerem notificações de modificação de ordem de origem incerta. A aplicação ao gráfico e as três conferências permanecem pendentes.
