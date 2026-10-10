# Avaliações estruturadas: candidato de integridade

DOCUMENTATION_IMPACT: UPDATE_REQUIRED. Código candidato; publicação não realizada.

New e Details mantêm o AppLayout, AppModuleShell, AppButton,
ClinicalSignatureConfirmModal e useClinicalRecordNavigationGuard existentes.
Salvar envia Evaluation e todas as respostas do formulário numa requisição
agregada. Assinar usa depois o lifecycle existente, com chave estável.
Conclusão só aparece após resposta válida de assinatura. Falha de assinatura
conserva o rascunho confirmado; falha de save conserva os campos no editor.

Uma ref compartilha a tentativa entre cliques; fieldset desabilita campos
durante a requisição. Timeout repete o mesmo payload/chave. Alterar um payload
de resultado desconhecido exige conferir a tentativa anterior. A edição envia
versão e IDs das instâncias; conflito não elimina os campos atuais.
Na criação, sessionStorage guarda somente a chave opaca por paciente, nunca
campos clínicos. Após reload, a API autorizada permite localizar o registro
daquela tentativa e abri-lo. Sem confirmação de persistência, não há conteúdo
clínico recuperável após fechar a aba; o guard de beforeunload alerta o usuário.

## Referências e decisões de interface

### Revisão de recuperação e assinatura

Um erro de assinatura conserva o modal e permite repetir a mesma tentativa,
com o rascunho confirmado e a chave original, sem outro POST de criação.
Details remove a chave opaca de criação somente após carregar completamente
o registro correspondente e confirmar paciente/chave. Chaves de outras
tentativas não são removidas. O rascunho permanece no banco e na timeline;
assinar e voltar a New na mesma aba permite iniciar outra avaliação.
Campos numéricos usam `step="any"` porque o contrato aceita números finitos,
incluindo decimais e zero. Nenhuma nova tela ou componente de navegação.

Regressões leves: 24 testes passaram. Suite global desta revisão: 140 suites,
1.545 testes aprovados e 3 ignorados. Lint global, mojibake, contrato de retry
e build passaram. Novos heads ainda dependem de CI/revisão coordenada e de
aprovação visual do usuário; PR55 incorporado continua sob seu gate próprio.

| Elemento | Referência inspecionada | Decisão e motivo | Consumidores |
| --- | --- | --- | --- |
| Cabeçalho, cards e campos | New/Details; AppLayout; AppModuleShell | Reusar estrutura atual | New/Details |
| Ações e erros | AppButton; SectionCard existente | Estender com erro persistente e link para o registro salvo | New/Details |
| Confirmação e retorno | ClinicalSignatureConfirmModal; ClinicalRecordNavigationConfirmation; guard | Reusar confirmação, Escape e descarte | New/Details |
| Campos bloqueados | AppForm não fornece bloqueio de um conjunto inteiro | Fieldset local sem decoração, mantendo layout e semântica nativa | New/Details |
| Número | Campos existentes das duas telas | Estender type/value; preservar zero | New/Details |
| Resposta tabular | AppTable, AppForm.Field, AppButton.GhostButton; renderers New/Details | Compor editor sem CSS próprio: antes New não renderizava table e Details mostrava somente leitura | New/Details |

O editor tabular reutiliza as primitivas existentes; não cria painel ou regra
clínica. Colunas são texto conforme a definição publicada. Quantidade mínima,
máxima e completude continuam validadas pelo Backend; não se infere condição
da descrição da pergunta. A comparação desktop/mobile exige bundle servido.

## Verificação

Contrato leve: `npm run test:structured-evaluation:client`. React: testes de
New/navigation e Details/permissionAwareControls, além da suíte global.
Checkpoint 2026-10-10: lint global, mojibake e contrato cliente passaram;
React focado passou 23 testes. Suíte global final passou 140/140 suites,
1540 testes e 3 skipped (469.889 s), antes do ajuste CSS mobile. Builds passaram;
bundle servido desktop 1440/mobile 390x844 revisado com dados fictícios: Voltar,
resposta perdida/retry sem duplicação, draft recuperado, assinatura inteira e
recusa clara de incompleto. Details recebeu border-box/min/max-width já usado
em New; 23 focados passaram depois. Medição mobile final: clientWidth e
scrollWidth 375/375 com scrollbar. CI completo no commit exato ainda pendente.
Commits/PRs draft em preparação; sem merge ou deploy.
Autoridade de negócio: MFBackend `docs/regras-negocio/prontuario.md` e
`docs/fluxos/structured-evaluation-integrity-candidate.md`.

Preservar PDF, relatórios, guards e registros legacy/finalized. A revisão visual
final pertence ao usuário. Integração do hotfix de hover precede a qualificação
do commit final. Nenhum deploy é autorizado por este documento.
## Re-revisão de seleções históricas

Ao carregar respostas JSON de seleção múltipla sem
`structured_answer_encoding`, os valores são códigos históricos de opção,
incluindo códigos textuais. O editor resolve cada código para exatamente um ID;
com `option_ids_v1`, interpreta IDs explícitos. A leitura usa a mesma regra,
inclusive depois de salvar e assinar. Não há fallback que confunda um código
numérico com o ID de outra opção.

Códigos desconhecidos ou duplicados exibem erro persistente e bloqueiam edição
e assinatura sem enviar gravações. As respostas armazenadas ficam preservadas.
A assinatura direta do backend também valida códigos históricos sem reescrevê-los.
Esta correção exige nova qualificação e re-revisão dos drafts; gates anteriores
não bastam para aprová-la.

Qualificação nova: 41 testes focados passaram e a suite global passou com
141 suítes, 1562 testes e 3 skips preexistentes (431.759 s). Lint global,
encoding, contratos e build passaram. Backend qualificou 21 cenários reais
MariaDB/HTTP, assinatura direta/editor e PDF históricos; recursos removidos.
CI dos novos heads, re-revisão independente e validação visual permanecem gates.

### Lookup de rótulo após resolução

`optionLabelById` compara somente IDs: após resolver códigos históricos para
IDs, repetir uma busca por ID OU código poderia selecionar o rótulo de outra
opção dependendo da ordem. A seleção simples por `option_id` usa a mesma regra
estrita. Doze regressões adicionais cobrem ambas as ordens de opções e estados
draft/finalized, histórico textual, IDs marcados e seleção simples. Nenhuma
alteração de dados, contrato histórico ou PDF decorre desta correção de leitura.

Gates do lookup estrito: 42 focados passaram; global passou com 141 suítes,
1574 testes, 3 skips preexistentes (344.977 s). Build, lint global, encoding,
contratos e diff check passaram. CI do novo head e re-revisão são gates separados.
