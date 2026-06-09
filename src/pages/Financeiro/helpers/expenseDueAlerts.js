const DATE_ONLY_RE = /^(\d{4})-(\d{2})-(\d{2})/;
const DAY_MS = 24 * 60 * 60 * 1000;

const toDateOnly = (value = new Date()) => {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    const month = String(value.getMonth() + 1).padStart(2, "0");
    const day = String(value.getDate()).padStart(2, "0");
    return `${value.getFullYear()}-${month}-${day}`;
  }

  const match = String(value || "").match(DATE_ONLY_RE);
  return match ? `${match[1]}-${match[2]}-${match[3]}` : null;
};

const toUtcDayTime = (dateOnly) => {
  const match = String(dateOnly || "").match(DATE_ONLY_RE);
  if (!match) return Number.NaN;
  return Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
};

export const getDaysUntilDue = (dueDate, today = new Date()) => {
  const dueDateOnly = toDateOnly(dueDate);
  const todayDateOnly = toDateOnly(today);
  if (!dueDateOnly || !todayDateOnly) return null;

  const dueTime = toUtcDayTime(dueDateOnly);
  const todayTime = toUtcDayTime(todayDateOnly);
  if (!Number.isFinite(dueTime) || !Number.isFinite(todayTime)) return null;

  return Math.round((dueTime - todayTime) / DAY_MS);
};

export const isExpenseDueAlert = (expense = {}, today = new Date()) => {
  if (expense?.paid_at) return false;
  const daysUntilDue = getDaysUntilDue(expense?.due_date, today);
  return Number.isInteger(daysUntilDue) && daysUntilDue <= 5;
};

export const getExpenseDueAlertLabel = (expense = {}, today = new Date()) => {
  if (!isExpenseDueAlert(expense, today)) return "";
  const daysUntilDue = getDaysUntilDue(expense?.due_date, today);

  if (daysUntilDue < 0) {
    const overdueDays = Math.abs(daysUntilDue);
    return `Vencida há ${overdueDays} ${overdueDays === 1 ? "dia" : "dias"}`;
  }
  if (daysUntilDue === 0) return "Vence hoje";
  if (daysUntilDue === 1) return "Vence amanhã";
  return `Vence em ${daysUntilDue} dias`;
};

export const formatExpenseAlertCount = (count) => {
  const parsed = Number(count || 0);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return parsed > 99 ? "99+" : String(Math.trunc(parsed));
};
