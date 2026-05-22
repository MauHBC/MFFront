import React, { useCallback, useEffect, useMemo, useState } from "react";
import styled from "styled-components";
import { useHistory, useLocation, useParams } from "react-router-dom";
import { toast } from "react-toastify";
import {
  FaBars,
  FaCalendarAlt,
  FaChevronLeft,
  FaLayerGroup,
  FaPlus,
  FaTags,
  FaTimes,
  FaUsers,
} from "react-icons/fa";

import { ModuleBody } from "../../components/AppModuleShell";
import {
  SidebarShellWrapper,
  SidebarShellLayout,
  SidebarMainArea,
} from "../../components/AppSidebarShell";
import {
  AppSidebar,
  AppSidebarHeader,
  AppSidebarSectionTitle,
  AppSidebarToggle,
  AppSidebarSection,
  AppSidebarButton,
  AppSidebarIcon,
  AppSidebarLabel,
  AppSidebarOverlay,
} from "../../components/AppSidebar";
import { AppToolbar, AppToolbarLeft } from "../../components/AppToolbar";
import {
  PrimaryButton,
  GhostButton,
  RowActionButton,
  DangerButton,
} from "../../components/AppButton";
import { TableWrap, DataTable, TH, TD } from "../../components/AppTable";
import { StatusPill } from "../../components/AppStatus";
import { Field, FieldHint } from "../../components/AppForm";
import PatientSearchField from "../../components/PatientSearchField";
import DataLoadingState from "../../components/DataLoadingState";
import {
  AppDrawer,
  DrawerBackdrop,
  DrawerHeader,
  DrawerTitle,
  DrawerCloseBtn,
  DrawerBody,
  DrawerFooter,
} from "../../components/AppDrawer";
import {
  listServicePlans,
  createServicePlan,
  updateServicePlan,
  deactivateServicePlan,
  listServicePrices,
  createServicePrice,
  updateServicePrice,
  listPatientPlans,
  createPatientPlan,
  updatePatientPlan,
  pausePatientPlan,
  previewResumePatientPlan,
  resumePatientPlan,
  cancelPatientPlan,
} from "../../services/financial";
import axios from "../../services/axios";
import {
  getPatientDisplayName,
  getPatientSearchText,
  normalizeSearchText,
} from "../../utils/patientSearch";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const WEEKDAY_OPTIONS = [
  { value: 1, label: "Seg" },
  { value: 2, label: "Ter" },
  { value: 3, label: "Qua" },
  { value: 4, label: "Qui" },
  { value: 5, label: "Sex" },
];

const START_HOUR = 7;
const END_HOUR = 20;
const PLAN_HOUR_OPTIONS = Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, index) => {
  const hour = START_HOUR + index;
  const padded = String(hour).padStart(2, "0");
  return {
    value: `${padded}:00`,
    label: `${padded}h`,
  };
});

const PROFESSIONAL_GROUP_SLUG = "profissional";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const centsToInputValue = (cents) => {
  if (cents == null) return "";
  return (cents / 100).toFixed(2).replace(".", ",");
};

const parseMoneyInput = (raw) => {
  if (!raw) return null;
  const s = String(raw).trim().replace(/[R$\s]/g, "");
  if (!s || s.startsWith("-")) return null;

  const cleaned = s.replace(/[^\d.,]/g, "");
  if (!cleaned) return null;

  const dotCount = (cleaned.match(/\./g) || []).length;
  const commaCount = (cleaned.match(/,/g) || []).length;

  let normalized;

  if (dotCount > 0 && commaCount > 0) {
    if (cleaned.lastIndexOf(",") > cleaned.lastIndexOf(".")) {
      normalized = cleaned.replace(/\./g, "").replace(",", ".");
    } else {
      normalized = cleaned.replace(/,/g, "");
    }
  } else if (commaCount === 1 && dotCount === 0) {
    const [intPart, decPart = ""] = cleaned.split(",");
    if (decPart.length <= 2) {
      normalized = `${intPart}.${decPart}`;
    } else if (decPart.length === 3) {
      normalized = intPart + decPart;
    } else {
      return null;
    }
  } else if (dotCount === 1 && commaCount === 0) {
    const [intPart, decPart = ""] = cleaned.split(".");
    if (decPart.length <= 2) {
      normalized = cleaned;
    } else if (decPart.length === 3) {
      normalized = intPart + decPart;
    } else {
      return null;
    }
  } else if (dotCount === 0 && commaCount === 0) {
    normalized = cleaned;
  } else if (dotCount > 1 && commaCount === 0) {
    normalized = cleaned.replace(/\./g, "");
  } else {
    return null;
  }

  const value = parseFloat(normalized);
  if (Number.isNaN(value) || value <= 0) return null;
  return Math.round(value * 100);
};

const formatPrice = (cents) => {
  if (cents == null) return "-";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(cents / 100);
};

const sortServicesByName = (items) => (
  [...items].sort((left, right) => (
    String(left?.name || "").localeCompare(String(right?.name || ""), "pt-BR", {
      sensitivity: "base",
    })
  ))
);

const upsertById = (items, nextItem) => {
  if (!nextItem?.id) return items;
  const exists = items.some((item) => item.id === nextItem.id);
  if (!exists) return [...items, nextItem];
  return items.map((item) => (item.id === nextItem.id ? { ...item, ...nextItem } : item));
};

const formatDateBR = (value) => {
  if (!value) return "-";
  const s = String(value).slice(0, 10);
  const [y, m, d] = s.split("-");
  return d && m && y ? `${d}/${m}/${y}` : s;
};

const formatDateTimeBR = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return formatDateBR(value);
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
};

const daysInMonth = (year, month) => new Date(Date.UTC(year, month, 0)).getUTCDate();

const isValidDateOnly = (value) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ""))) return false;
  const [year, month, day] = String(value).split("-").map(Number);
  if (month < 1 || month > 12) return false;
  return day >= 1 && day <= daysInMonth(year, month);
};

const addOneMonthDateOnly = (value) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ""))) return null;
  const [year, month, day] = String(value).split("-").map(Number);
  let nextMonth = month + 1;
  let nextYear = year;
  if (nextMonth > 12) {
    nextMonth = 1;
    nextYear += 1;
  }
  const nextDay = Math.min(day, daysInMonth(nextYear, nextMonth));
  return [
    String(nextYear).padStart(4, "0"),
    String(nextMonth).padStart(2, "0"),
    String(nextDay).padStart(2, "0"),
  ].join("-");
};

const subtractOneDayDateOnly = (value) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ""))) return null;
  const date = new Date(`${value}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
};

const todayDateOnly = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const isWeekendDateOnly = (value) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ""))) return false;
  const date = new Date(`${value}T12:00:00`);
  const day = date.getDay();
  return day === 0 || day === 6;
};

const normalizeWeekdays = (value) => {
  if (Array.isArray(value)) return value.map(Number).filter(Number.isFinite);
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed.map(Number).filter(Number.isFinite);
    } catch (_err) {
      return [];
    }
  }
  return [];
};

const formatWeekdayList = (value) => {
  const weekdays = normalizeWeekdays(value);
  if (weekdays.length === 0) return "-";
  return weekdays
    .map((day) => WEEKDAY_OPTIONS.find((opt) => opt.value === day)?.label)
    .filter(Boolean)
    .join(", ") || "-";
};

const getPatientPlanScheduleInfo = (pp, professionals = []) => {
  let seriesList = [];
  if (Array.isArray(pp?.sessionSeries)) {
    seriesList = pp.sessionSeries;
  } else if (Array.isArray(pp?.SessionSeries)) {
    seriesList = pp.SessionSeries;
  }
  const series = seriesList.find((item) => item.lifecycle_status !== "ended")
    || seriesList[0]
    || null;

  const professionalId = series?.professional_user_id;
  const professional = series?.professional
    || series?.Professional
    || professionals.find((item) => String(item.id) === String(professionalId));

  return {
    professionalName: professional?.name || "-",
    weekdayText: formatWeekdayList(series?.weekdays),
  };
};

const getPlanSeriesList = (pp) => {
  if (Array.isArray(pp?.sessionSeries)) return pp.sessionSeries;
  if (Array.isArray(pp?.SessionSeries)) return pp.SessionSeries;
  return [];
};

const getPrimaryPlanSeries = (pp) => {
  const seriesList = getPlanSeriesList(pp);
  return seriesList.find((item) => item.lifecycle_status !== "ended")
    || seriesList[0]
    || null;
};

const getSeriesSessions = (series) => {
  if (Array.isArray(series?.sessions)) return series.sessions;
  if (Array.isArray(series?.Sessions)) return series.Sessions;
  return [];
};

const getPlanBillingCycles = (pp) => {
  if (Array.isArray(pp?.BillingCycles)) return pp.BillingCycles;
  if (Array.isArray(pp?.billingCycles)) return pp.billingCycles;
  return [];
};

const getBillingCycleSessions = (cycle) => {
  if (Array.isArray(cycle?.Sessions)) return cycle.Sessions;
  if (Array.isArray(cycle?.sessions)) return cycle.sessions;
  return [];
};

const formatTimeBR = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
};

const getHourTimeValue = (value) => {
  if (!value) return "";
  if (/^\d{2}:\d{2}$/.test(String(value))) {
    return `${String(value).slice(0, 2)}:00`;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${String(date.getHours()).padStart(2, "0")}:00`;
};

const buildDateTimeWithHour = (dateValue, timeValue) => {
  if (!dateValue || !timeValue) return null;
  const date = String(dateValue).slice(0, 10);
  const hour = String(timeValue).slice(0, 2).padStart(2, "0");
  return `${date}T${hour}:00:00`;
};

const getPatientPlanAgendaInfo = (pp, professionals = []) => {
  const seriesList = getPlanSeriesList(pp);
  const activeSeries = getPrimaryPlanSeries(pp);
  const seriesSessions = seriesList.flatMap(getSeriesSessions);
  const legacySessions = getPlanBillingCycles(pp).flatMap(getBillingCycleSessions);
  const futureSessionsById = new Map();

  [...seriesSessions, ...legacySessions].forEach((session) => {
    if (session?.id) futureSessionsById.set(String(session.id), session);
  });

  const futureSessions = Array.from(futureSessionsById.values())
    .sort((left, right) => String(left.starts_at || "").localeCompare(String(right.starts_at || "")));
  const hasFutureSessions = futureSessions.length > 0;
  const scheduleInfo = getPatientPlanScheduleInfo(pp, professionals);
  const firstFutureSession = futureSessions[0] || null;

  return {
    label: hasFutureSessions ? "Configurada" : "Pendente",
    tone: hasFutureSessions ? "active" : "paused",
    isConfigured: hasFutureSessions,
    futureSessionsCount: futureSessions.length,
    seriesId: activeSeries?.id || null,
    professionalUserId: activeSeries?.professional_user_id || "",
    weekdays: normalizeWeekdays(activeSeries?.weekdays),
    professionalName: scheduleInfo.professionalName,
    weekdayText: scheduleInfo.weekdayText,
    timeText: formatTimeBR(activeSeries?.starts_at || firstFutureSession?.starts_at),
  };
};

const normalizeSessionsPerWeek = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) return null;
  return Math.floor(parsed);
};

const slugify = (name) =>
  String(name || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40) || `svc_${Date.now()}`;

const getPatientPlanPatientName = (pp) =>
  pp?.Patient ? getPatientDisplayName(pp.Patient) : "";

const comparePatientPlans = (left, right) => {
  const byName = getPatientPlanPatientName(left).localeCompare(
    getPatientPlanPatientName(right),
    "pt-BR",
    { sensitivity: "base" },
  );
  if (byName !== 0) return byName;

  const statusOrder = { active: 0, paused: 1, canceled: 2 };
  const byStatus = (statusOrder[left?.status] ?? 9) - (statusOrder[right?.status] ?? 9);
  if (byStatus !== 0) return byStatus;

  return String(right?.starts_at || "").localeCompare(String(left?.starts_at || ""));
};

const isPlanCancellationProgrammed = (pp) => (
  pp?.status === "canceled"
  && !!pp?.cancellation_effective_on
  && String(pp.cancellation_effective_on).slice(0, 10) > todayDateOnly()
);

const getPatientPlanStatusInfo = (pp) => {
  if (isPlanCancellationProgrammed(pp)) {
    return {
      label: `Ativo até ${formatDateBR(pp.cancellation_effective_on)}`,
      tone: "active",
    };
  }
  const statusInfo = {
    active: { label: "Ativo", tone: "active" },
    paused: { label: "Pausado", tone: "paused" },
    canceled: { label: "Cancelado", tone: "canceled" },
  };
  return statusInfo[pp?.status] || { label: pp?.status || "-", tone: pp?.status };
};

const getPatientPlanSummary = (pp) => {
  const plan = pp?.ServicePlan;
  const serviceName = plan?.Service?.name;
  const planName = plan?.name || serviceName || "-";
  const frequency = plan?.sessions_per_week
    ? `${plan.sessions_per_week}x/sem`
    : plan?.frequency_label || "-";

  return {
    patientName: getPatientPlanPatientName(pp) || "-",
    planName,
    serviceName: serviceName && serviceName !== planName ? serviceName : "",
    frequency,
    price: formatPrice(plan?.price_cents),
    startsAt: formatDateBR(pp?.starts_at),
    dueDay: pp?.anchor_day ? `Dia ${pp.anchor_day}` : "-",
  };
};

// ---------------------------------------------------------------------------
// Empty forms
// ---------------------------------------------------------------------------

const EMPTY_SP = {
  service_id: "",
  price: "",
  sessions_per_week: "",
};

const EMPTY_PP = {
  patient_id: "",
  service_plan_id: "",
  anchor_day: "",
  starts_at: "",
  ends_at: "",
  notes: "",
  professional_user_id: "",
  weekdays: [],
  time: "08:00",
};

const makeEmptyPpForm = () => ({
  ...EMPTY_PP,
  starts_at: todayDateOnly(),
});

const buildPpEditFormFromPlan = (pp) => ({
  patient_id: String(pp?.patient_id || ""),
  service_plan_id: String(pp?.service_plan_id || ""),
  anchor_day: String(pp?.anchor_day || ""),
  starts_at: pp?.starts_at ? String(pp.starts_at).slice(0, 10) : "",
  ends_at: pp?.ends_at ? String(pp.ends_at).slice(0, 10) : "",
  notes: pp?.notes || "",
  professional_user_id: String(getPrimaryPlanSeries(pp)?.professional_user_id || ""),
  weekdays: normalizeWeekdays(getPrimaryPlanSeries(pp)?.weekdays),
  time: getHourTimeValue(getPrimaryPlanSeries(pp)?.starts_at) || "08:00",
});

const getPatientPlanPauseInfo = (pp) => {
  const pauses = Array.isArray(pp?.pauses) ? pp.pauses : [];
  const current = pauses.find((pause) => pause.status === "active")
    || pauses.find((pause) => pause.status === "scheduled");
  if (!current) return null;

  if (current.status === "scheduled") {
    return current.is_indefinite
      ? `Pausa programada a partir de ${formatDateBR(current.starts_on)}`
      : `Pausa programada de ${formatDateBR(current.starts_on)} a ${formatDateBR(current.ends_on)}`;
  }

  return current.is_indefinite
    ? `Pausa por tempo indeterminado desde ${formatDateBR(current.starts_on)}`
    : `Pausa ativa desde ${formatDateBR(current.starts_on)} até ${formatDateBR(current.ends_on)}`;
};

const ANCHOR_DAY_OPTIONS = Array.from({ length: 31 }, (_, index) => index + 1);

const EMPTY_SCHED = {
  professional_user_id: "",
  date: "",
  time: "08:00",
  weekdays: [],
  duration_minutes: 60,
  occurrence_count: "",
  until_date: "",
  use_count: true,
};

const EMPTY_CANCEL = {
  effectiveDate: todayDateOnly(),
  reason: "",
};

const makeEmptyPauseForm = () => ({
  starts_on: todayDateOnly(),
  ends_on: "",
  is_indefinite: true,
  reason: "",
});

const makeEmptyResumeForm = () => ({
  resumes_on: todayDateOnly(),
});

const EMPTY_SVC = {
  name: "",
  price: "",
  color: "#6a795c",
  default_duration_minutes: 60,
};

const STATUS_INFO = {
  active: { label: "Ativo", tone: "active" },
  paused: { label: "Pausado", tone: "paused" },
  canceled: { label: "Cancelado", tone: "canceled" },
};

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

export default function Planos() {
  const history = useHistory();
  const location = useLocation();
  const { patientPlanId } = useParams();
  const isPatientPlanDetailPage = !!patientPlanId;
  const [activeTab, setActiveTab] = useState("patient-plans");
  const [isSaving, setIsSaving] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Base data
  const [services, setServices] = useState([]);
  const [servicePrices, setServicePrices] = useState([]);
  const [isServicesLoading, setIsServicesLoading] = useState(false);
  const [servicesError, setServicesError] = useState("");
  const [patients, setPatients] = useState([]);
  const [professionals, setProfessionals] = useState([]);
  const [servicePlans, setServicePlans] = useState([]);

  // Services tab
  const [svcDrawerOpen, setSvcDrawerOpen] = useState(false);
  const [svcEditingId, setSvcEditingId] = useState(null);
  const [svcForm, setSvcForm] = useState(EMPTY_SVC);

  // Service Plans tab
  const [spFilterServiceId, setSpFilterServiceId] = useState("");
  const [isServicePlansLoading, setIsServicePlansLoading] = useState(false);
  const [servicePlansError, setServicePlansError] = useState("");
  const [spDrawerOpen, setSpDrawerOpen] = useState(false);
  const [spEditingId, setSpEditingId] = useState(null);
  const [spForm, setSpForm] = useState(EMPTY_SP);

  // Patient Plans tab
  const [patientPlans, setPatientPlans] = useState([]);
  const [isPatientPlansLoading, setIsPatientPlansLoading] = useState(false);
  const [patientPlansError, setPatientPlansError] = useState("");
  const [ppPatientSearch, setPpPatientSearch] = useState("");
  const [ppFilterStatus, setPpFilterStatus] = useState("");
  const [ppFocusedPlanId, setPpFocusedPlanId] = useState("");
  const [ppDrawerOpen, setPpDrawerOpen] = useState(false);
  const [ppEditingId, setPpEditingId] = useState(null);
  const [ppEditingStatus, setPpEditingStatus] = useState(null);
  const [ppForm, setPpForm] = useState(makeEmptyPpForm);
  const [ppPausePlan, setPpPausePlan] = useState(null);
  const [ppPauseForm, setPpPauseForm] = useState(makeEmptyPauseForm);
  const [ppResumePlan, setPpResumePlan] = useState(null);
  const [ppResumeForm, setPpResumeForm] = useState(makeEmptyResumeForm);
  const [ppResumePreview, setPpResumePreview] = useState(null);
  const [ppResumePreviewLoading, setPpResumePreviewLoading] = useState(false);
  const [ppCancelPlan, setPpCancelPlan] = useState(null);
  const [ppCancelForm, setPpCancelForm] = useState(EMPTY_CANCEL);
  const [ppDetailPlan, setPpDetailPlan] = useState(null);
  const [ppDetailLoading, setPpDetailLoading] = useState(false);
  const [ppDetailError, setPpDetailError] = useState("");
  const [ppDetailEditing, setPpDetailEditing] = useState(false);
  const [ppDetailEditForm, setPpDetailEditForm] = useState(makeEmptyPpForm);

  // Schedule sessions drawer (open from PatientPlan row)
  const [schedDrawerOpen, setSchedDrawerOpen] = useState(false);
  const [schedPlan, setSchedPlan] = useState(null); // the PatientPlan being scheduled
  const [schedForm, setSchedForm] = useState(EMPTY_SCHED);

  // Post-creation prompt: ask user to schedule after vincular
  const [schedPrompt, setSchedPrompt] = useState(null); // PatientPlan object

  // ---- Data loading ----

  const loadBaseData = useCallback(async () => {
    setIsServicesLoading(true);
    setServicesError("");
    try {
      const [servicesRes, pricesRes, patientsRes, profsRes] = await Promise.all([
        axios.get("/services"),
        listServicePrices(),
        axios.get("/patients"),
        axios.get("/users", { params: { group: PROFESSIONAL_GROUP_SLUG } }),
      ]);
      setServices(Array.isArray(servicesRes.data) ? servicesRes.data : []);
      setServicePrices(Array.isArray(pricesRes.data) ? pricesRes.data : []);
      setPatients(Array.isArray(patientsRes.data) ? patientsRes.data : []);
      setProfessionals(Array.isArray(profsRes.data) ? profsRes.data : []);
    } catch (err) {
      const message = err?.response?.data?.error || "Erro ao carregar dados base.";
      setServicesError(message);
      toast.error(message);
    } finally {
      setIsServicesLoading(false);
    }
  }, []);

  const loadServicePlans = useCallback(async () => {
    setIsServicePlansLoading(true);
    setServicePlansError("");
    try {
      const res = await listServicePlans({});
      setServicePlans(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      const message = err?.response?.data?.error || "Erro ao carregar planos comerciais.";
      setServicePlansError(message);
      toast.error(message);
    } finally {
      setIsServicePlansLoading(false);
    }
  }, []);

  const loadPatientPlans = useCallback(async () => {
    setIsPatientPlansLoading(true);
    setPatientPlansError("");
    try {
      const params = {};
      if (ppFilterStatus) params.status = ppFilterStatus;
      const res = await listPatientPlans(params);
      setPatientPlans(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      const message = err?.response?.data?.error || "Erro ao carregar vínculos.";
      setPatientPlansError(message);
      toast.error(message);
    } finally {
      setIsPatientPlansLoading(false);
    }
  }, [ppFilterStatus]);

  const loadPatientPlanDetail = useCallback(async (id) => {
    if (!id) return null;
    setPpDetailLoading(true);
    setPpDetailError("");
    try {
      const res = await axios.get(`/patient-plans/${id}`);
      setPpDetailPlan(res.data || null);
      return res.data || null;
    } catch (err) {
      const message = err?.response?.data?.error || "Erro ao carregar detalhes do plano.";
      setPpDetailError(message);
      setPpDetailPlan(null);
      return null;
    } finally {
      setPpDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBaseData();
    loadServicePlans();
  }, [loadBaseData, loadServicePlans]);

  useEffect(() => {
    const params = new URLSearchParams(location.search || "");
    const tab = params.get("tab");
    const patientId = params.get("patient_id");
    const patientName = params.get("patient_name");
    const queryPatientPlanId = params.get("patient_plan_id");
    const status = params.get("status");

    if (tab === "patient-plans" || patientId || queryPatientPlanId) {
      setActiveTab("patient-plans");
    }

    if (status !== null) {
      setPpFilterStatus(status);
    }

    if (queryPatientPlanId) {
      setPpFocusedPlanId(queryPatientPlanId);
    }

    if (patientId) {
      const patient = patients.find((item) => String(item.id) === String(patientId));
      setPpPatientSearch(patient ? getPatientDisplayName(patient) : patientName || "");
    } else if (patientName) {
      setPpPatientSearch(patientName);
    }
  }, [location.search, patients]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("planos_sidebar_collapsed");
      if (stored !== null) {
        setIsSidebarCollapsed(stored === "true");
      }
    } catch (error) {
      // ignore storage errors
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return () => { };
    const media = window.matchMedia("(max-width: 960px)");
    const handleChange = () => {
      setIsMobile(media.matches);
      if (!media.matches) {
        setIsSidebarOpen(false);
      }
    };

    handleChange();
    if (media.addEventListener) {
      media.addEventListener("change", handleChange);
      return () => media.removeEventListener("change", handleChange);
    }
    media.addListener(handleChange);
    return () => media.removeListener(handleChange);
  }, []);

  useEffect(() => {
    if (activeTab === "patient-plans") loadPatientPlans();
  }, [activeTab, loadPatientPlans]);

  useEffect(() => {
    if (!patientPlanId) {
      setPpDetailPlan(null);
      setPpDetailError("");
      setPpDetailLoading(false);
      setPpDetailEditing(false);
      setPpDetailEditForm(makeEmptyPpForm());
      return;
    }
    setActiveTab("patient-plans");
    setPpDetailEditing(false);
    setPpDetailEditForm(makeEmptyPpForm());
    loadPatientPlanDetail(patientPlanId);
  }, [loadPatientPlanDetail, patientPlanId]);

  // ---- Derived ----

  const filteredServicePlans = useMemo(() => {
    if (!spFilterServiceId) return servicePlans;
    return servicePlans.filter(
      (sp) => String(sp.service_id) === spFilterServiceId,
    );
  }, [servicePlans, spFilterServiceId]);

  const activeServicePlans = useMemo(
    () => servicePlans.filter((sp) => sp.is_active !== false),
    [servicePlans],
  );

  const servicePriceMap = useMemo(() => {
    const map = new Map();
    servicePrices.forEach((item) => {
      if (item?.is_active === false) return;
      if (!map.has(item.service_id)) {
        map.set(item.service_id, item);
      }
    });
    return map;
  }, [servicePrices]);

  const latestServicePriceMap = useMemo(() => {
    const map = new Map();
    servicePrices.forEach((item) => {
      if (!map.has(item.service_id)) {
        map.set(item.service_id, item);
      }
    });
    return map;
  }, [servicePrices]);

  const displayedPatientPlans = useMemo(() => {
    const needle = normalizeSearchText(ppPatientSearch);
    return patientPlans
      .filter((pp) => {
        if (ppFocusedPlanId && String(pp.id) !== String(ppFocusedPlanId)) return false;
        if (!needle) return true;
        return getPatientSearchText(pp?.Patient).includes(needle);
      })
      .sort(comparePatientPlans);
  }, [patientPlans, ppFocusedPlanId, ppPatientSearch]);

  const ppCyclePreview = useMemo(() => {
    if (!ppForm.starts_at) return null;
    if (!isValidDateOnly(ppForm.starts_at)) return null;
    const nextCycleStart = addOneMonthDateOnly(ppForm.starts_at);
    const cycleEnd = subtractOneDayDateOnly(nextCycleStart);
    if (!nextCycleStart || !cycleEnd) return null;
    return `${formatDateBR(ppForm.starts_at)} a ${formatDateBR(cycleEnd)}`;
  }, [ppForm.starts_at]);

  const schedWeekdayLimit = useMemo(
    () => normalizeSessionsPerWeek(schedPlan?.ServicePlan?.sessions_per_week),
    [schedPlan],
  );

  const isSchedFormComplete = useMemo(() => {
    const hasProfessional = !!schedForm.professional_user_id;
    const hasRequiredDate = !!schedForm.date && !isWeekendDateOnly(schedForm.date);
    const hasRequiredTime = !!schedForm.time;
    const hasRequiredWeekdays = schedWeekdayLimit
      ? schedForm.weekdays.length === schedWeekdayLimit
      : schedForm.weekdays.length > 0;
    return hasProfessional
      && hasRequiredDate
      && hasRequiredTime
      && hasRequiredWeekdays;
  }, [schedForm, schedWeekdayLimit]);

  // ---- Services handlers ----

  const openSvcCreate = useCallback(() => {
    setSvcEditingId(null);
    setSvcForm(EMPTY_SVC);
    setSvcDrawerOpen(true);
  }, []);

  const openSvcEdit = useCallback((svc) => {
    const activePrice = servicePriceMap.get(svc.id);
    setSvcEditingId(svc.id);
    setSvcForm({
      name: svc.name || "",
      price: activePrice ? centsToInputValue(activePrice.price_cents) : "",
      color: svc.color || "#6a795c",
      default_duration_minutes: svc.default_duration_minutes || 60,
    });
    setSvcDrawerOpen(true);
  }, [servicePriceMap]);

  const closeSvcDrawer = useCallback(() => {
    setSvcDrawerOpen(false);
    setSvcEditingId(null);
    setSvcForm(EMPTY_SVC);
  }, []);

  const handleSvcChange = useCallback((e) => {
    const { name, value } = e.target;
    setSvcForm((prev) => ({ ...prev, [name]: value }));
  }, []);

  const handleSvcSubmit = useCallback(
    async (e) => {
      e.preventDefault();
      if (!svcForm.name.trim()) {
        toast.error("Informe o nome do serviço.");
        return;
      }
      const hasPriceInput = String(svcForm.price || "").trim() !== "";
      const priceCents = parseMoneyInput(svcForm.price);
      if (hasPriceInput && (!priceCents || priceCents <= 0)) {
        toast.error("Informe um valor por sessão maior que zero ou deixe em branco.");
        return;
      }
      setIsSaving(true);
      try {
        let serviceId = svcEditingId;
        const payload = {
          name: svcForm.name.trim(),
          color: svcForm.color || "#6a795c",
          default_duration_minutes: Number(svcForm.default_duration_minutes) || 60,
        };
        if (svcEditingId) {
          const response = await axios.put(`/services/${svcEditingId}`, payload);
          if (response?.data?.id) {
            setServices((prev) => sortServicesByName(upsertById(prev, response.data)));
          }
          toast.success("Serviço atualizado.");
        } else {
          const existingCodes = new Set(services.map((s) => s.code));
          let code = slugify(svcForm.name);
          if (existingCodes.has(code)) code = `${code}_${Date.now()}`;
          const response = await axios.post("/services", { ...payload, code });
          serviceId = response?.data?.id || null;
          if (response?.data?.id) {
            setServices((prev) => sortServicesByName(upsertById(prev, response.data)));
          }
          toast.success("Serviço criado.");
        }

        if (serviceId) {
          const existingPrice = latestServicePriceMap.get(serviceId);
          if (priceCents && priceCents > 0) {
            const pricePayload = {
              service_id: serviceId,
              price_cents: priceCents,
              currency: "BRL",
              is_active: true,
            };
            let priceResponse = null;
            if (existingPrice) {
              priceResponse = await updateServicePrice(existingPrice.id, pricePayload);
            } else {
              priceResponse = await createServicePrice(pricePayload);
            }
            if (priceResponse?.data?.id) {
              setServicePrices((prev) => upsertById(prev, priceResponse.data));
            }
          } else if (existingPrice?.is_active !== false) {
            const priceResponse = await updateServicePrice(existingPrice.id, {
              service_id: serviceId,
              price_cents: 0,
              currency: existingPrice.currency || "BRL",
              is_active: false,
            });
            if (priceResponse?.data?.id) {
              setServicePrices((prev) => upsertById(prev, priceResponse.data));
            }
          }
        }

        closeSvcDrawer();
      } catch (err) {
        toast.error(err?.response?.data?.error || "Erro ao salvar serviço.");
      } finally {
        setIsSaving(false);
      }
    },
    [
      svcForm,
      svcEditingId,
      services,
      latestServicePriceMap,
      closeSvcDrawer,
    ],
  );

  const handleSvcToggle = useCallback(
    async (svc) => {
      try {
        const response = await axios.put(`/services/${svc.id}`, { is_active: !svc.is_active });
        if (response?.data?.id) {
          setServices((prev) => sortServicesByName(upsertById(prev, response.data)));
        }
        toast.success(svc.is_active ? "Serviço inativado." : "Serviço ativado.");
      } catch (err) {
        toast.error(err?.response?.data?.error || "Erro ao alterar serviço.");
      }
    },
    [],
  );

  // ---- Service Plan handlers ----

  const handleSpChange = useCallback((e) => {
    const { name, value } = e.target;
    setSpForm((prev) => ({ ...prev, [name]: value }));
  }, []);

  const openSpCreate = useCallback(() => {
    setSpEditingId(null);
    setSpForm(EMPTY_SP);
    setSpDrawerOpen(true);
  }, []);

  const openSpEdit = useCallback((sp) => {
    setSpEditingId(sp.id);
    setSpForm({
      service_id: String(sp.service_id || ""),
      price: centsToInputValue(sp.price_cents),
      sessions_per_week:
        sp.sessions_per_week != null ? String(sp.sessions_per_week) : "",
    });
    setSpDrawerOpen(true);
  }, []);

  const closeSpDrawer = useCallback(() => {
    setSpDrawerOpen(false);
    setSpEditingId(null);
    setSpForm(EMPTY_SP);
  }, []);

  const handleSpSubmit = useCallback(
    async (e) => {
      e.preventDefault();
      if (!spForm.service_id) {
        toast.error("Selecione o serviço base.");
        return;
      }
      const priceCents = parseMoneyInput(spForm.price);
      if (!priceCents) {
        toast.error("Preço inválido. Use o formato 700,00 ou 1.000,00.");
        return;
      }
      setIsSaving(true);
      try {
        const service = services.find((s) => String(s.id) === String(spForm.service_id));
        const serviceName = service?.name || "";
        const sessionsN = spForm.sessions_per_week ? Number(spForm.sessions_per_week) : null;
        const derivedName = sessionsN
          ? `${serviceName} ${sessionsN}x na semana`
          : serviceName;
        const derivedFrequencyLabel = sessionsN ? `${sessionsN}x na semana` : null;
        const payload = {
          service_id: Number(spForm.service_id),
          name: derivedName,
          price_cents: priceCents,
          sessions_per_week: sessionsN,
          frequency_label: derivedFrequencyLabel,
        };
        if (spEditingId) {
          await updateServicePlan(spEditingId, payload);
          toast.success("Plano atualizado.");
        } else {
          await createServicePlan(payload);
          toast.success("Plano criado.");
        }
        closeSpDrawer();
        await loadServicePlans();
      } catch (err) {
        toast.error(err?.response?.data?.error || "Erro ao salvar plano.");
      } finally {
        setIsSaving(false);
      }
    },
    [spForm, spEditingId, services, closeSpDrawer, loadServicePlans],
  );

  const handleSpDeactivate = useCallback(
    async (sp) => {
      // eslint-disable-next-line no-alert
      const ok = window.confirm(`Inativar "${sp.name}"?\n\nVínculos de pacientes já existentes não são afetados.`);
      if (!ok) return;
      try {
        await deactivateServicePlan(sp.id);
        toast.success("Plano inativado.");
        await loadServicePlans();
      } catch (err) {
        toast.error(err?.response?.data?.error || "Erro ao inativar plano.");
      }
    },
    [loadServicePlans],
  );

  // ---- Patient Plan handlers ----

  const handlePpChange = useCallback((e) => {
    const { name, value } = e.target;
    setPpForm((prev) => ({ ...prev, [name]: value }));
  }, []);

  const openPpCreate = useCallback(() => {
    setPpEditingId(null);
    setPpEditingStatus(null);
    setPpForm(makeEmptyPpForm());
    setPpDrawerOpen(true);
  }, []);

  const openPpDetails = useCallback((pp) => {
    if (!pp?.id) return;
    history.push(`/planos/pacientes/${pp.id}`);
  }, [history]);

  const handlePpDetailEditChange = useCallback((e) => {
    const { name, value } = e.target;
    setPpDetailEditForm((prev) => {
      if (name === "service_plan_id") {
        const selectedPlan = [
          ...activeServicePlans,
          ppDetailPlan?.ServicePlan,
        ].filter(Boolean).find((sp) => String(sp.id) === String(value));
        const limit = normalizeSessionsPerWeek(selectedPlan?.sessions_per_week);
        const weekdays = Array.isArray(prev.weekdays) ? prev.weekdays : [];
        return {
          ...prev,
          [name]: value,
          weekdays: limit ? weekdays.slice(0, limit) : weekdays,
        };
      }
      return { ...prev, [name]: value };
    });
  }, [activeServicePlans, ppDetailPlan]);

  const togglePpDetailWeekday = useCallback((day) => {
    setPpDetailEditForm((prev) => {
      const current = Array.isArray(prev.weekdays) ? prev.weekdays : [];
      const selectedPlan = [
        ...activeServicePlans,
        ppDetailPlan?.ServicePlan,
      ].filter(Boolean).find((sp) => String(sp.id) === String(prev.service_plan_id));
      const limit = normalizeSessionsPerWeek(selectedPlan?.sessions_per_week);
      if (limit && !current.includes(day) && current.length >= limit) {
        return prev;
      }
      const next = current.includes(day)
        ? current.filter((item) => item !== day)
        : [...current, day].sort((a, b) => a - b);
      return { ...prev, weekdays: next };
    });
  }, [activeServicePlans, ppDetailPlan]);

  const startPpDetailEditing = useCallback(() => {
    if (!ppDetailPlan) return;
    if (ppDetailPlan.status === "canceled") {
      toast.error("Vínculos cancelados não podem ser editados.");
      return;
    }
    setPpDetailEditForm(buildPpEditFormFromPlan(ppDetailPlan));
    setPpDetailEditing(true);
  }, [ppDetailPlan]);

  const cancelPpDetailEditing = useCallback(() => {
    setPpDetailEditForm(buildPpEditFormFromPlan(ppDetailPlan));
    setPpDetailEditing(false);
  }, [ppDetailPlan]);

  const savePpDetailEditing = useCallback(async () => {
    if (!ppDetailPlan?.id) return;
    if (!ppDetailEditForm.service_plan_id) {
      toast.error("Selecione o plano comercial.");
      return;
    }
    const anchor = Number(ppDetailEditForm.anchor_day);
    if (!ppDetailEditForm.anchor_day || Number.isNaN(anchor) || anchor < 1 || anchor > 31) {
      toast.error("Dia de vencimento deve ser entre 1 e 31.");
      return;
    }
    if (!ppDetailEditForm.starts_at) {
      toast.error("Informe a data de início do plano.");
      return;
    }
    if (!isValidDateOnly(ppDetailEditForm.starts_at)) {
      toast.error("Informe uma data de início válida.");
      return;
    }
    const currentAgenda = getPatientPlanAgendaInfo(ppDetailPlan, professionals);
    const seriesId = currentAgenda?.seriesId;
    const selectedPlan = [
      ...activeServicePlans,
      ppDetailPlan?.ServicePlan,
    ].filter(Boolean).find((sp) => String(sp.id) === String(ppDetailEditForm.service_plan_id));
    const weekdayLimit = normalizeSessionsPerWeek(selectedPlan?.sessions_per_week);
    if (seriesId && !ppDetailEditForm.professional_user_id) {
      toast.error("Selecione o profissional.");
      return;
    }
    if (seriesId && ppDetailEditForm.weekdays.length === 0) {
      toast.error("Selecione pelo menos um dia da semana.");
      return;
    }
    if (seriesId && weekdayLimit && ppDetailEditForm.weekdays.length !== weekdayLimit) {
      toast.error(`Selecione exatamente ${weekdayLimit} dia(s) da semana para este plano.`);
      return;
    }
    if (seriesId && !ppDetailEditForm.time) {
      toast.error("Informe o horário.");
      return;
    }
    setIsSaving(true);
    try {
      await updatePatientPlan(ppDetailPlan.id, {
        patient_id: Number(ppDetailPlan.patient_id),
        service_plan_id: Number(ppDetailEditForm.service_plan_id),
        anchor_day: anchor,
        starts_at: ppDetailEditForm.starts_at,
        ends_at: ppDetailEditForm.ends_at || null,
        notes: ppDetailEditForm.notes.trim() || null,
      });
      if (seriesId) {
        const currentSeries = getPrimaryPlanSeries(ppDetailPlan);
        const rawSeriesDate = String(currentSeries?.starts_at || "").slice(0, 10);
        const rawPlanDate = String(ppDetailPlan.starts_at || "").slice(0, 10);
        let seriesDate = ppDetailEditForm.starts_at;
        if (isValidDateOnly(rawPlanDate)) seriesDate = rawPlanDate;
        if (isValidDateOnly(rawSeriesDate)) seriesDate = rawSeriesDate;
        await axios.put(`/session-series/${seriesId}`, {
          professional_user_id: Number(ppDetailEditForm.professional_user_id),
          weekdays: ppDetailEditForm.weekdays,
          starts_at: buildDateTimeWithHour(seriesDate, ppDetailEditForm.time),
        });
      }
      toast.success("Vínculo atualizado.");
      setPpDetailEditing(false);
      await loadPatientPlans();
      await loadPatientPlanDetail(ppDetailPlan.id);
    } catch (err) {
      toast.error(err?.response?.data?.error || "Erro ao salvar vínculo.");
    } finally {
      setIsSaving(false);
    }
  }, [activeServicePlans, loadPatientPlanDetail, loadPatientPlans, ppDetailEditForm, ppDetailPlan, professionals]);

  const closePpDrawer = useCallback(() => {
    setPpDrawerOpen(false);
    setPpEditingId(null);
    setPpEditingStatus(null);
    setPpForm(makeEmptyPpForm());
  }, []);

  const handlePpSubmit = useCallback(
    async (e) => {
      e.preventDefault();
      if (!ppForm.patient_id) {
        toast.error("Selecione o paciente.");
        return;
      }
      if (!ppForm.service_plan_id) {
        toast.error("Selecione o plano comercial.");
        return;
      }
      const anchor = Number(ppForm.anchor_day);
      if (!ppForm.anchor_day || Number.isNaN(anchor) || anchor < 1 || anchor > 31) {
        toast.error("Dia de vencimento deve ser entre 1 e 31.");
        return;
      }
      if (!ppForm.starts_at) {
        toast.error("Informe a data de início do plano.");
        return;
      }
      if (!isValidDateOnly(ppForm.starts_at)) {
        toast.error("Informe uma data de início válida.");
        return;
      }
      setIsSaving(true);
      try {
        const payload = {
          patient_id: Number(ppForm.patient_id),
          service_plan_id: Number(ppForm.service_plan_id),
          anchor_day: anchor,
          starts_at: ppForm.starts_at,
          ends_at: ppForm.ends_at || null,
          notes: ppForm.notes.trim() || null,
        };
        if (ppEditingId) {
          await updatePatientPlan(ppEditingId, payload);
          toast.success("Vínculo atualizado.");
          closePpDrawer();
          await loadPatientPlans();
          if (patientPlanId) await loadPatientPlanDetail(patientPlanId);
        } else {
          const res = await createPatientPlan(payload);
          toast.success("Vínculo criado!");
          closePpDrawer();
          await loadPatientPlans();
          // Offer to schedule sessions right away
          const sp = activeServicePlans.find(
            (s) => String(s.id) === String(ppForm.service_plan_id),
          );
          setSchedPrompt({ ...res.data, ServicePlan: sp });
        }
      } catch (err) {
        toast.error(err?.response?.data?.error || "Erro ao salvar vínculo.");
      } finally {
        setIsSaving(false);
      }
    },
    [ppForm, ppEditingId, closePpDrawer, loadPatientPlans, activeServicePlans, patientPlanId, loadPatientPlanDetail],
  );

	  const handlePpPause = useCallback(
	    (pp) => {
	      if (isSaving || ppPausePlan || ppResumePlan || ppCancelPlan) return;
	      setPpPauseForm(makeEmptyPauseForm());
	      setPpPausePlan(pp);
	    },
	    [isSaving, ppPausePlan, ppResumePlan, ppCancelPlan],
	  );

	  const closePpPauseModal = useCallback(() => {
	    setPpPausePlan(null);
	    setPpPauseForm(makeEmptyPauseForm());
	  }, []);

  const handlePpPauseConfirm = useCallback(
	    async () => {
	      if (!ppPausePlan || isSaving) return;
	      if (!isValidDateOnly(ppPauseForm.starts_on)) {
	        toast.error("Informe uma data de início válida.");
	        return;
	      }
	      if (!ppPauseForm.is_indefinite) {
	        if (!isValidDateOnly(ppPauseForm.ends_on)) {
	          toast.error("Informe uma data fim válida ou marque tempo indeterminado.");
	          return;
	        }
	        if (ppPauseForm.ends_on < ppPauseForm.starts_on) {
	          toast.error("A data fim não pode ser anterior ao início.");
	          return;
	        }
	      }
	      setIsSaving(true);
	      try {
	        await pausePatientPlan(ppPausePlan.id, {
	          starts_on: ppPauseForm.starts_on,
	          ends_on: ppPauseForm.is_indefinite ? null : ppPauseForm.ends_on,
	          is_indefinite: ppPauseForm.is_indefinite,
	          reason: ppPauseForm.reason.trim() || null,
	        });
	        toast.success("Plano pausado.");
	        closePpPauseModal();
        await loadPatientPlans();
        if (patientPlanId) await loadPatientPlanDetail(patientPlanId);
      } catch (err) {
        toast.error(err?.response?.data?.error || "Erro ao pausar plano.");
      } finally {
        setIsSaving(false);
      }
    },
	    [closePpPauseModal, isSaving, loadPatientPlans, patientPlanId, ppPauseForm, ppPausePlan, loadPatientPlanDetail],
	  );

  const handlePpResume = useCallback(
    (pp) => {
      if (isSaving || ppPausePlan || ppResumePlan || ppCancelPlan) return;
      setPpResumeForm(makeEmptyResumeForm());
      setPpResumePreview(null);
      setPpResumePlan(pp);
    },
    [isSaving, ppPausePlan, ppResumePlan, ppCancelPlan],
  );

  const closePpResumeModal = useCallback(() => {
    setPpResumePlan(null);
    setPpResumeForm(makeEmptyResumeForm());
    setPpResumePreview(null);
    setPpResumePreviewLoading(false);
  }, []);

  useEffect(() => {
    let active = true;
    const loadPreview = async () => {
      if (!ppResumePlan || !isValidDateOnly(ppResumeForm.resumes_on)) {
        setPpResumePreview(null);
        return;
      }
      setPpResumePreviewLoading(true);
      try {
        const res = await previewResumePatientPlan(ppResumePlan.id, {
          resumes_on: ppResumeForm.resumes_on,
        });
        if (active) setPpResumePreview(res.data || null);
      } catch (err) {
        if (active) {
          setPpResumePreview(null);
          toast.error(err?.response?.data?.error || "Erro ao revisar retomada.");
        }
      } finally {
        if (active) setPpResumePreviewLoading(false);
      }
    };
    loadPreview();
    return () => {
      active = false;
    };
  }, [ppResumeForm.resumes_on, ppResumePlan]);

  const handlePpResumeConfirm = useCallback(
    async () => {
      if (!ppResumePlan || isSaving) return;
      if (!isValidDateOnly(ppResumeForm.resumes_on)) {
        toast.error("Informe uma data de retomada válida.");
        return;
      }
      setIsSaving(true);
      try {
        await resumePatientPlan(ppResumePlan.id, {
          resumes_on: ppResumeForm.resumes_on,
        });
        toast.success("Plano retomado.");
        closePpResumeModal();
        await loadPatientPlans();
        if (patientPlanId) await loadPatientPlanDetail(patientPlanId);
      } catch (err) {
        toast.error(err?.response?.data?.error || "Erro ao retomar plano.");
      } finally {
        setIsSaving(false);
      }
    },
    [
      closePpResumeModal,
      isSaving,
      loadPatientPlans,
      patientPlanId,
      ppResumeForm.resumes_on,
      ppResumePlan,
      loadPatientPlanDetail,
    ],
  );


  const handlePpCancel = useCallback((pp) => {
    if (isSaving || ppPausePlan || ppResumePlan || ppCancelPlan) return;
    setPpCancelPlan(pp);
    setPpCancelForm({
      ...EMPTY_CANCEL,
      effectiveDate: todayDateOnly(),
    });
  }, [isSaving, ppPausePlan, ppResumePlan, ppCancelPlan]);

  const closePpCancelModal = useCallback(() => {
    setPpCancelPlan(null);
    setPpCancelForm(EMPTY_CANCEL);
  }, []);

  const handlePpCancelSubmit = useCallback(
    async (e) => {
      e.preventDefault();
      if (!ppCancelPlan || isSaving) return;

      const { effectiveDate } = ppCancelForm;
      if (!effectiveDate) {
        toast.error("Informe a data para cancelar o plano.");
        return;
      }
      if (effectiveDate < todayDateOnly()) {
        toast.error("A data de cancelamento não pode ser anterior a hoje.");
        return;
      }
      if (!ppCancelForm.reason.trim()) {
        toast.error("Informe o motivo do cancelamento.");
        return;
      }

      setIsSaving(true);
      try {
        await cancelPatientPlan(ppCancelPlan.id, {
          effective_date: effectiveDate,
          cancellation_reason: ppCancelForm.reason.trim(),
        });
        toast.success(effectiveDate === todayDateOnly()
          ? "Vínculo cancelado."
          : "Cancelamento programado.");
        closePpCancelModal();
        await loadPatientPlans();
        if (patientPlanId) await loadPatientPlanDetail(patientPlanId);
      } catch (err) {
        toast.error(err?.response?.data?.error || "Erro ao cancelar vínculo.");
      } finally {
        setIsSaving(false);
      }
    },
    [ppCancelPlan, ppCancelForm, isSaving, closePpCancelModal, loadPatientPlans, patientPlanId, loadPatientPlanDetail],
  );

  // ---- Schedule sessions handlers ----

  const openSchedDrawer = useCallback((pp) => {
    const sp = pp.ServicePlan;
    const sessionsPerWeek = normalizeSessionsPerWeek(sp?.sessions_per_week);
    const suggestedCount = sessionsPerWeek
      ? sessionsPerWeek * 4
      : 8;
    setSchedPlan(pp);
    setSchedForm({
      ...EMPTY_SCHED,
      date: pp.starts_at && !isWeekendDateOnly(String(pp.starts_at).slice(0, 10))
        ? String(pp.starts_at).slice(0, 10)
        : "",
      occurrence_count: String(suggestedCount),
    });
    setSchedDrawerOpen(true);
    setSchedPrompt(null);
  }, []);

  const closeSchedDrawer = useCallback(() => {
    setSchedDrawerOpen(false);
    setSchedPlan(null);
    setSchedForm(EMPTY_SCHED);
  }, []);

  const setSched = (name, value) =>
    setSchedForm((prev) => ({ ...prev, [name]: value }));

  const handleSchedChange = useCallback((e) => {
    const { name, value, type, checked } = e.target;
    if (name === "date" && isWeekendDateOnly(value)) {
      toast.error("Escolha um dia util para a primeira sessão.");
      setSched(name, "");
      return;
    }
    setSched(name, type === "checkbox" ? checked : value);
  }, []);

  const toggleWeekday = useCallback((day) => {
    setSchedForm((prev) => {
      if (
        schedWeekdayLimit
        && !prev.weekdays.includes(day)
        && prev.weekdays.length >= schedWeekdayLimit
      ) {
        return prev;
      }
      const next = prev.weekdays.includes(day)
        ? prev.weekdays.filter((d) => d !== day)
        : [...prev.weekdays, day].sort((a, b) => a - b);
      return { ...prev, weekdays: next };
    });
  }, [schedWeekdayLimit]);

  const handleSchedSubmit = useCallback(
    async (e) => {
      e.preventDefault();
      if (!schedPlan) return;

      if (!schedForm.professional_user_id) {
        toast.error("Selecione o profissional.");
        return;
      }
      if (!schedForm.date) {
        toast.error("Informe a data da primeira sessão.");
        return;
      }
      if (isWeekendDateOnly(schedForm.date)) {
        toast.error("Escolha um dia util para a primeira sessão.");
        return;
      }
      if (!schedForm.time) {
        toast.error("Informe o horário.");
        return;
      }
      if (schedForm.weekdays.length === 0) {
        toast.error("Selecione pelo menos um dia da semana.");
        return;
      }
      if (
        schedWeekdayLimit
        && schedForm.weekdays.length !== schedWeekdayLimit
      ) {
        toast.error(`Selecione exatamente ${schedWeekdayLimit} dia(s) da semana para este plano.`);
        return;
      }

      const startsAt = `${schedForm.date}T${schedForm.time}:00`;
      const sp = schedPlan.ServicePlan;
      const serviceId = sp?.service_id || schedPlan.service_id;

      const payload = {
        patient_id: schedPlan.patient_id,
        service_id: serviceId,
        professional_user_id: Number(schedForm.professional_user_id),
        starts_at: startsAt,
        duration_minutes: Number(schedForm.duration_minutes) || 60,
        repeat_interval: 1,
        weekdays: schedForm.weekdays,
        billing_mode: "covered_by_plan",
      };


      setIsSaving(true);
      try {
        const currentPlanStart = schedPlan.starts_at
          ? String(schedPlan.starts_at).slice(0, 10)
          : "";
        if (schedForm.date !== currentPlanStart) {
          await updatePatientPlan(schedPlan.id, { starts_at: schedForm.date });
        }

        const res = await axios.post("/session-series", payload);
        const count = res.data?.total_created ?? res.data?.total_sessions ?? "?";
        const skipped = Number(res.data?.total_skipped_by_availability || res.data?.total_skipped || 0);
        toast.success(skipped > 0
          ? `Agenda criada. ${skipped} data(s) bloqueada(s) foram ignorada(s).`
          : `${count} sessão(ões) criada(s) na agenda!`);
        closeSchedDrawer();
        await loadPatientPlans();
        if (patientPlanId) await loadPatientPlanDetail(patientPlanId);
      } catch (err) {
        const msg = err?.response?.data?.error || "Erro ao criar agendamentos.";
        toast.error(msg);
      } finally {
        setIsSaving(false);
      }
    },
    [schedPlan, schedForm, schedWeekdayLimit, closeSchedDrawer, loadPatientPlans, patientPlanId, loadPatientPlanDetail],
  );

  // ---- Sidebar handlers ----

  const toggleSidebar = useCallback(() => {
    setIsSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("planos_sidebar_collapsed", String(next));
      } catch (error) {
        // ignore storage errors
      }
      return next;
    });
  }, []);

  const openSidebar = useCallback(() => {
    setIsSidebarOpen(true);
  }, []);

  const closeSidebar = useCallback(() => {
    setIsSidebarOpen(false);
  }, []);

  const handleSidebarToggle = useCallback(() => {
    if (isMobile) {
      closeSidebar();
      return;
    }
    toggleSidebar();
  }, [closeSidebar, isMobile, toggleSidebar]);

  const handleSectionChange = useCallback(
    (section) => {
      if (isPatientPlanDetailPage) {
        history.push("/planos");
      }
      setActiveTab(section);
      if (isMobile) {
        closeSidebar();
      }
    },
    [closeSidebar, history, isMobile, isPatientPlanDetailPage],
  );

  // ---- Drawer visibility ----

  const anyDrawerOpen = svcDrawerOpen
    || spDrawerOpen
    || ppDrawerOpen
    || schedDrawerOpen;

  const handleBackdropClick = () => {
    if (schedDrawerOpen) closeSchedDrawer();
    else if (ppDrawerOpen) closePpDrawer();
    else if (spDrawerOpen) closeSpDrawer();
    else if (svcDrawerOpen) closeSvcDrawer();
  };

  // ---- Render ----

  let ppSubmitLabel = "Vincular";
  if (ppEditingId) ppSubmitLabel = "Salvar";
  if (isSaving) ppSubmitLabel = "Salvando...";
  const ppPauseSummary = ppPausePlan ? getPatientPlanSummary(ppPausePlan) : null;
  const ppResumeSummary = ppResumePlan ? getPatientPlanSummary(ppResumePlan) : null;
  const ppResumeOkSessions = Array.isArray(ppResumePreview?.resumable_sessions)
    ? ppResumePreview.resumable_sessions
    : [];
  const ppResumeConflictSessions = Array.isArray(ppResumePreview?.conflicted_sessions)
    ? ppResumePreview.conflicted_sessions
    : [];
  const ppCancelSummary = ppCancelPlan ? getPatientPlanSummary(ppCancelPlan) : null;
  let sidebarToggleLabel = "Recolher menu";
  let sidebarToggleIcon = <FaChevronLeft />;
  if (isMobile) {
    sidebarToggleLabel = "Fechar menu";
    sidebarToggleIcon = <FaTimes />;
  } else if (isSidebarCollapsed) {
    sidebarToggleLabel = "Expandir menu";
    sidebarToggleIcon = <FaBars />;
  }
  const activeSectionInfo = {
    "patient-plans": {
      title: "Pacientes com plano",
      subtitle: "Acompanhe os pacientes vinculados a planos mensais.",
    },
    "service-plans": {
      title: "Planos mensais",
      subtitle: "Configure os planos recorrentes oferecidos pela clínica.",
    },
    services: {
      title: "Serviços",
      subtitle: "Configure serviços, duração, cor e valor por sessão.",
    },
  }[activeTab] || {
    title: "Serviços e Planos",
    subtitle: "Cadastro de serviços, valores e planos mensais.",
  };
  if (isPatientPlanDetailPage) {
    activeSectionInfo.title = "Detalhes do plano do paciente";
    activeSectionInfo.subtitle = "";
  }

  const ppDetailSummary = ppDetailPlan ? getPatientPlanSummary(ppDetailPlan) : null;
  const ppDetailStatus = ppDetailPlan ? getPatientPlanStatusInfo(ppDetailPlan) : null;
	  const ppDetailAgenda = ppDetailPlan
	    ? getPatientPlanAgendaInfo(ppDetailPlan, professionals)
	    : null;
	  const ppDetailPauseInfo = ppDetailPlan ? getPatientPlanPauseInfo(ppDetailPlan) : null;
  const ppDetailPlanOptions = useMemo(() => {
    const options = [...activeServicePlans];
    const currentPlan = ppDetailPlan?.ServicePlan;
    if (currentPlan?.id && !options.some((sp) => String(sp.id) === String(currentPlan.id))) {
      options.push(currentPlan);
    }
    return options.sort((left, right) => (
      String(left?.name || "").localeCompare(String(right?.name || ""), "pt-BR", {
        sensitivity: "base",
      })
    ));
  }, [activeServicePlans, ppDetailPlan]);
  const ppDetailEditingPlan = ppDetailPlanOptions.find(
    (sp) => String(sp.id) === String(ppDetailEditForm.service_plan_id),
  );
  const ppDetailEditingFrequency = ppDetailEditingPlan?.sessions_per_week
    ? `${ppDetailEditingPlan.sessions_per_week}x/sem`
    : ppDetailEditingPlan?.frequency_label || ppDetailSummary?.frequency || "-";
  const ppDetailWeekdayLimit = normalizeSessionsPerWeek(ppDetailEditingPlan?.sessions_per_week);
  const isPpStatusActionBusy = Boolean(isSaving || ppPausePlan || ppResumePlan || ppCancelPlan);
  const isPpDetailDataLoading = ppDetailLoading && !ppDetailPlan;
  const ppDetailText = (value) => (
    <strong>{isPpDetailDataLoading ? "-" : value || "-"}</strong>
  );
  let ppDetailEditActions = null;
  if (!isPpDetailDataLoading && ppDetailEditing) {
    ppDetailEditActions = (
      <>
        <GhostButton
          type="button"
          onClick={cancelPpDetailEditing}
          disabled={isSaving}
        >
          Cancelar edição
        </GhostButton>
        <SaveBtn
          type="button"
          onClick={savePpDetailEditing}
          disabled={isSaving}
        >
          {isSaving ? "Salvando..." : "Salvar"}
        </SaveBtn>
      </>
    );
  } else if (!isPpDetailDataLoading && ppDetailPlan?.status !== "canceled") {
    ppDetailEditActions = (
      <GhostButton type="button" onClick={startPpDetailEditing}>
        Editar
      </GhostButton>
    );
  }
  let ppDetailAgendaActions = null;
  if (!isPpDetailDataLoading && ppDetailAgenda?.isConfigured) {
    ppDetailAgendaActions = null;
  } else if (!isPpDetailDataLoading) {
    ppDetailAgendaActions = (
      <PrimaryButton
        type="button"
        disabled={ppDetailPlan?.status !== "active" || ppDetailEditing}
        onClick={() => openSchedDrawer(ppDetailPlan)}
      >
        <FaCalendarAlt /> Configurar agenda
      </PrimaryButton>
    );
  }
  return (
    <SidebarShellWrapper $collapsed={isSidebarCollapsed}>
      {anyDrawerOpen && <DrawerBackdrop onClick={handleBackdropClick} />}

      {/* ---- Post-creation schedule prompt ---- */}
      {schedPrompt && (
        <PromptOverlay>
          <PromptCard>
            <PromptTitle>Plano ativado!</PromptTitle>
            <PromptText>
              Deseja agendar as sessões de{" "}
              <strong>
                {schedPrompt.Patient
                  ? getPatientDisplayName(schedPrompt.Patient)
                  : getPatientDisplayName(patients.find((p) => p.id === schedPrompt.patient_id))}
              </strong>{" "}
              na agenda agora?
              {schedPrompt.ServicePlan?.sessions_per_week && (
                <> ({schedPrompt.ServicePlan.sessions_per_week}x/semana)</>
              )}
            </PromptText>
            <PromptActions>
              <PrimaryButton
                type="button"
                onClick={() => openSchedDrawer(schedPrompt)}
              >
                <FaCalendarAlt /> Sim, agendar sessões
              </PrimaryButton>
              <GhostButton type="button" onClick={() => setSchedPrompt(null)}>
                Depois
              </GhostButton>
            </PromptActions>
          </PromptCard>
        </PromptOverlay>
      )}

      {ppPausePlan && (
        <PromptOverlay>
          <PromptCard>
            <PromptTitle>Pausar plano mensal</PromptTitle>
            {ppPauseSummary && (
              <CancelPlanSummary>
                <strong>{ppPauseSummary.patientName}</strong>
                <span>
                  {ppPauseSummary.planName}
                  {ppPauseSummary.serviceName ? ` · ${ppPauseSummary.serviceName}` : ""}
                </span>
	                <small>
	                  As sessões futuras dentro da pausa serão suspensas na agenda.
	                </small>
	              </CancelPlanSummary>
	            )}
	            <PauseFormGrid>
	              <Field>
	                <span>Início da pausa</span>
	                <input
	                  id="pause-starts-on"
	                  type="date"
	                  value={ppPauseForm.starts_on}
	                  onChange={(event) =>
	                    setPpPauseForm((prev) => ({ ...prev, starts_on: event.target.value }))
	                  }
	                  disabled={isSaving}
	                />
	              </Field>
	              <Field>
	                <span>Fim da pausa</span>
	                <input
	                  id="pause-ends-on"
	                  type="date"
	                  value={ppPauseForm.ends_on}
	                  onChange={(event) =>
	                    setPpPauseForm((prev) => ({ ...prev, ends_on: event.target.value }))
	                  }
	                  disabled={isSaving || ppPauseForm.is_indefinite}
	                />
	              </Field>
	              <PauseCheckboxLabel>
	                <input
	                  type="checkbox"
	                  checked={ppPauseForm.is_indefinite}
	                  onChange={(event) =>
	                    setPpPauseForm((prev) => ({
	                      ...prev,
	                      is_indefinite: event.target.checked,
	                      ends_on: event.target.checked ? "" : prev.ends_on,
	                    }))
	                  }
	                  disabled={isSaving}
	                />
	                Tempo indeterminado
	              </PauseCheckboxLabel>
	              <Field>
	                <span>Motivo/observação</span>
	                <textarea
	                  id="pause-reason"
	                  value={ppPauseForm.reason}
	                  onChange={(event) =>
	                    setPpPauseForm((prev) => ({ ...prev, reason: event.target.value }))
	                  }
	                  disabled={isSaving}
	                  rows={3}
	                  placeholder="Informe o motivo da pausa"
	                />
	              </Field>
	            </PauseFormGrid>
	            <PromptActions>
              <GhostButton type="button" onClick={closePpPauseModal} disabled={isSaving}>
                Voltar
              </GhostButton>
              <PrimaryButton type="button" onClick={handlePpPauseConfirm} disabled={isSaving}>
                {isSaving ? "Pausando..." : "Confirmar pausa"}
              </PrimaryButton>
            </PromptActions>
          </PromptCard>
        </PromptOverlay>
      )}

      {ppResumePlan && (
        <PromptOverlay>
          <PromptCard>
            <PromptTitle>Retomar plano mensal</PromptTitle>
            {ppResumeSummary && (
              <CancelPlanSummary>
                <strong>{ppResumeSummary.patientName}</strong>
                <span>
                  {ppResumeSummary.planName}
                  {ppResumeSummary.serviceName ? ` · ${ppResumeSummary.serviceName}` : ""}
                </span>
                <small>
                  Ciclos mensais voltarão a ser gerados conforme a regra do plano.
                </small>
              </CancelPlanSummary>
            )}
	            <PauseFormGrid>
	              <Field>
	                <span>Data de retomada</span>
	                <input
	                  id="resume-on"
	                  type="date"
	                  value={ppResumeForm.resumes_on}
	                  onChange={(event) =>
	                    setPpResumeForm((prev) => ({ ...prev, resumes_on: event.target.value }))
	                  }
	                  disabled={isSaving}
	                />
	              </Field>
	            </PauseFormGrid>
	            <ResumePreviewPanel>
	              <ResumePreviewHeader>
	                <strong>Prévia da retomada</strong>
	                {ppResumePreviewLoading && <DataLoadingState text="Atualizando prévia..." compact />}
	              </ResumePreviewHeader>
	              {ppResumePreview?.pause && (
	                <ResumePauseSummary>
	                  Pausa ativa desde {formatDateBR(ppResumePreview.pause.starts_on)}
	                  {ppResumePreview.pause.is_indefinite
	                    ? " por tempo indeterminado"
	                    : ` até ${formatDateBR(ppResumePreview.pause.ends_on)}`}
	                </ResumePauseSummary>
	              )}
	              {!ppResumePreviewLoading && ppResumeOkSessions.length === 0 && ppResumeConflictSessions.length === 0 && (
	                <ResumePreviewEmpty>
	                  Nenhuma sessão suspensa futura a partir desta data.
	                </ResumePreviewEmpty>
	              )}
	              {ppResumeOkSessions.length > 0 && (
	                <ResumePreviewSection>
	                  <ResumePreviewSectionTitle>Sessões que podem ser retomadas</ResumePreviewSectionTitle>
	                  <ResumePreviewList>
	                    {ppResumeOkSessions.map((session) => (
	                      <ResumePreviewItem key={session.id} $tone="ok">
	                        <span>
	                          {formatDateTimeBR(session.starts_at)} — {session.service_name || "Serviço"}
	                        </span>
	                        <strong>OK</strong>
	                      </ResumePreviewItem>
	                    ))}
	                  </ResumePreviewList>
	                </ResumePreviewSection>
	              )}
	              {ppResumeConflictSessions.length > 0 && (
	                <ResumePreviewSection>
	                  <ResumePreviewSectionTitle>Sessões com conflito ou ajuste</ResumePreviewSectionTitle>
	                  <ResumePreviewList>
	                    {ppResumeConflictSessions.map((session) => (
	                      <ResumePreviewItem key={session.id} $tone="warning">
	                        <span>
	                          {formatDateTimeBR(session.starts_at)} — {session.service_name || "Serviço"}
	                        </span>
	                        <strong>{session.conflict_reason || "Precisa de revisão"}</strong>
	                      </ResumePreviewItem>
	                    ))}
	                  </ResumePreviewList>
	                </ResumePreviewSection>
	              )}
	            </ResumePreviewPanel>
            <PromptActions>
              <GhostButton type="button" onClick={closePpResumeModal} disabled={isSaving}>
                Voltar
              </GhostButton>
	              <PrimaryButton
	                type="button"
	                onClick={handlePpResumeConfirm}
	                disabled={isSaving || ppResumePreviewLoading}
	              >
                {isSaving ? "Retomando..." : "Confirmar retomada"}
              </PrimaryButton>
            </PromptActions>
          </PromptCard>
        </PromptOverlay>
      )}

      {ppCancelPlan && (
        <PromptOverlay>
          <PromptCard as="form" onSubmit={handlePpCancelSubmit}>
            <PromptTitle>Cancelar plano mensal</PromptTitle>
            {ppCancelSummary && (
              <CancelPlanSummary>
                <strong>{ppCancelSummary.patientName}</strong>
                <span>
                  {ppCancelSummary.planName}
                  {ppCancelSummary.serviceName ? ` · ${ppCancelSummary.serviceName}` : ""}
                </span>
                <small>
                  Frequência: {ppCancelSummary.frequency} · Valor: {ppCancelSummary.price}
                </small>
                <small>
                  Início: {ppCancelSummary.startsAt} · Vencimento: {ppCancelSummary.dueDay}
                </small>
              </CancelPlanSummary>
	            )}
            <InlineAlert $tone="danger">
              Sessões automáticas do plano a partir desta data serão removidas da agenda.
              Sessões anteriores não serão alteradas. O financeiro não será ajustado nesta etapa.
            </InlineAlert>
	            <Field>
              Cancelar a partir de *
              <input
                type="date"
                min={todayDateOnly()}
                value={ppCancelForm.effectiveDate}
                disabled={isSaving}
                onChange={(e) => {
                  const nextDate = e.target.value;
                  if (nextDate && nextDate < todayDateOnly()) {
                    toast.error("A data de cancelamento não pode ser anterior a hoje.");
                    setPpCancelForm((prev) => ({
                      ...prev,
                      effectiveDate: todayDateOnly(),
                    }));
                    return;
                  }
                  setPpCancelForm((prev) => ({
                    ...prev,
                    effectiveDate: nextDate,
                  }));
                }}
              />
            </Field>
            <Field>
              Motivo do cancelamento *
              <textarea
                rows={4}
	                value={ppCancelForm.reason}
	                disabled={isSaving}
	                onChange={(e) => setPpCancelForm((prev) => ({
                  ...prev,
                  reason: e.target.value,
                }))}
                placeholder="Descreva o motivo para auditoria..."
              />
            </Field>
	            <PromptActions>
              <GhostButton type="button" onClick={closePpCancelModal} disabled={isSaving}>
                Voltar
              </GhostButton>
	              <DangerButton type="submit" disabled={isSaving}>
	                {isSaving ? "Cancelando..." : "Confirmar cancelamento"}
	              </DangerButton>
            </PromptActions>
          </PromptCard>
        </PromptOverlay>
      )}

      {/* ---- Services drawer ---- */}
      <AppDrawer $open={svcDrawerOpen}>
        <DrawerHeader>
          <DrawerTitle>{svcEditingId ? "Editar Serviço" : "Novo Serviço"}</DrawerTitle>
          <DrawerCloseBtn type="button" onClick={closeSvcDrawer}>
            <FaTimes />
          </DrawerCloseBtn>
        </DrawerHeader>
        <DrawerBody>
          <form onSubmit={handleSvcSubmit}>
            <DrawerSectionTitle>Dados do serviço</DrawerSectionTitle>
            <Field>
              Nome do serviço *
              <input
                name="name"
                value={svcForm.name}
                onChange={handleSvcChange}
                placeholder="Ex: Pilates, Fisioterapia"
              />
            </Field>
            <Field>
              Duração padrão (minutos)
              <input
                name="default_duration_minutes"
                type="number"
                min="15"
                max="240"
                step="5"
                value={svcForm.default_duration_minutes}
                onChange={handleSvcChange}
              />
            </Field>
            <Field>
              Cor
              <input
                name="color"
                type="color"
                value={svcForm.color}
                onChange={handleSvcChange}
                style={{ width: 48, height: 36, padding: 2 }}
              />
            </Field>
            <DrawerSectionTitle>Atendimento por sessão</DrawerSectionTitle>
            <Field>
              Valor por sessão
              <input
                name="price"
                value={svcForm.price}
                onChange={handleSvcChange}
                placeholder="Ex: 120,00"
                inputMode="decimal"
              />
              <FieldHint>
                Deixe em branco se este serviço não for usado em atendimento por sessão.
              </FieldHint>
            </Field>
            <DrawerFooter>
              <GhostButton type="button" onClick={closeSvcDrawer}>
                Cancelar
              </GhostButton>
              <SaveBtn type="submit" disabled={isSaving}>
                {isSaving ? "Salvando..." : "Salvar"}
              </SaveBtn>
            </DrawerFooter>
          </form>
        </DrawerBody>
      </AppDrawer>

      {/* ---- Service Plan drawer ---- */}
      <AppDrawer $open={spDrawerOpen}>
        <DrawerHeader>
          <DrawerTitle>
            {spEditingId ? "Editar Plano Comercial" : "Novo Plano Comercial"}
          </DrawerTitle>
          <DrawerCloseBtn type="button" onClick={closeSpDrawer}>
            <FaTimes />
          </DrawerCloseBtn>
        </DrawerHeader>
        <DrawerBody>
          <form onSubmit={handleSpSubmit}>
            <Field>
              Serviço base *
              <select
                name="service_id"
                value={spForm.service_id}
                onChange={handleSpChange}
                disabled={!!spEditingId}
              >
                <option value="">Selecione...</option>
                {services
                  .filter((s) => s.is_active !== false)
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
              </select>
            </Field>
            <Field>
              Preço mensal (R$) *
              <input
                name="price"
                value={spForm.price}
                onChange={handleSpChange}
                placeholder="700,00"
                inputMode="decimal"
              />
              <FieldHint>Aceito: 700,00 · 1.000,00 · 1000,00 · 1000.50</FieldHint>
            </Field>
            <Field>
              Sessões por semana
              <input
                name="sessions_per_week"
                type="number"
                min="1"
                max="7"
                value={spForm.sessions_per_week}
                onChange={handleSpChange}
                placeholder="Ex: 2"
              />
              <FieldHint>Informa a frequência que aparecerá na agenda.</FieldHint>
            </Field>
            <DrawerFooter>
              <GhostButton type="button" onClick={closeSpDrawer}>
                Cancelar
              </GhostButton>
              <SaveBtn type="submit" disabled={isSaving}>
                {isSaving ? "Salvando..." : "Salvar"}
              </SaveBtn>
            </DrawerFooter>
          </form>
        </DrawerBody>
      </AppDrawer>

      {/* ---- Patient Plan drawer ---- */}
      <AppDrawer $open={ppDrawerOpen}>
        <DrawerHeader>
          <DrawerTitle>
            {ppEditingId ? "Editar Vínculo" : "Vincular Paciente ao Plano"}
          </DrawerTitle>
          <DrawerCloseBtn type="button" onClick={closePpDrawer}>
            <FaTimes />
          </DrawerCloseBtn>
        </DrawerHeader>
        <DrawerBody>
          <form onSubmit={handlePpSubmit}>
            {ppEditingStatus && (
              <StatusRow>
                <span>Status atual:</span>
                <StatusPill $tone={ppEditingStatus}>
                  {STATUS_INFO[ppEditingStatus]?.label || ppEditingStatus}
                </StatusPill>
                <StatusNote>
                  Use Pausar / Retomar / Cancelar na tabela para alterar o status.
                </StatusNote>
              </StatusRow>
            )}
            <PatientSearchField
              mode="select"
              required
              patients={patients}
              selectedPatientId={ppForm.patient_id}
              value={
                ppForm.patient_id
                  ? getPatientDisplayName(patients.find((p) => String(p.id) === String(ppForm.patient_id)))
                  : ppForm.patient_search || ""
              }
              onChange={(nextValue) => {
                setPpForm((prev) => ({
                  ...prev,
                  patient_id: "",
                  patient_search: nextValue,
                }));
              }}
              onSelect={(patient) => {
                setPpForm((prev) => ({
                  ...prev,
                  patient_id: String(patient.id),
                  patient_search: getPatientDisplayName(patient),
                }));
              }}
              disabled={!!ppEditingId}
            />
            <Field>
              Plano comercial *
              <select
                name="service_plan_id"
                value={ppForm.service_plan_id}
                onChange={handlePpChange}
              >
                <option value="">Selecione...</option>
                {activeServicePlans.map((sp) => (
                  <option key={sp.id} value={sp.id}>
                    {sp.name}
                    {sp.Service?.name ? ` (${sp.Service.name})` : ""} -{" "}
                    {formatPrice(sp.price_cents)}/mês
                  </option>
                ))}
              </select>
            </Field>
            <Field>
              Dia de vencimento *
              <select
                name="anchor_day"
                value={ppForm.anchor_day}
                onChange={handlePpChange}
              >
                <option value="">Selecione...</option>
                {ANCHOR_DAY_OPTIONS.map((day) => (
                  <option key={day} value={day}>
                    {day}
                  </option>
                ))}
              </select>
              <FieldHint>Dia do mês em que a mensalidade vence (1-31).</FieldHint>
            </Field>
            <Field>
              Data de início do plano *
              <input
                name="starts_at"
                type="date"
                value={ppForm.starts_at}
                onChange={handlePpChange}
              />
              <FieldHint>Use a data em que o plano começa para o paciente.</FieldHint>
              {ppCyclePreview && (
                <FieldHint>Ciclo inicial previsto: {ppCyclePreview}.</FieldHint>
              )}
            </Field>
            <Field>
              Observações
              <textarea
                name="notes"
                value={ppForm.notes}
                onChange={handlePpChange}
                rows={3}
              />
            </Field>
            <DrawerFooter>
              <GhostButton type="button" onClick={closePpDrawer}>
                Cancelar
              </GhostButton>
              <SaveBtn type="submit" disabled={isSaving}>
                {ppSubmitLabel}
              </SaveBtn>
            </DrawerFooter>
          </form>
        </DrawerBody>
      </AppDrawer>

      {/* ---- Schedule sessions drawer ---- */}
      <AppDrawer $open={schedDrawerOpen}>
        <DrawerHeader>
          <DrawerTitle>Agendar Sessões do Plano</DrawerTitle>
          <DrawerCloseBtn type="button" onClick={closeSchedDrawer}>
            <FaTimes />
          </DrawerCloseBtn>
        </DrawerHeader>
        <DrawerBody>
          {schedPlan && (
            <SchedPlanInfo>
              <strong>
                {schedPlan.Patient
                  ? getPatientDisplayName(schedPlan.Patient)
                  : getPatientDisplayName(patients.find((p) => p.id === schedPlan.patient_id))}
              </strong>
              <span>
                {schedPlan.ServicePlan?.name || "Plano"}
              </span>
            </SchedPlanInfo>
          )}
          <form onSubmit={handleSchedSubmit}>
            <Field>
              Profissional *
              <select
                name="professional_user_id"
                value={schedForm.professional_user_id}
                onChange={handleSchedChange}
              >
                <option value="">Selecione um profissional</option>
                {professionals.map((pr) => (
                  <option key={pr.id} value={pr.id}>
                    {pr.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field>
              Data da primeira sessão *
              <input
                name="date"
                type="date"
                value={schedForm.date}
                onChange={handleSchedChange}
              />
              <FieldHint>Somente dias úteis.</FieldHint>
            </Field>
            <Field>
              Horário *
              <select
                name="time"
                value={schedForm.time}
                onChange={handleSchedChange}
              >
                {PLAN_HOUR_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field>
              Dias da semana *
              <WeekdayPicker>
                {WEEKDAY_OPTIONS.map((opt) => {
                  const isActive = schedForm.weekdays.includes(opt.value);
                  const isDisabled = !!(
                    schedWeekdayLimit
                    && !isActive
                    && schedForm.weekdays.length >= schedWeekdayLimit
                  );
                  return (
                    <WeekdayBtn
                      key={opt.value}
                      type="button"
                      $active={isActive}
                      disabled={isDisabled}
                      onClick={() => toggleWeekday(opt.value)}
                    >
                      {opt.label}
                    </WeekdayBtn>
                  );
                })}
              </WeekdayPicker>
              {schedWeekdayLimit && (
                <FieldHint>
                  Selecione {schedWeekdayLimit} dia(s) para este plano.
                </FieldHint>
              )}
              {schedForm.weekdays.length > 0 && (
                <FieldHint>
                  {schedForm.weekdays
                    .map((d) => WEEKDAY_OPTIONS.find((o) => o.value === d)?.label)
                    .join(", ")}
                </FieldHint>
              )}
            </Field>
            <DrawerFooter>
              <GhostButton type="button" onClick={closeSchedDrawer}>
                Cancelar
              </GhostButton>
              <SaveBtn type="submit" disabled={isSaving || !isSchedFormComplete}>
                {isSaving ? "Salvando..." : "Salvar"}
              </SaveBtn>
            </DrawerFooter>
          </form>
        </DrawerBody>
      </AppDrawer>

      <SidebarShellLayout $collapsed={isSidebarCollapsed}>
        <AppSidebar $collapsed={isSidebarCollapsed} $mobileOpen={isSidebarOpen}>
          <AppSidebarHeader>
            <AppSidebarSectionTitle $collapsed={isSidebarCollapsed}>Menu</AppSidebarSectionTitle>
            <AppSidebarToggle
              type="button"
              onClick={handleSidebarToggle}
              title={sidebarToggleLabel}
              aria-label={sidebarToggleLabel}
            >
              {sidebarToggleIcon}
            </AppSidebarToggle>
          </AppSidebarHeader>

          <AppSidebarSection $collapsed={isSidebarCollapsed}>
            <AppSidebarSectionTitle $collapsed={isSidebarCollapsed}>Planos</AppSidebarSectionTitle>
            <AppSidebarButton
              type="button"
              $active={activeTab === "patient-plans"}
              $collapsed={isSidebarCollapsed}
              onClick={() => handleSectionChange("patient-plans")}
              title="Pacientes com plano"
            >
              <AppSidebarIcon $active={activeTab === "patient-plans"}>
                <FaUsers />
              </AppSidebarIcon>
              <AppSidebarLabel $collapsed={isSidebarCollapsed}>Pacientes com plano</AppSidebarLabel>
            </AppSidebarButton>
          </AppSidebarSection>

          <AppSidebarSection $collapsed={isSidebarCollapsed}>
            <AppSidebarSectionTitle $collapsed={isSidebarCollapsed}>Configurações</AppSidebarSectionTitle>
            <AppSidebarButton
              type="button"
              $active={activeTab === "service-plans"}
              $collapsed={isSidebarCollapsed}
              onClick={() => handleSectionChange("service-plans")}
              title="Planos mensais"
            >
              <AppSidebarIcon $active={activeTab === "service-plans"}>
                <FaLayerGroup />
              </AppSidebarIcon>
              <AppSidebarLabel $collapsed={isSidebarCollapsed}>Planos mensais</AppSidebarLabel>
            </AppSidebarButton>
            <AppSidebarButton
              type="button"
              $active={activeTab === "services"}
              $collapsed={isSidebarCollapsed}
              onClick={() => handleSectionChange("services")}
              title="Serviços"
            >
              <AppSidebarIcon $active={activeTab === "services"}>
                <FaTags />
              </AppSidebarIcon>
              <AppSidebarLabel $collapsed={isSidebarCollapsed}>Serviços</AppSidebarLabel>
            </AppSidebarButton>
          </AppSidebarSection>
        </AppSidebar>

        <SidebarMainArea>
          <Header>
            <HeaderText>
              <Title>{activeSectionInfo.title}</Title>
              {activeSectionInfo.subtitle && <Subtitle>{activeSectionInfo.subtitle}</Subtitle>}
            </HeaderText>
            <MobileMenuButton type="button" onClick={openSidebar}>
              <FaBars />
              Menu
            </MobileMenuButton>
          </Header>

          {isPatientPlanDetailPage && (
            <ModuleBody>
              {ppDetailError && !ppDetailLoading && (
                <DataLoadingState tone="error" compact>
                  {ppDetailError}
                </DataLoadingState>
              )}
              {!ppDetailError && (
                <PlanDetailPage>
                  <PlanDetailHero>
                    <PlanDetailTitleGroup>
                      <PlanDetailEyebrow>Plano do paciente</PlanDetailEyebrow>
                      <PlanDetailPatient>
                        {isPpDetailDataLoading ? "-" : ppDetailSummary?.patientName || "-"}
                      </PlanDetailPatient>
                      <PlanDetailSubtitle>
                        {isPpDetailDataLoading ? "-" : (
                          <>
                            {ppDetailSummary?.planName || "-"}
                            {ppDetailSummary?.serviceName ? ` · ${ppDetailSummary.serviceName}` : ""}
                          </>
                        )}
                      </PlanDetailSubtitle>
	                      <PlanDetailBadges>
	                        {!isPpDetailDataLoading && (
	                          <>
	                            <StatusPill $tone={ppDetailStatus?.tone}>
	                              {ppDetailStatus?.label || "-"}
	                            </StatusPill>
	                            <StatusPill $tone={ppDetailAgenda?.tone}>
	                              {ppDetailAgenda?.label || "-"}
	                            </StatusPill>
	                          </>
		                        )}
		                      </PlanDetailBadges>
	                      {ppDetailPauseInfo && (
	                        <PlanDetailPauseNote>{ppDetailPauseInfo}</PlanDetailPauseNote>
	                      )}
	                    </PlanDetailTitleGroup>
                    <PlanDetailTopActions>
                      {ppDetailAgendaActions}
                      {ppDetailPlan?.status === "active" && (
		                        <GhostButton
	                          type="button"
	                          onClick={() => handlePpPause(ppDetailPlan)}
	                          disabled={ppDetailEditing || isPpStatusActionBusy}
	                        >
                          Pausar plano
                        </GhostButton>
                      )}
	                      {!ppDetailEditing && ppDetailPlan?.status === "paused" && (
		                        <GhostButton
		                          type="button"
		                          onClick={() => handlePpResume(ppDetailPlan)}
	                          disabled={ppDetailEditing || isPpStatusActionBusy}
	                        >
	                          Retomar plano
	                        </GhostButton>
	                      )}
	                      {!ppDetailEditing && ppDetailPlan && ppDetailPlan.status !== "canceled" && (
		                        <DangerButton
		                          type="button"
		                          onClick={() => handlePpCancel(ppDetailPlan)}
	                          disabled={ppDetailEditing || isPpStatusActionBusy}
	                        >
                          Cancelar plano
                        </DangerButton>
                      )}
                    </PlanDetailTopActions>
                  </PlanDetailHero>

                  <PlanDetailSection $editing={ppDetailEditing}>
                    <PlanDetailSectionHeader>
                      <PlanDetailsBlockTitle>Resumo do plano</PlanDetailsBlockTitle>
	                      <PlanDetailsActions>
                        {ppDetailEditActions}
                      </PlanDetailsActions>
                    </PlanDetailSectionHeader>
                    {isPpDetailDataLoading && (
                      <PlanBlockLoading>
                        <DataLoadingState text="Carregando dados do plano..." compact />
                      </PlanBlockLoading>
                    )}
                    <PlanSummaryList>
                      <PlanSummaryItem>
                        <PlanSummaryLabel>Plano comercial</PlanSummaryLabel>
                        <PlanSummaryValue>
                        {ppDetailEditing ? (
                          <PlanDetailField
                            as="select"
                            name="service_plan_id"
                            value={ppDetailEditForm.service_plan_id}
                            onChange={handlePpDetailEditChange}
                          >
                            <option value="">Selecione...</option>
                            {ppDetailPlanOptions.map((sp) => (
                              <option key={sp.id} value={sp.id}>
                                {sp.name}
                                {sp.Service?.name ? ` (${sp.Service.name})` : ""}
                              </option>
                            ))}
                          </PlanDetailField>
                        ) : (
                          ppDetailText(ppDetailSummary?.planName)
                        )}
                        </PlanSummaryValue>
                      </PlanSummaryItem>
                      <PlanSummaryItem>
                        <PlanSummaryLabel>Frequência</PlanSummaryLabel>
                        <PlanSummaryValue>
                          {ppDetailEditing
                            ? <strong>{ppDetailEditingFrequency}</strong>
                            : ppDetailText(ppDetailSummary?.frequency)}
                        </PlanSummaryValue>
                      </PlanSummaryItem>
                      <PlanSummaryItem>
                        <PlanSummaryLabel>Data de início</PlanSummaryLabel>
                        <PlanSummaryValue>
                        {ppDetailEditing ? (
                          <PlanDetailField
                            name="starts_at"
                            type="date"
                            $compact
                            value={ppDetailEditForm.starts_at}
                            onChange={handlePpDetailEditChange}
                          />
                        ) : (
                          ppDetailText(ppDetailSummary?.startsAt)
                        )}
                        </PlanSummaryValue>
                      </PlanSummaryItem>
                      <PlanSummaryItem>
                        <PlanSummaryLabel>Dia de vencimento</PlanSummaryLabel>
                        <PlanSummaryValue>
                        {ppDetailEditing ? (
                          <PlanDetailField
                            as="select"
                            name="anchor_day"
                            $compact
                            value={ppDetailEditForm.anchor_day}
                            onChange={handlePpDetailEditChange}
                          >
                            <option value="">Selecione...</option>
                            {ANCHOR_DAY_OPTIONS.map((day) => (
                              <option key={day} value={day}>
                                {day}
                              </option>
                            ))}
                          </PlanDetailField>
                        ) : (
                          ppDetailText(ppDetailSummary?.dueDay)
                        )}
                        </PlanSummaryValue>
                      </PlanSummaryItem>
                      <PlanSummaryItem>
                        <PlanSummaryLabel>Profissional</PlanSummaryLabel>
                        <PlanSummaryValue>
                          {ppDetailEditing && ppDetailAgenda?.seriesId ? (
                            <PlanDetailField
                              as="select"
                              name="professional_user_id"
                              value={ppDetailEditForm.professional_user_id}
                              onChange={handlePpDetailEditChange}
                            >
                              <option value="">Selecione um profissional</option>
                              {professionals.map((pr) => (
                                <option key={pr.id} value={pr.id}>
                                  {pr.name}
                                </option>
                              ))}
                            </PlanDetailField>
                          ) : (
                            ppDetailText(ppDetailAgenda?.professionalName)
                          )}
                        </PlanSummaryValue>
                      </PlanSummaryItem>
                      <PlanSummaryItem>
                        <PlanSummaryLabel>Dias da semana</PlanSummaryLabel>
                        <PlanSummaryValue>
                          {ppDetailEditing && ppDetailAgenda?.seriesId ? (
                            <>
                              <WeekdayPicker>
                                {WEEKDAY_OPTIONS.map((opt) => {
                                  const selectedWeekdays = ppDetailEditForm.weekdays || [];
                                  const isActive = selectedWeekdays.includes(opt.value);
                                  const isDisabled = !!(
                                    ppDetailWeekdayLimit
                                    && !isActive
                                    && selectedWeekdays.length >= ppDetailWeekdayLimit
                                  );
                                  return (
                                    <WeekdayBtn
                                      key={opt.value}
                                      type="button"
                                      $active={isActive}
                                      disabled={isDisabled}
                                      onClick={() => togglePpDetailWeekday(opt.value)}
                                    >
                                      {opt.label}
                                    </WeekdayBtn>
                                  );
                                })}
                              </WeekdayPicker>
                              {ppDetailWeekdayLimit && (
                                <FieldHint>
                                  Selecione {ppDetailWeekdayLimit} dia(s) para este plano.
                                </FieldHint>
                              )}
                            </>
                          ) : (
                            ppDetailText(ppDetailAgenda?.weekdayText)
                          )}
                        </PlanSummaryValue>
                      </PlanSummaryItem>
                      <PlanSummaryItem>
                        <PlanSummaryLabel>Horário</PlanSummaryLabel>
                        <PlanSummaryValue>
                          {ppDetailEditing && ppDetailAgenda?.seriesId ? (
                            <PlanDetailField
                              as="select"
                              name="time"
                              $compact
                              value={ppDetailEditForm.time}
                              onChange={handlePpDetailEditChange}
                            >
                              {PLAN_HOUR_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </PlanDetailField>
                          ) : (
                            ppDetailText(ppDetailAgenda?.timeText)
                          )}
                        </PlanSummaryValue>
                      </PlanSummaryItem>
                      <PlanSummaryItem>
                        <PlanSummaryLabel>Observações</PlanSummaryLabel>
                        <PlanSummaryValue>
                        {ppDetailEditing ? (
                        <PlanDetailField
                          as="textarea"
                          name="notes"
                          value={ppDetailEditForm.notes}
                          onChange={handlePpDetailEditChange}
                          rows={3}
                        />
                        ) : (
                          ppDetailText(String(ppDetailPlan?.notes || "").trim())
                        )}
                        </PlanSummaryValue>
                      </PlanSummaryItem>
                    </PlanSummaryList>
                  </PlanDetailSection>
                </PlanDetailPage>
              )}
            </ModuleBody>
          )}

          {/* ---- Patient Plans tab ---- */}
          {activeTab === "patient-plans" && !isPatientPlanDetailPage && (
            <ModuleBody>
              <AppToolbar>
                <AppToolbarLeft>
                  <PatientSearchField
                    mode="filter"
                    value={ppPatientSearch}
                    onChange={(value) => {
                      setPpFocusedPlanId("");
                      setPpPatientSearch(value);
                    }}
                  />
                  <ToolbarFilterField>
                    <span>Status</span>
	                    <select
	                      value={ppFilterStatus}
	                      onChange={(e) => setPpFilterStatus(e.target.value)}
	                    >
	                      <option value="">Todos os status</option>
	                      <option value="active">Ativo</option>
	                      <option value="paused">Pausado</option>
	                      <option value="canceled">Cancelado</option>
	                    </select>
                  </ToolbarFilterField>
                </AppToolbarLeft>
                <PrimaryButton type="button" onClick={openPpCreate}>
                  <FaPlus /> Adicionar Paciente
                </PrimaryButton>
              </AppToolbar>

              <TableWrap>
                <DataTable>
                  <thead>
                    <tr>
                      <TH>Paciente</TH>
                      <TH>Plano</TH>
                      <TH>Frequência</TH>
                      <TH>Agenda</TH>
                      <TH>Status</TH>
                      <ActionTH>Detalhes</ActionTH>
                    </tr>
                  </thead>
                  <tbody>
                    {isPatientPlansLoading && (
                      <tr>
                        <td colSpan={6}>
                          <DataLoadingState text="Carregando pacientes com plano..." compact />
                        </td>
                      </tr>
                    )}
                    {!isPatientPlansLoading && patientPlansError && (
                      <tr>
                        <td colSpan={6}>
                          <DataLoadingState tone="error" compact>
                            {patientPlansError}
                          </DataLoadingState>
                        </td>
                      </tr>
                    )}
                    {!isPatientPlansLoading && !patientPlansError && displayedPatientPlans.length === 0 && (
                      <tr>
                        <td colSpan={6}>
                          <Empty>Nenhum vínculo encontrado.</Empty>
                        </td>
                      </tr>
                    )}
                    {!isPatientPlansLoading && !patientPlansError && displayedPatientPlans.map((pp) => {
                      const si = getPatientPlanStatusInfo(pp);
                      const freqLabel = pp.ServicePlan?.sessions_per_week
                        ? `${pp.ServicePlan.sessions_per_week}x/sem`
                        : pp.ServicePlan?.frequency_label || "-";
                      const agendaInfo = getPatientPlanAgendaInfo(pp, professionals);
                      return (
                        <tr key={pp.id}>
                          <TD>
                            <strong>
                              {pp.Patient ? getPatientDisplayName(pp.Patient) : "-"}
                            </strong>
                          </TD>
                          <TD>{pp.ServicePlan?.name || "-"}</TD>
                          <TD>{freqLabel}</TD>
                          <TD>
                            <StatusPill $tone={agendaInfo.tone}>{agendaInfo.label}</StatusPill>
                          </TD>
                          <TD>
                            <StatusPill $tone={si.tone}>{si.label}</StatusPill>
                          </TD>
                          <ActionTD>
                            <RowActionButton type="button" onClick={() => openPpDetails(pp)}>
                              Detalhes
                            </RowActionButton>
                          </ActionTD>
                        </tr>
                      );
                    })}
                  </tbody>
                </DataTable>
              </TableWrap>
            </ModuleBody>
          )}

          {/* ---- Service Plans tab ---- */}
          {activeTab === "service-plans" && !isPatientPlanDetailPage && (
            <ModuleBody>
              <AppToolbar>
                <AppToolbarLeft>
                  <select
                    value={spFilterServiceId}
                    onChange={(e) => setSpFilterServiceId(e.target.value)}
                  >
                    <option value="">Todos os serviços</option>
                    {services.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </AppToolbarLeft>
                <PrimaryButton type="button" onClick={openSpCreate}>
                  <FaPlus /> Novo Plano
                </PrimaryButton>
              </AppToolbar>

              <TableWrap>
                <DataTable>
                  <thead>
                    <tr>
                      <TH>Nome</TH>
                      <TH>Serviço</TH>
                      <TH>Frequência</TH>
                      <TH>Preço/mês</TH>
                      <TH>Status</TH>
                      <TH>Ações</TH>
                    </tr>
                  </thead>
                  <tbody>
                    {isServicePlansLoading && (
                      <tr>
                        <td colSpan={6}>
                          <DataLoadingState text="Carregando planos mensais..." compact />
                        </td>
                      </tr>
                    )}
                    {!isServicePlansLoading && servicePlansError && (
                      <tr>
                        <td colSpan={6}>
                          <DataLoadingState tone="error" compact>
                            {servicePlansError}
                          </DataLoadingState>
                        </td>
                      </tr>
                    )}
                    {!isServicePlansLoading && !servicePlansError && filteredServicePlans.length === 0 && (
                      <tr>
                        <td colSpan={6}>
                          <Empty>Nenhum plano encontrado.</Empty>
                        </td>
                      </tr>
                    )}
                    {!isServicePlansLoading && !servicePlansError && filteredServicePlans.map((sp) => (
                      <tr key={sp.id}>
                        <TD>
                          <strong>{sp.name}</strong>
                        </TD>
                        <TD>{sp.Service?.name || "-"}</TD>
                        <TD>
                          {sp.frequency_label ||
                            (sp.sessions_per_week
                              ? `${sp.sessions_per_week}x/sem`
                              : "-")}
                        </TD>
                        <TD>{formatPrice(sp.price_cents)}</TD>
                        <TD>
                          <StatusPill $tone={sp.is_active ? "active" : "canceled"}>
                            {sp.is_active ? "Ativo" : "Inativo"}
                          </StatusPill>
                        </TD>
                        <TD>
                          <RowActions>
                            <RowActionButton
                              type="button"
                              onClick={() => openSpEdit(sp)}
                            >
                              Editar
                            </RowActionButton>
                            {sp.is_active && (
                              <DangerButton
                                type="button"
                                onClick={() => handleSpDeactivate(sp)}
                              >
                                Inativar
                              </DangerButton>
                            )}
                          </RowActions>
                        </TD>
                      </tr>
                    ))}
                  </tbody>
                </DataTable>
              </TableWrap>
            </ModuleBody>
          )}

          {/* ---- Services tab ---- */}
          {activeTab === "services" && !isPatientPlanDetailPage && (
            <ModuleBody>
              <AppToolbar>
                <AppToolbarLeft />
                <PrimaryButton type="button" onClick={openSvcCreate}>
                  <FaPlus /> Novo Serviço
                </PrimaryButton>
              </AppToolbar>

              <TableWrap>
                <DataTable>
                  <thead>
                    <tr>
                      <TH>Cor</TH>
                      <TH>Nome</TH>
                      <TH>Duração padrão</TH>
                      <TH>Valor por sessão</TH>
                      <TH>Status</TH>
                      <TH>Ações</TH>
                    </tr>
                  </thead>
                  <tbody>
                    {isServicesLoading && (
                      <tr>
                        <td colSpan={6}>
                          <DataLoadingState text="Carregando serviços..." compact />
                        </td>
                      </tr>
                    )}
                    {!isServicesLoading && servicesError && (
                      <tr>
                        <td colSpan={6}>
                          <DataLoadingState tone="error" compact>
                            {servicesError}
                          </DataLoadingState>
                        </td>
                      </tr>
                    )}
                    {!isServicesLoading && !servicesError && services.length === 0 && (
                      <tr>
                        <td colSpan={6}>
                          <Empty>Nenhum serviço cadastrado.</Empty>
                        </td>
                      </tr>
                    )}
                    {!isServicesLoading && !servicesError && services.map((svc) => {
                      const activePrice = servicePriceMap.get(svc.id);
                      return (
                        <tr key={svc.id}>
                          <TD>
                            <ServiceColorDot style={{ background: svc.color || "#6a795c" }} />
                          </TD>
                          <TD>
                            <strong>{svc.name}</strong>
                          </TD>
                          <TD>
                            {svc.default_duration_minutes
                              ? `${svc.default_duration_minutes} min`
                              : "-"}
                          </TD>
                          <TD>{activePrice ? formatPrice(activePrice.price_cents) : "-"}</TD>
                          <TD>
                            <StatusPill $tone={svc.is_active !== false ? "active" : "canceled"}>
                              {svc.is_active !== false ? "Ativo" : "Inativo"}
                            </StatusPill>
                          </TD>
                          <TD>
                            <RowActions>
                              <RowActionButton
                                type="button"
                                onClick={() => openSvcEdit(svc)}
                              >
                                Editar
                              </RowActionButton>
                              <RowActionButton
                                type="button"
                                onClick={() => handleSvcToggle(svc)}
                              >
                                {svc.is_active !== false ? "Inativar" : "Ativar"}
                              </RowActionButton>
                            </RowActions>
                          </TD>
                        </tr>
                      );
                    })}
                  </tbody>
                </DataTable>
              </TableWrap>
            </ModuleBody>
          )}
        </SidebarMainArea>
      </SidebarShellLayout>

      {isMobile && isSidebarOpen && <AppSidebarOverlay onClick={closeSidebar} />}
    </SidebarShellWrapper>
  );
}

// ---------------------------------------------------------------------------
// Styled components
// ---------------------------------------------------------------------------

const Header = styled.div`
  margin-bottom: 4px;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;

  @media (max-width: 960px) {
    align-items: center;
  }
`;

const HeaderText = styled.div`
  min-width: 0;
`;

const Title = styled.h1`
  margin: 0 0 8px;
  color: #2b2b2b;
  font-size: 28px;
`;

const Subtitle = styled.p`
  margin: 0;
  color: #606060;
  font-size: 15px;
`;

const MobileMenuButton = styled.button`
  display: none;
  align-items: center;
  gap: 8px;
  border: 1px solid rgba(106, 121, 92, 0.22);
  border-radius: 10px;
  background: #fff;
  color: #3d5230;
  padding: 9px 12px;
  font-weight: 700;
  cursor: pointer;

  @media (max-width: 960px) {
    display: inline-flex;
  }
`;

const ToolbarFilterField = styled.label`
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 160px;
  color: #354a2c;
  font-size: 0.92rem;
  font-weight: 700;

  select {
    min-height: 40px;
  }
`;

const ActionTH = styled(TH)`
  text-align: right;
`;

const ActionTD = styled(TD)`
  text-align: right;
`;

const RowActions = styled.div`
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
`;

const DrawerSectionTitle = styled.h3`
  margin: 18px 0 10px;
  color: #354a2c;
  font-size: 0.86rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;

  &:first-child {
    margin-top: 0;
  }
`;

const PlanDetailPage = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
`;

const PlanDetailHero = styled.section`
  align-items: flex-start;
  border: 1px solid rgba(106, 121, 92, 0.16);
  border-radius: 14px;
  background: #fbfcf8;
  display: flex;
  justify-content: space-between;
  gap: 16px;
  padding: 18px;

  @media (max-width: 760px) {
    flex-direction: column;
  }
`;

const PlanDetailTitleGroup = styled.div`
  min-width: 0;
`;

const PlanDetailEyebrow = styled.span`
  color: #6a795c;
  display: block;
  font-size: 0.72rem;
  font-weight: 900;
  letter-spacing: 0.05em;
  margin-bottom: 6px;
  text-transform: uppercase;
`;

const PlanDetailPatient = styled.h2`
  color: #1b1b1b;
  font-size: clamp(1.35rem, 2vw, 2rem);
  line-height: 1.15;
  margin: 0;
`;

const PlanDetailSubtitle = styled.p`
  color: #526247;
  font-size: 0.98rem;
  font-weight: 700;
  margin: 8px 0 0;
`;

const PlanDetailBadges = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 12px;
`;

const PlanDetailTopActions = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: flex-end;

  @media (max-width: 760px) {
    justify-content: flex-start;
  }
`;

const PlanDetailSection = styled.section`
  border: ${(props) => (props.$editing ? "2px" : "1px")} solid
    ${(props) => (props.$editing ? "rgba(190, 92, 92, 0.58)" : "rgba(106, 121, 92, 0.18)")};
  border-radius: 16px;
  background: ${(props) => (props.$editing ? "#fffdf7" : "#fff")};
  box-shadow: ${(props) => (
    props.$editing
      ? "0 0 0 4px rgba(190, 92, 92, 0.08), 0 14px 30px rgba(190, 92, 92, 0.08)"
      : "0 10px 24px rgba(0, 0, 0, 0.05)"
  )};
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 18px;
`;

const PlanDetailSectionHeader = styled.div`
  align-items: center;
  display: flex;
  gap: 12px;
  justify-content: space-between;
  margin-bottom: 4px;

  @media (max-width: 640px) {
    flex-direction: column;
  }
`;

const PlanSummaryList = styled.div`
  display: grid;
  gap: 8px;
`;

const PlanSummaryItem = styled.div`
  align-items: start;
  border-bottom: 1px solid rgba(106, 121, 92, 0.12);
  display: grid;
  gap: 8px;
  grid-template-columns: minmax(170px, 260px) minmax(0, 1fr);
  min-width: 0;
  padding-bottom: 6px;

  &:last-child {
    border-bottom: 0;
  }

  strong {
    color: #1b1b1b;
    display: block;
    font-size: 0.96rem;
    font-weight: 800;
    overflow-wrap: anywhere;
  }

  @media (max-width: 640px) {
    grid-template-columns: 1fr;
    gap: 6px;
  }
`;

const PlanSummaryLabel = styled.span`
  color: #55644c;
  display: block;
  font-size: 0.87rem;
  font-weight: 700;
`;

const PlanSummaryValue = styled.div`
  color: #2d3629;
  font-size: 0.92rem;
  line-height: 1.4;
  min-width: 0;
  overflow: hidden;
  white-space: pre-wrap;
  width: 100%;
  word-break: break-word;
`;

const PlanBlockLoading = styled.div`
  align-items: center;
  display: flex;
  justify-content: center;
  min-height: 44px;
`;

const PlanDetailField = styled.input`
  border: 1px solid rgba(106, 121, 92, 0.22);
  border-radius: 10px;
  background: #fff;
  box-sizing: border-box;
  color: #1b1b1b;
  display: block;
  font: inherit;
  font-size: 0.92rem;
  font-weight: 700;
  max-width: ${(props) => (props.$compact ? "220px" : "100%")};
  min-height: 38px;
  padding: 7px 11px;
  width: ${(props) => (props.$compact ? "220px" : "100%")};

  &:focus {
    border-color: rgba(106, 121, 92, 0.55);
    box-shadow: 0 0 0 3px rgba(106, 121, 92, 0.12);
    outline: none;
  }

  &[as="textarea"],
  textarea& {
    min-height: 74px;
    resize: vertical;
  }
`;

const PlanDetailPauseNote = styled.div`
  color: #7a5a18;
  font-size: 0.88rem;
  font-weight: 700;
`;

const PlanDetailsBlockTitle = styled.h3`
  margin: 0;
  color: #354a2c;
  font-size: 0.82rem;
  font-weight: 900;
  letter-spacing: 0.04em;
  text-transform: uppercase;
`;

const PlanDetailsActions = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;

  ${PlanDetailSectionHeader} & {
    justify-content: flex-end;
  }
`;

const Empty = styled.div`
  padding: 32px;
  text-align: center;
  color: #aaa;
  font-size: 0.9rem;
`;

const SaveBtn = styled(PrimaryButton)`
  padding: 9px 22px;
  font-size: 0.9rem;
`;

const StatusRow = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  padding: 10px 12px;
  background: #f9faf6;
  border-radius: 8px;
  border: 1px solid rgba(106, 121, 92, 0.14);
  margin-bottom: 16px;
  font-size: 0.85rem;
  color: #555;
`;

const StatusNote = styled.span`
  font-size: 0.77rem;
  color: #aaa;
  flex-basis: 100%;
`;

const ServiceColorDot = styled.div`
  width: 18px;
  height: 18px;
  border-radius: 50%;
  display: inline-block;
`;

const WeekdayPicker = styled.div`
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  margin-top: 6px;
`;

const WeekdayBtn = styled.button`
  padding: 5px 10px;
  border-radius: 6px;
  border: 1px solid ${({ $active }) => ($active ? "#6a795c" : "#d4d8ce")};
  background: ${({ $active }) => ($active ? "#6a795c" : "#fff")};
  color: ${({ $active }) => ($active ? "#fff" : "#555")};
  font-size: 0.82rem;
  font-weight: ${({ $active }) => ($active ? "700" : "400")};
  cursor: pointer;
  transition: all 0.15s;

  &:disabled {
    cursor: not-allowed;
    opacity: 0.45;
  }
`;

const SchedPlanInfo = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 12px 14px;
  background: #f0f3ec;
  border-radius: 8px;
  border: 1px solid rgba(106, 121, 92, 0.18);
  margin-bottom: 18px;
  font-size: 0.9rem;
  color: #3d4a35;

  strong {
    font-size: 1rem;
  }

  span {
    color: #6a795c;
    font-weight: 600;
  }
`;

const PromptOverlay = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1200;
`;

const PromptCard = styled.div`
  background: #fff;
  border-radius: 16px;
  padding: 32px 28px;
  max-width: 560px;
  width: 90%;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.18);
`;

const PromptTitle = styled.h2`
  font-size: 1.2rem;
  font-weight: 800;
  color: #3d4a35;
  margin: 0 0 10px;
`;

const PromptText = styled.p`
  font-size: 0.95rem;
  color: #555;
  margin: 0 0 22px;
  line-height: 1.5;
`;

const CancelPlanSummary = styled.div`
  margin: 2px 0 18px;
  padding: 12px;
  border: 1px solid rgba(106, 121, 92, 0.18);
  border-radius: 8px;
  background: #f6f8f4;
  color: #2f3d2a;
  display: flex;
  flex-direction: column;
  gap: 5px;

  strong {
    font-size: 1rem;
  }

  span {
    font-size: 0.92rem;
    font-weight: 600;
  }

  small {
    color: #687263;
    font-size: 0.82rem;
  }
`;

const InlineAlert = styled.div`
  margin: 0 0 16px;
  padding: 10px 12px;
  border-radius: 8px;
  border: 1px solid rgba(197, 95, 64, 0.28);
  background: rgba(197, 95, 64, 0.08);
  color: #8a3b20;
  font-size: 0.86rem;
  line-height: 1.45;
`;

const PauseFormGrid = styled.div`
  display: grid;
  gap: 14px;
  margin: 0 0 22px;

  ${Field} {
    margin: 0;
  }

  textarea {
    border: 1px solid rgba(106, 121, 92, 0.22);
    border-radius: 10px;
    box-sizing: border-box;
    color: #1b1b1b;
    font: inherit;
    min-height: 84px;
    padding: 10px 12px;
    resize: vertical;
    width: 100%;
  }
`;

const PauseCheckboxLabel = styled.label`
  align-items: center;
  color: #516046;
  display: inline-flex;
  font-size: 0.92rem;
  font-weight: 700;
  gap: 8px;

  input {
    accent-color: #6a795c;
    height: 16px;
    width: 16px;
  }
`;

const ResumePreviewPanel = styled.div`
  background: #f8faf6;
  border: 1px solid rgba(106, 121, 92, 0.16);
  border-radius: 12px;
  display: grid;
  gap: 12px;
  margin: 0 0 22px;
  padding: 14px;
`;

const ResumePreviewHeader = styled.div`
  align-items: center;
  display: flex;
  gap: 10px;
  justify-content: space-between;

  strong {
    color: #2f3d2a;
    font-size: 0.95rem;
    font-weight: 900;
  }
`;

const ResumePauseSummary = styled.div`
  color: #65715d;
  font-size: 0.86rem;
  font-weight: 700;
`;

const ResumePreviewSection = styled.div`
  display: grid;
  gap: 8px;
`;

const ResumePreviewSectionTitle = styled.div`
  color: #4d5d44;
  font-size: 0.82rem;
  font-weight: 900;
`;

const ResumePreviewList = styled.div`
  display: grid;
  gap: 6px;
`;

const ResumePreviewItem = styled.div`
  align-items: center;
  background: ${(props) => (props.$tone === "warning" ? "#fff5ed" : "#f1f7ee")};
  border: 1px solid ${(props) => (props.$tone === "warning"
    ? "rgba(198, 104, 44, 0.24)"
    : "rgba(106, 121, 92, 0.18)")};
  border-radius: 10px;
  color: #293225;
  display: flex;
  gap: 10px;
  justify-content: space-between;
  padding: 9px 10px;

  span {
    font-size: 0.86rem;
    line-height: 1.35;
  }

  strong {
    color: ${(props) => (props.$tone === "warning" ? "#a6451c" : "#3f6d37")};
    font-size: 0.78rem;
    font-weight: 900;
    white-space: nowrap;
  }
`;

const ResumePreviewEmpty = styled.div`
  border: 1px dashed rgba(106, 121, 92, 0.22);
  border-radius: 10px;
  color: #6f7869;
  font-size: 0.88rem;
  padding: 12px;
  text-align: center;
`;

const PromptActions = styled.div`
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
`;
