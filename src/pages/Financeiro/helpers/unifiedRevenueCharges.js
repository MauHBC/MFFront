import { getBillingDueStatus } from "./billingCycleDueStatus";

export const revenueTypeLabel = (kind) => ({
  billing_cycle: "Mensalidade", series: "Pacote", entry: "Avulsa",
}[kind] || "Cobrança");

const cents = (value) => Number.isSafeInteger(value) && value >= 0;
const dateLabel = (value) => value ? String(value).slice(0, 10).split("-").reverse().join("/") : "—";

export const validateUnifiedRevenueSummary = (data) => {
  const validAmounts = (row) => [row?.total, row?.received, row?.pending].every(cents);
  if (data?.origin !== "all" || !validAmounts(data.summary) || !Array.isArray(data.patients)
    || !data.patients.every((row) => Number.isSafeInteger(row.patient_id) && row.patient_id > 0
      && validAmounts(row) && cents(row.entries_count))) {
    throw new Error("Não foi possível conferir os valores do resumo de receitas.");
  }
  return data;
};

export const validateUnifiedRevenueDetail = (detail, patientId) => {
  if (detail?.origin !== "all" || Number(detail?.patient?.id) !== Number(patientId)
    || !Array.isArray(detail.charges) || !Array.isArray(detail.financial_history)
    || ![detail.summary?.total, detail.summary?.received, detail.summary?.pending,
      detail.summary?.creditAvailable].every(cents)) {
    throw new Error("Não foi possível conferir as cobranças e o crédito deste paciente.");
  }
  const keys = new Set();
  const entries = new Set();
  detail.charges.forEach((charge) => {
    const key = `${charge.kind}:${charge.sourceId}`;
    if (!["billing_cycle", "series", "entry"].includes(charge.kind)
      || !Number.isSafeInteger(charge.sourceId) || charge.sourceId <= 0 || keys.has(key)
      || ![charge.amount_cents, charge.paid_cents, charge.open_cents, charge.overdue_cents].every(cents)
      || !Array.isArray(charge.entries)
      || (charge.open_cents > 0 && !getBillingDueStatus({ dueDate: charge.reference_date }).dateOnly)) {
      throw new Error("Resposta de cobranças inválida. Atualize os dados antes de receber.");
    }
    keys.add(key);
    charge.entries.forEach((entry) => {
      if (!Number.isSafeInteger(entry.entryId) || entry.entryId <= 0 || entries.has(entry.entryId)
        || !cents(entry.openCents) || entry.openCents <= 0) {
        throw new Error("Resposta de cobranças inválida. Atualize os dados antes de receber.");
      }
      entries.add(entry.entryId);
    });
    if (charge.entries.reduce((sum, entry) => sum + entry.openCents, 0) !== charge.open_cents) {
      throw new Error("As cobranças estão incompletas. Atualize os dados antes de receber.");
    }
  });
  return detail;
};

export const mapUnifiedRevenueCharge = (charge) => ({
  ...charge,
  id: `${charge.kind}-${charge.sourceId}`,
  sourceId: charge.sourceId,
  serviceName: charge.service_name || "Nome não registrado",
  referenceDate: charge.reference_date || null,
  dueDate: charge.due_date || null,
  dueDates: charge.due_dates || [],
  overdueCents: charge.overdue_cents,
  amountCents: charge.amount_cents,
  paidCents: charge.paid_cents,
  openCents: charge.open_cents,
  financialStatus: charge.financial_status,
  duePresentation: getBillingDueStatus({ dueDate: charge.due_date, openCents: charge.open_cents }),
  totalSessions: Number(charge.total_sessions || charge.sessions?.length || 0),
  usedSessions: Number(charge.used_sessions || 0),
  expiresAt: charge.expires_at || null,
  usageSummary: charge.usage_summary || {},
  sessions: charge.sessions || [],
  entries: charge.entries.map((entry) => ({
    ...entry, referenceDate: entry.reference_date || charge.reference_date,
  })),
});

// Display order never determines the order of money or the proportional remainder.
export const financialEntryOrder = (first, second) => (
  String(first.referenceDate || first.reference_date || "").localeCompare(
    String(second.referenceDate || second.reference_date || ""),
  ) || Number(first.entryId || first.entry_id) - Number(second.entryId || second.entry_id)
);

export const buildUnifiedReceiptGroups = (charges) => charges
  .filter((charge) => charge.openCents > 0 && charge.entries.length
    && !["canceled", "no_charge"].includes(charge.financialStatus))
  .map((charge) => ({
    key: charge.id,
    kind: charge.kind,
    sourceId: charge.sourceId,
    label: `${revenueTypeLabel(charge.kind)} · ${charge.serviceName}`,
    referenceDate: String(charge.referenceDate || "").slice(0, 10),
    ...(charge.kind === "billing_cycle" ? {
      details: `Período ${dateLabel(charge.cycle_start)} a ${dateLabel(charge.cycle_end)} · Vencimento ${dateLabel(charge.dueDate)}`,
    } : {}),
    entries: [...charge.entries].sort(financialEntryOrder),
  }))
  .sort((first, second) => first.referenceDate.localeCompare(second.referenceDate)
    || first.sourceId - second.sourceId || first.kind.localeCompare(second.kind));
