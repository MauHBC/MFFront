import React, { useCallback, useEffect, useMemo, useState } from "react";
import styled from "styled-components";
import {
  FaBars,
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
import axios from "../../services/axios";
import {
  listFinancialEntries,
  createFinancialEntry,
  listFinancialCategories,
  listFinancialPayments,
  listPaymentMethods,
  createFinancialPayment,
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
  installments: "",
  paid_at: "",
  note: "",
  allocation_mode: "entry",
};

const formatCurrency = (cents) => {
  const value = Number(cents || 0) / 100;
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
};

const normalizeId = (value) => (value ? Number(value) : null);

const TOPBAR_HEIGHT = 80;
const SIDEBAR_WIDTH = 240;
const SIDEBAR_COLLAPSED_WIDTH = 86;
const SHOW_FINANCIAL_MANAGEMENT = false;
const SHOW_FINANCIAL_REPORTS = false;
const SHOW_MANUAL_ENTRIES = false;

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

  const [isEntryOpen, setIsEntryOpen] = useState(false);
  const [entryForm, setEntryForm] = useState(emptyEntry);
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [paymentForm, setPaymentForm] = useState(emptyPayment);
  const [paymentAllocations, setPaymentAllocations] = useState({});
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
    if (typeof window === "undefined") return () => {};
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

  const categoryMap = useMemo(
    () => new Map(categories.map((item) => [item.id, item])),
    [categories],
  );

  const patientMap = useMemo(
    () => new Map(patients.map((item) => [item.id, item])),
    [patients],
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
      const paid = paidByEntryId.get(entry.id) || 0;
      const amount = Number(entry.amount_cents || 0);
      let open = Math.max(0, amount - paid);
      let status = entry.status || "pending";
      let paidValue = paid;

      if (entry.status === "canceled") {
        status = "canceled";
        open = 0;
        paidValue = 0;
      } else if (amount <= 0) {
        status = entry.status || "pending";
        open = 0;
      } else if (paid > 0) {
        if (paid < amount) {
          status = "partial";
        } else {
          status = "paid";
          open = 0;
          paidValue = amount;
        }
      } else if (entry.status === "paid") {
        status = "paid";
        open = 0;
        paidValue = amount;
      } else {
        status = "pending";
        open = Math.max(0, amount);
      }

      map.set(entry.id, { paid: paidValue, open, status });
    });
    return map;
  }, [entries, paidByEntryId]);

  const filteredEntries = useMemo(() => {
    const search = filters.search.trim().toLowerCase();
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
        const haystack = [
          entry.description,
          entryStatus,
          category?.name,
          patient?.full_name,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
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
      if (attendanceFilters.patient_id) params.patient_id = attendanceFilters.patient_id;
      if (attendanceFilters.professional_id) {
        params.professional_user_id = attendanceFilters.professional_id;
      }
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
    attendanceFilters.patient_id,
    attendanceFilters.professional_id,
  ]);

  useEffect(() => {
    if (activeSection === "receitas") {
      loadAttendance();
    }
  }, [activeSection, loadAttendance]);

  const openEntryModal = useCallback(() => {
    setEntryForm(emptyEntry);
    setIsEntryOpen(true);
  }, []);

  const closeEntryModal = useCallback(() => {
    setIsEntryOpen(false);
  }, []);

  const openPaymentModal = useCallback((entry) => {
    const paidAmount = paidByEntryId.get(entry.id) || 0;
    const openAmountCents = Math.max(0, Number(entry.amount_cents || 0) - paidAmount);
    setPaymentForm({
      ...emptyPayment,
      entry_id: entry.id,
      patient_id: entry.patient_id || "",
      allocation_mode: "entry",
      amount: (openAmountCents / 100).toFixed(2),
      paid_at: new Date().toISOString().slice(0, 16),
    });
    setPaymentAllocations({});
    setIsPaymentOpen(true);
  }, [paidByEntryId]);

  const closePaymentModal = useCallback(() => {
    setIsPaymentOpen(false);
    setPaymentAllocations({});
  }, []);

  const openCreditModal = useCallback(() => {
    setPaymentForm({
      ...emptyPayment,
      entry_id: null,
      patient_id: "",
      allocation_mode: "credit",
      paid_at: new Date().toISOString().slice(0, 16),
    });
    setPaymentAllocations({});
    setIsPaymentOpen(true);
  }, []);

  const handleEntryChange = useCallback((event) => {
    const { name, value } = event.target;
    setEntryForm((prev) => ({ ...prev, [name]: value }));
  }, []);

  const handlePaymentChange = useCallback((event) => {
    const { name, value, type, checked } = event.target;
    if (name === "allocation_mode" && value !== "manual") {
      setPaymentAllocations({});
    }
    setPaymentForm((prev) => ({ ...prev, [name]: type === "checkbox" ? checked : value }));
  }, []);

  const handleAllocationChange = useCallback((entryId, value) => {
    setPaymentAllocations((prev) => ({ ...prev, [entryId]: value }));
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
  }, []);

  const handleViewPatientSessions = useCallback((patientId) => {
    if (!patientId) return;
    setAttendanceFilters((prev) => ({ ...prev, patient_id: String(patientId) }));
    setAttendanceView("sessions");
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

  const handleSavePayment = useCallback(async () => {
    const amountValue = Number(paymentForm.amount.replace(",", "."));
    if (Number.isNaN(amountValue) || amountValue <= 0) {
      toast.error("Informe um valor valido.");
      return;
    }
    if (!paymentForm.paid_at) {
      toast.error("Informe a data do pagamento.");
      return;
    }
    if (!paymentForm.entry_id && !paymentForm.patient_id) {
      toast.error("Selecione o paciente.");
      return;
    }

    try {
      const allocationMode = paymentForm.entry_id
        ? "entry"
        : paymentForm.allocation_mode || "none";
      const allocationItems = Object.entries(paymentAllocations)
        .map(([entryId, value]) => {
          const parsed = Number(String(value).replace(",", "."));
          if (Number.isNaN(parsed) || parsed <= 0) return null;
          return {
            entry_id: Number(entryId),
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
        if (allocationTotal > Math.round(amountValue * 100)) {
          toast.error("O valor distribuido nao pode ser maior que o recebimento.");
          return;
        }
      }

      await createFinancialPayment({
        entry_id: paymentForm.entry_id || null,
        patient_id: normalizeId(paymentForm.patient_id),
        payment_method_id: normalizeId(paymentForm.payment_method_id),
        amount_cents: Math.round(amountValue * 100),
        installments: paymentForm.installments
          ? Math.max(1, Number(paymentForm.installments))
          : null,
        paid_at: new Date(paymentForm.paid_at).toISOString(),
        note: paymentForm.note.trim() || null,
        allocation_mode: allocationMode,
        allocations: allocationMode === "manual" ? allocationItems : undefined,
      });

      toast.success("Recebimento registrado.");
      closePaymentModal();
      setPaymentAllocations({});
      loadData();
    } catch (error) {
      toast.error("Nao foi possivel registrar o pagamento.");
    }
  }, [paymentForm, paymentAllocations, closePaymentModal, loadData]);

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

  const attendanceRows = useMemo(() => {
    const search = attendanceFilters.search.trim().toLowerCase();
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
        const method = latestPayment?.payment_method_id
          ? paymentMethodMap.get(latestPayment.payment_method_id)
          : null;
        const entryFinancial = entry ? entryFinancialMap.get(entry.id) : null;
        const paidCents = entryFinancial?.paid ?? 0;
        const openCents =
          entryFinancial?.open ?? Math.max(0, Number(amountCents || 0) - paidCents);
        const status = entry ? entryFinancial?.status || entry.status || "pending" : "missing";

        return {
          id: session.id,
          starts_at: session.starts_at,
          patientId: session.patient_id,
          patientName,
          professionalName,
          serviceName,
          recurrence: formatRecurrence(session),
          amountCents,
          paidCents,
          openCents,
          entry,
          financialStatus: status,
          payment: latestPayment,
          paymentCount,
          paymentMethod: method?.name || "-",
        };
      })
      .filter((row) => {
        if (!search) return true;
        const haystack = [
          row.patientName,
          row.professionalName,
          row.serviceName,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
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
      .sort((a, b) => new Date(b.starts_at || 0) - new Date(a.starts_at || 0));
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

  const attendanceByPatient = useMemo(() => {
    const map = new Map();
    attendanceRows.forEach((row) => {
      if (!row.patientId) return;
      const existing = map.get(row.patientId);
      const base = existing || {
        patientId: row.patientId,
        patientName: row.patientName,
        sessions: 0,
        pendingSessions: 0,
        openCents: 0,
        paidCents: 0,
        services: new Set(),
        professionals: new Set(),
        lastSession: row.starts_at,
      };
      base.sessions += 1;
      if (row.financialStatus !== "paid") base.pendingSessions += 1;
      base.openCents += Number(row.openCents || 0);
      base.paidCents += Number(row.paidCents || 0);
      if (row.serviceName) base.services.add(row.serviceName);
      if (row.professionalName) base.professionals.add(row.professionalName);
      if (!base.lastSession || new Date(row.starts_at) > new Date(base.lastSession)) {
        base.lastSession = row.starts_at;
      }
      map.set(row.patientId, base);
    });

    return Array.from(map.values())
      .map((item) => {
        const serviceNames = Array.from(item.services);
        const professionals = Array.from(item.professionals);
        return {
          ...item,
          servicesLabel: serviceNames.length > 1 ? "Varios" : serviceNames[0] || "-",
          professionalsLabel: professionals.length > 1 ? "Varios" : professionals[0] || "-",
          creditsAvailable: creditBalanceByPatient.get(item.patientId) || 0,
        };
      })
      .sort((a, b) => new Date(b.lastSession || 0) - new Date(a.lastSession || 0));
  }, [attendanceRows, creditBalanceByPatient]);

  const pendingByPatientId = useMemo(() => {
    const map = new Map();
    attendanceRows.forEach((row) => {
      const status = row.financialStatus || "missing";
      if (status === "paid") return;
      if (!map.has(row.patientId)) map.set(row.patientId, 0);
      map.set(row.patientId, map.get(row.patientId) + 1);
    });
    return map;
  }, [attendanceRows]);

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

  const creditRows = useMemo(() => {
    const rows = [];
    creditBalanceByPatient.forEach((amountCents, patientId) => {
      if (!amountCents || amountCents <= 0) return;
      rows.push({ patientId, amountCents });
    });
    return rows.sort((a, b) => b.amountCents - a.amountCents);
  }, [creditBalanceByPatient]);

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
      const parsed = Number(String(value).replace(",", "."));
      if (Number.isNaN(parsed) || parsed <= 0) return sum;
      return sum + Math.round(parsed * 100);
    }, 0);
  }, [paymentAllocations]);

  const filteredPayments = useMemo(() => {
    const search = paymentFilters.search.trim().toLowerCase();
    return payments.filter((payment) => {
      if (paymentFilters.patient_id && Number(payment.patient_id) !== Number(paymentFilters.patient_id)) {
        return false;
      }
      if (paymentFilters.method_id && Number(payment.payment_method_id) !== Number(paymentFilters.method_id)) {
        return false;
      }
      if (paymentFilters.start) {
        const startDate = new Date(paymentFilters.start);
        const paidAt = new Date(payment.paid_at || 0);
        if (paidAt < startDate) return false;
      }
      if (paymentFilters.end) {
        const endDate = new Date(paymentFilters.end);
        const paidAt = new Date(payment.paid_at || 0);
        if (paidAt > endDate) return false;
      }
      if (search) {
        const patient = payment.patient_id ? patientMap.get(payment.patient_id) : null;
        const method = payment.payment_method_id
          ? paymentMethodMap.get(payment.payment_method_id)
          : null;
        const haystack = [
          patient?.full_name,
          patient?.name,
          method?.name,
          payment.note,
          payment.origin,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
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
                  <th>Acoes</th>
                </tr>
              </thead>
              <tbody>
                {filteredEntries.map((entry) => {
                  const category = entry.category_id ? categoryMap.get(entry.category_id) : null;
                  const patient = entry.patient_id ? patientMap.get(entry.patient_id) : null;
                  const financial = entryFinancialMap.get(entry.id);
                  const status = financial?.status || entry.status;
                  const openCents = financial?.open ?? 0;
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
                          {entry.type === "income" && status !== "paid" && status !== "canceled" && (
                            <SmallButton type="button" onClick={() => openPaymentModal(entry)}>
                              Confirmar pagamento
                            </SmallButton>
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
        attendanceView === "patients" ? "Resumo por paciente" : "Detalhe por sessao";

      let attendanceContent = <EmptyState>Sem atendimentos no periodo.</EmptyState>;

      if (attendanceView === "patients" && attendanceByPatient.length > 0) {
        attendanceContent = (
          <SimpleTable>
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Profissionais</th>
                <th>Servicos</th>
                <th>Sessoes</th>
                <th>Pendente</th>
                <th>Em aberto</th>
                <th>Ja recebido</th>
                <th>Credito</th>
                <th>Ultimo atendimento</th>
                <th>Acoes</th>
              </tr>
            </thead>
            <tbody>
              {attendanceByPatient.map((row) => (
                <tr key={row.patientId}>
                  <td>
                    <CellStack>
                      <strong>{row.patientName}</strong>
                      <MutedText>Sessoes: {row.sessions}</MutedText>
                    </CellStack>
                  </td>
                  <td>{row.professionalsLabel}</td>
                  <td>{row.servicesLabel}</td>
                  <td>{row.sessions}</td>
                  <td>
                    <Badge>{row.pendingSessions}</Badge>
                  </td>
                  <td>{formatCurrency(row.openCents)}</td>
                  <td>{formatCurrency(row.paidCents)}</td>
                  <td>{formatCurrency(row.creditsAvailable)}</td>
                  <td>{row.lastSession ? new Date(row.lastSession).toLocaleDateString() : "-"}</td>
                  <td>
                    <RowActions>
                      <SmallButton type="button" onClick={() => handleViewPatientSessions(row.patientId)}>
                        Ver sessoes
                      </SmallButton>
                    </RowActions>
                  </td>
                </tr>
              ))}
            </tbody>
          </SimpleTable>
        );
      }

      if (attendanceView === "sessions" && attendanceRows.length > 0) {
        attendanceContent = (
          <AttendanceTable>
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Profissional</th>
                <th>Servico</th>
                <th>Recorrencia</th>
                <th>Sessoes abertas do paciente</th>
                <th>Valor da sessao</th>
                <th>Ultima forma</th>
                <th>Parcelas</th>
                <th>Situacao financeira</th>
                <th>Observacoes</th>
                <th>Acoes</th>
              </tr>
            </thead>
            <tbody>
              {attendanceRows.map((row) => {
                const pendingCount = pendingByPatientId.get(row.patientId) || 0;
                const status = row.financialStatus || "missing";
                const statusLabel = formatFinancialStatus(status);
                let installmentsLabel = "-";
                if (row.payment?.installments) installmentsLabel = `${row.payment.installments}x`;
                else if (row.paymentCount > 1) installmentsLabel = "Varios";

                const methodLabel = row.paymentCount > 1 ? "Varios" : row.paymentMethod;

                return (
                  <tr key={row.id}>
                    <td>
                      <CellStack>
                        <strong>{row.patientName}</strong>
                        <MutedText>
                          Creditos: {formatCurrency(creditBalanceByPatient.get(row.patientId) || 0)}
                        </MutedText>
                      </CellStack>
                    </td>
                    <td>{row.professionalName}</td>
                    <td>{row.serviceName}</td>
                    <td>{row.recurrence}</td>
                    <td>
                      <Badge>{pendingCount}</Badge>
                    </td>
                    <td>
                      <CellStack>
                        <strong>{formatCurrency(row.amountCents)}</strong>
                        {row.openCents > 0 && (
                          <MutedText>Em aberto: {formatCurrency(row.openCents)}</MutedText>
                        )}
                      </CellStack>
                    </td>
                    <td>{methodLabel || "-"}</td>
                    <td>{installmentsLabel}</td>
                    <td>
                      <StatusPill $status={status}>
                        {statusLabel}
                      </StatusPill>
                    </td>
                    <td>{row.entry?.notes || row.payment?.note || "-"}</td>
                    <td>
                      <RowActions>
                        {!row.entry && (
                          <SmallButton type="button" onClick={() => handleCreateSessionEntry(row.id)}>
                            Gerar lancamento
                          </SmallButton>
                        )}
                        {row.entry && status !== "paid" && status !== "canceled" && (
                          <SmallButton type="button" onClick={() => openPaymentModal(row.entry)}>
                            Confirmar pagamento
                          </SmallButton>
                        )}
                      </RowActions>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </AttendanceTable>
        );
      }

      let creditContent = <EmptyState>Sem creditos disponiveis.</EmptyState>;
      if (creditRows.length > 0) {
        creditContent = (
          <SimpleTable>
            <thead>
              <tr>
                <th>Paciente</th>
                <th>Valor disponivel</th>
              </tr>
            </thead>
            <tbody>
              {creditRows.map((row) => {
                const patient = patientMap.get(row.patientId);
                return (
                  <tr key={row.patientId}>
                    <td>{patient?.full_name || "-"}</td>
                    <td>{formatCurrency(row.amountCents)}</td>
                  </tr>
                );
              })}
            </tbody>
          </SimpleTable>
        );
      }

      return (
        <Section>
          <SectionHeader>
            <div>
              <SectionTitle>Atendimentos</SectionTitle>
              <SectionSubtitle>O que foi atendido, o que gerou cobranca e o que ainda falta receber.</SectionSubtitle>
            </div>
            <HeaderActions>
              <GhostButton type="button" onClick={loadAttendance}>
                Atualizar
              </GhostButton>
              <PrimaryButton type="button" onClick={openCreditModal}>
                <FaPlus />
                Registrar credito
              </PrimaryButton>
            </HeaderActions>
          </SectionHeader>

          {isAttendanceBusy ? (
            <SectionLoader>
              <Spinner />
              Carregando atendimentos...
            </SectionLoader>
          ) : (
            <>
              <Panel>
                <PanelHeader>
                  <PanelTitle>Resumo de cobranca</PanelTitle>
                </PanelHeader>
                <SummaryGrid>
                  <SummaryCard>
                    <SummaryLabel>Sessoes concluidas</SummaryLabel>
                    <SummaryValue>{attendanceSummary.total}</SummaryValue>
                  </SummaryCard>
                  <SummaryCard>
                    <SummaryLabel>Pacientes em aberto</SummaryLabel>
                    <SummaryValue>{attendanceSummary.openPatients}</SummaryValue>
                  </SummaryCard>
                  <SummaryCard>
                    <SummaryLabel>Total em aberto</SummaryLabel>
                    <SummaryValue>{formatCurrency(attendanceSummary.pendingAmount)}</SummaryValue>
                  </SummaryCard>
                  <SummaryCard>
                    <SummaryLabel>Credito antecipado</SummaryLabel>
                    <SummaryValue>{formatCurrency(attendanceSummary.creditsAvailable)}</SummaryValue>
                  </SummaryCard>
                </SummaryGrid>
              </Panel>

              <Panel>
                <PanelHeader>
                  <PanelTitle>Filtros</PanelTitle>
                </PanelHeader>
                <FiltersRow>
                  <FilterField>
                    <Label htmlFor="attendance-status">Status financeiro</Label>
                    <Select
                      id="attendance-status"
                      name="financial"
                      value={attendanceFilters.financial}
                      onChange={handleAttendanceFilterChange}
                    >
                      <option value="all">Todos</option>
                      <option value="pending">Pendentes</option>
                      <option value="partial">Parciais</option>
                      <option value="paid">Pagos</option>
                      <option value="missing">Sem lancamento</option>
                    </Select>
                  </FilterField>
                  <FilterField>
                    <Label htmlFor="attendance-patient">Paciente</Label>
                    <Select
                      id="attendance-patient"
                      name="patient_id"
                      value={attendanceFilters.patient_id}
                      onChange={handleAttendanceFilterChange}
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
                    <Label htmlFor="attendance-professional">Profissional</Label>
                    <Select
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
                    </Select>
                  </FilterField>
                  <FilterField>
                    <Label htmlFor="attendance-start">De</Label>
                    <Input
                      id="attendance-start"
                      type="date"
                      name="start"
                      value={attendanceFilters.start}
                      onChange={handleAttendanceFilterChange}
                    />
                  </FilterField>
                  <FilterField>
                    <Label htmlFor="attendance-end">Ate</Label>
                    <Input
                      id="attendance-end"
                      type="date"
                      name="end"
                      value={attendanceFilters.end}
                      onChange={handleAttendanceFilterChange}
                    />
                  </FilterField>
                  <FilterField>
                    <Label htmlFor="attendance-search">Busca</Label>
                    <Input
                      id="attendance-search"
                      name="search"
                      placeholder="Paciente, profissional, servico..."
                      value={attendanceFilters.search}
                      onChange={handleAttendanceFilterChange}
                    />
                  </FilterField>
                </FiltersRow>
              </Panel>

              <Panel>
                <InlineViewToggle>
                  <SegmentedControl $prominent>
                    <SegmentButton
                      type="button"
                      $active={attendanceView === "patients"}
                      $prominent
                      onClick={() => setAttendanceView("patients")}
                    >
                      Por paciente
                    </SegmentButton>
                    <SegmentButton
                      type="button"
                      $active={attendanceView === "sessions"}
                      $prominent
                      onClick={() => setAttendanceView("sessions")}
                    >
                      Por sessao
                    </SegmentButton>
                  </SegmentedControl>
                </InlineViewToggle>
                <PanelHeader>
                  <PanelTitle>{attendanceTitle}</PanelTitle>
                </PanelHeader>
                {attendanceContent}
              </Panel>

              <Panel>
                <PanelHeader>
                  <div>
                    <PanelTitle>Credito dos pacientes</PanelTitle>
                    <SectionSubtitle>Valores recebidos antes do uso e ainda disponiveis para futuras cobrancas.</SectionSubtitle>
                  </div>
                </PanelHeader>
                {creditContent}
              </Panel>
            </>
          )}
        </Section>
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
                    <th>Parcelas</th>
                    <th>Uso do valor</th>
                    <th>Observacoes</th>
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
        <TabButton
          type="button"
          $active={receitasView === "recebimentos"}
          onClick={() => setReceitasView("recebimentos")}
        >
          Recebimentos
        </TabButton>
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

    if (receitasView === "recebimentos") {
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
            <th>Acoes</th>
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
            <th>Acoes</th>
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

  const renderPrices = () => {
    let content = (
      <SimpleTable>
        <thead>
          <tr>
            <th>Servico</th>
            <th>Valor</th>
            <th>Ativo</th>
            <th>Acoes</th>
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
            <th>Acoes</th>
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
            <SidebarTitle $collapsed={isSidebarCollapsed}>Configuracoes</SidebarTitle>
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
                  <Label htmlFor="entry-notes">Observacoes</Label>
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
                  <ModalSubtitle>Informe o valor recebido e como ele deve ser usado.</ModalSubtitle>
                </div>
                <IconButton type="button" onClick={closePaymentModal}>
                  <FaTimes />
                </IconButton>
              </ModalHeader>
              <ModalBody>
                <FormGrid>
                  {!paymentForm.entry_id && (
                    <Field>
                      <Label htmlFor="payment-patient">Paciente</Label>
                      <Select
                        id="payment-patient"
                        name="patient_id"
                        value={paymentForm.patient_id}
                        onChange={handlePaymentChange}
                      >
                        <option value="">Selecione</option>
                        {patients.map((patient) => (
                          <option key={patient.id} value={patient.id}>
                            {patient.full_name || patient.name}
                          </option>
                        ))}
                      </Select>
                    </Field>
                  )}
                  <Field>
                    <Label htmlFor="payment-amount">Valor</Label>
                    <Input
                      id="payment-amount"
                      name="amount"
                      value={paymentForm.amount}
                      onChange={handlePaymentChange}
                    />
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
                  <Field>
                    <Label htmlFor="payment-installments">Parcelas</Label>
                    <Input
                      id="payment-installments"
                      type="number"
                      min="1"
                      name="installments"
                      placeholder="Ex: 3"
                      value={paymentForm.installments}
                      onChange={handlePaymentChange}
                    />
                  </Field>
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
                <Field>
                  <Label htmlFor="payment-note">Observacoes</Label>
                  <TextArea
                    id="payment-note"
                    name="note"
                    rows="2"
                    value={paymentForm.note}
                    onChange={handlePaymentChange}
                  />
                </Field>
                {paymentForm.entry_id && (
                  <MutedText>Este recebimento sera usado para baixar esta cobranca.</MutedText>
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
              </ModalBody>
              <ModalActions>
                <SecondaryButton type="button" onClick={closePaymentModal}>
                  Cancelar
                </SecondaryButton>
                <PrimaryButton type="button" onClick={handleSavePayment}>
                  Confirmar recebimento
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
                  <Label htmlFor="recurring-notes">Observacoes</Label>
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
  padding: 18px;
  border: 1px solid rgba(0, 0, 0, 0.06);
  margin-bottom: 16px;
`;

const PanelHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
  flex-wrap: wrap;
`;

const PanelTitle = styled.h3`
  margin: 0;
  font-size: 16px;
  color: #2b2b2b;
`;

const SegmentedControl = styled.div`
  display: inline-flex;
  align-items: center;
  padding: ${(props) => (props.$prominent ? "6px" : "4px")};
  border-radius: 999px;
  background: #fff;
  border: 1px solid rgba(0, 0, 0, 0.1);
  box-shadow: ${(props) => (props.$prominent ? "0 10px 22px rgba(0, 0, 0, 0.08)" : "none")};
`;

const SegmentButton = styled.button`
  border: none;
  background: ${(props) => (props.$active ? "#6a795c" : "transparent")};
  color: ${(props) => (props.$active ? "#fff" : "#4a4a4a")};
  padding: ${(props) => (props.$prominent ? "10px 18px" : "6px 12px")};
  border-radius: 999px;
  font-size: ${(props) => (props.$prominent ? "14px" : "12px")};
  font-weight: 700;
  cursor: pointer;
`;

const InlineViewToggle = styled.div`
  display: flex;
  justify-content: flex-start;
  margin-bottom: 14px;
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
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 12px;
  margin-bottom: 16px;
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

const AttendanceTable = styled.table`
  width: 100%;
  min-width: 980px;
  border-collapse: collapse;
  display: block;
  overflow-x: auto;

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

const CellStack = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

const MutedText = styled.span`
  font-size: 12px;
  color: #7a7a7a;
`;

const Badge = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 2px 8px;
  border-radius: 999px;
  background: #eef2e9;
  color: #46533f;
  font-size: 12px;
  font-weight: 700;
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
  padding: 10px 16px;
  border-radius: 12px;
  font-weight: 700;
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

const SummaryGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 14px;
  margin-bottom: 18px;
`;

const SummaryCard = styled.div`
  padding: 16px;
  border-radius: 14px;
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
  font-size: 20px;
  font-weight: 800;
  color: #2b2b2b;
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
  align-items: center;
  z-index: 40;
`;

const ModalCard = styled.div`
  width: min(720px, 90vw);
  background: #fff;
  border-radius: 20px;
  padding: 24px;
  box-shadow: 0 18px 45px rgba(0, 0, 0, 0.15);
  z-index: 41;
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
`;

const ModalActions = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 20px;
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

const Input = styled.input`
  padding: 10px 12px;
  border-radius: 10px;
  border: 1px solid rgba(0, 0, 0, 0.15);
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

const TextArea = styled.textarea`
  padding: 10px 12px;
  border-radius: 10px;
  border: 1px solid rgba(0, 0, 0, 0.15);
`;

const Backdrop = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.35);
  z-index: 30;
`;
