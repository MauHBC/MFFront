const BIRTH_DATE_MASK = /^(\d{2})\/(\d{2})\/(\d{4})$/;
const BIRTH_DATE_API = /^(\d{4})-(\d{2})-(\d{2})$/;

export function maskBirthDateInput(value) {
  const digits = String(value || "")
    .replace(/\D/g, "")
    .slice(0, 8);

  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

function parseBirthDate(value) {
  if (value === null || value === undefined || value === "") return null;

  let dayText = "";
  let monthText = "";
  let yearText = "";

  if (value instanceof Date) {
    const date = value;
    if (Number.isNaN(date.getTime())) return null;
    return {
      day: date.getDate(),
      month: date.getMonth() + 1,
      year: date.getFullYear(),
    };
  }

  const stringValue = String(value).trim();
  const apiMatch = stringValue.match(BIRTH_DATE_API);
  const maskedValue = maskBirthDateInput(stringValue);
  const inputMatch = maskedValue.match(BIRTH_DATE_MASK);

  if (apiMatch) {
    [, yearText, monthText, dayText] = apiMatch;
  } else if (inputMatch) {
    [, dayText, monthText, yearText] = inputMatch;
  } else {
    return null;
  }

  const day = Number(dayText);
  const month = Number(monthText);
  const year = Number(yearText);

  if (year < 1000) return null;

  const date = new Date(year, month - 1, day);
  const isValidDate =
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day;

  if (!isValidDate) return null;

  return { day, month, year };
}

export function isBirthDateFilled(value) {
  return String(value || "").trim().length > 0;
}

export function isBirthDateValid(value) {
  return parseBirthDate(value) !== null;
}

export function formatBirthDateForApi(value) {
  const parsedDate = parseBirthDate(value);
  if (!parsedDate) return null;

  const { day, month, year } = parsedDate;
  return [
    String(year).padStart(4, "0"),
    String(month).padStart(2, "0"),
    String(day).padStart(2, "0"),
  ].join("-");
}

export function formatBirthDateForDisplay(value) {
  const parsedDate = parseBirthDate(value);
  if (!parsedDate) return "--/--/----";

  const { day, month, year } = parsedDate;
  return [
    String(day).padStart(2, "0"),
    String(month).padStart(2, "0"),
    String(year).padStart(4, "0"),
  ].join("/");
}

export function formatBirthDateForInput(value) {
  const parsedDate = parseBirthDate(value);
  if (!parsedDate) return "";

  const { day, month, year } = parsedDate;
  return [
    String(day).padStart(2, "0"),
    String(month).padStart(2, "0"),
    String(year).padStart(4, "0"),
  ].join("/");
}

export function calculateAgeFromBirthDate(value) {
  const parsedDate = parseBirthDate(value);
  if (!parsedDate) return null;

  const now = new Date();
  let years = now.getFullYear() - parsedDate.year;
  const hadBirthday =
    now.getMonth() + 1 > parsedDate.month ||
    (now.getMonth() + 1 === parsedDate.month &&
      now.getDate() >= parsedDate.day);

  if (!hadBirthday) years -= 1;
  return years < 0 ? 0 : years;
}
