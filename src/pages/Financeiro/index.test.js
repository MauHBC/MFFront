/* eslint-env jest */
import "@testing-library/jest-dom";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { Provider } from "react-redux";
import { createStore } from "redux";
import { toast } from "react-toastify";

import Financeiro from "./index";
import axios from "../../services/axios";
import { getReceivedPaid, getDistributionConfiguration } from "../../services/financialReceivedPaid";
import {
  applyScopedFinancialCredit,
  getClinicExpenseAlerts,
  getFinancialOverview,
  getFinancialRevenuePatientDetail,
  getFinancialRevenuesSummary,
  listBillingCycles,
  listFinancialEntries,
  listFinancialPayments,
  listPatientCredits,
} from "../../services/financial";

let mockAuthorization;
jest.mock("../../contexts/AuthorizationContext", () => ({
  useAuthorization: () => mockAuthorization,
}));
jest.mock("../../services/financialReceivedPaid", () => ({
  getReceivedPaid: jest.fn(),
  getDistributionConfiguration: jest.fn(),
  saveDistributionConfiguration: jest.fn(),
}));

jest.mock("react-toastify", () => ({
  toast: {
    error: jest.fn(),
    success: jest.fn(),
  },
}));

jest.mock("../../services/axios", () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
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

const renderFinanceiro = (pathname = "/financeiro/receitas") => render(
  <Provider store={createStore(() => ({ auth: { token: "local-test-session" } }))}>
    <MemoryRouter initialEntries={[pathname]}>
      <Financeiro />
    </MemoryRouter>
  </Provider>,
);

const revealFinancialValues = async () => {
  await userEvent.click(screen.getByRole("button", { name: "Mostrar valores financeiros" }));
};

const emptyOverview = {
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
};
const buildOverviewMonths = (year = "2026", overrides = {}) => (
  Array.from({ length: 12 }, (_, index) => ({
    month: `${year}-${String(index + 1).padStart(2, "0")}`,
    ...emptyOverview,
    ...(overrides[index + 1] || {}),
  }))
);
const cashReport = (year = "2026") => ({
  year: Number(year),
  months: Array.from({ length: 12 }, (_, index) => ({
    month: `${year}-${String(index + 1).padStart(2, "0")}`,
    received_cents: index === 10 ? 20000 : 0,
    paid_cents: 0,
    realized_result_cents: index === 10 ? 20000 : 0,
    distribution: null,
  })),
  totals: { received_cents: 20000, paid_cents: 0, realized_result_cents: 20000 },
  distribution: null,
});
const summaryField = (container, field) => container.querySelector(`[data-summary-field="${field}"]`);

const expectChargeTableStructure = (serviceName, expectedCells) => {
  const row = screen.getByText(serviceName).closest("tr");
  const table = row.closest("table");

  expect(within(table).getAllByRole("columnheader").map((header) => header.textContent.trim()))
    .toEqual([
      "Data",
      "Serviço",
      "Sessões",
      "Valor",
      "Recebido",
      "A receber",
      "Pagamento",
      "Ações",
    ]);

  const cells = within(row).getAllByRole("cell");
  expect(cells).toHaveLength(8);
  expect(cells.map((cell) => cell.textContent.replace(/\s+/g, " ").trim()))
    .toEqual(expectedCells);
};

const RealDate = Date;
const fixedFinanceiroTestDate = new RealDate("2026-06-15T12:00:00-03:00");

class FixedFinanceiroTestDate extends RealDate {
  constructor(...args) {
    if (args.length === 0) {
      super(fixedFinanceiroTestDate.getTime());
      return;
    }

    super(...args);
  }

  static now() {
    return fixedFinanceiroTestDate.getTime();
  }
}

describe("Financeiro - detalhe de receitas por paciente", () => {
  beforeEach(() => {
    Object.defineProperty(globalThis, "Date", {
      configurable: true,
      writable: true,
      value: FixedFinanceiroTestDate,
    });
    jest.clearAllMocks();
    mockAuthorization = {
      isAdministrator: false,
      context: { clinic_id: 1 },
      reload: jest.fn(),
      canAccessModule: () => false,
      hasCapability: () => false,
    };
    getReceivedPaid.mockImplementation((year) => Promise.resolve({ data: cashReport(year) }));
    getDistributionConfiguration.mockResolvedValue({
      data: { configured: false, revision: 0, current_rule: null, pending_rule: null },
    });
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: jest.fn().mockImplementation((query) => ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        addListener: jest.fn(),
        removeListener: jest.fn(),
        dispatchEvent: jest.fn(),
      })),
    });
    axios.get.mockResolvedValue({ data: [] });
    getClinicExpenseAlerts.mockResolvedValue({ data: { dueSoonCount: 0 } });
    getFinancialOverview.mockImplementation((period, mode) => Promise.resolve({
      data: {
        ...emptyOverview,
        ...(mode === "year" ? { year: period, months: buildOverviewMonths(period) } : { month: period }),
      },
    }));
    getFinancialRevenuesSummary.mockResolvedValue({
      data: {
        month: "2026-06",
        summary: {
          total: 100000,
          received: 40000,
          pending: 60000,
        },
        patients: [
          {
            patient_id: 30,
            patient_name: "Maria Silva",
            total: 100000,
            received: 40000,
            pending: 60000,
            entries_count: 1,
          },
        ],
      },
    });
    getFinancialRevenuePatientDetail.mockResolvedValue({
      data: {
        patient: { id: 30, name: "Maria Silva" },
        month: "2026-06",
        summary: {
          total: 100000,
          received: 40000,
          pending: 60000,
          creditAvailable: 15000,
        },
        entries: [
          {
            id: 501,
            clinic_id: 1,
            patient_id: 30,
            session_id: 701,
            service_id: 10,
            type: "income",
            description: "Sessao de fisioterapia",
            amount_cents: 100000,
            reference_date: "2026-06-10",
            status: "partial",
          },
        ],
        sessions: [
          {
            id: 701,
            clinic_id: 1,
            patient_id: 30,
            service_id: 10,
            series_id: 901,
            starts_at: "2026-06-10T09:00:00.000Z",
            status: "done",
            billing_mode: "per_session",
            Patient: { id: 30, full_name: "Maria Silva" },
            Service: { id: 10, name: "Fisioterapia" },
          },
        ],
        payments: [
          {
            id: 801,
            clinic_id: 1,
            patient_id: 30,
            amount_cents: 40000,
            paid_at: "2026-06-11T09:00:00.000Z",
            note: "Pagamento parcial",
            FinancialPaymentAllocations: [
              {
                id: 1,
                entry_id: 501,
                payment_id: 801,
                amount_cents: 40000,
              },
            ],
          },
        ],
        credits: [],
        series: [
          {
            id: 901,
            clinic_id: 1,
            patient_id: 30,
            service_id: 10,
            starts_at: "2026-06-10T09:00:00.000Z",
            occurrence_count: 1,
            Service: { id: 10, name: "Fisioterapia" },
          },
        ],
      },
    });
    listBillingCycles.mockResolvedValue({ data: [] });
    applyScopedFinancialCredit.mockResolvedValue({ data: {} });
  });

  it("consulta contas mensais e anuais com parâmetros exclusivos e a mesma base no gráfico", async () => {
    getFinancialOverview.mockImplementation((period, mode) => Promise.resolve({
      data: mode === "year"
        ? {
          year: period, incomeTotal: 300000, expenseTotal: 75000, periodResult: 225000,
          hasAccounts: true, received: 160000, receivable: 140000,
          paidExpenses: 50000, pendingExpenses: 25000, currentResult: 110000, pendingBalance: 115000,
          months: buildOverviewMonths(period, {
            1: { incomeTotal: 100000, expenseTotal: 25000, periodResult: 75000, hasAccounts: true,
              received: 100000, paidExpenses: 25000, currentResult: 75000 },
            2: { incomeTotal: 150000, expenseTotal: 50000, periodResult: 100000, hasAccounts: true,
              received: 10000, receivable: 140000, paidExpenses: 25000, pendingExpenses: 25000,
              currentResult: -15000, pendingBalance: 115000 },
            3: { incomeTotal: 50000, periodResult: 50000, hasAccounts: true, received: 50000, currentResult: 50000 },
          }),
        }
        : { month: period, incomeTotal: 30000, expenseTotal: 7000, periodResult: 23000,
          hasAccounts: true, received: 10000, receivable: 20000, paidExpenses: 3000,
          pendingExpenses: 4000, currentResult: 7000, pendingBalance: 16000 },
    }));
    const { container } = renderFinanceiro("/financeiro/visao-geral");
    await revealFinancialValues();
    expect(await screen.findByText("Contas do mês")).toBeInTheDocument();
    expect(getFinancialOverview).toHaveBeenCalledWith("2026-06", "month");
    expect(summaryField(container, "incomeTotal")).toHaveTextContent("R$ 300,00");
    expect(summaryField(container, "periodResult")).toHaveTextContent("R$ 230,00");

    await userEvent.click(screen.getByRole("button", { name: "Anual" }));
    expect(await screen.findByText("Contas do ano")).toBeInTheDocument();
    expect(getFinancialOverview).toHaveBeenCalledWith("2026", "year");
    expect(summaryField(container, "incomeTotal")).toHaveTextContent("R$ 3.000,00");
    expect(summaryField(container, "received")).toHaveTextContent("R$ 1.600,00");
    expect(summaryField(container, "receivable")).toHaveTextContent("R$ 1.400,00");
    expect(summaryField(container, "periodResult")).toHaveTextContent("R$ 2.250,00");
    expect(screen.getByRole("img", { name: "Saldo das contas por mês" })).toBeInTheDocument();
    const table = screen.getByRole("table", { name: "Contas por mês" });
    expect(within(table).getAllByRole("row")).toHaveLength(14);
    const february = table.querySelector('[data-month="2026-02"]');
    expect(february.querySelector('[data-field="incomeTotal"]')).toHaveTextContent("R$ 1.500,00");
    expect(february.querySelector('[data-field="expenseTotal"]')).toHaveTextContent("R$ 500,00");
    expect(february.querySelector('[data-field="periodResult"]')).toHaveTextContent("R$ 1.000,00");
    expect(container.querySelector('rect[data-month="2026-02"]')).toHaveAttribute("data-value-cents", "100000");
    expect(container.querySelector('text[data-month="2026-02"]')).toHaveAttribute("data-value-cents", "100000");
    await userEvent.click(screen.getByRole("button", { name: "Mensal" }));
    expect(await screen.findByText("Contas do mês")).toBeInTheDocument();
    expect(getFinancialOverview).toHaveBeenLastCalledWith("2026-06", "month");
  });

  it("preserva os períodos mensal e anual ao navegar entre anos", async () => {
    renderFinanceiro("/financeiro/visao-geral");
    await screen.findByText("Contas do mês");
    await userEvent.click(screen.getByRole("button", { name: "Próximo >" }));
    await waitFor(() => expect(getFinancialOverview).toHaveBeenLastCalledWith("2026-07", "month"));
    await userEvent.click(screen.getByRole("button", { name: "Anual" }));
    await screen.findByText("Contas do ano");
    await userEvent.click(screen.getByRole("button", { name: "Próximo ano >" }));
    await waitFor(() => expect(getFinancialOverview).toHaveBeenLastCalledWith("2027", "year"));
    await userEvent.click(screen.getByRole("button", { name: "Mensal" }));
    await screen.findByText("Contas do mês");
    expect(getFinancialOverview).toHaveBeenLastCalledWith("2026-07", "month");
    expect(screen.getByLabelText("Selecionar mês e ano do Resumo")).toHaveValue("2026-07");
    expect(screen.queryByLabelText("Selecionar ano do Resumo")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Anual" }));
    await screen.findByText("Contas do ano");
    expect(getFinancialOverview).toHaveBeenLastCalledWith("2027", "year");
    expect(screen.getByLabelText("Selecionar ano do Resumo")).toHaveValue("2027");
  });

  it("clicar novamente na aba ou no período ativo mantém os dados sem prender carregamento", async () => {
    renderFinanceiro("/financeiro/visao-geral");
    await screen.findByText("Contas do mês");
    await userEvent.click(screen.getByRole("tab", { name: "Resumo" }));
    await userEvent.click(screen.getByRole("button", { name: "Mensal" }));
    expect(screen.getByText("Contas do mês")).toBeInTheDocument();
    expect(screen.queryByText("Carregando contas do período...")).not.toBeInTheDocument();
    expect(getFinancialOverview).toHaveBeenCalledTimes(1);
    await userEvent.click(screen.getByRole("button", { name: "Anual" }));
    await screen.findByText("Contas do ano");
    await userEvent.click(screen.getByRole("button", { name: "Anual" }));
    expect(screen.getByText("Contas do ano")).toBeInTheDocument();
    expect(screen.queryByText("Carregando contas do período...")).not.toBeInTheDocument();
    expect(getFinancialOverview).toHaveBeenCalledTimes(2);
  });

  it("ignora resposta atrasada de um modo anterior sem apresentar zero durante carregamento", async () => {
    let resolveAnnual;
    const annualRequest = new Promise((resolve) => { resolveAnnual = resolve; });
    getFinancialOverview.mockImplementation((period, mode) => mode === "year" ? annualRequest : Promise.resolve({
      data: { ...emptyOverview, month: period, hasAccounts: true, incomeTotal: 11000, periodResult: 11000, received: 11000, currentResult: 11000 },
    }));
    const { container } = renderFinanceiro("/financeiro/visao-geral");
    await revealFinancialValues();
    await screen.findByText("Contas do mês");
    expect(summaryField(container, "incomeTotal")).toHaveTextContent("R$ 110,00");
    await userEvent.click(screen.getByRole("button", { name: "Anual" }));
    expect(screen.getByText("Carregando contas do período...")).toBeInTheDocument();
    expect(summaryField(container, "incomeTotal")).toBeNull();
    expect(screen.queryByText("Nenhuma conta encontrada para este ano.")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Mensal" }));
    await screen.findByText("Contas do mês");
    await act(async () => resolveAnnual({ data: { ...emptyOverview, year: "2026", incomeTotal: 999000, periodResult: 999000, hasAccounts: true, received: 999000, currentResult: 999000, months: buildOverviewMonths() } }));
    expect(summaryField(container, "incomeTotal")).toHaveTextContent("R$ 110,00");
    expect(screen.queryByText("R$ 9.990,00")).not.toBeInTheDocument();
  });

  it("apresenta erro de consulta anual sem transformá-lo em ausência ou zero", async () => {
    getFinancialOverview.mockImplementation((period, mode) => mode === "year"
      ? Promise.reject(new Error("annual failure"))
      : Promise.resolve({ data: { ...emptyOverview, month: period } }));
    const { container } = renderFinanceiro("/financeiro/visao-geral");
    await revealFinancialValues();
    await screen.findByText("Contas do mês");
    await userEvent.click(screen.getByRole("button", { name: "Anual" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Não foi possível carregar");
    expect(toast.error).toHaveBeenCalledWith("Não foi possível carregar a visão geral financeira.");
    expect(screen.queryByText("Nenhuma conta encontrada para este ano.")).not.toBeInTheDocument();
    expect(summaryField(container, "incomeTotal")).toBeNull();
  });

  it.each(["incomeTotal", "expenseTotal", "periodResult", "hasAccounts", "received", "receivable", "paidExpenses", "pendingExpenses"])("rejeita contrato sem %s, sem inferir valor zero", async (field) => {
    const payload = { ...emptyOverview, month: "2026-06" };
    delete payload[field];
    getFinancialOverview.mockResolvedValue({ data: payload });
    const { container } = renderFinanceiro("/financeiro/visao-geral");
    await revealFinancialValues();
    expect(await screen.findByRole("alert")).toHaveTextContent("Não foi possível carregar");
    expect(summaryField(container, "incomeTotal")).toBeNull();
    expect(screen.queryByText("Nenhuma conta encontrada para este mês.")).not.toBeInTheDocument();
  });

  it("distingue zero explícito de nenhuma conta e preserva o resumo anual se months for inválido", async () => {
    getFinancialOverview.mockImplementation((period, mode) => Promise.resolve({
      data: mode === "year"
        ? { ...emptyOverview, year: period, incomeTotal: 50000, expenseTotal: 20000, periodResult: 30000, hasAccounts: true,
          received: 50000, paidExpenses: 20000, currentResult: 30000, months: [{ month: `${period}-01`, periodResult: 30000 }] }
        : { ...emptyOverview, month: period },
    }));
    const { container } = renderFinanceiro("/financeiro/visao-geral");
    await revealFinancialValues();
    expect(await screen.findByText("Nenhuma conta encontrada para este mês.")).toBeInTheDocument();
    expect(summaryField(container, "incomeTotal")).toHaveTextContent("R$ 0,00");
    await userEvent.click(screen.getByRole("button", { name: "Anual" }));
    expect(await screen.findByText("Contas do ano")).toBeInTheDocument();
    expect(summaryField(container, "incomeTotal")).toHaveTextContent("R$ 500,00");
    expect(screen.getByRole("alert")).toHaveTextContent("Não foi possível carregar as contas por mês deste ano.");
    expect(screen.queryByRole("table", { name: "Contas por mês" })).not.toBeInTheDocument();
  });

  it("mostra pacote futuro de R$400 em outubro e zero em novembro no mensal, anual e gráfico", async () => {
    const packageAccounts = { ...emptyOverview, incomeTotal: 40000, periodResult: 40000, receivable: 40000, pendingBalance: 40000, hasAccounts: true };
    getFinancialOverview.mockImplementation((period, mode) => Promise.resolve({ data: mode === "year"
      ? { ...(period === "2026" ? packageAccounts : emptyOverview), year: period,
        months: buildOverviewMonths(period, period === "2026" ? { 10: packageAccounts } : {}) }
      : { ...(period === "2026-10" ? packageAccounts : emptyOverview), month: period },
    }));
    const { container } = renderFinanceiro("/financeiro/visao-geral");
    await revealFinancialValues();
    fireEvent.change(screen.getByLabelText("Selecionar mês e ano do Resumo"), { target: { value: "2026-10" } });
    await waitFor(() => expect(summaryField(container, "incomeTotal")).toHaveTextContent("R$ 400,00"));
    expect(summaryField(container, "received")).toHaveTextContent("R$ 0,00");
    fireEvent.change(screen.getByLabelText("Selecionar mês e ano do Resumo"), { target: { value: "2026-11" } });
    await waitFor(() => expect(summaryField(container, "incomeTotal")).toHaveTextContent("R$ 0,00"));
    await userEvent.click(screen.getByRole("button", { name: "Anual" }));
    const table = await screen.findByRole("table", { name: "Contas por mês" });
    expect(table.querySelector('[data-month="2026-10"] [data-field="incomeTotal"]')).toHaveTextContent("R$ 400,00");
    expect(table.querySelector('[data-month="2026-11"] [data-field="incomeTotal"]')).toHaveTextContent("R$ 0,00");
    expect(container.querySelector('rect[data-month="2026-10"]')).toHaveAttribute("data-value-cents", "40000");
    expect(table.querySelector('[data-annual-total="true"] [data-field="incomeTotal"]')).toHaveTextContent("R$ 400,00");
    await userEvent.click(screen.getByRole("button", { name: "Próximo ano >" }));
    await waitFor(() => expect(summaryField(container, "incomeTotal")).toHaveTextContent("R$ 0,00"));
    expect(getFinancialOverview).toHaveBeenLastCalledWith("2027", "year");
  });

  it("alterna três abas preservando períodos e separa conta de outubro do recebimento em novembro", async () => {
    mockAuthorization = { ...mockAuthorization, isAdministrator: true };
    const october = { ...emptyOverview, incomeTotal: 20000, periodResult: 20000, received: 20000, currentResult: 20000, hasAccounts: true };
    getFinancialOverview.mockImplementation((period, mode) => Promise.resolve({ data: mode === "year"
      ? { ...october, year: period, months: buildOverviewMonths(period, { 10: october }) }
      : { ...(period === "2026-10" ? october : emptyOverview), month: period },
    }));
    const { container } = renderFinanceiro("/financeiro/visao-geral");
    await revealFinancialValues();
    expect(screen.getAllByRole("tab").map((tab) => tab.textContent)).toEqual(["Resumo", "Recebido e pago", "Distribuição"]);
    fireEvent.change(screen.getByLabelText("Selecionar mês e ano do Resumo"), { target: { value: "2026-10" } });
    await waitFor(() => expect(summaryField(container, "incomeTotal")).toHaveTextContent("R$ 200,00"));
    expect(summaryField(container, "received")).toHaveTextContent("LiquidadoR$ 200,00");
    expect(summaryField(container, "receivable")).toHaveTextContent("R$ 0,00");
    await userEvent.click(screen.getByRole("tab", { name: "Recebido e pago" }));
    const cash = await screen.findByRole("table", { name: "Recebido e pago por mês" });
    expect(within(cash).getByRole("row", { name: /Novembro/ })).toHaveTextContent("R$ 200,00");
    expect(within(cash).getByRole("row", { name: /Outubro/ })).not.toHaveTextContent("R$ 200,00");
    expect(getDistributionConfiguration).not.toHaveBeenCalled();
    expect(screen.queryByRole("heading", { name: "Distribuição do resultado" })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("tab", { name: "Distribuição" }));
    expect(await screen.findByRole("button", { name: "Configurar distribuição" })).toBeInTheDocument();
    expect(getDistributionConfiguration).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("table", { name: "Recebido e pago por mês" })).not.toBeInTheDocument();
    expect(getReceivedPaid.mock.calls.map(([year]) => year)).toEqual(["2026", "2026"]);
    await userEvent.click(screen.getByRole("button", { name: "Próximo ano >" }));
    await waitFor(() => expect(getReceivedPaid).toHaveBeenLastCalledWith("2027", expect.any(AbortSignal)));
    await userEvent.click(screen.getByRole("tab", { name: "Recebido e pago" }));
    await screen.findByRole("table", { name: "Recebido e pago por mês" });
    expect(screen.getByLabelText("Selecionar ano de Recebido e pago")).toHaveValue("2027");
    await userEvent.click(screen.getByRole("tab", { name: "Resumo" }));
    await screen.findByText("Contas do mês");
    expect(screen.getByLabelText("Selecionar mês e ano do Resumo")).toHaveValue("2026-10");
    expect(summaryField(container, "incomeTotal")).toHaveTextContent("R$ 200,00");
    await userEvent.click(screen.getByRole("button", { name: "Anual" }));
    await screen.findByText("Contas do ano");
    expect(screen.getByLabelText("Selecionar ano do Resumo")).toHaveValue("2027");
  });

  it("usuário financeiro sem Administrador não vê nem consulta caixa e distribuição", async () => {
    mockAuthorization = { ...mockAuthorization, canAccessModule: () => true, hasCapability: () => true };
    renderFinanceiro("/financeiro/visao-geral");
    await screen.findByText("Contas do mês");
    expect(screen.getAllByRole("tab").map((tab) => tab.textContent)).toEqual(["Resumo"]);
    expect(getReceivedPaid).not.toHaveBeenCalled();
    expect(getDistributionConfiguration).not.toHaveBeenCalled();
  });

  it("abre Configurações em Formas de pagamento e preserva links diretos das abas", async () => {
    renderFinanceiro("/financeiro/configuracoes");

    expect(screen.getByRole("heading", { name: "Configurações" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Formas de pagamento" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByRole("tab", { name: "Categorias de despesas" })).toHaveAttribute(
      "href",
      "/financeiro/configuracoes/categorias-despesas",
    );
    expect(screen.queryByRole("navigation", { name: "Seções do Financeiro" })).not.toBeInTheDocument();
    expect(await screen.findByText("Nova forma")).toBeInTheDocument();
  });

  it("abre diretamente Categorias de despesas e mantém a aba correta após refresh", async () => {
    renderFinanceiro("/financeiro/configuracoes/categorias-despesas");

    expect(screen.getByRole("tab", { name: "Categorias de despesas" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByRole("tab", { name: "Formas de pagamento" })).toHaveAttribute(
      "aria-selected",
      "false",
    );
    expect(await screen.findByText("Nova categoria")).toBeInTheDocument();
  });

  afterEach(() => {
    Object.defineProperty(globalThis, "Date", {
      configurable: true,
      writable: true,
      value: RealDate,
    });
    jest.useRealTimers();
  });

  it("usa patient-detail ao clicar em Detalhes sem carregar listas pesadas", async () => {
    renderFinanceiro();

    expect(screen.getByRole("button", { name: "Mostrar valores financeiros" })).toBeInTheDocument();
    await revealFinancialValues();

    await screen.findByText("Maria Silva");
    await userEvent.click(screen.getByRole("button", { name: "Detalhes" }));

    await waitFor(() => {
      expect(getFinancialRevenuePatientDetail).toHaveBeenCalledTimes(1);
    });

    const [patientId, month] = getFinancialRevenuePatientDetail.mock.calls[0];
    expect(patientId).toBe("30");
    expect(month).toMatch(/^\d{4}-\d{2}$/);
    expect(listFinancialEntries).not.toHaveBeenCalled();
    expect(listFinancialPayments).not.toHaveBeenCalled();
    expect(listPatientCredits).not.toHaveBeenCalled();
    expect(axios.get).not.toHaveBeenCalledWith("/sessions", expect.anything());

    expect(await screen.findByText("Fisioterapia")).toBeInTheDocument();
    expect(screen.getAllByText("R$ 600,00").length).toBeGreaterThan(0);

    await userEvent.click(screen.getByRole("button", { name: "Recebimentos" }));

    expect(screen.getByText("Pagamento parcial")).toBeInTheDocument();
    expect(within(screen.getByText("Pagamento parcial").closest("tr")).getByText("R$ 400,00"))
      .toBeInTheDocument();
  });

  it("simplifica a lista por sessão e mantém data, pagamento, crédito e valores do período", async () => {
    renderFinanceiro();
    await revealFinancialValues();

    const patientCell = await screen.findByText("Maria Silva");
    const patientRow = patientCell.closest("tr");
    const table = patientRow.closest("table");

    expect(within(table).getAllByRole("columnheader").map((header) => header.textContent.trim()))
      .toEqual(["Paciente", "Data", "A receber", "Pagamento", "Ações"]);
    expect(within(table).queryByRole("columnheader", { name: "Valor" })).not.toBeInTheDocument();
    expect(within(table).queryByRole("columnheader", { name: "Recebido" })).not.toBeInTheDocument();
    expect(within(table).queryByRole("columnheader", { name: "Crédito" })).not.toBeInTheDocument();
    expect(within(patientRow).getByText("10/06/2026")).toBeInTheDocument();
    expect(within(patientRow).getByText("Vencida há 5 dias")).toBeInTheDocument();
    expect(within(patientRow).getByText("R$ 600,00")).toBeInTheDocument();
    expect(within(patientRow).getByText("Parcial")).toBeInTheDocument();
    expect(within(patientRow).getByText("Crédito disponível: R$ 150,00")).toBeInTheDocument();

    await userEvent.click(within(patientRow).getByRole("button", { name: "Detalhes" }));
    const detailRow = (await screen.findByText("Fisioterapia")).closest("tr");
    expect(within(detailRow).getByText("10/06/2026")).toBeInTheDocument();
    expect(within(detailRow).getByText("Vencida há 5 dias")).toBeInTheDocument();
    expect(within(detailRow).getByText("R$ 1.000,00")).toBeInTheDocument();
    expect(within(detailRow).getByText("R$ 400,00")).toBeInTheDocument();
    expect(within(detailRow).getByText("R$ 600,00")).toBeInTheDocument();
    expect(within(detailRow).getByText("Parcial")).toBeInTheDocument();
    expect(within(detailRow.closest("table")).getByRole("columnheader", { name: "Pagamento" }))
      .toBeInTheDocument();
  });

  it("usa a menor data aberta do mês e não deixa item pago mais antigo prevalecer", async () => {
    getFinancialRevenuesSummary.mockResolvedValueOnce({
      data: {
        month: "2026-06",
        summary: { total: 180000, received: 60000, pending: 120000 },
        patients: [{
          patient_id: 30,
          patient_name: "Maria Silva",
          total: 180000,
          received: 60000,
          pending: 120000,
          entries_count: 3,
        }],
      },
    });
    getFinancialRevenuePatientDetail.mockResolvedValueOnce({
      data: {
        patient: { id: 30, name: "Maria Silva" },
        month: "2026-06",
        summary: { total: 180000, received: 60000, pending: 120000, creditAvailable: 0 },
        entries: [],
        sessions: [],
        payments: [],
        credits: [],
        series: [],
        packages: [
          { series_id: 1, reference_date: "2026-06-02", open_cents: 0 },
          { series_id: 2, reference_date: "2026-06-10", open_cents: 40000 },
          { series_id: 3, reference_date: "2026-06-20", open_cents: 80000 },
        ],
      },
    });

    renderFinanceiro();

    const patientRow = (await screen.findByText("Maria Silva")).closest("tr");
    expect(within(patientRow).getByText("10/06/2026")).toBeInTheDocument();
    expect(within(patientRow).getByText("Vencida há 5 dias")).toBeInTheDocument();
    expect(within(patientRow).queryByText("02/06/2026")).not.toBeInTheDocument();
    expect(within(patientRow).getByText("Parcial")).toBeInTheDocument();
  });

  it("mantém o recorte anual ao escolher a menor data aberta e tolera ausência de data", async () => {
    getFinancialRevenuesSummary.mockImplementation((period, mode) => Promise.resolve({
      data: mode === "year"
        ? {
          year: period,
          summary: { total: 150000, received: 50000, pending: 100000 },
          patients: [
            {
              patient_id: 30,
              patient_name: "Maria Silva",
              total: 100000,
              received: 50000,
              pending: 50000,
              entries_count: 2,
            },
            {
              patient_id: 31,
              patient_name: "Bruno Costa",
              total: 50000,
              received: 0,
              pending: 50000,
              entries_count: 1,
            },
          ],
        }
        : {
          month: period,
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
    }));
    getFinancialRevenuePatientDetail.mockImplementation((patientId, period, mode) => Promise.resolve({
      data: mode === "year" && String(patientId) === "30"
        ? {
          patient: { id: 30, name: "Maria Silva" },
          year: period,
          summary: { creditAvailable: 0 },
          packages: [
            { series_id: 1, reference_date: "2026-01-05", open_cents: 0 },
            { series_id: 2, reference_date: "2026-02-15", open_cents: 50000 },
          ],
        }
        : {
          patient: { id: Number(patientId), name: String(patientId) === "31" ? "Bruno Costa" : "Maria Silva" },
          summary: { creditAvailable: 0 },
          entries: [],
          sessions: [],
          series: [],
          packages: [],
        },
    }));

    renderFinanceiro();
    await userEvent.click(screen.getByRole("button", { name: "Visão anual" }));

    const mariaRow = (await screen.findByText("Maria Silva")).closest("tr");
    const brunoRow = (await screen.findByText("Bruno Costa")).closest("tr");
    expect(within(mariaRow).getByText("15/02/2026")).toBeInTheDocument();
    expect(within(mariaRow).getByText("Vencida há 120 dias")).toBeInTheDocument();
    expect(within(brunoRow).getByText("-")).toBeInTheDocument();
    expect(getFinancialRevenuesSummary).toHaveBeenCalledWith("2026", "year");
    expect(getFinancialRevenuePatientDetail).toHaveBeenCalledWith("30", "2026", "year");
    expect(getFinancialRevenuePatientDetail).toHaveBeenCalledWith("31", "2026", "year");
  });

  it("usa credito disponivel do backend no detalhe do paciente", async () => {
    getFinancialRevenuePatientDetail.mockResolvedValueOnce({
      data: {
        patient: { id: 30, name: "Maria Silva" },
        month: "2026-06",
        summary: {
          total: 75000,
          received: 62000,
          pending: 13000,
          creditAvailable: 10000,
        },
        entries: [
          {
            id: 745,
            clinic_id: 1,
            patient_id: 30,
            session_id: 880,
            service_id: 12,
            type: "income",
            description: "Atendimento - Fisioterapia",
            amount_cents: 75000,
            reference_date: "2026-06-12",
            status: "partial",
          },
        ],
        sessions: [
          {
            id: 880,
            clinic_id: 1,
            patient_id: 30,
            service_id: 12,
            starts_at: "2026-06-12T09:00:00.000Z",
            status: "scheduled",
            billing_mode: "per_session",
            Service: { id: 12, name: "Fisioterapia" },
          },
        ],
        payments: [],
        credits: [],
        series: [],
        packages: [],
      },
    });

    renderFinanceiro();

    await revealFinancialValues();
    await screen.findByText("Maria Silva");
    await userEvent.click(screen.getByRole("button", { name: "Detalhes" }));

    expect(await screen.findByText("Crédito disponível")).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Usar crédito" })).toBeInTheDocument();
      expect(screen.getAllByText("R$ 100,00").length).toBeGreaterThan(0);
    });
  });

  it("usa financeiro agregado do pacote retornado pelo patient-detail", async () => {
    getFinancialRevenuePatientDetail.mockResolvedValueOnce({
      data: {
        patient: { id: 30, name: "Maria Silva" },
        month: "2026-06",
        summary: {
          total: 0,
          received: 0,
          pending: 0,
          creditAvailable: 0,
        },
        entries: [],
        sessions: [],
        payments: [],
        credits: [],
        series: [
          {
            id: 901,
            clinic_id: 1,
            patient_id: 30,
            service_id: 10,
            starts_at: "2026-06-10T09:00:00.000Z",
            occurrence_count: 9,
            Service: { id: 10, name: "Fisioterapia" },
          },
        ],
        packages: [
          {
            id: "series-901",
            sourceId: 901,
            kind: "series",
            series_id: 901,
            service_id: 10,
            service_name: "Fisioterapia",
            reference_date: "2026-06-10T09:00:00.000Z",
            total_sessions: 9,
            used_sessions: 5,
            contracted_amount_cents: 105000,
            amount_cents: 105000,
            paid_cents: 15000,
            open_cents: 90000,
            financial_status: "partial",
            entries: [{ entryId: 744, openCents: 90000 }],
            usage_summary: {
              scheduled: 3,
              done: 5,
              noShow: 0,
              canceledWithoutCharge: 1,
            },
            sessions: [
              {
                id: 701,
                clinic_id: 1,
                patient_id: 30,
                service_id: 10,
                series_id: 901,
                starts_at: "2026-06-10T09:00:00.000Z",
                status: "done",
                billing_mode: "per_session",
                Service: { id: 10, name: "Fisioterapia" },
              },
            ],
          },
        ],
      },
    });

    renderFinanceiro();

    await revealFinancialValues();
    await screen.findByText("Maria Silva");
    await userEvent.click(screen.getByRole("button", { name: "Detalhes" }));

    expect(await screen.findByText("Fisioterapia")).toBeInTheDocument();
    expect(screen.getByText("5/9")).toBeInTheDocument();
    expect(screen.getByText("R$ 1.050,00")).toBeInTheDocument();
    expect(screen.getByText("R$ 150,00")).toBeInTheDocument();
    expect(screen.getByText("R$ 900,00")).toBeInTheDocument();
    expect(screen.queryByText("Sem cobrança gerada")).not.toBeInTheDocument();
    expectChargeTableStructure("Fisioterapia", [
      "10/06/2026Vencida há 5 dias",
      "Fisioterapia",
      "5/9",
      "R$ 1.050,00",
      "R$ 150,00",
      "R$ 900,00",
      "Parcial",
      "Sessões",
    ]);
  });

  it("mantem pacote totalmente pago visivel no detalhe", async () => {
    getFinancialRevenuePatientDetail.mockResolvedValueOnce({
      data: {
        patient: { id: 30, name: "Maria Silva" },
        month: "2026-06",
        summary: {
          total: 100000,
          received: 100000,
          pending: 0,
          creditAvailable: 0,
        },
        entries: [],
        sessions: [],
        payments: [],
        credits: [],
        series: [
          {
            id: 902,
            clinic_id: 1,
            patient_id: 30,
            service_id: 10,
            starts_at: "2026-06-12T09:00:00.000Z",
            occurrence_count: 5,
            Service: { id: 10, name: "Fisioterapia" },
          },
        ],
        packages: [
          {
            id: "series-902",
            sourceId: 902,
            kind: "series",
            series_id: 902,
            service_id: 10,
            service_name: "Fisioterapia",
            reference_date: "2026-06-12T09:00:00.000Z",
            total_sessions: 5,
            used_sessions: 0,
            contracted_amount_cents: 100000,
            amount_cents: 100000,
            paid_cents: 100000,
            open_cents: 0,
            financial_status: "paid",
            entries: [],
            sessions: [],
          },
        ],
      },
    });

    renderFinanceiro();
    await revealFinancialValues();
    await screen.findByText("Maria Silva");
    await userEvent.click(screen.getByRole("button", { name: "Detalhes" }));

    expect(await screen.findByText("Fisioterapia")).toBeInTheDocument();
    expectChargeTableStructure("Fisioterapia", [
      "12/06/2026",
      "Fisioterapia",
      "0/5",
      "R$ 1.000,00",
      "R$ 1.000,00",
      "R$ 0,00",
      "Pago",
      "Sessões",
    ]);
  });

  it("nao transforma sessao sem FinancialEntry em cobranca pendente", async () => {
    getFinancialRevenuesSummary.mockResolvedValueOnce({
      data: {
        month: "2026-06",
        summary: {
          total: 0,
          received: 0,
          pending: 0,
        },
        patients: [
          {
            patient_id: 30,
            patient_name: "Maria Silva",
            total: 0,
            received: 0,
            pending: 0,
            entries_count: 0,
          },
        ],
      },
    });
    getFinancialRevenuePatientDetail.mockResolvedValueOnce({
      data: {
        patient: { id: 30, name: "Maria Silva" },
        month: "2026-06",
        summary: {
          total: 0,
          received: 0,
          pending: 0,
          creditAvailable: 0,
        },
        entries: [],
        sessions: [
          {
            id: 1202,
            clinic_id: 1,
            patient_id: 30,
            service_id: 10,
            starts_at: "2026-06-10T09:00:00.000Z",
            status: "scheduled",
            billing_mode: "per_session",
            Patient: { id: 30, full_name: "Maria Silva" },
            Service: { id: 10, name: "Fisioterapia" },
          },
        ],
        payments: [],
        credits: [],
        series: [],
        packages: [],
      },
    });

    renderFinanceiro();

    await revealFinancialValues();
    await screen.findByText("Maria Silva");
    await userEvent.click(screen.getByRole("button", { name: "Detalhes" }));

    await waitFor(() => {
      expect(getFinancialRevenuePatientDetail).toHaveBeenCalled();
    });
    expect(screen.getByText("A receber").nextSibling).toHaveTextContent("R$ 0,00");
    expect(screen.queryByText("Fisioterapia")).not.toBeInTheDocument();
    expect(screen.queryByText("R$ 200,00")).not.toBeInTheDocument();
  });

  it("zera o resumo e o valor a receber no mes seguinte ao inicio do pacote", async () => {
    getFinancialRevenuesSummary.mockResolvedValue({
      data: {
        month: "2026-05",
        summary: {
          total: 40000,
          received: 0,
          pending: 40000,
        },
        patients: [
          {
            patient_id: 30,
            patient_name: "Marcos Vinicius Forecchi Accioly",
            total: 40000,
            received: 0,
            pending: 40000,
            entries_count: 5,
          },
        ],
      },
    });
    getFinancialRevenuePatientDetail.mockResolvedValue({
      data: {
        patient: { id: 30, name: "Marcos Vinicius Forecchi Accioly" },
        month: "2026-05",
        summary: {
          total: 0,
          received: 0,
          pending: 0,
          creditAvailable: 95000,
        },
        entries: [],
        sessions: [],
        payments: [],
        credits: [],
        series: [
          {
            id: 901,
            clinic_id: 1,
            patient_id: 30,
            service_id: 10,
            starts_at: "2026-04-15T09:00:00.000Z",
            occurrence_count: 5,
            Service: { id: 10, name: "Fisioterapia" },
          },
        ],
        packages: [
          {
            id: "series-901",
            sourceId: 901,
            series_id: 901,
            service_id: 10,
            service_name: "Fisioterapia",
            reference_date: "2026-04-15T09:00:00.000Z",
            total_sessions: 5,
            used_sessions: 0,
            amount_cents: 40000,
            paid_cents: 0,
            open_cents: 40000,
            entries: [{ entryId: 744, openCents: 40000 }],
            sessions: [],
          },
        ],
      },
    });

    renderFinanceiro();
    await revealFinancialValues();
    await userEvent.click(screen.getByRole("button", { name: "< Anterior" }));
    await waitFor(() => {
      expect(getFinancialRevenuesSummary).toHaveBeenCalledWith("2026-05", "month");
    });
    await screen.findByText("Marcos Vinicius Forecchi Accioly");
    await userEvent.click(screen.getByRole("button", { name: "Detalhes" }));

    await waitFor(() => {
      expect(getFinancialRevenuePatientDetail).toHaveBeenCalledWith("30", "2026-05", "month");
      expect(screen.getByText("A receber").nextSibling).toHaveTextContent("R$ 0,00");
    });
    await waitFor(() => {
      const summaryCard = screen.getByText("Resumo de cobrança").parentElement.parentElement;
      expect(within(summaryCard).getByText("Sessões contratadas").nextSibling).toHaveTextContent("0");
      expect(within(summaryCard).getByText("Valor").nextSibling).toHaveTextContent("R$ 0,00");
      expect(within(summaryCard).getByText("Recebido").nextSibling).toHaveTextContent("R$ 0,00");
      expect(within(summaryCard).getByText("Pendente").nextSibling).toHaveTextContent("R$ 0,00");
    });
    expect(screen.queryByText("Fisioterapia")).not.toBeInTheDocument();
  });

  it("mantem servicos avulsos no detalhe ao pesquisar pelo paciente", async () => {
    getFinancialRevenuePatientDetail.mockResolvedValueOnce({
      data: {
        patient: { id: 30, name: "Maria Silva" },
        month: "2026-06",
        summary: {
          total: 30000,
          received: 0,
          pending: 30000,
          creditAvailable: 0,
        },
        entries: [
          {
            id: 745,
            clinic_id: 1,
            patient_id: 30,
            session_id: 880,
            service_id: 12,
            type: "income",
            description: "Atendimento - Avaliação Coluna",
            amount_cents: 30000,
            reference_date: "2026-06-12",
            status: "pending",
          },
        ],
        sessions: [
          {
            id: 880,
            clinic_id: 1,
            patient_id: 30,
            service_id: 12,
            starts_at: "2026-06-12T09:00:00.000Z",
            status: "scheduled",
            billing_mode: "per_session",
            Service: { id: 12, name: "Avaliação Coluna" },
          },
        ],
        payments: [],
        credits: [],
        series: [],
        packages: [],
      },
    });

    renderFinanceiro();

    await revealFinancialValues();
    await screen.findByText("Maria Silva");
    await userEvent.click(screen.getByRole("button", { name: "Detalhes" }));

    expect(await screen.findByText("Avaliação Coluna")).toBeInTheDocument();
    expectChargeTableStructure("Avaliação Coluna", [
      "12/06/2026Vencida há 3 dias",
      "Avaliação Coluna",
      "0/1",
      "R$ 300,00",
      "R$ 0,00",
      "R$ 300,00",
      "Pendente",
      "Sessões",
    ]);

    await userEvent.type(screen.getByLabelText("Pesquisar paciente"), "Maria Silva");

    expect(screen.getByText("Avaliação Coluna")).toBeInTheDocument();
  });

  it.each(["month", "year"])("preserva pacote entre meses na pesquisa e no detalhe (%s)", async (mode) => {
    const fullName = "TESTE Pacote Outubro-Novembro";
    const patient = {
      patient_id: 30,
      patient_name: "Apelido do pacote",
      patient_full_name: fullName,
      total: 40000,
      received: 0,
      pending: 40000,
      entries_count: 4,
    };
    const otherPatient = {
      patient_id: 31, patient_name: "Outro paciente", total: 7000,
      received: 0, pending: 7000, entries_count: 1,
    };
    const sessions = ["2026-10-28", "2026-11-04", "2026-11-11", "2026-11-18"].map((date, index) => ({
      id: 701 + index, patient_id: 30, series_id: 901, service_id: 10,
      starts_at: `${date}T13:00:00.000Z`, status: "scheduled", billing_mode: "per_session",
    }));
    const entries = sessions.map((session, index) => ({
      id: 501 + index, patient_id: 30, session_id: session.id, service_id: 10,
      type: "income", amount_cents: 10000, reference_date: session.starts_at.slice(0, 10), status: "pending",
    }));
    getFinancialRevenuesSummary.mockImplementation((period, periodMode) => Promise.resolve({
      data: {
        month: period,
        summary: periodMode === "month" && period === "2026-11"
          ? { total: 0, received: 0, pending: 0 }
          : { total: 47000, received: 0, pending: 47000 },
        patients: periodMode === "month" && period === "2026-11" ? [] : [patient, otherPatient],
      },
    }));
    getFinancialRevenuePatientDetail.mockImplementation((id) => Promise.resolve({
      data: {
        patient: { id: Number(id), name: id === "30" ? patient.patient_name : "Outro paciente", full_name: id === "30" ? fullName : "Outro paciente" },
        summary: { total: id === "30" ? 40000 : 7000, received: 0, pending: id === "30" ? 40000 : 7000, creditAvailable: 0 },
        entries: id === "30" ? entries : [],
        sessions: id === "30" ? sessions : [],
        payments: [], credits: [],
        series: id === "30" ? [{
          id: 901, patient_id: 30, service_id: 10, starts_at: sessions[0].starts_at,
          occurrence_count: 4,
        }] : [],
        packages: id === "30" ? [{
          id: "series-901", sourceId: 901, series_id: 901, service_id: 10,
          service_name: "Fisioterapia pacote", reference_date: "2026-10-28T13:00:00.000Z",
          total_sessions: 4, used_sessions: 0, amount_cents: 40000, paid_cents: 0,
          open_cents: 40000,
          entries: entries.map((entry) => ({ entryId: entry.id, openCents: 10000 })),
          sessions,
        }] : [],
      },
    }));

    renderFinanceiro();
    await revealFinancialValues();
    if (mode === "month") {
      fireEvent.change(screen.getByLabelText("Selecionar mes e ano"), { target: { value: "2026-10" } });
    } else {
      await userEvent.click(screen.getByRole("button", { name: "Visão anual" }));
    }
    await screen.findByText(patient.patient_name);
    await waitFor(() => expect(getFinancialRevenuesSummary).toHaveBeenLastCalledWith(
      mode === "month" ? "2026-10" : "2026", mode,
    ));
    const summary = () => within(screen.getByText("Resumo de cobrança").parentElement.parentElement);
    const expectTotals = (total, sessionCount) => {
      expect(summary().getByText("Valor").nextSibling).toHaveTextContent(total);
      expect(summary().getByText("Pendente").nextSibling).toHaveTextContent(total);
      expect(summary().getByText("Recebido").nextSibling).toHaveTextContent("R$ 0,00");
      expect(summary().getByText("Sessões contratadas").nextSibling).toHaveTextContent(sessionCount);
    };
    expectTotals("R$ 470,00", "5");
    const search = screen.getByLabelText("Pesquisar paciente");
    const expectSearch = async (query) => {
      await userEvent.clear(search);
      await userEvent.type(search, query);
      expect(screen.getByText(patient.patient_name)).toBeInTheDocument();
      expect(screen.queryByText("Outro paciente")).not.toBeInTheDocument();
      expectTotals("R$ 400,00", "4");
      expect(within(screen.getByText(patient.patient_name).closest("tr")).getByText("R$ 400,00")).toBeInTheDocument();
    };
    await expectSearch("TESTE");
    await expectSearch(fullName);
    await expectSearch("Apelido");
    await userEvent.clear(search);
    await userEvent.type(search, "inexistente");
    expect(screen.queryByText(patient.patient_name)).not.toBeInTheDocument();
    expectTotals("R$ 0,00", "0");
    await userEvent.clear(search);
    expectTotals("R$ 470,00", "5");
    await userEvent.type(search, "TESTE");
    const callsBeforeDetail = getFinancialRevenuesSummary.mock.calls.length;
    await userEvent.click(screen.getByRole("button", { name: "Detalhes" }));
    expect(await screen.findByText("Fisioterapia pacote")).toBeInTheDocument();
    expect(search).toBeDisabled();
    expect(search).toHaveValue(fullName);
    expectTotals("R$ 400,00", "4");
    expect(getFinancialRevenuesSummary).toHaveBeenCalledTimes(callsBeforeDetail);
    await userEvent.click(screen.getByRole("button", { name: "Voltar" }));
    expect(search).toBeEnabled();
    expect(search).toHaveValue("TESTE");
    await screen.findByText(patient.patient_name);
    expectTotals("R$ 400,00", "4");
    await userEvent.click(screen.getByRole("button", { name: "Detalhes" }));
    expect(await screen.findByText("Fisioterapia pacote")).toBeInTheDocument();
    expect(search).toBeDisabled();
    expect(search).toHaveValue(fullName);
    await userEvent.click(screen.getByRole("button", { name: "Voltar" }));
    await screen.findByText(patient.patient_name);
    expect(search).toBeEnabled();
    expect(search).toHaveValue("TESTE");
    await userEvent.clear(search);
    expectTotals("R$ 470,00", "5");
    expect(listFinancialEntries).not.toHaveBeenCalled();
    expect(axios.get).not.toHaveBeenCalledWith("/sessions", expect.anything());
  });

  it("usa resumo agregado no modo anual", async () => {
    renderFinanceiro();

    await userEvent.click(screen.getByRole("button", { name: "Visão anual" }));

    await waitFor(() => {
      expect(getFinancialRevenuesSummary).toHaveBeenCalledWith(expect.stringMatching(/^\d{4}$/), "year");
    });
    expect(listFinancialEntries).not.toHaveBeenCalled();
  });

  it("recarrega detalhe ao mudar mes e reaproveita cache ao voltar", async () => {
    getFinancialRevenuePatientDetail.mockReset();
    getFinancialRevenuePatientDetail
      .mockResolvedValueOnce({
        data: {
          patient: { id: 30, name: "Maria Silva" },
          month: "2026-06",
          summary: { total: 30000, received: 30000, pending: 0, creditAvailable: 0 },
          entries: [
            {
              id: 1345,
              clinic_id: 1,
              patient_id: 30,
              session_id: 1696,
              service_id: 6,
              type: "income",
              description: "Atendimento - Avaliacao Coluna",
              amount_cents: 30000,
              reference_date: "2026-06-29",
              status: "paid",
            },
          ],
          sessions: [
            {
              id: 1696,
              clinic_id: 1,
              patient_id: 30,
              service_id: 6,
              starts_at: "2026-06-29T10:00:00.000Z",
              status: "scheduled",
              billing_mode: "per_session",
              Service: { id: 6, name: "Avaliacao Coluna" },
            },
          ],
          payments: [],
          credits: [],
          series: [],
          packages: [],
        },
      })
      .mockResolvedValueOnce({
        data: {
          patient: { id: 30, name: "Maria Silva" },
          month: "2026-07",
          summary: { total: 120000, received: 0, pending: 120000, creditAvailable: 144000 },
          entries: [],
          sessions: [],
          payments: [],
          credits: [],
          series: [
            {
              id: 160,
              clinic_id: 1,
              patient_id: 30,
              service_id: 1,
              starts_at: "2026-07-02T14:00:00.000Z",
              occurrence_count: 8,
              Service: { id: 1, name: "Fisioterapia" },
            },
          ],
          packages: [
            {
              id: "series-160",
              sourceId: 160,
              series_id: 160,
              service_id: 1,
              service_name: "Fisioterapia",
              reference_date: "2026-07-02T14:00:00.000Z",
              total_sessions: 8,
              used_sessions: 0,
              amount_cents: 120000,
              paid_cents: 0,
              open_cents: 120000,
              financial_status: "pending",
              sessions: [],
              entries: [{ entryId: 1346, openCents: 120000 }],
            },
          ],
        },
      });

    renderFinanceiro();

    await screen.findByText("Maria Silva");
    await userEvent.click(screen.getByRole("button", { name: "Detalhes" }));

    expect(await screen.findByText("Avaliacao Coluna")).toBeInTheDocument();
    expect(getFinancialRevenuePatientDetail).toHaveBeenCalledTimes(1);

    await userEvent.click(screen.getByRole("button", { name: "Proximo >" }));

    expect(await screen.findByText("Fisioterapia")).toBeInTheDocument();
    await waitFor(() => {
      expect(getFinancialRevenuePatientDetail).toHaveBeenCalledWith("30", "2026-07", "month");
    });
    expect(screen.queryByText("Avaliacao Coluna")).not.toBeInTheDocument();
    expect(getFinancialRevenuePatientDetail).toHaveBeenCalledTimes(2);

    await userEvent.click(screen.getByRole("button", { name: "< Anterior" }));

    expect(await screen.findByText("Avaliacao Coluna")).toBeInTheDocument();
    expect(getFinancialRevenuePatientDetail).toHaveBeenCalledTimes(2);
  });

  it("alterna mensal e anual no detalhe usando cache por modo e periodo", async () => {
    getFinancialRevenuePatientDetail.mockReset();
    getFinancialRevenuePatientDetail
      .mockResolvedValueOnce({
        data: {
          patient: { id: 30, name: "Maria Silva" },
          month: "2026-06",
          summary: { total: 30000, received: 30000, pending: 0, creditAvailable: 0 },
          entries: [
            {
              id: 1345,
              clinic_id: 1,
              patient_id: 30,
              session_id: 1696,
              service_id: 6,
              type: "income",
              description: "Atendimento - Avaliacao Coluna",
              amount_cents: 30000,
              reference_date: "2026-06-29",
              status: "paid",
            },
          ],
          sessions: [
            {
              id: 1696,
              clinic_id: 1,
              patient_id: 30,
              service_id: 6,
              starts_at: "2026-06-29T10:00:00.000Z",
              status: "scheduled",
              billing_mode: "per_session",
              Service: { id: 6, name: "Avaliacao Coluna" },
            },
          ],
          payments: [],
          credits: [],
          series: [],
          packages: [],
        },
      })
      .mockResolvedValueOnce({
        data: {
          patient: { id: 30, name: "Maria Silva" },
          year: "2026",
          summary: { total: 150000, received: 30000, pending: 120000, creditAvailable: 144000 },
          entries: [],
          sessions: [],
          payments: [],
          credits: [],
          series: [
            {
              id: 160,
              clinic_id: 1,
              patient_id: 30,
              service_id: 1,
              starts_at: "2026-07-02T14:00:00.000Z",
              occurrence_count: 8,
              Service: { id: 1, name: "Fisioterapia" },
            },
          ],
          packages: [
            {
              id: "series-160",
              sourceId: 160,
              series_id: 160,
              service_id: 1,
              service_name: "Fisioterapia",
              reference_date: "2026-07-02T14:00:00.000Z",
              total_sessions: 8,
              used_sessions: 0,
              amount_cents: 120000,
              paid_cents: 0,
              open_cents: 120000,
              financial_status: "pending",
              sessions: [],
              entries: [{ entryId: 1346, openCents: 120000 }],
            },
          ],
        },
      });

    renderFinanceiro();

    await screen.findByText("Maria Silva");
    await userEvent.click(screen.getByRole("button", { name: "Detalhes" }));

    expect(await screen.findByText("Avaliacao Coluna")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /Vis.o anual/ }));

    expect(await screen.findByText("Fisioterapia")).toBeInTheDocument();
    expect(getFinancialRevenuePatientDetail).toHaveBeenCalledWith("30", "2026", "year");
    expect(getFinancialRevenuePatientDetail).toHaveBeenCalledTimes(2);

    await userEvent.click(screen.getByRole("button", { name: /^M.s$/ }));

    expect(await screen.findByText("Avaliacao Coluna")).toBeInTheDocument();
    expect(getFinancialRevenuePatientDetail).toHaveBeenCalledTimes(2);
  });

  it("invalida cache do detalhe apos usar credito financeiro", async () => {
    getFinancialRevenuePatientDetail.mockReset();
    getFinancialRevenuePatientDetail
      .mockResolvedValueOnce({
        data: {
          patient: { id: 30, name: "Maria Silva" },
          month: "2026-06",
          summary: { total: 120000, received: 0, pending: 120000, creditAvailable: 144000 },
          entries: [],
          sessions: [],
          payments: [],
          credits: [],
          series: [
            {
              id: 160,
              clinic_id: 1,
              patient_id: 30,
              service_id: 1,
              starts_at: "2026-06-10T14:00:00.000Z",
              occurrence_count: 8,
              Service: { id: 1, name: "Fisioterapia" },
            },
          ],
          packages: [
            {
              id: "series-160",
              sourceId: 160,
              series_id: 160,
              service_id: 1,
              service_name: "Fisioterapia",
              reference_date: "2026-06-10T14:00:00.000Z",
              total_sessions: 8,
              used_sessions: 0,
              amount_cents: 120000,
              paid_cents: 0,
              open_cents: 120000,
              financial_status: "pending",
              sessions: [],
              entries: [{ entryId: 1346, openCents: 120000 }],
            },
          ],
        },
      })
      .mockResolvedValueOnce({
        data: {
          patient: { id: 30, name: "Maria Silva" },
          month: "2026-06",
          summary: { total: 120000, received: 120000, pending: 0, creditAvailable: 24000 },
          entries: [],
          sessions: [],
          payments: [],
          credits: [],
          series: [
            {
              id: 160,
              clinic_id: 1,
              patient_id: 30,
              service_id: 1,
              starts_at: "2026-06-10T14:00:00.000Z",
              occurrence_count: 8,
              Service: { id: 1, name: "Fisioterapia" },
            },
          ],
          packages: [
            {
              id: "series-160",
              sourceId: 160,
              series_id: 160,
              service_id: 1,
              service_name: "Fisioterapia",
              reference_date: "2026-06-10T14:00:00.000Z",
              total_sessions: 8,
              used_sessions: 0,
              amount_cents: 120000,
              paid_cents: 120000,
              open_cents: 0,
              financial_status: "paid",
              sessions: [],
              entries: [],
            },
          ],
        },
      });

    renderFinanceiro();

    await revealFinancialValues();
    await screen.findByText("Maria Silva");
    await userEvent.click(screen.getByRole("button", { name: "Detalhes" }));

    expect(await screen.findByText("Fisioterapia")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Usar cr.dito/ })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /Usar cr.dito/ }));
    await userEvent.click(await screen.findByRole("button", { name: /Confirmar uso do cr.dito/ }));

    await waitFor(() => {
      expect(applyScopedFinancialCredit).toHaveBeenCalledWith({
        patient_id: 30,
        allocation_scope: "per_session_current_period",
        period_start: "2026-06-01",
        period_end: "2026-06-30",
      });
      expect(getFinancialRevenuePatientDetail).toHaveBeenCalledTimes(2);
    });
    expect(screen.queryByRole("button", { name: /Usar cr.dito/ })).not.toBeInTheDocument();
  });

  it("mantem todas as mensalidades do paciente no detalhe mesmo com busca preenchida", async () => {
    listBillingCycles.mockResolvedValueOnce({
      data: [
        {
          id: 11,
          clinic_id: 1,
          patient_id: 30,
          service_plan_id: 101,
          cycle_start: "2026-06-01",
          cycle_end: "2026-06-30",
          amount_cents: 70000,
          status: "active",
          Patient: { id: 30, full_name: "Maria Silva" },
          ServicePlan: { id: 101, name: "Recovery" },
          FinancialEntry: {
            id: 901,
            amount_cents: 70000,
            status: "pending",
            installments: [
              {
                amount_cents: 70000,
                paid_amount_cents: 0,
                open_amount_cents: 70000,
                status: "pending",
              },
            ],
          },
        },
        {
          id: 12,
          clinic_id: 1,
          patient_id: 30,
          service_plan_id: 102,
          cycle_start: "2026-06-01",
          cycle_end: "2026-06-30",
          amount_cents: 50000,
          status: "active",
          Patient: { id: 30, full_name: "Maria Silva" },
          ServicePlan: { id: 102, name: "Pilates" },
          FinancialEntry: {
            id: 902,
            amount_cents: 50000,
            status: "pending",
            installments: [
              {
                amount_cents: 50000,
                paid_amount_cents: 0,
                open_amount_cents: 50000,
                status: "pending",
              },
            ],
          },
        },
      ],
    });

    renderFinanceiro();

    await userEvent.click(screen.getByRole("button", { name: "Mensalidades" }));
    await screen.findByText("Maria Silva");

    await userEvent.type(screen.getByLabelText("Pesquisar paciente"), "Maria Silva");
    await userEvent.click(screen.getByRole("button", { name: "Detalhes" }));

    expect(await screen.findByText("Recovery")).toBeInTheDocument();
    expect(screen.getByText("Pilates")).toBeInTheDocument();
  });

  it("mostra mensalidade sem cobranca como informativa no detalhe do paciente", async () => {
    listBillingCycles.mockResolvedValueOnce({
      data: [
        {
          id: 991,
          clinic_id: 1,
          patient_plan_id: 41,
          patient_id: 30,
          service_plan_id: 102,
          cycle_start: "2026-06-01",
          cycle_end: "2026-06-30",
          amount_cents: 0,
          paid_amount_cents: 0,
          open_amount_cents: 0,
          status: "active",
          is_no_charge: true,
          financial_entry_id: null,
          Patient: { id: 30, full_name: "Maria Silva" },
          ServicePlan: { id: 102, name: "FUNCIONAL 2X NA SEMANA" },
          FinancialEntry: null,
        },
      ],
    });

    renderFinanceiro();
    await revealFinancialValues();

    await userEvent.click(screen.getByRole("button", { name: "Mensalidades" }));
    await screen.findByText("Maria Silva");

    const groupedPatientCell = screen.getByText("Maria Silva");
    const groupedRow = groupedPatientCell.closest("tr");
    expect(groupedRow).toBeTruthy();
    expect(within(groupedRow).getAllByText("Sem cobrança")).toHaveLength(1);
    expect(within(groupedRow).queryByText("R$ 0,00")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Detalhes" }));

    const planCell = await screen.findByText("FUNCIONAL 2X NA SEMANA");
    const row = planCell.closest("tr");
    expect(row).toBeTruthy();
    expect(within(row).getByText("Sem cobrança")).toBeInTheDocument();
    expect(within(row).queryByText("R$ 0,00")).not.toBeInTheDocument();
    expect(within(row).getByRole("button", { name: "Ver sessões" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Registrar recebimento" })).not.toBeInTheDocument();
  });

  it("nao mostra mensalidade sem sessao no detalhe por sessao", async () => {
    getFinancialRevenuePatientDetail.mockResolvedValueOnce({
      data: {
        patient: { id: 30, name: "Maria Silva" },
        month: "2026-06",
        summary: {
          total: 0,
          received: 0,
          pending: 0,
          creditAvailable: 0,
        },
        entries: [
          {
            id: 985,
            clinic_id: 1,
            patient_id: 30,
            session_id: null,
            service_id: 10,
            type: "income",
            description: "Mensalidade - Recovery",
            amount_cents: 70000,
            reference_date: "2026-06-03",
            status: "pending",
          },
        ],
        sessions: [
          {
            id: 1116,
            clinic_id: 1,
            patient_id: 30,
            service_id: 10,
            starts_at: "2026-06-03T18:00:00.000Z",
            status: "done",
            billing_mode: "covered_by_plan",
            Service: { id: 10, name: "Recovery" },
          },
        ],
        payments: [],
        credits: [],
        series: [],
      },
    });

    renderFinanceiro();

    await screen.findByText("Maria Silva");
    await userEvent.click(screen.getByRole("button", { name: "Detalhes" }));

    await waitFor(() => {
      expect(getFinancialRevenuePatientDetail).toHaveBeenCalled();
    });
    expect(screen.queryByText("Mensalidade - Recovery")).not.toBeInTheDocument();
    expect(screen.queryByText("R$ 700,00")).not.toBeInTheDocument();
  });

  it("busca sessoes da serie ao abrir Sessoes do pacote", async () => {
    axios.get.mockResolvedValueOnce({
      data: [
        {
          id: 701,
          clinic_id: 1,
          patient_id: 30,
          service_id: 10,
          series_id: 901,
          starts_at: "2026-06-10T09:00:00.000Z",
          status: "done",
          billing_mode: "per_session",
          Service: { id: 10, name: "Fisioterapia" },
        },
        {
          id: 702,
          clinic_id: 1,
          patient_id: 30,
          service_id: 10,
          series_id: 901,
          starts_at: "2026-07-10T09:00:00.000Z",
          status: "scheduled",
          billing_mode: "per_session",
          Service: { id: 10, name: "Fisioterapia" },
        },
      ],
    });

    renderFinanceiro();

    await screen.findByText("Maria Silva");
    await userEvent.click(screen.getByRole("button", { name: "Detalhes" }));
    await screen.findByText("Fisioterapia");

    await userEvent.click(screen.getByRole("button", { name: "Sessões" }));

    await waitFor(() => {
      expect(axios.get).toHaveBeenCalledWith("/sessions", {
        params: {
          patient_id: 30,
          series_id: 901,
        },
      });
    });
    expect(await screen.findByText("Sessões do pacote")).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getAllByText(/Agendada/i).length).toBeGreaterThan(0);
    });
    expect(screen.getByText(/Realizada/i)).toBeInTheDocument();
  });

  it("mostra erro amigavel quando patient-detail falha", async () => {
    getFinancialRevenuePatientDetail.mockRejectedValue(new Error("erro"));

    renderFinanceiro();

    await screen.findByText("Maria Silva");
    await userEvent.click(screen.getByRole("button", { name: "Detalhes" }));

    await waitFor(() => {
      expect(getFinancialRevenuePatientDetail).toHaveBeenCalled();
    });
    expect(await screen.findByText(/detalhes deste paciente/i)).toBeInTheDocument();
    expect(getFinancialRevenuePatientDetail).toHaveBeenCalledTimes(2);
  });
});
