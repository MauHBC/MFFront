import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import styled from "styled-components";
import {
  FaBars,
  FaCalendarAlt,
  FaChartLine,
  FaChevronLeft,
  FaCoins,
  FaMoneyBillWave,
  FaRegCreditCard,
  FaTags,
  FaTimes,
  FaWallet,
  FaPlus,
} from "react-icons/fa";
import { toast } from "react-toastify";

import Loading from "../../components/Loading";
import axios, { getUserFacingApiError } from "../../services/axios";
import {
  listFinancialEntries,
  createFinancialEntry,
  listFinancialCategories,
  listFinancialPayments,
  listPaymentMethods,
  createFinancialPayment,
  applyCreditToFinancialEntry,
  createFinancialCategory,
  createPaymentMethod,
  listServicePrices,
  createServicePrice,
  updateFinancialCategory,
  updatePaymentMethod,
  updateServicePrice,
  listFinancialRecurringExpenses,
  createFinancialRecurringExpense,
  updateFinancialRecurringExpense,
  createSessionFinancialEntry,
} from "../../services/financial";
import {
  createSpecialSchedulingEvent,
  inactivateSpecialSchedulingEvent,
  listSpecialSchedulingEvents,
} from "../../services/scheduling";

const emptyEntry = {
  type: "income",
  description: "",
  category_id: "",
  patient_id: "",
  service_id: "",
  amount: "",
  reference_date: "",
  due_date: "",
  notes: "",
};

const emptyPayment = {
  entry_id: null,
  patient_id: "",
  payment_method_id: "",
  amount: "",
  convert_entry_to_installments: false,
  entry_installments_count: "2",
  discount: "",
  surcharge: "",
  adjustment_reason: "",
  paid_at: "",
  note: "",
  allocation_mode: "entry",
};

const STANDALONE_PAYMENT_ANCHOR_DESCRIPTION = "Recebimento avulso (sistema)";
const STANDALONE_PAYMENT_ANCHOR_NOTE =
  "Entrada tecnica automatica para viabilizar recebimento avulso.";

const isManualReceiptEntry = (entry) =>
  Boolean(entry && entry.type === "income" && !entry.session_id);

const resolveManualReceiptLabel = (entry) => {
  const description = String(entry?.description || "").trim();
  if (!description || description === STANDALONE_PAYMENT_ANCHOR_DESCRIPTION) {
    return "Recebimento manual";
  }
  return description;
};

const resolveManualReceiptStatus = (amountCents, allocatedCents) => {
  const amount = Number(amountCents || 0);
  const allocated = Number(allocatedCents || 0);
  const remaining = Math.max(0, amount - allocated);

  if (allocated <= 0) return "credit";
  if (remaining <= 0) return "paid";
  return "partial";
};

const HOLIDAY_SOURCE_OPTIONS = [
  { value: "national", label: "Feriado nacional" },
  { value: "state", label: "Feriado estadual" },
  { value: "city", label: "Feriado municipal" },
  { value: "optional_point", label: "Ponto facultativo" },
];

const HOLIDAY_SOURCE_LABELS = HOLIDAY_SOURCE_OPTIONS.reduce((acc, option) => {
  acc[option.value] = option.label;
  return acc;
}, {});

const HOLIDAY_SOURCE_SET = new Set(HOLIDAY_SOURCE_OPTIONS.map((option) => option.value));

const emptyHolidayForm = {
  name: "",
  date: "",
  source_type: "national",
  state_code: "",
  city_name: "",
};

const formatCurrency = (cents) => {
  const value = Number(cents || 0) / 100;
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
};

const formatDate = (value) => {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleDateString("pt-BR");
};

const formatWeekday = (value) => {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  const weekday = parsed.toLocaleDateString("pt-BR", { weekday: "long" });
  return weekday ? weekday.charAt(0).toUpperCase() + weekday.slice(1) : "-";
};

const parseCurrencyInputToNumber = (value) => {
  if (value === null || value === undefined) return Number.NaN;
  const normalized = String(value)
    .replace(/[^\d,.-]/g, "")
    .replace(/\./g, "")
    .replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
};

const formatCurrencyInput = (value) => {
  const parsed = parseCurrencyInputToNumber(value);
  if (Number.isNaN(parsed)) return "";
  return parsed.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

const sanitizeCurrencyInput = (value) => {
  const source = String(value || "");
  const onlyValidChars = source.replace(/[^\d,.-]/g, "").replace(/\./g, ",");
  const hasNegative = onlyValidChars.startsWith("-");
  const unsigned = onlyValidChars.replace(/-/g, "");
  const [integerRaw = "", ...decimalParts] = unsigned.split(",");
  const integer = integerRaw.replace(/\D/g, "");
  const decimal = decimalParts.join("").replace(/\D/g, "").slice(0, 2);

  if (!integer && !decimal) return "";

  const normalizedInteger = integer.replace(/^0+(?=\d)/, "") || "0";
  const prefix = hasNegative ? "-" : "";
  if (onlyValidChars.includes(",")) return `${prefix}${normalizedInteger},${decimal}`;
  return `${prefix}${normalizedInteger}`;
};

const sanitizePositiveCurrencyInput = (value) => sanitizeCurrencyInput(value).replace("-", "");

const formatMonthYear = (value) => {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  const label = parsed.toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });
  return label ? label.charAt(0).toUpperCase() + label.slice(1) : "";
};

const formatHolidayDate = (value) => {
  if (!value) return "-";
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString("pt-BR");
};

const formatHolidayLocation = (item) => {
  if (!item) return "";
  if (item.source_type === "city") {
    const city = String(item.city_name || "").trim();
    const state = String(item.state_code || "").trim().toUpperCase();
    if (city && state) return `${city}/${state}`;
    if (city) return city;
  }
  if (item.source_type === "state") {
    const state = String(item.state_code || "").trim().toUpperCase();
    if (state) return state;
  }
  return "";
};

const closeActionMenu = (event) => {
  const container = event.currentTarget.closest("details");
  if (container) {
    container.removeAttribute("open");
  }
};

const normalizeId = (value) => (value ? Number(value) : null);

const getEntryInstallments = (entry) => {
  const raw =
    entry?.installments ||
    entry?.FinancialEntryInstallments ||
    entry?.financial_entry_installments ||
    [];
  if (!Array.isArray(raw)) return [];
  return [...raw]
    .map((item) => ({
      ...item,
      installment_number: Number(item.installment_number || 0),
      amount_cents: Number(item.amount_cents || 0),
      paid_amount_cents: Number(item.paid_amount_cents || 0),
      open_amount_cents: Number(item.open_amount_cents || 0),
    }))
    .sort((a, b) => Number(a.installment_number || 0) - Number(b.installment_number || 0));
};

const resolveInstallmentAgreement = (
  installments = [],
  fallbackCount = 1,
  fallbackTotalCents = 0,
) => {
  const normalizedInstallments = (Array.isArray(installments) ? installments : [])
    .filter((item) => String(item?.status || "").toLowerCase() !== "canceled")
    .sort((a, b) => Number(a.installment_number || 0) - Number(b.installment_number || 0));

  const count = Math.max(
    1,
    Number(fallbackCount || normalizedInstallments.length || 1),
  );

  if (count <= 1) {
    return {
      count: 1,
      unitCents: 0,
      totalCents: 0,
    };
  }

  const amountFromInstallment = (item) => Math.max(0, Number(item?.amount_cents || 0));
  const allAmounts = normalizedInstallments
    .map(amountFromInstallment)
    .filter((value) => value > 0);

  if (!allAmounts.length) {
    const fallbackTotal = Math.max(0, Number(fallbackTotalCents || 0));
    return {
      count,
      unitCents: Math.floor(fallbackTotal / Math.max(1, count)),
      totalCents: fallbackTotal,
    };
  }

  const recurringAmounts = normalizedInstallments
    .filter((item) => Number(item?.installment_number || 0) > 1)
    .map(amountFromInstallment)
    .filter((value) => value > 0);
  const sample = recurringAmounts.length ? recurringAmounts : allAmounts;

  const frequency = new Map();
  sample.forEach((value) => {
    frequency.set(value, (frequency.get(value) || 0) + 1);
  });

  let unitCents = sample[0] || 0;
  let highestFrequency = -1;
  frequency.forEach((freq, value) => {
    if (freq > highestFrequency || (freq === highestFrequency && value < unitCents)) {
      highestFrequency = freq;
      unitCents = value;
    }
  });

  const totalAmountCents = allAmounts.reduce((sum, value) => sum + value, 0);
  const firstInstallment =
    normalizedInstallments.find((item) => Number(item?.installment_number || 0) === 1)
    || normalizedInstallments[0]
    || null;
  const firstAmountCents = amountFromInstallment(firstInstallment);
  const hasRelevantResidual = firstAmountCents - unitCents > 1;

  return {
    count,
    unitCents,
    totalCents: hasRelevantResidual
      ? Math.min(totalAmountCents, unitCents * count)
      : totalAmountCents,
  };
};

const TOPBAR_HEIGHT = 80;
const SIDEBAR_WIDTH = 240;
const SIDEBAR_COLLAPSED_WIDTH = 86;
const SHOW_FINANCIAL_MANAGEMENT = false;
const SHOW_FINANCIAL_REPORTS = false;
const SHOW_MANUAL_ENTRIES = false;
// Mantemos a view antiga disponivel no codigo, mas fora da navegacao para simplificar a UX.
const SHOW_DEDICATED_PAYMENTS_VIEW = false;

const ATTENDANCE_UI = {
  colors: {
    background: "#f6f8fb",
    surface: "#ffffff",
    surfaceMuted: "#f8fafc",
    border: "#e3e8ef",
    borderStrong: "#d6dde8",
    textPrimary: "#111827",
    textSecondary: "#4b5563",
    textTertiary: "#6b7280",
    textMuted: "#8a94a6",
    action: "#5f7957",
    actionHover: "#536b4d",
    actionSoft: "#edf4ec",
    actionBorder: "#c9d6c6",
    rowStripe: "#fbfcfe",
    rowHover: "#f7f9fc",
    successSoft: "#edf7f1",
    successText: "#1f6a3b",
    infoSoft: "#eef3ff",
    infoText: "#3559a6",
    neutralSoft: "#f3f5f8",
    neutralText: "#475467",
    dangerSoft: "#fff4f0",
    dangerSoftHover: "#feebe4",
    dangerBorder: "#f0c8bb",
    dangerAccent: "#d16a56",
    dangerText: "#a33d2f",
  },
  radius: {
    sm: "10px",
    md: "14px",
    lg: "18px",
    xl: "22px",
    pill: "999px",
  },
  spacing: {
    1: "8px",
    2: "16px",
    3: "24px",
    4: "32px",
    5: "40px",
    6: "48px",
    7: "56px",
    8: "64px",
  },
  font: {
    size: {
      xs: "12px",
      sm: "13px",
      md: "14px",
      lg: "18px",
      xl: "20px",
    },
    lineHeight: {
      xs: "16px",
      sm: "18px",
      md: "20px",
      lg: "24px",
      xl: "28px",
    },
    weight: {
      regular: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
    },
  },
};

const slugifyCode = (value) => {
  if (!value) return "";
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
};

const toDateInputValue = (date) => date.toISOString().slice(0, 10);

const toMonthInputValue = (date) => {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "";
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${date.getFullYear()}-${month}`;
};

const parseMonthInputValue = (value) => {
  const match = String(value || "").match(/^(\d{4})-(\d{2})$/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) return null;
  return { year, month };
};

const parseDateInputBoundary = (value, boundary = "start") => {
  const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  const day = Number(match[3]);
  if (
    !Number.isInteger(year) ||
    !Number.isInteger(monthIndex) ||
    !Number.isInteger(day)
  ) {
    return null;
  }
  if (boundary === "end") {
    return new Date(year, monthIndex, day, 23, 59, 59, 999);
  }
  return new Date(year, monthIndex, day, 0, 0, 0, 0);
};

const toDateTimeLocalInputValue = (value = new Date()) => {
  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  const pad = (item) => String(item).padStart(2, "0");
  return `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(parsed.getDate())}T${pad(parsed.getHours())}:${pad(parsed.getMinutes())}`;
};

const normalizeSearchText = (value) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const getPatientDisplayName = (patient) => patient?.full_name || patient?.name || "Paciente";

const getMonthRangeFromInputValue = (value) => {
  const parsed = parseMonthInputValue(value);
  if (!parsed) return null;
  const start = new Date(parsed.year, parsed.month - 1, 1);
  const end = new Date(parsed.year, parsed.month, 0);
  return {
    start: toDateInputValue(start),
    end: toDateInputValue(end),
  };
};

const getYearRangeFromValue = (value) => {
  const year = Number(String(value || "").trim());
  if (!Number.isInteger(year) || year < 1900 || year > 9999) return null;
  const start = new Date(year, 0, 1);
  const end = new Date(year, 11, 31);
  return {
    start: toDateInputValue(start),
    end: toDateInputValue(end),
  };
};

const getCurrentMonthRange = () => {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  return {
    start: toDateInputValue(start),
    end: toDateInputValue(end),
  };
};

export default function Financeiro() {
  const [activeSection, setActiveSection] = useState("receitas");
  const [receitasView, setReceitasView] = useState("atendimentos");
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isAttendanceLoading, setIsAttendanceLoading] = useState(false);
  const [hasAttendanceLoaded, setHasAttendanceLoaded] = useState(false);
  const [entries, setEntries] = useState([]);
  const [categories, setCategories] = useState([]);
  const [patients, setPatients] = useState([]);
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [services, setServices] = useState([]);
  const [servicePrices, setServicePrices] = useState([]);
  const [payments, setPayments] = useState([]);
  const [recurringExpenses, setRecurringExpenses] = useState([]);
  const [attendanceSessions, setAttendanceSessions] = useState([]);
  const [holidays, setHolidays] = useState([]);
  const [isHolidayLoading, setIsHolidayLoading] = useState(false);
  const [isHolidaySaving, setIsHolidaySaving] = useState(false);
  const [isHolidayOpen, setIsHolidayOpen] = useState(false);
  const [holidayForm, setHolidayForm] = useState(emptyHolidayForm);

  const [filters, setFilters] = useState(() => {
    const range = getCurrentMonthRange();
    return {
      status: "all",
      type: "all",
      start: range.start,
      end: range.end,
      search: "",
    };
  });

  const [paymentFilters, setPaymentFilters] = useState(() => {
    const range = getCurrentMonthRange();
    return {
      patient_id: "",
      start: range.start,
      end: range.end,
      method_id: "",
      search: "",
    };
  });

  const [attendanceFilters, setAttendanceFilters] = useState(() => {
    const range = getCurrentMonthRange();
    return {
      start: range.start,
      end: range.end,
      search: "",
      status: "done",
      financial: "all",
      patient_id: "",
      professional_id: "",
    };
  });
  const [attendanceView, setAttendanceView] = useState("patients");
  const [attendanceDrilldownPatientId, setAttendanceDrilldownPatientId] = useState(null);
  const [attendancePeriodMode, setAttendancePeriodMode] = useState("month");
  const [attendancePeriodMonth, setAttendancePeriodMonth] = useState(() =>
    toMonthInputValue(new Date()),
  );
  const [attendancePeriodYear, setAttendancePeriodYear] = useState(() =>
    String(new Date().getFullYear()),
  );
  const attendanceMonthPickerRef = useRef(null);

  const [isEntryOpen, setIsEntryOpen] = useState(false);
  const [entryForm, setEntryForm] = useState(emptyEntry);
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [isPaymentSaving, setIsPaymentSaving] = useState(false);
  const [paymentForm, setPaymentForm] = useState(emptyPayment);
  const [paymentModalContext, setPaymentModalContext] = useState(null);
  const [paymentAllocations, setPaymentAllocations] = useState({});
  const [paymentPatientQuery, setPaymentPatientQuery] = useState("");
  const [isPaymentPatientSearchFocused, setIsPaymentPatientSearchFocused] = useState(false);
  const [isCategoryOpen, setIsCategoryOpen] = useState(false);
  const [categoryForm, setCategoryForm] = useState({ name: "", type: "income", color: "" });
  const [editingCategoryId, setEditingCategoryId] = useState(null);
  const [isMethodOpen, setIsMethodOpen] = useState(false);
  const [methodForm, setMethodForm] = useState({ name: "" });
  const [editingMethodId, setEditingMethodId] = useState(null);
  const [isServiceOpen, setIsServiceOpen] = useState(false);
  const [isServiceSaving, setIsServiceSaving] = useState(false);
  const [serviceForm, setServiceForm] = useState({
    name: "",
    price: "",
    color: "",
    is_active: true,
    default_duration_minutes: 60,
  });
  const [editingServiceId, setEditingServiceId] = useState(null);
  const [isRecurringOpen, setIsRecurringOpen] = useState(false);
  const [editingRecurringId, setEditingRecurringId] = useState(null);
  const [recurringForm, setRecurringForm] = useState({
    name: "",
    category_id: "",
    amount: "",
    day_of_month: "1",
    notes: "",
  });


  useEffect(() => {
    try {
      const stored = localStorage.getItem("financeiro_sidebar_collapsed");
      if (stored !== null) {
        setIsSidebarCollapsed(stored === "true");
      }
    } catch (error) {
      // ignore storage errors
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return () => { };
    const media = window.matchMedia("(max-width: 960px)");
    const handleChange = () => {
      setIsMobile(media.matches);
      if (!media.matches) {
        setIsSidebarOpen(false);
  }
};

    handleChange();
    if (media.addEventListener) {
      media.addEventListener("change", handleChange);
      return () => media.removeEventListener("change", handleChange);
    }
    media.addListener(handleChange);
    return () => media.removeListener(handleChange);
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return () => { };

    const closeOpenActionMenus = (target) => {
      const openMenus = document.querySelectorAll("details[data-action-menu='true'][open]");
      openMenus.forEach((menu) => {
        if (target && menu.contains(target)) return;
        menu.removeAttribute("open");
      });
    };

    const handlePointerDown = (event) => {
      closeOpenActionMenus(event.target);
    };

    const handleKeyDown = (event) => {
      if (event.key === "Escape") closeOpenActionMenus(null);
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown, { passive: true });
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const categoryMap = useMemo(
    () => new Map(categories.map((item) => [item.id, item])),
    [categories],
  );

  const patientMap = useMemo(
    () => new Map(patients.map((item) => [item.id, item])),
    [patients],
  );

  const sortedPatients = useMemo(() => {
    const collator = new Intl.Collator("pt-BR", {
      sensitivity: "base",
      ignorePunctuation: true,
      numeric: true,
    });
    return [...patients].sort((first, second) =>
      collator.compare(getPatientDisplayName(first), getPatientDisplayName(second)),
    );
  }, [patients]);

  const paymentPatientNormalizedQuery = useMemo(
    () => normalizeSearchText(paymentPatientQuery),
    [paymentPatientQuery],
  );

  const paymentPatientOptions = useMemo(() => {
    if (!paymentPatientNormalizedQuery) return [];
    return sortedPatients
      .filter((patient) =>
        normalizeSearchText(getPatientDisplayName(patient)).includes(paymentPatientNormalizedQuery),
      )
      .slice(0, 12);
  }, [paymentPatientNormalizedQuery, sortedPatients]);

  const serviceMap = useMemo(
    () => new Map(services.map((item) => [item.id, item])),
    [services],
  );

  const sessionById = useMemo(() => {
    const map = new Map();
    attendanceSessions.forEach((session) => {
      if (session?.id) map.set(session.id, session);
    });
    return map;
  }, [attendanceSessions]);

  const activeAttendancePatient = useMemo(() => {
    const patientId = normalizeId(attendanceFilters.patient_id);
    if (!patientId) return null;
    return patientMap.get(patientId) || null;
  }, [attendanceFilters.patient_id, patientMap]);

  const selectedAttendancePatientId = useMemo(
    () => normalizeId(attendanceFilters.patient_id),
    [attendanceFilters.patient_id],
  );

  const servicePriceMap = useMemo(() => {
    const map = new Map();
    servicePrices.forEach((item) => {
      if (!map.has(item.service_id)) {
        map.set(item.service_id, item);
      }
    });
    return map;
  }, [servicePrices]);

  const paymentMethodMap = useMemo(
    () => new Map(paymentMethods.map((item) => [item.id, item])),
    [paymentMethods],
  );

  const professionalOptions = useMemo(() => {
    const map = new Map();
    attendanceSessions.forEach((session) => {
      const professional = session?.professional;
      if (professional?.id) map.set(professional.id, professional);
    });
    return Array.from(map.values());
  }, [attendanceSessions]);

  const entryBySessionId = useMemo(() => {
    const map = new Map();
    entries.forEach((entry) => {
      if (entry.session_id && entry.type === "income") map.set(entry.session_id, entry);
    });
    return map;
  }, [entries]);

  const entryMap = useMemo(() => new Map(entries.map((entry) => [entry.id, entry])), [entries]);

  const paymentAllocationList = useMemo(() => {
    const list = [];
    payments.forEach((payment) => {
      const allocations =
        payment?.FinancialPaymentAllocations ||
        payment?.financial_payment_allocations ||
        [];
      allocations.forEach((allocation) => {
        list.push({ ...allocation, payment });
      });
    });
    return list;
  }, [payments]);

  const paidByEntryId = useMemo(() => {
    const map = new Map();
    paymentAllocationList.forEach((allocation) => {
      const entryId = allocation.entry_id;
      if (!entryId) return;
      const amount = Number(allocation.amount_cents || 0);
      map.set(entryId, (map.get(entryId) || 0) + amount);
    });
    return map;
  }, [paymentAllocationList]);

  const allocatedByPaymentId = useMemo(() => {
    const map = new Map();
    paymentAllocationList.forEach((allocation) => {
      const paymentId = allocation.payment_id || allocation.payment?.id;
      if (!paymentId) return;
      const amount = Number(allocation.amount_cents || 0);
      map.set(paymentId, (map.get(paymentId) || 0) + amount);
    });
    return map;
  }, [paymentAllocationList]);

  const paymentsByEntryId = useMemo(() => {
    const map = new Map();
    paymentAllocationList.forEach((allocation) => {
      const entryId = allocation.entry_id;
      const { payment } = allocation;
      if (!entryId || !payment) return;
      if (!map.has(entryId)) map.set(entryId, new Map());
      map.get(entryId).set(payment.id, payment);
    });
    const result = new Map();
    map.forEach((paymentMap, entryId) => {
      const list = Array.from(paymentMap.values()).sort(
        (a, b) => new Date(b.paid_at || 0) - new Date(a.paid_at || 0),
      );
      result.set(entryId, list);
    });
    return result;
  }, [paymentAllocationList]);

  const entryFinancialMap = useMemo(() => {
    const map = new Map();
    entries.forEach((entry) => {
      const installments = getEntryInstallments(entry);
      const amount = installments.length
        ? installments.reduce((sum, item) => sum + Number(item.amount_cents || 0), 0)
        : Number(entry.amount_cents || 0);
      const paidFromInstallments = installments.reduce(
        (sum, item) => sum + Number(item.paid_amount_cents || 0),
        0,
      );
      const openFromInstallments = installments.reduce(
        (sum, item) => sum + Number(item.open_amount_cents || 0),
        0,
      );

      const paidFromAllocations = paidByEntryId.get(entry.id) || 0;
      const paidValue = installments.length
        ? Math.min(amount, paidFromInstallments)
        : Math.min(amount, paidFromAllocations);
      let open = installments.length
        ? Math.max(0, openFromInstallments)
        : Math.max(0, amount - paidValue);
      let status = entry.status || "pending";

      if (entry.status === "canceled") {
        status = "canceled";
        open = 0;
      } else if (open <= 0 && amount > 0) {
        status = "paid";
      } else if (paidValue > 0) {
        status = "partial";
      } else {
        status = "pending";
      }

      map.set(entry.id, {
        paid: paidValue,
        open,
        status,
        amount,
        installments,
      });
    });
    return map;
  }, [entries, paidByEntryId]);

  const filteredEntries = useMemo(() => {
    const search = normalizeSearchText(filters.search);
    return entries.filter((entry) => {
      const entryStatus = entryFinancialMap.get(entry.id)?.status || entry.status;
      if (filters.status !== "all" && entryStatus !== filters.status) return false;
      if (filters.type !== "all" && entry.type !== filters.type) return false;

      if (filters.start) {
        const startDate = new Date(filters.start);
        const entryDate = new Date(entry.reference_date);
        if (entryDate < startDate) return false;
      }
      if (filters.end) {
        const endDate = new Date(filters.end);
        const entryDate = new Date(entry.reference_date);
        if (entryDate > endDate) return false;
      }

      if (search) {
        const category = entry.category_id ? categoryMap.get(entry.category_id) : null;
        const patient = entry.patient_id ? patientMap.get(entry.patient_id) : null;
        const haystack = normalizeSearchText([
          entry.description,
          entryStatus,
          category?.name,
          getPatientDisplayName(patient),
        ]
          .filter(Boolean)
          .join(" "));
        if (!haystack.includes(search)) return false;
      }

      return true;
    });
  }, [entries, filters, categoryMap, patientMap, entryFinancialMap]);

  const summary = useMemo(() => {
    const data = {
      incomePaid: 0,
      incomePending: 0,
      expenseTotal: 0,
      net: 0,
    };

    filteredEntries.forEach((entry) => {
      const amount = Number(entry.amount_cents || 0);
      if (entry.type === "income") {
        const status = entryFinancialMap.get(entry.id)?.status || entry.status;
        if (status === "paid") data.incomePaid += amount;
        else data.incomePending += amount;
      } else {
        data.expenseTotal += amount;
      }
    });

    data.net = data.incomePaid - data.expenseTotal;
    return data;
  }, [filteredEntries, entryFinancialMap]);

  const creditBalanceByPatient = useMemo(() => {
    const map = new Map();
    payments.forEach((payment) => {
      const allocated = allocatedByPaymentId.get(payment.id) || 0;
      const remaining = Math.max(0, Number(payment.amount_cents || 0) - allocated);
      if (remaining <= 0) return;
      const patientId = payment.patient_id;
      if (!patientId) return;
      map.set(patientId, (map.get(patientId) || 0) + remaining);
    });
    return map;
  }, [payments, allocatedByPaymentId]);


  const formatRecurrence = useCallback((session) => {
    const series = session?.series;
    if (!series) return "Avulso";
    const weekdays = Array.isArray(series.weekdays) ? series.weekdays.length : 0;
    if (weekdays > 0) {
      if (series.repeat_interval === 1) return `${weekdays}x/semana`;
      if (series.repeat_interval === 2) return `${weekdays}x/15 dias`;
      return `${weekdays}x a cada ${series.repeat_interval} semanas`;
    }
    if (series.occurrence_count) return `Serie (${series.occurrence_count} sessoes)`;
    return "Recorrente";
  }, []);

  const formatFinancialStatus = useCallback((status) => {
    if (status === "credit") return "Credito";
    if (status === "paid") return "Pago";
    if (status === "partial") return "Parcial";
    if (status === "canceled") return "Cancelado";
    if (status === "missing") return "Sem lancamento";
    return "Pendente";
  }, []);

  const formatPaymentUsage = useCallback((payment, allocatedAmount) => {
    const amount = Number(payment?.amount_cents || 0);
    const allocated = Number(allocatedAmount || 0);
    const remaining = Math.max(0, amount - allocated);

    if (allocated <= 0) return "Guardado como credito";
    if (remaining <= 0) return "Usado em cobrancas";
    return "Parte usada, parte em credito";
  }, []);

  const holidayRows = useMemo(
    () =>
      [...holidays].sort((first, second) => {
        const firstDate = String(first.start_date || "");
        const secondDate = String(second.start_date || "");
        if (firstDate !== secondDate) return firstDate.localeCompare(secondDate);
        return String(first.name || "").localeCompare(String(second.name || ""));
      }),
    [holidays],
  );

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [
        entriesResponse,
        categoriesResponse,
        paymentMethodsResponse,
        patientsResponse,
        servicesResponse,
        servicePricesResponse,
        paymentsResponse,
        recurringResponse,
      ] = await Promise.all([
        listFinancialEntries(),
        listFinancialCategories(),
        listPaymentMethods(),
        axios.get("/patients"),
        axios.get("/services"),
        listServicePrices(),
        listFinancialPayments(),
        listFinancialRecurringExpenses(),
      ]);

      setEntries(entriesResponse.data || []);
      setCategories(categoriesResponse.data || []);
      setPaymentMethods(paymentMethodsResponse.data || []);
      setPatients(patientsResponse.data || []);
      setServices(servicesResponse.data || []);
      setServicePrices(servicePricesResponse.data || []);
      setPayments(paymentsResponse.data || []);
      setRecurringExpenses(recurringResponse.data || []);
    } catch (error) {
      toast.error("Nao foi possivel carregar o financeiro.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const loadAttendance = useCallback(async () => {
    try {
      setIsAttendanceLoading(true);
      const params = {};
      if (attendanceFilters.status && attendanceFilters.status !== "all") {
        params.status = attendanceFilters.status;
      }
      if (attendanceFilters.start) params.from = attendanceFilters.start;
      if (attendanceFilters.end) params.to = attendanceFilters.end;
      const response = await axios.get("/sessions", { params });
      setAttendanceSessions(response.data || []);
      setHasAttendanceLoaded(true);
    } catch (error) {
      toast.error("Nao foi possivel carregar atendimentos.");
      setHasAttendanceLoaded(true);
    }
    finally {
      setIsAttendanceLoading(false);
    }
  }, [
    attendanceFilters.end,
    attendanceFilters.start,
    attendanceFilters.status,
  ]);

  const loadHolidays = useCallback(async () => {
    try {
      setIsHolidayLoading(true);
      const response = await listSpecialSchedulingEvents({});
      const items = Array.isArray(response.data) ? response.data : [];
      setHolidays(items.filter((item) => HOLIDAY_SOURCE_SET.has(item.source_type)));
    } catch (error) {
      toast.error("Nao foi possivel carregar os feriados.");
    } finally {
      setIsHolidayLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeSection === "receitas") {
      loadAttendance();
    }
  }, [activeSection, loadAttendance]);

  useEffect(() => {
    if (activeSection === "holidays") {
      loadHolidays();
    }
  }, [activeSection, loadHolidays]);

  const openEntryModal = useCallback(() => {
    setEntryForm(emptyEntry);
    setIsEntryOpen(true);
  }, []);

  const closeEntryModal = useCallback(() => {
    setIsEntryOpen(false);
  }, []);

  const openPaymentModal = useCallback((entry, options = null) => {
    const dueInstallment = options?.installment || null;
    const hasInstallmentTarget = Boolean(dueInstallment);
    const hasPredefinedMethod = Boolean(options?.payment_method_id);
    const openAmountOverrideCents = Math.max(0, Number(options?.open_amount_cents || 0));
    const hasOpenAmountOverride = openAmountOverrideCents > 0;
    const isSimplifiedInstallment = Boolean(
      options?.simplifiedInstallment && dueInstallment && hasPredefinedMethod,
    );
    const financial = entryFinancialMap.get(entry.id);
    const existingInstallments = getEntryInstallments(entry);
    const existingInstallmentsCount = Math.max(
      1,
      Number(entry.installments_count || 0) || existingInstallments.length || 1,
    );
    const fallbackOpen = Math.max(
      0,
      Number(entry.amount_cents || 0) - (paidByEntryId.get(entry.id) || 0),
    );
    const installmentOpenCents = isSimplifiedInstallment
      ? Math.max(
        0,
        Number(dueInstallment?.open_amount_cents || dueInstallment?.amount_cents || 0),
      )
      : 0;
    const targetedInstallmentOpenCents = hasInstallmentTarget
      ? Math.max(0, Number(dueInstallment?.open_amount_cents || dueInstallment?.amount_cents || 0))
      : 0;
    let openAmountCents = Math.max(0, Number(financial?.open ?? fallbackOpen));
    if (hasInstallmentTarget && targetedInstallmentOpenCents > 0) {
      openAmountCents = targetedInstallmentOpenCents;
    }
    if (hasOpenAmountOverride) {
      openAmountCents = openAmountOverrideCents;
	    }
	    if (isSimplifiedInstallment) {
	      openAmountCents = installmentOpenCents;
	    }
	    const paidAt = (hasInstallmentTarget && dueInstallment?.due_date)
	      ? `${String(dueInstallment.due_date).slice(0, 10)}T09:00`
	      : toDateTimeLocalInputValue(new Date());
	    const paymentMethodId = isSimplifiedInstallment
	      ? String(options?.payment_method_id || "")
	      : "";
	    setPaymentForm({
      ...emptyPayment,
      entry_id: entry.id,
      patient_id: entry.patient_id || "",
      payment_method_id: paymentMethodId,
      allocation_mode: "entry",
      amount: formatCurrencyInput(openAmountCents / 100),
      convert_entry_to_installments: false,
      entry_installments_count: String(Math.max(2, existingInstallmentsCount)),
      paid_at: paidAt,
    });
	    setPaymentModalContext({
	      simplifiedInstallment: isSimplifiedInstallment,
      installmentId: dueInstallment?.id || null,
      installmentNumber: Number(dueInstallment?.installment_number || 0) || null,
      installmentDueDate: dueInstallment?.due_date || null,
      installmentAmountCents: installmentOpenCents,
      installmentCount: existingInstallmentsCount,
      paymentMethodId: paymentMethodId || "",
      paymentMethodName: options?.payment_method_name || "",
	    });
	    setPaymentPatientQuery("");
	    setIsPaymentPatientSearchFocused(false);
	    setPaymentAllocations({});
	    setIsPaymentOpen(true);
	  }, [entryFinancialMap, paidByEntryId]);

	  const closePaymentModal = useCallback(() => {
	    setIsPaymentOpen(false);
	    setIsPaymentSaving(false);
	    setPaymentModalContext(null);
	    setPaymentAllocations({});
	    setPaymentPatientQuery("");
	    setIsPaymentPatientSearchFocused(false);
	  }, []);

	  const openCreditModal = useCallback(() => {
	    setPaymentForm({
	      ...emptyPayment,
	      entry_id: null,
	      patient_id: "",
	      allocation_mode: "credit",
	      amount: "",
	      paid_at: toDateTimeLocalInputValue(new Date()),
	    });
	    setPaymentAllocations({});
	    setPaymentModalContext(null);
	    setPaymentPatientQuery("");
	    setIsPaymentPatientSearchFocused(false);
	    setIsPaymentOpen(true);
	  }, []);

  useEffect(() => {
    if (!isPaymentOpen || typeof document === "undefined") return () => { };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isPaymentOpen]);

  useEffect(() => {
    if (!isPaymentOpen || typeof document === "undefined") return () => { };
    const handleEscape = (event) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      closePaymentModal();
    };
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isPaymentOpen, closePaymentModal]);

  const handleEntryChange = useCallback((event) => {
    const { name, value } = event.target;
    setEntryForm((prev) => ({ ...prev, [name]: value }));
  }, []);

  const handlePaymentChange = useCallback((event) => {
    const { name, value, type, checked } = event.target;
    if (name === "allocation_mode" && value !== "manual") {
      setPaymentAllocations({});
    }
    if (name === "amount" || name === "discount" || name === "surcharge") {
      setPaymentForm((prev) => ({ ...prev, [name]: sanitizePositiveCurrencyInput(value) }));
      return;
    }
    if (name === "entry_installments_count") {
      const digits = String(value || "").replace(/\D/g, "");
      setPaymentForm((prev) => ({
        ...prev,
        entry_installments_count: digits ? String(Math.max(2, Number(digits))) : "",
      }));
      return;
    }
    setPaymentForm((prev) => ({ ...prev, [name]: type === "checkbox" ? checked : value }));
  }, []);

  const handlePaymentPatientSearchChange = useCallback((event) => {
    const { value } = event.target;
    setPaymentPatientQuery(value);
    setPaymentForm((prev) => ({
      ...prev,
      patient_id: "",
    }));
  }, []);

  const handleSelectPaymentPatient = useCallback((patient) => {
    const patientName = getPatientDisplayName(patient);
    setPaymentPatientQuery(patientName);
    setPaymentForm((prev) => ({
      ...prev,
      patient_id: String(patient.id),
    }));
    setIsPaymentPatientSearchFocused(false);
  }, []);

  const handlePaymentPatientSearchBlur = useCallback(() => {
    if (!paymentPatientNormalizedQuery) {
      setIsPaymentPatientSearchFocused(false);
      return;
    }

    const exactMatch = sortedPatients.find(
      (patient) =>
        normalizeSearchText(getPatientDisplayName(patient)) === paymentPatientNormalizedQuery,
    );

    if (exactMatch) {
      handleSelectPaymentPatient(exactMatch);
      return;
    }

    setIsPaymentPatientSearchFocused(false);
  }, [
    handleSelectPaymentPatient,
    paymentPatientNormalizedQuery,
    sortedPatients,
  ]);

  const handlePaymentCurrencyBlur = useCallback((event) => {
    const { name } = event.target;
    if (!["amount", "discount", "surcharge"].includes(name)) return;
    setPaymentForm((prev) => ({
      ...prev,
      [name]: formatCurrencyInput(prev[name]),
    }));
  }, []);

  const handleAllocationChange = useCallback((entryId, value) => {
    setPaymentAllocations((prev) => ({
      ...prev,
      [entryId]: sanitizePositiveCurrencyInput(value),
    }));
  }, []);

  const handleFilterChange = useCallback((event) => {
    const { name, value } = event.target;
    setFilters((prev) => ({ ...prev, [name]: value }));
  }, []);

  const handlePaymentFilterChange = useCallback((event) => {
    const { name, value } = event.target;
    setPaymentFilters((prev) => ({ ...prev, [name]: value }));
  }, []);

  const handleAttendanceFilterChange = useCallback((event) => {
    const { name, value } = event.target;
    setAttendanceFilters((prev) => ({ ...prev, [name]: value }));
    if (name === "patient_id") {
      setAttendanceDrilldownPatientId(null);
      if (!value) {
        setAttendanceView("patients");
      }
    }
  }, []);

  const handleClearAttendancePatientFilter = useCallback(() => {
    setAttendanceFilters((prev) => ({ ...prev, patient_id: "" }));
    setAttendanceDrilldownPatientId(null);
  }, []);

  useEffect(() => {
    const range =
      attendancePeriodMode === "year"
        ? getYearRangeFromValue(attendancePeriodYear)
        : getMonthRangeFromInputValue(attendancePeriodMonth);

    if (!range) return;

    setAttendanceFilters((prev) => {
      if (prev.start === range.start && prev.end === range.end) return prev;
      return {
        ...prev,
        start: range.start,
        end: range.end,
      };
    });
  }, [attendancePeriodMode, attendancePeriodMonth, attendancePeriodYear]);

  const handleAttendanceMonthPickerChange = useCallback((event) => {
    const { value } = event.target;
    const parsed = parseMonthInputValue(value);
    if (!parsed) return;
    setAttendancePeriodMonth(value);
    setAttendancePeriodYear(String(parsed.year));
  }, []);

  const handleAttendanceYearPickerChange = useCallback((event) => {
    const digits = String(event.target.value || "").replace(/\D/g, "").slice(0, 4);
    if (!digits) return;
    setAttendancePeriodYear(digits);
    setAttendancePeriodMonth((prev) => {
      const parsed = parseMonthInputValue(prev);
      if (!parsed) return `${digits}-01`;
      return `${digits}-${String(parsed.month).padStart(2, "0")}`;
    });
  }, []);

  const handleAttendancePeriodModeChange = useCallback((mode) => {
    if (!["month", "year"].includes(mode)) return;
    setAttendancePeriodMode(mode);
  }, []);

  const handleAttendancePeriodTagClick = useCallback(() => {
    if (attendancePeriodMode !== "month") return;
    const input = attendanceMonthPickerRef.current;
    if (!input) return;
    if (typeof input.showPicker === "function") {
      try {
        input.showPicker();
        return;
      } catch (error) {
        // fallback below
      }
    }
    input.focus();
    input.click();
  }, [attendancePeriodMode]);

  const shiftAttendancePeriod = useCallback((direction) => {
    if (!Number.isFinite(direction) || direction === 0) return;
    if (attendancePeriodMode === "year") {
      setAttendancePeriodYear((prev) => {
        const baseYear = Number(String(prev || "").trim());
        const nextYear = Number.isInteger(baseYear)
          ? baseYear + direction
          : new Date().getFullYear() + direction;
        return String(nextYear);
      });
      return;
    }

    setAttendancePeriodMonth((prev) => {
      const parsed = parseMonthInputValue(prev);
      const baseDate = parsed
        ? new Date(parsed.year, parsed.month - 1, 1)
        : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
      const target = new Date(baseDate.getFullYear(), baseDate.getMonth() + direction, 1);
      return toMonthInputValue(target);
    });
  }, [attendancePeriodMode]);

  const handleAttendancePreviousMonth = useCallback(() => {
    shiftAttendancePeriod(-1);
  }, [shiftAttendancePeriod]);

  const handleAttendanceNextMonth = useCallback(() => {
    shiftAttendancePeriod(1);
  }, [shiftAttendancePeriod]);

  const handleViewPatientSessions = useCallback((patientId) => {
    if (!patientId) return;
    setAttendanceDrilldownPatientId(String(patientId));
    setAttendanceFilters((prev) => ({ ...prev, patient_id: String(patientId) }));
    setAttendanceView("sessions");
  }, []);

  const handleAttendanceViewChange = useCallback(
    (view) => {
      if (view === "sessions" && !attendanceFilters.patient_id) return;
      setAttendanceView(view);
      if (
        view === "patients" &&
        attendanceDrilldownPatientId &&
        attendanceFilters.patient_id === attendanceDrilldownPatientId
      ) {
        setAttendanceFilters((prev) => ({ ...prev, patient_id: "" }));
        setAttendanceDrilldownPatientId(null);
      }
    },
    [attendanceDrilldownPatientId, attendanceFilters.patient_id],
  );

  const handleActionMenuToggle = useCallback((event) => {
    const detailsEl = event.currentTarget;
    if (!detailsEl?.open || typeof window === "undefined") return;

    const trigger = detailsEl.querySelector("summary");
    const menuList = detailsEl.querySelector("[data-action-menu-list='true']");
    if (!trigger || !menuList) return;

    window.requestAnimationFrame(() => {
      const triggerRect = trigger.getBoundingClientRect();
      const menuRect = menuList.getBoundingClientRect();
      const menuWidth = Math.max(menuRect.width || 0, 190);
      const menuHeight = Math.max(menuRect.height || 0, 90);
      const margin = 8;
      const gap = 6;

      const spaceBelow = window.innerHeight - triggerRect.bottom - margin;
      const spaceAbove = triggerRect.top - margin;
      const openUp = spaceBelow < menuHeight && spaceAbove > spaceBelow;

      const top = openUp
        ? Math.max(margin, triggerRect.top - menuHeight - gap)
        : Math.min(window.innerHeight - menuHeight - margin, triggerRect.bottom + gap);

      const left = Math.min(
        Math.max(margin, triggerRect.right - menuWidth),
        window.innerWidth - menuWidth - margin,
      );

      detailsEl.style.setProperty("--action-menu-top", `${top}px`);
      detailsEl.style.setProperty("--action-menu-left", `${left}px`);
    });
  }, []);

  const toggleSidebar = useCallback(() => {
    setIsSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("financeiro_sidebar_collapsed", String(next));
      } catch (error) {
        // ignore storage errors
      }
      return next;
    });
  }, []);

  const openSidebar = useCallback(() => {
    setIsSidebarOpen(true);
  }, []);

  const closeSidebar = useCallback(() => {
    setIsSidebarOpen(false);
  }, []);

  const handleSidebarToggle = useCallback(() => {
    if (isMobile) {
      closeSidebar();
      return;
    }
    toggleSidebar();
  }, [closeSidebar, isMobile, toggleSidebar]);

  const handleSectionChange = useCallback(
    (section) => {
      setActiveSection(section);
      if (isMobile) {
        closeSidebar();
      }
    },
    [closeSidebar, isMobile],
  );

  const openHolidayModal = useCallback(() => {
    setHolidayForm(emptyHolidayForm);
    setIsHolidayOpen(true);
  }, []);

  const closeHolidayModal = useCallback(() => {
    if (isHolidaySaving) return;
    setIsHolidayOpen(false);
  }, [isHolidaySaving]);

  const handleHolidayChange = useCallback((event) => {
    const { name, value } = event.target;
    setHolidayForm((prev) => {
      const next = { ...prev, [name]: value };
      if (name === "source_type") {
        if (value !== "state" && value !== "city") {
          next.state_code = "";
        }
        if (value !== "city") {
          next.city_name = "";
        }
      }
      if (name === "state_code") {
        next.state_code = String(value || "").toUpperCase().slice(0, 2);
      }
      return next;
    });
  }, []);

  const handleSaveHoliday = useCallback(async () => {
    if (!holidayForm.name.trim()) {
      toast.error("Informe o nome do feriado.");
      return;
    }
    if (!holidayForm.date) {
      toast.error("Informe a data do feriado.");
      return;
    }
    if (holidayForm.source_type === "state" && !holidayForm.state_code.trim()) {
      toast.error("Informe a UF do feriado estadual.");
      return;
    }
    if (holidayForm.source_type === "city") {
      if (!holidayForm.state_code.trim()) {
        toast.error("Informe a UF do feriado municipal.");
        return;
      }
      if (!holidayForm.city_name.trim()) {
        toast.error("Informe a cidade do feriado municipal.");
        return;
      }
    }

    try {
      setIsHolidaySaving(true);
      await createSpecialSchedulingEvent({
        source_type: holidayForm.source_type,
        behavior_type: "BLOCK",
        name: holidayForm.name.trim(),
        description: null,
        start_date: holidayForm.date,
        end_date: holidayForm.date,
        all_day: true,
        start_time: null,
        end_time: null,
        affects_scheduling: true,
        professional_id: null,
        state_code: holidayForm.state_code.trim() || null,
        city_name: holidayForm.city_name.trim() || null,
      });
      toast.success("Feriado adicionado.");
      setHolidayForm(emptyHolidayForm);
      setIsHolidayOpen(false);
      await loadHolidays();
    } catch (error) {
      toast.error(error?.response?.data?.error || "Nao foi possivel salvar o feriado.");
    } finally {
      setIsHolidaySaving(false);
    }
  }, [holidayForm, loadHolidays]);

  const handleDeleteHoliday = useCallback(
    async (holiday) => {
      if (!holiday?.id) return;
      try {
        await inactivateSpecialSchedulingEvent(holiday.id);
        toast.success("Feriado excluido.");
        await loadHolidays();
      } catch (error) {
        toast.error(error?.response?.data?.error || "Nao foi possivel excluir o feriado.");
      }
    },
    [loadHolidays],
  );

  const openCategoryModal = useCallback((category = null) => {
    if (category) {
      setCategoryForm({
        name: category.name || "",
        type: category.type || "income",
        color: category.color || "",
      });
      setEditingCategoryId(category.id);
    } else {
      setCategoryForm({ name: "", type: "income", color: "" });
      setEditingCategoryId(null);
    }
    setIsCategoryOpen(true);
  }, []);

  const closeCategoryModal = useCallback(() => {
    setIsCategoryOpen(false);
    setEditingCategoryId(null);
  }, []);

  const openMethodModal = useCallback((method = null) => {
    if (method) {
      setMethodForm({ name: method.name || "" });
      setEditingMethodId(method.id);
    } else {
      setMethodForm({ name: "" });
      setEditingMethodId(null);
    }
    setIsMethodOpen(true);
  }, []);

  const closeMethodModal = useCallback(() => {
    setIsMethodOpen(false);
    setEditingMethodId(null);
  }, []);

  const openServiceModal = useCallback(
    (service = null) => {
      if (service) {
        const price = servicePriceMap.get(service.id);
        setServiceForm({
          name: service.name || "",
          price: price ? (Number(price.price_cents || 0) / 100).toFixed(2) : "",
          color: service.color || "#6a795c",
          is_active: service.is_active ?? true,
          default_duration_minutes: service.default_duration_minutes || 60,
        });
        setEditingServiceId(service.id);
      } else {
        setServiceForm({
          name: "",
          price: "",
          color: "#6a795c",
          is_active: true,
          default_duration_minutes: 60,
        });
        setEditingServiceId(null);
      }
      setIsServiceOpen(true);
    },
    [servicePriceMap],
  );

  const closeServiceModal = useCallback(() => {
    setIsServiceOpen(false);
    setEditingServiceId(null);
  }, []);

  const handleCategoryChange = useCallback((event) => {
    const { name, value } = event.target;
    setCategoryForm((prev) => ({ ...prev, [name]: value }));
  }, []);

  const handleMethodChange = useCallback((event) => {
    const { name, value } = event.target;
    setMethodForm((prev) => ({ ...prev, [name]: value }));
  }, []);

  const handleServiceChange = useCallback((event) => {
    const { name, value, type, checked } = event.target;
    setServiceForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  }, []);

  const handleSaveEntry = useCallback(async () => {
    const amountValue = Number(entryForm.amount.replace(",", "."));
    if (!entryForm.reference_date) {
      toast.error("Informe a data de referencia.");
      return;
    }
    if (!entryForm.type) {
      toast.error("Selecione o tipo do lancamento.");
      return;
    }
    if (Number.isNaN(amountValue) || amountValue <= 0) {
      toast.error("Informe um valor valido.");
      return;
    }

    try {
      const payload = {
        type: entryForm.type,
        description: entryForm.description.trim() || null,
        category_id: normalizeId(entryForm.category_id),
        patient_id: normalizeId(entryForm.patient_id),
        service_id: normalizeId(entryForm.service_id),
        amount_cents: Math.round(amountValue * 100),
        currency: "BRL",
        reference_date: entryForm.reference_date,
        due_date: entryForm.due_date || null,
        notes: entryForm.notes.trim() || null,
      };

      await createFinancialEntry(payload);
      toast.success("Lancamento criado.");
      closeEntryModal();
      loadData();
    } catch (error) {
      toast.error("Nao foi possivel salvar o lancamento.");
    }
  }, [entryForm, closeEntryModal, loadData]);

  const createStandalonePaymentAnchor = useCallback(
    async ({ patientId, referenceDate }) => {
      const normalizedReferenceDate =
        String(referenceDate || "").slice(0, 10) || new Date().toISOString().slice(0, 10);
      const response = await createFinancialEntry({
        type: "income",
        description: STANDALONE_PAYMENT_ANCHOR_DESCRIPTION,
        patient_id: patientId,
        amount_cents: 0,
        currency: "BRL",
        reference_date: normalizedReferenceDate,
        due_date: normalizedReferenceDate,
        notes: STANDALONE_PAYMENT_ANCHOR_NOTE,
      });
      const createdEntryId = Number(response?.data?.id || 0);
      if (!createdEntryId) {
        throw new Error("Nao foi possivel preparar o recebimento avulso.");
      }
      return createdEntryId;
    },
    [],
  );

  const handleSavePayment = useCallback(async () => {
    if (isPaymentSaving) return;
    const amountValue = parseCurrencyInputToNumber(paymentForm.amount);
    const discountValue = parseCurrencyInputToNumber(paymentForm.discount);
    const surchargeValue = parseCurrencyInputToNumber(paymentForm.surcharge);
    const amountCents = Math.round(amountValue * 100);
    const isSimplifiedInstallmentPayment = Boolean(paymentModalContext?.simplifiedInstallment);
    const simplifiedInstallmentAmountCents = isSimplifiedInstallmentPayment
      ? Math.max(0, Number(paymentModalContext?.installmentAmountCents || 0))
      : 0;
    const effectiveAmountCents = isSimplifiedInstallmentPayment
      ? simplifiedInstallmentAmountCents
      : amountCents;
    const discountCents =
      Number.isFinite(discountValue) && discountValue > 0 ? Math.round(discountValue * 100) : 0;
    const surchargeCents =
      Number.isFinite(surchargeValue) && surchargeValue > 0 ? Math.round(surchargeValue * 100) : 0;
    const hasAdjustment = !isSimplifiedInstallmentPayment
      && paymentForm.entry_id
      && (discountCents > 0 || surchargeCents > 0);
    const entryId = Number(paymentForm.entry_id || 0);
    const entryFinancial = entryId ? entryFinancialMap.get(entryId) : null;
    const entryInstallments = Array.isArray(entryFinancial?.installments)
      ? entryFinancial.installments
      : [];
    const originalInstallmentsCountForValidation = entryId
      ? Math.max(
          1,
          Number(entryMap.get(entryId)?.installments_count || entryInstallments.length || 1),
        )
      : 1;
    const isAlreadyInstallmentCharge = originalInstallmentsCountForValidation > 1;
    const shouldConvertEntryToInstallments = Boolean(
      paymentForm.entry_id
      && paymentForm.convert_entry_to_installments
      && !isAlreadyInstallmentCharge
      && !isSimplifiedInstallmentPayment,
    );
    const requestedInstallmentsCount = Number(paymentForm.entry_installments_count || 0);
    const baseCentsForValidation = entryId
      ? Math.max(
          0,
          Number(
            entryFinancialMap.get(entryId)?.open ??
              entryMap.get(entryId)?.amount_cents ??
              0,
          ),
        )
      : 0;

    if (
      (!isSimplifiedInstallmentPayment && (Number.isNaN(amountValue) || amountValue <= 0))
      || (isSimplifiedInstallmentPayment && effectiveAmountCents <= 0)
    ) {
      toast.error("Informe um valor valido.");
      return;
    }
    if (!isSimplifiedInstallmentPayment && !paymentForm.paid_at) {
      toast.error("Informe a data do pagamento.");
      return;
    }
    if (!paymentForm.entry_id && !paymentForm.patient_id) {
      toast.error("Selecione o paciente.");
      return;
    }
    if (!normalizeId(paymentForm.payment_method_id)) {
      toast.error("Selecione a forma de pagamento.");
      return;
    }
    if (Number.isFinite(discountValue) && discountValue < 0) {
      toast.error("Desconto nao pode ser negativo.");
      return;
    }
    if (Number.isFinite(surchargeValue) && surchargeValue < 0) {
      toast.error("Acrescimo nao pode ser negativo.");
      return;
    }
    if (paymentForm.entry_id && discountCents > baseCentsForValidation) {
      toast.error("O desconto nao pode ser maior que o valor original.");
      return;
    }
    if (hasAdjustment && !paymentForm.adjustment_reason.trim()) {
      toast.error("Informe o motivo do ajuste.");
      return;
    }
    if (paymentForm.entry_id && paymentForm.convert_entry_to_installments && isAlreadyInstallmentCharge) {
      toast.error("Esta cobranca ja esta parcelada. Registre apenas a quitacao.");
      return;
    }
    if (shouldConvertEntryToInstallments) {
      if (Number.isNaN(requestedInstallmentsCount) || requestedInstallmentsCount <= 1) {
        toast.error("Informe um numero de parcelas maior que 1.");
        return;
      }
    }

    try {
      setIsPaymentSaving(true);
      const selectedPatientId = normalizeId(paymentForm.patient_id);
      const selectedPaymentMethodId = normalizeId(paymentForm.payment_method_id);
      const allocationMode = paymentForm.entry_id
        ? "entry"
        : paymentForm.allocation_mode || "none";
      const paymentReferenceDate = isSimplifiedInstallmentPayment
        ? String(paymentModalContext?.installmentDueDate || "").slice(0, 10)
        : String(paymentForm.paid_at || "").slice(0, 10);
      const allocationItems = Object.entries(paymentAllocations)
        .map(([allocationEntryId, value]) => {
          const parsed = parseCurrencyInputToNumber(value);
          if (Number.isNaN(parsed) || parsed <= 0) return null;
          return {
            entry_id: Number(allocationEntryId),
            amount_cents: Math.round(parsed * 100),
          };
        })
        .filter(Boolean);
      const allocationTotal = allocationItems.reduce(
        (sum, item) => sum + Number(item.amount_cents || 0),
        0,
      );

      if (allocationMode === "manual") {
        if (!allocationItems.length) {
          toast.error("Informe as cobrancas para alocar.");
          return;
        }
        if (allocationTotal > effectiveAmountCents) {
          toast.error("O valor distribuido nao pode ser maior que o recebimento.");
          return;
        }
      }

      const paidAtIso = isSimplifiedInstallmentPayment && paymentModalContext?.installmentDueDate
        ? new Date(`${String(paymentModalContext.installmentDueDate).slice(0, 10)}T09:00:00`).toISOString()
        : new Date(paymentForm.paid_at).toISOString();
      let paymentEntryId = paymentForm.entry_id || null;
      let paymentAllocationMode = allocationMode;

      if (!paymentEntryId) {
        paymentEntryId = await createStandalonePaymentAnchor({
          patientId: selectedPatientId,
          referenceDate: paymentReferenceDate,
        });
        if (allocationMode === "credit") {
          paymentAllocationMode = "entry";
        }
      }

      await createFinancialPayment({
        entry_id: paymentEntryId,
        patient_id: selectedPatientId,
        payment_method_id: selectedPaymentMethodId,
        amount_cents: effectiveAmountCents,
        paid_at: paidAtIso,
        note: isSimplifiedInstallmentPayment ? null : paymentForm.note.trim() || null,
        allocation_mode: paymentAllocationMode,
        allocations: paymentAllocationMode === "manual" ? allocationItems : undefined,
        discount_cents: hasAdjustment ? discountCents : undefined,
        surcharge_cents: hasAdjustment ? surchargeCents : undefined,
        adjustment_reason: hasAdjustment ? paymentForm.adjustment_reason.trim() : undefined,
        adjustment: hasAdjustment
          ? {
              discount_cents: discountCents,
              surcharge_cents: surchargeCents,
              reason: paymentForm.adjustment_reason.trim(),
            }
          : undefined,
        convert_entry_to_installments: shouldConvertEntryToInstallments || undefined,
        entry_installments_count: shouldConvertEntryToInstallments
          ? Math.trunc(requestedInstallmentsCount)
          : undefined,
        preferred_installment_id: Number(paymentModalContext?.installmentId || 0) || undefined,
      });

      toast.success("Recebimento registrado.");
      closePaymentModal();
      setPaymentAllocations({});
      loadData();
    } catch (error) {
      toast.error(
        getUserFacingApiError(
          error,
          "Nao foi possivel registrar o recebimento. Tente novamente em instantes.",
        ),
      );
    } finally {
      setIsPaymentSaving(false);
    }
  }, [
    isPaymentSaving,
    paymentForm,
    paymentAllocations,
    entryFinancialMap,
    entryMap,
    paymentModalContext,
    createStandalonePaymentAnchor,
    closePaymentModal,
    loadData,
  ]);

  const handleCreateSessionEntry = useCallback(
    async (sessionId) => {
      try {
        await createSessionFinancialEntry(sessionId);
        toast.success("Lancamento gerado.");
        loadData();
        loadAttendance();
      } catch (error) {
        toast.error("Nao foi possivel gerar o lancamento.");
      }
    },
    [loadAttendance, loadData],
  );

  const handleApplyCreditToEntry = useCallback(
    async (entryId) => {
      try {
        await applyCreditToFinancialEntry(entryId);
        toast.success("Credito aplicado na cobranca.");
        loadData();
        loadAttendance();
      } catch (error) {
        toast.error("Nao foi possivel usar o credito.");
      }
    },
    [loadAttendance, loadData],
  );

  const attendanceRows = useMemo(() => {
    const search = normalizeSearchText(attendanceFilters.search);
    return attendanceSessions
      .map((session) => {
        const entry = entryBySessionId.get(session.id) || null;
        const patientName =
          session?.Patient?.full_name || session?.Patient?.name || "Paciente";
        const professionalName =
          session?.professional?.name || session?.professional?.email || "-";
        const serviceName =
          session?.Service?.name ||
          session?.service_type ||
          "Servico";
        const serviceId = session?.Service?.id || session?.service_id || null;
        const price = serviceId ? servicePriceMap.get(serviceId) : null;
        const amountCents = entry?.amount_cents ?? price?.price_cents ?? 0;
        const paymentList = entry ? paymentsByEntryId.get(entry.id) || [] : [];
        const latestPayment = paymentList[0] || null;
        const paymentCount = paymentList.length;
        const totalReceivedCents = paymentList.reduce(
          (sum, item) => sum + Number(item.amount_cents || 0),
          0,
        );
        const method = latestPayment?.payment_method_id
          ? paymentMethodMap.get(latestPayment.payment_method_id)
          : null;
        const entryFinancial = entry ? entryFinancialMap.get(entry.id) : null;
        const paidCents = entryFinancial?.paid ?? 0;
        const openCents =
          entryFinancial?.open ?? Math.max(0, Number(amountCents || 0) - paidCents);
        const status = entry ? entryFinancial?.status || entry.status || "pending" : "missing";
        const installments = entryFinancial?.installments || [];
        const configuredInstallmentCount = Math.max(
          1,
          Number(entry?.installments_count || installments.length || 1),
        );
        const isInstallmentPlan = configuredInstallmentCount > 1;
        const agreement = resolveInstallmentAgreement(
          installments,
          configuredInstallmentCount,
          Number(amountCents || 0),
        );
        const firstInstallment = isInstallmentPlan
          ? installments.find(
            (item) =>
              Number(item.installment_number || 0) === 1
              && String(item.status || "").toLowerCase() !== "canceled",
          ) || installments.find(
            (item) => String(item.status || "").toLowerCase() !== "canceled",
          ) || null
          : null;
        const firstInstallmentOpenCents = isInstallmentPlan
          ? Math.max(0, Number(firstInstallment?.open_amount_cents ?? openCents ?? 0))
          : 0;
        const installmentCount = isInstallmentPlan ? configuredInstallmentCount : 0;
        const installmentUnitCents = isInstallmentPlan ? agreement.unitCents : 0;
        const installmentAgreementTotalCents = isInstallmentPlan ? agreement.totalCents : 0;
        const paidInstallments = installments.filter(
          (item) => String(item.status || "").toLowerCase() === "paid",
        ).length;
        const effectiveOpenCents = isInstallmentPlan
          ? firstInstallmentOpenCents
          : openCents;
        const nextOpenInstallment = isInstallmentPlan
          ? installments.find(
            (item) => Number(item.open_amount_cents || 0) > 0 && item.status !== "canceled",
          ) || null
          : null;

        return {
          id: session.id,
          starts_at: session.starts_at,
          patientId: session.patient_id,
          patientName,
          professionalId:
            Number(session?.professional?.id || session?.professional_user_id || 0) || null,
          professionalName,
          serviceName,
          recurrence: formatRecurrence(session),
          amountCents,
          paidCents,
          openCents: effectiveOpenCents,
          entry,
          financialStatus: status,
          payment: latestPayment,
          paymentCount,
          totalReceivedCents,
          paymentMethod: method?.name || "-",
          isInstallmentPlan,
          firstInstallmentOpenCents,
          installmentCount,
          installmentUnitCents,
          installmentAgreementTotalCents,
          paidInstallments,
          nextOpenInstallment,
          installments,
        };
      })
      .filter((row) => {
        if (!search) return true;
        const haystack = normalizeSearchText([
          row.patientName,
          row.professionalName,
          row.serviceName,
        ]
          .filter(Boolean)
          .join(" "));
        return haystack.includes(search);
      })
      .filter((row) => {
        const status = row.financialStatus || "missing";
        if (attendanceFilters.financial === "pending") return status === "pending";
        if (attendanceFilters.financial === "partial") return status === "partial";
        if (attendanceFilters.financial === "paid") return status === "paid";
        if (attendanceFilters.financial === "missing") return status === "missing";
        return true;
      })
      .sort((a, b) => new Date(a.starts_at || 0) - new Date(b.starts_at || 0));
  }, [
    attendanceFilters.financial,
    attendanceFilters.search,
    attendanceSessions,
    entryBySessionId,
    entryFinancialMap,
    formatRecurrence,
    paymentMethodMap,
    paymentsByEntryId,
    servicePriceMap,
  ]);

  const attendanceVisibleRows = useMemo(() => {
    const selectedPatientId = normalizeId(attendanceFilters.patient_id);
    const selectedProfessionalId = normalizeId(attendanceFilters.professional_id);

    return attendanceRows.filter((row) => {
      if (selectedPatientId && Number(row.patientId || 0) !== selectedPatientId) return false;
      if (selectedProfessionalId && Number(row.professionalId || 0) !== selectedProfessionalId) {
        return false;
      }
      return true;
    });
  }, [
    attendanceFilters.patient_id,
    attendanceFilters.professional_id,
    attendanceRows,
  ]);

  const attendanceManualPaymentRows = useMemo(() => {
    const startDate = attendanceFilters.start
      ? parseDateInputBoundary(attendanceFilters.start, "start")
      : null;
    const endDate = attendanceFilters.end
      ? parseDateInputBoundary(attendanceFilters.end, "end")
      : null;
    const hasStart = !!startDate && !Number.isNaN(startDate.getTime());
    const hasEnd = !!endDate && !Number.isNaN(endDate.getTime());
    const selectedPatientId = normalizeId(attendanceFilters.patient_id);
    const selectedProfessionalId = normalizeId(attendanceFilters.professional_id);
    const search = normalizeSearchText(attendanceFilters.search);

    const matchesFinancial = (statusValue) => {
      const normalizedStatus = String(statusValue || "pending").toLowerCase();
      if (attendanceFilters.financial === "pending") {
        return normalizedStatus === "pending" || normalizedStatus === "credit";
      }
      if (attendanceFilters.financial === "partial") return normalizedStatus === "partial";
      if (attendanceFilters.financial === "paid") return normalizedStatus === "paid";
      return true;
    };

    return payments
      .map((payment) => {
        const paymentEntryId = Number(payment.entry_id || 0) || null;
        const entry = paymentEntryId ? entryMap.get(paymentEntryId) : null;
        if (entry && !isManualReceiptEntry(entry)) return null;
        if (selectedProfessionalId) return null;

        const patientId = Number(payment.patient_id || entry?.patient_id || 0) || null;
        if (!patientId) return null;
        if (selectedPatientId && patientId !== selectedPatientId) return null;

        const paidAt = new Date(payment.paid_at || 0);
        if (Number.isNaN(paidAt.getTime())) return null;
        if (hasStart && paidAt < startDate) return null;
        if (hasEnd && paidAt > endDate) return null;

        const patient = patientMap.get(patientId) || null;
        const paymentMethod = payment.payment_method_id
          ? paymentMethodMap.get(payment.payment_method_id)
          : null;
        const allocatedCents = allocatedByPaymentId.get(payment.id) || 0;
        const status = resolveManualReceiptStatus(payment.amount_cents, allocatedCents);
        if (!matchesFinancial(status)) return null;

        const noteParts = [
          payment.note,
          entry?.notes && entry.notes !== STANDALONE_PAYMENT_ANCHOR_NOTE ? entry.notes : null,
        ].filter(Boolean);
        const row = {
          id: `manual-payment-${payment.id}`,
          starts_at: payment.paid_at,
          patientId,
          patientName: patient?.full_name || patient?.name || "Paciente",
          professionalId: null,
          professionalName: "-",
          serviceName: resolveManualReceiptLabel(entry),
          recurrence: "-",
          amountCents: Number(payment.amount_cents || 0),
          paidCents: allocatedCents,
          openCents: Math.max(0, Number(payment.amount_cents || 0) - allocatedCents),
          entry,
          financialStatus: status,
          payment,
          paymentCount: 1,
          totalReceivedCents: Number(payment.amount_cents || 0),
          paymentMethod: paymentMethod?.name || "-",
          isInstallmentPlan: false,
          installmentCount: 0,
          installmentUnitCents: 0,
          installmentAgreementTotalCents: 0,
          paidInstallments: 0,
          nextOpenInstallment: null,
          installments: [],
          isManualReceiptRow: true,
          manualUsageLabel: formatPaymentUsage(payment, allocatedCents),
          manualNote: noteParts.join(" | ") || "-",
        };

        if (search) {
          const haystack = normalizeSearchText([
            row.patientName,
            row.serviceName,
            row.paymentMethod,
            row.manualUsageLabel,
            row.manualNote,
          ]
            .filter(Boolean)
            .join(" "));
          if (!haystack.includes(search)) return null;
        }

        return row;
      })
      .filter(Boolean)
      .sort((a, b) => new Date(a.starts_at || 0) - new Date(b.starts_at || 0));
  }, [
    attendanceFilters.end,
    attendanceFilters.financial,
    attendanceFilters.patient_id,
    attendanceFilters.professional_id,
    attendanceFilters.search,
    attendanceFilters.start,
    allocatedByPaymentId,
    entryMap,
    formatPaymentUsage,
    patientMap,
    paymentMethodMap,
    payments,
  ]);

  const attendanceSessionRows = useMemo(() => {
    const startDate = attendanceFilters.start
      ? new Date(`${attendanceFilters.start}T00:00:00`)
      : null;
    const endDate = attendanceFilters.end
      ? new Date(`${attendanceFilters.end}T23:59:59`)
      : null;
    const hasStart = !!startDate && !Number.isNaN(startDate.getTime());
    const hasEnd = !!endDate && !Number.isNaN(endDate.getTime());
    const search = normalizeSearchText(attendanceFilters.search);

    const matchesSearch = (row) => {
      if (!search) return true;
      const haystack = normalizeSearchText(
        [row.patientName, row.professionalName, row.serviceName]
          .filter(Boolean)
          .join(" "),
      );
      return haystack.includes(search);
    };

    const matchesFinancial = (statusValue) => {
      const normalizedStatus = String(statusValue || "missing").toLowerCase();
      if (attendanceFilters.financial === "pending") return normalizedStatus === "pending";
      if (attendanceFilters.financial === "partial") return normalizedStatus === "partial";
      if (attendanceFilters.financial === "paid") return normalizedStatus === "paid";
      if (attendanceFilters.financial === "missing") return normalizedStatus === "missing";
      return true;
    };

    const existingEntryIds = new Set(
      attendanceVisibleRows
        .map((row) => Number(row.entry?.id || 0))
        .filter((value) => value > 0),
    );
    const selectedPatientId = normalizeId(attendanceFilters.patient_id);
    const selectedProfessionalId = normalizeId(attendanceFilters.professional_id);

    const supplementalRows = [];

    entries.forEach((entry) => {
      if (!entry || entry.type !== "income") return;
      if (!entry.session_id) return;
      const entryId = Number(entry.id || 0);
      if (!entryId || existingEntryIds.has(entryId)) return;

      const entryFinancial = entryFinancialMap.get(entryId);
      const installments = entryFinancial?.installments || getEntryInstallments(entry);
      const configuredInstallmentCount = Math.max(
        1,
        Number(entry.installments_count || 0) || installments.length || 1,
      );
      if (configuredInstallmentCount <= 1 || !installments.length) return;

      const dueInstallments = installments.filter((item) => {
        if (String(item?.status || "").toLowerCase() === "canceled") return false;
        if (Number(item?.installment_number || 0) <= 1) return false;
        if (!item?.due_date) return false;
        const dueDateValue =
          typeof item.due_date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(item.due_date)
            ? `${item.due_date}T12:00:00`
            : item.due_date;
        const dueDate = new Date(dueDateValue);
        if (Number.isNaN(dueDate.getTime())) return false;
        if (hasStart && dueDate < startDate) return false;
        if (hasEnd && dueDate > endDate) return false;
        return true;
      });

      if (!dueInstallments.length) return;

      const linkedSession = entry.session_id ? sessionById.get(entry.session_id) : null;
      const patientId = Number(entry.patient_id || linkedSession?.patient_id || 0) || null;
      if (selectedPatientId && patientId !== selectedPatientId) return;
      const professionalId = Number(
        linkedSession?.professional?.id || linkedSession?.professional_id || 0,
      ) || null;
      if (selectedProfessionalId && professionalId !== selectedProfessionalId) return;
      const patient =
        linkedSession?.Patient ||
        (patientId ? patientMap.get(patientId) : null) ||
        null;
      const serviceId = Number(entry.service_id || linkedSession?.service_id || 0) || null;
      const service =
        linkedSession?.Service ||
        (serviceId ? serviceMap.get(serviceId) : null) ||
        null;
      const paymentList = paymentsByEntryId.get(entryId) || [];
      const latestPayment = paymentList[0] || null;
      const totalReceivedCents = paymentList.reduce(
        (sum, item) => sum + Number(item.amount_cents || 0),
        0,
      );
      const method = latestPayment?.payment_method_id
        ? paymentMethodMap.get(latestPayment.payment_method_id)
        : null;
      const paidInstallments = installments.filter(
        (item) => String(item.status || "").toLowerCase() === "paid",
      ).length;
      const agreement = resolveInstallmentAgreement(
        installments,
        configuredInstallmentCount,
        Number(entry.amount_cents || 0),
      );
      const firstInstallment = installments.find(
        (item) =>
          Number(item.installment_number || 0) === 1
          && String(item.status || "").toLowerCase() !== "canceled",
      ) || installments.find(
        (item) => String(item.status || "").toLowerCase() !== "canceled",
      ) || null;
      const firstInstallmentOpenCents = Math.max(
        0,
        Number(firstInstallment?.open_amount_cents || 0),
      );
      const nextOpenInstallment = installments.find(
        (item) =>
          Number(item.open_amount_cents || 0) > 0
          && String(item.status || "").toLowerCase() !== "canceled",
      ) || null;
      const installmentUnitCents = agreement.unitCents;

      dueInstallments.forEach((dueInstallment) => {
        const status = String(
          dueInstallment.status || entryFinancial?.status || entry.status || "pending",
        ).toLowerCase();
        if (!matchesFinancial(status)) return;

        const row = {
          id: `installment-due-${entryId}-${dueInstallment.id || dueInstallment.installment_number}`,
          starts_at: dueInstallment.due_date,
          patientId,
          patientName: patient?.full_name || patient?.name || "Paciente",
          professionalId,
          professionalName:
            linkedSession?.professional?.name ||
            linkedSession?.professional?.email ||
            "-",
          serviceName: service?.name || entry.description || "Servico",
          recurrence: "-",
          amountCents: Number(dueInstallment.amount_cents || 0),
          paidCents: Number(dueInstallment.paid_amount_cents || 0),
          openCents: Number(dueInstallment.open_amount_cents || 0),
          entry,
          financialStatus: status,
          payment: latestPayment,
          paymentCount: paymentList.length,
          totalReceivedCents,
          paymentMethod: method?.name || "-",
          isInstallmentPlan: true,
          firstInstallmentOpenCents,
          installmentCount: configuredInstallmentCount,
          installmentUnitCents,
          installmentAgreementTotalCents: agreement.totalCents,
          paidInstallments,
          nextOpenInstallment,
          dueInstallment,
          isProjectedInstallmentRow: true,
          installments,
        };

        if (!matchesSearch(row)) return;
        supplementalRows.push(row);
      });
    });

    return [...attendanceVisibleRows, ...supplementalRows, ...attendanceManualPaymentRows]
      .sort((a, b) => new Date(a.starts_at || 0) - new Date(b.starts_at || 0));
  }, [
    attendanceManualPaymentRows,
    attendanceFilters.end,
    attendanceFilters.financial,
    attendanceFilters.patient_id,
    attendanceFilters.professional_id,
    attendanceFilters.search,
    attendanceFilters.start,
    attendanceVisibleRows,
    entries,
    entryFinancialMap,
    patientMap,
    paymentMethodMap,
    paymentsByEntryId,
    serviceMap,
    sessionById,
  ]);

  const attendanceByPatient = useMemo(() => {
    const map = new Map();
    const collator = new Intl.Collator("pt-BR", {
      sensitivity: "base",
      ignorePunctuation: true,
      numeric: true,
    });
    attendanceVisibleRows.forEach((row) => {
      if (!row.patientId) return;
      const existing = map.get(row.patientId);
      const base = existing || {
        patientId: row.patientId,
        patientName: row.patientName,
        sessions: 0,
        totalCents: 0,
        openCents: 0,
        paidCents: 0,
        lastSession: row.starts_at,
      };
      base.sessions += 1;
      base.totalCents += Number(row.amountCents || 0);
      base.openCents += Number(row.openCents || 0);
      base.paidCents += Number(row.paidCents || 0);
      if (!base.lastSession || new Date(row.starts_at) > new Date(base.lastSession)) {
        base.lastSession = row.starts_at;
      }
      map.set(row.patientId, base);
    });

    attendanceManualPaymentRows.forEach((row) => {
      if (!row.patientId || map.has(row.patientId)) return;
      map.set(row.patientId, {
        patientId: row.patientId,
        patientName: row.patientName,
        sessions: 0,
        totalCents: 0,
        openCents: 0,
        paidCents: 0,
        lastSession: row.starts_at,
      });
    });

    return Array.from(map.values())
      .map((item) => {
        return {
          ...item,
          creditsAvailable: creditBalanceByPatient.get(item.patientId) || 0,
        };
      })
      .sort((a, b) => collator.compare(a.patientName || "", b.patientName || ""));
  }, [attendanceVisibleRows, attendanceManualPaymentRows, creditBalanceByPatient]);

  const attendanceSelectedPatientSummary = useMemo(() => {
    if (!selectedAttendancePatientId) return null;

    const patientSummary =
      attendanceByPatient.find((item) => item.patientId === selectedAttendancePatientId) || null;
    const sessionRows = attendanceSessionRows.filter(
      (row) => Number(row.patientId || 0) === selectedAttendancePatientId,
    );

    const patientName =
      activeAttendancePatient?.full_name
      || activeAttendancePatient?.name
      || patientSummary?.patientName
      || "Paciente";

    return {
      patientId: selectedAttendancePatientId,
      patientName,
      sessions: patientSummary?.sessions || 0,
      openCents: sessionRows.reduce(
        (sum, row) => sum + (row.isManualReceiptRow ? 0 : Math.max(0, Number(row.openCents || 0))),
        0,
      ),
      creditsAvailable:
        creditBalanceByPatient.get(selectedAttendancePatientId) || patientSummary?.creditsAvailable || 0,
    };
  }, [
    activeAttendancePatient,
    attendanceByPatient,
    attendanceSessionRows,
    creditBalanceByPatient,
    selectedAttendancePatientId,
  ]);

  const attendanceSummary = useMemo(() => {
    const openPatients = new Set();
    const data = {
      total: attendanceRows.length,
      openSessions: 0,
      openPatients: 0,
      pendingAmount: 0,
      paidAmount: 0,
      creditsAvailable: 0,
    };

    attendanceRows.forEach((row) => {
      const status = row.financialStatus || "missing";
      if (status === "paid") {
        data.paidAmount += Number(row.paidCents || 0);
      } else {
        data.openSessions += 1;
        data.pendingAmount += Number(row.openCents || 0);
        if (row.patientId) openPatients.add(row.patientId);
      }
    });

    creditBalanceByPatient.forEach((value) => {
      data.creditsAvailable += value;
    });

    data.openPatients = openPatients.size;

    return data;
  }, [attendanceRows, creditBalanceByPatient]);

  const isAttendancePatientRequired = attendanceView === "sessions" && !selectedAttendancePatientId;
  const canOpenAttendanceSessionsView = !!selectedAttendancePatientId;

  const attendancePeriodLabel = useMemo(() => {
    if (attendancePeriodMode === "year") {
      return attendancePeriodYear || "";
    }
    const parsed = parseMonthInputValue(attendancePeriodMonth);
    if (!parsed) return "";
    return formatMonthYear(new Date(parsed.year, parsed.month - 1, 1));
  }, [attendancePeriodMode, attendancePeriodMonth, attendancePeriodYear]);

  const attendanceYearOptions = useMemo(() => {
    const nowYear = new Date().getFullYear();
    const currentYear = Number(String(attendancePeriodYear || "").trim()) || nowYear;
    const years = [];
    for (let year = currentYear - 5; year <= currentYear + 5; year += 1) {
      years.push(String(year));
    }
    return years;
  }, [attendancePeriodYear]);

  const openEntriesForPayment = useMemo(() => {
    const patientId = Number(paymentForm.patient_id || 0);
    if (!patientId) return [];
    return entries
      .filter((entry) => entry.type === "income" && Number(entry.patient_id) === patientId)
      .map((entry) => {
        const financial = entryFinancialMap.get(entry.id);
        const open = financial?.open ?? Math.max(0, Number(entry.amount_cents || 0));
        const status = financial?.status || entry.status;
        return { entry, open, status };
      })
      .filter((item) => item.open > 0 && item.status !== "canceled")
      .sort(
        (a, b) => new Date(a.entry.reference_date || 0) - new Date(b.entry.reference_date || 0),
      );
  }, [entries, entryFinancialMap, paymentForm.patient_id]);

  const manualAllocationTotal = useMemo(() => {
    return Object.values(paymentAllocations).reduce((sum, value) => {
      const parsed = parseCurrencyInputToNumber(value);
      if (Number.isNaN(parsed) || parsed <= 0) return sum;
      return sum + Math.round(parsed * 100);
    }, 0);
  }, [paymentAllocations]);

  const paymentPreview = useMemo(() => {
    const amountNumber = parseCurrencyInputToNumber(paymentForm.amount);
    const discountNumber = parseCurrencyInputToNumber(paymentForm.discount);
    const surchargeNumber = parseCurrencyInputToNumber(paymentForm.surcharge);

    const receivedCents =
      Number.isFinite(amountNumber) && amountNumber > 0 ? Math.round(amountNumber * 100) : 0;
    const discountCents =
      Number.isFinite(discountNumber) && discountNumber > 0 ? Math.round(discountNumber * 100) : 0;
    const surchargeCents =
      Number.isFinite(surchargeNumber) && surchargeNumber > 0
        ? Math.round(surchargeNumber * 100)
        : 0;

    let baseCents = receivedCents;
    let installmentsCount = 1;
    let originalInstallmentsCount = 1;
    let installmentUnitCents = 0;
    let installmentPlanTotalCents = 0;
    let paidInstallments = 0;
    let openInstallments = 1;

    if (paymentForm.entry_id) {
      const entryId = Number(paymentForm.entry_id);
      const financial = entryFinancialMap.get(entryId);
      const entry = entryMap.get(entryId);
      if (financial) {
        baseCents = Math.max(0, Number(financial.open || 0));
        const installments = Array.isArray(financial.installments) ? financial.installments : [];
        installmentsCount = Math.max(
          1,
          installments.length || Number(entry?.installments_count || 0),
        );
        originalInstallmentsCount = installmentsCount;
        const agreement = resolveInstallmentAgreement(
          installments,
          installmentsCount,
          Number(entry?.amount_cents || 0),
        );
        installmentUnitCents = agreement.unitCents;
        installmentPlanTotalCents = agreement.totalCents;
        paidInstallments = installments.filter(
          (item) => String(item.status || "").toLowerCase() === "paid",
        ).length;
        openInstallments = Math.max(0, installmentsCount - paidInstallments);
      } else {
        baseCents = Math.max(0, Number(entry?.amount_cents || 0));
        installmentsCount = Math.max(1, Number(entry?.installments_count || 1));
        originalInstallmentsCount = installmentsCount;
        installmentUnitCents = installmentsCount > 1
          ? Math.floor(Math.max(0, Number(entry?.amount_cents || 0)) / installmentsCount)
          : 0;
        installmentPlanTotalCents = installmentsCount > 1 ? baseCents : 0;
        paidInstallments = 0;
        openInstallments = installmentsCount;
      }

      const requestedInstallmentsCount = Math.max(
        2,
        Number(paymentForm.entry_installments_count || 0) || 2,
      );
      const shouldConvertToInstallmentsNow = Boolean(
        paymentForm.convert_entry_to_installments && originalInstallmentsCount <= 1,
      );
      if (shouldConvertToInstallmentsNow) {
        const agreedInstallmentBaseCents = Math.max(
          0,
          receivedCents > 0 ? receivedCents : baseCents,
        );
        installmentsCount = requestedInstallmentsCount;
        installmentUnitCents = Math.floor(
          agreedInstallmentBaseCents / Math.max(1, requestedInstallmentsCount),
        );
        installmentPlanTotalCents = agreedInstallmentBaseCents;
        paidInstallments = 0;
        openInstallments = requestedInstallmentsCount;
      }
    } else if (paymentForm.allocation_mode === "manual" && manualAllocationTotal > 0) {
      baseCents = manualAllocationTotal;
    }

    const finalChargedCents = Math.max(0, baseCents - discountCents + surchargeCents);
    const openAfterCents = Math.max(0, finalChargedCents - receivedCents);
    const creditAfterCents = Math.max(0, receivedCents - finalChargedCents);
    const hasAdjustment = discountCents > 0 || surchargeCents > 0;

    return {
      baseCents,
      receivedCents,
      discountCents,
      surchargeCents,
      finalChargedCents,
      openAfterCents,
      creditAfterCents,
      hasAdjustment,
      originalInstallmentsCount,
      installmentsCount,
      installmentUnitCents,
      installmentPlanTotalCents,
      paidInstallments,
      openInstallments,
    };
  }, [
    entryFinancialMap,
    entryMap,
    manualAllocationTotal,
    paymentForm.allocation_mode,
    paymentForm.amount,
    paymentForm.convert_entry_to_installments,
    paymentForm.discount,
    paymentForm.entry_id,
    paymentForm.entry_installments_count,
    paymentForm.surcharge,
  ]);

  const isSimplifiedInstallmentPayment = Boolean(paymentModalContext?.simplifiedInstallment);
  const selectedChargeAmountCents = useMemo(() => {
    if (!paymentForm.entry_id) return 0;
    const entryId = Number(paymentForm.entry_id);
    const entryAmountCents = Number(entryMap.get(entryId)?.amount_cents || 0);
    if (entryAmountCents > 0) return entryAmountCents;
    return Math.max(0, Number(paymentPreview.baseCents || 0));
  }, [entryMap, paymentForm.entry_id, paymentPreview.baseCents]);

  const paymentModalSubtitle = useMemo(() => {
    if (isSimplifiedInstallmentPayment) {
      return "Confirmacao simples da parcela pendente.";
    }
    if (paymentForm.entry_id && paymentPreview.originalInstallmentsCount > 1) {
      return "";
    }
    return "";
  }, [
    isSimplifiedInstallmentPayment,
    paymentForm.entry_id,
    paymentPreview.originalInstallmentsCount,
  ]);

  const filteredPayments = useMemo(() => {
    const search = normalizeSearchText(paymentFilters.search);
    return payments.filter((payment) => {
      if (paymentFilters.patient_id && Number(payment.patient_id) !== Number(paymentFilters.patient_id)) {
        return false;
      }
      if (paymentFilters.method_id && Number(payment.payment_method_id) !== Number(paymentFilters.method_id)) {
        return false;
      }
      if (paymentFilters.start) {
        const startDate = parseDateInputBoundary(paymentFilters.start, "start");
        const paidAt = new Date(payment.paid_at || 0);
        if (startDate && paidAt < startDate) return false;
      }
      if (paymentFilters.end) {
        const endDate = parseDateInputBoundary(paymentFilters.end, "end");
        const paidAt = new Date(payment.paid_at || 0);
        if (endDate && paidAt > endDate) return false;
      }
      if (search) {
        const patient = payment.patient_id ? patientMap.get(payment.patient_id) : null;
        const method = payment.payment_method_id
          ? paymentMethodMap.get(payment.payment_method_id)
          : null;
        const haystack = normalizeSearchText([
          getPatientDisplayName(patient),
          method?.name,
          payment.note,
          payment.origin,
        ]
          .filter(Boolean)
          .join(" "));
        if (!haystack.includes(search)) return false;
      }
      return true;
    });
  }, [payments, paymentFilters, patientMap, paymentMethodMap]);

  const paymentsSummary = useMemo(() => {
    const data = {
      totalReceived: 0,
      totalAllocated: 0,
      totalCredit: 0,
    };
    filteredPayments.forEach((payment) => {
      const amount = Number(payment.amount_cents || 0);
      const allocated = allocatedByPaymentId.get(payment.id) || 0;
      data.totalReceived += amount;
      data.totalAllocated += allocated;
      data.totalCredit += Math.max(0, amount - allocated);
    });
    return data;
  }, [filteredPayments, allocatedByPaymentId]);

  const filteredAllocations = useMemo(() => {
    const paymentIds = new Set(filteredPayments.map((payment) => payment.id));
    return paymentAllocationList.filter((allocation) => {
      const paymentId = allocation.payment?.id || allocation.payment_id;
      return paymentIds.has(paymentId);
    });
  }, [filteredPayments, paymentAllocationList]);

  const reportIndicators = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const data = {
      totalOpen: 0,
      totalCredit: 0,
      totalReceived: 0,
      unpaidSessions: 0,
      overdueCharges: 0,
    };

    entries.forEach((entry) => {
      if (entry.type !== "income") return;
      const financial = entryFinancialMap.get(entry.id);
      const open = financial?.open ?? 0;
      const status = financial?.status || entry.status;
      data.totalOpen += open;
      if (status !== "paid" && entry.due_date) {
        const dueDate = new Date(entry.due_date);
        if (!Number.isNaN(dueDate.getTime()) && dueDate < today) {
          data.overdueCharges += 1;
        }
      }
    });

    creditBalanceByPatient.forEach((value) => {
      data.totalCredit += value;
    });

    payments.forEach((payment) => {
      data.totalReceived += Number(payment.amount_cents || 0);
    });

    data.unpaidSessions = attendanceRows.filter(
      (row) => row.entry && row.financialStatus !== "paid",
    ).length;

    return data;
  }, [attendanceRows, creditBalanceByPatient, entries, entryFinancialMap, payments]);

  const handleSaveCategory = useCallback(async () => {
    if (!categoryForm.name.trim()) {
      toast.error("Informe o nome da categoria.");
      return;
    }
    try {
      const payload = {
        name: categoryForm.name.trim(),
        type: categoryForm.type,
        color: categoryForm.color.trim() || null,
      };
      if (editingCategoryId) {
        await updateFinancialCategory(editingCategoryId, payload);
        toast.success("Categoria atualizada.");
      } else {
        await createFinancialCategory(payload);
        toast.success("Categoria criada.");
      }
      closeCategoryModal();
      loadData();
    } catch (error) {
      toast.error("Nao foi possivel salvar a categoria.");
    }
  }, [categoryForm, closeCategoryModal, loadData, editingCategoryId]);

  const handleSaveMethod = useCallback(async () => {
    if (!methodForm.name.trim()) {
      toast.error("Informe o nome da forma de pagamento.");
      return;
    }
    try {
      const payload = { name: methodForm.name.trim() };
      if (editingMethodId) {
        await updatePaymentMethod(editingMethodId, payload);
        toast.success("Forma de pagamento atualizada.");
      } else {
        await createPaymentMethod(payload);
        toast.success("Forma de pagamento criada.");
      }
      closeMethodModal();
      loadData();
    } catch (error) {
      toast.error("Nao foi possivel salvar a forma de pagamento.");
    }
  }, [methodForm, closeMethodModal, loadData, editingMethodId]);

  const handleSaveService = useCallback(async () => {
    if (!serviceForm.name.trim()) {
      toast.error("Informe o nome do servico.");
      return;
    }

    const priceValue = serviceForm.price
      ? Number(serviceForm.price.replace(",", "."))
      : null;

    if (priceValue !== null && (Number.isNaN(priceValue) || priceValue <= 0)) {
      toast.error("Informe um valor valido.");
      return;
    }

    setIsServiceSaving(true);
    try {
      let serviceId = editingServiceId;
      const payload = {
        name: serviceForm.name.trim(),
        color: serviceForm.color.trim() || null,
        is_active: !!serviceForm.is_active,
        default_duration_minutes: Number(serviceForm.default_duration_minutes) || 60,
      };

      if (editingServiceId) {
        await axios.put(`/services/${editingServiceId}`, payload);
        toast.success("Servico atualizado.");
      } else {
        const existingCodes = new Set(services.map((service) => service.code));
        const baseCode = slugifyCode(serviceForm.name) || "servico";
        let code = baseCode;
        let counter = 2;
        while (existingCodes.has(code)) {
          code = `${baseCode}_${counter}`;
          counter += 1;
        }
        const response = await axios.post("/services", { ...payload, code });
        serviceId = response?.data?.id || null;
        toast.success("Servico criado.");
      }

      if (serviceId && priceValue !== null) {
        const existingPrice = servicePriceMap.get(serviceId);
        const pricePayload = {
          service_id: serviceId,
          price_cents: Math.round(priceValue * 100),
          currency: "BRL",
          is_active: true,
        };
        if (existingPrice) {
          await updateServicePrice(existingPrice.id, pricePayload);
        } else {
          await createServicePrice(pricePayload);
        }
      }

      closeServiceModal();
      loadData();
    } catch (error) {
      toast.error("Nao foi possivel salvar o servico.");
    } finally {
      setIsServiceSaving(false);
    }
  }, [
    serviceForm,
    closeServiceModal,
    loadData,
    editingServiceId,
    services,
    servicePriceMap,
  ]);

  const handleToggleCategory = useCallback(
    async (category) => {
      try {
        await updateFinancialCategory(category.id, { is_active: !category.is_active });
        loadData();
      } catch (error) {
        toast.error("Nao foi possivel atualizar a categoria.");
      }
    },
    [loadData],
  );

  const handleToggleMethod = useCallback(
    async (method) => {
      try {
        await updatePaymentMethod(method.id, { is_active: !method.is_active });
        loadData();
      } catch (error) {
        toast.error("Nao foi possivel atualizar a forma de pagamento.");
      }
    },
    [loadData],
  );

  const handleToggleService = useCallback(
    async (service) => {
      try {
        await axios.put(`/services/${service.id}`, { is_active: !service.is_active });
        loadData();
      } catch (error) {
        toast.error("Nao foi possivel atualizar o servico.");
      }
    },
    [loadData],
  );

  const handleDeleteService = useCallback(
    async (service) => {
      try {
        await axios.delete(`/services/${service.id}`);
        toast.success("Servico excluido.");
        loadData();
      } catch (error) {
        toast.error("Nao foi possivel excluir o servico.");
      }
    },
    [loadData],
  );

  const openRecurringModal = useCallback((item = null) => {
    if (item) {
      setRecurringForm({
        name: item.name || "",
        category_id: item.category_id ? String(item.category_id) : "",
        amount: (Number(item.amount_cents || 0) / 100).toFixed(2),
        day_of_month: String(item.day_of_month || 1),
        notes: item.notes || "",
      });
      setEditingRecurringId(item.id);
    } else {
      setRecurringForm({
        name: "",
        category_id: "",
        amount: "",
        day_of_month: "1",
        notes: "",
      });
      setEditingRecurringId(null);
    }
    setIsRecurringOpen(true);
  }, []);

  const closeRecurringModal = useCallback(() => {
    setIsRecurringOpen(false);
    setEditingRecurringId(null);
  }, []);

  const handleRecurringChange = useCallback((event) => {
    const { name, value } = event.target;
    setRecurringForm((prev) => ({ ...prev, [name]: value }));
  }, []);

  const handleSaveRecurring = useCallback(async () => {
    const amountValue = Number(recurringForm.amount.replace(",", "."));
    const dayValue = Number(recurringForm.day_of_month);
    if (!recurringForm.name.trim()) {
      toast.error("Informe o nome da despesa fixa.");
      return;
    }
    if (Number.isNaN(amountValue) || amountValue <= 0) {
      toast.error("Informe um valor valido.");
      return;
    }
    if (Number.isNaN(dayValue) || dayValue < 1 || dayValue > 31) {
      toast.error("Informe um dia valido.");
      return;
    }

    const payload = {
      name: recurringForm.name.trim(),
      category_id: normalizeId(recurringForm.category_id),
      amount_cents: Math.round(amountValue * 100),
      currency: "BRL",
      day_of_month: dayValue,
      notes: recurringForm.notes.trim() || null,
      is_active: true,
    };

    try {
      if (editingRecurringId) {
        await updateFinancialRecurringExpense(editingRecurringId, payload);
        toast.success("Despesa fixa atualizada.");
      } else {
        await createFinancialRecurringExpense(payload);
        toast.success("Despesa fixa criada.");
      }
      closeRecurringModal();
      loadData();
    } catch (error) {
      toast.error("Nao foi possivel salvar a despesa fixa.");
    }
  }, [recurringForm, editingRecurringId, closeRecurringModal, loadData]);

  const handleToggleRecurring = useCallback(
    async (item) => {
      try {
        await updateFinancialRecurringExpense(item.id, { is_active: !item.is_active });
        loadData();
      } catch (error) {
        toast.error("Nao foi possivel atualizar a despesa fixa.");
      }
    },
    [loadData],
  );

  const handleExportCsv = useCallback(() => {
    if (!filteredEntries.length) {
      toast.info("Nao ha dados para exportar.");
      return;
    }

    const rows = [
      ["Data", "Tipo", "Descricao", "Categoria", "Paciente", "Valor", "Status"],
      ...filteredEntries.map((entry) => {
        const category = entry.category_id ? categoryMap.get(entry.category_id) : null;
        const patient = entry.patient_id ? patientMap.get(entry.patient_id) : null;
        const value = (Number(entry.amount_cents || 0) / 100).toFixed(2);
        return [
          entry.reference_date || "",
          entry.type === "income" ? "Receita" : "Despesa",
          entry.description || "",
          category?.name || "",
          patient?.full_name || "",
          value,
          entry.status || "",
        ];
      }),
    ];

    const escapeCell = (value) => `"${String(value).replace(/"/g, '""')}"`;
    const csv = rows.map((row) => row.map(escapeCell).join(";")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `financeiro_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }, [filteredEntries, categoryMap, patientMap]);

  const handleExportPayments = useCallback(() => {
    if (!payments.length) {
      toast.info("Nao ha pagamentos para exportar.");
      return;
    }
    const rows = [
      ["Data", "Paciente", "Forma de pagamento", "Parcelas", "Valor", "Observacao"],
      ...payments.map((payment) => {
        const entry = payment.entry_id ? entries.find((item) => item.id === payment.entry_id) : null;
        const patientId = payment.patient_id || entry?.patient_id || null;
        const patient = patientId ? patientMap.get(patientId) : null;
        const method = payment.payment_method_id
          ? paymentMethodMap.get(payment.payment_method_id)
          : null;
        const value = (Number(payment.amount_cents || 0) / 100).toFixed(2);
        return [
          payment.paid_at ? new Date(payment.paid_at).toISOString() : "",
          patient?.full_name || "",
          method?.name || "",
          payment.installments || "",
          value,
          payment.note || "",
        ];
      }),
    ];

    const escapeCell = (value) => `"${String(value).replace(/"/g, '""')}"`;
    const csv = rows.map((row) => row.map(escapeCell).join(";")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `pagamentos_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }, [payments, entries, patientMap, paymentMethodMap]);

  const renderEntries = () => (
    <Section>
      <SectionHeader>
        <div>
          <SectionTitle>Lancamentos manuais</SectionTitle>
          <SectionSubtitle>Ajustes e receitas/despesas fora dos atendimentos.</SectionSubtitle>
        </div>
        <HeaderActions>
          <GhostButton type="button" onClick={handleExportCsv}>
            Exportar CSV
          </GhostButton>
          <PrimaryButton type="button" onClick={openEntryModal}>
            <FaPlus />
            Novo lancamento
          </PrimaryButton>
        </HeaderActions>
      </SectionHeader>

      {loading ? (
        <SectionLoader>
          <Spinner />
          Carregando lancamentos...
        </SectionLoader>
      ) : (
        <>
          <SummaryGrid>
            <SummaryCard>
              <SummaryLabel>Recebido</SummaryLabel>
              <SummaryValue>{formatCurrency(summary.incomePaid)}</SummaryValue>
            </SummaryCard>
            <SummaryCard>
              <SummaryLabel>A receber</SummaryLabel>
              <SummaryValue>{formatCurrency(summary.incomePending)}</SummaryValue>
            </SummaryCard>
            <SummaryCard>
              <SummaryLabel>Despesas</SummaryLabel>
              <SummaryValue>{formatCurrency(summary.expenseTotal)}</SummaryValue>
            </SummaryCard>
            <SummaryCard>
              <SummaryLabel>Saldo</SummaryLabel>
              <SummaryValue>{formatCurrency(summary.net)}</SummaryValue>
            </SummaryCard>
          </SummaryGrid>

          <FiltersRow>
            <FilterField>
              <Label htmlFor="filter-status">Status</Label>
              <Select
                id="filter-status"
                name="status"
                value={filters.status}
                onChange={handleFilterChange}
              >
                <option value="all">Todos</option>
                <option value="pending">Pendente</option>
                <option value="partial">Parcial</option>
                <option value="paid">Pago</option>
              </Select>
            </FilterField>
            <FilterField>
              <Label htmlFor="filter-type">Tipo</Label>
              <Select
                id="filter-type"
                name="type"
                value={filters.type}
                onChange={handleFilterChange}
              >
                <option value="all">Todos</option>
                <option value="income">Receita</option>
                <option value="expense">Despesa</option>
              </Select>
            </FilterField>
            <FilterField>
              <Label htmlFor="filter-start">De</Label>
              <Input
                id="filter-start"
                type="date"
                name="start"
                value={filters.start}
                onChange={handleFilterChange}
              />
            </FilterField>
            <FilterField>
              <Label htmlFor="filter-end">Ate</Label>
              <Input
                id="filter-end"
                type="date"
                name="end"
                value={filters.end}
                onChange={handleFilterChange}
              />
            </FilterField>
            <FilterField>
              <Label htmlFor="filter-search">Busca</Label>
              <Input
                id="filter-search"
                name="search"
                placeholder="Paciente, descricao, categoria..."
                value={filters.search}
                onChange={handleFilterChange}
              />
            </FilterField>
          </FiltersRow>

          {filteredEntries.length === 0 ? (
            <EmptyState>Sem lancamentos cadastrados.</EmptyState>
          ) : (
            <EntriesTable>
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Descricao</th>
                  <th>Categoria</th>
                  <th>Paciente</th>
                  <th>Valor</th>
                  <th>Status</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {filteredEntries.map((entry) => {
                  const category = entry.category_id ? categoryMap.get(entry.category_id) : null;
                  const patient = entry.patient_id ? patientMap.get(entry.patient_id) : null;
                  const financial = entryFinancialMap.get(entry.id);
                  const status = financial?.status || entry.status;
                  const openCents = financial?.open ?? 0;
                  const availableCreditCents = creditBalanceByPatient.get(entry.patient_id) || 0;
                  const installmentCount = Math.max(
                    1,
                    Number(entry.installments_count || financial?.installments?.length || 1),
                  );
                  const installmentList = Array.isArray(financial?.installments)
                    ? financial.installments
                    : [];
                  const firstInstallment = installmentCount > 1
                    ? installmentList.find(
                      (item) =>
                        Number(item.installment_number || 0) === 1
                        && String(item.status || "").toLowerCase() !== "canceled",
                    ) || installmentList.find(
                      (item) => String(item.status || "").toLowerCase() !== "canceled",
                    ) || null
                    : null;
                  const firstInstallmentOpenCents = installmentCount > 1
                    ? Math.max(0, Number(firstInstallment?.open_amount_cents ?? openCents ?? 0))
                    : 0;
                  const hideActionsForInstallmentAgreement = Boolean(
                    installmentCount > 1
                    && status === "partial"
                    && firstInstallmentOpenCents <= 0,
                  );
                  return (
                    <tr key={entry.id}>
                      <td>{entry.reference_date || "-"}</td>
                      <td>{entry.description || "-"}</td>
                      <td>{category?.name || "-"}</td>
                      <td>{patient?.full_name || "-"}</td>
                      <td>
                        <CellStack>
                          <strong>{formatCurrency(entry.amount_cents)}</strong>
                          {openCents > 0 && entry.type === "income" && (
                            <MutedText>Em aberto: {formatCurrency(openCents)}</MutedText>
                          )}
                        </CellStack>
                      </td>
                      <td>
                        <StatusPill $status={status}>{formatFinancialStatus(status)}</StatusPill>
                      </td>
                      <td>
                        <RowActions>
                          {entry.type === "income"
                            && status !== "canceled"
                            && status !== "paid"
                            && !hideActionsForInstallmentAgreement && (
                            <ActionMenu onToggle={handleActionMenuToggle}>
                              <ActionMenuTrigger>Ações</ActionMenuTrigger>
                              <ActionMenuList>
                                {status !== "paid" && openCents > 0 && availableCreditCents > 0 && (
                                  <ActionMenuItem
                                    type="button"
                                    onClick={(event) => {
                                      closeActionMenu(event);
                                      handleApplyCreditToEntry(entry.id);
                                    }}
                                  >
                                    Usar credito
                                  </ActionMenuItem>
                                )}
                                {status !== "paid" && (
                                  <ActionMenuItem
                                    type="button"
                                    onClick={(event) => {
                                      closeActionMenu(event);
                                      openPaymentModal(
                                        entry,
                                        installmentCount > 1 && firstInstallmentOpenCents > 0
                                          ? { open_amount_cents: firstInstallmentOpenCents }
                                          : null,
                                      );
                                    }}
                                  >
                                    Registrar recebimento
                                  </ActionMenuItem>
                                )}
                              </ActionMenuList>
                            </ActionMenu>
                          )}
                        </RowActions>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </EntriesTable>
          )}
        </>
      )}
    </Section>
  );

  const renderAttendance = () => {
    const isAttendanceBusy = isAttendanceLoading || (loading && !hasAttendanceLoaded);
    const attendanceTitle =
      attendanceView === "patients" ? "Resumo por paciente" : "Detalhe financeiro";

    let attendanceContent = (
      <AttendanceEmptyState>Sem atendimentos no periodo.</AttendanceEmptyState>
    );

    if (attendanceView === "patients" && attendanceByPatient.length > 0) {
      attendanceContent = (
        <AttendanceTableCard>
          <AttendanceTableScroll>
            <AttendanceOverviewTable>
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Sessoes</th>
                <th>Valor total</th>
                <th>Em aberto</th>
                <th>Valor pago</th>
                <th>Credito</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {attendanceByPatient.map((row) => (
                <PatientSummaryRow key={row.patientId} $hasOpen={row.openCents > 0}>
                  <td>
                    <AttendanceCellStack>
                      <AttendancePatientSummaryName $hasOpen={row.openCents > 0}>
                        {row.patientName}
                      </AttendancePatientSummaryName>
                    </AttendanceCellStack>
                  </td>
                  <td>
                    <AttendancePrimaryText>{row.sessions}</AttendancePrimaryText>
                  </td>
                  <td>
                    <AttendanceMoneyText>{formatCurrency(row.totalCents)}</AttendanceMoneyText>
                  </td>
                  <td>
                    <AttendanceOpenAmountValue $hasOpen={row.openCents > 0}>
                      {formatCurrency(row.openCents)}
                    </AttendanceOpenAmountValue>
                  </td>
                  <td>
                    <AttendanceMoneyText>{formatCurrency(row.paidCents)}</AttendanceMoneyText>
                  </td>
                  <td>
                    <AttendanceMoneyText>{formatCurrency(row.creditsAvailable)}</AttendanceMoneyText>
                  </td>
                  <td>
                    <AttendanceRowActions>
                      <AttendanceSmallAction
                        type="button"
                        onClick={() => handleViewPatientSessions(row.patientId)}
                      >
                        Ver sessoes
                      </AttendanceSmallAction>
                    </AttendanceRowActions>
                  </td>
                </PatientSummaryRow>
              ))}
            </tbody>
            </AttendanceOverviewTable>
          </AttendanceTableScroll>
        </AttendanceTableCard>
      );
    }

    if (attendanceView === "sessions" && isAttendancePatientRequired) {
      attendanceContent = (
        <AttendanceEmptyState>
          Selecione um paciente nos filtros para visualizar o detalhe por sessao.
        </AttendanceEmptyState>
      );
    }

    if (
      attendanceView === "sessions"
      && !isAttendancePatientRequired
      && attendanceSessionRows.length > 0
    ) {
      attendanceContent = (
        <AttendanceTableCard>
          <AttendanceTableScroll>
            <AttendanceDataTable>
            <thead>
              <tr>
                <th>Data</th>
                <th>Cliente</th>
                <th>Profissional</th>
                <th>Servico</th>
                <th>Valor</th>
	                <th>Detalhe</th>
                <th>Status</th>
                <th>Obs.</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {attendanceSessionRows.map((row) => {
                const status = row.financialStatus || "missing";
                const statusLabel = formatFinancialStatus(status);
                const availableCreditCents = creditBalanceByPatient.get(row.patientId) || 0;
                const hideActionsForInstallmentAgreement = Boolean(
                  row.isInstallmentPlan
                  && !row.isProjectedInstallmentRow
                  && status === "partial"
                  && Number(row.firstInstallmentOpenCents || 0) <= 0,
                );
	                const canShowActions = Boolean(
	                  !row.isManualReceiptRow
	                  && row.entry
	                  && status !== "canceled"
	                  && status !== "paid"
	                  && !hideActionsForInstallmentAgreement,
	                );
	                let installmentSummary = "-";
	                if (row.isManualReceiptRow) {
	                  installmentSummary = row.paymentMethod || "-";
	                } else if (row.isInstallmentPlan) {
	                  installmentSummary = `${row.installmentCount}x de ${formatCurrency(row.installmentUnitCents)}`;
	                }
	                let installmentNote = null;
	                if (row.isManualReceiptRow) {
	                  installmentNote = row.manualUsageLabel || null;
	                } else if (row.isProjectedInstallmentRow && row.dueInstallment) {
	                  installmentNote = `Parcela ${row.dueInstallment.installment_number} de ${row.installmentCount}`;
	                } else if (row.isInstallmentPlan) {
	                  installmentNote = `Parcela 1/${row.installmentCount}`;
                }
                let paymentModalOptions = null;
                if (row.isProjectedInstallmentRow && row.dueInstallment) {
                  paymentModalOptions = {
                    simplifiedInstallment: true,
                    installment: row.dueInstallment,
                    payment_method_id: row.payment?.payment_method_id || null,
                    payment_method_name: row.paymentMethod || "",
                  };
                } else if (row.isInstallmentPlan && Number(row.firstInstallmentOpenCents || 0) > 0) {
                  paymentModalOptions = {
                    open_amount_cents: Number(row.firstInstallmentOpenCents || 0),
                  };
                }

                return (
                  <tr key={row.id}>
                    <td>
                      <AttendanceCellStack>
                        <AttendancePrimaryText>{formatDate(row.starts_at)}</AttendancePrimaryText>
                        <AttendanceSecondaryText>{formatWeekday(row.starts_at)}</AttendanceSecondaryText>
                      </AttendanceCellStack>
                    </td>
                    <td>
                      <AttendanceCellStack>
                        <AttendancePrimaryText>{row.patientName}</AttendancePrimaryText>
                      </AttendanceCellStack>
                    </td>
                    <td>
                      <AttendancePrimaryText>{row.professionalName}</AttendancePrimaryText>
                    </td>
	                    <td>
	                      <AttendanceCellStack>
	                        <AttendancePrimaryText>{row.serviceName}</AttendancePrimaryText>
	                        {row.isManualReceiptRow && (
	                          <AttendanceOriginBadge>Lancamento manual</AttendanceOriginBadge>
	                        )}
	                      </AttendanceCellStack>
	                    </td>
                    <td>
                      <AttendanceCellStack>
                        <AttendanceMoneyText>{formatCurrency(row.amountCents)}</AttendanceMoneyText>
                      </AttendanceCellStack>
                    </td>
	                    <td>
	                      <AttendanceCellStack>
	                        <AttendancePrimaryText>{installmentSummary}</AttendancePrimaryText>
	                        {row.isManualReceiptRow && installmentNote && (
	                          <AttendanceSecondaryText>{installmentNote}</AttendanceSecondaryText>
	                        )}
	                        {row.isInstallmentPlan && row.installmentAgreementTotalCents > 0 && (
	                          <AttendanceSecondaryText>
	                            Acordo: {formatCurrency(row.installmentAgreementTotalCents)}
	                          </AttendanceSecondaryText>
                        )}
                        {row.isInstallmentPlan
                          && !row.isProjectedInstallmentRow
                          && row.firstInstallmentOpenCents > 0 && (
                          <AttendanceSecondaryText>
                            Residual em aberto: {formatCurrency(row.firstInstallmentOpenCents)}
                          </AttendanceSecondaryText>
                        )}
                      </AttendanceCellStack>
                    </td>
                    <td>
                      <AttendanceStatusBadge $status={status}>
                        {statusLabel}
                      </AttendanceStatusBadge>
                    </td>
	                    <td>
	                      <AttendanceNoteText>
	                        {row.isManualReceiptRow
	                          ? row.manualNote || "-"
	                          : installmentNote || row.entry?.notes || row.payment?.note || "-"}
	                      </AttendanceNoteText>
	                    </td>
	                    <td>
	                      <AttendanceRowActions>
	                        {!row.isManualReceiptRow && !row.entry && (
	                          <AttendanceSmallAction
	                            type="button"
	                            onClick={() => handleCreateSessionEntry(row.id)}
	                          >
                            Gerar lancamento
                          </AttendanceSmallAction>
                        )}
                        {canShowActions && (
                          <ActionMenu onToggle={handleActionMenuToggle}>
                            <ActionMenuTrigger>Ações</ActionMenuTrigger>
                            <AttendanceActionList>
                              {status !== "paid" && row.openCents > 0 && availableCreditCents > 0 && (
                                <AttendanceActionItem
                                  type="button"
                                  onClick={(event) => {
                                    closeActionMenu(event);
                                    handleApplyCreditToEntry(row.entry.id);
                                  }}
                                >
                                  Usar credito
                                </AttendanceActionItem>
                              )}
                              {status !== "paid" && (
                                <AttendanceActionItem
                                  type="button"
                                  onClick={(event) => {
                                    closeActionMenu(event);
                                    openPaymentModal(row.entry, paymentModalOptions);
                                  }}
                                >
                                  Registrar recebimento
                                </AttendanceActionItem>
                              )}
                            </AttendanceActionList>
                          </ActionMenu>
                        )}
                      </AttendanceRowActions>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            </AttendanceDataTable>
          </AttendanceTableScroll>
        </AttendanceTableCard>
      );
    }

    return (
      <AttendanceSectionSurface>
        <AttendanceSectionHeader>
          <div>
            <AttendanceHeadingTitle>Atendimentos</AttendanceHeadingTitle>
            <AttendanceHeadingSubtitle>
              O que foi atendido, o que gerou cobranca, recebimentos manuais e o que ainda falta
              receber.
            </AttendanceHeadingSubtitle>
          </div>
          <AttendanceHeaderActions>
            <AttendanceGhostAction type="button" onClick={loadAttendance}>
              Atualizar
            </AttendanceGhostAction>
            <AttendancePrimaryAction type="button" onClick={openCreditModal}>
              <FaPlus />
              Registrar recebimento
            </AttendancePrimaryAction>
          </AttendanceHeaderActions>
        </AttendanceSectionHeader>

        {isAttendanceBusy ? (
          <SectionLoader>
            <Spinner />
            Carregando atendimentos...
          </SectionLoader>
        ) : (
          <>
            <AttendanceCard>
              <AttendanceCardHeader>
                <AttendanceCardTitle>Resumo de cobranca</AttendanceCardTitle>
              </AttendanceCardHeader>
              <AttendanceMetricsGrid>
                <AttendanceMetricCard>
                  <AttendanceMetricLabel>Sessoes concluidas</AttendanceMetricLabel>
                  <AttendanceMetricValue>{attendanceSummary.total}</AttendanceMetricValue>
                </AttendanceMetricCard>
                <AttendanceMetricCard>
                  <AttendanceMetricLabel>Pacientes em aberto</AttendanceMetricLabel>
                  <AttendanceMetricValue>{attendanceSummary.openPatients}</AttendanceMetricValue>
                </AttendanceMetricCard>
                <AttendanceMetricCard>
                  <AttendanceMetricLabel>Pendente de pagamento</AttendanceMetricLabel>
                  <AttendanceMetricValue>{formatCurrency(attendanceSummary.pendingAmount)}</AttendanceMetricValue>
                </AttendanceMetricCard>
                <AttendanceMetricCard>
                  <AttendanceMetricLabel>Credito antecipado</AttendanceMetricLabel>
                  <AttendanceMetricValue>{formatCurrency(attendanceSummary.creditsAvailable)}</AttendanceMetricValue>
                </AttendanceMetricCard>
              </AttendanceMetricsGrid>
            </AttendanceCard>

            <AttendanceCard>
              <AttendanceCardHeader>
                <AttendanceCardTitle>Filtros</AttendanceCardTitle>
              </AttendanceCardHeader>
              <AttendanceFilterGrid>
                <AttendanceFilterField>
                  <AttendanceFilterLabel htmlFor="attendance-status">Status financeiro</AttendanceFilterLabel>
                  <AttendanceFilterSelect
                    id="attendance-status"
                    name="financial"
                    value={attendanceFilters.financial}
                    onChange={handleAttendanceFilterChange}
                  >
                    <option value="all">Todos</option>
                    <option value="pending">Pendentes</option>
                    <option value="partial">Parciais</option>
                    <option value="paid">Pagos</option>
                  </AttendanceFilterSelect>
                </AttendanceFilterField>
                <AttendanceFilterField>
                  <AttendanceFilterLabel htmlFor="attendance-patient">Paciente</AttendanceFilterLabel>
                  <AttendanceFilterSelect
                    id="attendance-patient"
                    name="patient_id"
                    value={attendanceFilters.patient_id}
                    onChange={handleAttendanceFilterChange}
                  >
                    <option value="">
                      {attendanceView === "sessions" ? "Selecione um paciente" : "Todos"}
                    </option>
                    {patients.map((patient) => (
                      <option key={patient.id} value={patient.id}>
                        {patient.full_name || patient.name}
                      </option>
                    ))}
                  </AttendanceFilterSelect>
                </AttendanceFilterField>
                <AttendanceFilterField>
                  <AttendanceFilterLabel htmlFor="attendance-professional">Profissional</AttendanceFilterLabel>
                  <AttendanceFilterSelect
                    id="attendance-professional"
                    name="professional_id"
                    value={attendanceFilters.professional_id}
                    onChange={handleAttendanceFilterChange}
                  >
                    <option value="">Todos</option>
                    {professionalOptions.map((professional) => (
                      <option key={professional.id} value={professional.id}>
                        {professional.name || professional.email}
                      </option>
                    ))}
                  </AttendanceFilterSelect>
                </AttendanceFilterField>
                <AttendanceFilterField>
                  <AttendanceFilterLabel htmlFor="attendance-search">Busca</AttendanceFilterLabel>
                  <AttendanceFilterInput
                    id="attendance-search"
                    name="search"
                    placeholder="Paciente, profissional, servico..."
                    value={attendanceFilters.search}
                    onChange={handleAttendanceFilterChange}
                  />
                </AttendanceFilterField>
              </AttendanceFilterGrid>
              {attendanceFilters.patient_id && (
                <AttendanceFilterMeta>
                  <AttendanceFilterMetaText>
                    Filtro ativo de paciente:{" "}
                    <strong>
                      {activeAttendancePatient?.full_name ||
                        activeAttendancePatient?.name ||
                        "Paciente selecionado"}
                    </strong>
                  </AttendanceFilterMetaText>
                  <AttendanceClearAction type="button" onClick={handleClearAttendancePatientFilter}>
                    Limpar filtro
                  </AttendanceClearAction>
                </AttendanceFilterMeta>
              )}
            </AttendanceCard>

            <AttendanceCard>
              <AttendanceControlsRow>
                <AttendanceTabsRow>
                  <AttendanceTabGroup>
                  <AttendanceTabButton
                    type="button"
                    $active={attendanceView === "patients"}
                    onClick={() => handleAttendanceViewChange("patients")}
                  >
                    Por paciente
                  </AttendanceTabButton>
                  <AttendanceTabButton
                    type="button"
                    $active={attendanceView === "sessions"}
	                    disabled={!canOpenAttendanceSessionsView}
	                    onClick={() => handleAttendanceViewChange("sessions")}
	                    title={
	                      canOpenAttendanceSessionsView
	                        ? undefined
	                        : "Selecione um paciente para ver por sessao"
	                    }
                  >
                    Por sessão
	                  </AttendanceTabButton>
                  </AttendanceTabGroup>
		                <AttendanceTabGroup>
                  <AttendanceTabButton
                    type="button"
                    $active={attendancePeriodMode === "month"}
	                    onClick={() => handleAttendancePeriodModeChange("month")}
                  >
                    Mes
	                  </AttendanceTabButton>
	                  <AttendanceTabButton
                    type="button"
                    $active={attendancePeriodMode === "year"}
	                    onClick={() => handleAttendancePeriodModeChange("year")}
                  >
                    Visao anual
	                  </AttendanceTabButton>
	                </AttendanceTabGroup>
                </AttendanceTabsRow>
		              {attendancePeriodLabel && (
		                <AttendancePeriodControls>
		                  <AttendancePeriodButton type="button" onClick={handleAttendancePreviousMonth}>
                    {attendancePeriodMode === "year" ? "Ano anterior" : "Mes anterior"}
	                  </AttendancePeriodButton>
		                  <AttendancePeriodChip
                    role="button"
                    tabIndex={0}
                    onClick={handleAttendancePeriodTagClick}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        handleAttendancePeriodTagClick();
                      }
                    }}
                  >
                    {attendancePeriodLabel}
                    {attendancePeriodMode === "year" ? (
                      <AttendancePeriodYearSelect
                        aria-label="Selecionar ano"
                        value={attendancePeriodYear}
                        onChange={handleAttendanceYearPickerChange}
                      >
                        {attendanceYearOptions.map((year) => (
                          <option key={year} value={year}>
                            {year}
                          </option>
                        ))}
                      </AttendancePeriodYearSelect>
                    ) : (
                      <AttendancePeriodMonthInput
                        ref={attendanceMonthPickerRef}
                        aria-label="Selecionar mes e ano"
                        type="month"
                        value={attendancePeriodMonth}
                        onChange={handleAttendanceMonthPickerChange}
                      />
                    )}
	                  </AttendancePeriodChip>
		                  <AttendancePeriodButton type="button" onClick={handleAttendanceNextMonth}>
                    {attendancePeriodMode === "year" ? "Ano seguinte" : "Mes seguinte"}
	                  </AttendancePeriodButton>
		                </AttendancePeriodControls>
		              )}
              </AttendanceControlsRow>
		              {attendanceView === "sessions" && attendanceSelectedPatientSummary && (
		                <AttendancePatientStrip>
		                  <AttendancePatientName>{attendanceSelectedPatientSummary.patientName}</AttendancePatientName>
		                  <AttendancePatientStats>
		                    <AttendancePatientStat>
		                      <span>Sessoes</span>
		                      <strong>{attendanceSelectedPatientSummary.sessions}</strong>
		                    </AttendancePatientStat>
		                    <AttendancePatientStat>
		                      <span>Em aberto</span>
		                      <strong>{formatCurrency(attendanceSelectedPatientSummary.openCents)}</strong>
		                    </AttendancePatientStat>
		                    <AttendancePatientStat>
		                      <span>Creditos</span>
		                      <strong>
		                        {formatCurrency(attendanceSelectedPatientSummary.creditsAvailable)}
		                      </strong>
		                    </AttendancePatientStat>
		                  </AttendancePatientStats>
		                </AttendancePatientStrip>
		              )}
		              <AttendanceDetailHeader>
		                <AttendanceDetailTitle>{attendanceTitle}</AttendanceDetailTitle>
		              </AttendanceDetailHeader>
              {attendanceContent}
            </AttendanceCard>
          </>
        )}
      </AttendanceSectionSurface>
    );
  };

  const renderPayments = () => (
    <Section>
      <SectionHeader>
        <div>
          <SectionTitle>Recebimentos</SectionTitle>
          <SectionSubtitle>Entradas de caixa, uso em cobrancas e saldo ainda disponivel.</SectionSubtitle>
        </div>
        <HeaderActions>
          <GhostButton type="button" onClick={() => handleExportPayments()}>
            Exportar CSV
          </GhostButton>
          <PrimaryButton type="button" onClick={openCreditModal}>
            <FaPlus />
            Novo recebimento
          </PrimaryButton>
        </HeaderActions>
      </SectionHeader>

      {loading ? (
        <SectionLoader>
          <Spinner />
          Carregando recebimentos...
        </SectionLoader>
      ) : (
        <>
          <Panel>
            <PanelHeader>
              <PanelTitle>Resumo do caixa</PanelTitle>
            </PanelHeader>
            <SummaryGrid>
              <SummaryCard>
                <SummaryLabel>Total recebido</SummaryLabel>
                <SummaryValue>{formatCurrency(paymentsSummary.totalReceived)}</SummaryValue>
              </SummaryCard>
              <SummaryCard>
                <SummaryLabel>Ja usado em cobrancas</SummaryLabel>
                <SummaryValue>{formatCurrency(paymentsSummary.totalAllocated)}</SummaryValue>
              </SummaryCard>
              <SummaryCard>
                <SummaryLabel>Saldo em credito</SummaryLabel>
                <SummaryValue>{formatCurrency(paymentsSummary.totalCredit)}</SummaryValue>
              </SummaryCard>
            </SummaryGrid>
          </Panel>

          <Panel>
            <PanelHeader>
              <PanelTitle>Filtrar recebimentos</PanelTitle>
            </PanelHeader>
            <FiltersRow>
              <FilterField>
                <Label htmlFor="payment-filter-patient">Paciente</Label>
                <Select
                  id="payment-filter-patient"
                  name="patient_id"
                  value={paymentFilters.patient_id}
                  onChange={handlePaymentFilterChange}
                >
                  <option value="">Todos</option>
                  {patients.map((patient) => (
                    <option key={patient.id} value={patient.id}>
                      {patient.full_name || patient.name}
                    </option>
                  ))}
                </Select>
              </FilterField>
              <FilterField>
                <Label htmlFor="payment-filter-method">Forma de pagamento</Label>
                <Select
                  id="payment-filter-method"
                  name="method_id"
                  value={paymentFilters.method_id}
                  onChange={handlePaymentFilterChange}
                >
                  <option value="">Todas</option>
                  {paymentMethods.map((method) => (
                    <option key={method.id} value={method.id}>
                      {method.name}
                    </option>
                  ))}
                </Select>
              </FilterField>
              <FilterField>
                <Label htmlFor="payment-filter-start">De</Label>
                <Input
                  id="payment-filter-start"
                  type="date"
                  name="start"
                  value={paymentFilters.start}
                  onChange={handlePaymentFilterChange}
                />
              </FilterField>
              <FilterField>
                <Label htmlFor="payment-filter-end">Ate</Label>
                <Input
                  id="payment-filter-end"
                  type="date"
                  name="end"
                  value={paymentFilters.end}
                  onChange={handlePaymentFilterChange}
                />
              </FilterField>
              <FilterField>
                <Label htmlFor="payment-filter-search">Busca</Label>
                <Input
                  id="payment-filter-search"
                  name="search"
                  placeholder="Paciente, forma, observacao..."
                  value={paymentFilters.search}
                  onChange={handlePaymentFilterChange}
                />
              </FilterField>
            </FiltersRow>
          </Panel>

          <Panel>
            <PanelHeader>
              <PanelTitle>Recebimentos registrados</PanelTitle>
            </PanelHeader>
            {filteredPayments.length === 0 ? (
              <EmptyState>Sem recebimentos no periodo.</EmptyState>
            ) : (
              <SimpleTable>
                <thead>
                  <tr>
                    <th>Data</th>
                    <th>Paciente</th>
                    <th>Valor recebido</th>
                    <th>Usado em cobrancas</th>
                    <th>Saldo disponivel</th>
                    <th>Forma de pagamento</th>
                    <th>Parcelas do pagamento</th>
                    <th>Uso do valor</th>
                    <th>Observações</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPayments.map((payment) => {
                    const patient = payment.patient_id ? patientMap.get(payment.patient_id) : null;
                    const method = payment.payment_method_id
                      ? paymentMethodMap.get(payment.payment_method_id)
                      : null;
                    const allocated = allocatedByPaymentId.get(payment.id) || 0;
                    const remaining = Math.max(0, Number(payment.amount_cents || 0) - allocated);
                    return (
                      <tr key={payment.id}>
                        <td>{payment.paid_at ? new Date(payment.paid_at).toLocaleString() : "-"}</td>
                        <td>{patient?.full_name || "-"}</td>
                        <td>{formatCurrency(payment.amount_cents)}</td>
                        <td>{formatCurrency(allocated)}</td>
                        <td>{formatCurrency(remaining)}</td>
                        <td>{method?.name || "-"}</td>
                        <td>{payment.installments ? `${payment.installments}x` : "-"}</td>
                        <td>{formatPaymentUsage(payment, allocated)}</td>
                        <td>{payment.note || "-"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </SimpleTable>
            )}
          </Panel>

          <Panel>
            <PanelHeader>
              <div>
                <PanelTitle>Baixas nas cobrancas</PanelTitle>
                <SectionSubtitle>Cada linha mostra onde um recebimento foi aplicado.</SectionSubtitle>
              </div>
            </PanelHeader>
            {filteredAllocations.length === 0 ? (
              <EmptyState>Sem baixas registradas.</EmptyState>
            ) : (
              <SimpleTable>
                <thead>
                  <tr>
                    <th>Recebimento</th>
                    <th>Paciente</th>
                    <th>Cobranca</th>
                    <th>Valor aplicado</th>
                    <th>Competencia</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAllocations.map((allocation) => {
                    const { payment } = allocation;
                    const entry = allocation.FinancialEntry || entryMap.get(allocation.entry_id);
                    const patient =
                      (payment?.patient_id && patientMap.get(payment.patient_id)) ||
                      (entry?.patient_id && patientMap.get(entry.patient_id));
                    return (
                      <tr key={`${allocation.payment_id}-${allocation.entry_id}`}>
                        <td>{payment?.paid_at ? new Date(payment.paid_at).toLocaleString() : "-"}</td>
                        <td>{patient?.full_name || "-"}</td>
                        <td>{entry?.description || "-"}</td>
                        <td>{formatCurrency(allocation.amount_cents)}</td>
                        <td>{entry?.reference_date || "-"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </SimpleTable>
            )}
          </Panel>
        </>
      )}
    </Section>
  );

  const renderReceitasTabs = () => (
    <TabsWrapper>
      <TabsRow>
	        <TabButton
	          type="button"
	          $active={receitasView === "atendimentos"}
	          onClick={() => setReceitasView("atendimentos")}
	        >
	          Atendimentos
	        </TabButton>
	        {SHOW_DEDICATED_PAYMENTS_VIEW && (
	          <TabButton
	            type="button"
	            $active={receitasView === "recebimentos"}
	            onClick={() => setReceitasView("recebimentos")}
	          >
	            Recebimentos
	          </TabButton>
	        )}
	        {SHOW_MANUAL_ENTRIES && (
	          <TabButton
	            type="button"
	            $active={receitasView === "manuais"}
            onClick={() => setReceitasView("manuais")}
          >
            Lancamentos manuais
          </TabButton>
        )}
      </TabsRow>
    </TabsWrapper>
  );

  const renderReceitas = () => {
    let receitasContent = renderAttendance();

	    if (SHOW_DEDICATED_PAYMENTS_VIEW && receitasView === "recebimentos") {
	      receitasContent = renderPayments();
	    } else if (receitasView === "manuais" && SHOW_MANUAL_ENTRIES) {
	      receitasContent = renderEntries();
	    }

    return (
      <>
        {renderReceitasTabs()}
        {receitasContent}
      </>
    );
  };

  const renderCategories = () => {
    let content = (
      <SimpleTable>
        <thead>
          <tr>
            <th>Nome</th>
            <th>Tipo</th>
            <th>Ativo</th>
            <th>Ações</th>
          </tr>
        </thead>
        <tbody>
          {categories.map((category) => (
            <tr key={category.id}>
              <td>
                <ColorRow>
                  <ColorDot style={{ background: category.color || "#d7dfd0" }} />
                  {category.name}
                </ColorRow>
              </td>
              <td>
                <TypePill $type={category.type}>
                  {category.type === "income" ? "Receita" : "Despesa"}
                </TypePill>
              </td>
              <td>{category.is_active ? "Sim" : "Nao"}</td>
              <td>
                <RowActions>
                  <SmallButton type="button" onClick={() => openCategoryModal(category)}>
                    Editar
                  </SmallButton>
                  <SmallButton type="button" onClick={() => handleToggleCategory(category)}>
                    {category.is_active ? "Desativar" : "Ativar"}
                  </SmallButton>
                </RowActions>
              </td>
            </tr>
          ))}
        </tbody>
      </SimpleTable>
    );

    if (loading) {
      content = (
        <SectionLoader>
          <Spinner />
          Carregando categorias...
        </SectionLoader>
      );
    } else if (categories.length === 0) {
      content = <EmptyState>Sem categorias cadastradas.</EmptyState>;
    }

    return (
      <Section>
        <SectionHeader>
          <div>
            <SectionTitle>Categorias</SectionTitle>
            <SectionSubtitle>Organize receitas e despesas.</SectionSubtitle>
          </div>
          <PrimaryButton type="button" onClick={openCategoryModal}>
            <FaPlus />
            Nova categoria
          </PrimaryButton>
        </SectionHeader>
        {content}
      </Section>
    );
  };

  const renderMethods = () => {
    let content = (
      <SimpleTable>
        <thead>
          <tr>
            <th>Nome</th>
            <th>Ativo</th>
            <th>Ações</th>
          </tr>
        </thead>
        <tbody>
          {paymentMethods.map((method) => (
            <tr key={method.id}>
              <td>{method.name}</td>
              <td>{method.is_active ? "Sim" : "Nao"}</td>
              <td>
                <RowActions>
                  <SmallButton type="button" onClick={() => openMethodModal(method)}>
                    Editar
                  </SmallButton>
                  <SmallButton type="button" onClick={() => handleToggleMethod(method)}>
                    {method.is_active ? "Desativar" : "Ativar"}
                  </SmallButton>
                </RowActions>
              </td>
            </tr>
          ))}
        </tbody>
      </SimpleTable>
    );

    if (loading) {
      content = (
        <SectionLoader>
          <Spinner />
          Carregando formas de pagamento...
        </SectionLoader>
      );
    } else if (paymentMethods.length === 0) {
      content = <EmptyState>Sem formas cadastradas.</EmptyState>;
    }

    return (
      <Section>
        <SectionHeader>
          <div>
            <SectionTitle>Formas de pagamento</SectionTitle>
            <SectionSubtitle>Cadastre os metodos aceitos.</SectionSubtitle>
          </div>
          <PrimaryButton type="button" onClick={openMethodModal}>
            <FaPlus />
            Nova forma
          </PrimaryButton>
        </SectionHeader>
        {content}
      </Section>
    );
  };

  const renderHolidays = () => {
    let content = (
      <SimpleTable>
        <thead>
          <tr>
            <th>Nome</th>
            <th>Data</th>
            <th>Tipo</th>
            <th>Ações</th>
          </tr>
        </thead>
        <tbody>
          {holidayRows.map((holiday) => {
            const location = formatHolidayLocation(holiday);
            return (
              <tr key={holiday.id}>
                <td>
                  <CellStack>
                    <span>{holiday.name || "Feriado"}</span>
                    {location ? <MutedText>{location}</MutedText> : null}
                  </CellStack>
                </td>
                <td>{formatHolidayDate(holiday.start_date)}</td>
                <td>{HOLIDAY_SOURCE_LABELS[holiday.source_type] || holiday.source_type || "-"}</td>
                <td>
                  <RowActions>
                    <SmallButton type="button" onClick={() => handleDeleteHoliday(holiday)}>
                      Excluir
                    </SmallButton>
                  </RowActions>
                </td>
              </tr>
            );
          })}
        </tbody>
      </SimpleTable>
    );

    if (isHolidayLoading) {
      content = (
        <SectionLoader>
          <Spinner />
          Carregando feriados...
        </SectionLoader>
      );
    } else if (holidayRows.length === 0) {
      content = <EmptyState>Sem feriados cadastrados.</EmptyState>;
    }

    return (
      <Section>
        <SectionHeader>
          <div>
            <SectionTitle>Feriados</SectionTitle>
            <SectionSubtitle>Cadastre e remova feriados da agenda com o minimo necessario.</SectionSubtitle>
          </div>
          <HeaderActions>
            <GhostButton type="button" onClick={loadHolidays}>
              Atualizar
            </GhostButton>
            <PrimaryButton type="button" onClick={openHolidayModal}>
              <FaPlus />
              Novo feriado
            </PrimaryButton>
          </HeaderActions>
        </SectionHeader>

        {content}
      </Section>
    );
  };

  const renderPrices = () => {
    let content = (
      <SimpleTable>
        <thead>
          <tr>
            <th>Servico</th>
            <th>Valor</th>
            <th>Ativo</th>
            <th>Ações</th>
          </tr>
        </thead>
        <tbody>
          {services.map((service) => {
            const price = servicePriceMap.get(service.id);
            return (
              <tr key={service.id}>
                <td>
                  <CellStack>
                    <ColorRow>
                      {service.color ? <ColorDot style={{ background: service.color }} /> : null}
                      <span>{service.name}</span>
                    </ColorRow>
                    {service.code ? <MutedText>{service.code}</MutedText> : null}
                  </CellStack>
                </td>
                <td>{price ? formatCurrency(price.price_cents) : "Sem preco"}</td>
                <td>{service.is_active ? "Sim" : "Nao"}</td>
                <td>
                  <RowActions>
                    <SmallButton type="button" onClick={() => openServiceModal(service)}>
                      Editar
                    </SmallButton>
                    <SmallButton type="button" onClick={() => handleToggleService(service)}>
                      {service.is_active ? "Desativar" : "Ativar"}
                    </SmallButton>
                    <SmallButton type="button" onClick={() => handleDeleteService(service)}>
                      Excluir
                    </SmallButton>
                  </RowActions>
                </td>
              </tr>
            );
          })}
        </tbody>
      </SimpleTable>
    );

    if (loading) {
      content = (
        <SectionLoader>
          <Spinner />
          Carregando servicos...
        </SectionLoader>
      );
    } else if (services.length === 0) {
      content = <EmptyState>Sem servicos cadastrados.</EmptyState>;
    }

    return (
      <Section>
        <SectionHeader>
          <div>
            <SectionTitle>Servicos</SectionTitle>
            <SectionSubtitle>Gerencie servicos, valores e disponibilidade.</SectionSubtitle>
          </div>
          <PrimaryButton type="button" onClick={() => openServiceModal()}>
            <FaPlus />
            Novo servico
          </PrimaryButton>
        </SectionHeader>
        {content}
      </Section>
    );
  };

  const renderRecurring = () => {
    let content = (
      <SimpleTable>
        <thead>
          <tr>
            <th>Nome</th>
            <th>Categoria</th>
            <th>Valor</th>
            <th>Dia</th>
            <th>Ativo</th>
            <th>Ações</th>
          </tr>
        </thead>
        <tbody>
          {recurringExpenses.map((item) => {
            const category = item.category_id ? categoryMap.get(item.category_id) : null;
            return (
              <tr key={item.id}>
                <td>{item.name}</td>
                <td>{category?.name || "-"}</td>
                <td>{formatCurrency(item.amount_cents)}</td>
                <td>{item.day_of_month}</td>
                <td>{item.is_active ? "Sim" : "Nao"}</td>
                <td>
                  <RowActions>
                    <SmallButton type="button" onClick={() => openRecurringModal(item)}>
                      Editar
                    </SmallButton>
                    <SmallButton type="button" onClick={() => handleToggleRecurring(item)}>
                      {item.is_active ? "Desativar" : "Ativar"}
                    </SmallButton>
                  </RowActions>
                </td>
              </tr>
            );
          })}
        </tbody>
      </SimpleTable>
    );

    if (loading) {
      content = (
        <SectionLoader>
          <Spinner />
          Carregando despesas fixas...
        </SectionLoader>
      );
    } else if (recurringExpenses.length === 0) {
      content = <EmptyState>Sem despesas fixas cadastradas.</EmptyState>;
    }

    return (
      <Section>
        <SectionHeader>
          <div>
            <SectionTitle>Despesas fixas</SectionTitle>
            <SectionSubtitle>Controle despesas recorrentes mensais.</SectionSubtitle>
          </div>
          <PrimaryButton type="button" onClick={() => openRecurringModal()}>
            <FaPlus />
            Nova despesa fixa
          </PrimaryButton>
        </SectionHeader>
        {content}
      </Section>
    );
  };

  const renderReports = () => (
    <Section>
      <SectionHeader>
        <div>
          <SectionTitle>Relatorios</SectionTitle>
          <SectionSubtitle>Exporte dados para analise.</SectionSubtitle>
        </div>
      </SectionHeader>
      {loading ? (
        <SectionLoader>
          <Spinner />
          Carregando relatorios...
        </SectionLoader>
      ) : (
        <ReportGrid>
          <ReportCard>
            <h4>Total em aberto</h4>
            <p>{formatCurrency(reportIndicators.totalOpen)}</p>
          </ReportCard>
          <ReportCard>
            <h4>Credito disponivel</h4>
            <p>{formatCurrency(reportIndicators.totalCredit)}</p>
          </ReportCard>
          <ReportCard>
            <h4>Total recebido</h4>
            <p>{formatCurrency(reportIndicators.totalReceived)}</p>
          </ReportCard>
          <ReportCard>
            <h4>Sessoes nao quitadas</h4>
            <p>{reportIndicators.unpaidSessions}</p>
          </ReportCard>
          <ReportCard>
            <h4>Cobrancas vencidas</h4>
            <p>{reportIndicators.overdueCharges}</p>
          </ReportCard>
          <ReportCard>
            <h4>Lancamentos filtrados</h4>
            <p>Exporta os lancamentos atuais com os filtros selecionados.</p>
            <GhostButton type="button" onClick={handleExportCsv}>
              Exportar CSV
            </GhostButton>
          </ReportCard>
          <ReportCard>
            <h4>Pagamentos</h4>
            <p>Lista completa de pagamentos confirmados.</p>
            <GhostButton type="button" onClick={() => handleExportPayments()}>
              Exportar CSV
            </GhostButton>
          </ReportCard>
        </ReportGrid>
      )}
    </Section>
  );

  let sidebarToggleLabel = "Recolher menu";
  let sidebarToggleIcon = <FaChevronLeft />;
  if (isMobile) {
    sidebarToggleLabel = "Fechar menu";
    sidebarToggleIcon = <FaTimes />;
  } else if (isSidebarCollapsed) {
    sidebarToggleLabel = "Expandir menu";
    sidebarToggleIcon = <FaBars />;
  }

  return (
    <Wrapper $collapsed={isSidebarCollapsed}>
      <Layout $collapsed={isSidebarCollapsed}>
        <Sidebar $collapsed={isSidebarCollapsed} $mobileOpen={isSidebarOpen}>
          <SidebarHeader>
            <SidebarTitle $collapsed={isSidebarCollapsed}>Menu</SidebarTitle>
            <SidebarToggle
              type="button"
              onClick={handleSidebarToggle}
              aria-label={sidebarToggleLabel}
            >
              {sidebarToggleIcon}
            </SidebarToggle>
          </SidebarHeader>

          <SidebarSection $collapsed={isSidebarCollapsed}>
            <SidebarTitle $collapsed={isSidebarCollapsed}>Operacao</SidebarTitle>
            <SidebarButton
              type="button"
              $active={activeSection === "receitas"}
              $collapsed={isSidebarCollapsed}
              onClick={() => handleSectionChange("receitas")}
              title="Receitas"
            >
              <SidebarIcon $active={activeSection === "receitas"}>
                <FaMoneyBillWave />
              </SidebarIcon>
              <SidebarLabel $collapsed={isSidebarCollapsed}>Receitas</SidebarLabel>
            </SidebarButton>
          </SidebarSection>

          {SHOW_FINANCIAL_MANAGEMENT && (
            <SidebarSection $collapsed={isSidebarCollapsed}>
              <SidebarTitle $collapsed={isSidebarCollapsed}>Gestao</SidebarTitle>
              <SidebarButton
                type="button"
                $active={activeSection === "recurring"}
                $collapsed={isSidebarCollapsed}
                onClick={() => handleSectionChange("recurring")}
                title="Despesas fixas"
              >
                <SidebarIcon $active={activeSection === "recurring"}>
                  <FaWallet />
                </SidebarIcon>
                <SidebarLabel $collapsed={isSidebarCollapsed}>Despesas fixas</SidebarLabel>
              </SidebarButton>
            </SidebarSection>
          )}

          {SHOW_FINANCIAL_REPORTS && (
            <SidebarSection $collapsed={isSidebarCollapsed}>
              <SidebarTitle $collapsed={isSidebarCollapsed}>Relatorios</SidebarTitle>
              <SidebarButton
                type="button"
                $active={activeSection === "reports"}
                $collapsed={isSidebarCollapsed}
                onClick={() => handleSectionChange("reports")}
                title="Relatorios"
              >
                <SidebarIcon $active={activeSection === "reports"}>
                  <FaChartLine />
                </SidebarIcon>
                <SidebarLabel $collapsed={isSidebarCollapsed}>Relatorios</SidebarLabel>
              </SidebarButton>
            </SidebarSection>
          )}

          <SidebarSection $collapsed={isSidebarCollapsed}>
            <SidebarTitle $collapsed={isSidebarCollapsed}>Configurações</SidebarTitle>
            <SidebarButton
              type="button"
              $active={activeSection === "prices"}
              $collapsed={isSidebarCollapsed}
              onClick={() => handleSectionChange("prices")}
              title="Servicos"
            >
              <SidebarIcon $active={activeSection === "prices"}>
                <FaCoins />
              </SidebarIcon>
              <SidebarLabel $collapsed={isSidebarCollapsed}>Servicos</SidebarLabel>
            </SidebarButton>
            <SidebarButton
              type="button"
              $active={activeSection === "methods"}
              $collapsed={isSidebarCollapsed}
              onClick={() => handleSectionChange("methods")}
              title="Formas de pagamento"
            >
              <SidebarIcon $active={activeSection === "methods"}>
                <FaRegCreditCard />
              </SidebarIcon>
              <SidebarLabel $collapsed={isSidebarCollapsed}>Formas de pagamento</SidebarLabel>
            </SidebarButton>
            <SidebarButton
              type="button"
              $active={activeSection === "holidays"}
              $collapsed={isSidebarCollapsed}
              onClick={() => handleSectionChange("holidays")}
              title="Feriados"
            >
              <SidebarIcon $active={activeSection === "holidays"}>
                <FaCalendarAlt />
              </SidebarIcon>
              <SidebarLabel $collapsed={isSidebarCollapsed}>Feriados</SidebarLabel>
            </SidebarButton>
            {SHOW_FINANCIAL_MANAGEMENT && (
              <SidebarButton
                type="button"
                $active={activeSection === "categories"}
                $collapsed={isSidebarCollapsed}
                onClick={() => handleSectionChange("categories")}
                title="Categorias"
              >
                <SidebarIcon $active={activeSection === "categories"}>
                  <FaTags />
                </SidebarIcon>
                <SidebarLabel $collapsed={isSidebarCollapsed}>Categorias</SidebarLabel>
              </SidebarButton>
            )}
          </SidebarSection>
        </Sidebar>

        <MainArea>
          <Header>
            <HeaderText>
              <Title>Financeiro</Title>
              <Subtitle>Gestao financeira simples e escalavel.</Subtitle>
            </HeaderText>
            <MobileMenuButton type="button" onClick={openSidebar}>
              <FaBars />
              Menu
            </MobileMenuButton>
          </Header>

          <>
            {activeSection === "receitas" && renderReceitas()}
            {SHOW_FINANCIAL_MANAGEMENT && activeSection === "recurring" && renderRecurring()}
            {SHOW_FINANCIAL_MANAGEMENT && activeSection === "categories" && renderCategories()}
            {activeSection === "methods" && renderMethods()}
            {activeSection === "holidays" && renderHolidays()}
            {activeSection === "prices" && renderPrices()}
            {SHOW_FINANCIAL_REPORTS && activeSection === "reports" && renderReports()}
          </>
        </MainArea>
      </Layout>

      {isMobile && isSidebarOpen && <SidebarOverlay onClick={closeSidebar} />}

      {isEntryOpen && (
        <>
          <ModalOverlay>
            <ModalCard>
              <ModalHeader>
                <div>
                  <ModalTitle>Novo lancamento</ModalTitle>
                  <ModalSubtitle>Preencha os dados do lancamento.</ModalSubtitle>
                </div>
                <IconButton type="button" onClick={closeEntryModal}>
                  <FaTimes />
                </IconButton>
              </ModalHeader>
              <ModalBody>
                <FormGrid>
                  <Field>
                    <Label htmlFor="entry-type">Tipo</Label>
                    <Select
                      id="entry-type"
                      name="type"
                      value={entryForm.type}
                      onChange={handleEntryChange}
                    >
                      <option value="income">Receita</option>
                      <option value="expense">Despesa</option>
                    </Select>
                  </Field>
                  <Field>
                    <Label htmlFor="entry-amount">Valor</Label>
                    <Input
                      id="entry-amount"
                      name="amount"
                      value={entryForm.amount}
                      onChange={handleEntryChange}
                      placeholder="0,00"
                    />
                  </Field>
                  <Field>
                    <Label htmlFor="entry-date">Data de referencia</Label>
                    <Input
                      id="entry-date"
                      type="date"
                      name="reference_date"
                      value={entryForm.reference_date}
                      onChange={handleEntryChange}
                    />
                  </Field>
                  <Field>
                    <Label htmlFor="entry-due">Vencimento</Label>
                    <Input
                      id="entry-due"
                      type="date"
                      name="due_date"
                      value={entryForm.due_date}
                      onChange={handleEntryChange}
                    />
                  </Field>
                  <Field>
                    <Label htmlFor="entry-category">Categoria</Label>
                    <Select
                      id="entry-category"
                      name="category_id"
                      value={entryForm.category_id}
                      onChange={handleEntryChange}
                    >
                      <option value="">Selecione</option>
                      {categories.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field>
                    <Label htmlFor="entry-patient">Paciente</Label>
                    <Select
                      id="entry-patient"
                      name="patient_id"
                      value={entryForm.patient_id}
                      onChange={handleEntryChange}
                    >
                      <option value="">Selecione</option>
                      {patients.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.full_name}
                        </option>
                      ))}
                    </Select>
                  </Field>
                </FormGrid>
                <Field>
                  <Label htmlFor="entry-description">Descricao</Label>
                  <Input
                    id="entry-description"
                    name="description"
                    value={entryForm.description}
                    onChange={handleEntryChange}
                  />
                </Field>
                <Field>
                  <Label htmlFor="entry-notes">Observações</Label>
                  <TextArea
                    id="entry-notes"
                    name="notes"
                    rows="3"
                    value={entryForm.notes}
                    onChange={handleEntryChange}
                  />
                </Field>
              </ModalBody>
              <ModalActions>
                <SecondaryButton type="button" onClick={closeEntryModal}>
                  Cancelar
                </SecondaryButton>
                <PrimaryButton type="button" onClick={handleSaveEntry}>
                  Salvar
                </PrimaryButton>
              </ModalActions>
            </ModalCard>
          </ModalOverlay>
          <Backdrop onClick={closeEntryModal} />
        </>
      )}

      {isPaymentOpen && (
        <>
          <ModalOverlay>
            <ModalCard>
              <ModalHeader>
                <div>
                  <ModalTitle>Registrar recebimento</ModalTitle>
                  <ModalSubtitle>{paymentModalSubtitle}</ModalSubtitle>
                </div>
                <IconButton type="button" onClick={closePaymentModal}>
                  <FaTimes />
                </IconButton>
              </ModalHeader>
              <ModalBody>
                {isSimplifiedInstallmentPayment && (
                  <PaymentPreviewBox>
                    <PaymentPreviewTitle>Confirmacao de parcela</PaymentPreviewTitle>
                    <PaymentPreviewRow>
                      <span>Parcela</span>
                      <strong>
                        {paymentModalContext?.installmentNumber || "-"}
                        /
                        {paymentModalContext?.installmentCount || "-"}
                      </strong>
                    </PaymentPreviewRow>
                    <PaymentPreviewRow>
                      <span>Vencimento</span>
                      <strong>{formatDate(paymentModalContext?.installmentDueDate)}</strong>
                    </PaymentPreviewRow>
                    <PaymentPreviewRow>
                      <span>Valor</span>
                      <strong>{formatCurrency(paymentModalContext?.installmentAmountCents || 0)}</strong>
                    </PaymentPreviewRow>
                    <PaymentPreviewRow>
                      <span>Forma de pagamento</span>
                      <strong>
                        {paymentModalContext?.paymentMethodName ||
                          paymentMethodMap.get(Number(paymentModalContext?.paymentMethodId || 0))?.name ||
                          "-"}
                      </strong>
                    </PaymentPreviewRow>
                    <MutedText>
                      Clique em confirmar para registrar a baixa desta parcela.
                    </MutedText>
                  </PaymentPreviewBox>
                )}
                {!isSimplifiedInstallmentPayment && (
                <>
                {paymentForm.entry_id && (
                  <ChargeAmountBanner>
                    <span>Valor da cobranca</span>
                    <strong>{formatCurrency(selectedChargeAmountCents)}</strong>
                  </ChargeAmountBanner>
                )}
                <FormGrid>
	                  {!paymentForm.entry_id && (
	                    <Field>
	                      <Label htmlFor="payment-patient">Paciente</Label>
	                      <SearchFieldWrapper>
	                        <Input
	                          id="payment-patient"
	                          value={paymentPatientQuery}
	                          onChange={handlePaymentPatientSearchChange}
	                          onFocus={() => setIsPaymentPatientSearchFocused(true)}
	                          onBlur={handlePaymentPatientSearchBlur}
	                          placeholder="Digite o nome do paciente"
	                          autoComplete="off"
	                        />
	                        {isPaymentPatientSearchFocused
	                          && paymentPatientNormalizedQuery
	                          && paymentPatientOptions.length > 0 && (
	                          <SearchSuggestions role="listbox" aria-label="Sugestoes de pacientes">
	                            {paymentPatientOptions.map((patient) => (
	                              <SearchSuggestionButton
	                                key={patient.id}
	                                type="button"
	                                onMouseDown={(event) => {
	                                  event.preventDefault();
	                                  handleSelectPaymentPatient(patient);
	                                }}
	                              >
	                                {getPatientDisplayName(patient)}
	                              </SearchSuggestionButton>
	                            ))}
	                          </SearchSuggestions>
	                        )}
	                      </SearchFieldWrapper>
	                    </Field>
	                  )}
                  <Field>
                    <Label htmlFor="payment-amount">Valor recebido</Label>
                    <CurrencyInputGroup>
                      <CurrencyPrefix>R$</CurrencyPrefix>
                      <CurrencyInput
                        id="payment-amount"
                        name="amount"
                        value={paymentForm.amount}
                        onChange={handlePaymentChange}
                        onBlur={handlePaymentCurrencyBlur}
                        inputMode="decimal"
                        placeholder="0,00"
                      />
                    </CurrencyInputGroup>
                  </Field>
                  <Field>
                    <Label htmlFor="payment-date">Data do recebimento</Label>
                    <Input
                      id="payment-date"
                      type="datetime-local"
                      name="paid_at"
                      value={paymentForm.paid_at}
                      onChange={handlePaymentChange}
                    />
                  </Field>
                  <Field>
                    <Label htmlFor="payment-method">Forma de pagamento</Label>
                    <Select
                      id="payment-method"
                      name="payment_method_id"
                      value={paymentForm.payment_method_id}
                      onChange={handlePaymentChange}
                    >
                      <option value="">Selecione</option>
                      {paymentMethods.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  {paymentForm.entry_id && paymentPreview.originalInstallmentsCount <= 1 && (
                    <Field>
                      <InlineCheckLabel htmlFor="payment-convert-entry">
                        <input
                          id="payment-convert-entry"
                          type="checkbox"
                          name="convert_entry_to_installments"
                          checked={Boolean(paymentForm.convert_entry_to_installments)}
                          onChange={handlePaymentChange}
                        />
                        <span>Parcelamento da cobranca</span>
                      </InlineCheckLabel>
                      {paymentForm.convert_entry_to_installments && (
                        <NestedField>
                          <InstallmentInlineField>
                            <InstallmentInlineLabel htmlFor="payment-entry-installments">
                              nº de parcelas
                            </InstallmentInlineLabel>
                            <InstallmentCountInput
                              id="payment-entry-installments"
                              type="number"
                              min="2"
                              name="entry_installments_count"
                              value={paymentForm.entry_installments_count}
                              onChange={handlePaymentChange}
                            />
                          </InstallmentInlineField>
                        </NestedField>
                      )}
                    </Field>
                  )}
                  {false && paymentForm.entry_id
                    && paymentPreview.originalInstallmentsCount <= 1
                    && paymentForm.convert_entry_to_installments && (
                      <Field>
                        <MutedText>
                          Ao confirmar, a cobranca vira parcelada. A 1ª parcela vence na data do recebimento e sera baixada agora. As demais ficam para os meses seguintes.
                        </MutedText>
                      </Field>
                  )}
                  {paymentForm.entry_id && (
                    <Field>
                      <Label htmlFor="payment-discount">Desconto</Label>
                      <CurrencyInputGroup>
                        <CurrencyPrefix>R$</CurrencyPrefix>
                        <CurrencyInput
                          id="payment-discount"
                          name="discount"
                          value={paymentForm.discount}
                          onChange={handlePaymentChange}
                          onBlur={handlePaymentCurrencyBlur}
                          inputMode="decimal"
                          placeholder="0,00"
                        />
                      </CurrencyInputGroup>
                    </Field>
                  )}
                  {paymentForm.entry_id && (
                    <Field>
                      <Label htmlFor="payment-surcharge">Acrescimo</Label>
                      <CurrencyInputGroup>
                        <CurrencyPrefix>R$</CurrencyPrefix>
                        <CurrencyInput
                          id="payment-surcharge"
                          name="surcharge"
                          value={paymentForm.surcharge}
                          onChange={handlePaymentChange}
                          onBlur={handlePaymentCurrencyBlur}
                          inputMode="decimal"
                          placeholder="0,00"
                        />
                      </CurrencyInputGroup>
                    </Field>
                  )}
                  {!paymentForm.entry_id && (
                    <Field>
                      <Label htmlFor="payment-allocation">Destino do valor</Label>
                      <Select
                        id="payment-allocation"
                        name="allocation_mode"
                        value={paymentForm.allocation_mode}
                        onChange={handlePaymentChange}
                      >
                        <option value="credit">Guardar como credito</option>
                        <option value="auto">Quitar cobrancas automaticamente</option>
                        <option value="manual">Escolher cobrancas manualmente</option>
                      </Select>
                    </Field>
                  )}
                </FormGrid>
                {!isSimplifiedInstallmentPayment && paymentForm.entry_id && paymentPreview.originalInstallmentsCount > 1 && (
                  <MutedText>
                    Esta cobranca ja esta parcelada. Neste fluxo, registre apenas a quitacao da parcela em aberto.
                  </MutedText>
                )}
                {!isSimplifiedInstallmentPayment && paymentForm.entry_id && paymentPreview.hasAdjustment && (
                  <Field>
                    <Label htmlFor="payment-adjustment-reason">Motivo do ajuste</Label>
                    <TextArea
                      id="payment-adjustment-reason"
                      name="adjustment_reason"
                      rows="2"
                      placeholder="Descreva o motivo do desconto ou acrescimo."
                      value={paymentForm.adjustment_reason}
                      onChange={handlePaymentChange}
                    />
                  </Field>
                )}
                <Field>
                  <Label htmlFor="payment-note">Observações</Label>
                  <TextArea
                    id="payment-note"
                    name="note"
                    rows="2"
                    value={paymentForm.note}
                    onChange={handlePaymentChange}
                  />
                </Field>
                {paymentForm.entry_id && (
                  <PaymentPreviewBox>
                    <PaymentPreviewTitle>Resumo da operacao</PaymentPreviewTitle>
                    <PaymentPreviewRow>
                      <span>Valor da cobranca</span>
                      <strong>{formatCurrency(selectedChargeAmountCents)}</strong>
                    </PaymentPreviewRow>
                    {paymentPreview.discountCents > 0 && (
                      <PaymentPreviewRow>
                        <span>Desconto</span>
                        <strong>- {formatCurrency(paymentPreview.discountCents)}</strong>
                      </PaymentPreviewRow>
                    )}
                    {paymentPreview.surchargeCents > 0 && (
                      <PaymentPreviewRow>
                        <span>Acrescimo</span>
                        <strong>+ {formatCurrency(paymentPreview.surchargeCents)}</strong>
                      </PaymentPreviewRow>
                    )}
                    <PaymentPreviewDivider />
                    <PaymentPreviewRow>
                      <span>Valor final cobrado</span>
                      <strong>{formatCurrency(paymentPreview.finalChargedCents)}</strong>
                    </PaymentPreviewRow>
                    <PaymentPreviewRow>
                      <span>Valor recebido</span>
                      <strong>{formatCurrency(paymentPreview.receivedCents)}</strong>
                    </PaymentPreviewRow>
                    <PaymentPreviewDivider />
                    <PaymentPreviewRow>
                      <span>
                        {paymentPreview.creditAfterCents > 0
                          ? "Saldo em credito"
                          : "Valor pendente"}
                      </span>
                      <strong>
                        {formatCurrency(
                          paymentPreview.creditAfterCents > 0
                            ? paymentPreview.creditAfterCents
                            : paymentPreview.openAfterCents,
                        )}
                      </strong>
                    </PaymentPreviewRow>
                    {(paymentPreview.installmentsCount > 1 || paymentForm.convert_entry_to_installments) && (
                      <>
                        <PaymentPreviewRow>
                          <span>Parcelamento da cobranca</span>
                          <strong>
                            {`${paymentPreview.installmentsCount}x de ${formatCurrency(paymentPreview.installmentUnitCents)}`}
                          </strong>
                        </PaymentPreviewRow>
                        <PaymentPreviewRow>
                          <span>Status do parcelamento</span>
                          <strong>
                            {`${paymentPreview.paidInstallments}/${paymentPreview.installmentsCount} paga(s)`}
                          </strong>
                        </PaymentPreviewRow>
                      </>
                    )}
                  </PaymentPreviewBox>
                )}
                {!paymentForm.entry_id && paymentForm.allocation_mode === "manual" && (
                  <Field>
                    <Label>Escolher cobrancas</Label>
                    {openEntriesForPayment.length === 0 ? (
                      <MutedText>Sem cobrancas em aberto para este paciente.</MutedText>
                    ) : (
                      <>
                        <SimpleTable>
                          <thead>
                            <tr>
                              <th>Data</th>
                              <th>Descricao</th>
                              <th>Em aberto</th>
                              <th>Alocar</th>
                            </tr>
                          </thead>
                          <tbody>
                            {openEntriesForPayment.map((item) => (
                              <tr key={item.entry.id}>
                                <td>{item.entry.reference_date || "-"}</td>
                                <td>{item.entry.description || "-"}</td>
                                <td>{formatCurrency(item.open)}</td>
                                <td>
                                  <Input
                                    type="text"
                                    value={paymentAllocations[item.entry.id] || ""}
                                    onChange={(event) =>
                                      handleAllocationChange(item.entry.id, event.target.value)
                                    }
                                    placeholder="0,00"
                                  />
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </SimpleTable>
                        <MutedText>
                          Total distribuido: {formatCurrency(manualAllocationTotal)}
                        </MutedText>
                      </>
                    )}
                  </Field>
                )}
                </>
                )}
              </ModalBody>
              <ModalActions>
                <SecondaryButton type="button" onClick={closePaymentModal} disabled={isPaymentSaving}>
                  Cancelar
                </SecondaryButton>
                <PrimaryButton type="button" onClick={handleSavePayment} disabled={isPaymentSaving}>
                  {isPaymentSaving ? <ButtonSpinner /> : "Confirmar recebimento"}
                </PrimaryButton>
              </ModalActions>
            </ModalCard>
          </ModalOverlay>
          <Backdrop onClick={closePaymentModal} />
        </>
      )}

      {isCategoryOpen && (
        <>
          <ModalOverlay>
            <ModalCard>
              <ModalHeader>
                <div>
                  <ModalTitle>{editingCategoryId ? "Editar categoria" : "Nova categoria"}</ModalTitle>
                  <ModalSubtitle>Organize os lancamentos.</ModalSubtitle>
                </div>
                <IconButton type="button" onClick={closeCategoryModal}>
                  <FaTimes />
                </IconButton>
              </ModalHeader>
              <ModalBody>
                <FormGrid>
                  <Field>
                    <Label htmlFor="category-name">Nome</Label>
                    <Input
                      id="category-name"
                      name="name"
                      value={categoryForm.name}
                      onChange={handleCategoryChange}
                    />
                  </Field>
                  <Field>
                    <Label htmlFor="category-type">Tipo</Label>
                    <Select
                      id="category-type"
                      name="type"
                      value={categoryForm.type}
                      onChange={handleCategoryChange}
                    >
                      <option value="income">Receita</option>
                      <option value="expense">Despesa</option>
                    </Select>
                  </Field>
                  <Field>
                    <Label htmlFor="category-color">Cor (opcional)</Label>
                    <Input
                      id="category-color"
                      name="color"
                      value={categoryForm.color}
                      onChange={handleCategoryChange}
                      placeholder="#6a795c"
                    />
                  </Field>
                </FormGrid>
              </ModalBody>
              <ModalActions>
                <SecondaryButton type="button" onClick={closeCategoryModal}>
                  Cancelar
                </SecondaryButton>
                <PrimaryButton type="button" onClick={handleSaveCategory}>
                  Salvar
                </PrimaryButton>
              </ModalActions>
            </ModalCard>
          </ModalOverlay>
          <Backdrop onClick={closeCategoryModal} />
        </>
      )}

      {isMethodOpen && (
        <>
          <ModalOverlay>
            <ModalCard>
              <ModalHeader>
                <div>
                  <ModalTitle>{editingMethodId ? "Editar forma de pagamento" : "Nova forma de pagamento"}</ModalTitle>
                  <ModalSubtitle>Cadastre um metodo aceito.</ModalSubtitle>
                </div>
                <IconButton type="button" onClick={closeMethodModal}>
                  <FaTimes />
                </IconButton>
              </ModalHeader>
              <ModalBody>
                <Field>
                  <Label htmlFor="method-name">Nome</Label>
                  <Input
                    id="method-name"
                    name="name"
                    value={methodForm.name}
                    onChange={handleMethodChange}
                  />
                </Field>
              </ModalBody>
              <ModalActions>
                <SecondaryButton type="button" onClick={closeMethodModal}>
                  Cancelar
                </SecondaryButton>
                <PrimaryButton type="button" onClick={handleSaveMethod}>
                  Salvar
                </PrimaryButton>
              </ModalActions>
            </ModalCard>
          </ModalOverlay>
          <Backdrop onClick={closeMethodModal} />
        </>
      )}

      {isServiceOpen && (
        <>
          <ModalOverlay>
            <ModalCard>
              <ModalHeader>
                <div>
                  <ModalTitle>{editingServiceId ? "Editar servico" : "Novo servico"}</ModalTitle>
                  <ModalSubtitle>Gerencie nome, valor e disponibilidade.</ModalSubtitle>
                </div>
                <IconButton
                  type="button"
                  onClick={() => {
                    if (!isServiceSaving) closeServiceModal();
                  }}
                >
                  <FaTimes />
                </IconButton>
              </ModalHeader>
              <ModalBody>
                <FormGrid>
                  <Field>
                    <Label htmlFor="service-name">Nome</Label>
                    <Input
                      id="service-name"
                      name="name"
                      value={serviceForm.name}
                      onChange={handleServiceChange}
                    />
                  </Field>
                  <Field>
                    <Label htmlFor="service-price">Valor padrao</Label>
                    <Input
                      id="service-price"
                      name="price"
                      value={serviceForm.price}
                      onChange={handleServiceChange}
                      placeholder="0,00"
                    />
                  </Field>
                  <Field>
                    <Label htmlFor="service-color">Cor (opcional)</Label>
                    <ColorInput
                      id="service-color"
                      name="color"
                      type="color"
                      value={serviceForm.color || "#6a795c"}
                      onChange={handleServiceChange}
                    />
                  </Field>
                </FormGrid>
                <Loading isLoading={isServiceSaving} />
              </ModalBody>
              <ModalActions>
                <SecondaryButton type="button" onClick={closeServiceModal} disabled={isServiceSaving}>
                  Cancelar
                </SecondaryButton>
                <PrimaryButton type="button" onClick={handleSaveService} disabled={isServiceSaving}>
                  {isServiceSaving ? "Salvando..." : "Salvar"}
                </PrimaryButton>
              </ModalActions>
            </ModalCard>
          </ModalOverlay>
          <Backdrop onClick={() => {
            if (!isServiceSaving) closeServiceModal();
          }} />
        </>
      )}

      {isRecurringOpen && (
        <>
          <ModalOverlay>
            <ModalCard>
              <ModalHeader>
                <div>
                  <ModalTitle>{editingRecurringId ? "Editar despesa fixa" : "Nova despesa fixa"}</ModalTitle>
                  <ModalSubtitle>Informe os dados da despesa mensal.</ModalSubtitle>
                </div>
                <IconButton type="button" onClick={closeRecurringModal}>
                  <FaTimes />
                </IconButton>
              </ModalHeader>
              <ModalBody>
                <FormGrid>
                  <Field>
                    <Label htmlFor="recurring-name">Nome</Label>
                    <Input
                      id="recurring-name"
                      name="name"
                      value={recurringForm.name}
                      onChange={handleRecurringChange}
                    />
                  </Field>
                  <Field>
                    <Label htmlFor="recurring-amount">Valor</Label>
                    <Input
                      id="recurring-amount"
                      name="amount"
                      value={recurringForm.amount}
                      onChange={handleRecurringChange}
                      placeholder="0,00"
                    />
                  </Field>
                  <Field>
                    <Label htmlFor="recurring-day">Dia do mes</Label>
                    <Input
                      id="recurring-day"
                      name="day_of_month"
                      type="number"
                      min="1"
                      max="31"
                      value={recurringForm.day_of_month}
                      onChange={handleRecurringChange}
                    />
                  </Field>
                  <Field>
                    <Label htmlFor="recurring-category">Categoria</Label>
                    <Select
                      id="recurring-category"
                      name="category_id"
                      value={recurringForm.category_id}
                      onChange={handleRecurringChange}
                    >
                      <option value="">Selecione</option>
                      {categories.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                        </option>
                      ))}
                    </Select>
                  </Field>
                </FormGrid>
                <Field>
                  <Label htmlFor="recurring-notes">Observações</Label>
                  <TextArea
                    id="recurring-notes"
                    name="notes"
                    rows="3"
                    value={recurringForm.notes}
                    onChange={handleRecurringChange}
                  />
                </Field>
              </ModalBody>
              <ModalActions>
                <SecondaryButton type="button" onClick={closeRecurringModal}>
                  Cancelar
                </SecondaryButton>
                <PrimaryButton type="button" onClick={handleSaveRecurring}>
                  Salvar
                </PrimaryButton>
              </ModalActions>
            </ModalCard>
          </ModalOverlay>
          <Backdrop onClick={closeRecurringModal} />
        </>
      )}

      {isHolidayOpen && (
        <>
          <ModalOverlay>
            <ModalCard>
              <ModalHeader>
                <div>
                  <ModalTitle>Novo feriado</ModalTitle>
                  <ModalSubtitle>Informe apenas os dados essenciais do feriado.</ModalSubtitle>
                </div>
                <IconButton type="button" onClick={closeHolidayModal}>
                  <FaTimes />
                </IconButton>
              </ModalHeader>
              <ModalBody>
                <FormGrid>
                  <Field>
                    <Label htmlFor="holiday-name">Nome</Label>
                    <Input
                      id="holiday-name"
                      name="name"
                      placeholder="Ex.: Tiradentes"
                      value={holidayForm.name}
                      onChange={handleHolidayChange}
                    />
                  </Field>
                  <Field>
                    <Label htmlFor="holiday-date">Data</Label>
                    <Input
                      id="holiday-date"
                      type="date"
                      name="date"
                      value={holidayForm.date}
                      onChange={handleHolidayChange}
                    />
                  </Field>
                  <Field>
                    <Label htmlFor="holiday-source">Tipo</Label>
                    <Select
                      id="holiday-source"
                      name="source_type"
                      value={holidayForm.source_type}
                      onChange={handleHolidayChange}
                    >
                      {HOLIDAY_SOURCE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  {(holidayForm.source_type === "state" || holidayForm.source_type === "city") && (
                    <Field>
                      <Label htmlFor="holiday-state">UF</Label>
                      <Input
                        id="holiday-state"
                        name="state_code"
                        placeholder="SP"
                        maxLength={2}
                        value={holidayForm.state_code}
                        onChange={handleHolidayChange}
                      />
                    </Field>
                  )}
                  {holidayForm.source_type === "city" && (
                    <Field>
                      <Label htmlFor="holiday-city">Cidade</Label>
                      <Input
                        id="holiday-city"
                        name="city_name"
                        placeholder="Sao Paulo"
                        value={holidayForm.city_name}
                        onChange={handleHolidayChange}
                      />
                    </Field>
                  )}
                </FormGrid>
              </ModalBody>
              <ModalActions>
                <SecondaryButton type="button" onClick={closeHolidayModal} disabled={isHolidaySaving}>
                  Cancelar
                </SecondaryButton>
                <PrimaryButton type="button" onClick={handleSaveHoliday} disabled={isHolidaySaving}>
                  {isHolidaySaving ? <ButtonSpinner /> : "Adicionar feriado"}
                </PrimaryButton>
              </ModalActions>
            </ModalCard>
          </ModalOverlay>
          <Backdrop onClick={closeHolidayModal} />
        </>
      )}
    </Wrapper>
  );
}

const Wrapper = styled.div`
  min-height: 100vh;
  background: #f6f7f2;
  --topbar-height: ${TOPBAR_HEIGHT}px;
  --sidebar-width: ${(props) =>
    props.$collapsed ? `${SIDEBAR_COLLAPSED_WIDTH}px` : `${SIDEBAR_WIDTH}px`};
  padding-top: var(--topbar-height);
`;

const Header = styled.div`
  margin-bottom: 24px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
`;

const HeaderText = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

const Title = styled.h1`
  margin: 0 0 8px;
  color: #2b2b2b;
  font-size: 34px;
  font-weight: 800;
`;

const Subtitle = styled.p`
  margin: 0;
  color: #606060;
`;

const TabsWrapper = styled.div`
  display: flex;
  justify-content: flex-start;
  margin-bottom: 12px;
`;

const TabsRow = styled.div`
  display: inline-flex;
  gap: 6px;
  background: #fff;
  padding: 6px;
  border-radius: 999px;
  border: 1px solid rgba(0, 0, 0, 0.08);
  box-shadow: 0 8px 18px rgba(0, 0, 0, 0.06);
  flex-wrap: wrap;
`;

const TabButton = styled.button`
  border: none;
  background: ${(props) => (props.$active ? "#6a795c" : "transparent")};
  color: ${(props) => (props.$active ? "#fff" : "#4a4a4a")};
  padding: 8px 14px;
  border-radius: 999px;
  font-weight: 700;
  font-size: 14px;
`;

const Layout = styled.div`
  display: flex;
  align-items: stretch;
  width: 100%;
  min-height: calc(100vh - var(--topbar-height));
  box-sizing: border-box;
  padding-left: var(--sidebar-width);

  @media (max-width: 960px) {
    flex-direction: column;
    padding-left: 0;
  }
`;

const Sidebar = styled.aside`
  background: #fff;
  border-radius: 0 18px 18px 0;
  padding: 18px 16px;
  box-shadow: 6px 0 18px rgba(0, 0, 0, 0.04);
  display: flex;
  flex-direction: column;
  gap: 18px;
  height: calc(100vh - var(--topbar-height));
  position: fixed;
  top: var(--topbar-height);
  left: 0;
  border-right: 1px solid rgba(0, 0, 0, 0.06);
  transition: width 0.2s ease, padding 0.2s ease;
  width: var(--sidebar-width);
  z-index: 60;

  @media (max-width: 960px) {
    position: fixed;
    left: 0;
    top: var(--topbar-height);
    height: calc(100vh - var(--topbar-height));
    width: min(280px, 84vw);
    transform: translateX(${(props) => (props.$mobileOpen ? "0" : "-100%")});
    transition: transform 0.25s ease;
    z-index: 70;
    border-radius: 0 18px 18px 0;
    box-shadow: 12px 0 28px rgba(0, 0, 0, 0.18);
    border-right: none;
  }
`;

const SidebarHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;

  @media (max-width: 960px) {
    width: 100%;
  }
`;

const SidebarSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
`;

const SidebarTitle = styled.span`
  font-size: 12px;
  color: #8a8a8a;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  font-weight: 700;
  display: ${(props) => (props.$collapsed ? "none" : "block")};

  @media (max-width: 960px) {
    width: 100%;
    display: block;
  }
`;

const SidebarToggle = styled.button`
  border: 1px solid rgba(0, 0, 0, 0.1);
  background: #fff;
  color: #42523a;
  width: 36px;
  height: 36px;
  border-radius: 10px;
  display: inline-flex;
  align-items: center;
  justify-content: center;

  @media (max-width: 960px) {
    margin-left: auto;
  }
`;

const SidebarButton = styled.button`
  border: 1px solid ${(props) => (props.$active ? "#6a795c" : "rgba(0,0,0,0.1)")};
  background: ${(props) => (props.$active ? "#6a795c" : "#fff")};
  color: ${(props) => (props.$active ? "#fff" : "#2b2b2b")};
  padding: 10px 14px;
  border-radius: 12px;
  font-weight: 700;
  text-align: left;
  width: 100%;
  display: flex;
  align-items: center;
  gap: 10px;
  justify-content: ${(props) => (props.$collapsed ? "center" : "flex-start")};

  @media (max-width: 960px) {
    width: 100%;
    justify-content: flex-start;
  }
`;

const SidebarIcon = styled.span`
  display: inline-flex;
  align-items: center;
  font-size: 16px;
  color: ${(props) => (props.$active ? "#fff" : "#6a795c")};
`;

const SidebarLabel = styled.span`
  display: ${(props) => (props.$collapsed ? "none" : "inline")};

  @media (max-width: 960px) {
    display: inline;
  }
`;

const MobileMenuButton = styled.button`
  display: none;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  border-radius: 12px;
  border: 1px solid rgba(0, 0, 0, 0.12);
  background: #fff;
  color: #2b2b2b;
  font-weight: 700;

  @media (max-width: 960px) {
    display: inline-flex;
  }
`;

const SidebarOverlay = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.35);
  z-index: 40;
`;

const MainArea = styled.div`
  display: flex;
  flex-direction: column;
  gap: 24px;
  flex: 1;
  padding: 24px 32px 64px;
  min-width: 0;

  @media (max-width: 960px) {
    padding: 24px 20px 64px;
  }
`;

const Section = styled.section`
  background: #fff;
  border-radius: 18px;
  padding: 24px;
  box-shadow: 0 12px 28px rgba(0, 0, 0, 0.06);
`;

const Panel = styled.div`
  background: #f7f8f4;
  border-radius: 16px;
  padding: ${(props) => (props.$compact ? "14px" : "18px")};
  border: 1px solid rgba(0, 0, 0, 0.06);
  margin-bottom: 16px;
`;

const PanelHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${(props) => (props.$compact ? "8px" : "12px")};
  margin-bottom: ${(props) => (props.$compact ? "10px" : "12px")};
  flex-wrap: wrap;
`;

const PanelTitle = styled.h3`
  margin: 0;
  font-size: ${(props) => (props.$compact ? "14px" : "16px")};
  color: #2b2b2b;
`;

const AttendancePeriodMonthInput = styled.input`
  position: absolute;
  width: 0;
  height: 0;
  inset: auto;
  opacity: 0;
  pointer-events: none;
`;

const AttendancePeriodYearSelect = styled.select`
  position: absolute;
  inset: 0;
  opacity: 0;
  cursor: pointer;
`;

const SectionHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  margin-bottom: 20px;
`;

const HeaderActions = styled.div`
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
`;

const SectionTitle = styled.h2`
  margin: 0;
  font-size: 22px;
  color: #2b2b2b;
`;

const SectionSubtitle = styled.p`
  margin: 4px 0 0;
  color: #6b6b6b;
`;

const FiltersRow = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(${(props) => (props.$compact ? "160px" : "180px")}, 1fr));
  gap: ${(props) => (props.$compact ? "10px" : "12px")};
  margin-bottom: ${(props) => (props.$compact ? "10px" : "16px")};
`;

const FilterField = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
`;

const EntriesTable = styled.table`
  width: 100%;
  border-collapse: collapse;

  th,
  td {
    padding: 12px 8px;
    border-bottom: 1px solid rgba(0, 0, 0, 0.08);
    text-align: left;
    font-size: 14px;
  }

  th {
    font-weight: 700;
    color: #555;
  }
`;

const SimpleTable = styled.table`
  width: 100%;
  border-collapse: collapse;

  th,
  td {
    padding: 12px 8px;
    border-bottom: 1px solid rgba(0, 0, 0, 0.08);
    text-align: left;
    font-size: 14px;
  }

  th {
    font-weight: 700;
    color: #555;
  }
`;

const TableScroll = styled.div`
  width: 100%;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
`;

const PatientSummaryRow = styled.tr`
  &&& td {
    transition: background 140ms ease, border-color 140ms ease, box-shadow 140ms ease;
  }

  ${(props) =>
    props.$hasOpen
      ? `
        &&& td {
          background: ${ATTENDANCE_UI.colors.dangerSoft};
          border-bottom-color: ${ATTENDANCE_UI.colors.dangerBorder};
        }

        &&& td:first-child {
          box-shadow: inset 4px 0 0 ${ATTENDANCE_UI.colors.dangerAccent};
        }

        &&&:hover td {
          background: ${ATTENDANCE_UI.colors.dangerSoftHover};
        }
      `
      : ""}
`;

const AttendanceTable = styled.table`
  width: 100%;
  min-width: 1220px;
  border-collapse: collapse;

  th,
  td {
    padding: 12px 8px;
    border-bottom: 1px solid rgba(0, 0, 0, 0.08);
    text-align: left;
    font-size: 13px;
    vertical-align: top;
  }

  th {
    font-weight: 700;
    color: #555;
  }
`;

const StatusPill = styled.span`
  display: inline-block;
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  background: ${(props) => {
    if (props.$status === "paid") return "#e6efe0";
    if (props.$status === "partial") return "#eef2ff";
    if (props.$status === "canceled") return "#f3f3f3";
    return "#f6ece3";
  }};
  color: ${(props) => {
    if (props.$status === "paid") return "#4f6b45";
    if (props.$status === "partial") return "#4257a6";
    if (props.$status === "canceled") return "#6b6b6b";
    return "#9a6a3a";
  }};
`;

const TypePill = styled.span`
  display: inline-flex;
  align-items: center;
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 700;
  background: ${(props) => (props.$type === "income" ? "#e3f1e0" : "#f7e7dc")};
  color: ${(props) => (props.$type === "income" ? "#4f6b45" : "#9a6a3a")};
`;

const ColorRow = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 8px;
`;

const ColorDot = styled.span`
  width: 10px;
  height: 10px;
  border-radius: 50%;
  display: inline-block;
`;

const RowActions = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
`;

const ActionMenu = styled.details.attrs({
  "data-action-menu": "true",
})`
  position: relative;
  --action-menu-top: 0px;
  --action-menu-left: 0px;
`;

const ActionMenuTrigger = styled.summary`
  list-style: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 84px;
  background: #eef2e9;
  border: 1px solid rgba(106, 121, 92, 0.35);
  color: #46533f;
  padding: 6px 10px;
  border-radius: 10px;
  font-weight: 600;
  font-size: 12px;
  cursor: pointer;

  &::-webkit-details-marker {
    display: none;
  }
`;

const ActionMenuList = styled.div.attrs({
  "data-action-menu-list": "true",
})`
  position: fixed;
  left: var(--action-menu-left);
  top: var(--action-menu-top);
  min-width: 190px;
  display: grid;
  gap: 6px;
  padding: 8px;
  border-radius: 12px;
  background: #fff;
  border: 1px solid rgba(0, 0, 0, 0.08);
  box-shadow: 0 14px 28px rgba(0, 0, 0, 0.12);
  z-index: 3000;
`;

const ActionMenuItem = styled.button`
  width: 100%;
  border: none;
  background: #f6f8f2;
  color: #364030;
  padding: 9px 10px;
  border-radius: 10px;
  font-size: 12px;
  font-weight: 600;
  text-align: left;
  cursor: pointer;

  &:hover {
    background: #e8eee0;
  }
`;

const CellStack = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

const MutedText = styled.span`
  font-size: 12px;
  color: #7a7a7a;
`;

const SmallButton = styled.button`
  background: #eef2e9;
  border: 1px solid rgba(106, 121, 92, 0.35);
  color: #46533f;
  padding: 6px 10px;
  border-radius: 10px;
  font-weight: 600;
  font-size: 12px;
  cursor: pointer;
  transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease;

  &:hover {
    background: #e1e7da;
    border-color: rgba(106, 121, 92, 0.6);
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;

const PrimaryButton = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: #6a795c;
  color: #fff;
  border: none;
  padding: 10px 16px;
  border-radius: 12px;
  font-weight: 700;
  cursor: pointer;
  transition: background 0.15s ease, transform 0.15s ease;

  &:hover {
    background: #5a684e;
  }

  &:disabled {
    opacity: 0.7;
    cursor: not-allowed;
  }
`;

const GhostButton = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: #f0f3ec;
  color: #4f6b45;
  border: 1px solid rgba(106, 121, 92, 0.35);
  padding: ${(props) => (props.$small ? "8px 12px" : "10px 16px")};
  border-radius: 12px;
  font-weight: 700;
  font-size: ${(props) => (props.$small ? "12px" : "14px")};
  cursor: pointer;
  transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease;

  &:hover {
    background: #e6ebe0;
    border-color: rgba(106, 121, 92, 0.6);
  }

  &:disabled {
    opacity: 0.7;
    cursor: not-allowed;
  }
`;

const SecondaryButton = styled.button`
  background: #f2f2f2;
  color: #333;
  border: 1px solid rgba(0, 0, 0, 0.1);
  padding: 10px 16px;
  border-radius: 12px;
  font-weight: 700;
  cursor: pointer;
  transition: background 0.15s ease, border-color 0.15s ease;

  &:hover {
    background: #e6e6e6;
    border-color: rgba(0, 0, 0, 0.2);
  }

  &:disabled {
    opacity: 0.7;
    cursor: not-allowed;
  }
`;

const EmptyState = styled.div`
  padding: 24px;
  text-align: center;
  color: #6d6d6d;
`;

const SectionLoader = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 32px 16px;
  color: #6a795c;
  font-weight: 600;
`;

const Spinner = styled.span`
  width: 18px;
  height: 18px;
  border-radius: 999px;
  border: 2px solid rgba(106, 121, 92, 0.35);
  border-top-color: #6a795c;
  animation: spin 0.8s linear infinite;

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
`;

const ButtonSpinner = styled(Spinner)`
  width: 16px;
  height: 16px;
  border-color: rgba(255, 255, 255, 0.35);
  border-top-color: #fff;
`;

const SummaryGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(${(props) => (props.$compact ? "150px" : "180px")}, 1fr));
  gap: ${(props) => (props.$compact ? "10px" : "14px")};
  margin-bottom: ${(props) => (props.$compact ? "10px" : "18px")};
`;

const SummaryCard = styled.div`
  padding: ${(props) => (props.$compact ? "12px" : "16px")};
  border-radius: ${(props) => (props.$compact ? "12px" : "14px")};
  background: #f5f7f1;
  border: 1px solid rgba(0, 0, 0, 0.08);
`;

const SummaryLabel = styled.div`
  font-size: 12px;
  color: #6b6b6b;
  text-transform: uppercase;
  letter-spacing: 0.04em;
`;

const SummaryValue = styled.div`
  margin-top: 6px;
  font-size: ${(props) => (props.$compact ? "17px" : "20px")};
  font-weight: 800;
  color: #2b2b2b;
`;

const AttendanceSectionSurface = styled(Section)`
  background: ${ATTENDANCE_UI.colors.background};
  border: 1px solid ${ATTENDANCE_UI.colors.border};
  border-radius: ${ATTENDANCE_UI.radius.xl};
  box-shadow: none;
`;

const AttendanceSectionHeader = styled(SectionHeader)`
  margin-bottom: ${ATTENDANCE_UI.spacing[3]};
  align-items: flex-start;
`;

const AttendanceHeadingTitle = styled(SectionTitle)`
  font-size: ${ATTENDANCE_UI.font.size.lg};
  line-height: ${ATTENDANCE_UI.font.lineHeight.lg};
  font-weight: ${ATTENDANCE_UI.font.weight.semibold};
  color: ${ATTENDANCE_UI.colors.textPrimary};
  letter-spacing: -0.01em;
`;

const AttendanceHeadingSubtitle = styled(SectionSubtitle)`
  margin-top: ${ATTENDANCE_UI.spacing[1]};
  max-width: 720px;
  font-size: ${ATTENDANCE_UI.font.size.md};
  line-height: ${ATTENDANCE_UI.font.lineHeight.md};
  color: ${ATTENDANCE_UI.colors.textSecondary};
`;

const AttendanceHeaderActions = styled(HeaderActions)`
  gap: ${ATTENDANCE_UI.spacing[1]};
`;

const AttendanceGhostAction = styled(GhostButton)`
  background: ${ATTENDANCE_UI.colors.surface};
  color: ${ATTENDANCE_UI.colors.textSecondary};
  border: 1px solid ${ATTENDANCE_UI.colors.borderStrong};
  border-radius: ${ATTENDANCE_UI.radius.md};
  padding: 10px 14px;
  font-size: ${ATTENDANCE_UI.font.size.sm};
  font-weight: ${ATTENDANCE_UI.font.weight.medium};
  box-shadow: none;

  &:hover {
    background: ${ATTENDANCE_UI.colors.surfaceMuted};
    border-color: ${ATTENDANCE_UI.colors.borderStrong};
    color: ${ATTENDANCE_UI.colors.textPrimary};
  }
`;

const AttendancePrimaryAction = styled(PrimaryButton)`
  background: ${ATTENDANCE_UI.colors.action};
  border-radius: ${ATTENDANCE_UI.radius.md};
  padding: 10px 16px;
  font-size: ${ATTENDANCE_UI.font.size.sm};
  font-weight: ${ATTENDANCE_UI.font.weight.semibold};
  box-shadow: none;

  &:hover {
    background: ${ATTENDANCE_UI.colors.actionHover};
  }
`;

const AttendanceCard = styled.div`
  background: ${ATTENDANCE_UI.colors.surface};
  border: 1px solid ${ATTENDANCE_UI.colors.border};
  border-radius: ${ATTENDANCE_UI.radius.lg};
  padding: ${ATTENDANCE_UI.spacing[2]};
  margin-bottom: ${ATTENDANCE_UI.spacing[2]};
`;

const AttendanceCardHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${ATTENDANCE_UI.spacing[1]};
  margin-bottom: ${ATTENDANCE_UI.spacing[2]};
  flex-wrap: wrap;
`;

const AttendanceCardTitle = styled.h3`
  margin: 0;
  font-size: ${ATTENDANCE_UI.font.size.sm};
  line-height: ${ATTENDANCE_UI.font.lineHeight.sm};
  font-weight: ${ATTENDANCE_UI.font.weight.semibold};
  color: ${ATTENDANCE_UI.colors.textPrimary};
`;

const AttendanceMetricsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(176px, 1fr));
  gap: ${ATTENDANCE_UI.spacing[2]};
`;

const AttendanceMetricCard = styled.div`
  padding: ${ATTENDANCE_UI.spacing[2]};
  border-radius: ${ATTENDANCE_UI.radius.md};
  border: 1px solid ${ATTENDANCE_UI.colors.border};
  background: ${ATTENDANCE_UI.colors.surfaceMuted};
`;

const AttendanceMetricLabel = styled.span`
  display: block;
  color: ${ATTENDANCE_UI.colors.textTertiary};
  font-size: ${ATTENDANCE_UI.font.size.xs};
  line-height: ${ATTENDANCE_UI.font.lineHeight.xs};
  font-weight: ${ATTENDANCE_UI.font.weight.medium};
  text-transform: uppercase;
  letter-spacing: 0.05em;
`;

const AttendanceMetricValue = styled.strong`
  display: block;
  margin-top: ${ATTENDANCE_UI.spacing[1]};
  color: ${ATTENDANCE_UI.colors.textPrimary};
  font-size: ${ATTENDANCE_UI.font.size.lg};
  line-height: ${ATTENDANCE_UI.font.lineHeight.lg};
  font-weight: ${ATTENDANCE_UI.font.weight.semibold};
`;

const AttendanceFilterGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: ${ATTENDANCE_UI.spacing[2]};
`;

const AttendanceFilterField = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${ATTENDANCE_UI.spacing[1]};
`;

const AttendanceFilterLabel = styled.label`
  color: ${ATTENDANCE_UI.colors.textSecondary};
  font-size: ${ATTENDANCE_UI.font.size.xs};
  line-height: ${ATTENDANCE_UI.font.lineHeight.xs};
  font-weight: ${ATTENDANCE_UI.font.weight.medium};
  letter-spacing: 0.03em;
  text-transform: uppercase;
`;

const AttendanceFilterInput = styled.input`
  height: 44px;
  border-radius: ${ATTENDANCE_UI.radius.md};
  border: 1px solid ${ATTENDANCE_UI.colors.borderStrong};
  background: ${ATTENDANCE_UI.colors.surface};
  color: ${ATTENDANCE_UI.colors.textPrimary};
  padding: 0 14px;
  font-size: ${ATTENDANCE_UI.font.size.md};
  box-shadow: none;

  &::placeholder {
    color: ${ATTENDANCE_UI.colors.textMuted};
  }

  &:focus {
    outline: none;
    border-color: ${ATTENDANCE_UI.colors.action};
    box-shadow: 0 0 0 3px rgba(95, 121, 87, 0.12);
  }
`;

const AttendanceFilterSelect = styled.select`
  height: 44px;
  border-radius: ${ATTENDANCE_UI.radius.md};
  border: 1px solid ${ATTENDANCE_UI.colors.borderStrong};
  background: ${ATTENDANCE_UI.colors.surface};
  color: ${ATTENDANCE_UI.colors.textPrimary};
  padding: 0 14px;
  font-size: ${ATTENDANCE_UI.font.size.md};
  box-shadow: none;

  &:focus {
    outline: none;
    border-color: ${ATTENDANCE_UI.colors.action};
    box-shadow: 0 0 0 3px rgba(95, 121, 87, 0.12);
  }
`;

const AttendanceFilterMeta = styled.div`
  margin-top: ${ATTENDANCE_UI.spacing[2]};
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${ATTENDANCE_UI.spacing[1]};
  flex-wrap: wrap;
`;

const AttendanceFilterMetaText = styled.p`
  margin: 0;
  color: ${ATTENDANCE_UI.colors.textSecondary};
  font-size: ${ATTENDANCE_UI.font.size.sm};
  line-height: ${ATTENDANCE_UI.font.lineHeight.sm};

  strong {
    color: ${ATTENDANCE_UI.colors.textPrimary};
    font-weight: ${ATTENDANCE_UI.font.weight.semibold};
  }
`;

const AttendanceClearAction = styled(AttendanceGhostAction)`
  padding: 8px 12px;
  font-size: ${ATTENDANCE_UI.font.size.xs};
`;

const AttendanceControlsRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${ATTENDANCE_UI.spacing[2]};
  flex-wrap: wrap;
  margin-bottom: ${ATTENDANCE_UI.spacing[2]};
`;

const AttendanceTabsRow = styled.div`
  display: flex;
  align-items: center;
  gap: ${ATTENDANCE_UI.spacing[1]};
  flex-wrap: wrap;
`;

const AttendanceTabGroup = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px;
  border-radius: ${ATTENDANCE_UI.radius.xl};
  background: ${ATTENDANCE_UI.colors.surfaceMuted};
  border: 1px solid ${ATTENDANCE_UI.colors.border};
`;

const AttendanceTabButton = styled.button`
  border: none;
  border-radius: ${ATTENDANCE_UI.radius.xl};
  padding: 10px 14px;
  background: ${(props) => (props.$active ? ATTENDANCE_UI.colors.action : "transparent")};
  color: ${(props) => (props.$active ? "#fff" : ATTENDANCE_UI.colors.textSecondary)};
  font-size: ${ATTENDANCE_UI.font.size.sm};
  line-height: ${ATTENDANCE_UI.font.lineHeight.sm};
  font-weight: ${(props) =>
    props.$active ? ATTENDANCE_UI.font.weight.semibold : ATTENDANCE_UI.font.weight.medium};
  cursor: pointer;
  transition: background 120ms ease, color 120ms ease, opacity 120ms ease;

  &:hover:not(:disabled) {
    background: ${(props) =>
      props.$active ? ATTENDANCE_UI.colors.actionHover : ATTENDANCE_UI.colors.neutralSoft};
    color: ${(props) => (props.$active ? "#fff" : ATTENDANCE_UI.colors.textPrimary)};
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.45;
  }
`;

const AttendancePeriodControls = styled.div`
  display: inline-flex;
  align-items: center;
  gap: ${ATTENDANCE_UI.spacing[1]};
  flex-wrap: wrap;
`;

const AttendancePeriodButton = styled.button`
  border: 1px solid ${ATTENDANCE_UI.colors.borderStrong};
  background: ${ATTENDANCE_UI.colors.surface};
  color: ${ATTENDANCE_UI.colors.textSecondary};
  border-radius: ${ATTENDANCE_UI.radius.pill};
  padding: 8px 12px;
  font-size: ${ATTENDANCE_UI.font.size.xs};
  line-height: ${ATTENDANCE_UI.font.lineHeight.xs};
  font-weight: ${ATTENDANCE_UI.font.weight.medium};
  cursor: pointer;
  transition: background 120ms ease, border-color 120ms ease, color 120ms ease;

  &:hover {
    background: ${ATTENDANCE_UI.colors.surfaceMuted};
    border-color: ${ATTENDANCE_UI.colors.borderStrong};
    color: ${ATTENDANCE_UI.colors.textPrimary};
  }
`;

const AttendancePeriodChip = styled.div`
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 8px 14px;
  border-radius: ${ATTENDANCE_UI.radius.pill};
  border: 1px solid ${ATTENDANCE_UI.colors.borderStrong};
  background: ${ATTENDANCE_UI.colors.surface};
  color: ${ATTENDANCE_UI.colors.textPrimary};
  font-size: ${ATTENDANCE_UI.font.size.sm};
  line-height: ${ATTENDANCE_UI.font.lineHeight.sm};
  font-weight: ${ATTENDANCE_UI.font.weight.semibold};
  cursor: pointer;
`;

const AttendancePatientStrip = styled.div`
  margin-bottom: ${ATTENDANCE_UI.spacing[2]};
  padding: 12px 14px;
  border-radius: ${ATTENDANCE_UI.radius.md};
  background: ${ATTENDANCE_UI.colors.surfaceMuted};
  border: 1px solid ${ATTENDANCE_UI.colors.border};
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${ATTENDANCE_UI.spacing[1]};
  flex-wrap: wrap;
`;

const AttendancePatientName = styled.strong`
  color: ${ATTENDANCE_UI.colors.textPrimary};
  font-size: ${ATTENDANCE_UI.font.size.xl};
  line-height: ${ATTENDANCE_UI.font.lineHeight.xl};
  font-weight: ${ATTENDANCE_UI.font.weight.semibold};
`;

const AttendancePatientStats = styled.div`
  display: flex;
  align-items: center;
  gap: ${ATTENDANCE_UI.spacing[1]};
  flex-wrap: wrap;
`;

const AttendancePatientStat = styled.span`
  display: inline-flex;
  align-items: center;
  gap: ${ATTENDANCE_UI.spacing[1]};
  padding: 8px 12px;
  border-radius: ${ATTENDANCE_UI.radius.pill};
  background: ${ATTENDANCE_UI.colors.surface};
  border: 1px solid ${ATTENDANCE_UI.colors.border};

  span {
    color: ${ATTENDANCE_UI.colors.textTertiary};
    font-size: ${ATTENDANCE_UI.font.size.xs};
    line-height: ${ATTENDANCE_UI.font.lineHeight.xs};
    font-weight: ${ATTENDANCE_UI.font.weight.medium};
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  strong {
    color: ${ATTENDANCE_UI.colors.textPrimary};
    font-size: ${ATTENDANCE_UI.font.size.sm};
    line-height: ${ATTENDANCE_UI.font.lineHeight.sm};
    font-weight: ${ATTENDANCE_UI.font.weight.semibold};
  }
`;

const AttendanceDetailHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${ATTENDANCE_UI.spacing[1]};
  margin-bottom: ${ATTENDANCE_UI.spacing[2]};
`;

const AttendanceDetailTitle = styled.h3`
  margin: 0;
  color: ${ATTENDANCE_UI.colors.textPrimary};
  font-size: ${ATTENDANCE_UI.font.size.lg};
  line-height: ${ATTENDANCE_UI.font.lineHeight.lg};
  font-weight: ${ATTENDANCE_UI.font.weight.semibold};
`;

const AttendanceTableCard = styled.div`
  background: ${ATTENDANCE_UI.colors.surface};
  border: 1px solid ${ATTENDANCE_UI.colors.border};
  border-radius: ${ATTENDANCE_UI.radius.lg};
  overflow: hidden;
`;

const AttendanceTableScroll = styled(TableScroll)`
  background: ${ATTENDANCE_UI.colors.surface};
`;

const AttendanceOverviewTable = styled(SimpleTable)`
  th,
  td {
    padding: 18px 16px;
    border-bottom: 1px solid ${ATTENDANCE_UI.colors.border};
    vertical-align: middle;
  }

  th {
    background: ${ATTENDANCE_UI.colors.surfaceMuted};
    color: ${ATTENDANCE_UI.colors.textTertiary};
    font-size: ${ATTENDANCE_UI.font.size.xs};
    line-height: ${ATTENDANCE_UI.font.lineHeight.xs};
    font-weight: ${ATTENDANCE_UI.font.weight.medium};
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }

  tbody tr:nth-child(even) td {
    background: ${ATTENDANCE_UI.colors.rowStripe};
  }

  tbody tr:hover td {
    background: ${ATTENDANCE_UI.colors.rowHover};
  }

  th:last-child,
  td:last-child {
    text-align: right;
  }
`;

const AttendanceDataTable = styled(AttendanceTable)`
  min-width: 1220px;

  th,
  td {
    padding: 18px 16px;
    border-bottom: 1px solid ${ATTENDANCE_UI.colors.border};
  }

  th {
    background: ${ATTENDANCE_UI.colors.surfaceMuted};
    color: ${ATTENDANCE_UI.colors.textTertiary};
    font-size: ${ATTENDANCE_UI.font.size.xs};
    line-height: ${ATTENDANCE_UI.font.lineHeight.xs};
    font-weight: ${ATTENDANCE_UI.font.weight.medium};
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }

  tbody tr:nth-child(even) td {
    background: ${ATTENDANCE_UI.colors.rowStripe};
  }

  tbody tr:hover td {
    background: ${ATTENDANCE_UI.colors.rowHover};
  }

  th:last-child,
  td:last-child {
    text-align: right;
  }
`;

const AttendanceCellStack = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
`;

const AttendancePrimaryText = styled.span`
  color: ${ATTENDANCE_UI.colors.textPrimary};
  font-size: ${ATTENDANCE_UI.font.size.md};
  line-height: ${ATTENDANCE_UI.font.lineHeight.md};
  font-weight: ${ATTENDANCE_UI.font.weight.medium};
`;

const AttendancePatientSummaryName = styled(AttendancePrimaryText)`
  position: relative;
  display: inline-flex;
  align-items: center;
  padding-left: ${(props) => (props.$hasOpen ? "14px" : "0")};
  font-weight: ${(props) =>
    props.$hasOpen ? ATTENDANCE_UI.font.weight.semibold : ATTENDANCE_UI.font.weight.medium};

  &::before {
    content: "";
    display: ${(props) => (props.$hasOpen ? "block" : "none")};
    position: absolute;
    left: 0;
    top: 50%;
    width: 6px;
    height: 18px;
    border-radius: ${ATTENDANCE_UI.radius.pill};
    transform: translateY(-50%);
    background: ${ATTENDANCE_UI.colors.dangerAccent};
    box-shadow: 0 0 0 4px rgba(209, 106, 86, 0.12);
  }
`;

const AttendanceSecondaryText = styled.span`
  color: ${ATTENDANCE_UI.colors.textTertiary};
  font-size: ${ATTENDANCE_UI.font.size.sm};
  line-height: ${ATTENDANCE_UI.font.lineHeight.sm};
  font-weight: ${ATTENDANCE_UI.font.weight.regular};
`;

const AttendanceMoneyText = styled.strong`
  color: ${ATTENDANCE_UI.colors.textPrimary};
  font-size: ${ATTENDANCE_UI.font.size.md};
  line-height: ${ATTENDANCE_UI.font.lineHeight.md};
  font-weight: ${ATTENDANCE_UI.font.weight.semibold};
`;

const AttendanceOpenAmountValue = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: ${(props) => (props.$hasOpen ? "32px" : "auto")};
  padding: ${(props) => (props.$hasOpen ? "6px 10px" : "0")};
  border-radius: ${ATTENDANCE_UI.radius.pill};
  border: 1px solid
    ${(props) => (props.$hasOpen ? ATTENDANCE_UI.colors.dangerBorder : "transparent")};
  background: ${(props) => (props.$hasOpen ? ATTENDANCE_UI.colors.surface : "transparent")};
  color: ${(props) =>
    props.$hasOpen ? ATTENDANCE_UI.colors.dangerText : ATTENDANCE_UI.colors.textPrimary};
  font-size: ${ATTENDANCE_UI.font.size.md};
  line-height: ${ATTENDANCE_UI.font.lineHeight.md};
  font-weight: ${ATTENDANCE_UI.font.weight.semibold};
  box-shadow: ${(props) =>
    props.$hasOpen ? "inset 0 1px 0 rgba(255, 255, 255, 0.7)" : "none"};
`;

const AttendanceStatusBadge = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 6px 12px;
  border-radius: ${ATTENDANCE_UI.radius.pill};
  font-size: ${ATTENDANCE_UI.font.size.xs};
  line-height: ${ATTENDANCE_UI.font.lineHeight.xs};
  font-weight: ${ATTENDANCE_UI.font.weight.semibold};
  letter-spacing: 0.04em;
  text-transform: uppercase;
  background: ${(props) => {
    if (props.$status === "credit") return ATTENDANCE_UI.colors.actionSoft;
    if (props.$status === "paid" || props.$status === "done") return ATTENDANCE_UI.colors.successSoft;
    if (props.$status === "partial") return ATTENDANCE_UI.colors.infoSoft;
    return ATTENDANCE_UI.colors.neutralSoft;
  }};
  color: ${(props) => {
    if (props.$status === "credit") return ATTENDANCE_UI.colors.action;
    if (props.$status === "paid" || props.$status === "done") return ATTENDANCE_UI.colors.successText;
    if (props.$status === "partial") return ATTENDANCE_UI.colors.infoText;
    return ATTENDANCE_UI.colors.neutralText;
  }};
`;

const AttendanceOriginBadge = styled.span`
  display: inline-flex;
  align-items: center;
  width: fit-content;
  padding: 4px 10px;
  border-radius: ${ATTENDANCE_UI.radius.pill};
  background: ${ATTENDANCE_UI.colors.neutralSoft};
  color: ${ATTENDANCE_UI.colors.textSecondary};
  font-size: ${ATTENDANCE_UI.font.size.xs};
  line-height: ${ATTENDANCE_UI.font.lineHeight.xs};
  font-weight: ${ATTENDANCE_UI.font.weight.semibold};
  letter-spacing: 0.04em;
  text-transform: uppercase;
`;

const AttendanceRowActions = styled(RowActions)`
  width: 100%;
  justify-content: flex-end;
`;

const AttendanceActionList = styled(ActionMenuList)`
  border-radius: ${ATTENDANCE_UI.radius.md};
  border: 1px solid ${ATTENDANCE_UI.colors.border};
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.08);
`;

const AttendanceActionItem = styled(ActionMenuItem)`
  background: ${ATTENDANCE_UI.colors.surfaceMuted};
  color: ${ATTENDANCE_UI.colors.textPrimary};
  border-radius: ${ATTENDANCE_UI.radius.sm};
  font-size: ${ATTENDANCE_UI.font.size.sm};
  line-height: ${ATTENDANCE_UI.font.lineHeight.sm};
  font-weight: ${ATTENDANCE_UI.font.weight.medium};

  &:hover {
    background: ${ATTENDANCE_UI.colors.neutralSoft};
  }
`;

const AttendanceSmallAction = styled(SmallButton)`
  background: ${ATTENDANCE_UI.colors.surface};
  color: ${ATTENDANCE_UI.colors.textSecondary};
  border: 1px solid ${ATTENDANCE_UI.colors.borderStrong};
  border-radius: ${ATTENDANCE_UI.radius.md};
  padding: 8px 12px;
  font-size: ${ATTENDANCE_UI.font.size.xs};
  line-height: ${ATTENDANCE_UI.font.lineHeight.xs};
  font-weight: ${ATTENDANCE_UI.font.weight.medium};

  &:hover {
    background: ${ATTENDANCE_UI.colors.surfaceMuted};
    color: ${ATTENDANCE_UI.colors.textPrimary};
    border-color: ${ATTENDANCE_UI.colors.borderStrong};
  }
`;

const AttendanceNoteText = styled.div`
  min-width: 220px;
  max-width: 260px;
  white-space: normal;
  word-break: break-word;
  color: ${ATTENDANCE_UI.colors.textTertiary};
  font-size: ${ATTENDANCE_UI.font.size.sm};
  line-height: ${ATTENDANCE_UI.font.lineHeight.sm};
`;

const AttendanceEmptyState = styled(EmptyState)`
  background: ${ATTENDANCE_UI.colors.surface};
  border: 1px dashed ${ATTENDANCE_UI.colors.borderStrong};
  border-radius: ${ATTENDANCE_UI.radius.md};
  color: ${ATTENDANCE_UI.colors.textTertiary};
`;

const ReportGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 16px;
`;

const ReportCard = styled.div`
  padding: 18px;
  border-radius: 16px;
  background: #f5f7f1;
  border: 1px solid rgba(0, 0, 0, 0.08);

  h4 {
    margin: 0 0 8px;
    font-size: 16px;
    color: #2b2b2b;
  }

  p {
    margin: 0 0 14px;
    color: #6b6b6b;
    font-size: 14px;
  }
`;

const ModalOverlay = styled.div`
  position: fixed;
  inset: 0;
  display: flex;
  justify-content: center;
  align-items: flex-start;
  padding: max(14px, env(safe-area-inset-top)) 16px 14px;
  overflow-y: auto;
  z-index: 2000;
`;

const ModalCard = styled.div`
  width: min(720px, calc(100vw - 32px));
  max-height: calc(100dvh - 28px);
  background: #fff;
  border-radius: 20px;
  padding: 24px;
  box-shadow: 0 18px 45px rgba(0, 0, 0, 0.15);
  z-index: 2001;
  display: flex;
  flex-direction: column;
  overflow: hidden;

  @media (max-width: 760px) {
    width: 100%;
    max-height: calc(100dvh - 16px);
    border-radius: 14px;
    padding: 16px;
  }
`;

const ModalHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
  margin-bottom: 20px;
`;

const ModalTitle = styled.h3`
  margin: 0;
  font-size: 20px;
`;

const ModalSubtitle = styled.p`
  margin: 4px 0 0;
  color: #6d6d6d;
`;

const ModalBody = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  padding-right: 4px;
  margin-right: -4px;
`;

const PaymentPreviewBox = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 14px 16px;
  border-radius: 12px;
  border: 1px solid rgba(106, 121, 92, 0.25);
  background: rgba(106, 121, 92, 0.08);
`;

const PaymentPreviewTitle = styled.h4`
  margin: 0;
  font-size: 14px;
  color: #2f3b26;
  text-transform: uppercase;
  letter-spacing: 0.04em;
`;

const PaymentPreviewRow = styled.div`
  display: flex;
  justify-content: space-between;
  gap: 10px;
  font-size: 14px;
  color: #2f2f2f;
`;

const PaymentPreviewDivider = styled.div`
  height: 1px;
  background: rgba(47, 59, 38, 0.14);
  margin: 2px 0;
`;

const ChargeAmountBanner = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;
  padding: 10px 12px;
  border-radius: 10px;
  border: 1px solid rgba(106, 121, 92, 0.25);
  background: #f4f7f1;
  color: #355325;
  font-weight: 600;
`;

const ModalActions = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 14px;
  padding-top: 12px;
  border-top: 1px solid rgba(0, 0, 0, 0.08);
  flex-shrink: 0;
`;

const IconButton = styled.button`
  border: none;
  background: transparent;
  font-size: 18px;
  color: #4a4a4a;
`;

const FormGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 16px;
`;

const Field = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
`;

const Label = styled.label`
  font-weight: 600;
  color: #4a4a4a;
`;

const NestedField = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 8px;
`;

const InstallmentInlineField = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
`;

const InstallmentInlineLabel = styled.label`
  font-size: 14px;
  font-weight: 600;
  color: #4a4a4a;
`;

const InlineCheckLabel = styled.label`
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  color: #4a4a4a;
  cursor: pointer;

  input {
    width: 16px;
    height: 16px;
  }
`;

const Input = styled.input`
  padding: 10px 12px;
  border-radius: 10px;
  border: 1px solid rgba(0, 0, 0, 0.15);
`;

const InstallmentCountInput = styled(Input)`
  width: 84px;
  min-width: 84px;
  padding: 8px 10px;
  text-align: center;
`;

const CurrencyInputGroup = styled.div`
  display: flex;
  align-items: center;
  border: 1px solid rgba(0, 0, 0, 0.15);
  border-radius: 10px;
  background: #fff;
  overflow: hidden;
`;

const CurrencyPrefix = styled.span`
  padding: 0 10px;
  font-weight: 700;
  color: #4a4a4a;
  border-right: 1px solid rgba(0, 0, 0, 0.1);
  background: #f7f7f7;
  min-height: 42px;
  display: inline-flex;
  align-items: center;
`;

const CurrencyInput = styled(Input)`
  border: none;
  border-radius: 0;
  flex: 1;
  min-width: 0;

  &:focus {
    outline: none;
  }
`;

const ColorInput = styled.input`
  width: 100%;
  height: 44px;
  padding: 6px;
  border-radius: 10px;
  border: 1px solid rgba(0, 0, 0, 0.15);
  background: #fff;
  cursor: pointer;
`;

const Select = styled.select`
  padding: 10px 12px;
  border-radius: 10px;
  border: 1px solid rgba(0, 0, 0, 0.15);
  background: #fff;
`;

const SearchFieldWrapper = styled.div`
  position: relative;
`;

const SearchSuggestions = styled.div`
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  right: 0;
  display: flex;
  flex-direction: column;
  max-height: 260px;
  overflow-y: auto;
  padding: 6px;
  border-radius: 12px;
  border: 1px solid rgba(0, 0, 0, 0.12);
  background: #fff;
  box-shadow: 0 14px 28px rgba(0, 0, 0, 0.12);
  z-index: 2100;
`;

const SearchSuggestionButton = styled.button`
  width: 100%;
  border: none;
  background: transparent;
  color: #333;
  padding: 10px 12px;
  border-radius: 10px;
  text-align: left;
  cursor: pointer;

  &:hover {
    background: #f4f6f1;
  }
`;

const TextArea = styled.textarea`
  padding: 10px 12px;
  border-radius: 10px;
  border: 1px solid rgba(0, 0, 0, 0.15);
`;

const Backdrop = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.35);
  z-index: 1990;
`;
