const WEEKDAY_SHORT_LABELS = {
  0: "Dom",
  1: "Seg",
  2: "Ter",
  3: "Qua",
  4: "Qui",
  5: "Sex",
  6: "Sáb",
};

const WEEKDAY_FULL_LABELS = {
  0: "Domingo",
  1: "Segunda",
  2: "Terça",
  3: "Quarta",
  4: "Quinta",
  5: "Sexta",
  6: "Sábado",
};

const PROTECTED_REASON_LABELS = {
  has_absence_reason: "possui registro de falta",
  has_evaluation: "possui avaliação vinculada",
  linked_to_pause: "está vinculada a uma pausa",
  is_rescheduled: "foi remarcada",
  has_reschedules: "possui remarcações vinculadas",
  has_financial_entry: "possui movimentação financeira",
  used_replacement_credit: "utilizou uma reposição",
  has_document: "possui documento vinculado",
  has_open_scheduling_conflict: "possui conflito de Agenda em aberto",
};

const CONFLICT_LABELS = {
  SCHEDULE_CHANGE_NO_OCCURRENCES: "A nova grade não gera sessões no período disponível.",
  SCHEDULING_UNAVAILABLE: "O horário não está disponível.",
  PATIENT_SCHEDULE_CONFLICT: "O paciente já possui atendimento nesse horário.",
  PROFESSIONAL_SCHEDULE_CONFLICT: "O profissional já possui atendimento nesse horário.",
  EXPLICIT_SERVICE_CAPACITY_REACHED: "A capacidade do serviço foi atingida.",
};

const SCHEDULE_CHANGE_ACTIONABLE_MESSAGES = {
  SCHEDULE_CHANGE_EFFECTIVE_ON_INVALID: "Escolha uma data válida a partir de amanhã.",
  SCHEDULE_CHANGE_EFFECTIVE_ON_TOO_EARLY: "Escolha uma data a partir de amanhã.",
  SCHEDULE_CHANGE_CONTRACT_FREQUENCY_MISMATCH:
    "Selecione a quantidade de dias prevista no plano.",
  SCHEDULE_CHANGE_PLAN_NOT_ACTIVE:
    "A agenda só pode ser alterada enquanto o plano estiver ativo.",
  SCHEDULE_CHANGE_ACTIVE_PAUSE: "Retome o plano antes de alterar a agenda.",
  SCHEDULE_CHANGE_CANCELLATION_PENDING:
    "Resolva o cancelamento programado antes de alterar a agenda.",
  SCHEDULE_CHANGE_COMMERCIAL_CHANGE_PENDING:
    "Resolva a troca de plano agendada antes de alterar a agenda.",
  SCHEDULE_CHANGE_FUTURE_REVISION_CONFLICT:
    "Já existe uma alteração de agenda programada. Recarregue a página.",
  SCHEDULE_CHANGE_PROTECTED_SESSION:
    "Existem sessões futuras que precisam de revisão antes desta alteração.",
  SCHEDULE_CHANGE_AGENDA_CONFLICT:
    "A nova agenda possui conflitos. Revise os horários e tente novamente.",
  SCHEDULE_CHANGE_ALREADY_EFFECTIVE:
    "Esta alteração não pode mais ser modificada. Recarregue a página.",
  SCHEDULE_CHANGE_PENDING_CONFLICT:
    "A alteração programada mudou. Recarregue a página e tente novamente.",
  SCHEDULE_CHANGE_TOKEN_CONFLICT:
    "A alteração programada mudou. Recarregue a página e tente novamente.",
  SCHEDULE_CHANGE_RESTORE_CONFLICT:
    "A agenda mudou desde a programação. Recarregue a página e tente novamente.",
};

const SCHEDULE_CHANGE_TECHNICAL_ERROR_MESSAGE =
  "Não foi possível alterar a agenda agora. Atualize a página e tente novamente.";

const PLAN_HISTORY_EVENT_LABELS = {
  commercial_change_requested: "Troca de plano agendada",
  commercial_change_replaced: "Troca de plano atualizada",
  commercial_change_canceled: "Troca de plano cancelada",
  commercial_change_applied: "Troca de plano realizada",
  pause_started: "Pausa iniciada",
  pause_updated: "Pausa alterada",
  plan_resumed: "Plano retomado",
  schedule_changed: "Agenda alterada",
  schedule_change_canceled: "Alteração de agenda cancelada",
  schedule_change_applied: "Nova agenda vigente",
};

const SINGLE_LINE_SCHEDULE_CHANGE_EVENTS = new Set([
  "schedule_change_canceled",
  "schedule_change_applied",
]);

export const isSingleLinePlanHistoryEvent = (event) => (
  SINGLE_LINE_SCHEDULE_CHANGE_EVENTS.has(event?.type)
);

const HISTORY_TIMING_FIELDS = new Set([
  "starts_on",
  "ends_on",
  "is_indefinite",
  "cancellation_effective_on",
  "effective_on",
  "schedule_revision_effective_from",
  "schedule_revision_effective_to",
]);

const HISTORY_TECHNICAL_SCHEDULE_FIELDS = new Set([
  "schedule_revision_id",
  "schedule_revision_status",
  "schedule_replaced_sessions",
  "schedule_preserved_sessions",
]);

const HISTORY_PAUSE_LIFECYCLE_FIELDS = new Set([
  "status",
  "pause_status",
  "starts_on",
  "ends_on",
  "is_indefinite",
  "reason",
  "pause_version",
  "resumes_on",
]);

const HISTORY_PAUSE_TECHNICAL_FIELDS = new Set([
  "status",
  "pause_status",
  "pause_version",
  "version",
  "lifecycle",
  "lifecycle_status",
  "revision",
  "revision_id",
  "manifest",
]);

const parseDateOnly = (value) => {
  const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12, 0, 0);
};

export const formatCompactDate = (value, { includeYear = false } = {}) => {
  const date = parseDateOnly(value);
  if (!date) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "numeric",
    month: "short",
    ...(includeYear ? { year: "numeric" } : {}),
  }).format(date).replace(" de ", " ").replace(". de ", " ").replace(/\./g, "");
};

export const formatCompactInstantDate = (value, { includeYear = false } = {}) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "numeric",
    month: "short",
    ...(includeYear ? { year: "numeric" } : {}),
  }).format(date).replace(/ de /g, " ").replace(/\./g, "");
};

const formatHistoryInstant = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date).replace(/ de /g, " ").replace(/\./g, "");
};

const formatCompactHistoryInstant = (value, { preserveMidnight = false } = {}) => (
  formatHistoryInstant(value)
  .replace(/, (\d{2}):(\d{2})$/, (_, hour, minute) => {
    const compactHour = preserveMidnight && hour === "00" ? hour : hour.replace(/^0/, "");
    return `, ${compactHour}h${minute === "00" ? "" : minute}`;
  })
);

const addOneDay = (value) => {
  const date = parseDateOnly(value);
  if (!date) return null;
  date.setDate(date.getDate() + 1);
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
};

export const formatScheduleTime = (value) => {
  const normalized = String(value || "").slice(0, 5);
  if (!/^\d{2}:\d{2}$/.test(normalized)) return "—";
  return normalized.endsWith(":00") ? `${normalized.slice(0, 2)}h` : normalized;
};

export const formatScheduleGrid = (rows = []) => {
  const normalized = (Array.isArray(rows) ? rows : [])
    .map((row) => ({
      weekday: Number(row?.weekday),
      time: String(row?.time || "").slice(0, 5),
    }))
    .filter((row) => WEEKDAY_SHORT_LABELS[row.weekday] && /^\d{2}:\d{2}$/.test(row.time))
    .sort((left, right) => left.weekday - right.weekday || left.time.localeCompare(right.time));
  return normalized
    .map((row) => `${WEEKDAY_SHORT_LABELS[row.weekday]} ${formatScheduleTime(row.time)}`)
    .join(" · ");
};

export const formatAgendaPattern = (agendaSummary) => {
  const authoritative = String(agendaSummary?.pattern_summary || "").trim();
  if (authoritative) {
    return authoritative.replace(/ às /g, " ").replace(/\b(\d{2}):00\b/g, "$1h");
  }
  const weekdays = Array.isArray(agendaSummary?.weekdays) ? agendaSummary.weekdays : [];
  const time = String(agendaSummary?.time || "").slice(0, 5);
  if (!weekdays.length || !time) return "";
  return formatScheduleGrid(weekdays.map((weekday) => ({ weekday, time })));
};

const firstProfessionalName = (grid) => (
  (Array.isArray(grid) ? grid : [])
    .map((row) => String(row?.professional_name || "").trim())
    .find(Boolean) || ""
);

export const buildPendingScheduleChangePresentation = (pendingScheduleChange) => {
  if (!pendingScheduleChange?.effective_on || pendingScheduleChange.is_effective === true) return null;
  const currentPattern = formatScheduleGrid(pendingScheduleChange.current_grid);
  const proposedPattern = formatScheduleGrid(pendingScheduleChange.proposed_grid);
  if (!currentPattern || !proposedPattern) return null;

  let professionalChange = "";
  if (pendingScheduleChange.professional_changed === true) {
    const currentName = String(
      pendingScheduleChange.current_professional?.name
      || firstProfessionalName(pendingScheduleChange.current_grid),
    ).trim();
    const futureName = String(
      pendingScheduleChange.future_professional?.name
      || pendingScheduleChange.professional_name
      || firstProfessionalName(pendingScheduleChange.proposed_grid),
    ).trim();
    professionalChange = currentName && futureName
      ? `Profissional: ${currentName} → ${futureName}`
      : "";
  }

  return {
    effectiveOn: pendingScheduleChange.effective_on,
    currentPattern,
    proposedPattern,
    title: `${currentPattern} → ${proposedPattern}`,
    professionalChange,
  };
};

const relatedEntityMatches = (event, type, id) => (
  String(event?.related_entity?.type || "") === String(type || "")
  && String(event?.related_entity?.id || "") === String(id || "")
);

const changeAfterValue = (event, field) => (
  (Array.isArray(event?.changes) ? event.changes : [])
    .find((change) => change?.field === field)?.after
);

export const findPlanHistoryEvent = ({
  events,
  types,
  relatedEntityType,
  relatedEntityId,
  effectiveOn,
}) => {
  const allowedTypes = new Set(Array.isArray(types) ? types : []);
  return (Array.isArray(events) ? events : []).find((event) => {
    if (allowedTypes.size && !allowedTypes.has(event?.type)) return false;
    if (relatedEntityType && relatedEntityId) {
      return relatedEntityMatches(event, relatedEntityType, relatedEntityId);
    }
    if (effectiveOn) {
      const eventEffectiveOn = changeAfterValue(event, "cancellation_effective_on")
        || changeAfterValue(event, "effective_on")
        || changeAfterValue(event, "schedule_revision_effective_from");
      return String(eventEffectiveOn || "").slice(0, 10) === String(effectiveOn).slice(0, 10);
    }
    return true;
  }) || null;
};

export const formatRequestMetadata = ({
  requestedAt,
  actorName,
  prefix = "Solicitada em",
}) => {
  if (!requestedAt) return "";
  return [
    `${prefix} ${formatCompactInstantDate(requestedAt)}`,
    String(actorName || "").trim() || null,
  ].filter(Boolean).join(" · ");
};

export const buildPausePresentation = ({ pause, historyEvent }) => {
  if (!pause?.starts_on || !["scheduled", "active"].includes(pause.status)) return null;
  const startsOn = formatCompactDate(pause.starts_on);
  if (pause.status === "scheduled") {
    return {
      title: "Pausa agendada",
      metadata: formatRequestMetadata({
        requestedAt: pause.created_at || historyEvent?.occurred_at,
        actorName: historyEvent?.actor?.name,
      }),
      period: pause.is_indefinite
        ? `A partir de ${startsOn} · sem data de retorno`
        : `${startsOn} → ${formatCompactDate(pause.ends_on)}`,
    };
  }

  const returnOn = pause.is_indefinite ? null : addOneDay(pause.ends_on);
  return {
    title: "Pausa ativa",
    metadata: `Desde ${startsOn}`,
    period: pause.is_indefinite
      ? "Sem data de retorno"
      : `Retorno em ${formatCompactDate(returnOn)}`,
  };
};

const professionalIds = (grid) => [...new Set(
  (Array.isArray(grid) ? grid : [])
    .map((row) => Number(row?.professional_user_id))
    .filter((id) => Number.isSafeInteger(id) && id > 0),
)].sort((left, right) => left - right);

const sameIds = (left, right) => (
  left.length === right.length && left.every((id, index) => id === right[index])
);

export const buildProfessionalChangeText = ({ beforeGrid, afterGrid, professionals = [] }) => {
  const beforeIds = professionalIds(beforeGrid);
  const afterIds = professionalIds(afterGrid);
  if (!beforeIds.length || !afterIds.length || sameIds(beforeIds, afterIds)) return "";

  const namesById = new Map((Array.isArray(professionals) ? professionals : [])
    .filter((professional) => professional?.id && professional?.name)
    .map((professional) => [Number(professional.id), String(professional.name).trim()]));
  const beforeNames = beforeIds.map((id) => namesById.get(id)).filter(Boolean);
  const afterNames = afterIds.map((id) => namesById.get(id)).filter(Boolean);
  if (beforeNames.length !== beforeIds.length || afterNames.length !== afterIds.length) {
    return "";
  }
  return `Profissional: ${beforeNames.join(", ")} → ${afterNames.join(", ")}`;
};

const formatMoney = (value) => {
  const cents = Number(value);
  if (!Number.isFinite(cents)) return "Não informado";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(cents / 100);
};

export const buildPendingCommercialChangePresentation = ({
  pendingChange,
  currentPlanName,
  historyEvent,
  professionals = [],
}) => {
  if (!pendingChange?.effective_on) return null;
  const previous = pendingChange.previous_configuration || {};
  const proposed = pendingChange.new_configuration || {};
  const futurePlanName = pendingChange.service_plan_name
    || proposed.service_plan_name
    || "Novo plano";
  const details = [];

  const previousFrequency = previous.sessions_per_week;
  const proposedFrequency = proposed.sessions_per_week;
  if (previousFrequency != null && proposedFrequency != null
    && Number(previousFrequency) !== Number(proposedFrequency)) {
    details.push(`Frequência: ${previousFrequency}x → ${proposedFrequency}x por semana`);
  } else if (previous.frequency_label && proposed.frequency_label
    && previous.frequency_label !== proposed.frequency_label) {
    details.push(`Frequência: ${previous.frequency_label} → ${proposed.frequency_label}`);
  }

  if (previous.price_cents != null && proposed.price_cents != null
    && Number(previous.price_cents) !== Number(proposed.price_cents)) {
    details.push(`Valor: ${formatMoney(previous.price_cents)} → ${formatMoney(proposed.price_cents)}`);
  }

  const previousPattern = formatScheduleGrid(pendingChange.previous_schedule);
  const proposedPattern = formatScheduleGrid(pendingChange.new_schedule);
  const agendaComparison = previousPattern && proposedPattern && previousPattern !== proposedPattern
    ? { current: previousPattern, proposed: proposedPattern }
    : null;

  const professionalChange = buildProfessionalChangeText({
    beforeGrid: pendingChange.previous_schedule,
    afterGrid: pendingChange.new_schedule,
    professionals,
  });
  return {
    effectiveOn: pendingChange.effective_on,
    metadata: formatRequestMetadata({
      requestedAt: pendingChange.requested_at || historyEvent?.occurred_at,
      actorName: historyEvent?.actor?.name,
    }),
    title: `${currentPlanName || previous.service_plan_name || "Plano atual"} → ${futurePlanName}`,
    details,
    agendaComparison,
    professionalChange,
  };
};

const HISTORY_STATUS_LABELS = {
  active: "Ativo",
  paused: "Pausado",
  canceled: "Cancelado",
  scheduled: "Programada",
  ended: "Encerrada",
  pending: "Pendente",
  replaced: "Substituída",
  applied: "Aplicada",
};

const formatHistoryValue = (field, value) => {
  if (value === null || value === undefined || value === "") return "Não informado";
  if (field === "price_cents") return formatMoney(value);
  if (typeof value === "boolean") return value ? "Sim" : "Não";
  if (Array.isArray(value)) return value.join(", ");
  if (["status", "pause_status", "change_status"].includes(field)) {
    return HISTORY_STATUS_LABELS[String(value)] || String(value);
  }
  return String(value);
};

const historyVigencyLabel = (event) => {
  if (event?.type === "pause_updated") return "";
  const startsOn = changeAfterValue(event, "starts_on");
  const endsOn = changeAfterValue(event, "ends_on");
  const indefinite = changeAfterValue(event, "is_indefinite") === true;
  if (startsOn && event?.type === "pause_started") {
    if (indefinite) return `Desde ${formatCompactDate(startsOn)} · sem data de retorno`;
    if (endsOn) return `Período: ${formatCompactDate(startsOn)} → ${formatCompactDate(endsOn)}`;
    return `Desde ${formatCompactDate(startsOn)}`;
  }
  if (startsOn && event?.type?.startsWith("pause_")) {
    if (indefinite) return `A partir de ${formatCompactDate(startsOn)} · sem data de retorno`;
    if (endsOn) return `Período: ${formatCompactDate(startsOn)} → ${formatCompactDate(endsOn)}`;
    return `A partir de ${formatCompactDate(startsOn)}`;
  }
  if (endsOn && event?.type?.startsWith("pause_")) {
    return `Até ${formatCompactDate(endsOn)}`;
  }

  const resumesOn = changeAfterValue(event, "resumes_on");
  if (resumesOn && event?.type === "plan_resumed") {
    return `Retomado em ${formatCompactDate(resumesOn)}`;
  }

  const cancellationOn = changeAfterValue(event, "cancellation_effective_on");
  if (cancellationOn) return `Último dia ativo: ${formatCompactDate(cancellationOn, { includeYear: true })}`;

  const effectiveOn = changeAfterValue(event, "effective_on")
    || changeAfterValue(event, "schedule_revision_effective_from");
  if (effectiveOn && event?.type === "schedule_changed") {
    return `A partir de ${formatCompactDate(effectiveOn)}`;
  }
  return effectiveOn
    ? `A partir de ${formatCompactDate(effectiveOn, { includeYear: true })}`
    : "";
};

const formatHistoryChange = (change) => {
  const field = String(change?.field || "");
  const before = formatHistoryValue(field, change?.before);
  const after = formatHistoryValue(field, change?.after);
  if (field === "sessions_per_week") {
    return `Frequência: ${before}x → ${after}x por semana`;
  }
  const label = {
    service_plan_name: "Plano",
    frequency_label: "Frequência",
    price_cents: "Valor",
  }[field] || change?.label || "Alteração";
  return `${label}: ${before} → ${after}`;
};

const isPauseHistoryEvent = (event) => {
  const type = String(event?.type || "").toLowerCase();
  return type.startsWith("pause_") || type === "plan_resumed" || type.includes("pause");
};

const pausePeriodSide = (changes, side) => {
  const valueFor = (field) => changes.find((change) => change?.field === field)?.[side];
  const startsOn = valueFor("starts_on");
  const endsOn = valueFor("ends_on");
  const indefinite = valueFor("is_indefinite");
  if (indefinite === true) {
    return startsOn
      ? `a partir de ${formatCompactDate(startsOn)} · sem data de retorno`
      : "sem data de retorno";
  }
  if (startsOn && endsOn) {
    return `${formatCompactDate(startsOn)} → ${formatCompactDate(endsOn)}`;
  }
  if (endsOn) return `até ${formatCompactDate(endsOn)}`;
  if (startsOn) return `a partir de ${formatCompactDate(startsOn)}`;
  return "";
};

const buildPauseHistoryBusinessChanges = (event) => {
  const changes = Array.isArray(event?.changes) ? event.changes : [];
  const reasonChange = changes.find((change) => change?.field === "reason");
  const reasonBefore = String(reasonChange?.before || "").trim();
  const reasonAfter = String(reasonChange?.after || "").trim();

  if (event?.type !== "pause_updated") {
    return reasonAfter ? [`Motivo: ${reasonAfter}`] : [];
  }

  const result = [];
  const periodChanges = changes.filter((change) => (
    ["starts_on", "ends_on", "is_indefinite"].includes(change?.field)
    && change?.before !== change?.after
  ));
  if (periodChanges.length > 0) {
    const beforePeriod = pausePeriodSide(periodChanges, "before");
    const afterPeriod = pausePeriodSide(periodChanges, "after");
    if (beforePeriod && afterPeriod && beforePeriod !== afterPeriod) {
      result.push(`Período: ${beforePeriod} → ${afterPeriod}`);
    }
  }
  if (reasonBefore !== reasonAfter) {
    if (!reasonBefore && reasonAfter) result.push(`Motivo adicionado: ${reasonAfter}`);
    else if (reasonBefore && !reasonAfter) result.push("Motivo removido.");
    else if (reasonBefore && reasonAfter) result.push(`Motivo: ${reasonBefore} → ${reasonAfter}`);
  }
  return result;
};

export function getVisiblePlanHistoryChanges(event) {
  return (Array.isArray(event?.changes) ? event.changes : []).filter((change) => {
    const field = String(change?.field || "").trim().toLowerCase();
    const label = String(change?.label || "").trim().toLocaleLowerCase("pt-BR");
    const pauseTechnicalMetadata = isPauseHistoryEvent(event)
      && (HISTORY_PAUSE_TECHNICAL_FIELDS.has(field)
        || /(?:^|_)(?:status|version|cas|manifest|revision|lifecycle)(?:_|$)/i.test(field)
        || /(?:status|versão|version|cas|manifesto|manifest|revisão|revision|lifecycle|ciclo de vida)/i
          .test(label));
    const pauseLifecycleMetadata = ["pause_started", "plan_resumed"].includes(event?.type)
      && HISTORY_PAUSE_LIFECYCLE_FIELDS.has(field);
    const scheduleTechnicalMetadata = event?.type === "schedule_changed"
      && HISTORY_TECHNICAL_SCHEDULE_FIELDS.has(field);
    const redundantScheduledStatus = event?.type === "commercial_change_requested"
      && field === "change_status"
      && (change?.before == null || change.before === "")
      && String(change?.after || "").trim().toLowerCase() === "pending";
    return field !== "change_version"
      && label !== "versão da alteração"
      && !pauseTechnicalMetadata
      && !pauseLifecycleMetadata
      && !scheduleTechnicalMetadata
      && !redundantScheduledStatus;
  });
}

export const formatPlanHistoryEventLabel = (event) => {
  const businessLabel = PLAN_HISTORY_EVENT_LABELS[event?.type];
  if (businessLabel) return businessLabel;

  const label = String(event?.label || "").trim();
  if (!event?.legacy?.is_legacy) return label || "Evento do plano";

  const userFacingLabel = label.replace(/^Registro legado(?: de)?\s*/i, "").trim();
  if (!userFacingLabel) return "Evento do plano";
  return `${userFacingLabel.charAt(0).toUpperCase()}${userFacingLabel.slice(1)}`;
};

export const buildPlanHistoryPresentation = (event, professionals = []) => {
  const instant = formatCompactHistoryInstant(event?.occurred_at, {
    preserveMidnight: event?.type === "schedule_change_applied",
  });
  const singleLine = `${instant} · ${formatPlanHistoryEventLabel(event)}`;

  if (isSingleLinePlanHistoryEvent(event)) {
    return {
      singleLine,
      vigency: "",
      changes: [],
    };
  }

  const changes = getVisiblePlanHistoryChanges(event);
  const hasSessionsChange = changes.some((change) => change?.field === "sessions_per_week");
  const businessChanges = isPauseHistoryEvent(event)
    ? buildPauseHistoryBusinessChanges(event)
    : changes
      .filter((change) => !HISTORY_TIMING_FIELDS.has(change?.field))
      .filter((change) => !HISTORY_TECHNICAL_SCHEDULE_FIELDS.has(change?.field))
      .filter((change) => !(hasSessionsChange && change?.field === "frequency_label"))
      .filter((change) => change?.field !== "schedule_grid_summary")
      .map(formatHistoryChange);

  const scheduleChange = changes.find((change) => change?.field === "schedule_grid_summary");
  if (scheduleChange) {
    const beforePattern = formatScheduleGrid(scheduleChange.before);
    const afterPattern = formatScheduleGrid(scheduleChange.after);
    if (beforePattern && afterPattern && beforePattern !== afterPattern) {
      businessChanges.push(`Agenda: ${beforePattern} → ${afterPattern}`);
    }
    const professionalChange = buildProfessionalChangeText({
      beforeGrid: scheduleChange.before,
      afterGrid: scheduleChange.after,
      professionals,
    });
    if (professionalChange) businessChanges.push(professionalChange);
  }

  return {
    singleLine,
    vigency: historyVigencyLabel(event),
    changes: businessChanges,
  };
};

const normalizeConflictFrequency = (plan = {}) => {
  const sessionsPerWeek = Number(plan.sessions_per_week);
  if (Number.isInteger(sessionsPerWeek) && sessionsPerWeek > 0) {
    return `${sessionsPerWeek}x/semana`;
  }
  return String(plan.frequency_label || "")
    .trim()
    .replace(/\s*x\s+por\s+semana$/i, "x/semana")
    .replace(/\s*x\s*\/\s*sem(?:ana)?$/i, "x/semana");
};

const conflictingPlanLabel = (plan = {}) => {
  const baseName = String(plan.service_name || plan.service_plan_name || "").trim();
  const frequency = normalizeConflictFrequency(plan);
  if (!baseName) return frequency || "Outro atendimento deste paciente";
  if (!frequency) return baseName;
  const sessionsPerWeek = Number(plan.sessions_per_week);
  if (
    Number.isInteger(sessionsPerWeek)
    && new RegExp(`${sessionsPerWeek}\\s*x(?:\\s*[/]\\s*sem(?:ana)?|\\s+por\\s+semana)?$`, "i")
      .test(baseName)
  ) {
    return baseName.replace(
      new RegExp(`${sessionsPerWeek}\\s*x(?:\\s*[/]\\s*sem(?:ana)?|\\s+por\\s+semana)?$`, "i"),
      frequency,
    );
  }
  return `${baseName} ${frequency}`;
};

const conflictPatternSortValue = (conflict) => {
  const weekday = Number(conflict.weekday);
  const normalizedWeekday = weekday === 0 ? 7 : weekday;
  return `${String(normalizedWeekday).padStart(2, "0")}-${conflict.time || ""}`;
};

const formatConflictTime = (time) => {
  const [hour, minute] = String(time || "").split(":");
  const normalizedHour = String(Number(hour));
  return minute === "00" ? `${normalizedHour}h` : `${normalizedHour}h${minute}`;
};

const resolveConflictWeekday = (conflict) => {
  const suppliedWeekday = Number(conflict.weekday);
  if (
    conflict.weekday !== null
    && conflict.weekday !== undefined
    && Number.isInteger(suppliedWeekday)
    && suppliedWeekday >= 0
    && suppliedWeekday <= 6
  ) {
    return suppliedWeekday;
  }
  const date = conflict.date || String(conflict.starts_at || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  return new Date(`${date}T12:00:00Z`).getUTCDay();
};

export const getPatientScheduleConflictIssues = (conflicts = []) => {
  const grouped = new Map();
  conflicts
    .filter((conflict) => conflict?.code === "PATIENT_SCHEDULE_CONFLICT")
    .forEach((conflict) => {
      const weekday = resolveConflictWeekday(conflict);
      const time = String(conflict.time || "").slice(0, 5);
      if (
        !Object.prototype.hasOwnProperty.call(WEEKDAY_FULL_LABELS, weekday)
        || !/^\d{2}:\d{2}$/.test(time)
      ) return;
      const plan = conflict.conflicting_patient_plan || {};
      const planKey = plan.patient_plan_id || plan.service_plan_id || "unknown";
      const key = `${weekday}-${time}-${planKey}`;
      if (!grouped.has(key)) grouped.set(key, { weekday, time, plan });
    });
  const patterns = [...grouped.values()].sort((left, right) => (
    conflictPatternSortValue(left).localeCompare(conflictPatternSortValue(right))
  ));
  if (patterns.length === 0) return [];
  const details = patterns.map(({ weekday, time, plan }) => {
    const dayTime = `${WEEKDAY_FULL_LABELS[weekday]} às ${formatConflictTime(time)}`;
    const planLabel = conflictingPlanLabel(plan);
    if (patterns.length === 1) {
      return plan.patient_plan_id || plan.service_plan_id
        ? `${dayTime} já está ocupada pelo plano ${planLabel} deste paciente.`
        : `${dayTime} já está ocupada por outro atendimento deste paciente.`;
    }
    return `${dayTime} · ${planLabel}`;
  });
  return [{
    key: "patient-schedule-conflicts",
    title: patterns.length === 1 ? "Conflito de horário" : "Conflitos de horário",
    details,
  }];
};

export const getScheduleChangeIssues = (payload = {}) => {
  const protectedSessions = Array.isArray(payload.protected_sessions)
    ? payload.protected_sessions
    : [];
  const conflicts = Array.isArray(payload.conflicts) ? payload.conflicts : [];

  const patientConflictIssues = getPatientScheduleConflictIssues(conflicts);
  const remainingConflicts = conflicts.filter(
    (conflict) => conflict?.code !== "PATIENT_SCHEDULE_CONFLICT",
  );

  return [
    ...protectedSessions.map((session) => {
      const reasons = (Array.isArray(session.reasons) ? session.reasons : [])
        .map((reason) => PROTECTED_REASON_LABELS[reason] || "exige revisão")
        .join(", ");
      return {
        key: `protected-${session.id || session.starts_at}`,
        title: session.starts_at
          ? `Sessão de ${formatCompactDate(String(session.starts_at).slice(0, 10), { includeYear: true })}`
          : "Sessão protegida",
        detail: reasons || "Esta sessão precisa ser resolvida antes da alteração.",
      };
    }),
    ...patientConflictIssues,
    ...remainingConflicts.map((conflict, index) => {
      const date = conflict.date || String(conflict.starts_at || "").slice(0, 10);
      const time = conflict.time || String(conflict.starts_at || "").slice(11, 16);
      const when = [date ? formatCompactDate(date, { includeYear: true }) : null, time || null]
        .filter(Boolean)
        .join(" às ");
      return {
        key: `conflict-${conflict.code || index}-${date}-${time}`,
        title: when || "Conflito de Agenda",
        detail: CONFLICT_LABELS[conflict.code]
          || "A nova agenda possui um conflito que precisa ser resolvido.",
      };
    }),
  ];
};

export const createScheduleChangeIdempotencyKey = (patientPlanId) => {
  const randomValue = globalThis.crypto?.randomUUID
    ? globalThis.crypto.randomUUID()
    : Math.random().toString(36).slice(2);
  return `schedule-change-${patientPlanId}-${Date.now()}-${randomValue}`.slice(0, 100);
};

export const scheduleChangeErrorPresentation = (error) => {
  const payload = error?.response?.data || {};
  const code = payload.code || "";
  const actionableMessage = SCHEDULE_CHANGE_ACTIONABLE_MESSAGES[code] || "";
  return {
    code,
    message: actionableMessage || SCHEDULE_CHANGE_TECHNICAL_ERROR_MESSAGE,
    issues: actionableMessage ? getScheduleChangeIssues(payload) : [],
    stale: code === "SCHEDULE_CHANGE_PREVIEW_STALE",
  };
};

export const buildScheduleRows = ({ weekdays, timesByWeekday, professionalUserId }) => (
  [...(Array.isArray(weekdays) ? weekdays : [])]
    .map(Number)
    .filter(Number.isInteger)
    .sort((left, right) => left - right)
    .map((weekday) => ({
      weekday,
      time: String(timesByWeekday?.[String(weekday)] || timesByWeekday?.[weekday] || ""),
      professional_user_id: Number(professionalUserId),
    }))
);
