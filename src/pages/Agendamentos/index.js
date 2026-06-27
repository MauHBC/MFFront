import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import PropTypes from "prop-types";
import styled, { keyframes } from "styled-components";
import { Link, useLocation } from "react-router-dom";
import { toast } from "react-toastify";
import {
  FaBell,
  FaBirthdayCake,
  FaChevronLeft,
  FaChevronRight,
  FaCog,
  FaPlus,
  FaSpinner,
  FaTimes,
} from "react-icons/fa";

import axios, {
  getUserFacingApiError,
  sanitizeUserFacingErrorMessage,
} from "../../services/axios";
import Loading from "../../components/Loading";
import {
  checkSchedulingAvailability,
  listSpecialSchedulingEvents,
  previewSchedulingOccurrences,
} from "../../services/scheduling";
import { listPatientPlans, getCoveragePreview } from "../../services/financial";
import { AppDrawer, DrawerBackdrop } from "../../components/AppDrawer";
import { PageWrapper, PageContent } from "../../components/AppLayout";
import { SessionStatusButton } from "../../components/AppSessionStatus";
import PatientSearchField from "../../components/PatientSearchField";
import {
  getPatientDisplayName as getPatientName,
  getPatientSearchText,
  normalizeSearchText,
} from "../../utils/patientSearch";

const START_HOUR = 7;
const END_HOUR = 20;
const APPOINTMENT_HOUR_OPTIONS = Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, index) => {
  const hour = START_HOUR + index;
  return {
    value: String(hour).padStart(2, "0"),
    label: `${String(hour).padStart(2, "0")}h`,
  };
});
const PROFESSIONAL_GROUP_SLUG = "profissional";
const ATTENDANCE_CONFIRMATION_TOLERANCE_MINUTES = 15;
const MAX_WEEK_SLOT_VISIBLE = 3;
const WEEK_PERIODS = [
  { key: "morning", label: "Manhã", startHour: 7, endHour: 12 },
  { key: "afternoon", label: "Tarde", startHour: 13, endHour: END_HOUR },
];

const PATIENT_ATTENTION_INDICATOR_META = {
  high: {
    label: "Atenção alta",
    tone: "high",
  },
  medium: {
    label: "Atenção média",
    tone: "medium",
  },
  undefined: {
    label: "Atenção não definida",
    tone: "undefined",
  },
};

const OPERATIONAL_ALERT_SEVERITY_LABELS = {
  high: "Alta",
  medium: "Média",
  low: "Baixa",
};

const getOperationalAlertDueLabel = (alert) => {
  if (alert?.details?.due_date_label) return alert.details.due_date_label;
  if (String(alert?.type || "").startsWith("replacement_credit")) return "validade";
  return "data";
};

const OPERATIONAL_ALERT_SEVERITY_ORDER = {
  high: 0,
  medium: 1,
  low: 2,
};
const BIRTHDAY_ALERT_WINDOW_DAYS = 5;

const inFlightAgendaRequests = new Map();

const reuseInFlightAgendaRequest = (key, requestFactory) => {
  if (inFlightAgendaRequests.has(key)) {
    return inFlightAgendaRequests.get(key);
  }

  const request = Promise.resolve()
    .then(requestFactory)
    .finally(() => {
      inFlightAgendaRequests.delete(key);
    });
  inFlightAgendaRequests.set(key, request);
  return request;
};

const PENDING_CENTER_CATEGORY_LABELS = {
  patient_plan_overdue: "Planos vencidos",
  patient_plan_expiring: "Planos vencendo",
  patient_plan_pause_overdue: "Pausas vencidas",
  patient_plan_pause_expiring: "Pausas terminando",
  standalone_session_credit_expiring: "Pacote de sessões acabando",
  replacement_credit: "Reposições pendentes",
  patient_birthday: "Aniversários",
  other: "Outros alertas",
};

const PENDING_CENTER_SECTION_LABELS = {
  urgent: "Urgentes",
  attention: "Atenção",
  reminders: "Lembretes",
};

const PENDING_CENTER_SECTION_ORDER = {
  urgent: 0,
  attention: 1,
  reminders: 2,
};

const PENDING_CENTER_MAIN_SECTIONS = [
  {
    key: "urgent",
    items: [
      { key: "attendance-to-finalize", kind: "attendance", label: "Atendimentos pendentes" },
      { key: "patient_plan_overdue", kind: "operational-alert", label: PENDING_CENTER_CATEGORY_LABELS.patient_plan_overdue },
      { key: "patient_plan_pause_overdue", kind: "operational-alert", label: PENDING_CENTER_CATEGORY_LABELS.patient_plan_pause_overdue },
    ],
  },
  {
    key: "attention",
    items: [
      { key: "patient_plan_expiring", kind: "operational-alert", label: PENDING_CENTER_CATEGORY_LABELS.patient_plan_expiring },
      { key: "patient_plan_pause_expiring", kind: "operational-alert", label: PENDING_CENTER_CATEGORY_LABELS.patient_plan_pause_expiring },
      { key: "standalone_session_credit_expiring", kind: "operational-alert", label: PENDING_CENTER_CATEGORY_LABELS.standalone_session_credit_expiring },
      { key: "replacement_credit", kind: "operational-alert", label: PENDING_CENTER_CATEGORY_LABELS.replacement_credit },
    ],
  },
  {
    key: "reminders",
    items: [
      { key: "patient_birthday", kind: "operational-alert", label: PENDING_CENTER_CATEGORY_LABELS.patient_birthday },
    ],
  },
];

const getOperationalAlertCategory = (alert) => {
  const type = String(alert?.type || "");
  if (type === "patient_plan_overdue") return "patient_plan_overdue";
  if (type === "patient_plan_expiring") return "patient_plan_expiring";
  if (type === "patient_plan_pause_overdue") return "patient_plan_pause_overdue";
  if (type === "patient_plan_pause_expiring") return "patient_plan_pause_expiring";
  if (type.startsWith("standalone_session_credit")) return "standalone_session_credit_expiring";
  if (type.startsWith("replacement_credit")) return "replacement_credit";
  if (type.startsWith("patient_birthday")) return "patient_birthday";
  return "other";
};

const getOperationalAlertSection = (category) => {
  if (category === "patient_plan_overdue") return "urgent";
  if (category === "patient_plan_pause_overdue") return "urgent";
  if (category === "patient_birthday") return "reminders";
  return "attention";
};

const pluralizeSession = (count) => `${count} ${count === 1 ? "sessão restante" : "sessões restantes"}`;

const getStandaloneCreditServiceName = (alert) => {
  if (alert?.details?.service_name) return alert.details.service_name;
  const status = String(alert?.status || "");
  const [serviceName] = status.split(" - ");
  return serviceName || "Sessão avulsa";
};

const getStandaloneCreditQuantity = (alert) => {
  const remaining = Number(alert?.details?.remaining_sessions);
  if (Number.isFinite(remaining)) return remaining;
  const quantity = Number(alert?.quantity);
  return Number.isFinite(quantity) ? quantity : 0;
};

const groupStandaloneCreditAlerts = (alerts = []) => {
  const groupMap = new Map();
  alerts.forEach((alert) => {
    const serviceName = getStandaloneCreditServiceName(alert);
    const patientKey = `${alert.patient_id || alert.patient_name || "sem-paciente"}`;
    const existing = groupMap.get(patientKey) || {
      key: patientKey,
      patientId: alert.patient_id,
      patientName: alert.patient_name || "Paciente",
      services: new Map(),
    };

    const serviceKey = `${alert.details?.service_id || serviceName}`;
    const currentService = existing.services.get(serviceKey) || {
      key: serviceKey,
      serviceName,
      remainingSessions: 0,
      alertKeys: new Set(),
      alerts: [],
    };
    const alertKey = alert?.details?.alert_key || alert.centerKey;
    if (!currentService.alertKeys.has(alertKey)) {
      currentService.remainingSessions += getStandaloneCreditQuantity(alert);
      currentService.alertKeys.add(alertKey);
      currentService.alerts.push(alert);
    }
    existing.services.set(serviceKey, currentService);
    groupMap.set(patientKey, existing);
  });

  return Array.from(groupMap.values())
    .map((group) => ({
      ...group,
      services: Array.from(group.services.values())
        .filter((service) => service.remainingSessions === 1)
        .map((service) => ({
          ...service,
          alertKeys: undefined,
        })),
    }))
    .filter((group) => group.services.length > 0);
};

const countStandaloneCreditItems = (alerts = []) =>
  groupStandaloneCreditAlerts(alerts).reduce((total, patientGroup) => total + patientGroup.services.length, 0);

const groupPlanAlertsByPatient = (alerts = []) => {
  const groupMap = new Map();
  alerts.forEach((alert) => {
    const patientKey = `${alert.patient_id || alert.patient_name || "sem-paciente"}`;
    const existing = groupMap.get(patientKey) || {
      key: patientKey,
      patientId: alert.patient_id,
      patientName: alert.patient_name || "Paciente",
      plans: new Map(),
    };
    const planKey = `${alert.details?.patient_plan_id || alert.centerKey}`;
    if (!existing.plans.has(planKey)) {
      existing.plans.set(planKey, {
        key: planKey,
        alert,
      });
    }
    groupMap.set(patientKey, existing);
  });

  return Array.from(groupMap.values()).map((group) => ({
    ...group,
    plans: Array.from(group.plans.values()),
  }));
};

const countPlanAlertItems = (alerts = []) =>
  groupPlanAlertsByPatient(alerts).reduce((total, patientGroup) => total + patientGroup.plans.length, 0);

const isPlanOperationalAlert = (key) => [
  "patient_plan_expiring",
  "patient_plan_overdue",
  "patient_plan_pause_expiring",
  "patient_plan_pause_overdue",
].includes(key);

const getBirthdayAlertDaysUntil = (alert) => {
  const daysUntil = Number(alert?.details?.days_until);
  return Number.isFinite(daysUntil) ? daysUntil : null;
};

const isBirthdayAlertInWindow = (alert) => {
  const daysUntil = getBirthdayAlertDaysUntil(alert);
  return daysUntil !== null && daysUntil >= 0 && daysUntil <= BIRTHDAY_ALERT_WINDOW_DAYS;
};

const formatDateOnlyLabel = (value) => {
  const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return "";
  return `${match[3]}/${match[2]}/${match[1]}`;
};

const getBirthdayGroupTitle = (group) => {
  if (group.daysUntil === 0) return "Aniversariante do dia";
  return formatDateOnlyLabel(group.dateKey) || group.birthdayLabel || "Próximos aniversários";
};

const getBirthdayGroupSubtitle = (group) => {
  if (group.daysUntil === 0) return group.birthdayLabel || "Hoje";
  if (group.daysUntil === 1) return "Amanhã";
  return `Em ${group.daysUntil} dias`;
};

const groupBirthdayAlertsByDate = (alerts = []) => {
  const groupMap = new Map();

  alerts
    .filter(isBirthdayAlertInWindow)
    .forEach((alert) => {
      const daysUntil = getBirthdayAlertDaysUntil(alert);
      const dateKey = alert.due_date || alert.details?.next_birthday || alert.details?.birthday_label || `${daysUntil}`;
      const existing = groupMap.get(dateKey) || {
        key: dateKey,
        dateKey,
        daysUntil,
        birthdayLabel: alert.details?.birthday_label || "",
        alerts: [],
      };

      existing.alerts.push(alert);
      groupMap.set(dateKey, existing);
    });

  return Array.from(groupMap.values())
    .sort((first, second) => first.daysUntil - second.daysUntil)
    .map((group) => ({
      ...group,
      alerts: group.alerts.sort((first, second) =>
        String(first.patient_name || "").localeCompare(String(second.patient_name || ""), "pt-BR", {
          sensitivity: "base",
        })),
    }));
};

const countBirthdayAlertItems = (alerts = []) =>
  alerts.filter(isBirthdayAlertInWindow).length;

const buildReplacementCreditFromAlert = (alert) => ({
  id: alert?.details?.replacement_credit_id,
  patient_id: alert?.patient_id,
  patient_name: alert?.patient_name,
  reason: alert?.details?.reason || alert?.title || "Reposição pendente",
  expires_at: alert?.due_date || null,
  source_session_id: alert?.details?.source_session_id || null,
  source_service_id: alert?.details?.source_service_id || null,
  source_service_type: alert?.details?.source_service_type || null,
  source_service_name: alert?.details?.source_service_name || null,
  source_billing_mode: alert?.details?.source_billing_mode || null,
  source_billing_cycle_start: alert?.details?.source_billing_cycle_start || null,
  source_billing_cycle_end: alert?.details?.source_billing_cycle_end || null,
});

const getPlanAlertLink = (alert) => {
  const params = new URLSearchParams();
  if (alert?.type === "patient_plan_overdue") {
    params.set("view", "mensalidades");
    if (alert?.patient_name) params.set("patient_name", alert.patient_name);
    if (alert?.due_date) params.set("month", String(alert.due_date).slice(0, 7));
    return `/financeiro?${params.toString()}`;
  }

  params.set("tab", "patient-plans");
  if (alert?.patient_id) params.set("patient_id", String(alert.patient_id));
  if (alert?.patient_name) params.set("patient_name", alert.patient_name);
  if (alert?.details?.patient_plan_id) params.set("patient_plan_id", String(alert.details.patient_plan_id));
  return `/planos?${params.toString()}`;
};

const getPlanAlertDueText = (alert) => {
  if (!alert?.due_date) return alert?.status || "";
  if (alert?.type === "patient_plan_overdue") {
    return `Vencido desde ${formatDateOnlyLabel(alert.due_date) || alert.due_date}`;
  }
  if (alert?.type === "patient_plan_pause_overdue") {
    return `Fim previsto vencido desde ${formatDateOnlyLabel(alert.due_date) || alert.due_date}`;
  }
  if (alert?.type === "patient_plan_pause_expiring") {
    return `Pausa termina em ${formatDateOnlyLabel(alert.due_date) || alert.due_date}`;
  }
  return `Vence em ${alert.due_date}`;
};

const normalizeAttentionLevel = (value) => String(value || "").trim().toLowerCase();

const getPatientAttentionIndicatorMeta = (value) => {
  const normalized = normalizeAttentionLevel(value);
  if (normalized === "high") return PATIENT_ATTENTION_INDICATOR_META.high;
  if (normalized === "medium") return PATIENT_ATTENTION_INDICATOR_META.medium;
  if (!normalized) return PATIENT_ATTENTION_INDICATOR_META.undefined;
  return null;
};

const renderPatientAttentionIndicator = (level) => {
  const meta = getPatientAttentionIndicatorMeta(level);
  if (!meta) return null;

  return (
    <PatientAttentionDot
      role="img"
      aria-label={meta.label}
      title={meta.label}
      $tone={meta.tone}
    />
  );
};

const compactWeeklyFrequencyLabel = (servicePlan) => {
  const weeklyCount = Number(servicePlan?.sessions_per_week);
  if (Number.isInteger(weeklyCount) && weeklyCount > 0) {
    return `${weeklyCount}x/sem`;
  }

  const rawLabel = String(servicePlan?.frequency_label || "").trim();
  if (!rawLabel) return null;

  const compactMatch = rawLabel.match(/^(\d+)\s*x(?:\s+na\s+semana)?$/i);
  if (compactMatch) return `${compactMatch[1]}x/sem`;

  return rawLabel.replace(/\s+/g, " ");
};

const getSessionPlanDescriptor = (session, resolveServiceName) => {
  if (session?.billing_mode !== "covered_by_plan") return null;

  const servicePlan = session?.BillingCycle?.ServicePlan || null;
  const serviceCode = servicePlan?.Service?.code || session?.service_type || session?.Service?.code;
  const serviceLabel =
    servicePlan?.Service?.name
    || session?.Service?.name
    || (serviceCode ? resolveServiceName(serviceCode) : null);
  const frequencyLabel = compactWeeklyFrequencyLabel(servicePlan);

  if (serviceLabel && frequencyLabel) return `${serviceLabel} ${frequencyLabel}`;
  if (servicePlan?.name) return String(servicePlan.name).trim();
  if (serviceLabel) return serviceLabel;
  if (frequencyLabel) return frequencyLabel;
  return null;
};

const getSessionPlanSummary = (session, resolveServiceName) => {
  if (session?.billing_mode !== "covered_by_plan") return null;
  const descriptor = getSessionPlanDescriptor(session, resolveServiceName);
  const label = "Plano mensal";
  return descriptor ? `${label} — ${descriptor}` : label;
};

const getSessionServiceLabel = (session, resolveServiceName) => {
  const serviceCode = session?.service_type || session?.Service?.code;
  return session?.Service?.name || (serviceCode ? resolveServiceName(serviceCode) : null) || "Atendimento";
};

const getSessionStandaloneSummary = (session, resolveServiceName) => {
  if (!session || session.billing_mode === "covered_by_plan") return null;
  const serviceLabel = getSessionServiceLabel(session, resolveServiceName);
  const recurringPosition = Number(session?.recurring_position);
  const recurringTotal = Number(session?.recurring_total);
  const canShowSeriesPosition =
    Number.isInteger(recurringPosition) &&
    recurringPosition > 0 &&
    Number.isInteger(recurringTotal) &&
    recurringTotal > 0;
  const total = Number(session?.PatientCredit?.total_sessions || 0);
  const used = Number(session?.PatientCredit?.used_sessions || 0);
  const canShowPackagePosition =
    session?.status === "done" &&
    Number.isInteger(total) &&
    total > 0 &&
    Number.isInteger(used) &&
    used > 0;

  if (canShowSeriesPosition) {
    return `Sessão ${recurringPosition}/${recurringTotal} — ${serviceLabel}`;
  }

  return canShowPackagePosition
    ? `Sessão ${used}/${total} — ${serviceLabel}`
    : `Sessão — ${serviceLabel}`;
};

const getSessionBillingSummary = (session, resolveServiceName) => (
  session?.billing_mode === "covered_by_plan"
    ? getSessionPlanSummary(session, resolveServiceName)
    : getSessionStandaloneSummary(session, resolveServiceName)
);

const getRecurringSeriesBadge = (session) => {
  if (session?.billing_mode === "covered_by_plan") return null;
  const position = session?.recurring_position;
  if (!position) return null;
  const total = session?.recurring_total;
  return total ? `Sessão ${position}/${total}` : "Sessão";
};

const getPackageSessionCounter = (session) => {
  const position = Number(session?.recurring_position);
  const total = Number(session?.recurring_total);
  if (Number.isInteger(position) && position > 0 && Number.isInteger(total) && total > 0) {
    return `${position}/${total}`;
  }
  return "-";
};

const getShortPatientName = (name) => {
  const parts = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length <= 1) return parts[0] || "Paciente";
  return `${parts[0]} ${parts[1]}`;
};

const getCompactWeekPatientName = (name) => {
  const parts = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length <= 1) return parts[0] || "Paciente";
  if (parts.length === 2) return parts.join(" ");

  const connectors = new Set(["de", "da", "do", "das", "dos", "e"]);
  const firstName = parts[0];
  const lastUsefulName = [...parts].reverse().find(
    (part) => !connectors.has(part.toLocaleLowerCase("pt-BR")),
  );
  if (lastUsefulName && lastUsefulName !== firstName) {
    return `${firstName} ${lastUsefulName}`;
  }

  const secondUsefulName = parts.slice(1).find(
    (part) => !connectors.has(part.toLocaleLowerCase("pt-BR")),
  );
  return secondUsefulName ? `${firstName} ${secondUsefulName}` : firstName;
};

const getMonthlyCardSummary = (session) => {
  const servicePlan = session?.BillingCycle?.ServicePlan || session?.ServicePlan || null;
  const weeklyCount = Number(servicePlan?.sessions_per_week);
  if (Number.isInteger(weeklyCount) && weeklyCount > 0) {
    return `Mensal ${weeklyCount}x`;
  }

  const frequency = compactWeeklyFrequencyLabel(servicePlan);
  if (frequency) return `Mensal ${frequency.replace(/\/sem$/i, "")}`;
  return "Mensal";
};

const getSessionCardSummary = (session) => {
  if (session?.billing_mode === "covered_by_plan") return getMonthlyCardSummary(session);
  return getRecurringSeriesBadge(session) || "Sessão";
};

const getSessionCardMetaParts = (session) => {
  if (session?.billing_mode === "covered_by_plan") {
    const summary = getMonthlyCardSummary(session);
    const counter = summary.replace(/^Mensal\s*/i, "").trim();
    return { type: "Mensal", counter };
  }

  const position = session?.recurring_position;
  const total = session?.recurring_total;
  return {
    type: "Sessão",
    counter: position && total ? `${position}/${total}` : "",
  };
};

const getWeekSessionMetaLabel = (session) => {
  if (session?.billing_mode === "covered_by_plan") {
    return getMonthlyCardSummary(session);
  }

  const position = Number(session?.recurring_position);
  const total = Number(session?.recurring_total);
  if (Number.isInteger(position) && position > 0 && Number.isInteger(total) && total > 0) {
    return `${position}/${total}`;
  }
  return "1/1";
};

const SESSION_STATUS_CONFIG = {
  scheduled: {
    label: "Agendado",
    tone: "scheduled",
  },
  open: {
    label: "Agendado",
    tone: "scheduled",
  },
  done: {
    label: "Concluído",
    tone: "done",
  },
  no_show: {
    label: "Falta",
    tone: "no_show",
  },
	  canceled: {
	    label: "Cancelado",
	    tone: "canceled",
	  },
	  suspended: {
	    label: "Suspensa",
	    tone: "suspended",
	  },
	};

const normalizeSessionStatusValue = (status) =>
  SESSION_STATUS_CONFIG[status] ? status : "scheduled";

const getSessionStatusConfig = (status) =>
  SESSION_STATUS_CONFIG[normalizeSessionStatusValue(status)];

const getSessionStatusLabel = (status) => getSessionStatusConfig(status).label;

const getSessionStatusTone = (status) => getSessionStatusConfig(status).tone;

const isSessionStatusActive = (currentStatus, targetStatus) =>
  getSessionStatusTone(currentStatus) === getSessionStatusTone(targetStatus);

const isHistoricalSessionStatus = (status) =>
  status === "canceled" || status === "no_show" || status === "suspended";

const WEEK_HIDDEN_HISTORY_STATUSES = new Set(["canceled", "no_show", "suspended"]);

const SESSION_STATUS_OPTIONS = [
  { value: "scheduled", label: getSessionStatusLabel("scheduled") },
  { value: "done", label: getSessionStatusLabel("done") },
  { value: "canceled", label: getSessionStatusLabel("canceled") },
  { value: "no_show", label: getSessionStatusLabel("no_show") },
];

const SPECIAL_SOURCE_LABELS = {
  national: "Feriado nacional",
  state: "Feriado estadual",
  city: "Feriado municipal",
  optional_point: "Ponto facultativo",
  internal_block: "Bloqueio interno",
  staff_time_off: "Ausência profissional",
  unit_closure: "Fechamento da unidade",
};

const SPECIAL_HOLIDAY_SOURCES = new Set(["national", "state", "city"]);

const severityWeight = (value) => {
  if (value === "block") return 3;
  if (value === "warn") return 2;
  return 1;
};

const eventSeverity = (event) => {
  if (!event || event.affects_scheduling === false) return "info";
  const behavior = String(event.behavior_type || "").toUpperCase();
  if (behavior === "BLOCK") return "block";
  if (behavior === "WARN_CONFIRM") return "warn";
  return "info";
};

const eventSeverityLabel = (severity) => {
  if (severity === "block") return "Bloqueio";
  if (severity === "warn") return "Alerta";
  return "Info";
};

const eventBehaviorLabel = (event) => {
  if (!event || event.affects_scheduling === false) return "Informativo";
  const behavior = String(event.behavior_type || "").toUpperCase();
  if (behavior === "BLOCK") return "Bloqueante";
  if (behavior === "WARN_CONFIRM") return "Requer confirmação";
  return "Informativo";
};

const daySummaryLabel = (summary) => {
  if (!summary) return "";
  const events = Array.isArray(summary.events) ? summary.events : [];
  const hasHoliday = events.some((event) => SPECIAL_HOLIDAY_SOURCES.has(event.source_type));
  if (summary.severity === "block") return hasHoliday ? "Feriado" : "Bloqueado";
  if (summary.severity === "warn") return "Alerta";
  if (hasHoliday) return "Feriado";
  return "Informativo";
};

const buildSpecialEventsTooltip = (events = []) =>
  events
    .map((event) => {
      const source = SPECIAL_SOURCE_LABELS[event.source_type] || event.source_type || "Evento";
      const behavior = eventBehaviorLabel(event);
      return `${event.name || "Feriado ou bloqueio"} - ${source} - ${behavior}`;
    })
    .join("\n");

const formatHourLabel = (hour) => `${String(hour).padStart(2, "0")}:00`;

const availabilityStatus = (availability) => {
  if (!availability) return "available";
  if (availability?.has_blocking_events) return "block";
  if (availability?.requires_confirmation) return "warn";
  if (Array.isArray(availability?.matched_events) && availability.matched_events.length > 0) {
    return "info";
  }
  return "available";
};

const formatOccurrenceDate = (dateOnly, startsAt) => {
  if (dateOnly) {
    const [year, month, day] = String(dateOnly).split("-");
    if (year && month && day) {
      return `${day}/${month}/${year}`;
    }
  }
  if (!startsAt) return "";
  const date = new Date(startsAt);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
};

const OCCURRENCE_WEEKDAY_LABELS = [
  "Domingo",
  "Segunda",
  "Terça",
  "Quarta",
  "Quinta",
  "Sexta",
  "Sábado",
];

const formatOccurrenceCompactLabel = (occurrence) => {
  const dateLabel = formatOccurrenceDate(occurrence?.date, occurrence?.starts_at);
  const startTime = String(occurrence?.start_time || "").slice(0, 5);
  const hourLabel = startTime ? `${startTime.replace(":", "h")}` : "--h--";
  const referenceDate = occurrence?.starts_at
    ? new Date(occurrence.starts_at)
    : new Date(`${occurrence?.date || ""}T00:00:00`);
  const weekdayLabel = referenceDate && !Number.isNaN(referenceDate.getTime())
    ? OCCURRENCE_WEEKDAY_LABELS[referenceDate.getDay()]
    : "";
  return [dateLabel, hourLabel, weekdayLabel].filter(Boolean).join(" · ");
};

const getOccurrenceTimeValue = (occurrence) => {
  if (occurrence?.start_time) return String(occurrence.start_time).slice(0, 5);
  if (!occurrence?.starts_at) return "";
  const date = new Date(occurrence.starts_at);
  if (Number.isNaN(date.getTime())) return "";
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");
  return `${hour}:${minute}`;
};

const getOccurrenceDurationMinutes = (occurrence) => {
  const startsAt = new Date(occurrence?.starts_at);
  const endsAt = new Date(occurrence?.ends_at);
  if (!Number.isNaN(startsAt.getTime()) && !Number.isNaN(endsAt.getTime())) {
    const diff = Math.round((endsAt.getTime() - startsAt.getTime()) / 60000);
    if (diff > 0) return diff;
  }
  return 60;
};

const buildEditedOccurrenceTimes = (occurrence, dateValue, timeValue) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(dateValue || ""))) return null;
  if (!/^\d{2}:\d{2}$/.test(String(timeValue || ""))) return null;
  const [year, month, day] = String(dateValue).split("-").map(Number);
  const [hour, minute] = String(timeValue).split(":").map(Number);
  const startsAt = new Date(year, month - 1, day, hour, minute, 0, 0);
  if (Number.isNaN(startsAt.getTime())) return null;
  const endsAt = new Date(startsAt.getTime() + getOccurrenceDurationMinutes(occurrence) * 60000);
  return {
    starts_at: startsAt.toISOString(),
    ends_at: endsAt.toISOString(),
  };
};

const toOccurrencePreviewPayload = (occurrence, seriesPayload = {}) => ({
  starts_at: occurrence.starts_at,
  ends_at: occurrence.ends_at,
  professional_user_id:
    occurrence.professional_user_id !== undefined
      ? occurrence.professional_user_id
      : seriesPayload.professional_user_id || null,
  service_id:
    occurrence.service_id !== undefined
      ? occurrence.service_id
      : seriesPayload.service_id || null,
  service_type:
    occurrence.service_type !== undefined
      ? occurrence.service_type
      : seriesPayload.service_type || null,
});

const sortOccurrencesByDateTime = (occurrences) =>
  [...occurrences].sort((first, second) => {
    const firstTime = new Date(first?.starts_at || 0).getTime();
    const secondTime = new Date(second?.starts_at || 0).getTime();
    return firstTime - secondTime;
  });

const WEEKDAY_OPTIONS = [
  { value: 1, label: "Seg" },
  { value: 2, label: "Ter" },
  { value: 3, label: "Qua" },
  { value: 4, label: "Qui" },
  { value: 5, label: "Sex" },
];

const OCCURRENCE_STATUS_LABELS = {
  AVAILABLE: "Disponível",
  INFO: "Info",
  WARN_CONFIRM: "Alerta",
  BLOCK: "Bloqueado",
};

const emptyForm = {
  patient_id: "",
  professional_user_id: "",
  service_type: "",
  service_id: "",
  status: "scheduled",
  is_initial: false,
  starts_at: "",
  ends_at: "",
  notes: "",
  absence_reason: "",
  late_policy_exception_justified: false,
  late_policy_exception_reason: "",
  monthly_reschedule_exception_justified: false,
  monthly_reschedule_exception_reason: "",
  cycle_reschedule_exception_justified: false,
  cycle_reschedule_exception_reason: "",
  session_replacement_credit_id: "",
  patient_credit_id: "",
  billing_mode: "",
  package_update_scope: "single",
};

const emptyDeleteModal = {
  open: false,
  step: "choice",
  mode: "single",
  session: null,
  candidates: [],
  selectedIds: [],
  reason: "",
  removalIntent: "reschedule",
  keepForReschedule: true,
  confirmHardRemoval: false,
};

const emptyAbsenceModal = {
  open: false,
  id: null,
  status: null,
  session: null,
  reason: "",
  latePolicyApplies: false,
  latePolicyExceptionJustified: false,
  latePolicyExceptionReason: "",
  generateReplacementCredit: false,
  monthlyAbsenceCountBefore: 0,
  monthlyAbsenceCountAfter: 0,
  monthlyAbsenceLimit: 2,
  monthlyAbsenceReachedLimit: false,
  monthlyAbsenceExceededLimit: false,
  hasFixedSchedule: false,
  isSaving: false,
};

const resolveSeriesId = (session) => session?.series_id || session?.series?.id || null;

const hasRecurringSeries = (session) => !!resolveSeriesId(session);

const isPackageSeriesSession = (session) => (
  !!resolveSeriesId(session)
  && String(session?.billing_mode || "per_session") !== "covered_by_plan"
);

const canSelectDeleteCandidate = (candidate, keepForReschedule, isPackageRemoval) => {
  if (!candidate) return false;
  if (isPackageRemoval && keepForReschedule) {
    return candidate.can_remove_with_replacement !== false;
  }
  return candidate.can_delete !== false;
};

const getDeleteCandidateBlockReason = (candidate, keepForReschedule, isPackageRemoval) => {
  if (!candidate) return null;
  if (isPackageRemoval && keepForReschedule) {
    return candidate.removal_blocked_reason || null;
  }
  return candidate.blocked_reason || null;
};

const getDeleteModalTitle = (session, step) => {
  if (isPackageSeriesSession(session)) return "Remover agendamento";
  return step === "choice" ? "Excluir agendamento" : "Revisar exclusão";
};

const getPatientDisplayName = (patientLike) =>
  patientLike?.Patient?.nickname
  || patientLike?.Patient?.full_name
  || patientLike?.Patient?.name
  || patientLike?.nickname
  || patientLike?.full_name
  || patientLike?.name
  || "Paciente";

const normalizeText = (value) => {
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
};

const DEFAULT_OPERATIONAL_POLICY = {
  late_change_minimum_notice_hours: 24,
  monthly_reschedule_limit: 2,
  monthly_absence_limit: 2,
  replacement_credit_validity_days: 30,
  replacement_credit_expiring_alert_days: 7,
};

const isLessThanConfiguredNoticeBeforeSession = (startsAt, noticeHours = 24) => {
  if (!startsAt) return false;
  const date = new Date(startsAt);
  if (Number.isNaN(date.getTime())) return false;
  return date.getTime() - Date.now() < Number(noticeHours || 24) * 60 * 60 * 1000;
};

const isMonthlyRescheduleLimitError = (error) =>
  error?.response?.data?.code === "MONTHLY_RESCHEDULE_LIMIT_EXCEEDED";

const isPlanCycleRescheduleError = (error) =>
  error?.response?.data?.code === "PLAN_CYCLE_RESCHEDULE_OUT_OF_RANGE";

const getMonthlyRescheduleLimitMessage = (error) => {
  const count = Number(error?.response?.data?.monthly_reschedule_count || 0);
  const limit = Number(error?.response?.data?.monthly_reschedule_limit || 2);
  return `Este paciente já atingiu ${count} remarcações no mês da sessão original (limite ${limit}).`;
};

const getPlanCycleRescheduleMessage = (error) => {
  const cycleStart = error?.response?.data?.cycle_start || "";
  const cycleEnd = error?.response?.data?.cycle_end || "";
  const cycleLabel = cycleStart && cycleEnd ? ` (${cycleStart} a ${cycleEnd})` : "";
  return `Esta sessão está vinculada a plano e a nova data fica fora do ciclo vigente${cycleLabel}.`;
};

const showAbsenceMonthlyPolicyNotice = (payload) => {
  const policy = payload?.absence_monthly_policy || payload?.original_absence_monthly_policy;
  if (!policy?.fixed_schedule_review_recommended) return;
  const count = Number(policy.monthly_count_after || 0);
  const limit = Number(policy.monthly_limit || 2);
  if (policy.exceeded_limit) {
    toast.warn(
      `Paciente excedeu o limite mensal de faltas (${count}/${limit}). Avaliar horário fixo.`,
    );
    return;
  }
  if (policy.reached_limit) {
    toast.info(
      `Paciente atingiu o limite mensal de faltas (${count}/${limit}). Avaliar horário fixo.`,
    );
  }
};

const resolveSchedulingErrorMessage = (error) => {
  const responseData = error?.response?.data || {};
  const code = responseData?.code || "";
  const safeErrorMessage = sanitizeUserFacingErrorMessage(
    responseData?.error,
    "Não foi possível salvar o agendamento.",
  );
  if (code === "SCHEDULING_OVERRIDE_REASON_REQUIRED") {
    return safeErrorMessage || "Informe um motivo para forçar o encaixe.";
  }
  if (code === "SCHEDULING_BLOCKED") {
    const totalBlocked = Number(responseData?.total_blocked || 0);
    if (totalBlocked > 0) {
      return `${sanitizeUserFacingErrorMessage(
        responseData?.error,
        "Horario bloqueado.",
      )} (${totalBlocked} ocorrencia(s) bloqueada(s)).`;
    }
    return sanitizeUserFacingErrorMessage(
      responseData?.error,
      "Horario bloqueado por evento operacional.",
    );
  }
  if (code === "SCHEDULING_CONFIRMATION_REQUIRED") {
    const totalWarnings = Number(responseData?.total_warnings || 0);
    if (totalWarnings > 0) {
      return `${sanitizeUserFacingErrorMessage(
        responseData?.error,
        "Horario com alerta operacional.",
      )} (${totalWarnings} ocorrencia(s) com alerta).`;
    }
    return sanitizeUserFacingErrorMessage(
      responseData?.error,
      "Horario com alerta operacional.",
    );
  }
  if (code === "PATIENT_SCHEDULE_CONFLICT") {
    return "Este paciente já possui um atendimento nesse horário.";
  }
  return safeErrorMessage;
};

const toIsoWeekday = (date) => {
  const day = date.getDay();
  return day === 0 ? 7 : day;
};

const toSelectableWeekday = (date) => {
  const weekday = toIsoWeekday(date);
  return weekday >= 1 && weekday <= 5 ? weekday : null;
};

const formatDateTime = (value) => {
  if (!value) return "Sem data";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Sem data";
  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatDateParam = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const toDateInputValue = (value) => {
  if (!value) return "";
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const toMonthInputValue = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
};

const parseDateInputValue = (value) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ""))) return null;
  const [yearString, monthString, dayString] = String(value).split("-");
  const year = Number(yearString);
  const monthIndex = Number(monthString) - 1;
  const day = Number(dayString);
  const date = new Date(year, monthIndex, day);
  if (
    Number.isNaN(date.getTime())
    || date.getFullYear() !== year
    || date.getMonth() !== monthIndex
    || date.getDate() !== day
  ) {
    return null;
  }
  date.setHours(0, 0, 0, 0);
  return date;
};

const buildMonthlyValidityRange = (value) => {
  const startDate = parseDateInputValue(toDateInputValue(value));
  if (!startDate) {
    return {
      start: "",
      end: "",
    };
  }

  const firstDayOfNextMonth = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 1);
  const daysInNextMonth = new Date(
    firstDayOfNextMonth.getFullYear(),
    firstDayOfNextMonth.getMonth() + 1,
    0,
  ).getDate();
  const nextMonthSameDay = new Date(
    firstDayOfNextMonth.getFullYear(),
    firstDayOfNextMonth.getMonth(),
    Math.min(startDate.getDate(), daysInNextMonth),
  );
  const endDate = new Date(nextMonthSameDay);
  endDate.setDate(endDate.getDate() - 1);

  return {
    start: formatDateParam(startDate),
    end: formatDateParam(endDate),
  };
};

const formatDate = (value) => {
  if (!value) return "";
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const parsedDate = parseDateInputValue(value);
    if (!parsedDate) return "";
    return parsedDate.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
};

const formatTime = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatPendingDayLabel = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
  });
};

const formatWeekRange = (start, end) => {
  if (!start || !end) return "";
  const sameMonth = start.getMonth() === end.getMonth();
  const sameYear = start.getFullYear() === end.getFullYear();
  if (sameMonth && sameYear) {
    const monthName = start.toLocaleDateString("pt-BR", { month: "long" });
    return `${start.getDate()} a ${end.getDate()} de ${monthName} de ${start.getFullYear()}`;
  }
  const startLabel = start.toLocaleDateString("pt-BR", { day: "numeric", month: "long" });
  const endLabel = end.toLocaleDateString("pt-BR", {
    day: "numeric",
    month: "long",
  });
  if (!sameYear) {
    const startWithYear = start.toLocaleDateString("pt-BR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
    const endWithYear = end.toLocaleDateString("pt-BR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
    return `${startWithYear} a ${endWithYear}`;
  }
  return `${startLabel} a ${endLabel} de ${end.getFullYear()}`;
};

const formatDayPeriodLabel = (date) => {
  if (!date) return "";
  return date.toLocaleDateString("pt-BR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
};

const formatMonthPeriodLabel = (date) => {
  if (!date) return "";
  return date.toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });
};

const toInputValue = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
};

const getHourInputValue = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return String(date.getHours()).padStart(2, "0");
};

const buildDateHourInputValue = (dateValue, hourValue) => {
  if (!dateValue || !hourValue) return "";
  const normalizedHour = String(hourValue).padStart(2, "0");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateValue) || !/^\d{2}$/.test(normalizedHour)) return "";
  return `${dateValue}T${normalizedHour}:00`;
};

const getMonthDateRange = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return { start: "", end: "" };
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  return {
    start: toDateInputValue(start),
    end: toDateInputValue(end),
  };
};

const isDateWithinInputRange = (value, start, end) => {
  const dateValue = toDateInputValue(value);
  const startValue = toDateInputValue(start);
  const endValue = toDateInputValue(end);
  if (!dateValue || !startValue || !endValue) return true;
  return dateValue >= startValue && dateValue <= endValue;
};

const getMonthRangeForDate = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return { start: null, endExclusive: null };
  return {
    start: new Date(date.getFullYear(), date.getMonth(), 1),
    endExclusive: new Date(date.getFullYear(), date.getMonth() + 1, 1),
  };
};

const isSessionInMonth = (session, monthDate) => {
  const sessionDate = new Date(session?.starts_at);
  const referenceDate = new Date(monthDate);
  if (Number.isNaN(sessionDate.getTime()) || Number.isNaN(referenceDate.getTime())) return false;
  return (
    sessionDate.getFullYear() === referenceDate.getFullYear() &&
    sessionDate.getMonth() === referenceDate.getMonth()
  );
};

const getSessionPatientId = (session) =>
  session?.patient_id || session?.patient?.id || session?.Patient?.id || null;

const sameDay = (a, b) => {
  if (!a || !b) return false;
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
};

const startOfDay = (date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

const startOfNextDay = (date) => {
  const d = startOfDay(date);
  d.setDate(d.getDate() + 1);
  return d;
};

const endOfDay = (date) => {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
};

const isScheduledStatus = (status) =>
  !status || status === "scheduled" || status === "open";

const getWeekDays = (baseDate) => {
  const start = startOfDay(baseDate);
  const day = start.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  start.setDate(start.getDate() + diff);
  return Array.from({ length: 5 }).map((_, index) => {
    const d = new Date(start);
    d.setDate(start.getDate() + index);
    return d;
  });
};

const getMonthDays = (baseDate) => {
  const first = new Date(baseDate.getFullYear(), baseDate.getMonth(), 1);
  const last = new Date(baseDate.getFullYear(), baseDate.getMonth() + 1, 0);
  const days = [];
  const start = new Date(first);
  const offset = start.getDay() === 0 ? -6 : 1 - start.getDay();
  start.setDate(start.getDate() + offset);
  while (start <= last || start.getDay() !== 1) {
    days.push(new Date(start));
    start.setDate(start.getDate() + 1);
  }
  return days;
};

const getVisibleDateRange = (view, baseDate) => {
  if (view === "month") {
    const firstDayOfMonth = new Date(baseDate.getFullYear(), baseDate.getMonth(), 1);
    const lastDayOfMonth = new Date(baseDate.getFullYear(), baseDate.getMonth() + 1, 0);
    return {
      sessionsFrom: startOfDay(firstDayOfMonth),
      // The sessions API treats the date-only `to` boundary as exclusive.
      sessionsTo: startOfNextDay(lastDayOfMonth),
      specialEventsFrom: startOfDay(firstDayOfMonth),
      specialEventsTo: endOfDay(lastDayOfMonth),
    };
  }

  if (view === "week") {
    const weekDays = getWeekDays(baseDate);
    return {
      sessionsFrom: startOfDay(weekDays[0]),
      sessionsTo: startOfNextDay(weekDays[weekDays.length - 1]),
      specialEventsFrom: startOfDay(weekDays[0]),
      specialEventsTo: endOfDay(weekDays[weekDays.length - 1]),
    };
  }

  return {
    sessionsFrom: startOfDay(baseDate),
    sessionsTo: startOfNextDay(baseDate),
    specialEventsFrom: startOfDay(baseDate),
    specialEventsTo: endOfDay(baseDate),
  };
};



export default function Agendamentos() {
  const routeLocation = useLocation();
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const savingSessionIdsRef = useRef(new Set());
  const [savingSessionIds, setSavingSessionIds] = useState(new Set());
  const [savingActionMap, setSavingActionMap] = useState({});
  const submitLockRef = useRef(false);
  const [sessions, setSessions] = useState([]);
  const [specialEvents, setSpecialEvents] = useState([]);
  const [pendingSessionsSource, setPendingSessionsSource] = useState([]);
  const [packageScopePreview, setPackageScopePreview] = useState({
    sessionId: null,
    loading: false,
    data: null,
  });
  const packageScopePreviewRequestIdRef = useRef(0);
  const [patients, setPatients] = useState([]);
  const [professionals, setProfessionals] = useState([]);
  const [serviceLimits, setServiceLimits] = useState([]);
  const [services, setServices] = useState([]);
  const [isBaseDataLoading, setIsBaseDataLoading] = useState(true);
  const [statusOptions, setStatusOptions] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [filterPatientQuery, setFilterPatientQuery] = useState("");
  const [formPatientQuery, setFormPatientQuery] = useState("");
  const [absenceModal, setAbsenceModal] = useState(emptyAbsenceModal);
  const [attendanceModal, setAttendanceModal] = useState({
    open: false,
    timeLabel: "",
    serviceGroups: [],
    statuses: {},
    reasons: {},
    isSaving: false,
  });
  const [editingId, setEditingId] = useState(null);
  const [editingIntent, setEditingIntent] = useState("create");
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState("form");
  const [pendingCenterSelectedItemKey, setPendingCenterSelectedItemKey] = useState(null);
  const [groupContext, setGroupContext] = useState(null);
  const [view, setView] = useState("week");
  const [showMonthWeekend, setShowMonthWeekend] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [currentTime, setCurrentTime] = useState(Date.now());
  const [filters, setFilters] = useState({
    status: "",
    patient_id: "",
    service_type: "",
  });
  const [repeatEnabled, setRepeatEnabled] = useState(false);
  const [repeatWeekdays, setRepeatWeekdays] = useState([]);
  const [repeatMode, setRepeatMode] = useState("count");
  const [repeatCount, setRepeatCount] = useState("10");
  const [repeatWeeks, setRepeatWeeks] = useState("4");
  const [formAvailability, setFormAvailability] = useState(null);
  const [recurrencePreview, setRecurrencePreview] = useState(null);
  const [deleteModal, setDeleteModal] = useState(emptyDeleteModal);
  const [isDeletePreviewing, setIsDeletePreviewing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [activePlansForPatient, setActivePlansForPatient] = useState([]);
  const [replacementCreditsForPatient, setReplacementCreditsForPatient] = useState([]);
  const [patientCreditsForPatient, setPatientCreditsForPatient] = useState([]);
  const [operationalPolicy, setOperationalPolicy] = useState(DEFAULT_OPERATIONAL_POLICY);
  const [operationalAlerts, setOperationalAlerts] = useState([]);
  const [isOperationalAlertsLoading, setIsOperationalAlertsLoading] = useState(false);
  const [coveragePreview, setCoveragePreview] = useState(null);
  const [coveragePreviewLoading, setCoveragePreviewLoading] = useState(false);
  const [showEditReasonError, setShowEditReasonError] = useState(false);
  const [expandedHours, setExpandedHours] = useState(new Set());
  const [expandedPeriods, setExpandedPeriods] = useState({
    morning: true,
    afternoon: true,
  });
  const [popover, setPopover] = useState(null);
  const [openActionMenu, setOpenActionMenu] = useState(null);
  const sessionsRequestIdRef = useRef(0);
  const specialEventsRequestIdRef = useRef(0);
  const visibleRange = useMemo(() => getVisibleDateRange(view, selectedDate), [selectedDate, view]);
  const selectedMonthKey = useMemo(() => toMonthInputValue(selectedDate), [selectedDate]);
  const weekDays = useMemo(() => getWeekDays(selectedDate), [selectedDate]);

  useEffect(() => {
    const params = new URLSearchParams(routeLocation.search || "");
    const patientId = String(params.get("patient_id") || "").trim();
    const patientName = String(params.get("patient_name") || "").trim();

    if (!patientId && !patientName) return;

    if (patientId) {
      const patient = patients.find((item) => String(item.id) === patientId);
      const resolvedName = patient ? getPatientDisplayName(patient) : patientName;
      if (resolvedName) {
        setFilterPatientQuery((current) => (
          current === resolvedName ? current : resolvedName
        ));
      }
      return;
    }

    setFilterPatientQuery((current) => (
      current === patientName ? current : patientName
    ));
  }, [patients, routeLocation.search]);

  const loadBaseData = useCallback(async () => {
    setIsBaseDataLoading(true);
    try {
      const [
        patientsResponse,
        usersResponse,
        limitsResponse,
        statusResponse,
        servicesResponse,
        operationalPolicyResponse,
      ] = await reuseInFlightAgendaRequest("agenda:base-data", () => Promise.all([
        axios.get("/patients"),
        axios.get("/users", { params: { group: PROFESSIONAL_GROUP_SLUG } }),
        axios.get("/service-limits"),
        axios.get("/session-statuses"),
        axios.get("/services"),
        axios.get("/unit-scheduling-policy"),
      ]));
      setPatients(Array.isArray(patientsResponse.data) ? patientsResponse.data : []);
      setProfessionals(Array.isArray(usersResponse.data) ? usersResponse.data : []);
      setServiceLimits(Array.isArray(limitsResponse.data) ? limitsResponse.data : []);
      setStatusOptions(Array.isArray(statusResponse.data) ? statusResponse.data : []);
      setServices(Array.isArray(servicesResponse.data) ? servicesResponse.data : []);
      setOperationalPolicy({
        ...DEFAULT_OPERATIONAL_POLICY,
        ...(operationalPolicyResponse.data || {}),
      });
    } catch (error) {
      const message =
        error?.response?.data?.error ||
        "Não foi possível carregar pacientes ou profissionais.";
      toast.error(message);
    } finally {
      setIsBaseDataLoading(false);
    }
  }, []);

  const loadSessions = useCallback(
    async (fromDate, toDate) => {
      const requestId = sessionsRequestIdRef.current + 1;
      sessionsRequestIdRef.current = requestId;
      setIsLoading(true);
      try {
        const params = {};
        if (fromDate) params.from = formatDateParam(fromDate);
        if (toDate) params.to = formatDateParam(toDate);
        const response = await reuseInFlightAgendaRequest(
          `agenda:sessions:${params.from || ""}:${params.to || ""}`,
          () => axios.get("/sessions", { params }),
        );
        if (sessionsRequestIdRef.current === requestId) {
          setSessions(Array.isArray(response.data) ? response.data : []);
        }
      } catch (error) {
        if (sessionsRequestIdRef.current !== requestId) return;
        const message =
          error?.response?.data?.error || "Não foi possível carregar agendas.";
        toast.error(message);
      } finally {
        if (sessionsRequestIdRef.current === requestId) {
          setIsLoading(false);
        }
      }
    },
    [],
  );

  const loadSpecialEvents = useCallback(async (fromDate, toDate) => {
    const requestId = specialEventsRequestIdRef.current + 1;
    specialEventsRequestIdRef.current = requestId;
    try {
      const params = {};
      if (fromDate) params.from = formatDateParam(fromDate);
      if (toDate) params.to = formatDateParam(toDate);
      const response = await reuseInFlightAgendaRequest(
        `agenda:special-events:${params.from || ""}:${params.to || ""}`,
        () => listSpecialSchedulingEvents(params),
      );
      if (specialEventsRequestIdRef.current === requestId) {
        setSpecialEvents(Array.isArray(response.data) ? response.data : []);
      }
    } catch (error) {
      if (specialEventsRequestIdRef.current !== requestId) return;
      const message =
        error?.response?.data?.error || "Não foi possível carregar feriados.";
      toast.error(message);
    }
  }, []);

  const loadPendingSessions = useCallback(async () => {
    try {
      const response = await reuseInFlightAgendaRequest(
        "agenda:pending-sessions",
        () => axios.get("/sessions", {
          params: {
            status: "scheduled",
            to: new Date().toISOString(),
          },
        }),
      );
      setPendingSessionsSource(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      const message =
        error?.response?.data?.error || "Não foi possível carregar as pendências.";
      toast.error(message);
    }
  }, []);

  const reloadVisibleSessions = useCallback(
    () => loadSessions(visibleRange.sessionsFrom, visibleRange.sessionsTo),
    [loadSessions, visibleRange.sessionsFrom, visibleRange.sessionsTo],
  );

  const loadActivePlansForPatient = useCallback(async (patientId) => {
    if (!patientId) {
      setActivePlansForPatient([]);
      return;
    }
    try {
      const response = await listPatientPlans({ patient_id: patientId, status: "active" });
      setActivePlansForPatient(Array.isArray(response.data) ? response.data : []);
    } catch (_err) {
      setActivePlansForPatient([]);
    }
  }, []);

  const loadReplacementCreditsForPatient = useCallback(async (patientId) => {
    if (!patientId) {
      setReplacementCreditsForPatient([]);
      return;
    }
    try {
      const response = await axios.get("/session-replacement-credits", {
        params: { patient_id: patientId, status: "pending" },
      });
      setReplacementCreditsForPatient(Array.isArray(response.data) ? response.data : []);
    } catch (_err) {
      setReplacementCreditsForPatient([]);
    }
  }, []);

  const loadPatientCreditsForPatient = useCallback(async (patientId) => {
    if (!patientId) {
      setPatientCreditsForPatient([]);
      return;
    }
    try {
      const response = await axios.get("/patient-credits", {
        params: { patient_id: patientId },
      });
      const availableCredits = (Array.isArray(response.data) ? response.data : [])
        .filter((credit) => Number(credit.total_sessions || 0) - Number(credit.used_sessions || 0) > 0);
      setPatientCreditsForPatient(availableCredits);
    } catch (_err) {
      setPatientCreditsForPatient([]);
    }
  }, []);

  const loadOperationalAlerts = useCallback(async (month = toMonthInputValue(new Date())) => {
    setIsOperationalAlertsLoading(true);
    try {
      const response = await reuseInFlightAgendaRequest(
        `agenda:operational-alerts:${month}`,
        () => axios.get("/operational-alerts", {
          params: { month },
        }),
      );
      setOperationalAlerts(Array.isArray(response.data?.alerts) ? response.data.alerts : []);
    } catch (error) {
      setOperationalAlerts([]);
      const message =
        error?.response?.data?.error || "Não foi possível carregar alertas operacionais.";
      toast.error(message);
    } finally {
      setIsOperationalAlertsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadActivePlansForPatient(form.patient_id);
    loadReplacementCreditsForPatient(form.patient_id);
    loadPatientCreditsForPatient(form.patient_id);
  }, [
    form.patient_id,
    loadActivePlansForPatient,
    loadReplacementCreditsForPatient,
    loadPatientCreditsForPatient,
  ]);

  useEffect(() => {
    loadOperationalAlerts(selectedMonthKey);
  }, [loadOperationalAlerts, selectedMonthKey]);

  // Derived: plano elegível para cobertura mensal — considera serviço E data da sessão
  const eligiblePlan = useMemo(() => {
    if (!activePlansForPatient.length || !form.service_id || !form.starts_at) return null;
    const dateStr = String(form.starts_at).slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return null;
    return activePlansForPatient.find((p) => {
      if (String(p.ServicePlan?.service_id) !== String(form.service_id)) return false;
      if (dateStr < String(p.starts_at).slice(0, 10)) return false;
      if (p.ends_at && dateStr > String(p.ends_at).slice(0, 10)) return false;
      return true;
    }) || null;
  }, [activePlansForPatient, form.service_id, form.starts_at]);

  // Auto-seleciona billing_mode apenas em modo criação (não edição)
  useEffect(() => {
    if (editingId) return;
    if (!form.patient_id || !form.service_id || !form.starts_at) return;
    setForm((prev) => ({
      ...prev,
      billing_mode: eligiblePlan ? "covered_by_plan" : "per_session",
    }));
  }, [eligiblePlan, editingId, form.patient_id, form.service_id, form.starts_at]);

  const canUsePlanRepeatMode =
    !!eligiblePlan && form.billing_mode === "covered_by_plan";

  useEffect(() => {
    if (repeatMode === "plan" && !canUsePlanRepeatMode) {
      setRepeatMode("count");
    }
  }, [canUsePlanRepeatMode, repeatMode]);

  // Prévias de cobertura — só em criação e quando billing_mode é covered_by_plan
  useEffect(() => {
    let cancelled = false;
    const dateStr = String(form.starts_at || "").slice(0, 10);
    const ready = !editingId && form.patient_id && form.service_id && /^\d{4}-\d{2}-\d{2}$/.test(dateStr);
    if (ready && form.billing_mode === "covered_by_plan") {
      setCoveragePreviewLoading(true);
      getCoveragePreview({ patient_id: form.patient_id, service_id: form.service_id, date: dateStr })
        .then((res) => { if (!cancelled) setCoveragePreview(res.data); })
        .catch(() => { if (!cancelled) setCoveragePreview(null); })
        .finally(() => { if (!cancelled) setCoveragePreviewLoading(false); });
    } else {
      setCoveragePreview(null);
    }
    return () => { cancelled = true; };
  }, [form.patient_id, form.service_id, form.starts_at, form.billing_mode, editingId]);

  useEffect(() => {
    loadBaseData();
  }, [loadBaseData]);

  useEffect(() => {
    loadPendingSessions();
  }, [loadPendingSessions]);

  useEffect(() => {
    loadSessions(visibleRange.sessionsFrom, visibleRange.sessionsTo);
    loadSpecialEvents(visibleRange.specialEventsFrom, visibleRange.specialEventsTo);
  }, [loadSessions, loadSpecialEvents, visibleRange]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setCurrentTime(Date.now());
    }, 60000);

    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    if (!openActionMenu) return undefined;
    const handler = () => setOpenActionMenu(null);
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, [openActionMenu]);

  const toggleExpandedHour = useCallback((hour) => {
    setExpandedHours((prev) => {
      const next = new Set(prev);
      if (next.has(hour)) next.delete(hour);
      else next.add(hour);
      return next;
    });
  }, []);

  const toggleExpandedPeriod = useCallback((periodKey) => {
    setExpandedPeriods((prev) => ({
      ...prev,
      [periodKey]: !prev[periodKey],
    }));
  }, []);

  const patientOptions = useMemo(
    () =>
      patients.map((patient) => ({
        ...patient,
        id: patient.id,
        name: getPatientName(patient),
      })),
    [patients],
  );

  const patientDirectory = useMemo(
    () =>
      new Map(
        patients.map((patient) => [String(patient.id), patient]),
      ),
    [patients],
  );

  const getSessionPatientName = useCallback(
    (session) => getPatientDisplayName(session),
    [],
  );

  const getSessionPatientAttentionLevel = useCallback(
    (session) => {
      const directLevel = normalizeAttentionLevel(session?.Patient?.attention_level);
      if (directLevel) return directLevel;

      const fallbackPatient = patientDirectory.get(
        String(session?.patient_id || session?.Patient?.id || ""),
      );
      return normalizeAttentionLevel(fallbackPatient?.attention_level);
    },
    [patientDirectory],
  );

  const handleSelectPatient = useCallback((patient) => {
    setForm((prev) => ({ ...prev, patient_id: String(patient.id) }));
    setFormPatientQuery(getPatientName(patient));
  }, []);

  const professionalOptions = useMemo(
    () =>
      professionals.map((professional) => ({
        id: professional.id,
        name: professional.name || professional.email || "Profissional",
      })),
    [professionals],
  );

  const serviceOptions = useMemo(
    () =>
      services
        .filter((service) => service.is_active !== false)
        .map((service) => ({
          id: service.id,
          code: service.code,
          name: service.name,
          color: service.color,
          duration: service.default_duration_minutes,
        }))
        .sort((serviceA, serviceB) =>
          String(serviceA.name || "").localeCompare(String(serviceB.name || ""), "pt-BR", {
            sensitivity: "base",
          }),
        ),
    [services],
  );

  const allServiceOptions = useMemo(
    () => serviceOptions,
    [serviceOptions],
  );

  const serviceOrderMap = useMemo(() => {
    const map = new Map();
    allServiceOptions.forEach((service, index) => {
      if (service?.code) map.set(service.code, index);
    });
    return map;
  }, [allServiceOptions]);

  const servicesByCode = useMemo(() => {
    const map = new Map();
    services.forEach((service) => {
      if (service?.code) map.set(service.code, service);
    });
    return map;
  }, [services]);

  const servicesById = useMemo(() => {
    const map = new Map();
    services.forEach((service) => {
      if (service?.id) {
        map.set(service.id, service);
        map.set(String(service.id), service);
      }
    });
    return map;
  }, [services]);

  const serviceLimitMap = useMemo(() => {
    const map = new Map();
    serviceLimits.forEach((limit) => {
      if (limit?.service_id) map.set(`id:${limit.service_id}`, limit.max_patients);
      if (limit?.service_type) map.set(`code:${limit.service_type}`, limit.max_patients);
    });
    return map;
  }, [serviceLimits]);

  const serviceName = useCallback(
    (value) => {
      if (!value) return "N/A";
      const service = servicesByCode.get(value);
      if (service?.name) return service.name;
      if (value === "fisioterapia") return "Fisioterapia";
      if (value === "pilates") return "Pilates";
      if (value === "funcional") return "Funcional";
      if (value === "outro") return "Outro";
      return value;
    },
    [servicesByCode],
  );

  const serviceColor = useCallback(
    (value) => servicesByCode.get(value)?.color || null,
    [servicesByCode],
  );

  const getSessionService = useCallback(
    (session) => (
      (session?.service_id && servicesById.get(session.service_id)) ||
      (session?.service_id && servicesById.get(String(session.service_id))) ||
      session?.Service ||
      (session?.service_type && servicesByCode.get(session.service_type)) ||
      null
    ),
    [servicesByCode, servicesById],
  );

  const getSessionServiceCode = useCallback(
    (session) => getSessionService(session)?.code || session?.service_type || "outro",
    [getSessionService],
  );

  const compareServiceGroups = useCallback(
    (first, second) => {
      const firstCode = first.serviceCode || first.service_type || first.service?.code || "";
      const secondCode = second.serviceCode || second.service_type || second.service?.code || "";
      const firstOrder = serviceOrderMap.has(firstCode) ? serviceOrderMap.get(firstCode) : Number.MAX_SAFE_INTEGER;
      const secondOrder = serviceOrderMap.has(secondCode) ? serviceOrderMap.get(secondCode) : Number.MAX_SAFE_INTEGER;
      if (firstOrder !== secondOrder) return firstOrder - secondOrder;
      const firstLabel = first.serviceLabel || serviceName(firstCode);
      const secondLabel = second.serviceLabel || serviceName(secondCode);
      const labelCompare = firstLabel.localeCompare(secondLabel, "pt-BR", { sensitivity: "base" });
      if (labelCompare !== 0) return labelCompare;
      return firstCode.localeCompare(secondCode, "pt-BR", { sensitivity: "base" });
    },
    [serviceName, serviceOrderMap],
  );

  const compareSessionsByPatientThenId = useCallback((first, second) => {
    const patientCompare = getPatientDisplayName(first).localeCompare(
      getPatientDisplayName(second),
      "pt-BR",
      { sensitivity: "base" },
    );
    if (patientCompare !== 0) return patientCompare;
    return Number(first?.id || 0) - Number(second?.id || 0);
  }, []);

  const getMonthlyPlanSummary = useCallback(
    (session) => getSessionPlanSummary(session, serviceName),
    [serviceName],
  );

  const statusStyle = useCallback((status) => getSessionStatusTone(status), []);

  const buildDeleteCandidates = useCallback(
    (sourceSession, mode) => {
      if (!sourceSession?.id) return [];
      const sourcePool = pendingSessionsSource.length > 0 ? pendingSessionsSource : sessions;
      const targetSession =
        sourcePool.find((item) => String(item.id) === String(sourceSession.id)) || sourceSession;

      if (mode !== "series") {
        return targetSession ? [targetSession] : [];
      }

      const seriesId = resolveSeriesId(targetSession);
      if (!seriesId) {
        return targetSession ? [targetSession] : [];
      }

      const targetStart = targetSession?.starts_at ? new Date(targetSession.starts_at) : null;
      const targetTime =
        targetStart && !Number.isNaN(targetStart.getTime()) ? targetStart.getTime() : null;

      const candidates = sourcePool
        .filter((item) => String(resolveSeriesId(item)) === String(seriesId))
        .filter((item) => {
          if (targetTime === null) return true;
          const startsAt = item?.starts_at ? new Date(item.starts_at) : null;
          if (!startsAt || Number.isNaN(startsAt.getTime())) return false;
          return startsAt.getTime() >= targetTime;
        })
        .sort((first, second) => {
          const firstTime = first?.starts_at ? new Date(first.starts_at).getTime() : 0;
          const secondTime = second?.starts_at ? new Date(second.starts_at).getTime() : 0;
          if (firstTime !== secondTime) return firstTime - secondTime;
          return Number(first.id) - Number(second.id);
        });

      if (candidates.length > 0) return candidates;
      if (targetSession) return [targetSession];
      return [];
    },
    [pendingSessionsSource, sessions],
  );

  const getSessionEndDate = useCallback(
    (session) => {
      if (session?.ends_at) {
        const endsAt = new Date(session.ends_at);
        if (!Number.isNaN(endsAt.getTime())) return endsAt;
      }
      if (!session?.starts_at) return null;
      const startsAt = new Date(session.starts_at);
      if (Number.isNaN(startsAt.getTime())) return null;
      const service =
        (session.service_id && servicesById.get(session.service_id)) ||
        (session.service_type && servicesByCode.get(session.service_type)) ||
        session.Service ||
        null;
      const durationMinutes = Number(service?.default_duration_minutes) || 60;
      return new Date(startsAt.getTime() + durationMinutes * 60000);
    },
    [servicesByCode, servicesById],
  );

  const needsAttendanceConfirmation = useCallback(
    (session) => {
      if (!isScheduledStatus(session?.status)) return false;
      const endsAt = getSessionEndDate(session);
      if (!endsAt) return false;
      const toleranceMs = ATTENDANCE_CONFIRMATION_TOLERANCE_MINUTES * 60000;
      return currentTime >= endsAt.getTime() + toleranceMs;
    },
    [currentTime, getSessionEndDate],
  );

  const filteredSessions = useMemo(() => {
    const patientSearch = normalizeSearchText(filterPatientQuery);
    return sessions.filter((session) => {
      if (filters.status && session.status !== filters.status) return false;
      if (filters.service_type) {
        const sessionCode = getSessionServiceCode(session);
        if (sessionCode !== filters.service_type) return false;
      }
      if (patientSearch) {
        const patient = session?.Patient || patientDirectory.get(String(session?.patient_id || ""));
        if (!getPatientSearchText(patient).includes(patientSearch)) return false;
      }
      return true;
    });
  }, [filterPatientQuery, filters, getSessionServiceCode, patientDirectory, sessions]);

  const sessionsByDay = useMemo(() => {
    const map = new Map();
    filteredSessions.forEach((session) => {
      const date = session.starts_at ? new Date(session.starts_at) : null;
      if (!date || Number.isNaN(date.getTime())) return;
      const key = startOfDay(date).toISOString();
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(session);
    });
    return map;
  }, [filteredSessions]);

  const weekFilteredSessions = useMemo(() => {
    return filteredSessions.filter(
      (session) => !WEEK_HIDDEN_HISTORY_STATUSES.has(String(session.status || "")),
    );
  }, [filteredSessions]);

  const weekSessionsByDay = useMemo(() => {
    const map = new Map();
    weekFilteredSessions.forEach((session) => {
      const date = session.starts_at ? new Date(session.starts_at) : null;
      if (!date || Number.isNaN(date.getTime())) return;
      const key = startOfDay(date).toISOString();
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(session);
    });
    return map;
  }, [weekFilteredSessions]);

  const specialEventsByDay = useMemo(() => {
    const map = new Map();
    specialEvents.forEach((event) => {
      if (!event?.start_date || !event?.end_date) return;
      const startDate = new Date(`${event.start_date}T00:00:00`);
      const endDate = new Date(`${event.end_date}T00:00:00`);
      if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return;
      if (startDate > endDate) return;

      const severity = eventSeverity(event);
      const cursor = new Date(startDate);
      while (cursor <= endDate) {
        const key = startOfDay(cursor).toISOString();
        if (!map.has(key)) {
          map.set(key, { events: [], severity: "info" });
        }
        const base = map.get(key);
        base.events.push({ ...event, severity });
        if (severityWeight(severity) > severityWeight(base.severity)) {
          base.severity = severity;
        }
        cursor.setDate(cursor.getDate() + 1);
      }
    });
    return map;
  }, [specialEvents]);

  const daySessions = useMemo(() => {
    const key = startOfDay(selectedDate).toISOString();
    return sessionsByDay.get(key) || [];
  }, [selectedDate, sessionsByDay]);

  const daySessionGroups = useMemo(() => {
    const timeMap = new Map();

    daySessions.forEach((session) => {
      if (!session?.starts_at) return;
      const startsAt = new Date(session.starts_at);
      if (Number.isNaN(startsAt.getTime())) return;

      const minutes = startsAt.getHours() * 60 + startsAt.getMinutes();
      const timeKey = `${String(startsAt.getHours()).padStart(2, "0")}:${String(
        startsAt.getMinutes(),
      ).padStart(2, "0")}`;

      if (!timeMap.has(timeKey)) {
        timeMap.set(timeKey, {
          key: timeKey,
          label: startsAt.toLocaleTimeString("pt-BR", {
            hour: "2-digit",
            minute: "2-digit",
          }),
          sortMinutes: minutes,
          serviceMap: new Map(),
        });
      }

      const timeGroup = timeMap.get(timeKey);

      const serviceCode = getSessionServiceCode(session);
      const professionalName = session?.professional?.name || "Profissional";
      const serviceKey = `service-${serviceCode}`;
      if (!timeGroup.serviceMap.has(serviceKey)) {
        timeGroup.serviceMap.set(serviceKey, {
          key: serviceKey,
          serviceCode,
          serviceLabel: serviceName(serviceCode),
          serviceColor: serviceColor(serviceCode),
          cards: [],
        });
      }
      timeGroup.serviceMap.get(serviceKey).cards.push({
        key: `${session.id}-${timeKey}`,
        session,
        professionalName,
        serviceCode,
        serviceLabel: serviceName(serviceCode),
        serviceColor: serviceColor(serviceCode),
      });
    });

    return Array.from(timeMap.values())
      .map((timeGroup) => ({
        key: timeGroup.key,
        label: timeGroup.label,
        sortMinutes: timeGroup.sortMinutes,
	          serviceGroups: Array.from(timeGroup.serviceMap.values())
	          .map((serviceGroup) => {
	            const cards = serviceGroup.cards.sort((first, second) => {
	              const firstHistorical = isHistoricalSessionStatus(first.session?.status);
	              const secondHistorical = isHistoricalSessionStatus(second.session?.status);
	              if (firstHistorical !== secondHistorical) return firstHistorical ? 1 : -1;
	              const professionalCompare = String(first.professionalName || "").localeCompare(
	                String(second.professionalName || ""),
	                "pt-BR",
	                { sensitivity: "base" },
	              );
              if (professionalCompare !== 0) return professionalCompare;
              return compareSessionsByPatientThenId(first.session, second.session);
            });
            return {
              ...serviceGroup,
              cards,
            };
          })
          .sort(compareServiceGroups),
      }))
      .sort((first, second) => first.sortMinutes - second.sortMinutes);
  }, [compareServiceGroups, compareSessionsByPatientThenId, daySessions, getSessionServiceCode, serviceColor, serviceName]);

  const selectedDaySpecialEvents = useMemo(() => {
    const key = startOfDay(selectedDate).toISOString();
    return specialEventsByDay.get(key)?.events || [];
  }, [selectedDate, specialEventsByDay]);

  const selectedDaySpecialSummary = useMemo(() => {
    const key = startOfDay(selectedDate).toISOString();
    return specialEventsByDay.get(key) || null;
  }, [selectedDate, specialEventsByDay]);

  const formLocalSpecialSummary = useMemo(() => {
    if (!form.starts_at) return null;
    const date = new Date(form.starts_at);
    if (Number.isNaN(date.getTime())) return null;
    const key = startOfDay(date).toISOString();
    return specialEventsByDay.get(key) || null;
  }, [form.starts_at, specialEventsByDay]);

  const pendingConfirmationSessions = useMemo(() => {
    const queue = pendingSessionsSource.filter((session) =>
      needsAttendanceConfirmation(session),
    );

    return queue.sort((first, second) => {
      const firstDate = getSessionEndDate(first)?.getTime() || 0;
      const secondDate = getSessionEndDate(second)?.getTime() || 0;
      return firstDate - secondDate;
    });
  }, [getSessionEndDate, needsAttendanceConfirmation, pendingSessionsSource]);

  const pendingConfirmationGroups = useMemo(() => {
    const groups = [];
    const dayMap = new Map();

    pendingConfirmationSessions.forEach((session) => {
      const startsAt = session?.starts_at ? new Date(session.starts_at) : null;
      if (!startsAt || Number.isNaN(startsAt.getTime())) return;

      const dayDate = startOfDay(startsAt);
      const dayKey = dayDate.toISOString();
      const minutes = startsAt.getHours() * 60 + startsAt.getMinutes();
      const timeKey = `${dayKey}-${minutes}`;
      const serviceCode = getSessionServiceCode(session);
      const professionalName = session?.professional?.name || "Profissional";
      const serviceKey = `${timeKey}-${serviceCode}-${professionalName}`;

      if (!dayMap.has(dayKey)) {
        const group = {
          key: dayKey,
          date: dayDate,
          sessionCount: 0,
          timeGroups: [],
          timeMap: new Map(),
        };
        dayMap.set(dayKey, group);
        groups.push(group);
      }

      const dayGroup = dayMap.get(dayKey);
      dayGroup.sessionCount += 1;

      if (!dayGroup.timeMap.has(timeKey)) {
        const timeGroup = {
          key: timeKey,
          startsAt,
          sortMinutes: minutes,
          sessionCount: 0,
          serviceGroups: [],
          serviceMap: new Map(),
        };
        dayGroup.timeMap.set(timeKey, timeGroup);
        dayGroup.timeGroups.push(timeGroup);
      }

      const timeGroup = dayGroup.timeMap.get(timeKey);
      timeGroup.sessionCount += 1;

      if (!timeGroup.serviceMap.has(serviceKey)) {
        const groupedService = {
          key: serviceKey,
          serviceCode,
          serviceLabel: serviceName(serviceCode),
          serviceColor: serviceColor(serviceCode),
          professionalName,
          sessions: [],
        };
        timeGroup.serviceMap.set(serviceKey, groupedService);
        timeGroup.serviceGroups.push(groupedService);
      }

      timeGroup.serviceMap.get(serviceKey).sessions.push(session);
    });

    return groups.map((group) => ({
      key: group.key,
      date: group.date,
      sessionCount: group.sessionCount,
      timeGroups: group.timeGroups
        .map((timeGroup) => ({
          key: timeGroup.key,
          startsAt: timeGroup.startsAt,
          sessionCount: timeGroup.sessionCount,
          sortMinutes: timeGroup.sortMinutes,
          serviceGroups: timeGroup.serviceGroups
            .map((serviceGroup) => ({
              ...serviceGroup,
              sessions: serviceGroup.sessions.sort(compareSessionsByPatientThenId),
            }))
            .sort(compareServiceGroups),
        }))
        .sort((first, second) => first.sortMinutes - second.sortMinutes),
    }));
  }, [compareServiceGroups, compareSessionsByPatientThenId, getSessionServiceCode, pendingConfirmationSessions, serviceColor, serviceName]);

  const visibleOperationalAlerts = useMemo(
    () => [...operationalAlerts]
      .sort((a, b) => (
        (OPERATIONAL_ALERT_SEVERITY_ORDER[a.severity] ?? 9)
        - (OPERATIONAL_ALERT_SEVERITY_ORDER[b.severity] ?? 9)
      )),
    [operationalAlerts],
  );

  const operationalAlertGroups = useMemo(() => {
    const groupMap = new Map();

    visibleOperationalAlerts.forEach((alert, index) => {
      const category = getOperationalAlertCategory(alert);
      if (!groupMap.has(category)) {
        groupMap.set(category, {
          key: category,
          section: getOperationalAlertSection(category),
          label: PENDING_CENTER_CATEGORY_LABELS[category] || PENDING_CENTER_CATEGORY_LABELS.other,
          alerts: [],
        });
      }

      groupMap.get(category).alerts.push({
        ...alert,
        centerKey: `${alert.type}-${alert.patient_id || "sem-paciente"}-${alert.details?.audit_log_id || alert.details?.replacement_credit_id || index}`,
      });
    });

    return Array.from(groupMap.values()).sort((first, second) => {
      const sectionDiff =
        PENDING_CENTER_SECTION_ORDER[first.section] - PENDING_CENTER_SECTION_ORDER[second.section];
      if (sectionDiff !== 0) return sectionDiff;
      return first.label.localeCompare(second.label, "pt-BR", { sensitivity: "base" });
    });
  }, [visibleOperationalAlerts]);

  const pendingCenterSections = useMemo(() => {
    const operationalGroupMap = new Map(
      operationalAlertGroups.map((group) => [group.key, group]),
    );
    const fixedCategoryKeys = new Set();

    const getOperationalItemCount = (key, alerts = []) => {
      if (key === "standalone_session_credit_expiring") {
        return countStandaloneCreditItems(alerts);
      }
      if (isPlanOperationalAlert(key)) {
        return countPlanAlertItems(alerts);
      }
      if (key === "patient_birthday") {
        return countBirthdayAlertItems(alerts);
      }
      return alerts.length;
    };

    const sections = PENDING_CENTER_MAIN_SECTIONS.map((section) => ({
      key: section.key,
      label: PENDING_CENTER_SECTION_LABELS[section.key],
      items: section.items.map((item) => {
        fixedCategoryKeys.add(item.key);
        if (item.kind === "attendance") {
          return {
            ...item,
            count: pendingConfirmationSessions.length,
          };
        }

        const group = operationalGroupMap.get(item.key);
        const alerts = group?.alerts || [];
        return {
          ...item,
          count: getOperationalItemCount(item.key, alerts),
          alerts,
        };
      }),
    }));

    operationalAlertGroups.forEach((group) => {
      if (fixedCategoryKeys.has(group.key)) return;
      if (group.key === "other") return;
      const targetSection = sections.find((section) => section.key === group.section);
      if (!targetSection) return;
      targetSection.items.push({
        key: group.key,
        kind: "operational-alert",
        label: group.label,
        count: getOperationalItemCount(group.key, group.alerts),
        alerts: group.alerts,
      });
    });

    return sections;
  }, [operationalAlertGroups, pendingConfirmationSessions.length]);

  const pendingCenterTotal = pendingCenterSections.reduce(
    (sectionTotal, section) =>
      sectionTotal + section.items.reduce((itemTotal, item) => itemTotal + item.count, 0),
    0,
  );

  const pendingCenterSelectedItem = useMemo(() => {
    if (!pendingCenterSelectedItemKey) return null;
    return pendingCenterSections
      .flatMap((section) => section.items)
      .find((item) => item.key === pendingCenterSelectedItemKey) || null;
  }, [pendingCenterSections, pendingCenterSelectedItemKey]);

  const buildSlotGroupsForDayHour = useCallback(
    (dayList, hour) => {
      const groups = new Map();
      dayList.forEach((session) => {
        if (!session.starts_at) return;
        const sessionDate = new Date(session.starts_at);
        if (Number.isNaN(sessionDate.getTime())) return;
        if (sessionDate.getHours() !== hour) return;
        const service =
          (session.service_id && servicesById.get(session.service_id)) ||
          (session.service_type && servicesByCode.get(session.service_type)) ||
          null;
        const type = service?.code || session.service_type || "outro";
        if (!groups.has(type)) {
          groups.set(type, { service, sessions: [] });
        }
	        groups.get(type).sessions.push(session);
	      });
	      return Array.from(groups.entries()).map(([type, bucket]) => {
	        const items = [...bucket.sessions].sort((first, second) => {
	          const firstHistorical = isHistoricalSessionStatus(first?.status);
	          const secondHistorical = isHistoricalSessionStatus(second?.status);
	          if (firstHistorical !== secondHistorical) return firstHistorical ? 1 : -1;
	          return compareSessionsByPatientThenId(first, second);
	        });
        const activeSessions = items.filter((item) => !isHistoricalSessionStatus(item.status));
        const historicalSessions = items.filter((item) => isHistoricalSessionStatus(item.status));
        const limitById =
          bucket.service?.id !== undefined
            ? serviceLimitMap.get(`id:${bucket.service.id}`)
            : undefined;
        const limitByCode = serviceLimitMap.get(`code:${type}`);
        return ({
          service_type: type,
	          service: bucket.service,
	          sessions: items,
	          activeSessions,
	          historicalSessions,
	          count: activeSessions.length,
          total: items.length,
          limit: limitById ?? limitByCode,
        });
      }).sort(compareServiceGroups);
    },
    [
      compareServiceGroups,
      compareSessionsByPatientThenId,
      serviceLimitMap,
      servicesByCode,
      servicesById,
    ],
  );

  const weekSlotGroupsByKey = useMemo(() => {
    const map = new Map();
    weekDays.forEach((day) => {
      const dayKey = startOfDay(day).toISOString();
      const dayList = weekSessionsByDay.get(dayKey) || [];
      for (let hour = START_HOUR; hour <= END_HOUR; hour += 1) {
        map.set(`${dayKey}-${hour}`, buildSlotGroupsForDayHour(dayList, hour));
      }
    });
    return map;
  }, [buildSlotGroupsForDayHour, weekDays, weekSessionsByDay]);

  const getSlotGroups = useCallback(
    (day, hour) => {
      const key = startOfDay(day).toISOString();
      const precomputed = weekSlotGroupsByKey.get(`${key}-${hour}`);
      if (precomputed) return precomputed;
      return buildSlotGroupsForDayHour(weekSessionsByDay.get(key) || [], hour);
    },
    [buildSlotGroupsForDayHour, weekSessionsByDay, weekSlotGroupsByKey],
  );

  const groupSessions = useMemo(() => {
    if (!groupContext?.date) return [];
    const hour = groupContext.date.getHours();
    return getSlotGroups(groupContext.date, hour);
  }, [getSlotGroups, groupContext]);

  const handleFormChange = useCallback((event) => {
    const { name, type, value, checked } = event.target;
    if (name === "notes" && editingId && showEditReasonError && value.trim()) {
      setShowEditReasonError(false);
    }
    setForm((prev) => ({ ...prev, [name]: type === "checkbox" ? checked : value }));
  }, [editingId, showEditReasonError]);

  const updateStartDateTime = useCallback((dateValue, hourValue) => {
    const nextStartsAt = buildDateHourInputValue(dateValue, hourValue);
    if (!nextStartsAt) {
      setForm((prev) => ({ ...prev, starts_at: "", ends_at: "" }));
      return;
    }
    const startDate = new Date(nextStartsAt);
    if (Number.isNaN(startDate.getTime())) {
      setForm((prev) => ({ ...prev, starts_at: nextStartsAt, ends_at: "" }));
      return;
    }
    const nextEndsAt = new Date(startDate);
    nextEndsAt.setHours(nextEndsAt.getHours() + 1);
    setForm((prev) => ({
      ...prev,
      starts_at: nextStartsAt,
      ends_at: toInputValue(nextEndsAt),
    }));
    if (repeatEnabled && repeatWeekdays.length === 0) {
      const weekday = toSelectableWeekday(startDate);
      if (weekday) setRepeatWeekdays([weekday]);
    }
  }, [repeatEnabled, repeatWeekdays.length]);

  const handleStartDateChange = useCallback((event) => {
    const dateValue = event.target.value;
    const hourValue = getHourInputValue(form.starts_at) || String(START_HOUR).padStart(2, "0");
    updateStartDateTime(dateValue, hourValue);
  }, [form.starts_at, updateStartDateTime]);

  const handleStartHourChange = useCallback((event) => {
    const hourValue = event.target.value;
    const dateValue = toDateInputValue(form.starts_at) || toDateInputValue(selectedDate);
    updateStartDateTime(dateValue, hourValue);
  }, [form.starts_at, selectedDate, updateStartDateTime]);

  useEffect(() => {
    if (!isDrawerOpen || drawerMode !== "form") {
      setFormAvailability(null);
      return undefined;
    }

    if (!form.starts_at) {
      setFormAvailability(null);
      return undefined;
    }

    const startsAtDate = new Date(form.starts_at);
    if (Number.isNaN(startsAtDate.getTime())) {
      setFormAvailability(null);
      return undefined;
    }

    let cancelled = false;
    const timerId = window.setTimeout(async () => {
      try {
        const response = await checkSchedulingAvailability({
          starts_at: form.starts_at,
          ends_at: form.ends_at || null,
          professional_user_id: form.professional_user_id
            ? Number(form.professional_user_id)
            : null,
          service_id: form.service_id ? Number(form.service_id) : null,
          service_type: form.service_type || null,
        });
        if (!cancelled) {
          setFormAvailability(response?.data || null);
        }
      } catch (error) {
        if (!cancelled) {
          setFormAvailability({
            error: getUserFacingApiError(
              error,
              "Não foi possível validar a disponibilidade desta data.",
            ),
            matched_events: [],
          });
        }
      } finally {
        // noop
      }
    }, 280);

    return () => {
      cancelled = true;
      window.clearTimeout(timerId);
    };
  }, [
    drawerMode,
    form.ends_at,
    form.professional_user_id,
    form.service_id,
    form.service_type,
    form.starts_at,
    isDrawerOpen,
  ]);

  const closeRecurrencePreview = useCallback(() => {
    setRecurrencePreview(null);
  }, []);

  const handleTogglePreviewOccurrence = useCallback((occurrence) => {
    if (!occurrence?.index) return;
    setRecurrencePreview((previous) => {
      if (!previous) return previous;
      const { index } = occurrence;
      const isSelected = previous.selected_indexes.includes(index);
      const selectedIndexes = isSelected
        ? previous.selected_indexes.filter((item) => item !== index)
        : [...previous.selected_indexes, index].sort((a, b) => a - b);

      let confirmWarningIndexes = previous.confirm_warning_indexes.filter(
        (item) => item !== index,
      );
      let forceOverrideIndexes = previous.force_override_indexes.filter(
        (item) => item !== index,
      );

      if (!isSelected && occurrence.status === "WARN_CONFIRM") {
        confirmWarningIndexes = [...confirmWarningIndexes, index].sort((a, b) => a - b);
      }
      if (
        !isSelected &&
        occurrence.status === "BLOCK" &&
        occurrence.can_override_block
      ) {
        forceOverrideIndexes = [...forceOverrideIndexes, index].sort((a, b) => a - b);
      }

      return {
        ...previous,
        selected_indexes: selectedIndexes,
        confirm_warning_indexes: confirmWarningIndexes,
        force_override_indexes: forceOverrideIndexes,
      };
    });
  }, []);

  const handleStartEditPreviewOccurrence = useCallback((occurrence) => {
    if (!occurrence?.index) return;
    setRecurrencePreview((previous) => {
      if (!previous) return previous;
      return {
        ...previous,
        editing_index: occurrence.index,
        edit_date: toDateInputValue(occurrence.starts_at || occurrence.date),
        edit_time: getOccurrenceTimeValue(occurrence),
        edit_error: "",
      };
    });
  }, []);

  const handleCancelEditPreviewOccurrence = useCallback(() => {
    setRecurrencePreview((previous) => {
      if (!previous) return previous;
      return {
        ...previous,
        editing_index: null,
        edit_date: "",
        edit_time: "",
        edit_error: "",
      };
    });
  }, []);

  const handleSaveEditPreviewOccurrence = useCallback(async (occurrence) => {
    if (!occurrence?.index || !recurrencePreview) return;

    const editedTimes = buildEditedOccurrenceTimes(
      occurrence,
      recurrencePreview.edit_date,
      recurrencePreview.edit_time,
    );

    if (!editedTimes) {
      setRecurrencePreview((previous) =>
        previous
          ? {
            ...previous,
            edit_error: "Informe data e horário válidos.",
          }
          : previous);
      return;
    }

    const draftOccurrences = recurrencePreview.occurrences.map((item) =>
      item.index === occurrence.index
        ? {
          ...item,
          ...editedTimes,
          manually_edited: true,
        }
        : item);
    const sortedDraftOccurrences = sortOccurrencesByDateTime(draftOccurrences);

    setRecurrencePreview((previous) =>
      previous
        ? {
          ...previous,
          is_editing_occurrence: true,
          edit_error: "",
        }
        : previous);

    try {
      const response = await previewSchedulingOccurrences({
        ...recurrencePreview.series_payload,
        occurrences: sortedDraftOccurrences.map((item) =>
          toOccurrencePreviewPayload(item, recurrencePreview.series_payload)),
      });
      const nextOccurrences = Array.isArray(response?.data?.occurrences_preview)
        ? response.data.occurrences_preview.map((item, index) => ({
          ...item,
          manually_edited: !!sortedDraftOccurrences[index]?.manually_edited,
        }))
        : [];
      const validIndexes = new Set(nextOccurrences.map((item) => item.index));
      const previousSelectedSet = new Set(recurrencePreview.selected_indexes || []);
      const selectedByStartsAt = new Set(
        recurrencePreview.occurrences
          .filter((item) => previousSelectedSet.has(item.index))
          .map((item) => item.index === occurrence.index ? editedTimes.starts_at : item.starts_at),
      );
      const selectedIndexes = nextOccurrences
        .filter((item) => {
          if (!selectedByStartsAt.has(item.starts_at)) return false;
          if (item.status === "BLOCK" && !item.can_override_block) return false;
          return validIndexes.has(item.index);
        })
        .map((item) => item.index);
      const confirmWarningIndexes = nextOccurrences
        .filter((item) => selectedIndexes.includes(item.index) && item.status === "WARN_CONFIRM")
        .map((item) => item.index);
      const forceOverrideIndexes = nextOccurrences
        .filter(
          (item) =>
            selectedIndexes.includes(item.index) &&
            item.status === "BLOCK" &&
            item.can_override_block,
        )
        .map((item) => item.index);

      setRecurrencePreview((previous) =>
        previous
          ? {
            ...previous,
            occurrences: nextOccurrences,
            summary: response?.data?.summary || previous.summary,
            selected_indexes: selectedIndexes,
            confirm_warning_indexes: confirmWarningIndexes,
            force_override_indexes: forceOverrideIndexes,
            editing_index: null,
            edit_date: "",
            edit_time: "",
            edit_error: "",
            is_editing_occurrence: false,
          }
          : previous);
    } catch (error) {
      setRecurrencePreview((previous) =>
        previous
          ? {
            ...previous,
            edit_error:
              error?.response?.data?.error ||
              "Não foi possível recalcular esta ocorrência.",
            is_editing_occurrence: false,
          }
          : previous);
    }
  }, [recurrencePreview]);

  const handleFilterChange = useCallback((event) => {
    const { name, value } = event.target;
    setFilters((prev) => ({ ...prev, [name]: value }));
  }, []);

  const handleServiceFilterChange = useCallback((serviceType) => {
    setFilters((prev) => ({
      ...prev,
      service_type: prev.service_type === serviceType ? "" : serviceType,
    }));
  }, []);

  const handleToggleWeekday = useCallback((value) => {
    setRepeatWeekdays((prev) => {
      if (prev.includes(value)) {
        return prev.filter((item) => item !== value);
      }
      return [...prev, value].sort((a, b) => a - b);
    });
  }, []);

  const openDrawer = useCallback(() => {
    setDrawerMode("form");
    setPendingCenterSelectedItemKey(null);
    setGroupContext(null);
    setShowEditReasonError(false);
    setIsDrawerOpen(true);
  }, []);

  const togglePendingDrawer = useCallback(() => {
    if (isDrawerOpen && drawerMode === "pending") {
      setIsDrawerOpen(false);
      return;
    }

    setDrawerMode("pending");
    setPendingCenterSelectedItemKey(null);
    setGroupContext(null);
    setIsDrawerOpen(true);
  }, [drawerMode, isDrawerOpen]);

  const closeDrawer = useCallback(() => {
    setIsDrawerOpen(false);
  }, []);

  const resetForm = useCallback(() => {
    setEditingId(null);
    setEditingIntent("create");
    setForm(emptyForm);
    setFormPatientQuery("");
    setReplacementCreditsForPatient([]);
    setPatientCreditsForPatient([]);
    setRepeatEnabled(false);
    setRepeatWeekdays([]);
    setRepeatMode("count");
    setRepeatCount("10");
    setRepeatWeeks("4");
    setFormAvailability(null);
    setRecurrencePreview(null);
    setShowEditReasonError(false);
  }, []);

  const handleConfirmRecurrenceCreation = useCallback(async () => {
    if (!recurrencePreview?.series_payload) return;

    const selectedOccurrences = sortOccurrencesByDateTime(
      (recurrencePreview.occurrences || []).filter((occurrence) =>
        (recurrencePreview.selected_indexes || []).includes(occurrence.index)),
    );
    if (selectedOccurrences.length === 0) {
      toast.error("Selecione ao menos uma ocorrencia para criar.");
      return;
    }

    const selectedIndexPositionMap = new Map(
      selectedOccurrences.map((occurrence, index) => [occurrence.index, index + 1]),
    );
    const selectedIndexes = selectedOccurrences.map((_, index) => index + 1);
    const confirmWarningIndexes = (recurrencePreview.confirm_warning_indexes || [])
      .map((index) => selectedIndexPositionMap.get(index))
      .filter(Boolean);
    const forceOverrideIndexes = (recurrencePreview.force_override_indexes || [])
      .map((index) => selectedIndexPositionMap.get(index))
      .filter(Boolean);
    const requiresOverrideReason = forceOverrideIndexes.length > 0;
    const overrideReason = (recurrencePreview.override_reason || "").trim();

    if (requiresOverrideReason && !overrideReason) {
      toast.error("Informe o motivo para override em ocorrencias bloqueadas.");
      return;
    }

    setRecurrencePreview((previous) =>
      previous ? { ...previous, is_submitting: true } : previous,
    );

    try {
      const response = await axios.post("/session-series", {
        ...recurrencePreview.series_payload,
        starts_at: selectedOccurrences[0].starts_at,
        occurrence_count: selectedOccurrences.length,
        until_date: null,
        creation_mode: "selected_only",
        occurrence_indexes: selectedIndexes,
        occurrences: selectedOccurrences.map((item) =>
          toOccurrencePreviewPayload(item, recurrencePreview.series_payload)),
        confirm_warning_indexes: confirmWarningIndexes,
        force_override_indexes: forceOverrideIndexes,
        override_reason: requiresOverrideReason ? overrideReason : null,
      });

      const created = Number(response?.data?.total_created || 0);
      const skipped = Number(response?.data?.total_skipped || 0);
      toast.success(
        skipped > 0
          ? `Serie criada: ${created} sessão(ões) criada(s), ${skipped} ignorada(s).`
          : `Serie criada (${created} sessão(ões)).`,
      );

      setRecurrencePreview(null);
      resetForm();
      closeDrawer();
      await reloadVisibleSessions();
      await loadPendingSessions();
    } catch (error) {
      const responseData = error?.response?.data || {};
      if (Array.isArray(responseData?.occurrences_preview)) {
        setRecurrencePreview((previous) => {
          if (!previous) return previous;
          const validIndexes = new Set(
            responseData.occurrences_preview.map((occurrence) => occurrence.index),
          );
          return {
            ...previous,
            occurrences: responseData.occurrences_preview,
            summary: responseData.summary || previous.summary,
            selected_indexes: previous.selected_indexes.filter((index) =>
              validIndexes.has(index),
            ),
            confirm_warning_indexes: previous.confirm_warning_indexes.filter((index) =>
              validIndexes.has(index),
            ),
            force_override_indexes: previous.force_override_indexes.filter((index) =>
              validIndexes.has(index),
            ),
            is_submitting: false,
          };
        });
      }
      toast.error(resolveSchedulingErrorMessage(error));
    } finally {
      setRecurrencePreview((previous) =>
        previous ? { ...previous, is_submitting: false } : previous,
      );
    }
  }, [
    closeDrawer,
    loadPendingSessions,
    reloadVisibleSessions,
    recurrencePreview,
    resetForm,
  ]);

	  const handleCreateAt = useCallback(
	    (date) => {
      resetForm();
      const endsAt = new Date(date);
      endsAt.setHours(endsAt.getHours() + 1);
      setDrawerMode("form");
      setGroupContext(null);
      setForm((prev) => ({
        ...prev,
        starts_at: toInputValue(date),
        ends_at: toInputValue(endsAt),
      }));
      setIsDrawerOpen(true);
    },
	    [resetForm],
	  );

	  const handleScheduleReplacement = useCallback((alert) => {
	    const replacementCredit = buildReplacementCreditFromAlert(alert);
	    if (!replacementCredit.id || !replacementCredit.patient_id) {
	      toast.error("Reposição inválida para agendamento.");
	      return;
	    }

	    const serviceId = replacementCredit.source_service_id
	      ? String(replacementCredit.source_service_id)
	      : "";
	    const serviceType = replacementCredit.source_service_type || "";
	    if (!serviceId && !serviceType) {
	      toast.error("Não foi possível identificar o serviço da reposição.");
	      return;
	    }

	    resetForm();
	    const defaultStart = new Date(selectedDate);
	    defaultStart.setHours(START_HOUR, 0, 0, 0);
	    const defaultEnd = new Date(defaultStart);
	    defaultEnd.setHours(defaultEnd.getHours() + 1);

	    setDrawerMode("form");
	    setPendingCenterSelectedItemKey(null);
	    setGroupContext(null);
	    setEditingId(null);
	    setEditingIntent("create");
	    setRepeatEnabled(false);
	    setReplacementCreditsForPatient([replacementCredit]);
	    setPatientCreditsForPatient([]);
	    setFormPatientQuery(replacementCredit.patient_name || "Paciente");
	    setForm({
	      ...emptyForm,
	      patient_id: String(replacementCredit.patient_id),
	      service_id: serviceId,
	      service_type: serviceType,
	      status: "scheduled",
	      starts_at: toInputValue(defaultStart),
	      ends_at: toInputValue(defaultEnd),
	      billing_mode: replacementCredit.source_billing_mode || "per_session",
	      session_replacement_credit_id: String(replacementCredit.id),
	      patient_credit_id: "",
	    });
	    setIsDrawerOpen(true);
	  }, [resetForm, selectedDate]);

	  const handleOpenGroup = useCallback((date) => {
    setGroupContext({ date });
    setDrawerMode("group");
    setIsDrawerOpen(true);
  }, []);

  const handleDragStart = useCallback((event) => {
    const { id } = event.currentTarget.dataset;
    if (!id) return;
    const { dataTransfer } = event;
    dataTransfer.setData("text/plain", id);
    dataTransfer.effectAllowed = "move";
  }, []);

  const handleDropAt = useCallback(
    async (event, date) => {
      event.preventDefault();
      const id = event.dataTransfer.getData("text/plain");
      if (!id) return;
      const session = filteredSessions.find((item) => String(item.id) === id);
      if (!session) return;

      const startsAt = new Date(session.starts_at);
      const endsAt = session.ends_at ? new Date(session.ends_at) : null;
      const durationMs = endsAt && !Number.isNaN(endsAt.getTime())
        ? endsAt.getTime() - startsAt.getTime()
        : null;
      const newStart = new Date(date);
      const payload = {
        patient_id: session.patient_id,
        professional_user_id: session.professional_user_id || null,
        service_type: session.service_type || session.Service?.code || null,
        service_id: session.service_id || session.Service?.id || null,
        status: "scheduled",
        starts_at: newStart.toISOString(),
        notes: session.notes || null,
        billing_mode: session.billing_mode || "per_session",
        rescheduled_from_id: session.id,
      };
      if (durationMs && durationMs > 0) {
        payload.ends_at = new Date(newStart.getTime() + durationMs).toISOString();
      }

      setIsSaving(true);
      try {
        const response = await axios.post("/sessions", payload);
        showAbsenceMonthlyPolicyNotice(response?.data);
        toast.success("Agendamento reagendado.");
        await reloadVisibleSessions();
        await loadPendingSessions();
      } catch (error) {
        if (isPlanCycleRescheduleError(error)) {
	          toast.error(`${getPlanCycleRescheduleMessage(error)} Abra Editar agendamento para autorizar a exceção.`);
          return;
        }
        if (isMonthlyRescheduleLimitError(error)) {
	          toast.error(`${getMonthlyRescheduleLimitMessage(error)} Abra Editar agendamento para autorizar a exceção.`);
          return;
        }
        const message =
          error?.response?.data?.error ||
          "Não foi possível reagendar o agendamento.";
        toast.error(message);
      } finally {
        setIsSaving(false);
      }
    },
    [filteredSessions, loadPendingSessions, reloadVisibleSessions],
  );
  const handleDragOver = useCallback((event) => {
    event.preventDefault();
    const { dataTransfer } = event;
    dataTransfer.dropEffect = "move";
  }, []);

  const openSessionForm = useCallback(
    (session, intent = "edit") => {
      if (!session) return;
      setShowEditReasonError(false);
      setDrawerMode("form");
      setGroupContext(null);
      const patientName = getPatientDisplayName(session);
      const serviceFromCode = session.service_type
        ? servicesByCode.get(session.service_type)
        : null;
      let serviceIdValue = "";
      if (session.service_id) {
        serviceIdValue = String(session.service_id);
      } else if (serviceFromCode?.id) {
        serviceIdValue = String(serviceFromCode.id);
      }
      setEditingId(session.id);
      setEditingIntent(intent);
      setPackageScopePreview({ sessionId: null, loading: false, data: null });
      setRepeatEnabled(false);
      setRepeatWeekdays([]);
      setRepeatMode("count");
      setRepeatCount("10");
      setRepeatWeeks("4");
      setForm({
        patient_id: session.patient_id ? String(session.patient_id) : "",
        professional_user_id: session.professional_user_id
          ? String(session.professional_user_id)
          : "",
        service_type: session.service_type || session.Service?.code || "",
        service_id: serviceIdValue,
        status: session.status || "scheduled",
        is_initial: !!session.is_initial,
        starts_at: toInputValue(session.starts_at),
        ends_at: toInputValue(session.ends_at),
        notes: "",
        absence_reason: session.absence_reason || "",
        late_policy_exception_justified: false,
        late_policy_exception_reason: "",
        monthly_reschedule_exception_justified: false,
        monthly_reschedule_exception_reason: "",
        cycle_reschedule_exception_justified: false,
        cycle_reschedule_exception_reason: "",
        session_replacement_credit_id: "",
        patient_credit_id: session.patient_credit_id ? String(session.patient_credit_id) : "",
        billing_mode: session.billing_mode || "per_session",
        package_update_scope: "single",
      });
      setFormPatientQuery(patientName);
      setIsDrawerOpen(true);
    },
    [servicesByCode],
  );

  const handleEdit = useCallback(
    (event) => {
      const { id } = event.currentTarget.dataset;
      const session = filteredSessions.find((item) => String(item.id) === id);
      openSessionForm(session, "edit");
    },
    [filteredSessions, openSessionForm],
  );

	  const handleOpenDelete = useCallback(
	    (session) => {
	      if (!session?.id) return;
	      const sourcePool = pendingSessionsSource.length > 0 ? pendingSessionsSource : sessions;
	      const targetSession =
	        sourcePool.find((item) => String(item.id) === String(session.id)) || session;
	      const isPackageRemoval = isPackageSeriesSession(targetSession);

			      setDeleteModal({
			        ...emptyDeleteModal,
			        open: true,
				        step: "choice",
				        session: targetSession,
                removalIntent: "reschedule",
				        keepForReschedule: isPackageRemoval,
			      });
	    },
    [pendingSessionsSource, sessions],
  );

		  const handleCloseDelete = useCallback(() => {
		    if (isDeleting || isDeletePreviewing) return;
		    setDeleteModal(emptyDeleteModal);
		  }, [isDeletePreviewing, isDeleting]);

	  const handleSelectDeleteIntent = useCallback((intent) => {
	    const keepForReschedule = intent === "reschedule";
	    setDeleteModal((previous) => ({
	      ...previous,
	      step: "choice",
	      removalIntent: intent,
	      keepForReschedule,
	      confirmHardRemoval: false,
	      selectedIds: [],
	      candidates: [],
	      reason: "",
	    }));
	  }, []);

	  const handleDeleteModeSelection = useCallback(
    async (mode) => {
      const sessionId = deleteModal.session?.id;
      if (!sessionId) return;

      setIsDeletePreviewing(true);
      try {
        const response = await axios.post(`/sessions/${sessionId}/deletion-preview`, { mode });
        const candidates = Array.isArray(response?.data?.candidates)
          ? response.data.candidates
          : [];
        const sourceIsPackageRemoval =
          response?.data?.is_package_removal === true || isPackageSeriesSession(deleteModal.session);

        setDeleteModal((previous) => {
          const keepForReschedule = sourceIsPackageRemoval
            ? previous.removalIntent !== "hard_delete"
            : false;
          return {
            ...previous,
            step: "review",
            mode,
            candidates,
            selectedIds: candidates
              .filter((item) => canSelectDeleteCandidate(
                item,
                keepForReschedule,
                sourceIsPackageRemoval,
              ))
              .map((item) => String(item.id)),
            reason: "",
            keepForReschedule,
            confirmHardRemoval: false,
          };
        });
      } catch (error) {
        const message =
          error?.response?.data?.error || "Não foi possível preparar a revisão da exclusão.";
        toast.error(message);
      } finally {
        setIsDeletePreviewing(false);
      }
    },
    [deleteModal.session],
  );

		  const handleBackDeleteChoice = useCallback(() => {
	    if (isDeleting || isDeletePreviewing) return;
	    setDeleteModal((previous) => {
	      const isPackageRemoval = isPackageSeriesSession(previous.session);
	      return {
	        ...previous,
	        step: isPackageRemoval ? "choice" : "choice",
	        mode: "single",
	        candidates: [],
	        selectedIds: [],
	        reason: "",
	        keepForReschedule: isPackageRemoval
	          ? previous.removalIntent === "reschedule"
	          : isPackageRemoval,
	        confirmHardRemoval: false,
	      };
	    });
		  }, [isDeletePreviewing, isDeleting]);

	  const handleBackDeleteScope = useCallback(() => {
	    if (isDeleting || isDeletePreviewing) return;
	    setDeleteModal((previous) => ({
	      ...previous,
	      step: "intent",
	      mode: "single",
	      candidates: [],
	      selectedIds: [],
	      reason: "",
	      removalIntent: null,
	      keepForReschedule: true,
	      confirmHardRemoval: false,
	    }));
	  }, [isDeletePreviewing, isDeleting]);

	  const handleToggleDeleteCandidate = useCallback((id) => {
    const normalizedId = String(id);
    setDeleteModal((previous) => {
      const candidate = previous.candidates.find((item) => String(item.id) === normalizedId);
      const isPackageRemoval = isPackageSeriesSession(previous.session);
      if (!canSelectDeleteCandidate(candidate, previous.keepForReschedule, isPackageRemoval)) {
        return previous;
      }
      const isSelected = previous.selectedIds.includes(normalizedId);
      return {
        ...previous,
        selectedIds: isSelected
          ? previous.selectedIds.filter((item) => item !== normalizedId)
          : [...previous.selectedIds, normalizedId],
      };
    });
  }, []);

	  const handleToggleAllDeleteCandidates = useCallback(() => {
    setDeleteModal((previous) => {
      const isPackageRemoval = isPackageSeriesSession(previous.session);
      const selectableIds = previous.candidates
        .filter((item) => canSelectDeleteCandidate(
          item,
          previous.keepForReschedule,
          isPackageRemoval,
        ))
        .map((item) => String(item.id));
      if (selectableIds.length === 0) return previous;
      const allSelected = selectableIds.every((id) => previous.selectedIds.includes(id));
      return {
        ...previous,
        selectedIds: allSelected ? [] : selectableIds,
      };
    });
	  }, []);

	  const handleToggleConfirmHardRemoval = useCallback((event) => {
    setDeleteModal((previous) => ({
      ...previous,
      confirmHardRemoval: event.target.checked,
    }));
  }, []);

  const { selectedIds: deleteSelectedIds } = deleteModal;
  const deleteSelectedSessions = useMemo(() => {
    if (deleteModal.selectedIds.length === 0) return [];
    const selectedIdSet = new Set(deleteModal.selectedIds);
    return deleteModal.candidates.filter((item) => selectedIdSet.has(String(item.id)));
  }, [deleteModal.candidates, deleteModal.selectedIds]);

  const isPackageRemovalFlow =
    deleteModal.step === "review" &&
    isPackageSeriesSession(deleteModal.session);
  const isPackageDeleteFlow = isPackageSeriesSession(deleteModal.session);

  const deleteSelectableSessions = useMemo(
    () => deleteModal.candidates.filter((item) => canSelectDeleteCandidate(
      item,
      deleteModal.keepForReschedule,
      isPackageDeleteFlow,
    )),
    [deleteModal.candidates, deleteModal.keepForReschedule, isPackageDeleteFlow],
  );

  const deleteBlockedSessions = useMemo(
    () => deleteModal.candidates.filter((item) => !canSelectDeleteCandidate(
      item,
      deleteModal.keepForReschedule,
      isPackageDeleteFlow,
    )),
    [deleteModal.candidates, deleteModal.keepForReschedule, isPackageDeleteFlow],
  );

  const deleteReviewFirstSession = deleteSelectedSessions[0] || deleteSelectableSessions[0] || null;
  const deleteReviewLastSession =
    deleteSelectedSessions[deleteSelectedSessions.length - 1] ||
    deleteSelectableSessions[deleteSelectableSessions.length - 1] ||
    null;

  const areAllDeleteCandidatesSelected = useMemo(() => (
    deleteSelectableSessions.length > 0 &&
    deleteSelectableSessions.every((item) => deleteModal.selectedIds.includes(String(item.id)))
  ), [deleteModal.selectedIds, deleteSelectableSessions]);

	  const requiresHardRemovalConfirmation =
	    isPackageRemovalFlow && !deleteModal.keepForReschedule;
	  let deleteConfirmLabel = "Excluir selecionados";
	  if (isPackageRemovalFlow && deleteModal.keepForReschedule) {
	    deleteConfirmLabel = "Remover e deixar para remarcar";
	  } else if (isPackageRemovalFlow) {
	    deleteConfirmLabel = "Apagar definitivamente";
	  }

  const handleConfirmDelete = useCallback(async () => {
    if (isDeleting) return;

	    if (deleteSelectedIds.length === 0) {
	      toast.error(
	        isPackageRemovalFlow
	          ? "Selecione ao menos uma sessão para remover."
	          : "Selecione ao menos um agendamento para excluir.",
	      );
	      return;
	    }

    const normalizedReason = deleteModal.reason.trim();
	    if (!normalizedReason) {
	      toast.error(isPackageRemovalFlow ? "Informe o motivo da remoção." : "Informe o motivo da exclusão.");
	      return;
	    }

    if (requiresHardRemovalConfirmation && !deleteModal.confirmHardRemoval) {
      toast.error("Confirme que deseja apagar sem deixar para remarcar depois.");
      return;
    }

    setIsDeleting(true);
    try {
      const endpoint = isPackageRemovalFlow
        ? "/sessions/remove-package-futures"
        : "/sessions/soft-delete";
      const payload = {
        session_ids: deleteSelectedIds.map((id) => Number(id)),
        reason: normalizedReason,
        scope: deleteModal.mode,
      };
      if (isPackageRemovalFlow) {
        payload.create_replacement_credits = !!deleteModal.keepForReschedule;
      }
      const response = await axios.post(endpoint, payload);
      const successCount = Number(
        response?.data?.total_removed ||
        response?.data?.total_deleted ||
        deleteSelectedIds.length,
      );

      await reloadVisibleSessions();
      await loadPendingSessions();

      if (isPackageRemovalFlow && deleteModal.keepForReschedule) {
        toast.success(
          successCount === 1
            ? "Sessão removida e deixada como reposição pendente."
            : `${successCount} sessões removidas e deixadas como reposição pendente.`,
        );
      } else if (isPackageRemovalFlow) {
        toast.success(
          successCount === 1
            ? "Sessão apagada da agenda."
            : `${successCount} sessões apagadas da agenda.`,
        );
      } else {
        toast.success(
          successCount === 1
            ? "Agendamento excluido com historico."
            : `${successCount} agendamento(s) excluido(s) com historico.`,
        );
      }
      setDeleteModal(emptyDeleteModal);
	    } catch (error) {
	      const rawMessage =
	        error?.response?.data?.error ||
	        (isPackageRemovalFlow
	          ? "Não foi possível remover as sessões selecionadas."
	          : "Não foi possível excluir os agendamentos selecionados.");
	      const message = rawMessage ===
	        "Esta sessão possui vínculo financeiro. Para remover da agenda, marque 'Quero remarcar essas sessões depois' ou trate o financeiro antes."
	        ? "Esta sessão possui vínculo financeiro. Para remover da agenda, escolha 'Remarcar depois' ou trate o financeiro antes."
	        : rawMessage;
	      toast.error(message);
    } finally {
      setIsDeleting(false);
    }
	  }, [
	    deleteModal.mode,
	    deleteModal.reason,
	    deleteModal.keepForReschedule,
	    deleteModal.confirmHardRemoval,
    deleteSelectedIds,
    isDeleting,
    isPackageRemovalFlow,
    loadPendingSessions,
	    reloadVisibleSessions,
	    requiresHardRemovalConfirmation,
	  ]);

      const handlePackageRemovalIntentChange = useCallback((event) => {
        const intent = event.target.value === "hard_delete" ? "hard_delete" : "reschedule";
        setDeleteModal((previous) => ({
          ...previous,
          removalIntent: intent,
          keepForReschedule: intent === "reschedule",
        }));
      }, []);

      const handlePackageRemovalScopeChange = useCallback((event) => {
        const mode = event.target.value === "series" ? "series" : "single";
        setDeleteModal((previous) => ({
          ...previous,
          mode,
        }));
      }, []);

		  const handleRemovePackageFromAgenda = useCallback(
		    async () => {
		      if (isDeleting) return;
		      const sessionId = Number(deleteModal.session?.id);
		      if (!sessionId) return;
          const createReplacementCredits = deleteModal.removalIntent !== "hard_delete";

	      setIsDeleting(true);
	      try {
	        const response = await axios.post("/sessions/remove-package-futures", {
	          session_ids: [sessionId],
		          reason: createReplacementCredits
                ? "Removido da agenda pelo usuário."
                : "Exclusão definitiva de lançamento equivocado ou duplicado.",
		          scope: deleteModal.mode,
		          auto_resolve: true,
              create_replacement_credits: createReplacementCredits,
	        });
	        const totalRemoved = Number(response?.data?.total_removed || 0);
	        const totalReplacementCredits = Number(response?.data?.total_replacement_credits || 0);
	        const totalDeleted = Number(response?.data?.total_deleted || 0);
	        const totalBlocked = Number(response?.data?.total_blocked || 0);

	        await reloadVisibleSessions();
	        await loadPendingSessions();

	        if (totalRemoved === 1 && totalReplacementCredits === 1) {
	          toast.success("Sessão removida da agenda e deixada para remarcar depois.");
	        } else if (totalRemoved === 1 && totalDeleted === 1) {
	          toast.success("Sessão removida da agenda.");
	        } else if (totalReplacementCredits > 0 && totalDeleted > 0) {
	          toast.success(
	            `${totalRemoved} sessões removidas: ${totalReplacementCredits} para remarcar depois e ${totalDeleted} removida(s) da agenda.`,
	          );
	        } else if (totalReplacementCredits > 0) {
	          toast.success(`${totalReplacementCredits} sessões removidas da agenda e deixadas para remarcar depois.`);
	        } else {
	          toast.success(`${totalRemoved || totalDeleted} sessões removidas da agenda.`);
	        }

	        if (totalBlocked > 0) {
	          toast.info(`${totalBlocked} sessão(ões) não foram alteradas por proteção operacional.`);
	        }

	        setDeleteModal(emptyDeleteModal);
	      } catch (error) {
	        toast.error(
	          error?.response?.data?.error ||
	            error?.message ||
	            "Não foi possível remover o agendamento.",
	        );
	      } finally {
	        setIsDeleting(false);
	      }
	    },
		    [
          deleteModal.mode,
          deleteModal.removalIntent,
          deleteModal.session,
          isDeleting,
          loadPendingSessions,
          reloadVisibleSessions,
        ],
	  );

	  const applySessionStatusLocally = useCallback(({ id, status, reason, updatedSession }) => {
    if (!id || !status) return;
    const applyStatus = (session) => {
      if (String(session?.id) !== String(id)) return session;
      return {
        ...session,
        ...(updatedSession || {}),
        status: updatedSession?.status || status,
        absence_reason: reason || updatedSession?.absence_reason || session?.absence_reason,
      };
    };

    setSessions((previous) => previous.map(applyStatus));
    setPendingSessionsSource((previous) => previous.map(applyStatus));
    setDeleteModal((previous) => {
      if (!previous?.open) return previous;
      return {
        ...previous,
        session: previous.session ? applyStatus(previous.session) : previous.session,
        candidates: Array.isArray(previous.candidates)
          ? previous.candidates.map(applyStatus)
          : previous.candidates,
      };
    });
  }, []);

  const updateSessionStatus = useCallback(
    async ({
      id,
      status,
      reason,
      latePolicyExceptionJustified = false,
      latePolicyExceptionReason = "",
      generateReplacementCredit = false,
      onSuccess,
      onError,
    }) => {
      if (!id || !status) return;
      const sid = String(id);
      if (savingSessionIdsRef.current.has(sid)) return;
      const payload = { status };
      if (latePolicyExceptionJustified) {
        payload.late_policy_exception_justified = true;
        payload.late_policy_exception_reason = normalizeText(latePolicyExceptionReason);
      }
      if (reason) {
        payload.absence_reason = reason;
      }
      if (generateReplacementCredit) {
        payload.generate_replacement_credit = true;
        payload.replacement_credit_reason = reason || "";
      }
      savingSessionIdsRef.current.add(sid);
      setSavingSessionIds(new Set(savingSessionIdsRef.current));
      setSavingActionMap((prev) => ({ ...prev, [sid]: status }));
      try {
        const response = await axios.put(`/sessions/${id}`, payload);
        applySessionStatusLocally({
          id,
          status,
          reason,
          updatedSession: response?.data,
        });
        showAbsenceMonthlyPolicyNotice(response?.data);
	        toast.success("Agendamento atualizado.");
	        await reloadVisibleSessions();
	        await loadPendingSessions();
	        await loadOperationalAlerts(selectedMonthKey);
	        if (onSuccess) onSuccess();
      } catch (error) {
        const message =
          error?.response?.data?.error ||
          "Não foi possível atualizar o agendamento.";
        toast.error(message);
        if (onError) onError();
      } finally {
        savingSessionIdsRef.current.delete(sid);
        setSavingSessionIds(new Set(savingSessionIdsRef.current));
        setSavingActionMap((prev) => { const { [sid]: _, ...rest } = prev; return rest; });
      }
    },
    [
	      applySessionStatusLocally,
	      loadOperationalAlerts,
	      loadPendingSessions,
	      reloadVisibleSessions,
	      selectedMonthKey,
	    ],
	  );

  const handleQuickStatus = useCallback(
    async (event) => {
      const { id, status } = event.currentTarget.dataset;
      if (!id || !status) return;
      await updateSessionStatus({ id, status });
    },
    [updateSessionStatus],
  );

  const handleAbsence = useCallback(async (event) => {
    const { id, status } = event.currentTarget.dataset;
    if (!id || !status) return;
    const sourceSession =
      pendingSessionsSource.find((item) => String(item.id) === String(id)) ||
      sessions.find((item) => String(item.id) === String(id));
    const latePolicyApplies =
      status === "canceled" &&
      isLessThanConfiguredNoticeBeforeSession(
        sourceSession?.starts_at,
        operationalPolicy.late_change_minimum_notice_hours,
      );
    let monthlyAbsenceCountBefore = 0;
    const monthlyAbsenceLimit = Math.max(1, Number(operationalPolicy.monthly_absence_limit || 2));
    if (status === "no_show" && sourceSession?.starts_at) {
      const { start, endExclusive } = getMonthRangeForDate(sourceSession.starts_at);
      let monthSessions = [];
      if (start && endExclusive) {
        try {
          const response = await axios.get("/sessions", {
            params: {
              from: formatDateParam(start),
              to: formatDateParam(endExclusive),
            },
          });
          monthSessions = Array.isArray(response.data) ? response.data : [];
        } catch (error) {
          const fallbackMap = new Map();
          [...pendingSessionsSource, ...sessions].forEach((item) => {
            if (item?.id) fallbackMap.set(String(item.id), item);
          });
          monthSessions = Array.from(fallbackMap.values());
        }
      }
      const patientId = getSessionPatientId(sourceSession);
      monthlyAbsenceCountBefore = monthSessions.filter((item) => (
        String(item?.id) !== String(id) &&
        String(getSessionPatientId(item)) === String(patientId) &&
        item?.status === "no_show" &&
        isSessionInMonth(item, sourceSession.starts_at)
      )).length;
    }
    const monthlyAbsenceCountAfter =
      status === "no_show" ? monthlyAbsenceCountBefore + 1 : monthlyAbsenceCountBefore;
    setAbsenceModal({
      ...emptyAbsenceModal,
      open: true,
      id,
      status,
      session: sourceSession || null,
      reason: "",
      latePolicyApplies,
      monthlyAbsenceCountBefore,
      monthlyAbsenceCountAfter,
      monthlyAbsenceLimit,
      monthlyAbsenceReachedLimit:
        status === "no_show" && monthlyAbsenceCountAfter === monthlyAbsenceLimit,
      monthlyAbsenceExceededLimit:
        status === "no_show" && monthlyAbsenceCountAfter > monthlyAbsenceLimit,
      hasFixedSchedule: !!sourceSession?.series_id,
    });
  }, [
    operationalPolicy.late_change_minimum_notice_hours,
    operationalPolicy.monthly_absence_limit,
    pendingSessionsSource,
    sessions,
  ]);

  const handleConfirmAbsence = useCallback(async () => {
    if (!absenceModal.id || !absenceModal.status || absenceModal.isSaving) return;
    if (!absenceModal.reason.trim()) {
      toast.error("Informe o motivo.");
      return;
    }
    const canGenerateReplacementCredit =
      absenceModal.status === "canceled" &&
      (!absenceModal.latePolicyApplies || absenceModal.latePolicyExceptionJustified);
    setAbsenceModal((prev) => ({ ...prev, isSaving: true }));
    await updateSessionStatus({
      id: absenceModal.id,
      status: absenceModal.status,
      reason: absenceModal.reason.trim(),
      latePolicyExceptionJustified: absenceModal.latePolicyExceptionJustified,
      latePolicyExceptionReason: absenceModal.reason.trim(),
      generateReplacementCredit:
        canGenerateReplacementCredit && absenceModal.generateReplacementCredit,
      onSuccess: () => setAbsenceModal(emptyAbsenceModal),
      onError: () => setAbsenceModal((prev) => ({ ...prev, isSaving: false })),
    });
  }, [absenceModal, updateSessionStatus]);

  const handleOpenAttendanceCall = useCallback(({ timeGroup }) => {
    const allEligible = (timeGroup?.serviceGroups || []).flatMap((sg) =>
	      (sg.cards || []).filter((card) => card?.session?.id && !isHistoricalSessionStatus(card.session.status)),
    );

    if (allEligible.length === 0) {
      toast.info("Não há sessões ativas para fazer chamada neste horário.");
      return;
    }

    const statuses = {};
    const reasons = {};
    allEligible.forEach((card) => {
      const sid = String(card.session.id);
      if (card.session.status === "no_show") {
        statuses[sid] = "no_show";
        if (card.session.absence_reason) reasons[sid] = card.session.absence_reason;
      } else {
        statuses[sid] = "done";
      }
    });

    const modalServiceGroups = (timeGroup?.serviceGroups || [])
      .map((sg) => ({
        key: sg.key,
        serviceLabel: sg.serviceLabel,
        serviceColor: sg.serviceColor,
        serviceCode: sg.serviceCode,
        sessions: (sg.cards || [])
	          .filter((card) => card?.session?.id && !isHistoricalSessionStatus(card.session.status))
          .map((card) => card.session),
      }))
      .filter((sg) => sg.sessions.length > 0);

    setAttendanceModal({
      open: true,
      timeLabel: timeGroup?.label || "",
      serviceGroups: modalServiceGroups,
      statuses,
      reasons,
      isSaving: false,
    });
  }, []);

  const handleCloseAttendanceCall = useCallback(() => {
    setAttendanceModal((prev) => (
      prev.isSaving
        ? prev
        : {
          open: false,
          timeLabel: "",
          serviceGroups: [],
          statuses: {},
          reasons: {},
          isSaving: false,
        }
    ));
  }, []);

  const handleAttendanceStatusChange = useCallback((sessionId, status) => {
    setAttendanceModal((prev) => ({
      ...prev,
      statuses: {
        ...prev.statuses,
        [String(sessionId)]: status,
      },
    }));
  }, []);

  const handleAttendanceReasonChange = useCallback((sessionId, reason) => {
    setAttendanceModal((prev) => ({
      ...prev,
      reasons: {
        ...prev.reasons,
        [String(sessionId)]: reason,
      },
    }));
  }, []);

  const handleSaveAttendanceCall = useCallback(async () => {
    const allSessions = (attendanceModal.serviceGroups || []).flatMap((sg) => sg.sessions || []);
    if (!attendanceModal.open || attendanceModal.isSaving || allSessions.length === 0) return;

    const sessionsPayload = allSessions.map((session) => {
      const sid = String(session.id);
      const status = attendanceModal.statuses[sid] === "no_show" ? "no_show" : "done";
      const payload = { id: session.id, status };
      const reason = String(attendanceModal.reasons[sid] || "").trim();
      if (status === "no_show" && reason) {
        payload.absence_reason = reason;
      }
      return payload;
    });

    setAttendanceModal((prev) => ({ ...prev, isSaving: true }));
    try {
      const response = await axios.patch("/sessions/bulk-status", { sessions: sessionsPayload });
      (response?.data?.updated_sessions || []).forEach(showAbsenceMonthlyPolicyNotice);
      toast.success("Chamada salva.");
      setAttendanceModal({
        open: false,
        timeLabel: "",
        serviceGroups: [],
        statuses: {},
        reasons: {},
        isSaving: false,
      });
      await reloadVisibleSessions();
      await loadPendingSessions();
    } catch (error) {
      toast.error(getUserFacingApiError(error, "Não foi possível salvar a chamada."));
      setAttendanceModal((prev) => ({ ...prev, isSaving: false }));
    }
  }, [attendanceModal, loadPendingSessions, reloadVisibleSessions]);

  const handleOpenPendingDay = useCallback((value) => {
    if (!value) return;
    const sessionDate = new Date(value);
    if (Number.isNaN(sessionDate.getTime())) return;
    setSelectedDate(sessionDate);
    setView("day");
    closeDrawer();
  }, [closeDrawer]);

	  const handleDismissStandaloneCreditAlerts = useCallback(async (alerts = []) => {
    const validAlerts = alerts.filter((alert) => alert?.details?.alert_key);
    if (validAlerts.length === 0) return;

    const dismissedKeys = new Set(validAlerts.map((alert) => alert.details.alert_key));
    const previousOperationalAlerts = operationalAlerts;
    setOperationalAlerts((previous) =>
      previous.filter((alert) => !dismissedKeys.has(alert?.details?.alert_key)),
    );

    try {
      await axios.post("/operational-alerts/dismiss-standalone-credit", {
        alerts: validAlerts,
      });

      toast.success("Alerta ocultado.");
    } catch (error) {
      setOperationalAlerts(previousOperationalAlerts);
      toast.error(getUserFacingApiError(error, "Não foi possível ocultar o alerta."));
	    }
	  }, [operationalAlerts]);

	  const selectedReplacementCredit = useMemo(
	    () => replacementCreditsForPatient.find(
	      (credit) => String(credit.id) === String(form.session_replacement_credit_id),
	    ) || null,
	    [form.session_replacement_credit_id, replacementCreditsForPatient],
	  );
	  const isSchedulingReplacement = !editingId && !!selectedReplacementCredit;
	  const showReplacementCycleWarning = useMemo(() => {
	    if (!isSchedulingReplacement || selectedReplacementCredit?.source_billing_mode !== "covered_by_plan") {
	      return false;
	    }
	    const cycleStart = selectedReplacementCredit.source_billing_cycle_start;
	    const cycleEnd = selectedReplacementCredit.source_billing_cycle_end;
	    if (!cycleStart || !cycleEnd || !form.starts_at) return false;
	    return !isDateWithinInputRange(form.starts_at, cycleStart, cycleEnd);
	  }, [form.starts_at, isSchedulingReplacement, selectedReplacementCredit]);
	  const selectedReplacementServiceLabel =
	    selectedReplacementCredit?.source_service_name || serviceName(form.service_type) || "Atendimento";

	  const handleSubmit = useCallback(
    async (event) => {
      event.preventDefault();
      if (submitLockRef.current || isSaving) return;
      if (!form.patient_id) {
        toast.error("Selecione o paciente.");
        return;
      }
      if (!form.starts_at) {
        toast.error("Informe a data e horario.");
        return;
      }
      if (!form.service_id && !form.service_type) {
        toast.error("Selecione o serviço.");
        return;
      }
      if (editingId && !normalizeText(form.notes)) {
        setShowEditReasonError(true);
        return;
      }
      const startsAtDate = new Date(form.starts_at);
      if (Number.isNaN(startsAtDate.getTime())) {
        toast.error("Data de início inválida.");
        return;
      }

	      const editingOriginalSession = editingId
	        ? filteredSessions.find((session) => String(session.id) === String(editingId))
	        : null;
	      const selectedPackageUpdateScope =
	        form.package_update_scope === "series" ? "series" : "single";
	      const originalStart = editingOriginalSession?.starts_at
	        ? new Date(editingOriginalSession.starts_at).getTime()
	        : NaN;
	      const nextStart = form.starts_at ? new Date(form.starts_at).getTime() : NaN;
	      const editingScheduleWasChanged =
	        !!editingOriginalSession
	        && Number.isFinite(originalStart)
	        && Number.isFinite(nextStart)
	        && originalStart !== nextStart;
	      const packageScopeProfessionalChanged =
	        !!editingOriginalSession
	        && String(editingOriginalSession.professional_user_id || "") !== String(form.professional_user_id || "");
	      const packageScopeTimeChanged =
	        editingScheduleWasChanged;
	      const packageScopeApplies =
	        !!editingOriginalSession
	        && isPackageSeriesSession(editingOriginalSession)
	        && editingIntent === "edit";
	      const packageScopeDateWasChanged =
	        packageScopeApplies
	        && editingScheduleWasChanged
	        && toDateInputValue(editingOriginalSession?.starts_at) !== toDateInputValue(form.starts_at);
      const shouldUsePackageScopeUpdate =
        packageScopeApplies
        && selectedPackageUpdateScope === "series"
        && (packageScopeProfessionalChanged || packageScopeTimeChanged);

      if (shouldUsePackageScopeUpdate && packageScopeDateWasChanged) {
        toast.error("Para alterar a data, use Somente esta sessão. Em massa, altere apenas horário ou profissional.");
        return;
      }

	      if (showReplacementCycleWarning && !form.cycle_reschedule_exception_justified) {
	        toast.error("Confirme o agendamento da reposição fora do ciclo do plano mensal.");
	        return;
	      }

	      const isRecurring = repeatEnabled && !editingId && !isSchedulingReplacement;
      const endsAtDate = form.ends_at ? new Date(form.ends_at) : null;
      if (form.ends_at && (!endsAtDate || Number.isNaN(endsAtDate.getTime()))) {
        toast.error("Data de término inválida.");
        return;
      }
      if (endsAtDate && endsAtDate <= startsAtDate) {
        toast.error("O horário final deve ser posterior ao início.");
        return;
      }
      const hasValidEnd = endsAtDate && !Number.isNaN(endsAtDate.getTime());
      const durationMinutes = hasValidEnd
        ? Math.max(15, Math.round((endsAtDate - startsAtDate) / 60000))
        : 60;
      const hasLocalHolidayBlock =
        formLocalSpecialSummary?.severity === "block"
        && Array.isArray(formLocalSpecialSummary?.events)
        && formLocalSpecialSummary.events.some(
          (matchedEvent) =>
            SPECIAL_HOLIDAY_SOURCES.has(matchedEvent.source_type)
            && matchedEvent.affects_scheduling !== false,
        );

      if (isRecurring) {
        if (repeatMode === "count") {
          const count = Number(repeatCount);
          if (!Number.isFinite(count) || count <= 0) {
            toast.error("Informe a quantidade de sessões.");
            return;
          }
        }
        if (repeatMode === "weeks") {
          const weeks = Number(repeatWeeks);
          if (!Number.isFinite(weeks) || weeks <= 0) {
            toast.error("Informe o número de semanas.");
            return;
          }
        }
      }

      submitLockRef.current = true;
      setIsSaving(true);
      const releaseSubmitState = () => {
        setIsSaving(false);
        submitLockRef.current = false;
      };
      let selectedPatientCreditId = null;
      if (form.billing_mode !== "covered_by_plan" && form.patient_credit_id) {
        selectedPatientCreditId = Number(form.patient_credit_id);
      }

      const editReason = normalizeText(form.notes);
      const shouldUseEditReasonAsMonthlyRescheduleException =
        editingId
        && editingScheduleWasChanged
        && editReason;

      const payload = {
        patient_id: Number(form.patient_id),
        professional_user_id: form.professional_user_id
          ? Number(form.professional_user_id)
          : null,
        service_type: form.service_type
          ? form.service_type.toLowerCase()
          : null,
        service_id: form.service_id ? Number(form.service_id) : null,
        status: form.status || "scheduled",
        is_initial: editingId ? !!form.is_initial : false,
        starts_at: form.starts_at,
        ends_at: form.ends_at || null,
        notes: editReason,
        absence_reason: normalizeText(form.absence_reason),
        late_policy_exception_justified: !!form.late_policy_exception_justified,
        late_policy_exception_reason: normalizeText(form.late_policy_exception_reason),
        monthly_reschedule_exception_justified:
          !!form.monthly_reschedule_exception_justified
          || !!shouldUseEditReasonAsMonthlyRescheduleException,
        monthly_reschedule_exception_reason:
          normalizeText(form.monthly_reschedule_exception_reason)
          || (shouldUseEditReasonAsMonthlyRescheduleException ? editReason : null),
        cycle_reschedule_exception_justified: !!form.cycle_reschedule_exception_justified,
        cycle_reschedule_exception_reason: normalizeText(form.cycle_reschedule_exception_reason),
        session_replacement_credit_id: form.session_replacement_credit_id
          ? Number(form.session_replacement_credit_id)
          : null,
        patient_credit_id: selectedPatientCreditId,
	        ...(eligiblePlan || isSchedulingReplacement
	          ? { billing_mode: form.billing_mode || "per_session" }
	          : {}),
      };

      if (isRecurring) {
        let untilDate = null;
        const recurrenceStartsAt = new Date(startsAtDate);
        if (repeatMode === "weeks") {
          const weeks = Math.max(1, Number(repeatWeeks) || 1);
          const endDate = new Date(startsAtDate);
          endDate.setHours(0, 0, 0, 0);
          endDate.setDate(endDate.getDate() + weeks * 7 - 1);
          untilDate = formatDateParam(endDate);
        }
        if (repeatMode === "month") {
          const monthlyValidity = buildMonthlyValidityRange(startsAtDate);
          if (!monthlyValidity.end) {
            releaseSubmitState();
            toast.error("Não foi possível calcular a vigência mensal.");
            return;
          }
          recurrenceStartsAt.setSeconds(0, 0);
          untilDate = monthlyValidity.end;
        }
        const weekdays = repeatWeekdays.length
          ? repeatWeekdays
          : [toIsoWeekday(recurrenceStartsAt)];

        const seriesPayload = {
          patient_id: payload.patient_id,
          professional_user_id: payload.professional_user_id,
          service_type: payload.service_type,
          service_id: payload.service_id,
          status: payload.status,
          starts_at: recurrenceStartsAt.toISOString(),
          duration_minutes: durationMinutes,
          repeat_interval: 1,
          weekdays,
          ...(repeatMode === "plan"
            ? {}
            : {
              until_date:
                repeatMode === "weeks" || repeatMode === "month" ? untilDate : null,
              occurrence_count: repeatMode === "count" ? Number(repeatCount) : null,
            }),
          billing_mode:
            repeatMode === "plan" ? "covered_by_plan" : payload.billing_mode || "per_session",
          patient_credit_id: repeatMode === "plan" ? null : selectedPatientCreditId,
          notes: payload.notes,
        };

        if (repeatMode === "plan") {
          try {
            const response = await axios.post("/session-series", seriesPayload);
            const created = Number(
              response?.data?.total_created || response?.data?.total_sessions || 0,
            );
            const skipped = Number(
              response?.data?.total_skipped_by_availability || response?.data?.total_skipped || 0,
            );
            let successMessage = "Agenda do plano criada.";
            if (created > 0) {
              successMessage = `Agenda do plano criada (${created} sessão(ões)).`;
            }
            if (skipped > 0) {
              successMessage = `Agenda criada. ${skipped} data(s) bloqueada(s) foram ignorada(s).`;
            }
            toast.success(successMessage);
            resetForm();
            closeDrawer();
            await reloadVisibleSessions();
            await loadPendingSessions();
          } catch (error) {
            const message = resolveSchedulingErrorMessage(error);
            toast.error(message);
          } finally {
            releaseSubmitState();
          }
          return;
        }

        try {
          const previewResponse = await previewSchedulingOccurrences(seriesPayload);
          const occurrences = Array.isArray(previewResponse?.data?.occurrences_preview)
            ? previewResponse.data.occurrences_preview
            : [];
          const summary = previewResponse?.data?.summary || {};

          const selectedIndexes = occurrences
            .filter(
              (occurrence) =>
                occurrence.status === "AVAILABLE" || occurrence.status === "INFO",
            )
            .map((occurrence) => occurrence.index);

          setRecurrencePreview({
            open: true,
            is_submitting: false,
            series_payload: seriesPayload,
            occurrences,
            summary,
            selected_indexes: selectedIndexes,
            confirm_warning_indexes: [],
            force_override_indexes: [],
            override_reason: "",
            editing_index: null,
            edit_date: "",
            edit_time: "",
            edit_error: "",
            is_editing_occurrence: false,
          });
        } catch (error) {
          const message =
            error?.response?.data?.error ||
            "Não foi possível gerar a pré-visualização das ocorrências.";
          toast.error(message);
        } finally {
          releaseSubmitState();
        }
        return;
      }

      let confirmScheduleWarning = false;
      const forceOverride = false;
      const overrideReason = null;
	      const shouldValidateAvailability = !editingId || editingScheduleWasChanged;

      if (shouldValidateAvailability) {
        try {
          const availabilityResponse = await checkSchedulingAvailability({
            starts_at: payload.starts_at,
            ends_at: payload.ends_at,
            professional_user_id: payload.professional_user_id,
            service_id: payload.service_id,
            service_type: payload.service_type,
          });
          const availability = availabilityResponse?.data || {};
          const matchedEvents = Array.isArray(availability.matched_events)
            ? availability.matched_events
            : [];

          if (availability.has_blocking_events) {
            toast.error(
              availability.blocking_reason ||
              "Data bloqueada por evento operacional.",
            );
            releaseSubmitState();
            return;
          }
          if (hasLocalHolidayBlock) {
            toast.error("Data bloqueada por feriado.");
            releaseSubmitState();
            return;
          }

          if (availability.requires_confirmation) {
            const eventNames = matchedEvents
              .map((matchedEvent) => matchedEvent.name)
              .filter(Boolean)
              .slice(0, 3)
              .join(", ");
            confirmScheduleWarning = true;
            toast.info(`Data com alerta operacional${eventNames ? ` (${eventNames})` : ""}.`);
          }

          if (
            availability.severity === "info" &&
            matchedEvents.length > 0
          ) {
            toast.info("Dia com feriado ou bloqueio informativo.");
          }
        } catch (error) {
          const message =
            error?.response?.data?.error ||
            "Não foi possível validar disponibilidade.";
          toast.error(message);
          releaseSubmitState();
          return;
        }
      }

      try {
        const schedulingPayload = {
          confirm_schedule_warning: confirmScheduleWarning,
          force_override: forceOverride,
          override_reason: overrideReason,
        };
	        if (editingId) {
	          const originalSession = editingOriginalSession;
	          const isReschedule =
	            originalSession &&
	            editingScheduleWasChanged &&
	            originalSession.status === "scheduled" &&
	            payload.status === "scheduled";

	          if (shouldUsePackageScopeUpdate) {
	            const response = await axios.post(`/sessions/${editingId}/package-scope-update`, {
	              scope: "series",
	              data: {
	                professional_user_id: payload.professional_user_id,
	                starts_at: packageScopeTimeChanged ? payload.starts_at : undefined,
	                ends_at: packageScopeTimeChanged ? payload.ends_at : undefined,
	                notes: payload.notes,
	              },
	              ...schedulingPayload,
	            });
	            const updatedCount = Number(response?.data?.total_updated || 0);
	            const skippedCount = Number(response?.data?.total_skipped || 0);
	            toast.success(
	              skippedCount > 0
	                ? `Agendamento atualizado. ${updatedCount} sessão(ões) alterada(s), ${skippedCount} ignorada(s).`
	                : `Agendamento atualizado. ${updatedCount} sessão(ões) alterada(s).`,
	            );
	          } else if (isReschedule) {
            const response = await axios.post("/sessions", {
              ...payload,
              ...schedulingPayload,
              status: "scheduled",
              rescheduled_from_id: editingId,
            });
            showAbsenceMonthlyPolicyNotice(response?.data);
            toast.success("Agendamento remarcado.");
          } else {
            const response = await axios.put(`/sessions/${editingId}`, {
              ...payload,
              ...schedulingPayload,
            });
            showAbsenceMonthlyPolicyNotice(response?.data);
            toast.success("Agendamento atualizado.");
          }
        } else {
          await axios.post("/sessions", {
            ...payload,
            ...schedulingPayload,
          });
          toast.success("Agendamento criado.");
        }
        resetForm();
        closeDrawer();
        await reloadVisibleSessions();
        await loadPendingSessions();
        await loadReplacementCreditsForPatient(form.patient_id);
        await loadOperationalAlerts(selectedMonthKey);
      } catch (error) {
        toast.error(resolveSchedulingErrorMessage(error));
      } finally {
        releaseSubmitState();
      }
    },
    [
      closeDrawer,
      editingId,
	      editingIntent,
	      eligiblePlan,
	      filteredSessions,
	      form,
		      formLocalSpecialSummary,
		      isSaving,
		      isSchedulingReplacement,
	      loadPendingSessions,
      loadOperationalAlerts,
      loadReplacementCreditsForPatient,
      reloadVisibleSessions,
      repeatEnabled,
      repeatMode,
      repeatCount,
      repeatWeeks,
	      repeatWeekdays,
	      resetForm,
		      selectedMonthKey,
		      showReplacementCycleWarning,
	      submitLockRef,
    ],
  );

  const monthDays = useMemo(() => getMonthDays(selectedDate), [selectedDate]);

	  const monthServicesByDay = useMemo(() => {
	    const map = new Map();
	    sessionsByDay.forEach((daySessionList, key) => {
	      const groups = new Map();
	      let historyCount = 0;
	      daySessionList.forEach((session) => {
	        if (isHistoricalSessionStatus(session.status)) {
	          historyCount += 1;
	          return;
	        }
	        const code = getSessionServiceCode(session);
	        if (!groups.has(code)) {
	          groups.set(code, {
	            code,
	            count: 0,
	            color: serviceColor(code),
	            name: serviceName(code),
	            kind: "service",
	          });
	        }
	        groups.get(code).count += 1;
	      });
	      const activeServices = [...groups.values()].sort((a, b) =>
	        String(a.name || "").localeCompare(String(b.name || ""), "pt-BR", { sensitivity: "base" })
	      );
	      map.set(key, {
	        items: activeServices,
	        historyCount,
	      });
	    });
	    return map;
	  }, [getSessionServiceCode, sessionsByDay, serviceColor, serviceName]);

  const visibleMonthDays = useMemo(() => {
    if (showMonthWeekend) return monthDays;
    return monthDays.filter((day) => day.getDay() !== 0 && day.getDay() !== 6);
  }, [monthDays, showMonthWeekend]);

  const handlePrev = useCallback(() => {
    const next = new Date(selectedDate);
    if (view === "month") {
      next.setDate(1);
      next.setMonth(next.getMonth() - 1);
    }
    if (view === "week") next.setDate(next.getDate() - 7);
    if (view === "day") next.setDate(next.getDate() - 1);
    setSelectedDate(next);
  }, [selectedDate, view]);

  const handleNext = useCallback(() => {
    const next = new Date(selectedDate);
    if (view === "month") {
      next.setDate(1);
      next.setMonth(next.getMonth() + 1);
    }
    if (view === "week") next.setDate(next.getDate() + 7);
    if (view === "day") next.setDate(next.getDate() + 1);
    setSelectedDate(next);
  }, [selectedDate, view]);

  const handleToday = useCallback(() => {
    setSelectedDate(new Date());
  }, []);

  const formAvailabilityEvents = useMemo(
    () =>
      Array.isArray(formAvailability?.matched_events)
        ? formAvailability.matched_events
        : [],
    [formAvailability],
  );

  const formContextEvents = useMemo(() => {
    if (formAvailabilityEvents.length > 0) return formAvailabilityEvents;
    return Array.isArray(formLocalSpecialSummary?.events)
      ? formLocalSpecialSummary.events
      : [];
  }, [formAvailabilityEvents, formLocalSpecialSummary]);

  const formAvailabilityLevel = useMemo(() => {
    const serverLevel = availabilityStatus(formAvailability);
    const localLevel = formLocalSpecialSummary?.severity || "available";
    if (formAvailability?.error) return "block";
    return severityWeight(localLevel) > severityWeight(serverLevel)
      ? localLevel
      : serverLevel;
  }, [formAvailability, formLocalSpecialSummary]);

  const formBlockedHolidayEvents = useMemo(
    () =>
      formContextEvents.filter(
        (event) =>
          SPECIAL_HOLIDAY_SOURCES.has(event.source_type)
          && event.affects_scheduling !== false,
      ),
    [formContextEvents],
  );

  const shouldShowFormContext = useMemo(
    () =>
      Boolean(
        form.starts_at
        && formAvailabilityLevel === "block"
        && formBlockedHolidayEvents.length > 0,
      ),
    [form.starts_at, formAvailabilityLevel, formBlockedHolidayEvents.length],
  );

  const formAvailabilityTitle = useMemo(() => {
    const baseDate = form.starts_at ? formatDate(form.starts_at) : "Data selecionada";
    return `${baseDate} - Data bloqueada por feriado.`;
  }, [form.starts_at]);

  const monthlyValiditySummary = useMemo(() => {
    const monthlyValidity = buildMonthlyValidityRange(form.starts_at);
    if (!monthlyValidity.start || !monthlyValidity.end) {
      return "Defina data e horario acima.";
    }
    return `${formatDate(monthlyValidity.start)} ate ${formatDate(monthlyValidity.end)}`;
  }, [form.starts_at]);

  const recurrenceSelectedSet = useMemo(
    () => new Set(recurrencePreview?.selected_indexes || []),
    [recurrencePreview],
  );

  const recurrenceSelectedOccurrences = useMemo(() => {
    if (!recurrencePreview) return [];
    return sortOccurrencesByDateTime(
      recurrencePreview.occurrences.filter((occurrence) =>
        recurrenceSelectedSet.has(occurrence.index)),
    );
  }, [recurrencePreview, recurrenceSelectedSet]);

  const recurrenceSequenceMap = useMemo(() => {
    const map = new Map();
    recurrenceSelectedOccurrences.forEach((occurrence, index) => {
      map.set(occurrence.index, index + 1);
    });
    return map;
  }, [recurrenceSelectedOccurrences]);

  const recurrenceBlockedSelectedCount = useMemo(() => {
    if (!recurrencePreview) return 0;
    return recurrencePreview.occurrences.filter(
      (occurrence) =>
        recurrenceSelectedSet.has(occurrence.index) && occurrence.status === "BLOCK",
    ).length;
  }, [recurrencePreview, recurrenceSelectedSet]);

  const selectedDaySpecialTitle = useMemo(() => {
    if (!selectedDaySpecialSummary) return "";
    if (selectedDaySpecialSummary.severity === "block") return "Dia bloqueado";
    if (selectedDaySpecialSummary.severity === "warn") return "Dia com alerta";
    return "Dia com feriado ou bloqueio";
  }, [selectedDaySpecialSummary]);

  const editingSession = useMemo(
    () => filteredSessions.find((session) => String(session.id) === String(editingId)) || null,
    [editingId, filteredSessions],
  );

  const editingBillingSummary = useMemo(
    () => getSessionBillingSummary(editingSession, serviceName),
    [editingSession, serviceName],
  );
	  const isEditingInfo = !!editingId && editingIntent === "edit";
	  const isReschedulingSession = !!editingId && editingIntent === "reschedule";
  const showPackageUpdateScope =
    !!editingSession
    && isPackageSeriesSession(editingSession)
    && (isEditingInfo || isReschedulingSession);

  const fallbackPackageScopeFutureCount = useMemo(() => {
    if (!showPackageUpdateScope || !editingSession?.starts_at) return 0;
    const seriesId = resolveSeriesId(editingSession);
    if (!seriesId) return 0;
    const selectedStart = new Date(editingSession.starts_at).getTime();
    const now = Date.now();
    if (!Number.isFinite(selectedStart)) return 0;
    return sessions.filter((session) => {
      if (String(resolveSeriesId(session)) !== String(seriesId)) return false;
      if (String(session.id) === String(editingSession.id)) return false;
      if (String(session.status || "").toLowerCase() !== "scheduled") return false;
      const startsAt = session.starts_at ? new Date(session.starts_at).getTime() : NaN;
      return Number.isFinite(startsAt) && startsAt >= selectedStart && startsAt >= now;
    }).length;
  }, [editingSession, sessions, showPackageUpdateScope]);

  useEffect(() => {
    const sessionId = editingSession?.id ? String(editingSession.id) : null;
    if (!showPackageUpdateScope || !sessionId) {
      setPackageScopePreview({ sessionId: null, loading: false, data: null });
      return undefined;
    }

    const requestId = packageScopePreviewRequestIdRef.current + 1;
    packageScopePreviewRequestIdRef.current = requestId;
    setPackageScopePreview({ sessionId, loading: true, data: null });

    let cancelled = false;
    axios.get(`/sessions/${sessionId}/package-scope-update-preview`)
      .then((response) => {
        if (cancelled || packageScopePreviewRequestIdRef.current !== requestId) return;
        setPackageScopePreview({
          sessionId,
          loading: false,
          data: response?.data || null,
        });
      })
      .catch(() => {
        if (cancelled || packageScopePreviewRequestIdRef.current !== requestId) return;
        setPackageScopePreview({ sessionId, loading: false, data: null });
      });

    return () => {
      cancelled = true;
    };
  }, [editingSession?.id, showPackageUpdateScope]);

  const isPackageScopePreviewLoading =
    showPackageUpdateScope
    && packageScopePreview.loading
    && String(packageScopePreview.sessionId || "") === String(editingSession?.id || "");

  const packageScopePreviewFutureCount =
    String(packageScopePreview.sessionId || "") === String(editingSession?.id || "")
      ? Number(packageScopePreview.data?.total_following_eligible)
      : NaN;

  const packageScopeFutureCount = Number.isFinite(packageScopePreviewFutureCount)
    ? packageScopePreviewFutureCount
    : fallbackPackageScopeFutureCount;

	  const packageScopeDateChanged = useMemo(() => {
	    if (!showPackageUpdateScope) return false;
	    return toDateInputValue(editingSession?.starts_at) !== toDateInputValue(form.starts_at);
	  }, [editingSession, form.starts_at, showPackageUpdateScope]);

  const editingScheduleChanged = useMemo(() => {
    if (!editingSession?.starts_at || !form.starts_at) return false;
    const originalStart = new Date(editingSession.starts_at).getTime();
    const nextStart = new Date(form.starts_at).getTime();
    if (!Number.isFinite(originalStart) || !Number.isFinite(nextStart)) return false;
    return originalStart !== nextStart;
  }, [editingSession, form.starts_at]);

	  const isEditingScheduledReschedule =
	    !!editingSession
	    && editingScheduleChanged
	    && editingSession.status === "scheduled"
	    && form.status === "scheduled";

  const showLatePolicyException =
    !!editingSession
    && isLessThanConfiguredNoticeBeforeSession(
      editingSession.starts_at,
      operationalPolicy.late_change_minimum_notice_hours,
    )
    && (
      editingScheduleChanged
      || form.status === "canceled"
      || form.status === "no_show"
    );

  const showMonthlyRescheduleException = useMemo(() => {
    if (!isEditingScheduledReschedule) return false;
    const previousReschedules = Array.isArray(editingSession?.reschedules)
      ? editingSession.reschedules.length
      : 0;
    const limit = Number(
      operationalPolicy.monthly_reschedule_limit
      || DEFAULT_OPERATIONAL_POLICY.monthly_reschedule_limit,
    );
    return previousReschedules + 1 > limit;
  }, [editingSession, isEditingScheduledReschedule, operationalPolicy.monthly_reschedule_limit]);

  const showCycleRescheduleException = useMemo(() => {
    if (!isEditingScheduledReschedule || editingSession?.billing_mode !== "covered_by_plan") {
      return false;
    }
    const billingCycle = editingSession?.BillingCycle || null;
    const fallbackRange = getMonthDateRange(editingSession.starts_at);
    const cycleStart = billingCycle?.cycle_start || fallbackRange.start;
    const cycleEnd = billingCycle?.cycle_end || fallbackRange.end;
    return !isDateWithinInputRange(form.starts_at, cycleStart, cycleEnd);
  }, [editingSession, form.starts_at, isEditingScheduledReschedule]);

  useEffect(() => {
    if (!editingId) return;
    setForm((prev) => {
      const next = { ...prev };
      let changed = false;

      if (!showLatePolicyException && (
        next.late_policy_exception_justified
        || next.late_policy_exception_reason
      )) {
        next.late_policy_exception_justified = false;
        next.late_policy_exception_reason = "";
        changed = true;
      }

      if (!showMonthlyRescheduleException && (
        next.monthly_reschedule_exception_justified
        || next.monthly_reschedule_exception_reason
      )) {
        next.monthly_reschedule_exception_justified = false;
        next.monthly_reschedule_exception_reason = "";
        changed = true;
      }

      if (!showCycleRescheduleException && (
        next.cycle_reschedule_exception_justified
        || next.cycle_reschedule_exception_reason
      )) {
        next.cycle_reschedule_exception_justified = false;
        next.cycle_reschedule_exception_reason = "";
        changed = true;
      }

      return changed ? next : prev;
    });
  }, [
    editingId,
    showCycleRescheduleException,
    showLatePolicyException,
    showMonthlyRescheduleException,
  ]);

  const deleteSeriesCandidates = useMemo(() => {
    if (!deleteModal.session || !hasRecurringSeries(deleteModal.session)) return [];
    return buildDeleteCandidates(deleteModal.session, "series");
  }, [buildDeleteCandidates, deleteModal.session]);

  let drawerTitle = "Novo agendamento";
  if (drawerMode === "pending") {
    drawerTitle = "Central de pendencias";
  } else if (drawerMode === "group") {
    drawerTitle = "Detalhes do horário";
  } else if (isSchedulingReplacement) {
    drawerTitle = "Agendar reposição";
  } else if (isReschedulingSession) {
	    drawerTitle = "Editar agendamento";
  } else if (editingId) {
    drawerTitle = "Editar agendamento";
  }

  let drawerSubtitle = "Preencha os dados do atendimento.";
  if (drawerMode === "pending") {
    drawerSubtitle = "";
	  } else if (drawerMode === "group") {
	    drawerSubtitle = groupContext ? formatDateTime(groupContext.date) : "";
  } else if (isSchedulingReplacement) {
    drawerSubtitle = "Reposição pendente";
  } else if (editingId) {
    drawerSubtitle = editingBillingSummary || "";
  }

  let submitButtonLabel = "Criar agendamento";
  if (isSaving) {
    submitButtonLabel = "Processando...";
  } else if (isSchedulingReplacement) {
    submitButtonLabel = "Agendar reposição";
	  } else if (editingId) {
	    submitButtonLabel = "Salvar";
  }

  let notesFieldLabel = "Observações";
	  if (editingId) {
	    notesFieldLabel = "Motivo da alteração";
  }

  let temporalPeriodLabel = formatDayPeriodLabel(selectedDate);
  if (view === "week") {
    temporalPeriodLabel = formatWeekRange(weekDays[0], weekDays[weekDays.length - 1]);
  } else if (view === "month") {
    temporalPeriodLabel = formatMonthPeriodLabel(selectedDate);
  }

  return (
    <PageWrapper $paddingTop="90px" $paddingBottom="60px">
      <PageContent $maxWidth="1280px" $paddingX="30px" $paddingTop="0" $paddingBottom="0" $mobileBreakpoint="859px" $mobilePaddingX="15px" $mobilePaddingTop="0" $mobilePaddingBottom="0">
        <Header>
          <div>
            <h1 className="font40 extraBold">Agendamentos</h1>
            <p className="font15">
              {/* Visualize por semana, dia ou mes e edite com painel lateral. */}
            </p>
          </div>
          <ToolbarActions>
            <NotificationButton
              type="button"
              onClick={togglePendingDrawer}
              $active={isDrawerOpen && drawerMode === "pending"}
              aria-label={`Abrir central de pendencias. ${pendingCenterTotal} pendencias.`}
            >
              <FaBell />
              <NotificationBadge $hasPending={pendingCenterTotal > 0}>
                {pendingCenterTotal > 99 ? "99+" : pendingCenterTotal}
              </NotificationBadge>
            </NotificationButton>
            <ToolbarLink
              to="/agendamentos/eventos"
              aria-label="Configurações da agenda"
              title="Configurações da agenda"
            >
              <FaCog aria-hidden="true" />
            </ToolbarLink>
            <PrimaryButton
              type="button"
              $topAction
              onClick={() => {
                resetForm();
                openDrawer();
              }}
            >
              <FaPlus /> Novo agendamento
            </PrimaryButton>
          </ToolbarActions>
        </Header>

        <Toolbar>
          <ViewSwitch>
            <ToggleButton
              type="button"
              $active={view === "day"}
              onClick={() => setView("day")}
            >
              Dia
            </ToggleButton>
            <ToggleButton
              type="button"
              $active={view === "week"}
              onClick={() => setView("week")}
            >
              Semana
            </ToggleButton>
            <ToggleButton
              type="button"
              $active={view === "month"}
              onClick={() => setView("month")}
            >
              Mês
            </ToggleButton>
          </ViewSwitch>
          <DateNav>
            <NavButton type="button" onClick={handlePrev}>
              <FaChevronLeft />
            </NavButton>
            <DateContext>
              <DateLabel>{temporalPeriodLabel}</DateLabel>
            </DateContext>
            <NavButton type="button" onClick={handleNext}>
              <FaChevronRight />
            </NavButton>
          </DateNav>
          <TemporalActions>
            {view === "day" && (
              <SecondaryButton type="button" $navAction onClick={handleToday}>
                Hoje
              </SecondaryButton>
            )}
            {view === "week" && (
              <SecondaryButton type="button" $navAction onClick={handleToday}>
                Hoje
              </SecondaryButton>
            )}
            {view === "month" && (
              <WeekendToggleButton
                type="button"
                $active={showMonthWeekend}
                onClick={() => setShowMonthWeekend((prev) => !prev)}
              >
                {showMonthWeekend ? "Ocultar fim de semana" : "Fins de semana"}
              </WeekendToggleButton>
            )}
            <AgendaRefreshStatus
              $visible={isLoading}
              aria-live="polite"
              aria-hidden={!isLoading}
            >
              <ButtonSpinner aria-hidden="true" />
              <span>Atualizando</span>
            </AgendaRefreshStatus>
          </TemporalActions>
        </Toolbar>

        <AgendaControls>
          <FiltersRow>
            <FilterField>
              <span>Status</span>
              <select name="status" value={filters.status} onChange={handleFilterChange}>
                <option value="">Todos</option>
                {statusOptions.length === 0 && (
                  SESSION_STATUS_OPTIONS.map((status) => (
                    <option key={status.value} value={status.value}>
                      {status.label}
                    </option>
                  ))
                )}
                {statusOptions.map((status) => (
                  <option key={status.code} value={status.code}>
                    {status.label || status.code}
                  </option>
                ))}
              </select>
            </FilterField>
            <SearchFilterField>
              <CompactPatientSearchField
                mode="filter"
                value={filterPatientQuery}
                onChange={setFilterPatientQuery}
              />
            </SearchFilterField>
          </FiltersRow>
          <ServicesControl>
            <ServicesLabel>Serviços</ServicesLabel>
            {isBaseDataLoading && (
              <LegendLoading>Carregando serviços...</LegendLoading>
            )}
            {!isBaseDataLoading && allServiceOptions.length > 0 && (
              <Legend aria-label="Filtrar agenda por serviço">
                {allServiceOptions.map((service) => (
                  <LegendItem
                    key={service.id ? `id-${service.id}` : `code-${service.code}`}
                    type="button"
                    $active={filters.service_type === service.code}
                    $muted={!!filters.service_type && filters.service_type !== service.code}
                    aria-pressed={filters.service_type === service.code}
                    onClick={() => handleServiceFilterChange(service.code)}
                  >
                    <TypePill
                      $type={service.code}
                      $color={service.color}
                      $active={filters.service_type === service.code}
                      $muted={!!filters.service_type && filters.service_type !== service.code}
                    >
                      {service.name}
                    </TypePill>
                  </LegendItem>
                ))}
              </Legend>
            )}
          </ServicesControl>
        </AgendaControls>

        <AgendaContentArea>
          <AgendaRefreshLine $visible={isLoading} aria-hidden="true" />
          <AgendaContentBody $loading={isLoading}>
            {view === "week" && (
              <WeekGrid>
                <WeekHeader>
                  <div />
                  {weekDays.map((day) => (
                    <WeekHeaderCell
                      key={day.toISOString()}
                      onClick={() => {
                        setSelectedDate(day);
                        setView("day");
                      }}
                    >
                      <span>{day.toLocaleDateString("pt-BR", { weekday: "short" })}</span>
                      <strong>{day.getDate()}</strong>
                      {specialEventsByDay.get(startOfDay(day).toISOString()) && (
                        <DaySpecialBadge
                          $severity={
                            specialEventsByDay.get(startOfDay(day).toISOString()).severity
                          }
                          title={buildSpecialEventsTooltip(
                            specialEventsByDay.get(startOfDay(day).toISOString()).events,
                          )}
                        >
                          <span>
                            {daySummaryLabel(
                              specialEventsByDay.get(startOfDay(day).toISOString()),
                            )}
                          </span>
                          <strong>
                            {
                              specialEventsByDay.get(startOfDay(day).toISOString()).events
                                .length
                            }
                          </strong>
                        </DaySpecialBadge>
                      )}
                    </WeekHeaderCell>
                  ))}
                </WeekHeader>
                <WeekBody>
                  {Array.from({ length: END_HOUR - START_HOUR + 1 }).map((_, index) => {
                    const hour = START_HOUR + index;
                    const startingPeriod =
                      WEEK_PERIODS.find((period) => period.startHour === hour) || null;
                    const currentPeriod =
                      WEEK_PERIODS.find(
                        (period) => hour >= period.startHour && hour <= period.endHour,
                      ) || WEEK_PERIODS[WEEK_PERIODS.length - 1];
                    const isPeriodExpanded = expandedPeriods[currentPeriod.key] !== false;
                    const isHourExpanded = expandedHours.has(hour);
                    const rowHasMore = weekDays.some((day) => {
                      const groups = getSlotGroups(day, hour);
                      const totalSessions = groups.reduce((sum, group) => sum + group.total, 0);
                      return totalSessions > MAX_WEEK_SLOT_VISIBLE;
                    });
                    return (
                      <React.Fragment key={hour}>
                        {startingPeriod && (
                          <WeekPeriodRow>
                            <WeekPeriodSpacer />
                            <WeekPeriodToggle
                              type="button"
                              $expanded={isPeriodExpanded}
                              onClick={() => toggleExpandedPeriod(startingPeriod.key)}
                              aria-label={
                                isPeriodExpanded
                                  ? `Recolher período ${startingPeriod.label}`
                                  : `Expandir período ${startingPeriod.label}`
                              }
                            >
                              <WeekPeriodLabel>{startingPeriod.label}</WeekPeriodLabel>
                              <WeekPeriodMeta>
                                {formatHourLabel(startingPeriod.startHour)} as{" "}
                                {formatHourLabel(startingPeriod.endHour)}
                              </WeekPeriodMeta>
                              <WeekPeriodArrow>{isPeriodExpanded ? "▲" : "▾"}</WeekPeriodArrow>
                            </WeekPeriodToggle>
                          </WeekPeriodRow>
                        )}
                        {isPeriodExpanded && (
                          <WeekRow key={`row-${hour}`} $striped={hour % 2 === 0}>
                            <TimeCell $striped={hour % 2 === 0}>
                              <span>{`${hour.toString().padStart(2, "0")}:00`}</span>
                              {rowHasMore && (
                                <HourExpandToggle
                                  type="button"
                                  $expanded={isHourExpanded}
                                  aria-label={
                                    isHourExpanded
                                      ? `Recolher agendamentos das ${hour
                                        .toString()
                                        .padStart(2, "0")}:00`
                                      : `Expandir agendamentos das ${hour
                                        .toString()
                                        .padStart(2, "0")}:00`
                                  }
                                  title={
                                    isHourExpanded
                                      ? `Recolher agendamentos das ${hour
                                        .toString()
                                        .padStart(2, "0")}:00`
                                      : `Expandir agendamentos das ${hour
                                        .toString()
                                        .padStart(2, "0")}:00`
                                  }
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleExpandedHour(hour);
                                  }}
                                >
                                  {isHourExpanded ? "▲" : "▾"}
                                </HourExpandToggle>
                              )}
                            </TimeCell>
                            {weekDays.map((day) => {
                              const slotDate = new Date(day);
                              slotDate.setHours(hour, 0, 0, 0);
                              const groups = getSlotGroups(day, hour);
                              const allItems = groups.flatMap((group) => {
                                const color =
                                  group.service?.color || serviceColor(group.service_type);
                                return group.sessions
                                  .map((session) => ({ session, group, color }));
                              });
                              const visibleItems = isHourExpanded
                                ? allItems
                                : allItems.slice(0, MAX_WEEK_SLOT_VISIBLE);
	                              const hiddenCount = allItems.length - MAX_WEEK_SLOT_VISIBLE;
	                              return (
	                                <SlotCell
                                  key={`${day.toISOString()}-${hour}`}
                                  $striped={hour % 2 === 0}
                                  onClick={() => handleCreateAt(slotDate)}
                                  onDragOver={handleDragOver}
                                  onDrop={(event) => handleDropAt(event, slotDate)}
                                >
                                  {visibleItems.map(({ session, group, color }) => (
                                    <WeekSlotSessionPill
                                      key={`${session.id}-${day.toISOString()}-${hour}`}
                                      session={session}
                                      group={group}
                                      color={color}
                                      statusTone={statusStyle(session.status)}
                                      patientName={getSessionPatientName(session)}
                                      isHistory={isHistoricalSessionStatus(session.status)}
                                      attentionLevel={getSessionPatientAttentionLevel(session)}
                                      onOpen={(event) => {
                                        event.stopPropagation();
                                        handleOpenGroup(slotDate);
                                      }}
                                    />
                                  ))}
	                                  {hiddenCount > 0 && (
	                                    <OverflowIndicatorBadge
	                                      type="button"
	                                      $expanded={isHourExpanded}
	                                      title={
	                                        isHourExpanded
	                                          ? "Ver menos agendamentos neste horário"
	                                          : `${hiddenCount} paciente(s) a mais neste horário`
	                                      }
	                                      aria-label={
	                                        isHourExpanded
	                                          ? "Ver menos agendamentos neste horário"
	                                          : `Ver mais ${hiddenCount} agendamento(s) neste horário`
	                                      }
	                                      onClick={(event) => {
	                                        event.stopPropagation();
	                                        toggleExpandedHour(hour);
	                                      }}
	                                    >
	                                      <span>{isHourExpanded ? "Ver menos" : `+${hiddenCount} mais`}</span>
	                                      <WeekOverflowArrow aria-hidden="true">
	                                        {isHourExpanded ? "▲" : "▼"}
	                                      </WeekOverflowArrow>
	                                    </OverflowIndicatorBadge>
	                                  )}
                                </SlotCell>
                              );
                            })}
                          </WeekRow>
                        )}
                      </React.Fragment>
                    );
                  })}
                </WeekBody>
              </WeekGrid>
            )}
            {view === "day" && (
              <DayPanel>
                <DayHeader>
                  <h2>{formatDate(selectedDate)}</h2>
                  <SecondaryButton type="button" onClick={() => handleCreateAt(selectedDate)}>
                    Adicionar horario
                  </SecondaryButton>
                </DayHeader>
                {selectedDaySpecialSummary && (
                  <DaySpecialStateBanner $severity={selectedDaySpecialSummary.severity}>
                    <strong>{selectedDaySpecialTitle}</strong>
                    <span>
                      {daySummaryLabel(selectedDaySpecialSummary)}
                      {" - "}
                      {selectedDaySpecialSummary.events.length} evento(s) no dia.
                    </span>
                  </DaySpecialStateBanner>
                )}
                {selectedDaySpecialEvents.length > 0 && (
                  <DaySpecialList>
                    {selectedDaySpecialEvents.map((event) => (
                      <DaySpecialItem key={`${event.id}-${event.start_date}`} $severity={event.severity}>
                        <strong>{event.name}</strong>
                        <span>
                          {SPECIAL_SOURCE_LABELS[event.source_type] || event.source_type}
                          {" · "}
                          {eventSeverityLabel(event.severity)}
                        </span>
                        <small>{eventBehaviorLabel(event)}</small>
                      </DaySpecialItem>
                    ))}
                  </DaySpecialList>
                )}
                {daySessions.length === 0 && (
                  <EmptyState>Nenhum agendamento para este dia.</EmptyState>
                )}
                {daySessions.length > 0 && (
                  <DayList>
                    {daySessionGroups.map((timeGroup) => (
                      <DayTimeGroup key={timeGroup.key}>
	                        <DayTimeHeader>
	                          <strong>{timeGroup.label}</strong>
	                          {timeGroup.serviceGroups.some((serviceGroup) =>
	                            serviceGroup.cards.some((card) => !isHistoricalSessionStatus(card.session?.status)),
	                          ) && (
	                            <AttendanceCallButton
	                              type="button"
	                              onClick={() => handleOpenAttendanceCall({ timeGroup })}
	                            >
	                              Fazer chamada
	                            </AttendanceCallButton>
	                          )}
	                        </DayTimeHeader>
	                        <DayCardsColumn>
	                          {timeGroup.serviceGroups.map((serviceGroup) => {
	                            const activeCards = serviceGroup.cards.filter(
	                              (card) => !isHistoricalSessionStatus(card.session?.status),
	                            );
	                            if (activeCards.length === 0) return null;
	                            return (
	                              <DayServiceGroupBlock key={`${timeGroup.key}-${serviceGroup.key}`}>
	                                <DayServiceGroupHeader>
	                                  <DayServiceGroupBadge
	                                    $type={serviceGroup.serviceCode}
	                                    $color={serviceGroup.serviceColor}
	                                  >
	                                    {serviceGroup.serviceLabel}
	                                  </DayServiceGroupBadge>
	                                </DayServiceGroupHeader>
	                                <DayServiceCards>
	                                  {activeCards.map((card) => {
	                                  const { session } = card;
	                                  const tone = statusStyle(session.status);
                                  const patientName = getSessionPatientName(session);
                                  const shortPatientName = getShortPatientName(patientName);
                                  const patientId = getSessionPatientId(session);
                                  const attentionLevel = getSessionPatientAttentionLevel(session);
                                  const sessionMetaParts = getSessionCardMetaParts(session);
                                  const daySessionId = String(session.id);
                                  const isDaySessionSaving = savingSessionIds.has(daySessionId);
                                  const statusMenuKey = `day-status-${daySessionId}`;
                                  const actionsMenuKey = `day-actions-${daySessionId}`;
                                  const currentStatusLabel = isDaySessionSaving
                                    ? "Salvando..."
                                    : getSessionStatusLabel(session.status);
                                  return (
                                    <DaySessionCard
                                      key={card.key}
                                      data-id={session.id}
                                      draggable
                                      onDragStart={handleDragStart}
                                      $status={tone}
                                    >
                                      <DayServiceBar $color={card.serviceColor} />
	                                      <DaySessionBody>
		                                        <DaySessionTop>
		                                          <DaySessionPatient>
		                                            {renderPatientAttentionIndicator(attentionLevel)}
		                                            {patientId ? (
		                                              <PatientProfileLink to={`/pacientes/${patientId}`} title={patientName}>
		                                                <PatientInlineText>{shortPatientName}</PatientInlineText>
		                                              </PatientProfileLink>
		                                            ) : (
		                                              <PatientInlineText>{shortPatientName}</PatientInlineText>
		                                            )}
		                                            <CompactSessionType>{sessionMetaParts.type}</CompactSessionType>
		                                            <CompactSessionCounter>{sessionMetaParts.counter}</CompactSessionCounter>
		                                          </DaySessionPatient>
                                          <DaySessionActions>
                                            <DayDropdownWrapper>
                                              <DayStatusMenuButton
                                                type="button"
                                                $status={statusStyle(session.status)}
                                                disabled={isDaySessionSaving}
                                                onClick={(event) => {
                                                  event.stopPropagation();
                                                  setOpenActionMenu(
                                                    openActionMenu === statusMenuKey ? null : statusMenuKey,
                                                  );
                                                }}
                                              >
                                                {currentStatusLabel} <span>▼</span>
                                              </DayStatusMenuButton>
                                              {openActionMenu === statusMenuKey && (
                                                <ActionsDropdown onClick={(event) => event.stopPropagation()}>
                                                  <GroupStatusButton
                                                    type="button"
                                                    data-id={session.id}
                                                    data-status="scheduled"
                                                    $status="scheduled"
                                                    $active={isSessionStatusActive(session.status, "scheduled")}
                                                    onClick={(event) => { handleQuickStatus(event); setOpenActionMenu(null); }}
                                                  >
                                                    Agendado
                                                  </GroupStatusButton>
                                                  <GroupStatusButton
                                                    type="button"
                                                    data-id={session.id}
                                                    data-status="done"
                                                    $status="done"
                                                    $active={isSessionStatusActive(session.status, "done")}
                                                    onClick={(event) => { handleQuickStatus(event); setOpenActionMenu(null); }}
                                                  >
                                                    Concluir
                                                  </GroupStatusButton>
                                                  <GroupStatusButton
                                                    type="button"
                                                    data-id={session.id}
                                                    data-status="no_show"
                                                    $status="no_show"
                                                    $active={isSessionStatusActive(session.status, "no_show")}
                                                    onClick={(event) => { handleAbsence(event); setOpenActionMenu(null); }}
                                                  >
                                                    Marcar falta
                                                  </GroupStatusButton>
                                                  <GroupStatusButton
                                                    type="button"
                                                    data-id={session.id}
                                                    data-status="canceled"
                                                    $status="canceled"
                                                    $active={isSessionStatusActive(session.status, "canceled")}
                                                    onClick={(event) => { handleAbsence(event); setOpenActionMenu(null); }}
                                                  >
                                                    Cancelar
                                                  </GroupStatusButton>
                                                </ActionsDropdown>
                                              )}
                                            </DayDropdownWrapper>
                                            <DayDropdownWrapper>
                                              <DayKebabButton
                                                type="button"
                                                aria-label="Ações da sessão"
                                                onClick={(event) => {
                                                  event.stopPropagation();
                                                  setOpenActionMenu(
                                                    openActionMenu === actionsMenuKey ? null : actionsMenuKey,
                                                  );
                                                }}
                                              >
                                                ⋮
                                              </DayKebabButton>
                                              {openActionMenu === actionsMenuKey && (
                                                <ActionsDropdown onClick={(event) => event.stopPropagation()}>
                                                  <ActionsDropdownItem
                                                    type="button"
                                                    data-id={session.id}
                                                    onClick={(event) => { handleEdit(event); setOpenActionMenu(null); }}
                                                  >
                                                    Editar agendamento
                                                  </ActionsDropdownItem>
                                                  <ActionsDropdownItem
                                                    type="button"
                                                    $danger
                                                    onClick={() => { handleOpenDelete(session); setOpenActionMenu(null); }}
                                                  >
                                                    Remover da agenda
                                                  </ActionsDropdownItem>
                                                </ActionsDropdown>
                                              )}
                                            </DayDropdownWrapper>
                                          </DaySessionActions>
                                        </DaySessionTop>
                                      </DaySessionBody>
	                                    </DaySessionCard>
	                                  );
	                                })}
	                                </DayServiceCards>
	                              </DayServiceGroupBlock>
	                            );
	                          })}
	                          {timeGroup.serviceGroups.some((serviceGroup) =>
	                            serviceGroup.cards.some((card) => isHistoricalSessionStatus(card.session?.status)),
	                          ) && (
	                            <DayHistoryBlock>
	                          <DayHistoryTitle>Histórico</DayHistoryTitle>
	                              <DayServiceCards>
	                                {timeGroup.serviceGroups.flatMap((serviceGroup) =>
	                                  serviceGroup.cards
	                                    .filter((card) => isHistoricalSessionStatus(card.session?.status))
	                                    .map((card) => {
	                                      const { session } = card;
	                                      const tone = statusStyle(session.status);
		                                      const patientName = getSessionPatientName(session);
		                                      const shortPatientName = getShortPatientName(patientName);
		                                      const patientId = getSessionPatientId(session);
	                                      const attentionLevel = getSessionPatientAttentionLevel(session);
	                                      const sessionMetaParts = getSessionCardMetaParts(session);
	                                      const daySessionId = String(session.id);
	                                      const isDaySessionSaving = savingSessionIds.has(daySessionId);
	                                      const statusMenuKey = `day-status-${daySessionId}`;
	                                      const actionsMenuKey = `day-actions-${daySessionId}`;
	                                      const currentStatusLabel = isDaySessionSaving
	                                        ? "Salvando..."
	                                        : getSessionStatusLabel(session.status);
	                                      return (
	                                        <DaySessionCard
	                                          key={`history-${card.key}`}
	                                          data-id={session.id}
	                                          $status={tone}
	                                          $history
	                                        >
	                                          <DayServiceBar $color={card.serviceColor} $history />
		                                          <DaySessionBody>
			                                            <DaySessionTop>
			                                              <DaySessionPatient>
			                                                {renderPatientAttentionIndicator(attentionLevel)}
			                                                {patientId ? (
			                                                  <PatientProfileLink to={`/pacientes/${patientId}`} title={patientName}>
			                                                    <PatientInlineText>{shortPatientName}</PatientInlineText>
			                                                  </PatientProfileLink>
			                                                ) : (
			                                                  <PatientInlineText>{shortPatientName}</PatientInlineText>
			                                                )}
			                                                <CompactSessionType>{sessionMetaParts.type}</CompactSessionType>
			                                                <CompactSessionCounter>{sessionMetaParts.counter}</CompactSessionCounter>
			                                              </DaySessionPatient>
	                                              <DaySessionActions>
	                                                <DayDropdownWrapper>
	                                                  <DayStatusMenuButton
	                                                    type="button"
	                                                    $status={statusStyle(session.status)}
	                                                    disabled={isDaySessionSaving}
	                                                    onClick={(event) => {
	                                                      event.stopPropagation();
	                                                      setOpenActionMenu(
	                                                        openActionMenu === statusMenuKey ? null : statusMenuKey,
	                                                      );
	                                                    }}
	                                                  >
	                                                    {currentStatusLabel} <span>▾</span>
	                                                  </DayStatusMenuButton>
	                                                  {openActionMenu === statusMenuKey && (
	                                                    <ActionsDropdown onClick={(event) => event.stopPropagation()}>
	                                                      <GroupStatusButton
	                                                        type="button"
	                                                        data-id={session.id}
	                                                        data-status="scheduled"
	                                                        $status="scheduled"
	                                                        $active={isSessionStatusActive(session.status, "scheduled")}
	                                                        onClick={(event) => { handleQuickStatus(event); setOpenActionMenu(null); }}
	                                                      >
	                                                        Agendado
	                                                      </GroupStatusButton>
	                                                      <GroupStatusButton
	                                                        type="button"
	                                                        data-id={session.id}
	                                                        data-status="done"
	                                                        $status="done"
	                                                        $active={isSessionStatusActive(session.status, "done")}
	                                                        onClick={(event) => { handleQuickStatus(event); setOpenActionMenu(null); }}
	                                                      >
	                                                        Concluir
	                                                      </GroupStatusButton>
	                                                      <GroupStatusButton
	                                                        type="button"
	                                                        data-id={session.id}
	                                                        data-status="no_show"
	                                                        $status="no_show"
	                                                        $active={isSessionStatusActive(session.status, "no_show")}
	                                                        onClick={(event) => { handleAbsence(event); setOpenActionMenu(null); }}
	                                                      >
	                                                        Marcar falta
	                                                      </GroupStatusButton>
	                                                      <GroupStatusButton
	                                                        type="button"
	                                                        data-id={session.id}
	                                                        data-status="canceled"
	                                                        $status="canceled"
	                                                        $active={isSessionStatusActive(session.status, "canceled")}
	                                                        onClick={(event) => { handleAbsence(event); setOpenActionMenu(null); }}
	                                                      >
	                                                        Cancelar
	                                                      </GroupStatusButton>
	                                                    </ActionsDropdown>
	                                                  )}
	                                                </DayDropdownWrapper>
	                                                <DayDropdownWrapper>
	                                                  <DayKebabButton
	                                                    type="button"
		                                                    aria-label="Ações da sessão"
	                                                    onClick={(event) => {
	                                                      event.stopPropagation();
	                                                      setOpenActionMenu(
	                                                        openActionMenu === actionsMenuKey ? null : actionsMenuKey,
	                                                      );
	                                                    }}
	                                                  >
	                                                    ⋮
	                                                  </DayKebabButton>
	                                                  {openActionMenu === actionsMenuKey && (
	                                                    <ActionsDropdown onClick={(event) => event.stopPropagation()}>
	                                                      <ActionsDropdownItem
	                                                        type="button"
	                                                        data-id={session.id}
	                                                        onClick={(event) => { handleEdit(event); setOpenActionMenu(null); }}
	                                                      >
			                                                        Editar agendamento
	                                                      </ActionsDropdownItem>
	                                                      <ActionsDropdownItem
	                                                        type="button"
	                                                        $danger
	                                                        onClick={() => { handleOpenDelete(session); setOpenActionMenu(null); }}
	                                                      >
		                                                        Remover da agenda
	                                                      </ActionsDropdownItem>
	                                                    </ActionsDropdown>
	                                                  )}
	                                                </DayDropdownWrapper>
	                                              </DaySessionActions>
	                                            </DaySessionTop>
	                                          </DaySessionBody>
	                                        </DaySessionCard>
	                                      );
	                                    }),
	                                )}
	                              </DayServiceCards>
	                            </DayHistoryBlock>
	                          )}
	                        </DayCardsColumn>
                      </DayTimeGroup>
                    ))}
                  </DayList>
                )}
              </DayPanel>
            )}

            {view === "month" && (
              <MonthPanel>
                <MonthGrid $cols={showMonthWeekend ? 7 : 5}>
                  {(showMonthWeekend
                    ? ["Seg", "Ter", "Qua", "Qui", "Sex", "Sab", "Dom"]
                    : ["Seg", "Ter", "Qua", "Qui", "Sex"]
                  ).map((label) => (
                    <MonthHeader key={label}>{label}</MonthHeader>
                  ))}
                  {visibleMonthDays.map((day) => {
                    const key = startOfDay(day).toISOString();
                    return (
                      <MonthAgendaCell
                        key={day.toISOString()}
                        day={day}
                        isCurrentMonth={day.getMonth() === selectedDate.getMonth()}
                        isActive={sameDay(day, selectedDate)}
                        daySummary={monthServicesByDay.get(key)}
                        specialSummary={specialEventsByDay.get(key)}
                        onOpenDay={() => {
                          setSelectedDate(day);
                          setView("day");
                        }}
                      />
                    );
                  })}
                </MonthGrid>
                <MonthHint>
                  Clique em um dia para abrir a agenda detalhada.
                </MonthHint>
              </MonthPanel>
            )}
          </AgendaContentBody>
        </AgendaContentArea>

        <AppDrawer $open={isDrawerOpen}>
          <DrawerHeader>
            <div>
              <h2>
                {drawerTitle}
              </h2>
              <DrawerSubtitle
                $prominent={drawerMode === "group"}
                $billingSummary={Boolean(editingId && drawerSubtitle)}
              >
                {drawerSubtitle}
              </DrawerSubtitle>
            </div>
            <IconButton type="button" onClick={closeDrawer}>
              <FaTimes />
            </IconButton>
          </DrawerHeader>
          <DrawerBody>
            <Loading isLoading={isSaving} />
            {drawerMode === "pending" && (
              <PendingDrawerPanel>
                {isOperationalAlertsLoading && (
                  <PendingCenterHint>Atualizando alertas operacionais...</PendingCenterHint>
                )}
                {pendingCenterSections.length === 0 && (
                  <EmptyState>Nenhuma pendencia no momento.</EmptyState>
                )}
                {pendingCenterSections.length > 0 && pendingCenterSelectedItem && (
                  <PendingCategoryDetails>
                    <PendingBackButton
                      type="button"
                      onClick={() => setPendingCenterSelectedItemKey(null)}
                    >
                      {"<-"} Voltar
                    </PendingBackButton>
                    <PendingDetailHeader>
                      <PendingGroupTitle>{pendingCenterSelectedItem.label}</PendingGroupTitle>
                      <PendingCountBadge $empty={pendingCenterSelectedItem.count === 0}>
                        {pendingCenterSelectedItem.count}
                      </PendingCountBadge>
                    </PendingDetailHeader>
                    {pendingCenterSelectedItem.count === 0 && (
                      <EmptyState>Nenhuma pendência nesta categoria.</EmptyState>
                    )}
                    {pendingCenterSelectedItem.count > 0 && pendingCenterSelectedItem.kind === "attendance" && (
                      <PendingGroupDetails>
                        {pendingConfirmationGroups.map((group) => (
                          <PendingDayRow key={group.key}>
                            <div>
                              <strong>{formatPendingDayLabel(group.date)}</strong>
                              <span>
                                {group.sessionCount} atendimento
                                {group.sessionCount > 1 ? "s" : ""}
                              </span>
                            </div>
                            <PendingOpenDayButton
                              type="button"
                              onClick={() => handleOpenPendingDay(group.date)}
                            >
                              Abrir na agenda
                            </PendingOpenDayButton>
                          </PendingDayRow>
                        ))}
                      </PendingGroupDetails>
                    )}
                    {pendingCenterSelectedItem.count > 0 &&
                      pendingCenterSelectedItem.key === "standalone_session_credit_expiring" && (
                        <PendingGroupDetails>
                          {groupStandaloneCreditAlerts(pendingCenterSelectedItem.alerts).map((item) => (
                            <PendingPatientCard key={item.key}>
                              <PendingPatientName>
                                {item.patientId ? (
                                  <Link to={`/pacientes/${item.patientId}`}>
                                    {item.patientName}
                                  </Link>
                                ) : (
                                  item.patientName
                                )}
                              </PendingPatientName>
                              <PendingNestedList>
                                {item.services.map((service) => (
                                  <PendingNestedRow key={service.key}>
                                    <span>
                                      {service.serviceName} — {pluralizeSession(service.remainingSessions)}
                                    </span>
                                    <PendingDismissButton
                                      type="button"
                                      onClick={() => handleDismissStandaloneCreditAlerts(service.alerts)}
                                    >
                                      Não renovar agora
                                    </PendingDismissButton>
                                  </PendingNestedRow>
                                ))}
                              </PendingNestedList>
                            </PendingPatientCard>
                          ))}
                        </PendingGroupDetails>
                      )}
                    {pendingCenterSelectedItem.count > 0 &&
                      isPlanOperationalAlert(pendingCenterSelectedItem.key) && (
                        <PendingGroupDetails>
                          {groupPlanAlertsByPatient(pendingCenterSelectedItem.alerts).map((item) => (
                            <PendingPatientCard key={item.key}>
                              <PendingPatientName>
                                {item.patientId ? (
                                  <Link to={`/pacientes/${item.patientId}`}>
                                    {item.patientName}
                                  </Link>
                                ) : (
                                  item.patientName
                                )}
                              </PendingPatientName>
                              <PendingNestedList>
                                {item.plans.map(({ key, alert }) => (
                                  <PendingNestedRow key={key}>
                                    <div>
                                      <span>
                                        {alert.details?.plan_name || alert.status?.split(" - ")?.[0] || "Plano"}
                                      </span>
                                      <PendingPlanDueText $overdue={alert.type === "patient_plan_overdue" || alert.type === "patient_plan_pause_overdue"}>
                                        {getPlanAlertDueText(alert)}
                                      </PendingPlanDueText>
                                    </div>
                                    <PendingPlanLink to={getPlanAlertLink(alert)}>
                                      Ver plano
                                    </PendingPlanLink>
                                  </PendingNestedRow>
                                ))}
                              </PendingNestedList>
                            </PendingPatientCard>
                          ))}
                        </PendingGroupDetails>
                      )}
                    {pendingCenterSelectedItem.count > 0 &&
                      pendingCenterSelectedItem.key === "patient_birthday" && (
                        <BirthdayAlertList>
                          {groupBirthdayAlertsByDate(pendingCenterSelectedItem.alerts).map((group) => (
                            <BirthdayDateGroup key={group.key}>
                              <BirthdayDateHeader>
                                <strong>{getBirthdayGroupTitle(group)}</strong>
                                <span>{getBirthdayGroupSubtitle(group)}</span>
                              </BirthdayDateHeader>
                              <BirthdayPatientList>
                                {group.alerts.map((alert) => (
                                  <BirthdayPatientRow key={alert.centerKey}>
                                    <BirthdayIcon aria-hidden="true">
                                      <FaBirthdayCake />
                                    </BirthdayIcon>
                                    <BirthdayPatientName>
                                      {alert.patient_id ? (
                                        <Link to={`/pacientes/${alert.patient_id}`}>
                                          {alert.patient_name}
                                        </Link>
                                      ) : (
                                        alert.patient_name
                                      )}
                                    </BirthdayPatientName>
                                  </BirthdayPatientRow>
                                ))}
                              </BirthdayPatientList>
                            </BirthdayDateGroup>
                          ))}
                        </BirthdayAlertList>
                      )}
                    {pendingCenterSelectedItem.count > 0 &&
                      pendingCenterSelectedItem.key === "replacement_credit" && (
                        <PendingGroupDetails>
	                          {pendingCenterSelectedItem.alerts.map((alert) => (
	                            <PendingPatientCard key={alert.centerKey}>
	                              <PendingPatientName>
	                                {alert.patient_id ? (
	                                  <Link to={`/pacientes/${alert.patient_id}`}>
	                                    {alert.patient_name}
	                                  </Link>
	                                ) : (
	                                  alert.patient_name
	                                )}
	                              </PendingPatientName>
	                              <PendingNestedRow>
	                                <div>
	                                  <span>{alert.details?.source_service_name || "Reposição pendente"}</span>
	                                  <small>{alert.status}</small>
	                                </div>
	                                <PendingDismissButton
	                                  type="button"
	                                  onClick={() => handleScheduleReplacement(alert)}
	                                >
	                                  Agendar reposição
	                                </PendingDismissButton>
	                              </PendingNestedRow>
	                            </PendingPatientCard>
	                          ))}
	                        </PendingGroupDetails>
	                      )}
                    {pendingCenterSelectedItem.kind === "operational-alert" &&
                      pendingCenterSelectedItem.count > 0 &&
                      pendingCenterSelectedItem.key !== "standalone_session_credit_expiring" &&
                      !isPlanOperationalAlert(pendingCenterSelectedItem.key) &&
                      pendingCenterSelectedItem.key !== "patient_birthday" &&
                      pendingCenterSelectedItem.key !== "replacement_credit" && (
                        <PendingGroupDetails>
                          {pendingCenterSelectedItem.alerts.map((alert) => (
                            <PendingAlertRow key={alert.centerKey} $severity={alert.severity}>
                              <OperationalAlertTopline>
                                <OperationalAlertSeverity $severity={alert.severity}>
                                  {OPERATIONAL_ALERT_SEVERITY_LABELS[alert.severity] || "Alerta"}
                                </OperationalAlertSeverity>
                                <OperationalAlertType>{alert.type}</OperationalAlertType>
                                {alert.quantity !== null && alert.quantity !== undefined && (
                                  <OperationalAlertQuantity>{alert.quantity}</OperationalAlertQuantity>
                                )}
                              </OperationalAlertTopline>
                              <OperationalAlertBody>
                                <OperationalAlertField>
                                  <span>Paciente</span>
                                  <strong>
                                    {alert.patient_id ? (
                                      <Link to={`/pacientes/${alert.patient_id}`}>
                                        {alert.patient_name}
                                      </Link>
                                    ) : (
                                      alert.patient_name
                                    )}
                                  </strong>
                                </OperationalAlertField>
                                <OperationalAlertField>
                                  <span>Info principal</span>
                                  <strong>{alert.title}</strong>
                                </OperationalAlertField>
                                <OperationalAlertField>
                                  <span>Estado atual</span>
                                  <strong>
                                    {alert.status}
                                    {alert.due_date ? ` - ${getOperationalAlertDueLabel(alert)} ${alert.due_date}` : ""}
                                  </strong>
                                </OperationalAlertField>
                                <OperationalAlertAction>
                                  <span>Orientacao</span>
                                  <strong>{alert.suggested_action}</strong>
                                </OperationalAlertAction>
                              </OperationalAlertBody>
                            </PendingAlertRow>
                          ))}
                        </PendingGroupDetails>
                      )}
                  </PendingCategoryDetails>
                )}
                {pendingCenterSections.length > 0 && !pendingCenterSelectedItem && (
                  <PendingCenterSections>
                    {pendingCenterSections.map((section) => (
                      <PendingCenterSection key={section.key}>
                        <PendingSectionTitle>{section.label}</PendingSectionTitle>
                        <PendingGroupList>
                          {section.items.map((item) => (
                            <PendingCategoryButton
                              key={item.key}
                              type="button"
                              disabled={item.count === 0}
                              onClick={() => {
                                if (item.count === 0) return;
                                setPendingCenterSelectedItemKey(item.key);
                              }}
                              $empty={item.count === 0}
                            >
                              <PendingGroupHeader>
                                <div>
                                  <PendingGroupTitle>
                                    {item.label}
                                  </PendingGroupTitle>
                                </div>
                                <PendingCountBadge $empty={item.count === 0}>
                                  {item.count}
                                </PendingCountBadge>
                              </PendingGroupHeader>
                            </PendingCategoryButton>
                          ))}
                        </PendingGroupList>
                      </PendingCenterSection>
                    ))}
                  </PendingCenterSections>
                )}
              </PendingDrawerPanel>
            )}
            {drawerMode === "group" && (
              <GroupPanel>
                <GroupHeader>
                  <SecondaryButton
                    type="button"
                    onClick={() => {
                      if (!groupContext?.date) return;
                      resetForm();
                      const endsAt = new Date(groupContext.date);
                      endsAt.setHours(endsAt.getHours() + 1);
                      setDrawerMode("form");
                      setGroupContext(null);
                      setForm((prev) => ({
                        ...prev,
                        starts_at: toInputValue(groupContext.date),
                        ends_at: toInputValue(endsAt),
                      }));
                      setFormPatientQuery("");
                    }}
                  >
                    <FaPlus /> Adicionar paciente
                  </SecondaryButton>
                </GroupHeader>
                {groupSessions.length === 0 && (
                  <EmptyState>Sem pacientes neste horário.</EmptyState>
                )}
                <GroupList>
                  {groupSessions.map((group) => (
                    <GroupSection
                      key={group.service_type}
                      $color={group.service?.color || serviceColor(group.service_type)}
                    >
                      <GroupSectionHeader
                        $color={group.service?.color || serviceColor(group.service_type)}
                      >
                        <GroupSectionTitle>
                          {serviceName(group.service_type)}
                        </GroupSectionTitle>
                        <GroupSectionMeta>
                          {group.count}
                          {group.limit && group.limit > 0 ? ` / ${group.limit}` : ""} pacientes
                        </GroupSectionMeta>
                      </GroupSectionHeader>
                      {group.sessions.map((session) => {
                        const planSummary = getMonthlyPlanSummary(session);
                        const groupRecurringBadge = getRecurringSeriesBadge(session);
                        const groupSessionMeta = planSummary || groupRecurringBadge || null;
                        const groupSessionId = String(session.id);
                        const isGroupSessionSaving = savingSessionIds.has(groupSessionId);
                        const groupSessionSavingAction = savingActionMap[groupSessionId];
	                        const groupStatusMenuKey = `group-status-${groupSessionId}`;
	                        const groupActionsMenuKey = `group-actions-${groupSessionId}`;
	                        const isHistoricalGroupSession = isHistoricalSessionStatus(session.status);
		                        const groupCurrentStatusLabel = isGroupSessionSaving
		                          ? "Salvando..."
		                          : getSessionStatusLabel(session.status);
		                        const groupPatientId = getSessionPatientId(session);
		                        return (
		                          <GroupItem key={session.id} $history={isHistoricalGroupSession}>
		                            <PatientInfo>
		                              <PatientInfoName>
		                                {groupPatientId ? (
		                                  <PatientProfileLink
		                                    to={`/pacientes/${groupPatientId}`}
		                                    title={getSessionPatientName(session)}
		                                  >
		                                    <PatientInlineText>{getSessionPatientName(session)}</PatientInlineText>
		                                  </PatientProfileLink>
		                                ) : (
		                                  <PatientInlineText>{getSessionPatientName(session)}</PatientInlineText>
		                                )}
		                                {renderPatientAttentionIndicator(getSessionPatientAttentionLevel(session))}
	                                {isHistoricalGroupSession && (
	                                  <WeekHistoryStatusBadge $status={statusStyle(session.status)}>
	                                    {getSessionStatusLabel(session.status)}
	                                  </WeekHistoryStatusBadge>
	                                )}
	                              </PatientInfoName>
                              {groupSessionMeta && (
                                <PatientPlanSummary title={groupSessionMeta}>
                                  {groupSessionMeta}
                                </PatientPlanSummary>
                              )}
                              <PatientInfoMeta>
                                <PatientInfoProfessional>
                                  {session?.professional?.name || "Profissional"}
                                </PatientInfoProfessional>
                              </PatientInfoMeta>
                            </PatientInfo>
                            <DaySessionActions>
                              <DayDropdownWrapper>
                                <DayStatusMenuButton
                                  type="button"
                                  $status={statusStyle(session.status)}
                                  disabled={isGroupSessionSaving}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setOpenActionMenu(
                                      openActionMenu === groupStatusMenuKey ? null : groupStatusMenuKey,
                                    );
                                  }}
                                >
                                  {groupCurrentStatusLabel} <span>▼</span>
                                </DayStatusMenuButton>
                                {openActionMenu === groupStatusMenuKey && (
                                  <ActionsDropdown onClick={(e) => e.stopPropagation()}>
                                    <GroupStatusButton
                                      type="button"
                                      data-id={session.id}
                                      data-status="scheduled"
                                      $status="scheduled"
                                      $active={isSessionStatusActive(session.status, "scheduled")}
                                      disabled={isGroupSessionSaving}
                                      onClick={(e) => { handleQuickStatus(e); setOpenActionMenu(null); }}
                                    >
                                      {groupSessionSavingAction === "scheduled" ? "Salvando..." : "Agendado"}
                                    </GroupStatusButton>
                                    <GroupStatusButton
                                      type="button"
                                      data-id={session.id}
                                      data-status="done"
                                      $status="done"
                                      $active={isSessionStatusActive(session.status, "done")}
                                      disabled={isGroupSessionSaving}
                                      onClick={(e) => { handleQuickStatus(e); setOpenActionMenu(null); }}
                                    >
                                      {groupSessionSavingAction === "done" ? "Salvando..." : "Concluir"}
                                    </GroupStatusButton>
                                    <GroupStatusButton
                                      type="button"
                                      data-id={session.id}
                                      data-status="no_show"
                                      $status="no_show"
                                      $active={isSessionStatusActive(session.status, "no_show")}
                                      disabled={isGroupSessionSaving}
                                      onClick={(e) => { handleAbsence(e); setOpenActionMenu(null); }}
                                    >
                                      {groupSessionSavingAction === "no_show" ? "Salvando..." : "Marcar falta"}
                                    </GroupStatusButton>
                                    <GroupStatusButton
                                      type="button"
                                      data-id={session.id}
                                      data-status="canceled"
                                      $status="canceled"
                                      $active={isSessionStatusActive(session.status, "canceled")}
                                      disabled={isGroupSessionSaving}
                                      onClick={(e) => { handleAbsence(e); setOpenActionMenu(null); }}
                                    >
                                      {groupSessionSavingAction === "canceled" ? "Salvando..." : "Cancelar"}
                                    </GroupStatusButton>
                                  </ActionsDropdown>
                                )}
                              </DayDropdownWrapper>
                              <DayDropdownWrapper>
                                <DayKebabButton
                                  type="button"
                                  aria-label="Mais ações da sessão"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setOpenActionMenu(
                                      openActionMenu === groupActionsMenuKey ? null : groupActionsMenuKey,
                                    );
                                  }}
                                >
                                  ⋮
                                </DayKebabButton>
                                {openActionMenu === groupActionsMenuKey && (
                                  <ActionsDropdown onClick={(e) => e.stopPropagation()}>
                                    <ActionsDropdownItem
                                      type="button"
                                      data-id={session.id}
                                      onClick={(e) => { handleEdit(e); setOpenActionMenu(null); }}
                                    >
	                                      Editar agendamento
                                    </ActionsDropdownItem>
                                    <ActionsDropdownItem
                                      type="button"
                                      $danger
                                      onClick={() => { handleOpenDelete(session); setOpenActionMenu(null); }}
                                    >
	                                      Remover da agenda
                                    </ActionsDropdownItem>
                                  </ActionsDropdown>
                                )}
                              </DayDropdownWrapper>
                            </DaySessionActions>
                          </GroupItem>
                        );
                      })}
                    </GroupSection>
                  ))}
                </GroupList>
              </GroupPanel>
            )}
            {drawerMode !== "pending" && drawerMode !== "group" && (
              <Form onSubmit={handleSubmit}>
                <FormGrid>
		                  {editingId || isSchedulingReplacement ? (
		                    <Field className="span-2">
		                      Paciente
		                      <ReadonlyText>{formPatientQuery || "Paciente"}</ReadonlyText>
	                    </Field>
	                  ) : (
                    <PatientSearchField
                      className="span-2"
                      mode="select"
                      required
                      patients={patientOptions}
                      selectedPatientId={form.patient_id}
                      value={formPatientQuery}
                      onChange={(nextValue) => {
                        setFormPatientQuery(nextValue);
                        if (form.patient_id) {
                          setForm((prev) => ({ ...prev, patient_id: "" }));
                        }
                      }}
                      onSelect={handleSelectPatient}
                    />
                  )}
	                  {!editingId && !isSchedulingReplacement && form.patient_id && activePlansForPatient.length > 0 && (
                    <ActivePlansCard className="span-2">
                      {activePlansForPatient.map((p) => {
                        const planServiceName = p.ServicePlan?.Service?.name || p.ServicePlan?.name || "Plano";
                        const freq = compactWeeklyFrequencyLabel(p.ServicePlan);
                        return (
                          <ActivePlanRow key={p.id}>
                            <strong>Plano ativo:</strong> {planServiceName}{freq ? ` · ${freq}` : ""}
                          </ActivePlanRow>
                        );
                      })}
		                    </ActivePlansCard>
		                  )}
	                  <Field>
	                    Tipo de atendimento
		                    {editingId || isSchedulingReplacement ? (
		                      <ReadonlyText>
		                        {isSchedulingReplacement
		                          ? selectedReplacementServiceLabel
		                          : getSessionServiceLabel(editingSession, serviceName) || "Atendimento"}
		                      </ReadonlyText>
	                    ) : (
	                      <SelectionFieldShell>
	                        <SelectionNativeField
	                          name="service_id"
	                          value={form.service_id}
	                          $selected={!!form.service_id}
	                          onChange={(event) => {
	                            const selectedId = event.target.value;
	                            const service = serviceOptions.find(
	                              (item) => String(item.id) === selectedId,
	                            );
	                            setForm((prev) => ({
	                              ...prev,
	                              service_id: selectedId,
	                              service_type: service?.code || "",
	                            }));
	                          }}
	                        >
	                          <option value="" disabled hidden>
	                            Selecionar
	                          </option>
	                          {isBaseDataLoading && (
	                            <option value="" disabled>
	                              Carregando serviços...
	                            </option>
	                          )}
	                          {!isBaseDataLoading && serviceOptions.length === 0 && (
	                            <option value="" disabled>
	                              Nenhum serviço ativo disponível
	                            </option>
	                          )}
	                          {serviceOptions.map((service) => (
	                            <option key={service.id} value={service.id}>
	                              {service.name}
	                            </option>
	                          ))}
	                        </SelectionNativeField>
	                      </SelectionFieldShell>
	                    )}
	                  </Field>
	                  {!isReschedulingSession && (
	                    <Field className="span-2">
	                      Profissional
                      <SelectionFieldShell>
                        <SelectionNativeField
                          name="professional_user_id"
                          value={form.professional_user_id}
                          $selected={!!form.professional_user_id}
                          onChange={handleFormChange}
                        >
                          <option value="" disabled hidden>
                            Selecionar
                          </option>
                          {professionalOptions.map((professional) => (
                            <option key={professional.id} value={professional.id}>
                              {professional.name}
                            </option>
                          ))}
                        </SelectionNativeField>
                      </SelectionFieldShell>
                    </Field>
                  )}
		                  {!editingId && !isSchedulingReplacement && (
	                    <Field>
	                      Status
                      <select
                        name="status"
                        value={form.status}
                        onChange={handleFormChange}
                      >
                        {statusOptions.length === 0 && (
                          SESSION_STATUS_OPTIONS.map((status) => (
                            <option key={status.value} value={status.value}>
                              {status.label}
                            </option>
                          ))
                        )}
                        {statusOptions.map((status) => (
                          <option key={status.code} value={status.code}>
                            {status.label || status.code}
                          </option>
                        ))}
	                      </select>
	                    </Field>
	                  )}
			                  {editingId && form.status === "scheduled" && (
		                    <>
		                      <Field>
		                        Data *
		                        <input
		                          type="date"
		                          value={toDateInputValue(form.starts_at)}
		                          onChange={handleStartDateChange}
		                        />
		                      </Field>
		                      <Field>
		                        Horário *
		                        <select
		                          value={getHourInputValue(form.starts_at)}
		                          onChange={handleStartHourChange}
		                        >
		                          <option value="" disabled>Selecione</option>
		                          {APPOINTMENT_HOUR_OPTIONS.map((option) => (
		                            <option key={option.value} value={option.value}>
		                              {option.label}
		                            </option>
		                          ))}
		                        </select>
		                      </Field>
		                    </>
		                  )}
		                  {editingId && showLatePolicyException && (
		                    <LatePolicyCard className="span-2">
	                      <LatePolicyToggle>
                        <input
                          type="checkbox"
                          name="late_policy_exception_justified"
                          checked={!!form.late_policy_exception_justified}
                          onChange={handleFormChange}
                        />
		                        <span>Não considerar como falta</span>
		                      </LatePolicyToggle>
		                      {form.late_policy_exception_justified && (
		                        <textarea
		                          name="late_policy_exception_reason"
		                          value={form.late_policy_exception_reason}
		                          onChange={handleFormChange}
		                          rows={2}
		                          placeholder="Motivo"
		                        />
		                      )}
		                    </LatePolicyCard>
		                  )}
	                  {editingId && showMonthlyRescheduleException && (
                    <LatePolicyCard className="span-2">
                      <LatePolicyToggle>
                        <input
                          type="checkbox"
                          name="monthly_reschedule_exception_justified"
                          checked={!!form.monthly_reschedule_exception_justified}
                          onChange={handleFormChange}
                        />
                        <span>Permitir remarcação extra neste mês</span>
                      </LatePolicyToggle>
                      {form.monthly_reschedule_exception_justified && (
                        <textarea
                          name="monthly_reschedule_exception_reason"
                          value={form.monthly_reschedule_exception_reason}
                          onChange={handleFormChange}
                          rows={2}
                          placeholder="Justificativa para remarcação extra"
                        />
                      )}
                    </LatePolicyCard>
                  )}
                  {editingId && showCycleRescheduleException && (
                    <LatePolicyCard className="span-2">
                      <LatePolicyToggle>
                        <input
                          type="checkbox"
                          name="cycle_reschedule_exception_justified"
                          checked={!!form.cycle_reschedule_exception_justified}
                          onChange={handleFormChange}
                        />
                        <span>A nova data está fora do ciclo do plano mensal. Confirme se deseja continuar.</span>
                      </LatePolicyToggle>
                      {form.cycle_reschedule_exception_justified && (
                        <textarea
                          name="cycle_reschedule_exception_reason"
                          value={form.cycle_reschedule_exception_reason}
                          onChange={handleFormChange}
                          rows={2}
                          placeholder="Justificativa para reagendar fora do ciclo"
                        />
                      )}
                    </LatePolicyCard>
                  )}
	                  {!editingId && !isSchedulingReplacement && eligiblePlan && (
                    <BillingModeCard className="span-2">
                      <BillingModeHeader>
                        <strong>Cobrança</strong>
                        <span>{eligiblePlan.ServicePlan?.name || "Plano mensal"}</span>
                      </BillingModeHeader>
                      <BillingModeOptions>
                        <BillingModeOption
                          type="button"
                          $active={form.billing_mode === "covered_by_plan"}
                          disabled={!!(editingId && form.status === "done")}
                          onClick={() =>
                            setForm((prev) => ({
                              ...prev,
                              billing_mode: "covered_by_plan",
                              patient_credit_id: "",
                            }))
                          }
                        >
                          <strong>Mensal</strong>
                          <span>Incluída no plano</span>
                        </BillingModeOption>
                        <BillingModeOption
                          type="button"
                          $active={form.billing_mode === "per_session"}
                          disabled={!!(editingId && form.status === "done")}
                          onClick={() =>
                            setForm((prev) => ({ ...prev, billing_mode: "per_session" }))
                          }
                        >
                          <strong>Por sessão</strong>
                          <span>Cobrança separada</span>
                        </BillingModeOption>
                      </BillingModeOptions>
                    </BillingModeCard>
                  )}
	                  {isSchedulingReplacement && selectedReplacementCredit && (
	                    <Field className="span-2">
	                      Origem
	                      <ReadonlyValue>
	                        Reposição pendente
	                        {selectedReplacementCredit.expires_at
	                          ? ` - vence em ${selectedReplacementCredit.expires_at}`
	                          : ""}
	                      </ReadonlyValue>
	                    </Field>
	                  )}
	                  {showReplacementCycleWarning && (
	                    <LatePolicyCard className="span-2">
	                      <LatePolicyToggle>
	                        <input
	                          type="checkbox"
	                          name="cycle_reschedule_exception_justified"
	                          checked={!!form.cycle_reschedule_exception_justified}
	                          onChange={handleFormChange}
	                        />
	                        <span>A reposição está sendo agendada fora do ciclo do plano mensal. Confirme se deseja continuar.</span>
	                      </LatePolicyToggle>
	                    </LatePolicyCard>
	                  )}
	                  {!isSchedulingReplacement && replacementCreditsForPatient.length > 0 && (
                    <Field className="span-2">
                      Reposição de sessão
                      <select
                        name="session_replacement_credit_id"
                        value={form.session_replacement_credit_id}
                        onChange={handleFormChange}
                      >
                        <option value="">Não usar reposição</option>
                        {replacementCreditsForPatient.map((credit) => (
                          <option key={credit.id} value={credit.id}>
                            #{credit.id} - vence em {credit.expires_at} - {credit.reason}
                          </option>
                        ))}
                      </select>
                    </Field>
                  )}
	                  {!editingId && !isSchedulingReplacement && form.billing_mode !== "covered_by_plan" && patientCreditsForPatient.length > 0 && (
                    <Field className="span-2">
                      Pacote de sessões
                      <select
                        name="patient_credit_id"
                        value={form.patient_credit_id}
                        onChange={handleFormChange}
                      >
                        <option value="">Nao usar pacote</option>
                        {patientCreditsForPatient.map((credit) => {
                          const remaining = Number(credit.total_sessions || 0) - Number(credit.used_sessions || 0);
                          const creditServiceName = credit.Service?.name || "Pacote de sessões";
                          return (
                            <option key={credit.id} value={credit.id}>
                              {creditServiceName} - {remaining} de {credit.total_sessions} restantes
                            </option>
                          );
                        })}
                      </select>
                    </Field>
                  )}
		                  {!editingId && (
                    <>
                      <Field>
                        Data *
                        <input
                          type="date"
                          value={toDateInputValue(form.starts_at)}
                          onChange={handleStartDateChange}
                        />
                      </Field>
                      <Field>
                        Horário *
                        <select
                          value={getHourInputValue(form.starts_at)}
                          onChange={handleStartHourChange}
                        >
                          <option value="" disabled>Selecione</option>
                          {APPOINTMENT_HOUR_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </Field>
                    </>
                  )}
                  {!editingId && form.patient_id && form.service_id && form.starts_at && (
                    <CoveragePreviewCard className="span-2">
                      {form.billing_mode !== "covered_by_plan" && (
                        <CoveragePreviewRow><strong>Cobrança prevista:</strong> Avulsa</CoveragePreviewRow>
                      )}
                      {form.billing_mode === "covered_by_plan" && coveragePreviewLoading && (
                        <CoveragePreviewRow>Verificando cobertura...</CoveragePreviewRow>
                      )}
                      {form.billing_mode === "covered_by_plan" && !coveragePreviewLoading && coveragePreview && (
                        <>
                          <CoveragePreviewRow>
                            <strong>Cobrança prevista:</strong>{" "}
                            Plano mensal
                          </CoveragePreviewRow>
                          {coveragePreview.sessions_per_week && (
                            <CoveragePreviewRow>Frequência planejada: {coveragePreview.sessions_per_week}x/sem</CoveragePreviewRow>
                          )}
                          {coveragePreview.usage_summary && (
                            <CoveragePreviewRow>
                              Sessões neste ciclo: {coveragePreview.usage_summary.total_reserved || 0} agendada(s) / {coveragePreview.usage_summary.total_consumed || 0} realizada(s)
                            </CoveragePreviewRow>
                          )}
                          {!coveragePreview.usage_summary && (
                            <CoveragePreviewRow>{coveragePreview.message}</CoveragePreviewRow>
                          )}
                        </>
                      )}
                    </CoveragePreviewCard>
                  )}
                  {shouldShowFormContext && (
                    <ScheduleContextCard className="span-2" $severity="block">
                      <strong>{formAvailabilityTitle}</strong>
                      <span>A agenda esta bloqueada por feriado.</span>
                    </ScheduleContextCard>
                  )}
	                  {!editingId && !isSchedulingReplacement && (
                    <RepeatCard className="span-2">
                      <RepeatHeader>
                        <div>
                          <strong>Repetição</strong>
                        </div>
                        <RepeatToggle>
                          <input
                            type="checkbox"
                            checked={repeatEnabled}
                            onChange={(event) => {
                              const { checked } = event.target;
                              setRepeatEnabled(checked);
                              if (
                                checked &&
                                repeatWeekdays.length === 0 &&
                                form.starts_at
                              ) {
                                const start = new Date(form.starts_at);
                                if (!Number.isNaN(start.getTime())) {
                                  const weekday = toSelectableWeekday(start);
                                  if (weekday) setRepeatWeekdays([weekday]);
                                }
                              }
                            }}
                          />
                          <span>{repeatEnabled ? "Ativo" : "Inativo"}</span>
                        </RepeatToggle>
                      </RepeatHeader>
                      {repeatEnabled && (
                        <RepeatBody>
                          <RepeatRow>
                            <RepeatField className="full">
                              <RepeatModes>
                                <RepeatModeButton
                                  type="button"
                                  $active={repeatMode === "count"}
                                  onClick={() => setRepeatMode("count")}
                                >
                                  Quantidade
                                </RepeatModeButton>
                                <RepeatModeButton
                                  type="button"
                                  $active={repeatMode === "weeks"}
                                  onClick={() => setRepeatMode("weeks")}
                                >
                                  Por semanas
                                </RepeatModeButton>
                                <RepeatModeButton
                                  type="button"
                                  $active={repeatMode === "month"}
                                  onClick={() => setRepeatMode("month")}
                                >
                                  Por mes
                                </RepeatModeButton>
                                {canUsePlanRepeatMode && (
                                  <RepeatModeButton
                                    type="button"
                                    $active={repeatMode === "plan"}
                                    onClick={() => setRepeatMode("plan")}
                                  >
                                    Agenda do plano
                                  </RepeatModeButton>
                                )}
                              </RepeatModes>
                            </RepeatField>
                          </RepeatRow>
                          <RepeatRow>
                            {repeatMode === "count" && (
                              <RepeatField className="full">
                                <RepeatLabel>Quantas sessões?</RepeatLabel>
                                <RepeatInline>
                                  <input
                                    type="number"
                                    min="1"
                                    value={repeatCount}
                                    onChange={(event) =>
                                      setRepeatCount(event.target.value)
                                    }
                                    placeholder="Ex.: 10"
                                  />
                                  <span>sessões</span>
                                </RepeatInline>
                              </RepeatField>
                            )}
                            {repeatMode === "month" && (
                              <RepeatField className="full">
                                <RepeatLabel>Vigência mensal</RepeatLabel>
                                <RepeatReadonlyValue>
                                  {monthlyValiditySummary}
                                </RepeatReadonlyValue>
                                <small>
                                  Atualizado automaticamente com base na data de início.
                                </small>
                              </RepeatField>
                            )}
                            {repeatMode === "weeks" && (
                              <RepeatField className="full">
                                <RepeatLabel>Por quantas semanas?</RepeatLabel>
                                <RepeatInline>
                                  <input
                                    type="number"
                                    min="1"
                                    value={repeatWeeks}
                                    onChange={(event) =>
                                      setRepeatWeeks(event.target.value)
                                    }
                                    placeholder="Ex.: 4"
                                  />
                                  <span>semanas</span>
                                </RepeatInline>
                              </RepeatField>
                            )}
                            {repeatMode === "plan" && canUsePlanRepeatMode && (
                              <RepeatField className="full">
                                <RepeatLabel>Agenda do plano</RepeatLabel>
                                <RepeatReadonlyValue>
                                  Agenda fixa do plano. O sistema cria os próximos dias
                                  automaticamente e mantém a agenda futura pelo job recorrente.
                                </RepeatReadonlyValue>
                              </RepeatField>
                            )}
                          </RepeatRow>
                          <RepeatRow>
                            <RepeatField className="full">
                              <RepeatLabel>Quais dias?</RepeatLabel>
                              <WeekdayGrid>
                                {WEEKDAY_OPTIONS.map((option) => (
                                  <WeekdayButton
                                    key={option.value}
                                    type="button"
                                    $active={repeatWeekdays.includes(option.value)}
                                    onClick={() => handleToggleWeekday(option.value)}
                                  >
                                    {option.label}
                                  </WeekdayButton>
                                ))}
                              </WeekdayGrid>
                            </RepeatField>
                          </RepeatRow>
                        </RepeatBody>
                      )}
                    </RepeatCard>
                  )}
                  <Field className="span-2">
                    {notesFieldLabel}
                    <textarea
                      name="notes"
                      value={form.notes}
                      onChange={handleFormChange}
                      rows={3}
                      aria-invalid={editingId && showEditReasonError ? "true" : undefined}
                      className={editingId && showEditReasonError ? "is-invalid" : undefined}
                    />
		                    {editingId && showEditReasonError && (
		                      <FieldBubble role="alert">Preencher motivo para salvar</FieldBubble>
		                    )}
		                  </Field>
			                  {showPackageUpdateScope && (
			                    <PackageScopeCard className="span-2">
			                      <PackageScopeHeader>
			                        <strong>Aplicar alteração em:</strong>
			                      </PackageScopeHeader>
			                      <PackageScopeOptions>
			                        <PackageScopeOption>
		                          <input
		                            type="radio"
		                            name="package_update_scope"
		                            value="single"
		                            checked={form.package_update_scope !== "series"}
		                            onChange={handleFormChange}
		                          />
		                          <span>Somente esta sessão</span>
		                        </PackageScopeOption>
			                        <PackageScopeOption $disabled={isPackageScopePreviewLoading || packageScopeFutureCount === 0}>
		                          <input
		                            type="radio"
		                            name="package_update_scope"
		                            value="series"
		                            checked={form.package_update_scope === "series"}
			                            disabled={isPackageScopePreviewLoading || packageScopeFutureCount === 0}
			                            onChange={handleFormChange}
			                          />
			                          <span>Esta sessão e todas seguintes</span>
			                        </PackageScopeOption>
		                      </PackageScopeOptions>
			                      {!isPackageScopePreviewLoading && packageScopeFutureCount === 0 && (
		                        <PackageScopeHint>Não há próximas sessões elegíveis.</PackageScopeHint>
		                      )}
		                      {packageScopeDateChanged && form.package_update_scope === "series" && (
		                        <PackageScopeHint $danger>
		                          O campo Data não se aplica as seguintes sessões.
		                        </PackageScopeHint>
		                      )}
				                    </PackageScopeCard>
				                  )}
		                </FormGrid>
                <DrawerActions>
                  <SecondaryButton type="button" onClick={closeDrawer} disabled={isSaving}>
                    Cancelar
                  </SecondaryButton>
                  <PrimaryButton type="submit" disabled={isSaving}>
                    {isSaving ? <ButtonSpinner aria-hidden="true" /> : null}
                    {submitButtonLabel}
                  </PrimaryButton>
                </DrawerActions>
              </Form>
            )}
          </DrawerBody>
        </AppDrawer>
        {isDrawerOpen && <DrawerBackdrop onClick={closeDrawer} />}
        {recurrencePreview?.open && (
          <ModalOverlay>
            <RecurrencePreviewCard>
              <ModalHeader>
	                <h3>Revisar sessões</h3>
                <IconButton type="button" onClick={closeRecurrencePreview}>
                  <FaTimes />
                </IconButton>
              </ModalHeader>
              <RecurrencePreviewBody>
	                <RecurrenceSummaryGrid>
	                  <RecurrenceSummaryItem>
		                    <small>Sessões selecionadas</small>
	                    <strong>{recurrenceSelectedOccurrences.length}</strong>
	                  </RecurrenceSummaryItem>
                  <RecurrenceSummaryItem $variant="warn">
                    <small>Alertas</small>
                    <strong>{recurrencePreview?.summary?.warn || 0}</strong>
                  </RecurrenceSummaryItem>
                  <RecurrenceSummaryItem $variant="block">
                    <small>Bloqueadas</small>
                    <strong>{recurrencePreview?.summary?.blocked || 0}</strong>
                  </RecurrenceSummaryItem>
                </RecurrenceSummaryGrid>

		                <RecurrenceSectionDivider>
		                  <span>Sessões da recorrência</span>
		                </RecurrenceSectionDivider>

                <RecurrenceList>
	                  {recurrencePreview.occurrences.map((occurrence) => {
	                    const isSelected = recurrenceSelectedSet.has(occurrence.index);
	                    const isBlocked = occurrence.status === "BLOCK";
	                    const isSelectable =
	                      !isBlocked || occurrence.can_override_block;
	                    const selectedPosition = recurrenceSequenceMap.get(occurrence.index);
	                    const isEditing = recurrencePreview.editing_index === occurrence.index;
	                    return (
	                      <RecurrenceRow
	                        key={`occ-${occurrence.index}`}
                        $status={occurrence.status}
                        $selected={isSelected}
                      >
                        <RecurrenceRowSelect>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            disabled={
                              recurrencePreview.is_submitting ||
                              !isSelectable
                            }
                            onChange={() => handleTogglePreviewOccurrence(occurrence)}
                          />
	                        </RecurrenceRowSelect>
	                        <RecurrenceRowInfo>
	                          <RecurrenceOccurrenceHeader>
		                            <div>
		                              <strong>
		                                {formatOccurrenceCompactLabel(occurrence)}
		                              </strong>
		                              <span>
	                                {OCCURRENCE_STATUS_LABELS[occurrence.status] ||
	                                  occurrence.status}
		                                {occurrence.manually_edited ? " · Alterada" : ""}
		                              </span>
		                            </div>
		                            {isSelected && selectedPosition && (
		                              <RecurrenceSequenceBadge>
		                                {selectedPosition}/{recurrenceSelectedOccurrences.length}
		                              </RecurrenceSequenceBadge>
		                            )}
		                            {!isEditing && (
		                              <RecurrenceInlineButton
	                                type="button"
	                                onClick={() => handleStartEditPreviewOccurrence(occurrence)}
	                                disabled={recurrencePreview.is_submitting}
	                              >
	                                Editar
	                              </RecurrenceInlineButton>
	                            )}
	                          </RecurrenceOccurrenceHeader>
	                          {isEditing && (
	                            <RecurrenceEditBox>
	                              <label htmlFor={`recurrence-edit-date-${occurrence.index}`}>
	                                <span>Data</span>
	                                <input
	                                  id={`recurrence-edit-date-${occurrence.index}`}
	                                  type="date"
	                                  value={recurrencePreview.edit_date || ""}
	                                  onChange={(event) =>
	                                    setRecurrencePreview((previous) =>
	                                      previous
	                                        ? {
	                                          ...previous,
	                                          edit_date: event.target.value,
	                                          edit_error: "",
	                                        }
	                                        : previous)}
	                                />
	                              </label>
	                              <label htmlFor={`recurrence-edit-time-${occurrence.index}`}>
	                                <span>Horário</span>
	                                <input
	                                  id={`recurrence-edit-time-${occurrence.index}`}
	                                  type="time"
	                                  value={recurrencePreview.edit_time || ""}
	                                  onChange={(event) =>
	                                    setRecurrencePreview((previous) =>
	                                      previous
	                                        ? {
	                                          ...previous,
	                                          edit_time: event.target.value,
	                                          edit_error: "",
	                                        }
	                                        : previous)}
	                                />
	                              </label>
	                              <RecurrenceEditActions>
	                                <SecondaryButton
	                                  type="button"
	                                  onClick={handleCancelEditPreviewOccurrence}
	                                  disabled={recurrencePreview.is_editing_occurrence}
	                                >
	                                  Cancelar
	                                </SecondaryButton>
	                                <PrimaryButton
	                                  type="button"
	                                  onClick={() => handleSaveEditPreviewOccurrence(occurrence)}
	                                  disabled={recurrencePreview.is_editing_occurrence}
	                                >
	                                  {recurrencePreview.is_editing_occurrence ? "Salvando..." : "Salvar"}
	                                </PrimaryButton>
	                              </RecurrenceEditActions>
	                              {recurrencePreview.edit_error && (
	                                <small>{recurrencePreview.edit_error}</small>
	                              )}
	                            </RecurrenceEditBox>
	                          )}
	                          {Array.isArray(occurrence.matched_events) &&
	                            occurrence.matched_events.length > 0 && (
                              <RecurrenceEventList>
                                {occurrence.matched_events.map((event, index) => (
                                  <li key={`${occurrence.index}-${event.id || index}`}>
                                    {event.name || "Feriado ou bloqueio"} -{" "}
                                    {SPECIAL_SOURCE_LABELS[event.source_type] ||
                                      event.source_type}
                                  </li>
                                ))}
                              </RecurrenceEventList>
                            )}
                          {!occurrence.can_override_block &&
                            occurrence.status === "BLOCK" && (
                              <small>Sem permissao para override nesta ocorrencia.</small>
                            )}
                        </RecurrenceRowInfo>
                      </RecurrenceRow>
                    );
                  })}
                </RecurrenceList>

                {recurrenceBlockedSelectedCount > 0 && (
                  <RecurrenceOverrideField>
                    <span>Motivo do override (obrigatório)</span>
                    <textarea
                      rows={3}
                      value={recurrencePreview.override_reason || ""}
                      onChange={(event) =>
                        setRecurrencePreview((previous) =>
                          previous
                            ? {
                              ...previous,
                              override_reason: event.target.value,
                            }
                            : previous,
                        )
                      }
                    />
                  </RecurrenceOverrideField>
                )}
              </RecurrencePreviewBody>
              <ModalActions>
                <SecondaryButton
                  type="button"
                  onClick={closeRecurrencePreview}
                  disabled={recurrencePreview.is_submitting}
                >
                  Voltar e editar
                </SecondaryButton>
                <PrimaryButton
                  type="button"
	                  onClick={handleConfirmRecurrenceCreation}
	                  disabled={
	                    recurrencePreview.is_submitting ||
	                    recurrencePreview.is_editing_occurrence ||
	                    !!recurrencePreview.editing_index
	                  }
	                >
                  {recurrencePreview.is_submitting ? "Salvando..." : "Confirmar"}
                </PrimaryButton>
              </ModalActions>
            </RecurrencePreviewCard>
          </ModalOverlay>
        )}
        {attendanceModal.open && (
          <ModalOverlay>
            <AttendanceCallCard>
              <ModalHeader>
                <AttendanceCallTitle>
                  <h3>Fazer chamada — {attendanceModal.timeLabel}</h3>
                </AttendanceCallTitle>
                <IconButton
                  type="button"
                  disabled={attendanceModal.isSaving}
                  onClick={handleCloseAttendanceCall}
                >
                  <FaTimes />
                </IconButton>
              </ModalHeader>
              <AttendanceCallBody>
                {attendanceModal.serviceGroups.map((sg) => (
                  <AttendanceCallServiceSection key={sg.key}>
                    <AttendanceCallServiceHeader $color={sg.serviceColor} $code={sg.serviceCode}>
                      {sg.serviceLabel}
                    </AttendanceCallServiceHeader>
                    {sg.sessions.map((session) => {
                      const sid = String(session.id);
                      const selectedStatus = attendanceModal.statuses[sid] || "done";
                      const professionalName = session?.professional?.name || "";
                      return (
                        <AttendanceCallRow key={session.id}>
                          <AttendanceCallInfo>
                            <strong>{getSessionPatientName(session)}</strong>
                            {professionalName && <span>{professionalName}</span>}
                          </AttendanceCallInfo>
                          <AttendanceStatusToggle role="group" aria-label="Status da chamada">
                            <AttendanceStatusButton
                              type="button"
                              $active={selectedStatus === "done"}
                              disabled={attendanceModal.isSaving}
                              onClick={() => handleAttendanceStatusChange(session.id, "done")}
                            >
                              Concluído
                            </AttendanceStatusButton>
                            <AttendanceStatusButton
                              type="button"
                              $active={selectedStatus === "no_show"}
                              $tone="no_show"
                              disabled={attendanceModal.isSaving}
                              onClick={() => handleAttendanceStatusChange(session.id, "no_show")}
                            >
                              Falta
                            </AttendanceStatusButton>
                          </AttendanceStatusToggle>
                          {selectedStatus === "no_show" && (
                            <AttendanceReasonInput
                              type="text"
                              placeholder="Motivo opcional"
                              value={attendanceModal.reasons[sid] || ""}
                              disabled={attendanceModal.isSaving}
                              onChange={(event) =>
                                handleAttendanceReasonChange(session.id, event.target.value)
                              }
                            />
                          )}
                        </AttendanceCallRow>
                      );
                    })}
                  </AttendanceCallServiceSection>
                ))}
              </AttendanceCallBody>
              <ModalActions>
                <SecondaryButton
                  type="button"
                  disabled={attendanceModal.isSaving}
                  onClick={handleCloseAttendanceCall}
                >
                  Cancelar
                </SecondaryButton>
                <PrimaryButton
                  type="button"
                  disabled={attendanceModal.isSaving}
                  onClick={handleSaveAttendanceCall}
                >
                  {attendanceModal.isSaving ? "Salvando..." : "Salvar chamada"}
                </PrimaryButton>
              </ModalActions>
            </AttendanceCallCard>
          </ModalOverlay>
        )}
        {absenceModal.open && (
          <ModalOverlay>
            <ModalCard>
              <ModalHeader>
                <h3>
                  {absenceModal.status === "no_show" ? "Motivo da falta" : "Motivo do cancelamento"}
                </h3>
                <IconButton
                  type="button"
                  disabled={absenceModal.isSaving}
                  onClick={() => setAbsenceModal(emptyAbsenceModal)}
                >
                  <FaTimes />
                </IconButton>
              </ModalHeader>
              <ModalBody>
                {absenceModal.status === "no_show" && (
                  <AbsenceImpactPanel>
                    <span>
                      Faltas neste mês: {absenceModal.monthlyAbsenceCountBefore}/{absenceModal.monthlyAbsenceLimit}.
                    </span>
                  </AbsenceImpactPanel>
                )}
                {absenceModal.latePolicyApplies && (
                  <AbsencePolicyInline>
                    <span>
                      Este atendimento está sendo cancelado com menos de {operationalPolicy.late_change_minimum_notice_hours || 24}h e poderá ser registrado como Falta se não houver justificativa.
                    </span>
                    <LatePolicyToggle>
                      <input
                        type="checkbox"
                        checked={absenceModal.latePolicyExceptionJustified}
                        disabled={absenceModal.isSaving}
                        onChange={(event) =>
                          setAbsenceModal((prev) => ({
	                            ...prev,
	                            latePolicyExceptionJustified: event.target.checked,
	                            generateReplacementCredit: event.target.checked
	                              ? prev.generateReplacementCredit
	                              : false,
                          }))
                        }
                      />
	                      <span>Não considerar como falta</span>
                    </LatePolicyToggle>
                  </AbsencePolicyInline>
                )}
	                {absenceModal.status === "canceled" &&
	                  (!absenceModal.latePolicyApplies || absenceModal.latePolicyExceptionJustified) && (
	                    <LatePolicyToggle>
	                      <input
	                        type="checkbox"
	                        checked={absenceModal.generateReplacementCredit}
	                        disabled={absenceModal.isSaving}
	                        onChange={(event) =>
	                          setAbsenceModal((prev) => ({
	                            ...prev,
	                            generateReplacementCredit: event.target.checked,
	                          }))
	                        }
	                      />
	                      <span>Gerar reposição pendente</span>
	                    </LatePolicyToggle>
	                  )}
	                <ModalFieldLabel>
                  {absenceModal.status === "no_show" ? "Motivo da falta" : "Motivo do cancelamento"}
                </ModalFieldLabel>
                <textarea
                  rows={4}
                  placeholder={
                    absenceModal.status === "no_show"
                      ? "Descreva o motivo da falta"
                      : "Descreva o motivo"
                  }
                  value={absenceModal.reason}
                  disabled={absenceModal.isSaving}
                  onChange={(event) =>
                    setAbsenceModal((prev) => ({ ...prev, reason: event.target.value }))
                  }
                />
              </ModalBody>
              <ModalActions>
                <SecondaryButton
                  type="button"
                  disabled={absenceModal.isSaving}
                  onClick={() => setAbsenceModal(emptyAbsenceModal)}
                >
                  Cancelar
                </SecondaryButton>
                <ModalSaveButton
                  type="button"
                  onClick={handleConfirmAbsence}
                  disabled={absenceModal.isSaving}
                  aria-label={absenceModal.isSaving ? "Salvando motivo" : "Salvar motivo"}
                >
                  {absenceModal.isSaving && <ButtonSpinner aria-hidden="true" />}
                  {!absenceModal.isSaving && (
                    absenceModal.status === "no_show" ? "Confirmar falta" : "Salvar"
                  )}
                </ModalSaveButton>
              </ModalActions>
            </ModalCard>
          </ModalOverlay>
        )}
        {deleteModal.open && deleteModal.session && (
          <ModalOverlay>
            <DeleteFlowCard>
	              <ModalHeader>
	                <h3>
	                  {getDeleteModalTitle(deleteModal.session, deleteModal.step)}
	                </h3>
	                {!isPackageDeleteFlow && (
	                  <IconButton
	                    type="button"
	                    disabled={isDeletePreviewing || isDeleting}
	                    onClick={handleCloseDelete}
	                  >
	                    <FaTimes />
	                  </IconButton>
	                )}
	              </ModalHeader>
	              <DeleteFlowBody>
		                {isPackageDeleteFlow ? (
                      <>
		                    <PackageRemoveSummary>
	                    <PackageRemoveEyebrow>Paciente</PackageRemoveEyebrow>
	                    <PackageRemovePatient>{getPatientDisplayName(deleteModal.session)}</PackageRemovePatient>
	                    <PackageRemoveMain>
	                      {deleteModal.session?.Service?.name ||
	                        serviceName(
	                          deleteModal.session?.service_type ||
	                          deleteModal.session?.Service?.code,
	                        )}{" "}
	                      · Sessão {getPackageSessionCounter(deleteModal.session)}
	                    </PackageRemoveMain>
	                    <PackageRemoveDate>
	                      {formatDate(deleteModal.session?.starts_at) || "-"} às{" "}
	                      {formatTime(deleteModal.session?.starts_at) || "-"}
	                    </PackageRemoveDate>
		                    <PackageRemoveMeta>
		                      <span>Profissional: {deleteModal.session?.professional?.name || "Profissional"}</span>
		                      <span>Status: {getSessionStatusLabel(deleteModal.session?.status)}</span>
		                    </PackageRemoveMeta>
		                  </PackageRemoveSummary>
                      <PackageRemoveDecisionGroup>
                        <PackageRemoveQuestion>O que deseja fazer?</PackageRemoveQuestion>
                        <PackageRemoveRadioOption>
                          <input
                            type="radio"
                            name="package-removal-intent"
                            value="reschedule"
                            checked={deleteModal.removalIntent !== "hard_delete"}
                            disabled={isDeleting}
                            onChange={handlePackageRemovalIntentChange}
                          />
                          <span>Remover da agenda para remarcar depois</span>
                        </PackageRemoveRadioOption>
                        <PackageRemoveRadioOption>
                          <input
                            type="radio"
                            name="package-removal-intent"
                            value="hard_delete"
                            checked={deleteModal.removalIntent === "hard_delete"}
                            disabled={isDeleting}
                            onChange={handlePackageRemovalIntentChange}
                          />
                          <span>Excluir lançamento definitivamente</span>
                        </PackageRemoveRadioOption>
                      </PackageRemoveDecisionGroup>
                      <PackageRemoveDecisionGroup>
                        <PackageRemoveQuestion>Aplicar em quais sessões?</PackageRemoveQuestion>
                        <PackageRemoveRadioOption>
                          <input
                            type="radio"
                            name="package-removal-scope"
                            value="single"
                            checked={deleteModal.mode !== "series"}
                            disabled={isDeleting}
                            onChange={handlePackageRemovalScopeChange}
                          />
                          <span>Somente esta sessão</span>
                        </PackageRemoveRadioOption>
                        <PackageRemoveRadioOption>
                          <input
                            type="radio"
                            name="package-removal-scope"
                            value="series"
                            checked={deleteModal.mode === "series"}
                            disabled={isDeleting}
                            onChange={handlePackageRemovalScopeChange}
                          />
                          <span>Esta sessão e todas seguintes</span>
                        </PackageRemoveRadioOption>
	                      </PackageRemoveDecisionGroup>
                      </>
		                ) : (
	                  <>
				                {deleteModal.step === "intent" && (
		                  <>
		                    <RecurrenceSummaryGrid>
		                      <RecurrenceSummaryItem>
		                        <small>Paciente</small>
		                        <strong>{getPatientDisplayName(deleteModal.session)}</strong>
		                      </RecurrenceSummaryItem>
		                      <RecurrenceSummaryItem>
		                        <small>Data</small>
		                        <strong>{formatDateTime(deleteModal.session?.starts_at)}</strong>
		                      </RecurrenceSummaryItem>
		                      <RecurrenceSummaryItem>
		                        <small>Serviço</small>
		                        <strong>
		                          {deleteModal.session?.Service?.name ||
		                            serviceName(
		                              deleteModal.session?.service_type ||
		                              deleteModal.session?.Service?.code,
		                            )}
		                        </strong>
		                      </RecurrenceSummaryItem>
		                      <RecurrenceSummaryItem>
		                        <small>Status</small>
		                        <strong>{getSessionStatusLabel(deleteModal.session?.status)}</strong>
		                      </RecurrenceSummaryItem>
		                    </RecurrenceSummaryGrid>
		                    <DeleteChoiceGrid>
		                      <DeleteChoiceButton
		                        type="button"
		                        disabled={isDeletePreviewing}
		                        onClick={() => handleSelectDeleteIntent("reschedule")}
		                      >
		                        <div>
		                          <strong>Remarcar depois</strong>
		                          <span>
		                            As sessões sairão da agenda e ficarão pendentes para agendar em
		                            outro momento.
		                          </span>
		                        </div>
		                        <FaChevronRight aria-hidden="true" />
		                      </DeleteChoiceButton>
		                      <DeleteChoiceButton
		                        type="button"
		                        $danger
		                        disabled={isDeletePreviewing}
		                        onClick={() => handleSelectDeleteIntent("hard_delete")}
		                      >
		                        <div>
		                          <strong>Apagar definitivamente</strong>
		                          <span>
		                            Use apenas para lançamento feito por engano. As sessões não
		                            ficarão disponíveis para remarcar.
		                          </span>
		                        </div>
		                        <FaChevronRight aria-hidden="true" />
		                      </DeleteChoiceButton>
		                    </DeleteChoiceGrid>
			                  </>
			                )}
			                {deleteModal.step === "choice" && (
	                  <>
	                    {isPackageDeleteFlow && (
		                      <DeleteStepIntro>
		                        <strong>Escolha o escopo</strong>
		                        <span>
		                          Escolha se deseja remover somente a sessão clicada ou ela e
		                          as próximas sessões elegíveis.
		                        </span>
		                      </DeleteStepIntro>
	                    )}
	                    <RecurrenceSummaryGrid>
                      <RecurrenceSummaryItem>
                        <small>Paciente</small>
                        <strong>
                          {getPatientDisplayName(deleteModal.session)}
                        </strong>
                      </RecurrenceSummaryItem>
                      <RecurrenceSummaryItem>
                        <small>Data</small>
                        <strong>{formatDateTime(deleteModal.session?.starts_at)}</strong>
                      </RecurrenceSummaryItem>
                      <RecurrenceSummaryItem>
	                        <small>Serviço</small>
                        <strong>
                          {deleteModal.session?.Service?.name ||
                            serviceName(
                              deleteModal.session?.service_type ||
                              deleteModal.session?.Service?.code,
                            )}
                        </strong>
                      </RecurrenceSummaryItem>
                      <RecurrenceSummaryItem>
                        <small>Status</small>
                        <strong>{getSessionStatusLabel(deleteModal.session?.status)}</strong>
                      </RecurrenceSummaryItem>
                    </RecurrenceSummaryGrid>
                    <DeleteChoiceGrid>
	                      <DeleteChoiceButton
	                        type="button"
	                        disabled={isDeletePreviewing}
	                        onClick={() => handleDeleteModeSelection("single")}
	                      >
		                        <div>
		                          <strong>
		                            {isPackageDeleteFlow
		                              ? "Somente esta sessão"
		                              : "Apenas este agendamento"}
		                          </strong>
			                          {isPackageDeleteFlow && (
			                            <span>1 sessão</span>
			                          )}
		                        </div>
		                        <FaChevronRight aria-hidden="true" />
	                      </DeleteChoiceButton>
                      <DeleteChoiceButton
                        type="button"
                        disabled={isDeletePreviewing || deleteSeriesCandidates.length <= 1}
                        onClick={() => handleDeleteModeSelection("series")}
	                        title={
	                          deleteSeriesCandidates.length <= 1
	                            ? "Não há próximas sessões elegíveis."
	                            : undefined
	                        }
                      >
		                        <div>
		                          <strong>
		                            {isPackageDeleteFlow
		                              ? "Esta sessão e próximas"
		                              : "Revisar exclusão de vários"}
			                          </strong>
			                          {isPackageDeleteFlow && (
			                            <span>
			                              {deleteSeriesCandidates.length > 1
			                                ? `${deleteSeriesCandidates.length} sessões`
			                                : "Não há próximas sessões elegíveis."}
			                            </span>
			                          )}
			                        </div>
			                        <FaChevronRight aria-hidden="true" />
		                      </DeleteChoiceButton>
	                    </DeleteChoiceGrid>
	                  </>
		                )}
			                {deleteModal.step !== "intent" && deleteModal.step !== "choice" && (
	                  <>
	                    {isPackageRemovalFlow && (
	                      <DeleteStepIntro>
	                        <strong>
	                          {deleteModal.keepForReschedule
	                            ? "Remarcar depois"
	                            : "Apagar definitivamente"}
	                        </strong>
	                        <span>
	                          {deleteModal.keepForReschedule
	                            ? "As sessões selecionadas sairão da agenda e ficarão pendentes para agendar em outro momento."
	                            : "Use este caminho apenas para lançamento feito por engano."}
	                        </span>
	                      </DeleteStepIntro>
	                    )}
	                    <RecurrenceSummaryGrid>
	                      <RecurrenceSummaryItem>
	                        <small>Total afetado</small>
	                        <strong>{deleteSelectedSessions.length}</strong>
	                      </RecurrenceSummaryItem>
	                      <RecurrenceSummaryItem>
		                        <small>Não podem ser alteradas</small>
	                        <strong>{deleteBlockedSessions.length}</strong>
	                      </RecurrenceSummaryItem>
	                      <RecurrenceSummaryItem>
	                        <small>Primeiro</small>
	                        <strong>
	                          {deleteReviewFirstSession
	                            ? formatDate(deleteReviewFirstSession.starts_at)
	                            : "--/--/----"}
	                        </strong>
	                      </RecurrenceSummaryItem>
	                      <RecurrenceSummaryItem>
	                        <small>Último</small>
	                        <strong>
	                          {deleteReviewLastSession
	                            ? formatDate(deleteReviewLastSession.starts_at)
	                            : "--/--/----"}
	                        </strong>
	                      </RecurrenceSummaryItem>
                    </RecurrenceSummaryGrid>
		                    <RecurrenceHint>
			                      {isPackageRemovalFlow
			                        ? "Revise as sessões abaixo. Você pode remover para remarcar depois ou apagar definitivamente quando forem lançamentos sem impacto."
			                        : "Revise os itens marcados abaixo. Voce pode desmarcar qualquer agendamento antes de confirmar."}
			                    </RecurrenceHint>
				                    {isPackageRemovalFlow && !deleteModal.keepForReschedule && (
			                      <DeleteDangerNotice>
		                        <strong>
		                          Esta ação é definitiva. As sessões não ficarão disponíveis para
		                          remarcar.
		                        </strong>
		                        <label htmlFor="delete-confirm-hard-removal">
		                          <input
		                            id="delete-confirm-hard-removal"
		                            type="checkbox"
		                            checked={deleteModal.confirmHardRemoval}
		                            disabled={isDeleting}
		                            onChange={handleToggleConfirmHardRemoval}
		                          />
		                          <span>
		                            Confirmo que desejo apagar definitivamente estas sessões.
		                          </span>
		                        </label>
		                      </DeleteDangerNotice>
		                    )}
	                    <DeleteReviewToolbar>
                      <label htmlFor="delete-select-all">
                        <input
                          id="delete-select-all"
                          type="checkbox"
                          checked={areAllDeleteCandidatesSelected}
                          disabled={isDeleting || deleteSelectableSessions.length === 0}
                          onChange={handleToggleAllDeleteCandidates}
                        />
                        <span>Selecionar todos</span>
                      </label>
                      <small>
                        {deleteSelectedSessions.length} de {deleteSelectableSessions.length} selecionados
                      </small>
                    </DeleteReviewToolbar>
		                    <DeleteReviewList>
		                      {deleteSelectableSessions.map((session) => {
	                        const isSelected = deleteModal.selectedIds.includes(String(session.id));
	                        const candidateBlockedReason = getDeleteCandidateBlockReason(
	                          session,
	                          deleteModal.keepForReschedule,
	                          isPackageRemovalFlow,
	                        );
	                        const canSelectCandidate = canSelectDeleteCandidate(
	                          session,
	                          deleteModal.keepForReschedule,
	                          isPackageRemovalFlow,
	                        );
	                        return (
	                          <DeleteReviewRow key={`delete-${session.id}`} $selected={isSelected}>
	                            <DeleteReviewSelect>
	                              <input
	                                type="checkbox"
	                                checked={isSelected}
	                                disabled={isDeleting || !canSelectCandidate}
	                                onChange={() => handleToggleDeleteCandidate(session.id)}
	                              />
                            </DeleteReviewSelect>
                            <DeleteReviewInfo>
                              <strong>{formatDateTime(session.starts_at)}</strong>
                              <span>
                                {session?.Service?.name ||
                                  serviceName(session?.service_type || session?.Service?.code)}{" "}
                                - {session?.professional?.name || "Profissional"}
                              </span>
                              <DeleteReviewPatient>
                                <PatientInlineText>{getSessionPatientName(session)}</PatientInlineText>
                                {renderPatientAttentionIndicator(getSessionPatientAttentionLevel(session))}
                              </DeleteReviewPatient>
	                              {candidateBlockedReason && (
	                                <DeleteBlockedReason>
	                                  {candidateBlockedReason ===
	                                    "Este agendamento já possui baixa no financeiro."
	                                    ? "Este agendamento ja possui baixa no financeiro."
	                                    : candidateBlockedReason}
	                                </DeleteBlockedReason>
	                              )}
                            </DeleteReviewInfo>
                            <DeleteStatusPill $status={session.status}>
                              {getSessionStatusLabel(session.status)}
                            </DeleteStatusPill>
                          </DeleteReviewRow>
		                        );
		                      })}
		                    </DeleteReviewList>
		                    {deleteBlockedSessions.length > 0 && (
		                      <DeleteBlockedSection>
		                        <strong>Não podem ser alteradas</strong>
		                        <DeleteReviewList>
		                          {deleteBlockedSessions.map((session) => {
		                            const candidateBlockedReason = getDeleteCandidateBlockReason(
		                              session,
		                              deleteModal.keepForReschedule,
		                              isPackageRemovalFlow,
		                            );
		                            return (
		                              <DeleteReviewRow
		                                key={`delete-blocked-${session.id}`}
		                                $selected={false}
		                                $blocked
		                              >
		                                <DeleteReviewInfo>
		                                  <strong>{formatDateTime(session.starts_at)}</strong>
		                                  <span>
		                                    {session?.Service?.name ||
		                                      serviceName(session?.service_type || session?.Service?.code)}{" "}
		                                    - {session?.professional?.name || "Profissional"}
		                                  </span>
		                                  {candidateBlockedReason && (
		                                    <DeleteBlockedReason>
		                                      {candidateBlockedReason ===
		                                        "Esta sessão possui vínculo financeiro. Para remover da agenda, marque 'Quero remarcar essas sessões depois' ou trate o financeiro antes."
		                                        ? "Esta sessão possui vínculo financeiro. Para remover da agenda, escolha 'Remarcar depois' ou trate o financeiro antes."
		                                        : candidateBlockedReason}
		                                    </DeleteBlockedReason>
		                                  )}
		                                </DeleteReviewInfo>
		                                <DeleteStatusPill $status={session.status}>
		                                  {getSessionStatusLabel(session.status)}
		                                </DeleteStatusPill>
		                              </DeleteReviewRow>
		                            );
		                          })}
		                        </DeleteReviewList>
		                      </DeleteBlockedSection>
		                    )}
	                    <RecurrenceOverrideField>
	                      <span>{isPackageRemovalFlow ? "Motivo da remoção" : "Motivo da exclusão"}</span>
	                      <textarea
	                        rows={3}
	                        placeholder={isPackageRemovalFlow ? "Descreva o motivo da remoção" : "Descreva o motivo da exclusão"}
                        value={deleteModal.reason}
                        onChange={(event) =>
                          setDeleteModal((previous) => ({
                            ...previous,
                            reason: event.target.value,
                          }))
                        }
                      />
                    </RecurrenceOverrideField>
	                  </>
	                )}
	                  </>
	                )}
	              </DeleteFlowBody>
				              <ModalActions>
					                {isPackageDeleteFlow ? (
					                  <>
					                    <SecondaryButton
					                      type="button"
					                      onClick={handleCloseDelete}
					                      disabled={isDeleting}
					                    >
					                      Cancelar
					                    </SecondaryButton>
					                    <PackageRemovePrimaryAction
					                      type="button"
					                      onClick={handleRemovePackageFromAgenda}
					                      disabled={isDeleting}
					                    >
					                      {isDeleting ? <ButtonSpinner aria-hidden="true" /> : "Confirmar"}
					                    </PackageRemovePrimaryAction>
					                  </>
				                ) : (
				                  <>
				                {deleteModal.step === "intent" && (
				                  <SecondaryButton
				                    type="button"
				                    onClick={handleCloseDelete}
			                    disabled={isDeletePreviewing || isDeleting}
			                  >
			                    Fechar
			                  </SecondaryButton>
			                )}
				                {deleteModal.step === "choice" && (
				                  <SecondaryButton
				                    type="button"
				                    onClick={isPackageDeleteFlow ? handleBackDeleteScope : handleCloseDelete}
				                    disabled={isDeletePreviewing || isDeleting}
				                  >
				                    {isPackageDeleteFlow ? "Voltar" : "Fechar"}
				                  </SecondaryButton>
				                )}
			                {deleteModal.step !== "intent" && deleteModal.step !== "choice" && (
	                  <>
                    <SecondaryButton
                      type="button"
                      onClick={handleBackDeleteChoice}
                      disabled={isDeletePreviewing || isDeleting}
                    >
                      Voltar
                    </SecondaryButton>
                    <DeleteConfirmButton
                      type="button"
                      onClick={handleConfirmDelete}
                      disabled={
                        isDeletePreviewing ||
	                        isDeleting ||
	                        deleteSelectedSessions.length === 0 ||
	                        !deleteModal.reason.trim() ||
	                        (requiresHardRemovalConfirmation && !deleteModal.confirmHardRemoval)
	                      }
	                    >
	                      {isDeleting ? <ButtonSpinner aria-hidden="true" /> : deleteConfirmLabel}
	                    </DeleteConfirmButton>
		                  </>
		                )}
				                  </>
				                )}
	              </ModalActions>
            </DeleteFlowCard>
          </ModalOverlay>
        )}
      </PageContent>
      {popover && (
        <PopoverOverlay onClick={() => setPopover(null)}>
          <PopoverCard
            style={{
              top: Math.min(popover.rect.bottom + 8, window.innerHeight - 280),
              left: Math.min(popover.rect.left, window.innerWidth - 248),
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <PopoverTitle>Pacientes ocultos</PopoverTitle>
            {popover.items.map(({ session, color }) => (
              <PopoverPatientRow key={session.id}>
                <PopoverDot $color={color} />
                <PopoverPatientName>
                  <PatientInlineText>{getSessionPatientName(session)}</PatientInlineText>
                  {renderPatientAttentionIndicator(getSessionPatientAttentionLevel(session))}
                </PopoverPatientName>
              </PopoverPatientRow>
            ))}
            <PopoverFooter>
              <button
                type="button"
                onClick={() => {
                  setPopover(null);
                  handleOpenGroup(popover.slotDate);
                }}
              >
                Ver detalhes do horário →
              </button>
            </PopoverFooter>
          </PopoverCard>
        </PopoverOverlay>
      )}
    </PageWrapper>
  );
}

const WeekSlotSessionPill = React.memo(
  function WeekSlotSessionPill({
    session,
    group,
    color,
    statusTone,
    patientName,
    attentionLevel,
    isHistory = false,
    onOpen,
  }) {
    const shortPatientName = getCompactWeekPatientName(patientName);
    const sessionSummary = getSessionCardSummary(session);

    if (isHistory) {
      const statusLabel = getSessionStatusLabel(session.status);
      return (
        <GroupPill
          $type={group.service_type}
          $color={color}
          $history
          $status={statusTone}
          title={`${patientName} - ${statusLabel} - ${sessionSummary}`}
          onClick={onOpen}
        >
          <GroupPillContent>
            <GroupPillPatient>
              <PatientInlineText>{shortPatientName}</PatientInlineText>
              <WeekHistoryStatusBadge $status={statusTone}>
                {statusLabel}
              </WeekHistoryStatusBadge>
            </GroupPillPatient>
          </GroupPillContent>
        </GroupPill>
      );
    }

	    const weekMetaLabel = getWeekSessionMetaLabel(session);

	    return (
      <GroupPill
        $type={group.service_type}
        $color={color}
        $history={false}
        $status={statusTone}
        title={`${patientName} - ${sessionSummary}`}
        onClick={onOpen}
      >
	        <GroupPillContent>
	          <GroupPillPatient>
	            <WeekPillPatientName>{shortPatientName}</WeekPillPatientName>
	            <WeekPillMeta>
	              <WeekPillMetaText>{weekMetaLabel}</WeekPillMetaText>
	            </WeekPillMeta>
	            {renderPatientAttentionIndicator(attentionLevel)}
	          </GroupPillPatient>
	        </GroupPillContent>
      </GroupPill>
    );
  },
  (prev, next) => (
    prev.session === next.session &&
    prev.group === next.group &&
    prev.color === next.color &&
    prev.statusTone === next.statusTone &&
    prev.patientName === next.patientName &&
    prev.attentionLevel === next.attentionLevel &&
    prev.isHistory === next.isHistory
  ),
);

const MonthAgendaCell = React.memo(
  function MonthAgendaCell({
    day,
    isCurrentMonth,
    isActive,
    daySummary,
    specialSummary,
    onOpenDay,
  }) {
    const dayServices = daySummary?.items || [];
    const historySummary = daySummary?.historyCount > 0
      ? {
        code: "history",
        name: "Histórico",
        count: daySummary.historyCount,
        kind: "history",
      }
      : null;
    const monthSummaryItems =
      historySummary && dayServices.length < 3
        ? [...dayServices, historySummary]
        : dayServices;
    const visibleServices = monthSummaryItems.slice(0, 3);
    const totalMonthSummaryItems = dayServices.length + (historySummary ? 1 : 0);
    const extraServices = Math.max(0, totalMonthSummaryItems - visibleServices.length);

    return (
      <MonthCell
        $inactive={!isCurrentMonth}
        $active={isActive}
        onClick={onOpenDay}
      >
        <strong>{day.getDate()}</strong>
        {specialSummary && (
          <SpecialDayFlag
            $severity={specialSummary.severity}
            title={buildSpecialEventsTooltip(specialSummary.events)}
          >
            {daySummaryLabel(specialSummary)}
          </SpecialDayFlag>
        )}
        {visibleServices.length > 0 && (
          <MonthServiceChips>
            {visibleServices.map((svc) => (
              <MonthServiceChip
                key={svc.code}
                $color={svc.color}
                $history={svc.kind === "history"}
              >
                {svc.name}: {svc.count}
              </MonthServiceChip>
            ))}
            {extraServices > 0 && (
              <MonthServiceMore>+{extraServices} mais</MonthServiceMore>
            )}
          </MonthServiceChips>
        )}
      </MonthCell>
    );
  },
  (prev, next) => (
    prev.day.getTime() === next.day.getTime() &&
    prev.isCurrentMonth === next.isCurrentMonth &&
    prev.isActive === next.isActive &&
    prev.daySummary === next.daySummary &&
    prev.specialSummary === next.specialSummary
  ),
);

WeekSlotSessionPill.propTypes = {
  session: PropTypes.shape({
    status: PropTypes.string,
  }).isRequired,
  group: PropTypes.shape({
    service_type: PropTypes.string,
  }).isRequired,
  color: PropTypes.string,
  statusTone: PropTypes.string,
  patientName: PropTypes.string.isRequired,
  attentionLevel: PropTypes.string,
  isHistory: PropTypes.bool,
  onOpen: PropTypes.func.isRequired,
};

WeekSlotSessionPill.defaultProps = {
  color: null,
  statusTone: "scheduled",
  attentionLevel: null,
  isHistory: false,
};

MonthAgendaCell.propTypes = {
  day: PropTypes.instanceOf(Date).isRequired,
  isCurrentMonth: PropTypes.bool.isRequired,
  isActive: PropTypes.bool.isRequired,
  daySummary: PropTypes.shape({
    items: PropTypes.arrayOf(PropTypes.shape({
      code: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
      color: PropTypes.string,
      count: PropTypes.number,
      kind: PropTypes.string,
      name: PropTypes.string,
    })),
    historyCount: PropTypes.number,
  }),
  specialSummary: PropTypes.shape({
    events: PropTypes.arrayOf(PropTypes.shape({})),
    severity: PropTypes.string,
  }),
  onOpenDay: PropTypes.func.isRequired,
};

MonthAgendaCell.defaultProps = {
  daySummary: null,
  specialSummary: null,
};

const Header = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin-bottom: 14px;

  h1 {
    color: #1b1b1b;
    margin-bottom: 0;
    line-height: 1.05;
  }

  p {
    color: #6a795c;
  }

  @media (min-width: 720px) {
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
  }
`;

const Toolbar = styled.div`
  display: grid;
  grid-template-columns: minmax(210px, 1fr) minmax(320px, auto) minmax(170px, 1fr);
  align-items: center;
  gap: 18px;
  margin-bottom: 12px;

  @media (max-width: 860px) {
    align-items: stretch;
    grid-template-columns: 1fr;
  }
`;

const ViewSwitch = styled.div`
  display: inline-flex;
  background: #fff;
  border: 1px solid rgba(106, 121, 92, 0.2);
  border-radius: 10px;
  overflow: hidden;
  width: fit-content;

  @media (max-width: 520px) {
    width: 100%;
  }
`;

const ToggleButton = styled.button`
  min-height: 38px;
  padding: 0 16px;
  border: none;
  background: ${(props) => (props.$active ? "#6a795c" : "transparent")};
  color: ${(props) => (props.$active ? "#fff" : "#6a795c")};
  font-weight: 700;
  cursor: pointer;

  @media (max-width: 520px) {
    flex: 1;
  }
`;

const DateNav = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-width: 0;

  @media (max-width: 860px) {
    justify-content: center;
  }
`;

const AgendaRefreshStatus = styled.div`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  min-width: 122px;
  min-height: 34px;
  padding: 0 12px;
  border: 1px solid rgba(106, 121, 92, 0.18);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.82);
  color: #5f6d54;
  font-size: 0.82rem;
  font-weight: 800;
  opacity: ${(props) => (props.$visible ? 1 : 0)};
  visibility: ${(props) => (props.$visible ? "visible" : "hidden")};
  transform: translateY(${(props) => (props.$visible ? "0" : "2px")});
  transition:
    opacity 140ms ease,
    transform 140ms ease,
    visibility 140ms ease;
  pointer-events: none;

  svg {
    font-size: 0.82rem;
  }

  @media (max-width: 720px) {
    order: 10;
    width: 100%;
    max-width: 180px;
  }
`;

const DateContext = styled.div`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 38px;
  min-width: 260px;
  max-width: 360px;
  padding: 0 14px;

  @media (max-width: 520px) {
    width: auto;
    min-width: 0;
    padding: 0 8px;
  }
`;

const ToolbarActions = styled.div`
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
  flex-wrap: wrap;

  @media (max-width: 520px) {
    width: 100%;
    justify-content: flex-start;
  }
`;

const NavButton = styled.button`
  width: 38px;
  height: 38px;
  border-radius: 10px;
  border: 1px solid rgba(106, 121, 92, 0.2);
  background: #fff;
  color: #6a795c;
  display: flex;
  align-items: center;
  justify-content: center;
`;

const DateLabel = styled.span`
  font-weight: 800;
  color: #1b1b1b;
  min-width: 0;
  text-align: center;
  line-height: 1.2;
`;

const TemporalActions = styled.div`
  display: inline-flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
  min-width: 0;

  @media (max-width: 860px) {
    justify-content: center;
  }
`;

const AgendaControls = styled.div`
  display: grid;
  gap: 10px;
  margin-bottom: 14px;
  padding: 10px 12px 12px;
  border: 1px solid rgba(106, 121, 92, 0.12);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.62);
`;

const FiltersRow = styled.div`
  display: grid;
  grid-template-columns: minmax(132px, 180px) minmax(260px, 1fr);
  gap: 10px;
  align-items: end;

  @media (max-width: 700px) {
    grid-template-columns: 1fr;
  }
`;

const NotificationButton = styled.button`
  position: relative;
  width: 42px;
  height: 42px;
  border-radius: 12px;
  border: 1px solid
    ${(props) =>
    props.$active ? "rgba(185, 120, 35, 0.35)" : "rgba(106, 121, 92, 0.2)"};
  background: ${(props) => (props.$active ? "#fff5e7" : "#fff")};
  color: ${(props) => (props.$active ? "#8a5718" : "#6a795c")};
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 1.15rem;
  transition: transform 120ms ease, box-shadow 120ms ease, border-color 120ms ease;
  cursor: pointer;

  &:hover {
    transform: translateY(-1px);
    box-shadow: 0 10px 20px rgba(42, 52, 35, 0.08);
  }
`;

const NotificationBadge = styled.span`
  position: absolute;
  top: -6px;
  right: -6px;
  min-width: 20px;
  max-width: 32px;
  height: 20px;
  padding: 0 5px;
  border-radius: 999px;
  background: ${(props) => (props.$hasPending ? "#c63b32" : "#dfe6d8")};
  color: #fff;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-weight: 800;
  font-size: 0.68rem;
  line-height: 1;
  white-space: nowrap;
`;

const OperationalAlertSeverity = styled.span`
  align-self: start;
  border-radius: 999px;
  padding: 4px 8px;
  text-align: center;
  font-size: 11px;
  font-weight: 800;
  color: ${({ $severity }) => {
    if ($severity === "high") return "#991b1b";
    if ($severity === "medium") return "#92400e";
    return "#334155";
  }};
  background: ${({ $severity }) => {
    if ($severity === "high") return "#fee2e2";
    if ($severity === "medium") return "#fef3c7";
    return "#e2e8f0";
  }};
`;

const OperationalAlertBody = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 7px 12px;
  margin-top: 8px;
  min-width: 0;

  @media (max-width: 620px) {
    grid-template-columns: 1fr;
  }
`;

const OperationalAlertTopline = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  font-size: 13px;
  color: #0f172a;
`;

const OperationalAlertType = styled.span`
  color: #475569;
  font-size: 11px;
  font-weight: 800;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  text-transform: uppercase;
  white-space: nowrap;
`;

const OperationalAlertQuantity = styled.span`
  color: #0f172a;
  font-size: 12px;
  font-weight: 900;
  margin-left: auto;
`;

const OperationalAlertField = styled.div`
  min-width: 0;

  span {
    color: #64748b;
    display: block;
    font-size: 10px;
    font-weight: 800;
    margin-bottom: 2px;
    text-transform: uppercase;
  }

  strong {
    color: #0f172a;
    display: block;
    font-size: 12px;
    font-weight: 700;
    overflow-wrap: anywhere;
  }

  a {
    color: #2563eb;
    text-decoration: none;
  }
`;

const OperationalAlertAction = styled(OperationalAlertField)`
  grid-column: 1 / -1;
`;

const PendingDrawerPanel = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
`;

const PendingCenterHint = styled.div`
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  background: #f8fafc;
  color: #64748b;
  font-size: 12px;
  font-weight: 700;
  padding: 10px 12px;
`;

const PendingCenterSections = styled.div`
  display: flex;
  flex-direction: column;
  gap: 18px;
`;

const PendingCenterSection = styled.section`
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

const PendingSectionTitle = styled.h3`
  margin: 0;
  color: #516046;
  font-size: 0.78rem;
  font-weight: 900;
  letter-spacing: 0.04em;
  text-transform: uppercase;
`;

const PendingGroupList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

const PendingCategoryDetails = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

const PendingBackButton = styled.button`
  align-self: flex-start;
  border: 1px solid rgba(106, 121, 92, 0.22);
  border-radius: 8px;
  background: #fff;
  color: #516046;
  cursor: pointer;
  font-size: 0.84rem;
  font-weight: 800;
  padding: 7px 10px;

  &:hover {
    background: #f6f9f2;
    border-color: rgba(106, 121, 92, 0.36);
  }
`;

const PendingDetailHeader = styled.div`
  align-items: center;
  display: flex;
  gap: 12px;
  justify-content: space-between;
  padding: 2px 0 4px;
`;

const PendingCategoryButton = styled.button`
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px;
  border-radius: 10px;
  border: 1px solid ${({ $empty }) => ($empty ? "rgba(148, 163, 184, 0.18)" : "rgba(106, 121, 92, 0.16)")};
  background: ${({ $empty }) => ($empty ? "#f8fafc" : "#fbfcf8")};
  text-align: left;
  cursor: ${({ $empty }) => ($empty ? "default" : "pointer")};
  opacity: ${({ $empty }) => ($empty ? 0.68 : 1)};
  transition: border-color 120ms ease, background 120ms ease, transform 120ms ease;

  &:not(:disabled):hover {
    background: #f6f9f2;
    border-color: rgba(106, 121, 92, 0.28);
    transform: translateY(-1px);
  }
`;

const PendingGroupHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: nowrap;
`;

const PendingGroupTitle = styled.h3`
  margin: 0;
  color: #1b1b1b;
  font-size: 0.95rem;
`;

const PendingCountBadge = styled.span`
  min-width: 30px;
  height: 30px;
  padding: 0 8px;
  border-radius: 999px;
  background: ${({ $empty }) => ($empty ? "#e2e8f0" : "#c63b32")};
  color: ${({ $empty }) => ($empty ? "#64748b" : "#fff")};
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 0.78rem;
  font-weight: 800;
`;

const PendingGroupDetails = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const PendingDayRow = styled.div`
  align-items: center;
  border-top: 1px solid rgba(106, 121, 92, 0.12);
  display: flex;
  gap: 10px;
  justify-content: space-between;
  padding-top: 8px;

  strong {
    color: #1b1b1b;
    display: block;
    font-size: 0.9rem;
  }

  span {
    color: #6a795c;
    display: block;
    font-size: 0.78rem;
    margin-top: 2px;
  }
`;

const PendingOpenDayButton = styled.button`
  border: 1px solid rgba(106, 121, 92, 0.22);
  border-radius: 8px;
  background: #fff;
  color: #516046;
  cursor: pointer;
  font-size: 0.78rem;
  font-weight: 800;
  padding: 8px 10px;
  white-space: nowrap;

  &:hover {
    background: #f6f9f2;
  }
`;

const PendingPatientCard = styled.div`
  border: 1px solid rgba(106, 121, 92, 0.14);
  border-radius: 8px;
  background: #fff;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px 12px;
`;

const PendingPatientName = styled.strong`
  color: #1b1b1b;
  display: block;
  font-size: 0.92rem;

  a {
    color: inherit;
    text-decoration: none;
  }
`;

const PendingNestedList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const PendingNestedRow = styled.div`
  align-items: center;
  border-top: 1px solid rgba(106, 121, 92, 0.1);
  display: flex;
  gap: 10px;
  justify-content: space-between;
  min-width: 0;
  padding-top: 8px;

  div {
    min-width: 0;
  }

  span {
    color: #516046;
    display: block;
    font-size: 0.82rem;
    font-weight: 700;
    overflow-wrap: anywhere;
  }

  small {
    color: #6a795c;
    display: block;
    font-size: 0.78rem;
    font-weight: 700;
    margin-top: 3px;
  }

  @media (max-width: 520px) {
    align-items: flex-start;
    flex-direction: column;
  }
`;

const PendingDismissButton = styled.button`
  border: 1px solid rgba(106, 121, 92, 0.22);
  border-radius: 8px;
  background: #fff;
  color: #516046;
  cursor: pointer;
  flex: 0 0 auto;
  font-size: 0.78rem;
  font-weight: 800;
  padding: 8px 10px;
  white-space: nowrap;

  &:hover {
    background: #f6f9f2;
  }
`;

const PendingPlanLink = styled(Link)`
  border: 1px solid rgba(106, 121, 92, 0.22);
  border-radius: 8px;
  background: #fff;
  color: #516046;
  flex: 0 0 auto;
  font-size: 0.78rem;
  font-weight: 800;
  padding: 8px 10px;
  text-decoration: none;
  white-space: nowrap;

  &:hover {
    background: #f6f9f2;
  }
`;

const PendingPlanDueText = styled.small`
  color: ${({ $overdue }) => ($overdue ? "#b91c1c" : "#6a795c")} !important;
  display: block;
  font-size: 0.78rem;
  font-weight: 800;
  margin-top: 3px;
`;

const BirthdayAlertList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

const BirthdayDateGroup = styled.section`
  border: 1px solid rgba(185, 108, 63, 0.18);
  border-radius: 8px;
  background: #fffaf5;
  overflow: hidden;
`;

const BirthdayDateHeader = styled.div`
  align-items: center;
  background: #fff3e8;
  border-bottom: 1px solid rgba(185, 108, 63, 0.14);
  display: flex;
  gap: 10px;
  justify-content: space-between;
  padding: 10px 12px;

  strong {
    color: #7a3f1d;
    font-size: 0.88rem;
    font-weight: 900;
  }

  span {
    color: #9a5a32;
    flex: 0 0 auto;
    font-size: 0.76rem;
    font-weight: 800;
  }
`;

const BirthdayPatientList = styled.div`
  display: flex;
  flex-direction: column;
`;

const BirthdayPatientRow = styled.div`
  align-items: center;
  display: flex;
  gap: 10px;
  min-width: 0;
  padding: 10px 12px;

  & + & {
    border-top: 1px solid rgba(185, 108, 63, 0.12);
  }
`;

const BirthdayIcon = styled.span`
  align-items: center;
  background: #ffffff;
  border: 1px solid rgba(185, 108, 63, 0.2);
  border-radius: 999px;
  color: #b96c3f;
  display: inline-flex;
  flex: 0 0 auto;
  height: 28px;
  justify-content: center;
  width: 28px;

  svg {
    height: 13px;
    width: 13px;
  }
`;

const BirthdayPatientName = styled.strong`
  color: #1f2933;
  display: block;
  font-size: 0.91rem;
  font-weight: 800;
  min-width: 0;
  overflow-wrap: anywhere;

  a {
    color: inherit;
    text-decoration: none;
  }
`;

const PendingAlertRow = styled.div`
  border: 1px solid ${({ $severity }) => {
    if ($severity === "high") return "#fecaca";
    if ($severity === "medium") return "#fde68a";
    return "#d7dee8";
  }};
  border-left: 4px solid ${({ $severity }) => {
    if ($severity === "high") return "#dc2626";
    if ($severity === "medium") return "#d97706";
    return "#64748b";
  }};
  border-radius: 8px;
  background: #fff;
  padding: 8px 10px;
`;

const Legend = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  min-width: 0;
`;

const LegendItem = styled.button`
  display: inline-flex;
  align-items: center;
  border: 0;
  background: transparent;
  padding: 0;
  cursor: pointer;
  opacity: ${(props) => (props.$muted ? 0.42 : 1)};
  transition:
    opacity 140ms ease,
    transform 140ms ease;

  &:hover {
    opacity: 1;
    transform: translateY(-1px);
  }

  &:focus-visible {
    outline: 2px solid rgba(106, 121, 92, 0.38);
    outline-offset: 3px;
    border-radius: 999px;
  }
`;

const LegendLoading = styled.div`
  min-height: 28px;
  display: flex;
  align-items: center;
  color: #687263;
  font-size: 0.86rem;
  font-weight: 700;
`;

const FilterField = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 0.78rem;
  color: #516046;
  font-weight: 800;

  select {
    height: 36px;
    border-radius: 9px;
    border: 1px solid rgba(106, 121, 92, 0.2);
    padding: 0 9px;
    background: #fff;
    color: #1b1b1b;
    font-size: 0.88rem;
    font-weight: 600;
  }
`;

const SearchFilterField = styled.div`
  min-width: 0;
`;

const CompactPatientSearchField = styled(PatientSearchField)`
  min-width: 0;
  gap: 4px;
  font-size: 0.78rem;

  label {
    color: #516046;
    font-weight: 800;
  }

  input {
    min-height: 36px;
    border-radius: 9px;
    padding: 7px 10px;
    font-size: 0.88rem;
  }
`;

const ServicesControl = styled.div`
  display: grid;
  gap: 7px;
  min-width: 0;
`;

const ServicesLabel = styled.span`
  color: #516046;
  font-size: 0.78rem;
  font-weight: 900;
`;

const WeekGrid = styled.div`
  border-radius: 16px;
  overflow: hidden;
  border: 1px solid rgba(106, 121, 92, 0.2);
  background: #fff;
  box-shadow: 0 10px 24px rgba(42, 52, 35, 0.05);
`;

const WeekHeader = styled.div`
  display: grid;
  grid-template-columns: 80px repeat(5, minmax(0, 1fr));
  background: #f2f4ee;
  border-bottom: 1px solid rgba(106, 121, 92, 0.15);
`;

const WeekHeaderCell = styled.div`
  padding: 10px;
  text-align: center;
  position: relative;
  cursor: pointer;
  min-width: 0;

  &:hover {
    background: rgba(162, 177, 144, 0.12);
  }

  > span {
    display: block;
    color: #42523a;
    font-size: 0.8rem;
    font-weight: 800;
    letter-spacing: 0.01em;
  }
  > strong {
    font-size: 1rem;
    color: #1b1b1b;
    font-weight: 800;
  }
`;

const DaySpecialBadge = styled.span`
  position: absolute;
  top: 6px;
  right: 6px;
  min-height: 24px;
  padding: 3px 8px;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 0.68rem;
  font-weight: 800;
  background: ${(props) => {
    if (props.$severity === "block") return "#f9d9d6";
    if (props.$severity === "warn") return "#fdeacc";
    return "#e2ecda";
  }};
  color: ${(props) => {
    if (props.$severity === "block") return "#8f2f2a";
    if (props.$severity === "warn") return "#8a5718";
    return "#456039";
  }};

  span {
    font-size: 0.64rem;
    letter-spacing: 0.02em;
    text-transform: uppercase;
  }

  strong {
    font-size: 0.68rem;
  }
`;

const WeekBody = styled.div`
  display: grid;
  background: linear-gradient(180deg, #ffffff 0%, #fbfcf8 100%);
`;

const WeekPeriodRow = styled.div`
  display: grid;
  grid-template-columns: 80px repeat(5, minmax(0, 1fr));
  min-height: 36px;
  border-bottom: 1px solid rgba(106, 121, 92, 0.12);
  background: #f7f9f4;
`;

const WeekPeriodSpacer = styled.div`
  border-right: 1px solid rgba(106, 121, 92, 0.1);
  background: linear-gradient(180deg, #f5f7f1 0%, #eef2e9 100%);
`;

const WeekPeriodToggle = styled.button`
  grid-column: 2 / -1;
  display: inline-flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  width: 100%;
  padding: 8px 14px;
  border: none;
  background: ${(props) => (props.$expanded ? "rgba(162, 177, 144, 0.14)" : "rgba(162, 177, 144, 0.08)")};
  color: #42523a;
  cursor: pointer;
  transition: background 120ms ease, color 120ms ease;

  &:hover {
    background: rgba(162, 177, 144, 0.18);
  }
`;

const WeekPeriodLabel = styled.span`
  font-size: 0.82rem;
  font-weight: 800;
  letter-spacing: 0.02em;
  text-transform: uppercase;
`;

const WeekPeriodMeta = styled.span`
  margin-left: auto;
  font-size: 0.78rem;
  font-weight: 600;
  color: #6a795c;
`;

const WeekPeriodArrow = styled.strong`
  font-size: 0.9rem;
  line-height: 1;
`;

const WeekRow = styled.div`
  display: grid;
  grid-template-columns: 80px repeat(5, minmax(0, 1fr));
  min-height: 80px;
  border-bottom: 1px solid rgba(106, 121, 92, 0.3);
  background: ${(props) => (props.$striped ? "rgba(106, 121, 92, 0.018)" : "#fff")};
  box-shadow:
    inset 0 -1px 0 rgba(255, 255, 255, 0.88),
    inset 0 -2px 0 rgba(106, 121, 92, 0.06);
`;

const TimeCell = styled.div`
  padding: 8px 6px;
  color: #6a795c;
  font-weight: 600;
  border-right: 1px solid rgba(106, 121, 92, 0.14);
  background: ${(props) => (props.$striped ? "#f6f8f3" : "#fafbf8")};
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  min-width: 0;
  span {
    font-size: 0.88rem;
    font-weight: 800;
    color: #42523a;
    letter-spacing: 0.01em;
  }
`;

const HourExpandToggle = styled.button`
  width: 34px;
  height: 34px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: ${(props) => (props.$expanded ? "rgba(106, 121, 92, 0.22)" : "#fff")};
  border: 1px solid
    ${(props) => (props.$expanded ? "rgba(106, 121, 92, 0.42)" : "rgba(106, 121, 92, 0.32)")};
  border-radius: 999px;
  color: ${(props) => (props.$expanded ? "#42523a" : "#5d7050")};
  font-size: 1rem;
  font-weight: 700;
  padding: 0;
  cursor: pointer;
  line-height: 1;
  box-shadow: 0 3px 8px rgba(42, 52, 35, 0.1);
  transition:
    background 120ms ease,
    border-color 120ms ease,
    color 120ms ease,
    transform 120ms ease,
    box-shadow 120ms ease;

  &:hover {
    background: rgba(106, 121, 92, 0.14);
    border-color: rgba(106, 121, 92, 0.46);
    color: #42523a;
    transform: translateY(-1px);
    box-shadow: 0 6px 14px rgba(42, 52, 35, 0.14);
  }

  &:active {
    transform: translateY(0);
    box-shadow: 0 2px 6px rgba(42, 52, 35, 0.1);
  }

  &:focus-visible {
    outline: none;
    box-shadow:
      0 0 0 3px rgba(106, 121, 92, 0.18),
      0 5px 12px rgba(42, 52, 35, 0.12);
  }
`;

const SlotCell = styled.div`
  padding: 6px;
  border-right: 1px solid rgba(106, 121, 92, 0.1);
  display: flex;
  flex-direction: column;
  gap: 6px;
  cursor: pointer;
  min-width: 0;
  overflow: hidden;
  background: ${(props) => (props.$striped ? "rgba(106, 121, 92, 0.022)" : "transparent")};
  transition: background 120ms ease;
  &:hover {
    background: rgba(162, 177, 144, 0.08);
  }
`;

const GroupPill = styled.div`
  padding: 5px 8px;
  border-radius: 10px;
  background: ${(props) => {
    if (props.$history) return "#f2f3f0";
    if (props.$color) return `${props.$color}33`;
    if (props.$type === "pilates") return "rgba(122, 156, 112, 0.22)";
    if (props.$type === "funcional") return "rgba(120, 145, 176, 0.22)";
    if (props.$type === "fisioterapia") return "rgba(162, 177, 144, 0.35)";
    if (props.$type === "outro") return "rgba(201, 188, 152, 0.25)";
    return "rgba(162, 177, 144, 0.2)";
  }};
  border: 1px solid ${(props) => (props.$history ? "rgba(106, 121, 92, 0.13)" : "rgba(106, 121, 92, 0.2)")};
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
  width: 100%;
  min-width: 0;
  box-sizing: border-box;
  overflow: hidden;
  cursor: pointer;
  opacity: ${(props) => (props.$history ? 0.78 : 1)};
  span {
    font-size: 0.79rem;
    font-weight: 700;
    color: ${(props) => (props.$history ? "#60665c" : "#42523a")};
    line-height: 1.2;
  }
  strong {
    font-size: 0.75rem;
    color: #1b1b1b;
  }
`;

const GroupPillContent = styled.span`
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1 1 auto;
  min-width: 0;
  width: 100%;
`;

const GroupPillPatient = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  width: 100%;
`;

const WeekPillPatientName = styled.span`
  flex: 1 1 0;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: #25301f !important;
  font-size: 0.82rem !important;
  font-weight: 900 !important;
  line-height: 1.15 !important;
`;

const WeekPillMeta = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: flex-end;
  flex: 0 0 auto;
  min-width: max-content;
  color: #53624a !important;
  white-space: nowrap;
`;

const WeekPillMetaText = styled.span`
  flex: 0 0 auto;
  white-space: nowrap;
  text-align: right;
  color: inherit !important;
  font-size: 0.82rem !important;
  font-weight: 700 !important;
  line-height: 1.15 !important;
`;

const WeekHistoryStatusBadge = styled.span`
  flex: 0 0 auto;
  padding: 2px 6px;
  border-radius: 999px;
  border: 1px solid
    ${(props) => (props.$status === "canceled" ? "rgba(123, 58, 58, 0.2)" : "rgba(138, 87, 24, 0.22)")};
  background: ${(props) => (props.$status === "canceled" ? "rgba(123, 58, 58, 0.08)" : "rgba(138, 87, 24, 0.09)")};
  color: ${(props) => (props.$status === "canceled" ? "#7b3a3a" : "#8a5718")};
  font-size: 0.62rem !important;
  font-weight: 900 !important;
  text-transform: uppercase;
  letter-spacing: 0.02em;
`;

const OverflowIndicatorBadge = styled.button`
  align-self: flex-end;
  min-width: 58px;
  height: 20px;
  padding: 0 7px;
  border-radius: 999px;
  border: 1px solid rgba(106, 121, 92, 0.18);
  background: ${(props) => (props.$expanded ? "rgba(106, 121, 92, 0.12)" : "rgba(245, 247, 241, 0.82)")};
  color: #516046;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  flex-shrink: 0;
  cursor: pointer;
  transition:
    background 120ms ease,
    border-color 120ms ease,
    color 120ms ease,
    transform 120ms ease;

  span {
    font-size: 0.68rem;
    font-weight: 800;
    color: inherit;
  }

  &:hover {
    background: rgba(106, 121, 92, 0.12);
    border-color: rgba(106, 121, 92, 0.3);
    color: #42523a;
    transform: translateY(-1px);
  }

  &:focus-visible {
    outline: 2px solid rgba(106, 121, 92, 0.24);
    outline-offset: 2px;
  }
`;

const WeekOverflowArrow = styled.strong`
  font-size: 0.56rem;
  line-height: 1;
  color: inherit;
`;

const PopoverOverlay = styled.div`
  position: fixed;
  inset: 0;
  z-index: 1200;
`;

const PopoverCard = styled.div`
  position: fixed;
  z-index: 1201;
  width: 232px;
  background: #fff;
  border-radius: 14px;
  border: 1px solid rgba(106, 121, 92, 0.2);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.14);
  padding: 12px 0 8px;
  display: flex;
  flex-direction: column;
`;

const PopoverTitle = styled.div`
  font-size: 0.72rem;
  font-weight: 800;
  color: #6a795c;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  padding: 0 12px 8px;
  border-bottom: 1px solid rgba(106, 121, 92, 0.1);
  margin-bottom: 4px;
`;

const PopoverPatientRow = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 5px 12px;
  &:hover {
    background: rgba(106, 121, 92, 0.05);
  }
`;

const PopoverDot = styled.span`
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
  background: ${(props) => props.$color || "#6a795c"};
`;

const PopoverFooter = styled.div`
  border-top: 1px solid rgba(106, 121, 92, 0.1);
  margin-top: 4px;
  padding: 8px 12px 0;
  button {
    background: none;
    border: none;
    color: #516046;
    font-size: 0.8rem;
    font-weight: 700;
    cursor: pointer;
    padding: 0;
    &:hover { color: #1b1b1b; }
  }
`;

const DayPanel = styled.div`
  background: #fff;
  border-radius: 16px;
  border: 1px solid rgba(106, 121, 92, 0.18);
  padding: 20px;
`;

const DayHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
  h2 {
    margin: 0;
    color: #1b1b1b;
  }
`;

const DaySpecialStateBanner = styled.div`
  margin-bottom: 12px;
  padding: 10px 12px;
  border-radius: 10px;
  border: 1px solid
    ${(props) => {
    if (props.$severity === "block") return "rgba(199, 102, 102, 0.35)";
    if (props.$severity === "warn") return "rgba(196, 146, 73, 0.35)";
    return "rgba(106, 121, 92, 0.25)";
  }};
  background: ${(props) => {
    if (props.$severity === "block") return "rgba(199, 102, 102, 0.12)";
    if (props.$severity === "warn") return "rgba(214, 170, 104, 0.16)";
    return "rgba(162, 177, 144, 0.12)";
  }};
  display: grid;
  gap: 4px;

  strong {
    color: #1b1b1b;
    font-size: 0.9rem;
  }

  span {
    color: #556649;
    font-size: 0.82rem;
  }
`;

const DaySpecialList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 14px;
`;

const DaySpecialItem = styled.div`
  padding: 10px 12px;
  border-radius: 10px;
  border: 1px solid
    ${(props) => {
    if (props.$severity === "block") return "rgba(199, 102, 102, 0.35)";
    if (props.$severity === "warn") return "rgba(196, 146, 73, 0.35)";
    return "rgba(106, 121, 92, 0.25)";
  }};
  background: ${(props) => {
    if (props.$severity === "block") return "rgba(199, 102, 102, 0.12)";
    if (props.$severity === "warn") return "rgba(214, 170, 104, 0.16)";
    return "rgba(162, 177, 144, 0.12)";
  }};
  display: grid;
  gap: 4px;

  strong {
    color: #1b1b1b;
    font-size: 0.9rem;
  }

  span {
    color: #556649;
    font-size: 0.8rem;
  }

  small {
    color: #5a6750;
    font-size: 0.76rem;
    font-weight: 600;
  }
`;

const DayList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const DayTimeGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 8px 0 12px;
  border-bottom: 1px solid rgba(106, 121, 92, 0.14);

  &:last-child {
    border-bottom: none;
    padding-bottom: 0;
  }
`;

const DayTimeHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;

  strong {
    color: #1f1f1f;
    font-size: 1.18rem;
    font-weight: 800;
    letter-spacing: 0.01em;
    line-height: 1;
  }
`;

const DayCardsColumn = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const DayServiceGroupBlock = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
`;

const DayServiceGroupHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
`;

const DayServiceGroupBadge = styled.span`
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 0.7rem;
  font-weight: 700;
  color: #42523a;
  background: ${(props) => {
    if (props.$color) return `${props.$color}2A`;
    if (props.$type === "pilates") return "rgba(116, 141, 189, 0.22)";
    if (props.$type === "funcional") return "rgba(120, 145, 176, 0.22)";
    if (props.$type === "fisioterapia") return "rgba(162, 177, 144, 0.3)";
    if (props.$type === "outro") return "rgba(201, 188, 152, 0.3)";
    return "rgba(162, 177, 144, 0.2)";
  }};
`;

const AttendanceCallButton = styled.button`
  border: 1px solid rgba(106, 121, 92, 0.22);
  background: #fff;
  color: #516046;
  border-radius: 999px;
  padding: 4px 10px;
  font-size: 0.72rem;
  font-weight: 800;
  cursor: pointer;
  white-space: nowrap;
  transition: background 120ms ease, border-color 120ms ease, color 120ms ease;

  &:hover {
    background: rgba(106, 121, 92, 0.12);
    border-color: rgba(106, 121, 92, 0.38);
    color: #3f5035;
  }
`;

const DayServiceCards = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
`;

const DayHistoryBlock = styled.div`
  margin-top: 4px;
  padding-top: 8px;
  border-top: 1px dashed rgba(106, 121, 92, 0.2);
  display: flex;
  flex-direction: column;
  gap: 6px;
`;

const DayHistoryTitle = styled.span`
  color: #687161;
  font-size: 0.72rem;
  font-weight: 900;
  text-transform: uppercase;
  letter-spacing: 0.04em;
`;

const DaySessionCard = styled.article`
  display: grid;
  grid-template-columns: 5px 1fr;
  border-radius: 10px;
  overflow: visible;
  position: relative;
  border: 1px solid rgba(106, 121, 92, 0.18);
  background: ${(props) => {
    if (props.$history) return "#f6f7f4";
    if (props.$status === "done") return "rgba(94, 135, 90, 0.07)";
    if (props.$status === "canceled") return "rgba(199, 102, 102, 0.07)";
    if (props.$status === "suspended") return "rgba(106, 121, 92, 0.08)";
    if (props.$status === "no_show") return "rgba(214, 170, 104, 0.09)";
    return "#fff";
  }};
  opacity: ${(props) => (props.$history ? 0.78 : 1)};
`;

const DayServiceBar = styled.span`
  border-radius: 10px 0 0 10px;
  background: ${(props) => {
    if (props.$history) return "#b7bdb0";
    if (props.$color) return props.$color;
    return "#a2b190";
  }};
`;

const DaySessionBody = styled.div`
  padding: 8px 10px;
  display: flex;
  flex-direction: column;
  gap: 5px;
`;

const DaySessionTop = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
`;

const DaySessionPatient = styled.strong`
  margin: 0;
  color: #1f1f1f;
  font-size: 0.96rem;
  font-weight: 800;
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1 1 auto;
  min-width: 0;
`;

const DaySessionActions = styled.div`
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 6px;
  flex: 0 1 auto;
  min-width: 0;
  margin-left: auto;
  flex-wrap: nowrap;
  overflow: visible;
`;

const MonthPanel = styled.div`
  background: #fff;
  border-radius: 16px;
  border: 1px solid rgba(106, 121, 92, 0.18);
  padding: 16px;
`;

const MonthGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(${(props) => props.$cols || 7}, 1fr);
  gap: 8px;
`;

const MonthHeader = styled.div`
  text-align: center;
  font-weight: 700;
  color: #6a795c;
  padding: 6px;
  font-size: 0.92rem;
`;

const MonthCell = styled.div`
  min-height: 90px;
  border-radius: 12px;
  border: 1px solid rgba(106, 121, 92, 0.45);
  padding: 8px;
  cursor: pointer;
  background: ${(props) => (props.$active ? "rgba(162, 177, 144, 0.25)" : "#fff")};
  opacity: ${(props) => (props.$inactive ? 0.4 : 1)};
  display: flex;
  flex-direction: column;
  gap: 4px;
  transition: background 0.15s;
  &:hover {
    background: ${(props) => (props.$active ? "rgba(162, 177, 144, 0.35)" : "rgba(106, 121, 92, 0.06)")};
  }
  strong {
    color: #1b1b1b;
    font-size: 1.05rem;
    font-weight: 700;
    text-align: center;
  }
`;

const SpecialDayFlag = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 0.66rem;
  margin-top: 6px;
  margin-left: 0;
  font-weight: 700;
  white-space: nowrap;
  background: ${(props) => {
    if (props.$severity === "block") return "#f9d9d6";
    if (props.$severity === "warn") return "#fdeacc";
    return "#e2ecda";
  }};
  color: ${(props) => {
    if (props.$severity === "block") return "#8f2f2a";
    if (props.$severity === "warn") return "#8a5718";
    return "#456039";
  }};
`;

const MonthHint = styled.p`
  margin: 12px 0 0;
  color: #6a795c;
  font-size: 0.9rem;
`;

const WeekendToggleButton = styled.button`
  padding: 8px 12px;
  border-radius: 8px;
  border: 1px solid rgba(106, 121, 92, 0.28);
  background: ${(props) => (props.$active ? "rgba(106, 121, 92, 0.15)" : "transparent")};
  color: #6a795c;
  font-weight: 600;
  font-size: 0.82rem;
  cursor: pointer;
  transition: background 0.15s;
  &:hover {
    background: rgba(106, 121, 92, 0.12);
  }
`;

const MonthServiceChips = styled.div`
  display: flex;
  flex-direction: column;
  gap: 3px;
  margin-top: 2px;
`;

const MonthServiceChip = styled.span`
  display: block;
  padding: 2px 5px 2px 7px;
  border-radius: 4px;
  border-left: 3px solid ${(props) => (props.$history ? "#9aa196" : props.$color || "#6a795c")};
  background: ${(props) => (props.$history ? "#f1f3ef" : "rgba(106, 121, 92, 0.06)")};
  font-size: 0.63rem;
  font-weight: 600;
  color: ${(props) => (props.$history ? "#656d61" : "#2a2a2a")};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const MonthServiceMore = styled.span`
  font-size: 0.62rem;
  color: #6a795c;
  padding: 1px 5px;
  font-weight: 600;
`;

const DrawerHeader = styled.div`
  padding: 22px 20px;
  border-bottom: 1px solid rgba(106, 121, 92, 0.15);
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  h2 {
    margin: 0 0 6px;
  }
  span {
    color: #6a795c;
    font-size: 0.9rem;
  }
`;

const DrawerSubtitle = styled.span`
  display: block;
  color: ${(props) => (props.$prominent || props.$billingSummary ? "#1b1b1b" : "#6a795c")};
  font-size: ${(props) => {
    if (props.$billingSummary) return "1.05rem";
    if (props.$prominent) return "1rem";
    return "0.9rem";
  }};
  font-weight: ${(props) => {
    if (props.$billingSummary) return "800";
    if (props.$prominent) return "600";
    return "400";
  }};
  line-height: 1.3;
`;

const DrawerBody = styled.div`
  padding: 28px 20px 20px;
  overflow-y: auto;
  flex: 1;
`;

const DrawerActions = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 16px;
`;

const GroupPanel = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

const GroupHeader = styled.div`
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  h3 {
    margin: 0;
    font-size: 0.95rem;
    color: #1b1b1b;
  }
  span {
    color: #6a795c;
    font-size: 0.78rem;
  }
  > div {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
`;

const GroupList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const GroupSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 8px;
  border-radius: 12px;
  background: ${(props) =>
    props.$color ? `${props.$color}10` : "#ffffff"};
  border: 1px solid
    ${(props) =>
    props.$color ? `${props.$color}44` : "rgba(106, 121, 92, 0.22)"};
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.04);
`;

const GroupSectionHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  justify-content: space-between;
  padding: 6px 8px;
  border-radius: 8px;
  background: ${(props) =>
    props.$color ? `${props.$color}22` : "rgba(106, 121, 92, 0.1)"};
`;

const GroupSectionTitle = styled.h4`
  margin: 0;
  color: #1b1b1b;
  font-size: 0.95rem;
`;

const GroupSectionMeta = styled.span`
  display: inline-block;
  margin-top: 4px;
  color: #516046;
  font-size: 0.82rem;
  font-weight: 600;
`;

const GroupItem = styled.div`
  padding: 7px 8px;
  border-radius: 8px;
  border: 1px solid ${(props) => (props.$history ? "rgba(106, 121, 92, 0.08)" : "rgba(106, 121, 92, 0.1)")};
  background: ${(props) => (props.$history ? "#f5f6f3" : "rgba(255, 255, 255, 0.92)")};
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 8px;
  align-items: center;
  opacity: ${(props) => (props.$history ? 0.78 : 1)};

  @media (max-width: 720px) {
    grid-template-columns: 1fr;
  }
`;

const PatientInfo = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
`;

const PatientInfoName = styled.strong`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  min-width: 0;
  color: #1b1b1b;
  font-size: 0.88rem;
  line-height: 1.2;
`;

const PatientInfoMeta = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  min-width: 0;
`;

const PatientPlanSummary = styled.span`
  display: block;
  color: #5d7050;
  font-size: 0.74rem;
  font-weight: 700;
  line-height: 1.2;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const PatientInfoProfessional = styled.span`
  display: inline-flex;
  align-items: center;
  color: #6a795c;
  font-size: 0.78rem;
  line-height: 1;
  min-height: 20px;
`;

/**
 * Botão de status dentro do dropdown "Detalhes do horário".
 * Estende SessionStatusButton (AppSessionStatus) com ajustes de layout de lista.
 */
const GroupStatusButton = styled(SessionStatusButton)`
  width: 100%;
  justify-content: flex-start;
  padding: 8px 14px;
  font-size: 0.82rem;
  border-radius: 8px;
  border: none;
  background: ${(props) => (props.$active ? "#6a795c" : "#fff")};
  color: ${(props) => {
    if (props.$active) return "#fff";
    if (props.$status === "done") return "#2f5a33";
    if (props.$status === "canceled") return "#7b3a3a";
    if (props.$status === "suspended") return "#60665c";
    if (props.$status === "no_show") return "#8a5718";
    return "#516046";
  }};
  box-shadow: none;
  transition: background 120ms ease, color 120ms ease, transform 120ms ease;

  &:hover {
    background: ${(props) => (props.$active ? "#5f6f52" : "rgba(106, 121, 92, 0.14)")};
    box-shadow: none;
    filter: none;
    transform: translateX(2px);
  }
`;

const ActionsDropdown = styled.div`
  position: absolute;
  right: 0;
  top: calc(100% + 4px);
  z-index: 200;
  background: #fff;
  border: 1px solid rgba(106, 121, 92, 0.18);
  border-radius: 12px;
  box-shadow: 0 12px 30px rgba(32, 43, 27, 0.16);
  padding: 6px;
  min-width: 164px;
  display: flex;
  flex-direction: column;
  gap: 2px;
`;

const ActionsDropdownItem = styled.button`
  background: ${(props) => {
    if (props.$active && props.$tone === "done") return "rgba(47,90,51,0.1)";
    if (props.$active && props.$tone === "canceled") return "rgba(123,58,58,0.1)";
    if (props.$active && props.$tone === "suspended") return "rgba(106,121,92,0.1)";
    if (props.$active && props.$tone === "no_show") return "rgba(138,87,24,0.1)";
    if (props.$active) return "rgba(106,121,92,0.1)";
    return "none";
  }};
  border: none;
  text-align: left;
  padding: 7px 14px;
  font-size: 0.82rem;
  font-weight: ${(props) => (props.$active ? "700" : "500")};
  color: ${(props) => {
    if (props.$danger) return "#8c3737";
    if (props.$tone === "done") return "#2f5a33";
    if (props.$tone === "canceled") return "#7b3a3a";
    if (props.$tone === "suspended") return "#60665c";
    if (props.$tone === "no_show") return "#8a5718";
    return "#1b1b1b";
  }};
  cursor: pointer;
  &:disabled {
    cursor: not-allowed;
    opacity: 0.45;
  }
  &:not(:disabled):hover {
    background: rgba(106, 121, 92, 0.07);
  }
`;

const StatusAction = styled.button`
  border: 1px solid
    ${(props) => {
    if (props.$status === "done") return "rgba(94, 135, 90, 0.32)";
    if (props.$status === "canceled") return "rgba(199, 102, 102, 0.3)";
    if (props.$status === "suspended") return "rgba(106, 121, 92, 0.22)";
    if (props.$status === "no_show") return "rgba(214, 170, 104, 0.34)";
    return "rgba(106, 121, 92, 0.24)";
  }};
  background: ${(props) => {
    if (props.$active && props.$status === "done") return "#2f5a33";
    if (props.$active && props.$status === "canceled") return "#7b3a3a";
    if (props.$active && props.$status === "suspended") return "#60665c";
    if (props.$active && props.$status === "no_show") return "#8a5718";
    if (props.$active) return "#6a795c";
    if (props.$status === "done") return "rgba(94, 135, 90, 0.12)";
    if (props.$status === "canceled") return "rgba(199, 102, 102, 0.11)";
    if (props.$status === "suspended") return "rgba(106, 121, 92, 0.1)";
    if (props.$status === "no_show") return "rgba(214, 170, 104, 0.14)";
    return "#fff";
  }};
  color: ${(props) => {
    if (props.$active) return "#fff";
    if (props.$status === "done") return "#2f5a33";
    if (props.$status === "canceled") return "#7b3a3a";
    if (props.$status === "suspended") return "#60665c";
    if (props.$status === "no_show") return "#8a5718";
    return "#516046";
  }};
  padding: 7px 10px;
  border-radius: 9px;
  font-weight: 700;
  font-size: 0.82rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: transform 120ms ease, box-shadow 120ms ease, filter 120ms ease;

  &:hover {
    transform: translateY(-1px);
    box-shadow: 0 8px 18px rgba(42, 52, 35, 0.08);
    filter: brightness(0.98);
  }
`;

const DayDropdownWrapper = styled.div`
  position: relative;
  display: inline-flex;
  align-items: center;
  flex: 0 0 auto;
`;

const DayStatusMenuButton = styled(StatusAction)`
  min-width: 112px;
  padding: 5px 10px;
  border-radius: 999px;
  font-size: 0.76rem;
  gap: 6px;
  box-shadow: none;
  white-space: nowrap;

  span {
    font-size: 0.62rem;
    line-height: 1;
  }

  &:disabled {
    opacity: 0.68;
    cursor: not-allowed;
    transform: none;
    box-shadow: none;
    filter: none;
  }
`;

const DayKebabButton = styled.button`
  width: 30px;
  height: 30px;
  border-radius: 999px;
  border: 1px solid rgba(106, 121, 92, 0.22);
  background: #fff;
  color: #516046;
  font-size: 1.05rem;
  font-weight: 800;
  line-height: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background 120ms ease, box-shadow 120ms ease, transform 120ms ease;

  &:hover {
    background: #f5f7f1;
    box-shadow: 0 8px 18px rgba(42, 52, 35, 0.08);
    transform: translateY(-1px);
  }
`;


const ModalOverlay = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.35);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1300;
  padding: 16px;
  overflow-y: auto;
`;

const ModalCard = styled.div`
  width: min(520px, 92vw);
  background: #fff;
  border-radius: 16px;
  border: 1px solid rgba(106, 121, 92, 0.2);
  box-shadow: 0 18px 40px rgba(0, 0, 0, 0.18);
  padding: 18px;
  display: flex;
  flex-direction: column;
  gap: 14px;
`;

const ModalHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;

  h3 {
    margin: 0;
    color: #1b1b1b;
  }
`;

const ModalBody = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;

  textarea {
    width: 100%;
    box-sizing: border-box;
    border-radius: 12px;
    border: 1px solid rgba(106, 121, 92, 0.25);
    padding: 12px;
    font-size: 0.95rem;
    resize: vertical;
  }
`;

const ModalFieldLabel = styled.span`
  color: #1b1b1b;
  font-size: 0.86rem;
  font-weight: 800;
`;

const AbsencePolicyInline = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 2px 0 4px;

  > span {
    color: #b42318;
    font-size: 0.82rem;
    font-weight: 800;
    line-height: 1.35;
  }
`;

const AbsenceImpactPanel = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
  border: 1px solid rgba(214, 170, 104, 0.36);
  border-radius: 10px;
  background: rgba(255, 248, 235, 0.86);
  padding: 10px 12px;

  strong {
    color: #1b1b1b;
    font-size: 0.9rem;
    font-weight: 900;
  }

  span {
    color: #6d4b18;
    font-size: 0.82rem;
    font-weight: 700;
    line-height: 1.35;
  }
`;

const ModalActions = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  flex-shrink: 0;
`;

const AttendanceCallCard = styled(ModalCard)`
  width: min(820px, 96vw);
  max-height: calc(100vh - 32px);
  overflow: hidden;
`;

const AttendanceCallTitle = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;

  h3 {
    margin: 0;
  }

  span {
    color: #5d6b52;
    font-size: 0.86rem;
    font-weight: 700;
  }
`;

const AttendanceCallBody = styled.div`
  display: flex;
  flex-direction: column;
  gap: 14px;
  overflow-y: auto;
  min-height: 0;
  padding-right: 2px;
`;

const AttendanceCallServiceSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
`;

const AttendanceCallServiceHeader = styled.div`
  display: inline-flex;
  align-items: center;
  padding: 3px 10px;
  border-radius: 999px;
  font-size: 0.72rem;
  font-weight: 700;
  color: #42523a;
  background: ${(props) => {
    if (props.$color) return `${props.$color}2A`;
    if (props.$code === "pilates") return "rgba(116, 141, 189, 0.22)";
    if (props.$code === "funcional") return "rgba(120, 145, 176, 0.22)";
    if (props.$code === "fisioterapia") return "rgba(162, 177, 144, 0.3)";
    return "rgba(162, 177, 144, 0.2)";
  }};
`;

const AttendanceCallRow = styled.div`
  display: grid;
  grid-template-columns: minmax(180px, 1fr) auto;
  gap: 10px;
  align-items: center;
  border: 1px solid rgba(106, 121, 92, 0.14);
  border-radius: 10px;
  padding: 10px;
  background: #fbfcf9;

  @media (max-width: 720px) {
    grid-template-columns: 1fr;
  }
`;

const AttendanceCallInfo = styled.div`
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;

  strong,
  span {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  strong {
    color: #1f1f1f;
    font-size: 0.95rem;
  }

  span {
    color: #5d6b52;
    font-size: 0.78rem;
    font-weight: 700;
  }
`;

const AttendanceStatusToggle = styled.div`
  display: inline-flex;
  border: 1px solid rgba(106, 121, 92, 0.18);
  border-radius: 999px;
  padding: 3px;
  background: #fff;
  justify-self: end;

  @media (max-width: 720px) {
    justify-self: start;
  }
`;

const AttendanceStatusButton = styled.button`
  border: none;
  border-radius: 999px;
  padding: 6px 12px;
  font-size: 0.78rem;
  font-weight: 800;
  cursor: pointer;
  background: ${(props) => {
    if (!props.$active) return "transparent";
    if (props.$tone === "no_show") return "#8a5718";
    return "#2f5a33";
  }};
  color: ${(props) => (props.$active ? "#fff" : "#516046")};
  transition: background 120ms ease, color 120ms ease;

  &:hover {
    background: ${(props) => {
    if (props.$active && props.$tone === "no_show") return "#7c4e16";
    if (props.$active) return "#294f2d";
    return "rgba(106, 121, 92, 0.12)";
  }};
  }

  &:disabled {
    opacity: 0.65;
    cursor: not-allowed;
  }
`;

const AttendanceReasonInput = styled.input`
  grid-column: 1 / -1;
  width: 100%;
  box-sizing: border-box;
  border: 1px solid rgba(138, 87, 24, 0.22);
  border-radius: 9px;
  padding: 8px 10px;
  color: #1f1f1f;
  font-size: 0.86rem;
  background: #fff;
`;

const RecurrencePreviewCard = styled(ModalCard)`
  width: min(860px, 96vw);
  max-height: calc(100vh - 32px);
  overflow: hidden;
`;

const RecurrencePreviewBody = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
  overflow-y: auto;
  flex: 1;
  min-height: 0;
`;

const RecurrenceSummaryGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 8px;
`;

const RecurrenceSummaryItem = styled.div`
  border-radius: 10px;
  border: 1px solid
    ${(props) => {
    if (props.$variant === "block") return "rgba(199, 102, 102, 0.3)";
    if (props.$variant === "warn") return "rgba(196, 146, 73, 0.32)";
    return "rgba(106, 121, 92, 0.2)";
  }};
  background: ${(props) => {
    if (props.$variant === "block") return "rgba(199, 102, 102, 0.1)";
    if (props.$variant === "warn") return "rgba(214, 170, 104, 0.14)";
    return "#f8faf5";
  }};
  padding: 8px 10px;
  display: grid;
  gap: 2px;

  small {
    color: #6a795c;
    font-size: 0.72rem;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  strong {
    color: #1b1b1b;
    font-size: 1rem;
  }
`;

const RecurrenceHint = styled.p`
  margin: 0;
  color: #556649;
  font-size: 0.88rem;
`;

const RecurrenceSectionDivider = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  color: #42523a;
  font-size: 0.82rem;
  font-weight: 800;

  &::before,
  &::after {
    content: "";
    height: 1px;
    flex: 1;
    background: rgba(106, 121, 92, 0.2);
  }
`;

const RecurrenceList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const RecurrenceRow = styled.div`
  border-radius: 10px;
  border: 1px solid
    ${(props) => {
    if (props.$status === "BLOCK") return "rgba(199, 102, 102, 0.35)";
    if (props.$status === "WARN_CONFIRM") return "rgba(196, 146, 73, 0.35)";
    if (props.$status === "INFO") return "rgba(106, 121, 92, 0.25)";
    return "rgba(106, 121, 92, 0.2)";
  }};
  background: ${(props) => {
    if (props.$status === "BLOCK") return "rgba(199, 102, 102, 0.1)";
    if (props.$status === "WARN_CONFIRM") return "rgba(214, 170, 104, 0.12)";
    if (props.$selected) return "rgba(162, 177, 144, 0.12)";
    return "#fff";
  }};
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 10px;
  padding: 10px;
`;

const RecurrenceRowSelect = styled.div`
  padding-top: 3px;

  input {
    width: 18px;
    height: 18px;
    accent-color: #6a795c;
  }
`;

const RecurrenceRowInfo = styled.div`
  display: grid;
  gap: 4px;

  strong {
    color: #1b1b1b;
    font-size: 0.9rem;
  }

  span {
    color: #5f6d53;
    font-size: 0.82rem;
    font-weight: 600;
  }

  small {
    color: #6a795c;
    font-size: 0.77rem;
  }
`;

const RecurrenceOccurrenceHeader = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto;
  align-items: flex-start;
  gap: 10px;

  > div {
    display: grid;
    gap: 3px;
    min-width: 0;
  }
`;

const RecurrenceSequenceBadge = styled.span`
  justify-self: end;
  color: #42523a;
  font-size: 0.84rem;
  font-weight: 800;
  white-space: nowrap;
`;

const RecurrenceInlineButton = styled.button`
  border: 0;
  background: transparent;
  color: #556649;
  font-size: 0.78rem;
  font-weight: 800;
  padding: 2px 0;
  cursor: pointer;

  &:disabled {
    cursor: not-allowed;
    opacity: 0.55;
  }
`;

const RecurrenceEditBox = styled.div`
  display: grid;
  grid-template-columns: minmax(130px, 1fr) minmax(110px, 0.8fr) auto;
  gap: 8px;
  align-items: end;
  border: 1px solid rgba(106, 121, 92, 0.16);
  border-radius: 10px;
  padding: 8px;
  background: rgba(255, 255, 255, 0.72);

  label {
    display: grid;
    gap: 3px;
  }

  input {
    width: 100%;
    box-sizing: border-box;
    border: 1px solid rgba(106, 121, 92, 0.22);
    border-radius: 8px;
    padding: 7px 8px;
    color: #1b1b1b;
    font-size: 0.86rem;
  }

  small {
    grid-column: 1 / -1;
    color: #b42318;
    font-weight: 700;
  }

  @media (max-width: 720px) {
    grid-template-columns: 1fr;
  }
`;

const RecurrenceEditActions = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 6px;

  button {
    min-height: 34px;
    padding: 7px 10px;
  }
`;

const RecurrenceEventList = styled.ul`
  margin: 0;
  padding-left: 16px;
  color: #556649;
  font-size: 0.8rem;
  display: grid;
  gap: 2px;
`;

const RecurrenceOverrideField = styled.div`
  display: grid;
  gap: 6px;

  span {
    font-size: 0.82rem;
    color: #1b1b1b;
    font-weight: 600;
  }

  textarea {
    width: 100%;
    box-sizing: border-box;
    border-radius: 10px;
    border: 1px solid rgba(106, 121, 92, 0.25);
    padding: 10px 12px;
    font-size: 0.9rem;
    resize: vertical;
  }
`;

const DeleteFlowCard = styled(ModalCard)`
  width: min(760px, 96vw);
  max-height: 88vh;
`;

const DeleteFlowBody = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
  overflow-y: auto;
`;

const DeleteChoiceGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 10px;
`;

const DeleteChoiceButton = styled.button`
  border: 1px solid ${(props) => (props.$danger ? "#f2b8a8" : "rgba(106, 121, 92, 0.22)")};
  background: ${(props) => (
    props.$danger
      ? "linear-gradient(180deg, #fffaf7 0%, #fff1eb 100%)"
      : "linear-gradient(180deg, #ffffff 0%, #f8faf5 100%)"
  )};
  border-radius: 14px;
  padding: 16px 18px;
  text-align: left;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  cursor: pointer;
  box-shadow: 0 10px 24px rgba(42, 52, 35, 0.05);
  transition:
    transform 120ms ease,
    box-shadow 120ms ease,
    border-color 120ms ease,
    background 120ms ease;

  > div {
    display: flex;
    flex-direction: column;
    gap: 5px;
    min-width: 0;
  }

  strong {
    color: ${(props) => (props.$danger ? "#8c2f16" : "#1b1b1b")};
    font-size: 0.95rem;
    font-weight: 700;
  }

  span {
    color: ${(props) => (props.$danger ? "#9a3412" : "#5f6d53")};
    font-size: 0.82rem;
    line-height: 1.35;
    font-weight: 600;
  }

  svg {
    flex: 0 0 auto;
    color: #6a795c;
    font-size: 0.95rem;
  }

  &:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 14px 26px rgba(42, 52, 35, 0.1);
    border-color: ${(props) => (props.$danger ? "#e8957f" : "rgba(106, 121, 92, 0.4)")};
    background: ${(props) => (
    props.$danger
      ? "linear-gradient(180deg, #fff7f2 0%, #ffe8de 100%)"
      : "linear-gradient(180deg, #ffffff 0%, #eef4e8 100%)"
  )};
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.55;
    box-shadow: none;
  }
`;

const DeleteStepIntro = styled.div`
  display: flex;
  flex-direction: column;
  gap: 5px;
  padding: 12px 14px;
  border-radius: 12px;
  border: 1px solid rgba(106, 121, 92, 0.14);
  background: #fbfcf8;

  strong {
    color: #1b1b1b;
    font-size: 0.95rem;
    font-weight: 800;
  }

  span {
    color: #5f6d53;
    font-size: 0.84rem;
    line-height: 1.45;
    font-weight: 600;
  }
`;

const PackageRemoveSummary = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
  border: 1px solid rgba(106, 121, 92, 0.16);
  border-radius: 14px;
  background: #fbfcf8;
  padding: 16px 18px;
`;

const PackageRemoveEyebrow = styled.span`
  color: #6a795c;
  font-size: 0.72rem;
  font-weight: 900;
  letter-spacing: 0.04em;
  text-transform: uppercase;
`;

const PackageRemovePatient = styled.strong`
  color: #1b1b1b;
  font-size: 1rem;
  font-weight: 900;
  line-height: 1.3;
`;

const PackageRemoveMain = styled.span`
  margin-top: 6px;
  color: #1b1b1b;
  font-size: 0.95rem;
  font-weight: 900;
  line-height: 1.35;
`;

const PackageRemoveDate = styled.span`
  color: #394235;
  font-size: 0.9rem;
  font-weight: 700;
  line-height: 1.35;
`;

const PackageRemoveMeta = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-top: 8px;

  span {
    color: #4f5f47;
    font-size: 0.84rem;
    font-weight: 700;
    line-height: 1.35;
  }
`;

const PackageRemoveDecisionGroup = styled.fieldset`
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin: 14px 0 0;
  padding: 0;
  border: 0;
`;

const PackageRemoveQuestion = styled.legend`
  margin-bottom: 2px;
  color: #1b1b1b;
  font-size: 0.92rem;
  font-weight: 900;
`;

const PackageRemoveRadioOption = styled.label`
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 44px;
  padding: 10px 12px;
  border: 1px solid rgba(106, 121, 92, 0.18);
  border-radius: 8px;
  background: #fff;
  color: #263021;
  font-size: 0.9rem;
  font-weight: 700;
  line-height: 1.35;

  input {
    flex: 0 0 auto;
    width: 16px;
    height: 16px;
    accent-color: #6a795c;
  }

  span {
    min-width: 0;
  }
`;

const PackageRemovePrimaryAction = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-width: 170px;
  padding: 10px 18px;
  border-radius: 10px;
  border: none;
  background: #8c4a3c;
  color: #fff;
  font-weight: 800;
  box-shadow: 0 12px 26px rgba(140, 74, 60, 0.18);

  &:hover:not(:disabled) {
    background: #7b3f33;
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;

const DeleteReviewList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const DeleteReviewToolbar = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 12px;
  border-radius: 12px;
  border: 1px solid rgba(106, 121, 92, 0.14);
  background: #fbfcf8;

  label {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    color: #1b1b1b;
    font-size: 0.86rem;
    font-weight: 800;
    cursor: pointer;
  }

  input {
    width: 18px;
    height: 18px;
    accent-color: #8c3737;
  }

  small {
    color: #6a795c;
    font-size: 0.78rem;
    font-weight: 700;
    white-space: nowrap;
  }

  @media (max-width: 520px) {
    align-items: flex-start;
    flex-direction: column;
  }
`;

const DeleteDangerNotice = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 10px 12px;
  border: 1px solid #f2b8a8;
  border-radius: 10px;
  background: #fff4ef;
  color: #9a3412;

  strong {
    color: #9a3412;
    font-size: 0.86rem;
    line-height: 1.45;
  }

  label {
    align-items: flex-start;
    color: #7c2d12;
    font-size: 0.84rem;
  }

  input {
    accent-color: #c2410c;
    margin-top: 2px;
  }
`;

const DeleteReviewRow = styled.div`
  border-radius: 12px;
  border: 1px solid rgba(106, 121, 92, 0.18);
  background: ${(props) => {
    if (props.$blocked) return "#f6f5f1";
    return props.$selected ? "rgba(162, 177, 144, 0.12)" : "#fff";
  }};
  display: grid;
  grid-template-columns: ${(props) => (props.$blocked ? "minmax(0, 1fr) auto" : "auto minmax(0, 1fr) auto")};
  gap: 10px;
  align-items: center;
  padding: 10px 12px;
  opacity: ${(props) => (props.$blocked ? 0.82 : 1)};

  @media (max-width: 680px) {
    grid-template-columns: auto minmax(0, 1fr);
  }
`;

const DeleteBlockedSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-top: 4px;

  > strong {
    color: #8c3737;
    font-size: 0.86rem;
    font-weight: 800;
  }
`;

const DeleteReviewSelect = styled.div`
  display: flex;
  align-items: flex-start;
  padding-top: 2px;

  input {
    width: 18px;
    height: 18px;
    accent-color: #8c3737;
  }
`;

const DeleteReviewInfo = styled.div`
  min-width: 0;
  display: grid;
  gap: 4px;

  strong {
    color: #1b1b1b;
    font-size: 0.9rem;
  }

  span,
  small {
    color: #5f6d53;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  span {
    font-size: 0.84rem;
    font-weight: 600;
  }

  small {
    font-size: 0.8rem;
  }
`;

const DeleteReviewPatient = styled.small`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
`;

const PatientInlineText = styled.span`
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const PatientProfileLink = styled(Link)`
  display: inline-flex;
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  color: inherit;
  text-decoration: none;
  cursor: pointer;

  &:hover {
    color: #4f6b45;
    text-decoration: underline;
    text-underline-offset: 3px;
  }
`;

const CompactSessionType = styled.span`
  flex: 0 0 48px;
  width: 48px;
  min-width: 48px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-align: right;
  color: #4f6045;
  font-size: 0.72rem;
  font-weight: 800;
`;

const CompactSessionCounter = styled.span`
  flex: 0 0 34px;
  width: 34px;
  min-width: 34px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-align: right;
  color: #4f6045;
  font-size: 0.72rem;
  font-weight: 800;
`;

const PatientAttentionDot = styled.span`
  width: 10px;
  height: 10px;
  border-radius: 999px;
  flex: 0 0 10px;
  display: inline-block;
  background: ${(props) => {
    if (props.$tone === "high") return "#c53b32";
    if (props.$tone === "medium") return "#b87400";
    return "transparent";
  }};
  border: 1.5px solid
    ${(props) => {
    if (props.$tone === "high") return "#c53b32";
    if (props.$tone === "medium") return "#b87400";
    return "rgba(106, 121, 92, 0.4)";
  }};
  box-shadow: ${(props) =>
    props.$tone === "undefined" ? "none" : "0 0 0 2px rgba(255, 255, 255, 0.6)"};
`;

const PopoverPatientName = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  width: 100%;
  font-size: 0.82rem;
  color: #1b1b1b;
  font-weight: 500;
`;

const DeleteBlockedReason = styled.small`
  color: #b42318;
  font-weight: 900;
  white-space: normal;
  overflow: visible;
  text-overflow: clip;
`;

const DeleteStatusPill = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 5px 10px;
  border-radius: 999px;
  font-size: 0.74rem;
  font-weight: 700;
  border: 1px solid
    ${(props) => {
    if (props.$status === "done") return "rgba(94, 135, 90, 0.32)";
    if (props.$status === "canceled") return "rgba(199, 102, 102, 0.3)";
    if (props.$status === "no_show") return "rgba(214, 170, 104, 0.34)";
    return "rgba(106, 121, 92, 0.24)";
  }};
  background: ${(props) => {
    if (props.$status === "done") return "rgba(94, 135, 90, 0.12)";
    if (props.$status === "canceled") return "rgba(199, 102, 102, 0.11)";
    if (props.$status === "no_show") return "rgba(214, 170, 104, 0.14)";
    return "#f8faf5";
  }};
  color: ${(props) => {
    if (props.$status === "done") return "#2f5a33";
    if (props.$status === "canceled") return "#7b3a3a";
    if (props.$status === "no_show") return "#8a5718";
    return "#516046";
  }};

  @media (max-width: 680px) {
    grid-column: 2;
    justify-self: flex-start;
  }
`;

const DeleteConfirmButton = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-width: 170px;
  padding: 10px 18px;
  border-radius: 10px;
  border: none;
  background: #a83f3f;
  color: #fff;
  font-weight: 700;
  transition: filter 0.2s ease;

  &:hover:not(:disabled) {
    filter: brightness(0.95);
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;

const Form = styled.form`
  display: flex;
  flex-direction: column;
  gap: 18px;
`;

const FormGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 12px;

  .span-2 {
    grid-column: span 2;
  }
`;

const Field = styled.label`
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 0.9rem;
  font-weight: 800;
  color: #1b1b1b;

  input,
  select,
  textarea {
    border-radius: 10px;
    border: 1px solid rgba(106, 121, 92, 0.2);
    padding: 10px 12px;
    font-size: 0.95rem;
    font-weight: 500;
    color: #1b1b1b;
    background: #fff;
  }

  textarea {
    resize: vertical;
  }

  textarea.is-invalid {
    border-color: #c63b32;
    box-shadow: 0 0 0 3px rgba(198, 59, 50, 0.1);
  }
`;

const FieldBubble = styled.span`
  position: relative;
  align-self: flex-start;
  margin-top: 2px;
  border-radius: 8px;
  background: #c63b32;
  color: #fff;
  font-size: 0.76rem;
  font-weight: 800;
  line-height: 1.2;
  padding: 7px 10px;

  &::before {
    content: "";
    position: absolute;
    top: -6px;
    left: 14px;
    width: 0;
    height: 0;
    border-left: 6px solid transparent;
    border-right: 6px solid transparent;
    border-bottom: 6px solid #c63b32;
  }
`;

const ScheduleContextCard = styled.div`
  border-radius: 12px;
  border: 1px solid
    ${(props) => {
    if (props.$severity === "block") return "rgba(199, 102, 102, 0.35)";
    if (props.$severity === "warn") return "rgba(196, 146, 73, 0.35)";
    if (props.$severity === "info") return "rgba(106, 121, 92, 0.25)";
    return "rgba(106, 121, 92, 0.2)";
  }};
  background: ${(props) => {
    if (props.$severity === "block") return "rgba(199, 102, 102, 0.12)";
    if (props.$severity === "warn") return "rgba(214, 170, 104, 0.16)";
    if (props.$severity === "info") return "rgba(162, 177, 144, 0.12)";
    return "#f8faf5";
  }};
  padding: 10px 12px;
  display: grid;
  gap: 6px;

  strong {
    color: #1b1b1b;
    font-size: 0.9rem;
  }

  span {
    color: #556649;
    font-size: 0.82rem;
  }
`;

const LatePolicyCard = styled.div`
  border: 1px solid rgba(106, 121, 92, 0.16);
  border-radius: 10px;
  padding: 12px;
  background: #fff;
  display: grid;
  gap: 10px;

  textarea {
    border-radius: 10px;
    border: 1px solid rgba(106, 121, 92, 0.2);
    padding: 10px 12px;
    font-size: 0.95rem;
    color: #1b1b1b;
    background: #fff;
    resize: vertical;
  }
`;

const LatePolicyToggle = styled.label`
  display: flex;
  align-items: center;
  gap: 8px;
  color: #1b1b1b;
  font-size: 0.9rem;

  input {
    width: 16px;
    height: 16px;
  }
`;

const PackageScopeCard = styled.div`
  display: grid;
  gap: 6px;
`;

const PackageScopeHeader = styled.div`
  strong {
    color: #1b1b1b;
    font-size: 0.86rem;
    font-weight: 800;
  }
`;

const PackageScopeOptions = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
  gap: 6px;
`;

const PackageScopeOption = styled.label`
  border: 1px solid rgba(106, 121, 92, 0.2);
  border-radius: 9px;
  padding: 7px 10px;
  background: #fff;
  display: flex;
  align-items: center;
  gap: 7px;
  color: #1b1b1b;
  font-size: 0.84rem;
  cursor: ${(props) => (props.$disabled ? "not-allowed" : "pointer")};
  opacity: ${(props) => (props.$disabled ? 0.55 : 1)};

  input {
    width: 14px;
    height: 14px;
  }
`;

const PackageScopeHint = styled.small`
  color: ${(props) => (props.$danger ? "#b42318" : "#6a795c")};
  font-weight: ${(props) => (props.$danger ? 800 : 700)};
  line-height: 1.4;
`;

const BillingModeCard = styled.div`
  border: 1px solid rgba(106, 121, 92, 0.18);
  border-radius: 14px;
  padding: 14px;
  background: #f9faf6;
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

const BillingModeHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;

  strong {
    font-size: 0.95rem;
    color: #1b1b1b;
  }

  span {
    font-size: 0.82rem;
    color: #6a795c;
  }
`;

const BillingModeOptions = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
`;

const BillingModeOption = styled.button`
  border: 2px solid
    ${(props) => (props.$active ? "#6a795c" : "rgba(106, 121, 92, 0.2)")};
  border-radius: 10px;
  padding: 10px 12px;
  background: ${(props) => (props.$active ? "rgba(106, 121, 92, 0.12)" : "#fff")};
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: 3px;
  text-align: left;
  transition: border-color 0.15s, background 0.15s;

  strong {
    font-size: 0.9rem;
    color: ${(props) => (props.$active ? "#3d5230" : "#1b1b1b")};
  }

  span {
    font-size: 0.78rem;
    color: #6a795c;
  }

  &:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }
`;

const ActivePlansCard = styled.div`
  border: 1px solid rgba(106, 121, 92, 0.35);
  border-radius: 12px;
  padding: 10px 14px;
  background: rgba(106, 121, 92, 0.09);
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

const ActivePlanRow = styled.span`
  font-size: 0.86rem;
  color: #2e4025;

  strong {
    color: #1b1b1b;
  }
`;

const CoveragePreviewCard = styled.div`
  border: 1px solid rgba(106, 121, 92, 0.18);
  border-radius: 12px;
  padding: 10px 14px;
  background: #f8faf5;
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

const CoveragePreviewRow = styled.span`
  font-size: 0.83rem;
  color: #3d5230;

  strong {
    color: #1b1b1b;
  }
`;

const RepeatCard = styled.div`
  border: 1px solid rgba(106, 121, 92, 0.18);
  border-radius: 14px;
  padding: 14px;
  background: #f9faf6;
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const RepeatHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;

  strong {
    display: block;
    font-size: 0.95rem;
    color: #1b1b1b;
  }

  span {
    color: #6a795c;
    font-size: 0.85rem;
  }
`;

const RepeatToggle = styled.label`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  color: #6a795c;

  input {
    width: 18px;
    height: 18px;
    accent-color: #6a795c;
  }
`;

const RepeatBody = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const RepeatRow = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 12px;
`;

const RepeatField = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 0.85rem;
  color: #1b1b1b;

  &.full {
    grid-column: 1 / -1;
  }

  input {
    border-radius: 10px;
    border: 1px solid rgba(106, 121, 92, 0.2);
    padding: 8px 10px;
    font-size: 0.9rem;
    background: #fff;
  }

  small {
    color: #6a795c;
  }
`;

const RepeatLabel = styled.span`
  font-size: 0.85rem;
  font-weight: 600;
  color: #1b1b1b;
`;

const RepeatReadonlyValue = styled.div`
  border-radius: 10px;
  border: 1px solid rgba(106, 121, 92, 0.18);
  background: #f8faf5;
  padding: 8px 10px;
  font-size: 0.9rem;
  color: #2f3a26;
  font-weight: 600;
`;

const RepeatInline = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;

  input {
    width: 90px;
  }

  span {
    font-size: 0.85rem;
    color: #6a795c;
  }
`;

const RepeatModes = styled.div`
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
`;

const RepeatModeButton = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 0.85rem;
  color: #516046;
  border: 1px solid rgba(106, 121, 92, 0.25);
  background: ${(props) => (props.$active ? "rgba(106, 121, 92, 0.12)" : "#fff")};
  padding: 6px 10px;
  border-radius: 999px;
  cursor: pointer;
  font-weight: 600;
  transition: transform 120ms ease, box-shadow 120ms ease;

  &:hover {
    transform: translateY(-1px);
    box-shadow: 0 6px 12px rgba(42, 52, 35, 0.08);
  }
`;

const WeekdayGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 8px;
`;

const WeekdayButton = styled.button`
  width: 100%;
  border: 1px solid rgba(106, 121, 92, 0.25);
  background: ${(props) => (props.$active ? "#6a795c" : "#fff")};
  color: ${(props) => (props.$active ? "#fff" : "#6a795c")};
  padding: 6px 10px;
  border-radius: 999px;
  font-weight: 600;
  cursor: pointer;
  transition: transform 120ms ease, box-shadow 120ms ease;

  &:hover {
    transform: translateY(-1px);
    box-shadow: 0 6px 12px rgba(42, 52, 35, 0.08);
  }
`;

const SelectionFieldShell = styled.div`
  position: relative;
`;

const SelectionNativeField = styled.select`
  width: 100%;
  padding-right: 40px;
  border-color: ${(props) =>
    props.$selected ? "rgba(106, 121, 92, 0.48)" : "rgba(106, 121, 92, 0.2)"};
  background: ${(props) => (props.$selected ? "#fbfcf9" : "#fff")};
  box-shadow: ${(props) =>
    props.$selected ? "0 0 0 3px rgba(106, 121, 92, 0.08)" : "none"};
`;

const ReadonlyValue = styled.div`
  width: 100%;
  min-height: 44px;
  display: flex;
  align-items: center;
  border: 1px solid rgba(106, 121, 92, 0.16);
  border-radius: 12px;
  background: #f8faf7;
  color: #1f2933;
  font-size: 0.95rem;
  font-weight: 700;
  padding: 0 14px;
`;

const ReadonlyText = styled.div`
  color: #1f2933;
  font-size: 0.96rem;
  font-weight: 500;
  line-height: 1.35;
`;

const PrimaryButton = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 10px 18px;
  border-radius: 10px;
  border: none;
  background: #6a795c;
  color: #fff;
  font-weight: 700;
  min-height: ${(props) => (props.$topAction ? "42px" : "auto")};
  white-space: ${(props) => (props.$topAction ? "nowrap" : "normal")};
  box-shadow: 0 10px 22px rgba(73, 90, 63, 0.16);
  transition:
    transform 120ms ease,
    filter 120ms ease,
    box-shadow 120ms ease;

  &:hover:not(:disabled) {
    transform: translateY(-1px);
    filter: brightness(0.95);
    box-shadow: 0 14px 28px rgba(73, 90, 63, 0.22);
  }

  &:focus-visible {
    outline: 3px solid rgba(106, 121, 92, 0.24);
    outline-offset: 2px;
  }

  &:active:not(:disabled) {
    transform: translateY(0);
    box-shadow: 0 8px 18px rgba(73, 90, 63, 0.18);
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;

const spin = keyframes`
  to {
    transform: rotate(360deg);
  }
`;

const ButtonSpinner = styled(FaSpinner)`
  font-size: 0.95rem;
  animation: ${spin} 0.9s linear infinite;
`;

const ModalSaveButton = styled(PrimaryButton)`
  min-width: 88px;
`;

const SecondaryButton = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: ${(props) => (props.$navAction ? "38px" : "auto")};
  padding: ${(props) => (props.$navAction ? "0 16px" : "10px 18px")};
  border-radius: 10px;
  background: #fff;
  color: #6a795c;
  border: 1px solid rgba(106, 121, 92, 0.3);
  font-weight: 600;

  transition:
    transform 120ms ease,
    box-shadow 120ms ease,
    background 120ms ease,
    border-color 120ms ease;

  &:hover:not(:disabled) {
    transform: translateY(-1px);
    background: #f6f8f3;
    border-color: rgba(106, 121, 92, 0.45);
    box-shadow: 0 10px 22px rgba(73, 90, 63, 0.08);
  }

  &:focus-visible {
    outline: 3px solid rgba(106, 121, 92, 0.18);
    outline-offset: 2px;
  }

  &:active:not(:disabled) {
    transform: translateY(0);
    box-shadow: 0 6px 14px rgba(73, 90, 63, 0.06);
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    box-shadow: none;
  }
`;

const ToolbarLink = styled(Link)`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 42px;
  height: 42px;
  padding: 0;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.68);
  color: #6a795c;
  border: 1px solid rgba(106, 121, 92, 0.18);
  font-size: 1rem;
  font-weight: 600;
  text-decoration: none;

  &:hover {
    background: #fff;
    border-color: rgba(106, 121, 92, 0.3);
  }
`;

const IconButton = styled.button`
  border: none;
  background: transparent;
  color: #6a795c;
  font-size: 1.1rem;
`;

const EmptyState = styled.div`
  padding: 32px 16px;
  text-align: center;
  color: #6a795c;
`;

const loadingSweep = keyframes`
  0% {
    transform: translateX(-120%);
  }
  100% {
    transform: translateX(260%);
  }
`;

const AgendaContentArea = styled.div`
  position: relative;
  min-height: 360px;
`;

const AgendaContentBody = styled.div`
  transition: opacity 0.16s ease;
  opacity: ${(props) => (props.$loading ? 0.88 : 1)};
`;

const AgendaRefreshLine = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  z-index: 4;
  height: 3px;
  overflow: hidden;
  border-radius: 999px 999px 0 0;
  opacity: ${(props) => (props.$visible ? 1 : 0)};
  transition: opacity 140ms ease;
  pointer-events: none;

  &::before {
    content: "";
    display: block;
    width: 42%;
    height: 100%;
    border-radius: inherit;
    background: linear-gradient(90deg, transparent, #6a795c, transparent);
    animation: ${loadingSweep} 1.1s ease-in-out infinite;
  }
`;

const TypePill = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 6px 10px;
  border-radius: 999px;
  border: 1px solid ${(props) => {
    if (props.$active && props.$color) return props.$color;
    if (props.$active) return "rgba(106, 121, 92, 0.55)";
    if (props.$color) return `${props.$color}55`;
    return "rgba(106, 121, 92, 0.18)";
  }};
  font-size: 0.75rem;
  font-weight: ${(props) => (props.$active ? 900 : 700)};
  color: #42523a;
  background: ${(props) => {
    if (props.$color) return props.$active ? `${props.$color}4d` : `${props.$color}33`;
    if (props.$active) return "rgba(106, 121, 92, 0.14)";
    if (props.$type === "pilates") return "rgba(116, 141, 189, 0.25)";
    if (props.$type === "funcional") return "rgba(120, 145, 176, 0.25)";
    if (props.$type === "fisioterapia") return "rgba(162, 177, 144, 0.35)";
    if (props.$type === "outro") return "rgba(201, 188, 152, 0.35)";
    return "rgba(162, 177, 144, 0.2)";
  }};
  box-shadow: ${(props) => (props.$active ? "0 5px 12px rgba(42, 52, 35, 0.12)" : "none")};
  transition:
    background 140ms ease,
    border-color 140ms ease,
    box-shadow 140ms ease;
`;
