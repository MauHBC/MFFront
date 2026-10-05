import { formatInTimeZone, fromZonedTime } from "date-fns-tz";

export const SAO_PAULO_TIME_ZONE = "America/Sao_Paulo";

const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const EXPLICIT_INSTANT_PATTERN = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,9}))?)?(Z|[+-]\d{2}:\d{2})$/;
const pad = (value) => String(value).padStart(2, "0");

const validDate = (value) => value instanceof Date && !Number.isNaN(value.getTime());

export const normalizeCivilDate = (value) => {
  const match = String(value || "").match(DATE_ONLY_PATTERN);
  if (!match) return "";
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const marker = new Date(Date.UTC(year, month - 1, day));
  if (
    marker.getUTCFullYear() !== year
    || marker.getUTCMonth() !== month - 1
    || marker.getUTCDate() !== day
  ) return "";
  return `${String(year).padStart(4, "0")}-${pad(month)}-${pad(day)}`;
};
export const parseExplicitInstant = (value) => {
  if (value instanceof Date) return validDate(value) ? new Date(value.getTime()) : null;
  if (typeof value === "number") {
    const date = new Date(value);
    return validDate(date) ? date : null;
  }
  if (typeof value !== "string") return null;
  const match = value.trim().match(EXPLICIT_INSTANT_PATTERN);
  if (!match || !normalizeCivilDate(match[1])) return null;
  const hour = Number(match[2]);
  const minute = Number(match[3]);
  const second = Number(match[4] || 0);
  const offset = match[6];
  if (hour > 23 || minute > 59 || second > 59) return null;
  if (offset !== "Z") {
    const [offsetHour, offsetMinute] = offset.slice(1).split(":").map(Number);
    if (offsetHour > 23 || offsetMinute > 59) return null;
  }
  const date = new Date(value);
  return validDate(date) ? date : null;
};

export const civilDateToMarker = (value) => {
  const normalized = normalizeCivilDate(value);
  if (!normalized) return null;
  const [year, month, day] = normalized.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
};

export const markerToCivilDate = (value) => {
  if (!validDate(value)) return "";
  return `${String(value.getUTCFullYear()).padStart(4, "0")}-${pad(value.getUTCMonth() + 1)}-${pad(value.getUTCDate())}`;
};

export const civilDateInSaoPaulo = (value) => {
  if (typeof value === "string") {
    const normalized = normalizeCivilDate(value);
    if (normalized) return normalized;
    if (DATE_ONLY_PATTERN.test(value)) return "";
  }
  const date = parseExplicitInstant(value);
  return validDate(date) ? formatInTimeZone(date, SAO_PAULO_TIME_ZONE, "yyyy-MM-dd") : "";
};

export const civilMonthInSaoPaulo = (value) => {
  const dateOnly = civilDateInSaoPaulo(value);
  return dateOnly ? dateOnly.slice(0, 7) : "";
};

export const todayInSaoPaulo = (now = new Date()) => (
  validDate(now) ? formatInTimeZone(now, SAO_PAULO_TIME_ZONE, "yyyy-MM-dd") : ""
);

export const addCivilDays = (value, amount) => {
  const marker = civilDateToMarker(value);
  if (!marker || !Number.isFinite(Number(amount))) return "";
  marker.setUTCDate(marker.getUTCDate() + Number(amount));
  return markerToCivilDate(marker);
};

export const addCivilMonths = (value, amount, { clampDay = true } = {}) => {
  const normalized = normalizeCivilDate(value);
  if (!normalized || !Number.isFinite(Number(amount))) return "";
  const [year, month, day] = normalized.split("-").map(Number);
  const firstOfTarget = new Date(Date.UTC(year, month - 1 + Number(amount), 1));
  const targetYear = firstOfTarget.getUTCFullYear();
  const targetMonth = firstOfTarget.getUTCMonth();
  if (targetYear < 1900 || targetYear > 9999) return "";
  const daysInTarget = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
  const targetDay = clampDay ? Math.min(day, daysInTarget) : day;
  const marker = new Date(Date.UTC(targetYear, targetMonth, targetDay));
  return markerToCivilDate(marker);
};

export const getCivilMonthRange = (monthValue) => {
  const match = String(monthValue || "").match(/^(\d{4})-(\d{2})$/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (year < 1900 || year > 9999 || month < 1 || month > 12) return null;
  const endMarker = new Date(Date.UTC(year, month, 0));
  return {
    start: `${String(year).padStart(4, "0")}-${pad(month)}-01`,
    end: markerToCivilDate(endMarker),
  };
};

export const getCivilYearRange = (yearValue) => {
  const normalizedYear = String(yearValue || "").trim();
  if (!/^\d{4}$/.test(normalizedYear)) return null;
  const year = Number(normalizedYear);
  if (year < 1900 || year > 9999) return null;
  return {
    start: `${String(year).padStart(4, "0")}-01-01`,
    end: `${String(year).padStart(4, "0")}-12-31`,
  };
};

export const saoPauloCivilDateTimeToInstant = (
  dateValue,
  timeValue = "00:00:00",
) => {
  const dateOnly = normalizeCivilDate(dateValue);
  if (!dateOnly || !/^\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?$/.test(String(timeValue))) {
    return null;
  }
  const date = fromZonedTime(`${dateOnly}T${timeValue}`, SAO_PAULO_TIME_ZONE);
  if (!validDate(date)) return null;
  const expectedMinute = `${dateOnly}T${String(timeValue).slice(0, 5)}`;
  return formatInTimeZone(date, SAO_PAULO_TIME_ZONE, "yyyy-MM-dd'T'HH:mm") === expectedMinute
    ? date
    : null;
};

export const formatInstantInSaoPaulo = (value, pattern = "dd/MM/yyyy") => {
  const date = parseExplicitInstant(value);
  return validDate(date) ? formatInTimeZone(date, SAO_PAULO_TIME_ZONE, pattern) : "";
};

export const formatCivilDate = (value) => {
  const normalized = normalizeCivilDate(value);
  if (!normalized) return "";
  const [year, month, day] = normalized.split("-");
  return `${day}/${month}/${year}`;
};
