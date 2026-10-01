/* eslint-env jest */
import "@testing-library/jest-dom";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { toast } from "react-toastify";

import Financeiro from "./index";
import axios, { getUserFacingApiError } from "../../services/axios";
import {
  applyScopedFinancialCredit,
  createFinancialEntry,
  createFinancialPayment,
  getFinancialRevenuePatientDetail,
  getFinancialRevenuesSummary,
  listBillingCycles,
  listFinancialCategories,
  listFinancialEntries,
  listFinancialPayments,
  listPatientCredits,
  listPaymentMethods,
  listServicePrices,
} from "../../services/financial";

jest.mock("react-toastify", () => ({
  toast: { error: jest.fn(), success: jest.fn(), info: jest.fn() },
}));

jest.mock("../../services/axios", () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
  },
  getUserFacingApiError: jest.fn((error, fallback) => error?.response?.data?.message || fallback),
}));

jest.mock("../../services/scheduling", () => ({
  createSpecialSchedulingEvent: jest.fn(),
  inactivateSpecialSchedulingEvent: jest.fn(),
  listSpecialSchedulingEvents: jest.fn(),
  updateSpecialSchedulingEvent: jest.fn(),
}));

jest.mock("../../services/financial", () => ({
  listFinancialCategories: jest.fn(),
  getFinancialOverview: jest.fn(),
  getFinancialRevenuesSummary: jest.fn(),
  getFinancialRevenuePatientDetail: jest.fn(),
  createFinancialEntry: jest.fn(),
  listFinancialEntries: jest.fn(),
  listFinancialPayments: jest.fn(),
  listPaymentMethods: jest.fn(),
  listClinicExpenses: jest.fn(),
  getClinicExpenseAlerts: jest.fn(),
  listClinicExpenseCategories: jest.fn(),
  createClinicExpense: jest.fn(),
  updateClinicExpense: jest.fn(),
  deleteClinicExpense: jest.fn(),
  payClinicExpense: jest.fn(),
  unpayClinicExpense: jest.fn(),
  createClinicExpenseCategory: jest.fn(),
  updateClinicExpenseCategory: jest.fn(),
  activateClinicExpenseCategory: jest.fn(),
  deactivateClinicExpenseCategory: jest.fn(),
  createFinancialPayment: jest.fn(),
  applyCreditToFinancialEntry: jest.fn(),
  applyScopedFinancialCredit: jest.fn(),
  createFinancialCategory: jest.fn(),
  createPaymentMethod: jest.fn(),
  listServicePrices: jest.fn(),
  createServicePrice: jest.fn(),
  updateFinancialCategory: jest.fn(),
  updatePaymentMethod: jest.fn(),
  updateServicePrice: jest.fn(),
  listFinancialRecurringExpenses: jest.fn(),
  createFinancialRecurringExpense: jest.fn(),
  updateFinancialRecurringExpense: jest.fn(),
  listBillingCycles: jest.fn(),
  listPatientCredits: jest.fn(),
}));

const patients = [
  { id: 30, full_name: "Maria Silva" },
  { id: 31, full_name: "Bruno Costa" },
  { id: 32, full_name: "Carla Lima" },
  { id: 33, full_name: "Dora Alves" },
  { id: 34, full_name: "Eva Rocha" },
  { id: 35, full_name: "Fernanda Sem Ciclo" },
];

const toLocalDateOnly = (value) => {
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${value.getFullYear()}-${month}-${day}`;
};

const addLocalDays = (days) => {
  const value = new Date();
  value.setHours(12, 0, 0, 0);
  value.setDate(value.getDate() + days);
  return toLocalDateOnly(value);
};

const formatDateOnlyBR = (value) => {
  const [year, month, day] = String(value).split("-");
  return `${day}/${month}/${year}`;
};

const makeEntry = ({ id, patientId, amountCents, paidCents = 0, status = "pending", dueDate = "2026-08-31" }) => ({
  id,
  patient_id: patientId,
  type: "income",
  description: `Mensalidade ${id}`,
  amount_cents: amountCents,
  reference_date: "2026-08-01",
  due_date: dueDate,
  status,
  FinancialEntryInstallments: [{
    id: id + 100,
    installment_number: 1,
    amount_cents: amountCents,
    paid_amount_cents: paidCents,
    open_amount_cents: status === "canceled" ? 0 : Math.max(0, amountCents - paidCents),
    status,
  }],
});

const entries = [
  makeEntry({ id: 901, patientId: 30, amountCents: 70000 }),
  makeEntry({ id: 902, patientId: 31, amountCents: 80000, paidCents: 30000 }),
  makeEntry({ id: 903, patientId: 32, amountCents: 90000, paidCents: 90000, status: "paid" }),
  makeEntry({ id: 904, patientId: 33, amountCents: 60000, dueDate: "2020-01-01" }),
  makeEntry({ id: 905, patientId: 34, amountCents: 50000, status: "canceled" }),
];

const makeCycle = ({ id, patientId, entryId, amountCents, planName, status = "active", ...extra }) => ({
  id,
  patient_id: patientId,
  patient_plan_id: 1000 + patientId,
  service_plan_id: 2000 + id,
  financial_entry_id: entryId,
  cycle_start: `2026-08-${String(id).padStart(2, "0")}`,
  cycle_end: "2026-08-31",
  amount_cents: amountCents,
  status,
  Patient: patients.find((patient) => patient.id === patientId),
  ServicePlan: { id: 2000 + id, name: planName },
  FinancialEntry: entries.find((entry) => entry.id === entryId) || null,
  ...extra,
});

const cycles = [
  makeCycle({ id: 11, patientId: 30, entryId: 901, amountCents: 70000, planName: "Recovery" }),
  makeCycle({ id: 12, patientId: 30, amountCents: 0, planName: "Pilates", is_no_charge: true }),
  makeCycle({ id: 13, patientId: 31, entryId: 902, amountCents: 80000, planName: "Movimento" }),
  makeCycle({ id: 14, patientId: 32, entryId: 903, amountCents: 90000, planName: "Performance" }),
  makeCycle({ id: 15, patientId: 33, entryId: 904, amountCents: 60000, planName: "Mobilidade" }),
  makeCycle({ id: 16, patientId: 34, entryId: 905, amountCents: 50000, planName: "Equilíbrio", status: "canceled" }),
];

// The old monthly link now reaches the unified projection; fixtures remain isolated.
const authorizationContext = { clinic_id: 77 };
jest.mock("../../contexts/AuthorizationContext", () => ({
  useAuthorization: () => ({ context: authorizationContext, canAccessModule: () => true, hasCapability: () => true }),
}));
const FINANCIAL_TEST_NOW = new Date("2026-08-20T12:00:00-03:00");
let currentCycles;
let availableCredit;
const periodCycles = (period, mode) => currentCycles.filter((cycle) =>
  String(cycle.cycle_start).startsWith(mode === "year" ? String(period).slice(0, 4) : period));
const asCharge = (cycle) => {
  const entry = cycle.FinancialEntry;
  const part = entry?.FinancialEntryInstallments?.[0];
  const canceled = cycle.status === "canceled" || entry?.status === "canceled";
  const amount = canceled || cycle.is_no_charge ? 0 : Number(entry?.amount_cents || 0);
  const paid = Math.min(amount, Number(part?.paid_amount_cents || 0));
  const open = Math.max(0, amount - paid);
  const dueDate = entry?.due_date || null;
  let financialStatus = "pending";
  if (paid > 0) financialStatus = "partial";
  if (!open) financialStatus = "paid";
  if (canceled) financialStatus = "canceled";
  if (cycle.is_no_charge) financialStatus = "no_charge";
  return {
    key: `billing_cycle-${cycle.id}`, kind: "billing_cycle", sourceId: cycle.id,
    service_name: cycle.ServicePlan.name, reference_date: cycle.cycle_start,
    cycle_start: cycle.cycle_start, cycle_end: cycle.cycle_end, due_date: dueDate,
    due_dates: dueDate ? [{ due_date: dueDate, open_cents: open }] : [],
    overdue_cents: dueDate && dueDate < "2026-08-20" ? open : 0,
    amount_cents: amount, paid_cents: paid, open_cents: open,
    financial_status: financialStatus,
    entries: open ? [{ entryId: entry.id, openCents: open, reference_date: cycle.cycle_start }] : [],
    sessions: [],
  };
};
const detailFor = (patientId, period, mode) => {
  const charges = periodCycles(period, mode).filter((cycle) => cycle.patient_id === Number(patientId)).map(asCharge);
  const summary = charges.reduce((sum, charge) => ({
    total: sum.total + charge.amount_cents, received: sum.received + charge.paid_cents,
    pending: sum.pending + charge.open_cents, creditAvailable: availableCredit,
  }), { total: 0, received: 0, pending: 0, creditAvailable: availableCredit });
  return { origin: "all", patient: patients.find((item) => item.id === Number(patientId)),
    charges, summary, entries: [], payments: [], credits: [], series: [], packages: [], sessions: [], financial_history: [] };
};
const renderMensalidades = (query = "?view=mensalidades&month=2026-08") => render(
  <MemoryRouter initialEntries={[`/financeiro/receitas${query}`]}><Financeiro /></MemoryRouter>,
);
const openDetail = async (name = "Maria Silva") => {
  const row = (await screen.findByText(name)).closest("tr");
  await userEvent.click(within(row).getByRole("button", { name: "Detalhes" }));
  await waitFor(() => expect(screen.getByRole("button", { name: "Registrar recebimento" })).toBeEnabled());
};
const openPayment = async () => {
  await openDetail();
  await userEvent.click(screen.getByRole("button", { name: "Registrar recebimento" }));
};
const fillPayment = async (amount, discount = "0") => {
  await userEvent.click(screen.getByRole("button", { name: "Avançar" }));
  fireEvent.change(screen.getByLabelText("Valor recebido"), { target: { value: amount } });
  const discountInput = screen.queryByLabelText("Desconto");
  if (discountInput) fireEvent.change(discountInput, { target: { value: discount } });
  fireEvent.change(screen.getByLabelText("Forma de pagamento"), { target: { value: "3" } });
  fireEvent.change(screen.getByLabelText("Data do recebimento"), { target: { value: "2026-08-20" } });
};

beforeEach(() => {
  jest.useFakeTimers().setSystemTime(FINANCIAL_TEST_NOW);
  jest.clearAllMocks();
  currentCycles = cycles.map((cycle) => ({ ...cycle }));
  availableCredit = 0;
  window.matchMedia = jest.fn().mockReturnValue({ matches: false, addEventListener: jest.fn(), removeEventListener: jest.fn() });
  getFinancialRevenuePatientDetail.mockImplementation(async (id, period, mode) => ({ data: detailFor(id, period, mode) }));
  getFinancialRevenuesSummary.mockImplementation(async (period, mode) => {
    const ids = [...new Set(periodCycles(period, mode).map((cycle) => cycle.patient_id))];
    const rows = ids.map((id) => {
      const detail = detailFor(id, period, mode);
      const openCharges = detail.charges.filter((charge) => charge.open_cents > 0 && charge.due_date)
        .sort((a, b) => a.due_date.localeCompare(b.due_date));
      return { patient_id: id, patient_name: detail.patient.full_name, ...detail.summary,
        entries_count: detail.charges.length, reference_date: detail.charges[0]?.reference_date,
        due_date: openCharges[0]?.due_date || detail.charges[0]?.due_date,
        overdue_cents: detail.charges.reduce((sum, charge) => sum + charge.overdue_cents, 0) };
    });
    return { data: { origin: "all", patients: rows, summary: rows.reduce((sum, row) => ({
      total: sum.total + row.total, received: sum.received + row.received, pending: sum.pending + row.pending,
    }), { total: 0, received: 0, pending: 0 }), professionals: [] } };
  });
  listPaymentMethods.mockResolvedValue({ data: [{ id: 3, name: "Pix", is_active: true }] });
  axios.get.mockResolvedValue({ data: patients });
  createFinancialEntry.mockResolvedValue({ data: { id: 990 } });
  createFinancialPayment.mockResolvedValue({ data: { id: 991 } });
});
afterEach(() => { cleanup(); jest.useRealTimers(); });

test("link mensal preserva período, autorização pelo servidor e valores visíveis desde a abertura", async () => {
  renderMensalidades();
  await screen.findByText("Maria Silva");
  expect(getFinancialRevenuesSummary).toHaveBeenLastCalledWith("2026-08", "month", { origin: "all", charge_type: "billing_cycle" });
  expect(screen.getByRole("button", { name: "Mensalidade", exact: true })).toHaveAttribute("aria-pressed", "true");
  expect(screen.queryByRole("button", { name: "Todos", exact: true })).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Pacote", exact: true })).toHaveAttribute("aria-pressed", "false");
  expect(screen.getByRole("button", { name: "Avulsa", exact: true })).toHaveAttribute("aria-pressed", "false");
  expect(listBillingCycles).not.toHaveBeenCalled();
  expect(screen.getByText("Maria Silva").closest("tr")).toHaveTextContent("R$ 700,00");
  expect(screen.queryAllByText(/R\$\s*•/)).toHaveLength(0);
  expect(screen.queryByRole("button", { name: /(?:Mostrar|Ocultar) valores financeiros/ }))
    .not.toBeInTheDocument();
});

test("ciclos continuam distintos e sem cobrança não entra na seleção", async () => {
  renderMensalidades(); await openDetail();
  expect(screen.getByText("Recovery")).toBeVisible();
  expect(screen.getByText("Pilates")).toBeVisible();
  expect(screen.getByText("Crédito disponível")).toBeVisible();
  await userEvent.click(screen.getByRole("button", { name: "Registrar recebimento" }));
  expect(screen.getAllByRole("checkbox")).toHaveLength(1);
  expect(screen.getByRole("checkbox")).toBeChecked();
});

test("parcial, vencido, hoje e futuro usam vencimento real sem alterar Data", async () => {
  currentCycles = [makeCycle({ id: 13, patientId: 31, entryId: 902, amountCents: 80000, planName: "Movimento",
    FinancialEntry: makeEntry({ id: 902, patientId: 31, amountCents: 80000, paidCents: 30000, dueDate: "2026-08-10" }) })];
  renderMensalidades(); await openDetail("Bruno Costa");
  const row = screen.getByText("Movimento").closest("tr");
  expect(row).toHaveTextContent("13/08/2026");
  expect(row).toHaveTextContent("10/08/2026");
  expect(within(row).getAllByRole("cell")[2].textContent).toBe("10/08/2026");
  expect(within(row).getAllByRole("cell")[2].childElementCount).toBe(0);
  expect(row).toHaveTextContent("Parcial");
});

test.each(["2026-08-20", "2026-08-31", null])("vencimento %s não inventa atraso ou data", async (dueDate) => {
  currentCycles = [{ ...cycles[0], FinancialEntry: { ...entries[0], due_date: dueDate } }];
  renderMensalidades(); await openDetail();
  const row = screen.getByText("Recovery").closest("tr");
  expect(row).not.toHaveTextContent("em atraso");
  expect(within(row).getAllByRole("cell")[2].textContent).toBe(dueDate ? formatDateOnlyBR(dueDate) : "-");
  expect(within(row).getAllByRole("cell")[2].childElementCount).toBe(0);
});

test("anual permite escolher somente mensalidade mais nova e não seleciona a antiga", async () => {
  currentCycles = [cycles[0], makeCycle({ id: 21, patientId: 30, entryId: 901, amountCents: 70000, planName: "Recovery setembro",
    cycle_start: "2026-09-01", cycle_end: "2026-09-30", FinancialEntry: makeEntry({ id: 999, patientId: 30, amountCents: 48000 }) })];
  renderMensalidades();
  await screen.findByText("Maria Silva");
  await userEvent.click(screen.getByRole("button", { name: "Visão anual" }));
  await waitFor(() => expect(getFinancialRevenuesSummary).toHaveBeenLastCalledWith("2026", "year", expect.any(Object)));
  await openPayment();
  expect(screen.getAllByRole("checkbox")).toHaveLength(2);
  await userEvent.click(screen.getByRole("checkbox", { name: /Recovery setembro/ }));
  await fillPayment("630,00");
  await userEvent.click(screen.getByRole("button", { name: "Confirmar recebimento" }));
  await waitFor(() => expect(createFinancialPayment).toHaveBeenCalledWith(expect.objectContaining({
    amount_cents: 63000, receipt_groups: [{ kind: "billing_cycle", id: 21 }],
    allocations: [{ entry_id: 999, amount_cents: 48000 }],
  }), expect.any(String)));
});

test("sem seleção recebe crédito integral sem desconto e sem âncora", async () => {
  renderMensalidades(); await openPayment();
  await userEvent.click(screen.getByRole("checkbox"));
  await fillPayment("630,00");
  expect(screen.queryByLabelText("Desconto")).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Confirmar recebimento" }));
  await waitFor(() => expect(createFinancialPayment).toHaveBeenCalledWith(expect.objectContaining({
    receipt_intent: "credit_only", allocation_mode: "none", allocations: [], amount_cents: 63000,
  }), expect.any(String)));
  expect(createFinancialEntry).not.toHaveBeenCalled();
});

test("período sem ciclos permite pesquisar paciente e receber somente crédito", async () => {
  currentCycles = [];
  renderMensalidades();
  fireEvent.change(screen.getByLabelText("Pesquisar paciente"), { target: { value: "Fernanda" } });
  await openDetail("Fernanda Sem Ciclo");
  await userEvent.click(screen.getByRole("button", { name: "Registrar recebimento" }));
  expect(screen.queryAllByRole("checkbox")).toHaveLength(0);
  await fillPayment("630,00");
  await userEvent.click(screen.getByRole("button", { name: "Confirmar recebimento" }));
  await waitFor(() => expect(createFinancialPayment).toHaveBeenCalledWith(expect.objectContaining({ patient_id: 35, receipt_intent: "credit_only" }), expect.any(String)));
});

test("desconto parcial preserva alvos e cobrança após recarregar", async () => {
  renderMensalidades(); await openPayment();
  await fillPayment("300,00", "70,00");
  await userEvent.click(screen.getByRole("button", { name: "Confirmar recebimento" }));
  await waitFor(() => expect(createFinancialPayment).toHaveBeenCalledWith(expect.objectContaining({
    amount_cents: 30000, discount_cents: 7000, adjustment_targets: [{ entry_id: 901, open_amount_cents: 70000 }],
    allocations: [{ entry_id: 901, amount_cents: 30000 }],
  }), expect.any(String)));
  expect(await screen.findByText("Recovery")).toBeVisible();
});

test("consulta falha permanece explícita e não habilita recebimento", async () => {
  getFinancialRevenuePatientDetail.mockRejectedValue(new Error("offline"));
  renderMensalidades();
  const row = (await screen.findByText("Maria Silva")).closest("tr");
  await userEvent.click(within(row).getByRole("button", { name: "Detalhes" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Não foi possível");
  expect(screen.getByRole("button", { name: "Registrar recebimento" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Tentar novamente" })).toBeEnabled();
});

test("erro ambíguo conserva modal e chave de repetição", async () => {
  createFinancialPayment.mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce({ data: { id: 991 } });
  renderMensalidades(); await openPayment();
  await fillPayment("700,00");
  await userEvent.click(screen.getByRole("button", { name: "Confirmar recebimento" }));
  await waitFor(() => expect(toast.error).toHaveBeenCalled());
  const key = createFinancialPayment.mock.calls[0][1];
  await userEvent.click(screen.getByRole("button", { name: "Confirmar recebimento" }));
  await waitFor(() => expect(createFinancialPayment).toHaveBeenCalledTimes(2));
  expect(createFinancialPayment.mock.calls[1][1]).toBe(key);
  expect(createFinancialEntry).toHaveBeenCalledTimes(1);
});
