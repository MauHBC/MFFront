/* eslint-env jest */
import "@testing-library/jest-dom";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { toast } from "react-toastify";

import Financeiro from "./index";
import { useAuthorization } from "../../contexts/AuthorizationContext";
import axios from "../../services/axios";
import {
  activateClinicExpenseCategory,
  createClinicExpense,
  createClinicExpenseWithPayment,
  createClinicExpenseCategory,
  createPaymentMethod,
  deactivateClinicExpenseCategory,
  deleteClinicExpense,
  getClinicExpenseAlerts,
  getFinancialOverview,
  listClinicExpenseCategories,
  listClinicExpenses,
  listFinancialCategories,
  listFinancialRecurringExpenses,
  listPaymentMethods,
  payClinicExpense,
  unpayClinicExpense,
  updateClinicExpense,
  updateClinicExpenseCategory,
  updatePaymentMethod,
} from "../../services/financial";
import {
  createSpecialSchedulingEvent,
  listSpecialSchedulingEvents,
} from "../../services/scheduling";

jest.mock("react-toastify", () => ({
  toast: { error: jest.fn(), success: jest.fn(), info: jest.fn() },
}));

jest.mock("../../contexts/AuthorizationContext", () => ({
  useAuthorization: jest.fn(),
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
  createClinicExpenseWithPayment: jest.fn(),
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

const pendingExpense = {
  id: 101,
  name: "Aluguel",
  category_id: 7,
  category_name: "Estrutura",
  amount_cents: 250000,
  reference_month: "2026-08-01",
  due_date: "2026-08-15",
  paid_at: null,
  notes: "Sala principal",
  recurrence_type: "none",
};

const paidExpense = {
  id: 102,
  name: "Internet",
  category_id: 8,
  category_name: "Operacional",
  amount_cents: 15000,
  paid_amount_cents: 15000,
  reference_month: "2026-08-01",
  due_date: "2026-08-10",
  paid_at: "2026-08-10",
  payment_notes: "Pix",
  recurrence_type: "none",
};

const expenseCategories = [
  { id: 7, name: "Estrutura", active: true },
  { id: 8, name: "Operacional", active: false },
];

const paymentMethods = [
  { id: 3, name: "Pix", is_active: true },
  { id: 4, name: "Cheque", is_active: false },
];

const renderFinanceiro = (pathname) => render(
  <MemoryRouter initialEntries={[pathname]}>
    <Financeiro />
  </MemoryRouter>,
);

const FINANCIAL_TEST_NOW = new Date("2026-08-20T12:00:00-03:00");

const openExpenseAction = async (expenseName, actionName) => {
  const row = (await screen.findByText(expenseName)).closest("tr");
  await userEvent.click(within(row).getByText("Ações"));
  await userEvent.click(within(row).getByRole("button", { name: actionName }));
};

describe("Financeiro - caracterização de despesas e configurações publicadas", () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(FINANCIAL_TEST_NOW);
    jest.clearAllMocks();
    useAuthorization.mockReturnValue({
      canAccessModule: jest.fn(() => true),
      hasCapability: jest.fn(() => true),
    });
    window.matchMedia = jest.fn().mockReturnValue({
      matches: false,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      addListener: jest.fn(),
      removeListener: jest.fn(),
    });
    axios.get.mockResolvedValue({ data: [] });
    axios.post.mockResolvedValue({ data: {} });
    axios.put.mockResolvedValue({ data: {} });
    axios.delete.mockResolvedValue({ data: {} });
    getFinancialOverview.mockResolvedValue({
      data: {
        incomeTotal: 175000,
        expenseTotal: 265000,
        periodResult: -90000,
        hasAccounts: true,
        received: 125000,
        receivable: 50000,
        paidExpenses: 15000,
        pendingExpenses: 250000,
        currentResult: 110000,
        pendingBalance: -200000,
      },
    });
    getClinicExpenseAlerts.mockResolvedValue({ data: { dueSoonCount: 3 } });
    listClinicExpenses.mockResolvedValue({
      data: {
        items: [pendingExpense, paidExpense],
        summary: {
          total_cents: 265000,
          pending_cents: 250000,
          paid_cents: 15000,
          overdue_cents: 0,
        },
      },
    });
    listClinicExpenseCategories.mockResolvedValue({ data: expenseCategories });
    listPaymentMethods.mockResolvedValue({ data: paymentMethods });
    [
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
      createPaymentMethod,
      updatePaymentMethod,
    ].forEach((mock) => mock.mockResolvedValue({ data: {} }));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("carrega despesas, categorias, resumo e publica o badge sem chamar áreas legadas", async () => {
    const dispatchSpy = jest.spyOn(window, "dispatchEvent");

    renderFinanceiro("/financeiro/despesas");

    expect(await screen.findByText("Aluguel")).toBeInTheDocument();
    expect(screen.getByText("Internet")).toBeInTheDocument();
    expect(listClinicExpenses).toHaveBeenCalledWith(expect.objectContaining({
      reference_month: expect.stringMatching(/^\d{4}-\d{2}$/),
    }));
    expect(listClinicExpenseCategories).toHaveBeenCalled();
    await waitFor(() => expect(dispatchSpy).toHaveBeenCalledWith(expect.objectContaining({
      type: "multifisio:app-shell:navigation-badge",
      detail: { key: "financial-expenses", value: "3" },
    })));
    expect(listFinancialCategories).not.toHaveBeenCalled();
    expect(listFinancialRecurringExpenses).not.toHaveBeenCalled();
    expect(listSpecialSchedulingEvents).not.toHaveBeenCalled();
    expect(createSpecialSchedulingEvent).not.toHaveBeenCalled();

    dispatchSpy.mockRestore();
  });

  it("cria e edita uma despesa conforme o payload publicado", async () => {
    renderFinanceiro("/financeiro/despesas");
    await screen.findByText("Aluguel");

    await userEvent.click(screen.getByRole("button", { name: "Nova despesa" }));
    fireEvent.change(screen.getByLabelText("Nome da despesa"), { target: { value: "Energia" } });
    fireEvent.change(document.querySelector("select[name='category_id']"), { target: { value: "7" } });
    fireEvent.change(screen.getByLabelText("Valor"), { target: { value: "320,50" } });
    fireEvent.change(screen.getByLabelText("Vencimento"), { target: { value: "2026-08-20" } });
    await userEvent.click(screen.getByRole("button", { name: "Salvar despesa" }));

    await waitFor(() => expect(createClinicExpense).toHaveBeenCalledWith(expect.objectContaining({
      name: "Energia",
      category_id: 7,
      amount_cents: 32050,
      due_date: "2026-08-20",
      recurrence_type: "none",
    })));

    await openExpenseAction("Aluguel", "Editar");
    fireEvent.change(screen.getByLabelText("Nome da despesa"), { target: { value: "Aluguel reajustado" } });
    await userEvent.click(screen.getByRole("button", { name: "Salvar despesa" }));

    await waitFor(() => expect(updateClinicExpense).toHaveBeenCalledWith(101, expect.objectContaining({
      name: "Aluguel reajustado",
      category_id: 7,
      amount_cents: 250000,
      due_date: "2026-08-15",
    })));
    await waitFor(() => expect(screen.queryByRole("heading", { name: "Editar despesa" }))
      .not.toBeInTheDocument());
  });

  it("preenche edição e baixa em centavos exatos, inclusive despesas já pagas", async () => {
    listClinicExpenses.mockResolvedValue({ data: {
      items: [
        { ...pendingExpense, id: 201, name: "Internet aberta", amount_cents: 8690 },
        { ...paidExpense, id: 202, name: "Aluguel pago", amount_cents: 107702, paid_amount_cents: 107702 },
      ],
      summary: {},
    } });
    renderFinanceiro("/financeiro/despesas");

    await openExpenseAction("Internet aberta", "Editar");
    expect(screen.getByLabelText("Valor")).toHaveValue("86,90");
    await userEvent.click(screen.getByRole("button", { name: "Salvar despesa" }));
    await waitFor(() => expect(updateClinicExpense).toHaveBeenCalledWith(201,
      expect.objectContaining({ amount_cents: 8690 })));
    await waitFor(() => expect(screen.queryByRole("heading", { name: "Editar despesa" }))
      .not.toBeInTheDocument());

    await openExpenseAction("Aluguel pago", "Editar");
    expect(screen.getByLabelText("Valor")).toHaveValue("1.077,02");
    expect(screen.getByLabelText("Valor pago")).toHaveValue("1.077,02");
    await userEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    await waitFor(() => expect(screen.queryByRole("heading", { name: "Editar despesa" }))
      .not.toBeInTheDocument());

    await openExpenseAction("Aluguel pago", "Editar pagamento");
    expect(screen.getByLabelText("Valor pago")).toHaveValue("1.077,02");
    await userEvent.click(screen.getByRole("button", { name: "Cancelar" }));

    await openExpenseAction("Internet aberta", "Marcar como pago");
    expect(screen.getByLabelText("Valor pago")).toHaveValue("86,90");
    await userEvent.click(screen.getByRole("button", { name: "Confirmar pagamento" }));
    await waitFor(() => expect(payClinicExpense).toHaveBeenCalledWith(201,
      expect.objectContaining({ paid_amount_cents: 8690 })));
  });

  it("após desfazer a baixa, reabre o valor original para refazê-la", async () => {
    const expense = { ...paidExpense, amount_cents: 8690, paid_amount_cents: 8690 };
    listClinicExpenses.mockResolvedValueOnce({ data: { items: [expense], summary: {} } })
      .mockResolvedValue({ data: { items: [{ ...expense, paid_at: null, paid_amount_cents: null }], summary: {} } });
    renderFinanceiro("/financeiro/despesas");
    await openExpenseAction("Internet", "Desfazer pagamento");
    fireEvent.change(screen.getByLabelText("Motivo"), { target: { value: "Baixa incorreta" } });
    await userEvent.click(screen.getByRole("button", { name: "Confirmar estorno" }));
    await waitFor(() => expect(unpayClinicExpense).toHaveBeenCalled());
    await waitFor(() => expect(within(screen.getByText("Internet").closest("tr"))
      .getByText("Pendente")).toBeInTheDocument());
    await openExpenseAction("Internet", "Marcar como pago");
    expect(screen.getByLabelText("Valor pago")).toHaveValue("86,90");
    await userEvent.click(screen.getByRole("button", { name: "Confirmar pagamento" }));
    await waitFor(() => expect(payClinicExpense).toHaveBeenCalledWith(102,
      expect.objectContaining({ paid_amount_cents: 8690 })));
  });

  const fillNewExpense = async () => {
    await screen.findByText("Aluguel");
    await userEvent.click(screen.getByRole("button", { name: "Nova despesa" }));
    fireEvent.change(screen.getByLabelText("Nome da despesa"), { target: { value: "Energia paga" } });
    fireEvent.change(document.getElementById("clinic-expense-category"), { target: { value: "7" } });
    fireEvent.change(screen.getByLabelText("Valor"), { target: { value: "320,50" } });
    fireEvent.change(screen.getByLabelText("Vencimento"), { target: { value: "2026-08-20" } });
  };

  it("cria e paga em uma única chamada, preserva pagamento e recarrega a despesa paga", async () => {
    listClinicExpenses.mockResolvedValueOnce({ data: { items: [pendingExpense], summary: {} } })
      .mockResolvedValue({ data: { items: [{ ...paidExpense, name: "Energia paga" }], summary: {} } });
    renderFinanceiro("/financeiro/despesas");
    await fillNewExpense();
    fireEvent.change(screen.getByLabelText("Já foi paga?"), { target: { value: "paid" } });
    fireEvent.change(screen.getByLabelText("Data do pagamento"), { target: { value: "2026-08-12" } });
    fireEvent.change(screen.getByLabelText("Observação"), { target: { value: "Pix antecipado" } });
    await userEvent.click(screen.getByRole("button", { name: "Salvar despesa" }));
    await waitFor(() => expect(createClinicExpenseWithPayment).toHaveBeenCalledWith({
      name: "Energia paga", amount_cents: 32050, due_date: "2026-08-20", notes: null,
      category_id: 7, recurrence_type: "none",
      payment: { paid_at: "2026-08-12", paid_amount_cents: 32050, payment_notes: "Pix antecipado" },
    }));
    expect(createClinicExpense).not.toHaveBeenCalled();
    expect(payClinicExpense).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByRole("heading", { name: "Nova despesa" })).not.toBeInTheDocument());
    expect(within(screen.getByText("Energia paga").closest("tr")).getByText("Pago")).toBeInTheDocument();
  });

  it("falha na operação paga mantém o formulário e não tenta cadastrar ou compensar separadamente", async () => {
    createClinicExpenseWithPayment.mockRejectedValueOnce(new Error("Pagamento não concluído"));
    renderFinanceiro("/financeiro/despesas");
    await fillNewExpense();
    fireEvent.change(screen.getByLabelText("Já foi paga?"), { target: { value: "paid" } });
    await userEvent.click(screen.getByRole("button", { name: "Salvar despesa" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(screen.getByRole("heading", { name: "Nova despesa" })).toBeInTheDocument();
    expect(screen.getByLabelText("Nome da despesa")).toHaveValue("Energia paga");
    expect(createClinicExpense).not.toHaveBeenCalled();
    expect(payClinicExpense).not.toHaveBeenCalled();
    expect(deleteClinicExpense).not.toHaveBeenCalled();
    expect(listClinicExpenses).toHaveBeenCalledTimes(1);
  });

  it("exige intenção final e motivo para cadastrar com valor pago diferente", async () => {
    renderFinanceiro("/financeiro/despesas");
    await fillNewExpense();
    fireEvent.change(screen.getByLabelText("Já foi paga?"), { target: { value: "paid" } });
    fireEvent.change(screen.getByLabelText("Valor pago"), { target: { value: "300,00" } });
    await userEvent.click(screen.getByRole("button", { name: "Salvar despesa" }));
    expect(createClinicExpenseWithPayment).not.toHaveBeenCalled();
    expect(screen.getByText(/Pagamento parcial não é suportado/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("checkbox", { name: "Este valor quita integralmente a despesa." }));
    await userEvent.click(screen.getByRole("button", { name: "Salvar despesa" }));
    expect(createClinicExpenseWithPayment).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText("Motivo da quitação com valor diferente"), {
      target: { value: "Desconto negociado" },
    });
    await userEvent.click(screen.getByRole("button", { name: "Salvar despesa" }));
    await waitFor(() => expect(createClinicExpenseWithPayment).toHaveBeenCalledWith(expect.objectContaining({
      payment: expect.objectContaining({ paid_amount_cents: 30000, settlement_type: "adjusted_final", reason: "Desconto negociado" }),
    })));
  });

  it("avisa em vermelho somente para cadastro recorrente pago e envia a combinação correta", async () => {
    renderFinanceiro("/financeiro/despesas");
    await fillNewExpense();
    const warning = "Somente a primeira despesa será marcada como paga.";
    const recurrence = screen.getByLabelText("Essa despesa se repete?");
    const status = screen.getByLabelText("Já foi paga?");
    expect(screen.queryByText(warning)).not.toBeInTheDocument();
    fireEvent.change(recurrence, { target: { value: "monthly" } });
    expect(screen.queryByText(warning)).not.toBeInTheDocument();
    fireEvent.change(status, { target: { value: "paid" } });
    expect(screen.getByText(warning)).toHaveStyle({ color: "#a33b32" });
    fireEvent.change(status, { target: { value: "open" } });
    expect(screen.queryByText(warning)).not.toBeInTheDocument();
    fireEvent.change(status, { target: { value: "paid" } });
    fireEvent.change(recurrence, { target: { value: "none" } });
    expect(screen.queryByText(warning)).not.toBeInTheDocument();
    fireEvent.change(recurrence, { target: { value: "monthly" } });
    await userEvent.click(screen.getByRole("button", { name: "Salvar despesa" }));
    await waitFor(() => expect(createClinicExpenseWithPayment).toHaveBeenCalledWith(expect.objectContaining({
      recurrence_type: "monthly", payment: expect.objectContaining({ paid_amount_cents: 32050 }),
    })));
  });

  it("sem finance settle bloqueia Sim mesmo por evento forçado e permite cadastro aberto", async () => {
    useAuthorization.mockReturnValue({ canAccessModule: jest.fn(() => true), hasCapability: jest.fn(() => false) });
    renderFinanceiro("/financeiro/despesas");
    await fillNewExpense();
    expect(screen.getByRole("option", { name: "Sim", exact: true })).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Já foi paga?"), { target: { value: "paid" } });
    expect(screen.getByLabelText("Já foi paga?")).toHaveValue("open");
    expect(screen.queryByLabelText("Data do pagamento")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Salvar despesa" }));
    await waitFor(() => expect(createClinicExpense).toHaveBeenCalled());
    expect(createClinicExpenseWithPayment).not.toHaveBeenCalled();
  });

  it("paga uma despesa pelo comando publicado", async () => {
    renderFinanceiro("/financeiro/despesas");
    await screen.findByText("Aluguel");

    await openExpenseAction("Aluguel", "Marcar como pago");
    fireEvent.change(screen.getByLabelText("Data do pagamento"), { target: { value: "2026-08-12" } });
    fireEvent.change(screen.getByLabelText("Valor pago"), { target: { value: "2400,00" } });
    fireEvent.change(screen.getByLabelText("Observação"), { target: { value: "Desconto negociado" } });
    await userEvent.click(screen.getByRole("checkbox", { name: "Este valor quita integralmente a despesa." }));
    fireEvent.change(screen.getByLabelText("Motivo da quitação com valor diferente"), {
      target: { value: "Desconto negociado" },
    });
    await userEvent.click(screen.getByRole("button", { name: "Confirmar pagamento" }));

    await waitFor(() => expect(payClinicExpense).toHaveBeenCalledWith(101, {
      paid_at: "2026-08-12",
      paid_amount_cents: 240000,
      payment_notes: "Desconto negociado",
      settlement_type: "adjusted_final",
      reason: "Desconto negociado",
    }));
  });

  it("exige motivo, estorna o pagamento e recarrega a despesa como pendente", async () => {
    listClinicExpenses
      .mockResolvedValueOnce({
        data: {
          items: [paidExpense],
          summary: {
            total_cents: 15000,
            pending_cents: 0,
            paid_cents: 15000,
            overdue_cents: 0,
          },
        },
      })
      .mockResolvedValueOnce({
        data: {
          items: [{
            ...paidExpense,
            status: "open",
            paid_at: null,
            paid_amount_cents: null,
            payment_notes: null,
          }],
          summary: {
            total_cents: 15000,
            pending_cents: 15000,
            paid_cents: 0,
            overdue_cents: 0,
          },
        },
      });

    renderFinanceiro("/financeiro/despesas");
    await screen.findByText("Internet");
    await openExpenseAction("Internet", "Desfazer pagamento");

    expect(screen.getByRole("heading", { name: "Desfazer pagamento" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Confirmar estorno" }));
    expect(toast.error).toHaveBeenCalledWith("Informe o motivo para desfazer o pagamento.");
    expect(unpayClinicExpense).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText("Motivo"), {
      target: { value: "  Pagamento registrado em duplicidade  " },
    });
    await userEvent.click(screen.getByRole("button", { name: "Confirmar estorno" }));

    await waitFor(() => expect(unpayClinicExpense).toHaveBeenCalledWith(102, {
      reason: "Pagamento registrado em duplicidade",
    }));
    expect(deleteClinicExpense).not.toHaveBeenCalled();
    await waitFor(() => expect(within(screen.getByText("Internet").closest("tr"))
      .getByText("Pendente")).toBeInTheDocument());

    await openExpenseAction("Internet", "Excluir");
    expect(deleteClinicExpense).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Excluir despesa" }));
    await waitFor(() => expect(deleteClinicExpense).toHaveBeenCalledWith(102));
  });

  it("cancela o estorno sem chamar o backend", async () => {
    renderFinanceiro("/financeiro/despesas");
    await screen.findByText("Internet");
    await openExpenseAction("Internet", "Desfazer pagamento");

    await userEvent.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(unpayClinicExpense).not.toHaveBeenCalled();
    expect(screen.queryByRole("heading", { name: "Desfazer pagamento" })).not.toBeInTheDocument();
  });

  it("não oferece exclusão direta para despesa paga", async () => {
    renderFinanceiro("/financeiro/despesas");
    const row = (await screen.findByText("Internet")).closest("tr");
    await userEvent.click(within(row).getByText("Ações"));

    expect(within(row).queryByRole("button", { name: "Excluir" })).not.toBeInTheDocument();
    expect(within(row).getByRole("button", { name: "Desfazer pagamento" })).toBeInTheDocument();
  });

  it("exige confirmação, permite cancelar e recarrega lista e resumo após excluir", async () => {
    listClinicExpenses.mockResolvedValueOnce({
      data: {
        items: [pendingExpense],
        summary: {
          total_cents: 250000,
          pending_cents: 250000,
          paid_cents: 0,
          overdue_cents: 0,
        },
      },
    }).mockResolvedValueOnce({
      data: {
        items: [],
        summary: {
          total_cents: 0,
          pending_cents: 0,
          paid_cents: 0,
          overdue_cents: 0,
        },
      },
    });

    renderFinanceiro("/financeiro/despesas");
    await screen.findByText("Aluguel");
    await userEvent.click(screen.getByRole("button", { name: "Mostrar valores financeiros" }));
    expect(within(screen.getByText("Total do mês").parentElement)
      .getByText("R$ 2.500,00")).toBeInTheDocument();
    await openExpenseAction("Aluguel", "Excluir");

    expect(screen.getByText("Esta ação é definitiva.")).toBeInTheDocument();
    expect(screen.getByText("Tem certeza que deseja excluir definitivamente esta despesa?"))
      .toBeInTheDocument();
    const standaloneModalBody = screen.getByText("Tem certeza que deseja excluir definitivamente esta despesa?")
      .parentElement;
    expect(standaloneModalBody).not.toHaveAttribute("style");
    expect(standaloneModalBody).toHaveStyle({ paddingRight: "4px", marginRight: "-4px", overflowY: "auto" });
    expect(screen.queryByRole("radio")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Confirmar exclusão" })).not.toBeInTheDocument();
    expect(deleteClinicExpense).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(deleteClinicExpense).not.toHaveBeenCalled();
    expect(screen.queryByRole("heading", { name: "Excluir despesa" })).not.toBeInTheDocument();

    await openExpenseAction("Aluguel", "Excluir");
    await userEvent.click(screen.getByRole("button", { name: "Excluir despesa" }));
    await waitFor(() => expect(deleteClinicExpense).toHaveBeenCalledWith(101));
    await waitFor(() => expect(listClinicExpenses).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.queryByText("Aluguel")).not.toBeInTheDocument());
    expect(screen.getByText("Nenhuma despesa cadastrada neste mês.")).toBeInTheDocument();
    expect(within(screen.getByText("Total do mês").parentElement)
      .getByText("R$ 0,00")).toBeInTheDocument();
  });

  it("abre recorrente com seleção única padrão e confirma somente a ocorrência selecionada", async () => {
    listClinicExpenses.mockResolvedValueOnce({
      data: {
        items: [{
          ...pendingExpense,
          id: 201,
          name: "Aluguel recorrente",
          recurrence_type: "monthly",
          recurrence_group_id: "expense-group-1",
        }],
        summary: {
          total_cents: 250000,
          pending_cents: 250000,
          paid_cents: 0,
          overdue_cents: 0,
        },
      },
    });

    renderFinanceiro("/financeiro/despesas");
    await openExpenseAction("Aluguel recorrente", "Excluir");

    expect(screen.getByRole("heading", { name: "Excluir despesa recorrente" })).toBeInTheDocument();
    const recurringOptions = screen.getByRole("group", {
      name: "Esta é uma despesa recorrente. Escolha o que deseja excluir:",
    });
    expect(recurringOptions).toBeInTheDocument();
    expect(recurringOptions.parentElement).toHaveStyle({ padding: "4px", margin: "-4px", overflowY: "auto" });
    const single = screen.getByRole("radio", { name: "Excluir somente esta" });
    const future = screen.getByRole("radio", { name: "Excluir esta e lançamentos futuros" });
    expect(screen.getAllByRole("radio")).toHaveLength(2);
    expect(single).toBeChecked();
    expect(future).not.toBeChecked();
    expect(screen.getByText("Remove apenas esta ocorrência.")).toBeInTheDocument();
    expect(screen.getByText(/Lançamentos já pagos serão preservados/)).toBeInTheDocument();
    await userEvent.click(future);
    expect(future).toBeChecked();
    expect(single).not.toBeChecked();
    await userEvent.click(single);
    expect(single).toBeChecked();
    expect(future).not.toBeChecked();
    expect(deleteClinicExpense).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Confirmar exclusão" }));
    await waitFor(() => expect(deleteClinicExpense).toHaveBeenCalledWith(201));
    expect(deleteClinicExpense).toHaveBeenCalledTimes(1);
  });

  it("envia a intenção de excluir futuras, bloqueia enquanto carrega e recarrega após sucesso", async () => {
    const recurring = { ...pendingExpense, recurrence_type: "monthly", name: "Aluguel recorrente" };
    listClinicExpenses.mockResolvedValueOnce({ data: { items: [recurring], summary: {} } })
      .mockResolvedValue({ data: { items: [], summary: {} } });
    let resolveDeletion;
    deleteClinicExpense.mockImplementationOnce(() => new Promise((resolve) => { resolveDeletion = resolve; }));
    renderFinanceiro("/financeiro/despesas");
    await openExpenseAction("Aluguel recorrente", "Excluir");
    expect(within(screen.getByText("Aluguel recorrente").closest("tr")).getByText("Recorrente"))
      .toBeInTheDocument();
    const single = screen.getByRole("radio", { name: "Excluir somente esta" });
    const future = screen.getByRole("radio", { name: "Excluir esta e lançamentos futuros" });
    await userEvent.click(future);
    expect(future).toBeChecked();
    expect(single).not.toBeChecked();
    expect(deleteClinicExpense).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Confirmar exclusão" }));
    expect(deleteClinicExpense).toHaveBeenCalledWith(101, "this_and_future");
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeDisabled();
    expect(single).toBeDisabled();
    expect(future).toBeDisabled();
    expect(screen.getByRole("button", { name: "Excluindo..." })).toBeDisabled();
    await userEvent.click(single);
    await userEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(future).toBeChecked();
    expect(deleteClinicExpense).toHaveBeenCalledTimes(1);
    expect(listClinicExpenses).toHaveBeenCalledTimes(1);
    await act(async () => { resolveDeletion({}); });
    await waitFor(() => expect(listClinicExpenses).toHaveBeenCalledTimes(2));
    expect(screen.queryByRole("heading", { name: "Excluir despesa recorrente" })).not.toBeInTheDocument();
    expect(toast.success).toHaveBeenCalledWith("Despesa excluída com sucesso.");
  });

  it("mantém o modal e permite nova tentativa quando a exclusão futura falha", async () => {
    listClinicExpenses.mockResolvedValue({ data: {
      items: [{ ...pendingExpense, recurrence_type: "monthly" }], summary: {},
    } });
    deleteClinicExpense.mockRejectedValueOnce(new Error("Falha na exclusão"));
    renderFinanceiro("/financeiro/despesas");
    await openExpenseAction("Aluguel", "Excluir");
    await userEvent.click(screen.getByRole("radio", { name: "Excluir esta e lançamentos futuros" }));
    expect(deleteClinicExpense).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Confirmar exclusão" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(screen.getByRole("heading", { name: "Excluir despesa recorrente" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Excluir esta e lançamentos futuros" })).toBeEnabled();
    expect(screen.getByRole("radio", { name: "Excluir esta e lançamentos futuros" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Excluir somente esta" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Confirmar exclusão" })).toBeEnabled();
    expect(listClinicExpenses).toHaveBeenCalledTimes(1);
    expect(toast.success).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(screen.queryByRole("heading", { name: "Excluir despesa recorrente" })).not.toBeInTheDocument();
    expect(deleteClinicExpense).toHaveBeenCalledTimes(1);
  });

  it("cancelar a escolha recorrente não exclui e reabrir restaura somente esta", async () => {
    listClinicExpenses.mockResolvedValue({ data: {
      items: [{ ...pendingExpense, recurrence_type: "monthly" }], summary: {},
    } });
    renderFinanceiro("/financeiro/despesas");
    await openExpenseAction("Aluguel", "Excluir");
    await userEvent.click(screen.getByRole("radio", { name: "Excluir esta e lançamentos futuros" }));
    await userEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(deleteClinicExpense).not.toHaveBeenCalled();
    expect(screen.queryByRole("heading", { name: "Excluir despesa recorrente" })).not.toBeInTheDocument();
    await openExpenseAction("Aluguel", "Excluir");
    expect(screen.getByRole("radio", { name: "Excluir somente esta" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Excluir esta e lançamentos futuros" })).not.toBeChecked();
    expect(deleteClinicExpense).not.toHaveBeenCalled();
  });

  it("oculta gestão e exclusão para usuário sem finance manage", async () => {
    useAuthorization.mockReturnValue({
      canAccessModule: jest.fn((_module, minimum) => minimum === "view"),
      hasCapability: jest.fn(() => false),
    });

    renderFinanceiro("/financeiro/despesas");
    const row = (await screen.findByText("Aluguel")).closest("tr");

    expect(within(row).queryByText("Ações")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Nova despesa" })).not.toBeInTheDocument();
    expect(deleteClinicExpense).not.toHaveBeenCalled();
  });

  it("cria, edita e desativa categorias de despesas", async () => {
    renderFinanceiro("/financeiro/configuracoes/categorias-despesas");
    expect(await screen.findByText("Estrutura")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Nova categoria" }));
    await userEvent.type(screen.getByLabelText("Nome da categoria"), "Contabilidade");
    await userEvent.click(screen.getByRole("button", { name: "Salvar categoria" }));
    await waitFor(() => expect(createClinicExpenseCategory).toHaveBeenCalledWith({
      name: "Contabilidade",
    }));

    const activeRow = screen.getByText("Estrutura").closest("tr");
    await userEvent.click(within(activeRow).getByRole("button", { name: "Editar" }));
    fireEvent.change(screen.getByLabelText("Nome da categoria"), { target: { value: "Estrutura física" } });
    await userEvent.click(screen.getByRole("button", { name: "Salvar categoria" }));
    await waitFor(() => expect(updateClinicExpenseCategory).toHaveBeenCalledWith(7, {
      name: "Estrutura física",
    }));
    await waitFor(() => expect(screen.queryByRole("heading", { name: "Editar categoria" }))
      .not.toBeInTheDocument());

    const refreshedActiveRow = (await screen.findByText("Estrutura")).closest("tr");
    await userEvent.click(within(refreshedActiveRow).getByRole("button", { name: "Desativar" }));
    await waitFor(() => expect(screen.getAllByRole("button", { name: "Desativar" })).toHaveLength(2));
    const deactivateButtons = screen.getAllByRole("button", { name: "Desativar" });
    await userEvent.click(deactivateButtons[deactivateButtons.length - 1]);
    await waitFor(() => expect(deactivateClinicExpenseCategory).toHaveBeenCalledWith(7));
  });

  it("ativa uma categoria de despesa inativa", async () => {
    renderFinanceiro("/financeiro/configuracoes/categorias-despesas");
    const inactiveRow = (await screen.findByText("Operacional")).closest("tr");
    await userEvent.click(within(inactiveRow).getByRole("button", { name: "Ativar" }));
    await waitFor(() => expect(activateClinicExpenseCategory).toHaveBeenCalledWith(8));
  });

  it("lista, cria, edita e ativa formas de pagamento", async () => {
    renderFinanceiro("/financeiro/configuracoes/formas-pagamento");
    expect(await screen.findByText("Pix")).toBeInTheDocument();
    expect(screen.getByText("Cheque")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Nova forma" }));
    await userEvent.type(screen.getByLabelText("Nome"), "Cartão");
    await userEvent.click(screen.getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(createPaymentMethod).toHaveBeenCalledWith({ name: "Cartão" }));

    const pixRow = screen.getByText("Pix").closest("tr");
    await userEvent.click(within(pixRow).getByRole("button", { name: "Editar" }));
    fireEvent.change(screen.getByLabelText("Nome"), { target: { value: "Pix imediato" } });
    await userEvent.click(screen.getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(updatePaymentMethod).toHaveBeenCalledWith(3, {
      name: "Pix imediato",
    }));
    await waitFor(() => expect(screen.queryByRole("heading", { name: "Editar forma de pagamento" }))
      .not.toBeInTheDocument());

    const chequeRow = (await screen.findByText("Cheque")).closest("tr");
    await userEvent.click(within(chequeRow).getByRole("button", { name: "Ativar" }));
    await waitFor(() => expect(updatePaymentMethod).toHaveBeenCalledWith(4, { is_active: true }));
    expect(listFinancialCategories).not.toHaveBeenCalled();
    expect(listFinancialRecurringExpenses).not.toHaveBeenCalled();
    expect(listSpecialSchedulingEvents).not.toHaveBeenCalled();
  });

  it("oculta valores por padrão e os revela somente após ação explícita", async () => {
    renderFinanceiro("/financeiro/visao-geral");

    expect(await screen.findAllByText("R$ ••••")).not.toHaveLength(0);
    expect(screen.queryByText("R$ 1.250,00")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Mostrar valores financeiros" }));
    expect(await screen.findByText("R$ 1.250,00")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ocultar valores financeiros" })).toBeInTheDocument();
  });
});
