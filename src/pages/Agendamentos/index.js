import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import styled, { keyframes } from "styled-components";
import { Link } from "react-router-dom";
import { toast } from "react-toastify";
import {
  FaBell,
  FaChevronLeft,
  FaChevronRight,
  FaPlus,
  FaSpinner,
  FaTimes,
} from "react-icons/fa";

import axios, {
  getUserFacingApiError,
  sanitizeUserFacingErrorMessage,
} from "../../services/axios";
import Loading from "../../components/Loading";
import DataLoadingState from "../../components/DataLoadingState";
import {
  checkSchedulingAvailability,
  listSpecialSchedulingEvents,
  previewSchedulingOccurrences,
} from "../../services/scheduling";
import { listPatientPlans, getCoveragePreview } from "../../services/financial";
import { AppDrawer, DrawerBackdrop } from "../../components/AppDrawer";
import { PageWrapper, PageContent } from "../../components/AppLayout";
import {
  SessionStatusPill,
  SessionStatusButton,
} from "../../components/AppSessionStatus";
import PatientSearchField from "../../components/PatientSearchField";
import {
  getPatientDisplayName as getPatientName,
  getPatientSearchText,
  normalizeSearchText,
} from "../../utils/patientSearch";

const START_HOUR = 7;
const END_HOUR = 20;
const PROFESSIONAL_GROUP_SLUG = "profissional";
const ATTENDANCE_CONFIRMATION_TOLERANCE_MINUTES = 15;
const MAX_WEEK_SLOT_VISIBLE = 3;
const WEEK_PERIODS = [
  { key: "morning", label: "Manhã", startHour: 7, endHour: 12 },
  { key: "afternoon", label: "Tarde", startHour: 13, endHour: END_HOUR },
];

const PATIENT_ATTENTION_INDICATOR_META = {
  high: {
    label: "Atencao alta",
    tone: "high",
  },
  medium: {
    label: "Atencao media",
    tone: "medium",
  },
  undefined: {
    label: "Atencao nao definida",
    tone: "undefined",
  },
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
  const label = "Mensal";
  return descriptor ? `${label} - ${descriptor}` : label;
};

const getRecurringSeriesBadge = (session) => {
  if (session?.billing_mode === "covered_by_plan") return null;
  const position = session?.recurring_position;
  if (!position) return null;
  const total = session?.recurring_total;
  return total ? `Avulso ${position}/${total}` : "Avulso";
};

const getShortPatientName = (name) => {
  const parts = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length <= 1) return parts[0] || "Paciente";
  return `${parts[0]} ${parts[1]}`;
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
  return getRecurringSeriesBadge(session) || "Avulso";
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
    type: "Avulso",
    counter: position && total ? `${position}/${total}` : "",
  };
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
};

const normalizeSessionStatusValue = (status) =>
  SESSION_STATUS_CONFIG[status] ? status : "scheduled";

const getSessionStatusConfig = (status) =>
  SESSION_STATUS_CONFIG[normalizeSessionStatusValue(status)];

const getSessionStatusLabel = (status) => getSessionStatusConfig(status).label;

const getSessionStatusTone = (status) => getSessionStatusConfig(status).tone;

const isSessionStatusActive = (currentStatus, targetStatus) =>
  getSessionStatusTone(currentStatus) === getSessionStatusTone(targetStatus);

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
  staff_time_off: "Ausencia profissional",
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
  if (behavior === "WARN_CONFIRM") return "Requer confirmacao";
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

const WEEKDAY_OPTIONS = [
  { value: 1, label: "Seg" },
  { value: 2, label: "Ter" },
  { value: 3, label: "Qua" },
  { value: 4, label: "Qui" },
  { value: 5, label: "Sex" },
];

const OCCURRENCE_STATUS_LABELS = {
  AVAILABLE: "Disponivel",
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
  billing_mode: "",
};

const emptyDeleteModal = {
  open: false,
  step: "choice",
  mode: "single",
  session: null,
  candidates: [],
  selectedIds: [],
  reason: "",
};

const resolveSeriesId = (session) => session?.series_id || session?.series?.id || null;

const hasRecurringSeries = (session) => !!resolveSeriesId(session);

const getPatientDisplayName = (patientLike) =>
  patientLike?.Patient?.full_name
  || patientLike?.Patient?.name
  || patientLike?.full_name
  || patientLike?.name
  || "Paciente";

const normalizeText = (value) => {
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
};

const resolveSchedulingErrorMessage = (error) => {
  const responseData = error?.response?.data || {};
  const code = responseData?.code || "";
  const safeErrorMessage = sanitizeUserFacingErrorMessage(
    responseData?.error,
    "Nao foi possivel salvar o agendamento.",
  );
  if (code === "SCHEDULING_OVERRIDE_REASON_REQUIRED") {
    return safeErrorMessage || "Informe um motivo para forcar o encaixe.";
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

const parseMonthInputValue = (value) => {
  if (!/^\d{4}-\d{2}$/.test(String(value || ""))) return null;
  const [yearString, monthString] = String(value).split("-");
  const year = Number(yearString);
  const monthIndex = Number(monthString) - 1;
  const date = new Date(year, monthIndex, 1);
  if (
    Number.isNaN(date.getTime())
    || date.getFullYear() !== year
    || date.getMonth() !== monthIndex
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
  if (sameMonth) {
    const monthName = start.toLocaleDateString("pt-BR", { month: "long" });
    return `Semana ${String(start.getDate()).padStart(2, "0")} a ${String(
      end.getDate(),
    ).padStart(2, "0")} de ${monthName}`;
  }
  const startLabel = start.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
  });
  const endLabel = end.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
  });
  return `Semana ${startLabel} a ${endLabel}`;
};

const formatWeekYearLabel = (start, end) => {
  if (!start || !end) return "";
  const startYear = start.getFullYear();
  const endYear = end.getFullYear();
  if (startYear === endYear) return String(startYear);
  return `${startYear} / ${endYear}`;
};

const toInputValue = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
};

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
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const savingSessionIdsRef = useRef(new Set());
  const [savingSessionIds, setSavingSessionIds] = useState(new Set());
  const [savingActionMap, setSavingActionMap] = useState({});
  const submitLockRef = useRef(false);
  const [sessions, setSessions] = useState([]);
  const [specialEvents, setSpecialEvents] = useState([]);
  const [pendingSessionsSource, setPendingSessionsSource] = useState([]);
  const [patients, setPatients] = useState([]);
  const [professionals, setProfessionals] = useState([]);
  const [serviceLimits, setServiceLimits] = useState([]);
  const [services, setServices] = useState([]);
  const [isBaseDataLoading, setIsBaseDataLoading] = useState(true);
  const [statusOptions, setStatusOptions] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [filterPatientQuery, setFilterPatientQuery] = useState("");
  const [formPatientQuery, setFormPatientQuery] = useState("");
  const [absenceModal, setAbsenceModal] = useState({
    open: false,
    id: null,
    status: null,
    reason: "",
    isSaving: false,
  });
  const [attendanceModal, setAttendanceModal] = useState({
    open: false,
    timeLabel: "",
    serviceGroups: [],
    statuses: {},
    reasons: {},
    isSaving: false,
  });
  const [editingId, setEditingId] = useState(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState("form");
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
  const [coveragePreview, setCoveragePreview] = useState(null);
  const [coveragePreviewLoading, setCoveragePreviewLoading] = useState(false);
  const [expandedHours, setExpandedHours] = useState(new Set());
  const [expandedPeriods, setExpandedPeriods] = useState({
    morning: true,
    afternoon: true,
  });
  const [popover, setPopover] = useState(null);
  const [openActionMenu, setOpenActionMenu] = useState(null);
  const visibleRange = useMemo(() => getVisibleDateRange(view, selectedDate), [selectedDate, view]);

  const loadBaseData = useCallback(async () => {
    setIsBaseDataLoading(true);
    try {
      const [patientsResponse, usersResponse, limitsResponse, statusResponse, servicesResponse] = await Promise.all([
        axios.get("/patients"),
        axios.get("/users", { params: { group: PROFESSIONAL_GROUP_SLUG } }),
        axios.get("/service-limits"),
        axios.get("/session-statuses"),
        axios.get("/services"),
      ]);
      setPatients(Array.isArray(patientsResponse.data) ? patientsResponse.data : []);
      setProfessionals(Array.isArray(usersResponse.data) ? usersResponse.data : []);
      setServiceLimits(Array.isArray(limitsResponse.data) ? limitsResponse.data : []);
      setStatusOptions(Array.isArray(statusResponse.data) ? statusResponse.data : []);
      setServices(Array.isArray(servicesResponse.data) ? servicesResponse.data : []);
    } catch (error) {
      const message =
        error?.response?.data?.error ||
        "Nao foi possivel carregar pacientes ou profissionais.";
      toast.error(message);
    } finally {
      setIsBaseDataLoading(false);
    }
  }, []);

  const loadSessions = useCallback(
    async (fromDate, toDate) => {
      setIsLoading(true);
      try {
        const params = {};
        if (fromDate) params.from = formatDateParam(fromDate);
        if (toDate) params.to = formatDateParam(toDate);
        const response = await axios.get("/sessions", { params });
        setSessions(Array.isArray(response.data) ? response.data : []);
      } catch (error) {
        const message =
          error?.response?.data?.error || "Nao foi possivel carregar agendas.";
        toast.error(message);
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  const loadSpecialEvents = useCallback(async (fromDate, toDate) => {
    try {
      const params = {};
      if (fromDate) params.from = formatDateParam(fromDate);
      if (toDate) params.to = formatDateParam(toDate);
      const response = await listSpecialSchedulingEvents(params);
      setSpecialEvents(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      const message =
        error?.response?.data?.error || "Nao foi possivel carregar feriados.";
      toast.error(message);
    }
  }, []);

  const loadPendingSessions = useCallback(async () => {
    try {
      const response = await axios.get("/sessions");
      setPendingSessionsSource(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      const message =
        error?.response?.data?.error || "Nao foi possivel carregar as pendencias.";
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

  useEffect(() => {
    loadActivePlansForPatient(form.patient_id);
  }, [form.patient_id, loadActivePlansForPatient]);

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

  // Prévia de cobertura — só em criação e quando billing_mode é covered_by_plan
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
        name: patient.full_name || patient.name || "Paciente",
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
    (session) => session?.Patient?.full_name || session?.Patient?.name || "Paciente",
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
      if (service?.id) map.set(service.id, service);
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
        const sessionCode = session.service_type || session.Service?.code || "";
        if (sessionCode !== filters.service_type) return false;
      }
      if (patientSearch) {
        const patient = session?.Patient || patientDirectory.get(String(session?.patient_id || ""));
        if (!getPatientSearchText(patient).includes(patientSearch)) return false;
      }
      return true;
    });
  }, [filterPatientQuery, filters, patientDirectory, sessions]);

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

      const serviceCode = session.service_type || session.Service?.code || "outro";
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
  }, [compareServiceGroups, compareSessionsByPatientThenId, daySessions, serviceColor, serviceName]);

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
      const serviceCode = session.service_type || session.Service?.code || "outro";
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
  }, [compareServiceGroups, compareSessionsByPatientThenId, pendingConfirmationSessions, serviceColor, serviceName]);

  const getSlotGroups = useCallback(
    (day, hour) => {
      const key = startOfDay(day).toISOString();
      const dayList = sessionsByDay.get(key) || [];
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
        const items = [...bucket.sessions].sort(compareSessionsByPatientThenId);
        const activeCount = items.filter(
          (item) => item.status !== "canceled" && item.status !== "no_show",
        ).length;
        const limitById =
          bucket.service?.id !== undefined
            ? serviceLimitMap.get(`id:${bucket.service.id}`)
            : undefined;
        const limitByCode = serviceLimitMap.get(`code:${type}`);
        return ({
          service_type: type,
          service: bucket.service,
          sessions: items,
          count: activeCount,
          total: items.length,
          limit: limitById ?? limitByCode,
        });
      }).sort(compareServiceGroups);
    },
    [
      compareServiceGroups,
      compareSessionsByPatientThenId,
      serviceLimitMap,
      sessionsByDay,
      servicesByCode,
      servicesById,
    ],
  );

  const groupSessions = useMemo(() => {
    if (!groupContext?.date) return [];
    const hour = groupContext.date.getHours();
    return getSlotGroups(groupContext.date, hour);
  }, [getSlotGroups, groupContext]);

  const handleFormChange = useCallback((event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }, []);

  const handleStartsAtChange = useCallback((event) => {
    const { value } = event.target;
    if (!value) {
      setForm((prev) => ({ ...prev, starts_at: value, ends_at: "" }));
      return;
    }
    const startDate = new Date(value);
    if (Number.isNaN(startDate.getTime())) {
      setForm((prev) => ({ ...prev, starts_at: value }));
      return;
    }
    setForm((prev) => {
      const previousStartsAt = prev.starts_at ? new Date(prev.starts_at) : null;
      const previousEndsAt = prev.ends_at ? new Date(prev.ends_at) : null;
      const hasValidPreviousDuration =
        previousStartsAt &&
        !Number.isNaN(previousStartsAt.getTime()) &&
        previousEndsAt &&
        !Number.isNaN(previousEndsAt.getTime()) &&
        previousEndsAt > previousStartsAt;

      const nextEndsAt = new Date(startDate);
      if (hasValidPreviousDuration) {
        nextEndsAt.setTime(
          startDate.getTime() + (previousEndsAt.getTime() - previousStartsAt.getTime()),
        );
      } else {
        nextEndsAt.setHours(nextEndsAt.getHours() + 1);
      }

      return {
        ...prev,
        starts_at: value,
        ends_at: toInputValue(nextEndsAt),
      };
    });
    if (repeatEnabled && repeatWeekdays.length === 0) {
      const weekday = toSelectableWeekday(startDate);
      if (weekday) setRepeatWeekdays([weekday]);
    }
  }, [repeatEnabled, repeatWeekdays.length]);

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
              "Nao foi possivel validar a disponibilidade desta data.",
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

  const handleFilterChange = useCallback((event) => {
    const { name, value } = event.target;
    setFilters((prev) => ({ ...prev, [name]: value }));
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
    setGroupContext(null);
    setIsDrawerOpen(true);
  }, []);

  const togglePendingDrawer = useCallback(() => {
    if (isDrawerOpen && drawerMode === "pending") {
      setIsDrawerOpen(false);
      return;
    }

    setDrawerMode("pending");
    setGroupContext(null);
    setIsDrawerOpen(true);
  }, [drawerMode, isDrawerOpen]);

  const closeDrawer = useCallback(() => {
    setIsDrawerOpen(false);
  }, []);

  const resetForm = useCallback(() => {
    setEditingId(null);
    setForm(emptyForm);
    setFormPatientQuery("");
    setRepeatEnabled(false);
    setRepeatWeekdays([]);
    setRepeatMode("count");
    setRepeatCount("10");
    setRepeatWeeks("4");
    setFormAvailability(null);
    setRecurrencePreview(null);
  }, []);

  const handleConfirmRecurrenceCreation = useCallback(async () => {
    if (!recurrencePreview?.series_payload) return;

    const selectedIndexes = recurrencePreview.selected_indexes || [];
    if (selectedIndexes.length === 0) {
      toast.error("Selecione ao menos uma ocorrencia para criar.");
      return;
    }

    const forceOverrideIndexes = recurrencePreview.force_override_indexes || [];
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
        creation_mode: "selected_only",
        occurrence_indexes: selectedIndexes,
        confirm_warning_indexes: recurrencePreview.confirm_warning_indexes || [],
        force_override_indexes: forceOverrideIndexes,
        override_reason: requiresOverrideReason ? overrideReason : null,
      });

      const created = Number(response?.data?.total_created || 0);
      const skipped = Number(response?.data?.total_skipped || 0);
      toast.success(
        skipped > 0
          ? `Serie criada: ${created} sessao(oes) criada(s), ${skipped} ignorada(s).`
          : `Serie criada (${created} sessao(oes)).`,
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
        starts_at: newStart.toISOString(),
      };
      if (durationMs && durationMs > 0) {
        payload.ends_at = new Date(newStart.getTime() + durationMs).toISOString();
      }

      setIsSaving(true);
      try {
        await axios.put(`/sessions/${id}`, payload);
        toast.success("Agendamento reagendado.");
        await reloadVisibleSessions();
        await loadPendingSessions();
      } catch (error) {
        const message =
          error?.response?.data?.error ||
          "Nao foi possivel reagendar o agendamento.";
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

  const handleEdit = useCallback(
    (event) => {
      const { id } = event.currentTarget.dataset;
      const session = filteredSessions.find((item) => String(item.id) === id);
      if (!session) return;
      setDrawerMode("form");
      setGroupContext(null);
      const patientName = session?.Patient?.full_name || session?.Patient?.name || "";
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
        notes: session.notes || "",
        absence_reason: session.absence_reason || "",
        billing_mode: session.billing_mode || "per_session",
      });
      setFormPatientQuery(patientName);
      setIsDrawerOpen(true);
    },
    [filteredSessions, servicesByCode],
  );

  const handleOpenDelete = useCallback(
    (session) => {
      if (!session?.id) return;
      const sourcePool = pendingSessionsSource.length > 0 ? pendingSessionsSource : sessions;
      const targetSession =
        sourcePool.find((item) => String(item.id) === String(session.id)) || session;

      setDeleteModal({
        ...emptyDeleteModal,
        open: true,
        session: targetSession,
      });
    },
    [pendingSessionsSource, sessions],
  );

  const handleCloseDelete = useCallback(() => {
    if (isDeleting || isDeletePreviewing) return;
    setDeleteModal(emptyDeleteModal);
  }, [isDeletePreviewing, isDeleting]);

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

        setDeleteModal((previous) => ({
          ...previous,
          step: "review",
          mode,
          candidates,
          selectedIds: candidates
            .filter((item) => item.can_delete !== false)
            .map((item) => String(item.id)),
          reason: "",
        }));
      } catch (error) {
        const message =
          error?.response?.data?.error || "Nao foi possivel preparar a revisao da exclusao.";
        toast.error(message);
      } finally {
        setIsDeletePreviewing(false);
      }
    },
    [deleteModal.session?.id],
  );

  const handleBackDeleteChoice = useCallback(() => {
    if (isDeleting || isDeletePreviewing) return;
    setDeleteModal((previous) => ({
      ...previous,
      step: "choice",
      mode: "single",
      candidates: [],
      selectedIds: [],
      reason: "",
    }));
  }, [isDeletePreviewing, isDeleting]);

  const handleToggleDeleteCandidate = useCallback((id) => {
    const normalizedId = String(id);
    setDeleteModal((previous) => {
      const candidate = previous.candidates.find((item) => String(item.id) === normalizedId);
      if (candidate?.can_delete === false) return previous;
      const isSelected = previous.selectedIds.includes(normalizedId);
      return {
        ...previous,
        selectedIds: isSelected
          ? previous.selectedIds.filter((item) => item !== normalizedId)
          : [...previous.selectedIds, normalizedId],
      };
    });
  }, []);

  const { selectedIds: deleteSelectedIds } = deleteModal;

  const handleConfirmDelete = useCallback(async () => {
    if (isDeleting) return;

    if (deleteSelectedIds.length === 0) {
      toast.error("Selecione ao menos um agendamento para excluir.");
      return;
    }

    const normalizedReason = deleteModal.reason.trim();
    if (!normalizedReason) {
      toast.error("Informe o motivo da exclusao.");
      return;
    }

    setIsDeleting(true);
    try {
      const response = await axios.post("/sessions/soft-delete", {
        session_ids: deleteSelectedIds.map((id) => Number(id)),
        reason: normalizedReason,
        scope: deleteModal.mode,
      });
      const successCount = Number(response?.data?.total_deleted || deleteSelectedIds.length);

      await reloadVisibleSessions();
      await loadPendingSessions();

      toast.success(
        successCount === 1
          ? "Agendamento excluido com historico."
          : `${successCount} agendamento(s) excluido(s) com historico.`,
      );
      setDeleteModal(emptyDeleteModal);
    } catch (error) {
      const message =
        error?.response?.data?.error ||
        "Nao foi possivel excluir os agendamentos selecionados.";
      toast.error(message);
    } finally {
      setIsDeleting(false);
    }
  }, [
    deleteModal.mode,
    deleteModal.reason,
    deleteSelectedIds,
    isDeleting,
    loadPendingSessions,
    reloadVisibleSessions,
  ]);

  const applySessionStatusLocally = useCallback(({ id, status, reason, updatedSession }) => {
    if (!id || !status) return;
    const applyStatus = (session) => {
      if (String(session?.id) !== String(id)) return session;
      return {
        ...session,
        ...(updatedSession || {}),
        status,
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
    async ({ id, status, reason, onSuccess, onError }) => {
      if (!id || !status) return;
      const sid = String(id);
      if (savingSessionIdsRef.current.has(sid)) return;
      const payload = { status };
      if (reason) {
        payload.absence_reason = reason;
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
        toast.success("Agendamento atualizado.");
        await reloadVisibleSessions();
        await loadPendingSessions();
        if (onSuccess) onSuccess();
      } catch (error) {
        const message =
          error?.response?.data?.error ||
          "Nao foi possivel atualizar o agendamento.";
        toast.error(message);
        if (onError) onError();
      } finally {
        savingSessionIdsRef.current.delete(sid);
        setSavingSessionIds(new Set(savingSessionIdsRef.current));
        setSavingActionMap((prev) => { const { [sid]: _, ...rest } = prev; return rest; });
      }
    },
    [applySessionStatusLocally, loadPendingSessions, reloadVisibleSessions],
  );

  const handleQuickStatus = useCallback(
    async (event) => {
      const { id, status } = event.currentTarget.dataset;
      if (!id || !status) return;
      await updateSessionStatus({ id, status });
    },
    [updateSessionStatus],
  );

  const handleAbsence = useCallback((event) => {
    const { id, status } = event.currentTarget.dataset;
    if (!id || !status) return;
    setAbsenceModal({
      open: true,
      id,
      status,
      reason: "",
    });
  }, []);

  const handleConfirmAbsence = useCallback(async () => {
    if (!absenceModal.id || !absenceModal.status || absenceModal.isSaving) return;
    if (!absenceModal.reason.trim()) {
      toast.error("Informe o motivo.");
      return;
    }
    setAbsenceModal((prev) => ({ ...prev, isSaving: true }));
    await updateSessionStatus({
      id: absenceModal.id,
      status: absenceModal.status,
      reason: absenceModal.reason.trim(),
      onSuccess: () => setAbsenceModal({ open: false, id: null, status: null, reason: "", isSaving: false }),
      onError: () => setAbsenceModal((prev) => ({ ...prev, isSaving: false })),
    });
  }, [absenceModal, updateSessionStatus]);

  const handleOpenAttendanceCall = useCallback(({ timeGroup }) => {
    const allEligible = (timeGroup?.serviceGroups || []).flatMap((sg) =>
      (sg.cards || []).filter((card) => card?.session?.id && card.session.status !== "canceled"),
    );

    if (allEligible.length === 0) {
      toast.info("Nao ha sessoes ativas para fazer chamada neste horario.");
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
          .filter((card) => card?.session?.id && card.session.status !== "canceled")
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
      await axios.patch("/sessions/bulk-status", { sessions: sessionsPayload });
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
      toast.error(getUserFacingApiError(error, "Nao foi possivel salvar a chamada."));
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
        toast.error("Selecione o servico.");
        return;
      }
      const startsAtDate = new Date(form.starts_at);
      if (Number.isNaN(startsAtDate.getTime())) {
        toast.error("Data de inicio invalida.");
        return;
      }

      const isRecurring = repeatEnabled && !editingId;
      const endsAtDate = form.ends_at ? new Date(form.ends_at) : null;
      if (form.ends_at && (!endsAtDate || Number.isNaN(endsAtDate.getTime()))) {
        toast.error("Data de termino invalida.");
        return;
      }
      if (endsAtDate && endsAtDate <= startsAtDate) {
        toast.error("O campo Termina as deve ser posterior ao Inicio.");
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
            toast.error("Informe a quantidade de sessoes.");
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
        notes: normalizeText(form.notes),
        absence_reason: normalizeText(form.absence_reason),
        ...(eligiblePlan ? { billing_mode: form.billing_mode || "per_session" } : {}),
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
            toast.error("Nao foi possivel calcular a vigencia mensal.");
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
              successMessage = `Agenda do plano criada (${created} sessao(oes)).`;
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
          });
        } catch (error) {
          const message =
            error?.response?.data?.error ||
            "Nao foi possivel gerar a pre-visualizacao das ocorrencias.";
          toast.error(message);
        } finally {
          releaseSubmitState();
        }
        return;
      }

      let confirmScheduleWarning = false;
      let forceOverride = false;
      let overrideReason = null;

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
          if (!availability.can_override_block) {
            toast.error(
              availability.blocking_reason ||
              "Data bloqueada por evento operacional.",
            );
            releaseSubmitState();
            return;
          }

          // eslint-disable-next-line no-alert
          const shouldForce = window.confirm(
            `${availability.blocking_reason || "Data bloqueada."}\n\nVoce tem permissao para forcar encaixe. Deseja continuar?`,
          );
          if (!shouldForce) {
            releaseSubmitState();
            return;
          }
          // eslint-disable-next-line no-alert
          const typedReason = window.prompt(
            "Informe o motivo do encaixe em data bloqueada:",
            "Encaixe autorizado pelo administrador.",
          );
          if (typedReason === null) {
            releaseSubmitState();
            return;
          }
          const normalizedReason = typedReason.trim();
          if (!normalizedReason) {
            toast.error("Informe o motivo para forcar o encaixe.");
            releaseSubmitState();
            return;
          }
          forceOverride = true;
          overrideReason = normalizedReason;
        } else if (hasLocalHolidayBlock) {
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
          // eslint-disable-next-line no-alert
          const shouldConfirm = window.confirm(
            `Data com alerta operacional${eventNames ? ` (${eventNames})` : ""}. Deseja confirmar o agendamento?`,
          );
          if (!shouldConfirm) {
            releaseSubmitState();
            return;
          }
          confirmScheduleWarning = true;
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
          "Nao foi possivel validar disponibilidade.";
        toast.error(message);
        releaseSubmitState();
        return;
      }

      try {
        const schedulingPayload = {
          confirm_schedule_warning: confirmScheduleWarning,
          force_override: forceOverride,
          override_reason: overrideReason,
        };
        if (editingId) {
          await axios.put(`/sessions/${editingId}`, {
            ...payload,
            ...schedulingPayload,
          });
          toast.success("Agendamento atualizado.");
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
      } catch (error) {
        toast.error(resolveSchedulingErrorMessage(error));
      } finally {
        releaseSubmitState();
      }
    },
    [
      closeDrawer,
      editingId,
      eligiblePlan,
      form,
      formLocalSpecialSummary,
      isSaving,
      loadPendingSessions,
      reloadVisibleSessions,
      repeatEnabled,
      repeatMode,
      repeatCount,
      repeatWeeks,
      repeatWeekdays,
      resetForm,
      submitLockRef,
    ],
  );

  const weekDays = useMemo(() => getWeekDays(selectedDate), [selectedDate]);
  const monthDays = useMemo(() => getMonthDays(selectedDate), [selectedDate]);

  const monthServicesByDay = useMemo(() => {
    const map = new Map();
    sessionsByDay.forEach((daySessionList, key) => {
      const groups = new Map();
      daySessionList.forEach((session) => {
        const code = session.service_type || session.Service?.code || "outro";
        if (!groups.has(code)) {
          groups.set(code, { code, count: 0, color: serviceColor(code), name: serviceName(code) });
        }
        groups.get(code).count += 1;
      });
      map.set(key, [...groups.values()].sort((a, b) =>
        String(a.name || "").localeCompare(String(b.name || ""), "pt-BR", { sensitivity: "base" })
      ));
    });
    return map;
  }, [sessionsByDay, serviceColor, serviceName]);

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

  const handleDayPickerChange = useCallback((event) => {
    const nextDate = parseDateInputValue(event.target.value);
    if (!nextDate) return;
    setSelectedDate(nextDate);
  }, []);

  const handleMonthPickerChange = useCallback((event) => {
    const nextDate = parseMonthInputValue(event.target.value);
    if (!nextDate) return;
    setSelectedDate(nextDate);
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
      return "Defina o campo Inicio acima.";
    }
    return `${formatDate(monthlyValidity.start)} ate ${formatDate(monthlyValidity.end)}`;
  }, [form.starts_at]);

  const recurrenceSelectedSet = useMemo(
    () => new Set(recurrencePreview?.selected_indexes || []),
    [recurrencePreview],
  );

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

  const deleteSeriesCandidates = useMemo(() => {
    if (!deleteModal.session || !hasRecurringSeries(deleteModal.session)) return [];
    return buildDeleteCandidates(deleteModal.session, "series");
  }, [buildDeleteCandidates, deleteModal.session]);

  const deleteSelectedSessions = useMemo(() => {
    if (deleteModal.selectedIds.length === 0) return [];
    const selectedIdSet = new Set(deleteModal.selectedIds);
    return deleteModal.candidates.filter((item) => selectedIdSet.has(String(item.id)));
  }, [deleteModal.candidates, deleteModal.selectedIds]);

  let drawerTitle = "Novo agendamento";
  if (drawerMode === "pending") {
    drawerTitle = "Pendencias";
  } else if (drawerMode === "group") {
    drawerTitle = "Detalhes do horário";
  } else if (editingId) {
    drawerTitle = `Editar #${editingId}`;
  }

  let drawerSubtitle = "Preencha os dados do atendimento.";
  if (drawerMode === "pending") {
    drawerSubtitle = "Confirme quem veio, faltou ou precisa de ajuste.";
  } else if (drawerMode === "group") {
    drawerSubtitle = groupContext ? formatDateTime(groupContext.date) : "";
  }

  let submitButtonLabel = "Criar agendamento";
  if (isSaving) {
    submitButtonLabel = "Processando...";
  } else if (editingId) {
    submitButtonLabel = "Salvar";
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
          <BackLink to="/menu">Voltar</BackLink>
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
              Mes
            </ToggleButton>
          </ViewSwitch>
	          <DateNav>
	            <NavButton type="button" onClick={handlePrev}>
	              <FaChevronLeft />
	            </NavButton>
	            {view === "week" && (
	              <DateContext>
	                <DateYearLabel>{formatWeekYearLabel(weekDays[0], weekDays[weekDays.length - 1])}</DateYearLabel>
	                <DateLabel>
	                  {formatWeekRange(weekDays[0], weekDays[weekDays.length - 1])}
	                </DateLabel>
	              </DateContext>
	            )}
	            {view === "day" && (
	              <DatePickerInput
	                type="date"
	                value={toDateInputValue(selectedDate)}
	                onChange={handleDayPickerChange}
	                aria-label="Selecionar dia da agenda"
	                $prominent
	              />
	            )}
	            {view === "month" && (
	              <DatePickerInput
	                type="month"
	                value={toMonthInputValue(selectedDate)}
	                onChange={handleMonthPickerChange}
	                aria-label="Selecionar mes e ano da agenda"
	                $prominent
	              />
	            )}
	            <NavButton type="button" onClick={handleNext}>
	              <FaChevronRight />
	            </NavButton>
            {view === "day" && (
              <SecondaryButton type="button" onClick={handleToday}>
                Hoje
              </SecondaryButton>
            )}
            {view === "week" && (
              <SecondaryButton type="button" onClick={handleToday}>
                Semana atual
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
          </DateNav>
          <ToolbarActions>
            <NotificationButton
              type="button"
              onClick={togglePendingDrawer}
              $active={isDrawerOpen && drawerMode === "pending"}
              aria-label={`Abrir pendencias. ${pendingConfirmationSessions.length} pendencias.`}
            >
              <FaBell />
              <NotificationBadge $hasPending={pendingConfirmationSessions.length > 0}>
                {pendingConfirmationSessions.length}
              </NotificationBadge>
            </NotificationButton>
            <PrimaryButton
              type="button"
              onClick={() => {
                resetForm();
                openDrawer();
              }}
            >   
              <FaPlus /> Novo agendamento
            </PrimaryButton>
            <ToolbarLink to="/agendamentos/eventos">
              Feriados
            </ToolbarLink>
          </ToolbarActions>
        </Toolbar>

        <FiltersRow>
          <FilterField>
            Status
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
          <FilterField>
            Tipo
            <select
              name="service_type"
              value={filters.service_type}
              onChange={handleFilterChange}
            >
              <option value="">Todos</option>
              {isBaseDataLoading && (
                <option value="" disabled>
                  Carregando serviços...
                </option>
              )}
              {allServiceOptions.map((service) => (
                <option
                  key={service.id ? `id-${service.id}` : `code-${service.code}`}
                  value={service.code}
                >
                  {service.name}
                </option>
              ))}
            </select>
          </FilterField>
          <FilterField>
            <PatientSearchField
              mode="filter"
              value={filterPatientQuery}
              onChange={setFilterPatientQuery}
            />
          </FilterField>
        </FiltersRow>
        {isBaseDataLoading && (
          <LegendLoading>Carregando serviços...</LegendLoading>
        )}
        {!isBaseDataLoading && allServiceOptions.length > 0 && (
          <Legend>
            {allServiceOptions.map((service) => (
              <LegendItem
                key={service.id ? `id-${service.id}` : `code-${service.code}`}
              >
                <TypePill $type={service.code} $color={service.color}>
                  {service.name}
                </TypePill>
              </LegendItem>
            ))}
          </Legend>
        )}

        {isLoading ? (
          <AgendaLoadingPanel>
            <DataLoadingState text="Carregando agenda..." />
          </AgendaLoadingPanel>
        ) : (
          <>
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
                  const totalActive = groups.reduce(
                    (sum, g) =>
                      sum +
                      g.sessions.filter(
                        (s) => s.status !== "canceled" && s.status !== "no_show",
                      ).length,
                    0,
                  );
                  return totalActive > MAX_WEEK_SLOT_VISIBLE;
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
                            {formatHourLabel(startingPeriod.startHour)} às{" "}
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
                      const allActive = groups.flatMap((group) => {
                        const color =
                          group.service?.color || serviceColor(group.service_type);
                        return group.sessions
                          .filter(
                            (s) => s.status !== "canceled" && s.status !== "no_show",
                          )
                          .map((session) => ({ session, group, color }));
                      });
                      const visibleItems = isHourExpanded
                        ? allActive
                        : allActive.slice(0, MAX_WEEK_SLOT_VISIBLE);
                      const hiddenItems = isHourExpanded
                        ? []
                        : allActive.slice(MAX_WEEK_SLOT_VISIBLE);
                      return (
                        <SlotCell
                          key={`${day.toISOString()}-${hour}`}
                          $striped={hour % 2 === 0}
                          onClick={() => handleCreateAt(slotDate)}
                          onDragOver={handleDragOver}
                          onDrop={(event) => handleDropAt(event, slotDate)}
                        >
                          {visibleItems.map(({ session, group, color }) => {
                            const patientName = getSessionPatientName(session);
                            const shortPatientName = getShortPatientName(patientName);
                            const attentionLevel = getSessionPatientAttentionLevel(session);
                            const sessionSummary = getSessionCardSummary(session);
                            const sessionMetaParts = getSessionCardMetaParts(session);
                            return (
                              <GroupPill
                                key={`${session.id}-${day.toISOString()}-${hour}`}
                                $type={group.service_type}
                                $color={color}
                                title={`${patientName} - ${sessionSummary}`}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  handleOpenGroup(slotDate);
                                }}
                              >
                                <GroupPillContent>
                                  <GroupPillPatient>
                                    <PatientInlineText>{shortPatientName}</PatientInlineText>
                                    <CompactSessionType>{sessionMetaParts.type}</CompactSessionType>
                                    <CompactSessionCounter>{sessionMetaParts.counter}</CompactSessionCounter>
                                    {renderPatientAttentionIndicator(attentionLevel)}
                                  </GroupPillPatient>
                                </GroupPillContent>
                              </GroupPill>
                            );
                          })}
                          {hiddenItems.length > 0 && (
                            <OverflowIndicatorBadge
                              aria-hidden="true"
                              title={`${hiddenItems.length} paciente(s) a mais neste horario`}
                            >
                              <span>{hiddenItems.length}</span>
                              <WeekOverflowArrow aria-hidden="true">▼</WeekOverflowArrow>
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
                      <AttendanceCallButton
                        type="button"
                        onClick={() => handleOpenAttendanceCall({ timeGroup })}
                      >
                        Fazer chamada
                      </AttendanceCallButton>
                    </DayTimeHeader>
                    <DayCardsColumn>
                      {timeGroup.serviceGroups.map((serviceGroup) => (
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
                            {serviceGroup.cards.map((card) => {
                              const { session } = card;
                              const tone = statusStyle(session.status);
                              const patientName = getSessionPatientName(session);
                              const shortPatientName = getShortPatientName(patientName);
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
                                        <PatientInlineText>{shortPatientName}</PatientInlineText>
                                        <CompactSessionType>{sessionMetaParts.type}</CompactSessionType>
                                        <CompactSessionCounter>{sessionMetaParts.counter}</CompactSessionCounter>
                                        {renderPatientAttentionIndicator(attentionLevel)}
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
                                                onClick={(event) => { handleQuickStatus(event); setOpenActionMenu(null); }}
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
                                                Editar
                                              </ActionsDropdownItem>
                                              <ActionsDropdownItem
                                                type="button"
                                                $danger
                                                onClick={() => { handleOpenDelete(session); setOpenActionMenu(null); }}
                                              >
                                                Excluir
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
                      ))}
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
                const specialSummary = specialEventsByDay.get(key) || null;
                const isCurrentMonth = day.getMonth() === selectedDate.getMonth();
                const dayServices = monthServicesByDay.get(key) || [];
                const visibleServices = dayServices.slice(0, 3);
                const extraServices = dayServices.length > 3 ? dayServices.length - 3 : 0;
                return (
                  <MonthCell
                    key={day.toISOString()}
                    $inactive={!isCurrentMonth}
                    $active={sameDay(day, selectedDate)}
                    onClick={() => {
                      setSelectedDate(day);
                      setView("day");
                    }}
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
                          <MonthServiceChip key={svc.code} $color={svc.color}>
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
              })}
            </MonthGrid>
            <MonthHint>
              Clique em um dia para abrir a agenda detalhada.
            </MonthHint>
          </MonthPanel>
        )}
          </>
        )}

        <AppDrawer $open={isDrawerOpen}>
          <DrawerHeader>
            <div>
              <h2>
                {drawerTitle}
              </h2>
              <DrawerSubtitle $prominent={drawerMode === "group"}>
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
                {pendingConfirmationSessions.length === 0 ? (
                  <EmptyState>Nenhuma pendencia no periodo carregado.</EmptyState>
                ) : (
                  <PendingGroupList>
                    {pendingConfirmationGroups.map((group) => (
                      <PendingGroup
                        key={group.key}
                        as="button"
                        type="button"
                        onClick={() => handleOpenPendingDay(group.date)}
                      >
                        <PendingGroupHeader>
                          <div>
                            <PendingGroupTitle>
                              {formatPendingDayLabel(group.date)}
                            </PendingGroupTitle>
                            <PendingGroupMeta>
                              {group.sessionCount} pendencia
                              {group.sessionCount > 1 ? "s" : ""}
                            </PendingGroupMeta>
                          </div>
                          <PendingServiceCount>
                            {group.sessionCount}
                          </PendingServiceCount>
                        </PendingGroupHeader>
                      </PendingGroup>
                    ))}
                  </PendingGroupList>
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
                        let groupCancelLabel = "Cancelar";
                        if (groupSessionSavingAction === "canceled") groupCancelLabel = "Salvando...";
                        else if (session.status === "canceled") groupCancelLabel = "Cancelado";
                        return (
                          <GroupItem key={session.id}>
                            <PatientInfo>
                              <PatientInfoName>
                                <PatientInlineText>{getSessionPatientName(session)}</PatientInlineText>
                                {renderPatientAttentionIndicator(getSessionPatientAttentionLevel(session))}
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
                                <GroupSessionStatusPill $status={session.status}>
                                  {getSessionStatusLabel(session.status)}
                                </GroupSessionStatusPill>
                              </PatientInfoMeta>
                            </PatientInfo>
                            <ActionsMenuWrapper>
                              <ActionsMenuButton
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setOpenActionMenu(
                                    openActionMenu === session.id ? null : session.id,
                                  );
                                }}
                              >
                                Ações ▾
                              </ActionsMenuButton>
                              {openActionMenu === session.id && (
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
                                    {groupSessionSavingAction === "scheduled" ? "Salvando..." : getSessionStatusLabel("scheduled")}
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
                                    {groupSessionSavingAction === "done" ? "Salvando..." : getSessionStatusLabel("done")}
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
                                    {groupSessionSavingAction === "no_show" ? "Salvando..." : getSessionStatusLabel("no_show")}
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
                                    {groupCancelLabel}
                                  </GroupStatusButton>
                                  <ActionsDropdownDivider />
                                  <ActionsDropdownItem
                                    type="button"
                                    data-id={session.id}
                                    onClick={(e) => { handleEdit(e); setOpenActionMenu(null); }}
                                  >
                                    Editar
                                  </ActionsDropdownItem>
                                  <ActionsDropdownItem
                                    type="button"
                                    $danger
                                    onClick={() => { handleOpenDelete(session); setOpenActionMenu(null); }}
                                  >
                                    Excluir
                                  </ActionsDropdownItem>
                                </ActionsDropdown>
                              )}
                            </ActionsMenuWrapper>
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
                  {!editingId && form.patient_id && activePlansForPatient.length > 0 && (
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
                      {form.professional_user_id && (
                        <SelectionIndicator aria-hidden="true" $right="38px" />
                      )}
                    </SelectionFieldShell>
                  </Field>
                  <Field>
                    Tipo de atendimento
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
                      {form.service_id && (
                        <SelectionIndicator aria-hidden="true" $right="38px" />
                      )}
                    </SelectionFieldShell>
                  </Field>
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
                  {eligiblePlan && (
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
                            setForm((prev) => ({ ...prev, billing_mode: "covered_by_plan" }))
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
                          <strong>Avulso</strong>
                          <span>Cobrança separada</span>
                        </BillingModeOption>
                      </BillingModeOptions>
                    </BillingModeCard>
                  )}
                  <Field className="span-2">
                    Inicio *
                    <input
                      type="datetime-local"
                      name="starts_at"
                      value={form.starts_at}
                      onChange={handleStartsAtChange}
                    />
                  </Field>
                  <Field className="span-2">
                    Termina as
                    <input
                      type="datetime-local"
                      name="ends_at"
                      value={form.ends_at}
                      onChange={handleFormChange}
                    />
                  </Field>
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
                  <RepeatCard className="span-2">
                    <RepeatHeader>
                      <div>
                        <strong>Repetição</strong>
                      </div>
                      <RepeatToggle>
                        <input
                          type="checkbox"
                          checked={repeatEnabled}
                          disabled={!!editingId}
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
                              <RepeatLabel>Quantas sessoes?</RepeatLabel>
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
                                <span>sessoes</span>
                              </RepeatInline>
                            </RepeatField>
                          )}
                          {repeatMode === "month" && (
                            <RepeatField className="full">
                              <RepeatLabel>Vigencia mensal</RepeatLabel>
                              <RepeatReadonlyValue>
                                {monthlyValiditySummary}
                              </RepeatReadonlyValue>
                              <small>
                                Atualizado automaticamente com base na data de inicio.
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
                                Agenda fixa do plano. O sistema cria os proximos dias
                                automaticamente e mantem a agenda futura pelo job recorrente.
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
                  <Field className="span-2">
                    Observações
                    <textarea
                      name="notes"
                      value={form.notes}
                      onChange={handleFormChange}
                      rows={3}
                    />
                  </Field>
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
                <h3>Preview de recorrencia</h3>
                <IconButton type="button" onClick={closeRecurrencePreview}>
                  <FaTimes />
                </IconButton>
              </ModalHeader>
              <RecurrencePreviewBody>
                <RecurrenceSummaryGrid>
                  <RecurrenceSummaryItem>
                    <small>Total</small>
                    <strong>{recurrencePreview?.summary?.total || 0}</strong>
                  </RecurrenceSummaryItem>
                  <RecurrenceSummaryItem>
                    <small>Disponiveis</small>
                    <strong>
                      {(recurrencePreview?.summary?.available || 0) +
                        (recurrencePreview?.summary?.info || 0)}
                    </strong>
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

                <RecurrenceHint>
                  Selecione explicitamente o que sera criado. Nada e persistido sem confirmacao.
                </RecurrenceHint>

                <RecurrenceList>
                  {recurrencePreview.occurrences.map((occurrence) => {
                    const isSelected = recurrenceSelectedSet.has(occurrence.index);
                    const isBlocked = occurrence.status === "BLOCK";
                    const isSelectable =
                      !isBlocked || occurrence.can_override_block;
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
                          <strong>
                            {formatOccurrenceDate(occurrence.date, occurrence.starts_at)}
                            {" - "}
                            {occurrence.start_time || "--:--"} ate{" "}
                            {occurrence.end_time || "--:--"}
                          </strong>
                          <span>
                            {OCCURRENCE_STATUS_LABELS[occurrence.status] ||
                              occurrence.status}
                          </span>
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
                    <span>Motivo do override (obrigatorio)</span>
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
                  disabled={recurrencePreview.is_submitting}
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
                <h3>Motivo da falta/cancelamento</h3>
                <IconButton
                  type="button"
                  disabled={absenceModal.isSaving}
                  onClick={() =>
                    setAbsenceModal({ open: false, id: null, status: null, reason: "", isSaving: false })
                  }
                >
                  <FaTimes />
                </IconButton>
              </ModalHeader>
              <ModalBody>
                <textarea
                  rows={4}
                  placeholder="Descreva o motivo"
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
                  onClick={() =>
                    setAbsenceModal({ open: false, id: null, status: null, reason: "", isSaving: false })
                  }
                >
                  Cancelar
                </SecondaryButton>
                <ModalSaveButton
                  type="button"
                  onClick={handleConfirmAbsence}
                  disabled={absenceModal.isSaving}
                  aria-label={absenceModal.isSaving ? "Salvando motivo" : "Salvar motivo"}
                >
                  {absenceModal.isSaving ? <ButtonSpinner aria-hidden="true" /> : "Salvar"}
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
                  {deleteModal.step === "choice" ? "Excluir agendamento" : "Revisar exclusao"}
                </h3>
                <IconButton
                  type="button"
                  disabled={isDeletePreviewing || isDeleting}
                  onClick={handleCloseDelete}
                >
                  <FaTimes />
                </IconButton>
              </ModalHeader>
              <DeleteFlowBody>
                {deleteModal.step === "choice" ? (
                  <>
                    <RecurrenceSummaryGrid>
                      <RecurrenceSummaryItem>
                        <small>Paciente</small>
                        <strong>
                          {deleteModal.session?.Patient?.full_name ||
                            deleteModal.session?.Patient?.name ||
                            "Paciente"}
                        </strong>
                      </RecurrenceSummaryItem>
                      <RecurrenceSummaryItem>
                        <small>Data</small>
                        <strong>{formatDateTime(deleteModal.session?.starts_at)}</strong>
                      </RecurrenceSummaryItem>
                      <RecurrenceSummaryItem>
                        <small>Servico</small>
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
                        <strong>Apenas este agendamento</strong>
                        <FaChevronRight aria-hidden="true" />
                      </DeleteChoiceButton>
                      <DeleteChoiceButton
                        type="button"
                        disabled={isDeletePreviewing || deleteSeriesCandidates.length <= 1}
                        onClick={() => handleDeleteModeSelection("series")}
                        title={
                          deleteSeriesCandidates.length <= 1
                            ? "Nao ha outros agendamentos desta sequencia para revisar."
                            : undefined
                        }
                      >
                        <strong>Revisar exclusao de varios</strong>
                        <FaChevronRight aria-hidden="true" />
                      </DeleteChoiceButton>
                    </DeleteChoiceGrid>
                  </>
                ) : (
                  <>
                    <RecurrenceSummaryGrid>
                      <RecurrenceSummaryItem>
                        <small>Total na revisao</small>
                        <strong>{deleteModal.candidates.length}</strong>
                      </RecurrenceSummaryItem>
                      <RecurrenceSummaryItem>
                        <small>Selecionados</small>
                        <strong>{deleteSelectedSessions.length}</strong>
                      </RecurrenceSummaryItem>
                      <RecurrenceSummaryItem>
                        <small>Primeiro</small>
                        <strong>
                          {deleteModal.candidates[0]
                            ? formatDate(deleteModal.candidates[0].starts_at)
                            : "--/--/----"}
                        </strong>
                      </RecurrenceSummaryItem>
                      <RecurrenceSummaryItem>
                        <small>Ultimo</small>
                        <strong>
                          {deleteModal.candidates[deleteModal.candidates.length - 1]
                            ? formatDate(
                              deleteModal.candidates[deleteModal.candidates.length - 1].starts_at,
                            )
                            : "--/--/----"}
                        </strong>
                      </RecurrenceSummaryItem>
                    </RecurrenceSummaryGrid>
                    <RecurrenceHint>
                      Revise os itens marcados abaixo. Voce pode desmarcar qualquer agendamento
                      antes de confirmar.
                    </RecurrenceHint>
                    <DeleteReviewList>
                      {deleteModal.candidates.map((session) => {
                        const isSelected = deleteModal.selectedIds.includes(String(session.id));
                        return (
                          <DeleteReviewRow key={`delete-${session.id}`} $selected={isSelected}>
                            <DeleteReviewSelect>
                              <input
                                type="checkbox"
                                checked={isSelected}
                                disabled={isDeleting || session.can_delete === false}
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
                              {session?.blocked_reason && (
                                <DeleteBlockedReason>
                                  {session.blocked_reason}
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
                    <RecurrenceOverrideField>
                      <span>Motivo da exclusao</span>
                      <textarea
                        rows={3}
                        placeholder="Descreva o motivo da exclusao"
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
              </DeleteFlowBody>
              <ModalActions>
                {deleteModal.step === "choice" ? (
                  <SecondaryButton
                    type="button"
                    onClick={handleCloseDelete}
                    disabled={isDeletePreviewing || isDeleting}
                  >
                    Fechar
                  </SecondaryButton>
                ) : (
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
                        !deleteModal.reason.trim()
                      }
                    >
                      {isDeleting ? <ButtonSpinner aria-hidden="true" /> : "Excluir selecionados"}
                    </DeleteConfirmButton>
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

const Header = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 24px;

  h1 {
    color: #1b1b1b;
    margin-bottom: 6px;
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

const BackLink = styled(Link)`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 10px 18px;
  border-radius: 10px;
  background: #fff;
  color: #6a795c;
  text-decoration: none;
  font-weight: 600;
  border: 1px solid rgba(106, 121, 92, 0.3);
`;

const Toolbar = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 16px;
  align-items: center;
  margin-bottom: 18px;
`;

const ViewSwitch = styled.div`
  display: inline-flex;
  background: #fff;
  border: 1px solid rgba(106, 121, 92, 0.2);
  border-radius: 12px;
  overflow: hidden;
  width: fit-content;
`;

const ToggleButton = styled.button`
  padding: 10px 16px;
  border: none;
  background: ${(props) => (props.$active ? "#6a795c" : "transparent")};
  color: ${(props) => (props.$active ? "#fff" : "#6a795c")};
  font-weight: 700;
  cursor: pointer;
`;

const DateNav = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  justify-content: center;
  flex-wrap: wrap;
`;

const DateContext = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  min-width: 180px;
`;

const DateYearLabel = styled.span`
  font-size: 0.76rem;
  font-weight: 800;
  color: #6a795c;
  letter-spacing: 0.06em;
`;

const ToolbarActions = styled.div`
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 12px;
  flex-wrap: wrap;
`;

const NavButton = styled.button`
  width: 36px;
  height: 36px;
  border-radius: 10px;
  border: 1px solid rgba(106, 121, 92, 0.2);
  background: #fff;
  color: #6a795c;
  display: flex;
  align-items: center;
  justify-content: center;
`;

const DateLabel = styled.span`
  font-weight: 700;
  color: #1b1b1b;
  min-width: 120px;
  text-align: center;
  text-transform: capitalize;
`;

const DatePickerInput = styled.input`
  height: ${(props) => (props.$prominent ? "38px" : "34px")};
  min-width: ${(props) => (props.$prominent ? "190px" : "150px")};
  padding: 0 12px;
  border-radius: 10px;
  border: 1px solid rgba(106, 121, 92, 0.22);
  background: #fff;
  color: #516046;
  font-size: ${(props) => (props.$prominent ? "1rem" : "0.84rem")};
  font-weight: ${(props) => (props.$prominent ? "700" : "600")};

  &::-webkit-calendar-picker-indicator {
    cursor: pointer;
    opacity: 0.78;
  }
`;

const FiltersRow = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 12px;
  margin-bottom: 20px;
`;

const NotificationButton = styled.button`
  position: relative;
  width: 46px;
  height: 46px;
  border-radius: 14px;
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
  top: -7px;
  right: -7px;
  min-width: 22px;
  height: 22px;
  padding: 0 6px;
  border-radius: 999px;
  background: ${(props) => (props.$hasPending ? "#c63b32" : "#dfe6d8")};
  color: #fff;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-weight: 800;
  font-size: 0.72rem;
`;

const PendingDrawerPanel = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
`;

const PendingGroupList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
`;

const PendingGroup = styled.section`
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 14px 16px;
  border-radius: 14px;
  border: 1px solid rgba(106, 121, 92, 0.16);
  background: #fbfcf8;
  text-align: left;
  cursor: pointer;
  transition: border-color 120ms ease, background 120ms ease, transform 120ms ease;

  &:hover {
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
  font-size: 1rem;
  text-transform: capitalize;
`;

const PendingGroupMeta = styled.span`
  display: inline-block;
  margin-top: 4px;
  color: #6a795c;
  font-size: 0.84rem;
`;

const PendingServiceCount = styled.span`
  min-width: 30px;
  height: 30px;
  padding: 0 8px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.78);
  color: #1b1b1b;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 0.78rem;
  font-weight: 800;
`;

const Legend = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 18px;
`;

const LegendItem = styled.div`
  display: inline-flex;
  align-items: center;
`;

const LegendLoading = styled.div`
  min-height: 32px;
  margin-bottom: 14px;
  display: flex;
  align-items: center;
  color: #687263;
  font-size: 0.86rem;
  font-weight: 700;
`;

const FilterField = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 0.9rem;
  color: #1b1b1b;

  select {
    height: 40px;
    border-radius: 10px;
    border: 1px solid rgba(106, 121, 92, 0.2);
    padding: 0 10px;
    background: #fff;
  }
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
  padding: 6px 8px;
  border-radius: 10px;
  background: ${(props) => {
    if (props.$color) return `${props.$color}33`;
    if (props.$type === "pilates") return "rgba(122, 156, 112, 0.22)";
    if (props.$type === "funcional") return "rgba(120, 145, 176, 0.22)";
    if (props.$type === "fisioterapia") return "rgba(162, 177, 144, 0.35)";
    if (props.$type === "outro") return "rgba(201, 188, 152, 0.25)";
    return "rgba(162, 177, 144, 0.2)";
  }};
  border: 1px solid rgba(106, 121, 92, 0.2);
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
  width: 100%;
  min-width: 0;
  box-sizing: border-box;
  overflow: hidden;
  cursor: pointer;
  span {
    font-size: 0.79rem;
    font-weight: 700;
    color: #42523a;
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
  gap: 8px;
  min-width: 0;
  width: 100%;
`;

const OverflowIndicatorBadge = styled.div`
  align-self: flex-end;
  min-width: 26px;
  height: 18px;
  padding: 0 6px;
  border-radius: 999px;
  border: 1px solid rgba(106, 121, 92, 0.14);
  background: rgba(245, 247, 241, 0.72);
  color: #6a795c;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  flex-shrink: 0;
  pointer-events: none;

  span {
    font-size: 0.64rem;
    font-weight: 700;
    color: inherit;
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

const DaySessionCard = styled.article`
  display: grid;
  grid-template-columns: 5px 1fr;
  border-radius: 10px;
  overflow: visible;
  position: relative;
  border: 1px solid rgba(106, 121, 92, 0.18);
  background: ${(props) => {
    if (props.$status === "done") return "rgba(94, 135, 90, 0.07)";
    if (props.$status === "canceled") return "rgba(199, 102, 102, 0.07)";
    if (props.$status === "no_show") return "rgba(214, 170, 104, 0.09)";
    return "#fff";
  }};
`;

const DayServiceBar = styled.span`
  border-radius: 10px 0 0 10px;
  background: ${(props) => {
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
  border-left: 3px solid ${(props) => props.$color || "#6a795c"};
  background: rgba(106, 121, 92, 0.06);
  font-size: 0.63rem;
  font-weight: 600;
  color: #2a2a2a;
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
  color: ${(props) => (props.$prominent ? "#1b1b1b" : "#6a795c")};
  font-size: ${(props) => (props.$prominent ? "1rem" : "0.9rem")};
  font-weight: ${(props) => (props.$prominent ? "600" : "400")};
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
  border: 1px solid rgba(106, 121, 92, 0.1);
  background: rgba(255, 255, 255, 0.92);
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 8px;
  align-items: center;

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

const GroupSessionStatusPill = styled(SessionStatusPill)`
  align-self: center;
  min-height: 20px;
  line-height: 1;
  white-space: nowrap;
`;

// SessionStatusBadge removido — usar SessionStatusPill de AppSessionStatus.

const ActionsMenuWrapper = styled.div`
  position: relative;
`;

const ActionsMenuButton = styled.button`
  border: 1px solid rgba(106, 121, 92, 0.22);
  background: #f5f7f1;
  color: #516046;
  font-size: 0.78rem;
  font-weight: 700;
  padding: 5px 10px;
  border-radius: 8px;
  cursor: pointer;
  white-space: nowrap;
  &:hover {
    background: #eef2e7;
  }
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
    if (props.$tone === "no_show") return "#8a5718";
    return "#1b1b1b";
  }};
  cursor: pointer;
  &:hover {
    background: rgba(106, 121, 92, 0.07);
  }
`;

const ActionsDropdownDivider = styled.div`
  height: 1px;
  background: rgba(106, 121, 92, 0.12);
  margin: 4px 0;
`;

const StatusAction = styled.button`
  border: 1px solid
    ${(props) => {
    if (props.$status === "done") return "rgba(94, 135, 90, 0.32)";
    if (props.$status === "canceled") return "rgba(199, 102, 102, 0.3)";
    if (props.$status === "no_show") return "rgba(214, 170, 104, 0.34)";
    return "rgba(106, 121, 92, 0.24)";
  }};
  background: ${(props) => {
    if (props.$active && props.$status === "done") return "#2f5a33";
    if (props.$active && props.$status === "canceled") return "#7b3a3a";
    if (props.$active && props.$status === "no_show") return "#8a5718";
    if (props.$active) return "#6a795c";
    if (props.$status === "done") return "rgba(94, 135, 90, 0.12)";
    if (props.$status === "canceled") return "rgba(199, 102, 102, 0.11)";
    if (props.$status === "no_show") return "rgba(214, 170, 104, 0.14)";
    return "#fff";
  }};
  color: ${(props) => {
    if (props.$active) return "#fff";
    if (props.$status === "done") return "#2f5a33";
    if (props.$status === "canceled") return "#7b3a3a";
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
  border: 1px solid rgba(106, 121, 92, 0.22);
  background: linear-gradient(180deg, #ffffff 0%, #f8faf5 100%);
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

  strong {
    color: #1b1b1b;
    font-size: 0.95rem;
    font-weight: 700;
  }

  svg {
    flex: 0 0 auto;
    color: #6a795c;
    font-size: 0.95rem;
  }

  &:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 14px 26px rgba(42, 52, 35, 0.1);
    border-color: rgba(106, 121, 92, 0.4);
    background: linear-gradient(180deg, #ffffff 0%, #eef4e8 100%);
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.55;
    box-shadow: none;
  }
`;

const DeleteReviewList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const DeleteReviewRow = styled.div`
  border-radius: 12px;
  border: 1px solid rgba(106, 121, 92, 0.18);
  background: ${(props) => (props.$selected ? "rgba(162, 177, 144, 0.12)" : "#fff")};
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  gap: 10px;
  align-items: center;
  padding: 10px 12px;

  @media (max-width: 680px) {
    grid-template-columns: auto minmax(0, 1fr);
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
  color: #8c3737;
  font-weight: 600;
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
  color: #1b1b1b;

  input,
  select,
  textarea {
    border-radius: 10px;
    border: 1px solid rgba(106, 121, 92, 0.2);
    padding: 10px 12px;
    font-size: 0.95rem;
    color: #1b1b1b;
    background: #fff;
  }

  textarea {
    resize: vertical;
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
  padding-right: ${(props) => (props.$selected ? "72px" : "40px")};
  border-color: ${(props) =>
    props.$selected ? "rgba(106, 121, 92, 0.48)" : "rgba(106, 121, 92, 0.2)"};
  background: ${(props) => (props.$selected ? "#fbfcf9" : "#fff")};
  box-shadow: ${(props) =>
    props.$selected ? "0 0 0 3px rgba(106, 121, 92, 0.08)" : "none"};
`;

const SelectionIndicator = styled.span`
  position: absolute;
  top: 50%;
  right: ${(props) => props.$right || "10px"};
  transform: translateY(-50%);
  width: 22px;
  height: 22px;
  border-radius: 999px;
  border: 1px solid rgba(106, 121, 92, 0.24);
  background: rgba(106, 121, 92, 0.12);
  pointer-events: none;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.7);

  &::before {
    content: "";
    position: absolute;
    top: 50%;
    left: 50%;
    width: 6px;
    height: 10px;
    border-right: 2px solid #5b6f50;
    border-bottom: 2px solid #5b6f50;
    transform: translate(-50%, -62%) rotate(45deg);
  }
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
  padding: 10px 18px;
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
  padding: 10px 14px;
  border-radius: 10px;
  background: #fff;
  color: #6a795c;
  border: 1px solid rgba(106, 121, 92, 0.3);
  font-weight: 600;
  text-decoration: none;
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

const AgendaLoadingPanel = styled.div`
  min-height: 360px;
  border: 1px solid rgba(106, 121, 92, 0.16);
  border-radius: 14px;
  background: #fff;
  overflow: hidden;
`;

const TypePill = styled.span`
  padding: 6px 10px;
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 700;
  color: #42523a;
  background: ${(props) => {
    if (props.$color) return `${props.$color}33`;
    if (props.$type === "pilates") return "rgba(116, 141, 189, 0.25)";
    if (props.$type === "funcional") return "rgba(120, 145, 176, 0.25)";
    if (props.$type === "fisioterapia") return "rgba(162, 177, 144, 0.35)";
    if (props.$type === "outro") return "rgba(201, 188, 152, 0.35)";
    return "rgba(162, 177, 144, 0.2)";
  }};
`;
