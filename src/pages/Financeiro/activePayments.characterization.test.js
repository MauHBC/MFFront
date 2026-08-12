/* eslint-env jest */
import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { toast } from "react-toastify";

import Financeiro from "./index";
import axios from "../../services/axios";
import {
  createFinancialEntry,
  createFinancialPayment,
  getFinancialRevenuePatientDetail,
  getFinancialRevenuesSummary,
  listBillingCycles,
  listFinancialCategories,
  listFinancialEntries,
  listFinancialPayments,
  listFinancialRecurringExpenses,
  listPatientCredits,
  listPaymentMethods,
  listServicePrices,
} from "../../services/financial";
import { listSpecialSchedulingEvents } from "../../services/scheduling";

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
  getUserFacingApiError: jest.fn((error, fallback) => fallback),
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

const entry = {
  id: 501,
  patient_id: 30,
  session_id: 701,
  service_id: 10,
  type: "income",
  description: "Sessão de fisioterapia",
  amount_cents: 100000,
  reference_date: "2026-08-10",
  status: "partial",
  FinancialPaymentAllocations: [
    { id: 1, entry_id: 501, payment_id: 801, amount_cents: 40000 },
  ],
};

const session = {
  id: 701,
  patient_id: 30,
  service_id: 10,
  series_id: 901,
  starts_at: "2026-08-10T09:00:00.000Z",
  status: "done",
  billing_mode: "per_session",
  Patient: { id: 30, full_name: "Maria Silva" },
  Service: { id: 10, name: "Fisioterapia" },
};

const patientDetail = {
  patient: { id: 30, name: "Maria Silva" },
  month: "2026-08",
  summary: { total: 100000, received: 40000, pending: 60000, creditAvailable: 0 },
  entries: [entry],
  sessions: [session],
  payments: [{
    id: 801,
    patient_id: 30,
    amount_cents: 40000,
    paid_at: "2026-08-11T09:00:00.000Z",
    FinancialPaymentAllocations: entry.FinancialPaymentAllocations,
  }],
  credits: [],
  series: [{
    id: 901,
    patient_id: 30,
    service_id: 10,
    starts_at: "2026-08-10T09:00:00.000Z",
    occurrence_count: 1,
    Service: { id: 10, name: "Fisioterapia" },
  }],
  packages: [{
    id: "series-901",
    sourceId: 901,
    kind: "series",
    series_id: 901,
    service_id: 10,
    service_name: "Fisioterapia",
    reference_date: "2026-08-10T09:00:00.000Z",
    total_sessions: 1,
    used_sessions: 1,
    contracted_amount_cents: 100000,
    amount_cents: 100000,
    paid_cents: 40000,
    open_cents: 60000,
    financial_status: "partial",
    entries: [{ entryId: 501, openCents: 60000 }],
    usage_summary: { scheduled: 0, done: 1, noShow: 0, canceledWithoutCharge: 0 },
    sessions: [session],
  }],
};

const monthlyCycle = {
  id: 11,
  patient_id: 30,
  service_plan_id: 101,
  cycle_start: "2026-08-01",
  cycle_end: "2026-08-31",
  amount_cents: 70000,
  status: "active",
  Patient: { id: 30, full_name: "Maria Silva" },
  ServicePlan: { id: 101, name: "Recovery" },
  FinancialEntry: {
    id: 901,
    patient_id: 30,
    amount_cents: 70000,
    status: "pending",
    installments: [{
      id: 911,
      installment_number: 1,
      amount_cents: 70000,
      paid_amount_cents: 0,
      open_amount_cents: 70000,
      status: "pending",
    }],
  },
};

const renderFinanceiro = (pathname = "/financeiro/receitas") => render(
  <MemoryRouter initialEntries={[pathname]}>
    <Financeiro />
  </MemoryRouter>,
);

describe("Financeiro - caracterização dos recebimentos publicados", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    window.matchMedia = jest.fn().mockReturnValue({
      matches: false,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      addListener: jest.fn(),
      removeListener: jest.fn(),
    });
    getFinancialRevenuesSummary.mockResolvedValue({
      data: {
        month: "2026-08",
        summary: { total: 100000, received: 40000, pending: 60000 },
        patients: [{
          patient_id: 30,
          patient_name: "Maria Silva",
          total: 100000,
          received: 40000,
          pending: 60000,
          entries_count: 1,
        }],
      },
    });
    getFinancialRevenuePatientDetail.mockResolvedValue({ data: patientDetail });
    listFinancialEntries.mockResolvedValue({ data: [entry] });
    listFinancialCategories.mockResolvedValue({ data: [] });
    listPaymentMethods.mockResolvedValue({ data: [{ id: 3, name: "Pix", is_active: true }] });
    listServicePrices.mockResolvedValue({ data: [{ id: 20, service_id: 10, price_cents: 100000 }] });
    listFinancialPayments.mockResolvedValue({ data: patientDetail.payments });
    listPatientCredits.mockResolvedValue({ data: [] });
    listBillingCycles.mockResolvedValue({ data: [monthlyCycle] });
    createFinancialEntry.mockResolvedValue({ data: { id: 990 } });
    createFinancialPayment.mockResolvedValue({ data: { id: 991 } });
    axios.get.mockImplementation((url) => {
      if (url === "/patients") return Promise.resolve({ data: [{ id: 30, full_name: "Maria Silva" }] });
      if (url === "/services") return Promise.resolve({ data: [{ id: 10, name: "Fisioterapia" }] });
      if (url === "/session-series") return Promise.resolve({ data: patientDetail.series });
      if (url === "/sessions") return Promise.resolve({ data: [session] });
      return Promise.resolve({ data: [] });
    });
  });

  it("recebe por sessão com desconto, aloca e cria a standalone payment anchor", async () => {
    renderFinanceiro();
    expect(await screen.findByText("Maria Silva")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Detalhes" }));
    expect(await screen.findByRole("button", { name: "Registrar recebimento" })).toBeInTheDocument();
    expect(await screen.findByText("Fisioterapia")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Registrar recebimento" }));

    fireEvent.change(await screen.findByLabelText("Forma de pagamento"), { target: { value: "3" } });
    fireEvent.change(screen.getByLabelText("Valor recebido"), { target: { value: "500,00" } });
    fireEvent.change(screen.getByLabelText("Desconto"), { target: { value: "100,00" } });
    fireEvent.change(screen.getByLabelText("Data do recebimento"), { target: { value: "2026-08-15" } });
    await userEvent.click(screen.getByRole("button", { name: "Confirmar recebimento" }));

    expect(toast.error).not.toHaveBeenCalled();

    await waitFor(() => expect(createFinancialEntry).toHaveBeenCalledWith({
      type: "income",
      description: "Recebimento por sessão (sistema)",
      patient_id: 30,
      amount_cents: 0,
      currency: "BRL",
      reference_date: "2026-08-15",
      due_date: "2026-08-15",
      notes: "Entrada técnica automática para viabilizar recebimento por sessão.",
    }));
    await waitFor(() => expect(createFinancialPayment).toHaveBeenCalledWith(expect.objectContaining({
      entry_id: 990,
      patient_id: 30,
      payment_method_id: 3,
      amount_cents: 50000,
      allocation_mode: "manual",
      allocations: [{ entry_id: 501, amount_cents: 50000 }],
      discount_cents: 10000,
    })));
  });

  it("recebe mensalidade pelo mesmo contrato de anchor e alocação", async () => {
    renderFinanceiro();
    await userEvent.click(await screen.findByRole("button", { name: "Mensalidades" }));
    expect(await screen.findByText("Maria Silva")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Detalhes" }));
    expect(await screen.findByText("Recovery")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Registrar recebimento" }));

    fireEvent.change(await screen.findByLabelText("Forma de pagamento"), { target: { value: "3" } });
    fireEvent.change(screen.getByLabelText("Data do recebimento"), { target: { value: "2026-08-15" } });
    await userEvent.click(screen.getByRole("button", { name: "Confirmar recebimento" }));

    await waitFor(() => expect(createFinancialEntry).toHaveBeenCalled());
    await waitFor(() => expect(createFinancialPayment).toHaveBeenCalledWith(expect.objectContaining({
      entry_id: 990,
      patient_id: 30,
      payment_method_id: 3,
      amount_cents: 70000,
      allocation_mode: "manual",
      allocations: [{ entry_id: 901, amount_cents: 70000 }],
    })));
  });

  it("mantém lote, conversão em parcelas e Recebimentos dedicado fora da UI publicada", async () => {
    renderFinanceiro();
    await screen.findByText("Maria Silva");

    expect(screen.queryByRole("button", { name: "Recebimentos" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Desconto por sessão")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Parcelamento da cobrança")).not.toBeInTheDocument();
    expect(createFinancialPayment).not.toHaveBeenCalled();
    expect(listFinancialRecurringExpenses).not.toHaveBeenCalled();
    expect(listSpecialSchedulingEvents).not.toHaveBeenCalled();
  });
});
