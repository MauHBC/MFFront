const DATE_ONLY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const DAY_IN_MILLISECONDS = 24 * 60 * 60 * 1000;

const pad = (value) => String(value).padStart(2, "0");

export const normalizeDateOnly = (value) => {
  const source = String(value || "").slice(0, 10);
  const match = source.match(DATE_ONLY_RE);
  if (!match) return "";

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const utcDate = new Date(Date.UTC(year, month - 1, day));

  if (
    utcDate.getUTCFullYear() !== year
    || utcDate.getUTCMonth() !== month - 1
    || utcDate.getUTCDate() !== day
  ) {
    return "";
  }

  return `${year}-${pad(month)}-${pad(day)}`;
};

export const getLocalTodayDateOnly = (today = new Date()) => {
  if (!(today instanceof Date) || Number.isNaN(today.getTime())) return "";
  return `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
};

export const formatBillingDueDate = (value) => {
  const dateOnly = normalizeDateOnly(value);
  if (!dateOnly) return "-";
  const [year, month, day] = dateOnly.split("-");
  return `${day}/${month}/${year}`;
};

const toUtcDay = (dateOnly) => {
  const [year, month, day] = dateOnly.split("-").map(Number);
  return Date.UTC(year, month - 1, day);
};

export const getTemporalDateStatus = ({
  date,
  openCents = 0,
  today = new Date(),
} = {}) => {
  const dateOnly = normalizeDateOnly(date);
  const todayDateOnly = typeof today === "string"
    ? normalizeDateOnly(today)
    : getLocalTodayDateOnly(today);

  if (!dateOnly) {
    return {
      dateOnly: "",
      formattedDate: "-",
      state: "missing",
      alertLabel: "",
      daysOverdue: 0,
    };
  }

  if (!todayDateOnly || Number(openCents || 0) <= 0) {
    return {
      dateOnly,
      formattedDate: formatBillingDueDate(dateOnly),
      state: "settled",
      alertLabel: "",
      daysOverdue: 0,
    };
  }

  const daysUntilDue = Math.round(
    (toUtcDay(dateOnly) - toUtcDay(todayDateOnly)) / DAY_IN_MILLISECONDS,
  );

  if (daysUntilDue < 0) {
    const daysOverdue = Math.abs(daysUntilDue);
    return {
      dateOnly,
      formattedDate: formatBillingDueDate(dateOnly),
      state: "overdue",
      alertLabel: `Vencida há ${daysOverdue} ${daysOverdue === 1 ? "dia" : "dias"}`,
      daysOverdue,
    };
  }

  if (daysUntilDue === 0) {
    return {
      dateOnly,
      formattedDate: formatBillingDueDate(dateOnly),
      state: "today",
      alertLabel: "Vence hoje",
      daysOverdue: 0,
    };
  }

  return {
    dateOnly,
    formattedDate: formatBillingDueDate(dateOnly),
    state: "upcoming",
    alertLabel: "A vencer",
    daysOverdue: 0,
  };
};

export const getBillingDueStatus = ({
  dueDate,
  openCents = 0,
  today = new Date(),
} = {}) => getTemporalDateStatus({
  date: dueDate,
  openCents,
  today,
});

export const getGroupedReferenceDatePresentation = (items = [], { today = new Date() } = {}) => {
  const validItems = items
    .map((item) => ({
      referenceDate: normalizeDateOnly(item?.referenceDate),
      openCents: Math.max(0, Number(item?.openCents || 0)),
    }))
    .filter((item) => item.referenceDate)
    .sort((first, second) => first.referenceDate.localeCompare(second.referenceDate));
  const oldestOpenItem = validItems.find((item) => item.openCents > 0) || null;
  const referenceItem = oldestOpenItem || validItems[0] || null;

  if (!referenceItem) {
    return {
      dateOnly: "",
      formattedDate: "-",
      state: "missing",
      alertLabel: "",
    };
  }

  return getTemporalDateStatus({
    date: referenceItem.referenceDate,
    openCents: oldestOpenItem ? oldestOpenItem.openCents : 0,
    today,
  });
};

export const getGroupedBillingDuePresentation = (items = [], { today = new Date() } = {}) => {
  const validItems = items
    .map((item) => ({
      dueDate: normalizeDateOnly(item?.dueDate),
      openCents: Math.max(0, Number(item?.openCents || 0)),
    }))
    .filter((item) => item.dueDate);
  const distinctDueDates = [...new Set(validItems.map((item) => item.dueDate))].sort();
  const oldestOpenItem = validItems
    .filter((item) => item.openCents > 0)
    .sort((first, second) => first.dueDate.localeCompare(second.dueDate))[0] || null;
  const oldestOpenDue = oldestOpenItem
    ? getBillingDueStatus({
      dueDate: oldestOpenItem.dueDate,
      openCents: oldestOpenItem.openCents,
      today,
    })
    : null;

  if (distinctDueDates.length === 0) {
    return {
      count: 0,
      primaryLabel: "-",
      secondaryLabel: "",
      state: "missing",
      oldestOpenDue: null,
    };
  }

  if (distinctDueDates.length === 1) {
    const due = getBillingDueStatus({
      dueDate: distinctDueDates[0],
      openCents: oldestOpenItem?.openCents || 0,
      today,
    });
    return {
      count: 1,
      primaryLabel: due.formattedDate,
      secondaryLabel: due.alertLabel,
      state: due.state,
      oldestOpenDue,
    };
  }

  return {
    count: distinctDueDates.length,
    primaryLabel: `${distinctDueDates.length} vencimentos`,
    secondaryLabel: oldestOpenDue
      ? `Mais antigo em aberto: ${oldestOpenDue.formattedDate} · ${oldestOpenDue.alertLabel}`
      : "",
    state: oldestOpenDue?.state || "settled",
    oldestOpenDue,
  };
};
