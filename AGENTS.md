# Desenvolvimento NTSL no Profit Pro

Use o [Manual NTSL da Nelogica](https://downloadserver-cdn.nelogica.com.br/content/profit/manual_ntsl/ManualNTSL.pdf) como referência para sintaxe, funções e requisitos de versão ou módulo. Use o [Fechamento](.scratch/fechamento/prd.md) como exemplo do fluxo local.

## Fluxo por indicador

1. **PRD** — Registre o objetivo, o que deve aparecer no gráfico e os critérios de aceitação em `.scratch/<indicador>/prd.md`. Use `grill-with-docs` para esclarecer as regras em aberto.
2. **Spec** — Use `to-spec` para consolidar entradas, regras por candle, saídas e casos-limite em `.scratch/<indicador>/spec.md`.
3. **Tarefas** — Use `to-tickets` para dividir a spec em entregas verificáveis. Cada tarefa indica o critério que cobre e eventuais dependências.
4. **Código** — Defina primeiro as entradas e os resultados esperados dos testes. Mantenha o fonte em `src/indicadores/<indicador>.ntsl`. No PowerShell, execute `./scripts/verificar-indicador.ps1 -Indicador <indicador>` para conferir a estrutura e obter o SHA-256 do fonte. A compilação ocorre no Profit.
5. **Validação** — O usuário opera o Editor de Estratégias e aplica o indicador a um gráfico histórico. Registre na tarefa a revisão, a versão do Profit, o ativo, o período gráfico, os parâmetros quando houver, e os resultados esperados e observados. Marque como validada após a compilação e a conferência dos casos. Se o fonte mudar, repita a validação para a nova revisão.

## Agent skills

### Issue tracker

Use Markdown no próprio Git. Consulte [Tracker local](docs/agents/issue-tracker.md).

### Triage labels

Use os rótulos padrão das skills. Consulte [Estados de triagem](docs/agents/triage-labels.md).

### Domain docs

O projeto tem um único contexto. Consulte [Documentação de domínio](docs/agents/domain.md).

## Memória entre sessões

Após validar o Fechamento, siga o [roteiro do piloto do Claude-Mem](docs/agents/claude-mem.md). Registre decisões e evidências no Git para que o fluxo possa ser retomado a partir do repositório.
