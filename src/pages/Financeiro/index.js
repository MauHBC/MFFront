/* eslint-disable no-use-before-define */
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import styled from "styled-components";
import {
  FaTimes,
  FaPlus,
} from "react-icons/fa";
import { toast } from "react-toastify";

import { FinancialStatusPill } from "../../components/AppFinancialStatus";
import { NeutralPill } from "../../components/AppStatus";
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
import { useAuthorization } from "../../contexts/AuthorizationContext";
import { colors as appColors, fontSizes, layout, radii, spacing } from "../../styles/tokens";
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
  createClinicExpenseWithPayment,
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
import {
  buildClinicExpensePaymentInput,
  requiresExpenseSettlementAdjustment,
} from "./helpers/clinicExpensePayment";
import FinancialPaymentModal from "./components/FinancialPaymentModal";
import FinancialOverviewSection from "./components/FinancialOverviewSection";
import FinancialHistory from "./components/FinancialHistory";
import FinancialCancellationDetails from "./components/FinancialCancellationDetails";
import FinancialCancellationModal from "./components/FinancialCancellationModal";
import FinancialCreditUseModal from "./components/FinancialCreditUseModal";
import useFinancialPaymentFlow from "./hooks/useFinancialPaymentFlow";
import currentObligationCents, { currentObligationFinancial } from "./helpers/currentObligation";
import {
  mergeUnifiedRevenueSummaries,
  buildUnifiedReceiptGroups,
  mapUnifiedRevenueCharge,
  revenueTypeLabel,
  validateUnifiedRevenueDetail,
} from "./helpers/unifiedRevenueCharges";
import {
  emptyFinancialRevenuesSummary,
  filterFinancialRevenuesSummary,
  mapRevenuesSummaryPatientsToAttendanceRows,
  mapRevenuesSummaryToAttendanceSummary,
  normalizeFinancialRevenuesSummary,
} from "./helpers/financialRevenuesSummary";
import {
  emptyClinicExpenseSummary,
  formatCurrencyInputFromCents,
  formatDateOnlyBR as formatExpenseDateOnlyBR,
  getClinicExpenseObservation,
  getClinicExpensePaidAmountCents,
  normalizeClinicExpenseSummary,
} from "./helpers/expenseFormatters";
import { formatExpenseAlertCount } from "./helpers/expenseDueAlerts";
import { formatClinicExpenseStatus, getClinicExpenseStatus } from "./helpers/expenseStatus";
import {
  getBillingDueStatus,
  getGroupedBillingDuePresentation,
  getGroupedReferenceDatePresentation,
} from "./helpers/billingCycleDueStatus";

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

const resolveBillingPaymentStatus = (paidCents, openCents) => {
  const paid = Number(paidCents || 0);
  const open = Number(openCents || 0);

  if (open <= 0) return "paid";
  if (paid > 0) return "partial";
  return "pending";
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
  if (status === "suspended") return "Suspensa";
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
  adjusted_final_confirmed: false,
  settlement_reason: "",
});

const createEmptyClinicExpensePayment = () => ({
  expense: null,
  paid_at: toDateInputValue(new Date()),
  paid_amount: "",
  payment_notes: "",
  adjusted_final_confirmed: false,
  settlement_reason: "",
});

const emptyFinancialOverview = (period = "", periodMode = "month") => ({
  ...(periodMode === "year" ? { year: period } : { month: period }),
  summary: {
    incomeTotal: 0,
    expenseTotal: 0,
    periodResult: 0,
    hasAccounts: false,
    received: 0,
    receivable: 0,
    paidExpenses: 0,
    pendingExpenses: 0,
    currentResult: 0,
    pendingBalance: 0,
  },
  months: [],
  hasMonthlyBreakdown: false,
  hasMovement: false,
});

const OVERVIEW_AMOUNT_FIELDS = [
  "incomeTotal", "expenseTotal", "periodResult", "received", "receivable",
  "paidExpenses", "pendingExpenses",
];

const normalizeOverviewSummary = (payload) => {
  if (!payload || typeof payload.hasAccounts !== "boolean") return null;
  const summary = { hasAccounts: payload.hasAccounts };
  for (let index = 0; index < OVERVIEW_AMOUNT_FIELDS.length; index += 1) {
    const field = OVERVIEW_AMOUNT_FIELDS[index];
    const raw = payload[field];
    if (raw == null || raw === "" || !["number", "string"].includes(typeof raw)) return null;
    const value = Number(raw);
    if (!Number.isFinite(value)) return null;
    summary[field] = value;
  }
  return summary;
};

const normalizeFinancialOverviewMonths = (items, year) => {
  if (!Array.isArray(items) || items.length !== 12 || !/^\d{4}$/.test(String(year || ""))) {
    return null;
  }

  const itemsByMonth = new Map();
  for (let itemIndex = 0; itemIndex < items.length; itemIndex += 1) {
    const item = items[itemIndex];
    const month = String(item?.month || "");
    if (itemsByMonth.has(month)) return null;
    itemsByMonth.set(month, item);
  }

  const normalizedItems = [];
  for (let index = 0; index < 12; index += 1) {
    const month = `${year}-${String(index + 1).padStart(2, "0")}`;
    const source = itemsByMonth.get(month);
    if (!source) return null;

    const summary = normalizeOverviewSummary(source);
    if (!summary) return null;
    normalizedItems.push({ month, ...summary });
  }
  return normalizedItems;
};

const normalizeFinancialOverview = (
  payload = {},
  fallbackPeriod = "",
  periodMode = "month",
) => {
  const summary = normalizeOverviewSummary(payload);
  if (!summary) throw new Error("Invalid financial overview response");
  const annualMonths = periodMode === "year"
    ? normalizeFinancialOverviewMonths(payload.months, payload.year || fallbackPeriod)
    : null;

  return {
    ...(periodMode === "year"
      ? { year: payload.year || fallbackPeriod }
      : { month: payload.month || fallbackPeriod }),
    summary,
    months: annualMonths || [],
    hasMonthlyBreakdown: Array.isArray(annualMonths),
    hasMovement: summary.hasAccounts,
  };
};

export default function Financeiro() {
  const routeLocation = useLocation();
  const authorization = useAuthorization();
  const canManageClinicExpenses = authorization.canAccessModule("finance", "manage");
  const canSettleClinicExpenses = canManageClinicExpenses
    && authorization.hasCapability("finance.settle");
  const canResolveFinancialCancellation = authorization.canAccessModule("finance", "manage")
    && authorization.hasCapability("finance.settle");
  const [activeSection, setActiveSection] = useState(() =>
    getFinancialSectionFromPath(routeLocation.pathname)
  );
  const [receitasView, setReceitasView] = useState("atendimentos");
  const [revenueTypes, setRevenueTypes] = useState(["billing_cycle", "series", "entry"]);
  const showRevenueProfessional = revenueTypes.length > 0 && !revenueTypes.includes("billing_cycle");
  const [unifiedCharges, setUnifiedCharges] = useState(null);
  const [revenueProfessionals, setRevenueProfessionals] = useState([]);
  const [revenuePatientSearchError, setRevenuePatientSearchError] = useState("");
  const [revenuePatientSearchLoading, setRevenuePatientSearchLoading] = useState(false);
  const [revenuePatientSearchRetry, setRevenuePatientSearchRetry] = useState(0);
  const [loadingOverview, setLoadingOverview] = useState(true);
  const [overviewError, setOverviewError] = useState("");
  const [loadingRevenues, setLoadingRevenues] = useState(false);
  const [loadingRevenuesSummary, setLoadingRevenuesSummary] = useState(false);
  const [revenuesSummaryError, setRevenuesSummaryError] = useState("");
  const [revenuesSummaryQuery, setRevenuesSummaryQuery] = useState(null);
  const [revenuesSummaryFailedQuery, setRevenuesSummaryFailedQuery] = useState(null);
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
  const [attendanceListPresentationByPatient, setAttendanceListPresentationByPatient] = useState(
    () => new Map(),
  );
  const revenuesSummaryRequestRef = useRef(0);
  const [, setAttendanceSeries] = useState([]);
  const [attendanceSessions, setAttendanceSessions] = useState([]);
  const [clinicExpensesMonth, setClinicExpensesMonth] = useState(() =>
    toMonthInputValue(new Date()),
  );
  const [overviewTab, setOverviewTab] = useState("summary");
  const [overviewPeriodMode, setOverviewPeriodMode] = useState("month");
  const [overviewPeriodMonth, setOverviewPeriodMonth] = useState(() =>
    toMonthInputValue(new Date()),
  );
  const [overviewPeriodYear, setOverviewPeriodYear] = useState(() =>
    String(new Date().getFullYear()),
  );
  const overviewMonthPickerRef = useRef(null);
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
    cacheKey: "",
    sessions: [],
    isLoading: false,
    error: "",
  });
  const [attendanceDetailPackages, setAttendanceDetailPackages] = useState([]);
  const [attendanceFinancialContext, setAttendanceFinancialContext] = useState(null);
  const [cancellationTarget, setCancellationTarget] = useState(null);
  const [attendanceDetailSummary, setAttendanceDetailSummary] = useState(null);
  const [attendanceBackendCreditByPatient, setAttendanceBackendCreditByPatient] = useState(() => new Map());
  const [attendanceDetailTab, setAttendanceDetailTab] = useState("charges");
  const [attendanceHistoryFilter, setAttendanceHistoryFilter] = useState("all");
  const [selectedAttendancePackageId, setSelectedAttendancePackageId] = useState(null);
  const [attendanceCycleSessions, setAttendanceCycleSessions] = useState(null);
  const [attendanceCycleSessionsAttempt, setAttendanceCycleSessionsAttempt] = useState(0);
  const revenueChargeDetailRef = useRef(null);
  const revenueChargeDetailCloseRef = useRef(null);
  const revenueChargeDetailHandoffRef = useRef(false);
  revenueChargeDetailHandoffRef.current = Boolean(cancellationTarget);
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
  const financeAuthorizationRef = useRef(authorization.context);

  useEffect(() => {
    if (activeSection !== "receitas" || !attendanceFilters.search.trim()
      || attendanceDrilldownPatientId) {
      setRevenuePatientSearchError("");
      setRevenuePatientSearchLoading(false);
      return undefined;
    }
    let active = true;
    setRevenuePatientSearchLoading(true);
    const timer = setTimeout(() => {
      setRevenuePatientSearchError("");
      axios.get("/patients").then((response) => {
        if (active) setPatients(Array.isArray(response.data) ? response.data : []);
      }).catch(() => {
        if (active) setRevenuePatientSearchError("Não foi possível pesquisar pacientes. Tente pesquisar novamente.");
      }).finally(() => {
        if (active) setRevenuePatientSearchLoading(false);
      });
    }, 250);
    return () => { active = false; clearTimeout(timer); };
  }, [activeSection, attendanceFilters.search, attendanceDrilldownPatientId, revenuePatientSearchRetry]);

  const [billingCycles, setBillingCycles] = useState([]);
  const [isBillingCyclesLoading, setIsBillingCyclesLoading] = useState(false);
  const [hasBillingCyclesLoaded, setHasBillingCyclesLoaded] = useState(false);
  const [billingCyclesError, setBillingCyclesError] = useState("");
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
  const billingCyclesDetailRequestRef = useRef(0);
  const [billingCyclesDetailTab, setBillingCyclesDetailTab] = useState("charges");
  const [billingCyclesHistoryFilter, setBillingCyclesHistoryFilter] = useState("all");
  const [billingCyclesPatientDetail, setBillingCyclesPatientDetail] = useState({
    patientId: null,
    periodKey: "",
    data: null,
    isLoading: false,
    error: "",
  });

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
    if (view && !["mensalidades", "atendimentos", "receitas"].includes(view)) return;
    if (!view && !params.has("month") && !params.has("year") && !params.has("patient_id")) return;

    setActiveSection("receitas");
    setReceitasView("atendimentos");
    setRevenueTypes((previous) => {
      const next = view === "mensalidades" ? ["billing_cycle"] : ["billing_cycle", "series", "entry"];
      return previous.length === next.length && next.every((type) => previous.includes(type)) ? previous : next;
    });

    const month = params.get("month");
    const parsedMonth = parseMonthInputValue(month);
    if (parsedMonth) {
      setAttendancePeriodMode("month");
      setAttendancePeriodMonth(month);
      setAttendancePeriodYear(String(parsedMonth.year));
    }
    if (/^\d{4}$/.test(params.get("year") || "")) {
      setAttendancePeriodMode("year");
      setAttendancePeriodYear(params.get("year"));
    }

    const patientId = normalizeId(params.get("patient_id"));
    if (patientId) {
      setAttendanceDrilldownPatientId(String(patientId));
    }

    const patientName = String(params.get("patient_name") || "").trim();
    if (patientName) {
      setAttendanceFilters((prev) => (
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
  const [clinicExpenseDeleteScope, setClinicExpenseDeleteScope] = useState("single");
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

  useEffect(() => {
    setAttendanceHistoryFilter("all");
  }, [selectedAttendancePatientId, attendanceDetailTab]);

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

  const overviewPeriodLabel = useMemo(() => {
    if (overviewPeriodMode === "year") return overviewPeriodYear;
    const parsed = parseMonthInputValue(overviewPeriodMonth);
    if (!parsed) return "";
    return formatMonthYear(new Date(parsed.year, parsed.month - 1, 1));
  }, [overviewPeriodMode, overviewPeriodMonth, overviewPeriodYear]);

  const overviewYearOptions = useMemo(() => {
    const nowYear = new Date().getFullYear();
    const selectedYear = Number(overviewPeriodYear) || nowYear;
    return Array.from({ length: 11 }, (_, index) => String(selectedYear - 5 + index));
  }, [overviewPeriodYear]);

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
    && !attendanceDrilldownPatientId
  ), [
    attendanceDrilldownPatientId,
    receitasView,
  ]);

  const loadOverviewData = useCallback(async () => {
    if (overviewTab !== "summary") return;
    const overviewPeriod = overviewPeriodMode === "year"
      ? overviewPeriodYear
      : overviewPeriodMonth;
    if (!overviewPeriod) return;

    const requestId = overviewRequestRef.current + 1;
    overviewRequestRef.current = requestId;
    try {
      setLoadingOverview(true);
      setOverviewError("");
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
      setOverviewError("Não foi possível carregar o Resumo. Tente novamente selecionando o período.");
      setOverviewSummary(emptyFinancialOverview(overviewPeriod, overviewPeriodMode));
    } finally {
      if (requestId === overviewRequestRef.current) {
        setLoadingOverview(false);
      }
    }
  }, [overviewTab, overviewPeriodMode, overviewPeriodMonth, overviewPeriodYear]);

  const revenuesPeriodKey = `${attendancePeriodMode}:${attendancePeriodMode === "year" ? attendancePeriodYear : attendancePeriodMonth}`;
  const revenuesQueryKey = JSON.stringify([revenuesPeriodKey, [...revenueTypes].sort(),
    showRevenueProfessional ? attendanceFilters.professional_id : ""]);
  const revenuesQueryRef = useRef(null);
  revenuesQueryRef.current = { key: revenuesQueryKey, context: authorization.context };

  const loadRevenuesSummary = useCallback(async () => {
    const summaryPeriod = attendancePeriodMode === "year"
      ? attendancePeriodYear
      : attendancePeriodMonth;
    if (!summaryPeriod) return;

    const requestId = revenuesSummaryRequestRef.current + 1;
    revenuesSummaryRequestRef.current = requestId;
    const query = { key: revenuesQueryKey, period: revenuesPeriodKey,
      types: revenueTypes, context: authorization.context };

    try {
      setLoadingRevenuesSummary(true);
      setRevenuesSummaryError("");
      setRevenuesSummaryFailedQuery(null);
      const chargeTypes = revenueTypes.length === 3 ? ["all"] : revenueTypes;
      const responses = await Promise.all(chargeTypes.map((chargeType) => (
        getFinancialRevenuesSummary(summaryPeriod, attendancePeriodMode, {
          origin: "all",
          charge_type: chargeType,
          ...(showRevenueProfessional && attendanceFilters.professional_id
            ? { professional_id: attendanceFilters.professional_id } : {}),
        })
      )));
      if (revenuesSummaryRequestRef.current !== requestId
        || revenuesQueryRef.current.key !== query.key
        || revenuesQueryRef.current.context !== query.context) return;
      const response = { data: mergeUnifiedRevenueSummaries(responses.map((item) => item.data), summaryPeriod) };
      const normalizedSummary = normalizeFinancialRevenuesSummary(
        response.data || {},
        summaryPeriod,
      );
      setRevenuesSummary(normalizedSummary);
      setRevenuesSummaryQuery(query);
      setRevenueProfessionals(response.data.professionals || []);
      setAttendanceListPresentationByPatient(new Map(response.data.patients.map((patient) => [
        Number(patient.patient_id), {
          referenceItems: [{ referenceDate: patient.reference_date, openCents: 0 }],
          dueDate: patient.due_date,
          overdueCents: Number(patient.overdue_cents || 0),
        },
      ])));
    } catch (error) {
      if (revenuesSummaryRequestRef.current !== requestId
        || revenuesQueryRef.current.key !== query.key
        || revenuesQueryRef.current.context !== query.context) return;
      setRevenuesSummaryError("Não foi possível carregar o resumo de receitas.");
      setRevenuesSummaryFailedQuery(query.key);
      toast.error("Não foi possível carregar o resumo de receitas.");
    } finally {
      if (revenuesSummaryRequestRef.current === requestId) {
        setLoadingRevenuesSummary(false);
      }
    }
  }, [attendancePeriodMode, attendancePeriodMonth, attendancePeriodYear,
    attendanceFilters.professional_id, revenueTypes, showRevenueProfessional,
    revenuesPeriodKey, revenuesQueryKey, authorization.context]);

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

  useEffect(() => {
    if (activeSection === "receitas" && receitasView === "atendimentos"
      && selectedAttendancePatientId) {
      loadPaymentMethodsData();
    }
  }, [activeSection, receitasView, selectedAttendancePatientId, attendanceDetailTab, loadPaymentMethodsData]);

  const loadBillingCycles = useCallback(async () => {
    try {
      setIsBillingCyclesLoading(true);
      setBillingCyclesError("");
      const params = {};
      if (billingCyclesFilters.start) params.from = billingCyclesFilters.start;
      if (billingCyclesFilters.end) params.to = billingCyclesFilters.end;
      const response = await listBillingCycles(params);
      setBillingCycles(response.data || []);
      setHasBillingCyclesLoaded(true);
    } catch (error) {
      const message = getUserFacingApiError(
        error,
        "Não foi possível carregar as mensalidades.",
      ) || "Não foi possível carregar as mensalidades.";
      setBillingCyclesError(message);
      setHasBillingCyclesLoaded(true);
      toast.error(message);
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
      amount: formatCurrencyInputFromCents(openAmountCents),
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
    setCreditUseModalContext(null);
  }, []);

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
      if (isPaymentOpen) closePaymentModal();
    };
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isPaymentOpen, closePaymentModal]);

  const openClinicExpenseModal = useCallback((expense = null) => {
    if (expense?.id) {
      setClinicExpenseForm({
        description: expense.name || "",
        category: expense.category_name || expense.category || "",
        category_id: expense.category_id ? String(expense.category_id) : "",
        amount: formatCurrencyInputFromCents(expense.amount_cents),
        reference_month: String(expense.reference_month || expense.due_date || "").slice(0, 7),
        due_date: String(expense.due_date || "").slice(0, 10),
        status: expense.paid_at ? "paid" : "open",
        recurrence_type: expense.recurrence_type || "none",
        paid_at: expense.paid_at ? String(expense.paid_at).slice(0, 10) : toDateInputValue(new Date()),
        paid_amount: formatCurrencyInputFromCents(
          expense.paid_amount_cents || expense.amount_cents,
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
    const { name, value, checked } = event.target;
    if (name === "adjusted_final_confirmed") {
      setClinicExpenseForm((prev) => ({ ...prev, [name]: checked }));
      return;
    }
    if (name === "amount") {
      setClinicExpenseForm((prev) => ({
        ...prev,
        amount: sanitizePositiveCurrencyInput(value),
        adjusted_final_confirmed: false,
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
        adjusted_final_confirmed: false,
      }));
      return;
    }
    if (name === "status") {
      if (editingClinicExpenseId || (value === "paid" && !canSettleClinicExpenses)) return;
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
  }, [clinicExpenseCategories, editingClinicExpenseId, canSettleClinicExpenses]);

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

  const handleOverviewTabChange = useCallback((tab) => {
    const nextTab = ["received-paid", "distribution"].includes(tab) ? tab : "summary";
    if (nextTab === overviewTab) return;
    overviewRequestRef.current += 1;
    setLoadingOverview(true);
    setOverviewTab(nextTab);
  }, [overviewTab]);

  const handleOverviewPeriodModeChange = useCallback((mode) => {
    if (mode === "realized") {
      handleOverviewTabChange("received-paid");
      return;
    }
    const nextMode = mode === "year" ? "year" : "month";
    if (nextMode === overviewPeriodMode) return;
    setLoadingOverview(true);
    setOverviewPeriodMode(nextMode);
  }, [handleOverviewTabChange, overviewPeriodMode]);

  const handleOverviewMonthChange = useCallback((event) => {
    const { value } = event.target;
    if (!parseMonthInputValue(value)) return;
    setOverviewPeriodMonth(value);
  }, []);

  const handleOverviewYearChange = useCallback((event) => {
    const year = String(event.target.value || "").trim();
    if (!/^\d{4}$/.test(year)) return;
    setOverviewPeriodYear(year);
  }, []);

  const handleOverviewPeriodTagClick = useCallback(() => {
    if (overviewPeriodMode !== "month") return;
    const input = overviewMonthPickerRef.current;
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
  }, [overviewPeriodMode]);

  const shiftOverviewPeriod = useCallback((direction) => {
    if (!Number.isFinite(direction) || direction === 0) return;
    if (overviewTab !== "summary" || overviewPeriodMode === "year") {
      setOverviewPeriodYear((previousYear) => (
        String((Number(previousYear) || new Date().getFullYear()) + direction)
      ));
      return;
    }
    setOverviewPeriodMonth((prev) => {
      const parsed = parseMonthInputValue(prev);
      const baseDate = parsed
        ? new Date(parsed.year, parsed.month - 1, 1)
        : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
      const target = new Date(baseDate.getFullYear(), baseDate.getMonth() + direction, 1);
      return toMonthInputValue(target);
    });
  }, [overviewTab, overviewPeriodMode]);

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
    if (isClinicExpenseSaving) return;
    if (!canManageClinicExpenses) return;
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
    let payment = null;
    if (!editingClinicExpenseId && clinicExpenseForm.status === "paid") {
      if (!canSettleClinicExpenses) {
        toast.error("Você não tem permissão para registrar pagamentos.");
        return;
      }
      const input = buildClinicExpensePaymentInput({
        form: clinicExpenseForm,
        paidAmount: paidAmountValue,
        obligationAmountCents: Math.round(amountValue * 100),
      });
      if (input.error) {
        toast.error(input.error);
        return;
      }
      payment = input.payload;
    }

    const payload = {
      name: clinicExpenseForm.description.trim(),
      amount_cents: Math.round(amountValue * 100),
      due_date: clinicExpenseForm.due_date,
      notes: clinicExpenseForm.notes.trim() || null,
    };
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
        if (payment) {
          await createClinicExpenseWithPayment({ ...payload, payment });
        } else {
          await createClinicExpense(payload);
        }
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
  }, [clinicExpenseForm, editingClinicExpenseId, closeClinicExpenseModal, loadClinicExpensesData,
    isClinicExpenseSaving, canManageClinicExpenses, canSettleClinicExpenses]);

  const openClinicExpensePaymentModal = useCallback((entry) => {
    if (!entry?.id) return;
    setClinicExpensePaymentForm({
      ...createEmptyClinicExpensePayment(),
      expense: entry,
      paid_at: entry.paid_at ? String(entry.paid_at).slice(0, 10) : toDateInputValue(new Date()),
      paid_amount: formatCurrencyInputFromCents(
        entry.paid_amount_cents || entry.amount_cents,
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
    const { name, value, checked } = event.target;
    if (name === "adjusted_final_confirmed") {
      setClinicExpensePaymentForm((prev) => ({ ...prev, [name]: checked }));
      return;
    }
    if (name === "paid_amount") {
      setClinicExpensePaymentForm((prev) => ({
        ...prev,
        paid_amount: sanitizePositiveCurrencyInput(value),
        adjusted_final_confirmed: false,
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
    if (!entry?.id || clinicExpensePayingId || !canSettleClinicExpenses) return;

    const paidAmountValue = parseCurrencyInputToNumber(clinicExpensePaymentForm.paid_amount);
    const input = buildClinicExpensePaymentInput({
      form: clinicExpensePaymentForm,
      paidAmount: paidAmountValue,
      obligationAmountCents: Number(entry.amount_cents),
    });
    if (input.error) {
      toast.error(input.error);
      return;
    }

    try {
      setClinicExpensePayingId(entry.id);
      await payClinicExpense(entry.id, input.payload);
      toast.success(entry.paid_at ? "Pagamento atualizado com sucesso." : "Despesa marcada como paga.");
      setIsClinicExpensePaymentOpen(false);
      setClinicExpensePaymentForm(createEmptyClinicExpensePayment());
      loadClinicExpensesData();
    } catch (error) {
      toast.error(getUserFacingApiError(error, "Não foi possível salvar o pagamento."));
    } finally {
      setClinicExpensePayingId(null);
    }
  }, [clinicExpensePaymentForm, clinicExpensePayingId, loadClinicExpensesData, canSettleClinicExpenses]);

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
    setClinicExpenseDeleteScope("single");
    setClinicExpenseDeleteTarget(entry || null);
  }, []);

  const isRecurringExpenseDelete = clinicExpenseDeleteTarget?.recurrence_type === "monthly";
  const clinicExpenseDeleteConfirmLabel = clinicExpenseDeleteTarget?.recurrence_type === "monthly"
    ? "Confirmar exclusão" : "Excluir despesa";

  const closeClinicExpenseDeleteModal = useCallback(() => {
    if (isClinicExpenseDeleting) return;
    setClinicExpenseDeleteTarget(null);
  }, [isClinicExpenseDeleting]);

  const handleDeleteClinicExpense = useCallback(async (scope = "single") => {
    if (!clinicExpenseDeleteTarget?.id || isClinicExpenseDeleting) return;
    try {
      setIsClinicExpenseDeleting(true);
      if (scope === "single") {
        await deleteClinicExpense(clinicExpenseDeleteTarget.id);
      } else {
        await deleteClinicExpense(clinicExpenseDeleteTarget.id, scope);
      }
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
    validateUnifiedRevenueDetail(detail, patientId);
    setUnifiedCharges(detail.charges);
    const normalizedPatientId = String(patientId);
    const patientIdNumber = Number(normalizedPatientId);
    const detailPatient = detail?.patient?.id
      ? {
        id: Number(detail.patient.id),
        full_name: detail.patient.full_name || detail.patient.name || "Paciente",
        display_name: detail.patient.name || "Paciente",
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
    setAttendanceFinancialContext({
      history: Array.isArray(detail?.financial_history) ? detail.financial_history : null,
      pendingResolutions: Array.isArray(detail?.pending_resolutions) ? detail.pending_resolutions : [],
      resolutions: Array.isArray(detail?.cancellation_resolutions) ? detail.cancellation_resolutions : [],
    });
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
      cacheKey,
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
          full_name: summaryPatient.patient_full_name || summaryPatient.patient_name || "Paciente",
          display_name: summaryPatient.patient_name || "Paciente",
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
      cacheKey: detailCacheKey,
      sessions: [],
      isLoading: true,
      error: "",
    });
    setUnifiedCharges(null);
    setEntries([]);
    setPayments([]);
    setPatientCredits([]);
    setAttendanceSeries([]);
    setAttendanceSessions([]);
    setAttendanceDetailPackages([]);
    setAttendanceFinancialContext(null);
    setCancellationTarget(null);
    setAttendanceDetailSummary(null);

    try {
      const response = await getFinancialRevenuePatientDetail(
        normalizedPatientId,
        detailPeriod,
        detailPeriodMode,
        "all",
      );
      if (attendanceDetailRequestRef.current !== requestId) return;
      const detail = validateUnifiedRevenueDetail(response.data, normalizedPatientId);
      setUnifiedCharges(detail.charges);
      if (detailCacheKey) {
        attendanceDetailCacheRef.current.set(detailCacheKey, detail);
      }
      const detailPatient = detail.patient?.id
        ? {
          id: Number(detail.patient.id),
          full_name: detail.patient.full_name || detail.patient.name || "Paciente",
          display_name: detail.patient.name || "Paciente",
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
      setAttendanceFinancialContext({
        history: Array.isArray(detail.financial_history) ? detail.financial_history : null,
        pendingResolutions: Array.isArray(detail.pending_resolutions) ? detail.pending_resolutions : [],
        resolutions: Array.isArray(detail.cancellation_resolutions) ? detail.cancellation_resolutions : [],
      });
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
        cacheKey: detailCacheKey,
        sessions: Array.isArray(detail.sessions) ? detail.sessions : [],
        isLoading: false,
        error: "",
      });
    } catch (error) {
      if (attendanceDetailRequestRef.current !== requestId) return;
      setAttendanceDetailSessions({
        patientId: normalizedPatientId,
        cacheKey: detailCacheKey,
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
    setUnifiedCharges(null);
  }, []);

  useEffect(() => {
    if (!attendanceDrilldownPatientId) return;
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
    if (attendanceDetailSessions.cacheKey === cacheKey
      && (attendanceDetailSessions.isLoading || attendanceDetailSessions.error)) return;
    if (!cacheKey || attendanceDetailSummary?.cacheKey === cacheKey) return;
    handleViewPatientSessions(attendanceDrilldownPatientId, { keepTab: true });
  }, [
    attendanceDetailSessions.cacheKey,
    attendanceDetailSessions.error,
    attendanceDetailSessions.isLoading,
    attendanceDetailSummary?.cacheKey,
    attendanceDrilldownPatientId,
    attendancePeriodMode,
    attendancePeriodMonth,
    attendancePeriodYear,
    handleViewPatientSessions,
  ]);

  const loadBillingCyclesPatientDetail = useCallback(async (patientId, { keepTab = false } = {}) => {
    if (!patientId) return;
    const normalizedPatientId = String(patientId);
    const periodMode = billingCyclesPeriodMode === "year" ? "year" : "month";
    const period = periodMode === "year" ? billingCyclesPeriodYear : billingCyclesPeriodMonth;
    const periodKey = `${periodMode}:${period}`;
    const requestId = billingCyclesDetailRequestRef.current + 1;
    billingCyclesDetailRequestRef.current = requestId;
    setBillingCyclesDrilldownPatientId(normalizedPatientId);
    if (!keepTab) setBillingCyclesDetailTab("charges");
    setBillingCyclesPatientDetail({
      patientId: Number(normalizedPatientId),
      periodKey,
      data: null,
      isLoading: true,
      error: "",
    });
    try {
      const response = await getFinancialRevenuePatientDetail(
        normalizedPatientId,
        period,
        periodMode,
        "billing_cycle",
      );
      if (billingCyclesDetailRequestRef.current !== requestId) return;
      const data = response.data || {};
      if (Number(data?.patient?.id) !== Number(normalizedPatientId)
        || data?.origin !== "billing_cycle") {
        throw new Error("Resposta inválida para o detalhe de mensalidades.");
      }
      setBillingCyclesPatientDetail({
        patientId: Number(normalizedPatientId),
        periodKey,
        data,
        isLoading: false,
        error: "",
      });
    } catch (error) {
      if (billingCyclesDetailRequestRef.current !== requestId) return;
      setBillingCyclesPatientDetail({
        patientId: Number(normalizedPatientId),
        periodKey,
        data: null,
        isLoading: false,
        error: getUserFacingApiError(
          error,
          "Não foi possível carregar o crédito e o histórico de mensalidades.",
        ) || "Não foi possível carregar o crédito e o histórico de mensalidades.",
      });
    }
  }, [
    billingCyclesPeriodMode,
    billingCyclesPeriodMonth,
    billingCyclesPeriodYear,
  ]);

  const handleViewBillingCyclesPatient = useCallback((patientId) => {
    loadBillingCyclesPatientDetail(patientId);
  }, [loadBillingCyclesPatientDetail]);

  const handleCloseBillingCyclesPatient = useCallback(() => {
    billingCyclesDetailRequestRef.current += 1;
    setBillingCyclesDrilldownPatientId(null);
    setBillingCyclesDetailTab("charges");
    setBillingCyclesHistoryFilter("all");
    setBillingCyclesPatientDetail({
      patientId: null,
      periodKey: "",
      data: null,
      isLoading: false,
      error: "",
    });
  }, []);

  useEffect(() => {
    if (!billingCyclesDrilldownPatientId) return;
    const periodMode = billingCyclesPeriodMode === "year" ? "year" : "month";
    const period = periodMode === "year" ? billingCyclesPeriodYear : billingCyclesPeriodMonth;
    const periodKey = `${periodMode}:${period}`;
    if (billingCyclesPatientDetail.isLoading
      || (billingCyclesPatientDetail.patientId === Number(billingCyclesDrilldownPatientId)
        && billingCyclesPatientDetail.periodKey === periodKey)) return;
    loadBillingCyclesPatientDetail(billingCyclesDrilldownPatientId, { keepTab: true });
  }, [
    billingCyclesDrilldownPatientId,
    billingCyclesPatientDetail.isLoading,
    billingCyclesPatientDetail.patientId,
    billingCyclesPatientDetail.periodKey,
    billingCyclesPeriodMode,
    billingCyclesPeriodMonth,
    billingCyclesPeriodYear,
    loadBillingCyclesPatientDetail,
  ]);

  const handleOpenPackageSessions = useCallback((item) => {
    if (item?.id) setSelectedAttendancePackageId(String(item.id));
  }, []);

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
        const entryFinancial = currentObligationFinancial(entry ? entryFinancialMap.get(entry.id) : null);
        const amountCents = isCanceledWithoutEntry
          ? 0
          : currentObligationCents(entryFinancial, originalAmountCents, entry?.status);
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
        referenceItems: [],
      };
      base.sessions += Number(credit.total_sessions || 0);
      base.totalCents += amountCents;
      base.openCents += openCents;
      base.paidCents += paidCents;
      base.referenceItems.push({
        referenceDate: sourceEntry?.reference_date || credit.created_at,
        openCents,
      });
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
        referenceItems: [],
      };
      base.sessions += 1;
      base.totalCents += Number(row.amountCents || 0);
      base.openCents += Number(row.openCents || 0);
      base.paidCents += Number(row.paidCents || 0);
      base.referenceItems.push({
        referenceDate: row.starts_at,
        openCents: Number(row.openCents || 0),
      });
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
          datePresentation: getGroupedReferenceDatePresentation(item.referenceItems),
          financialStatus: resolveGroupedFinancialStatus(
            item.totalCents,
            item.paidCents,
            item.openCents,
          ),
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

  const attendanceSelectedPatientPackages = useMemo(() => (
    (unifiedCharges || []).map(mapUnifiedRevenueCharge)
  ), [unifiedCharges]);

  const visibleRevenueCharges = useMemo(() => attendanceSelectedPatientPackages.filter((item) => (
    revenueTypes.includes(item.kind)
    && (attendanceFilters.financial === "all"
      || (attendanceFilters.financial === "overdue" ? item.overdueCents > 0
        : item.financialStatus === attendanceFilters.financial))
    && (!showRevenueProfessional || !attendanceFilters.professional_id
      || item.sessions.some((session) => String(session.professional_user_id || session.professional?.id || "")
        === String(attendanceFilters.professional_id)))
  )), [attendanceSelectedPatientPackages, revenueTypes, showRevenueProfessional, attendanceFilters.financial,
    attendanceFilters.professional_id]);

  const selectedAttendancePackage = useMemo(() => {
    if (!selectedAttendancePackageId) return null;
    return attendanceSelectedPatientPackages.find(
      (item) => String(item.id) === String(selectedAttendancePackageId),
    ) || null;
  }, [attendanceSelectedPatientPackages, selectedAttendancePackageId]);

  const isRevenueChargeDetailOpen = Boolean(selectedAttendancePackage && attendanceSelectedPatientSummary);
  useEffect(() => {
    if (!isRevenueChargeDetailOpen) return undefined;
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    revenueChargeDetailCloseRef.current?.focus();

    const handleKeyDown = (event) => {
      const dialog = revenueChargeDetailRef.current;
      const dialogs = document.querySelectorAll("[role='dialog']");
      if (!dialog || dialogs[dialogs.length - 1] !== dialog) return;
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        handleClosePackageSessions();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = Array.from(dialog.querySelectorAll(
        "button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex='0']",
      ));
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first) { event.preventDefault(); return; }
      if (event.shiftKey && (document.activeElement === first || !dialog.contains(document.activeElement))) {
        event.preventDefault(); last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !dialog.contains(document.activeElement))) {
        event.preventDefault(); first.focus();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      if (!revenueChargeDetailHandoffRef.current && previousFocus?.isConnected) previousFocus.focus();
    };
  }, [isRevenueChargeDetailOpen, handleClosePackageSessions]);

  useEffect(() => {
    if (selectedAttendancePackage?.kind !== "billing_cycle") {
      setAttendanceCycleSessions(null);
      return undefined;
    }

    let current = true;
    const scope = {
      chargeId: selectedAttendancePackage.id,
      patientId: Number(selectedAttendancePatientId),
      authorizationContext: authorization.context,
    };
    const cycleId = Number(selectedAttendancePackage.sourceId);
    const errorMessage = "Não foi possível carregar as sessões da mensalidade.";
    setAttendanceCycleSessions({ ...scope, sessions: [], isLoading: true, error: "" });

    const loadCycleSessions = async () => {
      try {
        if (!Number.isSafeInteger(cycleId) || cycleId <= 0
          || !Number.isSafeInteger(scope.patientId) || scope.patientId <= 0) {
          throw new Error(errorMessage);
        }
        const response = await axios.get("/sessions", {
          params: { patient_id: scope.patientId, billing_cycle_id: cycleId },
        });
        if (!current) return;
        const sessionIds = new Set();
        if (!Array.isArray(response.data) || response.data.some((session) => {
          const sessionId = Number(session?.id);
          if (!Number.isSafeInteger(sessionId) || sessionId <= 0 || sessionIds.has(sessionId)
            || Number(session?.patient_id) !== scope.patientId
            || Number(session?.billing_cycle_id) !== cycleId
            || !session?.starts_at || !Number.isFinite(new Date(session.starts_at).getTime())) return true;
          sessionIds.add(sessionId);
          return false;
        })) throw new Error(errorMessage);
        const sessions = [...response.data].sort((first, second) => (
          new Date(first.starts_at).getTime() - new Date(second.starts_at).getTime()
          || Number(first.id) - Number(second.id)
        ));
        setAttendanceCycleSessions({ ...scope, sessions, isLoading: false, error: "" });
      } catch (error) {
        if (!current) return;
        setAttendanceCycleSessions({
          ...scope, sessions: [], isLoading: false,
          error: getUserFacingApiError(error, errorMessage) || errorMessage,
        });
      }
    };
    loadCycleSessions();
    return () => { current = false; };
  }, [selectedAttendancePackage, selectedAttendancePatientId, authorization.context,
    attendanceCycleSessionsAttempt]);

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
          paymentMethodName: paymentMethod?.name || "—",
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

  const filteredRevenuesSummary = useMemo(() => {
    if (revenuesSummaryQuery?.types.length === 0) return emptyFinancialRevenuesSummary(revenuesSummary.month);
    const filtered = filterFinancialRevenuesSummary(revenuesSummary, attendanceFilters.search);
    const items = [...filtered.patients];
    const search = normalizeSearchText(attendanceFilters.search);
    if (search && attendanceFilters.financial === "all") {
      patients.forEach((patient) => {
        if (!getPatientSearchText(patient).includes(search)
          || items.some((item) => item.patient_id === Number(patient.id))) return;
        items.push({ patient_id: Number(patient.id), patient_name: getPatientDisplayName(patient),
          patient_full_name: patient.full_name, total: 0, received: 0, pending: 0, entries_count: 0 });
      });
    }
    const matching = items.filter((patient) => attendanceFilters.financial === "all"
      || (attendanceFilters.financial === "overdue"
        ? (attendanceListPresentationByPatient.get(patient.patient_id)?.overdueCents || 0) > 0
        : resolveGroupedFinancialStatus(patient.total, patient.received, patient.pending)
          === attendanceFilters.financial));
    return { ...filtered, patients: matching, summary: matching.reduce((sum, patient) => ({
      total: sum.total + patient.total, received: sum.received + patient.received,
      pending: sum.pending + patient.pending,
    }), { total: 0, received: 0, pending: 0 }) };
  }, [attendanceFilters.search, attendanceFilters.financial, revenuesSummary,
    attendanceListPresentationByPatient, patients, revenuesSummaryQuery]);

  const aggregatedAttendanceByPatient = useMemo(
    () => mapRevenuesSummaryPatientsToAttendanceRows(filteredRevenuesSummary).map((row) => {
      const presentation = attendanceListPresentationByPatient.get(row.patientId) || {};
      return {
        ...row,
        datePresentation: getGroupedReferenceDatePresentation(presentation.referenceItems || []),
        duePresentation: getBillingDueStatus({ dueDate: presentation.dueDate, openCents: row.openCents }),
        overdueCents: presentation.overdueCents || 0,
        financialStatus: resolveGroupedFinancialStatus(
          row.totalCents,
          row.paidCents,
          row.openCents,
        ),
      };
    }),
    [attendanceListPresentationByPatient, filteredRevenuesSummary],
  );

  const aggregatedAttendanceSummary = useMemo(
    () => mapRevenuesSummaryToAttendanceSummary(filteredRevenuesSummary),
    [filteredRevenuesSummary],
  );

  const resolveBillingCycleFinancial = useCallback((cycle) => {
    if (cycle?.is_no_charge === true) {
      return {
        entry: null,
        amount: 0,
        paid: 0,
        open: 0,
        status: "no_charge",
        due: getBillingDueStatus(),
      };
    }

    const entry = cycle?.FinancialEntry || (cycle?.financial_entry_id
      ? entryMap.get(cycle.financial_entry_id)
      : null);
    const financial = entry?.id ? entryFinancialMap.get(entry.id) : null;
    const amount = Number(cycle?.amount_cents || entry?.amount_cents || financial?.amount || 0);
    const paid = Math.min(amount, Number(financial?.paid || 0));
    const open = Math.max(0, Number(financial?.open ?? amount - paid));
    const status = financial?.status || entry?.status || cycle?.status || "pending";
    const paymentStatus = resolveBillingPaymentStatus(paid, open);
    const due = getBillingDueStatus({
      dueDate: cycle?.FinancialEntry?.due_date,
      openCents: open,
    });

    return {
      entry, amount, paid, open, status, paymentStatus, due,
    };
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
        const { paymentStatus, status } = financial;
        const matchesStatusFilter = billingCyclesStatusFilter === "all"
          || paymentStatus === billingCyclesStatusFilter
          || status === billingCyclesStatusFilter
          || (
            billingCyclesStatusFilter === "overdue"
            && financial.due.state === "overdue"
          );
        if (!matchesStatusFilter) {
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
        dueItems: [],
      };

      current.cycles += 1;
      if (financial.status === "no_charge") {
        current.noChargeCycles += 1;
      }
      if (financial.status !== "canceled" && financial.status !== "no_charge") {
        current.amountCents += financial.amount;
        current.paidCents += financial.paid;
        current.openCents += financial.open;
        current.dueItems.push({
          dueDate: financial.due.dateOnly,
          openCents: financial.open,
        });
      }
      map.set(key, current);
    });

    const search = normalizeSearchText(billingCyclesFilters.search);
    if (search && ["all", "no_charge"].includes(billingCyclesStatusFilter)) {
      patients.forEach((patient) => {
        const patientId = Number(patient.id || 0);
        if (!patientId || map.has(patientId) || !getPatientSearchText(patient).includes(search)) return;
        map.set(patientId, {
          key: patientId,
          patientId,
          patientName: getPatientDisplayName(patient),
          cycles: 0,
          amountCents: 0,
          paidCents: 0,
          openCents: 0,
          noChargeCycles: 0,
          withoutCycles: true,
          dueItems: [],
        });
      });
    }

    return Array.from(map.values())
      .map((row) => ({
        ...row,
        duePresentation: row.withoutCycles
          ? { primaryLabel: "Sem cobrança no período", secondaryLabel: "", state: "none" }
          : getGroupedBillingDuePresentation(row.dueItems),
      }))
      .sort((a, b) =>
        String(a.patientName || "").localeCompare(String(b.patientName || ""), "pt-BR", {
          sensitivity: "base",
        }));
  }, [
    billingCyclesFilteredRows,
    billingCyclesFilters.search,
    billingCyclesStatusFilter,
    patients,
    resolveBillingCycleFinancial,
  ]);

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

  const currentBillingCyclesPatientDetail = useMemo(() => {
    if (!billingCyclesDrilldownPatientId
      || billingCyclesPatientDetail.patientId !== Number(billingCyclesDrilldownPatientId)) return null;
    return billingCyclesPatientDetail.data;
  }, [
    billingCyclesDrilldownPatientId,
    billingCyclesPatientDetail.data,
    billingCyclesPatientDetail.patientId,
  ]);

  const billingCyclesCreditAvailableCents = Math.max(
    0,
    Number(currentBillingCyclesPatientDetail?.summary?.creditAvailable || 0),
  );

  const billingCyclesPatientReceipts = useMemo(() => (
    (currentBillingCyclesPatientDetail?.payments || [])
      .map((payment) => ({
        payment,
        amountCents: Number(payment.amount_cents || 0),
        paymentMethodName: paymentMethodMap.get(Number(payment.payment_method_id))?.name || "—",
      }))
      .sort((first, second) => (
        new Date(second.payment?.paid_at || 0) - new Date(first.payment?.paid_at || 0)
      ))
  ), [currentBillingCyclesPatientDetail, paymentMethodMap]);

  const handleSharedPaymentSaved = useCallback(async ({ patientId }) => {
    invalidateAttendanceDetailCacheForPatient(patientId);
    await Promise.all([
      loadPaymentMethodsData(),
      loadRevenuesSummary(),
    ]);
    if (attendanceDrilldownPatientId && Number(attendanceDrilldownPatientId) === patientId) {
      await handleViewPatientSessions(patientId, { keepTab: true });
    }
    if (billingCyclesDrilldownPatientId && Number(billingCyclesDrilldownPatientId) === patientId) {
      await loadBillingCyclesPatientDetail(patientId, { keepTab: true });
    }
    if (hasBillingCyclesLoaded) loadBillingCycles();
  }, [
    attendanceDrilldownPatientId,
    billingCyclesDrilldownPatientId,
    handleViewPatientSessions,
    hasBillingCyclesLoaded,
    invalidateAttendanceDetailCacheForPatient,
    loadBillingCyclesPatientDetail,
    loadBillingCycles,
    loadPaymentMethodsData,
    loadRevenuesSummary,
  ]);

  const financialPaymentFlow = useFinancialPaymentFlow({
    onPaymentSaved: handleSharedPaymentSaved,
  });
  const { openScopedPatientPaymentModal } = financialPaymentFlow;

  useLayoutEffect(() => {
    if (financeAuthorizationRef.current === authorization.context) return;
    financeAuthorizationRef.current = authorization.context;
    attendanceDetailCacheRef.current.clear();
    attendanceDetailRequestRef.current += 1;
    revenuesSummaryRequestRef.current += 1;
    setUnifiedCharges(null);
    setAttendanceDetailSummary(null);
    setAttendanceBackendCreditByPatient(new Map());
    setAttendanceDrilldownPatientId(null);
    setRevenuesSummaryQuery(null);
    setRevenuesSummaryFailedQuery(null);
    setRevenuesSummary(emptyFinancialRevenuesSummary());
    setAttendanceListPresentationByPatient(new Map());
    setPatients([]);
    setCreditUseModalContext(null);
    financialPaymentFlow.close();
  }, [authorization.context, financialPaymentFlow]);

  const openAttendanceScopedPaymentModal = useCallback(() => {
    if (!attendanceSelectedPatientSummary || !canSettleClinicExpenses) return;
    const expectedCacheKey = buildAttendanceDetailCacheKey({
      patientId: String(attendanceSelectedPatientSummary.patientId),
      periodMode: attendancePeriodMode,
      period: attendancePeriodMode === "year" ? attendancePeriodYear : attendancePeriodMonth,
    });
    if (attendanceDetailSessions.isLoading || attendanceDetailSessions.error
      || !Array.isArray(unifiedCharges) || !attendanceDetailSummary
      || attendanceDetailSummary.cacheKey !== expectedCacheKey) {
      toast.error("Não foi possível carregar as cobranças. Atualize os dados antes de continuar.");
      return;
    }
    const groups = buildUnifiedReceiptGroups(attendanceSelectedPatientPackages);
    const scopedEntries = groups.flatMap((group) => group.entries);
    openScopedPatientPaymentModal(selectedAttendancePatient || {
      id: attendanceSelectedPatientSummary.patientId,
      full_name: attendanceSelectedPatientSummary.patientName,
    }, {
      type: "all", selectionReady: true, label: "Receitas",
      periodLabel: attendancePeriodMode === "year" ? attendancePeriodYear
        : String(attendancePeriodMonth || "").split("-").reverse().join("/"),
      patientId: attendanceSelectedPatientSummary.patientId,
      patientName: attendanceSelectedPatientSummary.patientName,
      totalOpenCents: scopedEntries.reduce((sum, entry) => sum + entry.openCents, 0),
      entries: scopedEntries, groups,
    });
  }, [attendanceSelectedPatientSummary, canSettleClinicExpenses, attendancePeriodMode,
    attendancePeriodMonth, attendancePeriodYear, attendanceDetailSessions.isLoading,
    attendanceDetailSessions.error, unifiedCharges, attendanceDetailSummary,
    attendanceSelectedPatientPackages,
    openScopedPatientPaymentModal, selectedAttendancePatient]);

  const openAttendanceCreditUseModal = useCallback(() => {
    if (!canSettleClinicExpenses || !attendanceSelectedPatientSummary) return;
    const expectedKey = buildAttendanceDetailCacheKey({
      patientId: attendanceSelectedPatientSummary.patientId,
      periodMode: attendancePeriodMode,
      period: attendancePeriodMode === "year" ? attendancePeriodYear : attendancePeriodMonth,
    });
    if (attendanceDetailSessions.isLoading || attendanceDetailSessions.error
      || attendanceDetailSummary?.cacheKey !== expectedKey || !Array.isArray(unifiedCharges)) return;

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
      authorizationContext: authorization.context,
      patientId: attendanceSelectedPatientSummary.patientId,
      destinationType: "all",
      patientName: attendanceSelectedPatientSummary.patientName,
      creditAvailableCents,
      openCents,
      periodStart: attendanceFilters.start,
      periodEnd: attendanceFilters.end,
      periodLabel,
    });
  }, [
    authorization.context,
    canSettleClinicExpenses,
    attendanceFilters.end,
    attendanceFilters.start,
    attendancePeriodMode,
    attendancePeriodMonth,
    attendancePeriodYear,
    attendanceSelectedPatientSummary,
    attendanceDetailSessions.isLoading,
    attendanceDetailSessions.error,
    attendanceDetailSummary,
    unifiedCharges,
  ]);

  const handleCreditUseCompleted = useCallback(async () => {
    if (!creditUseModalContext) return;
    const { patientId, destinationType } = creditUseModalContext;
    if (destinationType === "billing_cycle") {
      toast.success("Crédito aplicado nas mensalidades selecionadas.");
      setCreditUseModalContext(null);
      await Promise.all([
        loadBillingCycles(),
        loadBillingCyclesPatientDetail(patientId, { keepTab: true }),
      ]);
      return;
    }
    const keepPatientDetail = attendanceDrilldownPatientId
      && Number(attendanceDrilldownPatientId) === Number(patientId);
    toast.success("Crédito aplicado nas cobranças pendentes.");
    invalidateAttendanceDetailCacheForPatient(patientId);
    setCreditUseModalContext(null);
    if (keepPatientDetail) {
      await handleViewPatientSessions(patientId, { keepTab: true });
      await loadRevenuesSummary();
      return;
    }
    await loadRevenuesData();
    await loadRevenuesSummary();
    await loadAttendance();
  }, [
    attendanceDrilldownPatientId,
    creditUseModalContext,
    handleViewPatientSessions,
    invalidateAttendanceDetailCacheForPatient,
    loadAttendance,
    loadBillingCycles,
    loadBillingCyclesPatientDetail,
    loadRevenuesData,
    loadRevenuesSummary,
  ]);

  const openBillingCyclesScopedPaymentModal = useCallback(() => {
    if (!selectedBillingCyclesPatientSummary) return;
    if (isBillingCyclesLoading || billingCyclesError || !hasBillingCyclesLoaded) {
      toast.error("Não foi possível carregar as cobranças. Atualize os dados antes de continuar.");
      return;
    }

    const groups = selectedBillingCyclesPatientRows
      .map((cycle) => {
        const financial = resolveBillingCycleFinancial(cycle);
        const entryId = Number(financial.entry?.id || cycle.financial_entry_id || 0);
        const openCents = Math.max(0, Number(financial.open || 0));
        if (!entryId || openCents <= 0 || financial.status === "canceled") return null;
        const periodStart = formatDateOnlyBR(cycle.cycle_start);
        const periodEnd = formatDateOnlyBR(cycle.cycle_end);
        return {
          key: `billing-cycle-${cycle.id}`,
          kind: "billing_cycle",
          sourceId: Number(cycle.id),
          label: cycle.ServicePlan?.name || "Plano",
          referenceDate: String(cycle.cycle_start || "").slice(0, 10),
          details: `Período ${periodStart}${cycle.cycle_end ? ` a ${periodEnd}` : ""} · Vencimento ${financial.due.formattedDate}`,
          entries: [{ entryId, openCents }],
        };
      })
      .filter(Boolean)
      .sort((first, second) => (
        first.referenceDate.localeCompare(second.referenceDate)
        || first.sourceId - second.sourceId
      ));
    const entriesToReceive = groups.flatMap((group) => group.entries);
    const totalOpenCents = entriesToReceive.reduce((sum, item) => sum + Number(item.openCents || 0), 0);

    openScopedPatientPaymentModal(
      selectedBillingCyclesPatient || {
        id: selectedBillingCyclesPatientSummary.patientId,
        full_name: selectedBillingCyclesPatientSummary.patientName,
      },
      {
        type: "billing_cycles",
        selectionReady: true,
        label: "Mensalidades",
        periodLabel: billingCyclesPeriodMode === "year"
          ? billingCyclesPeriodYear
          : String(billingCyclesPeriodMonth || "").split("-").reverse().join("/"),
        patientId: selectedBillingCyclesPatientSummary.patientId,
        patientName: selectedBillingCyclesPatientSummary.patientName,
        totalOpenCents,
        entries: entriesToReceive,
        groups,
      },
    );
  }, [
    openScopedPatientPaymentModal,
    billingCyclesError,
    billingCyclesPeriodMode,
    billingCyclesPeriodMonth,
    billingCyclesPeriodYear,
    formatDateOnlyBR,
    hasBillingCyclesLoaded,
    isBillingCyclesLoading,
    resolveBillingCycleFinancial,
    selectedBillingCyclesPatient,
    selectedBillingCyclesPatientRows,
    selectedBillingCyclesPatientSummary,
  ]);

  const openBillingCyclesCreditUseModal = useCallback(() => {
    if (!canSettleClinicExpenses || !selectedBillingCyclesPatientSummary
      || billingCyclesCreditAvailableCents <= 0
      || selectedBillingCyclesPatientSummary.openCents <= 0) return;
    setCreditUseModalContext({
      authorizationContext: authorization.context,
      patientId: selectedBillingCyclesPatientSummary.patientId,
      patientName: selectedBillingCyclesPatientSummary.patientName,
      creditAvailableCents: billingCyclesCreditAvailableCents,
      openCents: selectedBillingCyclesPatientSummary.openCents,
      periodStart: billingCyclesFilters.start,
      periodEnd: billingCyclesFilters.end,
      periodLabel: billingCyclesPeriodMode === "year"
        ? billingCyclesPeriodYear
        : String(billingCyclesPeriodMonth || "").split("-").reverse().join("/"),
      destinationType: "billing_cycle",
    });
  }, [
    authorization.context,
    billingCyclesCreditAvailableCents,
    billingCyclesFilters.end,
    billingCyclesFilters.start,
    billingCyclesPeriodMode,
    billingCyclesPeriodMonth,
    billingCyclesPeriodYear,
    canSettleClinicExpenses,
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

  const openFinancialCancellation = (candidate) => {
    if (!canResolveFinancialCancellation || !selectedAttendancePatientId
      || candidate.can_resolve !== true
      || !attendanceFinancialContext?.pendingResolutions?.some((item) => Number(item.entry_id) === Number(candidate.entry_id))) return;
    setSelectedAttendancePackageId(null);
    setCancellationTarget({
      entry_id: Number(candidate.entry_id),
      patient_id: Number(selectedAttendancePatientId),
      patient_name: attendanceSelectedPatientSummary?.patientName || "Paciente",
      authorizationContext: authorization.context,
    });
  };

  const completeFinancialCancellation = async (result) => {
    setCancellationTarget(null);
    const patientId = Number(result.patient_id);
    invalidateAttendanceDetailCacheForPatient(patientId);
    toast.success("Pendência financeira resolvida. O recebimento original foi preservado.");
    await loadRevenuesSummary();
    await handleViewPatientSessions(patientId, { keepTab: true });
  };

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
        AttendancePeriodYearSelect,
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
        AttendanceTableCard,
        AttendanceTableScroll,
        AnnualOverviewTable,
        AttendanceMoneyText,
        ModalOverlay,
        ModalCard,
        ModalHeader,
        ModalTitle,
        ModalBody,
        ModalActions,
        Field,
        Label,
        Input,
        IconButton,
        PrimaryButton,
        SecondaryButton,
        attendancePalette: ATTENDANCE_UI.colors,
      }}
      loading={loadingOverview}
      error={overviewError}
      overview={overviewSummary}
      overviewTab={overviewTab}
      handleOverviewTabChange={handleOverviewTabChange}
      overviewMonth={overviewPeriodMonth}
      overviewYear={overviewPeriodYear}
      overviewYearOptions={overviewYearOptions}
      overviewPeriodLabel={overviewPeriodLabel}
      overviewPeriodMode={overviewPeriodMode}
      formatCurrency={formatCurrency}
      overviewMonthPickerRef={overviewMonthPickerRef}
      handleOverviewMonthChange={handleOverviewMonthChange}
      handleOverviewYearChange={handleOverviewYearChange}
      handleOverviewPeriodTagClick={handleOverviewPeriodTagClick}
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
      canManageExpenses={canManageClinicExpenses}
      canSettleExpenses={canSettleClinicExpenses}
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
    const hasCurrentRevenuesSummary = revenuesSummaryQuery?.period === revenuesPeriodKey
      && revenuesSummaryQuery?.context === authorization.context;
    const isRevenuesSelectionPending = useAggregatedRevenues
      && revenuesSummaryQuery?.key !== revenuesQueryKey
      && revenuesSummaryFailedQuery !== revenuesQueryKey;
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
        total: visibleRevenueCharges.length,
        expectedAmount: visibleRevenueCharges.reduce((sum, charge) => sum + charge.amountCents, 0),
        paidAmount: visibleRevenueCharges.reduce((sum, charge) => sum + charge.paidCents, 0),
        pendingAmount: visibleRevenueCharges.reduce((sum, charge) => sum + charge.openCents, 0),
      };
    }
    const isAttendanceInitialLoading = revenuePatientSearchLoading || (useAggregatedRevenues
      ? !hasCurrentRevenuesSummary && (loadingRevenuesSummary || isRevenuesSelectionPending)
      : isAttendanceLoading && !hasAttendanceLoaded);
    const isAttendanceSummaryLoading = isAttendanceInitialLoading
      || (Boolean(attendanceDrilldownPatientId) && attendanceDetailSessions.isLoading);
    const isAttendanceRefreshing = useAggregatedRevenues
      ? hasCurrentRevenuesSummary && (loadingRevenuesSummary || isRevenuesSelectionPending)
      : isAttendanceLoading && hasAttendanceLoaded;
    const periodSuffix = attendancePeriodLabel ? ` - ${attendancePeriodLabel}` : "";
    const attendanceTitle = `Resumo por paciente${periodSuffix}`;

    let attendanceContent = (
      <AttendanceEmptyState>Nenhuma cobrança no período. Pesquise um paciente para registrar crédito.</AttendanceEmptyState>
    );

    if ((revenuePatientSearchError || (revenuesSummaryError && !hasCurrentRevenuesSummary)) && useAggregatedRevenues) {
      attendanceContent = (
        <AttendanceEmptyState role="alert">{revenuesSummaryError || revenuePatientSearchError}
          <AttendanceGhostAction type="button" onClick={() => {
            if (revenuePatientSearchError) setRevenuePatientSearchRetry((attempt) => attempt + 1);
            loadRevenuesSummary();
          }}>Tentar novamente</AttendanceGhostAction>
        </AttendanceEmptyState>
      );
    } else if (displayAttendanceRows.length > 0) {
      attendanceContent = (
        <AttendanceTableCard>
          <AttendanceTableScroll>
            <AttendanceOverviewTable $revenuePatients>
              <thead>
                <tr>
                  <th>Paciente</th>
                  <th>Data</th>
                  <th>Vencimento</th>
                  <th>A receber</th>
                  <th>Pagamento</th>
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
                        {Number(row.creditsAvailable || 0) > 0 && (
                          <AttendanceSecondaryText>
                            Crédito disponível: {formatCurrency(row.creditsAvailable)}
                          </AttendanceSecondaryText>
                        )}
                      </AttendanceCellStack>
                    </td>
                    <td>
                      <AttendanceCellStack>
                        <AttendancePrimaryText>{row.datePresentation?.formattedDate || "-"}</AttendancePrimaryText>
                      </AttendanceCellStack>
                    </td>
                    <td>{row.duePresentation?.formattedDate || "-"}</td>
                    <td>
                      <AttendanceOpenAmountValue $hasOpen={row.openCents > 0}>
                        {formatCurrency(row.openCents)}
                      </AttendanceOpenAmountValue>
                    </td>
                    <td>
                      <AttendanceStatusBadge $status={row.financialStatus}>
                        {row.totalCents ? formatFinancialStatus(row.financialStatus) : "Sem cobrança"}
                      </AttendanceStatusBadge>
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
      let packageContent = <AttendanceEmptyState>Nenhuma cobrança neste filtro.</AttendanceEmptyState>;

      if (attendanceDetailSessions.isLoading) {
        packageContent = <AttendanceEmptyState>Carregando cobranças do paciente...</AttendanceEmptyState>;
      } else if (attendanceDetailSessions.error) {
        packageContent = <AttendanceEmptyState role="alert">{attendanceDetailSessions.error}
          <AttendanceGhostAction type="button" onClick={() => handleViewPatientSessions(selectedAttendancePatientId, { keepTab: true })}>Tentar novamente</AttendanceGhostAction>
        </AttendanceEmptyState>;
      } else if (visibleRevenueCharges.length > 0) {
        packageContent = (
          <BillingCyclesInnerTableCard>
            <AttendanceTableScroll>
              <BillingCyclesTable $detail $unified>
                <thead>
                  <tr>
                    <th>Data</th>
                    <th>Serviço</th>
                    <th>Vencimento</th>
                    <th>Valor</th>
                    <th>Pago</th>
                    <th>A receber</th>
                    <th>Situação</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleRevenueCharges.map((item) => (
                    <PatientSummaryRow key={item.id} $hasOpen={item.openCents > 0}>
                      <td>
                        <AttendanceCellStack>
                          <AttendancePrimaryText>
                            {formatDateOnlyBR(item.referenceDate)}
                          </AttendancePrimaryText>
                        </AttendanceCellStack>
                      </td>
                      <td>
                        <AttendanceCellStack>
                          <AttendancePrimaryText>{item.serviceName}</AttendancePrimaryText>
                          <RevenueTypeTag>{revenueTypeLabel(item.kind)}</RevenueTypeTag>
                        </AttendanceCellStack>
                      </td>
                      <td>{formatDateOnlyBR(item.dueDate)}</td>
                      <td>
                        <AttendanceMoneyText>
                          {formatCurrency(item.amountCents)}
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
                          <AttendanceRowActions>
                            <AttendanceSmallAction
                              type="button"
                              onClick={() => handleOpenPackageSessions(item)}
                            >
                              Detalhes
                            </AttendanceSmallAction>
                          </AttendanceRowActions>
                      </td>
                    </PatientSummaryRow>
                  ))}
                </tbody>
              </BillingCyclesTable>
            </AttendanceTableScroll>
          </BillingCyclesInnerTableCard>
        );
      }

      const receiptsContent = (
        <FinancialHistory
          key={selectedAttendancePatientId}
          events={attendanceFinancialContext?.history}
          receipts={attendanceSelectedPatientReceipts}
          sessions={[
            ...attendanceDetailPackages.flatMap((item) => item.sessions || []),
            ...attendanceDetailSessions.sessions,
          ]}
          filter={attendanceHistoryFilter}
          formatCurrency={formatCurrency}
        />
      );

      attendanceContent = (
        <AttendancePatientDetailBlock>
          <AttendancePatientDetailTopline data-revenue-results-heading>
            <div>
              <AttendanceHeadingTitle>
                {attendanceDetailPatientSummary.patientName}{periodSuffix}
              </AttendanceHeadingTitle>
            </div>
            <AttendanceHeaderActions>
              <AttendancePrimaryAction
                type="button"
                onClick={openAttendanceScopedPaymentModal}
                disabled={!canSettleClinicExpenses || attendanceDetailSessions.isLoading
                  || Boolean(attendanceDetailSessions.error) || !Array.isArray(unifiedCharges)}
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
              <strong>{attendanceDetailSessions.isLoading || attendanceDetailSessions.error
                ? "—" : formatCurrency(attendanceDetailPatientSummary.openCents)}</strong>
            </AttendancePatientStat>
            <AttendancePatientStat>
              <span>Crédito disponível</span>
              <strong>{attendanceDetailSessions.isLoading || attendanceDetailSessions.error
                ? "—" : formatCurrency(attendanceDetailPatientSummary.creditsAvailable)}</strong>
            </AttendancePatientStat>
            {canSettleClinicExpenses && !attendanceDetailSessions.isLoading
              && !attendanceDetailSessions.error && attendanceDetailPatientSummary.creditsAvailable > 0
              && attendanceDetailPatientSummary.openCents > 0 && (
                <AttendanceCreditUseAction
                  type="button"
                  onClick={openAttendanceCreditUseModal}
                >
                  Usar crédito
                </AttendanceCreditUseAction>
              )}
          </AttendancePatientStats>
          <PatientDetailToolbar>
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
                Histórico
              </PatientDetailTabButton>
            </PatientDetailTabsRow>
            {attendanceDetailTab === "payments" && (
              <HistoryEventFilter
                aria-label="Filtrar histórico"
                value={attendanceHistoryFilter}
                onChange={(event) => setAttendanceHistoryFilter(event.target.value)}
              >
                <option value="all">Todos os eventos</option>
                <option value="receipts">Recebimentos</option>
              </HistoryEventFilter>
            )}
          </PatientDetailToolbar>
          {attendanceDetailTab === "payments" && !attendanceDetailSessions.isLoading
            && !attendanceDetailSessions.error ? receiptsContent : packageContent}
          {attendanceDetailTab === "charges" && (
            <FinancialCancellationDetails
              pendingResolutions={attendanceFinancialContext?.pendingResolutions}
              canResolve={canResolveFinancialCancellation}
              onResolve={openFinancialCancellation}
            />
          )}
        </AttendancePatientDetailBlock>
      );
    }

    let attendanceSummaryContent = (
      <AttendanceMetricsGrid>
        <AttendanceMetricCard>
          <AttendanceMetricLabel>Cobranças</AttendanceMetricLabel>
          <AttendanceMetricValue>{displayAttendanceSummary.total}</AttendanceMetricValue>
        </AttendanceMetricCard>
        <AttendanceMetricCard>
          <AttendanceMetricLabel>Valor</AttendanceMetricLabel>
          <AttendanceMetricValue>{formatCurrency(displayAttendanceSummary.expectedAmount)}</AttendanceMetricValue>
        </AttendanceMetricCard>
        <AttendanceMetricCard>
          <AttendanceMetricLabel>Pago</AttendanceMetricLabel>
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
    } else if (revenuesSummaryError && useAggregatedRevenues && !hasCurrentRevenuesSummary) {
      attendanceSummaryContent = (
        <AttendanceEmptyState>{revenuesSummaryError}</AttendanceEmptyState>
      );
    }

    let resultsDescription;
    if (isAttendanceRefreshing) resultsDescription = "revenue-update-status";
    else if (revenuesSummaryError && hasCurrentRevenuesSummary) resultsDescription = "revenue-update-error";
    if (isAttendanceRefreshing && displayAttendanceRows.length === 0) {
      attendanceContent = <AttendanceInlineLoader>Atualizando resultados...</AttendanceInlineLoader>;
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

          <AttendanceCard role="region" aria-label="Resumo de receitas" aria-busy={isAttendanceInitialLoading || isAttendanceRefreshing}>
            <AttendanceCardHeader>
              <AttendanceCardTitle>Resumo de cobrança</AttendanceCardTitle>
              {isAttendanceRefreshing && (
                <AttendanceInlineLoader role="status" id="revenue-update-status">
                  <Spinner /> Atualizando receitas — resultados anteriores.
                </AttendanceInlineLoader>
              )}
            </AttendanceCardHeader>
            {revenuesSummaryError && useAggregatedRevenues && hasCurrentRevenuesSummary && (
              <AttendanceFilterMetaText role="alert" id="revenue-update-error">
                {revenuesSummaryError} Resultados anteriores; atualização não concluída.
                <AttendanceGhostAction type="button" onClick={loadRevenuesSummary}>Tentar novamente</AttendanceGhostAction>
              </AttendanceFilterMetaText>
            )}
            {attendanceSummaryContent}
          </AttendanceCard>

          <AttendanceCard>
            <AttendanceCardHeader>
              <AttendanceCardTitle>Filtros</AttendanceCardTitle>
            </AttendanceCardHeader>
            <RevenueFiltersGrid>
              <RevenueSearchField>
                <PatientSearchField
                  mode="filter"
                  inputId="attendance-search"
                  value={attendanceDrilldownPatientId
                    ? selectedAttendancePatient?.full_name || ""
                    : attendanceFilters.search}
                  disabled={Boolean(attendanceDrilldownPatientId)}
                  onChange={(nextValue) => setAttendanceFilters((prev) => ({
                    ...prev,
                    search: nextValue,
                  }))}
                />
              </RevenueSearchField>
              <RevenueStatusField>
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
                  <option value="overdue">Com valor vencido</option>
                </AttendanceFilterSelect>
              </RevenueStatusField>
              {renderRevenueTypeFilters()}
              {showRevenueProfessional && <RevenueProfessionalField>
                <AttendanceFilterLabel htmlFor="attendance-professional">Profissional</AttendanceFilterLabel>
                <AttendanceFilterSelect
                  id="attendance-professional"
                  name="professional_id"
                  value={attendanceFilters.professional_id}
                  onChange={handleAttendanceFilterChange}
                >
                  <option value="">Todos</option>
                  {revenueProfessionals.map((professional) => (
                    <option key={professional.id} value={professional.id}>
                      {professional.name || professional.email}
                    </option>
                  ))}
                </AttendanceFilterSelect>
              </RevenueProfessionalField>}

            </RevenueFiltersGrid>
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

          <AttendanceResultsCard role="region" aria-label="Resultados de receitas"
            aria-busy={isAttendanceInitialLoading || isAttendanceRefreshing}
            aria-describedby={resultsDescription}>
            {!attendanceDrilldownPatientId && (
              <AttendanceDetailHeader data-revenue-results-heading>
                <AttendanceDetailTitle>{attendanceTitle}</AttendanceDetailTitle>
                {isAttendanceRefreshing && !useAggregatedRevenues && (
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
          </AttendanceResultsCard>
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
              <AttendancePrimaryAction
                type="button"
                onClick={openBillingCyclesScopedPaymentModal}
                disabled={isBillingCyclesLoading || Boolean(billingCyclesError) || !hasBillingCyclesLoaded}
              >
                <FaPlus />
                Registrar recebimento
              </AttendancePrimaryAction>
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
              <span>Crédito disponível</span>
              <strong>{billingCyclesPatientDetail.isLoading
                ? "—" : formatCurrency(billingCyclesCreditAvailableCents)}</strong>
            </AttendancePatientStat>
            {canSettleClinicExpenses && billingCyclesCreditAvailableCents > 0
              && selectedBillingCyclesPatientSummary.openCents > 0 && (
                <AttendanceCreditUseAction type="button" onClick={openBillingCyclesCreditUseModal}>
                  Usar crédito
                </AttendanceCreditUseAction>
              )}
          </AttendancePatientStats>
          {billingCyclesPatientDetail.error && (
            <AttendanceEmptyState role="alert">
              {billingCyclesPatientDetail.error}
              <AttendanceGhostAction
                type="button"
                onClick={() => loadBillingCyclesPatientDetail(
                  selectedBillingCyclesPatientSummary.patientId,
                  { keepTab: true },
                )}
              >
                Tentar novamente
              </AttendanceGhostAction>
            </AttendanceEmptyState>
          )}
          {billingCyclesError && (
            <AttendanceEmptyState role="alert">
              {billingCyclesError}
              <AttendanceGhostAction type="button" onClick={loadBillingCycles}>
                Tentar novamente
              </AttendanceGhostAction>
            </AttendanceEmptyState>
          )}
          <PatientDetailToolbar>
            <PatientDetailTabsRow>
              <PatientDetailTabButton
                type="button"
                $active={billingCyclesDetailTab === "charges"}
                onClick={() => setBillingCyclesDetailTab("charges")}
              >
                Cobranças
              </PatientDetailTabButton>
              <PatientDetailTabButton
                type="button"
                $active={billingCyclesDetailTab === "payments"}
                onClick={() => setBillingCyclesDetailTab("payments")}
              >
                Histórico
              </PatientDetailTabButton>
            </PatientDetailTabsRow>
            {billingCyclesDetailTab === "payments" && (
              <HistoryEventFilter
                aria-label="Filtrar histórico"
                value={billingCyclesHistoryFilter}
                onChange={(event) => setBillingCyclesHistoryFilter(event.target.value)}
              >
                <option value="all">Todos os eventos</option>
                <option value="receipts">Recebimentos</option>
              </HistoryEventFilter>
            )}
          </PatientDetailToolbar>
          {billingCyclesDetailTab === "charges" && <BillingCyclesInnerTableCard>
            <AttendanceTableScroll>
              <BillingCyclesTable $detail $billingPatientDetail>
                <thead>
                  <tr>
                    <th>Plano</th>
                    <th>Período</th>
                    <th>Valor</th>
                    <th>Recebido</th>
                    <th>A receber</th>
                    <th>Pagamento</th>
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
                          <AttendanceCellStack>
                            <AttendancePrimaryText>
                              {periodStart}{cycle.cycle_end ? ` - ${periodEnd}` : ""}
                            </AttendancePrimaryText>
                            <BillingCycleDueStatusText $state={financial.due.state}>
                              Vencimento: {financial.due.formattedDate}
                              {financial.due.alertLabel ? ` · ${financial.due.alertLabel}` : ""}
                            </BillingCycleDueStatusText>
                          </AttendanceCellStack>
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
                              <AttendanceStatusBadge $status={financial.paymentStatus}>
                                {formatFinancialStatus(financial.paymentStatus)}
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
          </BillingCyclesInnerTableCard>}
          {billingCyclesDetailTab === "payments"
            && billingCyclesPatientDetail.isLoading && (
              <AttendanceEmptyState>Carregando histórico...</AttendanceEmptyState>
          )}
          {billingCyclesDetailTab === "payments"
            && !billingCyclesPatientDetail.isLoading
            && currentBillingCyclesPatientDetail && (
              <FinancialHistory
                key={`billing-cycles-${selectedBillingCyclesPatientSummary.patientId}`}
                events={currentBillingCyclesPatientDetail.financial_history}
                receipts={billingCyclesPatientReceipts}
                sessions={[]}
                filter={billingCyclesHistoryFilter}
                formatCurrency={formatCurrency}
              />
          )}
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
          {!isBillingCyclesLoading && billingCyclesError && (
            <AttendanceEmptyState role="alert">
              {billingCyclesError}
              <AttendanceGhostAction type="button" onClick={loadBillingCycles}>
                Tentar novamente
              </AttendanceGhostAction>
            </AttendanceEmptyState>
          )}
          {!isBillingCyclesLoading && !billingCyclesError && billingCyclesByPatient.length === 0 && (
            <div style={{ padding: "32px 16px", textAlign: "center", color: ATTENDANCE_UI.colors.textSecondary }}>
              Nenhuma mensalidade encontrada no período.
            </div>
          )}
          {!isBillingCyclesLoading && !billingCyclesError && billingCyclesByPatient.length > 0 && (
            <BillingCyclesTable>
              <thead>
                <tr>
                  <th>Paciente</th>
                  <th>Vencimento</th>
                  <th>A receber</th>
                  <th>Pagamento</th>
                  <th>Ação</th>
                </tr>
              </thead>
              <tbody>
                {billingCyclesByPatient.map((row) => {
                  const status = row.withoutCycles || (row.amountCents <= 0 && row.noChargeCycles > 0)
                    ? "no_charge"
                    : resolveBillingPaymentStatus(row.paidCents, row.openCents);

                  return (
                    <PatientSummaryRow key={row.key} $hasOpen={row.openCents > 0}>
                      <td>
                        <AttendancePrimaryText>{row.patientName}</AttendancePrimaryText>
                      </td>
                      <td>
                        <AttendanceCellStack>
                          <AttendancePrimaryText>
                            {row.duePresentation.primaryLabel}
                          </AttendancePrimaryText>
                          {row.duePresentation.secondaryLabel && (
                            <BillingCycleDueStatusText $state={row.duePresentation.state}>
                              {row.duePresentation.secondaryLabel}
                            </BillingCycleDueStatusText>
                          )}
                        </AttendanceCellStack>
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

  const renderRevenueTypeFilters = () => (
    <AttendanceFilterField>
      <AttendanceFilterLabel as="span" id="revenue-type-label">Tipo de cobrança</AttendanceFilterLabel>
      <RevenueTypeChips role="group" aria-labelledby="revenue-type-label">
        {[
          ["billing_cycle", "Mensalidade"],
          ["series", "Pacote"],
          ["entry", "Avulsa"],
        ].map(([value, label]) => (
          <RevenueTypeButton
            key={value}
            type="button"
            $active={revenueTypes.includes(value)}
            aria-pressed={revenueTypes.includes(value)}
            onClick={() => {
              setRevenueTypes((previous) => (previous.includes(value)
                ? previous.filter((type) => type !== value) : [...previous, value]));
              setAttendanceFilters((previous) => ({ ...previous, professional_id: "" }));
            }}
          >
            {label}
          </RevenueTypeButton>
        ))}
      </RevenueTypeChips>
    </AttendanceFilterField>
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
  const isFinancialSettings = ["methods", "clinic-expense-categories"].includes(activeSection);

  return (
    <FinancePage>
      <FinanceContent>
          <Header>
            <HeaderText>
              <HeaderTitleRow>
                <Title>{currentSectionTitle}</Title>
              </HeaderTitleRow>
            </HeaderText>
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
          <RevenueChargeDetailOverlay>
            <RevenueChargeDetailCard ref={revenueChargeDetailRef} role="dialog" aria-modal="true" aria-labelledby="revenue-charge-detail-title">
              <RevenueChargeDetailHeader>
                <ModalHeaderText>
                  <ModalTitle id="revenue-charge-detail-title">
                    {`${revenueTypeLabel(selectedAttendancePackage.kind)} · ${selectedAttendancePackage.serviceName}`}
                  </ModalTitle>
                  <RevenueChargeDetailPatient>{attendanceSelectedPatientSummary.patientName}</RevenueChargeDetailPatient>
                </ModalHeaderText>
                <IconButton ref={revenueChargeDetailCloseRef} type="button" aria-label="Fechar detalhes" onClick={handleClosePackageSessions}>
                  <FaTimes />
                </IconButton>
              </RevenueChargeDetailHeader>
              <RevenueChargeDetailBody role="region" aria-label="Conteúdo dos detalhes" tabIndex={0}>
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
			                    const isBillingCycle = item.kind === "billing_cycle";
                          const currentCycleSessions = attendanceCycleSessions?.chargeId === item.id
                            && attendanceCycleSessions?.patientId === Number(selectedAttendancePatientId)
                            && attendanceCycleSessions?.authorizationContext === authorization.context
                            ? attendanceCycleSessions : null;
                          const sessionsLoading = isBillingCycle
                            && (!currentCycleSessions || currentCycleSessions.isLoading);
                          const sessionsError = isBillingCycle ? currentCycleSessions?.error || "" : "";
                          const sessions = isBillingCycle ? currentCycleSessions?.sessions || [] : item.sessions;
                          const emptySessionsLabel = {
                            billing_cycle: "Nenhuma sessão vinculada a esta mensalidade.",
                            series: "Nenhuma sessão vinculada a este pacote.",
                            entry: "Nenhum atendimento vinculado a esta cobrança.",
                          }[item.kind];
                          const usageSummary = {
                            scheduled: sessions.filter((session) => session.status === "scheduled").length,
                            done: sessions.filter((session) => session.status === "done").length,
                            noShow: sessions.filter((session) => session.status === "no_show").length,
                            canceledWithoutCharge: sessions.filter((session) => session.status === "canceled").length,
                            suspended: sessions.filter((session) => session.status === "suspended").length,
                          };
                          const contractedSessions = Number.isSafeInteger(item.total_sessions)
                            && item.total_sessions > 0 ? item.total_sessions : null;
                          const dueDates = item.dueDates.map((due) => due.due_date);
			                    const statusItems = [
                            { label: usageSummary.scheduled === 1 ? "agendada" : "agendadas", value: usageSummary.scheduled },
                            { label: usageSummary.done === 1 ? "realizada" : "realizadas", value: usageSummary.done },
                            { label: usageSummary.noShow === 1 ? "falta" : "faltas", value: usageSummary.noShow },
                            { label: usageSummary.suspended === 1 ? "suspensa" : "suspensas", value: usageSummary.suspended },
			                      {
			                        label: (usageSummary.canceledWithoutCharge || 0) === 1
			                          ? "cancelada"
			                          : "canceladas",
			                        value: usageSummary.canceledWithoutCharge || 0,
			                      },
			                    ].filter((statusItem) => statusItem.value > 0);
			                    const distributionText = statusItems
			                      .map((statusItem) => `${statusItem.value} ${statusItem.label}`)
			                      .join(" · ");
                          const summaryParts = [
                            item.kind === "series" && contractedSessions
                              ? `${contractedSessions} ${contractedSessions === 1 ? "contratada" : "contratadas"}` : "",
                            sessions.length > 0
                              ? `${sessions.length} ${sessions.length === 1 ? "vinculada" : "vinculadas"}${isBillingCycle ? " ao ciclo" : ""}` : "",
                            distributionText,
                          ].filter(Boolean);
	
		                    return (
                            <React.Fragment key={item.id}>
                              {(isBillingCycle || dueDates.length > 1) && <AttendanceChargeMetadata aria-label="Dados da cobrança">
                                {isBillingCycle && <div>
                                  <dt>Período:</dt>
                                  <dd>{formatDateOnlyBR(item.cycle_start)} a {formatDateOnlyBR(item.cycle_end)}</dd>
                                </div>}
                                {dueDates.length > 1 && <div aria-label="Vencimentos da cobrança">
                                  <dt>Vencimento:</dt>
                                  {dueDates.map((dueDate) => (
                                    <dd key={dueDate || "missing"}>{formatDateOnlyBR(dueDate)}</dd>
                                  ))}
                                </div>}
                              </AttendanceChargeMetadata>}
                              {item.kind !== "entry" && !sessionsLoading && !sessionsError && summaryParts.length > 0 && <AttendancePackageSummarySection>
			                            <AttendancePackageSummaryTitle>
                                      Sessões
			                            </AttendancePackageSummaryTitle>
                                    <AttendanceSessionsSummaryText>{summaryParts.join(" · ")}</AttendanceSessionsSummaryText>
			                          </AttendancePackageSummarySection>}
                                {item.kind !== "billing_cycle" && <FinancialCancellationDetails
                                  pendingResolutions={attendanceFinancialContext?.pendingResolutions}
                                  packageItem={item}
                                  canResolve={canResolveFinancialCancellation}
                                  onResolve={openFinancialCancellation}
                                />}
                          {sessionsLoading && <EmptyState>Carregando sessões da mensalidade...</EmptyState>}
                          {!sessionsLoading && sessionsError && <EmptyState role="alert">
                            {sessionsError}
                            <AttendanceGhostAction type="button" onClick={() => setAttendanceCycleSessionsAttempt((attempt) => attempt + 1)}>
                              Tentar novamente
                            </AttendanceGhostAction>
                          </EmptyState>}
	                        {!sessionsLoading && !sessionsError && sessions.length === 0 && (
                              <EmptyState>{emptySessionsLabel}</EmptyState>
                          )}
	                        {!sessionsLoading && !sessionsError && sessions.length > 0 && (
	                            <RevenueChargeDetailSessionsTable>
	                              <thead>
	                                <tr>
	                                  <th scope="col">Data</th>
	                                  <th scope="col">Profissional</th>
	                                  <th scope="col">Status</th>
	                                </tr>
	                              </thead>
	                              <tbody>
	                                {sessions.map((session) => {
		                                  const professionalName =
		                                    session?.professional?.name || session?.professional?.email || "-";
	
	                                  return (
	                                    <tr key={session.id}>
	                                      <td>{formatSessionDateTimeBR(session.starts_at)}</td>
	                                      <td>{professionalName}</td>
	                                      <td>
	                                        <AttendanceStatusBadge $status={session.status}>
	                                          {isBillingCycle
                                              ? formatBillingCycleSessionStatus(session.status)
                                              : formatPackageSessionStatus(session.status)}
	                                        </AttendanceStatusBadge>
	                                      </td>
	                                    </tr>
	                                  );
	                                })}
	                              </tbody>
	                            </RevenueChargeDetailSessionsTable>
	                        )}
                            </React.Fragment>
	                    );
	                  })}
              </RevenueChargeDetailBody>
              <ModalActions>
                <SecondaryButton type="button" onClick={handleClosePackageSessions}>
                  Fechar
                </SecondaryButton>
              </ModalActions>
            </RevenueChargeDetailCard>
          </RevenueChargeDetailOverlay>
          <ProtectedBackdrop onClick={handleClosePackageSessions} />
        </>
      )}

      {cancellationTarget && canResolveFinancialCancellation
        && cancellationTarget.authorizationContext === authorization.context && (
          <FinancialCancellationModal
            key={`${cancellationTarget.patient_id}:${cancellationTarget.entry_id}`}
            target={cancellationTarget}
            formatCurrency={formatCurrency}
            onClose={() => setCancellationTarget(null)}
            onCompleted={completeFinancialCancellation}
          />
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
          canSettleExpenses={canSettleClinicExpenses}
          requiresAdjustment={requiresExpenseSettlementAdjustment(
            parseCurrencyInputToNumber(clinicExpenseForm.paid_amount),
            Math.round(parseCurrencyInputToNumber(clinicExpenseForm.amount) * 100),
          )}
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
          requiresAdjustment={requiresExpenseSettlementAdjustment(
            parseCurrencyInputToNumber(clinicExpensePaymentForm.paid_amount),
            Number(clinicExpensePaymentForm.expense?.amount_cents),
          )}
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
                  <ModalTitle>
                    {isRecurringExpenseDelete ? "Excluir despesa recorrente" : "Excluir despesa"}
                  </ModalTitle>
                  {!isRecurringExpenseDelete && <ModalSubtitle>Esta ação é definitiva.</ModalSubtitle>}
                </div>
                <IconButton
                  type="button"
                  onClick={closeClinicExpenseDeleteModal}
                  disabled={isClinicExpenseDeleting}
                >
                  <FaTimes />
                </IconButton>
              </ModalHeader>
              <ModalBody style={isRecurringExpenseDelete ? {
                padding: spacing.xs,
                margin: `-${spacing.xs}`,
              } : undefined}>
                {isRecurringExpenseDelete ? (
                  <ExpenseDeleteOptions disabled={isClinicExpenseDeleting}>
                    <legend>Esta é uma despesa recorrente. Escolha o que deseja excluir:</legend>
                    <ExpenseDeleteOption>
                      <input
                        type="radio"
                        name="clinic-expense-delete-scope"
                        value="single"
                        checked={clinicExpenseDeleteScope === "single"}
                        disabled={isClinicExpenseDeleting}
                        onChange={(event) => setClinicExpenseDeleteScope(event.target.value)}
                        aria-labelledby="expense-delete-single-title"
                        aria-describedby="expense-delete-single-hint"
                      />
                      <span>
                        <strong id="expense-delete-single-title">Excluir somente esta</strong>
                        <small id="expense-delete-single-hint">Remove apenas esta ocorrência.</small>
                      </span>
                    </ExpenseDeleteOption>
                    <ExpenseDeleteOption>
                      <input
                        type="radio"
                        name="clinic-expense-delete-scope"
                        value="this_and_future"
                        checked={clinicExpenseDeleteScope === "this_and_future"}
                        disabled={isClinicExpenseDeleting}
                        onChange={(event) => setClinicExpenseDeleteScope(event.target.value)}
                        aria-labelledby="expense-delete-future-title"
                        aria-describedby="expense-delete-future-hint"
                      />
                      <span>
                        <strong id="expense-delete-future-title">Excluir esta e lançamentos futuros</strong>
                        <small id="expense-delete-future-hint">
                          Remove esta ocorrência e os próximos lançamentos não pagos. Lançamentos já pagos serão preservados.
                        </small>
                      </span>
                    </ExpenseDeleteOption>
                  </ExpenseDeleteOptions>
                ) : (
                  <EmptyState>Tem certeza que deseja excluir definitivamente esta despesa?</EmptyState>
                )}
              </ModalBody>
              <ModalActions style={clinicExpenseDeleteTarget.recurrence_type === "monthly" ? {
                flexWrap: "wrap",
              } : undefined}>
                <SecondaryButton
                  type="button"
                  onClick={closeClinicExpenseDeleteModal}
                  disabled={isClinicExpenseDeleting}
                >
                  Cancelar
                </SecondaryButton>
                <PrimaryButton
                  type="button"
                  onClick={() => handleDeleteClinicExpense(
                    isRecurringExpenseDelete ? clinicExpenseDeleteScope : "single",
                  )}
                  disabled={isClinicExpenseDeleting}
                >
                  {isClinicExpenseDeleting ? "Excluindo..." : clinicExpenseDeleteConfirmLabel}
                </PrimaryButton>
              </ModalActions>
            </ModalCard>
          </ModalOverlay>
          <ProtectedBackdrop onClick={closeClinicExpenseDeleteModal} />
        </>
      )}

      {creditUseModalContext && canSettleClinicExpenses
        && creditUseModalContext.authorizationContext === authorization.context && (
          <FinancialCreditUseModal
            key={`${creditUseModalContext.patientId}:${creditUseModalContext.periodStart}:${creditUseModalContext.periodEnd}`}
            context={creditUseModalContext}
            formatCurrency={formatCurrency}
            onClose={closeCreditUseModal}
            onCompleted={handleCreditUseCompleted}
          />
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

const Title = styled.h1`
  margin: 0;
  color: #2b2b2b;
  font-size: 34px;
  font-weight: 800;
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

const PatientDetailToolbar = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
  width: 100%;
`;

const HistoryEventFilter = styled.select`
  margin-left: auto;
  padding: 9px 12px;
  border: 1px solid #ccd2ce;
  border-radius: 8px;
  background: white;
  color: #4a4a4a;
  font-size: 14px;
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

const RevenueChargeDetailSessionsTable = styled(SimpleTable)`
  min-width: 420px;
  margin: 0;
  border-collapse: separate;
  border-spacing: 0;

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

const AttendanceResultsCard = styled(AttendanceCard)`
  min-width: 0;
  isolation: isolate;

  [data-revenue-results-heading] {
    position: sticky;
    top: ${layout.appHeaderHeight};
    z-index: 1;
    padding: ${ATTENDANCE_UI.spacing[1]} 0;
    background: ${ATTENDANCE_UI.colors.surface};
    overflow-wrap: anywhere;
  }
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

const RevenueFiltersGrid = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: ${ATTENDANCE_UI.spacing[2]};
  min-width: 0;

  label {
    color: ${ATTENDANCE_UI.colors.textSecondary};
    font-size: ${ATTENDANCE_UI.font.size.xs};
    line-height: ${ATTENDANCE_UI.font.lineHeight.xs};
    font-weight: ${ATTENDANCE_UI.font.weight.medium};
    letter-spacing: 0.03em;
    text-transform: uppercase;
  }
`;

const RevenueSearchField = styled(AttendanceFilterField)`
  flex: 1 1 280px;
  min-width: 0;
  > div { min-width: 0; gap: ${ATTENDANCE_UI.spacing[1]}; }
  input { height: 44px; }
  @media (max-width: 560px) { flex-basis: 100%; }
`;

const RevenueStatusField = styled(AttendanceFilterField)`
  flex: 0 0 205px;
  min-width: 0;
  @media (max-width: 560px) { flex-basis: 100%; }
`;

const RevenueProfessionalField = styled(RevenueStatusField)`
  flex-basis: 100%;
  select { max-width: 205px; }
  @media (max-width: 560px) { select { max-width: none; } }
`;

const RevenueTypeChips = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  min-width: 0;
  min-height: 44px;
  align-items: center;
`;

const RevenueTypeButton = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 6px 10px;
  border-radius: 999px;
  border: 1px solid ${(props) => (props.$active ? "rgba(106, 121, 92, 0.55)" : "rgba(106, 121, 92, 0.18)")};
  background: ${(props) => (props.$active ? "rgba(106, 121, 92, 0.14)" : "rgba(162, 177, 144, 0.2)")};
  color: #42523a;
  font-size: 0.75rem;
  font-weight: ${(props) => (props.$active ? 900 : 700)};
  box-shadow: ${(props) => (props.$active ? "0 5px 12px rgba(42, 52, 35, 0.12)" : "none")};
  opacity: ${(props) => (props.$active ? 1 : 0.42)};
  white-space: nowrap;
  cursor: pointer;
  transition: opacity 140ms ease, transform 140ms ease, background 140ms ease, border-color 140ms ease, box-shadow 140ms ease;

  &:hover {
    opacity: 1;
    transform: translateY(-1px);
  }

  &:focus-visible {
    outline: 2px solid rgba(106, 121, 92, 0.38);
    outline-offset: 3px;
  }
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

  &:focus-visible {
    outline: 3px solid rgba(95, 121, 87, 0.24);
    outline-offset: 2px;
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

  &:focus-visible {
    outline: 3px solid rgba(95, 121, 87, 0.2);
    outline-offset: 2px;
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

  &:focus-visible {
    outline: 3px solid rgba(95, 121, 87, 0.2);
    outline-offset: 2px;
  }
`;

const AttendancePackageSummarySection = styled.div`
  display: grid;
  gap: ${spacing.xs};
`;

const AttendanceChargeMetadata = styled.dl`
  display: flex;
  flex-wrap: wrap;
  gap: ${spacing.sm} ${spacing.xl};
  margin: 0;

  > div {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: ${spacing.xs} ${spacing.sm};
  }

  dt {
    color: ${ATTENDANCE_UI.colors.textSecondary};
    font-size: ${ATTENDANCE_UI.font.size.xs};
    line-height: ${ATTENDANCE_UI.font.lineHeight.xs};
    font-weight: ${ATTENDANCE_UI.font.weight.medium};
  }

  dd {
    margin: 0;
    color: ${ATTENDANCE_UI.colors.textPrimary};
    font-size: ${ATTENDANCE_UI.font.size.sm};
    line-height: ${ATTENDANCE_UI.font.lineHeight.sm};
    font-weight: ${ATTENDANCE_UI.font.weight.regular};
    overflow-wrap: anywhere;
  }
`;

const AttendancePackageSummaryTitle = styled.strong`
  color: ${ATTENDANCE_UI.colors.textPrimary};
  font-size: ${ATTENDANCE_UI.font.size.xs};
  line-height: ${ATTENDANCE_UI.font.lineHeight.xs};
  font-weight: ${ATTENDANCE_UI.font.weight.semibold};
  text-transform: uppercase;
  letter-spacing: 0;
`;

const AttendanceSessionsSummaryText = styled.p`
  margin: 0;
  color: ${ATTENDANCE_UI.colors.textSecondary};
  font-size: ${ATTENDANCE_UI.font.size.md};
  line-height: ${ATTENDANCE_UI.font.lineHeight.md};
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

  ${(props) => (props.$revenuePatients ? `
    th:nth-child(2), td:nth-child(2),
    th:nth-child(3), td:nth-child(3) { white-space: nowrap; }
    th:nth-child(4), td:nth-child(4) {
      text-align: right;
      white-space: nowrap;
    }
  ` : "")}
`;

const AnnualOverviewTable = styled(AttendanceOverviewTable)`
  min-width: 620px;

  th,
  td {
    padding: 8px 14px;
  }

  th:not(:first-child),
  td:not(:first-child) {
    text-align: right;
    white-space: nowrap;
  }

  th[data-primary-metric="true"],
  td[data-primary-metric="true"] {
    box-shadow: inset 2px 0 0 ${ATTENDANCE_UI.colors.actionBorder};
  }

  th[data-primary-metric="true"] {
    color: ${ATTENDANCE_UI.colors.textPrimary};
    font-weight: ${ATTENDANCE_UI.font.weight.semibold};
  }

  tbody tr:nth-child(even) td {
    background: ${ATTENDANCE_UI.colors.surface};
  }

  tbody tr:hover td {
    background: ${ATTENDANCE_UI.colors.rowHover};
  }

  tbody td[data-primary-metric="true"] strong {
    font-weight: 700;
  }

  tbody tr[data-current-month="true"] td,
  tbody tr[data-current-month="true"]:hover td {
    background: ${ATTENDANCE_UI.colors.actionSoft};
  }

  tbody tr[data-current-month="true"] td:first-child {
    box-shadow: inset 3px 0 0 ${ATTENDANCE_UI.colors.actionBorder};
    font-weight: ${ATTENDANCE_UI.font.weight.semibold};
  }

  tfoot td {
    padding-top: 11px;
    padding-bottom: 11px;
    border-top: 2px solid ${ATTENDANCE_UI.colors.borderStrong};
    border-bottom: none;
    background: ${ATTENDANCE_UI.colors.surfaceMuted};
    color: ${ATTENDANCE_UI.colors.textPrimary};
    font-weight: 700;
  }

  tfoot td:not(:first-child) {
    text-align: right;
    white-space: nowrap;
  }
`;

const BillingCyclesTable = styled(AttendanceOverviewTable)`
  min-width: ${(props) => (props.$detail ? "100%" : "720px")};
  max-width: 100%;
  table-layout: ${(props) => (props.$detail ? "fixed" : "auto")};

  ${(props) => (!props.$detail ? `
    th:first-child,
    td:first-child {
      width: 26%;
    }

    th:nth-child(2),
    td:nth-child(2) {
      width: 34%;
    }

    th:nth-child(3),
    td:nth-child(3) {
      width: 16%;
      white-space: nowrap;
    }

    th:nth-child(4),
    td:nth-child(4) {
      width: 14%;
      white-space: nowrap;
    }
  ` : "")}

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

  ${(props) => (props.$unified ? `
    min-width: 900px;
    th:first-child, td:first-child { white-space: nowrap; }
    th:nth-child(2), td:nth-child(2) { width: 23%; }
    th:nth-child(3), td:nth-child(3) {
      width: 11%;
      white-space: nowrap;
    }
    th:nth-child(4), td:nth-child(4),
    th:nth-child(5), td:nth-child(5) { width: 11%; }
    th:nth-child(6), td:nth-child(6) { width: 12%; }
    th:nth-child(7), td:nth-child(7) { width: 12%; }
    th:nth-child(4), td:nth-child(4),
    th:nth-child(5), td:nth-child(5),
    th:nth-child(6), td:nth-child(6) { text-align: right; }
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
      width: 24%;
    }

    th:nth-child(2),
    td:nth-child(2) {
      width: 22%;
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
    if (props.$unified) return "900px";
    if (props.$detail) return "760px";
    return "720px";
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

const RevenueTypeTag = styled(NeutralPill)`
  align-self: flex-start;
  color: ${appColors.textSecondary};
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

const BillingCycleDueStatusText = styled(AttendanceSecondaryText)`
  color: ${(props) => {
    if (props.$state === "overdue") return ATTENDANCE_UI.colors.dangerText;
    if (props.$state === "today") return ATTENDANCE_UI.colors.action;
    if (props.$state === "missing") return ATTENDANCE_UI.colors.textMuted;
    return ATTENDANCE_UI.colors.textSecondary;
  }};
  font-weight: ${(props) => (
    ["overdue", "today"].includes(props.$state)
      ? ATTENDANCE_UI.font.weight.semibold
      : ATTENDANCE_UI.font.weight.regular
  )};
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
  display: inline-block;
  color: ${(props) =>
    props.$hasOpen ? ATTENDANCE_UI.colors.dangerText : ATTENDANCE_UI.colors.textPrimary};
  font-size: ${ATTENDANCE_UI.font.size.md};
  line-height: ${ATTENDANCE_UI.font.lineHeight.md};
  font-weight: ${ATTENDANCE_UI.font.weight.semibold};
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

const RevenueChargeDetailOverlay = styled(ModalOverlay)`
  --charge-dialog-top: max(14px, env(safe-area-inset-top));
  --charge-dialog-bottom: max(14px, env(safe-area-inset-bottom));
  padding-top: var(--charge-dialog-top);
  padding-bottom: var(--charge-dialog-bottom);
  overflow: hidden;
`;

const RevenueChargeDetailCard = styled(ModalCard)`
  max-width: 100%;
  min-height: 0;
  max-height: calc(100vh - var(--charge-dialog-top) - var(--charge-dialog-bottom));
  max-height: calc(100dvh - var(--charge-dialog-top) - var(--charge-dialog-bottom));

  button:focus-visible, [tabindex="0"]:focus-visible {
    outline: 2px solid ${appColors.focus};
    outline-offset: -2px;
  }

  @media (max-height: 480px) {
    padding: ${spacing.md};
  }
`;

const RevenueChargeDetailHeader = styled(ModalHeader)`
  flex-shrink: 0;
  margin-bottom: ${spacing.md};

  h3, p {
    overflow-wrap: anywhere;
  }
`;

const RevenueChargeDetailPatient = styled(ModalSubtitle)`
  font-size: ${ATTENDANCE_UI.font.size.md};
  font-weight: ${ATTENDANCE_UI.font.weight.regular};
`;

const RevenueChargeDetailBody = styled(ModalBody)`
  display: block;
  min-height: 0;
  overflow-x: auto;
  overflow-y: auto;
  overscroll-behavior-y: contain;

  > * + * {
    margin-top: ${spacing.md};
  }
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

const ExpenseDeleteOptions = styled.fieldset`
  display: flex;
  flex-direction: column;
  gap: ${spacing.md};
  min-width: 0;
  margin: 0;
  padding: 0;
  border: 0;

  legend {
    margin-bottom: ${spacing.lg};
    padding: 0;
    color: ${appColors.textSecondary};
    line-height: 1.5;
  }

  &:disabled label {
    opacity: 0.65;
    cursor: default;
  }
`;

const ExpenseDeleteOption = styled.label`
  display: flex;
  align-items: flex-start;
  gap: ${spacing.md};
  padding: ${spacing.md} ${spacing.lg};
  border: 1px solid ${appColors.borderSubtle};
  border-radius: ${radii.sm};
  background: ${appColors.surface};
  cursor: pointer;

  &:focus-within {
    outline: 2px solid ${appColors.focus};
    outline-offset: 2px;
  }

  input {
    flex-shrink: 0;
    width: 16px;
    height: 16px;
    margin: 3px 0 0;
    accent-color: ${appColors.brand};
  }

  span {
    display: flex;
    flex-direction: column;
    gap: ${spacing.xs};
    min-width: 0;
  }

  strong {
    color: ${appColors.textPrimary};
    font-size: ${fontSizes.body};
    font-weight: 600;
    line-height: 1.5;
  }

  small {
    color: ${appColors.textSecondary};
    font-size: ${fontSizes.small};
    line-height: 1.5;
  }
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
