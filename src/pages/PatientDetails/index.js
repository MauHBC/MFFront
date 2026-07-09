import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useHistory, useParams } from "react-router-dom";
import styled, { css } from "styled-components";
import { toast } from "react-toastify";
import {
  FaInfoCircle,
  FaListAlt,
  FaPen,
  FaPhoneAlt,
  FaPlus,
  FaTimes,
  FaUserAlt,
} from "react-icons/fa";

import DataLoadingState from "../../components/DataLoadingState";
import axios from "../../services/axios";
import {
  createPatientClinicalCase,
  listPatientClinicalCases,
  updatePatientClinicalCase,
  updatePatientClinicalCaseStatus,
} from "../../services/patientClinicalCases";
import {
  createPatientClinicalReference,
  listPatientClinicalReferences,
  removePatientClinicalReference,
  updatePatientClinicalReference,
} from "../../services/patientClinicalReferences";
import {
  createPatientExternalProfessional,
  inactivatePatientExternalProfessional,
  listPatientExternalProfessionals,
  updatePatientExternalProfessional,
} from "../../services/patientExternalProfessionals";
import { PageWrapper, PageContent } from "../../components/AppLayout";
import {
  ModuleHeader,
  ModuleTitle,
} from "../../components/AppModuleShell";
import { PrimaryButton as SharedPrimaryButton } from "../../components/AppButton";
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
  prontuario: "prontuario",
  historico: "historico",
  dados: "dados",
};

const PATIENT_DETAILS_TAB_STORAGE_PREFIX = "patient-details-active-tab:";
const PATIENT_DETAILS_CASE_STORAGE_PREFIX = "patient-details-active-case:";

function isValidPatientDetailsTab(tab) {
  return Object.values(TABS).includes(tab);
}

function getPatientDetailsTabStorageKey(patientId) {
  return `${PATIENT_DETAILS_TAB_STORAGE_PREFIX}${patientId}`;
}

function getStoredPatientDetailsTab(patientId) {
  if (!patientId) return TABS.resumo;

  try {
    const storedTab = window.sessionStorage.getItem(
      getPatientDetailsTabStorageKey(patientId),
    );
    return isValidPatientDetailsTab(storedTab) ? storedTab : TABS.resumo;
  } catch (error) {
    return TABS.resumo;
  }
}

function storePatientDetailsTab(patientId, tab) {
  if (!patientId || !isValidPatientDetailsTab(tab)) return;

  try {
    window.sessionStorage.setItem(getPatientDetailsTabStorageKey(patientId), tab);
  } catch (error) {
    // Ignore storage failures; the screen should keep working normally.
  }
}

function getPatientDetailsCaseStorageKey(patientId) {
  return `${PATIENT_DETAILS_CASE_STORAGE_PREFIX}${patientId}`;
}

function getStoredPatientDetailsCase(patientId) {
  if (!patientId) return "all";

  try {
    const storedCase = window.sessionStorage.getItem(
      getPatientDetailsCaseStorageKey(patientId),
    );
    return storedCase || "all";
  } catch (error) {
    return "all";
  }
}

function storePatientDetailsCase(patientId, clinicalCaseId) {
  if (!patientId) return;

  try {
    window.sessionStorage.setItem(
      getPatientDetailsCaseStorageKey(patientId),
      clinicalCaseId || "all",
    );
  } catch (error) {
    // Ignore storage failures; the screen should keep working normally.
  }
}

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

const CLINICAL_REFERENCE_TYPES = [
  { value: "scientific_article", label: "Artigo científico" },
  { value: "protocol", label: "Protocolo" },
  { value: "video", label: "Vídeo" },
  { value: "guideline", label: "Guideline" },
  { value: "other", label: "Outro" },
];

const CLINICAL_REFERENCE_TYPE_LABELS = CLINICAL_REFERENCE_TYPES.reduce(
  (labels, option) => ({
    ...labels,
    [option.value]: option.label,
  }),
  {},
);

const PRONTUARIO_SECTIONS = {
  records: "records",
  references: "references",
};

const PAIN_SCALE_OPTIONS = ["", "0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10"];

const CLINICAL_CASE_STATUSES = [
  { value: "active", label: "Ativo" },
  { value: "resolved", label: "Resolvido" },
  { value: "archived", label: "Arquivado" },
];

const CLINICAL_CASE_STATUS_LABELS = CLINICAL_CASE_STATUSES.reduce(
  (labels, option) => ({
    ...labels,
    [option.value]: option.label,
  }),
  {},
);

const buildClinicalCaseForm = (clinicalCase = null) => ({
  title: clinicalCase?.title || "",
  chief_complaint: clinicalCase?.chief_complaint || "",
  status: clinicalCase?.status || "active",
  started_on: clinicalCase?.started_on || "",
  diagnosis_hypothesis: clinicalCase?.diagnosis_hypothesis || "",
  current_plan: clinicalCase?.current_plan || "",
  suggested_frequency: clinicalCase?.suggested_frequency || "",
  attention_points: clinicalCase?.attention_points || "",
});

const todayDateInput = () => new Date().toISOString().slice(0, 10);

function dateInputFromValue(value) {
  if (!value) return todayDateInput();
  const normalizedValue = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(normalizedValue)) return normalizedValue;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return todayDateInput();
  return date.toISOString().slice(0, 10);
}

const buildQuickEvolutionForm = (clinicalCaseId = "") => ({
  evolution_date: todayDateInput(),
  clinical_case_id: clinicalCaseId,
  evolution_text: "",
  conduct_text: "",
  pain_scale: "",
  pain_notes: "",
});

function getEvaluationPainScaleInputValue(evaluation) {
  const painScale = evaluation?.pain_scale ?? evaluation?.painScale;
  if (painScale === null || painScale === undefined || painScale === "") return "";
  return String(painScale);
}

const buildQuickEvolutionFormFromEvaluation = (evaluation) => ({
  evolution_date: dateInputFromValue(evaluation?.created_at || evaluation?.createdAt),
  clinical_case_id: evaluation?.clinical_case_id
    ? String(evaluation.clinical_case_id)
    : "",
  evolution_text: evaluation?.summary_text || evaluation?.summaryText || "",
  conduct_text: evaluation?.plan_text || evaluation?.planText || "",
  pain_scale: getEvaluationPainScaleInputValue(evaluation),
  pain_notes: evaluation?.pain_notes || evaluation?.painNotes || "",
});

const buildClinicalReferenceForm = (reference = null) => ({
  title: reference?.title || "",
  reference_text: reference?.reference_text || "",
  reference_type: reference?.reference_type || "scientific_article",
  clinical_question: reference?.clinical_question || "",
  notes: reference?.notes || "",
});

const EXTERNAL_PROFESSIONAL_TYPES = [
  { value: "personal_trainer", label: "Personal trainer" },
  { value: "physical_educator", label: "Educador físico" },
  { value: "nutritionist", label: "Nutricionista" },
  { value: "doctor", label: "Médico" },
  { value: "pilates", label: "Pilates" },
  { value: "other", label: "Outro" },
];

const EXTERNAL_PROFESSIONAL_TYPE_LABELS = EXTERNAL_PROFESSIONAL_TYPES.reduce(
  (labels, option) => ({
    ...labels,
    [option.value]: option.label,
  }),
  {},
);

const buildExternalProfessionalForm = (professional = null) => ({
  professional_type: professional?.professional_type || "personal_trainer",
  professional_name: professional?.professional_name || "",
  contact: professional?.contact || "",
  instagram_url: professional?.instagram_url || "",
  contact_authorized: professional?.contact_authorized === true,
  notes: professional?.notes || "",
  is_active: professional?.is_active !== false,
});

function normalizeExternalUrl(value) {
  if (value === null || value === undefined) return null;
  const normalized = String(value).trim();
  if (!normalized) return null;
  if (/^https?:\/\//i.test(normalized)) return normalized;
  return `https://${normalized}`;
}

function isHttpUrl(value) {
  try {
    const parsed = new URL(String(value || "").trim());
    return ["http:", "https:"].includes(parsed.protocol);
  } catch (error) {
    return false;
  }
}

function resolveAttentionLevelStyles(level) {
  return ATTENTION_LEVEL_STYLES[level] || ATTENTION_LEVEL_STYLES.default;
}

function getEvaluationTemplateTitle(evaluation) {
  const formInstances = evaluation?.FormInstances || evaluation?.form_instances || [];
  const firstInstance = Array.isArray(formInstances) ? formInstances[0] : null;
  const template = firstInstance?.FormTemplate || firstInstance?.form_template;
  return template?.title || null;
}

function getEvaluationClinicalCase(evaluation) {
  return evaluation?.PatientClinicalCase || evaluation?.patient_clinical_case || null;
}

function getEvaluationTypeLabel(evaluation) {
  if (evaluation?.record_type === "session") return "Evolução";
  if (evaluation?.evaluation_phase === "reassessment") return "Reavaliação";
  if (evaluation?.evaluation_phase === "initial") return "Avaliação inicial";
  return getEvaluationTemplateTitle(evaluation) ? "Registro completo" : "Avaliação";
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

function getEvaluationSummary(evaluation) {
  return cleanText(evaluation?.summary_text || evaluation?.summaryText);
}

function getEvaluationConduct(evaluation) {
  return cleanText(evaluation?.plan_text || evaluation?.planText);
}

function getEvaluationPainLabel(evaluation) {
  const painScale = evaluation?.pain_scale ?? evaluation?.painScale;
  const painNotes = cleanText(evaluation?.pain_notes || evaluation?.painNotes);
  const hasPainScale = painScale !== null && painScale !== undefined && painScale !== "";
  if (!hasPainScale && !painNotes) return null;
  if (hasPainScale && painNotes) return `Dor ${painScale}/10 · ${painNotes}`;
  if (hasPainScale) return `Dor ${painScale}/10`;
  return painNotes;
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
  const history = useHistory();
  const [activeTab, setActiveTab] = useState(() => getStoredPatientDetailsTab(id));
  const [activeProntuarioSection, setActiveProntuarioSection] = useState(
    PRONTUARIO_SECTIONS.records,
  );
  const [recordCaseFilter, setRecordCaseFilter] = useState(() =>
    getStoredPatientDetailsCase(id),
  );
  const [isLoading, setIsLoading] = useState(false);
  const [patient, setPatient] = useState(null);
  const [evaluations, setEvaluations] = useState([]);
  const [clinicalCases, setClinicalCases] = useState([]);
  const [isCaseManagerOpen, setIsCaseManagerOpen] = useState(false);
  const [clinicalCaseModal, setClinicalCaseModal] = useState(null);
  const [clinicalCaseForm, setClinicalCaseForm] = useState(() =>
    buildClinicalCaseForm(),
  );
  const [expandedCaseSummaryFields, setExpandedCaseSummaryFields] = useState({});
  const [activeCaseDetailSection, setActiveCaseDetailSection] = useState("chief_complaint");
  const [isSavingClinicalCase, setIsSavingClinicalCase] = useState(false);
  const [isUpdatingClinicalCaseStatus, setIsUpdatingClinicalCaseStatus] =
    useState(false);
  const [quickEvolutionModal, setQuickEvolutionModal] = useState(false);
  const [quickEvolutionEditTarget, setQuickEvolutionEditTarget] = useState(null);
  const [quickEvolutionForm, setQuickEvolutionForm] = useState(() =>
    buildQuickEvolutionForm(),
  );
  const [isSavingQuickEvolution, setIsSavingQuickEvolution] = useState(false);
  const [clinicalReferences, setClinicalReferences] = useState([]);
  const [selectedClinicalReference, setSelectedClinicalReference] = useState(null);
  const [clinicalReferenceDeleteTarget, setClinicalReferenceDeleteTarget] = useState(null);
  const [clinicalReferenceEditReturn, setClinicalReferenceEditReturn] = useState(null);
  const [clinicalReferenceModal, setClinicalReferenceModal] = useState(null);
  const [clinicalReferenceForm, setClinicalReferenceForm] = useState(() =>
    buildClinicalReferenceForm(),
  );
  const [isSavingClinicalReference, setIsSavingClinicalReference] = useState(false);
  const [isDeletingClinicalReference, setIsDeletingClinicalReference] = useState(false);
  const [frequencySessions, setFrequencySessions] = useState([]);
  const [perSessionSessions, setPerSessionSessions] = useState([]);
  const [perSessionSeries, setPerSessionSeries] = useState([]);
  const [selectedPackage, setSelectedPackage] = useState(null);
  const [replacementCredits, setReplacementCredits] = useState([]);
  const [externalProfessionals, setExternalProfessionals] = useState([]);
  const [externalProfessionalModal, setExternalProfessionalModal] = useState(null);
  const [externalProfessionalForm, setExternalProfessionalForm] = useState(() =>
    buildExternalProfessionalForm(),
  );
  const [isSavingExternalProfessional, setIsSavingExternalProfessional] = useState(false);
  const [operationalPolicy, setOperationalPolicy] = useState(DEFAULT_OPERATIONAL_POLICY);
  const [frequencyRangeMonths, setFrequencyRangeMonths] = useState(3);
  const [editingSection, setEditingSection] = useState(null);
  const [isSavingSection, setIsSavingSection] = useState(false);
  const [editForm, setEditForm] = useState(() => buildPatientForm(null));

  useEffect(() => {
    setActiveTab(getStoredPatientDetailsTab(id));
  }, [id]);

  useEffect(() => {
    storePatientDetailsTab(id, activeTab);
  }, [activeTab, id]);

  useEffect(() => {
    setRecordCaseFilter(getStoredPatientDetailsCase(id));
  }, [id]);

  useEffect(() => {
    storePatientDetailsCase(id, recordCaseFilter);
  }, [id, recordCaseFilter]);

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
          clinicalCasesResponse,
          clinicalReferencesResponse,
          sessionsResponse,
          allSessionsResponse,
          sessionSeriesResponse,
          replacementCreditsResponse,
          externalProfessionalsResponse,
          operationalPolicyResponse,
        ] = await Promise.all([
          axios.get(`/patients/${id}`),
          axios.get(`/evaluations?patient_id=${id}`),
          listPatientClinicalCases({ patient_id: id }),
          listPatientClinicalReferences({ patient_id: id }),
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
          listPatientExternalProfessionals({ patient_id: id }),
          axios.get("/unit-scheduling-policy"),
        ]);
        setPatient(patientResponse.data);
        setEvaluations(Array.isArray(evalResponse.data) ? evalResponse.data : []);
        setClinicalCases(
          Array.isArray(clinicalCasesResponse.data)
            ? clinicalCasesResponse.data
            : [],
        );
        setClinicalReferences(
          Array.isArray(clinicalReferencesResponse.data)
            ? clinicalReferencesResponse.data
            : [],
        );
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
        setExternalProfessionals(
          Array.isArray(externalProfessionalsResponse.data)
            ? externalProfessionalsResponse.data
            : [],
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
  const activeClinicalCases = useMemo(
    () => clinicalCases.filter((item) => item.status === "active"),
    [clinicalCases],
  );
  const inactiveClinicalCases = useMemo(
    () => clinicalCases.filter((item) => item.status !== "active"),
    [clinicalCases],
  );
  const filteredEvaluations = useMemo(() => {
    if (recordCaseFilter === "all") return evaluations;
    if (recordCaseFilter === "none") {
      return evaluations.filter((evaluation) => !evaluation.clinical_case_id);
    }
    return evaluations.filter(
      (evaluation) => Number(evaluation.clinical_case_id) === Number(recordCaseFilter),
    );
  }, [evaluations, recordCaseFilter]);
  const selectedRecordCase = useMemo(() => {
    if (recordCaseFilter === "all" || recordCaseFilter === "none") return null;
    return clinicalCases.find(
      (clinicalCase) => String(clinicalCase.id) === String(recordCaseFilter),
    ) || null;
  }, [clinicalCases, recordCaseFilter]);
	  useEffect(() => {
	    setExpandedCaseSummaryFields({});
	    setActiveCaseDetailSection("chief_complaint");
	  }, [selectedRecordCase?.id]);
	  const selectedCaseDetailSections = useMemo(() => {
	    if (!selectedRecordCase) return [];
	    return [
	      {
	        key: "chief_complaint",
	        label: "Queixa principal",
	        title: "Resumo clínico / queixa principal",
	        value: selectedRecordCase.chief_complaint,
	        fallback: "Sem resumo clínico registrado.",
	      },
	      {
	        key: "diagnosis_hypothesis",
	        label: "Hipótese",
	        title: "Hipótese / diagnóstico",
	        value: selectedRecordCase.diagnosis_hypothesis,
	        fallback: "Sem hipótese registrada.",
	      },
	      {
	        key: "current_plan",
	        label: "Plano",
	        title: "Plano atual / conduta",
	        value: selectedRecordCase.current_plan,
	        fallback: "Sem plano atual registrado.",
	      },
	      {
	        key: "suggested_frequency",
	        label: "Frequência",
	        title: "Frequência sugerida",
	        value: selectedRecordCase.suggested_frequency,
	        fallback: "Sem frequência sugerida registrada.",
	      },
	      {
	        key: "attention_points",
	        label: "Atenção",
	        title: "Observações finais / pontos de atenção",
	        value: selectedRecordCase.attention_points,
	        fallback: "Sem observações finais registradas.",
	      },
	    ];
	  }, [selectedRecordCase]);
	  const activeCaseDetail = useMemo(() => (
	    selectedCaseDetailSections.find((section) => section.key === activeCaseDetailSection)
	      || selectedCaseDetailSections[0]
	      || null
	  ), [activeCaseDetailSection, selectedCaseDetailSections]);
  const lastRecordName = latestEval
    ? getEvaluationTemplateTitle(latestEval) || summaryText || planText || "Avaliação"
    : "Nenhum registro encontrado.";
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
  const showProntuario = useCallback(() => {
    setActiveTab(TABS.prontuario);
    setActiveProntuarioSection(PRONTUARIO_SECTIONS.records);
  }, []);
  const showHistorico = useCallback(() => setActiveTab(TABS.historico), []);
  const showDados = useCallback(() => setActiveTab(TABS.dados), []);
  const closePackageModal = useCallback(() => setSelectedPackage(null), []);

  const reloadEvaluations = useCallback(async () => {
    if (!id) return;
    const response = await axios.get(`/evaluations?patient_id=${id}`);
    setEvaluations(Array.isArray(response.data) ? response.data : []);
  }, [id]);

  const resolveDefaultCaseIdForRecord = useCallback(() => (
    recordCaseFilter !== "all" && recordCaseFilter !== "none"
      ? String(recordCaseFilter)
      : ""
  ), [recordCaseFilter]);

  const openQuickEvolutionModal = useCallback(() => {
    setQuickEvolutionEditTarget(null);
    setQuickEvolutionForm(buildQuickEvolutionForm(resolveDefaultCaseIdForRecord()));
    setQuickEvolutionModal(true);
  }, [resolveDefaultCaseIdForRecord]);

  const openQuickEvolutionEditModal = useCallback((evaluation) => {
    if (!evaluation?.id || evaluation.record_type !== "session") return;
    setQuickEvolutionEditTarget(evaluation);
    setQuickEvolutionForm(buildQuickEvolutionFormFromEvaluation(evaluation));
    setQuickEvolutionModal(true);
  }, []);

  const openCaseEvaluationForm = useCallback(() => {
    if (!selectedRecordCase?.id) return;
    history.push(`/pacientes/${id}/avaliacoes/nova?case=${selectedRecordCase.id}`);
  }, [history, id, selectedRecordCase]);

  const closeQuickEvolutionModal = useCallback(() => {
    if (isSavingQuickEvolution) return;
    setQuickEvolutionModal(false);
    setQuickEvolutionEditTarget(null);
    setQuickEvolutionForm(buildQuickEvolutionForm());
  }, [isSavingQuickEvolution]);

  const handleQuickEvolutionFieldChange = useCallback((event) => {
    const { name, value } = event.target;
    setQuickEvolutionForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  }, []);

  const handleQuickEvolutionPainScaleChange = useCallback((value) => {
    setQuickEvolutionForm((prev) => ({
      ...prev,
      pain_scale: value,
    }));
  }, []);

  const handleSaveQuickEvolution = useCallback(async () => {
    const evolutionText = cleanText(quickEvolutionForm.evolution_text);
    if (!evolutionText || evolutionText.length < 2) {
      toast.error("Informe o texto da evolução.");
      return;
    }

    setIsSavingQuickEvolution(true);
    try {
      const payload = {
        patient_id: id,
        evolution_date: quickEvolutionForm.evolution_date,
        clinical_case_id: quickEvolutionForm.clinical_case_id
          ? Number(quickEvolutionForm.clinical_case_id)
          : null,
        evolution_text: evolutionText,
        conduct_text: cleanText(quickEvolutionForm.conduct_text),
        pain_scale: quickEvolutionForm.pain_scale
          ? Number(quickEvolutionForm.pain_scale)
          : null,
        pain_notes: cleanText(quickEvolutionForm.pain_notes),
      };

      if (quickEvolutionEditTarget?.id) {
        await axios.put(`/evaluations/${quickEvolutionEditTarget.id}`, {
          clinical_case_id: payload.clinical_case_id,
          summary_text: payload.evolution_text,
          plan_text: payload.conduct_text,
          pain_scale: payload.pain_scale,
          pain_notes: payload.pain_notes,
          created_at: payload.evolution_date,
        });
        toast.success("Evolução atualizada.");
      } else {
        await axios.post("/evaluations/quick-evolution", payload);
        toast.success("Evolução registrada.");
      }
      setQuickEvolutionModal(false);
      setQuickEvolutionEditTarget(null);
      setQuickEvolutionForm(buildQuickEvolutionForm());
      await reloadEvaluations();
    } catch (error) {
      toast.error(
        error?.response?.data?.error ||
          "Não foi possível registrar a evolução.",
      );
    } finally {
      setIsSavingQuickEvolution(false);
    }
  }, [id, quickEvolutionEditTarget, quickEvolutionForm, reloadEvaluations]);

  const reloadClinicalCases = useCallback(async () => {
    if (!id) return;
    const response = await listPatientClinicalCases({ patient_id: id });
    setClinicalCases(Array.isArray(response.data) ? response.data : []);
  }, [id]);

  const openClinicalCaseCreateModal = useCallback(() => {
    setClinicalCaseForm(buildClinicalCaseForm());
    setClinicalCaseModal({ mode: "create", item: null });
  }, []);

  const openClinicalCaseEditModal = useCallback((clinicalCase) => {
    setClinicalCaseForm(buildClinicalCaseForm(clinicalCase));
    setClinicalCaseModal({ mode: "edit", item: clinicalCase });
  }, []);

  const closeClinicalCaseModal = useCallback(() => {
    if (isSavingClinicalCase) return;
    setClinicalCaseModal(null);
    setClinicalCaseForm(buildClinicalCaseForm());
  }, [isSavingClinicalCase]);

	  const handleClinicalCaseFieldChange = useCallback((event) => {
	    const { name, value } = event.target;
	    setClinicalCaseForm((prev) => ({
	      ...prev,
	      [name]: value,
	    }));
	  }, []);

	  const toggleCaseSummaryField = useCallback((field) => {
	    setExpandedCaseSummaryFields((prev) => ({
	      ...prev,
	      [field]: !prev[field],
	    }));
	  }, []);

  const handleSaveClinicalCase = useCallback(async () => {
    const title = cleanText(clinicalCaseForm.title);

    if (!title || title.length < 2) {
      toast.error("Informe o nome do caso clinico.");
      return;
    }

    const payload = {
      patient_id: id,
      title,
      chief_complaint: cleanText(clinicalCaseForm.chief_complaint),
      status: clinicalCaseForm.status,
      started_on: cleanText(clinicalCaseForm.started_on),
	      diagnosis_hypothesis: cleanText(clinicalCaseForm.diagnosis_hypothesis),
	      current_plan: cleanText(clinicalCaseForm.current_plan),
	      suggested_frequency: cleanText(clinicalCaseForm.suggested_frequency),
	      attention_points: cleanText(clinicalCaseForm.attention_points),
	    };

    setIsSavingClinicalCase(true);
    try {
      if (clinicalCaseModal?.mode === "edit" && clinicalCaseModal?.item?.id) {
        await updatePatientClinicalCase(clinicalCaseModal.item.id, payload);
        toast.success("Caso clinico atualizado.");
      } else {
        await createPatientClinicalCase(payload);
        toast.success("Caso clinico criado.");
      }
      setClinicalCaseModal(null);
      setClinicalCaseForm(buildClinicalCaseForm());
      await reloadClinicalCases();
    } catch (error) {
      toast.error(
        error?.response?.data?.error ||
          "Nao foi possivel salvar o caso clinico.",
      );
    } finally {
      setIsSavingClinicalCase(false);
    }
  }, [
    clinicalCaseForm,
    clinicalCaseModal,
    id,
    reloadClinicalCases,
  ]);

  const handleClinicalCaseStatusChange = useCallback(async (clinicalCase, status) => {
    if (!clinicalCase?.id || clinicalCase.status === status) return;
    setIsUpdatingClinicalCaseStatus(true);
    try {
      await updatePatientClinicalCaseStatus(clinicalCase.id, status);
      toast.success("Status do caso atualizado.");
      await reloadClinicalCases();
    } catch (error) {
      toast.error(
        error?.response?.data?.error ||
          "Nao foi possivel atualizar o status do caso.",
      );
    } finally {
      setIsUpdatingClinicalCaseStatus(false);
    }
  }, [reloadClinicalCases]);

  const reloadClinicalReferences = useCallback(async () => {
    if (!id) return;
    const response = await listPatientClinicalReferences({ patient_id: id });
    setClinicalReferences(Array.isArray(response.data) ? response.data : []);
  }, [id]);

  const openClinicalReferenceCreateModal = useCallback(() => {
    setClinicalReferenceForm(buildClinicalReferenceForm());
    setClinicalReferenceModal({ mode: "create", item: null });
  }, []);

  const openClinicalReferenceEditModal = useCallback((reference) => {
    setClinicalReferenceForm(buildClinicalReferenceForm(reference));
    setClinicalReferenceModal({ mode: "edit", item: reference });
  }, []);

  const openClinicalReferenceDetailModal = useCallback((reference) => {
    setSelectedClinicalReference(reference);
  }, []);

  const closeClinicalReferenceDetailModal = useCallback(() => {
    setSelectedClinicalReference(null);
  }, []);

  const closeClinicalReferenceModal = useCallback(() => {
    if (isSavingClinicalReference) return;
    setClinicalReferenceModal(null);
    setClinicalReferenceForm(buildClinicalReferenceForm());
    if (clinicalReferenceModal?.mode === "edit" && clinicalReferenceEditReturn) {
      setSelectedClinicalReference(clinicalReferenceEditReturn);
      setClinicalReferenceEditReturn(null);
    }
  }, [clinicalReferenceEditReturn, clinicalReferenceModal, isSavingClinicalReference]);

  const handleClinicalReferenceFieldChange = useCallback((event) => {
    const { name, value } = event.target;
    setClinicalReferenceForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  }, []);

  const handleSaveClinicalReference = useCallback(async () => {
    const title = cleanText(clinicalReferenceForm.title);
    const referenceText = cleanText(clinicalReferenceForm.reference_text);

    if (!title || title.length < 2) {
      toast.error("Informe o título da referência.");
      return;
    }
    if (!referenceText || referenceText.length < 2) {
      toast.error("Informe o link ou referência.");
      return;
    }

    const payload = {
      patient_id: id,
      title,
      reference_text: referenceText,
      reference_type: clinicalReferenceForm.reference_type,
      clinical_question: cleanText(clinicalReferenceForm.clinical_question),
      notes: cleanText(clinicalReferenceForm.notes),
    };

    setIsSavingClinicalReference(true);
    try {
      if (clinicalReferenceModal?.mode === "edit" && clinicalReferenceModal?.item?.id) {
        await updatePatientClinicalReference(clinicalReferenceModal.item.id, payload);
        toast.success("Referência atualizada.");
      } else {
        await createPatientClinicalReference(payload);
        toast.success("Referência adicionada.");
      }
      setClinicalReferenceModal(null);
      setClinicalReferenceForm(buildClinicalReferenceForm());
      setClinicalReferenceEditReturn(null);
      await reloadClinicalReferences();
    } catch (error) {
      toast.error(
        error?.response?.data?.error ||
          "Não foi possível salvar a referência clínica.",
      );
    } finally {
      setIsSavingClinicalReference(false);
    }
  }, [
    clinicalReferenceForm,
    clinicalReferenceModal,
    id,
    reloadClinicalReferences,
  ]);

  const handleRemoveClinicalReference = useCallback(async (reference) => {
    if (!reference?.id) return false;
    setIsDeletingClinicalReference(true);
    try {
      await removePatientClinicalReference(reference.id);
      toast.success("Referência excluída.");
      await reloadClinicalReferences();
      return true;
    } catch (error) {
      toast.error(
        error?.response?.data?.error ||
          "Não foi possível excluir a referência clínica.",
      );
      return false;
    } finally {
      setIsDeletingClinicalReference(false);
    }
  }, [reloadClinicalReferences]);

  const handleEditSelectedClinicalReference = useCallback(() => {
    if (!selectedClinicalReference) return;
    setClinicalReferenceEditReturn(selectedClinicalReference);
    openClinicalReferenceEditModal(selectedClinicalReference);
    setSelectedClinicalReference(null);
  }, [openClinicalReferenceEditModal, selectedClinicalReference]);

  const handleOpenDeleteClinicalReference = useCallback(() => {
    if (!selectedClinicalReference) return;
    setClinicalReferenceDeleteTarget(selectedClinicalReference);
  }, [selectedClinicalReference]);

  const handleCancelDeleteClinicalReference = useCallback(() => {
    if (isDeletingClinicalReference) return;
    setClinicalReferenceDeleteTarget(null);
  }, [isDeletingClinicalReference]);

  const handleConfirmDeleteClinicalReference = useCallback(async () => {
    if (!clinicalReferenceDeleteTarget) return;
    const removed = await handleRemoveClinicalReference(clinicalReferenceDeleteTarget);
    if (removed) {
      setClinicalReferenceDeleteTarget(null);
      setSelectedClinicalReference(null);
    }
  }, [clinicalReferenceDeleteTarget, handleRemoveClinicalReference]);

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

  const reloadExternalProfessionals = useCallback(async () => {
    if (!id) return;
    const response = await listPatientExternalProfessionals({ patient_id: id });
    setExternalProfessionals(Array.isArray(response.data) ? response.data : []);
  }, [id]);

  const openExternalProfessionalCreateModal = useCallback(() => {
    setExternalProfessionalForm(buildExternalProfessionalForm());
    setExternalProfessionalModal({ mode: "create", item: null });
  }, []);

  const openExternalProfessionalEditModal = useCallback((professional) => {
    setExternalProfessionalForm(buildExternalProfessionalForm(professional));
    setExternalProfessionalModal({ mode: "edit", item: professional });
  }, []);

  const closeExternalProfessionalModal = useCallback(() => {
    if (isSavingExternalProfessional) return;
    setExternalProfessionalModal(null);
    setExternalProfessionalForm(buildExternalProfessionalForm());
  }, [isSavingExternalProfessional]);

  const handleExternalProfessionalFieldChange = useCallback((event) => {
    const { name, value, type, checked } = event.target;
    setExternalProfessionalForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  }, []);

  const handleSaveExternalProfessional = useCallback(async () => {
    const professionalName = cleanText(externalProfessionalForm.professional_name);
    if (!professionalName || professionalName.length < 2) {
      toast.error("Informe o nome do profissional.");
      return;
    }

    const payload = {
      patient_id: id,
      professional_type: externalProfessionalForm.professional_type,
      professional_name: professionalName,
      contact: cleanText(externalProfessionalForm.contact),
      instagram_url: normalizeExternalUrl(externalProfessionalForm.instagram_url),
      contact_authorized: externalProfessionalForm.contact_authorized,
      notes: cleanText(externalProfessionalForm.notes),
      is_active: externalProfessionalForm.is_active,
    };

    setIsSavingExternalProfessional(true);
    try {
      if (externalProfessionalModal?.mode === "edit" && externalProfessionalModal?.item?.id) {
        await updatePatientExternalProfessional(externalProfessionalModal.item.id, payload);
        toast.success("Profissional atualizado.");
      } else {
        await createPatientExternalProfessional(payload);
        toast.success("Profissional adicionado.");
      }
      setExternalProfessionalModal(null);
      setExternalProfessionalForm(buildExternalProfessionalForm());
      await reloadExternalProfessionals();
    } catch (error) {
      toast.error(
        error?.response?.data?.error ||
          "Não foi possível salvar o profissional externo.",
      );
    } finally {
      setIsSavingExternalProfessional(false);
    }
  }, [
    externalProfessionalForm,
    externalProfessionalModal,
    id,
    reloadExternalProfessionals,
  ]);

  const handleInactivateExternalProfessional = useCallback(async (professional) => {
    // eslint-disable-next-line no-alert
    const confirmed = window.confirm(
      `Inativar ${professional.professional_name}?`,
    );
    if (!confirmed) return;

    try {
      await inactivatePatientExternalProfessional(professional.id);
      toast.success("Profissional inativado.");
      await reloadExternalProfessionals();
    } catch (error) {
      toast.error(
        error?.response?.data?.error ||
          "Não foi possível inativar o profissional externo.",
      );
    }
  }, [reloadExternalProfessionals]);

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

	  const renderClinicalTimeline = useCallback(
    (items, { showCaseLabel = true } = {}) => {
      if (!items.length) {
        return <EmptyState>Nenhum registro clínico encontrado.</EmptyState>;
      }

      return (
        <TimelineList>
          {items.map((evaluation) => {
            const typeLabel = getEvaluationTypeLabel(evaluation);
            const templateTitle = getEvaluationTemplateTitle(evaluation);
            const summary = getEvaluationSummary(evaluation);
            const conduct = getEvaluationConduct(evaluation);
            const painLabel = getEvaluationPainLabel(evaluation);
            const title = templateTitle || summary || typeLabel;
            const createdAt = formatDate(
              evaluation.created_at || evaluation.createdAt,
            );
            const clinicalCase = getEvaluationClinicalCase(evaluation);
            const isSession = evaluation.record_type === "session";

            return (
              <TimelineItem
                key={evaluation.id || `${createdAt}-${title}`}
                $compact={isSession}
              >
	                <TimelineMarker $type={evaluation.record_type} />
	                <TimelineCard $compact={isSession}>
	                  {isSession ? (
	                    <TimelineCardContent>
	                      <TimelineCardHeader>
	                        <TimelineCardMeta>
	                          <TimelineDate>{createdAt}</TimelineDate>
	                          <RecordTypePill $type={evaluation.record_type}>
	                            {typeLabel}
	                          </RecordTypePill>
	                          {showCaseLabel && (
	                            <CaseLinkLabel>
	                              {clinicalCase?.title || "Não organizados"}
	                            </CaseLinkLabel>
	                          )}
	                        </TimelineCardMeta>
	                      </TimelineCardHeader>
	                      {summary && (
	                        <TimelineClinicalLine>
	                          <strong>Evolução</strong>
	                          <span>{summary}</span>
	                        </TimelineClinicalLine>
	                      )}
	                      {conduct && (
	                        <TimelineClinicalLine>
	                          <strong>Conduta</strong>
	                          <span>{conduct}</span>
	                        </TimelineClinicalLine>
	                      )}
	                      {painLabel && (
	                        <TimelinePainLine>{painLabel}</TimelinePainLine>
	                      )}
	                    </TimelineCardContent>
	                  ) : (
	                    <TimelineCardLink to={`/pacientes/${id}/avaliacoes/${evaluation.id}`}>
	                    <TimelineCardHeader>
	                      <TimelineCardMeta>
	                        <TimelineDate>{createdAt}</TimelineDate>
                        <RecordTypePill $type={evaluation.record_type}>
                          {typeLabel}
                        </RecordTypePill>
                        {showCaseLabel && (
                          <CaseLinkLabel>
                            {clinicalCase?.title || "Não organizados"}
                          </CaseLinkLabel>
                        )}
                      </TimelineCardMeta>
                    </TimelineCardHeader>
                    <TimelineCardTitle>{title}</TimelineCardTitle>
                    {summary && summary !== title && (
                      <TimelineText>{summary}</TimelineText>
                    )}
                    {conduct && (
                      <TimelineClinicalLine>
                        <strong>Conduta</strong>
                        <span>{conduct}</span>
                      </TimelineClinicalLine>
                    )}
	                    {painLabel && (
	                      <TimelinePainLine>{painLabel}</TimelinePainLine>
	                    )}
	                    </TimelineCardLink>
	                  )}
	                  {isSession && (
	                    <TimelineCardActions>
	                      <TimelineEditButton
	                        type="button"
	                        onClick={() => openQuickEvolutionEditModal(evaluation)}
	                      >
	                        Editar
	                      </TimelineEditButton>
	                    </TimelineCardActions>
	                  )}
	                </TimelineCard>
              </TimelineItem>
            );
          })}
        </TimelineList>
      );
    },
	    [id, openQuickEvolutionEditModal],
	  );

  const quickEvolutionSaveLabel = quickEvolutionEditTarget
    ? "Salvar alterações"
    : "Salvar evolução";

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
            onClick={showProntuario}
            $active={activeTab === TABS.prontuario}
          >
            Prontuário
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
                {lastDate} - {lastRecordName}
              </CardText>
            </InfoCard>
            <InfoCard>
              <CardHeader>
                <CardHeaderInfo>
                  <CardTitle>
                    <FaUserAlt /> Acompanhamento externo do tratamento
                  </CardTitle>
                </CardHeaderInfo>
                <CardActions>
                  <CardButton
                    type="button"
                    $primary
                    onClick={openExternalProfessionalCreateModal}
                  >
                    <FaPlus /> Adicionar profissional
                  </CardButton>
                </CardActions>
              </CardHeader>
              {externalProfessionals.length === 0 && (
                <EmptyState>Nenhum acompanhamento externo registrado.</EmptyState>
              )}
              {externalProfessionals.length > 0 && (
                <ExternalProfessionalList>
                  {externalProfessionals.map((professional) => (
                    <ExternalProfessionalItem
                      key={professional.id}
                      $inactive={professional.is_active === false}
                    >
                      <ExternalProfessionalMain>
                        <ExternalProfessionalHeader>
                          <strong>{professional.professional_name}</strong>
                          <StatusPill>
                            {EXTERNAL_PROFESSIONAL_TYPE_LABELS[professional.professional_type] ||
                              "Outro"}
                          </StatusPill>
                          {professional.is_active === false && (
                            <StatusPill>Inativo</StatusPill>
                          )}
                        </ExternalProfessionalHeader>
                        <ExternalProfessionalMeta>
                          <span>Contato: {valueOrDash(professional.contact)}</span>
                          <span>
                            Instagram:{" "}
                            {professional.instagram_url ? (
                              <ExternalProfessionalLink
                                href={normalizeExternalUrl(professional.instagram_url)}
                                target="_blank"
                                rel="noreferrer"
                              >
                                Abrir perfil
                              </ExternalProfessionalLink>
                            ) : (
                              "-"
                            )}
                          </span>
                          <span>
                            Autorização para contato:{" "}
                            <strong>{formatBoolean(professional.contact_authorized)}</strong>
                          </span>
                        </ExternalProfessionalMeta>
                        {professional.notes && (
                          <ExternalProfessionalNotes>
                            {professional.notes}
                          </ExternalProfessionalNotes>
                        )}
                      </ExternalProfessionalMain>
                      <CardActions>
                        <CardButton
                          type="button"
                          onClick={() => openExternalProfessionalEditModal(professional)}
                        >
                          Editar
                        </CardButton>
                        {professional.is_active !== false && (
                          <CardButton
                            type="button"
                            onClick={() => handleInactivateExternalProfessional(professional)}
                          >
                            Inativar
                          </CardButton>
                        )}
                      </CardActions>
                    </ExternalProfessionalItem>
                  ))}
                </ExternalProfessionalList>
              )}
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
          </Section>
        )}

        {!isLoading && activeTab === TABS.prontuario && (
          <Section>
            <ProntuarioSubTabs role="tablist" aria-label="Seções do prontuário">
              <ProntuarioSubTabButton
                type="button"
                role="tab"
                $active={activeProntuarioSection === PRONTUARIO_SECTIONS.records}
                aria-selected={activeProntuarioSection === PRONTUARIO_SECTIONS.records}
                onClick={() => setActiveProntuarioSection(PRONTUARIO_SECTIONS.records)}
              >
                Casos clínicos
              </ProntuarioSubTabButton>
              <ProntuarioSubTabButton
                type="button"
                role="tab"
                $active={activeProntuarioSection === PRONTUARIO_SECTIONS.references}
                aria-selected={activeProntuarioSection === PRONTUARIO_SECTIONS.references}
                onClick={() => setActiveProntuarioSection(PRONTUARIO_SECTIONS.references)}
              >
                Referências
              </ProntuarioSubTabButton>
            </ProntuarioSubTabs>

	            {activeProntuarioSection === PRONTUARIO_SECTIONS.records && (
	              <>
	                <ProntuarioSectionHeader>
	                  <div>
		                    <ProntuarioSectionTitle>
		                      {selectedRecordCase ? selectedRecordCase.title : "Casos clínicos"}
		                    </ProntuarioSectionTitle>
		                  </div>
	                  {patient && (
		                    <TimelineActions>
		                      {selectedRecordCase ? (
		                        <>
		                          <CardButton
		                            type="button"
		                            onClick={() => setRecordCaseFilter("all")}
		                          >
		                            Voltar aos casos
		                          </CardButton>
		                          <SubtleCardButton
		                            type="button"
		                            onClick={() => openClinicalCaseEditModal(selectedRecordCase)}
		                          >
		                            <FaPen /> Editar caso
		                          </SubtleCardButton>
		                        </>
		                      ) : (
	                        <ProntuarioActionButton
	                          type="button"
	                          onClick={openClinicalCaseCreateModal}
	                        >
	                          <FaPlus /> Caso clínico
	                        </ProntuarioActionButton>
	                      )}
	                    </TimelineActions>
	                  )}
	                </ProntuarioSectionHeader>
	                {!selectedRecordCase && (
	                  <>
	                    {clinicalCases.length === 0 && (
	                      <ClinicalCasesEmptyState>
	                        <strong>Nenhum caso clínico cadastrado.</strong>
	                        <span>
	                          Crie uma linha de cuidado para organizar avaliações,
	                          evoluções e registros completos do paciente.
	                        </span>
	                      </ClinicalCasesEmptyState>
	                    )}

		                    {activeClinicalCases.length > 0 && (
		                      <CaseOverviewGrid>
		                        {activeClinicalCases.map((clinicalCase) => (
			                            <CaseOverviewCard
			                              key={clinicalCase.id}
			                              type="button"
			                              onClick={() => setRecordCaseFilter(String(clinicalCase.id))}
			                            >
	                              <CaseOverviewHeader>
	                                <div>
	                                  <CaseOverviewTitle>{clinicalCase.title}</CaseOverviewTitle>
	                                  <ClinicalCaseMeta>
	                                    Início: {formatDate(clinicalCase.started_on)}
	                                  </ClinicalCaseMeta>
	                                </div>
	                                <ClinicalCaseStatusPill $status={clinicalCase.status}>
	                                  {CLINICAL_CASE_STATUS_LABELS[clinicalCase.status] || "Ativo"}
	                                </ClinicalCaseStatusPill>
	                              </CaseOverviewHeader>
	                              <ClinicalCaseDescription>
	                                {clinicalCase.chief_complaint ||
	                                  "Sem queixa principal registrada."}
	                              </ClinicalCaseDescription>
			                            </CaseOverviewCard>
		                        ))}
		                      </CaseOverviewGrid>
		                    )}

	                    {inactiveClinicalCases.length > 0 && (
	                      <SecondaryClinicalSection>
	                        <ClinicalCaseGroupTitle>Resolvidos e arquivados</ClinicalCaseGroupTitle>
	                        <CaseOverviewGrid>
	                          {inactiveClinicalCases.map((clinicalCase) => (
		                            <CaseOverviewCard
		                              key={clinicalCase.id}
		                              type="button"
		                              $muted
		                              onClick={() => setRecordCaseFilter(String(clinicalCase.id))}
		                            >
	                              <CaseOverviewHeader>
	                                <div>
	                                  <CaseOverviewTitle>{clinicalCase.title}</CaseOverviewTitle>
	                                  <ClinicalCaseMeta>
	                                    Início: {formatDate(clinicalCase.started_on)}
	                                  </ClinicalCaseMeta>
	                                </div>
	                                <ClinicalCaseStatusPill $status={clinicalCase.status}>
	                                  {CLINICAL_CASE_STATUS_LABELS[clinicalCase.status] ||
	                                    "Arquivado"}
	                                </ClinicalCaseStatusPill>
	                              </CaseOverviewHeader>
	                              <ClinicalCaseDescription>
	                                {clinicalCase.chief_complaint ||
	                                  "Sem queixa principal registrada."}
	                              </ClinicalCaseDescription>
		                            </CaseOverviewCard>
	                          ))}
	                        </CaseOverviewGrid>
	                      </SecondaryClinicalSection>
	                    )}

		                  </>
	                )}

			                {selectedRecordCase && (
			                  <>
				                    <CaseDetailsPanel>
				                      <CaseDetailsShell>
				                        <CaseDetailsNav aria-label="Seções da base clínica">
				                          {selectedCaseDetailSections.map((section) => (
				                            <CaseDetailsNavButton
				                              key={section.key}
				                              type="button"
				                              $active={activeCaseDetail?.key === section.key}
				                              onClick={() => setActiveCaseDetailSection(section.key)}
				                            >
				                              <strong>{section.label}</strong>
				                            </CaseDetailsNavButton>
				                          ))}
				                        </CaseDetailsNav>
				                        {activeCaseDetail && (
				                          <CaseDetailsContent>
				                            <CaseDetailsContentTitle>
				                              {activeCaseDetail.title}
				                            </CaseDetailsContentTitle>
				                            <CaseDetailsContentText
				                              $expanded={Boolean(expandedCaseSummaryFields[activeCaseDetail.key])}
				                            >
				                              {activeCaseDetail.value || activeCaseDetail.fallback}
				                            </CaseDetailsContentText>
				                            {activeCaseDetail.value && activeCaseDetail.value.length > 700 && (
				                              <CaseExpandButton
				                                type="button"
				                                onClick={() => toggleCaseSummaryField(activeCaseDetail.key)}
				                              >
				                                {expandedCaseSummaryFields[activeCaseDetail.key]
				                                  ? "Ver menos"
				                                  : "Ver mais"}
				                              </CaseExpandButton>
				                            )}
				                          </CaseDetailsContent>
				                        )}
				                      </CaseDetailsShell>
				                    </CaseDetailsPanel>

				                    <CaseActionButtonGroup>
				                      <CasePrimaryActionButton
				                        type="button"
				                        $primary
				                        onClick={openQuickEvolutionModal}
				                      >
				                        <FaPlus /> Evolução
				                      </CasePrimaryActionButton>
				                      <CasePrimaryActionButton
				                        type="button"
				                        $primary
				                        onClick={openCaseEvaluationForm}
				                      >
				                        <FaPlus /> Avaliação
				                      </CasePrimaryActionButton>
				                    </CaseActionButtonGroup>

				                    {renderClinicalTimeline(filteredEvaluations, { showCaseLabel: false })}
		                  </>
		                )}
	              </>
	            )}

            {activeProntuarioSection === PRONTUARIO_SECTIONS.references && (
              <>
                <ProntuarioSectionHeader>
                  <div>
                    <ProntuarioSectionTitle>Referências</ProntuarioSectionTitle>
                    <ProntuarioSectionDescription>
                      Materiais de apoio ao raciocínio clínico do caso.
                    </ProntuarioSectionDescription>
                  </div>
                  <ProntuarioActionButton
                    type="button"
                    onClick={openClinicalReferenceCreateModal}
                  >
                    <FaPlus /> Adicionar referência
                  </ProntuarioActionButton>
                </ProntuarioSectionHeader>
                {clinicalReferences.length === 0 && (
                  <EmptyState>Nenhuma referência clínica cadastrada para este caso.</EmptyState>
                )}
                {clinicalReferences.length > 0 && (
                  <ClinicalReferenceList>
                    {clinicalReferences.map((reference) => (
                      <ClinicalReferenceItem
                        key={reference.id}
                        type="button"
                        onClick={() => openClinicalReferenceDetailModal(reference)}
                      >
                        <ClinicalReferenceMain>
                          <ClinicalReferenceHeader>
                            <span>{formatDate(reference.created_at)}</span>
                            <StatusPill>
                              {CLINICAL_REFERENCE_TYPE_LABELS[reference.reference_type] || "Outro"}
                            </StatusPill>
                          </ClinicalReferenceHeader>
                          <ClinicalReferenceTitle>{reference.title}</ClinicalReferenceTitle>
                          <ClinicalReferenceMeta>
                            {isHttpUrl(reference.reference_text) ? "Link" : "Referência textual"}
                          </ClinicalReferenceMeta>
                        </ClinicalReferenceMain>
                      </ClinicalReferenceItem>
                    ))}
                  </ClinicalReferenceList>
                )}
              </>
            )}
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
        {quickEvolutionModal && (
          <ModalOverlay>
            <ModalCard>
              <ModalHeader>
	                <div>
		                  <ModalTitle>Evolução</ModalTitle>
	                </div>
                <IconButton
                  type="button"
                  onClick={closeQuickEvolutionModal}
                  aria-label="Fechar"
                  disabled={isSavingQuickEvolution}
                >
                  <FaTimes />
                </IconButton>
              </ModalHeader>
              <ModalBody>
                <QuickEvolutionForm>
		                  <QuickEvolutionTopGrid>
		                    <CaseContextHeader>
		                      <CaseContextLabel>Caso clínico</CaseContextLabel>
		                      <CaseContextTitle>
		                        {selectedRecordCase?.title || "Caso clínico"}
		                      </CaseContextTitle>
		                    </CaseContextHeader>
	                    <QuickEvolutionField>
                      <FieldLabel>Data</FieldLabel>
                      <InlineInput
                        type="date"
                        name="evolution_date"
                        value={quickEvolutionForm.evolution_date}
                        onChange={handleQuickEvolutionFieldChange}
                      />
                    </QuickEvolutionField>
                  </QuickEvolutionTopGrid>

                  <QuickEvolutionField $primary>
                    <FieldLabel>Evolução</FieldLabel>
                    <InlineTextarea
                      name="evolution_text"
                      value={quickEvolutionForm.evolution_text}
                      onChange={handleQuickEvolutionFieldChange}
                      rows={5}
                      placeholder="Ex.: paciente evoluiu com menos dor ao agachar..."
                    />
                  </QuickEvolutionField>

                  <QuickEvolutionField>
                    <FieldLabel>Conduta realizada</FieldLabel>
                    <CompactTextarea
                      name="conduct_text"
                      value={quickEvolutionForm.conduct_text}
                      onChange={handleQuickEvolutionFieldChange}
                      rows={3}
                      placeholder="Ex.: mobilidade, fortalecimento, orientação de carga..."
                    />
                  </QuickEvolutionField>

	                  <PainFieldGroup>
	                    <PainScaleField>
	                      <FieldLabel>Dor</FieldLabel>
	                      <PainScaleOptions role="group" aria-label="Escala de dor">
	                        {PAIN_SCALE_OPTIONS.map((value) => (
	                          <PainScaleButton
	                            key={value || "empty"}
	                            type="button"
	                            $selected={quickEvolutionForm.pain_scale === value}
	                            $wide={value === ""}
	                            onClick={() => handleQuickEvolutionPainScaleChange(value)}
	                          >
	                            {value === "" ? "Não informar" : value}
	                          </PainScaleButton>
	                        ))}
	                      </PainScaleOptions>
	                    </PainScaleField>
	                    <QuickEvolutionField>
	                      <FieldLabel>Observação sobre a dor</FieldLabel>
	                      <CompactTextarea
	                        name="pain_notes"
	                        value={quickEvolutionForm.pain_notes}
	                        onChange={handleQuickEvolutionFieldChange}
	                        rows={2}
	                        placeholder="Ex.: dor ao agachar, palpação, treino, repouso..."
	                      />
	                    </QuickEvolutionField>
                  </PainFieldGroup>
                </QuickEvolutionForm>
              </ModalBody>
              <ModalFooter>
                <CardButton
                  type="button"
                  onClick={closeQuickEvolutionModal}
                  disabled={isSavingQuickEvolution}
                >
                  Cancelar
                </CardButton>
                <CardButton
                  type="button"
                  $primary
                  onClick={handleSaveQuickEvolution}
                  disabled={isSavingQuickEvolution}
                >
		                  {isSavingQuickEvolution ? "Salvando..." : quickEvolutionSaveLabel}
                </CardButton>
              </ModalFooter>
            </ModalCard>
          </ModalOverlay>
        )}
        {isCaseManagerOpen && (
          <ModalOverlay>
            <ModalCard>
              <ModalHeader>
                <div>
	                  <ModalTitle>Gerenciar linhas de cuidado</ModalTitle>
                  <ModalSubtitle>
                    <span>Linhas de cuidado usadas como contexto da linha do tempo.</span>
                  </ModalSubtitle>
                </div>
                <IconButton
                  type="button"
                  onClick={() => setIsCaseManagerOpen(false)}
                  aria-label="Fechar"
                >
                  <FaTimes />
                </IconButton>
              </ModalHeader>
              <ModalBody>
                <CaseManagerHeader>
	                  <span>Crie linhas como Lombar, Joelho direito ou Ombro esquerdo.</span>
                  <SubtleCardButton
                    type="button"
                    onClick={openClinicalCaseCreateModal}
                  >
                    <FaPlus /> Novo caso
                  </SubtleCardButton>
                </CaseManagerHeader>

                {clinicalCases.length === 0 && (
                  <ClinicalCasesEmptyState>
	                    <strong>Nenhuma linha de cuidado cadastrada.</strong>
	                    <span>
	                      As linhas ajudam a acompanhar o prontuário por queixa ou objetivo clínico.
	                    </span>
                  </ClinicalCasesEmptyState>
                )}

                {activeClinicalCases.length > 0 && (
                  <ClinicalCaseGroup>
                    <ClinicalCaseGroupTitle>Ativos</ClinicalCaseGroupTitle>
                    <ClinicalCaseGrid>
                      {activeClinicalCases.map((clinicalCase) => (
                        <ClinicalCaseCard key={clinicalCase.id}>
                          <ClinicalCaseCardHeader>
                            <div>
                              <ClinicalCaseTitle>{clinicalCase.title}</ClinicalCaseTitle>
                              <ClinicalCaseMeta>
                                Início: {formatDate(clinicalCase.started_on)}
                              </ClinicalCaseMeta>
                            </div>
                            <ClinicalCaseStatusPill $status={clinicalCase.status}>
                              {CLINICAL_CASE_STATUS_LABELS[clinicalCase.status] || "Ativo"}
                            </ClinicalCaseStatusPill>
                          </ClinicalCaseCardHeader>
                          <ClinicalCaseDescription>
                            {clinicalCase.chief_complaint ||
                              "Sem queixa principal registrada."}
                          </ClinicalCaseDescription>
                          {(clinicalCase.diagnosis_hypothesis ||
                            clinicalCase.current_plan ||
                            clinicalCase.attention_points) && (
                            <ClinicalCaseDetails>
                              {clinicalCase.diagnosis_hypothesis && (
                                <span>Hipótese: {clinicalCase.diagnosis_hypothesis}</span>
                              )}
                              {clinicalCase.current_plan && (
                                <span>Plano: {clinicalCase.current_plan}</span>
                              )}
                              {clinicalCase.attention_points && (
                                <span>Atenção: {clinicalCase.attention_points}</span>
                              )}
                            </ClinicalCaseDetails>
                          )}
                          <ClinicalCaseActions>
                            <SubtleCardButton
                              type="button"
                              onClick={() => openClinicalCaseEditModal(clinicalCase)}
                            >
                              Editar
                            </SubtleCardButton>
                            <CaseStatusSelect
                              value={clinicalCase.status}
                              onChange={(event) =>
                                handleClinicalCaseStatusChange(
                                  clinicalCase,
                                  event.target.value,
                                )
                              }
                              disabled={isUpdatingClinicalCaseStatus}
                              aria-label={`Status do caso ${clinicalCase.title}`}
                            >
                              {CLINICAL_CASE_STATUSES.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </CaseStatusSelect>
                          </ClinicalCaseActions>
                        </ClinicalCaseCard>
                      ))}
                    </ClinicalCaseGrid>
                  </ClinicalCaseGroup>
                )}

                {inactiveClinicalCases.length > 0 && (
                  <ClinicalCaseGroup>
                    <ClinicalCaseGroupTitle>Resolvidos e arquivados</ClinicalCaseGroupTitle>
                    <ClinicalCaseGrid>
                      {inactiveClinicalCases.map((clinicalCase) => (
                        <ClinicalCaseCard key={clinicalCase.id} $muted>
                          <ClinicalCaseCardHeader>
                            <div>
                              <ClinicalCaseTitle>{clinicalCase.title}</ClinicalCaseTitle>
                              <ClinicalCaseMeta>
                                Início: {formatDate(clinicalCase.started_on)}
                              </ClinicalCaseMeta>
                            </div>
                            <ClinicalCaseStatusPill $status={clinicalCase.status}>
                              {CLINICAL_CASE_STATUS_LABELS[clinicalCase.status] ||
                                "Arquivado"}
                            </ClinicalCaseStatusPill>
                          </ClinicalCaseCardHeader>
                          <ClinicalCaseDescription>
                            {clinicalCase.chief_complaint ||
                              "Sem queixa principal registrada."}
                          </ClinicalCaseDescription>
                          <ClinicalCaseActions>
                            <SubtleCardButton
                              type="button"
                              onClick={() => openClinicalCaseEditModal(clinicalCase)}
                            >
                              Editar
                            </SubtleCardButton>
                            <SubtleCardButton
                              type="button"
                              onClick={() =>
                                handleClinicalCaseStatusChange(clinicalCase, "active")
                              }
                              disabled={isUpdatingClinicalCaseStatus}
                            >
                              Reativar
                            </SubtleCardButton>
                          </ClinicalCaseActions>
                        </ClinicalCaseCard>
                      ))}
                    </ClinicalCaseGrid>
                  </ClinicalCaseGroup>
                )}
              </ModalBody>
            </ModalCard>
          </ModalOverlay>
        )}
        {clinicalCaseModal && (
          <ModalOverlay>
            <ModalCard>
              <ModalHeader>
                <div>
                  <ModalTitle>
                    {clinicalCaseModal.mode === "edit"
                      ? "Editar caso clínico"
                      : "Novo caso clínico"}
                  </ModalTitle>
                  <ModalSubtitle>
                    <span>Uma linha de cuidado do paciente, como Lombar ou Joelho direito.</span>
                  </ModalSubtitle>
                </div>
                <IconButton
                  type="button"
                  onClick={closeClinicalCaseModal}
                  aria-label="Fechar"
                  disabled={isSavingClinicalCase}
                >
                  <FaTimes />
                </IconButton>
              </ModalHeader>
	              <ModalBody>
	                <ClinicalCaseFormSections>
	                  <ClinicalCaseFormBlock>
	                    <ClinicalCaseFormBlockTitle>Identificação</ClinicalCaseFormBlockTitle>
	                    <DataList>
	                      <DataRow>
	                        <DataLabel>Nome do caso</DataLabel>
	                        <DataValue>
	                          <InlineInput
	                            name="title"
	                            value={clinicalCaseForm.title}
	                            onChange={handleClinicalCaseFieldChange}
	                            placeholder="Ex.: Lombar, Joelho direito, Quadril / iliopsoas"
	                          />
	                        </DataValue>
	                      </DataRow>
	                      <DataRow>
	                        <DataLabel>Data de início</DataLabel>
	                        <DataValue>
	                          <InlineInput
	                            type="date"
	                            name="started_on"
	                            value={clinicalCaseForm.started_on}
	                            onChange={handleClinicalCaseFieldChange}
	                          />
	                        </DataValue>
	                      </DataRow>
	                      <DataRow>
	                        <DataLabel>Status</DataLabel>
	                        <DataValue>
	                          <InlineSelect
	                            name="status"
	                            value={clinicalCaseForm.status}
	                            onChange={handleClinicalCaseFieldChange}
	                          >
	                            {CLINICAL_CASE_STATUSES.map((option) => (
	                              <option key={option.value} value={option.value}>
	                                {option.label}
	                              </option>
	                            ))}
	                          </InlineSelect>
	                        </DataValue>
	                      </DataRow>
	                    </DataList>
	                  </ClinicalCaseFormBlock>

	                  <ClinicalCaseFormBlock>
	                    <ClinicalCaseFormBlockTitle>Contexto clínico</ClinicalCaseFormBlockTitle>
	                    <DataList>
	                      <DataRow>
	                        <DataLabel>Resumo clínico / Queixa principal</DataLabel>
	                        <DataValue>
	                          <InlineTextarea
	                            name="chief_complaint"
	                            value={clinicalCaseForm.chief_complaint}
	                            onChange={handleClinicalCaseFieldChange}
	                            rows={3}
	                            placeholder="Descreva o contexto principal desta linha de cuidado"
	                          />
	                        </DataValue>
	                      </DataRow>
	                      <DataRow>
	                        <DataLabel>Hipótese(s) / Diagnóstico</DataLabel>
	                        <DataValue>
	                          <InlineTextarea
	                            name="diagnosis_hypothesis"
	                            value={clinicalCaseForm.diagnosis_hypothesis}
	                            onChange={handleClinicalCaseFieldChange}
	                            rows={3}
	                          />
	                        </DataValue>
	                      </DataRow>
	                    </DataList>
	                  </ClinicalCaseFormBlock>

	                  <ClinicalCaseFormBlock>
	                    <ClinicalCaseFormBlockTitle>Plano</ClinicalCaseFormBlockTitle>
	                    <DataList>
	                      <DataRow>
	                        <DataLabel>Plano atual / Conduta</DataLabel>
	                        <DataValue>
	                          <InlineTextarea
	                            name="current_plan"
	                            value={clinicalCaseForm.current_plan}
	                            onChange={handleClinicalCaseFieldChange}
	                            rows={3}
	                          />
	                        </DataValue>
	                      </DataRow>
	                      <DataRow>
	                        <DataLabel>Frequência sugerida</DataLabel>
	                        <DataValue>
	                          <InlineInput
	                            name="suggested_frequency"
	                            value={clinicalCaseForm.suggested_frequency}
	                            onChange={handleClinicalCaseFieldChange}
	                            placeholder="Ex.: 2x por semana por 4 semanas"
	                          />
	                        </DataValue>
	                      </DataRow>
	                      <DataRow>
	                        <DataLabel>Observações finais / Pontos de atenção</DataLabel>
	                        <DataValue>
	                          <InlineTextarea
	                            name="attention_points"
	                            value={clinicalCaseForm.attention_points}
	                            onChange={handleClinicalCaseFieldChange}
	                            rows={3}
	                          />
	                        </DataValue>
	                      </DataRow>
	                    </DataList>
	                  </ClinicalCaseFormBlock>
	                </ClinicalCaseFormSections>
	              </ModalBody>
              <ModalFooter>
                <CardButton
                  type="button"
                  onClick={closeClinicalCaseModal}
                  disabled={isSavingClinicalCase}
                >
                  Cancelar
                </CardButton>
                <CardButton
                  type="button"
                  $primary
                  onClick={handleSaveClinicalCase}
                  disabled={isSavingClinicalCase}
                >
                  {isSavingClinicalCase ? "Salvando..." : "Salvar"}
                </CardButton>
              </ModalFooter>
            </ModalCard>
          </ModalOverlay>
        )}
        {selectedClinicalReference && (
	          <ModalOverlay>
	            <ModalCard>
              <ModalHeader>
                <div>
	                  <ModalTitle>{selectedClinicalReference.title}</ModalTitle>
	                  <ModalSubtitle>
	                    <span>
	                      Criada em {formatDate(selectedClinicalReference.created_at)}
	                    </span>
                  </ModalSubtitle>
                </div>
                <IconButton
                  type="button"
                  onClick={closeClinicalReferenceDetailModal}
                  aria-label="Fechar"
                >
                  <FaTimes />
                </IconButton>
              </ModalHeader>
		              <ModalBody>
		                <DataList>
		                  <DataRow>
		                    <DataLabel>Tipo</DataLabel>
		                    <DataValue>
		                      {CLINICAL_REFERENCE_TYPE_LABELS[selectedClinicalReference.reference_type] ||
		                        "Outro"}
		                    </DataValue>
		                  </DataRow>
		                  <DataRow>
		                    <DataLabel>Link ou referência</DataLabel>
		                    <DataValue>
                      {isHttpUrl(selectedClinicalReference.reference_text) ? (
                        <ClinicalReferenceLink
                          href={selectedClinicalReference.reference_text}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {selectedClinicalReference.reference_text}
                        </ClinicalReferenceLink>
                      ) : (
                        valueOrDash(selectedClinicalReference.reference_text)
                      )}
                    </DataValue>
                  </DataRow>
                  <DataRow>
                    <DataLabel>Pergunta clínica</DataLabel>
                    <DataValue>
                      {valueOrDash(selectedClinicalReference.clinical_question)}
                    </DataValue>
                  </DataRow>
	                  <DataRow>
	                    <DataLabel>Observações</DataLabel>
	                    <DataValue>{valueOrDash(selectedClinicalReference.notes)}</DataValue>
	                  </DataRow>
	                </DataList>
	              </ModalBody>
	              <ModalFooter>
	                <CardButton
	                  type="button"
	                  onClick={handleEditSelectedClinicalReference}
                >
                  Editar
                </CardButton>
	                <ReferenceDeleteButton
	                  type="button"
	                  onClick={handleOpenDeleteClinicalReference}
	                >
	                  Excluir
	                </ReferenceDeleteButton>
	              </ModalFooter>
	            </ModalCard>
	          </ModalOverlay>
	        )}
	        {clinicalReferenceDeleteTarget && (
	          <ModalOverlay>
	            <ModalCard>
	              <ModalHeader>
	                <div>
	                  <ModalTitle>Excluir referência</ModalTitle>
	                  <ModalSubtitle>
	                    <span>Esta ação remove a referência clínica deste caso.</span>
	                  </ModalSubtitle>
	                </div>
	                <IconButton
	                  type="button"
	                  onClick={handleCancelDeleteClinicalReference}
	                  aria-label="Fechar"
	                  disabled={isDeletingClinicalReference}
	                >
	                  <FaTimes />
	                </IconButton>
	              </ModalHeader>
	              <ModalBody>
	                <ConfirmText>
	                  Deseja excluir a referência{" "}
	                  <strong>{clinicalReferenceDeleteTarget.title}</strong>?
	                </ConfirmText>
	              </ModalBody>
	              <ModalFooter>
	                <CardButton
	                  type="button"
	                  onClick={handleCancelDeleteClinicalReference}
	                  disabled={isDeletingClinicalReference}
	                >
	                  Cancelar
	                </CardButton>
	                <ReferenceConfirmDeleteButton
	                  type="button"
	                  onClick={handleConfirmDeleteClinicalReference}
	                  disabled={isDeletingClinicalReference}
	                >
	                  {isDeletingClinicalReference ? "Excluindo..." : "Excluir"}
	                </ReferenceConfirmDeleteButton>
	              </ModalFooter>
	            </ModalCard>
	          </ModalOverlay>
	        )}
	        {clinicalReferenceModal && (
	          <ModalOverlay>
            <ModalCard>
              <ModalHeader>
                <div>
                  <ModalTitle>
                    {clinicalReferenceModal.mode === "edit"
                      ? "Editar referência clínica"
                      : "Adicionar referência clínica"}
                  </ModalTitle>
                  <ModalSubtitle>
                    <span>Material de apoio ao raciocínio clínico do caso.</span>
                  </ModalSubtitle>
                </div>
                <IconButton
                  type="button"
                  onClick={closeClinicalReferenceModal}
                  aria-label="Fechar"
                  disabled={isSavingClinicalReference}
                >
                  <FaTimes />
                </IconButton>
              </ModalHeader>
              <ModalBody>
                <DataList>
                  <DataRow>
                    <DataLabel>Título</DataLabel>
                    <DataValue>
                      <InlineInput
                        name="title"
                        value={clinicalReferenceForm.title}
                        onChange={handleClinicalReferenceFieldChange}
                        placeholder="Ex.: Guideline de dor lombar"
                      />
                    </DataValue>
                  </DataRow>
                  <DataRow>
                    <DataLabel>Link ou referência</DataLabel>
                    <DataValue>
                      <InlineInput
                        name="reference_text"
                        value={clinicalReferenceForm.reference_text}
                        onChange={handleClinicalReferenceFieldChange}
                        placeholder="https://... ou referência textual"
                      />
                    </DataValue>
                  </DataRow>
                  <DataRow>
                    <DataLabel>Tipo</DataLabel>
                    <DataValue>
                      <InlineSelect
                        name="reference_type"
                        value={clinicalReferenceForm.reference_type}
                        onChange={handleClinicalReferenceFieldChange}
                      >
                        {CLINICAL_REFERENCE_TYPES.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </InlineSelect>
                    </DataValue>
                  </DataRow>
                  <DataRow>
                    <DataLabel>Pergunta clínica</DataLabel>
                    <DataValue>
                      <InlineTextarea
                        name="clinical_question"
                        value={clinicalReferenceForm.clinical_question}
                        onChange={handleClinicalReferenceFieldChange}
                        rows={3}
                      />
                    </DataValue>
                  </DataRow>
                  <DataRow>
                    <DataLabel>Observações</DataLabel>
                    <DataValue>
                      <InlineTextarea
                        name="notes"
                        value={clinicalReferenceForm.notes}
                        onChange={handleClinicalReferenceFieldChange}
                        rows={4}
                      />
                    </DataValue>
                  </DataRow>
                </DataList>
              </ModalBody>
              <ModalFooter>
                <CardButton
                  type="button"
                  onClick={closeClinicalReferenceModal}
                  disabled={isSavingClinicalReference}
                >
                  Cancelar
                </CardButton>
                <CardButton
                  type="button"
                  $primary
                  onClick={handleSaveClinicalReference}
                  disabled={isSavingClinicalReference}
                >
                  {isSavingClinicalReference ? "Salvando..." : "Salvar"}
                </CardButton>
              </ModalFooter>
            </ModalCard>
          </ModalOverlay>
        )}
        {externalProfessionalModal && (
          <ModalOverlay>
            <ModalCard>
              <ModalHeader>
                <div>
                  <ModalTitle>
                    {externalProfessionalModal.mode === "edit"
                      ? "Editar profissional externo"
                      : "Adicionar profissional externo"}
                  </ModalTitle>
                  <ModalSubtitle>
                    <span>Informação de apoio para alinhamento do tratamento.</span>
                  </ModalSubtitle>
                </div>
                <IconButton
                  type="button"
                  onClick={closeExternalProfessionalModal}
                  aria-label="Fechar"
                  disabled={isSavingExternalProfessional}
                >
                  <FaTimes />
                </IconButton>
              </ModalHeader>
              <ModalBody>
                <DataList>
                  <DataRow>
                    <DataLabel>Tipo de profissional</DataLabel>
                    <DataValue>
                      <InlineSelect
                        name="professional_type"
                        value={externalProfessionalForm.professional_type}
                        onChange={handleExternalProfessionalFieldChange}
                      >
                        {EXTERNAL_PROFESSIONAL_TYPES.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </InlineSelect>
                    </DataValue>
                  </DataRow>
                  <DataRow>
                    <DataLabel>Nome do profissional</DataLabel>
                    <DataValue>
                      <InlineInput
                        name="professional_name"
                        value={externalProfessionalForm.professional_name}
                        onChange={handleExternalProfessionalFieldChange}
                        placeholder="Nome completo"
                      />
                    </DataValue>
                  </DataRow>
                  <DataRow>
                    <DataLabel>Contato</DataLabel>
                    <DataValue>
                      <InlineInput
                        name="contact"
                        value={externalProfessionalForm.contact}
                        onChange={handleExternalProfessionalFieldChange}
                        placeholder="Telefone, WhatsApp ou e-mail"
                      />
                    </DataValue>
                  </DataRow>
                  <DataRow>
                    <DataLabel>Instagram</DataLabel>
                    <DataValue>
                      <InlineInput
                        name="instagram_url"
                        value={externalProfessionalForm.instagram_url}
                        onChange={handleExternalProfessionalFieldChange}
                        placeholder="https://instagram.com/profissional"
                      />
                    </DataValue>
                  </DataRow>
                  <DataRow>
                    <DataLabel>Autorização de contato</DataLabel>
                    <DataValue>
                      <CheckboxOption>
                        <input
                          type="checkbox"
                          name="contact_authorized"
                          checked={externalProfessionalForm.contact_authorized}
                          onChange={handleExternalProfessionalFieldChange}
                        />
                        <span>Paciente autorizou contato com esse profissional</span>
                      </CheckboxOption>
                    </DataValue>
                  </DataRow>
                  <DataRow>
                    <DataLabel>Status</DataLabel>
                    <DataValue>
                      <CheckboxOption>
                        <input
                          type="checkbox"
                          name="is_active"
                          checked={externalProfessionalForm.is_active}
                          onChange={handleExternalProfessionalFieldChange}
                        />
                        <span>Ativo</span>
                      </CheckboxOption>
                    </DataValue>
                  </DataRow>
                  <DataRow>
                    <DataLabel>Observações</DataLabel>
                    <DataValue>
                      <InlineTextarea
                        name="notes"
                        value={externalProfessionalForm.notes}
                        onChange={handleExternalProfessionalFieldChange}
                        placeholder="Restrições, carga, frequência de treino, cuidados combinados..."
                      />
                    </DataValue>
                  </DataRow>
                </DataList>
              </ModalBody>
              <ModalFooter>
                <CardButton
                  type="button"
                  onClick={closeExternalProfessionalModal}
                  disabled={isSavingExternalProfessional}
                >
                  Cancelar
                </CardButton>
                <CardButton
                  type="button"
                  $primary
                  onClick={handleSaveExternalProfessional}
                  disabled={isSavingExternalProfessional}
                >
                  {isSavingExternalProfessional ? "Salvando..." : "Salvar"}
                </CardButton>
              </ModalFooter>
            </ModalCard>
          </ModalOverlay>
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

const prontuarioActionButtonStyles = css`
  height: 42px;
  align-items: center;
  justify-content: center;
  padding: 0 16px;
  line-height: 1.2;

  svg {
    display: block;
    flex-shrink: 0;
    width: 0.95em;
    height: 0.95em;
  }
`;

const ProntuarioActionButton = styled(SharedPrimaryButton)`
  ${prontuarioActionButtonStyles}
`;

const TimelineActions = styled.div`
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  align-items: center;
`;

const ProntuarioSubTabs = styled.div`
  display: flex;
  gap: 24px;
  flex-wrap: wrap;
  align-items: center;
  border-bottom: 1px solid rgba(106, 121, 92, 0.16);
  margin-bottom: 2px;
`;

const ProntuarioSubTabButton = styled.button`
  min-height: 38px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 0;
  border-bottom: 3px solid
    ${(props) => (props.$active ? "#6a795c" : "transparent")};
  background: transparent;
  color: ${(props) => (props.$active ? "#2d3629" : "#6a795c")};
  padding: 0 0 10px;
  font-weight: 700;
  line-height: 1.2;
  cursor: pointer;
  transition: border-color 0.2s ease, color 0.2s ease;

  &:hover {
    color: #2d3629;
  }

  &:focus {
    outline: none;
  }

  &:focus-visible {
    border-radius: 6px;
    box-shadow: 0 0 0 3px rgba(106, 121, 92, 0.14);
  }
`;

const ProntuarioSectionHeader = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-top: 2px;

  @media (max-width: 720px) {
    flex-direction: column;
  }
`;

const ProntuarioSectionTitle = styled.h2`
  margin: 0;
  color: #1b1b1b;
  font-size: 1.25rem;
  line-height: 1.25;
`;

const ProntuarioSectionDescription = styled.p`
  margin: 4px 0 0;
  color: #6a795c;
  font-size: 0.92rem;
  line-height: 1.4;
`;

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

const ExternalProfessionalList = styled.div`
  display: grid;
  gap: 10px;
  margin-top: 14px;
`;

const ExternalProfessionalItem = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  border-radius: 12px;
  border: 1px solid rgba(106, 121, 92, 0.16);
  background: ${(props) => (props.$inactive ? "#f6f6f3" : "#fcfdf8")};
  padding: 12px;
  opacity: ${(props) => (props.$inactive ? 0.74 : 1)};

  @media (max-width: 720px) {
    flex-direction: column;
  }
`;

const ExternalProfessionalMain = styled.div`
  min-width: 0;
`;

const ExternalProfessionalHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;

  strong {
    color: #1b1b1b;
  }
`;

const ExternalProfessionalMeta = styled.div`
  display: flex;
  gap: 8px 14px;
  flex-wrap: wrap;
  margin-top: 6px;
  color: #6a795c;
  font-size: 0.9rem;

  strong {
    color: #2d3629;
  }
`;

const ExternalProfessionalNotes = styled.p`
  margin: 8px 0 0;
  color: #2d3629;
  line-height: 1.45;
  white-space: pre-wrap;
  word-break: break-word;
`;

const ExternalProfessionalLink = styled.a`
  color: #55644c;
  font-weight: 800;
  text-decoration: none;

  &:hover {
    text-decoration: underline;
  }
`;

const ClinicalCasesEmptyState = styled.div`
  border: 1px dashed rgba(106, 121, 92, 0.28);
  border-radius: 12px;
  background: #fcfdf8;
  padding: 18px;
  color: #6a795c;
  display: grid;
  gap: 6px;

  strong {
    color: #2d3629;
  }

  span {
    line-height: 1.45;
  }
`;

const ClinicalCaseGroup = styled.div`
  display: grid;
  gap: 10px;
`;

const ClinicalCaseGroupTitle = styled.h3`
  margin: 0;
  color: #2d3629;
  font-size: 0.95rem;
`;

const ClinicalCaseGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 12px;
`;

const ClinicalCaseCard = styled.article`
  border: 1px solid rgba(106, 121, 92, 0.18);
  border-radius: 12px;
  background: ${(props) => (props.$muted ? "#f8f9f4" : "#fff")};
  padding: 16px;
  display: grid;
  gap: 12px;
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.04);
`;

const ClinicalCaseCardHeader = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
`;

const ClinicalCaseTitle = styled.h3`
  margin: 0;
  color: #1b1b1b;
  font-size: 1rem;
  line-height: 1.25;
`;

const ClinicalCaseMeta = styled.span`
  display: block;
  margin-top: 4px;
  color: #6a795c;
  font-size: 0.78rem;
  font-weight: 700;
`;

const ClinicalCaseStatusPill = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 28px;
  padding: 0 10px;
  border-radius: 999px;
  color: ${(props) => {
    if (props.$status === "resolved") return "#4f7c42";
    if (props.$status === "archived") return "#6a6f63";
    return "#8a5a00";
  }};
  background: ${(props) => {
    if (props.$status === "resolved") return "rgba(79, 124, 66, 0.1)";
    if (props.$status === "archived") return "rgba(106, 111, 99, 0.1)";
    return "rgba(165, 106, 0, 0.1)";
  }};
  border: 1px solid
    ${(props) => {
    if (props.$status === "resolved") return "rgba(79, 124, 66, 0.22)";
    if (props.$status === "archived") return "rgba(106, 111, 99, 0.22)";
    return "rgba(165, 106, 0, 0.22)";
  }};
  font-size: 0.76rem;
  font-weight: 800;
`;

const ClinicalCaseDescription = styled.p`
  margin: 0;
  color: #55644c;
  line-height: 1.45;
`;

const ClinicalCaseDetails = styled.div`
  display: grid;
  gap: 6px;
  color: #6a795c;
  font-size: 0.86rem;
  line-height: 1.4;
`;

const ClinicalCaseActions = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  flex-wrap: wrap;
`;

const CaseManagerHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;
  color: #6a795c;
  font-size: 0.9rem;
  line-height: 1.4;

  @media (max-width: 640px) {
    align-items: flex-start;
    flex-direction: column;
  }
`;

const ClinicalReferenceList = styled.div`
  display: grid;
  gap: 10px;
`;

const ClinicalReferenceItem = styled.button`
  width: 100%;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 14px;
  border-radius: 16px;
  border: 1px solid rgba(106, 121, 92, 0.18);
  background: #fff;
  padding: 16px;
  box-shadow: 0 10px 24px rgba(0, 0, 0, 0.06);
  text-align: left;
  cursor: pointer;
  transition: transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease;

  &:hover {
    transform: translateY(-1px);
    border-color: rgba(106, 121, 92, 0.28);
    box-shadow: 0 12px 26px rgba(0, 0, 0, 0.08);
  }

  &:focus-visible {
    outline: none;
    border-color: rgba(106, 121, 92, 0.5);
    box-shadow: 0 0 0 3px rgba(106, 121, 92, 0.12);
  }

  @media (max-width: 720px) {
    flex-direction: column;
    align-items: stretch;
  }
`;

const ClinicalReferenceMain = styled.div`
  min-width: 0;
  flex: 1;
`;

const ClinicalReferenceHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;

  span {
    font-size: 0.85rem;
    color: #6a795c;
  }
`;

const ClinicalReferenceTitle = styled.h3`
  margin: 6px 0 0;
  color: #1b1b1b;
  font-size: 1.05rem;
  line-height: 1.25;
`;

const ClinicalReferenceMeta = styled.div`
  margin-top: 7px;
  color: #6a795c;
  font-size: 0.88rem;
  font-weight: 700;
`;

const ClinicalReferenceLink = styled.a`
  color: #55644c;
  font-weight: 800;
  text-decoration: none;

  &:hover {
    text-decoration: underline;
  }
`;

const CardActions = styled.div`
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
`;

const CardButton = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
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

const SubtleCardButton = styled(CardButton)`
  min-height: 34px;
  padding: 7px 10px;
  border-color: rgba(106, 121, 92, 0.18);
  background: #fff;
  color: #55644c;
  font-size: 0.84rem;
  font-weight: 800;
`;

const ReferenceDeleteButton = styled(CardButton)`
  border-color: rgba(168, 63, 63, 0.28);
  color: #a83f3f;

  &:hover:not(:disabled) {
    background: rgba(168, 63, 63, 0.06);
    filter: none;
  }
`;

const ReferenceConfirmDeleteButton = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-width: 120px;
  padding: 10px 18px;
  border-radius: 10px;
  border: none;
  background: #a83f3f;
  color: #fff;
  font-weight: 700;
  cursor: pointer;
  transition: filter 0.2s ease, opacity 0.2s ease;

  &:hover:not(:disabled) {
    filter: brightness(0.95);
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;

const ConfirmText = styled.p`
  margin: 0;
  color: #2d3629;
  line-height: 1.5;

  strong {
    color: #1b1b1b;
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

const CompactTextarea = styled(InlineTextarea)`
  min-height: 84px;
`;

const QuickEvolutionForm = styled.div`
  display: grid;
  gap: 14px;
`;

const ClinicalCaseFormSections = styled.div`
  display: grid;
  gap: 16px;
`;

const ClinicalCaseFormBlock = styled.section`
  display: grid;
  gap: 10px;
  border-top: 1px solid rgba(106, 121, 92, 0.12);
  padding-top: 14px;

  &:first-child {
    border-top: 0;
    padding-top: 0;
  }
`;

const ClinicalCaseFormBlockTitle = styled.h3`
  margin: 0;
  color: #2d3629;
  font-size: 0.95rem;
`;

const QuickEvolutionTopGrid = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1.4fr) minmax(170px, 0.6fr);
  gap: 12px;

  @media (max-width: 680px) {
    grid-template-columns: 1fr;
  }
`;

const QuickEvolutionField = styled.label`
  display: grid;
  gap: 6px;

  ${(props) =>
    props.$primary
      ? `
        textarea {
          min-height: 132px;
          font-size: 1rem;
          line-height: 1.5;
        }
      `
      : ""}
`;

const FieldLabel = styled.span`
  color: #2d3629;
  font-size: 0.86rem;
  font-weight: 900;
`;

const CaseContextHeader = styled.div`
  display: grid;
  align-content: center;
  gap: 4px;
  min-height: 42px;
`;

const CaseContextLabel = styled.span`
  color: #6a795c;
  font-size: 0.78rem;
  font-weight: 900;
  text-transform: uppercase;
`;

const CaseContextTitle = styled.h3`
  margin: 0;
  color: #2d3629;
  font-size: 1.05rem;
  font-weight: 900;
  line-height: 1.2;
`;

const PainFieldGroup = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 12px;
  border-radius: 12px;
  background: #f8f9f4;
  padding: 12px;
  border: 1px solid rgba(106, 121, 92, 0.1);

  textarea {
    min-height: 62px;
  }
`;

const PainScaleField = styled(QuickEvolutionField)`
  gap: 8px;
`;

const PainScaleOptions = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
`;

const PainScaleButton = styled.button`
  min-height: 34px;
  min-width: ${(props) => (props.$wide ? "104px" : "36px")};
  border-radius: 999px;
  border: 1px solid
    ${(props) => (props.$selected ? "rgba(15, 91, 72, 0.78)" : "rgba(106, 121, 92, 0.18)")};
  background: ${(props) => (props.$selected ? "#6a795c" : "#fff")};
  color: ${(props) => (props.$selected ? "#fff" : "#2d3629")};
  padding: 0 11px;
  font-weight: 800;
  cursor: pointer;
  transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease;

  &:hover {
    border-color: rgba(15, 91, 72, 0.5);
  }
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

const CaseOverviewGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 12px;
`;

const CaseOverviewCard = styled.button`
  width: 100%;
  border: 1px solid rgba(106, 121, 92, 0.16);
  border-radius: 12px;
  background: ${(props) => (props.$muted ? "#f8f9f4" : "#fff")};
  padding: 14px;
  display: grid;
  gap: 10px;
  box-shadow: 0 8px 18px rgba(0, 0, 0, 0.045);
  text-align: left;
  cursor: pointer;
  font: inherit;
  transition: border-color 0.15s ease, box-shadow 0.15s ease, transform 0.15s ease;

  &:hover {
    border-color: rgba(106, 121, 92, 0.3);
    box-shadow: 0 10px 22px rgba(0, 0, 0, 0.06);
    transform: translateY(-1px);
  }

  &:focus-visible {
    outline: none;
    border-color: rgba(15, 91, 72, 0.65);
    box-shadow: 0 0 0 3px rgba(15, 91, 72, 0.12);
  }
`;

const CaseOverviewHeader = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
`;

const CaseOverviewTitle = styled.h3`
  margin: 0;
  color: #1b1b1b;
  font-size: 1rem;
  line-height: 1.25;
`;

const SecondaryClinicalSection = styled.div`
  display: grid;
  gap: 12px;
  border-top: 1px solid rgba(106, 121, 92, 0.12);
  padding-top: 14px;
`;

const CaseActionButtonGroup = styled.div`
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  width: 100%;

  @media (max-width: 640px) {
    align-items: stretch;
    flex-direction: column;
  }
`;

const casePrimaryActionStyles = css`
  min-height: 42px;
  padding: 8px 14px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  color: #fff;
  font-size: 0.9rem;
  font-weight: 700;
  line-height: 1.2;
  white-space: nowrap;

  svg {
    width: 0.95em;
    height: 0.95em;
    flex-shrink: 0;
  }
`;

const CasePrimaryActionButton = styled(CardButton)`
  ${casePrimaryActionStyles}
`;

const CaseDetailsPanel = styled.section`
  display: grid;
  gap: 10px;
`;

const CaseDetailsShell = styled.div`
  display: grid;
  grid-template-columns: minmax(180px, 240px) minmax(0, 1fr);
  gap: 14px;
  align-items: start;

  @media (max-width: 760px) {
    grid-template-columns: 1fr;
  }
`;

const CaseDetailsNav = styled.nav`
  display: grid;
  gap: 8px;
`;

const CaseDetailsNavButton = styled.button`
  width: 100%;
  min-height: 48px;
  display: flex;
  align-items: center;
  text-align: left;
  border-radius: 9px;
  border: 1px solid
    ${(props) => (props.$active ? "rgba(106, 121, 92, 0.55)" : "rgba(106, 121, 92, 0.12)")};
  background: ${(props) => (props.$active ? "#f8faf3" : "#fff")};
  color: #2d3629;
  padding: 10px 12px;
  cursor: pointer;
  box-shadow: ${(props) =>
    props.$active ? "0 6px 16px rgba(0, 0, 0, 0.06)" : "0 3px 10px rgba(0, 0, 0, 0.025)"};

  strong {
    color: #1b1b1b;
    font-size: 0.9rem;
    font-weight: 800;
    line-height: 1.2;
  }
`;

const CaseDetailsContent = styled.article`
  min-width: 0;
  display: grid;
  gap: 10px;
  align-content: start;
  border: 1px solid rgba(106, 121, 92, 0.12);
  border-radius: 10px;
  background: #fff;
  padding: 16px 18px;
  min-height: calc((48px * 5) + (8px * 4));
`;

const CaseDetailsContentTitle = styled.h3`
  margin: 0;
  color: #1b1b1b;
  font-size: 1.15rem;
  line-height: 1.25;
`;

const CaseDetailsContentText = styled.p`
  margin: 0;
  color: #2d3629;
  font-size: 0.96rem;
  line-height: 1.55;
  ${(props) =>
    props.$expanded
      ? ""
      : `
        display: -webkit-box;
        -webkit-line-clamp: 9;
        -webkit-box-orient: vertical;
        overflow: hidden;
      `}
`;

const CaseExpandButton = styled.button`
  width: fit-content;
  border: 0;
  background: transparent;
  color: #6a795c;
  font-size: 0.76rem;
  font-weight: 800;
  padding: 1px 0 0;
  cursor: pointer;

  &:hover {
    color: #0f5b48;
    text-decoration: underline;
  }
`;

const CaseLinkLabel = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  border: 1px solid rgba(106, 121, 92, 0.18);
  background: #fff;
  color: #55644c;
  padding: 4px 9px;
  font-size: 0.78rem;
  font-weight: 800;
`;

const RecordTypePill = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  border: 1px solid
    ${(props) => (props.$type === "session" ? "rgba(79, 124, 66, 0.22)" : "rgba(106, 121, 92, 0.18)")};
  background: ${(props) => (props.$type === "session" ? "rgba(79, 124, 66, 0.1)" : "rgba(106, 121, 92, 0.08)")};
  color: ${(props) => (props.$type === "session" ? "#4f7c42" : "#55644c")};
  padding: 4px 9px;
  font-size: 0.76rem;
  font-weight: 900;
`;

const TimelineList = styled.div`
  position: relative;
  display: grid;
  gap: 10px;
  padding-left: 18px;

  &::before {
    content: "";
    position: absolute;
    left: 5px;
    top: 6px;
    bottom: 6px;
    width: 2px;
    border-radius: 999px;
    background: rgba(106, 121, 92, 0.14);
  }
`;

const TimelineItem = styled.article`
  position: relative;
  display: grid;
  gap: 0;
`;

const TimelineMarker = styled.span`
  position: absolute;
  left: -18px;
  top: 18px;
  width: 12px;
  height: 12px;
  border-radius: 999px;
  border: 2px solid #fff;
  background: ${(props) => (props.$type === "session" ? "#4f7c42" : "#6a795c")};
  box-shadow: 0 0 0 2px rgba(106, 121, 92, 0.16);
`;

const TimelineCard = styled.div`
  position: relative;
  background: #fff;
  border-radius: 12px;
  border: 1px solid
    ${(props) =>
    props.$compact ? "rgba(106, 121, 92, 0.14)" : "rgba(106, 121, 92, 0.2)"};
  padding: ${(props) => (props.$compact ? "10px 12px" : "13px")};
	  box-shadow: ${(props) =>
	    props.$compact
	      ? "0 4px 14px rgba(0, 0, 0, 0.035)"
	      : "0 8px 20px rgba(0, 0, 0, 0.05)"};
  transition: border-color 0.15s ease, box-shadow 0.15s ease, transform 0.15s ease;

  &:hover {
    border-color: rgba(106, 121, 92, 0.3);
    box-shadow: 0 10px 22px rgba(0, 0, 0, 0.06);
    transform: translateY(-1px);
  }
`;

const TimelineCardLink = styled(Link)`
  display: block;
  color: inherit;
  text-decoration: none;
  padding-right: 38px;

  &:focus {
    outline: none;
  }

  &:focus-visible {
    border-radius: 10px;
    box-shadow: 0 0 0 3px rgba(106, 121, 92, 0.14);
  }
`;

const TimelineCardContent = styled.div`
  display: block;
  padding-right: 92px;

  @media (max-width: 640px) {
    padding-right: 0;
    padding-top: 38px;
  }
`;

const TimelineCardHeader = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;

  @media (max-width: 640px) {
    flex-direction: column;
  }
`;

const TimelineCardMeta = styled.div`
  display: flex;
  align-items: center;
  gap: 7px;
  flex-wrap: wrap;
`;

const TimelineDate = styled.span`
  color: #2d3629;
  font-size: 0.82rem;
  font-weight: 900;
`;

const TimelineCardActions = styled.div`
  position: absolute;
  top: 10px;
  right: 10px;
  display: inline-flex;
  gap: 6px;
  align-items: center;
  flex-shrink: 0;
`;

const TimelineEditButton = styled(SubtleCardButton)`
  min-height: 34px;
  padding: 7px 12px;
`;

const TimelineCardTitle = styled.h3`
  margin: 6px 0 0;
  color: #1b1b1b;
  font-size: 0.94rem;
  line-height: 1.32;
`;

const TimelineText = styled.p`
  margin: 5px 0 0;
  color: #55644c;
  font-size: 0.9rem;
  line-height: 1.38;
`;

const TimelineClinicalLine = styled.div`
  display: grid;
  gap: 3px;
  margin-top: 8px;
  color: #55644c;
  line-height: 1.38;

  strong {
    color: #2d3629;
    font-size: 0.78rem;
  }
`;

const TimelinePainLine = styled.div`
  width: fit-content;
  margin-top: 8px;
  border-radius: 999px;
  background: rgba(165, 106, 0, 0.08);
  color: #7a5000;
  padding: 5px 9px;
  font-size: 0.8rem;
  font-weight: 800;
`;

const CaseStatusSelect = styled(InlineSelect)`
  width: auto;
  min-width: 128px;
  min-height: 34px;
  padding: 0 30px 0 10px;
  font-size: 0.82rem;
  font-weight: 800;
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

const ModalBody = styled.div`
  padding: 16px 18px;
  max-height: min(560px, calc(100vh - 190px));
  overflow: auto;
`;

const ModalFooter = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 14px 18px 18px;
  border-top: 1px solid rgba(106, 121, 92, 0.12);
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
