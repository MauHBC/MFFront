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

const renderMensalidades = (query = "?view=mensalidades&month=2026-08") => render(
  <MemoryRouter initialEntries={[`/financeiro/receitas${query}`]}>
    <Financeiro />
  </MemoryRouter>,
);

const openMariaDetail = async () => {
  const maria = await screen.findByText("Maria Silva");
  const row = maria.closest("tr");
  await userEvent.click(within(row).getByRole("button", { name: "Detalhes" }));
  return row;
};

const openMariaPayment = async () => {
  await openMariaDetail();
  await userEvent.click(await screen.findByRole("button", { name: "Registrar recebimento" }));
};

describe("Financeiro - caracterização focada de Mensalidades", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getUserFacingApiError.mockImplementation(
      (error, fallback) => error?.response?.data?.message || fallback,
    );
    window.matchMedia = jest.fn().mockReturnValue({
      matches: false,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      addListener: jest.fn(),
      removeListener: jest.fn(),
    });

    getFinancialRevenuesSummary.mockResolvedValue({
      data: { month: "2026-08", summary: {}, patients: [] },
    });
    getFinancialRevenuePatientDetail.mockResolvedValue({ data: {} });
    listFinancialEntries.mockResolvedValue({ data: entries });
    listFinancialCategories.mockResolvedValue({ data: [] });
    listPaymentMethods.mockResolvedValue({ data: [{ id: 3, name: "Pix", is_active: true }] });
    listServicePrices.mockResolvedValue({ data: [] });
    listFinancialPayments.mockResolvedValue({ data: [] });
    listPatientCredits.mockResolvedValue({
      data: [{ id: 77, patient_id: 30, remaining_amount_cents: 25000 }],
    });
    listBillingCycles.mockResolvedValue({ data: cycles });
    createFinancialEntry.mockResolvedValue({ data: { id: 990 } });
    createFinancialPayment.mockResolvedValue({ data: { id: 991 } });
    applyScopedFinancialCredit.mockResolvedValue({ data: {} });
    axios.get.mockImplementation((url) => {
      if (url === "/patients") return Promise.resolve({ data: patients });
      if (url === "/services" || url === "/session-series" || url === "/sessions") {
        return Promise.resolve({ data: [] });
      }
      return Promise.resolve({ data: [] });
    });
  });

  afterEach(cleanup);

  it("carrega pelo período sem tenant do cliente, agrupa por paciente e mascara valores", async () => {
    renderMensalidades();

    const maria = await screen.findByText("Maria Silva");
    const mariaRow = maria.closest("tr");
    expect(listBillingCycles).toHaveBeenCalledWith({ from: "2026-08-01", to: "2026-08-31" });
    expect(listBillingCycles.mock.calls.some(([params]) => Object.hasOwn(params, "clinic_id"))).toBe(false);
    expect(within(mariaRow).getByText("31/08/2026")).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Vencimento" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Pagamento" })).toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: "Mensalidades" })).not.toBeInTheDocument();
    expect(screen.getAllByText("R$ ••••").length).toBeGreaterThan(0);
    expect(screen.queryByText("R$ 700,00")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Mostrar valores financeiros" }));
    expect(screen.getAllByText("R$ 700,00").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Ocultar valores financeiros" })).toBeInTheDocument();
  });

  it("apresenta vencimentos de hoje e futuro sem misturar com o pagamento", async () => {
    const today = addLocalDays(0);
    const future = addLocalDays(5);
    const todayEntry = makeEntry({
      id: 910,
      patientId: 30,
      amountCents: 70000,
      dueDate: today,
    });
    const futureEntry = makeEntry({
      id: 911,
      patientId: 31,
      amountCents: 80000,
      dueDate: future,
    });
    listFinancialEntries.mockResolvedValue({ data: [todayEntry, futureEntry] });
    listBillingCycles.mockResolvedValue({
      data: [
        makeCycle({
          id: 21,
          patientId: 30,
          entryId: todayEntry.id,
          amountCents: todayEntry.amount_cents,
          planName: "Hoje",
          FinancialEntry: todayEntry,
        }),
        makeCycle({
          id: 22,
          patientId: 31,
          entryId: futureEntry.id,
          amountCents: futureEntry.amount_cents,
          planName: "Futuro",
          FinancialEntry: futureEntry,
        }),
      ],
    });

    renderMensalidades();

    const todayRow = (await screen.findByText("Maria Silva")).closest("tr");
    expect(within(todayRow).getByText(formatDateOnlyBR(today))).toBeInTheDocument();
    expect(within(todayRow).getByText("Vence hoje")).toBeInTheDocument();
    expect(within(todayRow).getByText("Pendente")).toBeInTheDocument();

    const futureRow = screen.getByText("Bruno Costa").closest("tr");
    expect(within(futureRow).getByText(formatDateOnlyBR(future))).toBeInTheDocument();
    expect(within(futureRow).getByText("A vencer")).toBeInTheDocument();
    expect(within(futureRow).getByText("Pendente")).toBeInTheDocument();
  });

  it("mantém mensalidade parcial e vencida consistente entre lista e detalhe", async () => {
    const past = addLocalDays(-7);
    const partialEntry = makeEntry({
      id: 912,
      patientId: 31,
      amountCents: 80000,
      paidCents: 30000,
      status: "overdue",
      dueDate: past,
    });
    const partialCycle = makeCycle({
      id: 23,
      patientId: 31,
      entryId: partialEntry.id,
      amountCents: partialEntry.amount_cents,
      planName: "Parcial vencido",
      FinancialEntry: partialEntry,
    });
    listFinancialEntries.mockResolvedValue({ data: [partialEntry] });
    listBillingCycles.mockResolvedValue({ data: [partialCycle] });

    renderMensalidades();

    const patientRow = (await screen.findByText("Bruno Costa")).closest("tr");
    expect(within(patientRow).getByText(formatDateOnlyBR(past))).toBeInTheDocument();
    expect(within(patientRow).getByText("Vencida há 7 dias")).toBeInTheDocument();
    expect(within(patientRow).getByText("Parcial")).toBeInTheDocument();
    expect(within(patientRow).queryByText("Vencido")).not.toBeInTheDocument();

    await userEvent.click(within(patientRow).getByRole("button", { name: "Detalhes" }));
    const detailRow = (await screen.findByText("Parcial vencido")).closest("tr");
    expect(within(detailRow).getByText(
      `Vencimento: ${formatDateOnlyBR(past)} · Vencida há 7 dias`,
    )).toBeInTheDocument();
    expect(within(detailRow).getByText("Parcial")).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Pagamento" })).toBeInTheDocument();
  });

  it("resume vários vencimentos anuais pelo mais antigo que ainda está em aberto", async () => {
    const paidPast = addLocalDays(-40);
    const oldestOpen = addLocalDays(-20);
    const futureOpen = addLocalDays(20);
    const paidEntry = makeEntry({
      id: 920,
      patientId: 30,
      amountCents: 50000,
      paidCents: 50000,
      status: "paid",
      dueDate: paidPast,
    });
    const oldestOpenEntry = makeEntry({
      id: 921,
      patientId: 30,
      amountCents: 60000,
      dueDate: oldestOpen,
    });
    const futureOpenEntry = makeEntry({
      id: 922,
      patientId: 30,
      amountCents: 70000,
      dueDate: futureOpen,
    });
    const annualEntries = [paidEntry, oldestOpenEntry, futureOpenEntry];
    listFinancialEntries.mockResolvedValue({ data: annualEntries });
    listBillingCycles.mockResolvedValue({
      data: [
        makeCycle({
          id: 24,
          patientId: 30,
          entryId: paidEntry.id,
          amountCents: paidEntry.amount_cents,
          planName: "Janeiro",
          FinancialEntry: paidEntry,
          cycle_start: "2026-01-01",
          cycle_end: "2026-01-31",
        }),
        makeCycle({
          id: 25,
          patientId: 30,
          entryId: oldestOpenEntry.id,
          amountCents: oldestOpenEntry.amount_cents,
          planName: "Junho",
          FinancialEntry: oldestOpenEntry,
          cycle_start: "2026-06-01",
          cycle_end: "2026-06-30",
        }),
        makeCycle({
          id: 26,
          patientId: 30,
          entryId: futureOpenEntry.id,
          amountCents: futureOpenEntry.amount_cents,
          planName: "Novembro",
          FinancialEntry: futureOpenEntry,
          cycle_start: "2026-11-01",
          cycle_end: "2026-11-30",
        }),
      ],
    });

    renderMensalidades();
    await userEvent.click(screen.getByRole("button", { name: "Visão anual" }));

    const patientRow = (await screen.findByText("Maria Silva")).closest("tr");
    expect(within(patientRow).getByText("3 vencimentos")).toBeInTheDocument();
    expect(within(patientRow).getByText(
      `Mais antigo em aberto: ${formatDateOnlyBR(oldestOpen)} · Vencida há 20 dias`,
    )).toBeInTheDocument();
    expect(within(patientRow).getByText("Parcial")).toBeInTheDocument();
    await waitFor(() => expect(listBillingCycles).toHaveBeenCalledWith({
      from: "2026-01-01",
      to: "2026-12-31",
    }));
  });

  it("não alerta atraso no agrupamento anual totalmente pago", async () => {
    const firstPast = addLocalDays(-60);
    const secondPast = addLocalDays(-30);
    const firstPaidEntry = makeEntry({
      id: 930,
      patientId: 32,
      amountCents: 50000,
      paidCents: 50000,
      status: "paid",
      dueDate: firstPast,
    });
    const secondPaidEntry = makeEntry({
      id: 931,
      patientId: 32,
      amountCents: 60000,
      paidCents: 60000,
      status: "paid",
      dueDate: secondPast,
    });
    listFinancialEntries.mockResolvedValue({ data: [firstPaidEntry, secondPaidEntry] });
    listBillingCycles.mockResolvedValue({
      data: [
        makeCycle({
          id: 27,
          patientId: 32,
          entryId: firstPaidEntry.id,
          amountCents: firstPaidEntry.amount_cents,
          planName: "Pago 1",
          FinancialEntry: firstPaidEntry,
          cycle_start: "2026-02-01",
          cycle_end: "2026-02-28",
        }),
        makeCycle({
          id: 28,
          patientId: 32,
          entryId: secondPaidEntry.id,
          amountCents: secondPaidEntry.amount_cents,
          planName: "Pago 2",
          FinancialEntry: secondPaidEntry,
          cycle_start: "2026-07-01",
          cycle_end: "2026-07-31",
        }),
      ],
    });

    renderMensalidades();
    await userEvent.click(screen.getByRole("button", { name: "Visão anual" }));

    const patientRow = (await screen.findByText("Carla Lima")).closest("tr");
    expect(within(patientRow).getByText("2 vencimentos")).toBeInTheDocument();
    expect(within(patientRow).getByText("Pago")).toBeInTheDocument();
    expect(within(patientRow).queryByText(/Mais antigo em aberto/)).not.toBeInTheDocument();
    expect(within(patientRow).queryByText(/Vencida há/)).not.toBeInTheDocument();

    await userEvent.click(within(patientRow).getByRole("button", { name: "Detalhes" }));
    const firstPaidRow = (await screen.findByText("Pago 1")).closest("tr");
    expect(within(firstPaidRow).getByText(
      `Vencimento: ${formatDateOnlyBR(firstPast)}`,
    )).toBeInTheDocument();
    expect(within(firstPaidRow).getByText("Pago")).toBeInTheDocument();
    expect(within(firstPaidRow).queryByText(/Vencida há/)).not.toBeInTheDocument();
  });

  it("tolera mensalidade sem vencimento financeiro e não usa fallback de outro contrato", async () => {
    const entryFromFinancialList = makeEntry({
      id: 940,
      patientId: 33,
      amountCents: 60000,
      dueDate: "2099-12-31",
    });
    const cycleEntryWithoutDueDate = { ...entryFromFinancialList, due_date: null };
    const cycleWithoutDueDate = makeCycle({
      id: 29,
      patientId: 33,
      entryId: entryFromFinancialList.id,
      amountCents: entryFromFinancialList.amount_cents,
      planName: "Sem vencimento",
      FinancialEntry: cycleEntryWithoutDueDate,
    });
    listFinancialEntries.mockResolvedValue({ data: [entryFromFinancialList] });
    listBillingCycles.mockResolvedValue({ data: [cycleWithoutDueDate] });

    renderMensalidades();

    const patientRow = (await screen.findByText("Dora Alves")).closest("tr");
    expect(within(patientRow).getByText("-")).toBeInTheDocument();
    expect(within(patientRow).getByText("Pendente")).toBeInTheDocument();
    expect(within(patientRow).queryByText("31/12/2099")).not.toBeInTheDocument();

    await userEvent.click(within(patientRow).getByRole("button", { name: "Detalhes" }));
    const detailRow = (await screen.findByText("Sem vencimento")).closest("tr");
    expect(within(detailRow).getByText("Vencimento: -")).toBeInTheDocument();
  });

  it("aplica busca e status sobre a listagem publicada", async () => {
    renderMensalidades();
    await screen.findByText("Maria Silva");

    fireEvent.change(screen.getByLabelText("Status financeiro"), { target: { value: "partial" } });
    expect(screen.getByText("Bruno Costa")).toBeInTheDocument();
    expect(screen.queryByText("Maria Silva")).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Status financeiro"), { target: { value: "all" } });
    fireEvent.change(screen.getByLabelText("Pesquisar paciente"), { target: { value: "carla" } });
    expect(screen.getByText("Carla Lima")).toBeInTheDocument();
    expect(screen.queryByText("Bruno Costa")).not.toBeInTheDocument();
  });

  it("alterna mês e visão anual atualizando a consulta de ciclos", async () => {
    renderMensalidades();
    await screen.findByText("Maria Silva");

    fireEvent.change(screen.getByLabelText("Selecionar mes e ano"), { target: { value: "2026-07" } });
    await waitFor(() => expect(listBillingCycles).toHaveBeenCalledWith({
      from: "2026-07-01",
      to: "2026-07-31",
    }));

    await userEvent.click(screen.getByRole("button", { name: "Visão anual" }));
    await waitFor(() => expect(listBillingCycles).toHaveBeenCalledWith({
      from: "2026-01-01",
      to: "2026-12-31",
    }));
  });

  it("abre o drilldown, apresenta ciclos e preserva crédito fora de Mensalidades", async () => {
    renderMensalidades("?view=mensalidades&month=2026-08&patient_id=30&patient_name=Maria%20Silva");

    expect(await screen.findByText("Recovery")).toBeInTheDocument();
    expect(screen.getByText("Pilates")).toBeInTheDocument();
    expect(screen.getAllByText("Sem cobrança").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Registrar recebimento" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Usar crédito" })).not.toBeInTheDocument();
    expect(applyScopedFinancialCredit).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole("button", { name: "Voltar" }));
    expect(await screen.findByText("31/08/2026")).toBeInTheDocument();
  });

  it("mostra a prévia somente das sessões vinculadas ao ciclo e seus status", async () => {
    axios.get.mockImplementation((url) => {
      if (url === "/patients") return Promise.resolve({ data: patients });
      if (url === "/sessions") {
        return Promise.resolve({
          data: [
            { id: 2, billing_cycle_id: 11, starts_at: "2026-08-20T14:00:00.000Z", status: "canceled" },
            { id: 1, billing_cycle_id: 11, starts_at: "2026-08-10T09:00:00.000Z", status: "done" },
            { id: 3, billing_cycle_id: 99, starts_at: "2026-08-12T09:00:00.000Z", status: "no_show" },
          ],
        });
      }
      return Promise.resolve({ data: [] });
    });
    renderMensalidades();
    await openMariaDetail();

    await userEvent.click(within(screen.getByText("Recovery").closest("tr"))
      .getByRole("button", { name: "Ver sessões" }));
    expect(await screen.findByRole("heading", { name: "Sessões da mensalidade" })).toBeInTheDocument();
    expect(await screen.findByText("Realizada")).toBeInTheDocument();
    expect(screen.getByText("Cancelada")).toBeInTheDocument();
    expect(screen.queryByText("Falta")).not.toBeInTheDocument();
    expect(axios.get).toHaveBeenCalledWith("/sessions", {
      params: { from: "2026-08-11", to: "2026-08-31" },
    });
  });

  it("registra pagamento integral com anchor e alocação e atualiza o ciclo", async () => {
    renderMensalidades();
    await openMariaPayment();

    const paidEntry = makeEntry({ id: 901, patientId: 30, amountCents: 70000, paidCents: 70000, status: "paid" });
    const paidCycle = { ...cycles[0], FinancialEntry: paidEntry };
    listFinancialEntries.mockResolvedValue({ data: [paidEntry, ...entries.slice(1)] });
    listBillingCycles.mockResolvedValue({ data: [paidCycle, ...cycles.slice(1)] });

    fireEvent.change(screen.getByLabelText("Forma de pagamento"), { target: { value: "3" } });
    fireEvent.change(screen.getByLabelText("Data do recebimento"), { target: { value: "2026-08-15" } });
    await userEvent.click(screen.getByRole("button", { name: "Confirmar recebimento" }));

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
    await waitFor(() => expect(createFinancialPayment).toHaveBeenCalledWith(
      expect.objectContaining({
        entry_id: 990,
        patient_id: 30,
        payment_method_id: 3,
        amount_cents: 70000,
        allocation_mode: "manual",
        allocations: [{ entry_id: 901, amount_cents: 70000 }],
      }),
      expect.stringMatching(/\S/),
    ));
    expect(createFinancialPayment.mock.calls[0][0]).not.toHaveProperty("clinic_id");
    await waitFor(() => expect(screen.queryByRole("button", { name: "Registrar recebimento" })).not.toBeInTheDocument());
    expect(listBillingCycles.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it("permite desconto no recebimento agregado de Mensalidades", async () => {
    renderMensalidades();
    await openMariaPayment();

    fireEvent.change(screen.getByLabelText("Forma de pagamento"), { target: { value: "3" } });
    fireEvent.change(screen.getByLabelText("Valor recebido"), { target: { value: "600,00" } });
    fireEvent.change(screen.getByLabelText("Desconto"), { target: { value: "100,00" } });
    fireEvent.change(screen.getByLabelText("Data do recebimento"), { target: { value: "2026-08-15" } });
    expect(screen.getByText("Total final").parentElement).toHaveTextContent("R$ ••••");
    await userEvent.click(screen.getByRole("button", { name: "Confirmar recebimento" }));

    await waitFor(() => expect(createFinancialPayment).toHaveBeenCalledWith(
      expect.objectContaining({
        amount_cents: 60000,
        discount_cents: 10000,
        allocation_mode: "manual",
        allocations: [{ entry_id: 901, amount_cents: 60000 }],
      }),
      expect.stringMatching(/\S/),
    ));
  });

  it("mantém a UI no erro de carregamento e apresenta o erro da prévia", async () => {
    listBillingCycles.mockRejectedValueOnce(new Error("offline"));
    renderMensalidades();
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Não foi possível carregar as mensalidades."));
    expect(await screen.findByText("Nenhuma mensalidade encontrada no periodo.")).toBeInTheDocument();

    cleanup();
    jest.clearAllMocks();
    listBillingCycles.mockResolvedValue({ data: cycles });
    listFinancialEntries.mockResolvedValue({ data: entries });
    listFinancialCategories.mockResolvedValue({ data: [] });
    listPaymentMethods.mockResolvedValue({ data: [{ id: 3, name: "Pix", is_active: true }] });
    listServicePrices.mockResolvedValue({ data: [] });
    listFinancialPayments.mockResolvedValue({ data: [] });
    listPatientCredits.mockResolvedValue({ data: [] });
    getFinancialRevenuesSummary.mockResolvedValue({ data: { summary: {}, patients: [] } });
    axios.get.mockImplementation((url, options) => {
      if (url === "/patients") return Promise.resolve({ data: patients });
      if (url === "/sessions" && options?.params?.from) {
        const error = new Error("preview unavailable");
        error.response = { data: { message: "Sessões indisponíveis" } };
        return Promise.reject(error);
      }
      return Promise.resolve({ data: [] });
    });
    renderMensalidades();
    await openMariaDetail();
    await userEvent.click(within(screen.getByText("Recovery").closest("tr"))
      .getByRole("button", { name: "Ver sessões" }));
    expect(await screen.findByText("Sessões indisponíveis")).toBeInTheDocument();
  });

  it("valida forma de pagamento e mantém o modal aberto quando a API falha", async () => {
    renderMensalidades();
    await openMariaPayment();

    await userEvent.click(screen.getByRole("button", { name: "Confirmar recebimento" }));
    expect(toast.error).toHaveBeenCalledWith("Selecione a forma de pagamento.");
    expect(createFinancialEntry).not.toHaveBeenCalled();

    createFinancialPayment.mockRejectedValueOnce({
      response: { data: { message: "Recebimento recusado" } },
    });
    fireEvent.change(screen.getByLabelText("Forma de pagamento"), { target: { value: "3" } });
    await userEvent.click(screen.getByRole("button", { name: "Confirmar recebimento" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Recebimento recusado"));
    expect(screen.getByRole("heading", { name: "Registrar recebimento" })).toBeInTheDocument();
  });
});
