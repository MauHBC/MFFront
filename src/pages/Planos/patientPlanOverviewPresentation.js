import { normalizeSearchText } from "../../utils/patientSearch";

const frequencyPatternFor = (sessionsPerWeek) => {
  const frequency = Number(sessionsPerWeek);
  if (!Number.isSafeInteger(frequency) || frequency < 1) return null;
  return new RegExp(`(^|\\s)${frequency}\\s*(?:x|vez(?:es)?)(?=\\s|$)`, "i");
};

export const commercialNameRepresentsFrequency = ({
  commercialName,
  sessionsPerWeek,
  frequencyLabel,
}) => {
  const normalizedName = normalizeSearchText(commercialName);
  if (!normalizedName) return false;
  const structuredPattern = frequencyPatternFor(sessionsPerWeek);
  if (structuredPattern?.test(normalizedName)) return true;

  const normalizedLabel = normalizeSearchText(frequencyLabel);
  return Boolean(normalizedLabel && normalizedName.includes(normalizedLabel));
};

export const getPlanFrequencySubtitle = (plan = {}) => {
  if (commercialNameRepresentsFrequency({
    commercialName: plan.commercial_name,
    sessionsPerWeek: plan.sessions_per_week,
    frequencyLabel: plan.frequency_label,
  })) return "";

  const explicitLabel = String(plan.frequency_label || "").trim();
  if (explicitLabel) return explicitLabel;
  const sessionsPerWeek = Number(plan.sessions_per_week);
  if (Number.isSafeInteger(sessionsPerWeek) && sessionsPerWeek > 0) {
    return `${sessionsPerWeek}x por semana`;
  }
  return "";
};

export const getOverviewStatusPresentation = (status) => ({
  active: { label: "Ativo", tone: "active" },
  paused: { label: "Pausado", tone: "paused" },
  canceled: { label: "Cancelado", tone: "neutral" },
}[status] || { label: status || "—", tone: "neutral" });

export const getOverviewAgendaPresentation = (agendaState) => (
  agendaState === "configured"
    ? { label: "Configurada", tone: "active" }
    : { label: "Pendente", tone: "paused" }
);
