import React, { useCallback, useEffect, useMemo, useState } from "react";
import styled from "styled-components";
import { toast } from "react-toastify";
import { FaCalendarAlt, FaPlus, FaTimes } from "react-icons/fa";

import Loading from "../../components/Loading";
import { PageWrapper, PageContent } from "../../components/AppLayout";
import {
  ModuleHeader,
  ModuleTitle,
  ModuleTabs,
  ModuleTabButton,
  ModuleBody,
} from "../../components/AppModuleShell";
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
  listPatientPlans,
  createPatientPlan,
  updatePatientPlan,
  pausePatientPlan,
  resumePatientPlan,
  cancelPatientPlan,
} from "../../services/financial";
import axios from "../../services/axios";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const WEEKDAY_OPTIONS = [
  { value: 1, label: "Seg" },
  { value: 2, label: "Ter" },
  { value: 3, label: "Qua" },
  { value: 4, label: "Qui" },
  { value: 5, label: "Sex" },
  { value: 6, label: "Sáb" },
  { value: 7, label: "Dom" },
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

const dateOnlyDay = (value) => {
  const match = String(value || "").match(/^\d{4}-\d{2}-(\d{2})$/);
  if (!match) return null;
  return Number(match[1]);
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
  return [
    String(nextYear).padStart(4, "0"),
    String(nextMonth).padStart(2, "0"),
    String(day).padStart(2, "0"),
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

const slugify = (name) =>
  String(name || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40) || `svc_${Date.now()}`;

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

const EMPTY_SVC = {
  name: "",
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
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Base data
  const [services, setServices] = useState([]);
  const [patients, setPatients] = useState([]);
  const [professionals, setProfessionals] = useState([]);
  const [servicePlans, setServicePlans] = useState([]);

  // Services tab
  const [svcDrawerOpen, setSvcDrawerOpen] = useState(false);
  const [svcEditingId, setSvcEditingId] = useState(null);
  const [svcForm, setSvcForm] = useState(EMPTY_SVC);

  // Service Plans tab
  const [spFilterServiceId, setSpFilterServiceId] = useState("");
  const [spDrawerOpen, setSpDrawerOpen] = useState(false);
  const [spEditingId, setSpEditingId] = useState(null);
  const [spForm, setSpForm] = useState(EMPTY_SP);

  // Patient Plans tab
  const [patientPlans, setPatientPlans] = useState([]);
  const [ppFilterPatientId, setPpFilterPatientId] = useState("");
  const [ppFilterStatus, setPpFilterStatus] = useState("active");
  const [ppDrawerOpen, setPpDrawerOpen] = useState(false);
  const [ppEditingId, setPpEditingId] = useState(null);
  const [ppEditingStatus, setPpEditingStatus] = useState(null);
  const [ppForm, setPpForm] = useState(EMPTY_PP);

  // Schedule sessions drawer (open from PatientPlan row)
  const [schedDrawerOpen, setSchedDrawerOpen] = useState(false);
  const [schedPlan, setSchedPlan] = useState(null); // the PatientPlan being scheduled
  const [schedForm, setSchedForm] = useState(EMPTY_SCHED);

  // Post-creation prompt: ask user to schedule after vincular
  const [schedPrompt, setSchedPrompt] = useState(null); // PatientPlan object

  // ---- Data loading ----

  const loadServices = useCallback(async () => {
    try {
      const res = await axios.get("/services");
      setServices(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      toast.error(err?.response?.data?.error || "Erro ao carregar serviços.");
    }
  }, []);

  const loadBaseData = useCallback(async () => {
    try {
      const [servicesRes, patientsRes, profsRes] = await Promise.all([
        axios.get("/services"),
        axios.get("/patients"),
        axios.get("/users", { params: { group: PROFESSIONAL_GROUP_SLUG } }),
      ]);
      setServices(Array.isArray(servicesRes.data) ? servicesRes.data : []);
      setPatients(Array.isArray(patientsRes.data) ? patientsRes.data : []);
      setProfessionals(Array.isArray(profsRes.data) ? profsRes.data : []);
    } catch (err) {
      toast.error(err?.response?.data?.error || "Erro ao carregar dados base.");
    }
  }, []);

  const loadServicePlans = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await listServicePlans({});
      setServicePlans(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      toast.error(err?.response?.data?.error || "Erro ao carregar planos comerciais.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadPatientPlans = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = {};
      if (ppFilterPatientId) params.patient_id = ppFilterPatientId;
      if (ppFilterStatus) params.status = ppFilterStatus;
      const res = await listPatientPlans(params);
      setPatientPlans(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      toast.error(err?.response?.data?.error || "Erro ao carregar vínculos.");
    } finally {
      setIsLoading(false);
    }
  }, [ppFilterPatientId, ppFilterStatus]);

  useEffect(() => {
    loadBaseData();
    loadServicePlans();
  }, [loadBaseData, loadServicePlans]);

  useEffect(() => {
    if (activeTab === "patient-plans") loadPatientPlans();
  }, [activeTab, loadPatientPlans]);

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

  const ppCyclePreview = useMemo(() => {
    if (!ppForm.starts_at) return null;
    const startDay = dateOnlyDay(ppForm.starts_at);
    if (!startDay || startDay < 1 || startDay > 28) return null;
    const nextCycleStart = addOneMonthDateOnly(ppForm.starts_at);
    const cycleEnd = subtractOneDayDateOnly(nextCycleStart);
    if (!nextCycleStart || !cycleEnd) return null;
    return `${formatDateBR(ppForm.starts_at)} a ${formatDateBR(cycleEnd)}`;
  }, [ppForm.starts_at]);

  // ---- Services handlers ----

  const openSvcCreate = useCallback(() => {
    setSvcEditingId(null);
    setSvcForm(EMPTY_SVC);
    setSvcDrawerOpen(true);
  }, []);

  const openSvcEdit = useCallback((svc) => {
    setSvcEditingId(svc.id);
    setSvcForm({
      name: svc.name || "",
      color: svc.color || "#6a795c",
      default_duration_minutes: svc.default_duration_minutes || 60,
    });
    setSvcDrawerOpen(true);
  }, []);

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
      setIsSaving(true);
      try {
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
          await axios.post("/services", { ...payload, code });
          toast.success("Serviço criado.");
        }
        closeSvcDrawer();
        await loadServices();
      } catch (err) {
        toast.error(err?.response?.data?.error || "Erro ao salvar serviço.");
      } finally {
        setIsSaving(false);
      }
    },
    [svcForm, svcEditingId, services, closeSvcDrawer, loadServices],
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
    setPpForm(EMPTY_PP);
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
    setPpForm(EMPTY_PP);
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
      const startDay = dateOnlyDay(ppForm.starts_at);
      const anchor = Number(ppForm.anchor_day);
      if (!ppForm.anchor_day || Number.isNaN(anchor) || anchor < 1 || anchor > 28) {
        toast.error("Dia de vencimento deve ser entre 1 e 28.");
        return;
      }
      if (!ppForm.starts_at) {
        toast.error("Informe a data de inicio do plano.");
        return;
      }
      if (!startDay || startDay < 1 || startDay > 28) {
        toast.error("Para manter ciclos mensais consistentes, a data de inicio deve cair entre os dias 1 e 28.");
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

  const handlePpCancel = useCallback(
    async (pp) => {
      const patientName = pp.Patient?.full_name || pp.Patient?.name || "este paciente";
      const planName = pp.ServicePlan?.name || "este plano";
      // eslint-disable-next-line no-alert
      const ok = window.confirm(`Cancelar o vínculo de "${patientName}" com "${planName}"?\n\nEsta ação não pode ser desfeita.`);
      if (!ok) return;
      try {
        await cancelPatientPlan(pp.id);
        toast.success("Vínculo cancelado.");
        await loadPatientPlans();
      } catch (err) {
        toast.error(err?.response?.data?.error || "Erro ao cancelar vínculo.");
      }
    },
    [loadPatientPlans],
  );

  // ---- Schedule sessions handlers ----

  const openSchedDrawer = useCallback((pp) => {
    const sp = pp.ServicePlan;
    const suggestedCount = sp?.sessions_per_week
      ? sp.sessions_per_week * 4
      : 8;
    setSchedPlan(pp);
    setSchedForm({
      ...EMPTY_SCHED,
      date: todayDateOnly(),
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
    setSched(name, type === "checkbox" ? checked : value);
  }, []);

  const toggleWeekday = useCallback((day) => {
    setSchedForm((prev) => {
      const next = prev.weekdays.includes(day)
        ? prev.weekdays.filter((d) => d !== day)
        : [...prev.weekdays, day].sort((a, b) => a - b);
      return { ...prev, weekdays: next };
    });
  }, []);

  const handleSchedSubmit = useCallback(
    async (e) => {
      e.preventDefault();
      if (!schedPlan) return;

      if (!schedForm.date) {
        toast.error("Informe a data da primeira sessão.");
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
        schedForm.use_count &&
        (!schedForm.occurrence_count || Number(schedForm.occurrence_count) < 1)
      ) {
        toast.error("Informe a quantidade de sessões.");
        return;
      }
      if (!schedForm.use_count && !schedForm.until_date) {
        toast.error("Informe a data de término.");
        return;
      }

      const startsAt = `${schedForm.date}T${schedForm.time}:00`;
      const sp = schedPlan.ServicePlan;
      const serviceId = sp?.service_id || schedPlan.service_id;

      const payload = {
        patient_id: schedPlan.patient_id,
        service_id: serviceId,
        professional_user_id: schedForm.professional_user_id
          ? Number(schedForm.professional_user_id)
          : undefined,
        starts_at: startsAt,
        duration_minutes: Number(schedForm.duration_minutes) || 60,
        repeat_interval: 7,
        weekdays: schedForm.weekdays,
        billing_mode: "covered_by_plan",
      };

      if (schedForm.use_count) {
        payload.occurrence_count = Number(schedForm.occurrence_count);
      } else {
        payload.until_date = schedForm.until_date;
      }

      setIsSaving(true);
      try {
        const res = await axios.post("/session-series", payload);
        const count = res.data?.total_created ?? res.data?.total_sessions ?? "?";
        toast.success(`${count} sessão(ões) criada(s) na agenda!`);
        closeSchedDrawer();
      } catch (err) {
        const msg = err?.response?.data?.error || "Erro ao criar agendamentos.";
        toast.error(msg);
      } finally {
        setIsSaving(false);
      }
    },
    [schedPlan, schedForm, closeSchedDrawer],
  );

  // ---- Drawer visibility ----

  const anyDrawerOpen = svcDrawerOpen || spDrawerOpen || ppDrawerOpen || schedDrawerOpen;

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

  return (
    <PageWrapper>
      <Loading isLoading={isLoading} />

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
            <Field>
              Paciente *
              <select
                name="patient_id"
                value={ppForm.patient_id}
                onChange={handlePpChange}
                disabled={!!ppEditingId}
              >
                <option value="">Selecione...</option>
                {patients.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.full_name || p.name}
                  </option>
                ))}
              </select>
            </Field>
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
                    {sp.Service?.name ? ` (${sp.Service.name})` : ""} —{" "}
                    {formatPrice(sp.price_cents)}/mês
                  </option>
                ))}
              </select>
            </Field>
            <Field>
              Dia de vencimento *
              <input
                name="anchor_day"
                type="number"
                min="1"
                max="28"
                value={ppForm.anchor_day}
                onChange={handlePpChange}
                placeholder="Ex: 10"
              />
              <FieldHint>Dia do mês em que a mensalidade vence (1–28).</FieldHint>
            </Field>
            <Field>
              Data de início do plano *
              <input
                name="starts_at"
                type="date"
                value={ppForm.starts_at}
                onChange={handlePpChange}
              />
              <FieldHint>Use um dia entre 1 e 28 para ciclos mensais consistentes.</FieldHint>
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
                placeholder="Opcional..."
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
              Profissional
              <select
                name="professional_user_id"
                value={schedForm.professional_user_id}
                onChange={handleSchedChange}
              >
                <option value="">Sem profissional definido</option>
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
                {WEEKDAY_OPTIONS.map((opt) => (
                  <WeekdayBtn
                    key={opt.value}
                    type="button"
                    $active={schedForm.weekdays.includes(opt.value)}
                    onClick={() => toggleWeekday(opt.value)}
                  >
                    {opt.label}
                  </WeekdayBtn>
                ))}
              </WeekdayPicker>
              {schedForm.weekdays.length > 0 && (
                <FieldHint>
                  {schedForm.weekdays
                    .map((d) => WEEKDAY_OPTIONS.find((o) => o.value === d)?.label)
                    .join(", ")}
                </FieldHint>
              )}
            </Field>
            <Field>
              Término por
              <ModeToggle>
                <ModeBtn
                  type="button"
                  $active={schedForm.use_count}
                  onClick={() => setSched("use_count", true)}
                >
                  Nº de sessões
                </ModeBtn>
                <ModeBtn
                  type="button"
                  $active={!schedForm.use_count}
                  onClick={() => setSched("use_count", false)}
                >
                  Data limite
                </ModeBtn>
              </ModeToggle>
            </Field>
            {schedForm.use_count ? (
              <Field>
                Quantidade de sessões *
                <input
                  name="occurrence_count"
                  type="number"
                  min="1"
                  max="200"
                  value={schedForm.occurrence_count}
                  onChange={handleSchedChange}
                  placeholder="Ex: 8"
                />
                {schedPlan?.ServicePlan?.sessions_per_week && (
                  <FieldHint>
                    Sugestão: {schedPlan.ServicePlan.sessions_per_week}x/sem × 4 semanas ={" "}
                    {schedPlan.ServicePlan.sessions_per_week * 4} sessões/mês
                  </FieldHint>
                )}
              </Field>
            ) : (
              <Field>
                Data de término *
                <input
                  name="until_date"
                  type="date"
                  value={schedForm.until_date}
                  onChange={handleSchedChange}
                />
              </Field>
            )}
            <DrawerFooter>
              <GhostButton type="button" onClick={closeSchedDrawer}>
                Cancelar
              </GhostButton>
              <SaveBtn type="submit" disabled={isSaving}>
                {isSaving ? "Criando..." : "Criar sessões na agenda"}
              </SaveBtn>
            </DrawerFooter>
          </form>
        </DrawerBody>
      </AppDrawer>

      <PageContent>
        <ModuleHeader>
          <ModuleTitle>Planos Mensais</ModuleTitle>
        </ModuleHeader>

        <ModuleTabs>
          <ModuleTabButton
            type="button"
            $active={activeTab === "patient-plans"}
            onClick={() => setActiveTab("patient-plans")}
          >
            Planos de Pacientes
          </ModuleTabButton>
          <ModuleTabButton
            type="button"
            $active={activeTab === "service-plans"}
            onClick={() => setActiveTab("service-plans")}
          >
            Planos Comerciais
          </ModuleTabButton>
          <ModuleTabButton
            type="button"
            $active={activeTab === "services"}
            onClick={() => setActiveTab("services")}
          >
            Serviços
          </ModuleTabButton>
        </ModuleTabs>

        {/* ---- Patient Plans tab ---- */}
        {activeTab === "patient-plans" && (
          <ModuleBody>
            <AppToolbar>
              <AppToolbarLeft>
                <select
                  value={ppFilterPatientId}
                  onChange={(e) => setPpFilterPatientId(e.target.value)}
                >
                  <option value="">Todos os pacientes</option>
                  {patients.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.full_name || p.name}
                    </option>
                  ))}
                </select>
                <select
                  value={ppFilterStatus}
                  onChange={(e) => setPpFilterStatus(e.target.value)}
                >
                  <option value="">Todos os status</option>
                  <option value="active">Ativo</option>
                  <option value="paused">Pausado</option>
                  <option value="canceled">Cancelado</option>
                </select>
              </AppToolbarLeft>
              <PrimaryButton type="button" onClick={openPpCreate}>
                <FaPlus /> Vincular Paciente
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
                    <TH>Status</TH>
                    <TH>Ações</TH>
                  </tr>
                </thead>
                <tbody>
                  {patientPlans.length === 0 && (
                    <tr>
                      <td colSpan={7}>
                        <Empty>Nenhum vínculo encontrado.</Empty>
                      </td>
                    </tr>
                  )}
                  {patientPlans.map((pp) => {
                    const si = STATUS_INFO[pp.status] || {
                      label: pp.status,
                      tone: pp.status,
                    };
                    const freqLabel = pp.ServicePlan?.sessions_per_week
                      ? `${pp.ServicePlan.sessions_per_week}x/sem`
                      : pp.ServicePlan?.frequency_label || "-";
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
                        <TD>
                          <StatusPill $tone={pp.status}>{si.label}</StatusPill>
                        </TD>
                        <TD>
                          <RowActions>
                            {pp.status === "active" && (
                              <RowActionButton
                                type="button"
                                title="Agendar sessões deste plano na agenda"
                                onClick={() => openSchedDrawer(pp)}
                              >
                                <FaCalendarAlt /> Agendar
                              </RowActionButton>
                            )}
                            {pp.status !== "canceled" && (
                              <RowActionButton
                                type="button"
                                onClick={() => openPpEdit(pp)}
                              >
                                Editar
                              </RowActionButton>
                            )}
                            {pp.status === "active" && (
                              <RowActionButton
                                type="button"
                                onClick={() => handlePpPause(pp)}
                              >
                                Pausar
                              </RowActionButton>
                            )}
                            {pp.status === "paused" && (
                              <RowActionButton
                                type="button"
                                onClick={() => handlePpResume(pp)}
                              >
                                Retomar
                              </RowActionButton>
                            )}
                            {pp.status !== "canceled" && (
                              <DangerButton
                                type="button"
                                onClick={() => handlePpCancel(pp)}
                              >
                                Cancelar
                              </DangerButton>
                            )}
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
                  {filteredServicePlans.length === 0 && (
                    <tr>
                      <td colSpan={6}>
                        <Empty>Nenhum plano encontrado.</Empty>
                      </td>
                    </tr>
                  )}
                  {filteredServicePlans.map((sp) => (
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
                    <TH>Status</TH>
                    <TH>Ações</TH>
                  </tr>
                </thead>
                <tbody>
                  {services.length === 0 && (
                    <tr>
                      <td colSpan={5}>
                        <Empty>Nenhum serviço cadastrado.</Empty>
                      </td>
                    </tr>
                  )}
                  {services.map((svc) => (
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
                  ))}
                </tbody>
              </DataTable>
            </TableWrap>
          </ModuleBody>
        )}
      </PageContent>
    </PageWrapper>
  );
}

// ---------------------------------------------------------------------------
// Styled components
// ---------------------------------------------------------------------------

const RowActions = styled.div`
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
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

const PromptActions = styled.div`
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
`;
