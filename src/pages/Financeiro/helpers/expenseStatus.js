export const formatClinicExpenseStatus = (status) => {
  if (status === "paid") return "Pago";
  return "Pendente";
};

export const getClinicExpenseStatus = (entry) => {
  if (!entry) return "pending";
  if (entry.status) return entry.status === "open" ? "pending" : entry.status;
  if (entry.paid_at) return "paid";
  const dueDate = String(entry.due_date || "").slice(0, 10);
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const today = `${now.getFullYear()}-${month}-${day}`;
  if (dueDate && dueDate < today) return "overdue";
  return "pending";
};
