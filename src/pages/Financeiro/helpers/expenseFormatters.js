const parseCurrencyInputToNumber = (value) => {
  if (value === null || value === undefined) return Number.NaN;
  const normalized = String(value)
    .replace(/[^\d,.-]/g, "")
    .replace(/\./g, "")
    .replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
};

export const parseCurrencyInputToCents = (value) => {
  const parsed = parseCurrencyInputToNumber(value);
  if (Number.isNaN(parsed)) return Number.NaN;
  return Math.round(parsed * 100);
};

export const formatCurrencyInput = (value) => {
  const parsed = parseCurrencyInputToNumber(value);
  if (Number.isNaN(parsed)) return "";
  return parsed.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

export const sanitizeCurrencyInput = (value) => {
  const source = String(value || "");
  const validChars = source.replace(/[^\d,.-]/g, "");
  const lastComma = validChars.lastIndexOf(",");
  const lastDot = validChars.lastIndexOf(".");
  const decimalSeparatorIndex = lastComma > lastDot ? lastComma : -1;
  const onlyValidChars = decimalSeparatorIndex >= 0
    ? `${validChars.slice(0, decimalSeparatorIndex).replace(/[.,]/g, "")},${validChars
      .slice(decimalSeparatorIndex + 1)
      .replace(/[.,]/g, "")}`
    : validChars.replace(/[.,]/g, "");
  const hasNegative = onlyValidChars.startsWith("-");
  const unsigned = onlyValidChars.replace(/-/g, "");
  const [integerRaw = "", ...decimalParts] = unsigned.split(",");
  const integer = integerRaw.replace(/\D/g, "");
  const decimal = decimalParts.join("").replace(/\D/g, "").slice(0, 2);

  if (!integer && !decimal) return "";

  const normalizedInteger = integer.replace(/^0+(?=\d)/, "") || "0";
  const prefix = hasNegative ? "-" : "";
  if (onlyValidChars.includes(",")) return `${prefix}${normalizedInteger},${decimal}`;
  return `${prefix}${normalizedInteger}`;
};

export const sanitizePositiveCurrencyInput = (value) =>
  sanitizeCurrencyInput(value).replace("-", "");

export const normalizeClinicExpenseSummary = (summary = {}) => ({
  totalCents: Number(summary.total_cents || 0),
  pendingCents: Number(summary.open_cents || 0),
  paidCents: Number(summary.paid_cents || 0),
  overdueCents: Number(summary.overdue_cents || 0),
});

export const emptyClinicExpenseSummary = normalizeClinicExpenseSummary();

export const getClinicExpensePaidAmountCents = (expense = {}) => {
  const paidAmount = Number(expense.paid_amount_cents || 0);
  if (paidAmount > 0) return paidAmount;
  return expense.paid_at ? Number(expense.amount_cents || 0) : 0;
};

export const shouldShowClinicExpensePaidAmount = (expense = {}) =>
  Boolean(expense.paid_at)
  && getClinicExpensePaidAmountCents(expense) !== Number(expense.amount_cents || 0);

export const getClinicExpenseObservation = (expense = {}) =>
  String(expense.payment_notes || expense.notes || "").trim() || "-";

export const formatDateOnlyBR = (value) => {
  if (!value) return "-";
  const dateOnlyValue = String(value).slice(0, 10);
  const parts = dateOnlyValue.split("-");
  if (parts.length !== 3) return "-";
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
};
