import { financialTodayDate } from "./financialDateTime";

export const formatClinicExpenseStatus = (status) => {
  if (status === "paid") return "Pago";
  return "Pendente";
};
export const getClinicExpenseStatus = (entry, now = new Date()) => {
  if (!entry) return "pending";
  if (entry.status) return entry.status === "open" ? "pending" : entry.status;
  if (entry.paid_at) return "paid";
  const dueDate = String(entry.due_date || "").slice(0, 10);
  const today = financialTodayDate(now);
  if (dueDate && dueDate < today) return "overdue";
  return "pending";
};
