import "@testing-library/jest-dom";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import Financeiro from "./index";
import * as financial from "../../services/financial";
import * as credit from "../../services/financialCredit";
import axios from "../../services/axios";

jest.mock("../../services/financial");
jest.mock("../../services/financialCredit");
jest.mock("react-toastify", () => ({ toast: { error: jest.fn(), success: jest.fn(), info: jest.fn() } }));
jest.mock("../../services/axios", () => ({
  __esModule: true, default: { get: jest.fn() },
  getUserFacingApiError: (error, fallback) => error?.response?.data?.message || fallback,
}));
jest.mock("../../contexts/AuthorizationContext", () => {
  const context = { clinic_id: 77 };
  return { useAuthorization: () => ({ context, canAccessModule: () => true, hasCapability: () => true }) };
});

const patient = { id: 30, name: "TESTE Maurício misto", full_name: "TESTE Maurício misto" };
const makeCharge = (kind, sourceId, amount, reference, due, entries, extra = {}) => ({
  key: `${kind}-${sourceId}`, kind, sourceId, service_name: kind === "billing_cycle" ? "Recovery" : "Fisioterapia",
  reference_date: reference, due_date: due, due_dates: [{ due_date: due, open_cents: amount }],
  amount_cents: amount, paid_cents: 0, open_cents: amount, overdue_cents: amount,
  financial_status: "pending", entries, sessions: [], ...extra,
});
const monthly = makeCharge("billing_cycle", 11, 48000, "2026-09-01", "2026-09-05",
  [{ entryId: 101, openCents: 48000, reference_date: "2026-09-01" }],
  { billing_cycle_id: 11, cycle_start: "2026-09-01", cycle_end: "2026-09-30" });
const pkg = makeCharge("series", 21, 20000, "2026-09-22", "2026-09-22", [
  { entryId: 201, openCents: 10000, reference_date: "2026-09-22" },
  { entryId: 202, openCents: 10000, reference_date: "2026-10-20" },
], { total_sessions: 2, overdue_cents: 10000,
  due_dates: [{ due_date: "2026-09-22", open_cents: 10000 }, { due_date: "2026-10-20", open_cents: 10000 }],
  sessions: [{ id: 801, starts_at: "2026-09-22T12:00:00Z", status: "scheduled", professional: { id: 8, name: "Profissional teste" } },
    { id: 802, starts_at: "2026-10-20T12:00:00Z", status: "scheduled", professional: { id: 8, name: "Profissional teste" } }] });
const single = makeCharge("entry", 301, 10000, "2026-09-25", "2026-10-25",
  [{ entryId: 301, openCents: 10000, reference_date: "2026-09-25" }], { overdue_cents: 0 });
let detail;
const makeDetail = (charges = [single, pkg, monthly], balance = 0) => ({
  origin: "all", patient, month: "2026-09", charges,
  summary: charges.reduce((sum, charge) => ({ total: sum.total + charge.amount_cents,
    received: sum.received + charge.paid_cents, pending: sum.pending + charge.open_cents,
    creditAvailable: balance }), { total: 0, received: 0, pending: 0, creditAvailable: balance }),
  entries: [], sessions: charges.flatMap((charge) => charge.sessions), series: [], packages: [],
  payments: [], credits: [], financial_history: [], pending_resolutions: [],
});
const open = (query = "?month=2026-09") => render(<MemoryRouter initialEntries={[`/financeiro/receitas${query}`]}><Financeiro /></MemoryRouter>);
const openPatient = async () => {
  const row = (await screen.findByText(patient.full_name)).closest("tr");
  await userEvent.click(within(row).getByRole("button", { name: "Detalhes" }));
  await waitFor(() => expect(screen.getByRole("button", { name: "Registrar recebimento" })).toBeEnabled());
};
const payment = async (amount) => {
  await userEvent.click(screen.getByRole("button", { name: "Avançar" }));
  fireEvent.change(screen.getByLabelText("Valor recebido"), { target: { value: amount } });
  fireEvent.change(screen.getByLabelText("Data do recebimento"), { target: { value: "2026-09-30" } });
  fireEvent.change(screen.getByLabelText("Forma de pagamento"), { target: { value: "3" } });
  await userEvent.click(screen.getByRole("button", { name: "Confirmar recebimento" }));
  await waitFor(() => expect(financial.createFinancialPayment).toHaveBeenCalled());
};
const typeFilters = [["Todos", "all"], ["Mensalidade", "billing_cycle"], ["Pacote", "series"], ["Avulsa", "entry"]];
const expectActiveType = (activeLabel) => {
  typeFilters.forEach(([label]) => {
    expect(screen.getByRole("button", { name: label, exact: true }))
      .toHaveAttribute("aria-pressed", String(label === activeLabel));
  });
  expect(screen.getAllByRole("button", { pressed: true })
    .filter((button) => typeFilters.some(([label]) => button.textContent === label))).toHaveLength(1);
};
const deferredResponse = () => {
  let resolve;
  const promise = new Promise((complete) => { resolve = complete; });
  return { promise, resolve };
};
const cycleSession = (id, extra = {}) => ({
  id, clinic_id: 77, patient_id: patient.id, billing_cycle_id: monthly.sourceId,
  billing_mode: "covered_by_plan", starts_at: "2026-09-08T12:30:00.000Z", status: "scheduled",
  professional: { id: 8, name: `Profissional da sessão ${id}` }, ...extra,
});
const mockSessionsRequest = (implementation) => {
  axios.get.mockImplementation((url, options) => (url === "/sessions"
    ? implementation(options) : Promise.resolve({ data: [patient] })));
};
const openChargeDetails = async (serviceName = "Recovery") => {
  const row = (await screen.findByText(serviceName)).closest("tr");
  await userEvent.click(within(row).getByRole("button", { name: "Detalhes" }));
  return screen.findByRole("dialog");
};
const expectCompactChargeDetails = (dialog) => {
  expect(within(dialog).queryByText(/Financeiro da cobrança|Distribuição das/)).not.toBeInTheDocument();
  ["Valor", "Pago", "A receber"].forEach((label) => {
    expect(within(dialog).queryByText(label, { exact: true })).not.toBeInTheDocument();
  });
  expect(within(dialog).queryByText(/^\d+ sessões?$/)).not.toBeInTheDocument();
};
const expectResultsHeading = (period, title = "Resumo por paciente") => {
  const lines = document.querySelectorAll("[data-revenue-results-heading]");
  expect(lines).toHaveLength(1);
  const heading = within(lines[0]).getByRole("heading", { name: `${title} - ${period}`, exact: true });
  expect(heading).toBeVisible();
  expect(heading.textContent).toBe(`${title} - ${period}`);
  expect(within(lines[0]).getAllByRole("heading")).toHaveLength(1);
  expect(screen.queryByLabelText("Competência dos resultados")).not.toBeInTheDocument();
  return lines[0].parentElement;
};
const expectSingleSessionHeader = (dialog) => {
  const body = within(dialog).getByRole("region", { name: "Conteúdo dos detalhes" });
  const tables = within(dialog).getAllByRole("table");
  expect(tables).toHaveLength(1);
  expect(tables[0].parentElement).toBe(body);
  expect(tables[0].querySelectorAll("thead")).toHaveLength(1);
  expect(within(dialog).getAllByRole("columnheader").map((header) => header.textContent))
    .toEqual(["Data", "Profissional", "Status"]);
  within(dialog).getAllByRole("columnheader").forEach((header) => {
    expect(header).toHaveAttribute("scope", "col");
  });
};

beforeEach(() => {
  jest.clearAllMocks();
  detail = makeDetail();
  Object.values(financial).forEach((fn) => { if (jest.isMockFunction(fn)) fn.mockResolvedValue({ data: [] }); });
  financial.getFinancialRevenuesSummary.mockImplementation(async () => ({ data: {
    origin: "all", month: "2026-09", summary: detail.summary,
    patients: [{ patient_id: patient.id, patient_name: patient.full_name, ...detail.summary,
      entries_count: detail.charges.length, reference_date: "2026-09-01", due_date: "2026-09-05", overdue_cents: 58000 }],
    professionals: [{ id: 8, name: "Profissional teste" }],
  } }));
  financial.getFinancialRevenuePatientDetail.mockImplementation(async () => ({ data: detail }));
  financial.listPaymentMethods.mockResolvedValue({ data: [{ id: 3, name: "Pix", is_active: true }] });
  financial.createFinancialEntry.mockResolvedValue({ data: { id: 900 } });
  financial.createFinancialPayment.mockResolvedValue({ data: { id: 901 } });
  axios.get.mockResolvedValue({ data: [patient] });
  window.matchMedia = jest.fn().mockReturnValue({ matches: false, addEventListener: jest.fn(), removeEventListener: jest.fn() });
});

test("uma lista com valores visíveis, detalhe misto e colunas aprovadas; filtro de tipo não reduz destinos", async () => {
  open();
  expect(screen.getByRole("button", { name: "Todos", exact: true })).toHaveAttribute("aria-pressed", "true");
  expect(screen.queryByRole("combobox", { name: "Tipo de cobrança" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Por sessão" })).not.toBeInTheDocument();
  const patientRow = (await screen.findByText(patient.full_name)).closest("tr");
  expect(patientRow).toHaveTextContent("R$ 780,00");
  expect(screen.queryByRole("button", { name: /(?:Mostrar|Ocultar) valores financeiros/ }))
    .not.toBeInTheDocument();
  expect(screen.queryAllByText(/R\$\s*•/)).toHaveLength(0);
  await openPatient();
  expect(financial.getFinancialRevenuePatientDetail).toHaveBeenCalledWith("30", expect.any(String), "month", "all");
  expect(screen.getAllByRole("columnheader").map((cell) => cell.textContent)).toEqual([
    "Data", "Serviço", "Vencimento", "Valor", "Pago", "A receber", "Situação", "Ações",
  ]);
  expect(screen.getAllByRole("row")).toHaveLength(4);
  [
    ["Recovery", "Mensalidade"], ["Fisioterapia", "Pacote"], ["Fisioterapia", "Avulsa"],
  ].forEach(([serviceName, label]) => {
    const tag = screen.getByText(label, { selector: "span" });
    const serviceCell = tag.closest("td");
    const name = within(serviceCell).getByText(serviceName);
    expect(tag.tagName).toBe("SPAN");
    expect(tag.closest("button, a, [role=button]")).toBeNull();
    expect(tag).not.toHaveAttribute("tabindex");
    expect(name.compareDocumentPosition(tag)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });
  const packageRow = screen.getByText("Pacote", { selector: "span" }).closest("tr");
  expect(packageRow).toHaveTextContent("R$ 200,00");
  expect(within(packageRow).getAllByRole("cell")[2].textContent).toBe("22/09/2026");
  expect(within(packageRow).getAllByRole("cell")[2].childElementCount).toBe(0);
  expect(packageRow).toHaveTextContent("22/09/2026");
  await userEvent.click(within(packageRow).getByRole("button", { name: "Detalhes" }));
  const packageDialog = await screen.findByRole("dialog");
  expect(within(packageDialog).getByText("20/10/2026", { selector: "dd" })).toBeVisible();
  await userEvent.click(screen.getByRole("button", { name: "Fechar" }));
  await userEvent.click(screen.getByRole("button", { name: "Mensalidade", exact: true }));
  expect(screen.getAllByRole("row")).toHaveLength(2);
  await userEvent.click(screen.getByRole("button", { name: "Registrar recebimento" }));
  expect(screen.getAllByRole("checkbox")).toHaveLength(3);
  expect(screen.getAllByRole("checkbox").every((input) => !input.checked)).toBe(true);
});

test("quatro botões exclusivos mantêm parâmetros, período, busca e status financeiro", async () => {
  open();
  await screen.findByText(patient.full_name);
  expect(within(screen.getByRole("group", { name: "Tipo de cobrança" })).getAllByRole("button")
    .map((button) => button.textContent)).toEqual(typeFilters.map(([label]) => label));
  expectActiveType("Todos");
  fireEvent.change(screen.getByLabelText("Pesquisar paciente"), { target: { value: "TESTE" } });
  fireEvent.change(screen.getByLabelText("Status financeiro"), { target: { value: "overdue" } });
  const changeType = async ([label, chargeType]) => {
    await userEvent.click(screen.getByRole("button", { name: label, exact: true }));
    expectActiveType(label);
    await waitFor(() => expect(financial.getFinancialRevenuesSummary).toHaveBeenLastCalledWith(
      "2026-09", "month", { origin: "all", charge_type: chargeType },
    ));
    expect(screen.getByLabelText("Pesquisar paciente")).toHaveValue("TESTE");
    expect(screen.getByLabelText("Status financeiro")).toHaveValue("overdue");
    expect(screen.getByLabelText("Selecionar mes e ano")).toHaveValue("2026-09");
  };
  await changeType(typeFilters[1]);
  await changeType(typeFilters[2]);
  await changeType(typeFilters[3]);
  await changeType(typeFilters[0]);
  await userEvent.click(screen.getByRole("button", { name: "Visão anual" }));
  await userEvent.click(screen.getByRole("button", { name: "Pacote", exact: true }));
  expectActiveType("Pacote");
  await waitFor(() => expect(financial.getFinancialRevenuesSummary).toHaveBeenLastCalledWith(
    "2026", "year", { origin: "all", charge_type: "series" },
  ));
});

test("clicar no tipo ativo preserva profissional e trocar tipo mantém a limpeza existente", async () => {
  open();
  await screen.findByText(patient.full_name);
  await userEvent.click(screen.getByRole("button", { name: "Pacote", exact: true }));
  fireEvent.change(screen.getByLabelText("Profissional"), { target: { value: "8" } });
  await waitFor(() => expect(financial.getFinancialRevenuesSummary).toHaveBeenLastCalledWith(
    "2026-09", "month", { origin: "all", charge_type: "series", professional_id: "8" },
  ));
  await userEvent.click(screen.getByRole("button", { name: "Pacote", exact: true }));
  expect(screen.getByLabelText("Profissional")).toHaveValue("8");
  expectActiveType("Pacote");
  await userEvent.click(screen.getByRole("button", { name: "Avulsa", exact: true }));
  expect(screen.getByLabelText("Profissional")).toHaveValue("");
  expectActiveType("Avulsa");
  await waitFor(() => expect(financial.getFinancialRevenuesSummary).toHaveBeenLastCalledWith(
    "2026-09", "month", { origin: "all", charge_type: "entry" },
  ));
});

test.each([monthly, pkg, single].flatMap((charge) => ["pending", "partial", "paid"].map((status) => [charge.kind, status, charge])))
  ("%s %s mostra o vencimento recebido, sem saldo ou alerta na célula", async (kind, status, charge) => {
    const factor = { pending: 1, partial: 0.5, paid: 0 }[status];
    const openCents = charge.amount_cents * factor;
    const name = kind === "billing_cycle" ? "Plano Recovery 480" : `Serviço ${kind}`;
    detail = makeDetail([{
      ...charge, service_name: name, due_date: "2026-10-07", financial_status: status,
      open_cents: openCents, paid_cents: charge.amount_cents - openCents, overdue_cents: openCents,
      entries: factor ? charge.entries.map((entry) => ({ ...entry, openCents: entry.openCents * factor })) : [],
    }]);
    open("?month=2026-09&patient_id=30");
    const row = (await screen.findByText(name)).closest("tr");
    const due = within(row).getAllByRole("cell")[2];
    expect(due.textContent).toBe("07/10/2026");
    expect(due.childElementCount).toBe(0);
    expect(within(row).getAllByRole("cell")[1]).toHaveTextContent(name);
    expect(within(row).getAllByRole("cell")[6])
      .toHaveTextContent({ pending: "Pendente", partial: "Parcial", paid: "Pago" }[status]);
    expect(row).not.toHaveTextContent("em atraso");
  });

test.each([monthly, pkg, single])("$kind sem vencimento não usa referência, ciclo ou sessão como substitutos", async (charge) => {
  const name = `Sem vencimento ${charge.kind}`;
  detail = makeDetail([{ ...charge, service_name: name, due_date: null }]);
  open("?month=2026-09&patient_id=30");
  const due = within((await screen.findByText(name)).closest("tr")).getAllByRole("cell")[2];
  expect(due.textContent).toBe("-");
  expect(due.childElementCount).toBe(0);
});

test("lista de pacientes sem vencimento mantém ausência, apesar de referência e atraso calculado", async () => {
  financial.getFinancialRevenuesSummary.mockResolvedValue({ data: {
    origin: "all", month: "2026-09", summary: detail.summary,
    patients: [{ patient_id: patient.id, patient_name: patient.full_name, ...detail.summary,
      entries_count: 3, reference_date: "2026-09-01", due_date: null, overdue_cents: 58000 }],
  } });
  open();
  const row = (await screen.findByText(patient.full_name)).closest("tr");
  const cells = within(row).getAllByRole("cell");
  expect(cells[1]).toHaveTextContent("01/09/2026");
  expect(cells[2].textContent).toBe("-");
  expect(cells[2].childElementCount).toBe(0);
  expect(row).not.toHaveTextContent("em atraso");
});

test.each([["pendente", 0], ["parcial", 20000], ["pago", 78000]])
  ("lista de pacientes com saldo %s preserva vencimento recebido e somente data na célula", async (label, received) => {
    const summary = { total: 78000, received, pending: 78000 - received };
    financial.getFinancialRevenuesSummary.mockResolvedValue({ data: {
      origin: "all", month: "2026-09", summary,
      patients: [{ patient_id: patient.id, patient_name: patient.full_name, ...summary,
        entries_count: 3, reference_date: "2026-09-01", due_date: "2026-10-07", overdue_cents: summary.pending }],
    } });
    open();
    const row = (await screen.findByText(patient.full_name)).closest("tr");
    const due = within(row).getAllByRole("cell")[2];
    expect(due.textContent).toBe("07/10/2026");
    expect(due.childElementCount).toBe(0);
    expect(row).not.toHaveTextContent("em atraso");
  });

test("mensalidade 480 selecionada, recebimento 680: só ela recebe e excedente não paga avulsa", async () => {
  open(); await openPatient();
  await userEvent.click(screen.getByRole("button", { name: "Registrar recebimento" }));
  await userEvent.click(screen.getByRole("checkbox", { name: /Mensalidade · Recovery/ }));
  await payment("680,00");
  expect(financial.createFinancialPayment).toHaveBeenCalledWith(expect.objectContaining({
    amount_cents: 68000, allocation_mode: "manual", allocations: [{ entry_id: 101, amount_cents: 48000 }],
    receipt_groups: [{ kind: "billing_cycle", id: 11 }],
  }), expect.any(String));
  expect(financial.listFinancialEntries).not.toHaveBeenCalled();
});

test("seleção mista ordena grupos financeiros sem intercalar sessões do pacote", async () => {
  open(); await openPatient();
  await userEvent.click(screen.getByRole("button", { name: "Registrar recebimento" }));
  screen.getAllByRole("checkbox").forEach((input) => fireEvent.click(input));
  await payment("730,00");
  expect(financial.createFinancialPayment).toHaveBeenCalledWith(expect.objectContaining({
    receipt_groups: [{ kind: "billing_cycle", id: 11 }, { kind: "series", id: 21 }, { kind: "entry", id: 301 }],
    allocations: [{ entry_id: 101, amount_cents: 48000 }, { entry_id: 201, amount_cents: 10000 },
      { entry_id: 202, amount_cents: 10000 }, { entry_id: 301, amount_cents: 5000 }],
  }), expect.any(String));
});

test("sem seleção, crédito integral sem âncora nem desconto", async () => {
  open(); await openPatient();
  await userEvent.click(screen.getByRole("button", { name: "Registrar recebimento" }));
  await payment("680,00");
  expect(financial.createFinancialEntry).not.toHaveBeenCalled();
  expect(financial.createFinancialPayment).toHaveBeenCalledWith(expect.objectContaining({
    receipt_intent: "credit_only", allocation_mode: "none", amount_cents: 68000, allocations: [],
  }), expect.any(String));
});

test("link antigo de mensalidades abre o mesmo detalhe e consulta origin all", async () => {
  open("?view=mensalidades&month=2026-09&patient_id=30");
  await screen.findByText("Recovery");
  expect(screen.getByRole("button", { name: "Mensalidade", exact: true })).toHaveAttribute("aria-pressed", "true");
  expect(financial.getFinancialRevenuePatientDetail).toHaveBeenCalledWith("30", "2026-09", "month", "all");
  expect(financial.listBillingCycles).not.toHaveBeenCalled();
});

test("erro no detalhe não vira crédito zero, lista vazia ou operação disponível", async () => {
  financial.getFinancialRevenuePatientDetail.mockRejectedValue(new Error("offline"));
  open();
  await userEvent.click(within((await screen.findByText(patient.full_name)).closest("tr")).getByRole("button", { name: "Detalhes" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Não foi possível carregar os detalhes");
  expect(screen.getByRole("button", { name: "Registrar recebimento" })).toBeDisabled();
  expect(screen.getByText("Crédito disponível").parentElement).toHaveTextContent("—");
  expect(screen.queryByText(/Nenhuma cobrança neste filtro/)).not.toBeInTheDocument();
});

test("Histórico deduplica operação mista e crédito usa todos os destinos", async () => {
  const receipt = { id: "receipt:701", type: "RECEIPT", occurred_at: "2026-09-30T12:00:00Z", amount_cents: 68000,
    payment_method_name: "Pix", source: { payment_id: 701 } };
  detail = { ...makeDetail(undefined, 20000), financial_history: [receipt, receipt] };
  credit.getFinancialCreditDestinations.mockResolvedValue({ data: { patient, credit_available_cents: 20000, groups: [] } });
  open(); await openPatient();
  await userEvent.click(screen.getByRole("button", { name: "Histórico" }));
  expect(screen.getAllByRole("row")).toHaveLength(2);
  expect(screen.getByText("Pix")).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Usar crédito" }));
  await waitFor(() => expect(credit.getFinancialCreditDestinations).toHaveBeenCalledWith(expect.objectContaining({ patient_id: 30, destination_type: "all" })));
});

test("troca de período invalida consulta pendente e ignora a resposta antiga", async () => {
  let resolvePrevious;
  const pending = new Promise((resolve) => { resolvePrevious = resolve; });
  const october = makeDetail([{ ...single, service_name: "Avulsa de outubro", reference_date: "2026-10-25" }]);
  financial.getFinancialRevenuePatientDetail.mockImplementation(async (id, period) => (
    period === "2026-09" ? pending : { data: october }
  ));
  open("?month=2026-09&patient_id=30");
  await waitFor(() => expect(financial.getFinancialRevenuePatientDetail).toHaveBeenCalledWith("30", "2026-09", "month", "all"));
  fireEvent.change(screen.getByLabelText("Selecionar mes e ano"), { target: { value: "2026-10" } });
  expect(await screen.findByText("Avulsa de outubro")).toBeVisible();
  await act(async () => resolvePrevious({ data: detail }));
  expect(screen.getByText("Avulsa de outubro")).toBeVisible();
  expect(screen.queryByText("Recovery")).not.toBeInTheDocument();
});

test("novo período pode ser consultado após erro sem permanecer preso ao erro anterior", async () => {
  financial.getFinancialRevenuePatientDetail.mockRejectedValueOnce(new Error("offline"))
    .mockImplementation(async () => ({ data: detail }));
  open("?month=2026-09&patient_id=30");
  await screen.findByRole("alert");
  fireEvent.change(screen.getByLabelText("Selecionar mes e ano"), { target: { value: "2026-10" } });
  expect(await screen.findByText("Recovery")).toBeVisible();
  expect(financial.getFinancialRevenuePatientDetail).toHaveBeenLastCalledWith("30", "2026-10", "month", "all");
});

describe("competência somente no título existente dos resultados da consulta", () => {
  test.each([
    ["mês", "?month=2026-09", "Setembro de 2026", "2026-09", "month"],
    ["ano", "?year=2026", "2026", "2026", "year"],
  ])("%s mantém a competência no título da lista, paciente, Histórico e filtro vazio", async (_, query, label, period, mode) => {
    detail = makeDetail([monthly]);
    open(query);
    await screen.findByText(patient.full_name);
    expectResultsHeading(label);
    expect(financial.getFinancialRevenuesSummary).toHaveBeenLastCalledWith(period, mode,
      { origin: "all", charge_type: "all" });
    await openPatient();
    expectResultsHeading(label, patient.full_name);
    expect(financial.getFinancialRevenuePatientDetail).toHaveBeenLastCalledWith("30", period, mode, "all");
    expect(screen.getByText("Recovery")).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: "Histórico" }));
    expectResultsHeading(label, patient.full_name);
    expect(screen.queryByText("Recovery")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Cobranças", exact: true }));
    await userEvent.click(screen.getByRole("button", { name: "Avulsa", exact: true }));
    expect(await screen.findByText("Nenhuma cobrança neste filtro.")).toBeVisible();
    expectResultsHeading(label, patient.full_name);
    expect(financial.createFinancialPayment).not.toHaveBeenCalled();
    expect(financial.createFinancialEntry).not.toHaveBeenCalled();
  });

  test("mês muda imediatamente com a consulta pendente, sem exibir resultados do mês anterior", async () => {
    open();
    await screen.findByText(patient.full_name);
    expectResultsHeading("Setembro de 2026");
    const request = deferredResponse();
    financial.getFinancialRevenuesSummary.mockImplementation(() => request.promise);
    fireEvent.change(screen.getByLabelText("Selecionar mes e ano"), { target: { value: "2026-10" } });
    const results = expectResultsHeading("Outubro de 2026");
    expect(within(results).getByText("Carregando resumo...")).toBeVisible();
    expect(within(results).queryByRole("table")).not.toBeInTheDocument();
    expect(within(results).queryByText(patient.full_name)).not.toBeInTheDocument();
    expect(financial.getFinancialRevenuesSummary).toHaveBeenLastCalledWith("2026-10", "month",
      { origin: "all", charge_type: "all" });
    await act(async () => request.resolve({ data: {
      origin: "all", month: "2026-10", summary: { total: 0, received: 0, pending: 0 }, patients: [],
    } }));
    expectResultsHeading("Outubro de 2026");
    expect(within(results).getByText("Nenhuma cobrança no período. Pesquise um paciente para registrar crédito."))
      .toBeVisible();
  });

  test("troca para visão anual e escolha de ano atualizam o título e parâmetros, sem resultados antigos", async () => {
    open();
    await screen.findByText(patient.full_name);
    await userEvent.click(screen.getByRole("button", { name: "Visão anual" }));
    await screen.findByText(patient.full_name);
    expectResultsHeading("2026");
    expect(screen.getByLabelText("Selecionar ano")).toHaveValue("2026");
    expect(financial.getFinancialRevenuesSummary).toHaveBeenLastCalledWith("2026", "year",
      { origin: "all", charge_type: "all" });
    const request = deferredResponse();
    financial.getFinancialRevenuesSummary.mockImplementation(() => request.promise);
    fireEvent.change(screen.getByLabelText("Selecionar ano"), { target: { value: "2027" } });
    const results = expectResultsHeading("2027");
    expect(within(results).getByText("Carregando resumo...")).toBeVisible();
    expect(within(results).queryByRole("table")).not.toBeInTheDocument();
    expect(financial.getFinancialRevenuesSummary).toHaveBeenLastCalledWith("2027", "year",
      { origin: "all", charge_type: "all" });
    await act(async () => request.resolve({ data: {
      origin: "all", year: "2027", summary: { total: 0, received: 0, pending: 0 }, patients: [],
    } }));
    expectResultsHeading("2027");
    expect(within(results).getByText("Nenhuma cobrança no período. Pesquise um paciente para registrar crédito."))
      .toBeVisible();
  });

  test("Histórico não exibe movimento antigo sob a nova competência enquanto carrega o detalhe", async () => {
    detail = { ...makeDetail(), financial_history: [{
      id: "receipt:701", type: "RECEIPT", occurred_at: "2026-09-30T12:00:00Z", amount_cents: 68000,
      payment_method_name: "Recebimento de setembro", source: { payment_id: 701 },
    }] };
    open("?month=2026-09&patient_id=30");
    await screen.findByText("Recovery");
    await userEvent.click(screen.getByRole("button", { name: "Histórico" }));
    const receiptRow = screen.getByText("Recebimento de setembro").closest("tr");
    expect(receiptRow).toBeVisible();
    expect(within(receiptRow).getByText("R$ 680,00")).toBeVisible();
    const request = deferredResponse();
    financial.getFinancialRevenuePatientDetail.mockImplementation(() => request.promise);
    fireEvent.change(screen.getByLabelText("Selecionar mes e ano"), { target: { value: "2026-10" } });
    expectResultsHeading("Outubro de 2026", patient.full_name);
    expect(screen.queryByText("Recebimento de setembro")).not.toBeInTheDocument();
    expect(screen.queryByText("Recovery")).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("Carregando cobranças do paciente...")).toBeVisible());
    expect(financial.getFinancialRevenuePatientDetail).toHaveBeenLastCalledWith("30", "2026-10", "month", "all");
    await act(async () => request.resolve({ data: { ...makeDetail([]), month: "2026-10" } }));
    expectResultsHeading("Outubro de 2026", patient.full_name);
    expect(screen.queryByText("Recebimento de setembro")).not.toBeInTheDocument();
    expect(screen.queryByText("Carregando cobranças do paciente...")).not.toBeInTheDocument();
  });

});

test("resumo financeiro incompleto mostra erro em vez de valores zerados", async () => {
  financial.getFinancialRevenuesSummary.mockResolvedValue({ data: { origin: "all", summary: {}, patients: [] } });
  open();
  expect(await screen.findByRole("alert")).toHaveTextContent("Não foi possível carregar o resumo");
  expect(screen.queryByText(/Nenhuma cobrança no período/)).not.toBeInTheDocument();
});

test("destino aberto sem composição não deixa outra cobrança selecionada por exclusão", async () => {
  detail = makeDetail([{ ...monthly, entries: [] }, single]);
  open("?month=2026-09&patient_id=30");
  expect(await screen.findByRole("alert")).toHaveTextContent("Não foi possível carregar os detalhes");
  expect(screen.getByRole("button", { name: "Registrar recebimento" })).toBeDisabled();
  expect(screen.queryByRole("button", { name: "Usar crédito" })).not.toBeInTheDocument();
});

describe("Detalhes da cobrança e sessões canônicas da mensalidade", () => {
  test("modal preserva período, remove financeiro e vencimento único; vazio tem uma única mensagem", async () => {
    detail = makeDetail([{ ...monthly, paid_cents: 18000, open_cents: 30000, financial_status: "partial",
      overdue_cents: 30000, entries: [{ ...monthly.entries[0], openCents: 30000 }],
      due_dates: [{ due_date: "2026-09-05", open_cents: 30000 }], total_sessions: 99 }]);
    mockSessionsRequest(async () => ({ data: [] }));
    open("?month=2026-09&patient_id=30");
    const dialog = await openChargeDetails();
    await within(dialog).findByText("Nenhuma sessão vinculada a esta mensalidade.");
    expect(axios.get).toHaveBeenCalledWith("/sessions", { params: { patient_id: 30, billing_cycle_id: 11 } });
    expect(within(dialog).getByText("Período:", { selector: "dt" }).nextElementSibling)
      .toHaveTextContent(/01\/09\/2026.*30\/09\/2026/);
    expect(within(dialog).queryByText("Vencimento:", { selector: "dt" })).not.toBeInTheDocument();
    expect(within(dialog).queryByText("05/09/2026")).not.toBeInTheDocument();
    expect(dialog.querySelector("dl")).not.toHaveTextContent(/R\$|a receber/i);
    expectCompactChargeDetails(dialog);
    ["R$ 480,00", "R$ 180,00", "R$ 300,00"].forEach((amount) => {
      expect(within(dialog).queryByText(amount)).not.toBeInTheDocument();
    });
    expect(within(dialog).getAllByText("Nenhuma sessão vinculada a esta mensalidade.")).toHaveLength(1);
    expect(within(dialog).getAllByText(/Recovery/)).toHaveLength(1);
    expect(within(dialog).queryByText(/0 sessões|99 sessões|Distribuição|Sem sessões distribuídas/))
      .not.toBeInTheDocument();
    expect(within(dialog).queryByRole("table")).not.toBeInTheDocument();
  });

  test("mensalidade usa quantidade, datas, profissionais e status reais, incluindo remarcada fora do ciclo", async () => {
    const first = cycleSession(901, { status: "done", starts_at: "2026-09-08T12:30:00.000Z" });
    const rescheduled = cycleSession(902, { starts_at: "2026-10-06T13:00:00.000Z", rescheduled_from_id: 900 });
    detail = makeDetail([{ ...monthly, total_sessions: 99, usage_summary: { scheduled: 99 },
      sessions: [cycleSession(999, { professional: { name: "Sessão antiga na projeção" } })] }]);
    mockSessionsRequest(async () => ({ data: [rescheduled, first] }));
    open("?month=2026-09&patient_id=30");
    const dialog = await openChargeDetails();
    expect(await within(dialog).findByText(/2 vinculadas ao ciclo/)).toBeVisible();
    expect(within(dialog).getAllByText(/Recovery/)).toHaveLength(1);
    expect(within(dialog).getAllByText("Sessões", { exact: true })).toHaveLength(1);
    expect(within(dialog).getByText(/1 agendada.*1 realizada/)).toBeVisible();
    expect(within(dialog).queryByText(/99 sessões|Sessão antiga na projeção/)).not.toBeInTheDocument();
    const rows = within(dialog).getAllByRole("row");
    expect(rows).toHaveLength(3);
    expect(within(rows[0]).getAllByRole("columnheader").map((cell) => cell.textContent))
      .toEqual(["Data", "Profissional", "Status"]);
    expectSingleSessionHeader(dialog);
    expect(rows[1]).toHaveTextContent("08/09/2026");
    expect(rows[1]).toHaveTextContent("Profissional da sessão 901");
    expect(rows[1]).toHaveTextContent("Realizada");
    expect(rows[2]).toHaveTextContent("06/10/2026");
    expect(rows[2]).toHaveTextContent("Profissional da sessão 902");
    expect(rows[2]).toHaveTextContent("Agendada");
    expect(axios.get).toHaveBeenCalledWith("/sessions", { params: { patient_id: 30, billing_cycle_id: 11 } });
    expectCompactChargeDetails(dialog);
    expect(financial.createFinancialPayment).not.toHaveBeenCalled();
    expect(financial.createFinancialEntry).not.toHaveBeenCalled();
  });

  test("loading não aparece como zero sessões nem vazio e não repõe blocos removidos", async () => {
    const request = deferredResponse();
    mockSessionsRequest(() => request.promise);
    open("?month=2026-09&patient_id=30");
    const dialog = await openChargeDetails();
    expect(within(dialog).getByText("Carregando sessões da mensalidade...")).toBeVisible();
    expect(within(dialog).queryByText(/Nenhuma sessão|0 sessões|Distribuição/)).not.toBeInTheDocument();
    expectCompactChargeDetails(dialog);
    await act(async () => request.resolve({ data: [] }));
    expect(await within(dialog).findByText("Nenhuma sessão vinculada a esta mensalidade.")).toBeVisible();
    expect(within(dialog).queryByText("Carregando sessões da mensalidade...")).not.toBeInTheDocument();
  });

  test("sessão suspensa da mensalidade mantém status real e não conta como agendada", async () => {
    mockSessionsRequest(async () => ({ data: [cycleSession(901, { status: "suspended" })] }));
    open("?month=2026-09&patient_id=30");
    const dialog = await openChargeDetails();
    expect(await within(dialog).findByText(/1 vinculada ao ciclo/)).toBeVisible();
    expect(within(dialog).getByText(/1 suspensa/)).toBeVisible();
    expect(within(dialog).getByText("Suspensa")).toBeVisible();
    expect(within(dialog).queryByText(/agendadas|Agendada/)).not.toBeInTheDocument();
    expectCompactChargeDetails(dialog);
  });

  test("erro de consulta não vira vazio e nova tentativa recupera as sessões do mesmo ciclo", async () => {
    const request = jest.fn().mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce({ data: [cycleSession(901)] });
    mockSessionsRequest(request);
    open("?month=2026-09&patient_id=30");
    const dialog = await openChargeDetails();
    const retry = await within(dialog).findByRole("button", { name: "Tentar novamente" });
    expect(within(dialog).getByText(/Não foi possível carregar as sessões/)).toBeVisible();
    expect(within(dialog).queryByText(/Nenhuma sessão|0 sessões|Distribuição/)).not.toBeInTheDocument();
    expectCompactChargeDetails(dialog);
    await userEvent.click(retry);
    expect(await within(dialog).findByText("Profissional da sessão 901")).toBeVisible();
    expect(request).toHaveBeenCalledTimes(2);
    expect(axios.get).toHaveBeenLastCalledWith("/sessions", { params: { patient_id: 30, billing_cycle_id: 11 } });
    expect(within(dialog).queryByRole("button", { name: "Tentar novamente" })).not.toBeInTheDocument();
  });

  test.each([
    ["payload não-array", {}],
    ["outro ciclo", [cycleSession(991, { billing_cycle_id: 12 })]],
    ["outro paciente", [cycleSession(992, { patient_id: 31 })]],
    ["item inválido", [null]],
  ])("resposta %s falha fechada, sem inventar vazio ou exibir sessões estranhas", async (label, response) => {
    mockSessionsRequest(async () => ({ data: response }));
    open("?month=2026-09&patient_id=30");
    const dialog = await openChargeDetails();
    expect(await within(dialog).findByRole("button", { name: "Tentar novamente" })).toBeVisible();
    expect(within(dialog).queryByText(/Nenhuma sessão|0 sessões|Distribuição|Profissional da sessão/))
      .not.toBeInTheDocument();
    expect(within(dialog).queryByRole("table")).not.toBeInTheDocument();
  });

  test("reabrir o mesmo ciclo consulta novamente e ignora resposta da abertura encerrada", async () => {
    const first = deferredResponse();
    const second = deferredResponse();
    const request = jest.fn().mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    mockSessionsRequest(request);
    open("?month=2026-09&patient_id=30");
    let dialog = await openChargeDetails();
    await userEvent.click(within(dialog).getByRole("button", { name: "Fechar", exact: true }));
    dialog = await openChargeDetails();
    expect(request).toHaveBeenCalledTimes(2);
    await act(async () => first.resolve({ data: [cycleSession(991)] }));
    expect(within(dialog).getByText("Carregando sessões da mensalidade...")).toBeVisible();
    expect(within(dialog).queryByText("Profissional da sessão 991")).not.toBeInTheDocument();
    await act(async () => second.resolve({ data: [cycleSession(992)] }));
    expect(await within(dialog).findByText("Profissional da sessão 992")).toBeVisible();
    expect(within(dialog).queryByText("Profissional da sessão 991")).not.toBeInTheDocument();
  });

  test("troca de ciclo isola sessões e resposta atrasada não substitui o modal atual", async () => {
    const first = deferredResponse();
    const other = { ...monthly, key: "billing_cycle-12", sourceId: 12, billing_cycle_id: 12,
      service_name: "Recovery segundo ciclo", entries: [{ ...monthly.entries[0], entryId: 102 }] };
    detail = makeDetail([monthly, other]);
    mockSessionsRequest(({ params }) => (params.billing_cycle_id === 11 ? first.promise
      : Promise.resolve({ data: [cycleSession(992, { billing_cycle_id: 12 })] })));
    open("?month=2026-09&patient_id=30");
    let dialog = await openChargeDetails();
    await userEvent.click(within(dialog).getByRole("button", { name: "Fechar", exact: true }));
    dialog = await openChargeDetails(other.service_name);
    expect(await within(dialog).findByText("Profissional da sessão 992")).toBeVisible();
    expect(axios.get).toHaveBeenLastCalledWith("/sessions", { params: { patient_id: 30, billing_cycle_id: 12 } });
    await act(async () => first.resolve({ data: [cycleSession(991)] }));
    expect(within(dialog).getByText("Profissional da sessão 992")).toBeVisible();
    expect(within(dialog).queryByText("Profissional da sessão 991")).not.toBeInTheDocument();
    expect(dialog).toHaveAccessibleName("Mensalidade · Recovery segundo ciclo");
  });

  test.each([pkg, { ...single, total_sessions: 1, usage_summary: { done: 1 },
    sessions: [{ id: 803, starts_at: "2026-09-25T12:00:00Z", status: "done",
      professional: { id: 8, name: "Profissional teste" } }] }])
    ("$kind preserva sessões e vencimentos adicionais sem blocos financeiros nem consulta de mensalidade", async (charge) => {
      detail = makeDetail([{ ...charge, service_name: "Serviço da regressão" }]);
      open("?month=2026-09&patient_id=30");
      const dialog = await openChargeDetails("Serviço da regressão");
      expectCompactChargeDetails(dialog);
      expect(within(dialog).getAllByRole("row")).toHaveLength(charge.sessions.length + 1);
      expectSingleSessionHeader(dialog);
      expect(within(dialog).getAllByText("Profissional teste")).toHaveLength(charge.sessions.length);
      expect(axios.get.mock.calls.filter(([url]) => url === "/sessions")).toHaveLength(0);
      const dates = charge.due_dates.length > 1
        ? charge.due_dates.map((due) => due.due_date.split("-").reverse().join("/")) : [];
      expect([...dialog.querySelectorAll("dd")].map((value) => value.textContent)).toEqual(dates);
      if (dates.length) expect(dialog.querySelector("dl")).not.toHaveTextContent(/R\$|a receber/i);
      if (charge.kind === "entry") {
        expect(within(dialog).queryByText("Sessões", { exact: true })).not.toBeInTheDocument();
        expect(within(dialog).queryByText(/contratadas|vinculadas|agendadas/)).not.toBeInTheDocument();
      }
    });

  test("pacote separa quantidade contratada canônica de vínculos e estados operacionais reais", async () => {
    const sessions = ["scheduled", "done", "no_show", "canceled"].map((status, index) => ({
      ...pkg.sessions[0], id: 810 + index, status,
    }));
    detail = makeDetail([{ ...pkg, total_sessions: 9, sessions,
      usage_summary: { scheduled: 99, done: 98, noShow: 97, canceledWithoutCharge: 0 } }]);
    open("?month=2026-09&patient_id=30");
    const dialog = await openChargeDetails("Fisioterapia");
    expect(within(dialog).getByText(/9 contratadas.*4 vinculadas/)).toBeVisible();
    expect(within(dialog).getByText(/1 agendada.*1 realizada.*1 falta.*1 cancelada/)).toBeVisible();
    expect(within(dialog).getAllByText("Sessões", { exact: true })).toHaveLength(1);
    expect(within(dialog).getAllByRole("row")).toHaveLength(5);
    expect(within(dialog).queryByText(/99 agendadas|98 realizadas|97 faltas|0 canceladas/)).not.toBeInTheDocument();
    expectCompactChargeDetails(dialog);
  });

  test("pacote sem quantidade contratada não infere direitos pela quantidade de linhas", async () => {
    detail = makeDetail([{ ...pkg, total_sessions: undefined }]);
    open("?month=2026-09&patient_id=30");
    const dialog = await openChargeDetails("Fisioterapia");
    expect(within(dialog).getByText(/2 vinculadas.*2 agendadas/)).toBeVisible();
    expect(within(dialog).queryByText(/contratad/)).not.toBeInTheDocument();
    expectCompactChargeDetails(dialog);
  });

  test.each([
    ["Pacote", { ...pkg, sessions: [], total_sessions: 4 }, "Nenhuma sessão vinculada a este pacote."],
    ["Avulsa", { ...single, sessions: [] }, "Nenhum atendimento vinculado a esta cobrança."],
  ])("%s vazio tem mensagem apropriada única e não cria resumo com zeros", async (label, charge, emptyMessage) => {
    detail = makeDetail([charge]);
    open("?month=2026-09&patient_id=30");
    const dialog = await openChargeDetails("Fisioterapia");
    expect(within(dialog).getAllByText(emptyMessage)).toHaveLength(1);
    expect(within(dialog).queryByRole("table")).not.toBeInTheDocument();
    expect(within(dialog).queryByText(/0 vinculadas|0 sessões|0 agendadas|Sem sessões distribuídas/))
      .not.toBeInTheDocument();
    if (charge.kind === "series") expect(within(dialog).getByText("4 contratadas", { exact: true })).toBeVisible();
    else expect(within(dialog).queryByText("Sessões", { exact: true })).not.toBeInTheDocument();
    expectCompactChargeDetails(dialog);
  });

  test("lista longa contém todas as 21 sessões retornadas, inclusive primeira e última, sem limite cliente", async () => {
    const sessions = Array.from({ length: 21 }, (_, index) => cycleSession(900 + index, {
      starts_at: `2026-09-${String(index + 1).padStart(2, "0")}T12:30:00.000Z`,
    }));
    mockSessionsRequest(async () => ({ data: [...sessions].reverse() }));
    open("?month=2026-09&patient_id=30");
    const dialog = await openChargeDetails();
    expect(await within(dialog).findByText(/21 vinculadas ao ciclo.*21 agendadas/)).toBeVisible();
    const body = within(dialog).getByRole("region", { name: "Conteúdo dos detalhes" });
    const rows = within(body).getAllByRole("row");
    expect(rows).toHaveLength(22);
    expectSingleSessionHeader(dialog);
    expect(rows[1]).toHaveTextContent("01/09/2026");
    expect(rows[21]).toHaveTextContent("21/09/2026");
    sessions.forEach((session) => {
      expect(within(body).getByText(session.professional.name)).toBeInTheDocument();
    });
    expect(axios.get).toHaveBeenCalledWith("/sessions", { params: { patient_id: 30, billing_cycle_id: 11 } });
    expect(within(body).queryByRole("button", { name: "Fechar", exact: true })).not.toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Fechar detalhes" })).toBeEnabled();
    expect(within(dialog).getByRole("button", { name: "Fechar", exact: true })).toBeEnabled();
    expectCompactChargeDetails(dialog);
  });

  test("teclado alcança corpo e rodapé, contém foco, Escape fecha e restaura foco e overflow anterior", async () => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "scroll";
    mockSessionsRequest(async () => ({ data: [cycleSession(901)] }));
    const view = open("?month=2026-09&patient_id=30");
    try {
      const trigger = within((await screen.findByText("Recovery")).closest("tr"))
        .getByRole("button", { name: "Detalhes" });
      await userEvent.click(trigger);
      const dialog = await screen.findByRole("dialog", { name: "Mensalidade · Recovery" });
      await within(dialog).findByText("Profissional da sessão 901");
      const closeIcon = within(dialog).getByRole("button", { name: "Fechar detalhes" });
      const body = within(dialog).getByRole("region", { name: "Conteúdo dos detalhes" });
      const closeFooter = within(dialog).getByRole("button", { name: "Fechar", exact: true });
      expect(document.body.style.overflow).toBe("hidden");
      await waitFor(() => expect(closeIcon).toHaveFocus());
      await userEvent.tab();
      expect(body).toHaveFocus();
      await userEvent.tab();
      expect(closeFooter).toHaveFocus();
      await userEvent.tab();
      expect(closeIcon).toHaveFocus();
      await userEvent.tab({ shift: true });
      expect(closeFooter).toHaveFocus();
      await userEvent.keyboard("{Escape}");
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
      expect(trigger).toHaveFocus();
      expect(document.body.style.overflow).toBe("scroll");
      await userEvent.click(trigger);
      await userEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Fechar detalhes" }));
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(trigger).toHaveFocus();
      expect(document.body.style.overflow).toBe("scroll");
    } finally {
      view.unmount();
      document.body.style.overflow = previousOverflow;
    }
  });
});
