# Piloto do Claude-Mem no Windows

**Status** — Aguarda a validação do indicador Fechamento.

1. Depois de concluir a [validação no Profit](../../.scratch/fechamento/tasks/01-validar-fechamento.md), instale o adaptador oficial com `npx.cmd claude-mem install --ide codex-cli`. Registre as versões do Claude-Mem e do Codex CLI e a opção de armazenamento escolhida.
2. Em uma sessão interativa do Codex CLI, revise os hooks instalados e confirme o carregamento do plugin. Abra uma sessão nova no projeto após a revisão.
3. Na sessão do CLI, use uma operação de ferramenta para gerar uma observação fictícia e encerre a sessão. Em outra sessão no mesmo projeto, verifique se o contexto do início da sessão ou a busca de memória recupera a observação sem fornecer seu conteúdo na pergunta.
4. Repita a captura e a recuperação no Codex desktop com outra observação fictícia. Registre o resultado por cliente, incluindo se houve captura, se houve recuperação e o erro observado em caso de falha.

[Guia de instalação](https://github.com/thedotmack/claude-mem/blob/main/docs/public/installation.mdx) · [Integração com Codex CLI](https://github.com/thedotmack/claude-mem/blob/main/docs/public/platform-integration.mdx)
