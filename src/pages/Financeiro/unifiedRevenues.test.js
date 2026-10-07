import "@testing-library/jest-dom";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import Financeiro from "./index";
import * as financial from "../../services/financial";
import * as credit from "../../services/financialCredit";
import axios from "../../services/axios";
import * as authorizationContext from "../../contexts/AuthorizationContext";

jest.mock("../../services/financial");
jest.mock("../../services/financialCredit");
jest.mock("react-toastify", () => ({ toast: { error: jest.fn(), success: jest.fn(), info: jest.fn() } }));
jest.mock("../../services/axios", () => ({
  __esModule: true, default: { get: jest.fn() },
  getUserFacingApiError: (error, fallback) => error?.response?.data?.message || fallback,
}));
jest.mock("../../contexts/AuthorizationContext", () => {
  const context = { clinic_id: 77 };
  return { useAuthorization: jest.fn(() => ({ context, canAccessModule: () => true, hasCapability: () => true })) };
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
const typeFilters = [["Mensalidade", "billing_cycle"], ["Pacote", "series"], ["Avulsa", "entry"]];
const expectActiveTypes = (activeLabels) => {
  typeFilters.forEach(([label]) => {
    expect(screen.getByRole("button", { name: label, exact: true }))
      .toHaveAttribute("aria-pressed", String(activeLabels.includes(label)));
  });
};
const fixtureRevenueStatus = (charge) => {
  if (charge.open_cents <= 0) return "paid";
  if (charge.overdue_cents > 0) return "overdue";
  return "upcoming";
};

const pageFixture = (response) => {
  const { data } = response;
  if (data?.page_info) return response;
  if (data?.origin !== "all" || !data.summary || !data.patients) return response;
  return { ...response, data: { ...data, patients_count: data.patients.length,
    charges_count: data.patients.reduce((sum, row) => sum + row.entries_count, 0), result_version: "fixture",
    page_info: { page: 1, page_size: 20, total: data.patients.length, has_more: false, next_page: null },
    patients: data.patients.map((row) => ({ ...row, revenue_status: fixtureRevenueStatus({ open_cents: row.pending, overdue_cents: row.overdue_cents }) })) } };
};
const deferredResponse = () => {
  let resolve;
  const promise = new Promise((complete) => { resolve = complete; });
  return { promise, resolve: (response) => resolve(response?.data ? pageFixture(response) : response) };
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
  await userEvent.click(within(row).getByRole("button", { name: /Ações da cobrança/ }));
  await userEvent.click(screen.getByRole("menuitem", { name: "Ver sessões" }));
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
  expect(body).toHaveStyle("overflow: auto; min-height: 0;");
  expect(body.parentElement).toHaveStyle("overflow: hidden; display: flex;");
  expect(within(body).queryByText("Período:")).not.toBeInTheDocument();
  expect(within(body).queryByText("Sessões", { exact: true })).not.toBeInTheDocument();
  expect(tables[0].querySelectorAll("thead")).toHaveLength(1);
  expect(within(dialog).getAllByRole("columnheader").map((header) => header.textContent))
    .toEqual(["Data", "Paciente atendido", "Profissional", "Status"]);
  within(dialog).getAllByRole("columnheader").forEach((header) => {
    expect(header).toHaveAttribute("scope", "col");
  });
};

const summaryMock = {
  mockImplementation: (implementation) => financial.getFinancialRevenuesSummary.mockImplementation(async (...args) => pageFixture(await implementation(...args))),
  mockResolvedValue: (response) => financial.getFinancialRevenuesSummary.mockResolvedValue(pageFixture(response)),
};

beforeEach(() => {
  jest.clearAllMocks();
  authorizationContext.useAuthorization.mockReturnValue({
    context: { clinic_id: 77 }, canAccessModule: () => true, hasCapability: () => true,
  });
  detail = makeDetail();
  Object.values(financial).forEach((fn) => { if (jest.isMockFunction(fn)) fn.mockResolvedValue({ data: [] }); });
  summaryMock.mockImplementation(async (period, mode, filters) => {
    const filtered = makeDetail(detail.charges.filter((charge) => filters.charge_types.split(",").includes(charge.kind) && (filters.financial_status === "all" || filters.financial_status === fixtureRevenueStatus(charge))));
    return { data: {
    origin: "all", month: "2026-09", summary: filtered.summary,
    patients: filtered.charges.length ? [{ patient_id: patient.id, patient_name: patient.full_name, ...filtered.summary,
      entries_count: filtered.charges.length, reference_date: "2026-09-01", due_date: "2026-09-05", overdue_cents: filtered.charges.reduce((sum, row) => sum + row.overdue_cents, 0) }] : [],
    professionals: [{ id: 8, name: "Profissional teste" }],
  } }; });
  financial.getFinancialRevenuePatientDetail.mockImplementation(async () => ({ data: detail }));
  financial.listPaymentMethods.mockResolvedValue({ data: [{ id: 3, name: "Pix", is_active: true }] });
  financial.createFinancialEntry.mockResolvedValue({ data: { id: 900 } });
  financial.createFinancialPayment.mockResolvedValue({ data: { id: 901 } });
  axios.get.mockResolvedValue({ data: [patient] });
  window.matchMedia = jest.fn().mockReturnValue({ matches: false, addEventListener: jest.fn(), removeEventListener: jest.fn() });
});

test("uma lista com valores visíveis, detalhe misto e colunas aprovadas; filtro de tipo não reduz destinos", async () => {
  open();
  expectActiveTypes(["Mensalidade", "Pacote", "Avulsa"]);
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
  await userEvent.click(within(packageRow).getByRole("button", { name: /Ações da cobrança/ }));
  await userEvent.click(screen.getByRole("menuitem", { name: "Ver sessões" }));
  const packageDialog = await screen.findByRole("dialog");
  expect(within(packageDialog).getByText("20/10/2026", { selector: "dd" })).toBeVisible();
  await userEvent.click(screen.getByRole("button", { name: "Fechar" }));
  await userEvent.click(screen.getByRole("button", { name: "Pacote", exact: true }));
  await userEvent.click(screen.getByRole("button", { name: "Avulsa", exact: true }));
  expect(screen.getAllByRole("row")).toHaveLength(2);
  await userEvent.click(screen.getByRole("button", { name: "Registrar recebimento" }));
  expect(screen.getAllByRole("checkbox")).toHaveLength(3);
  expect(screen.getAllByRole("checkbox").every((input) => !input.checked)).toBe(true);
});

test("chips em Filtros combinam tipos, mantêm busca/status/período e permitem nenhum", async () => {
  open();
  await screen.findByText(patient.full_name);
  const group = screen.getByRole("group", { name: "Tipo de cobrança" });
  expect(within(group).getAllByRole("button").map((button) => button.textContent))
    .toEqual(typeFilters.map(([label]) => label));
  expect(group.closest("header")).toBeNull();
  expect(group.parentElement.parentElement).toContainElement(screen.getByLabelText("Status financeiro"));
  expectActiveTypes(["Mensalidade", "Pacote", "Avulsa"]);
  fireEvent.change(screen.getByLabelText("Pesquisar paciente"), { target: { value: "TESTE" } });
  fireEvent.change(screen.getByLabelText("Status financeiro"), { target: { value: "overdue" } });
  await userEvent.click(screen.getByRole("button", { name: "Mensalidade", exact: true }));
  expectActiveTypes(["Pacote", "Avulsa"]);
  await waitFor(() => expect(financial.getFinancialRevenuesSummary).toHaveBeenCalledWith(
    "2026-09", "month", expect.objectContaining({ origin: "all", charge_types: "entry,series" }),
  ));
  await userEvent.click(screen.getByRole("button", { name: "Pacote", exact: true }));
  expectActiveTypes(["Avulsa"]);
  expect(screen.getByLabelText("Pesquisar paciente")).toHaveValue("TESTE");
  expect(screen.getByLabelText("Status financeiro")).toHaveValue("overdue");
  expect(screen.getByLabelText("Selecionar mes e ano")).toHaveValue("2026-09");
  const calls = financial.getFinancialRevenuesSummary.mock.calls.length;
  await userEvent.click(screen.getByRole("button", { name: "Avulsa", exact: true }));
  expectActiveTypes([]);
  await waitFor(() => expect(screen.queryByText(patient.full_name)).not.toBeInTheDocument());
  expect(financial.getFinancialRevenuesSummary).toHaveBeenCalledTimes(calls + 1);
  await userEvent.click(screen.getByRole("button", { name: "Visão anual" }));
  await userEvent.click(screen.getByRole("button", { name: "Pacote", exact: true }));
  expectActiveTypes(["Pacote"]);
  await waitFor(() => expect(financial.getFinancialRevenuesSummary).toHaveBeenLastCalledWith(
    "2026", "year", expect.objectContaining({ origin: "all", charge_types: "series" }),
  ));
});

test("profissional filtra combinação de pacote/avulsa e troca de chips limpa o filtro", async () => {
  open();
  await screen.findByText(patient.full_name);
  await userEvent.click(screen.getByRole("button", { name: "Mensalidade", exact: true }));
  fireEvent.change(screen.getByLabelText("Profissional"), { target: { value: "8" } });
  await waitFor(() => expect(financial.getFinancialRevenuesSummary).toHaveBeenLastCalledWith(
    "2026-09", "month", expect.objectContaining({ origin: "all", charge_types: "entry,series", professional_id: "8" }),
  ));
  await userEvent.click(screen.getByRole("button", { name: "Pacote", exact: true }));
  expect(screen.getByLabelText("Profissional")).toHaveValue("");
  expectActiveTypes(["Avulsa"]);
  await waitFor(() => expect(financial.getFinancialRevenuesSummary).toHaveBeenLastCalledWith(
    "2026-09", "month", expect.objectContaining({ origin: "all", charge_types: "entry" }),
  ));
});

test.each(Array.from({ length: 8 }, (_, mask) => [mask]))("combinação %i filtra pacientes e cobranças sem limitar o recebimento", async (mask) => {
  const charges = [monthly, pkg, single];
  const included = (index) => Math.floor(mask / (2 ** index)) % 2 === 1;
  summaryMock.mockImplementation(async (period, mode, filters) => {
    const selected = charges.filter((charge) => filters.charge_types.split(",").includes(charge.kind) && (filters.financial_status === "all" || filters.financial_status === fixtureRevenueStatus(charge)));
    const projected = makeDetail(selected);
    return { data: { origin: "all", month: period, summary: projected.summary,
      patients: selected.length ? [{ patient_id: patient.id, patient_name: patient.full_name,
        ...projected.summary, entries_count: selected.length }] : [], professionals: [] } };
  });
  open();
  await screen.findByText(patient.full_name);
  await typeFilters.reduce(async (previous, [label], index) => {
    await previous;
    if (!included(index)) await userEvent.click(screen.getByRole("button", { name: label, exact: true }));
  }, Promise.resolve());
  const selected = charges.filter((_, index) => included(index));
  expectActiveTypes(typeFilters.filter((_, index) => included(index)).map(([label]) => label));
  if (!selected.length) {
    await waitFor(() => expect(screen.queryByText(patient.full_name)).not.toBeInTheDocument());
    return;
  }
  const total = selected.reduce((sum, charge) => sum + charge.amount_cents, 0);
  await waitFor(() => expect(screen.getByText(patient.full_name).closest("tr"))
    .toHaveTextContent((total / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }).replace(/\s/g, " ")));
  await openPatient();
  expect(screen.getAllByRole("row")).toHaveLength(selected.length + 1);
  charges.forEach((charge, index) => {
    const label = typeFilters[index][0];
    if (included(index)) expect(screen.getByText(label, { selector: "span" })).toBeVisible();
    else expect(screen.queryByText(label, { selector: "span" })).not.toBeInTheDocument();
  });
  await userEvent.click(screen.getByRole("button", { name: "Registrar recebimento" }));
  expect(screen.getAllByRole("checkbox")).toHaveLength(3);
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
      .toHaveTextContent({ pending: "Vencido", partial: "Vencido", paid: "Pago" }[status]);
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
  summaryMock.mockResolvedValue({ data: {
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
    summaryMock.mockResolvedValue({ data: {
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
      expect.objectContaining({ origin: "all", charge_types: "billing_cycle,entry,series" }));
    await openPatient();
    expectResultsHeading(label, patient.full_name);
    expect(financial.getFinancialRevenuePatientDetail).toHaveBeenLastCalledWith("30", period, mode, "all");
    expect(screen.getByText("Recovery")).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: "Histórico" }));
    expectResultsHeading(label, patient.full_name);
    expect(screen.queryByText("Recovery")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Cobranças", exact: true }));
    await userEvent.click(screen.getByRole("button", { name: "Mensalidade", exact: true }));
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
    summaryMock.mockImplementation(() => request.promise);
    fireEvent.change(screen.getByLabelText("Selecionar mes e ano"), { target: { value: "2026-10" } });
    const results = expectResultsHeading("Outubro de 2026");
    expect(within(results).getByText("Carregando resumo...")).toBeVisible();
    expect(within(results).queryByRole("table")).not.toBeInTheDocument();
    expect(within(results).queryByText(patient.full_name)).not.toBeInTheDocument();
    expect(financial.getFinancialRevenuesSummary).toHaveBeenLastCalledWith("2026-10", "month",
      expect.objectContaining({ origin: "all", charge_types: "billing_cycle,entry,series" }));
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
      expect.objectContaining({ origin: "all", charge_types: "billing_cycle,entry,series" }));
    const request = deferredResponse();
    summaryMock.mockImplementation(() => request.promise);
    fireEvent.change(screen.getByLabelText("Selecionar ano"), { target: { value: "2027" } });
    const results = expectResultsHeading("2027");
    expect(within(results).getByText("Carregando resumo...")).toBeVisible();
    expect(within(results).queryByRole("table")).not.toBeInTheDocument();
    expect(financial.getFinancialRevenuesSummary).toHaveBeenLastCalledWith("2027", "year",
      expect.objectContaining({ origin: "all", charge_types: "billing_cycle,entry,series" }));
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
  summaryMock.mockResolvedValue({ data: { origin: "all", summary: {}, patients: [] } });
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
      .toEqual(["Data", "Paciente atendido", "Profissional", "Status"]);
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

  test("pacote mantém o comprador no cabeçalho e identifica o paciente atendido por sessão", async () => {
    const attendedPatient = { id: 31, full_name: "João Atendido" };
    const sharedPackage = {
      ...pkg,
      sessions: [{
        ...pkg.sessions[0],
        patient_id: attendedPatient.id,
        Patient: attendedPatient,
      }],
    };
    detail = makeDetail([sharedPackage]);
    open("?month=2026-09&patient_id=30");
    const dialog = await openChargeDetails("Fisioterapia");

    expect(within(dialog).getByText(patient.full_name)).toBeVisible();
    const sessionRow = within(dialog).getByText(attendedPatient.full_name).closest("tr");
    expect(sessionRow).toHaveTextContent(attendedPatient.full_name);
    expect(sessionRow).not.toHaveTextContent(patient.full_name);
    expectSingleSessionHeader(dialog);
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

  test("mensalidade com 20 sessões preserva contexto fora da rolagem e primeira e última linhas", async () => {
    const sessions = Array.from({ length: 20 }, (_, index) => cycleSession(900 + index, {
      starts_at: `2026-09-${String(index + 1).padStart(2, "0")}T12:30:00.000Z`,
    }));
    mockSessionsRequest(async () => ({ data: [...sessions].reverse() }));
    open("?month=2026-09&patient_id=30");
    const dialog = await openChargeDetails();
    expect(await within(dialog).findByText(/20 vinculadas ao ciclo.*20 agendadas/)).toBeVisible();
    const body = within(dialog).getByRole("region", { name: "Conteúdo dos detalhes" });
    const rows = within(body).getAllByRole("row");
    expect(rows).toHaveLength(21);
    expectSingleSessionHeader(dialog);
    expect(rows[1]).toHaveTextContent("01/09/2026");
    expect(rows[20]).toHaveTextContent("20/09/2026");
    expect(body.contains(within(dialog).getByText(/20 vinculadas ao ciclo/))).toBe(false);
    expect(body.contains(within(dialog).getByText("Período:", { selector: "dt" }))).toBe(false);
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
        .getByRole("button", { name: /Ações da cobrança/ });
      await userEvent.click(trigger);
      await userEvent.click(screen.getByRole("menuitem", { name: "Ver sessões" }));
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
      await userEvent.click(screen.getByRole("menuitem", { name: "Ver sessões" }));
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



const projectionForTypes = (types) => {
  const selected = [monthly, pkg, single].filter((charge) => types.includes(charge.kind));
  const projected = makeDetail(selected);
  return pageFixture({ data: { origin: "all", summary: projected.summary, professionals: [],
    patients: selected.length ? [{ patient_id: patient.id, patient_name: patient.full_name,
      ...projected.summary, entries_count: selected.length, overdue_cents: 58000 }] : [] } });
};

test("alternar Pacote mantém cards, tabela, filtros, foco e marca atualização até resumo/lista prontos", async () => {
  open();
  const patientRow = (await screen.findByText(patient.full_name)).closest("tr");
  const input = screen.getByLabelText("Pesquisar paciente");
  const title = screen.getByRole("heading", { name: "Receitas" });
  const period = screen.getByLabelText("Selecionar mes e ano");
  const summary = screen.getByRole("region", { name: "Resumo de receitas" });
  const metrics = within(summary).getByText("Valor").parentElement;
  const results = screen.getByRole("region", { name: "Resultados de receitas" });
  const chip = screen.getByRole("button", { name: "Pacote", exact: true });
  const pendingMonthly = deferredResponse();
  financial.getFinancialRevenuesSummary.mockClear();
  summaryMock.mockImplementation(() => pendingMonthly.promise);
  window.scrollTo = jest.fn();
  await act(async () => { await userEvent.click(chip); });
  expect(financial.getFinancialRevenuesSummary.mock.calls.map((call) => call[2].charge_types))
    .toEqual(["billing_cycle,entry"]);
  expect(screen.getByRole("status")).toHaveTextContent("Atualizando receitas — resultados anteriores.");
  expect(summary).toHaveAttribute("aria-busy", "true");
  expect(results).toHaveAttribute("aria-busy", "true");
  expect(metrics).toBeInTheDocument();
  expect(patientRow).toBeInTheDocument();
  expect(patientRow).toHaveTextContent("R$ 780,00");
  expect(chip).toHaveFocus();
  expect(chip).toHaveAttribute("aria-pressed", "false");
  expect(title).toBeInTheDocument();
  expect(screen.getByLabelText("Selecionar mes e ano")).toBe(period);
  expect(screen.getByLabelText("Pesquisar paciente")).toBe(input);
  expect(screen.queryByText(/Carregando resumo|Nenhuma cobrança/)).not.toBeInTheDocument();
  await act(async () => pendingMonthly.resolve(projectionForTypes(["billing_cycle", "entry"])));
  expect(metrics).toHaveTextContent("R$ 580,00");
  expect(patientRow).toHaveTextContent("R$ 580,00");
  expect(summary).toHaveAttribute("aria-busy", "false");
  expect(results).toHaveAttribute("aria-busy", "false");
  expect(screen.queryByRole("status")).not.toBeInTheDocument();
  expect(chip).toHaveFocus();
  expect(window.scrollTo).not.toHaveBeenCalled();
  summaryMock.mockResolvedValue(projectionForTypes(["billing_cycle", "series", "entry"]));
  financial.getFinancialRevenuesSummary.mockClear();
  await act(async () => { await userEvent.click(chip); });
  expect(financial.getFinancialRevenuesSummary.mock.calls.map((call) => call[2].charge_types)).toEqual(["billing_cycle,entry,series"]);
  expect(metrics).toHaveTextContent("R$ 780,00");
});

test("respostas de seleção antiga não substituem resumo/lista da seleção mais recente", async () => {
  open();
  await screen.findByText(patient.full_name);
  const monthlyResponse = deferredResponse();
  const oldSingle = deferredResponse();
  const latestSingle = deferredResponse();
  financial.getFinancialRevenuesSummary.mockReset();
  financial.getFinancialRevenuesSummary.mockReturnValueOnce(monthlyResponse.promise)
    .mockReturnValueOnce(latestSingle.promise);
  await act(async () => { await userEvent.click(screen.getByRole("button", { name: "Pacote", exact: true })); });
  await act(async () => { await userEvent.click(screen.getByRole("button", { name: "Mensalidade", exact: true })); });
  await act(async () => latestSingle.resolve(projectionForTypes(["entry"])));
  const summary = screen.getByRole("region", { name: "Resumo de receitas" });
  const metric = within(summary).getByText("Valor").parentElement;
  expect(metric).toHaveTextContent("R$ 100,00");
  await act(async () => {
    monthlyResponse.resolve(projectionForTypes(["billing_cycle"]));
    oldSingle.resolve(projectionForTypes(["entry"]));
  });
  expect(metric).toHaveTextContent("R$ 100,00");
  expect(screen.getByText(patient.full_name).closest("tr")).toHaveTextContent("R$ 100,00");
  expectActiveTypes(["Avulsa"]);
  expect(summary).toHaveAttribute("aria-busy", "false");
});

test("falha preserva dados anteriores com alerta e retry publica a seleção pendente", async () => {
  open();
  const row = (await screen.findByText(patient.full_name)).closest("tr");
  const summary = screen.getByRole("region", { name: "Resumo de receitas" });
  const metric = within(summary).getByText("Valor").parentElement;
  const pending = deferredResponse();
  financial.getFinancialRevenuesSummary.mockReturnValue(pending.promise);
  await act(async () => { await userEvent.click(screen.getByRole("button", { name: "Pacote", exact: true })); });
  await act(async () => pending.resolve(Promise.reject(new Error("Falha sintética"))));
  expect(screen.getByRole("alert")).toHaveTextContent("Resultados anteriores; atualização não concluída.");
  expect(metric).toHaveTextContent("R$ 780,00");
  expect(row).toBeInTheDocument();
  expect(summary).toHaveAttribute("aria-busy", "false");
  summaryMock.mockImplementation(async (_, __, filters) => projectionForTypes(filters.charge_types.split(",")));
  await act(async () => { await userEvent.click(screen.getByRole("button", { name: "Tentar novamente" })); });
  expect(metric).toHaveTextContent("R$ 580,00");
  expect(row).toHaveTextContent("R$ 580,00");
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});

test("nenhum tipo fica vazio mesmo com pesquisa; detalhe completo filtra sem novas consultas", async () => {
  open();
  await screen.findByText(patient.full_name);
  const labels = document.querySelectorAll('label[for="attendance-search"], label[for="attendance-status"], #revenue-type-label');
  expect([...labels].map((label) => label.textContent)).toEqual(["Pesquisar paciente", "Status financeiro", "Tipo de cobrança"]);
  await openPatient();
  const calls = financial.getFinancialRevenuesSummary.mock.calls.length;
  await act(async () => { await userEvent.click(screen.getByRole("button", { name: "Pacote", exact: true })); });
  const summary = screen.getByRole("region", { name: "Resumo de receitas" });
  expect(within(summary).getByText("Valor").parentElement).toHaveTextContent("R$ 580,00");
  expect(screen.getAllByRole("row")).toHaveLength(3);
  expect(financial.getFinancialRevenuesSummary).toHaveBeenCalledTimes(calls);
  expect(screen.getByLabelText("Pesquisar paciente")).toBeDisabled();
  await userEvent.click(screen.getByRole("button", { name: "Voltar", exact: true }));
  fireEvent.change(screen.getByLabelText("Pesquisar paciente"), { target: { value: "TESTE" } });
  await act(async () => {
    await userEvent.click(screen.getByRole("button", { name: "Mensalidade", exact: true }));
    await userEvent.click(screen.getByRole("button", { name: "Avulsa", exact: true }));
  });
  await waitFor(() => expect(screen.queryByText(patient.full_name)).not.toBeInTheDocument());
  await waitFor(() => expect(within(screen.getByRole("region", { name: "Resumo de receitas" })).getByText("Valor").parentElement).toHaveTextContent("R$ 0,00"));
});


test("troca de contexto limpa o resultado retido e não aceita respostas da clínica anterior", async () => {
  const rendered = open();
  await screen.findByText(patient.full_name);
  const old = deferredResponse();
  financial.getFinancialRevenuesSummary.mockReturnValue(old.promise);
  await act(async () => { await userEvent.click(screen.getByRole("button", { name: "Pacote", exact: true })); });
  const next = deferredResponse();
  financial.getFinancialRevenuesSummary.mockClear();
  financial.getFinancialRevenuesSummary.mockReturnValue(next.promise);
  const originalAuthorization = authorizationContext.useAuthorization.getMockImplementation();
  authorizationContext.useAuthorization.mockReturnValue({
    context: { clinic_id: 88 }, canAccessModule: () => true, hasCapability: () => true,
  });
  try {
    rendered.rerender(<MemoryRouter initialEntries={["/financeiro/receitas?month=2026-09"]}><Financeiro /></MemoryRouter>);
    expect(screen.queryByText(patient.full_name)).not.toBeInTheDocument();
    expect(financial.getFinancialRevenuesSummary.mock.calls.map((call) => call[2].charge_types))
      .toEqual(["billing_cycle,entry"]);
    await act(async () => old.resolve(projectionForTypes(["billing_cycle", "entry"])));
    expect(screen.queryByText(patient.full_name)).not.toBeInTheDocument();
    await act(async () => next.resolve(projectionForTypes([])));
    expect(screen.getByRole("region", { name: "Resumo de receitas" })).toHaveAttribute("aria-busy", "false");
    expect(screen.queryByText(patient.full_name)).not.toBeInTheDocument();
  } finally { authorizationContext.useAuthorization.mockImplementation(originalAuthorization); }
});

test("recebimento sintético recarrega detalhe e resumo mantendo os tipos selecionados", async () => {
  financial.createFinancialPayment.mockImplementation(async () => {
    detail = makeDetail([{ ...monthly, paid_cents: 48000, open_cents: 0, overdue_cents: 0,
      financial_status: "paid", entries: [] }, pkg, single]);
    return { data: { id: 901 } };
  });
  open(); await openPatient();
  await userEvent.click(screen.getByRole("button", { name: "Pacote", exact: true }));
  await userEvent.click(screen.getByRole("button", { name: "Registrar recebimento" }));
  await userEvent.click(screen.getByRole("checkbox", { name: /Mensalidade · Recovery/ }));
  await payment("480,00");
  await waitFor(() => {
    const summary = screen.getByRole("region", { name: "Resumo de receitas" });
    expect(within(summary).getByText("Pago").parentElement).toHaveTextContent("R$ 480,00");
    expect(within(summary).getByText("Pendente").parentElement).toHaveTextContent("R$ 100,00");
  });
  expectActiveTypes(["Mensalidade", "Avulsa"]);
  expect(financial.createFinancialPayment).toHaveBeenCalledWith(expect.objectContaining({
    receipt_groups: [{ kind: "billing_cycle", id: 11 }],
  }), expect.any(String));
  expect(financial.getFinancialRevenuePatientDetail.mock.calls.length).toBeGreaterThan(1);
});


test("pagina 20/40/45 mantém linhas, foco, rolagem e cards globais; último bloco remove o botão", async () => {
  const people = Array.from({ length: 45 }, (_, index) => ({ patient_id: index + 100,
    patient_name: `TESTE Página ${index + 1}`, patient_full_name: `TESTE Página ${index + 1}`,
    total: 10000, received: 0, pending: 10000, entries_count: 1, revenue_status: "upcoming" }));
  summaryMock.mockImplementation(async (_, __, filters) => ({ data: { origin: "all",
    summary: { total: 450000, received: 0, pending: 450000 }, charges_count: 45, patients_count: 45,
    result_version: "pages", professionals: [], patients: people.slice((filters.page - 1) * 20, filters.page * 20),
    page_info: { page: filters.page, page_size: 20, total: 45, has_more: filters.page < 3,
      next_page: filters.page < 3 ? filters.page + 1 : null } } }));
  open();
  await screen.findByText("TESTE Página 1");
  const firstRow = screen.getByText("TESTE Página 1").closest("tr");
  const summary = screen.getByRole("region", { name: "Resumo de receitas" });
  const card = within(summary).getByText("Valor").parentElement;
  expect(card).toHaveTextContent("R$ 4.500,00");
  expect(screen.getByText(/Exibindo 20 de 45 pacientes/)).toBeInTheDocument();
  const button = screen.getByRole("button", { name: "Carregar mais 20" });
  window.scrollTo = jest.fn();
  await userEvent.click(button);
  await screen.findByText("TESTE Página 40");
  expect(screen.getByText("TESTE Página 1").closest("tr")).toBe(firstRow);
  expect(button).toHaveFocus();
  expect(card).toHaveTextContent("R$ 4.500,00");
  expect(screen.getByText(/Exibindo 40 de 45 pacientes/)).toBeInTheDocument();
  await userEvent.click(button);
  await screen.findByText("TESTE Página 45");
  expect(screen.getByText(/Exibindo 45 de 45 pacientes/)).toBeInTheDocument();
  expect(screen.getByText(/Exibindo 45 de 45 pacientes/)).toHaveFocus();
  expect(screen.queryByRole("button", { name: "Carregar mais 20" })).not.toBeInTheDocument();
  expect(card).toHaveTextContent("R$ 4.500,00");
  expect(window.scrollTo).not.toHaveBeenCalled();
  expect(screen.getAllByRole("row")).toHaveLength(46);
});


test.each([["paid", "Pagos", "#edf7f1"], ["overdue", "Vencidos", "#fff4f0"], ["upcoming", "A vencer", "#eef3ff"]])
  ("filtro %s evidencia situação sem depender da cor e Limpar preserva pesquisa, competência e tipos", async (status, label, background) => {
    open();
    await screen.findByText(patient.full_name);
    const selector = screen.getByLabelText("Status financeiro");
    expect(screen.queryByText("Filtro ativo", { exact: true })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Limpar status financeiro" })).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Pesquisar paciente"), { target: { value: "TESTE" } });
    await userEvent.click(screen.getByRole("button", { name: "Pacote", exact: true }));
    fireEvent.change(selector, { target: { value: status } });
    await waitFor(() => expect(financial.getFinancialRevenuesSummary).toHaveBeenLastCalledWith("2026-09", "month",
      expect.objectContaining({ financial_status: status, patient_query: "TESTE", charge_types: "billing_cycle,entry", page: 1 })));
    expect(selector).toHaveValue(status);
    expect(within(selector).getByRole("option", { name: label }).selected).toBe(true);
    expect(selector).toHaveAttribute("aria-describedby", "revenue-status-active");
    expect(screen.getByText("Filtro ativo", { exact: true })).toBeVisible();
    expect(selector).toHaveStyle(`background: ${background}`);
    await userEvent.click(screen.getByRole("button", { name: "Limpar status financeiro" }));
    await waitFor(() => expect(financial.getFinancialRevenuesSummary).toHaveBeenLastCalledWith("2026-09", "month",
      expect.objectContaining({ financial_status: "all", patient_query: "TESTE", charge_types: "billing_cycle,entry", page: 1 })));
    expect(selector).toHaveValue("all");
    expect(selector).toHaveFocus();
    expect(selector).not.toHaveAttribute("aria-describedby");
    expect(screen.getByLabelText("Pesquisar paciente")).toHaveValue("TESTE");
    expect(screen.getByLabelText("Selecionar mes e ano")).toHaveValue("2026-09");
    expectActiveTypes(["Mensalidade", "Avulsa"]);
    expect(screen.queryByText("Filtro ativo", { exact: true })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Limpar status financeiro" })).not.toBeInTheDocument();
  });

test.each([["paid", "Pagos"], ["overdue", "Vencidos"], ["upcoming", "A vencer"]])
  ("vazio concluído de %s é contextual e nenhum tipo mantém mensagem própria", async (status, label) => {
    summaryMock.mockResolvedValue({ data: { origin: "all", summary: { total: 0, received: 0, pending: 0 }, patients: [] } });
    open();
    fireEvent.change(screen.getByLabelText("Status financeiro"), { target: { value: status } });
    expect(await screen.findByText(`Nenhuma cobrança encontrada com o status ‘${label}’ para esta pesquisa.`)).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: "Mensalidade", exact: true }));
    await userEvent.click(screen.getByRole("button", { name: "Pacote", exact: true }));
    await userEvent.click(screen.getByRole("button", { name: "Avulsa", exact: true }));
    expect(await screen.findByText("Selecione pelo menos um tipo de cobrança.")).toBeVisible();
    expect(screen.queryByText(`Nenhuma cobrança encontrada com o status ‘${label}’ para esta pesquisa.`)).not.toBeInTheDocument();
  });

test("Limpar reinicia página um e descarta anexação atrasada do status anterior", async () => {
  const people = Array.from({ length: 21 }, (_, index) => ({ patient_id: index + 100,
    patient_name: `Filtro Página ${index + 1}`, total: 10000, received: 10000, pending: 0,
    entries_count: 1, revenue_status: "paid" }));
  const late = deferredResponse();
  const payload = (page) => ({ data: { origin: "all", professionals: [],
    summary: { total: 210000, received: 210000, pending: 0 }, patients_count: 21, charges_count: 21,
    result_version: "filter-pages", patients: people.slice((page - 1) * 20, page * 20),
    page_info: { page, page_size: 20, total: 21, has_more: page === 1, next_page: page === 1 ? 2 : null } } });
  summaryMock.mockImplementation(async (_, __, filters) => filters.page === 2 ? late.promise : payload(1));
  open();
  await screen.findByText("Filtro Página 1");
  fireEvent.change(screen.getByLabelText("Status financeiro"), { target: { value: "paid" } });
  await waitFor(() => expect(financial.getFinancialRevenuesSummary).toHaveBeenLastCalledWith("2026-09", "month",
    expect.objectContaining({ financial_status: "paid", page: 1 })));
  await waitFor(() => expect(screen.getByRole("button", { name: "Carregar mais 20" })).toBeEnabled());
  await userEvent.click(screen.getByRole("button", { name: "Carregar mais 20" }));
  await userEvent.click(screen.getByRole("button", { name: "Limpar status financeiro" }));
  await waitFor(() => expect(financial.getFinancialRevenuesSummary).toHaveBeenLastCalledWith("2026-09", "month",
    expect.objectContaining({ financial_status: "all", page: 1 })));
  await act(async () => late.resolve(payload(2)));
  expect(screen.queryByText("Filtro Página 21")).not.toBeInTheDocument();
  expect(screen.getByText(/Exibindo 20 de 21 pacientes/)).toBeVisible();
  expect(within(screen.getByRole("region", { name: "Resumo de receitas" })).getByText("Valor").parentElement)
    .toHaveTextContent("R$ 2.100,00");
});

test("status ativo durante carregamento ou erro não afirma ausência de cobranças", async () => {
  const request = deferredResponse();
  summaryMock.mockImplementation(() => request.promise);
  open();
  fireEvent.change(screen.getByLabelText("Status financeiro"), { target: { value: "paid" } });
  expect(screen.queryByText(/Nenhuma cobrança encontrada com o status/)).not.toBeInTheDocument();
  expect(screen.getByText("Carregando resumo...")).toBeVisible();
  await act(async () => request.resolve({ data: { origin: "all", summary: {}, patients: [] } }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Não foi possível carregar o resumo");
  expect(screen.queryByText(/Nenhuma cobrança encontrada com o status/)).not.toBeInTheDocument();
});

test("status por cobrança mantém cards, paciente e detalhe coerentes sem Parcial", async () => {
  detail = makeDetail([
    { ...monthly, paid_cents: 48000, open_cents: 0, overdue_cents: 0, revenue_status: "paid", entries: [] },
    { ...pkg, paid_cents: 5000, open_cents: 15000, overdue_cents: 0, revenue_status: "upcoming",
      entries: [{ ...pkg.entries[0], openCents: 5000 }, pkg.entries[1]] },
    { ...single, overdue_cents: 10000, revenue_status: "overdue" },
  ]);
  open();
  await screen.findByText(patient.full_name);
  const selector = screen.getByLabelText("Status financeiro");
  expect(within(selector).getAllByRole("option").map((option) => option.textContent))
    .toEqual(["Todos", "A vencer", "Vencidos", "Pagos"]);
  fireEvent.change(selector, { target: { value: "overdue" } });
  const summary = screen.getByRole("region", { name: "Resumo de receitas" });
  await waitFor(() => expect(within(summary).getByText("Valor").parentElement).toHaveTextContent("R$ 100,00"));
  expect(within(summary).getByText("Cobranças").parentElement).toHaveTextContent("1");
  const row = screen.getByText(patient.full_name).closest("tr");
  expect(row).toHaveTextContent("R$ 100,00");
  expect(row).toHaveTextContent("Vencido");
  expect(row).not.toHaveTextContent("Parcial");
  await openPatient();
  expect(screen.getAllByRole("row")).toHaveLength(2);
  expect(screen.getByText("Avulsa", { selector: "span" })).toBeVisible();
  expect(screen.queryByText("Mensalidade", { selector: "span" })).not.toBeInTheDocument();
  expect(within(summary).getByText("Valor").parentElement).toHaveTextContent("R$ 100,00");
  await userEvent.click(screen.getByRole("button", { name: "Voltar", exact: true }));
  expect(screen.getByLabelText("Status financeiro")).toHaveValue("overdue");
  expect(screen.getByText("Filtro ativo", { exact: true })).toBeVisible();
  await openPatient();
  await userEvent.click(screen.getByRole("button", { name: "Registrar recebimento" }));
  expect(screen.getAllByRole("checkbox")).toHaveLength(2);
});
