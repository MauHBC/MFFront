# Planos

Esta é a fonte do comportamento permanente da interface de Administração de
Planos e dos contratos de Agenda mensal consumidos por ela. As regras de
negócio continuam canônicas no MFBackend, conforme a ponte
[Regras de negócio](regras-negocio.md).

## Agenda atual e futura

O Frontend apresenta a Agenda vigente e uma alteração futura como estados
distintos. Ele consome `agenda_summary` e `pending_schedule_change` do resumo
administrativo e não escolhe a revisão efetiva a partir de `current`, `future`
ou de datas calculadas localmente. Quando a data de vigência já chegou, a grade
efetiva retornada pela API é apresentada como Agenda atual, ainda que a promoção
persistida aguarde o lifecycle das `00:05`.

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

## Conflitos recorrentes

Conflitos individuais `PATIENT_SCHEDULE_CONFLICT` são agrupados por dia da
semana, horário e identidade do `conflicting_patient_plan`, evitando repetir
cada data materializada. Nome do serviço, plano e frequência são exibidos
somente a partir dos campos fornecidos pelo Backend.

O preview com `can_confirm=false`, o `409 PATIENT_SCHEDULE_CONFLICT` da criação
inicial e o envelope `SCHEDULE_CHANGE_AGENDA_CONFLICT` com conflitos individuais
mantêm a confirmação bloqueada. A interface não reimplementa a política de
conflito nem resolve o outro plano por catálogo local.
