import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import styled, { css } from "styled-components";
import { toast } from "react-toastify";
import { FaInfoCircle, FaListAlt, FaPhoneAlt, FaTimes, FaUserAlt } from "react-icons/fa";

import DataLoadingState from "../../components/DataLoadingState";
import axios from "../../services/axios";
import { PageWrapper, PageContent } from "../../components/AppLayout";
import { LinkGhostButton } from "../../components/AppButton";
import {
  ModuleHeader,
  ModuleTitle,
} from "../../components/AppModuleShell";
import {
  calculateAgeFromBirthDate,
  formatBirthDateForApi,
  formatBirthDateForDisplay,
  formatBirthDateForInput,
  isBirthDateFilled,
  isBirthDateValid,
  maskBirthDateInput,
} from "../../utils/birthDate";
import { getPatientDisplayName } from "../../utils/patientSearch";

const TABS = {
  resumo: "resumo",
  historico: "historico",
  dados: "dados",
};

const EDIT_SECTIONS = {
  personal: "personal",
  contact: "contact",
  address: "address",
  emergency: "emergency",
  clinical: "clinical",
  consent: "consent",
};

const SEX_OPTIONS = [
  { value: "", label: "Selecionar" },
  { value: "F", label: "Feminino" },
  { value: "M", label: "Masculino" },
];

const MARITAL_STATUS_OPTIONS = [
  { value: "", label: "Selecionar" },
  { value: "Solteiro(a)", label: "Solteiro(a)" },
  { value: "Casado(a)", label: "Casado(a)" },
  { value: "Uniao estavel", label: "Uniao estavel" },
  { value: "Divorciado(a)", label: "Divorciado(a)" },
  { value: "Viuvo(a)", label: "Viuvo(a)" },
  { value: "Outro", label: "Outro" },
];

const REFERRAL_SOURCE_OPTIONS = [
  { value: "", label: "Selecionar" },
  { value: "Instagram", label: "Instagram" },
  { value: "WhatsApp", label: "WhatsApp" },
  { value: "Medico", label: "Medico" },
  { value: "Amigo", label: "Amigo" },
  { value: "Outro", label: "Outro" },
];

const ATTENTION_LEVEL_OPTIONS = [
  { value: "", label: "Selecionar" },
  { value: "low", label: "Baixa" },
  { value: "medium", label: "Média" },
  { value: "high", label: "Alta" },
];

const ATTENTION_LEVEL_LABELS = {
  low: "Baixa",
  medium: "Média",
  high: "Alta",
};

const ATTENTION_LEVEL_STYLES = {
  default: {
    color: "#55644c",
    border: "rgba(106, 121, 92, 0.22)",
    background: "#fff",
  },
  low: {
    color: "#4f7c42",
    border: "rgba(79, 124, 66, 0.34)",
    background: "rgba(79, 124, 66, 0.09)",
  },
  medium: {
    color: "#a56a00",
    border: "rgba(165, 106, 0, 0.34)",
    background: "rgba(165, 106, 0, 0.1)",
  },
  high: {
    color: "#c53b32",
    border: "rgba(197, 59, 50, 0.34)",
    background: "rgba(197, 59, 50, 0.1)",
  },
};

const FREQUENCY_RANGE_OPTIONS = [
  { value: 3, label: "Últimos 3 meses" },
  { value: 6, label: "Últimos 6 meses" },
  { value: 12, label: "Últimos 12 meses" },
];

const ENDED_SESSION_STATUSES = new Set(["done", "no_show", "canceled"]);

const DEFAULT_OPERATIONAL_POLICY = {
  monthly_reschedule_limit: 2,
  monthly_absence_limit: 2,
};

function resolveAttentionLevelStyles(level) {
  return ATTENTION_LEVEL_STYLES[level] || ATTENTION_LEVEL_STYLES.default;
}

function buildAttentionOptionStyle(level) {
  const styles = resolveAttentionLevelStyles(level);
  return {
    color: styles.color,
    backgroundColor: styles.background,
  };
}

function formatAttentionLevel(value) {
  return ATTENTION_LEVEL_LABELS[value] || "-";
}

const TREATMENT_GOAL_OPTIONS = [
  { value: "reduce_pain", label: "Reduzir dor" },
  { value: "recover_movement", label: "Recuperar movimento" },
  { value: "rehabilitation", label: "Reabilitacao" },
  { value: "strength_flex_mob", label: "Forca/Flex/Mob" },
];

const TREATMENT_GOAL_LABELS = {
  reduce_pain: "Reduzir dor",
  recover_movement: "Recuperar movimento",
  rehabilitation: "Reabilitacao",
  strength_flex_mob: "Forca/Flex/Mob",
  other: "Outro",
};

function cleanText(value) {
  if (value === null || value === undefined) return null;
  const normalized = String(value).trim();
  return normalized.length ? normalized : null;
}

function valueOrDash(value) {
  if (value === null || value === undefined) return "-";
  const normalized = String(value).trim();
  return normalized.length ? normalized : "-";
}

function formatDate(value) {
  if (!value) return "--/--/----";

  const normalizedValue = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(normalizedValue)) {
    return formatBirthDateForDisplay(normalizedValue);
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--/--/----";

  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

function formatDateTime(value) {
  if (!value) return "--/--/---- --:--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--/--/---- --:--";
  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatTime(value) {
  if (!value) return "--:--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--:--";
  return date.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatSessionStatus(status) {
  const map = {
    scheduled: "Agendada",
    done: "Realizada",
    no_show: "Falta",
    canceled: "Cancelada",
    suspended: "Suspensa",
  };
  return map[status] || valueOrDash(status);
}

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0);
}

function addMonths(date, amount) {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1, 0, 0, 0, 0);
}

function formatDateParam(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getMonthKey(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function formatMonthLabel(date) {
  return date.toLocaleDateString("pt-BR", {
    month: "short",
    year: "numeric",
  });
}

function buildFrequencyMonths(rangeMonths) {
  const currentMonth = startOfMonth(new Date());
  return Array.from({ length: rangeMonths }, (_, index) => {
    const start = addMonths(currentMonth, index - rangeMonths + 1);
    const end = addMonths(start, 1);
    return {
      key: getMonthKey(start),
      label: formatMonthLabel(start),
      start,
      end,
    };
  });
}

function buildFrequencySummary(sessions, rangeMonths, policy = DEFAULT_OPERATIONAL_POLICY) {
  const now = new Date();
  const months = buildFrequencyMonths(rangeMonths).map((month) => ({
    ...month,
    scheduled: 0,
    done: 0,
    noShow: 0,
    reschedules: 0,
    canceled: 0,
    closed: 0,
    attendanceRate: null,
    alerts: [],
  }));
  const monthMap = new Map(months.map((month) => [month.key, month]));

  (sessions || []).forEach((session) => {
    const startsAt = session?.starts_at ? new Date(session.starts_at) : null;
    if (!startsAt || Number.isNaN(startsAt.getTime())) return;
    const month = monthMap.get(getMonthKey(startsAt));
    if (!month) return;

    const status = String(session.status || "scheduled");
    month.scheduled += 1;
    if (status === "done") month.done += 1;
    if (status === "no_show") month.noShow += 1;
    if (status === "canceled") month.canceled += 1;
    if (Array.isArray(session.reschedules)) {
      month.reschedules += session.reschedules.length;
    }
    if (startsAt <= now && ENDED_SESSION_STATUSES.has(status)) {
      month.closed += 1;
    }
  });

  return months.map((month) => {
    const attendanceRate = month.closed > 0
      ? Math.round((month.done / month.closed) * 100)
      : null;
    const alerts = [];
    const absenceLimit = Number(policy.monthly_absence_limit || DEFAULT_OPERATIONAL_POLICY.monthly_absence_limit);
    const rescheduleLimit = Number(policy.monthly_reschedule_limit || DEFAULT_OPERATIONAL_POLICY.monthly_reschedule_limit);
    if (month.noShow === absenceLimit) alerts.push(`Atingiu ${absenceLimit} faltas no mes.`);
    if (month.noShow > absenceLimit) alerts.push(`Excedeu ${absenceLimit} faltas no mes.`);
    if (month.reschedules === rescheduleLimit) {
      alerts.push(`Atingiu ${rescheduleLimit} remarcacoes no mes.`);
    }
    if (month.reschedules > rescheduleLimit) {
      alerts.push(`Excedeu ${rescheduleLimit} remarcacoes no mes.`);
    }

    return {
      ...month,
      attendanceRate,
      alerts,
      hasAlert: alerts.length > 0,
    };
  });
}

function buildFrequencyPeriodSummary(months) {
  const totals = (months || []).reduce(
    (accumulator, month) => ({
      scheduled: accumulator.scheduled + month.scheduled,
      done: accumulator.done + month.done,
      noShow: accumulator.noShow + month.noShow,
      reschedules: accumulator.reschedules + month.reschedules,
      canceled: accumulator.canceled + month.canceled,
      closed: accumulator.closed + month.closed,
    }),
    {
      scheduled: 0,
      done: 0,
      noShow: 0,
      reschedules: 0,
      canceled: 0,
      closed: 0,
    },
  );

  return {
    ...totals,
    attendanceRate: totals.closed > 0
      ? Math.round((totals.done / totals.closed) * 100)
      : null,
  };
}

function getAttendanceTone(rate) {
  if (rate === null || rate === undefined) return "neutral";
  return rate >= 75 ? "positive" : "attention";
}

function formatBoolean(value) {
  if (value === true) return "Sim";
  if (value === false) return "Nao";
  return "-";
}

function formatReplacementCreditStatus(status) {
  const map = {
    pending: "Pendente",
    used: "Usada",
    expired: "Expirada",
    canceled: "Cancelada",
  };
  return map[status] || valueOrDash(status);
}

function formatSex(value) {
  if (value === "F") return "Feminino";
  if (value === "M") return "Masculino";
  return "-";
}

function resolveAddress(patient) {
  if (!patient) return "";
  const direct = patient.address || patient.endereco || "";
  if (direct) return direct;

  const street = patient.address_street || "";
  const number = patient.address_number || "";
  const complement = patient.address_complement || "";
  const neighborhood = patient.address_neighborhood || "";
  const city = patient.address_city || "";
  const state = patient.address_state || "";
  const zip = patient.address_zip || "";

  let line1 = street;
  if (number) line1 = line1 ? `${line1}, ${number}` : number;
  if (complement) line1 = line1 ? `${line1} ${complement}` : complement;

  const parts = [];
  if (line1) parts.push(line1);
  if (neighborhood) parts.push(neighborhood);

  const cityState = [city, state].filter(Boolean).join(" - ");
  if (cityState) parts.push(cityState);
  if (zip) parts.push(`CEP ${zip}`);

  return parts.join(", ");
}

function buildTreatmentGoalState(patient) {
  const storedOptions = Array.isArray(patient?.treatment_goal_options)
    ? [...new Set(patient.treatment_goal_options.filter(Boolean))]
    : null;
  const storedOther = cleanText(patient?.treatment_goal_other) || "";

  if (storedOptions) {
    const options = [...storedOptions];
    if (storedOther && !options.includes("other")) options.push("other");
    return { options, other: storedOther };
  }

  const legacyText = cleanText(patient?.treatment_goal);
  if (!legacyText) {
    return { options: [], other: "" };
  }

  const options = [];
  const extraParts = [];

  legacyText
    .split("|")
    .map((item) => item.trim())
    .filter(Boolean)
    .forEach((item) => {
      const matchedOption = TREATMENT_GOAL_OPTIONS.find(
        (option) => option.label.toLowerCase() === item.toLowerCase(),
      );

      if (matchedOption) {
        options.push(matchedOption.value);
        return;
      }

      if (/^outro\s*:/i.test(item)) {
        const otherText = item.replace(/^outro\s*:\s*/i, "").trim();
        options.push("other");
        if (otherText) extraParts.push(otherText);
        return;
      }

      extraParts.push(item);
    });

  const uniqueOptions = [...new Set(options)];
  if (extraParts.length && !uniqueOptions.includes("other")) {
    uniqueOptions.push("other");
  }

  return {
    options: uniqueOptions,
    other: extraParts.join(" | "),
  };
}

function buildPatientForm(patient) {
  const treatmentGoalState = buildTreatmentGoalState(patient);

  return {
    full_name: patient?.full_name || patient?.name || "",
    nickname: patient?.nickname || "",
    sex: patient?.sex || "",
    birth_date: formatBirthDateForInput(patient?.birth_date || patient?.birthDate),
    cpf: patient?.cpf || "",
    rg: patient?.rg || "",
    marital_status: patient?.marital_status || "",
    profession: patient?.profession || "",
    attention_level: patient?.attention_level || "",
    referral_source: patient?.referral_source || "",
    email: patient?.email || "",
    phone: patient?.phone || "",
    instagram: patient?.instagram || "",
    contact_via_whatsapp: patient?.contact_via_whatsapp === true,
    contact_via_phone: patient?.contact_via_phone === true,
    contact_via_email: patient?.contact_via_email === true,
    address_street: patient?.address_street || "",
    address_number: patient?.address_number || "",
    address_complement: patient?.address_complement || "",
    address_neighborhood: patient?.address_neighborhood || "",
    address_city: patient?.address_city || "",
    address_state: patient?.address_state || "",
    address_zip: patient?.address_zip || "",
    emergency_contact_name: patient?.emergency_contact_name || "",
    emergency_contact_relationship: patient?.emergency_contact_relationship || "",
    emergency_contact_phone: patient?.emergency_contact_phone || "",
    main_complaint: patient?.main_complaint || "",
    relevant_conditions: patient?.relevant_conditions || "",
    treatment_goal_options: treatmentGoalState.options,
    treatment_goal_other: treatmentGoalState.other,
    consent_data_processing: patient?.consent_data_processing === true,
    consent_image_use: patient?.consent_image_use === true,
    consent_info_truth: patient?.consent_info_truth === true,
  };
}

export default function PatientDetails() {
  const { id } = useParams();
  const [activeTab, setActiveTab] = useState(TABS.resumo);
  const [isLoading, setIsLoading] = useState(false);
  const [patient, setPatient] = useState(null);
  const [evaluations, setEvaluations] = useState([]);
  const [frequencySessions, setFrequencySessions] = useState([]);
  const [perSessionSessions, setPerSessionSessions] = useState([]);
  const [perSessionSeries, setPerSessionSeries] = useState([]);
  const [selectedPackage, setSelectedPackage] = useState(null);
  const [replacementCredits, setReplacementCredits] = useState([]);
  const [operationalPolicy, setOperationalPolicy] = useState(DEFAULT_OPERATIONAL_POLICY);
  const [frequencyRangeMonths, setFrequencyRangeMonths] = useState(3);
  const [editingSection, setEditingSection] = useState(null);
  const [isSavingSection, setIsSavingSection] = useState(false);
  const [editForm, setEditForm] = useState(() => buildPatientForm(null));

  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      try {
        const currentMonth = startOfMonth(new Date());
        const sessionsFrom = addMonths(currentMonth, -5);
        const sessionsTo = addMonths(currentMonth, 1);
        const [
          patientResponse,
          evalResponse,
          sessionsResponse,
          allSessionsResponse,
          sessionSeriesResponse,
          replacementCreditsResponse,
          operationalPolicyResponse,
        ] = await Promise.all([
          axios.get(`/patients/${id}`),
          axios.get(`/evaluations?patient_id=${id}`),
          axios.get("/sessions", {
            params: {
              patient_id: id,
              from: formatDateParam(sessionsFrom),
              to: formatDateParam(sessionsTo),
            },
          }),
          axios.get("/sessions", { params: { patient_id: id } }),
          axios.get("/session-series", { params: { patient_id: id } }),
          axios.get("/session-replacement-credits", { params: { patient_id: id } }),
          axios.get("/unit-scheduling-policy"),
        ]);
        setPatient(patientResponse.data);
        setEvaluations(Array.isArray(evalResponse.data) ? evalResponse.data : []);
        setFrequencySessions(
          Array.isArray(sessionsResponse.data) ? sessionsResponse.data : [],
        );
        setPerSessionSessions(
          Array.isArray(allSessionsResponse.data) ? allSessionsResponse.data : [],
        );
        setPerSessionSeries(
          Array.isArray(sessionSeriesResponse.data) ? sessionSeriesResponse.data : [],
        );
        setReplacementCredits(
          Array.isArray(replacementCreditsResponse.data) ? replacementCreditsResponse.data : [],
        );
        setOperationalPolicy({
          ...DEFAULT_OPERATIONAL_POLICY,
          ...(operationalPolicyResponse.data || {}),
        });
      } catch (error) {
        const message =
          error?.response?.data?.error ||
          "Não foi possível carregar os dados do paciente.";
        toast.error(message);
      } finally {
        setIsLoading(false);
      }
    }

    if (id) {
      loadData();
    }
  }, [id]);

  useEffect(() => {
    if (patient && !editingSection) {
      setEditForm(buildPatientForm(patient));
    }
  }, [patient, editingSection]);

  const latestEval = evaluations[0] || null;
  const summaryText = latestEval?.summary_text || latestEval?.summaryText || "";
  const planText = latestEval?.plan_text || latestEval?.planText || "";
  const lastNote = summaryText || planText || "Nenhum registro encontrado.";
  const lastDate = latestEval
    ? formatDate(latestEval.created_at || latestEval.createdAt)
    : "--/--/----";

  const age = useMemo(
    () =>
      patient
        ? calculateAgeFromBirthDate(patient.birth_date || patient.birthDate)
        : null,
    [patient],
  );
  const editAge = useMemo(
    () => calculateAgeFromBirthDate(editForm.birth_date),
    [editForm.birth_date],
  );
  const address = useMemo(() => resolveAddress(patient || {}), [patient]);
  const editAddress = useMemo(() => resolveAddress(editForm || {}), [editForm]);
  const createdAtLabel = useMemo(
    () => formatDateTime(patient?.created_at || patient?.createdAt),
    [patient],
  );
  const treatmentGoalDisplay = useMemo(() => {
    if (!patient) return "-";

    const goalState = buildTreatmentGoalState(patient);
    const labels = goalState.options
      .filter((item) => item !== "other")
      .map((item) => TREATMENT_GOAL_LABELS[item] || item);

    if (goalState.options.includes("other")) {
      labels.push(goalState.other ? `Outro: ${goalState.other}` : "Outro");
    }

    if (labels.length) return labels.join(" | ");
    return valueOrDash(patient.treatment_goal);
  }, [patient]);
  const frequencySummary = useMemo(
    () => buildFrequencySummary(frequencySessions, frequencyRangeMonths, operationalPolicy),
    [frequencyRangeMonths, frequencySessions, operationalPolicy],
  );
  const frequencyPeriodSummary = useMemo(
    () => buildFrequencyPeriodSummary(frequencySummary),
    [frequencySummary],
  );
  const perSessionSeriesById = useMemo(() => {
    const map = new Map();
    perSessionSeries.forEach((series) => {
      if (series.id) map.set(Number(series.id), series);
    });
    return map;
  }, [perSessionSeries]);

  const perSessionItems = useMemo(() => {
    const eligibleSessions = perSessionSessions
      .filter((session) => (session.billing_mode || "per_session") === "per_session")
      .sort((first, second) => new Date(first.starts_at || 0) - new Date(second.starts_at || 0));
    const sessionsBySeriesId = new Map();
    const singleSessions = [];

    eligibleSessions.forEach((session) => {
      const seriesId = Number(session.series_id || session.series?.id || 0);
      if (seriesId) {
        const list = sessionsBySeriesId.get(seriesId) || [];
        list.push(session);
        sessionsBySeriesId.set(seriesId, list);
        return;
      }
      singleSessions.push(session);
    });

    const buildSessionDetail = (session) => {
      return {
        id: session.id,
        starts_at: session.starts_at,
        dateLabel: formatDate(session.starts_at),
        timeLabel: formatTime(session.starts_at),
        serviceName: session.Service?.name || session.service?.name || valueOrDash(session.service_type),
        professionalName: session.professional?.name || "-",
        status: session.status || "scheduled",
        statusLabel: formatSessionStatus(session.status || "scheduled"),
      };
    };

    const packageItems = Array.from(sessionsBySeriesId.entries()).map(([seriesId, sessions]) => {
      const series = perSessionSeriesById.get(Number(seriesId)) || sessions[0]?.series || {};
      const sessionDetails = sessions.map(buildSessionDetail);
      const totalSessions = Number(series.occurrence_count || 0)
        || Number(sessions[0]?.recurring_total || 0)
        || sessions.length;
      const doneCount = sessions.filter((session) => session.status === "done").length;
      const noShowCount = sessions.filter((session) => session.status === "no_show").length;
      const scheduledCount = sessions.filter((session) => session.status === "scheduled").length;
      const canceledCount = sessions.filter((session) => session.status === "canceled").length;
      const serviceName = series.Service?.name
        || sessions[0]?.Service?.name
        || sessions[0]?.service?.name
        || "Pacote de sessões";

      return {
        id: `series-${seriesId}`,
        kind: "package",
        sourceId: seriesId,
        serviceName,
        referenceDate: sessions[0]?.starts_at || series.starts_at || null,
        totalSessions,
        doneCount,
        noShowCount,
        scheduledCount,
        canceledCount,
        sessions: sessionDetails,
      };
    });

    const singleItems = singleSessions.map((session) => {
      const detail = buildSessionDetail(session);
      return {
        id: `session-${session.id}`,
        kind: "single",
        sourceId: session.id,
        serviceName: detail.serviceName || "Sessão avulsa",
        referenceDate: session.starts_at,
        totalSessions: 1,
        doneCount: session.status === "done" ? 1 : 0,
        noShowCount: session.status === "no_show" ? 1 : 0,
        scheduledCount: session.status === "scheduled" ? 1 : 0,
        canceledCount: session.status === "canceled" ? 1 : 0,
        status: session.status || "scheduled",
        sessions: [detail],
      };
    });

    return [...packageItems, ...singleItems]
      .sort((first, second) => {
        const firstDate = new Date(first.referenceDate || 0).getTime();
        const secondDate = new Date(second.referenceDate || 0).getTime();
        return (Number.isNaN(firstDate) ? 0 : firstDate) - (Number.isNaN(secondDate) ? 0 : secondDate);
      });
  }, [
    perSessionSeriesById,
    perSessionSessions,
  ]);

  const isTreatmentGoalOtherSelected = editForm.treatment_goal_options.includes(
    "other",
  );
  const isPersonalEditing = editingSection === EDIT_SECTIONS.personal;
  const isAttentionLevelMissing = isPersonalEditing
    ? !cleanText(editForm.attention_level)
    : !cleanText(patient?.attention_level);
  const isContactEditing = editingSection === EDIT_SECTIONS.contact;
  const isAddressEditing = editingSection === EDIT_SECTIONS.address;
  const isEmergencyEditing = editingSection === EDIT_SECTIONS.emergency;
  const isClinicalEditing = editingSection === EDIT_SECTIONS.clinical;
  const isConsentEditing = editingSection === EDIT_SECTIONS.consent;

  const showResumo = useCallback(() => setActiveTab(TABS.resumo), []);
  const showHistorico = useCallback(() => setActiveTab(TABS.historico), []);
  const showDados = useCallback(() => setActiveTab(TABS.dados), []);
  const closePackageModal = useCallback(() => setSelectedPackage(null), []);

  const reloadReplacementCredits = useCallback(async () => {
    if (!id) return;
    const response = await axios.get("/session-replacement-credits", { params: { patient_id: id } });
    setReplacementCredits(Array.isArray(response.data) ? response.data : []);
  }, [id]);

  const handleCancelReplacementCredit = useCallback(async (creditId) => {
    // eslint-disable-next-line no-alert
    const reason = window.prompt("Motivo do cancelamento da reposição:", "Cancelada pelo administrador.");
    if (reason === null) return;
    try {
      await axios.post(`/session-replacement-credits/${creditId}/cancel`, {
        reason: reason.trim() || "Cancelada pelo administrador.",
      });
      toast.success("Reposicao cancelada.");
      await reloadReplacementCredits();
    } catch (error) {
      toast.error(error?.response?.data?.error || "Não foi possível cancelar a reposição.");
    }
  }, [reloadReplacementCredits]);

  const startEditingSection = useCallback(
    (section) => {
      if (!patient || isSavingSection) return;
      setEditForm(buildPatientForm(patient));
      setEditingSection(section);
    },
    [patient, isSavingSection],
  );

  const cancelEditingSection = useCallback(() => {
    setEditForm(buildPatientForm(patient));
    setEditingSection(null);
  }, [patient]);

  const handleEditFieldChange = useCallback((event) => {
    const { name, value, type, checked } = event.target;
    let nextValue = type === "checkbox" ? checked : value;

    if (name === "birth_date") {
      nextValue = maskBirthDateInput(value);
    } else if (name === "address_state") {
      nextValue = String(value || "")
        .replace(/[^a-zA-Z]/g, "")
        .toUpperCase()
        .slice(0, 2);
    }

    setEditForm((prev) => ({
      ...prev,
      [name]: nextValue,
    }));
  }, []);

  const handleTreatmentGoalToggle = useCallback((goalValue) => {
    setEditForm((prev) => {
      const hasValue = prev.treatment_goal_options.includes(goalValue);
      const nextGoals = hasValue
        ? prev.treatment_goal_options.filter((value) => value !== goalValue)
        : [...prev.treatment_goal_options, goalValue];

      return {
        ...prev,
        treatment_goal_options: nextGoals,
      };
    });
  }, []);

  const handleSaveSection = useCallback(async () => {
    if (!editingSection) return;

    let payload = null;

    if (editingSection === EDIT_SECTIONS.personal) {
      const fullName = String(editForm.full_name || "").trim();
      if (fullName.length < 3) {
        toast.error("Informe o nome completo com pelo menos 3 caracteres.");
        return;
      }

      if (isBirthDateFilled(editForm.birth_date) && !isBirthDateValid(editForm.birth_date)) {
        toast.error(
          "Confira a data de nascimento: use dia, mes e ano com 4 digitos, por exemplo 02/02/1992.",
        );
        return;
      }

      const sex = cleanText(editForm.sex);
      payload = {
        full_name: fullName,
        nickname: cleanText(editForm.nickname),
        sex: sex ? sex.toUpperCase() : null,
        birth_date: formatBirthDateForApi(editForm.birth_date),
        cpf: cleanText(editForm.cpf),
        rg: cleanText(editForm.rg),
        marital_status: cleanText(editForm.marital_status),
        profession: cleanText(editForm.profession),
        attention_level: cleanText(editForm.attention_level),
        referral_source: cleanText(editForm.referral_source),
      };
    }

    if (editingSection === EDIT_SECTIONS.contact) {
      payload = {
        email: cleanText(editForm.email),
        phone: cleanText(editForm.phone),
        instagram: cleanText(editForm.instagram),
        contact_via_whatsapp: editForm.contact_via_whatsapp,
        contact_via_phone: editForm.contact_via_phone,
        contact_via_email: editForm.contact_via_email,
      };
    }

    if (editingSection === EDIT_SECTIONS.address) {
      payload = {
        address_street: cleanText(editForm.address_street),
        address_number: cleanText(editForm.address_number),
        address_complement: cleanText(editForm.address_complement),
        address_neighborhood: cleanText(editForm.address_neighborhood),
        address_city: cleanText(editForm.address_city),
        address_state: cleanText(editForm.address_state),
        address_zip: cleanText(editForm.address_zip),
      };
    }

    if (editingSection === EDIT_SECTIONS.emergency) {
      payload = {
        emergency_contact_name: cleanText(editForm.emergency_contact_name),
        emergency_contact_relationship: cleanText(
          editForm.emergency_contact_relationship,
        ),
        emergency_contact_phone: cleanText(editForm.emergency_contact_phone),
      };
    }

    if (editingSection === EDIT_SECTIONS.clinical) {
      const treatmentGoalOther = cleanText(editForm.treatment_goal_other);

      if (
        editForm.treatment_goal_options.includes("other") &&
        !treatmentGoalOther
      ) {
        toast.error("Preencha o campo 'Outro' em objetivo do tratamento.");
        return;
      }

      payload = {
        main_complaint: cleanText(editForm.main_complaint),
        relevant_conditions: cleanText(editForm.relevant_conditions),
        treatment_goal_options: editForm.treatment_goal_options,
        treatment_goal_other: editForm.treatment_goal_options.includes("other")
          ? treatmentGoalOther
          : null,
      };
    }

    if (editingSection === EDIT_SECTIONS.consent) {
      payload = {
        consent_data_processing: editForm.consent_data_processing,
        consent_image_use: editForm.consent_image_use,
        consent_info_truth: editForm.consent_info_truth,
      };
    }

    if (!payload) return;

    setIsSavingSection(true);
    try {
      const response = await axios.put(`/patients/${id}`, payload);
      const nextPatient =
        response?.data && typeof response.data === "object"
          ? response.data
          : { ...patient, ...payload };

      setPatient(nextPatient);
      setEditForm(buildPatientForm(nextPatient));
      setEditingSection(null);
      toast.success("Dados atualizados com sucesso.");
    } catch (error) {
      const message =
        error?.response?.data?.error ||
        "Não foi possível atualizar os dados do paciente.";
      toast.error(message);
    } finally {
      setIsSavingSection(false);
    }
  }, [editForm, editingSection, id, patient]);

  const renderSectionActions = useCallback(
    (section) => {
      const isCurrentSection = editingSection === section;
      const disableEdit = Boolean(editingSection) || isSavingSection;

      if (isCurrentSection) {
        return (
          <CardActions>
            <CardButton
              type="button"
              onClick={cancelEditingSection}
              disabled={isSavingSection}
            >
              Cancelar
            </CardButton>
            <CardButton
              type="button"
              $primary
              onClick={handleSaveSection}
              disabled={isSavingSection}
            >
              {isSavingSection ? "Salvando..." : "Salvar"}
            </CardButton>
          </CardActions>
        );
      }

      return (
        <CardActions>
          <CardButton
            type="button"
            onClick={() => startEditingSection(section)}
            disabled={disableEdit}
          >
            Editar
          </CardButton>
        </CardActions>
      );
    },
    [
      cancelEditingSection,
      editingSection,
      handleSaveSection,
      isSavingSection,
      startEditingSection,
    ],
  );

  return (
    <PageWrapper $paddingTop="90px" $paddingBottom="60px">
      <PageContent
        $maxWidth="1220px"
        $paddingTop="0"
        $paddingX="30px"
        $paddingBottom="0"
        $mobileBreakpoint="859px"
        $mobilePaddingX="15px"
        $mobilePaddingTop="0"
        $mobilePaddingBottom="0"
      >
        <Header>
          <div>
            <HeaderTitle>
              {getPatientDisplayName(patient)}
            </HeaderTitle>
          </div>
          <HeaderActions>
            {/* <AddLink to={`/pacientes/${id}/avaliacoes/nova`}>
              Adicionar registro
            </AddLink> */}
            <LinkGhostButton to="/pacientes/consultar">Voltar</LinkGhostButton>
          </HeaderActions>
        </Header>

        <Tabs>
          <TabButton
            type="button"
            onClick={showResumo}
            $active={activeTab === TABS.resumo}
          >
            Resumo
          </TabButton>
          <TabButton
            type="button"
            onClick={showHistorico}
            $active={activeTab === TABS.historico}
          >
            Histórico
          </TabButton>
          <TabButton
            type="button"
            onClick={showDados}
            $active={activeTab === TABS.dados}
          >
            Dados
          </TabButton>
        </Tabs>

        {isLoading && (
          <Section>
            <InfoCard>
              <DataLoadingState text="Carregando paciente..." />
            </InfoCard>
          </Section>
        )}

        {!isLoading && activeTab === TABS.resumo && (
          <Section>
            <InfoCard>
              <CardTitle>
                <FaInfoCircle /> Resumo clinico
              </CardTitle>
              <CardText>{summaryText || "Sem resumo clinico."}</CardText>
            </InfoCard>
            <InfoCard>
              <CardTitle>
                <FaListAlt /> Ultimo registro
              </CardTitle>
              <CardText>
                {lastDate} - {lastNote}
              </CardText>
            </InfoCard>
            <InfoCard>
              <FrequencyHeader>
                <CardTitle>
                  <FaListAlt /> Reposições de sessão
                </CardTitle>
              </FrequencyHeader>
              {replacementCredits.length === 0 && (
                <EmptyState>Nenhuma reposição registrada.</EmptyState>
              )}
              {replacementCredits.length > 0 && (
                <ReplacementCreditList>
                  {replacementCredits.map((credit) => (
                    <ReplacementCreditItem key={credit.id} $status={credit.status}>
                      <div>
                        <strong>{formatReplacementCreditStatus(credit.status)}</strong>
                        <span>Validade: {formatDate(credit.expires_at)}</span>
                        <p>{credit.reason}</p>
                        {credit.source_session_id && (
                          <small>Origem: sessão #{credit.source_session_id}</small>
                        )}
                        {credit.used_session_id && (
                          <small>Usada na sessão #{credit.used_session_id}</small>
                        )}
                      </div>
                      {credit.status === "pending" && (
                        <CardButton
                          type="button"
                          onClick={() => handleCancelReplacementCredit(credit.id)}
                        >
                          Cancelar
                        </CardButton>
                      )}
                    </ReplacementCreditItem>
                  ))}
                </ReplacementCreditList>
              )}
            </InfoCard>
          </Section>
        )}

        {!isLoading && activeTab === TABS.historico && (
          <Section>
            <InfoCard>
              <FrequencyHeader>
                <CardTitle>
                  <FaListAlt /> Frequência e presença
                </CardTitle>
                <FrequencyRangeControl
                  value={frequencyRangeMonths}
                  onChange={(event) => setFrequencyRangeMonths(Number(event.target.value))}
                  aria-label="Período da análise de frequência"
                >
                  {FREQUENCY_RANGE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </FrequencyRangeControl>
              </FrequencyHeader>
              <FrequencySummaryGrid>
                <FrequencySummaryCard>
                  <span>Agendadas</span>
                  <strong>{frequencyPeriodSummary.scheduled}</strong>
                </FrequencySummaryCard>
                <FrequencySummaryCard>
                  <span>Realizadas</span>
                  <strong>{frequencyPeriodSummary.done}</strong>
                </FrequencySummaryCard>
                <FrequencySummaryCard $tone={frequencyPeriodSummary.noShow > 0 ? "attention" : "neutral"}>
                  <span>Faltas</span>
                  <strong>{frequencyPeriodSummary.noShow}</strong>
                </FrequencySummaryCard>
                <FrequencySummaryCard>
                  <span>Cancelamentos</span>
                  <strong>{frequencyPeriodSummary.canceled}</strong>
                </FrequencySummaryCard>
                <FrequencySummaryCard $tone={frequencyPeriodSummary.reschedules > 0 ? "attention" : "neutral"}>
                  <span>Remarcações</span>
                  <strong>{frequencyPeriodSummary.reschedules}</strong>
                </FrequencySummaryCard>
                <FrequencySummaryCard $tone={getAttendanceTone(frequencyPeriodSummary.attendanceRate)}>
                  <span>Comparecimento</span>
                  <strong>
                    {frequencyPeriodSummary.attendanceRate === null
                      ? "-"
                      : `${frequencyPeriodSummary.attendanceRate}%`}
                  </strong>
                </FrequencySummaryCard>
              </FrequencySummaryGrid>
              <FrequencyTableWrap>
                <FrequencyTable>
                  <thead>
                    <tr>
                      <th>Mês</th>
                      <th>Agendadas</th>
                      <th>Realizadas</th>
                      <th>Faltas</th>
                      <th>Remarcações</th>
                      <th>Cancelamentos</th>
                      <th>Comparecimento</th>
                    </tr>
                  </thead>
                  <tbody>
                    {frequencySummary.map((month) => (
                      <tr key={month.key}>
                        <td>
                          <strong>{month.label}</strong>
                        </td>
                        <td>{month.scheduled}</td>
                        <td>{month.done}</td>
                        <td>
                          <FrequencyCellHighlight $active={month.noShow > 0}>
                            {month.noShow}
                          </FrequencyCellHighlight>
                        </td>
                        <td>
                          <FrequencyCellHighlight $active={month.reschedules > 0}>
                            {month.reschedules}
                          </FrequencyCellHighlight>
                        </td>
                        <td>{month.canceled}</td>
                        <td>
                          <AttendanceRatePill $tone={getAttendanceTone(month.attendanceRate)}>
                            {month.attendanceRate === null ? "-" : `${month.attendanceRate}%`}
                          </AttendanceRatePill>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </FrequencyTable>
              </FrequencyTableWrap>
            </InfoCard>
            <InfoCard>
              <FrequencyHeader>
                <CardTitle>
                  <FaListAlt /> Pacotes e sessões avulsas
                </CardTitle>
              </FrequencyHeader>
              {perSessionItems.length === 0 && (
                <EmptyState>Nenhum pacote ou sessão avulsa encontrada para este paciente.</EmptyState>
              )}
              {perSessionItems.length > 0 && (
                <PackageTableWrap>
                  <PackageTable>
                    <thead>
                      <tr>
                        <th>Tipo</th>
                        <th>Serviço</th>
                        <th>Data inicial</th>
                        <th>Total</th>
                        <th>Realizadas</th>
                        <th>Faltas</th>
                        <th>Canceladas</th>
                        <th>Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {perSessionItems.map((item) => (
                        <tr key={item.id}>
                          <td>
                            <TypePill $kind={item.kind}>
                              {item.kind === "package" ? "Pacote" : "Avulsa"}
                            </TypePill>
                          </td>
                          <td>
                            <strong>{item.serviceName}</strong>
                          </td>
                          <td>{formatDate(item.referenceDate)}</td>
                          <td>{item.totalSessions}</td>
                          <td>{item.doneCount}</td>
                          <td>{item.noShowCount}</td>
                          <td>{item.canceledCount}</td>
                          <td>
                            {item.kind === "package" ? (
                              <CardButton type="button" onClick={() => setSelectedPackage(item)}>
                                Ver sessões
                              </CardButton>
                            ) : (
                              <span>-</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </PackageTable>
                </PackageTableWrap>
              )}
            </InfoCard>
            {evaluations.length === 0 && (
              <EmptyState>Nenhuma avaliacao encontrada.</EmptyState>
            )}
            {evaluations.map((evaluation) => {
              const title =
                evaluation.summary_text || evaluation.summaryText || "Avaliacao";
              const note =
                evaluation.plan_text ||
                evaluation.planText ||
                evaluation.summary_text ||
                evaluation.summaryText ||
                "Sem observacoes.";
              const createdAt = formatDate(
                evaluation.created_at || evaluation.createdAt,
              );

              return (
                <HistoryCardLink
                  key={evaluation.id || `${createdAt}-${title}`}
                  to={`/pacientes/${id}/avaliacoes/${evaluation.id}`}
                >
                  <HistoryHeader>
                    <span>{createdAt}</span>
                    <h3>{title}</h3>
                  </HistoryHeader>
                  <p>{note}</p>
                </HistoryCardLink>
              );
            })}
          </Section>
        )}

        {!isLoading && activeTab === TABS.dados && (
          <Section>
            <InfoCard>
              <CardTitle>
                Cadastro
                <CardTitleMeta>Criado em {createdAtLabel}</CardTitleMeta>
              </CardTitle>
            </InfoCard>

            <InfoCard $editing={isPersonalEditing}>
              <CardHeader>
                <CardHeaderInfo>
                  <CardTitle>
                    <FaUserAlt /> Informacoes pessoais
                  </CardTitle>
                  {isAttentionLevelMissing && (
                    <AttentionMissingPill>Atenção não definida</AttentionMissingPill>
                  )}
                  {isPersonalEditing && <EditingBadge>Em edição</EditingBadge>}
                </CardHeaderInfo>
                {renderSectionActions(EDIT_SECTIONS.personal)}
              </CardHeader>
              {!isPersonalEditing && (
                <DataList>
                  <DataRow>
                    <DataLabel>Apelido</DataLabel>
                    <DataValue>{valueOrDash(patient?.nickname)}</DataValue>
                  </DataRow>
                  <DataRow>
                    <DataLabel>Nome completo</DataLabel>
                    <DataValue>
                      {valueOrDash(patient?.full_name || patient?.name)}
                    </DataValue>
                  </DataRow>
                  <DataRow>
                    <DataLabel>Sexo</DataLabel>
                    <DataValue>{formatSex(patient?.sex)}</DataValue>
                  </DataRow>
                  <DataRow>
                    <DataLabel>Data de nascimento</DataLabel>
                    <DataValue>
                      {formatBirthDateForDisplay(
                        patient?.birth_date || patient?.birthDate,
                      )}
                    </DataValue>
                  </DataRow>
                  <DataRow>
                    <DataLabel>Idade</DataLabel>
                    <DataValue>{age !== null ? `${age} anos` : "-"}</DataValue>
                  </DataRow>
                  <DataRow>
                    <DataLabel>CPF</DataLabel>
                    <DataValue>{valueOrDash(patient?.cpf)}</DataValue>
                  </DataRow>
                  <DataRow>
                    <DataLabel>RG</DataLabel>
                    <DataValue>{valueOrDash(patient?.rg)}</DataValue>
                  </DataRow>
                  <DataRow>
                    <DataLabel>Estado civil</DataLabel>
                    <DataValue>{valueOrDash(patient?.marital_status)}</DataValue>
                  </DataRow>
                  <DataRow>
                    <DataLabel>Profissao</DataLabel>
                    <DataValue>{valueOrDash(patient?.profession)}</DataValue>
                  </DataRow>
                  <DataRow>
                    <DataLabel>Atenção do paciente</DataLabel>
                    <DataValue>
                      {patient?.attention_level ? (
                        <AttentionBadge $level={patient.attention_level}>
                          {formatAttentionLevel(patient.attention_level)}
                        </AttentionBadge>
                      ) : (
                        "-"
                      )}
                    </DataValue>
                  </DataRow>
                  <DataRow>
                    <DataLabel>Origem</DataLabel>
                    <DataValue>{valueOrDash(patient?.referral_source)}</DataValue>
                  </DataRow>
                </DataList>
              )}
              {isPersonalEditing && (
                <DataList>
                  <DataRow>
                    <DataLabel>Apelido</DataLabel>
                    <DataValue>
                      <InlineInput
                        name="nickname"
                        value={editForm.nickname}
                        onChange={handleEditFieldChange}
                        placeholder="Nome de exibicao"
                        maxLength={80}
                      />
                    </DataValue>
                  </DataRow>
                  <DataRow>
                    <DataLabel>Nome completo</DataLabel>
                    <DataValue>
                      <InlineInput
                        name="full_name"
                        value={editForm.full_name}
                        onChange={handleEditFieldChange}
                        placeholder="Nome completo"
                      />
                    </DataValue>
                  </DataRow>
                  <DataRow>
                    <DataLabel>Sexo</DataLabel>
                    <DataValue>
                      <InlineSelect
                        name="sex"
                        value={editForm.sex}
                        onChange={handleEditFieldChange}
                      >
                        {SEX_OPTIONS.map((option) => (
                          <option key={option.value || "empty"} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </InlineSelect>
                    </DataValue>
                  </DataRow>
                  <DataRow>
                    <DataLabel>Data de nascimento</DataLabel>
                    <DataValue>
                      <InlineInput
                        type="text"
                        name="birth_date"
                        value={editForm.birth_date}
                        onChange={handleEditFieldChange}
                        placeholder="dd/mm/aaaa"
                        inputMode="numeric"
                        maxLength={10}
                      />
                    </DataValue>
                  </DataRow>
                  <DataRow>
                    <DataLabel>Idade</DataLabel>
                    <DataValue>{editAge !== null ? `${editAge} anos` : "-"}</DataValue>
                  </DataRow>
                  <DataRow>
                    <DataLabel>CPF</DataLabel>
                    <DataValue>
                      <InlineInput
                        name="cpf"
                        value={editForm.cpf}
                        onChange={handleEditFieldChange}
                        placeholder="000.000.000-00"
                      />
                    </DataValue>
                  </DataRow>
                  <DataRow>
                    <DataLabel>RG</DataLabel>
                    <DataValue>
                      <InlineInput
                        name="rg"
                        value={editForm.rg}
                        onChange={handleEditFieldChange}
                        placeholder="RG"
                      />
                    </DataValue>
                  </DataRow>
                  <DataRow>
                    <DataLabel>Estado civil</DataLabel>
                    <DataValue>
                      <InlineSelect
                        name="marital_status"
                        value={editForm.marital_status}
                        onChange={handleEditFieldChange}
                      >
                        {MARITAL_STATUS_OPTIONS.map((option) => (
                          <option key={option.value || "empty"} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </InlineSelect>
                    </DataValue>
                  </DataRow>
                  <DataRow>
                    <DataLabel>Profissao</DataLabel>
                    <DataValue>
                      <InlineInput
                        name="profession"
                        value={editForm.profession}
                        onChange={handleEditFieldChange}
                        placeholder="Profissao"
                      />
                    </DataValue>
                  </DataRow>
                  <DataRow>
                    <DataLabel>Atenção do paciente</DataLabel>
                    <DataValue>
                      <AttentionInlineSelect
                        name="attention_level"
                        value={editForm.attention_level}
                        onChange={handleEditFieldChange}
                        $level={editForm.attention_level}
                      >
                        {ATTENTION_LEVEL_OPTIONS.map((option) => (
                          <option
                            key={option.value || "empty"}
                            value={option.value}
                            style={buildAttentionOptionStyle(option.value)}
                          >
                            {option.label}
                          </option>
                        ))}
                      </AttentionInlineSelect>
                    </DataValue>
                  </DataRow>
                  <DataRow>
                    <DataLabel>Origem</DataLabel>
                    <DataValue>
                      <InlineSelect
                        name="referral_source"
                        value={editForm.referral_source}
                        onChange={handleEditFieldChange}
                      >
                        {REFERRAL_SOURCE_OPTIONS.map((option) => (
                          <option key={option.value || "empty"} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </InlineSelect>
                    </DataValue>
                  </DataRow>
                </DataList>
              )}
            </InfoCard>

            <InfoCard $editing={isContactEditing}>
              <CardHeader>
                <CardHeaderInfo>
                  <CardTitle>
                    <FaPhoneAlt /> Contato
                  </CardTitle>
                  {isContactEditing && <EditingBadge>Em edição</EditingBadge>}
                </CardHeaderInfo>
                {renderSectionActions(EDIT_SECTIONS.contact)}
              </CardHeader>
              {!isContactEditing && (
                <DataList>
                  <DataRow>
                    <DataLabel>Email</DataLabel>
                    <DataValue>{valueOrDash(patient?.email)}</DataValue>
                  </DataRow>
                  <DataRow>
                    <DataLabel>Telefone</DataLabel>
                    <DataValue>{valueOrDash(patient?.phone)}</DataValue>
                  </DataRow>
                  <DataRow>
                    <DataLabel>Instagram</DataLabel>
                    <DataValue>{valueOrDash(patient?.instagram)}</DataValue>
                  </DataRow>
                  <DataRow>
                    <DataLabel>Contato via WhatsApp</DataLabel>
                    <DataValue>
                      {formatBoolean(patient?.contact_via_whatsapp)}
                    </DataValue>
                  </DataRow>
                  <DataRow>
                    <DataLabel>Contato via telefone</DataLabel>
                    <DataValue>{formatBoolean(patient?.contact_via_phone)}</DataValue>
                  </DataRow>
                  <DataRow>
                    <DataLabel>Contato via email</DataLabel>
                    <DataValue>{formatBoolean(patient?.contact_via_email)}</DataValue>
                  </DataRow>
                </DataList>
              )}
              {isContactEditing && (
                <DataList>
                  <DataRow>
                    <DataLabel>Email</DataLabel>
                    <DataValue>
                      <InlineInput
                        type="email"
                        name="email"
                        value={editForm.email}
                        onChange={handleEditFieldChange}
                        placeholder="email@exemplo.com"
                      />
                    </DataValue>
                  </DataRow>
                  <DataRow>
                    <DataLabel>Telefone</DataLabel>
                    <DataValue>
                      <InlineInput
                        name="phone"
                        value={editForm.phone}
                        onChange={handleEditFieldChange}
                        placeholder="(00) 00000-0000"
                      />
                    </DataValue>
                  </DataRow>
                  <DataRow>
                    <DataLabel>Instagram</DataLabel>
                    <DataValue>
                      <InlineInput
                        name="instagram"
                        value={editForm.instagram}
                        onChange={handleEditFieldChange}
                        placeholder="@perfil"
                      />
                    </DataValue>
                  </DataRow>
                  <DataRow>
                    <DataLabel>Contato via WhatsApp</DataLabel>
                    <DataValue>
                      <CheckboxOption>
                        <input
                          type="checkbox"
                          name="contact_via_whatsapp"
                          checked={editForm.contact_via_whatsapp}
                          onChange={handleEditFieldChange}
                        />
                        <span>Permitir contato por WhatsApp</span>
                      </CheckboxOption>
                    </DataValue>
                  </DataRow>
                  <DataRow>
                    <DataLabel>Contato via telefone</DataLabel>
                    <DataValue>
                      <CheckboxOption>
                        <input
                          type="checkbox"
                          name="contact_via_phone"
                          checked={editForm.contact_via_phone}
                          onChange={handleEditFieldChange}
                        />
                        <span>Permitir contato por telefone</span>
                      </CheckboxOption>
                    </DataValue>
                  </DataRow>
                  <DataRow>
                    <DataLabel>Contato via email</DataLabel>
                    <DataValue>
                      <CheckboxOption>
                        <input
                          type="checkbox"
                          name="contact_via_email"
                          checked={editForm.contact_via_email}
                          onChange={handleEditFieldChange}
                        />
                        <span>Permitir contato por email</span>
                      </CheckboxOption>
                    </DataValue>
                  </DataRow>
                </DataList>
              )}
            </InfoCard>

            <InfoCard $editing={isAddressEditing}>
              <CardHeader>
                <CardHeaderInfo>
                  <CardTitle>Endereco</CardTitle>
                  {isAddressEditing && <EditingBadge>Em edição</EditingBadge>}
                </CardHeaderInfo>
                {renderSectionActions(EDIT_SECTIONS.address)}
              </CardHeader>
              {!isAddressEditing && (
                <DataList>
                  <DataRow>
                    <DataLabel>Endereco completo</DataLabel>
                    <DataValue>{valueOrDash(address)}</DataValue>
                  </DataRow>
                  <DataRow>
                    <DataLabel>Rua</DataLabel>
                    <DataValue>{valueOrDash(patient?.address_street)}</DataValue>
                  </DataRow>
                  <DataRow>
                    <DataLabel>Numero</DataLabel>
                    <DataValue>{valueOrDash(patient?.address_number)}</DataValue>
                  </DataRow>
                  <DataRow>
                    <DataLabel>Complemento</DataLabel>
                    <DataValue>{valueOrDash(patient?.address_complement)}</DataValue>
                  </DataRow>
                  <DataRow>
                    <DataLabel>Bairro</DataLabel>
                    <DataValue>{valueOrDash(patient?.address_neighborhood)}</DataValue>
                  </DataRow>
                  <DataRow>
                    <DataLabel>Cidade</DataLabel>
                    <DataValue>{valueOrDash(patient?.address_city)}</DataValue>
                  </DataRow>
                  <DataRow>
                    <DataLabel>UF</DataLabel>
                    <DataValue>{valueOrDash(patient?.address_state)}</DataValue>
                  </DataRow>
                  <DataRow>
                    <DataLabel>CEP</DataLabel>
                    <DataValue>{valueOrDash(patient?.address_zip)}</DataValue>
                  </DataRow>
                </DataList>
              )}
              {isAddressEditing && (
                <DataList>
                  <DataRow>
                    <DataLabel>Endereco completo</DataLabel>
                    <DataValue>{valueOrDash(editAddress)}</DataValue>
                  </DataRow>
                  <DataRow>
                    <DataLabel>Rua</DataLabel>
                    <DataValue>
                      <InlineInput
                        name="address_street"
                        value={editForm.address_street}
                        onChange={handleEditFieldChange}
                      />
                    </DataValue>
                  </DataRow>
                  <DataRow>
                    <DataLabel>Numero</DataLabel>
                    <DataValue>
                      <InlineInput
                        name="address_number"
                        value={editForm.address_number}
                        onChange={handleEditFieldChange}
                      />
                    </DataValue>
                  </DataRow>
                  <DataRow>
                    <DataLabel>Complemento</DataLabel>
                    <DataValue>
                      <InlineInput
                        name="address_complement"
                        value={editForm.address_complement}
                        onChange={handleEditFieldChange}
                      />
                    </DataValue>
                  </DataRow>
                  <DataRow>
                    <DataLabel>Bairro</DataLabel>
                    <DataValue>
                      <InlineInput
                        name="address_neighborhood"
                        value={editForm.address_neighborhood}
                        onChange={handleEditFieldChange}
                      />
                    </DataValue>
                  </DataRow>
                  <DataRow>
                    <DataLabel>Cidade</DataLabel>
                    <DataValue>
                      <InlineInput
                        name="address_city"
                        value={editForm.address_city}
                        onChange={handleEditFieldChange}
                      />
                    </DataValue>
                  </DataRow>
                  <DataRow>
                    <DataLabel>UF</DataLabel>
                    <DataValue>
                      <InlineInput
                        name="address_state"
                        value={editForm.address_state}
                        onChange={handleEditFieldChange}
                        maxLength={2}
                        placeholder="UF"
                      />
                    </DataValue>
                  </DataRow>
                  <DataRow>
                    <DataLabel>CEP</DataLabel>
                    <DataValue>
                      <InlineInput
                        name="address_zip"
                        value={editForm.address_zip}
                        onChange={handleEditFieldChange}
                      />
                    </DataValue>
                  </DataRow>
                </DataList>
              )}
            </InfoCard>

            <InfoCard $editing={isEmergencyEditing}>
              <CardHeader>
                <CardHeaderInfo>
                  <CardTitle>Contato de emergencia</CardTitle>
                  {isEmergencyEditing && <EditingBadge>Em edição</EditingBadge>}
                </CardHeaderInfo>
                {renderSectionActions(EDIT_SECTIONS.emergency)}
              </CardHeader>
              {!isEmergencyEditing && (
                <DataList>
                  <DataRow>
                    <DataLabel>Nome</DataLabel>
                    <DataValue>{valueOrDash(patient?.emergency_contact_name)}</DataValue>
                  </DataRow>
                  <DataRow>
                    <DataLabel>Parentesco</DataLabel>
                    <DataValue>
                      {valueOrDash(patient?.emergency_contact_relationship)}
                    </DataValue>
                  </DataRow>
                  <DataRow>
                    <DataLabel>Telefone</DataLabel>
                    <DataValue>{valueOrDash(patient?.emergency_contact_phone)}</DataValue>
                  </DataRow>
                </DataList>
              )}
              {isEmergencyEditing && (
                <DataList>
                  <DataRow>
                    <DataLabel>Nome</DataLabel>
                    <DataValue>
                      <InlineInput
                        name="emergency_contact_name"
                        value={editForm.emergency_contact_name}
                        onChange={handleEditFieldChange}
                        placeholder="Nome do contato"
                      />
                    </DataValue>
                  </DataRow>
                  <DataRow>
                    <DataLabel>Parentesco</DataLabel>
                    <DataValue>
                      <InlineInput
                        name="emergency_contact_relationship"
                        value={editForm.emergency_contact_relationship}
                        onChange={handleEditFieldChange}
                        placeholder="Ex.: Mae, Pai, Conjuge"
                      />
                    </DataValue>
                  </DataRow>
                  <DataRow>
                    <DataLabel>Telefone</DataLabel>
                    <DataValue>
                      <InlineInput
                        name="emergency_contact_phone"
                        value={editForm.emergency_contact_phone}
                        onChange={handleEditFieldChange}
                        placeholder="(00) 00000-0000"
                      />
                    </DataValue>
                  </DataRow>
                </DataList>
              )}
            </InfoCard>

            <InfoCard $editing={isClinicalEditing}>
              <CardHeader>
                <CardHeaderInfo>
                  <CardTitle>Informacoes clinicas</CardTitle>
                  {isClinicalEditing && <EditingBadge>Em edição</EditingBadge>}
                </CardHeaderInfo>
                {renderSectionActions(EDIT_SECTIONS.clinical)}
              </CardHeader>
              {!isClinicalEditing && (
                <DataList>
                  <DataRow>
                    <DataLabel>Queixa principal</DataLabel>
                    <DataValue>{valueOrDash(patient?.main_complaint)}</DataValue>
                  </DataRow>
                  <DataRow>
                    <DataLabel>Doencas/condicoes relevantes</DataLabel>
                    <DataValue>{valueOrDash(patient?.relevant_conditions)}</DataValue>
                  </DataRow>
                  <DataRow>
                    <DataLabel>Objetivo do tratamento</DataLabel>
                    <DataValue>{treatmentGoalDisplay}</DataValue>
                  </DataRow>
                  <DataRow>
                    <DataLabel>Objetivo (Outro)</DataLabel>
                    <DataValue>{valueOrDash(patient?.treatment_goal_other)}</DataValue>
                  </DataRow>
                </DataList>
              )}
              {isClinicalEditing && (
                <DataList>
                  <DataRow>
                    <DataLabel>Queixa principal</DataLabel>
                    <DataValue>
                      <InlineTextarea
                        name="main_complaint"
                        value={editForm.main_complaint}
                        onChange={handleEditFieldChange}
                        rows={4}
                      />
                    </DataValue>
                  </DataRow>
                  <DataRow>
                    <DataLabel>Doencas/condicoes relevantes</DataLabel>
                    <DataValue>
                      <InlineTextarea
                        name="relevant_conditions"
                        value={editForm.relevant_conditions}
                        onChange={handleEditFieldChange}
                        rows={4}
                        placeholder="Ex.: Hipertensao, diabetes, cardiopatia, labirintite etc."
                      />
                    </DataValue>
                  </DataRow>
                  <DataRow>
                    <DataLabel>Objetivo do tratamento</DataLabel>
                    <DataValue>
                      <TreatmentGoalOptions>
                        {TREATMENT_GOAL_OPTIONS.map((goal) => (
                          <CheckboxOption key={goal.value}>
                            <input
                              type="checkbox"
                              checked={editForm.treatment_goal_options.includes(goal.value)}
                              onChange={() => handleTreatmentGoalToggle(goal.value)}
                            />
                            <span>{goal.label}</span>
                          </CheckboxOption>
                        ))}
                        <CheckboxOption>
                          <input
                            type="checkbox"
                            checked={isTreatmentGoalOtherSelected}
                            onChange={() => handleTreatmentGoalToggle("other")}
                          />
                          <span>Outro</span>
                        </CheckboxOption>
                      </TreatmentGoalOptions>
                      {isTreatmentGoalOtherSelected && (
                        <TreatmentGoalOtherInput
                          name="treatment_goal_other"
                          value={editForm.treatment_goal_other}
                          onChange={handleEditFieldChange}
                          placeholder="Descreva"
                        />
                      )}
                    </DataValue>
                  </DataRow>
                </DataList>
              )}
            </InfoCard>

            <InfoCard $editing={isConsentEditing}>
              <CardHeader>
                <CardHeaderInfo>
                  <CardTitle>Consentimentos</CardTitle>
                  {isConsentEditing && <EditingBadge>Em edição</EditingBadge>}
                </CardHeaderInfo>
                {renderSectionActions(EDIT_SECTIONS.consent)}
              </CardHeader>
              {!isConsentEditing && (
                <DataList>
                  <DataRow>
                    <DataLabel>Consentimento LGPD</DataLabel>
                    <DataValue>
                      {formatBoolean(patient?.consent_data_processing)}
                    </DataValue>
                  </DataRow>
                  <DataRow>
                    <DataLabel>Consentimento de imagem</DataLabel>
                    <DataValue>{formatBoolean(patient?.consent_image_use)}</DataValue>
                  </DataRow>
                  <DataRow>
                    <DataLabel>Veracidade das informacoes</DataLabel>
                    <DataValue>{formatBoolean(patient?.consent_info_truth)}</DataValue>
                  </DataRow>
                </DataList>
              )}
              {isConsentEditing && (
                <DataList>
                  <DataRow>
                    <DataLabel>Consentimento LGPD</DataLabel>
                    <DataValue>
                      <CheckboxOption>
                        <input
                          type="checkbox"
                          name="consent_data_processing"
                          checked={editForm.consent_data_processing}
                          onChange={handleEditFieldChange}
                        />
                        <span>Autoriza a coleta e uso dos dados</span>
                      </CheckboxOption>
                    </DataValue>
                  </DataRow>
                  <DataRow>
                    <DataLabel>Consentimento de imagem</DataLabel>
                    <DataValue>
                      <CheckboxOption>
                        <input
                          type="checkbox"
                          name="consent_image_use"
                          checked={editForm.consent_image_use}
                          onChange={handleEditFieldChange}
                        />
                        <span>Autoriza uso de imagem, voz e depoimento</span>
                      </CheckboxOption>
                    </DataValue>
                  </DataRow>
                  <DataRow>
                    <DataLabel>Veracidade das informacoes</DataLabel>
                    <DataValue>
                      <CheckboxOption>
                        <input
                          type="checkbox"
                          name="consent_info_truth"
                          checked={editForm.consent_info_truth}
                          onChange={handleEditFieldChange}
                        />
                        <span>Declara que as informacoes sao verdadeiras</span>
                      </CheckboxOption>
                    </DataValue>
                  </DataRow>
                </DataList>
              )}
            </InfoCard>
          </Section>
        )}
        {selectedPackage && (
          <ModalOverlay>
            <ModalCard>
              <ModalHeader>
                <div>
                  <ModalTitle>Sessões do pacote</ModalTitle>
                  <ModalSubtitle>
                    <strong>{selectedPackage.serviceName}</strong>
                    <span>
                      {selectedPackage.doneCount}/{selectedPackage.totalSessions} realizadas
                    </span>
                  </ModalSubtitle>
                </div>
                <IconButton type="button" onClick={closePackageModal} aria-label="Fechar">
                  <FaTimes />
                </IconButton>
              </ModalHeader>
              <PackageSessionTableWrap>
                <PackageSessionTable>
                  <thead>
                    <tr>
                      <th>Data</th>
                      <th>Horário</th>
                      <th>Profissional</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedPackage.sessions.map((session) => (
                      <tr key={session.id}>
                        <td>{session.dateLabel}</td>
                        <td>{session.timeLabel}</td>
                        <td>{session.professionalName}</td>
                        <td>
                          <StatusPill>{session.statusLabel}</StatusPill>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </PackageSessionTable>
              </PackageSessionTableWrap>
            </ModalCard>
          </ModalOverlay>
        )}
      </PageContent>
    </PageWrapper>
  );
}

const Header = styled(ModuleHeader)`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 20px;

  @media (max-width: 720px) {
    flex-direction: column;
  }
`;

const HeaderTitle = styled(ModuleTitle)`
  margin-bottom: 0;
`;

const HeaderActions = styled.div`
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
`;

// const AddLink = styled(Link)`
//   display: inline-flex;
//   align-items: center;
//   justify-content: center;
//   padding: 10px 18px;
//   border-radius: 10px;
//   background: #6a795c;
//   color: #fff;
//   text-decoration: none;
//   font-weight: 700;
// `;

const Tabs = styled.div`
  display: flex;
  gap: 10px;
  margin-bottom: 20px;
  flex-wrap: wrap;
`;

const TabButton = styled.button`
  padding: 10px 16px;
  border-radius: 999px;
  border: 1px solid rgba(106, 121, 92, 0.3);
  background: ${(props) => (props.$active ? "#6a795c" : "#fff")};
  color: ${(props) => (props.$active ? "#fff" : "#6a795c")};
  font-weight: 600;
  cursor: pointer;
`;

const Section = styled.div`
  display: grid;
  gap: 16px;
`;

const InfoCard = styled.div`
  background: ${(props) => (props.$editing ? "#fcfdf8" : "#fff")};
  border-radius: 16px;
  border: 1px solid
    ${(props) =>
    props.$editing ? "rgba(190, 92, 92, 0.5)" : "rgba(106, 121, 92, 0.18)"};
  padding: 18px;
  box-shadow: ${(props) =>
    props.$editing
      ? "0 14px 30px rgba(190, 92, 92, 0.08)"
      : "0 10px 24px rgba(0, 0, 0, 0.06)"};
`;

const CardHeader = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;

  @media (max-width: 720px) {
    flex-direction: column;
  }
`;

const CardHeaderInfo = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
`;

const CardTitle = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  font-weight: 700;
  color: #1b1b1b;
`;

const CardTitleMeta = styled.span`
  color: #6a795c;
  font-size: 0.82rem;
  font-weight: 600;
`;

const EditingBadge = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 4px 10px;
  border-radius: 999px;
  background: rgba(106, 121, 92, 0.12);
  color: #55644c;
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 0.02em;
`;

const AttentionMissingPill = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 4px 10px;
  border-radius: 999px;
  background: rgba(165, 106, 0, 0.12);
  color: #8a5a00;
  border: 1px solid rgba(165, 106, 0, 0.22);
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 0.02em;
`;

const CardText = styled.div`
  margin-top: 10px;
  color: #6a795c;
  line-height: 1.5;
`;

const FrequencyHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
`;

const FrequencyRangeControl = styled.select`
  border-radius: 10px;
  border: 1px solid rgba(106, 121, 92, 0.24);
  background: #fff;
  color: #2d3629;
  min-height: 38px;
  padding: 0 12px;
  font-weight: 700;
`;

const FrequencySummaryGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 10px;
  margin-top: 14px;
`;

const FrequencySummaryCard = styled.div`
  border-radius: 10px;
  border: 1px solid
    ${(props) => {
    if (props.$tone === "positive") return "rgba(79, 124, 66, 0.28)";
    if (props.$tone === "attention") return "rgba(165, 106, 0, 0.26)";
    return "rgba(106, 121, 92, 0.14)";
  }};
  background: ${(props) => {
    if (props.$tone === "positive") return "rgba(79, 124, 66, 0.08)";
    if (props.$tone === "attention") return "rgba(165, 106, 0, 0.08)";
    return "#fcfdf8";
  }};
  padding: 12px;

  span {
    display: block;
    color: #6a795c;
    font-size: 0.78rem;
    font-weight: 800;
  }

  strong {
    display: block;
    margin-top: 4px;
    color: #1b1b1b;
    font-size: 1.35rem;
  }
`;

const FrequencyTableWrap = styled.div`
  margin-top: 14px;
  overflow-x: auto;
`;

const FrequencyTable = styled.table`
  width: 100%;
  border-collapse: collapse;
  min-width: 760px;

  th,
  td {
    border-bottom: 1px solid rgba(106, 121, 92, 0.12);
    padding: 10px 8px;
    text-align: left;
    vertical-align: middle;
  }

  th {
    color: #6a795c;
    font-size: 0.78rem;
    font-weight: 900;
  }

  td {
    color: #1b1b1b;
    font-size: 0.9rem;
  }

  td:first-child {
    text-transform: capitalize;
  }
`;

const PackageTableWrap = styled.div`
  margin-top: 14px;
  overflow-x: auto;
`;

const PackageTable = styled.table`
  width: 100%;
  border-collapse: collapse;
  min-width: 780px;

  th,
  td {
    border-bottom: 1px solid rgba(106, 121, 92, 0.12);
    padding: 10px 8px;
    text-align: left;
    vertical-align: middle;
  }

  th {
    color: #6a795c;
    font-size: 0.74rem;
    font-weight: 900;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }

  td {
    color: #1b1b1b;
    font-size: 0.9rem;
  }
`;

const TypePill = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 72px;
  border-radius: 999px;
  padding: 5px 9px;
  border: 1px solid
    ${(props) => (props.$kind === "package" ? "rgba(106, 121, 92, 0.22)" : "rgba(165, 106, 0, 0.22)")};
  background: ${(props) => (props.$kind === "package" ? "rgba(106, 121, 92, 0.09)" : "rgba(165, 106, 0, 0.09)")};
  color: ${(props) => (props.$kind === "package" ? "#55644c" : "#7a5000")};
  font-size: 0.78rem;
  font-weight: 900;
`;

const StatusPill = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  padding: 5px 9px;
  background: ${(props) => (props.$financial ? "rgba(106, 121, 92, 0.09)" : "#f2f4ef")};
  color: #3f4f38;
  font-size: 0.76rem;
  font-weight: 900;
`;

const FrequencyCellHighlight = styled.span`
  color: ${(props) => (props.$active ? "#8a5a00" : "#1b1b1b")};
  font-weight: ${(props) => (props.$active ? "900" : "700")};
`;

const AttendanceRatePill = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 46px;
  border-radius: 999px;
  padding: 4px 8px;
  background: ${(props) => {
    if (props.$tone === "positive") return "rgba(79, 124, 66, 0.12)";
    if (props.$tone === "attention") return "rgba(165, 106, 0, 0.12)";
    return "rgba(106, 121, 92, 0.1)";
  }};
  color: ${(props) => {
    if (props.$tone === "positive") return "#4f7c42";
    if (props.$tone === "attention") return "#8a5a00";
    return "#55644c";
  }};
  font-size: 0.78rem;
  font-weight: 900;
`;

const ReplacementCreditList = styled.div`
  display: grid;
  gap: 10px;
  margin-top: 14px;
`;

const ReplacementCreditItem = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  border-radius: 12px;
  border: 1px solid rgba(106, 121, 92, 0.16);
  background: ${(props) => (props.$status === "pending" ? "#fcfdf8" : "#f6f6f3")};
  padding: 12px;

  strong,
  span,
  small {
    display: block;
  }

  strong {
    color: #1b1b1b;
  }

  span,
  small {
    color: #6a795c;
    margin-top: 3px;
  }

  p {
    color: #2d3629;
    margin: 6px 0 0;
  }

  @media (max-width: 640px) {
    flex-direction: column;
  }
`;

const CardActions = styled.div`
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
`;

const CardButton = styled.button`
  padding: 8px 14px;
  border-radius: 10px;
  border: 1px solid rgba(106, 121, 92, 0.28);
  background: ${(props) => (props.$primary ? "#6a795c" : "#fff")};
  color: ${(props) => (props.$primary ? "#fff" : "#6a795c")};
  font-weight: 700;
  cursor: pointer;
  transition: filter 0.2s ease, opacity 0.2s ease;

  &:hover:not(:disabled) {
    filter: brightness(0.97);
  }

  &:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }
`;

const DataList = styled.div`
  display: grid;
  gap: 8px;
`;

const DataRow = styled.div`
  display: grid;
  grid-template-columns: minmax(170px, 240px) minmax(0, 1fr);
  gap: 8px;
  align-items: start;
  padding-bottom: 6px;
  border-bottom: 1px solid rgba(106, 121, 92, 0.12);

  &:last-child {
    border-bottom: none;
    padding-bottom: 0;
  }

  @media (max-width: 680px) {
    grid-template-columns: 1fr;
    gap: 4px;
  }
`;

const DataLabel = styled.span`
  color: #55644c;
  font-size: 0.87rem;
  font-weight: 700;
`;

const DataValue = styled.div`
  min-width: 0;
  width: 100%;
  color: #2d3629;
  font-size: 0.92rem;
  line-height: 1.4;
  white-space: pre-wrap;
  word-break: break-word;
`;

const fieldStyles = css`
  width: 100%;
  max-width: 100%;
  min-height: 42px;
  box-sizing: border-box;
  display: block;
  border-radius: 10px;
  border: 1px solid rgba(106, 121, 92, 0.2);
  padding: 0 12px;
  font-size: 0.95rem;
  color: #1b1b1b;
  background: #fff;

  &:focus {
    outline: none;
    border-color: rgba(106, 121, 92, 0.45);
    box-shadow: 0 0 0 3px rgba(106, 121, 92, 0.12);
  }
`;

const InlineInput = styled.input`
  ${fieldStyles}
`;

const InlineSelect = styled.select`
  ${fieldStyles}
`;

const AttentionInlineSelect = styled(InlineSelect)`
  ${({ $level }) => {
    const styles = resolveAttentionLevelStyles($level);
    return `
      color: ${styles.color};
      border-color: ${styles.border};
      background: ${styles.background};
      font-weight: 600;
    `;
  }}
`;

const AttentionBadge = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 0.78rem;
  font-weight: 700;

  ${({ $level }) => {
    const styles = resolveAttentionLevelStyles($level);
    return `
      color: ${styles.color};
      background: ${styles.background};
      border: 1px solid ${styles.border};
    `;
  }}
`;

const InlineTextarea = styled.textarea`
  ${fieldStyles}
  min-height: 110px;
  padding: 10px 12px;
  resize: vertical;
`;

const CheckboxOption = styled.label`
  display: flex;
  align-items: center;
  gap: 10px;
  color: #1b1b1b;
  font-size: 0.95rem;

  input[type="checkbox"] {
    width: 18px;
    height: 18px;
    margin: 0;
    accent-color: #6a795c;
    flex-shrink: 0;
  }
`;

const TreatmentGoalOptions = styled.div`
  display: grid;
  gap: 10px;
`;

const TreatmentGoalOtherInput = styled.input`
  ${fieldStyles}
  margin-top: 10px;
`;

const HistoryCardLink = styled(Link)`
  background: #fff;
  border-radius: 16px;
  border: 1px solid rgba(106, 121, 92, 0.18);
  padding: 16px;
  box-shadow: 0 10px 24px rgba(0, 0, 0, 0.06);
  text-decoration: none;
  transition: transform 0.15s ease, box-shadow 0.15s ease;

  p {
    color: #6a795c;
    margin-top: 8px;
  }

  &:hover {
    transform: translateY(-1px);
    box-shadow: 0 12px 26px rgba(0, 0, 0, 0.08);
  }
`;

const HistoryHeader = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;

  span {
    font-size: 0.85rem;
    color: #6a795c;
  }

  h3 {
    margin: 0;
    color: #1b1b1b;
  }
`;

const ModalOverlay = styled.div`
  position: fixed;
  inset: 0;
  z-index: 1200;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  background: rgba(27, 27, 27, 0.42);
`;

const ModalCard = styled.div`
  width: min(860px, 100%);
  max-height: min(720px, calc(100vh - 40px));
  overflow: hidden;
  border-radius: 16px;
  border: 1px solid rgba(106, 121, 92, 0.18);
  background: #fff;
  box-shadow: 0 24px 70px rgba(0, 0, 0, 0.22);
`;

const ModalHeader = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding: 18px 18px 12px;
  border-bottom: 1px solid rgba(106, 121, 92, 0.12);
`;

const ModalTitle = styled.h2`
  margin: 0;
  color: #1b1b1b;
  font-size: 1.25rem;
`;

const ModalSubtitle = styled.div`
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: 6px;
  color: #6a795c;
  font-size: 0.92rem;

  strong {
    color: #2d3629;
  }
`;

const IconButton = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 10px;
  border: 1px solid rgba(106, 121, 92, 0.2);
  background: #fff;
  color: #55644c;
  cursor: pointer;
`;

const PackageSessionTableWrap = styled.div`
  max-height: 560px;
  overflow: auto;
`;

const PackageSessionTable = styled.table`
  width: 100%;
  border-collapse: collapse;
  min-width: 540px;

  th,
  td {
    border-bottom: 1px solid rgba(106, 121, 92, 0.12);
    padding: 11px 14px;
    text-align: left;
    vertical-align: middle;
  }

  th {
    background: #f7f9f4;
    color: #6a795c;
    font-size: 0.76rem;
    font-weight: 900;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  td {
    color: #1b1b1b;
    font-size: 0.9rem;
  }
`;

const EmptyState = styled.div`
  text-align: center;
  color: #6a795c;
  padding: 24px 12px;
`;
