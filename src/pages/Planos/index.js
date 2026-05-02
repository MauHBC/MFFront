import React, { useCallback, useEffect, useMemo, useState } from "react";
import styled from "styled-components";
import { toast } from "react-toastify";
import {
  FaBars,
  FaCalendarAlt,
  FaChevronLeft,
  FaEllipsisV,
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

const formatDateBR = (value) => {
  if (!value) return "-";
  const s = String(value).slice(0, 10);
  const [y, m, d] = s.split("-");
  return d && m && y ? `${d}/${m}/${y}` : s;
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
  pp?.Patient?.full_name || pp?.Patient?.name || "";

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
  pp?.status === "active"
  && !!pp?.ends_at
  && String(pp.ends_at).slice(0, 10) >= todayDateOnly()
  && !!String(pp?.cancellation_reason || "").trim()
);

const getPatientPlanStatusInfo = (pp) => {
  if (isPlanCancellationProgrammed(pp)) {
    return {
      label: `Cancelamento programado · ativo até ${formatDateBR(pp.ends_at)}`,
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
};

const makeEmptyPpForm = () => ({
  ...EMPTY_PP,
  starts_at: todayDateOnly(),
});

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
  effectiveMode: "today",
  effectiveDate: todayDateOnly(),
  reason: "",
};

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
  const [ppFilterStatus, setPpFilterStatus] = useState("active");
  const [ppDrawerOpen, setPpDrawerOpen] = useState(false);
  const [ppEditingId, setPpEditingId] = useState(null);
  const [ppEditingStatus, setPpEditingStatus] = useState(null);
  const [ppForm, setPpForm] = useState(makeEmptyPpForm);
  const [ppCancelPlan, setPpCancelPlan] = useState(null);
  const [ppCancelForm, setPpCancelForm] = useState(EMPTY_CANCEL);
  const [openPpActionMenuId, setOpenPpActionMenuId] = useState(null);
  const [ppActionMenuPosition, setPpActionMenuPosition] = useState(null);

  // Schedule sessions drawer (open from PatientPlan row)
  const [schedDrawerOpen, setSchedDrawerOpen] = useState(false);
  const [schedPlan, setSchedPlan] = useState(null); // the PatientPlan being scheduled
  const [schedForm, setSchedForm] = useState(EMPTY_SCHED);

  // Post-creation prompt: ask user to schedule after vincular
  const [schedPrompt, setSchedPrompt] = useState(null); // PatientPlan object

  // ---- Data loading ----

  const loadServices = useCallback(async () => {
    setIsServicesLoading(true);
    setServicesError("");
    try {
      const [servicesRes, pricesRes] = await Promise.all([
        axios.get("/services"),
        listServicePrices(),
      ]);
      setServices(Array.isArray(servicesRes.data) ? servicesRes.data : []);
      setServicePrices(Array.isArray(pricesRes.data) ? pricesRes.data : []);
    } catch (err) {
      const message = err?.response?.data?.error || "Erro ao carregar serviços.";
      setServicesError(message);
      toast.error(message);
    } finally {
      setIsServicesLoading(false);
    }
  }, []);

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

  useEffect(() => {
    loadBaseData();
    loadServicePlans();
  }, [loadBaseData, loadServicePlans]);

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
    if (typeof window === "undefined") return () => {};
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
    if (!openPpActionMenuId) return undefined;
    const closeMenu = () => {
      setOpenPpActionMenuId(null);
      setPpActionMenuPosition(null);
    };
    window.addEventListener("click", closeMenu);
    return () => window.removeEventListener("click", closeMenu);
  }, [openPpActionMenuId]);

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
        if (!needle) return true;
        return getPatientSearchText(pp?.Patient).includes(needle);
      })
      .sort(comparePatientPlans);
  }, [patientPlans, ppPatientSearch]);

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
    const duration = Number(schedForm.duration_minutes);
    const hasProfessional = !!schedForm.professional_user_id;
    const hasRequiredDate = !!schedForm.date && !isWeekendDateOnly(schedForm.date);
    const hasRequiredTime = !!schedForm.time;
    const hasValidDuration = Number.isFinite(duration) && duration >= 15;
    const hasRequiredWeekdays = schedWeekdayLimit
      ? schedForm.weekdays.length === schedWeekdayLimit
      : schedForm.weekdays.length > 0;
    return hasProfessional
      && hasRequiredDate
      && hasRequiredTime
      && hasValidDuration
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
        toast.error("Informe um valor avulso maior que zero ou deixe em branco.");
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
          await axios.put(`/services/${svcEditingId}`, payload);
          toast.success("Serviço atualizado.");
        } else {
          const existingCodes = new Set(services.map((s) => s.code));
          let code = slugify(svcForm.name);
          if (existingCodes.has(code)) code = `${code}_${Date.now()}`;
          const response = await axios.post("/services", { ...payload, code });
          serviceId = response?.data?.id || null;
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
            if (existingPrice) {
              await updateServicePrice(existingPrice.id, pricePayload);
            } else {
              await createServicePrice(pricePayload);
            }
          } else if (existingPrice?.is_active !== false) {
            await updateServicePrice(existingPrice.id, {
              service_id: serviceId,
              price_cents: 0,
              currency: existingPrice.currency || "BRL",
              is_active: false,
            });
          }
        }

        closeSvcDrawer();
        await loadServices();
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
      loadServices,
    ],
  );

  const handleSvcToggle = useCallback(
    async (svc) => {
      try {
        await axios.put(`/services/${svc.id}`, { is_active: !svc.is_active });
        toast.success(svc.is_active ? "Serviço inativado." : "Serviço ativado.");
        await loadServices();
      } catch (err) {
        toast.error(err?.response?.data?.error || "Erro ao alterar serviço.");
      }
    },
    [loadServices],
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

  const openPpEdit = useCallback((pp) => {
    if (pp.status === "canceled") {
      toast.error("Vínculos cancelados não podem ser editados.");
      return;
    }
    setPpEditingId(pp.id);
    setPpEditingStatus(pp.status);
    setPpForm({
      patient_id: String(pp.patient_id || ""),
      service_plan_id: String(pp.service_plan_id || ""),
      anchor_day: String(pp.anchor_day || ""),
      starts_at: pp.starts_at ? String(pp.starts_at).slice(0, 10) : "",
      ends_at: pp.ends_at ? String(pp.ends_at).slice(0, 10) : "",
      notes: pp.notes || "",
    });
    setPpDrawerOpen(true);
  }, []);

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
        toast.error("Informe a data de inicio do plano.");
        return;
      }
      if (!isValidDateOnly(ppForm.starts_at)) {
        toast.error("Informe uma data de inicio valida.");
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
    [ppForm, ppEditingId, closePpDrawer, loadPatientPlans, activeServicePlans],
  );

  const handlePpPause = useCallback(
    async (pp) => {
      // eslint-disable-next-line no-alert
      const ok = window.confirm("Pausar este plano?\n\nCiclos mensais não serão gerados enquanto pausado.");
      if (!ok) return;
      try {
        await pausePatientPlan(pp.id);
        toast.success("Plano pausado.");
        await loadPatientPlans();
      } catch (err) {
        toast.error(err?.response?.data?.error || "Erro ao pausar plano.");
      }
    },
    [loadPatientPlans],
  );

  const handlePpResume = useCallback(
    async (pp) => {
      try {
        await resumePatientPlan(pp.id);
        toast.success("Plano retomado.");
        await loadPatientPlans();
      } catch (err) {
        toast.error(err?.response?.data?.error || "Erro ao retomar plano.");
      }
    },
    [loadPatientPlans],
  );


  const handlePpCancel = useCallback((pp) => {
    setPpCancelPlan(pp);
    setPpCancelForm({
      ...EMPTY_CANCEL,
      effectiveDate: todayDateOnly(),
    });
  }, []);

  const closePpCancelModal = useCallback(() => {
    setPpCancelPlan(null);
    setPpCancelForm(EMPTY_CANCEL);
  }, []);

  const handlePpCancelSubmit = useCallback(
    async (e) => {
      e.preventDefault();
      if (!ppCancelPlan) return;

      const effectiveDate = ppCancelForm.effectiveMode === "today"
        ? todayDateOnly()
        : ppCancelForm.effectiveDate;
      if (!effectiveDate) {
        toast.error("Informe ate quando o plano ficara ativo.");
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
      } catch (err) {
        toast.error(err?.response?.data?.error || "Erro ao cancelar vínculo.");
      } finally {
        setIsSaving(false);
      }
    },
    [ppCancelPlan, ppCancelForm, closePpCancelModal, loadPatientPlans],
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
      toast.error("Escolha um dia util para a primeira sessao.");
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
        toast.error("Escolha um dia util para a primeira sessao.");
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
      } catch (err) {
        const msg = err?.response?.data?.error || "Erro ao criar agendamentos.";
        toast.error(msg);
      } finally {
        setIsSaving(false);
      }
    },
    [schedPlan, schedForm, schedWeekdayLimit, closeSchedDrawer, loadPatientPlans],
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
      setActiveTab(section);
      setOpenPpActionMenuId(null);
      setPpActionMenuPosition(null);
      if (isMobile) {
        closeSidebar();
      }
    },
    [closeSidebar, isMobile],
  );

  const closePpActionMenu = useCallback(() => {
    setOpenPpActionMenuId(null);
    setPpActionMenuPosition(null);
  }, []);

  const togglePpActionMenu = useCallback((event, ppId) => {
    event.stopPropagation();
    if (openPpActionMenuId === ppId) {
      closePpActionMenu();
      return;
    }

    const rect = event.currentTarget.getBoundingClientRect();
    const menuWidth = 168;
    const menuHeight = 190;
    const gap = 8;
    const viewportWidth = window.innerWidth || document.documentElement.clientWidth;
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
    const opensUp = rect.bottom + gap + menuHeight > viewportHeight && rect.top > menuHeight;
    const top = opensUp
      ? Math.max(gap, rect.top - menuHeight - gap)
      : Math.min(rect.bottom + gap, viewportHeight - menuHeight - gap);
    const left = Math.min(
      Math.max(gap, rect.right - menuWidth),
      viewportWidth - menuWidth - gap,
    );

    setPpActionMenuPosition({ top, left, opensUp });
    setOpenPpActionMenuId(ppId);
  }, [closePpActionMenu, openPpActionMenuId]);

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
      subtitle: "Configure serviços, duração, cor e valor avulso.",
    },
  }[activeTab] || {
    title: "Serviços e Planos",
    subtitle: "Cadastro de serviços, valores e planos mensais.",
  };

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
                {schedPrompt.Patient?.full_name ||
                  patients.find((p) => p.id === schedPrompt.patient_id)?.full_name ||
                  "paciente"}
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
            <Field>
              Plano ativo até quando?
              <ModeToggle>
                <ModeBtn
                  type="button"
                  $active={ppCancelForm.effectiveMode === "today"}
                  onClick={() => setPpCancelForm((prev) => ({
                    ...prev,
                    effectiveMode: "today",
                    effectiveDate: todayDateOnly(),
                  }))}
                >
                  Hoje
                </ModeBtn>
                <ModeBtn
                  type="button"
                  $active={ppCancelForm.effectiveMode === "custom"}
                  onClick={() => setPpCancelForm((prev) => ({
                    ...prev,
                    effectiveMode: "custom",
                  }))}
                >
                  Escolher data
                </ModeBtn>
              </ModeToggle>
            </Field>
            {ppCancelForm.effectiveMode === "custom" && (
              <Field>
                Data final *
                <input
                  type="date"
                  min={todayDateOnly()}
                  value={ppCancelForm.effectiveDate}
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
            )}
            <Field>
              Motivo do cancelamento *
              <textarea
                rows={4}
                value={ppCancelForm.reason}
                onChange={(e) => setPpCancelForm((prev) => ({
                  ...prev,
                  reason: e.target.value,
                }))}
                placeholder="Descreva o motivo para auditoria..."
              />
            </Field>
            <PromptActions>
              <GhostButton type="button" onClick={closePpCancelModal}>
                Voltar
              </GhostButton>
              <DangerButton type="submit" disabled={isSaving}>
                Confirmar cancelamento
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
            <DrawerSectionTitle>Atendimento avulso</DrawerSectionTitle>
            <Field>
              Valor avulso
              <input
                name="price"
                value={svcForm.price}
                onChange={handleSvcChange}
                placeholder="Ex: 120,00"
                inputMode="decimal"
              />
              <FieldHint>
                Deixe em branco se este serviço não for usado em atendimento avulso.
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
                {schedPlan.Patient?.full_name ||
                  patients.find((p) => p.id === schedPlan.patient_id)?.full_name ||
                  "Paciente"}
              </strong>
              <span>
                {schedPlan.ServicePlan?.name || "Plano"}
                {schedPlan.ServicePlan?.sessions_per_week
                  ? ` · ${schedPlan.ServicePlan.sessions_per_week}x/sem`
                  : ""}
              </span>
              <SchedPlanNote>
                As sessões criadas serão vinculadas automaticamente ao plano mensal (cobertas pela mensalidade).
              </SchedPlanNote>
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
              <input
                name="time"
                type="time"
                value={schedForm.time}
                onChange={handleSchedChange}
              />
            </Field>
            <Field>
              Duração (minutos)
              <input
                name="duration_minutes"
                type="number"
                min="15"
                max="240"
                step="5"
                value={schedForm.duration_minutes}
                onChange={handleSchedChange}
              />
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
              <Subtitle>{activeSectionInfo.subtitle}</Subtitle>
            </HeaderText>
            <MobileMenuButton type="button" onClick={openSidebar}>
              <FaBars />
              Menu
            </MobileMenuButton>
          </Header>

        {/* ---- Patient Plans tab ---- */}
        {activeTab === "patient-plans" && (
          <ModuleBody>
            <AppToolbar>
              <AppToolbarLeft>
                <PatientSearchField
                  mode="filter"
                  value={ppPatientSearch}
                  onChange={setPpPatientSearch}
                />
                <ToolbarFilterField>
                  <span>Status</span>
                  <select
                    value={ppFilterStatus}
                    onChange={(e) => setPpFilterStatus(e.target.value)}
                  >
                    <option value="active">Ativo</option>
                    <option value="canceled">Cancelado</option>
                    <option value="">Todos os status</option>
                    <option value="paused">Pausado</option>
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
                    <TH>Vencimento</TH>
                    <TH>Início</TH>
                    <TH>Profissional</TH>
                    <TH>Dias</TH>
                    <TH>Status</TH>
                    <ActionTH>Ações</ActionTH>
                  </tr>
                </thead>
                <tbody>
                  {isPatientPlansLoading && (
                    <tr>
                      <td colSpan={9}>
                        <DataLoadingState text="Carregando pacientes com plano..." compact />
                      </td>
                    </tr>
                  )}
                  {!isPatientPlansLoading && patientPlansError && (
                    <tr>
                      <td colSpan={9}>
                        <DataLoadingState tone="error" compact>
                          {patientPlansError}
                        </DataLoadingState>
                      </td>
                    </tr>
                  )}
                  {!isPatientPlansLoading && !patientPlansError && displayedPatientPlans.length === 0 && (
                    <tr>
                      <td colSpan={9}>
                        <Empty>Nenhum vínculo encontrado.</Empty>
                      </td>
                    </tr>
                  )}
                  {!isPatientPlansLoading && !patientPlansError && displayedPatientPlans.map((pp) => {
                    const si = getPatientPlanStatusInfo(pp);
                    const freqLabel = pp.ServicePlan?.sessions_per_week
                      ? `${pp.ServicePlan.sessions_per_week}x/sem`
                      : pp.ServicePlan?.frequency_label || "-";
                    const scheduleInfo = getPatientPlanScheduleInfo(pp, professionals);
                    return (
                      <tr key={pp.id}>
                        <TD>
                          <strong>
                            {pp.Patient?.full_name || pp.Patient?.name || "-"}
                          </strong>
                        </TD>
                        <TD>{pp.ServicePlan?.name || "-"}</TD>
                        <TD>{freqLabel}</TD>
                        <TD>Dia {pp.anchor_day}</TD>
                        <TD>{formatDateBR(pp.starts_at)}</TD>
                        <TD>{scheduleInfo.professionalName}</TD>
                        <TD>{scheduleInfo.weekdayText}</TD>
                        <TD>
                          <StatusPill $tone={si.tone}>{si.label}</StatusPill>
                        </TD>
                        <ActionTD>
                          <ActionMenuWrap>
                            <ActionMenuButton
                              type="button"
                              title="Ações do plano"
                              aria-label="Ações do plano"
                              onClick={(event) => togglePpActionMenu(event, pp.id)}
                            >
                              <FaEllipsisV />
                            </ActionMenuButton>
                          </ActionMenuWrap>
                          {openPpActionMenuId === pp.id && ppActionMenuPosition && (
                            <ActionMenuList
                              style={{
                                top: ppActionMenuPosition.top,
                                left: ppActionMenuPosition.left,
                              }}
                              onClick={(event) => event.stopPropagation()}
                            >
                            {pp.status === "active" && (
                              <ActionMenuItem
                                type="button"
                                title="Agendar sessões deste plano na agenda"
                                onClick={() => {
                                  closePpActionMenu();
                                  openSchedDrawer(pp);
                                }}
                              >
                                <FaCalendarAlt /> Agendar
                              </ActionMenuItem>
                            )}
                            {pp.status !== "canceled" && (
                              <ActionMenuItem
                                type="button"
                                onClick={() => {
                                  closePpActionMenu();
                                  openPpEdit(pp);
                                }}
                              >
                                Editar
                              </ActionMenuItem>
                            )}
                            {pp.status === "active" && (
                              <ActionMenuItem
                                type="button"
                                onClick={() => {
                                  closePpActionMenu();
                                  handlePpPause(pp);
                                }}
                              >
                                Pausar
                              </ActionMenuItem>
                            )}
                            {pp.status === "paused" && (
                              <ActionMenuItem
                                type="button"
                                onClick={() => {
                                  closePpActionMenu();
                                  handlePpResume(pp);
                                }}
                              >
                                Retomar
                              </ActionMenuItem>
                            )}
                            {pp.status !== "canceled" && (
                              <ActionMenuDangerItem
                                type="button"
                                onClick={() => {
                                  closePpActionMenu();
                                  handlePpCancel(pp);
                                }}
                              >
                                Cancelar
                              </ActionMenuDangerItem>
                            )}
                            </ActionMenuList>
                          )}
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
        {activeTab === "service-plans" && (
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
        {activeTab === "services" && (
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
                    <TH>Valor avulso</TH>
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

const ActionMenuWrap = styled.div`
  display: inline-flex;
  justify-content: flex-end;
`;

const ActionMenuButton = styled.button`
  width: 32px;
  height: 32px;
  border: 1px solid rgba(106, 121, 92, 0.24);
  border-radius: 8px;
  background: #fff;
  color: #3d5230;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background 0.12s;

  &:hover {
    background: rgba(106, 121, 92, 0.08);
  }
`;

const ActionMenuList = styled.div`
  position: fixed;
  z-index: 3000;
  width: 168px;
  padding: 6px;
  border: 1px solid rgba(106, 121, 92, 0.16);
  border-radius: 8px;
  background: #fff;
  box-shadow: 0 10px 28px rgba(0, 0, 0, 0.12);
  display: flex;
  flex-direction: column;
  gap: 2px;
`;

const ActionMenuItem = styled.button`
  width: 100%;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: #3d5230;
  padding: 8px 10px;
  display: inline-flex;
  align-items: center;
  gap: 7px;
  text-align: left;
  font-size: 0.84rem;
  font-weight: 600;
  cursor: pointer;

  &:hover {
    background: rgba(106, 121, 92, 0.08);
  }
`;

const ActionMenuDangerItem = styled(ActionMenuItem)`
  color: #992222;

  &:hover {
    background: rgba(200, 70, 70, 0.07);
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

const ModeToggle = styled.div`
  display: flex;
  gap: 4px;
  margin-top: 6px;
`;

const ModeBtn = styled.button`
  padding: 5px 12px;
  border-radius: 6px;
  border: 1px solid ${({ $active }) => ($active ? "#6a795c" : "#d4d8ce")};
  background: ${({ $active }) => ($active ? "#6a795c" : "#fff")};
  color: ${({ $active }) => ($active ? "#fff" : "#555")};
  font-size: 0.82rem;
  cursor: pointer;
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

const SchedPlanNote = styled.p`
  font-size: 0.77rem;
  color: #888;
  margin: 4px 0 0;
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
  max-width: 440px;
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

const PromptActions = styled.div`
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
`;

