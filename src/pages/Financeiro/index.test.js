import "@testing-library/jest-dom";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

import Financeiro from "./index";
import axios from "../../services/axios";
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

const renderFinanceiro = () => render(
  <MemoryRouter>
    <Financeiro />
  </MemoryRouter>,
);

const revealFinancialValues = async () => {
  await userEvent.click(screen.getByRole("button", { name: "Mostrar valores financeiros" }));
};

describe("Financeiro - detalhe de receitas por paciente", () => {
  beforeEach(() => {
    jest.clearAllMocks();
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
    getFinancialOverview.mockResolvedValue({
      data: {
        received: 0,
        receivable: 0,
        paidExpenses: 0,
        pendingExpenses: 0,
        currentResult: 0,
        pendingBalance: 0,
      },
    });
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

  it("usa patient-detail ao clicar em Detalhes sem carregar listas pesadas", async () => {
    renderFinanceiro();

    expect(screen.getByRole("button", { name: "Mostrar valores financeiros" })).toBeInTheDocument();
    await revealFinancialValues();
    await userEvent.click(screen.getByRole("button", { name: "Receitas" }));

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
    await userEvent.click(screen.getByRole("button", { name: "Receitas" }));
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
    await userEvent.click(screen.getByRole("button", { name: "Receitas" }));
    await screen.findByText("Maria Silva");
    await userEvent.click(screen.getByRole("button", { name: "Detalhes" }));

    expect(await screen.findByText("Fisioterapia")).toBeInTheDocument();
    expect(screen.getByText("5/9")).toBeInTheDocument();
    expect(screen.getByText("R$ 1.050,00")).toBeInTheDocument();
    expect(screen.getByText("R$ 150,00")).toBeInTheDocument();
    expect(screen.getByText("R$ 900,00")).toBeInTheDocument();
    expect(screen.queryByText("Sem cobrança gerada")).not.toBeInTheDocument();
  });

  it("mantem servicos avulsos no detalhe ao pesquisar pelo paciente", async () => {
    getFinancialRevenuePatientDetail.mockResolvedValueOnce({
      data: {
        patient: { id: 30, name: "Maria Silva" },
        month: "2026-06",
        summary: {
          total: 30000,
          received: 30000,
          pending: 0,
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
            status: "paid",
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

    await userEvent.click(screen.getByRole("button", { name: "Receitas" }));
    await screen.findByText("Maria Silva");
    await userEvent.click(screen.getByRole("button", { name: "Detalhes" }));

    expect(await screen.findByText("Avaliação Coluna")).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText("Pesquisar paciente"), "Maria Silva");

    expect(screen.getByText("Avaliação Coluna")).toBeInTheDocument();
  });

  it("usa resumo agregado no modo anual", async () => {
    renderFinanceiro();

    await userEvent.click(screen.getByRole("button", { name: "Receitas" }));
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

    await userEvent.click(screen.getByRole("button", { name: "Receitas" }));
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
          entries: [],
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

    await userEvent.click(screen.getByRole("button", { name: "Receitas" }));
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
    await userEvent.click(screen.getByRole("button", { name: "Receitas" }));
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

    await userEvent.click(screen.getByRole("button", { name: "Receitas" }));
    await userEvent.click(screen.getByRole("button", { name: "Mensalidades" }));
    await screen.findByText("Maria Silva");

    await userEvent.type(screen.getByLabelText("Pesquisar paciente"), "Maria Silva");
    await userEvent.click(screen.getByRole("button", { name: "Detalhes" }));

    expect(await screen.findByText("Recovery")).toBeInTheDocument();
    expect(screen.getByText("Pilates")).toBeInTheDocument();
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

    await userEvent.click(screen.getByRole("button", { name: "Receitas" }));
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

    await userEvent.click(screen.getByRole("button", { name: "Receitas" }));
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

    await userEvent.click(screen.getByRole("button", { name: "Receitas" }));
    await screen.findByText("Maria Silva");
    await userEvent.click(screen.getByRole("button", { name: "Detalhes" }));

    await waitFor(() => {
      expect(getFinancialRevenuePatientDetail).toHaveBeenCalled();
    });
    expect(await screen.findByText(/detalhes deste paciente/i)).toBeInTheDocument();
  });
});
