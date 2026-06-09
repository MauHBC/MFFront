const toCents = (value) => Number(value || 0);

export const getMonthRangeFromMonthValue = (monthValue) => {
  const match = String(monthValue || "").match(/^(\d{4})-(\d{2})$/);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    return null;
  }

  const lastDay = new Date(year, month, 0).getDate();
  return {
    start: `${match[1]}-${match[2]}-01`,
    end: `${match[1]}-${match[2]}-${String(lastDay).padStart(2, "0")}`,
  };
};

export const getYearRangeFromMonthValue = (monthValue) => {
  const match = String(monthValue || "").match(/^(\d{4})-(\d{2})$/);
  if (!match) return null;

  const year = Number(match[1]);
  if (!Number.isInteger(year) || year < 1900 || year > 9999) return null;

  return {
    start: `${match[1]}-01-01`,
    end: `${match[1]}-12-31`,
  };
};

export const isDateOnlyWithinOverviewRange = (value, range) => {
  if (!range) return false;
  const dateOnly = String(value || "").slice(0, 10);
  return Boolean(dateOnly && dateOnly >= range.start && dateOnly <= range.end);
};

const readMapValue = (mapLike, key) => {
  if (!mapLike || key === null || key === undefined) return null;
  if (typeof mapLike.get === "function") return mapLike.get(key) || mapLike.get(Number(key)) || null;
  return mapLike[key] || mapLike[String(key)] || null;
};

export const resolveOverviewBillingCycleFinancial = (cycle, entryFinancialMap, entryMap) => {
  const entry = cycle?.FinancialEntry || cycle?.financial_entry || (
    cycle?.financial_entry_id ? readMapValue(entryMap, cycle.financial_entry_id) : null
  );
  const financial = entry?.id ? readMapValue(entryFinancialMap, entry.id) : null;
  const amount = toCents(cycle?.amount_cents || entry?.amount_cents || financial?.amount);
  const paid = Math.min(amount, toCents(financial?.paid));
  const open = Math.max(0, toCents(financial?.open ?? amount - paid));
  const status = financial?.status || entry?.status || cycle?.status || "pending";

  return {
    entry,
    amount,
    paid,
    open,
    status,
  };
};

export const calculateFinancialOverview = ({
  month,
  periodMode = "month",
  entries = [],
  entryFinancialMap,
  entryMap,
  billingCycles = [],
  clinicExpensesSummary = {},
}) => {
  const range = periodMode === "year"
    ? getYearRangeFromMonthValue(month)
    : getMonthRangeFromMonthValue(month);
  const result = {
    month,
    revenues: {
      expected: 0,
      received: 0,
      pending: 0,
    },
    expenses: {
      total: toCents(clinicExpensesSummary.totalCents ?? clinicExpensesSummary.total_cents),
      paid: toCents(clinicExpensesSummary.paidCents ?? clinicExpensesSummary.paid_cents),
      open: toCents(clinicExpensesSummary.pendingCents ?? clinicExpensesSummary.open_cents),
      overdue: toCents(clinicExpensesSummary.overdueCents ?? clinicExpensesSummary.overdue_cents),
    },
    result: {
      expected: 0,
      realized: 0,
    },
    summary: {
      received: 0,
      receivable: 0,
      paidExpenses: 0,
      pendingExpenses: 0,
      currentBalance: 0,
      forecastBalance: 0,
    },
    hasMovement: false,
  };

  if (!range) return result;

  const billingEntryIds = new Set();
  billingCycles.forEach((cycle) => {
    const entryId = cycle?.FinancialEntry?.id || cycle?.financial_entry?.id || cycle?.financial_entry_id;
    if (entryId) billingEntryIds.add(Number(entryId));
  });

  entries.forEach((entry) => {
    if (entry?.type !== "income") return;
    if (billingEntryIds.has(Number(entry.id))) return;
    if (!isDateOnlyWithinOverviewRange(entry.reference_date, range)) return;

    const financial = readMapValue(entryFinancialMap, entry.id) || {};
    const amount = toCents(financial.amount ?? entry.amount_cents);
    if (financial.status === "canceled" || entry.status === "canceled") return;

    result.revenues.expected += amount;
    result.revenues.received += Math.min(amount, toCents(financial.paid));
    result.revenues.pending += Math.max(0, toCents(financial.open ?? amount - toCents(financial.paid)));
  });

  billingCycles.forEach((cycle) => {
    if (!isDateOnlyWithinOverviewRange(cycle?.cycle_start, range)) return;
    if (cycle?.status === "canceled") return;

    const financial = resolveOverviewBillingCycleFinancial(cycle, entryFinancialMap, entryMap);
    if (financial.status === "canceled") return;

    result.revenues.expected += financial.amount;
    result.revenues.received += financial.paid;
    result.revenues.pending += financial.open;
  });

  result.result.expected = result.revenues.expected - result.expenses.total;
  result.result.realized = result.revenues.received - result.expenses.paid;
  result.summary = {
    received: result.revenues.received,
    receivable: result.revenues.pending,
    paidExpenses: result.expenses.paid,
    pendingExpenses: result.expenses.open + result.expenses.overdue,
    currentBalance: result.revenues.received - result.expenses.paid,
    forecastBalance: result.revenues.pending - (result.expenses.open + result.expenses.overdue),
  };
  result.hasMovement = [
    result.revenues.expected,
    result.revenues.received,
    result.revenues.pending,
    result.expenses.total,
    result.expenses.paid,
    result.expenses.open,
    result.expenses.overdue,
  ].some((value) => Number(value || 0) > 0);

  return result;
};
