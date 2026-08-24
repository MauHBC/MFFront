/* eslint-disable no-use-before-define */
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import styled from "styled-components";
import {
  FaEye,
  FaEyeSlash,
  FaTimes,
  FaPlus,
} from "react-icons/fa";
import { toast } from "react-toastify";

import { FinancialStatusPill } from "../../components/AppFinancialStatus";
import { NAVIGATION_BADGE_EVENT } from "../../components/AppShell/navigation";
import {
  PrimaryButton as SharedPrimaryButton,
  GhostButton as SharedGhostButton,
} from "../../components/AppButton";
import { UnsavedChangesDialog } from "../../components/AppDrawer";
import {
  MetricCardLabel,
  MetricCardSurface,
  MetricCardValue,
} from "../../components/AppMetricCard";
import { DataTable as SharedDataTable } from "../../components/AppTable";
import PatientSearchField from "../../components/PatientSearchField";
import { colors as appColors } from "../../styles/tokens";
import axios, { getUserFacingApiError } from "../../services/axios";
import {
  listFinancialEntries,
  getFinancialOverview,
  getFinancialRevenuesSummary,
  getFinancialRevenuePatientDetail,
  createFinancialEntry,
  listFinancialPayments,
  listPaymentMethods,
  listClinicExpenses,
  getClinicExpenseAlerts,
  listClinicExpenseCategories,
  createClinicExpense,
  updateClinicExpense,
  deleteClinicExpense,
  payClinicExpense,
  unpayClinicExpense,
  createClinicExpenseCategory,
  updateClinicExpenseCategory,
  activateClinicExpenseCategory,
  deactivateClinicExpenseCategory,
  createFinancialPayment,
  applyCreditToFinancialEntry,
  applyScopedFinancialCredit,
  createPaymentMethod,
  listServicePrices,
  updatePaymentMethod,
  listBillingCycles,
  listPatientCredits,
} from "../../services/financial";
import {
  getPatientDisplayName,
  getPatientSearchText,
  normalizeSearchText,
} from "../../utils/patientSearch";
import ClinicExpenseModal from "./components/ClinicExpenseModal";
import ClinicExpenseCategoryModal from "./components/ClinicExpenseCategoryModal";
import ClinicExpenseCategoriesSection from "./components/ClinicExpenseCategoriesSection";
import ClinicExpensesSection from "./components/ClinicExpensesSection";
import ClinicExpensePaymentModal from "./components/ClinicExpensePaymentModal";
import FinancialPaymentModal from "./components/FinancialPaymentModal";
import FinancialOverviewSection from "./components/FinancialOverviewSection";
import useFinancialPaymentFlow from "./hooks/useFinancialPaymentFlow";
import {
  emptyFinancialRevenuesSummary,
  mapRevenuesSummaryPatientsToAttendanceRows,
  mapRevenuesSummaryToAttendanceSummary,
  normalizeFinancialRevenuesSummary,
} from "./helpers/financialRevenuesSummary";
import {
  emptyClinicExpenseSummary,
  formatDateOnlyBR as formatExpenseDateOnlyBR,
  getClinicExpenseObservation,
  getClinicExpensePaidAmountCents,
  normalizeClinicExpenseSummary,
} from "./helpers/expenseFormatters";
import { formatExpenseAlertCount } from "./helpers/expenseDueAlerts";
import { formatClinicExpenseStatus, getClinicExpenseStatus } from "./helpers/expenseStatus";

const emptyPayment = {
  entry_id: null,
  patient_id: "",
  payment_method_id: "",
  amount: "",
  convert_entry_to_installments: false,
  entry_installments_count: "2",
  discount: "",
  surcharge: "",
  batch_discount_per_session: "",
  adjustment_reason: "",
  paid_at: "",
  note: "",
  allocation_mode: "entry",
};

const hasFilledText = (value) => String(value || "").trim() !== "";

const STANDALONE_PAYMENT_ANCHOR_DESCRIPTION = "Recebimento por sessão (sistema)";
const STANDALONE_PAYMENT_ANCHOR_NOTE =
  "Entrada técnica automática para viabilizar recebimento por sessão.";

const resolveGroupedFinancialStatus = (amountCents, paidCents, openCents) => {
  const amount = Number(amountCents || 0);
  const paid = Number(paidCents || 0);
  const open = Number(openCents || 0);

  if (amount <= 0) return "missing";
  if (open <= 0) return "paid";
  if (paid > 0) return "partial";
  return "pending";
};

const formatCurrencyValue = (cents) => {
  const value = Number(cents || 0) / 100;
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
};

const MASKED_CURRENCY = "R$ ••••";

const formatDate = (value) => {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleDateString("pt-BR");
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
  const validChars = source.replace(/[^\d,.-]/g, "");
  const lastComma = validChars.lastIndexOf(",");
  const lastDot = validChars.lastIndexOf(".");
  const decimalSeparatorIndex = lastComma > lastDot ? lastComma : -1;
  const onlyValidChars = decimalSeparatorIndex >= 0
    ? `${validChars.slice(0, decimalSeparatorIndex).replace(/[.,]/g, "")},${validChars
      .slice(decimalSeparatorIndex + 1)
      .replace(/[.,]/g, "")}`
    : validChars.replace(/[.,]/g, "");
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

const SHOW_CLINIC_EXPENSES = true;
// Mantemos a view antiga disponivel no codigo, mas fora da navegacao para simplificar a UX.
const SHOW_DEDICATED_PAYMENTS_VIEW = false;

const getFinancialSectionFromPath = (pathname) => {
  if (pathname === "/financeiro/receitas") return "receitas";
  if (pathname === "/financeiro/despesas") return "clinic-expenses";
  if (pathname === "/financeiro/configuracoes/categorias-despesas") {
    return "clinic-expense-categories";
  }
  if (
    pathname === "/financeiro/configuracoes"
    || pathname === "/financeiro/configuracoes/formas-pagamento"
  ) {
    return "methods";
  }
  return "overview";
};

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

const getAttendanceDetailPeriod = ({ periodMode, periodMonth, periodYear }) => {
  const mode = periodMode === "year" ? "year" : "month";
  return {
    mode,
    period: mode === "year" ? String(periodYear || "") : String(periodMonth || ""),
  };
};

const buildAttendanceDetailCacheKey = ({ patientId, periodMode, period }) => {
  const normalizedPatientId = Number(patientId || 0);
  const normalizedMode = periodMode === "year" ? "year" : "month";
  const normalizedPeriod = String(period || "").trim();
  if (!normalizedPatientId || !normalizedPeriod) return "";
  return `${normalizedPatientId}:${normalizedMode}:${normalizedPeriod}`;
};

const isDateOnlyWithinRange = (value, start, end) => {
  const dateOnly = String(value || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOnly)) return false;
  if (start && dateOnly < start) return false;
  if (end && dateOnly > end) return false;
  return true;
};

const formatSessionDateTimeBR = (value) => {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatSessionWeekdayBR = (value) => {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  const label = parsed.toLocaleDateString("pt-BR", { weekday: "long" });
  return label ? label.charAt(0).toUpperCase() + label.slice(1) : "-";
};

const formatBillingCycleSessionStatus = (status) => {
  if (status === "done") return "Realizada";
  if (status === "no_show") return "Falta";
  if (status === "canceled") return "Cancelada";
  return "Agendada";
};

const formatPackageSessionStatus = (status) => {
  if (status === "done") return "Concluída";
  if (status === "no_show") return "Falta";
  if (status === "canceled") return "Cancelada";
  return "Agendada";
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

const createEmptyClinicExpense = () => ({
  description: "",
  category: "",
  category_id: "",
  amount: "",
  reference_month: toMonthInputValue(new Date()),
  due_date: toDateInputValue(new Date()),
  status: "open",
  recurrence_type: "none",
  paid_at: "",
  paid_amount: "",
  payment_notes: "",
  notes: "",
});

const createEmptyClinicExpensePayment = () => ({
  expense: null,
  paid_at: toDateInputValue(new Date()),
  paid_amount: "",
  payment_notes: "",
});

const emptyFinancialOverview = (period = "", periodMode = "month") => ({
  ...(periodMode === "year" ? { year: period } : { month: period }),
  revenues: {
    expected: 0,
    received: 0,
    pending: 0,
  },
  expenses: {
    total: 0,
    paid: 0,
    open: 0,
    overdue: 0,
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
});

const normalizeFinancialOverview = (
  payload = {},
  fallbackPeriod = "",
  periodMode = "month",
) => {
  const received = Number(payload.received || 0);
  const receivable = Number(payload.receivable || 0);
  const paidExpenses = Number(payload.paidExpenses || 0);
  const pendingExpenses = Number(payload.pendingExpenses || 0);
  const currentBalance = Number(payload.currentResult || 0);
  const forecastBalance = Number(payload.pendingBalance || 0);

  return {
    ...(periodMode === "year"
      ? { year: payload.year || fallbackPeriod }
      : { month: payload.month || fallbackPeriod }),
    revenues: {
      expected: received + receivable,
      received,
      pending: receivable,
    },
    expenses: {
      total: paidExpenses + pendingExpenses,
      paid: paidExpenses,
      open: pendingExpenses,
      overdue: 0,
    },
    result: {
      expected: received + receivable - (paidExpenses + pendingExpenses),
      realized: currentBalance,
    },
    summary: {
      received,
      receivable,
      paidExpenses,
      pendingExpenses,
      currentBalance,
      forecastBalance,
    },
    hasMovement: [
      received,
      receivable,
      paidExpenses,
      pendingExpenses,
    ].some((value) => Number(value || 0) !== 0),
  };
};

export default function Financeiro() {
  const routeLocation = useLocation();
  const [activeSection, setActiveSection] = useState(() =>
    getFinancialSectionFromPath(routeLocation.pathname)
  );
  const [receitasView, setReceitasView] = useState("atendimentos");
  const [financialValuesVisible, setFinancialValuesVisible] = useState(false);
  const formatCurrency = useCallback(
    (cents) => (financialValuesVisible ? formatCurrencyValue(cents) : MASKED_CURRENCY),
    [financialValuesVisible],
  );
  const [loadingOverview, setLoadingOverview] = useState(true);
  const [loadingRevenues, setLoadingRevenues] = useState(false);
  const [loadingRevenuesSummary, setLoadingRevenuesSummary] = useState(false);
  const [revenuesSummaryError, setRevenuesSummaryError] = useState("");
  const [loadingExpenses, setLoadingExpenses] = useState(false);
  const [loadingExpenseCategories, setLoadingExpenseCategories] = useState(false);
  const [loadingPaymentMethods, setLoadingPaymentMethods] = useState(false);
  const [isAttendanceLoading, setIsAttendanceLoading] = useState(false);
  const [hasAttendanceLoaded, setHasAttendanceLoaded] = useState(false);
  const [entries, setEntries] = useState([]);
  const [patients, setPatients] = useState([]);
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [services, setServices] = useState([]);
  const [servicePrices, setServicePrices] = useState([]);
  const [payments, setPayments] = useState([]);
  const [patientCredits, setPatientCredits] = useState([]);
  const [clinicExpensesData, setClinicExpensesData] = useState([]);
  const [clinicExpenseCategories, setClinicExpenseCategories] = useState([]);
  const [clinicExpensesSummary, setClinicExpensesSummary] = useState(emptyClinicExpenseSummary);
  const [clinicExpenseAlertsCount, setClinicExpenseAlertsCount] = useState(0);
  const [overviewSummary, setOverviewSummary] = useState(() =>
    emptyFinancialOverview(toMonthInputValue(new Date())),
  );
  const overviewRequestRef = useRef(0);
  const [revenuesSummary, setRevenuesSummary] = useState(() =>
    emptyFinancialRevenuesSummary(toMonthInputValue(new Date())),
  );
  const [attendanceSeries, setAttendanceSeries] = useState([]);
  const [attendanceSessions, setAttendanceSessions] = useState([]);
  const [clinicExpensesMonth, setClinicExpensesMonth] = useState(() =>
    toMonthInputValue(new Date()),
  );
  const [overviewPeriodMode, setOverviewPeriodMode] = useState("month");
  const [clinicExpensesPeriodMode, setClinicExpensesPeriodMode] = useState("month");
  const [clinicExpensesFilters, setClinicExpensesFilters] = useState({
    status: "all",
    category: "all",
    search: "",
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
      status: "all",
      financial: "all",
      patient_id: "",
      professional_id: "",
    };
  });
  const [attendanceDrilldownPatientId, setAttendanceDrilldownPatientId] = useState(null);
  const [attendanceDetailSessions, setAttendanceDetailSessions] = useState({
    patientId: null,
    sessions: [],
    isLoading: false,
    error: "",
  });
  const [attendanceDetailPackages, setAttendanceDetailPackages] = useState([]);
  const [attendanceDetailSummary, setAttendanceDetailSummary] = useState(null);
  const [attendanceBackendCreditByPatient, setAttendanceBackendCreditByPatient] = useState(() => new Map());
  const [attendanceDetailTab, setAttendanceDetailTab] = useState("charges");
  const [selectedAttendancePackageId, setSelectedAttendancePackageId] = useState(null);
  const [attendancePeriodMode, setAttendancePeriodMode] = useState("month");
  const [attendancePeriodMonth, setAttendancePeriodMonth] = useState(() =>
    toMonthInputValue(new Date()),
  );
  const [attendancePeriodYear, setAttendancePeriodYear] = useState(() =>
    String(new Date().getFullYear()),
  );
  const attendanceMonthPickerRef = useRef(null);
  const attendanceDetailRequestRef = useRef(0);
  const attendanceDetailCacheRef = useRef(new Map());

  const [billingCycles, setBillingCycles] = useState([]);
  const [isBillingCyclesLoading, setIsBillingCyclesLoading] = useState(false);
  const [hasBillingCyclesLoaded, setHasBillingCyclesLoaded] = useState(false);
  const [billingCyclesStatusFilter, setBillingCyclesStatusFilter] = useState("all");
  const [billingCyclesFilters, setBillingCyclesFilters] = useState(() => {
    const range = getCurrentMonthRange();
    return {
      start: range.start,
      end: range.end,
      search: "",
    };
  });
  const [billingCyclesPeriodMode, setBillingCyclesPeriodMode] = useState("month");
  const [billingCyclesPeriodMonth, setBillingCyclesPeriodMonth] = useState(() =>
    toMonthInputValue(new Date()),
  );
  const [billingCyclesPeriodYear, setBillingCyclesPeriodYear] = useState(() =>
    String(new Date().getFullYear()),
  );
  const billingCyclesMonthPickerRef = useRef(null);
  const [billingCyclesDrilldownPatientId, setBillingCyclesDrilldownPatientId] = useState(null);

  useEffect(() => {
    setActiveSection(getFinancialSectionFromPath(routeLocation.pathname));
  }, [routeLocation.pathname]);

  useEffect(() => {
    window.dispatchEvent(new CustomEvent(NAVIGATION_BADGE_EVENT, {
      detail: {
        key: "financial-expenses",
        value: formatExpenseAlertCount(clinicExpenseAlertsCount),
      },
    }));
  }, [clinicExpenseAlertsCount]);

  useEffect(() => {
    const params = new URLSearchParams(routeLocation.search || "");
    const view = params.get("view") || params.get("tab");
    if (view !== "mensalidades") return;

    setActiveSection("receitas");
    setReceitasView("mensalidades");

    const month = params.get("month");
    const parsedMonth = parseMonthInputValue(month);
    if (parsedMonth) {
      setBillingCyclesPeriodMode("month");
      setBillingCyclesPeriodMonth(month);
      setBillingCyclesPeriodYear(String(parsedMonth.year));
    }

    const patientId = normalizeId(params.get("patient_id"));
    if (patientId) {
      setBillingCyclesDrilldownPatientId(String(patientId));
    }

    const patientName = String(params.get("patient_name") || "").trim();
    if (patientName) {
      setBillingCyclesFilters((prev) => (
        prev.search === patientName ? prev : { ...prev, search: patientName }
      ));
    }
  }, [routeLocation.search]);

  const [billingCycleSessionsPreview, setBillingCycleSessionsPreview] = useState({
    open: false,
    cycle: null,
    sessions: [],
    isLoading: false,
    error: "",
  });

  const [discardModalClose, setDiscardModalClose] = useState(null);
  const [isClinicExpenseOpen, setIsClinicExpenseOpen] = useState(false);
  const [clinicExpenseForm, setClinicExpenseForm] = useState(() => createEmptyClinicExpense());
  const [editingClinicExpenseId, setEditingClinicExpenseId] = useState(null);
  const [clinicExpenseDeleteTarget, setClinicExpenseDeleteTarget] = useState(null);
  const [clinicExpenseUnpayTarget, setClinicExpenseUnpayTarget] = useState(null);
  const [clinicExpenseUnpayReason, setClinicExpenseUnpayReason] = useState("");
  const [isClinicExpenseSaving, setIsClinicExpenseSaving] = useState(false);
  const [clinicExpensePayingId, setClinicExpensePayingId] = useState(null);
  const [isClinicExpensePaymentOpen, setIsClinicExpensePaymentOpen] = useState(false);
  const [clinicExpensePaymentForm, setClinicExpensePaymentForm] = useState(() =>
    createEmptyClinicExpensePayment());
  const [isClinicExpenseDeleting, setIsClinicExpenseDeleting] = useState(false);
  const [isClinicExpenseCategoryOpen, setIsClinicExpenseCategoryOpen] = useState(false);
  const [clinicExpenseCategoryForm, setClinicExpenseCategoryForm] = useState({ name: "" });
  const [editingClinicExpenseCategoryId, setEditingClinicExpenseCategoryId] = useState(null);
  const [isClinicExpenseCategorySaving, setIsClinicExpenseCategorySaving] = useState(false);
  const [clinicExpenseCategoryUpdatingId, setClinicExpenseCategoryUpdatingId] = useState(null);
  const [clinicExpenseCategoryDeactivateTarget, setClinicExpenseCategoryDeactivateTarget] = useState(null);
  // Estado legado preservado exclusivamente para a view dedicada de Recebimentos.
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [isPaymentSaving, setIsPaymentSaving] = useState(false);
  const [paymentForm, setPaymentForm] = useState(emptyPayment);
  const [paymentModalContext, setPaymentModalContext] = useState(null);
  const [paymentAllocations, setPaymentAllocations] = useState({});
  const [paymentPatientQuery, setPaymentPatientQuery] = useState("");
  const [isPaymentPatientSearchFocused, setIsPaymentPatientSearchFocused] = useState(false);
  const [creditUseModalContext, setCreditUseModalContext] = useState(null);
  const [isCreditUseSaving, setIsCreditUseSaving] = useState(false);
  const [isMethodOpen, setIsMethodOpen] = useState(false);
  const [methodForm, setMethodForm] = useState({ name: "" });
  const [editingMethodId, setEditingMethodId] = useState(null);


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
        getPatientSearchText(patient).includes(paymentPatientNormalizedQuery),
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
    () => normalizeId(attendanceDrilldownPatientId || attendanceFilters.patient_id),
    [attendanceDrilldownPatientId, attendanceFilters.patient_id],
  );

  const selectedAttendancePatient = useMemo(() => {
    if (!selectedAttendancePatientId) return null;
    return patientMap.get(selectedAttendancePatientId) || null;
  }, [patientMap, selectedAttendancePatientId]);

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

  const paymentAdjustmentList = useMemo(() => {
    const list = [];
    payments.forEach((payment) => {
      const adjustments =
        payment?.FinancialPaymentAdjustments ||
        payment?.financial_payment_adjustments ||
        [];
      adjustments.forEach((adjustment) => {
        list.push({ ...adjustment, payment });
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

  const adjustmentByEntryId = useMemo(() => {
    const map = new Map();
    paymentAdjustmentList.forEach((adjustment) => {
      const entryId = adjustment.entry_id;
      if (!entryId) return;
      const current = map.get(entryId) || {
        discountCents: 0,
        surchargeCents: 0,
        adjustedAmountCents: 0,
        receivedAmountCents: 0,
        reason: null,
      };
      current.discountCents += Number(adjustment.discount_cents || 0);
      current.surchargeCents += Number(adjustment.surcharge_cents || 0);
      current.adjustedAmountCents += Number(adjustment.adjusted_amount_cents || 0);
      current.receivedAmountCents += Number(adjustment.received_amount_cents || 0);
      current.reason = current.reason || adjustment.reason || null;
      map.set(entryId, current);
    });
    return map;
  }, [paymentAdjustmentList]);

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

  const clinicExpenses = useMemo(() => {
    const periodMonth = parseMonthInputValue(clinicExpensesMonth);
    const range = clinicExpensesPeriodMode === "year" && periodMonth
      ? getYearRangeFromValue(String(periodMonth.year))
      : getMonthRangeFromInputValue(clinicExpensesMonth);
    if (!range) return [];
    const search = normalizeSearchText(clinicExpensesFilters.search);

    return clinicExpensesData
      .filter((entry) => isDateOnlyWithinRange(entry.reference_month, range.start, range.end))
      .filter((entry) => {
        const status = getClinicExpenseStatus(entry);
        if (clinicExpensesFilters.status !== "all" && status !== clinicExpensesFilters.status) {
          return false;
        }
        if (clinicExpensesFilters.category !== "all") {
          const selectedCategory = String(clinicExpensesFilters.category || "");
          if (selectedCategory.startsWith("legacy:")) {
            const legacyName = selectedCategory.replace("legacy:", "");
            if ((entry.category_name || entry.category) !== legacyName) return false;
          } else {
            const configuredCategory = clinicExpenseCategories.find(
              (category) => String(category.id) === selectedCategory,
            );
            const currentCategoryName = entry.category_name || entry.category;
            if (
              String(entry.category_id || "") !== selectedCategory
              && (!configuredCategory || currentCategoryName !== configuredCategory.name)
            ) {
              return false;
            }
          }
        }
        if (!search) return true;

        const haystack = normalizeSearchText([
          entry.name,
          entry.notes,
          entry.payment_notes,
          entry.category_name || entry.category,
          formatClinicExpenseStatus(status),
        ]
          .filter(Boolean)
          .join(" "));
        return haystack.includes(search);
      })
      .sort((first, second) => {
        const firstDue = String(first.due_date || first.reference_month || "");
        const secondDue = String(second.due_date || second.reference_month || "");
        if (firstDue !== secondDue) return firstDue.localeCompare(secondDue);
        return String(first.name || "").localeCompare(String(second.name || ""));
      });
  }, [
    clinicExpensesData,
    clinicExpensesMonth,
    clinicExpensesPeriodMode,
    clinicExpensesFilters,
    clinicExpenseCategories,
  ]);

  const overviewMonthLabel = useMemo(() => {
    const parsed = parseMonthInputValue(clinicExpensesMonth);
    if (!parsed) return "";
    if (overviewPeriodMode === "year") return String(parsed.year);
    return formatMonthYear(new Date(parsed.year, parsed.month - 1, 1));
  }, [clinicExpensesMonth, overviewPeriodMode]);

  const clinicExpensesPeriodLabel = useMemo(() => {
    const parsed = parseMonthInputValue(clinicExpensesMonth);
    if (!parsed) return "";
    if (clinicExpensesPeriodMode === "year") return String(parsed.year);
    return formatMonthYear(new Date(parsed.year, parsed.month - 1, 1));
  }, [clinicExpensesMonth, clinicExpensesPeriodMode]);

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
    if (!series) return "Por sessão";
    const weekdays = Array.isArray(series.weekdays) ? series.weekdays.length : 0;
    if (weekdays > 0) {
      if (series.repeat_interval === 1) return `${weekdays}x/semana`;
      if (series.repeat_interval === 2) return `${weekdays}x/15 dias`;
      return `${weekdays}x a cada ${series.repeat_interval} semanas`;
    }
    if (series.occurrence_count) return `Série (${series.occurrence_count} sessões)`;
    return "Recorrente";
  }, []);

  const formatDateOnlyBR = useCallback((dateStr) => {
    if (!dateStr) return "-";
    const dateOnlyValue = String(dateStr).slice(0, 10);
    const parts = dateOnlyValue.split("-");
    if (parts.length !== 3) return dateStr;
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }, []);

  const formatFinancialStatus = useCallback((status) => {
    if (status === "credit") return "Credito";
    if (status === "paid") return "Pago";
    if (status === "partial") return "Parcial";
    if (status === "canceled") return "Cancelado";
    if (status === "overdue") return "Vencido";
    if (status === "missing") return "Sem lançamento";
    if (status === "covered_by_plan") return "Coberto pelo plano";
    if (status === "no_charge") return "Sem cobrança";
    return "Pendente";
  }, []);

  const formatPaymentUsage = useCallback((payment, allocatedAmount) => {
    const amount = Number(payment?.amount_cents || 0);
    const allocated = Number(allocatedAmount || 0);
    const remaining = Math.max(0, amount - allocated);

    if (allocated <= 0) return "Guardado como crédito";
    if (remaining <= 0) return "Usado em cobranças";
    return "Parte usada, parte em crédito";
  }, []);

  const getClinicExpensesPeriodParams = useCallback((periodMode = clinicExpensesPeriodMode) => (
    periodMode === "year"
      ? { year: String(parseMonthInputValue(clinicExpensesMonth)?.year || new Date().getFullYear()) }
      : { reference_month: clinicExpensesMonth }
  ), [clinicExpensesMonth, clinicExpensesPeriodMode]);

  const applyClinicExpensesPayload = useCallback((payload = {}) => {
    setClinicExpensesData(
      Array.isArray(payload)
        ? payload
        : (payload.items || []),
    );
    setClinicExpensesSummary(
      normalizeClinicExpenseSummary(payload.summary),
    );
  }, []);

  const canUseAggregatedRevenuesSummary = useMemo(() => (
    receitasView === "atendimentos"
    && attendanceFilters.financial === "all"
    && !attendanceFilters.patient_id
    && !attendanceFilters.professional_id
    && !String(attendanceFilters.search || "").trim()
    && !attendanceDrilldownPatientId
  ), [
    attendanceDrilldownPatientId,
    attendanceFilters.financial,
    attendanceFilters.patient_id,
    attendanceFilters.professional_id,
    attendanceFilters.search,
    receitasView,
  ]);

  const loadOverviewData = useCallback(async () => {
    const parsedPeriod = parseMonthInputValue(clinicExpensesMonth);
    const overviewPeriod = overviewPeriodMode === "year"
      ? String(parsedPeriod?.year || "")
      : clinicExpensesMonth;
    if (!overviewPeriod) return;

    const requestId = overviewRequestRef.current + 1;
    overviewRequestRef.current = requestId;
    try {
      setLoadingOverview(true);
      const [
        overviewResponse,
        clinicExpenseAlertsResponse,
      ] = await Promise.all([
        getFinancialOverview(overviewPeriod, overviewPeriodMode),
        getClinicExpenseAlerts(),
      ]);

      if (requestId !== overviewRequestRef.current) return;
      setOverviewSummary(normalizeFinancialOverview(
        overviewResponse.data || {},
        overviewPeriod,
        overviewPeriodMode,
      ));
      setClinicExpenseAlertsCount(Number(clinicExpenseAlertsResponse.data?.dueSoonCount || 0));
    } catch (error) {
      if (requestId !== overviewRequestRef.current) return;
      toast.error("Não foi possível carregar a visão geral financeira.");
      setOverviewSummary(emptyFinancialOverview(overviewPeriod, overviewPeriodMode));
    } finally {
      if (requestId === overviewRequestRef.current) {
        setLoadingOverview(false);
      }
    }
  }, [clinicExpensesMonth, overviewPeriodMode]);

  const loadRevenuesSummary = useCallback(async () => {
    const summaryPeriod = attendancePeriodMode === "year"
      ? attendancePeriodYear
      : attendancePeriodMonth;
    if (!summaryPeriod) return;

    try {
      setLoadingRevenuesSummary(true);
      setRevenuesSummaryError("");
      const response = await getFinancialRevenuesSummary(summaryPeriod, attendancePeriodMode);
      setRevenuesSummary(normalizeFinancialRevenuesSummary(
        response.data || {},
        summaryPeriod,
      ));
    } catch (error) {
      setRevenuesSummaryError("Não foi possível carregar o resumo de receitas.");
      setRevenuesSummary(emptyFinancialRevenuesSummary(summaryPeriod));
      toast.error("Não foi possível carregar o resumo de receitas.");
    } finally {
      setLoadingRevenuesSummary(false);
    }
  }, [attendancePeriodMode, attendancePeriodMonth, attendancePeriodYear]);

  const loadRevenuesData = useCallback(async () => {
    try {
      setLoadingRevenues(true);
      const [
        entriesResponse,
        paymentMethodsResponse,
        patientsResponse,
        servicesResponse,
        servicePricesResponse,
        paymentsResponse,
        patientCreditsResponse,
        sessionSeriesResponse,
      ] = await Promise.all([
        listFinancialEntries(),
        listPaymentMethods(),
        axios.get("/patients"),
        axios.get("/services"),
        listServicePrices(),
        listFinancialPayments(),
        listPatientCredits(),
        axios.get("/session-series"),
      ]);

      setEntries(entriesResponse.data || []);
      setPaymentMethods(paymentMethodsResponse.data || []);
      setPatients(patientsResponse.data || []);
      setServices(servicesResponse.data || []);
      setServicePrices(servicePricesResponse.data || []);
      setPayments(paymentsResponse.data || []);
      setPatientCredits(patientCreditsResponse.data || []);
      setAttendanceSeries(sessionSeriesResponse.data || []);
    } catch (error) {
      toast.error("Nao foi possivel carregar as receitas.");
    } finally {
      setLoadingRevenues(false);
    }
  }, []);

  const loadClinicExpensesData = useCallback(async () => {
    try {
      setLoadingExpenses(true);
      const [
        clinicExpensesResponse,
        clinicExpenseAlertsResponse,
        clinicExpenseCategoriesResponse,
      ] = await Promise.all([
        listClinicExpenses(getClinicExpensesPeriodParams()),
        getClinicExpenseAlerts(),
        listClinicExpenseCategories(),
      ]);

      applyClinicExpensesPayload(clinicExpensesResponse.data || {});
      setClinicExpenseAlertsCount(Number(clinicExpenseAlertsResponse.data?.dueSoonCount || 0));
      setClinicExpenseCategories(clinicExpenseCategoriesResponse.data || []);
    } catch (error) {
      toast.error("Nao foi possivel carregar as despesas da clinica.");
    } finally {
      setLoadingExpenses(false);
    }
  }, [applyClinicExpensesPayload, getClinicExpensesPeriodParams]);

  const loadClinicExpenseCategoriesData = useCallback(async () => {
    try {
      setLoadingExpenseCategories(true);
      const response = await listClinicExpenseCategories();
      setClinicExpenseCategories(response.data || []);
    } catch (error) {
      toast.error("Nao foi possivel carregar as categorias de despesas.");
    } finally {
      setLoadingExpenseCategories(false);
    }
  }, []);

  const loadPaymentMethodsData = useCallback(async () => {
    try {
      setLoadingPaymentMethods(true);
      const response = await listPaymentMethods();
      setPaymentMethods(response.data || []);
    } catch (error) {
      toast.error("Nao foi possivel carregar as formas de pagamento.");
    } finally {
      setLoadingPaymentMethods(false);
    }
  }, []);

  useEffect(() => {
    if (activeSection === "overview") loadOverviewData();
  }, [activeSection, loadOverviewData]);

  useEffect(() => {
    if (activeSection !== "receitas") return;
    if (receitasView === "atendimentos" && attendanceDrilldownPatientId) return;
    if (canUseAggregatedRevenuesSummary) {
      loadRevenuesSummary();
      return;
    }
    loadRevenuesData();
  }, [
    activeSection,
    attendanceDrilldownPatientId,
    canUseAggregatedRevenuesSummary,
    loadRevenuesData,
    loadRevenuesSummary,
    receitasView,
  ]);

  useEffect(() => {
    if (activeSection === "clinic-expenses") loadClinicExpensesData();
  }, [activeSection, loadClinicExpensesData]);

  useEffect(() => {
    if (activeSection === "clinic-expense-categories") loadClinicExpenseCategoriesData();
  }, [activeSection, loadClinicExpenseCategoriesData]);

  useEffect(() => {
    if (activeSection === "methods") loadPaymentMethodsData();
  }, [activeSection, loadPaymentMethodsData]);

  const loadBillingCycles = useCallback(async () => {
    try {
      setIsBillingCyclesLoading(true);
      const params = {};
      if (billingCyclesFilters.start) params.from = billingCyclesFilters.start;
      if (billingCyclesFilters.end) params.to = billingCyclesFilters.end;
      const response = await listBillingCycles(params);
      setBillingCycles(response.data || []);
      setHasBillingCyclesLoaded(true);
    } catch (error) {
      toast.error("Não foi possível carregar as mensalidades.");
    } finally {
      setIsBillingCyclesLoading(false);
    }
  }, [billingCyclesFilters.start, billingCyclesFilters.end]);

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
      toast.error("Não foi possível carregar atendimentos.");
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

  const ensureRevenueOperationalData = useCallback(async () => {
    await Promise.all([
      loadRevenuesData(),
      loadAttendance(),
    ]);
  }, [loadAttendance, loadRevenuesData]);

  useEffect(() => {
    if (
      activeSection === "receitas"
      && receitasView === "atendimentos"
      && !attendanceDrilldownPatientId
      && !canUseAggregatedRevenuesSummary
    ) {
      loadAttendance();
    }
  }, [
    activeSection,
    attendanceDrilldownPatientId,
    canUseAggregatedRevenuesSummary,
    loadAttendance,
    receitasView,
  ]);

  useEffect(() => {
    if (activeSection === "receitas" && receitasView === "mensalidades") {
      loadBillingCycles();
    }
  }, [activeSection, receitasView, loadBillingCycles]);

  // eslint-disable-next-line no-unused-vars -- Preservado para a visão dedicada de Recebimentos.
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

  const closeCreditUseModal = useCallback(() => {
    if (isCreditUseSaving) return;
    setCreditUseModalContext(null);
  }, [isCreditUseSaving]);

  const requestModalDiscard = useCallback((closeFn, hasInput) => {
    if (typeof closeFn !== "function") return;
    if (!hasInput) {
      closeFn();
      return;
    }
    setDiscardModalClose(() => closeFn);
  }, []);

  const keepModalEditing = useCallback(() => {
    setDiscardModalClose(null);
  }, []);

  const discardModalChanges = useCallback(() => {
    if (discardModalClose) discardModalClose();
    setDiscardModalClose(null);
  }, [discardModalClose]);

  const ProtectedBackdrop = useCallback(({ onClick, $hasInput }) => (
    <Backdrop
      onClick={() => requestModalDiscard(onClick, $hasInput)}
    />
  ), [requestModalDiscard]);

  const clinicExpenseModalHasInput = Boolean(
    editingClinicExpenseId
    || hasFilledText(clinicExpenseForm.description)
    || hasFilledText(clinicExpenseForm.category_id)
    || hasFilledText(clinicExpenseForm.amount)
    || hasFilledText(clinicExpenseForm.notes)
    || hasFilledText(clinicExpenseForm.paid_amount)
    || hasFilledText(clinicExpenseForm.payment_notes),
  );
  const clinicExpensePaymentModalHasInput = Boolean(
    hasFilledText(clinicExpensePaymentForm.paid_amount)
    || hasFilledText(clinicExpensePaymentForm.payment_notes),
  );
  const clinicExpenseCategoryModalHasInput = Boolean(
    editingClinicExpenseCategoryId
    || hasFilledText(clinicExpenseCategoryForm.name),
  );
  const creditUseModalHasInput = Boolean(creditUseModalContext);
  const paymentModalHasInput = Boolean(
    hasFilledText(paymentForm.entry_id)
    || hasFilledText(paymentForm.patient_id)
    || hasFilledText(paymentForm.payment_method_id)
    || hasFilledText(paymentForm.amount)
    || hasFilledText(paymentForm.discount)
    || hasFilledText(paymentForm.surcharge)
    || hasFilledText(paymentForm.batch_discount_per_session)
    || hasFilledText(paymentForm.adjustment_reason)
    || hasFilledText(paymentForm.note),
  );
  const methodModalHasInput = Boolean(editingMethodId || hasFilledText(methodForm.name));
  const openCreditModal = useCallback((patient = null) => {
    const patientId = patient?.id ? String(patient.id) : "";
    const patientName = patientId ? getPatientDisplayName(patient) : "";

    setPaymentForm({
      ...emptyPayment,
      entry_id: null,
      patient_id: patientId,
      allocation_mode: "auto",
      amount: "",
      paid_at: toDateInputValue(new Date()),
    });
    setPaymentAllocations({});
    setPaymentModalContext(patientId ? {
      fixedPatient: true,
      patientName,
    } : null);
    setPaymentPatientQuery(patientName);
    setIsPaymentPatientSearchFocused(false);
    setIsPaymentOpen(true);
  }, []);

  useEffect(() => {
    if ((!isPaymentOpen && !creditUseModalContext) || typeof document === "undefined") return () => { };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [creditUseModalContext, isPaymentOpen]);

  useEffect(() => {
    if ((!isPaymentOpen && !creditUseModalContext) || typeof document === "undefined") return () => { };
    const handleEscape = (event) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      if (isPaymentOpen) closePaymentModal();
      if (creditUseModalContext) closeCreditUseModal();
    };
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("keydown", handleEscape);
    };
  }, [creditUseModalContext, isPaymentOpen, closeCreditUseModal, closePaymentModal]);

  const openClinicExpenseModal = useCallback((expense = null) => {
    if (expense?.id) {
      setClinicExpenseForm({
        description: expense.name || "",
        category: expense.category_name || expense.category || "",
        category_id: expense.category_id ? String(expense.category_id) : "",
        amount: formatCurrencyInput(Number(expense.amount_cents || 0) / 100),
        reference_month: String(expense.reference_month || expense.due_date || "").slice(0, 7),
        due_date: String(expense.due_date || "").slice(0, 10),
        status: expense.paid_at ? "paid" : "open",
        recurrence_type: expense.recurrence_type || "none",
        paid_at: expense.paid_at ? String(expense.paid_at).slice(0, 10) : toDateInputValue(new Date()),
        paid_amount: formatCurrencyInput(
          Number((expense.paid_amount_cents || expense.amount_cents || 0)) / 100,
        ),
        payment_notes: expense.payment_notes || "",
        notes: expense.notes || "",
      });
      setEditingClinicExpenseId(expense.id);
    } else {
      setClinicExpenseForm({
        ...createEmptyClinicExpense(),
        reference_month: clinicExpensesMonth || toMonthInputValue(new Date()),
      });
      setEditingClinicExpenseId(null);
    }
    setIsClinicExpenseOpen(true);
  }, [clinicExpensesMonth]);

  const closeClinicExpenseModal = useCallback(() => {
    if (isClinicExpenseSaving) return;
    setIsClinicExpenseOpen(false);
    setEditingClinicExpenseId(null);
  }, [isClinicExpenseSaving]);

  const handleClinicExpenseChange = useCallback((event) => {
    const { name, value } = event.target;
    if (name === "amount") {
      setClinicExpenseForm((prev) => ({
        ...prev,
        amount: sanitizePositiveCurrencyInput(value),
        paid_amount: prev.status === "paid" && !prev.paid_amount
          ? sanitizePositiveCurrencyInput(value)
          : prev.paid_amount,
      }));
      return;
    }
    if (name === "paid_amount") {
      setClinicExpenseForm((prev) => ({
        ...prev,
        paid_amount: sanitizePositiveCurrencyInput(value),
      }));
      return;
    }
    if (name === "status") {
      setClinicExpenseForm((prev) => ({
        ...prev,
        status: value,
        paid_at: value === "paid" && !prev.paid_at ? toDateInputValue(new Date()) : prev.paid_at,
        paid_amount: value === "paid" && !prev.paid_amount ? formatCurrencyInput(prev.amount) : prev.paid_amount,
        payment_notes: value === "paid" ? prev.payment_notes : "",
      }));
      return;
    }
    if (name === "category_id") {
      const selectedCategory = clinicExpenseCategories.find(
        (category) => String(category.id) === String(value),
      );
      setClinicExpenseForm((prev) => ({
        ...prev,
        category_id: value,
        category: selectedCategory?.name || "",
      }));
      return;
    }
    setClinicExpenseForm((prev) => ({ ...prev, [name]: value }));
  }, [clinicExpenseCategories]);

  const handleClinicExpenseAmountBlur = useCallback(() => {
    setClinicExpenseForm((prev) => ({
      ...prev,
      amount: formatCurrencyInput(prev.amount),
      paid_amount: prev.paid_amount || formatCurrencyInput(prev.amount),
    }));
  }, []);

  const handleClinicExpensePaidAmountBlur = useCallback(() => {
    setClinicExpenseForm((prev) => ({
      ...prev,
      paid_amount: formatCurrencyInput(prev.paid_amount),
    }));
  }, []);

  const handleClinicExpensesFilterChange = useCallback((event) => {
    const { name, value } = event.target;
    setClinicExpensesFilters((prev) => ({ ...prev, [name]: value }));
  }, []);

  const handleClinicExpenseMonthChange = useCallback((event) => {
    const { value } = event.target;
    if (!parseMonthInputValue(value)) return;
    setClinicExpensesMonth(value);
  }, []);

  const handleClinicExpensesPeriodModeChange = useCallback((mode) => {
    setClinicExpensesPeriodMode(mode === "year" ? "year" : "month");
  }, []);

  const handleOverviewPeriodModeChange = useCallback((mode) => {
    const nextMode = mode === "year" ? "year" : "month";
    setLoadingOverview(true);
    setOverviewPeriodMode(nextMode);
  }, []);

  const shiftOverviewPeriod = useCallback((direction) => {
    if (!Number.isFinite(direction) || direction === 0) return;
    setClinicExpensesMonth((prev) => {
      const parsed = parseMonthInputValue(prev);
      const baseDate = parsed
        ? new Date(parsed.year, parsed.month - 1, 1)
        : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
      const offset = overviewPeriodMode === "year" ? direction * 12 : direction;
      const target = new Date(baseDate.getFullYear(), baseDate.getMonth() + offset, 1);
      return toMonthInputValue(target);
    });
  }, [overviewPeriodMode]);

  const handleOverviewPreviousMonth = useCallback(() => {
    shiftOverviewPeriod(-1);
  }, [shiftOverviewPeriod]);

  const handleOverviewNextMonth = useCallback(() => {
    shiftOverviewPeriod(1);
  }, [shiftOverviewPeriod]);

  const shiftClinicExpensesPeriod = useCallback((direction) => {
    if (!Number.isFinite(direction) || direction === 0) return;
    setClinicExpensesMonth((prev) => {
      const parsed = parseMonthInputValue(prev);
      const baseDate = parsed
        ? new Date(parsed.year, parsed.month - 1, 1)
        : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
      const offset = clinicExpensesPeriodMode === "year" ? direction * 12 : direction;
      const target = new Date(baseDate.getFullYear(), baseDate.getMonth() + offset, 1);
      return toMonthInputValue(target);
    });
  }, [clinicExpensesPeriodMode]);

  const handleClinicExpensesPreviousPeriod = useCallback(() => {
    shiftClinicExpensesPeriod(-1);
  }, [shiftClinicExpensesPeriod]);

  const handleClinicExpensesNextPeriod = useCallback(() => {
    shiftClinicExpensesPeriod(1);
  }, [shiftClinicExpensesPeriod]);

  const handleSaveClinicExpense = useCallback(async () => {
    const amountValue = parseCurrencyInputToNumber(clinicExpenseForm.amount);
    const paidAmountValue = parseCurrencyInputToNumber(clinicExpenseForm.paid_amount);
    if (!clinicExpenseForm.description.trim()) {
      toast.error("Informe a descrição da despesa.");
      return;
    }
    if (!clinicExpenseForm.category_id && !clinicExpenseForm.category) {
      toast.error("Informe a categoria.");
      return;
    }
    if (Number.isNaN(amountValue) || amountValue <= 0) {
      toast.error("Informe um valor válido.");
      return;
    }
    if (!clinicExpenseForm.due_date) {
      toast.error("Informe o vencimento.");
      return;
    }
    if (clinicExpenseForm.status === "paid" && !clinicExpenseForm.paid_at) {
      toast.error("Informe a data do pagamento.");
      return;
    }
    if (
      clinicExpenseForm.status === "paid"
      && (Number.isNaN(paidAmountValue) || paidAmountValue <= 0)
    ) {
      toast.error("Informe o valor pago.");
      return;
    }

    const payload = {
      name: clinicExpenseForm.description.trim(),
      amount_cents: Math.round(amountValue * 100),
      due_date: clinicExpenseForm.due_date,
      notes: clinicExpenseForm.notes.trim() || null,
    };
    if (clinicExpenseForm.status === "paid") {
      payload.paid_at = clinicExpenseForm.paid_at;
      payload.paid_amount_cents = Math.round(paidAmountValue * 100);
      payload.payment_notes = clinicExpenseForm.payment_notes.trim() || null;
    } else {
      payload.paid_at = null;
      payload.paid_amount_cents = null;
      payload.payment_notes = null;
    }
    if (clinicExpenseForm.category_id) {
      payload.category_id = Number(clinicExpenseForm.category_id);
    } else {
      payload.category = clinicExpenseForm.category;
    }

    if (!editingClinicExpenseId) {
      payload.recurrence_type = clinicExpenseForm.recurrence_type || "none";
    }

    try {
      setIsClinicExpenseSaving(true);
      if (editingClinicExpenseId) {
        await updateClinicExpense(editingClinicExpenseId, payload);
        toast.success("Despesa atualizada com sucesso.");
      } else {
        await createClinicExpense(payload);
        toast.success(
          payload.recurrence_type === "monthly"
            ? "Despesa recorrente cadastrada com sucesso."
            : "Despesa cadastrada com sucesso.",
        );
      }
      setClinicExpensesMonth(String(clinicExpenseForm.due_date).slice(0, 7));
      closeClinicExpenseModal();
      loadClinicExpensesData();
    } catch (error) {
      toast.error(getUserFacingApiError(error, "Não foi possível salvar a despesa."));
    } finally {
      setIsClinicExpenseSaving(false);
    }
  }, [clinicExpenseForm, editingClinicExpenseId, closeClinicExpenseModal, loadClinicExpensesData]);

  const openClinicExpensePaymentModal = useCallback((entry) => {
    if (!entry?.id) return;
    setClinicExpensePaymentForm({
      expense: entry,
      paid_at: entry.paid_at ? String(entry.paid_at).slice(0, 10) : toDateInputValue(new Date()),
      paid_amount: formatCurrencyInput(
        Number((entry.paid_amount_cents || entry.amount_cents || 0)) / 100,
      ),
      payment_notes: entry.payment_notes || "",
    });
    setIsClinicExpensePaymentOpen(true);
  }, []);

  const closeClinicExpensePaymentModal = useCallback(() => {
    if (clinicExpensePayingId) return;
    setIsClinicExpensePaymentOpen(false);
    setClinicExpensePaymentForm(createEmptyClinicExpensePayment());
  }, [clinicExpensePayingId]);

  const handleClinicExpensePaymentChange = useCallback((event) => {
    const { name, value } = event.target;
    if (name === "paid_amount") {
      setClinicExpensePaymentForm((prev) => ({
        ...prev,
        paid_amount: sanitizePositiveCurrencyInput(value),
      }));
      return;
    }
    setClinicExpensePaymentForm((prev) => ({ ...prev, [name]: value }));
  }, []);

  const handleClinicExpensePaymentAmountBlur = useCallback(() => {
    setClinicExpensePaymentForm((prev) => ({
      ...prev,
      paid_amount: formatCurrencyInput(prev.paid_amount),
    }));
  }, []);

  const handleSaveClinicExpensePayment = useCallback(async () => {
    const entry = clinicExpensePaymentForm.expense;
    if (!entry?.id || clinicExpensePayingId) return;

    const paidAmountValue = parseCurrencyInputToNumber(clinicExpensePaymentForm.paid_amount);
    if (!clinicExpensePaymentForm.paid_at) {
      toast.error("Informe a data do pagamento.");
      return;
    }
    if (Number.isNaN(paidAmountValue) || paidAmountValue <= 0) {
      toast.error("Informe o valor pago.");
      return;
    }

    try {
      setClinicExpensePayingId(entry.id);
      await payClinicExpense(entry.id, {
        paid_at: clinicExpensePaymentForm.paid_at,
        paid_amount_cents: Math.round(paidAmountValue * 100),
        payment_notes: clinicExpensePaymentForm.payment_notes.trim() || null,
      });
      toast.success(entry.paid_at ? "Pagamento atualizado com sucesso." : "Despesa marcada como paga.");
      setIsClinicExpensePaymentOpen(false);
      setClinicExpensePaymentForm(createEmptyClinicExpensePayment());
      loadClinicExpensesData();
    } catch (error) {
      toast.error(getUserFacingApiError(error, "Não foi possível salvar o pagamento."));
    } finally {
      setClinicExpensePayingId(null);
    }
  }, [clinicExpensePaymentForm, clinicExpensePayingId, loadClinicExpensesData]);

  const openClinicExpenseUnpayModal = useCallback((entry) => {
    if (!entry?.id) return;
    setClinicExpenseUnpayTarget(entry);
    setClinicExpenseUnpayReason("");
  }, []);

  const closeClinicExpenseUnpayModal = useCallback(() => {
    if (clinicExpensePayingId) return;
    setClinicExpenseUnpayTarget(null);
    setClinicExpenseUnpayReason("");
  }, [clinicExpensePayingId]);

  const handleUnpayClinicExpense = useCallback(
    async () => {
      if (!clinicExpenseUnpayTarget?.id || clinicExpensePayingId) return;
      const reason = clinicExpenseUnpayReason.trim();
      if (!reason) {
        toast.error("Informe o motivo para desfazer o pagamento.");
        return;
      }
      try {
        setClinicExpensePayingId(clinicExpenseUnpayTarget.id);
        await unpayClinicExpense(clinicExpenseUnpayTarget.id, { reason });
        toast.success("Pagamento desfeito.");
        setClinicExpenseUnpayTarget(null);
        setClinicExpenseUnpayReason("");
        loadClinicExpensesData();
      } catch (error) {
        toast.error(getUserFacingApiError(error, "Não foi possível desfazer o pagamento."));
      } finally {
        setClinicExpensePayingId(null);
      }
    },
    [clinicExpensePayingId, clinicExpenseUnpayReason, clinicExpenseUnpayTarget, loadClinicExpensesData],
  );

  const openClinicExpenseDeleteModal = useCallback((entry) => {
    setClinicExpenseDeleteTarget(entry || null);
  }, []);

  const closeClinicExpenseDeleteModal = useCallback(() => {
    if (isClinicExpenseDeleting) return;
    setClinicExpenseDeleteTarget(null);
  }, [isClinicExpenseDeleting]);

  const handleDeleteClinicExpense = useCallback(async () => {
    if (!clinicExpenseDeleteTarget?.id || isClinicExpenseDeleting) return;
    try {
      setIsClinicExpenseDeleting(true);
      await deleteClinicExpense(clinicExpenseDeleteTarget.id);
      toast.success("Despesa excluída com sucesso.");
      setClinicExpenseDeleteTarget(null);
      loadClinicExpensesData();
    } catch (error) {
      toast.error(getUserFacingApiError(error, "Não foi possível excluir a despesa."));
    } finally {
      setIsClinicExpenseDeleting(false);
    }
  }, [clinicExpenseDeleteTarget, isClinicExpenseDeleting, loadClinicExpensesData]);

  const openClinicExpenseCategoryModal = useCallback((category = null) => {
    if (category?.id) {
      setClinicExpenseCategoryForm({ name: category.name || "" });
      setEditingClinicExpenseCategoryId(category.id);
    } else {
      setClinicExpenseCategoryForm({ name: "" });
      setEditingClinicExpenseCategoryId(null);
    }
    setIsClinicExpenseCategoryOpen(true);
  }, []);

  const closeClinicExpenseCategoryModal = useCallback(() => {
    if (isClinicExpenseCategorySaving) return;
    setIsClinicExpenseCategoryOpen(false);
    setEditingClinicExpenseCategoryId(null);
  }, [isClinicExpenseCategorySaving]);

  const handleClinicExpenseCategoryChange = useCallback((event) => {
    const { name, value } = event.target;
    setClinicExpenseCategoryForm((prev) => ({ ...prev, [name]: value }));
  }, []);

  const handleSaveClinicExpenseCategory = useCallback(async () => {
    const name = clinicExpenseCategoryForm.name.trim();
    if (!name) {
      toast.error("Informe o nome da categoria.");
      return;
    }

    try {
      setIsClinicExpenseCategorySaving(true);
      if (editingClinicExpenseCategoryId) {
        await updateClinicExpenseCategory(editingClinicExpenseCategoryId, { name });
        toast.success("Categoria atualizada com sucesso.");
      } else {
        await createClinicExpenseCategory({ name });
        toast.success("Categoria cadastrada com sucesso.");
      }
      closeClinicExpenseCategoryModal();
      loadClinicExpenseCategoriesData();
    } catch (error) {
      toast.error(getUserFacingApiError(error, "Não foi possível salvar a categoria."));
    } finally {
      setIsClinicExpenseCategorySaving(false);
    }
  }, [
    clinicExpenseCategoryForm,
    closeClinicExpenseCategoryModal,
    editingClinicExpenseCategoryId,
    loadClinicExpenseCategoriesData,
  ]);

  const handleActivateClinicExpenseCategory = useCallback(async (category) => {
    if (!category?.id || clinicExpenseCategoryUpdatingId) return;
    try {
      setClinicExpenseCategoryUpdatingId(category.id);
      await activateClinicExpenseCategory(category.id);
      toast.success("Categoria ativada com sucesso.");
      loadClinicExpenseCategoriesData();
    } catch (error) {
      toast.error(getUserFacingApiError(error, "Não foi possível ativar a categoria."));
    } finally {
      setClinicExpenseCategoryUpdatingId(null);
    }
  }, [clinicExpenseCategoryUpdatingId, loadClinicExpenseCategoriesData]);

  const openClinicExpenseCategoryDeactivateModal = useCallback((category) => {
    setClinicExpenseCategoryDeactivateTarget(category || null);
  }, []);

  const closeClinicExpenseCategoryDeactivateModal = useCallback(() => {
    if (clinicExpenseCategoryUpdatingId) return;
    setClinicExpenseCategoryDeactivateTarget(null);
  }, [clinicExpenseCategoryUpdatingId]);

  const handleDeactivateClinicExpenseCategory = useCallback(async () => {
    if (!clinicExpenseCategoryDeactivateTarget?.id || clinicExpenseCategoryUpdatingId) return;
    try {
      setClinicExpenseCategoryUpdatingId(clinicExpenseCategoryDeactivateTarget.id);
      await deactivateClinicExpenseCategory(clinicExpenseCategoryDeactivateTarget.id);
      toast.success("Categoria desativada com sucesso.");
      setClinicExpenseCategoryDeactivateTarget(null);
      loadClinicExpenseCategoriesData();
    } catch (error) {
      toast.error(getUserFacingApiError(error, "Não foi possível desativar a categoria."));
    } finally {
      setClinicExpenseCategoryUpdatingId(null);
    }
  }, [clinicExpenseCategoryDeactivateTarget, clinicExpenseCategoryUpdatingId, loadClinicExpenseCategoriesData]);

  const handlePaymentChange = useCallback((event) => {
    const { name, value, type, checked } = event.target;
    if (name === "allocation_mode" && value !== "manual") {
      setPaymentAllocations({});
    }
    if (
      name === "amount"
      || name === "discount"
      || name === "surcharge"
      || name === "batch_discount_per_session"
    ) {
      setPaymentForm((prev) => ({
        ...prev,
        [name]: sanitizePositiveCurrencyInput(value),
      }));
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
    if (![
      "amount",
      "discount",
      "surcharge",
      "batch_discount_per_session",
    ].includes(name)) return;
    setPaymentForm((prev) => ({
      ...prev,
      [name]: formatCurrencyInput(prev[name]),
    }));
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

  useEffect(() => {
    const range =
      billingCyclesPeriodMode === "year"
        ? getYearRangeFromValue(billingCyclesPeriodYear)
        : getMonthRangeFromInputValue(billingCyclesPeriodMonth);

    if (!range) return;

    setBillingCyclesFilters((prev) => {
      if (prev.start === range.start && prev.end === range.end) return prev;
      return {
        ...prev,
        start: range.start,
        end: range.end,
      };
    });
  }, [billingCyclesPeriodMode, billingCyclesPeriodMonth, billingCyclesPeriodYear]);

  const handleBillingCyclesMonthPickerChange = useCallback((event) => {
    const { value } = event.target;
    const parsed = parseMonthInputValue(value);
    if (!parsed) return;
    setBillingCyclesPeriodMonth(value);
    setBillingCyclesPeriodYear(String(parsed.year));
  }, []);

  const handleBillingCyclesYearPickerChange = useCallback((event) => {
    const digits = String(event.target.value || "").replace(/\D/g, "").slice(0, 4);
    if (!digits) return;
    setBillingCyclesPeriodYear(digits);
    setBillingCyclesPeriodMonth((prev) => {
      const parsed = parseMonthInputValue(prev);
      if (!parsed) return `${digits}-01`;
      return `${digits}-${String(parsed.month).padStart(2, "0")}`;
    });
  }, []);

  const handleBillingCyclesPeriodModeChange = useCallback((mode) => {
    if (!["month", "year"].includes(mode)) return;
    setBillingCyclesPeriodMode(mode);
  }, []);

  const handleBillingCyclesPeriodTagClick = useCallback(() => {
    if (billingCyclesPeriodMode !== "month") return;
    const input = billingCyclesMonthPickerRef.current;
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
  }, [billingCyclesPeriodMode]);

  const shiftBillingCyclesPeriod = useCallback((direction) => {
    if (!Number.isFinite(direction) || direction === 0) return;
    if (billingCyclesPeriodMode === "year") {
      setBillingCyclesPeriodYear((prev) => {
        const baseYear = Number(String(prev || "").trim());
        const nextYear = Number.isInteger(baseYear)
          ? baseYear + direction
          : new Date().getFullYear() + direction;
        return String(nextYear);
      });
      return;
    }

    setBillingCyclesPeriodMonth((prev) => {
      const parsed = parseMonthInputValue(prev);
      const baseDate = parsed
        ? new Date(parsed.year, parsed.month - 1, 1)
        : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
      const target = new Date(baseDate.getFullYear(), baseDate.getMonth() + direction, 1);
      return toMonthInputValue(target);
    });
  }, [billingCyclesPeriodMode]);

  const handleBillingCyclesPreviousMonth = useCallback(() => {
    shiftBillingCyclesPeriod(-1);
  }, [shiftBillingCyclesPeriod]);

  const handleBillingCyclesNextMonth = useCallback(() => {
    shiftBillingCyclesPeriod(1);
  }, [shiftBillingCyclesPeriod]);

  const closeBillingCycleSessionsPreview = useCallback(() => {
    setBillingCycleSessionsPreview({
      open: false,
      cycle: null,
      sessions: [],
      isLoading: false,
      error: "",
    });
  }, []);

  const openBillingCycleSessionsPreview = useCallback(async (cycle) => {
    if (!cycle?.id) return;
    setBillingCycleSessionsPreview({
      open: true,
      cycle,
      sessions: [],
      isLoading: true,
      error: "",
    });

    try {
      const params = {};
      if (cycle.cycle_start) params.from = cycle.cycle_start;
      if (cycle.cycle_end) params.to = cycle.cycle_end;
      const response = await axios.get("/sessions", { params });
      const sessions = (Array.isArray(response.data) ? response.data : [])
        .filter((session) => String(session.billing_cycle_id || "") === String(cycle.id))
        .sort((first, second) => {
          const firstTime = first?.starts_at ? new Date(first.starts_at).getTime() : 0;
          const secondTime = second?.starts_at ? new Date(second.starts_at).getTime() : 0;
          return firstTime - secondTime;
        });
      setBillingCycleSessionsPreview((prev) => ({
        ...prev,
        sessions,
        isLoading: false,
      }));
    } catch (error) {
      setBillingCycleSessionsPreview((prev) => ({
        ...prev,
        isLoading: false,
        error: getUserFacingApiError(error, "Não foi possível carregar as sessões do ciclo."),
      }));
    }
  }, []);

  const applyCachedAttendanceDetail = useCallback(({ patientId, cacheKey, detail }) => {
    const normalizedPatientId = String(patientId);
    const patientIdNumber = Number(normalizedPatientId);
    const detailPatient = detail?.patient?.id
      ? {
        id: Number(detail.patient.id),
        full_name: detail.patient.name || "Paciente",
      }
      : null;

    if (detailPatient) {
      setPatients((prev) => {
        const map = new Map(prev.map((item) => [Number(item.id), item]));
        map.set(Number(detailPatient.id), {
          ...(map.get(Number(detailPatient.id)) || {}),
          ...detailPatient,
        });
        return Array.from(map.values());
      });
    }

    setEntries(Array.isArray(detail?.entries) ? detail.entries : []);
    setPayments(Array.isArray(detail?.payments) ? detail.payments : []);
    setPatientCredits(Array.isArray(detail?.credits) ? detail.credits : []);
    setAttendanceSeries(Array.isArray(detail?.series) ? detail.series : []);
    setAttendanceSessions(Array.isArray(detail?.sessions) ? detail.sessions : []);
    setAttendanceDetailPackages(Array.isArray(detail?.packages) ? detail.packages : []);
    setAttendanceDetailSummary({
      patientId: patientIdNumber,
      cacheKey,
      summary: detail?.summary || {},
    });
    setAttendanceBackendCreditByPatient((prev) => {
      const next = new Map(prev);
      const creditValue = Number(detail?.summary?.creditAvailable);
      if (Number.isFinite(creditValue)) {
        next.set(patientIdNumber, Math.max(0, creditValue));
      } else {
        next.delete(patientIdNumber);
      }
      return next;
    });
    setHasAttendanceLoaded(true);
    setAttendanceDetailSessions({
      patientId: normalizedPatientId,
      sessions: Array.isArray(detail?.sessions) ? detail.sessions : [],
      isLoading: false,
      error: "",
    });
  }, []);

  const invalidateAttendanceDetailCacheForPatient = useCallback((patientId) => {
    const patientIdNumber = Number(patientId || 0);
    if (!patientIdNumber) return;
    Array.from(attendanceDetailCacheRef.current.keys()).forEach((key) => {
      if (String(key).startsWith(`${patientIdNumber}:`)) {
        attendanceDetailCacheRef.current.delete(key);
      }
    });
  }, []);

  const handleViewPatientSessions = useCallback(async (patientId, options = {}) => {
    if (!patientId) return;
    const normalizedPatientId = String(patientId);
    const requestId = attendanceDetailRequestRef.current + 1;
    attendanceDetailRequestRef.current = requestId;
    const detailPeriodMode = attendancePeriodMode === "year" ? "year" : "month";
    const detailPeriod = detailPeriodMode === "year" ? attendancePeriodYear : attendancePeriodMonth;
    const detailCacheKey = buildAttendanceDetailCacheKey({
      patientId: normalizedPatientId,
      periodMode: detailPeriodMode,
      period: detailPeriod,
    });

    setAttendanceDrilldownPatientId(normalizedPatientId);
    if (!options.keepTab) setAttendanceDetailTab("charges");
    setSelectedAttendancePackageId(null);
    const summaryPatient = (revenuesSummary.patients || []).find(
      (item) => String(item.patient_id || "") === normalizedPatientId,
    );
    if (summaryPatient) {
      setPatients((prev) => {
        const map = new Map(prev.map((item) => [Number(item.id), item]));
        const patientIdNumber = Number(summaryPatient.patient_id);
        map.set(patientIdNumber, {
          ...(map.get(patientIdNumber) || {}),
          id: patientIdNumber,
          full_name: summaryPatient.patient_name || "Paciente",
        });
        return Array.from(map.values());
      });
    }
    const cachedDetail = detailCacheKey ? attendanceDetailCacheRef.current.get(detailCacheKey) : null;
    if (cachedDetail) {
      applyCachedAttendanceDetail({
        patientId: normalizedPatientId,
        cacheKey: detailCacheKey,
        detail: cachedDetail,
      });
      return;
    }
    setAttendanceDetailSessions({
      patientId: normalizedPatientId,
      sessions: [],
      isLoading: true,
      error: "",
    });
    setEntries([]);
    setPayments([]);
    setPatientCredits([]);
    setAttendanceSeries([]);
    setAttendanceSessions([]);
    setAttendanceDetailPackages([]);
    setAttendanceDetailSummary(null);

    try {
      const response = await getFinancialRevenuePatientDetail(
        normalizedPatientId,
        detailPeriod,
        detailPeriodMode,
      );
      if (attendanceDetailRequestRef.current !== requestId) return;
      const detail = response.data || {};
      if (detailCacheKey) {
        attendanceDetailCacheRef.current.set(detailCacheKey, detail);
      }
      const detailPatient = detail.patient?.id
        ? {
          id: Number(detail.patient.id),
          full_name: detail.patient.name || "Paciente",
        }
        : null;

      if (detailPatient) {
        setPatients((prev) => {
          const map = new Map(prev.map((item) => [Number(item.id), item]));
          map.set(Number(detailPatient.id), {
            ...(map.get(Number(detailPatient.id)) || {}),
            ...detailPatient,
          });
          return Array.from(map.values());
        });
      }

      setEntries(Array.isArray(detail.entries) ? detail.entries : []);
      setPayments(Array.isArray(detail.payments) ? detail.payments : []);
      setPatientCredits(Array.isArray(detail.credits) ? detail.credits : []);
      setAttendanceSeries(Array.isArray(detail.series) ? detail.series : []);
      setAttendanceSessions(Array.isArray(detail.sessions) ? detail.sessions : []);
      setAttendanceDetailPackages(Array.isArray(detail.packages) ? detail.packages : []);
      setAttendanceDetailSummary({
        patientId: Number(normalizedPatientId),
        cacheKey: detailCacheKey,
        summary: detail.summary || {},
      });
      setAttendanceBackendCreditByPatient((prev) => {
        const next = new Map(prev);
        const creditValue = Number(detail.summary?.creditAvailable);
        const patientIdNumber = Number(normalizedPatientId);
        if (Number.isFinite(creditValue)) {
          next.set(patientIdNumber, Math.max(0, creditValue));
        } else {
          next.delete(patientIdNumber);
        }
        return next;
      });
      setHasAttendanceLoaded(true);
      setAttendanceDetailSessions({
        patientId: normalizedPatientId,
        sessions: Array.isArray(detail.sessions) ? detail.sessions : [],
        isLoading: false,
        error: "",
      });
    } catch (error) {
      if (attendanceDetailRequestRef.current !== requestId) return;
      setAttendanceDetailSessions({
        patientId: normalizedPatientId,
        sessions: [],
        isLoading: false,
        error: getUserFacingApiError(
          error,
          "Não foi possível carregar os detalhes deste paciente.",
        ) || "Não foi possível carregar os detalhes deste paciente.",
      });
    }
  }, [
    applyCachedAttendanceDetail,
    attendancePeriodMode,
    attendancePeriodMonth,
    attendancePeriodYear,
    revenuesSummary.patients,
  ]);

  const handleClosePatientSessions = useCallback(() => {
    attendanceDetailRequestRef.current += 1;
    setAttendanceDrilldownPatientId(null);
    setAttendanceDetailTab("charges");
    setSelectedAttendancePackageId(null);
    setAttendanceDetailSessions({
      patientId: null,
      sessions: [],
      isLoading: false,
      error: "",
    });
    setAttendanceDetailPackages([]);
    setAttendanceDetailSummary(null);
  }, []);

  useEffect(() => {
    if (!attendanceDrilldownPatientId) return;
    if (attendanceDetailSessions.isLoading || attendanceDetailSessions.error) return;
    const { mode, period } = getAttendanceDetailPeriod({
      periodMode: attendancePeriodMode,
      periodMonth: attendancePeriodMonth,
      periodYear: attendancePeriodYear,
    });
    const cacheKey = buildAttendanceDetailCacheKey({
      patientId: attendanceDrilldownPatientId,
      periodMode: mode,
      period,
    });
    if (!cacheKey || attendanceDetailSummary?.cacheKey === cacheKey) return;
    handleViewPatientSessions(attendanceDrilldownPatientId, { keepTab: true });
  }, [
    attendanceDetailSessions.error,
    attendanceDetailSessions.isLoading,
    attendanceDetailSummary?.cacheKey,
    attendanceDrilldownPatientId,
    attendancePeriodMode,
    attendancePeriodMonth,
    attendancePeriodYear,
    handleViewPatientSessions,
  ]);

  const handleViewBillingCyclesPatient = useCallback((patientId) => {
    if (!patientId) return;
    setBillingCyclesDrilldownPatientId(String(patientId));
  }, []);

  const handleCloseBillingCyclesPatient = useCallback(() => {
    setBillingCyclesDrilldownPatientId(null);
  }, []);

  const handleOpenPackageSessions = useCallback(async (item) => {
    if (!item?.id) return;
    setSelectedAttendancePackageId(String(item.id));

    if (item.kind !== "series" || !item.sourceId || !selectedAttendancePatientId) return;

    setAttendanceDetailSessions((prev) => ({
      ...prev,
      patientId: String(selectedAttendancePatientId),
      isLoading: true,
      error: "",
    }));

    try {
      const response = await axios.get("/sessions", {
        params: {
          patient_id: selectedAttendancePatientId,
          series_id: item.sourceId,
        },
      });
      const seriesSessions = Array.isArray(response.data) ? response.data : [];
      const mergeSessions = (current) => {
        const map = new Map();
        current.forEach((session) => {
          if (session?.id) map.set(Number(session.id), session);
        });
        seriesSessions.forEach((session) => {
          if (session?.id) map.set(Number(session.id), session);
        });
        return Array.from(map.values()).sort(
          (first, second) => new Date(first.starts_at || 0) - new Date(second.starts_at || 0),
        );
      };

      setAttendanceSessions((prev) => mergeSessions(prev));
      setAttendanceDetailSessions((prev) => ({
        ...prev,
        patientId: String(selectedAttendancePatientId),
        sessions: mergeSessions(prev.sessions || []),
        isLoading: false,
        error: "",
      }));
    } catch (error) {
      setAttendanceDetailSessions((prev) => ({
        ...prev,
        patientId: String(selectedAttendancePatientId),
        isLoading: false,
        error: getUserFacingApiError(error, "Não foi possível carregar as sessões deste pacote."),
      }));
    }
  }, [selectedAttendancePatientId]);

  const handleClosePackageSessions = useCallback(() => {
    setSelectedAttendancePackageId(null);
  }, []);

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

  const handleMethodChange = useCallback((event) => {
    const { name, value } = event.target;
    setMethodForm((prev) => ({ ...prev, [name]: value }));
  }, []);

  // Contrato legado preservado para a view dedicada de Recebimentos desabilitada.
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
        throw new Error("Não foi possível preparar o recebimento por sessão.");
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
    const batchDiscountPerSessionValue = parseCurrencyInputToNumber(
      paymentForm.batch_discount_per_session,
    );
    const amountCents = Math.round(amountValue * 100);
    const isSessionBatchPayment = Boolean(paymentModalContext?.sessionBatch);
    const sessionBatchSessionIds = Array.isArray(paymentModalContext?.sessionBatch?.sessionIds)
      ? paymentModalContext.sessionBatch.sessionIds
      : [];
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
    const batchSessions = Array.isArray(paymentModalContext?.sessionBatch?.sessions)
      ? paymentModalContext.sessionBatch.sessions
      : [];
    const batchOriginalTotalCents = batchSessions.reduce(
      (sum, session) => sum + Math.max(0, Number(session.openCents || session.amountCents || 0)),
      0,
    );
    const batchDiscountPerSessionCents =
      Number.isFinite(batchDiscountPerSessionValue) && batchDiscountPerSessionValue > 0
        ? Math.round(batchDiscountPerSessionValue * 100)
        : 0;
    const batchDiscountCents = (() => {
      if (!isSessionBatchPayment || !batchSessions.length) return 0;
      return batchDiscountPerSessionCents * batchSessions.length;
    })();
    const batchFinalChargedCents = Math.max(0, batchOriginalTotalCents - batchDiscountCents);
    const hasAdjustment = !isSimplifiedInstallmentPayment
      && (
        (!isSessionBatchPayment && paymentForm.entry_id && (discountCents > 0 || surchargeCents > 0))
        || (isSessionBatchPayment && batchDiscountCents > 0)
      );
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
    if (isSessionBatchPayment && !sessionBatchSessionIds.length) {
      toast.error("Selecione as sessões do lote.");
      return;
    }
    if (isSessionBatchPayment && Number.isFinite(batchDiscountPerSessionValue) && batchDiscountPerSessionValue < 0) {
      toast.error("Desconto por sessão não pode ser negativo.");
      return;
    }
    if (Number.isFinite(discountValue) && discountValue < 0) {
      toast.error("Desconto não pode ser negativo.");
      return;
    }
    if (Number.isFinite(surchargeValue) && surchargeValue < 0) {
      toast.error("Acréscimo não pode ser negativo.");
      return;
    }
    if (paymentForm.entry_id && discountCents > baseCentsForValidation) {
      toast.error("O desconto não pode ser maior que o valor original.");
      return;
    }
    if (isSessionBatchPayment && batchDiscountCents > batchOriginalTotalCents) {
      toast.error("O desconto do lote não pode ser maior que o valor original.");
      return;
    }
    if (
      isSessionBatchPayment
      && batchDiscountCents > 0
      && effectiveAmountCents !== batchFinalChargedCents
    ) {
      toast.error("Valor recebido deve ser igual ao total final do lote com desconto.");
      return;
    }
    if (paymentForm.entry_id && paymentForm.convert_entry_to_installments && isAlreadyInstallmentCharge) {
      toast.error("Esta cobrança já está parcelada. Registre apenas a quitação.");
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
      let allocationMode = paymentForm.entry_id
        ? "entry"
        : paymentForm.allocation_mode || "none";
      const hasOpenEntriesForSelectedPatient = entries.some((entry) => {
        if (entry.type !== "income" || Number(entry.patient_id) !== selectedPatientId) return false;
        const financial = entryFinancialMap.get(entry.id);
        const open = financial?.open ?? Math.max(0, Number(entry.amount_cents || 0));
        const status = financial?.status || entry.status;
        return open > 0 && status !== "canceled";
      });
      if (!paymentForm.entry_id && !isSessionBatchPayment && allocationMode !== "manual" && !hasOpenEntriesForSelectedPatient) {
        allocationMode = "credit";
      }
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

      if (allocationMode === "manual" && !isSessionBatchPayment) {
        if (!allocationItems.length) {
          toast.error("Informe as cobranças para alocar.");
          return;
        }
        if (allocationTotal > effectiveAmountCents) {
          toast.error("O valor distribuído não pode ser maior que o recebimento.");
          return;
        }
      }

      const paidAtDateValue = String(paymentForm.paid_at || "").slice(0, 10);
      const paidAtIso = isSimplifiedInstallmentPayment && paymentModalContext?.installmentDueDate
        ? new Date(`${String(paymentModalContext.installmentDueDate).slice(0, 10)}T09:00:00`).toISOString()
        : new Date(`${paidAtDateValue}T09:00:00`).toISOString();

      if (isSessionBatchPayment) {
        const adjustmentReason = paymentForm.note.trim() || "Desconto aplicado no recebimento em lote";
        await createFinancialPayment({
          patient_id: selectedPatientId,
          origin: "session_batch",
          payment_method_id: selectedPaymentMethodId,
          amount_cents: effectiveAmountCents,
          paid_at: paidAtIso,
          note: paymentForm.note.trim() || null,
          allocation_mode: "manual",
          session_batch_session_ids: sessionBatchSessionIds,
          discount_cents: batchDiscountCents || undefined,
          adjustment_reason: batchDiscountCents
            ? adjustmentReason
            : undefined,
        });

        toast.success("Recebimento em lote registrado.");
        closePaymentModal();
        setPaymentAllocations({});
        invalidateAttendanceDetailCacheForPatient(selectedPatientId);
        await Promise.all([
          loadRevenuesData(),
          loadRevenuesSummary(),
        ]);
        if (attendanceDrilldownPatientId && Number(attendanceDrilldownPatientId) === selectedPatientId) {
          await handleViewPatientSessions(selectedPatientId, { keepTab: true });
        }
        if (hasBillingCyclesLoaded) loadBillingCycles();
        return;
      }

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

      const adjustmentReason = paymentForm.note.trim() || "Ajuste aplicado no recebimento";

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
        adjustment_reason: hasAdjustment ? adjustmentReason : undefined,
        adjustment: hasAdjustment
          ? {
            discount_cents: discountCents,
            surcharge_cents: surchargeCents,
            reason: adjustmentReason,
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
      invalidateAttendanceDetailCacheForPatient(selectedPatientId);
      await Promise.all([
        loadRevenuesData(),
        loadRevenuesSummary(),
      ]);
      if (attendanceDrilldownPatientId && Number(attendanceDrilldownPatientId) === selectedPatientId) {
        await handleViewPatientSessions(selectedPatientId, { keepTab: true });
      }
      if (hasBillingCyclesLoaded) loadBillingCycles();
    } catch (error) {
      toast.error(
        getUserFacingApiError(
          error,
          "Não foi possível registrar o recebimento. Tente novamente em instantes.",
        ),
      );
    } finally {
      setIsPaymentSaving(false);
    }
  }, [
    isPaymentSaving,
    paymentForm,
    paymentAllocations,
    entries,
    entryFinancialMap,
    entryMap,
    paymentModalContext,
    createStandalonePaymentAnchor,
    closePaymentModal,
    attendanceDrilldownPatientId,
    handleViewPatientSessions,
    invalidateAttendanceDetailCacheForPatient,
    loadRevenuesData,
    loadRevenuesSummary,
    loadBillingCycles,
    hasBillingCyclesLoaded,
  ]);

  // eslint-disable-next-line no-unused-vars -- Preservado para a visão dedicada de Recebimentos.
  const handleApplyCreditToEntry = useCallback(
    async (entryId) => {
      try {
        const affectedEntry = entryMap.get(Number(entryId || 0));
        const affectedPatientId = Number(affectedEntry?.patient_id || 0);
        await applyCreditToFinancialEntry(entryId);
        invalidateAttendanceDetailCacheForPatient(affectedPatientId);
        toast.success("Crédito aplicado na cobrança.");
        await Promise.all([
          loadRevenuesData(),
          loadRevenuesSummary(),
          loadAttendance(),
        ]);
        if (attendanceDrilldownPatientId && Number(attendanceDrilldownPatientId) === affectedPatientId) {
          await handleViewPatientSessions(affectedPatientId, { keepTab: true });
        }
      } catch (error) {
        toast.error("Não foi possível usar o crédito.");
      }
    },
    [
      attendanceDrilldownPatientId,
      entryMap,
      handleViewPatientSessions,
      invalidateAttendanceDetailCacheForPatient,
      loadAttendance,
      loadRevenuesData,
      loadRevenuesSummary,
    ],
  );

  const attendanceRows = useMemo(() => {
    const search = normalizeSearchText(attendanceFilters.search);
    return attendanceSessions
      .map((session) => {
        const entry = entryBySessionId.get(session.id) || null;
        const patient =
          session?.Patient ||
          (session?.patient_id ? patientMap.get(Number(session.patient_id)) : null) ||
          selectedAttendancePatient ||
          null;
        const patientName = getPatientDisplayName(patient);
        const professionalName =
          session?.professional?.name || session?.professional?.email || "-";
        const serviceName =
          session?.Service?.name ||
          session?.service_type ||
          "Servico";
        const serviceId = session?.Service?.id || session?.service_id || null;
        const price = serviceId ? servicePriceMap.get(serviceId) : null;
        const sessionStatus = String(session?.status || "").toLowerCase();
        const isCanceledWithoutEntry = !entry && sessionStatus === "canceled";
        const originalAmountCents = entry?.amount_cents ?? price?.price_cents ?? 0;
        const amountCents = isCanceledWithoutEntry
          ? 0
          : originalAmountCents;
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
        const adjustment = entry ? adjustmentByEntryId.get(entry.id) : null;
        const discountCents = Math.max(0, Number(adjustment?.discountCents || 0));
        const surchargeCents = Math.max(0, Number(adjustment?.surchargeCents || 0));
        const hasAdjustment = discountCents > 0 || surchargeCents > 0;
        const paidCents = isCanceledWithoutEntry ? 0 : entryFinancial?.paid ?? 0;
        const openCents =
          isCanceledWithoutEntry
            ? 0
            : entryFinancial?.open ?? Math.max(0, Number(amountCents || 0) - paidCents);
        let status = "missing";
        if (isCanceledWithoutEntry) {
          status = "canceled";
        } else if (entry) {
          status = entryFinancial?.status || entry.status || "pending";
        }
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

        const billingMode = session.billing_mode || "per_session";

        return {
          id: session.id,
          starts_at: session.starts_at,
          patientId: session.patient_id,
          patientName,
          professionalId:
            Number(session?.professional?.id || session?.professional_user_id || 0) || null,
          professionalName,
          serviceId,
          serviceName,
          seriesId: session.series_id || session?.series?.id || null,
          patientCreditId: session.patient_credit_id || session?.PatientCredit?.id || null,
          recurrence: formatRecurrence(session),
          billing_mode: billingMode,
          amountCents,
          displayAmountCents: hasAdjustment && paidCents > 0 ? paidCents : amountCents,
          originalAmountCents,
          discountCents,
          surchargeCents,
          hasAdjustment,
          adjustmentReason: adjustment?.reason || null,
          paidCents,
          openCents: effectiveOpenCents,
          entry,
          financialStatus: status,
          isCanceledWithoutEntry,
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
      .filter((row) => row.billing_mode === "per_session")
      .filter((row) => !!row.entry?.id)
      .filter((row) => {
        if (attendanceDrilldownPatientId) return true;
        if (!search) return true;
        const haystack = normalizeSearchText(row.patientName);
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
    attendanceDrilldownPatientId,
    attendanceSessions,
    adjustmentByEntryId,
    entryBySessionId,
    entryFinancialMap,
    formatRecurrence,
    patientMap,
    paymentMethodMap,
    paymentsByEntryId,
    servicePriceMap,
    selectedAttendancePatient,
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

  const attendanceVisibleCredits = useMemo(() => {
    const search = normalizeSearchText(attendanceFilters.search);
    const selectedPatientId = normalizeId(attendanceFilters.patient_id);

    return patientCredits.filter((credit) => {
      const patientId = Number(credit.patient_id || 0);
      if (!patientId) return false;
      if (selectedPatientId && patientId !== selectedPatientId) return false;

      const patient = credit.Patient || patientMap.get(patientId);
      if (search && !getPatientSearchText(patient).includes(search)) return false;

      const sourceEntry = credit.FinancialEntry || (credit.source_entry_id
        ? entryMap.get(credit.source_entry_id)
        : null);
      const financial = sourceEntry?.id ? entryFinancialMap.get(sourceEntry.id) : null;
      const financialStatus = financial?.status || sourceEntry?.status || (sourceEntry ? "pending" : "missing");
      if (attendanceFilters.financial === "pending" && financialStatus !== "pending") return false;
      if (attendanceFilters.financial === "partial" && financialStatus !== "partial") return false;
      if (attendanceFilters.financial === "paid" && financialStatus !== "paid") return false;
      if (attendanceFilters.financial === "missing" && financialStatus !== "missing") return false;
      const referenceDate = sourceEntry?.reference_date || credit.created_at || credit.updated_at;
      return !referenceDate || isDateOnlyWithinRange(
        referenceDate,
        attendanceFilters.start,
        attendanceFilters.end,
      );
    });
  }, [
    attendanceFilters.end,
    attendanceFilters.financial,
    attendanceFilters.patient_id,
    attendanceFilters.search,
    attendanceFilters.start,
    entryFinancialMap,
    entryMap,
    patientCredits,
    patientMap,
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
      if (attendanceDrilldownPatientId) return true;
      if (!search) return true;
      const haystack = normalizeSearchText(row.patientName);
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
      if (linkedSession?.billing_mode === "covered_by_plan") return;
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
          patientName: getPatientDisplayName(patient),
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

    return [...attendanceVisibleRows, ...supplementalRows]
      .sort((a, b) => new Date(a.starts_at || 0) - new Date(b.starts_at || 0));
  }, [
    attendanceFilters.end,
    attendanceFilters.financial,
    attendanceFilters.patient_id,
    attendanceFilters.professional_id,
    attendanceFilters.search,
    attendanceFilters.start,
    attendanceDrilldownPatientId,
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
    attendanceVisibleCredits.forEach((credit) => {
      const patientId = Number(credit.patient_id || 0);
      if (!patientId) return;
      const patient = credit.Patient || patientMap.get(patientId);
      const sourceEntry = credit.FinancialEntry || (credit.source_entry_id
        ? entryMap.get(credit.source_entry_id)
        : null);
      const financial = sourceEntry?.id ? entryFinancialMap.get(sourceEntry.id) : null;
      const amountCents = Number(sourceEntry?.amount_cents || 0);
      const paidCents = Math.min(amountCents, Number(financial?.paid || 0));
      const openCents = Math.max(0, Number(financial?.open ?? amountCents - paidCents));
      const existing = map.get(patientId);
      const base = existing || {
        patientId,
        patientName: getPatientDisplayName(patient),
        sessions: 0,
        totalCents: 0,
        openCents: 0,
        paidCents: 0,
        lastSession: sourceEntry?.reference_date || credit.created_at,
      };
      base.sessions += Number(credit.total_sessions || 0);
      base.totalCents += amountCents;
      base.openCents += openCents;
      base.paidCents += paidCents;
      map.set(patientId, base);
    });

    attendanceVisibleRows.forEach((row) => {
      if (!row.patientId) return;
      if (row.patientCreditId) return;
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

    return Array.from(map.values())
      .map((item) => {
        return {
          ...item,
          creditsAvailable: creditBalanceByPatient.get(item.patientId) || 0,
        };
      })
      .sort((a, b) => collator.compare(a.patientName || "", b.patientName || ""));
  }, [
    attendanceVisibleCredits,
    attendanceVisibleRows,
    creditBalanceByPatient,
    entryFinancialMap,
    entryMap,
    patientMap,
  ]);

  const attendanceSelectedPatientSummary = useMemo(() => {
    if (!selectedAttendancePatientId) return null;

    const patientSummary =
      attendanceByPatient.find((item) => item.patientId === selectedAttendancePatientId) || null;
    const sessionRows = attendanceSessionRows.filter(
      (row) => Number(row.patientId || 0) === selectedAttendancePatientId,
    );

    const patientName = selectedAttendancePatient
      ? getPatientDisplayName(selectedAttendancePatient)
      : patientSummary?.patientName || "Paciente";
    const { mode: detailPeriodMode, period: detailPeriod } = getAttendanceDetailPeriod({
      periodMode: attendancePeriodMode,
      periodMonth: attendancePeriodMonth,
      periodYear: attendancePeriodYear,
    });
    const currentDetailCacheKey = buildAttendanceDetailCacheKey({
      patientId: selectedAttendancePatientId,
      periodMode: detailPeriodMode,
      period: detailPeriod,
    });
    const currentDetailSummary =
      attendanceDetailSummary?.patientId === selectedAttendancePatientId
        && attendanceDetailSummary?.cacheKey === currentDetailCacheKey
        ? attendanceDetailSummary.summary || null
        : null;
    const hasBackendCredit = attendanceBackendCreditByPatient.has(selectedAttendancePatientId);
    const backendCredit = hasBackendCredit
      ? attendanceBackendCreditByPatient.get(selectedAttendancePatientId)
      : null;
    const fallbackCredit =
      creditBalanceByPatient.get(selectedAttendancePatientId) || patientSummary?.creditsAvailable || 0;

    return {
      patientId: selectedAttendancePatientId,
      patientName,
      sessions: patientSummary?.sessions || sessionRows.length,
      openCents: currentDetailSummary
        ? Number(currentDetailSummary.pending || 0)
        : sessionRows.reduce(
          (sum, row) => {
            if (row.isManualReceiptRow || !row.entry?.id) return sum;
            return sum + Math.max(0, Number(row.openCents || 0));
          },
          0,
        ),
      creditsAvailable: backendCredit ?? fallbackCredit,
    };
  }, [
    attendanceBackendCreditByPatient,
    attendanceByPatient,
    attendanceDetailSummary,
    attendancePeriodMode,
    attendancePeriodMonth,
    attendancePeriodYear,
    attendanceSessionRows,
    creditBalanceByPatient,
    selectedAttendancePatient,
    selectedAttendancePatientId,
  ]);

  const attendanceSelectedPatientRows = useMemo(() => {
    if (!selectedAttendancePatientId) return [];
    return attendanceSessionRows.filter(
      (row) => Number(row.patientId || 0) === selectedAttendancePatientId,
    );
  }, [attendanceSessionRows, selectedAttendancePatientId]);

  const attendanceSelectedPatientPackages = useMemo(() => {
    if (!selectedAttendancePatientId) return [];

    const sessionsBySeriesId = new Map();
    const detailSessionsById = new Map();
    attendanceDetailSessions.sessions.forEach((session) => {
      if (session?.id) detailSessionsById.set(Number(session.id), session);
      const seriesId = Number(session?.series_id || session?.series?.id || 0);
      if (!seriesId) return;
      const list = sessionsBySeriesId.get(seriesId) || [];
      list.push(session);
      sessionsBySeriesId.set(seriesId, list);
    });

    const detailPackagesBySeriesId = new Map();
    attendanceDetailPackages.forEach((item) => {
      const seriesId = Number(item?.series_id || item?.sourceId || item?.source_id || 0);
      if (!seriesId) return;
      detailPackagesBySeriesId.set(seriesId, item);
    });

    const readPackageNumber = (item, keys, fallback = 0) => {
      if (!item) return fallback;
      const key = keys.find((candidate) =>
        Object.prototype.hasOwnProperty.call(item, candidate));
      if (!key) return fallback;
      const value = Number(item[key] || 0);
      return Number.isFinite(value) ? value : fallback;
    };

    const normalizePackageEntries = (backendPackage, fallbackEntries) => {
      if (!Array.isArray(backendPackage?.entries)) return fallbackEntries;
      return backendPackage.entries
        .map((entry) => ({
          entryId: Number(entry?.entryId || entry?.entry_id || entry?.id || 0),
          openCents: Number(entry?.openCents ?? entry?.open_cents ?? entry?.open ?? 0),
        }))
        .filter((entry) => entry.entryId > 0 && entry.openCents > 0);
    };

    const mergeUsageSummary = (localUsage, backendPackage) => {
      const backendUsage = backendPackage?.usage_summary || backendPackage?.usageSummary || null;
      if (!backendUsage) return localUsage;
      return {
        ...localUsage,
        scheduled: Number(backendUsage.scheduled ?? localUsage.scheduled ?? 0),
        done: Number(backendUsage.done ?? localUsage.done ?? 0),
        noShow: Number(backendUsage.noShow ?? backendUsage.no_show ?? localUsage.noShow ?? 0),
        canceledWithoutCharge: Number(
          backendUsage.canceledWithoutCharge
            ?? backendUsage.canceled_without_charge
            ?? localUsage.canceledWithoutCharge
            ?? 0,
        ),
      };
    };

    const seriesPackages = attendanceSeries
      .filter((series) => {
        if (Number(series.patient_id || 0) !== selectedAttendancePatientId) return false;
        if (series.patient_plan_id) return false;
        return true;
      })
      .map((series) => {
        const seriesId = Number(series.id || 0);
        const backendPackage = detailPackagesBySeriesId.get(seriesId) || null;
        const backendServiceName = backendPackage?.service_name || backendPackage?.serviceName || null;
        const service =
          backendPackage?.Service ||
          backendPackage?.service ||
          (backendServiceName ? { name: backendServiceName } : null) ||
          series?.Service ||
          (series.service_id ? serviceMap.get(series.service_id) : null) ||
          null;
        const backendPackageSessions = Array.isArray(backendPackage?.sessions)
          ? backendPackage.sessions
          : [];
        const packageSessions = (backendPackageSessions.length
          ? backendPackageSessions
          : (sessionsBySeriesId.get(seriesId) || []))
          .sort((first, second) => new Date(first.starts_at || 0) - new Date(second.starts_at || 0));
        const seriesRows = attendanceSelectedPatientRows.filter(
          (row) => Number(row.seriesId || 0) === seriesId,
        );
        const localTotalSessions = Number(series.occurrence_count || 0) || packageSessions.length;
        const totalSessions = readPackageNumber(
          backendPackage,
          ["total_sessions", "totalSessions"],
          localTotalSessions,
        );
        const localUsedSessions = packageSessions.filter(
          (session) => String(session.status || "").toLowerCase() === "done",
        ).length;
        const usedSessions = readPackageNumber(
          backendPackage,
          ["used_sessions", "usedSessions"],
          localUsedSessions,
        );
        const referenceDate =
          backendPackage?.reference_date ||
          backendPackage?.referenceDate ||
          packageSessions[0]?.starts_at ||
          series.starts_at ||
          null;
        const localContractedAmountCents = seriesRows.reduce(
          (sum, row) => sum + Number(row.originalAmountCents || row.amountCents || 0),
          0,
        );
        const localAmountCents = seriesRows.reduce((sum, row) => sum + Number(row.amountCents || 0), 0);
        const localPaidCents = seriesRows.reduce((sum, row) => sum + Number(row.paidCents || 0), 0);
        const localOpenCents = seriesRows.reduce((sum, row) => sum + Number(row.openCents || 0), 0);
        const contractedAmountCents = readPackageNumber(
          backendPackage,
          ["contracted_amount_cents", "contractedAmountCents"],
          localContractedAmountCents,
        );
        const amountCents = readPackageNumber(
          backendPackage,
          ["amount_cents", "amountCents"],
          localAmountCents,
        );
        const paidCents = readPackageNumber(
          backendPackage,
          ["paid_cents", "paidCents"],
          localPaidCents,
        );
        const openCents = readPackageNumber(
          backendPackage,
          ["open_cents", "openCents"],
          localOpenCents,
        );
        const financialStatus = resolveGroupedFinancialStatus(amountCents, paidCents, openCents);
        const usageSummary = seriesRows.reduce(
          (usageAcc, row) => {
            const rowStatus = String(row.financialStatus || "").toLowerCase();
            return {
              ...usageAcc,
              paid: rowStatus === "paid" ? usageAcc.paid + 1 : usageAcc.paid,
              canceledWithoutCharge: row.isCanceledWithoutEntry
                ? usageAcc.canceledWithoutCharge + 1
                : usageAcc.canceledWithoutCharge,
            };
          },
          { paid: 0, canceledWithoutCharge: 0 },
        );
        packageSessions.forEach((session) => {
          const statusValue = String(session?.status || "").toLowerCase();
          if (statusValue === "scheduled") usageSummary.scheduled = (usageSummary.scheduled || 0) + 1;
          if (statusValue === "done") usageSummary.done = (usageSummary.done || 0) + 1;
          if (statusValue === "no_show") usageSummary.noShow = (usageSummary.noShow || 0) + 1;
        });
        const entriesById = new Map();
        seriesRows.forEach((row) => {
          const entryId = Number(row.entry?.id || 0);
          const rowOpenCents = Math.max(0, Number(row.openCents || 0));
          if (!entryId || rowOpenCents <= 0) return;
          entriesById.set(entryId, (entriesById.get(entryId) || 0) + rowOpenCents);
        });
        const fallbackEntries = Array.from(entriesById.entries()).map(([entryId, entryOpenCents]) => ({
          entryId,
          openCents: entryOpenCents,
        }));
        const packageEntries = normalizePackageEntries(backendPackage, fallbackEntries);

        return {
          id: `series-${seriesId}`,
          sourceId: seriesId,
          kind: "series",
          serviceName: service?.name || "Pacote de sessões",
          referenceDate,
          totalSessions,
          usedSessions,
          balance: Math.max(0, totalSessions - usedSessions),
          expiresAt: backendPackage?.expires_at || backendPackage?.expiresAt || series.until_date || null,
          contractedAmountCents,
          amountCents,
          paidCents,
          openCents,
          financialStatus:
            backendPackage?.financial_status ||
            backendPackage?.financialStatus ||
            financialStatus,
          usageSummary: mergeUsageSummary(usageSummary, backendPackage),
          entries: packageEntries,
          sessions: packageSessions,
        };
      })
      .filter(Boolean)
      .sort((first, second) => String(first.serviceName || "").localeCompare(String(second.serviceName || "")));

    const standalonePackages = attendanceSelectedPatientRows
      .filter((row) => {
        if (row.seriesId || row.patientCreditId) return false;
        if (row.isManualReceiptRow || row.isProjectedInstallmentRow) return false;
        if (!row.entry?.id) return false;
        return Number(row.id || 0) > 0;
      })
      .map((row) => {
        const sessionId = Number(row.id || 0);
        const linkedSession = detailSessionsById.get(sessionId) || sessionById.get(sessionId) || {
          id: sessionId,
          starts_at: row.starts_at,
          service_id: row.serviceId,
          status: row.financialStatus === "paid" ? "done" : "scheduled",
          professional: { name: row.professionalName },
        };
        const linkedSessionStatus = String(linkedSession.status || "").toLowerCase();
        const isDone = linkedSessionStatus === "done";
        const financialStatus = resolveGroupedFinancialStatus(
          row.amountCents,
          row.paidCents,
          row.openCents,
        );

        return {
          id: `session-${sessionId}`,
          sourceId: sessionId,
          kind: "single",
          serviceName: row.serviceName || "Sessão individual",
          referenceDate: linkedSession.starts_at || row.starts_at || null,
          totalSessions: 1,
          usedSessions: isDone ? 1 : 0,
          balance: isDone ? 0 : 1,
          expiresAt: null,
          contractedAmountCents: Number(row.originalAmountCents || row.amountCents || 0),
          amountCents: Number(row.amountCents || 0),
          paidCents: Number(row.paidCents || 0),
          openCents: Number(row.openCents || 0),
          financialStatus,
          usageSummary: {
            scheduled: linkedSessionStatus === "scheduled" ? 1 : 0,
            done: isDone ? 1 : 0,
            noShow: linkedSessionStatus === "no_show" ? 1 : 0,
            canceledWithoutCharge: row.isCanceledWithoutEntry ? 1 : 0,
          },
          entries: row.entry?.id && Number(row.openCents || 0) > 0
            ? [{ entryId: Number(row.entry.id), openCents: Number(row.openCents || 0) }]
            : [],
          sessions: [linkedSession],
        };
      });

    const matchesSelectedPeriod = (item) => {
      const referenceDate = item?.referenceDate;
      if (!referenceDate) return true;
      return isDateOnlyWithinRange(
        String(referenceDate).slice(0, 10),
        attendanceFilters.start,
        attendanceFilters.end,
      );
    };

    return [...seriesPackages, ...standalonePackages].filter(matchesSelectedPeriod).sort((first, second) => {
      const firstDate = new Date(first.referenceDate || 0).getTime();
      const secondDate = new Date(second.referenceDate || 0).getTime();
      const safeFirstDate = Number.isNaN(firstDate) ? 0 : firstDate;
      const safeSecondDate = Number.isNaN(secondDate) ? 0 : secondDate;
      if (safeFirstDate === safeSecondDate) {
        return String(first.serviceName || "").localeCompare(String(second.serviceName || ""));
      }
      return safeFirstDate - safeSecondDate;
    });
  }, [
    attendanceDetailPackages,
    attendanceDetailSessions.sessions,
    attendanceSelectedPatientRows,
    attendanceSeries,
    attendanceFilters.end,
    attendanceFilters.start,
    selectedAttendancePatientId,
    serviceMap,
    sessionById,
  ]);

  const selectedAttendancePackage = useMemo(() => {
    if (!selectedAttendancePackageId) return null;
    return attendanceSelectedPatientPackages.find(
      (item) => String(item.id) === String(selectedAttendancePackageId),
    ) || null;
  }, [attendanceSelectedPatientPackages, selectedAttendancePackageId]);

  const attendanceSelectedPatientReceipts = useMemo(() => {
    if (!selectedAttendancePatientId) return [];

    return payments
      .map((payment) => {
        const allocations =
          payment?.FinancialPaymentAllocations ||
          payment?.financial_payment_allocations ||
          [];
        const paymentPatientId = Number(payment?.patient_id || 0);
        const isDirectPatientPayment = paymentPatientId === selectedAttendancePatientId;
        const patientAllocations = allocations.filter((allocation) => {
          const entry =
            allocation.FinancialEntry ||
            allocation.financial_entry ||
            entryMap.get(allocation.entry_id);
          return Number(entry?.patient_id || 0) === selectedAttendancePatientId;
        });

        if (!isDirectPatientPayment && patientAllocations.length === 0) return null;

        const amountCents = Number(payment.amount_cents || 0);
        const paymentMethod = payment.payment_method_id
          ? paymentMethodMap.get(payment.payment_method_id)
          : null;

        return {
          payment,
          amountCents,
          paymentMethodName: paymentMethod?.name || "-",
        };
      })
      .filter(Boolean)
      .sort((first, second) => new Date(second.payment?.paid_at || 0) - new Date(first.payment?.paid_at || 0));
  }, [
    entryMap,
    paymentMethodMap,
    payments,
    selectedAttendancePatientId,
  ]);

  const attendanceSummary = useMemo(() => {
    const data = {
      total: 0,
      openSessions: 0,
      openPatients: attendanceByPatient.filter((row) => Number(row.openCents || 0) > 0).length,
      pendingAmount: 0,
      paidAmount: 0,
      expectedAmount: 0,
      creditsAvailable: 0,
    };

    attendanceByPatient.forEach((row) => {
      data.total += Number(row.sessions || 0);
      data.expectedAmount += Number(row.totalCents || 0);
      data.paidAmount += Number(row.paidCents || 0);
      data.pendingAmount += Number(row.openCents || 0);
      if (Number(row.openCents || 0) > 0) data.openSessions += Number(row.sessions || 0);
    });

    creditBalanceByPatient.forEach((value) => {
      data.creditsAvailable += value;
    });

    return data;
  }, [attendanceByPatient, creditBalanceByPatient]);

  const aggregatedAttendanceByPatient = useMemo(
    () => mapRevenuesSummaryPatientsToAttendanceRows(revenuesSummary),
    [revenuesSummary],
  );

  const aggregatedAttendanceSummary = useMemo(
    () => mapRevenuesSummaryToAttendanceSummary(revenuesSummary),
    [revenuesSummary],
  );

  const resolveBillingCycleFinancial = useCallback((cycle) => {
    if (cycle?.is_no_charge === true) {
      return {
        entry: null,
        amount: 0,
        paid: 0,
        open: 0,
        status: "no_charge",
      };
    }

    const entry = cycle?.FinancialEntry || (cycle?.financial_entry_id
      ? entryMap.get(cycle.financial_entry_id)
      : null);
    const financial = entry?.id ? entryFinancialMap.get(entry.id) : null;
    const amount = Number(cycle?.amount_cents || entry?.amount_cents || financial?.amount || 0);
    const paid = Math.min(amount, Number(financial?.paid || 0));
    const open = Math.max(0, Number(financial?.open ?? amount - paid));
    let status = financial?.status || entry?.status || cycle?.status || "pending";

    if (status === "pending" && open > 0 && entry?.due_date) {
      const dueDate = parseDateInputBoundary(String(entry.due_date).slice(0, 10), "end");
      const today = parseDateInputBoundary(toDateInputValue(new Date()), "end");
      if (dueDate && today && dueDate.getTime() < today.getTime()) {
        status = "overdue";
      }
    }

    return { entry, amount, paid, open, status };
  }, [entryFinancialMap, entryMap]);

  const billingCyclesBaseRows = useMemo(() => {
    return billingCycles
      .filter((cycle) => {
        if (!isDateOnlyWithinRange(
          cycle.cycle_start,
          billingCyclesFilters.start,
          billingCyclesFilters.end,
        )) {
          return false;
        }
        const financial = resolveBillingCycleFinancial(cycle);
        const { status } = financial;
        if (billingCyclesStatusFilter !== "all" && status !== billingCyclesStatusFilter) {
          return false;
        }
        return true;
      })
      .sort((a, b) => String(b.cycle_start || "").localeCompare(String(a.cycle_start || "")));
  }, [
    billingCycles,
    billingCyclesFilters.end,
    billingCyclesFilters.start,
    billingCyclesStatusFilter,
    resolveBillingCycleFinancial,
  ]);

  const billingCyclesFilteredRows = useMemo(() => {
    const search = normalizeSearchText(billingCyclesFilters.search);
    if (!search) return billingCyclesBaseRows;
    return billingCyclesBaseRows.filter((cycle) =>
      getPatientSearchText(cycle.Patient).includes(search));
  }, [
    billingCyclesBaseRows,
    billingCyclesFilters.search,
  ]);

  const billingCyclesByPatient = useMemo(() => {
    const map = new Map();

    billingCyclesFilteredRows.forEach((cycle) => {
      const patientId = Number(cycle.patient_id || cycle.Patient?.id || 0);
      const key = patientId || `patient-${cycle.Patient ? getPatientDisplayName(cycle.Patient) : "sem-paciente"}`;
      const patientName = cycle.Patient ? getPatientDisplayName(cycle.Patient) : "Paciente";
      const financial = resolveBillingCycleFinancial(cycle);
      const current = map.get(key) || {
        key,
        patientId,
        patientName,
        cycles: 0,
        amountCents: 0,
        paidCents: 0,
        openCents: 0,
        noChargeCycles: 0,
      };

      current.cycles += 1;
      if (financial.status === "no_charge") {
        current.noChargeCycles += 1;
      }
      if (financial.status !== "canceled" && financial.status !== "no_charge") {
        current.amountCents += financial.amount;
        current.paidCents += financial.paid;
        current.openCents += financial.open;
      }
      map.set(key, current);
    });

    return Array.from(map.values()).sort((a, b) =>
      String(a.patientName || "").localeCompare(String(b.patientName || ""), "pt-BR", {
        sensitivity: "base",
      }));
  }, [billingCyclesFilteredRows, resolveBillingCycleFinancial]);

  const selectedBillingCyclesPatient = useMemo(() => {
    const patientId = normalizeId(billingCyclesDrilldownPatientId);
    if (!patientId) return null;
    return patientMap.get(patientId) || null;
  }, [billingCyclesDrilldownPatientId, patientMap]);

  const selectedBillingCyclesPatientRows = useMemo(() => {
    const patientId = normalizeId(billingCyclesDrilldownPatientId);
    if (!patientId) return [];
    return billingCyclesBaseRows.filter((cycle) =>
      Number(cycle.patient_id || cycle.Patient?.id || 0) === patientId);
  }, [billingCyclesBaseRows, billingCyclesDrilldownPatientId]);

  const selectedBillingCyclesPatientSummary = useMemo(() => {
    const patientId = normalizeId(billingCyclesDrilldownPatientId);
    if (!patientId) return null;

    const groupedSummary = billingCyclesByPatient.find((item) => item.patientId === patientId);
    const fallbackCycle = selectedBillingCyclesPatientRows[0] || null;
    const patientName = selectedBillingCyclesPatient
      ? getPatientDisplayName(selectedBillingCyclesPatient)
      : groupedSummary?.patientName || (fallbackCycle?.Patient ? getPatientDisplayName(fallbackCycle.Patient) : "Paciente");
    const selectedTotals = selectedBillingCyclesPatientRows.reduce((acc, cycle) => {
      const financial = resolveBillingCycleFinancial(cycle);
      if (financial.status === "canceled" || financial.status === "no_charge") return acc;
      return {
        amountCents: acc.amountCents + financial.amount,
        paidCents: acc.paidCents + financial.paid,
        openCents: acc.openCents + financial.open,
      };
    }, {
      amountCents: 0,
      paidCents: 0,
      openCents: 0,
    });

    return {
      patientId,
      patientName,
      cycles: selectedBillingCyclesPatientRows.length,
      amountCents: selectedTotals.amountCents,
      paidCents: selectedTotals.paidCents,
      openCents: selectedTotals.openCents,
    };
  }, [
    billingCyclesByPatient,
    billingCyclesDrilldownPatientId,
    resolveBillingCycleFinancial,
    selectedBillingCyclesPatient,
    selectedBillingCyclesPatientRows,
  ]);

  const handleSharedPaymentSaved = useCallback(async ({ patientId }) => {
    invalidateAttendanceDetailCacheForPatient(patientId);
    await Promise.all([
      loadRevenuesData(),
      loadRevenuesSummary(),
    ]);
    if (attendanceDrilldownPatientId && Number(attendanceDrilldownPatientId) === patientId) {
      await handleViewPatientSessions(patientId, { keepTab: true });
    }
    if (hasBillingCyclesLoaded) loadBillingCycles();
  }, [
    attendanceDrilldownPatientId,
    handleViewPatientSessions,
    hasBillingCyclesLoaded,
    invalidateAttendanceDetailCacheForPatient,
    loadBillingCycles,
    loadRevenuesData,
    loadRevenuesSummary,
  ]);

  const financialPaymentFlow = useFinancialPaymentFlow({
    onPaymentSaved: handleSharedPaymentSaved,
  });
  const { openScopedPatientPaymentModal } = financialPaymentFlow;

  const openAttendanceScopedPaymentModal = useCallback(async () => {
    if (!attendanceSelectedPatientSummary) return;
    await ensureRevenueOperationalData();

    const entryMapById = new Map();
    const sourcePackages = attendanceSelectedPatientPackages.length > 0
      ? attendanceSelectedPatientPackages
      : [];

    if (sourcePackages.length > 0) {
      sourcePackages.forEach((item) => {
        (item.entries || []).forEach((entryItem) => {
          const entryId = Number(entryItem.entryId || 0);
          const openCents = Math.max(0, Number(entryItem.openCents || 0));
          if (!entryId || openCents <= 0) return;
          entryMapById.set(entryId, {
            entryId,
            openCents: (entryMapById.get(entryId)?.openCents || 0) + openCents,
          });
        });
      });
    } else {
      attendanceSelectedPatientRows.forEach((row) => {
        if (row.isManualReceiptRow || row.isProjectedInstallmentRow) return;
        const entryId = Number(row.entry?.id || 0);
        const openCents = Math.max(0, Number(row.openCents || 0));
        if (!entryId || openCents <= 0) return;
        entryMapById.set(entryId, {
          entryId,
          openCents: (entryMapById.get(entryId)?.openCents || 0) + openCents,
        });
      });
    }

    const entriesToReceive = [...entryMapById.values()];
    const totalOpenCents = sourcePackages.length > 0
      ? sourcePackages.reduce((sum, item) => sum + Math.max(0, Number(item.openCents || 0)), 0)
      : entriesToReceive.reduce((sum, item) => sum + Number(item.openCents || 0), 0);

    openScopedPatientPaymentModal(
      selectedAttendancePatient || {
        id: attendanceSelectedPatientSummary.patientId,
        full_name: attendanceSelectedPatientSummary.patientName,
      },
      {
        type: "per_session",
        label: "Por sessao",
        patientId: attendanceSelectedPatientSummary.patientId,
        patientName: attendanceSelectedPatientSummary.patientName,
        totalOpenCents,
        entries: entriesToReceive,
      },
    );
  }, [
    attendanceSelectedPatientPackages,
    attendanceSelectedPatientRows,
    attendanceSelectedPatientSummary,
    ensureRevenueOperationalData,
    openScopedPatientPaymentModal,
	    selectedAttendancePatient,
	  ]);

  const openAttendanceCreditUseModal = useCallback(() => {
    if (!attendanceSelectedPatientSummary) return;

    const creditAvailableCents = Math.max(
      0,
      Number(attendanceSelectedPatientSummary.creditsAvailable || 0),
    );
    const openCents = Math.max(0, Number(attendanceSelectedPatientSummary.openCents || 0));
    if (creditAvailableCents <= 0 || openCents <= 0) return;

    const parsedPeriodMonth = parseMonthInputValue(attendancePeriodMonth);
    let periodLabel = "";
    if (attendancePeriodMode === "year") {
      periodLabel = attendancePeriodYear || "";
    } else if (parsedPeriodMonth) {
      periodLabel = formatMonthYear(new Date(parsedPeriodMonth.year, parsedPeriodMonth.month - 1, 1));
    }

    setCreditUseModalContext({
      patientId: attendanceSelectedPatientSummary.patientId,
      patientName: attendanceSelectedPatientSummary.patientName,
      creditAvailableCents,
      openCents,
      periodStart: attendanceFilters.start,
      periodEnd: attendanceFilters.end,
      periodLabel,
    });
  }, [
    attendanceFilters.end,
    attendanceFilters.start,
    attendancePeriodMode,
    attendancePeriodMonth,
    attendancePeriodYear,
    attendanceSelectedPatientSummary,
  ]);

  const creditUsePreview = useMemo(() => {
    if (!creditUseModalContext) return null;
    const creditAvailableCents = Math.max(
      0,
      Number(creditUseModalContext.creditAvailableCents || 0),
    );
    const openCents = Math.max(0, Number(creditUseModalContext.openCents || 0));
    const creditToUseCents = Math.min(creditAvailableCents, openCents);

    return {
      creditAvailableCents,
      openCents,
      creditToUseCents,
      openAfterCents: Math.max(0, openCents - creditToUseCents),
      creditRemainingCents: Math.max(0, creditAvailableCents - creditToUseCents),
    };
  }, [creditUseModalContext]);

  const handleConfirmCreditUse = useCallback(async () => {
    if (!creditUseModalContext || !creditUsePreview || isCreditUseSaving) return;

    setIsCreditUseSaving(true);
    try {
      await applyScopedFinancialCredit({
        patient_id: creditUseModalContext.patientId,
        allocation_scope: "per_session_current_period",
        period_start: creditUseModalContext.periodStart,
        period_end: creditUseModalContext.periodEnd,
      });
      toast.success("Crédito aplicado nas cobranças pendentes.");
      invalidateAttendanceDetailCacheForPatient(creditUseModalContext.patientId);
      setCreditUseModalContext(null);
      await loadRevenuesData();
      await loadRevenuesSummary();
      await loadAttendance();
      if (
        attendanceDrilldownPatientId
        && Number(attendanceDrilldownPatientId) === Number(creditUseModalContext.patientId)
      ) {
        await handleViewPatientSessions(creditUseModalContext.patientId, { keepTab: true });
      }
    } catch (error) {
      toast.error(getUserFacingApiError(error, "Não foi possível usar o crédito."));
    } finally {
      setIsCreditUseSaving(false);
    }
  }, [
    attendanceDrilldownPatientId,
    creditUseModalContext,
    creditUsePreview,
    handleViewPatientSessions,
    invalidateAttendanceDetailCacheForPatient,
    isCreditUseSaving,
    loadAttendance,
    loadRevenuesData,
    loadRevenuesSummary,
  ]);

  const openBillingCyclesScopedPaymentModal = useCallback(() => {
    if (!selectedBillingCyclesPatientSummary) return;

    const entriesToReceive = selectedBillingCyclesPatientRows
      .map((cycle) => {
        const financial = resolveBillingCycleFinancial(cycle);
        const entryId = Number(financial.entry?.id || cycle.financial_entry_id || 0);
        const openCents = Math.max(0, Number(financial.open || 0));
        if (!entryId || openCents <= 0 || financial.status === "canceled") return null;
        return { entryId, openCents };
      })
      .filter(Boolean);
    const totalOpenCents = entriesToReceive.reduce((sum, item) => sum + Number(item.openCents || 0), 0);
    if (totalOpenCents <= 0 || entriesToReceive.length === 0) return;

    openScopedPatientPaymentModal(
      selectedBillingCyclesPatient || {
        id: selectedBillingCyclesPatientSummary.patientId,
        full_name: selectedBillingCyclesPatientSummary.patientName,
      },
      {
        type: "billing_cycles",
        label: "Mensalidades",
        patientId: selectedBillingCyclesPatientSummary.patientId,
        patientName: selectedBillingCyclesPatientSummary.patientName,
        totalOpenCents,
        entries: entriesToReceive,
      },
    );
  }, [
    openScopedPatientPaymentModal,
    resolveBillingCycleFinancial,
    selectedBillingCyclesPatient,
    selectedBillingCyclesPatientRows,
    selectedBillingCyclesPatientSummary,
  ]);

  const billingCyclesSummary = useMemo(() => {
    const activePlanIds = new Set();
    const data = {
      activePlans: 0,
      expectedCents: 0,
      paidCents: 0,
      pendingCents: 0,
    };

    billingCyclesFilteredRows.forEach((cycle) => {
      if (cycle.status !== "canceled" && cycle.patient_plan_id) {
        activePlanIds.add(cycle.patient_plan_id);
      }
      const financial = resolveBillingCycleFinancial(cycle);
      if (financial.status === "canceled" || financial.status === "no_charge") return;
      data.expectedCents += financial.amount;
      data.paidCents += financial.paid;
      data.pendingCents += financial.open;
    });

    data.activePlans = activePlanIds.size;
    return data;
  }, [billingCyclesFilteredRows, resolveBillingCycleFinancial]);

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

  const billingCyclesPeriodLabel = useMemo(() => {
    if (billingCyclesPeriodMode === "year") {
      return billingCyclesPeriodYear || "";
    }
    const parsed = parseMonthInputValue(billingCyclesPeriodMonth);
    if (!parsed) return "";
    return formatMonthYear(new Date(parsed.year, parsed.month - 1, 1));
  }, [billingCyclesPeriodMode, billingCyclesPeriodMonth, billingCyclesPeriodYear]);

  const billingCyclesYearOptions = useMemo(() => {
    const nowYear = new Date().getFullYear();
    const currentYear = Number(String(billingCyclesPeriodYear || "").trim()) || nowYear;
    const years = [];
    for (let year = currentYear - 5; year <= currentYear + 5; year += 1) {
      years.push(String(year));
    }
    return years;
  }, [billingCyclesPeriodYear]);

  // Preview legado preservado para a view dedicada de Recebimentos desabilitada.
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
    const batchDiscountPerSessionNumber = parseCurrencyInputToNumber(
      paymentForm.batch_discount_per_session,
    );
    const sessionBatchSessions = Array.isArray(paymentModalContext?.sessionBatch?.sessions)
      ? paymentModalContext.sessionBatch.sessions
      : [];
    const sessionBatchCount = sessionBatchSessions.length;
    const sessionBatchOriginalTotalCents = sessionBatchSessions.reduce(
      (sum, session) => sum + Math.max(0, Number(session.openCents || session.amountCents || 0)),
      0,
    );
    const sessionBatchTotalOpenCents = Math.max(
      0,
      Number(paymentModalContext?.sessionBatch?.totalOpenCents || sessionBatchOriginalTotalCents || 0),
    );

    const receivedCents =
      Number.isFinite(amountNumber) && amountNumber > 0 ? Math.round(amountNumber * 100) : 0;
    const discountCents =
      Number.isFinite(discountNumber) && discountNumber > 0 ? Math.round(discountNumber * 100) : 0;
    const surchargeCents =
      Number.isFinite(surchargeNumber) && surchargeNumber > 0
        ? Math.round(surchargeNumber * 100)
        : 0;
    const batchDiscountPerSessionCents =
      Number.isFinite(batchDiscountPerSessionNumber) && batchDiscountPerSessionNumber > 0
        ? Math.round(batchDiscountPerSessionNumber * 100)
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
    } else if (sessionBatchTotalOpenCents > 0) {
      baseCents = sessionBatchTotalOpenCents;
    } else if (paymentForm.allocation_mode === "manual" && manualAllocationTotal > 0) {
      baseCents = manualAllocationTotal;
    }

    let effectiveDiscountCents = discountCents;
    let batchFinalPerSessionCents = sessionBatchCount > 0
      ? Math.floor(baseCents / Math.max(1, sessionBatchCount))
      : 0;
    if (!paymentForm.entry_id && sessionBatchCount > 0) {
      if (batchDiscountPerSessionCents > 0) {
        effectiveDiscountCents = batchDiscountPerSessionCents * sessionBatchCount;
        batchFinalPerSessionCents = Math.max(
          0,
          Math.floor((baseCents - effectiveDiscountCents) / Math.max(1, sessionBatchCount)),
        );
      }
    }

    const finalChargedCents = Math.max(0, baseCents - effectiveDiscountCents + surchargeCents);
    const openAfterCents = Math.max(0, finalChargedCents - receivedCents);
    const creditAfterCents = Math.max(0, receivedCents - finalChargedCents);
    const hasAdjustment = effectiveDiscountCents > 0 || surchargeCents > 0;
    const batchOriginalPerSessionCents = sessionBatchCount > 0
      ? Math.floor(baseCents / Math.max(1, sessionBatchCount))
      : 0;

    return {
      baseCents,
      receivedCents,
      discountCents: effectiveDiscountCents,
      surchargeCents,
      finalChargedCents,
      openAfterCents,
      creditAfterCents,
      hasAdjustment,
      batchOriginalTotalCents: baseCents,
      batchOriginalPerSessionCents,
      batchDiscountPerSessionCents,
      batchFinalPerSessionCents,
      batchSessionCount: sessionBatchCount,
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
    paymentForm.batch_discount_per_session,
    paymentForm.entry_id,
    paymentForm.entry_installments_count,
    paymentForm.surcharge,
    paymentModalContext,
  ]);

  const isSimplifiedInstallmentPayment = Boolean(paymentModalContext?.simplifiedInstallment);
  const isSessionBatchPayment = Boolean(paymentModalContext?.sessionBatch);
  const selectedChargeAmountCents = useMemo(() => {
    if (!paymentForm.entry_id) return 0;
    const entryId = Number(paymentForm.entry_id);
    const entryAmountCents = Number(entryMap.get(entryId)?.amount_cents || 0);
    if (entryAmountCents > 0) return entryAmountCents;
    return Math.max(0, Number(paymentPreview.baseCents || 0));
  }, [entryMap, paymentForm.entry_id, paymentPreview.baseCents]);
  const sessionBatchBalanceLabel = useMemo(() => {
    if (paymentPreview.creditAfterCents > 0) return "Saldo em crédito";
    if (paymentPreview.openAfterCents > 0) return "Falta receber";
    return "Diferenca";
  }, [paymentPreview.creditAfterCents, paymentPreview.openAfterCents]);

  const paymentModalSubtitle = useMemo(() => {
    if (isSimplifiedInstallmentPayment) {
      return "Confirmacao simples da parcela pendente.";
    }
    if (isSessionBatchPayment) {
      return paymentModalContext?.sessionBatch?.patientName || "Paciente";
    }
    if (paymentForm.entry_id && paymentPreview.originalInstallmentsCount > 1) {
      return "";
    }
    return "";
  }, [
    isSimplifiedInstallmentPayment,
    isSessionBatchPayment,
    paymentModalContext,
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
      loadPaymentMethodsData();
    } catch (error) {
      toast.error("Não foi possível salvar a forma de pagamento.");
    }
  }, [methodForm, closeMethodModal, loadPaymentMethodsData, editingMethodId]);

  const handleToggleMethod = useCallback(
    async (method) => {
      try {
        await updatePaymentMethod(method.id, { is_active: !method.is_active });
        loadPaymentMethodsData();
      } catch (error) {
        toast.error("Não foi possível atualizar a forma de pagamento.");
      }
    },
    [loadPaymentMethodsData],
  );

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
          patient ? getPatientDisplayName(patient) : "",
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

  const renderOverview = () => (
    <FinancialOverviewSection
      ui={{
        Spinner,
        AttendanceSectionSurface,
        AttendancePeriodBlock,
        AttendancePeriodBlockLeft,
        AttendancePeriodBlockLabel,
        AttendancePeriodBlockValue,
        AttendancePeriodBlockRight,
        AttendanceTabGroup,
        AttendanceTabButton,
        AttendancePeriodControls,
        AttendancePeriodButton,
        AttendancePeriodChip,
        AttendancePeriodMonthInput,
        AttendanceCard,
        AttendanceCardHeader,
        AttendanceCardTitle,
        OverviewSummaryGrid,
        OverviewSummaryColumn,
        OverviewSummaryHeader,
        AttendanceMetricCard,
        AttendanceMetricLabel,
        AttendanceMetricValue,
        AttendanceEmptyState,
        BlockLoader,
      }}
      loading={loadingOverview}
      overview={overviewSummary}
      overviewMonth={clinicExpensesMonth}
      overviewMonthLabel={overviewMonthLabel}
      overviewPeriodMode={overviewPeriodMode}
      formatCurrency={formatCurrency}
      handleOverviewMonthChange={handleClinicExpenseMonthChange}
      handleOverviewPeriodModeChange={handleOverviewPeriodModeChange}
      handleOverviewPreviousMonth={handleOverviewPreviousMonth}
      handleOverviewNextMonth={handleOverviewNextMonth}
    />
  );

  const renderClinicExpenses = () => (
    <ClinicExpensesSection
      ui={{
        Spinner,
        AttendanceSectionSurface,
        AttendancePeriodBlock,
        AttendancePeriodBlockLeft,
        AttendancePeriodBlockLabel,
        AttendancePeriodBlockValue,
        AttendancePeriodBlockRight,
        AttendanceTabGroup,
        AttendanceTabButton,
        AttendancePeriodControls,
        AttendancePeriodButton,
        AttendancePeriodChip,
        AttendancePeriodMonthInput,
        AttendanceCard,
        AttendanceCardHeader,
        AttendanceCardTitle,
        AttendanceMetricsGrid,
        AttendanceMetricCard,
        AttendanceMetricLabel,
        AttendanceMetricValue,
        AttendanceFilterGrid,
        AttendanceFilterField,
        AttendanceFilterLabel,
        AttendanceFilterSelect,
        AttendanceFilterInput,
        AttendanceTableCard,
        AttendanceDetailHeader,
        AttendanceDetailTitle,
        AttendanceTableScroll,
        AttendanceOverviewTable,
        AttendanceCellStack,
        AttendancePrimaryText,
        AttendanceStatusBadge,
        AttendanceRowActions,
        AttendanceEmptyState,
        AttendancePrimaryAction,
        BlockLoader,
        ActionMenu,
        ActionMenuTrigger,
        ActionMenuList,
        ActionMenuItem,
        closeActionMenu,
        handleActionMenuToggle,
      }}
      loading={loadingExpenses}
      clinicExpenses={clinicExpenses}
      clinicExpensesSummary={clinicExpensesSummary}
      clinicExpenseCategories={clinicExpenseCategories}
      clinicExpensesMonth={clinicExpensesMonth}
      clinicExpensesMonthLabel={clinicExpensesPeriodLabel}
      clinicExpensesPeriodMode={clinicExpensesPeriodMode}
      clinicExpensesFilters={clinicExpensesFilters}
      clinicExpensePayingId={clinicExpensePayingId}
      formatCurrency={formatCurrency}
      formatDateOnlyBR={formatExpenseDateOnlyBR}
      getClinicExpenseStatus={getClinicExpenseStatus}
      handleClinicExpenseMonthChange={handleClinicExpenseMonthChange}
      handleClinicExpensesPeriodModeChange={handleClinicExpensesPeriodModeChange}
      handleClinicExpensesPreviousPeriod={handleClinicExpensesPreviousPeriod}
      handleClinicExpensesNextPeriod={handleClinicExpensesNextPeriod}
      handleClinicExpensesFilterChange={handleClinicExpensesFilterChange}
      openClinicExpensePaymentModal={openClinicExpensePaymentModal}
      openClinicExpenseUnpayModal={openClinicExpenseUnpayModal}
      openClinicExpenseModal={openClinicExpenseModal}
      openClinicExpenseDeleteModal={openClinicExpenseDeleteModal}
      getClinicExpenseObservation={getClinicExpenseObservation}
      getClinicExpensePaidAmountCents={getClinicExpensePaidAmountCents}
    />
  );

  const renderClinicExpenseCategories = () => (
    <ClinicExpenseCategoriesSection
      ui={{
        Section,
        SectionHeader,
        SectionTitle,
        SectionSubtitle,
        PrimaryButton,
        SectionLoader,
        Spinner,
        EmptyState,
        TableScroll,
        EntriesTable,
        FinancialStatusPill,
        RowActions,
        SmallButton,
      }}
      loading={loadingExpenseCategories}
      categories={clinicExpenseCategories}
      onNew={() => openClinicExpenseCategoryModal()}
      onEdit={openClinicExpenseCategoryModal}
      onActivate={handleActivateClinicExpenseCategory}
      onDeactivate={openClinicExpenseCategoryDeactivateModal}
      updatingId={clinicExpenseCategoryUpdatingId}
    />
  );

  const renderAttendance = () => {
    const useAggregatedRevenues = canUseAggregatedRevenuesSummary;
    const displayAttendanceRows = useAggregatedRevenues
      ? aggregatedAttendanceByPatient
      : attendanceByPatient;
    let displayAttendanceSummary = useAggregatedRevenues
      ? aggregatedAttendanceSummary
      : attendanceSummary;
    const currentPatientDetailSummary =
      attendanceDrilldownPatientId
      && attendanceDetailSummary?.patientId === Number(attendanceDrilldownPatientId)
        ? attendanceDetailSummary.summary || null
        : null;
    if (currentPatientDetailSummary) {
      displayAttendanceSummary = {
        ...displayAttendanceSummary,
        total: attendanceSelectedPatientPackages.reduce(
          (sum, item) => sum + Number(item.totalSessions || 0),
          0,
        ),
        expectedAmount: Number(currentPatientDetailSummary.total || 0),
        paidAmount: Number(currentPatientDetailSummary.received || 0),
        pendingAmount: Number(currentPatientDetailSummary.pending || 0),
      };
    }
    const isAttendanceInitialLoading = useAggregatedRevenues
      ? loadingRevenuesSummary
      : isAttendanceLoading && !hasAttendanceLoaded;
    const isAttendanceSummaryLoading = isAttendanceInitialLoading
      || (Boolean(attendanceDrilldownPatientId) && attendanceDetailSessions.isLoading);
    const isAttendanceRefreshing = isAttendanceLoading && hasAttendanceLoaded;
    const periodSuffix = attendancePeriodLabel ? ` - ${attendancePeriodLabel}` : "";
    const attendanceTitle = `Resumo por paciente${periodSuffix}`;

    let attendanceContent = (
      <AttendanceEmptyState>Sem atendimentos no periodo.</AttendanceEmptyState>
    );

    if (revenuesSummaryError && useAggregatedRevenues) {
      attendanceContent = (
        <AttendanceEmptyState>{revenuesSummaryError}</AttendanceEmptyState>
      );
    } else if (displayAttendanceRows.length > 0) {
      attendanceContent = (
        <AttendanceTableCard>
          <AttendanceTableScroll>
            <AttendanceOverviewTable>
              <thead>
                <tr>
                  <th>Paciente</th>
                  <th>Valor</th>
                  <th>A receber</th>
                  <th>Recebido</th>
                  <th>Credito</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {displayAttendanceRows.map((row) => (
                  <PatientSummaryRow key={row.patientId} $hasOpen={row.openCents > 0}>
                    <td>
                      <AttendanceCellStack>
                        <AttendancePatientSummaryName $hasOpen={row.openCents > 0}>
                          {row.patientName}
                        </AttendancePatientSummaryName>
                      </AttendanceCellStack>
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
                          Detalhes
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

    const attendanceDetailPatientSummary = attendanceSelectedPatientSummary || (
      attendanceDrilldownPatientId
        ? (() => {
          const summaryPatient = (revenuesSummary.patients || []).find(
            (item) => String(item.patient_id || "") === String(attendanceDrilldownPatientId),
          );
          return {
            patientId: Number(attendanceDrilldownPatientId),
            patientName: summaryPatient?.patient_name || "Paciente",
            sessions: Number(summaryPatient?.entries_count || 0),
            openCents: Number(summaryPatient?.pending || 0),
            creditsAvailable: 0,
          };
        })()
        : null
    );

    if (attendanceDrilldownPatientId && attendanceDetailPatientSummary) {
      let packageContent = <AttendanceEmptyState>Nenhum pacote de sessões encontrado para este paciente.</AttendanceEmptyState>;

      if (attendanceDetailSessions.isLoading) {
        packageContent = <AttendanceEmptyState>Carregando pacotes do paciente...</AttendanceEmptyState>;
      } else if (attendanceDetailSessions.error) {
        packageContent = <AttendanceEmptyState>{attendanceDetailSessions.error}</AttendanceEmptyState>;
      } else if (attendanceSelectedPatientPackages.length > 0) {
        packageContent = (
          <BillingCyclesInnerTableCard>
            <AttendanceTableScroll>
              <BillingCyclesTable $detail>
                <thead>
                  <tr>
                    <th>Data</th>
                    <th>Serviço</th>
                    <th>Sessões</th>
                    <th>Valor</th>
                    <th>Recebido</th>
                    <th>A receber</th>
                    <th>Status</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {attendanceSelectedPatientPackages.map((item) => (
                    <PatientSummaryRow key={item.id} $hasOpen={item.openCents > 0}>
                      <td>
                        <AttendancePrimaryText>
                          {formatDateOnlyBR(item.referenceDate)}
                        </AttendancePrimaryText>
                      </td>
                      <td>
                        <AttendancePrimaryText>{item.serviceName}</AttendancePrimaryText>
                      </td>
                      <td>
                        <AttendancePrimaryText>
                          {item.displaySessionsLabel || `${item.usedSessions}/${item.totalSessions}`}
                        </AttendancePrimaryText>
                      </td>
                      <td>
                        <AttendanceMoneyText>
                          {item.amountCents ? formatCurrency(item.amountCents) : "Sem cobrança gerada"}
                        </AttendanceMoneyText>
                      </td>
                      <td>
                        <AttendanceMoneyText>{formatCurrency(item.paidCents)}</AttendanceMoneyText>
                      </td>
                      <td>
                        <AttendanceOpenAmountValue $hasOpen={item.openCents > 0}>
                          {formatCurrency(item.openCents)}
                        </AttendanceOpenAmountValue>
                      </td>
                      <td>
                        <AttendanceStatusBadge $status={item.financialStatus}>
                          {item.amountCents ? formatFinancialStatus(item.financialStatus) : "Sem cobrança"}
                        </AttendanceStatusBadge>
                      </td>
                      <td>
                        {item.kind === "entry" ? (
                          <AttendancePrimaryText>-</AttendancePrimaryText>
                        ) : (
                          <AttendanceRowActions>
                            <AttendanceSmallAction
                              type="button"
                              onClick={() => handleOpenPackageSessions(item)}
                            >
	                              Sessões
                            </AttendanceSmallAction>
                          </AttendanceRowActions>
                        )}
                      </td>
                    </PatientSummaryRow>
                  ))}
                </tbody>
              </BillingCyclesTable>
            </AttendanceTableScroll>
          </BillingCyclesInnerTableCard>
        );
      } else if (attendanceSelectedPatientRows.length > 0) {
        packageContent = (
          <AttendanceEmptyState>
            Este paciente possui receitas por sessão no período, mas não há pacote vinculado encontrado.
          </AttendanceEmptyState>
        );
      }

      const receiptsContent = attendanceSelectedPatientReceipts.length === 0 ? (
        <AttendanceEmptyState>Nenhum recebimento registrado para este paciente.</AttendanceEmptyState>
      ) : (
        <BillingCyclesInnerTableCard>
          <AttendanceTableScroll>
            <BillingCyclesTable $detail>
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Valor recebido</th>
                  <th>Forma</th>
                  <th>Observações</th>
                </tr>
              </thead>
              <tbody>
                {attendanceSelectedPatientReceipts.map((item) => (
                  <PatientSummaryRow key={item.payment.id}>
                    <td>
                      <AttendancePrimaryText>
                        {formatDateOnlyBR(item.payment.paid_at)}
                      </AttendancePrimaryText>
                    </td>
                    <td>
                      <AttendanceMoneyText>{formatCurrency(item.amountCents)}</AttendanceMoneyText>
                    </td>
                    <td>
                      <AttendancePrimaryText>{item.paymentMethodName}</AttendancePrimaryText>
                    </td>
                    <td>
                      <AttendanceSecondaryText>{item.payment.note || "-"}</AttendanceSecondaryText>
                    </td>
                  </PatientSummaryRow>
                ))}
              </tbody>
            </BillingCyclesTable>
          </AttendanceTableScroll>
        </BillingCyclesInnerTableCard>
      );

      attendanceContent = (
        <AttendancePatientDetailBlock>
          <AttendancePatientDetailTopline>
            <div>
              <AttendanceHeadingTitle>
                {attendanceDetailPatientSummary.patientName}
              </AttendanceHeadingTitle>
            </div>
            <AttendanceHeaderActions>
              <AttendancePrimaryAction
                type="button"
                onClick={openAttendanceScopedPaymentModal}
              >
                <FaPlus />
                Registrar recebimento
              </AttendancePrimaryAction>
              <AttendanceGhostAction type="button" onClick={handleClosePatientSessions}>
                Voltar
              </AttendanceGhostAction>
            </AttendanceHeaderActions>
          </AttendancePatientDetailTopline>
	          <AttendancePatientStats>
            <AttendancePatientStat>
              <span>A receber</span>
              <strong>{formatCurrency(attendanceDetailPatientSummary.openCents)}</strong>
            </AttendancePatientStat>
            <AttendancePatientStat>
              <span>Crédito disponível</span>
              <strong>{formatCurrency(attendanceDetailPatientSummary.creditsAvailable)}</strong>
            </AttendancePatientStat>
            {attendanceDetailPatientSummary.creditsAvailable > 0
              && attendanceDetailPatientSummary.openCents > 0 && (
                <AttendanceCreditUseAction
                  type="button"
                  onClick={openAttendanceCreditUseModal}
                >
                  Usar crédito
                </AttendanceCreditUseAction>
              )}
          </AttendancePatientStats>
          <PatientDetailTabsRow>
            <PatientDetailTabButton
              type="button"
              $active={attendanceDetailTab === "charges"}
              onClick={() => setAttendanceDetailTab("charges")}
            >
              Cobranças
            </PatientDetailTabButton>
            <PatientDetailTabButton
              type="button"
              $active={attendanceDetailTab === "payments"}
              onClick={() => setAttendanceDetailTab("payments")}
            >
              Recebimentos
            </PatientDetailTabButton>
          </PatientDetailTabsRow>
          {attendanceDetailTab === "payments" ? receiptsContent : packageContent}
        </AttendancePatientDetailBlock>
      );
    }

    let attendanceSummaryContent = (
      <AttendanceMetricsGrid>
        <AttendanceMetricCard>
          <AttendanceMetricLabel>Sessões contratadas</AttendanceMetricLabel>
          <AttendanceMetricValue>{displayAttendanceSummary.total}</AttendanceMetricValue>
        </AttendanceMetricCard>
        <AttendanceMetricCard>
          <AttendanceMetricLabel>Valor</AttendanceMetricLabel>
          <AttendanceMetricValue>{formatCurrency(displayAttendanceSummary.expectedAmount)}</AttendanceMetricValue>
        </AttendanceMetricCard>
        <AttendanceMetricCard>
          <AttendanceMetricLabel>Recebido</AttendanceMetricLabel>
          <AttendanceMetricValue>{formatCurrency(displayAttendanceSummary.paidAmount)}</AttendanceMetricValue>
        </AttendanceMetricCard>
        <AttendanceMetricCard>
          <AttendanceMetricLabel>Pendente</AttendanceMetricLabel>
          <AttendanceMetricValue>{formatCurrency(displayAttendanceSummary.pendingAmount)}</AttendanceMetricValue>
        </AttendanceMetricCard>
      </AttendanceMetricsGrid>
    );

    if (isAttendanceSummaryLoading) {
      attendanceSummaryContent = (
        <BlockLoader>
          <Spinner />
          Carregando resumo de cobrança...
        </BlockLoader>
      );
    } else if (revenuesSummaryError && useAggregatedRevenues) {
      attendanceSummaryContent = (
        <AttendanceEmptyState>{revenuesSummaryError}</AttendanceEmptyState>
      );
    }

    return (
      <AttendanceSectionSurface>
        <>
          <AttendancePeriodBlock>
            <AttendancePeriodBlockLeft>
              <AttendancePeriodBlockLabel>Competência financeira</AttendancePeriodBlockLabel>
              <AttendancePeriodBlockValue>{attendancePeriodLabel}</AttendancePeriodBlockValue>
            </AttendancePeriodBlockLeft>
            <AttendancePeriodBlockRight>
              <AttendanceTabGroup>
                <AttendanceTabButton
                  type="button"
                  $active={attendancePeriodMode === "month"}
                  onClick={() => handleAttendancePeriodModeChange("month")}
                >
                  Mês
                </AttendanceTabButton>
                <AttendanceTabButton
                  type="button"
                  $active={attendancePeriodMode === "year"}
                  onClick={() => handleAttendancePeriodModeChange("year")}
                >
                  Visão anual
                </AttendanceTabButton>
              </AttendanceTabGroup>
              {attendancePeriodLabel && (
                <AttendancePeriodControls>
                  <AttendancePeriodButton type="button" onClick={handleAttendancePreviousMonth}>
                    {attendancePeriodMode === "year" ? "< Ano anterior" : "< Anterior"}
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
                          <option key={year} value={year}>{year}</option>
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
                    {attendancePeriodMode === "year" ? "Proximo ano >" : "Proximo >"}
                  </AttendancePeriodButton>
                </AttendancePeriodControls>
              )}
            </AttendancePeriodBlockRight>
          </AttendancePeriodBlock>

          <AttendanceCard>
            <AttendanceCardHeader>
              <AttendanceCardTitle>Resumo de cobrança</AttendanceCardTitle>
            </AttendanceCardHeader>
            {attendanceSummaryContent}
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
                <PatientSearchField
                  mode="filter"
                  inputId="attendance-search"
                  value={attendanceFilters.search}
                  onChange={(nextValue) => setAttendanceFilters((prev) => ({
                    ...prev,
                    search: nextValue,
                  }))}
                />
              </AttendanceFilterField>
            </AttendanceFilterGrid>
            {attendanceFilters.patient_id && (
              <AttendanceFilterMeta>
                <AttendanceFilterMetaText>
                  Filtro ativo de paciente:{" "}
                  <strong>
                    {activeAttendancePatient
                      ? getPatientDisplayName(activeAttendancePatient)
                      : "Paciente selecionado"}
                  </strong>
                </AttendanceFilterMetaText>
                <AttendanceClearAction type="button" onClick={handleClearAttendancePatientFilter}>
                  Limpar filtro
                </AttendanceClearAction>
              </AttendanceFilterMeta>
            )}
          </AttendanceCard>

          <AttendanceCard>
            {!attendanceDrilldownPatientId && (
              <AttendanceDetailHeader>
                <AttendanceDetailTitle>{attendanceTitle}</AttendanceDetailTitle>
                {isAttendanceRefreshing && (
                  <AttendanceInlineLoader>
                    <Spinner />
                    Atualizando dados...
                  </AttendanceInlineLoader>
                )}
              </AttendanceDetailHeader>
            )}
            {isAttendanceInitialLoading ? (
              <BlockLoader>
                <Spinner />
                Carregando resumo...
              </BlockLoader>
            ) : (
              attendanceContent
            )}
          </AttendanceCard>
        </>
      </AttendanceSectionSurface>
    );
  };

  const renderPayments = () => (
    <Section>
      <SectionHeader>
        <div>
          <SectionTitle>Recebimentos</SectionTitle>
          <SectionSubtitle>Entradas de caixa, uso em cobranças e saldo ainda disponível.</SectionSubtitle>
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

      {loadingRevenues ? (
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
                <SummaryLabel>Já usado em cobranças</SummaryLabel>
                <SummaryValue>{formatCurrency(paymentsSummary.totalAllocated)}</SummaryValue>
              </SummaryCard>
              <SummaryCard>
                <SummaryLabel>Saldo em crédito</SummaryLabel>
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
                      {getPatientDisplayName(patient)}
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
                    <th>Usado em cobranças</th>
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
                        <td>{patient ? getPatientDisplayName(patient) : "-"}</td>
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
                <PanelTitle>Baixas nas cobranças</PanelTitle>
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
                        <td>{patient ? getPatientDisplayName(patient) : "-"}</td>
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

  const renderMensalidades = () => {
    const billingCyclesTitle = `Mensalidades${billingCyclesPeriodLabel ? ` - ${billingCyclesPeriodLabel}` : ""}`;
    let billingCyclesContent = null;

    if (billingCyclesDrilldownPatientId && selectedBillingCyclesPatientSummary) {
      billingCyclesContent = (
        <AttendancePatientDetailBlock>
          <AttendancePatientDetailTopline>
            <div>
              <AttendanceHeadingTitle>
                {selectedBillingCyclesPatientSummary.patientName}
              </AttendanceHeadingTitle>
            </div>
            <AttendanceHeaderActions>
              {selectedBillingCyclesPatientSummary.openCents > 0 && (
                <AttendancePrimaryAction
                  type="button"
                  onClick={openBillingCyclesScopedPaymentModal}
                >
                  <FaPlus />
                  Registrar recebimento
                </AttendancePrimaryAction>
              )}
              <AttendanceGhostAction type="button" onClick={handleCloseBillingCyclesPatient}>
                Voltar
              </AttendanceGhostAction>
            </AttendanceHeaderActions>
          </AttendancePatientDetailTopline>
          <AttendancePatientStats>
            <AttendancePatientStat>
              <span>A receber</span>
              <strong>{formatCurrency(selectedBillingCyclesPatientSummary.openCents)}</strong>
            </AttendancePatientStat>
            <AttendancePatientStat>
              <span>Recebido</span>
              <strong>{formatCurrency(selectedBillingCyclesPatientSummary.paidCents)}</strong>
            </AttendancePatientStat>
          </AttendancePatientStats>
          <BillingCyclesInnerTableCard>
            <AttendanceTableScroll>
              <BillingCyclesTable $detail $billingPatientDetail>
                <thead>
                  <tr>
                    <th>Plano</th>
                    <th>Periodo</th>
                    <th>Valor</th>
                    <th>Recebido</th>
                    <th>A receber</th>
                    <th>Situação</th>
                    <th>Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedBillingCyclesPatientRows.map((cycle) => {
                    const financial = resolveBillingCycleFinancial(cycle);
                    const planName = cycle.ServicePlan?.name || "-";
                    const periodStart = formatDateOnlyBR(cycle.cycle_start);
                    const periodEnd = formatDateOnlyBR(cycle.cycle_end);
                    const isNoCharge = financial.status === "no_charge";

                    return (
                      <PatientSummaryRow key={cycle.id} $hasOpen={!isNoCharge && financial.open > 0}>
                        <td>
                          <BillingCyclePlanName title={planName}>{planName}</BillingCyclePlanName>
                        </td>
                        <td>
                          <AttendancePrimaryText>
                            {periodStart}{cycle.cycle_end ? ` - ${periodEnd}` : ""}
                          </AttendancePrimaryText>
                        </td>
                        {isNoCharge ? (
                          <BillingCycleNoChargeCell colSpan={4}>
                            <AttendanceStatusBadge $status="no_charge">
                              Sem cobrança
                            </AttendanceStatusBadge>
                          </BillingCycleNoChargeCell>
                        ) : (
                          <>
                            <td>
                              <AttendanceMoneyText>
                                {formatCurrency(financial.amount)}
                              </AttendanceMoneyText>
                            </td>
                            <td>
                              <AttendanceMoneyText>{formatCurrency(financial.paid)}</AttendanceMoneyText>
                            </td>
                            <td>
                              <AttendanceOpenAmountValue $hasOpen={financial.open > 0}>
                                {formatCurrency(financial.open)}
                              </AttendanceOpenAmountValue>
                            </td>
                            <td>
                              <AttendanceStatusBadge $status={financial.status}>
                                {formatFinancialStatus(financial.status)}
                              </AttendanceStatusBadge>
                            </td>
                          </>
                        )}
                        <td>
                          <AttendanceRowActions>
                            <AttendanceSmallAction
                              type="button"
                              onClick={() => openBillingCycleSessionsPreview(cycle)}
                            >
                              Ver sessões
                            </AttendanceSmallAction>
                          </AttendanceRowActions>
                        </td>
                      </PatientSummaryRow>
                    );
                  })}
                </tbody>
              </BillingCyclesTable>
            </AttendanceTableScroll>
          </BillingCyclesInnerTableCard>
        </AttendancePatientDetailBlock>
      );
    } else {
      billingCyclesContent = (
        <AttendanceTableScroll>
          {isBillingCyclesLoading && (
            <div style={{ padding: "32px 16px", textAlign: "center", color: ATTENDANCE_UI.colors.textSecondary }}>
              Carregando...
            </div>
          )}
          {!isBillingCyclesLoading && billingCyclesByPatient.length === 0 && (
            <div style={{ padding: "32px 16px", textAlign: "center", color: ATTENDANCE_UI.colors.textSecondary }}>
              Nenhuma mensalidade encontrada no periodo.
            </div>
          )}
          {!isBillingCyclesLoading && billingCyclesByPatient.length > 0 && (
            <BillingCyclesTable>
              <thead>
                <tr>
                  <th>Paciente</th>
                  <th>Mensalidades</th>
                  <th>Valor</th>
                  <th>Recebido</th>
                  <th>A receber</th>
                  <th>Status</th>
                  <th>Ação</th>
                </tr>
              </thead>
              <tbody>
                {billingCyclesByPatient.map((row) => {
                  const status = row.amountCents <= 0 && row.noChargeCycles > 0
                    ? "no_charge"
                    : resolveGroupedFinancialStatus(row.amountCents, row.paidCents, row.openCents);

                  return (
                    <PatientSummaryRow key={row.key} $hasOpen={row.openCents > 0}>
                      <td>
                        <AttendancePrimaryText>{row.patientName}</AttendancePrimaryText>
                      </td>
                      <td>
                        <BillingCycleCountText>
                          {row.cycles} mensalidade{row.cycles === 1 ? "" : "s"}
                        </BillingCycleCountText>
                      </td>
                      <td>
                        <AttendanceMoneyText>
                          {status === "no_charge" ? "Sem cobrança" : formatCurrency(row.amountCents)}
                        </AttendanceMoneyText>
                      </td>
                      <td>
                        <AttendanceMoneyText>
                          {status === "no_charge" ? "-" : formatCurrency(row.paidCents)}
                        </AttendanceMoneyText>
                      </td>
                      <td>
                        <AttendanceOpenAmountValue $hasOpen={row.openCents > 0}>
                          {status === "no_charge" ? "-" : formatCurrency(row.openCents)}
                        </AttendanceOpenAmountValue>
                      </td>
                      <td>
                        <AttendanceStatusBadge $status={status}>
                          {formatFinancialStatus(status)}
                        </AttendanceStatusBadge>
                      </td>
                      <td>
                        <AttendanceRowActions>
                          <AttendanceSmallAction
                            type="button"
                            onClick={() => handleViewBillingCyclesPatient(row.patientId)}
                          >
                            Detalhes
                          </AttendanceSmallAction>
                        </AttendanceRowActions>
                      </td>
                    </PatientSummaryRow>
                  );
                })}
              </tbody>
            </BillingCyclesTable>
          )}
        </AttendanceTableScroll>
      );
    }

    return (
      <AttendanceSectionSurface>
        <AttendancePeriodBlock>
          <AttendancePeriodBlockLeft>
            <AttendancePeriodBlockLabel>Competência financeira</AttendancePeriodBlockLabel>
            <AttendancePeriodBlockValue>{billingCyclesPeriodLabel}</AttendancePeriodBlockValue>
          </AttendancePeriodBlockLeft>
          <AttendancePeriodBlockRight>
            <AttendanceTabGroup>
              <AttendanceTabButton
                type="button"
                $active={billingCyclesPeriodMode === "month"}
                onClick={() => handleBillingCyclesPeriodModeChange("month")}
              >
                Mês
              </AttendanceTabButton>
              <AttendanceTabButton
                type="button"
                $active={billingCyclesPeriodMode === "year"}
                onClick={() => handleBillingCyclesPeriodModeChange("year")}
              >
                Visão anual
              </AttendanceTabButton>
            </AttendanceTabGroup>
            {billingCyclesPeriodLabel && (
              <AttendancePeriodControls>
                <AttendancePeriodButton type="button" onClick={handleBillingCyclesPreviousMonth}>
                  {billingCyclesPeriodMode === "year" ? "< Ano anterior" : "< Anterior"}
                </AttendancePeriodButton>
                <AttendancePeriodChip
                  role="button"
                  tabIndex={0}
                  onClick={handleBillingCyclesPeriodTagClick}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      handleBillingCyclesPeriodTagClick();
                    }
                  }}
                >
                  {billingCyclesPeriodLabel}
                  {billingCyclesPeriodMode === "year" ? (
                    <AttendancePeriodYearSelect
                      aria-label="Selecionar ano"
                      value={billingCyclesPeriodYear}
                      onChange={handleBillingCyclesYearPickerChange}
                    >
                      {billingCyclesYearOptions.map((year) => (
                        <option key={year} value={year}>{year}</option>
                      ))}
                    </AttendancePeriodYearSelect>
                  ) : (
                    <AttendancePeriodMonthInput
                      ref={billingCyclesMonthPickerRef}
                      aria-label="Selecionar mes e ano"
                      type="month"
                      value={billingCyclesPeriodMonth}
                      onChange={handleBillingCyclesMonthPickerChange}
                    />
                  )}
                </AttendancePeriodChip>
                <AttendancePeriodButton type="button" onClick={handleBillingCyclesNextMonth}>
                  {billingCyclesPeriodMode === "year" ? "Proximo ano >" : "Proximo >"}
                </AttendancePeriodButton>
              </AttendancePeriodControls>
            )}
          </AttendancePeriodBlockRight>
        </AttendancePeriodBlock>

        <AttendanceCard>
          <AttendanceCardHeader>
            <AttendanceCardTitle>Resumo de mensalidades</AttendanceCardTitle>
          </AttendanceCardHeader>
          <AttendanceMetricsGrid>
            <AttendanceMetricCard>
              <AttendanceMetricLabel>Planos ativos</AttendanceMetricLabel>
              <AttendanceMetricValue>{billingCyclesSummary.activePlans}</AttendanceMetricValue>
            </AttendanceMetricCard>
            <AttendanceMetricCard>
              <AttendanceMetricLabel>Valor</AttendanceMetricLabel>
              <AttendanceMetricValue>{formatCurrency(billingCyclesSummary.expectedCents)}</AttendanceMetricValue>
            </AttendanceMetricCard>
            <AttendanceMetricCard>
              <AttendanceMetricLabel>Recebido</AttendanceMetricLabel>
              <AttendanceMetricValue>{formatCurrency(billingCyclesSummary.paidCents)}</AttendanceMetricValue>
            </AttendanceMetricCard>
            <AttendanceMetricCard>
              <AttendanceMetricLabel>Pendente</AttendanceMetricLabel>
              <AttendanceMetricValue>{formatCurrency(billingCyclesSummary.pendingCents)}</AttendanceMetricValue>
            </AttendanceMetricCard>
          </AttendanceMetricsGrid>
        </AttendanceCard>

        <AttendanceCard>
          <AttendanceCardHeader>
            <AttendanceCardTitle>Filtros</AttendanceCardTitle>
          </AttendanceCardHeader>
          <AttendanceFilterGrid>
            <AttendanceFilterField>
              <AttendanceFilterLabel htmlFor="billing-cycle-status">Status financeiro</AttendanceFilterLabel>
              <AttendanceFilterSelect
                id="billing-cycle-status"
                value={billingCyclesStatusFilter}
                onChange={(e) => setBillingCyclesStatusFilter(e.target.value)}
              >
                <option value="all">Todos</option>
                <option value="pending">Pendente</option>
                <option value="partial">Parcial</option>
                <option value="paid">Pago</option>
                <option value="overdue">Vencido</option>
                <option value="no_charge">Sem cobrança</option>
                <option value="canceled">Cancelado</option>
              </AttendanceFilterSelect>
            </AttendanceFilterField>
            <AttendanceFilterField>
              <PatientSearchField
                mode="filter"
                inputId="billing-cycle-search"
                value={billingCyclesDrilldownPatientId && selectedBillingCyclesPatientSummary
                  ? selectedBillingCyclesPatientSummary.patientName
                  : billingCyclesFilters.search}
                disabled={Boolean(billingCyclesDrilldownPatientId)}
                onChange={(nextValue) => setBillingCyclesFilters((prev) => ({
                  ...prev,
                  search: nextValue,
                }))}
              />
            </AttendanceFilterField>
          </AttendanceFilterGrid>
        </AttendanceCard>

        <AttendanceTableCard>
          {!billingCyclesDrilldownPatientId && (
            <AttendanceDetailHeader style={{ padding: `${ATTENDANCE_UI.spacing[2]} ${ATTENDANCE_UI.spacing[2]} 0` }}>
              <AttendanceDetailTitle>{billingCyclesTitle}</AttendanceDetailTitle>
            </AttendanceDetailHeader>
          )}
          {billingCyclesDrilldownPatientId ? (
            <BillingCyclesDetailContent>
              {billingCyclesContent}
            </BillingCyclesDetailContent>
          ) : (
            billingCyclesContent
          )}
        </AttendanceTableCard>
      </AttendanceSectionSurface>
    );
  };

  const renderReceitasTabs = () => (
    <TabsWrapper>
      <TabsRow>
        <TabButton
          type="button"
          $active={receitasView === "atendimentos"}
          onClick={() => setReceitasView("atendimentos")}
        >
          Por sessão
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
        <TabButton
          type="button"
          $active={receitasView === "mensalidades"}
          onClick={() => setReceitasView("mensalidades")}
        >
          Mensalidades
        </TabButton>
      </TabsRow>
    </TabsWrapper>
  );

  const renderReceitas = () => {
    let receitasContent = renderAttendance();

    if (SHOW_DEDICATED_PAYMENTS_VIEW && receitasView === "recebimentos") {
      receitasContent = renderPayments();
    } else if (receitasView === "mensalidades") {
      receitasContent = renderMensalidades();
    }

    return receitasContent;
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

    if (loadingPaymentMethods) {
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

  const previewCycle = billingCycleSessionsPreview.cycle;
  const previewPatientName = previewCycle?.Patient ? getPatientDisplayName(previewCycle.Patient) : "-";
  const previewPlanName = previewCycle?.ServicePlan?.name || "-";
  const previewPeriodLabel = previewCycle
    ? `${formatDateOnlyBR(previewCycle.cycle_start)}${previewCycle.cycle_end ? ` - ${formatDateOnlyBR(previewCycle.cycle_end)}` : ""
    }`
    : "-";
  const sectionTitleByKey = {
    overview: "Visão geral",
    receitas: "Receitas",
    "clinic-expenses": "Despesas da clínica",
    methods: "Configurações",
    "clinic-expense-categories": "Configurações",
  };
  const currentSectionTitle = sectionTitleByKey[activeSection] || "Financeiro";
  const showFinancialPrivacyToggle = ["overview", "receitas", "clinic-expenses"].includes(activeSection);
  const isFinancialSettings = ["methods", "clinic-expense-categories"].includes(activeSection);

  return (
    <FinancePage>
      <FinanceContent>
          <Header>
            <HeaderText>
              <HeaderTitleRow>
                <Title>{currentSectionTitle}</Title>
                {showFinancialPrivacyToggle && (
                  <PrivacyToggle
                    type="button"
                    onClick={() => setFinancialValuesVisible((visible) => !visible)}
                    aria-label={financialValuesVisible ? "Ocultar valores financeiros" : "Mostrar valores financeiros"}
                    title={financialValuesVisible ? "Ocultar valores" : "Mostrar valores"}
                  >
                    {financialValuesVisible ? <FaEyeSlash /> : <FaEye />}
                  </PrivacyToggle>
                )}
              </HeaderTitleRow>
            </HeaderText>
            {activeSection === "receitas" && (
              <HeaderTabsSlot>
                {renderReceitasTabs()}
              </HeaderTabsSlot>
            )}
          </Header>

          {isFinancialSettings && (
            <SettingsTabs role="tablist" aria-label="Configurações financeiras">
              <SettingsTab
                as={Link}
                to="/financeiro/configuracoes/formas-pagamento"
                role="tab"
                $active={activeSection === "methods"}
                aria-selected={activeSection === "methods"}
              >
                Formas de pagamento
              </SettingsTab>
              <SettingsTab
                as={Link}
                to="/financeiro/configuracoes/categorias-despesas"
                role="tab"
                $active={activeSection === "clinic-expense-categories"}
                aria-selected={activeSection === "clinic-expense-categories"}
              >
                Categorias de despesas
              </SettingsTab>
            </SettingsTabs>
          )}

          <>
            {activeSection === "overview" && renderOverview()}
            {activeSection === "receitas" && renderReceitas()}
            {SHOW_CLINIC_EXPENSES && activeSection === "clinic-expenses" && renderClinicExpenses()}
            {activeSection === "clinic-expense-categories" && renderClinicExpenseCategories()}
            {activeSection === "methods" && renderMethods()}
          </>
      </FinanceContent>

      {selectedAttendancePackage && attendanceSelectedPatientSummary && (
        <>
          <ModalOverlay>
            <ModalCard>
              <ModalHeader>
                <div>
                  <ModalTitle>
                    {selectedAttendancePackage.kind === "single" ? "Sessão individual" : "Sessões do pacote"}
                  </ModalTitle>
                  <ModalSubtitle>
                    <strong>{attendanceSelectedPatientSummary.patientName}</strong>
                  </ModalSubtitle>
                </div>
                <IconButton type="button" onClick={handleClosePackageSessions}>
                  <FaTimes />
                </IconButton>
              </ModalHeader>
              <ModalBody>
                {attendanceDetailSessions.isLoading && (
                  <EmptyState>Carregando sessões do paciente...</EmptyState>
                )}
                {!attendanceDetailSessions.isLoading && attendanceDetailSessions.error && (
                  <EmptyState>{attendanceDetailSessions.error}</EmptyState>
                )}
                {!attendanceDetailSessions.isLoading
                  && !attendanceDetailSessions.error
                  && attendanceSelectedPatientPackages.length === 0 && (
                    <EmptyState>
                      {attendanceSelectedPatientRows.length > 0
                        ? "Este paciente possui receitas por sessão no período, mas não há pacote vinculado encontrado."
                        : "Nenhum pacote de sessões encontrado para este paciente."}
                    </EmptyState>
                  )}
	                {!attendanceDetailSessions.isLoading
		                  && !attendanceDetailSessions.error
		                  && [selectedAttendancePackage].map((item) => {
			                    const usageSummary = item.usageSummary || {};
			                    const totalSessions = item.totalSessions || 0;
			                    const packageDateLabel = item.expiresAt ? formatDateOnlyBR(item.expiresAt) : "";
			                    const packageTitle = `${packageDateLabel ? `${packageDateLabel} · ` : ""}${item.serviceName} - ${totalSessions} ${totalSessions === 1 ? "sessão" : "sessões"}`;
			                    const statusItems = [
			                      { label: "agendadas", value: usageSummary.scheduled || 0, show: (usageSummary.scheduled || 0) > 0 },
			                      { label: "realizadas", value: usageSummary.done || 0, show: (usageSummary.done || 0) > 0 },
			                      { label: "faltas", value: usageSummary.noShow || 0, show: (usageSummary.noShow || 0) > 0 },
			                      {
			                        label: (usageSummary.canceledWithoutCharge || 0) === 1
			                          ? "cancelada"
			                          : "canceladas",
			                        value: usageSummary.canceledWithoutCharge || 0,
			                        show: (usageSummary.canceledWithoutCharge || 0) > 0,
			                      },
			                    ].filter((statusItem) => statusItem.show);
			                    const distributionText = statusItems
			                      .map((statusItem) => `${statusItem.value} ${statusItem.label}`)
			                      .join(" · ");
	
		                    return (
		                      <AttendancePackageCard key={item.id}>
		                        <AttendancePackageHeader>
		                          <div>
		                            <AttendancePackageName>{packageTitle}</AttendancePackageName>
		                          </div>
		                        </AttendancePackageHeader>
		                        <AttendancePackageSummary>
			                          <AttendancePackageSummarySection>
			                            <AttendancePackageSummaryTitle>
			                              Distribuição das {totalSessions} sessões
			                            </AttendancePackageSummaryTitle>
			                            <AttendancePackageDistributionLine>
			                              {distributionText || "Sem sessões distribuídas"}
			                            </AttendancePackageDistributionLine>
			                          </AttendancePackageSummarySection>
			                          <AttendancePackageSummarySection>
			                            <AttendancePackageSummaryTitle>Financeiro do pacote</AttendancePackageSummaryTitle>
			                            <AttendancePackageFinanceGrid>
			                              <AttendancePackageFinanceItem>
			                                <span>Contratado</span>
			                                <strong>{formatCurrency(item.contractedAmountCents || item.amountCents || 0)}</strong>
			                              </AttendancePackageFinanceItem>
			                              <AttendancePackageFinanceItem>
			                                <span>Cobrável</span>
			                                <strong>{formatCurrency(item.amountCents || 0)}</strong>
		                              </AttendancePackageFinanceItem>
		                              <AttendancePackageFinanceItem>
		                                <span>Recebido</span>
		                                <strong>{formatCurrency(item.paidCents || 0)}</strong>
		                              </AttendancePackageFinanceItem>
		                              <AttendancePackageFinanceItem $highlight>
		                                <span>Pendente</span>
		                                <strong>{formatCurrency(item.openCents || 0)}</strong>
		                              </AttendancePackageFinanceItem>
		                            </AttendancePackageFinanceGrid>
		                          </AttendancePackageSummarySection>
		                        </AttendancePackageSummary>
	                        {item.sessions.length === 0 ? (
	                          <EmptyState>Nenhuma sessão vinculada a este pacote.</EmptyState>
	                        ) : (
		                          <AttendancePackageSessionsScroll>
	                            <SimpleTable>
	                              <thead>
	                                <tr>
	                                  <th>Data</th>
	                                  <th>Profissional</th>
	                                  <th>Status</th>
	                                </tr>
	                              </thead>
	                              <tbody>
	                                {item.sessions.map((session) => {
		                                  const professionalName =
		                                    session?.professional?.name || session?.professional?.email || "-";
	
	                                  return (
	                                    <tr key={session.id}>
	                                      <td>{formatSessionDateTimeBR(session.starts_at)}</td>
	                                      <td>{professionalName}</td>
	                                      <td>
	                                        <AttendanceStatusBadge $status={session.status}>
	                                          {formatPackageSessionStatus(session.status)}
	                                        </AttendanceStatusBadge>
	                                      </td>
	                                    </tr>
	                                  );
	                                })}
	                              </tbody>
	                            </SimpleTable>
		                          </AttendancePackageSessionsScroll>
	                        )}
	                      </AttendancePackageCard>
	                    );
	                  })}
              </ModalBody>
              <ModalActions>
                <SecondaryButton type="button" onClick={handleClosePackageSessions}>
                  Fechar
                </SecondaryButton>
              </ModalActions>
            </ModalCard>
          </ModalOverlay>
          <ProtectedBackdrop onClick={handleClosePackageSessions} />
        </>
      )}

      {billingCycleSessionsPreview.open && (
        <>
          <ModalOverlay>
            <ModalCard>
              <ModalHeader>
                <div>
                  <ModalTitle>Sessões da mensalidade</ModalTitle>
                  <BillingCyclePreviewSummary>
                    <strong>{previewPatientName}</strong>
                    <span>{previewPlanName}</span>
                    <small>{previewPeriodLabel}</small>
                  </BillingCyclePreviewSummary>
                </div>
                <IconButton type="button" onClick={closeBillingCycleSessionsPreview}>
                  <FaTimes />
                </IconButton>
              </ModalHeader>
              <ModalBody>
                {billingCycleSessionsPreview.isLoading && (
                  <div style={{ padding: "28px 12px", textAlign: "center", color: ATTENDANCE_UI.colors.textSecondary }}>
                    Carregando sessões...
                  </div>
                )}
                {!billingCycleSessionsPreview.isLoading && billingCycleSessionsPreview.error && (
                  <EmptyState>{billingCycleSessionsPreview.error}</EmptyState>
                )}
                {!billingCycleSessionsPreview.isLoading &&
                  !billingCycleSessionsPreview.error &&
                  billingCycleSessionsPreview.sessions.length === 0 && (
                    <EmptyState>Nenhuma sessão vinculada a este ciclo.</EmptyState>
                  )}
                {!billingCycleSessionsPreview.isLoading &&
                  !billingCycleSessionsPreview.error &&
                  billingCycleSessionsPreview.sessions.length > 0 && (
                    <TableScroll>
                      <SimpleTable>
                        <thead>
                          <tr>
                            <th>Data e horário</th>
                            <th>Dia da semana</th>
                            <th>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {billingCycleSessionsPreview.sessions.map((session) => (
                            <tr key={session.id}>
                              <td>{formatSessionDateTimeBR(session.starts_at)}</td>
                              <td>{formatSessionWeekdayBR(session.starts_at)}</td>
                              <td>
                                <AttendanceStatusBadge $status={session.status}>
                                  {formatBillingCycleSessionStatus(session.status)}
                                </AttendanceStatusBadge>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </SimpleTable>
                    </TableScroll>
                  )}
              </ModalBody>
              <ModalActions>
                <SecondaryButton type="button" onClick={closeBillingCycleSessionsPreview}>
                  Fechar
                </SecondaryButton>
              </ModalActions>
            </ModalCard>
          </ModalOverlay>
          <ProtectedBackdrop onClick={closeBillingCycleSessionsPreview} />
        </>
      )}

      {isClinicExpenseOpen && (
        <ClinicExpenseModal
          ui={{
            ModalOverlay,
            ModalCard: CompactModalCard,
            ModalHeader,
            ModalTitle,
            ModalSubtitle,
            IconButton,
            ModalBody,
            Field,
            Label,
            Input,
            Select,
            FormGrid,
            TextArea,
            ModalActions,
            SecondaryButton,
            PrimaryButton,
            Backdrop: ProtectedBackdrop,
            backdropHasInput: clinicExpenseModalHasInput,
            MutedText,
          }}
          clinicExpenseForm={clinicExpenseForm}
          clinicExpenseCategories={clinicExpenseCategories}
          editingClinicExpenseId={editingClinicExpenseId}
          isClinicExpenseSaving={isClinicExpenseSaving}
          closeClinicExpenseModal={closeClinicExpenseModal}
          handleClinicExpenseChange={handleClinicExpenseChange}
          handleClinicExpenseAmountBlur={handleClinicExpenseAmountBlur}
          handleClinicExpensePaidAmountBlur={handleClinicExpensePaidAmountBlur}
          handleSaveClinicExpense={handleSaveClinicExpense}
        />
      )}
      {isClinicExpensePaymentOpen && (
        <ClinicExpensePaymentModal
          ui={{
            ModalOverlay,
            ModalCard,
            ModalHeader,
            ModalTitle,
            ModalSubtitle,
            IconButton,
            ModalBody,
            Field,
            Label,
            Input,
            TextArea,
            ModalActions,
            SecondaryButton,
            PrimaryButton,
            Backdrop: ProtectedBackdrop,
            backdropHasInput: clinicExpensePaymentModalHasInput,
          }}
          form={clinicExpensePaymentForm}
          isSaving={Boolean(clinicExpensePayingId)}
          isEditing={Boolean(clinicExpensePaymentForm.expense?.paid_at)}
          onChange={handleClinicExpensePaymentChange}
          onAmountBlur={handleClinicExpensePaymentAmountBlur}
          onClose={closeClinicExpensePaymentModal}
          onSave={handleSaveClinicExpensePayment}
        />
      )}
      {clinicExpenseUnpayTarget && (
        <>
          <ModalOverlay>
            <CompactModalCard>
              <ModalHeader>
                <div>
                  <ModalTitle>Desfazer pagamento</ModalTitle>
                  <ModalSubtitle>Informe o motivo do estorno desta despesa.</ModalSubtitle>
                </div>
                <IconButton
                  type="button"
                  onClick={closeClinicExpenseUnpayModal}
                  disabled={Boolean(clinicExpensePayingId)}
                >
                  <FaTimes />
                </IconButton>
              </ModalHeader>
              <ModalBody>
                <Field>
                  <Label htmlFor="clinic-expense-unpay-reason">Motivo</Label>
                  <TextArea
                    id="clinic-expense-unpay-reason"
                    value={clinicExpenseUnpayReason}
                    onChange={(event) => setClinicExpenseUnpayReason(event.target.value)}
                    rows={4}
                    required
                    autoFocus
                  />
                </Field>
              </ModalBody>
              <ModalActions>
                <SecondaryButton
                  type="button"
                  onClick={closeClinicExpenseUnpayModal}
                  disabled={Boolean(clinicExpensePayingId)}
                >
                  Cancelar
                </SecondaryButton>
                <PrimaryButton
                  type="button"
                  onClick={handleUnpayClinicExpense}
                  disabled={Boolean(clinicExpensePayingId)}
                >
                  {clinicExpensePayingId ? "Salvando..." : "Confirmar estorno"}
                </PrimaryButton>
              </ModalActions>
            </CompactModalCard>
          </ModalOverlay>
          <ProtectedBackdrop
            onClick={closeClinicExpenseUnpayModal}
            $hasInput={hasFilledText(clinicExpenseUnpayReason)}
          />
        </>
      )}
      {isClinicExpenseCategoryOpen && (
        <ClinicExpenseCategoryModal
          ui={{
            ModalOverlay,
            ModalCard,
            ModalHeader,
            ModalTitle,
            ModalSubtitle,
            IconButton,
            ModalBody,
            Field,
            Label,
            Input,
            ModalActions,
            SecondaryButton,
            PrimaryButton,
            Backdrop: ProtectedBackdrop,
            backdropHasInput: clinicExpenseCategoryModalHasInput,
          }}
          form={clinicExpenseCategoryForm}
          editingId={editingClinicExpenseCategoryId}
          isSaving={isClinicExpenseCategorySaving}
          onClose={closeClinicExpenseCategoryModal}
          onChange={handleClinicExpenseCategoryChange}
          onSave={handleSaveClinicExpenseCategory}
        />
      )}
      {clinicExpenseCategoryDeactivateTarget && (
        <>
          <ModalOverlay>
            <CompactModalCard>
              <ModalHeader>
                <div>
                  <ModalTitle>Desativar categoria</ModalTitle>
                  <ModalSubtitle>Ela não aparecerá em novas despesas.</ModalSubtitle>
                </div>
                <IconButton
                  type="button"
                  onClick={closeClinicExpenseCategoryDeactivateModal}
                  disabled={Boolean(clinicExpenseCategoryUpdatingId)}
                >
                  <FaTimes />
                </IconButton>
              </ModalHeader>
              <ModalBody>
                <EmptyState>
                  Deseja desativar a categoria {clinicExpenseCategoryDeactivateTarget.name}?
                  {Number(clinicExpenseCategoryDeactivateTarget.used_count || 0) > 0 ? (
                    <MutedText>As despesas antigas continuarão com essa categoria.</MutedText>
                  ) : null}
                </EmptyState>
              </ModalBody>
              <ModalActions>
                <SecondaryButton
                  type="button"
                  onClick={closeClinicExpenseCategoryDeactivateModal}
                  disabled={Boolean(clinicExpenseCategoryUpdatingId)}
                >
                  Cancelar
                </SecondaryButton>
                <PrimaryButton
                  type="button"
                  onClick={handleDeactivateClinicExpenseCategory}
                  disabled={Boolean(clinicExpenseCategoryUpdatingId)}
                >
                  {clinicExpenseCategoryUpdatingId ? "Salvando..." : "Desativar"}
                </PrimaryButton>
              </ModalActions>
            </CompactModalCard>
          </ModalOverlay>
          <ProtectedBackdrop onClick={closeClinicExpenseCategoryDeactivateModal} />
        </>
      )}
      {clinicExpenseDeleteTarget && (
        <>
          <ModalOverlay>
            <ModalCard>
              <ModalHeader>
                <div>
                  <ModalTitle>Excluir despesa</ModalTitle>
                  <ModalSubtitle>Essa ação removerá apenas esta despesa.</ModalSubtitle>
                </div>
                <IconButton
                  type="button"
                  onClick={closeClinicExpenseDeleteModal}
                  disabled={isClinicExpenseDeleting}
                >
                  <FaTimes />
                </IconButton>
              </ModalHeader>
              <ModalBody>
                <EmptyState>
                  Tem certeza que deseja excluir esta despesa?
                  {clinicExpenseDeleteTarget.recurrence_type === "monthly" ? (
                    <MutedText>
                      Essa despesa faz parte de uma recorrência mensal. Nesta versão, apenas este mês será removido.
                    </MutedText>
                  ) : null}
                </EmptyState>
              </ModalBody>
              <ModalActions>
                <SecondaryButton
                  type="button"
                  onClick={closeClinicExpenseDeleteModal}
                  disabled={isClinicExpenseDeleting}
                >
                  Cancelar
                </SecondaryButton>
                <PrimaryButton
                  type="button"
                  onClick={handleDeleteClinicExpense}
                  disabled={isClinicExpenseDeleting}
                >
                  {isClinicExpenseDeleting ? "Excluindo..." : "Excluir despesa"}
                </PrimaryButton>
              </ModalActions>
            </ModalCard>
          </ModalOverlay>
          <ProtectedBackdrop onClick={closeClinicExpenseDeleteModal} />
        </>
      )}

      {creditUseModalContext && creditUsePreview && (
        <>
          <ModalOverlay>
            <ModalCard>
              <ModalHeader>
                <ModalHeaderText>
                  <ModalTitle>Usar crédito</ModalTitle>
                  <ModalSubtitle>
                    Aplicar crédito financeiro nas cobranças pendentes da competência atual.
                  </ModalSubtitle>
                </ModalHeaderText>
                <IconButton type="button" onClick={closeCreditUseModal} disabled={isCreditUseSaving}>
                  <FaTimes />
                </IconButton>
              </ModalHeader>
              <ModalBody>
                <PaymentPreviewBox>
                  <PaymentPreviewRow>
                    <span>Paciente</span>
                    <strong>{creditUseModalContext.patientName}</strong>
                  </PaymentPreviewRow>
                  <PaymentPreviewRow>
                    <span>Competência</span>
                    <strong>{creditUseModalContext.periodLabel || "-"}</strong>
                  </PaymentPreviewRow>
                  <PaymentPreviewRow>
                    <span>Crédito disponível</span>
                    <strong>{formatCurrency(creditUsePreview.creditAvailableCents)}</strong>
                  </PaymentPreviewRow>
                  <PaymentPreviewRow>
                    <span>Pendente atual</span>
                    <strong>{formatCurrency(creditUsePreview.openCents)}</strong>
                  </PaymentPreviewRow>
                  <PaymentPreviewRow $emphasis>
                    <span>Crédito a usar</span>
                    <strong>{formatCurrency(creditUsePreview.creditToUseCents)}</strong>
                  </PaymentPreviewRow>
                  <PaymentPreviewRow $balance={creditUsePreview.openAfterCents > 0}>
                    <span>Pendente após uso</span>
                    <strong>{formatCurrency(creditUsePreview.openAfterCents)}</strong>
                  </PaymentPreviewRow>
                  <PaymentPreviewRow $balance={creditUsePreview.creditRemainingCents > 0}>
                    <span>Crédito restante</span>
                    <strong>{formatCurrency(creditUsePreview.creditRemainingCents)}</strong>
                  </PaymentPreviewRow>
                </PaymentPreviewBox>
              </ModalBody>
              <ModalActions>
                <SecondaryButton
                  type="button"
                  onClick={closeCreditUseModal}
                  disabled={isCreditUseSaving}
                >
                  Cancelar
                </SecondaryButton>
                <PrimaryButton
                  type="button"
                  onClick={handleConfirmCreditUse}
                  disabled={isCreditUseSaving || creditUsePreview.creditToUseCents <= 0}
                >
                  {isCreditUseSaving ? <ButtonSpinner /> : "Confirmar uso do crédito"}
                </PrimaryButton>
              </ModalActions>
            </ModalCard>
          </ModalOverlay>
          <ProtectedBackdrop onClick={closeCreditUseModal} $hasInput={creditUseModalHasInput} />
        </>
      )}

      <FinancialPaymentModal
        flow={financialPaymentFlow}
        formatCurrency={formatCurrency}
        paymentMethods={paymentMethods}
        onRequestClose={requestModalDiscard}
      />

      {/* Modal legado preservado para SHOW_DEDICATED_PAYMENTS_VIEW. */}
      {isPaymentOpen && (
        <>
          <ModalOverlay>
            <ModalCard>
              <ModalHeader>
                <ModalHeaderText>
                  <ModalTitle>Registrar recebimento</ModalTitle>
                  {isSessionBatchPayment && (
                    <ModalContextLine>
                      <span>Paciente</span>
                      <strong title={paymentModalContext?.sessionBatch?.patientName || "Paciente"}>
                        {paymentModalContext?.sessionBatch?.patientName || "Paciente"}
                      </strong>
                    </ModalContextLine>
                  )}
                  {!isSessionBatchPayment && paymentModalSubtitle && (
                    <ModalSubtitle>{paymentModalSubtitle}</ModalSubtitle>
                  )}
                </ModalHeaderText>
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
                        <span>Valor da cobrança</span>
                        <strong>{formatCurrency(selectedChargeAmountCents)}</strong>
                      </ChargeAmountBanner>
                    )}
                    <FormGrid>
                      {!paymentForm.entry_id && !isSessionBatchPayment && paymentModalContext?.fixedPatient && (
                        <Field>
                          <Label>Paciente</Label>
                          <FixedPatientDisplay title={paymentModalContext.patientName}>
                            {paymentModalContext.patientName}
                          </FixedPatientDisplay>
                        </Field>
                      )}
                      {!paymentForm.entry_id && !isSessionBatchPayment && !paymentModalContext?.fixedPatient && (
                        <Field>
                          <Label htmlFor="payment-patient">Paciente</Label>
                          <SearchFieldWrapper>
                            <Input
                              id="payment-patient"
                              value={paymentPatientQuery}
                              onChange={handlePaymentPatientSearchChange}
                              onFocus={() => setIsPaymentPatientSearchFocused(true)}
                              onBlur={handlePaymentPatientSearchBlur}
                              placeholder="Buscar paciente"
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
                          type="date"
                          name="paid_at"
                          value={String(paymentForm.paid_at || "").slice(0, 10)}
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
                      {isSessionBatchPayment && (
                        <Field>
                          <Label htmlFor="payment-batch-discount">Desconto por sessão</Label>
                          <CurrencyInputGroup>
                            <CurrencyPrefix>R$</CurrencyPrefix>
                            <CurrencyInput
                              id="payment-batch-discount"
                              name="batch_discount_per_session"
                              value={paymentForm.batch_discount_per_session}
                              onChange={handlePaymentChange}
                              onBlur={handlePaymentCurrencyBlur}
                              inputMode="decimal"
                              placeholder="0,00"
                            />
                          </CurrencyInputGroup>
                        </Field>
                      )}
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
                            <span>Parcelamento da cobrança</span>
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
                    </FormGrid>
                    {isSessionBatchPayment && (
                      <PaymentPreviewBox>
                        <PaymentPreviewTitle>Resumo da cobrança</PaymentPreviewTitle>
                        <PaymentPreviewRow>
                          <span>Valor por sessão</span>
                          <PaymentPreviewValue>
                            {paymentPreview.discountCents > 0 && (
                              <DiscountFlag>com desconto</DiscountFlag>
                            )}
                            <strong>
                              {formatCurrency(
                                paymentPreview.discountCents > 0
                                  ? paymentPreview.batchFinalPerSessionCents || 0
                                  : paymentPreview.batchOriginalPerSessionCents || 0,
                              )}
                            </strong>
                          </PaymentPreviewValue>
                        </PaymentPreviewRow>
                        <PaymentPreviewRow>
                          <span>Quantidade de sessões</span>
                          <strong>{paymentPreview.batchSessionCount || 0}</strong>
                        </PaymentPreviewRow>
                        <PaymentPreviewRow $total>
                          <span>Total da cobrança</span>
                          <strong>{formatCurrency(paymentPreview.finalChargedCents || 0)}</strong>
                        </PaymentPreviewRow>
                        <PaymentPreviewSectionTitle>Resumo do pagamento</PaymentPreviewSectionTitle>
                        <PaymentPreviewRow $emphasis>
                          <span>Valor recebido</span>
                          <strong>{formatCurrency(paymentPreview.receivedCents)}</strong>
                        </PaymentPreviewRow>
                        <PaymentPreviewRow $balance={paymentPreview.openAfterCents > 0 || paymentPreview.creditAfterCents > 0}>
                          <span>{sessionBatchBalanceLabel}</span>
                          <strong>
                            {formatCurrency(
                              paymentPreview.creditAfterCents > 0
                                ? paymentPreview.creditAfterCents
                                : paymentPreview.openAfterCents,
                            )}
                          </strong>
                        </PaymentPreviewRow>
                      </PaymentPreviewBox>
                    )}
                    {!isSimplifiedInstallmentPayment && paymentForm.entry_id && paymentPreview.originalInstallmentsCount > 1 && (
                      <MutedText>
                        Esta cobrança já está parcelada. Neste fluxo, registre apenas a quitação da parcela em aberto.
                      </MutedText>
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
                          <span>Valor da cobrança</span>
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
                              ? "Saldo em crédito"
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
                              <span>Parcelamento da cobrança</span>
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
          <ProtectedBackdrop onClick={closePaymentModal} $hasInput={paymentModalHasInput} />
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
          <ProtectedBackdrop onClick={closeMethodModal} $hasInput={methodModalHasInput} />
        </>
      )}

      <UnsavedChangesDialog
        open={Boolean(discardModalClose)}
        onKeepEditing={keepModalEditing}
        onDiscard={discardModalChanges}
      />
    </FinancePage>
  );
}


const Header = styled.div`
  position: relative;
  margin-bottom: 10px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
  min-height: 52px;
`;

const HeaderText = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

const HeaderTitleRow = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
`;

const PrivacyToggle = styled.button`
  width: 36px;
  height: 36px;
  border-radius: 999px;
  border: 1px solid rgba(37, 51, 44, 0.1);
  background: #f8faf8;
  color: #5d6f63;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background 0.16s ease, border-color 0.16s ease, color 0.16s ease;

  &:hover,
  &:focus-visible {
    background: #eef5ef;
    border-color: rgba(95, 121, 87, 0.35);
    color: #314036;
    outline: none;
  }
`;

const Title = styled.h1`
  margin: 0;
  color: #2b2b2b;
  font-size: 34px;
  font-weight: 800;
`;

const TabsWrapper = styled.div`
  display: flex;
  justify-content: center;
`;

const HeaderTabsSlot = styled.div`
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  display: flex;
  justify-content: center;
  max-width: calc(100% - 280px);

  @media (max-width: 900px) {
    position: static;
    order: 3;
    width: 100%;
    max-width: none;
    transform: none;
  }
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

const PatientDetailTabsRow = styled(TabsRow)`
  justify-self: start;
`;

const PatientDetailTabButton = styled(TabButton)``;




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

// Financeiro usa estilo visual próprio de tabela - override sobre SharedDataTable para manter pixel-perfect.
const tableOverrides = `
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

const EntriesTable = styled(SharedDataTable)`
  ${tableOverrides}
`;

const SimpleTable = styled(SharedDataTable)`
  ${tableOverrides}
`;

const TableScroll = styled.div`
  width: 100%;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
`;

const AttendancePackageSessionsScroll = styled(TableScroll)`
  max-height: min(420px, 52vh);
  overflow-y: auto;
  border-top: 1px solid ${ATTENDANCE_UI.colors.border};

  table {
    margin: 0;
  }

  thead th {
    position: sticky;
    top: 0;
    z-index: 1;
    background: ${ATTENDANCE_UI.colors.surfaceMuted};
  }
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

const MutedText = styled.span`
  font-size: 12px;
  color: #7a7a7a;
`;

const FinancePage = styled.div`
  min-height: calc(100vh - 72px);
  background: ${appColors.workspaceBackground};
`;

const FinanceContent = styled.div`
  width: min(100%, 1600px);
  margin: 0 auto;
  padding: 24px 32px 64px;
  box-sizing: border-box;

  @media (max-width: 960px) {
    padding: 24px 20px 64px;
  }
`;

const SettingsTabs = styled.div`
  display: flex;
  gap: 24px;
  margin: 0 0 20px;
  border-bottom: 1px solid rgba(106, 121, 92, 0.22);
  overflow-x: auto;
`;

const SettingsTab = styled.a`
  position: relative;
  flex: 0 0 auto;
  padding: 10px 2px 12px;
  border: 0;
  background: transparent;
  color: ${(props) => (props.$active ? "#354a2c" : "#667160")};
  font-size: 0.92rem;
  font-weight: ${(props) => (props.$active ? 800 : 650)};
  text-decoration: none;

  &::after {
    content: "";
    position: absolute;
    right: 0;
    bottom: -1px;
    left: 0;
    height: 3px;
    background: ${(props) => (props.$active ? "#6a795c" : "transparent")};
  }

  &:hover {
    color: #354a2c;
  }

  &:focus-visible {
    outline: 3px solid rgba(106, 121, 92, 0.28);
    outline-offset: 2px;
  }
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

// Financeiro usa visual próprio - overrides sobre o SharedPrimaryButton para manter pixel-perfect.
const PrimaryButton = styled(SharedPrimaryButton)`
  gap: 8px;
  border-radius: 12px;
  padding: 10px 16px;
  font-size: inherit;
  white-space: normal;
  transition: background 0.15s ease, transform 0.15s ease;

  &:hover:not(:disabled) {
    background: #5a684e;
  }

  &:disabled {
    opacity: 0.7;
  }
`;

// Financeiro usa visual próprio - overrides sobre o SharedGhostButton para manter pixel-perfect.
const GhostButton = styled(SharedGhostButton)`
  gap: 8px;
  background: #f0f3ec;
  color: #4f6b45;
  border: 1px solid rgba(106, 121, 92, 0.35);
  padding: 10px 16px;
  border-radius: 12px;
  font-weight: 700;
  font-size: 14px;
  transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease;

  &:hover {
    background: #e6ebe0;
    border-color: rgba(106, 121, 92, 0.6);
  }

  &:disabled {
    opacity: 0.7;
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

const BlockLoader = styled(SectionLoader)`
  min-height: 96px;
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

const AttendanceInlineLoader = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: ${ATTENDANCE_UI.colors.textSecondary};
  font-size: ${ATTENDANCE_UI.font.size.sm};
  font-weight: ${ATTENDANCE_UI.font.weight.semibold};

  ${Spinner} {
    width: 16px;
    height: 16px;
  }
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

const AttendanceHeadingTitle = styled(SectionTitle)`
  font-size: ${ATTENDANCE_UI.font.size.lg};
  line-height: ${ATTENDANCE_UI.font.lineHeight.lg};
  font-weight: ${ATTENDANCE_UI.font.weight.semibold};
  color: ${ATTENDANCE_UI.colors.textPrimary};
  letter-spacing: -0.01em;
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

const AttendancePeriodBlock = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${ATTENDANCE_UI.spacing[2]};
  flex-wrap: wrap;
  background: ${ATTENDANCE_UI.colors.surface};
  border: 1px solid ${ATTENDANCE_UI.colors.borderStrong};
  border-radius: ${ATTENDANCE_UI.radius.lg};
  padding: 14px ${ATTENDANCE_UI.spacing[2]};
  margin-bottom: ${ATTENDANCE_UI.spacing[2]};
`;

const AttendancePeriodBlockLeft = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
`;

const AttendancePeriodBlockLabel = styled.span`
  font-size: ${ATTENDANCE_UI.font.size.xs};
  font-weight: ${ATTENDANCE_UI.font.weight.semibold};
  color: ${ATTENDANCE_UI.colors.textTertiary};
  text-transform: uppercase;
  letter-spacing: 0.06em;
`;

const AttendancePeriodBlockValue = styled.span`
  font-size: ${ATTENDANCE_UI.font.size.xl};
  font-weight: ${ATTENDANCE_UI.font.weight.semibold};
  color: ${ATTENDANCE_UI.colors.textPrimary};
  letter-spacing: -0.01em;
`;

const AttendancePeriodBlockRight = styled.div`
  display: flex;
  align-items: center;
  gap: ${ATTENDANCE_UI.spacing[1]};
  flex-wrap: wrap;
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

const OverviewSummaryGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: ${ATTENDANCE_UI.spacing[2]};

  @media (max-width: 640px) {
    grid-template-columns: 1fr;
  }
`;

const OverviewSummaryColumn = styled.div`
  display: grid;
  gap: ${ATTENDANCE_UI.spacing[2]};
  align-content: start;
  padding: ${ATTENDANCE_UI.spacing[2]};
  border-radius: ${ATTENDANCE_UI.radius.lg};
  border: 1px solid ${(props) => (
    props.$variant === "current" ? ATTENDANCE_UI.colors.actionBorder : ATTENDANCE_UI.colors.borderStrong
  )};
  background: ${(props) => (
    props.$variant === "current" ? ATTENDANCE_UI.colors.actionSoft : ATTENDANCE_UI.colors.infoSoft
  )};
`;

const OverviewSummaryHeader = styled.div`
  color: ${ATTENDANCE_UI.colors.textTertiary};
  font-size: ${ATTENDANCE_UI.font.size.xs};
  line-height: ${ATTENDANCE_UI.font.lineHeight.xs};
  font-weight: ${ATTENDANCE_UI.font.weight.semibold};
  text-transform: uppercase;
  letter-spacing: 0.05em;
`;

const AttendanceMetricCard = styled(MetricCardSurface)`
  --app-metric-card-background: ${ATTENDANCE_UI.colors.surfaceMuted};
  --app-metric-card-border: ${ATTENDANCE_UI.colors.border};
  --app-metric-card-padding: ${ATTENDANCE_UI.spacing[2]};
  --app-metric-card-radius: ${ATTENDANCE_UI.radius.md};

  ${(props) => props.$summaryFinal && `
    margin-top: ${ATTENDANCE_UI.spacing[3]};

    &::before {
      content: "";
      position: absolute;
      left: 0;
      right: 0;
      top: -14px;
      height: 2px;
      border-radius: 999px;
      background: ${ATTENDANCE_UI.colors.borderStrong};
    }
  `}
`;

const AttendanceMetricLabel = styled(MetricCardLabel)`
  --app-metric-label-color: ${ATTENDANCE_UI.colors.textTertiary};
  --app-metric-label-line-height: ${ATTENDANCE_UI.font.lineHeight.xs};
  --app-metric-label-size: ${ATTENDANCE_UI.font.size.xs};
  --app-metric-label-weight: ${ATTENDANCE_UI.font.weight.medium};
`;

const AttendanceMetricValue = styled(MetricCardValue)`
  --app-metric-value-color: ${ATTENDANCE_UI.colors.textPrimary};
  --app-metric-value-line-height: ${ATTENDANCE_UI.font.lineHeight.lg};
  --app-metric-value-margin-top: ${ATTENDANCE_UI.spacing[1]};
  --app-metric-value-size: ${ATTENDANCE_UI.font.size.lg};
  --app-metric-value-weight: ${ATTENDANCE_UI.font.weight.semibold};
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

const AttendanceFilterInput = styled.input`
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

const AttendancePackageCard = styled.div`
  border: 1px solid ${ATTENDANCE_UI.colors.border};
  border-radius: ${ATTENDANCE_UI.radius.md};
  background: ${ATTENDANCE_UI.colors.surface};
  overflow: hidden;
`;

const AttendancePackageHeader = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: ${ATTENDANCE_UI.spacing[2]};
  padding: 12px 14px;
  border-bottom: 1px solid ${ATTENDANCE_UI.colors.border};
  background: ${ATTENDANCE_UI.colors.surfaceMuted};
`;

const AttendancePackageName = styled.strong`
  display: block;
  color: ${ATTENDANCE_UI.colors.textPrimary};
  font-size: ${ATTENDANCE_UI.font.size.sm};
  line-height: ${ATTENDANCE_UI.font.lineHeight.sm};
  font-weight: ${ATTENDANCE_UI.font.weight.semibold};
`;

const AttendancePackageSummary = styled.div`
  display: grid;
  gap: 14px;
  padding: 14px;
  border-bottom: 1px solid ${ATTENDANCE_UI.colors.border};
  background: ${ATTENDANCE_UI.colors.surface};
`;

const AttendancePackageSummarySection = styled.div`
  display: grid;
  gap: 8px;
`;

const AttendancePackageSummaryTitle = styled.strong`
  color: ${ATTENDANCE_UI.colors.textPrimary};
  font-size: ${ATTENDANCE_UI.font.size.xs};
  line-height: ${ATTENDANCE_UI.font.lineHeight.xs};
  font-weight: ${ATTENDANCE_UI.font.weight.semibold};
  text-transform: uppercase;
  letter-spacing: 0;
`;

const AttendancePackageDistributionLine = styled.div`
  display: inline-flex;
  width: fit-content;
  max-width: 100%;
  min-height: 36px;
  align-items: center;
  padding: 8px 11px;
  border: 1px solid ${ATTENDANCE_UI.colors.border};
  border-radius: ${ATTENDANCE_UI.radius.sm};
  background: ${ATTENDANCE_UI.colors.surfaceMuted};
  color: ${ATTENDANCE_UI.colors.textSecondary};
  font-size: ${ATTENDANCE_UI.font.size.xs};
  line-height: ${ATTENDANCE_UI.font.lineHeight.xs};
`;

const AttendancePackageFinanceGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 8px;
`;

const AttendancePackageFinanceItem = styled.div`
  display: grid;
  gap: 4px;
  min-height: 58px;
  padding: 10px 12px;
  border: 1px solid ${({ $highlight, $muted }) => {
    if ($highlight) return ATTENDANCE_UI.colors.actionBorder;
    if ($muted) return ATTENDANCE_UI.colors.dangerBorder;
    return ATTENDANCE_UI.colors.border;
  }};
  border-radius: ${ATTENDANCE_UI.radius.sm};
  background: ${({ $highlight, $muted }) => {
    if ($highlight) return ATTENDANCE_UI.colors.actionSoft;
    if ($muted) return ATTENDANCE_UI.colors.dangerSoft;
    return ATTENDANCE_UI.colors.surfaceMuted;
  }};

  span {
    color: ${ATTENDANCE_UI.colors.textSecondary};
    font-size: ${ATTENDANCE_UI.font.size.xs};
    line-height: ${ATTENDANCE_UI.font.lineHeight.xs};
  }

  strong {
    color: ${ATTENDANCE_UI.colors.textPrimary};
    font-size: ${ATTENDANCE_UI.font.size.sm};
    line-height: ${ATTENDANCE_UI.font.lineHeight.sm};
    font-weight: ${ATTENDANCE_UI.font.weight.semibold};
  }
`;

const AttendancePatientDetailBlock = styled.div`
  display: grid;
  gap: ${ATTENDANCE_UI.spacing[3]};
`;

const AttendancePatientDetailTopline = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${ATTENDANCE_UI.spacing[2]};
  flex-wrap: wrap;
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

const AttendanceCreditUseAction = styled(AttendancePrimaryAction)`
  min-height: 38px;
  padding: 8px 14px;
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

const BillingCyclesTable = styled(AttendanceOverviewTable)`
  min-width: ${(props) => (props.$detail ? "100%" : "900px")};
  max-width: 100%;
  table-layout: ${(props) => (props.$detail ? "fixed" : "auto")};

  ${(props) => (props.$detail ? `
    th,
    td {
      box-sizing: border-box;
      padding: 14px 7px;
    }

    th:first-child,
    td:first-child {
      width: 10%;
    }

    th:nth-child(2),
    td:nth-child(2) {
      width: 18%;
    }

    th:nth-child(3),
    td:nth-child(3) {
      width: 8%;
    }

    th:nth-child(4),
    td:nth-child(4),
    th:nth-child(5),
    td:nth-child(5) {
      width: 12%;
      white-space: nowrap;
    }

    th:nth-child(6),
    td:nth-child(6) {
      width: 13%;
      white-space: nowrap;
    }

    th:nth-child(7),
    td:nth-child(7) {
      width: 14%;
      text-align: center;
    }
  ` : "")}

  th:last-child,
  td:last-child {
    text-align: center;
    width: ${(props) => (props.$detail ? "8%" : "120px")};
    white-space: nowrap;
  }

  td:last-child > div {
    justify-content: center;
  }

  ${(props) => (props.$billingPatientDetail ? `
    min-width: 0;

    th,
    td {
      padding: 14px 10px;
    }

    th:first-child,
    td:first-child {
      width: 28%;
    }

    th:nth-child(2),
    td:nth-child(2) {
      width: 18%;
    }

    th:nth-child(3),
    td:nth-child(3) {
      width: 12%;
    }

    th:nth-child(4),
    td:nth-child(4),
    th:nth-child(5),
    td:nth-child(5) {
      width: 11%;
      white-space: nowrap;
    }

    th:nth-child(6),
    td:nth-child(6) {
      width: 12%;
      white-space: nowrap;
    }

    th:nth-child(7),
    td:nth-child(7) {
      width: 8%;
      text-align: right;
      white-space: nowrap;
    }

    td:last-child > div {
      justify-content: flex-end;
    }

    @media (max-width: 760px) {
      min-width: 720px;
    }
  ` : "")}

  @media (max-width: 900px) and (min-width: 761px) {
    min-width: ${(props) => {
    if (props.$billingPatientDetail) return "0";
    if (props.$detail) return "760px";
    return "900px";
  }};
  }
`;

const BillingCyclesDetailContent = styled.div`
  padding: ${ATTENDANCE_UI.spacing[3]};
`;

const BillingCyclesInnerTableCard = styled(AttendanceTableCard)`
  box-shadow: none;
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

const BillingCyclePlanName = styled(AttendancePrimaryText)`
  display: -webkit-box;
  max-width: 100%;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  color: ${ATTENDANCE_UI.colors.textPrimary};
  font-weight: ${ATTENDANCE_UI.font.weight.semibold};
  overflow-wrap: anywhere;
`;

const BillingCycleCountText = styled(AttendancePrimaryText)`
  white-space: nowrap;
`;

const BillingCycleNoChargeCell = styled.td`
  && {
    color: ${ATTENDANCE_UI.colors.textSecondary};
    text-align: left;
  }
`;

const AttendanceSecondaryText = styled.span`
  color: ${ATTENDANCE_UI.colors.textSecondary};
  font-size: ${ATTENDANCE_UI.font.size.sm};
  line-height: ${ATTENDANCE_UI.font.lineHeight.sm};
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
    if (props.$status === "pending" || props.$status === "open" || props.$status === "overdue") return "rgba(190, 58, 58, 0.12)";
    if (props.$status === "covered_by_plan") return ATTENDANCE_UI.colors.neutralSoft;
    return ATTENDANCE_UI.colors.neutralSoft;
  }};
  color: ${(props) => {
    if (props.$status === "credit") return ATTENDANCE_UI.colors.action;
    if (props.$status === "paid" || props.$status === "done") return ATTENDANCE_UI.colors.successText;
    if (props.$status === "partial") return ATTENDANCE_UI.colors.infoText;
    if (props.$status === "pending" || props.$status === "open" || props.$status === "overdue") return "#9a2f2f";
    if (props.$status === "covered_by_plan") return ATTENDANCE_UI.colors.textSecondary;
    return ATTENDANCE_UI.colors.neutralText;
  }};
`;

const AttendanceRowActions = styled(RowActions)`
  width: 100%;
  justify-content: flex-end;
`;

const AttendanceSmallAction = styled(SmallButton)`
  background: ${ATTENDANCE_UI.colors.action};
  color: #fff;
  border: 1px solid ${ATTENDANCE_UI.colors.action};
  border-radius: ${ATTENDANCE_UI.radius.sm};
  padding: 7px 8px;
  font-size: ${ATTENDANCE_UI.font.size.xs};
  line-height: ${ATTENDANCE_UI.font.lineHeight.xs};
  font-weight: ${ATTENDANCE_UI.font.weight.semibold};
  box-shadow: 0 4px 10px rgba(95, 121, 87, 0.12);
  white-space: nowrap;

  &:hover {
    background: ${ATTENDANCE_UI.colors.actionHover};
    color: #fff;
    border-color: ${ATTENDANCE_UI.colors.actionHover};
    transform: translateY(-1px);
  }
`;

const AttendanceEmptyState = styled(EmptyState)`
  background: ${ATTENDANCE_UI.colors.surface};
  border: 1px dashed ${ATTENDANCE_UI.colors.borderStrong};
  border-radius: ${ATTENDANCE_UI.radius.md};
  color: ${ATTENDANCE_UI.colors.textTertiary};
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

const ModalHeaderText = styled.div`
  flex: 1 1 auto;
  min-width: 0;
`;

const ModalTitle = styled.h3`
  flex: 0 0 auto;
  margin: 0;
  font-size: 20px;
`;

const ModalContextLine = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  max-width: 100%;
  min-width: 0;
  margin-top: 6px;
  color: #5e6757;
  font-size: 13px;

  span {
    flex: 0 0 auto;
    color: #78806f;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    font-size: 11px;
    font-weight: 700;
  }

  strong {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: #34422d;
    font-size: 15px;
  }
`;

const ModalSubtitle = styled.p`
  margin: 4px 0 0;
  color: #6d6d6d;
`;

const BillingCyclePreviewSummary = styled.div`
  margin-top: 8px;
  display: flex;
  flex-direction: column;
  gap: 3px;
  color: #34422d;

  strong {
    font-size: 1rem;
  }

  span {
    color: #4f6045;
    font-weight: 700;
  }

  small {
    color: #6d6d6d;
    font-size: 0.9rem;
  }
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

const PaymentPreviewSectionTitle = styled.h5`
  margin: 8px 0 0;
  padding-top: 10px;
  border-top: 1px solid rgba(47, 59, 38, 0.14);
  font-size: 13px;
  color: #2f3b26;
  text-transform: uppercase;
  letter-spacing: 0.04em;
`;

const PaymentPreviewRow = styled.div`
  display: flex;
  justify-content: space-between;
  gap: 10px;
  align-items: baseline;
  font-size: ${({ $emphasis, $total }) => {
    if ($emphasis || $total) return "15px";
    return "14px";
  }};
  font-weight: ${({ $emphasis, $total }) => {
    if ($emphasis || $total) return 700;
    return 400;
  }};
  color: #2f2f2f;

  strong {
    font-size: ${({ $emphasis, $total }) => {
    if ($total) return "18px";
    if ($emphasis) return "16px";
    return "14px";
  }};
    color: ${({ $balance, $discount }) => {
    if ($discount) return "#a33a2b";
    if ($balance) return "#7a3f14";
    return "#2f2f2f";
  }};
    white-space: nowrap;
  }

  span {
    min-width: 0;
    color: ${({ $discount }) => ($discount ? "#8d3025" : "inherit")};
  }
`;

const PaymentPreviewValue = styled.div`
  display: inline-flex;
  align-items: baseline;
  justify-content: flex-end;
  gap: 8px;
  min-width: 0;
`;

const DiscountFlag = styled.span`
  color: #a33a2b !important;
  font-size: 12px;
  font-weight: 700;
  white-space: nowrap;
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

const CompactModalCard = styled(ModalCard)`
  width: min(420px, calc(100vw - 32px));
  padding: 18px;

  ${ModalHeader} {
    margin-bottom: 12px;
  }

  ${ModalBody} {
    gap: 10px;
    min-height: 0;
    padding-right: 0;
    margin-right: 0;
  }

  ${EmptyState} {
    padding: 12px;
    min-height: 0;
  }

  ${ModalActions} {
    margin-top: 10px;
    padding-top: 10px;
  }

  @media (max-width: 760px) {
    padding: 14px;
  }
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

const Select = styled.select`
  padding: 10px 12px;
  border-radius: 10px;
  border: 1px solid rgba(0, 0, 0, 0.15);
  background: #fff;
`;

const SearchFieldWrapper = styled.div`
  position: relative;
`;

const FixedPatientDisplay = styled.div`
  width: 100%;
  min-height: 44px;
  display: flex;
  align-items: center;
  padding: 10px 0;
  color: #1f2933;
  font-weight: 700;
  line-height: 1.35;
  white-space: normal;
  word-break: normal;
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
