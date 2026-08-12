/* eslint-env jest */
import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

import Financeiro from "./index";
import axios from "../../services/axios";
import {
  activateClinicExpenseCategory,
  createClinicExpense,
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

const openExpenseAction = async (expenseName, actionName) => {
  const row = (await screen.findByText(expenseName)).closest("tr");
  await userEvent.click(within(row).getByText("Ações"));
  await userEvent.click(within(row).getByRole("button", { name: actionName }));
};

describe("Financeiro - caracterização de despesas e configurações publicadas", () => {
  beforeEach(() => {
    jest.clearAllMocks();
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

  it("paga uma despesa pelo comando publicado", async () => {
    renderFinanceiro("/financeiro/despesas");
    await screen.findByText("Aluguel");

    await openExpenseAction("Aluguel", "Marcar como pago");
    fireEvent.change(screen.getByLabelText("Data do pagamento"), { target: { value: "2026-08-12" } });
    fireEvent.change(screen.getByLabelText("Valor pago"), { target: { value: "2400,00" } });
    fireEvent.change(screen.getByLabelText("Observação"), { target: { value: "Desconto negociado" } });
    await userEvent.click(screen.getByRole("button", { name: "Confirmar pagamento" }));

    await waitFor(() => expect(payClinicExpense).toHaveBeenCalledWith(101, {
      paid_at: "2026-08-12",
      paid_amount_cents: 240000,
      payment_notes: "Desconto negociado",
    }));
  });

  it("estorna o pagamento de uma despesa pelo comando publicado", async () => {
    renderFinanceiro("/financeiro/despesas");
    await screen.findByText("Internet");
    await openExpenseAction("Internet", "Desfazer pagamento");
    await waitFor(() => expect(unpayClinicExpense).toHaveBeenCalledWith(102));
  });

  it("exclui uma despesa pelo comando publicado", async () => {
    renderFinanceiro("/financeiro/despesas");
    await screen.findByText("Aluguel");
    await openExpenseAction("Aluguel", "Excluir");
    await userEvent.click(screen.getByRole("button", { name: "Excluir despesa" }));
    await waitFor(() => expect(deleteClinicExpense).toHaveBeenCalledWith(101));
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
