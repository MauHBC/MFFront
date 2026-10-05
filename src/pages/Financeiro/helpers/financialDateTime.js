import {
  addCivilDays,
  civilDateInSaoPaulo,
  civilMonthInSaoPaulo,
  formatInstantInSaoPaulo,
  normalizeCivilDate,
  parseExplicitInstant,
  saoPauloCivilDateTimeToInstant,
  todayInSaoPaulo,
} from "../../../utils/canonicalDateTime";

const OFFSET_DATE_TIME_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})$/;
const LEGACY_PAID_AT_PATTERN = /^(\d{4}-\d{2}-\d{2})T09:00(?::00(?:\.0{1,3})?)?$/;

export const financialTodayDate = (now = new Date()) => todayInSaoPaulo(now);

export const financialCivilDateFromInstant = (value) => civilDateInSaoPaulo(value);

export const financialCivilMonthFromInstant = (value) => civilMonthInSaoPaulo(value);

export const formatFinancialInstant = (value, pattern = "dd/MM/yyyy") => (
  formatInstantInSaoPaulo(value, pattern)
);

export const financialCivilBoundaryToInstant = (dateValue, timeValue) => (
  saoPauloCivilDateTimeToInstant(dateValue, timeValue)
);

export const financialCivilDayStartInstant = (dateValue) => {
  const dateOnly = normalizeCivilDate(dateValue);
  if (!dateOnly) return null;

  for (let minuteOfDay = 0; minuteOfDay < 24 * 60; minuteOfDay += 1) {
    const hour = String(Math.floor(minuteOfDay / 60)).padStart(2, "0");
    const minute = String(minuteOfDay % 60).padStart(2, "0");
    const instant = financialCivilBoundaryToInstant(dateOnly, `${hour}:${minute}:00.000`);
    if (instant) return instant;
  }

  return null;
};

export const financialCivilDateRangeToInstants = ({ start = "", end = "" } = {}) => {
  const normalizedStart = start ? normalizeCivilDate(start) : "";
  const normalizedEnd = end ? normalizeCivilDate(end) : "";
  const endNextDay = normalizedEnd ? addCivilDays(normalizedEnd, 1) : "";

  return {
    start: normalizedStart ? financialCivilDayStartInstant(normalizedStart) : null,
    endExclusive: endNextDay ? financialCivilDayStartInstant(endNextDay) : null,
  };
};

// O contrato legado grava a data financeira às 09h do calendário de São Paulo.
export const financialPaidAtInstant = (dateValue) => {
  const date = financialCivilBoundaryToInstant(dateValue, "09:00:00");
  return date ? date.toISOString() : "";
};

export const parseFinancialHistoricalValue = (value) => {
  const text = String(value || "").trim();
  const dateOnly = normalizeCivilDate(text);
  if (dateOnly) return { kind: "civil-date", dateOnly, date: null };
  if (OFFSET_DATE_TIME_PATTERN.test(text)) {
    const date = parseExplicitInstant(text);
    return date ? { kind: "instant", dateOnly: "", date } : null;
  }
  const legacyMatch = text.match(LEGACY_PAID_AT_PATTERN);
  if (legacyMatch) {
    const date = financialCivilBoundaryToInstant(legacyMatch[1], "09:00:00");
    return date ? { kind: "legacy-paid-date", dateOnly: legacyMatch[1], date } : null;
  }
  return null;
};
