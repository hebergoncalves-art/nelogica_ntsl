# SMC_Hebim — pacote de evolução para Codex

1. Preserve o projeto atual e faça commit/tag antes de incorporar este pacote.
2. Copie a pasta `SMC_Hebim_Evolucao` para o repositório (por exemplo, `docs/evolucao/`), sem sobrescrever `prd.md`, `spec.md`, `casos.md` ou código existentes.
3. Leia `PRD_evolucao.md` (roadmap e precedências), `SPEC_evolucao.md` (regras técnicas e integração) e a tarefa da entrega corrente em `tasks/`.
4. `referencias/` contém cópias dos documentos atuais fornecidos e dos PRDs anteriores. Links relativos originais para casos/tarefas referem-se ao repositório de origem, não a novos arquivos do pacote. As especificações novas prevalecem apenas nas diferenças explicitamente documentadas; funcionalidades baseline continuam regidas pelos documentos atuais.
5. Execute 08A e aguarde aceite. Depois 09A, 09B, 09C, 10A, 10B, 10C, 11A, 11B, 11C, 12A, 12B, 12C, 13, sempre um gate por vez.

## Prompt inicial
Atue como desenvolvedor sênior NTSL do SMC_Hebim existente. Leia integralmente PRD_evolucao.md, SPEC_evolucao.md e tasks/08A-fundacao.md; compare com o código e documentos do repositório. Execute exclusivamente 08A. Antes de editar, reporte conflitos entre especificação e código, liste funções e limitações reais da plataforma, proponha alterações mínimas e preserve os presets. Não modifique algoritmos LuxAlgo legados, não invente funções NTSL e não implemente Flip, IDM, Liquidity Capture ou BB estrutural nesta etapa. Gere baseline de regressão, logs e relatório de testes reais; se não tiver Profit, marque compilação/replay pendentes e entregue instruções para execução manual. Ao concluir, apresente diff, evidências, pendências e solicite aprovação antes de iniciar 09A.

## Prompt para próximos gates
Leia a seção da subentrega [ID] no PRD, SPEC e tarefa correspondente. Confirme aprovação da anterior. Implemente apenas [ID]; preserve baseline e entradas existentes. Execute os casos desta subentrega e regressões anteriores; apresente arquivos alterados, logs, resultados reais, screenshots disponíveis, limitações e status PASS/FAIL/PENDENTE. Não avance sem aceite. Atualize documentos do repositório após validação, preservando histórico das decisões.
