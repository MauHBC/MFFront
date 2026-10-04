import { formatInTimeZone, fromZonedTime } from "date-fns-tz";

export const AGENDA_TIME_ZONE = "America/Sao_Paulo";

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const CIVIL_DATE_TIME_PATTERN = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?$/;

const isValidDate = (value) => value instanceof Date && !Number.isNaN(value.getTime());

const parseCivilAgendaDateTime = (value) => {
  const match = String(value || "").match(CIVIL_DATE_TIME_PATTERN);
  if (!match) return null;

  const civilMinute = `${match[1]}T${match[2]}:${match[3]}`;
  const seconds = match[4] || "00";
  const milliseconds = String(match[5] || "").padEnd(3, "0");
  const civilWithPrecision = `${civilMinute}:${seconds}${milliseconds ? `.${milliseconds}` : ""}`;
  const date = fromZonedTime(civilWithPrecision, AGENDA_TIME_ZONE);
  if (!isValidDate(date)) return null;

  // Rejeita horários civis inexistentes em transições históricas do fuso.
  if (formatInTimeZone(date, AGENDA_TIME_ZONE, "yyyy-MM-dd'T'HH:mm") !== civilMinute) {
    return null;
  }

  return date;
};

export const parseAgendaDateTime = (value) => {
  if (!value) return null;
  if (isValidDate(value)) return new Date(value.getTime());

  const text = String(value).trim();
  if (!text) return null;
  if (DATE_ONLY_PATTERN.test(text)) {
    return parseCivilAgendaDateTime(`${text}T00:00`);
  }
  if (CIVIL_DATE_TIME_PATTERN.test(text)) {
    return parseCivilAgendaDateTime(text);
  }

  const date = new Date(text);
  return isValidDate(date) ? date : null;
};

export const formatAgendaDateTimeInput = (value) => {
  const date = parseAgendaDateTime(value);
  if (!date) return "";
  return formatInTimeZone(date, AGENDA_TIME_ZONE, "yyyy-MM-dd'T'HH:mm");
};

export const formatAgendaDateInput = (value) => {
  const date = parseAgendaDateTime(value);
  if (!date) return "";
  return formatInTimeZone(date, AGENDA_TIME_ZONE, "yyyy-MM-dd");
};

export const formatAgendaHourInput = (value) => {
  const date = parseAgendaDateTime(value);
  if (!date) return "";
  return formatInTimeZone(date, AGENDA_TIME_ZONE, "HH");
};

export const formatAgendaMinuteInput = (value) => {
  const date = parseAgendaDateTime(value);
  if (!date) return "";
  return formatInTimeZone(date, AGENDA_TIME_ZONE, "mm");
};

export const formatAgendaDate = (value) => {
  const date = parseAgendaDateTime(value);
  if (!date) return "";
  return formatInTimeZone(date, AGENDA_TIME_ZONE, "dd/MM/yyyy");
};

export const formatAgendaTime = (value) => {
  const date = parseAgendaDateTime(value);
  if (!date) return "";
  return formatInTimeZone(date, AGENDA_TIME_ZONE, "HH:mm");
};

export const getAgendaIsoWeekday = (value) => {
  const date = parseAgendaDateTime(value);
  if (!date) return null;
  return Number(formatInTimeZone(date, AGENDA_TIME_ZONE, "i"));
};

export const resolveAgendaFormInterval = ({
  startInput,
  endInput,
  originalStart = null,
  originalEnd = null,
}) => {
  const startDate = parseAgendaDateTime(startInput);
  const endDate = endInput ? parseAgendaDateTime(endInput) : null;
  if (!startDate || (endInput && !endDate)) {
    return {
      valid: false,
      changed: false,
      starts_at: null,
      ends_at: null,
      startDate,
      endDate,
    };
  }

  const startCivil = formatAgendaDateTimeInput(startDate);
  const endCivil = endDate ? formatAgendaDateTimeInput(endDate) : "";
  const originalStartCivil = originalStart ? formatAgendaDateTimeInput(originalStart) : "";
  const originalEndCivil = originalEnd ? formatAgendaDateTimeInput(originalEnd) : "";
  const hasOriginal = Boolean(originalStartCivil);
  const startChanged = hasOriginal && startCivil !== originalStartCivil;
  const changed = hasOriginal
    ? startChanged || endCivil !== originalEndCivil
    : true;
  const originalStartDate = originalStart ? parseAgendaDateTime(originalStart) : null;
  const originalEndDate = originalEnd ? parseAgendaDateTime(originalEnd) : null;
  const originalDuration = originalStartDate && originalEndDate
    ? originalEndDate.getTime() - originalStartDate.getTime()
    : NaN;
  let resolvedEndDate = endDate;
  if (changed && startChanged && originalDuration > 0) {
    resolvedEndDate = new Date(startDate.getTime() + originalDuration);
  }
  let resolvedEnd = null;
  if (!changed && originalEnd) {
    resolvedEnd = originalEnd;
  } else if (resolvedEndDate) {
    resolvedEnd = resolvedEndDate.toISOString();
  }

  return {
    valid: true,
    changed,
    starts_at: !changed && originalStart ? originalStart : startDate.toISOString(),
    ends_at: resolvedEnd,
    startDate,
    endDate: resolvedEndDate,
  };
};
