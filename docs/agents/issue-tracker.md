# Tracker local em Markdown

Cada indicador tem uma pasta `.scratch/<indicador>/` versionada no Git. Use o mesmo slug do fonte NTSL, com letras minúsculas, dígitos e hífens entre segmentos.

- PRD em `prd.md` e especificação em `spec.md`.
- Uma tarefa por arquivo em `tasks/<NN>-<slug>.md`, com numeração a partir de `01`. Esse diretório vale também para as tarefas geradas pelas skills.
- Use a linha `Status:` próxima ao topo da tarefa. Registre dependências e critérios de aceitação no corpo, seguidos da evidência de validação. Acrescente comentários na seção `## Comentários` quando necessário.

Quando uma skill pedir publicação, escreva no caminho local correspondente. Quando pedir a leitura de uma tarefa, use o caminho ou procure pelo número na pasta do indicador.
