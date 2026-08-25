# Planos

Esta é a fonte do comportamento permanente da interface de Administração de
Planos e dos contratos de Agenda mensal consumidos por ela. As regras de
negócio continuam canônicas no MFBackend, conforme a ponte
[Regras de negócio](regras-negocio.md).

## Visão operacional

A entrada “Planos” consome `GET /patient-plans/overview`. Não há navegação
separada entre atuais e encerrados: o filtro Status oferece `Ativos e pausados`
como padrão, além de `Ativos`, `Pausados` e `Cancelados`. A seleção deriva
`view=current` para os três primeiros estados e `view=closed` para cancelados,
sem alterar o contrato da API. Paciente, serviço, status e situação da Agenda
são filtros server-side. A busca textual do paciente é enviada com debounce, e
qualquer mudança de filtro volta para a primeira página.

A busca textual usa debounce de 300 ms e respostas de consultas antigas são
ignoradas quando uma consulta mais recente já foi iniciada. O read-model expõe
`page_info` no padrão `page`, `page_size`, `total` e `total_pages`; a tela usa
dez `PatientPlans` por página e não calcula totais a partir de `items`.

O Backend devolve uma coleção plana já filtrada e paginada por `PatientPlan`.
Cada item contém o paciente como contexto; por isso, o mesmo paciente aparece
em mais de uma linha quando possui mais de um vínculo. Três cards compactos de
resumo usam diretamente `active_plans`, `paused_plans` e `pending_agendas`;
nenhuma métrica é recalculada a partir da página visível. Os cards permanecem
visíveis quando o valor é zero e funcionam como atalhos: Ativos e Pausados
aplicam o Status correspondente, enquanto Agendas pendentes aplica Agenda =
Pendente. Cada atalho preserva os demais filtros e volta à primeira página.

Uma única linha de cabeçalho secundária apresenta Paciente, Plano, Agenda e
Status. Cada `PatientPlan` ocupa uma linha compacta que faz sentido isoladamente:
o paciente é a identificação principal, o plano é o segundo elemento relevante,
Agenda configurada é discreta e Agenda pendente preserva o destaque de atenção.
Cada linha representa um `patient_plan_id` e é um link completo para
`/planos/pacientes/:patientPlanId`. O mesmo padrão compartilhado de superfície
interativa da lista de Pacientes fornece hover, cursor e foco visível. Enter é
nativo do link e Space aciona o mesmo destino. Não existe ação paralela
“Detalhes” ou “Gerenciar”.

Em telas estreitas, as colunas viram blocos empilhados dentro da mesma linha,
o cabeçalho global é ocultado e não há tabela com rolagem horizontal. A
paginação segue os limites, textos, controles e comportamento visual da lista
de Pacientes por meio de `AppPagination`. Estados de carregamento, erro,
resultado vazio global e resultado vazio por filtro/visão são distintos.

`Agenda pendente` é apresentada exatamente a partir de `agenda_state` da API.
A interface não consulta nem conta sessões futuras. O nome comercial é a
informação principal; frequência contratada aparece como subtítulo somente
quando não estiver semanticamente contida no nome, evitando a antiga coluna
redundante.

A ação primária é “Vincular plano”, porque o fluxo cria um vínculo mensal para
um paciente existente ou criado durante o próprio fluxo. Ela respeita as
capacidades de edição/contratação de Planos já aplicadas às demais mutações.

## Editar dados do vínculo

No detalhe do plano mensal, “Editar dados” mantém plano comercial, frequência e
data de início somente leitura. Observações permanecem editáveis. Dia de
vencimento e “Plano sem cobrança” são editáveis apenas no vínculo ativo sem
cancelamento programado; em plano pausado ou com cancelamento programado a tela
explica que somente observações podem mudar. Plano cancelado não oferece edição.

Salvar primeiro chama `POST /patient-plans/:id/configuration-preview`, enviando
somente `anchor_day`, `is_no_charge`, `notes` e
`expected_configuration_version`. A confirmação apresenta a data concreta do
próximo ciclo, os valores anterior e novo, a alteração de cobrança e a quantidade
de cobranças futuras afetadas, sem IDs técnicos. Ela então chama
`POST /patient-plans/:id/configuration-change` com o token autoritativo e uma
`Idempotency-Key` estável durante o retry.

A interface informa que alterações financeiras valem a partir do próximo ciclo
e que o ciclo atual não será alterado. Ela não calcula efeitos financeiros, não
envia `starts_at`, plano comercial ou vigência e não usa o `PUT` genérico para
esse fluxo. Conflitos de versão, prévia obsoleta ou estado futuro inconsistente
fecham a confirmação e exigem recarregar a situação do vínculo.

## Agenda atual e futura

O Frontend apresenta a Agenda vigente e uma alteração futura como estados
distintos. Ele consome `agenda_summary` e `pending_schedule_change` do resumo
administrativo e não escolhe a revisão efetiva a partir de `current`, `future`
ou de datas calculadas localmente. Quando a data de vigência já chegou, a grade
efetiva retornada pela API é apresentada como Agenda atual, ainda que a promoção
persistida aguarde o lifecycle das `00:05`.

A configuração vigente usa `agenda_summary.configuration_grid` como autoridade
visual aditiva. Cada `{ weekday, time }` gera uma linha própria, em ordem de dia
e horário, independentemente de a origem ser uma série com vários dias ou
várias séries singleton. Sessões materializadas não formam essa lista e uma
remarcação individual não a altera. Respostas antigas continuam compatíveis por
`pattern_summary` e, na ausência dele, por `weekdays` + `time`.

Quando `agenda_summary.configuration_transition` estiver presente, a aba Agenda
mantém a grade efetiva como configuração principal e apresenta também, em
linguagem funcional, o último dia dessa grade e a nova grade com sua data de
início. A continuidade autoritativa mantém a Agenda ativa, impede o falso estado
“Sem sessões futuras” e não oferece “Configurar nova agenda”. Se também existir
`pending_schedule_change`, o painel editável/cancelável desse fluxo prevalece e
a transição aditiva não é duplicada.

Status históricos de sessões não são reinterpretados pela aba do plano. Explicar
a origem de uma sessão suspensa depende de uma projeção específica de histórico
de Agenda/pausa e permanece fora deste contrato.

## Alteração e cancelamento

A alteração operacional usa, nesta ordem:

- `POST /patient-plans/:id/schedule-change-preview`;
- `POST /patient-plans/:id/schedule-change`, com revisão observada, versão,
  token da prévia e `Idempotency-Key`;
- `POST /patient-plans/:id/schedule-change/cancel`, somente quando
  `pending_schedule_change.can_cancel=true` e com a identidade e o token de
  comando fornecidos pela API.

Depois de confirmar ou cancelar, a interface recarrega o resumo administrativo.
Ela não edita nem substitui uma alteração operacional pendente: para programar
outra grade, cancela a existente e inicia um novo fluxo.

## Histórico funcional

A timeline apresenta somente eventos de negócio retornados pela projeção
funcional do Backend. `schedule_revision_cutover` e
`legacy_pause_financial_regularized` permanecem no ledger interno, mas são
excluídos antes da paginação e também bloqueados defensivamente na renderização.

Metadados de revisão, versão, lifecycle, migração, backfill, legado, cutover,
identificadores, contagens de adoção e status internos não usam o fallback
genérico. No cancelamento efetivo, a interface mantém a data útil e apresenta
eventual motivo diretamente, sem mostrar versão, transição de status ou
`Não informado → valor`.

`legacy_pause_snapshot` é apresentado como o fato funcional “Pausa iniciada”,
com o instante histórico do evento e somente a vigência útil: início, período
conhecido ou ausência de data de retorno. Origem de backfill, marcador legado,
nome de snapshot, versão, status e evidência técnica incompleta não aparecem na
timeline.

## Conflitos recorrentes

Conflitos individuais `PATIENT_SCHEDULE_CONFLICT` são agrupados por dia da
semana, horário e identidade do `conflicting_patient_plan`, evitando repetir
cada data materializada. Nome do serviço, plano e frequência são exibidos
somente a partir dos campos fornecidos pelo Backend.

O preview com `can_confirm=false`, o `409 PATIENT_SCHEDULE_CONFLICT` da criação
inicial e o envelope `SCHEDULE_CHANGE_AGENDA_CONFLICT` com conflitos individuais
mantêm a confirmação bloqueada. A interface não reimplementa a política de
conflito nem resolve o outro plano por catálogo local.
