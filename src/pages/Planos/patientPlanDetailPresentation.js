const WEEKDAY_SHORT_LABELS = {
  0: "Dom",
  1: "Seg",
  2: "Ter",
  3: "Qua",
  4: "Qui",
  5: "Sex",
  6: "Sáb",
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

const PLAN_HISTORY_EVENT_LABELS = {
  commercial_change_requested: "Troca de plano agendada",
  commercial_change_replaced: "Troca de plano atualizada",
  commercial_change_canceled: "Troca de plano cancelada",
  commercial_change_applied: "Troca de plano realizada",
};

const REQUEST_EVENT_TYPES = new Set([
  "commercial_change_requested",
  "commercial_change_replaced",
  "pause_scheduled",
  "pause_started",
  "pause_updated",
  "cancellation_scheduled",
  "cancellation_updated",
  "schedule_changed",
]);

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
  if (!pendingScheduleChange?.effective_on) return null;
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
  if (previousPattern && proposedPattern && previousPattern !== proposedPattern) {
    details.push(`Atual: ${previousPattern}`);
    details.push(`Nova: ${proposedPattern}`);
  }

  const professionalChange = buildProfessionalChangeText({
    beforeGrid: pendingChange.previous_schedule,
    afterGrid: pendingChange.new_schedule,
    professionals,
  });
  if (professionalChange) details.push(professionalChange);

  return {
    effectiveOn: pendingChange.effective_on,
    metadata: formatRequestMetadata({
      requestedAt: pendingChange.requested_at || historyEvent?.occurred_at,
      actorName: historyEvent?.actor?.name,
    }),
    title: `${currentPlanName || previous.service_plan_name || "Plano atual"} → ${futurePlanName}`,
    details,
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
  const startsOn = changeAfterValue(event, "starts_on");
  const endsOn = changeAfterValue(event, "ends_on");
  const indefinite = changeAfterValue(event, "is_indefinite") === true;
  if (startsOn && event?.type?.startsWith("pause_")) {
    if (indefinite) return `A partir de ${formatCompactDate(startsOn)} · sem data de retorno`;
    if (endsOn) return `Período: ${formatCompactDate(startsOn)} → ${formatCompactDate(endsOn)}`;
    return `A partir de ${formatCompactDate(startsOn)}`;
  }
  if (endsOn && event?.type?.startsWith("pause_")) {
    return `Até ${formatCompactDate(endsOn)}`;
  }

  const cancellationOn = changeAfterValue(event, "cancellation_effective_on");
  if (cancellationOn) return `Último dia ativo: ${formatCompactDate(cancellationOn, { includeYear: true })}`;

  const effectiveOn = changeAfterValue(event, "effective_on")
    || changeAfterValue(event, "schedule_revision_effective_from");
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

export function getVisiblePlanHistoryChanges(event) {
  return (Array.isArray(event?.changes) ? event.changes : []).filter((change) => {
    const field = String(change?.field || "").trim().toLowerCase();
    const label = String(change?.label || "").trim().toLocaleLowerCase("pt-BR");
    const redundantScheduledStatus = event?.type === "commercial_change_requested"
      && field === "change_status"
      && (change?.before == null || change.before === "")
      && String(change?.after || "").trim().toLowerCase() === "pending";
    return field !== "change_version"
      && label !== "versão da alteração"
      && !redundantScheduledStatus;
  });
}

export const buildPlanHistoryPresentation = (event, professionals = []) => {
  const actorName = event?.actor?.name
    || (event?.origin === "automatic" ? "Sistema" : "Responsável não identificado");
  const momentPrefix = REQUEST_EVENT_TYPES.has(event?.type) ? "Solicitada em" : "Registrado em";
  const changes = getVisiblePlanHistoryChanges(event);
  const hasSessionsChange = changes.some((change) => change?.field === "sessions_per_week");
  const businessChanges = changes
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
    moment: `${momentPrefix} ${formatHistoryInstant(event?.occurred_at)} · ${actorName}`,
    vigency: historyVigencyLabel(event),
    changes: businessChanges,
  };
};

export const formatPlanHistoryEventLabel = (event) => {
  const businessLabel = PLAN_HISTORY_EVENT_LABELS[event?.type];
  if (businessLabel) return businessLabel;

  const label = String(event?.label || "").trim();
  if (!event?.legacy?.is_legacy) return label || "Evento do plano";

  const userFacingLabel = label.replace(/^Registro legado(?: de)?\s*/i, "").trim();
  if (!userFacingLabel) return "Evento do plano";
  return `${userFacingLabel.charAt(0).toUpperCase()}${userFacingLabel.slice(1)}`;
};

export const getScheduleChangeIssues = (payload = {}) => {
  const protectedSessions = Array.isArray(payload.protected_sessions)
    ? payload.protected_sessions
    : [];
  const conflicts = Array.isArray(payload.conflicts) ? payload.conflicts : [];

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
    ...conflicts.map((conflict, index) => {
      const date = conflict.date || String(conflict.starts_at || "").slice(0, 10);
      const time = conflict.time || String(conflict.starts_at || "").slice(11, 16);
      const when = [date ? formatCompactDate(date, { includeYear: true }) : null, time || null]
        .filter(Boolean)
        .join(" às ");
      return {
        key: `conflict-${conflict.code || index}-${date}-${time}`,
        title: when || "Conflito de Agenda",
        detail: conflict.reason || CONFLICT_LABELS[conflict.code]
          || "A nova grade possui um conflito que precisa ser resolvido.",
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
  const fallback = "Não foi possível revisar a alteração da Agenda.";
  return {
    code: payload.code || "",
    message: payload.error || fallback,
    issues: getScheduleChangeIssues(payload),
    stale: payload.code === "SCHEDULE_CHANGE_PREVIEW_STALE",
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
