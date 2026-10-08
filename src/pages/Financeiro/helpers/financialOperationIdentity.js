import { formatCivilDate } from "../../../utils/canonicalDateTime";
import { formatFinancialInstant, parseFinancialHistoricalValue } from "./financialDateTime";

export const formatPaymentOperationIdentity = (operation, formatCurrency) => {
  const receipt = operation.kind === "receipt" || operation.type === "RECEIPT";
  const parsed = parseFinancialHistoricalValue(operation.occurred_at);
  const date = parsed && ["civil-date", "legacy-paid-date"].includes(parsed.kind)
    ? formatCivilDate(parsed.dateOnly)
    : formatFinancialInstant(operation.occurred_at, receipt ? "dd/MM/yyyy" : "dd/MM/yyyy HH:mm");
  const amount = operation.original_amount_cents ?? operation.amount_cents;
  return [receipt ? "Recebimento" : "Uso de crédito", date || "Data não registrada",
    Number.isSafeInteger(amount) ? formatCurrency(amount) : "Valor não registrado",
    operation.payment_method_name || (receipt ? "Forma não registrada" : "Crédito disponível"),
    operation.reference].filter(Boolean).join(" · ");
};
