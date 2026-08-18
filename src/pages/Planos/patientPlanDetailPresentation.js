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
    professionalChange = `Profissional: ${currentName || "atual"} → ${futureName || "novo"}`;
  }

  return {
    effectiveOn: pendingScheduleChange.effective_on,
    currentPattern,
    proposedPattern,
    title: `${currentPattern} → ${proposedPattern}`,
    professionalChange,
  };
};

export const formatPlanHistoryEventLabel = (event) => {
  const label = String(event?.label || "").trim();
  if (!event?.legacy?.is_legacy) return label || "Evento do plano";

  const userFacingLabel = label.replace(/^Registro legado(?: de)?\s*/i, "").trim();
  if (!userFacingLabel) return "Evento do plano";
  return `${userFacingLabel.charAt(0).toUpperCase()}${userFacingLabel.slice(1)}`;
};

export const getVisiblePlanHistoryChanges = (changes = []) => (
  (Array.isArray(changes) ? changes : []).filter((change) => (
    String(change?.field || "").trim().toLowerCase() !== "change_version"
    && String(change?.label || "").trim().toLocaleLowerCase("pt-BR") !== "versão da alteração"
  ))
);

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
