# PRD — Evolução incremental do SMC_Hebim

Versão 1.0 | 24/11/2026 | Profit Pro / NTSL | complemento às entregas 1–7 existentes.

## 1. Objetivo
Adicionar ao indicador existente Flip e suas faixas, Inducement, padrões de captura de liquidez e Breaker Blocks estruturais, com entregas pequenas, testáveis e reversíveis. Preservar o comportamento LuxAlgo e as configurações atuais. Não reconstruir o indicador nem criar ordens automáticas.

## 2. Fontes e precedência
- `referencias/prd_atual.md` e `referencias/spec_atual.md`: baseline documental do produto; são normativos para funcionalidades existentes. Os anexos de configuração mostram PeriodoSwing=10, BarrasConfirmacaoEQ=1 e LimiarEQ=0,09 em uso, mas os defaults documentados são 50, 3 e 0,1, respectivamente. Não substituir defaults pelos valores de uma instância. Manter presets existentes.
- `referencias/PRD_SMC_Flip_Profit_Pro.md`, `referencias/PRD_SMC_Inducement_IDM_Liquidity_v1.1_Profit_Pro.md`, `referencias/PRD_SMC_Breaker_Block_Profit_Pro.md`: catálogo dos requisitos discutidos anteriormente. As regras conflitantes de motor estrutural/OB/ATR ficam substituídas pela especificação de integração `SPEC_evolucao.md`; demais requisitos são implementados somente na entrega que os agenda. P0/P1/P2 antigos não são ordem de execução do projeto atual.
- Código NTSL, `casos.md`, tarefas originais e evidências de compilação não foram anexados nesta análise. Codex deve verificar no repositório antes de editar; divergências devem ser relatadas e não corrigidas silenciosamente.
- Os exemplos gráficos anteriores definem a intenção visual de Flip e LG/SW/SH; não são dados OHLC de teste nem prova de equivalência exata.

## 3. Inventário e lacunas
| Existente | Preservar | Complementar |
|---|---|---|
| Swing LuxAlgo | leg, janela PeriodoSwing, cruzamentos e viés | histórico imutável dos pivôs e eventos, proteção contextual |
| Interna LuxAlgo | janela fixa 5, filtro e independência | calcular quando módulo novo precisar, ainda que oculto |
| OB interno/swing | seleção por extremos analisados, ATR200, remoção, slots 0–4 | eventos de criação/remoção, snapshots; origem ICT própria opcional |
| EQH/EQL | janela e tolerância ATR200 próprias, rótulo segundo pivô | fonte de liquidez causal por extremo do par |
| FVG | fórmula e filtro automático LuxAlgo, mitigação e extensão | eventos de formação independentes da exibição, Unicorn opcional |
| Premium/Equilibrium/Discount | bandas 95–100, 47,5–52,5, 0–5% | régua congelada por Flip/BB, não modificar zonas existentes |
| Breaker atual | swing, modo 1/2, FVG A/B/C, travessia sem repique, cinza | modelo separado ICT Strict e Flexible, internos, gestão e confluências |
| Flip/IDM/LQ | não documentados no baseline | módulos novos |

## 4. Entregas em ordem (cada subentrega com gate próprio)
| Entrega | Resultado observável | Dependência | Critério de saída |
|---|---|---|---|
| 08A — auditoria e fundação | baseline congelada, sem mudança gráfica | código atual | compilação e regressão B01–B12 |
| 09A — Flip estrutural | linhas FLIP+ / FLIP− e escala | 08A | sequência simétrica e sem repaint |
| 09B — Flip POI | faixa origem, meio, fresh/mitigação/invalidação | 09A | limites e ciclo verificados |
| 09C — Flip avançado | EQ, sweep local, Fibonacci, Extreme/Continuation, filtros independentes não dependentes de IDM/LQ | 09B | critérios de confluência e localização |
| 10A — IDM estrutural | último pullback elegível antes de BOS swing | 09C | causalidade, proteção e seleção |
| 10B — gestão IDM | toque, tomada, confirmação posterior, múltiplos níveis | 10A | estados e confirmação sem CHoCH indevido |
| 10C — IDM adicional | FLIP_LOCAL, POST_BOS, opções e filtros locais | 10B | modelos separados e sem duplicidade |
| 11A — Liquidez | níveis de swing/IDM e LG | 10C | BSL/SSL, consumo, deduplicação |
| 11B — Liquidez | SW e SH; timeout e gaps | 11A | classificação exclusiva pelo primeiro retorno |
| 11C — Liquidez avançada | EQH/EQL, extremos de sessão, confirmação e confluência Flip/IDM | 11B | fontes causais, filtros completos |
| 12A — BB compatibilidade | modo LEGACY preservado, candidatos e seleção de fonte OB | 11C | regressão exata do Breaker atual |
| 12B — BB estrutural | ICT Strict e Flexible, faixas internas/swing | 12A | captura, falha, quebra, displacement, original preservado |
| 12C — BB gestão | visitas, mitigação, reteste, invalidação, cores/slots | 12B | ciclo de vida e desenho |
| 13 — Integração final | Unicorn, scores, alertas e dependências dos filtros | 12C | testes combinados e release |

A [tarefa 12A](tasks/12A-breaker-compatibilidade.md) registra a comparação com a 11C e a validação dos marcadores de candidatos a OB no Profit.
A [tarefa 12B](tasks/12B-breaker-estrutural.md) cobre a confirmação Strict e Flexible, os slots exclusivos 9–12 e a comparação com a revisão aceita da 12A.
A [tarefa 12C](tasks/12C-gestao-breaker.md) cobre a gestão das zonas no painel e nos slots e registra a comparação com a 12B aceita.
A [tarefa 13](tasks/13-integracao.md) registra a integração final e seu roteiro de aceite no Profit Pro.

As tarefas `tasks/08A-fundacao.md`, `09-flip.md`, `10-idm.md`, `11-liquidez.md`, `12-breaker.md` e `13-integracao.md` contêm os gates e casos. Não iniciar uma subentrega sem aprovação da anterior; não exigir que recursos de entregas futuras estejam disponíveis. Se uma subentrega for grande, separar cálculo e desenho em commits, mas só aprovar quando o resultado for observável e testado.

## 5. Requisitos transversais
EVO-01: defaults dos novos módulos e flags de exibição desligados; `ModoBB=0` (LEGACY) mantém o comportamento de `MostrarBreakerBlocks` já existente. Não renomear, reordenar ou alterar defaults dos inputs existentes sem migração aprovada.

EVO-02: não alterar algoritmo de pernas, ordem interna/swing, cruzamentos, viés, filtro de confluência interno, OB, EQ, FVG ou PD para atender a novas regras. Camadas novas podem ter viés confirmado/protegido próprio, com nomes distintos e snapshots. Nenhuma escreve no estado original.

EVO-03: um único motor de eventos causal por instância; independência entre processamento e renderização dos novos módulos. Preservar a política atual de renderização/ativação dos recursos antigos. Dependências novas forçam cálculo oculto somente quando necessário; não ligam automaticamente labels antigos.

EVO-04: processar barra fechada. Separar índice de origem, de confirmação e de publicação; caso NTSL exija barra seguinte, publicar nela apontando para timestamp da confirmação, não alegar disponibilidade antecipada. Sem retroatividade, sem repaint de eventos confirmados, sem alertas duplicados intrabar.

EVO-05: faixas e níveis congelados; permitir múltiplas zonas. Não juntar por preço apenas (exceto alias de liquidez física); ranking determinístico. Eventos históricos não se apagam por perda de contexto, mitigação ou ocultação. Se a plataforma só permitir ativos visíveis, guardar diagnóstico e histórico até capacidade documentada.

EVO-06: normalizar comparações novas em ticks; igualdade não é ruptura; buffer de 1 tick significa distância >=1 tick e cruzamento estrito. ATR14 Wilder novo, independente de ATR200 legado. Sem dados/ATR necessário, aguardar ou rejeitar com motivo.

EVO-07: manter modos 0–4 existentes. Novos modos exclusivos de faixa, propostos 5/6 Flip swing alta/baixa, 7/8 Flip interno alta/baixa, 9/10 BB estrutural swing alta/baixa, 11/12 BB estrutural interno alta/baixa. Se o código já usar números adicionais, mapear sem colisão e documentar. OrdemFaixaOB continua para 1–4; OrdemFaixaSMC nova para slots novos. Não alterar significado de 1 e 2 quando Breaker legado ligado. Modo 0 é painel principal; slots de faixa não dependem da visibilidade do painel. Usar desenho suportado ou fallback de dois plots com lacunas.

EVO-08: configurações exclusivamente visuais não alteram registros de negócio. Alterações de regras estruturais provocam recálculo determinístico. Cada input documentado com tipo, default, unidade, faixa, dependência. Inputs novos não aplicáveis à entrega não devem ser expostos como funcionais.

EVO-09: mesma revisão, mesmo OHLC desde inicialização, ativo, tick, sessão, fuso, parâmetros e versão Profit para replay, reload e comparação. LuxAlgo é referência somente para o baseline; módulos novos são validados por fixtures próprias, prints e replay, não por suposta paridade LuxAlgo.

EVO-10: validar capacidade NTSL e performance; sem inventar APIs. Sem acesso ao Profit, fornecer roteiro e marcar aprovação pendente, nunca declarar compilação. Preservar atribuição e licença CC BY-NC-SA 4.0 informada no projeto; conferir obrigações antes de distribuir/comercializar adaptação.

## 6. Escopo final
Inclui: Flip estrutural clássico, flexível/sweep, POIs primário/extremo/continuação; IDM estrutural, local e pós-BOS; LG/SW/SH e fontes de liquidez; BB Legacy/ICT/Flexible e Unicorn; opções de ATR, buffers, mitigação, Fibonacci, volume, FVG, score e alertas. Modo FLIP_SD clássico (zona testada/reação/ruptura da distal), HTF, agrupamento avançado, modelos experimentais e recursos de múltiplos períodos ficam no backlog após entrega 13, conforme referências; não são considerados implementados. Nenhuma promessa de vantagem estatística.

## 7. Definition of Done por entrega
- Revisar diff e listar arquivos alterados, inputs e comportamentos novos.
- Compilar no ambiente Profit da versão alvo; anexar resultado real ou marcar pendente.
- Executar casos sintéticos unitários (motor de referência ou harness) e replay OHLC da plataforma, reportar ambos separadamente. Comparar logs; teste de modelo externo não prova comportamento NTSL.
- Registrar tabela caso/esperado/observado/status, timestamps, imagens, revisão e parâmetros.
- Executar regressão baseline com módulos desligados, toggles visuais, replay e reload; zero divergência não explicada. Comparar BB legado também ligado em slots 1/2.
- Validar visual em histórico e ao vivo, sem vazamento de futuro, limites estáveis e ausência de faixas fantasmas.
- Verificar capacidade e tempo de cálculo contra baseline medido. Relatar impacto e limite de plataforma; não remover histórico sem política explícita.
- Criar commit/tag de entrega, atualizar PRD/spec/casos/tarefa no repositório conforme convenções existentes e solicitar aceite. Não iniciar próximo gate automaticamente.
