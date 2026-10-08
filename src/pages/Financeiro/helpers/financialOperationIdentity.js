import { formatCivilDate } from "../../../utils/canonicalDateTime";
import { formatFinancialInstant, parseFinancialHistoricalValue } from "./financialDateTime";

export const formatPaymentOperationIdentity = (operation, formatCurrency) => {
  const receipt = operation.kind === "receipt" || operation.type === "RECEIPT";
  const parsed = parseFinancialHistoricalValue(operation.occurred_at);
  const date = parsed && ["civil-date", "legacy-paid-date"].includes(parsed.kind)
    ? formatCivilDate(parsed.dateOnly)
    : formatFinancialInstant(operation.occurred_at, receipt ? "dd/MM/yyyy" : "dd/MM/yyyy HH:mm");
  const amount = operation.original_amount_cents ?? operation.amount_cents;
  let origin = operation.payment_method_name;
  if (receipt) origin = origin || "Forma não registrada";
  else if (origin === "Crédito disponível") origin = null;
  return [receipt ? "Recebimento" : "Uso de crédito", date || "Data não registrada",
    Number.isSafeInteger(amount) ? formatCurrency(amount) : "Valor não registrado",
    origin,
    operation.reference].filter(Boolean).join(" · ");
};
