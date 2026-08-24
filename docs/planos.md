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

O Backend devolve grupos já paginados por paciente. O Frontend não agrupa uma
página de vínculos individualmente: cada paciente aparece uma vez e todos os
seus `PatientPlans` filtrados permanecem juntos. O resumo compacto usa
diretamente `active_plans`, `paused_plans` e `pending_agendas`; nenhuma métrica é
recalculada a partir da página visível.

O cabeçalho `Plano / Agenda / Status` aparece uma única vez acima da lista; os
pacientes permanecem como cabeçalhos leves dos grupos. Cada linha representa
um `patient_plan_id` e é um link completo para
`/planos/pacientes/:patientPlanId`. O mesmo padrão compartilhado de superfície
interativa da lista de Pacientes fornece hover, cursor e foco visível. Enter é
nativo do link e Space aciona o mesmo destino. Não existe ação paralela
“Detalhes” ou “Gerenciar”.

Em telas estreitas, as colunas viram blocos empilhados dentro da mesma linha,
sem tabela com rolagem horizontal. Estados de carregamento, erro, resultado
vazio global e resultado vazio por filtro/visão são distintos.

`Agenda pendente` é apresentada exatamente a partir de `agenda_state` da API.
A interface não consulta nem conta sessões futuras. O nome comercial é a
informação principal; frequência contratada aparece como subtítulo somente
quando não estiver semanticamente contida no nome, evitando a antiga coluna
redundante.

A ação primária é “Vincular plano”, porque o fluxo cria um vínculo mensal para
um paciente existente ou criado durante o próprio fluxo. Ela respeita as
capacidades de edição/contratação de Planos já aplicadas às demais mutações.

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
