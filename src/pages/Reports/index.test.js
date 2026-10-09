import React from "react";
import "@testing-library/jest-dom";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Reports, { catalog } from ".";
import api from "../../services/axios";
import { downloadPdfResponse } from "../../services/documents";

jest.mock("../../components/AppShell", () => function Shell({ children }) { return <div>{children}</div>; });
jest.mock("../../services/axios", () => ({ __esModule: true, default: { get: jest.fn() } }));
jest.mock("../../services/documents", () => ({ downloadPdfResponse: jest.fn() }));
const mockAccess = jest.fn(() => true);
let mockAdmin = true;
let mockContext;
jest.mock("../../contexts/AuthorizationContext", () => ({ useAuthorization: () => ({ canAccessModule: mockAccess, context: mockContext, isAdministrator: mockAdmin }) }));
jest.mock("../../utils/canonicalDateTime", () => ({ ...jest.requireActual("../../utils/canonicalDateTime"), todayInSaoPaulo: () => "2026-10-09" }));
const report = { kind: "receipts", title: "Recebimentos e devoluções", clinic: { name: "Clínica Jardim das Flores" }, filters: { from: "2026-10-01", to: "2026-10-31" }, date_basis: "Movimentos realizados", generated_at: "2026-10-09T12:00:00Z", version: "a".repeat(64), columns: [{ key: "patient", label: "Paciente" }, { key: "amount", label: "Valor", type: "money" }], rows: [{ patient: "Ana Carolina Almeida", amount: 10000 }], totals: [{ key: "received", label: "Recebido", type: "money", value: 10000 }], notes: [], detail: [], detail_columns: [] };
const mount = () => render(<MemoryRouter><Reports /></MemoryRouter>);
const generate = () => fireEvent.click(screen.getByRole("button", { name: "Gerar relatório" }));
it("apresenta devoluções de crédito em seção própria sem reduzir o recebido", async () => {
  const separated = { ...report, rows_title: "Recebimentos", credit_returns_title: "Devoluções de crédito — informação separada do resultado", credit_returns_columns: report.columns, credit_returns: [{ patient: "Bruno Santos", amount: 4000 }], totals: [...report.totals, { key: "returned", label: "Devoluções de crédito (informativo)", value: 4000, type: "money" }] };
  api.get.mockImplementation((url) => Promise.resolve({ data: url.includes("/document") ? separated : [] }));
  mount(); generate();
  expect(await screen.findByText("Devoluções de crédito — informação separada do resultado")).toBeInTheDocument();
  expect(screen.getByText("Bruno Santos")).toBeInTheDocument();
  expect(screen.getAllByText("R$ 100,00").length).toBeGreaterThan(0);
  expect(screen.queryByText("R$ 60,00")).not.toBeInTheDocument();
});
beforeEach(() => {
  jest.clearAllMocks();
  mockAdmin = true;
  mockAccess.mockImplementation(() => true);
  mockContext = { modules: ["schedule", "patients", "finance"].map((key) => ({ module_key: key, can_export: true })) };
  api.get.mockImplementation((url) => Promise.resolve({ data: url.includes("references") || url === "/payment-methods" ? [] : report }));
  URL.createObjectURL = jest.fn(() => "blob:reports-test"); URL.revokeObjectURL = jest.fn();
});
it("não gera automaticamente e substitui telas redundantes pelo catálogo de seis relatórios", () => {
  mount();
  expect(screen.getByRole("option", { name: "Recebimentos e devoluções" })).toBeInTheDocument();
  expect(screen.getByRole("option", { name: "Aniversariantes" })).toBeInTheDocument();
  expect(screen.queryByText("Resumo do dia")).not.toBeInTheDocument();
  expect(screen.queryByText("Agenda e presença")).not.toBeInTheDocument();
  expect(api.get.mock.calls.some(([url]) => url.includes("/document"))).toBe(false);
});
it("gera documento com clínica, período e totais após ação explícita", async () => {
  mount(); generate();
  expect(await screen.findByText("Ana Carolina Almeida")).toBeInTheDocument();
  expect(screen.getByText("Clínica Jardim das Flores")).toBeInTheDocument();
  expect(screen.getByText("01/10/2026 a 31/10/2026")).toBeInTheDocument();
  expect(api.get).toHaveBeenCalledWith("/reports/receipts/document", { params: { from: "2026-10-01", to: "2026-10-31", situation: "all" } });
});
it("aniversários selecionam ano da ocorrência e intervalo cruzando ano", async () => {
  mount(); fireEvent.change(screen.getByLabelText("Relatório"), { target: { value: "anniversaries" } });
  fireEvent.change(screen.getByLabelText("Mês"), { target: { value: "2" } }); fireEvent.change(screen.getByLabelText("Ano"), { target: { value: "2027" } }); generate();
  await waitFor(() => expect(api.get).toHaveBeenCalledWith("/reports/anniversaries/document", { params: { from: "2027-02-01", to: "2027-02-28" } }));
  fireEvent.change(screen.getByLabelText("Período"), { target: { value: "range" } });
  fireEvent.change(screen.getByLabelText("De"), { target: { value: "2026-12-01" } }); fireEvent.change(screen.getByLabelText("Até"), { target: { value: "2027-03-01" } }); generate();
  await waitFor(() => expect(api.get).toHaveBeenCalledWith("/reports/anniversaries/document", { params: { from: "2026-12-01", to: "2027-03-01" } }));
});
it("oculta caixa de não administradores e nega geração sem permissões", () => {
  mockAdmin = false; mockAccess.mockImplementation((key) => key === "patients"); mount();
  expect(screen.queryByRole("option", { name: "Movimentação de caixa" })).not.toBeInTheDocument();
  expect(screen.queryByRole("option", { name: "Contas a receber e atrasos" })).not.toBeInTheDocument();
  expect(screen.getByLabelText("Relatório")).toHaveValue("anniversaries");
});
it("invalida documento ao alterar filtros e ignora resposta atrasada", async () => {
  let resolve;
  api.get.mockImplementation((url) => url.includes("document") ? new Promise((done) => { resolve = done; }) : Promise.resolve({ data: [] }));
  mount(); generate(); fireEvent.change(screen.getByLabelText("Mês"), { target: { value: "11" } });
  resolve({ data: report }); await waitFor(() => expect(screen.queryByText("Ana Carolina Almeida")).not.toBeInTheDocument());
  expect(screen.queryByRole("button", { name: "CSV" })).not.toBeInTheDocument();
});
it("revogação ou troca de contexto remove dados anteriormente autorizados", async () => {
  const view = mount(); generate(); await screen.findByText("Ana Carolina Almeida");
  mockContext = { modules: [] }; mockAdmin = false; mockAccess.mockImplementation(() => false);
  view.rerender(<MemoryRouter><Reports /></MemoryRouter>);
  expect(screen.queryByText("Ana Carolina Almeida")).not.toBeInTheDocument();
  expect(screen.getByText("Você não tem acesso aos relatórios disponíveis.")).toBeInTheDocument();
});
it("pagina somente a visualização e exporta consulta completa com versão", async () => {
  api.get.mockImplementation((url) => {
    if (url.includes("/export")) return Promise.resolve({ data: new Blob(["CSV"], { type: "text/csv" }) });
    if (url.includes("/document")) return Promise.resolve({ data: { ...report, rows: Array.from({ length: 36 }, (_, index) => ({ patient: `Nome ${index + 1}`, amount: 10000 })) } });
    return Promise.resolve({ data: [] });
  });
  const click = jest.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  mount(); generate(); await screen.findByText("Nome 1"); expect(screen.queryByText("Nome 21")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Próxima" })); expect(screen.getByText("Nome 36")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "CSV" }));
  await waitFor(() => expect(api.get).toHaveBeenCalledWith("/reports/receipts/export", { params: { from: "2026-10-01", to: "2026-10-31", situation: "all", format: "csv", version: report.version }, responseType: "blob" }));
  expect(URL.revokeObjectURL).toHaveBeenCalled(); click.mockRestore();
});
it("preserva leitura mas bloqueia exportação sem can_export", async () => {
  mockContext.modules = mockContext.modules.map((m) => ({ ...m, can_export: false })); mount(); generate(); await screen.findByText("Ana Carolina Almeida");
  expect(screen.getByRole("button", { name: "Baixar PDF" })).toBeDisabled(); expect(screen.getByRole("button", { name: "CSV" })).toBeDisabled();
});
it("mostra estados vazio e erro de consulta sem exibir relatório anterior", async () => {
  api.get.mockResolvedValue({ data: { ...report, rows: [] } }); mount(); generate(); await screen.findByText("Nenhum registro para os filtros selecionados.");
  api.get.mockRejectedValue({ response: { status: 400 } }); generate(); expect(await screen.findByRole("alert")).toHaveTextContent("Confira o período");
  expect(screen.queryByLabelText("Documento do relatório")).not.toBeInTheDocument();
});

it.each(catalog)("preserva critério, filtros e ações acessíveis em $name", async ({ id, name }) => {
  const generated = { ...report, kind: id, title: name, filters: { ...report.filters, group_by: "professional" }, date_basis: "Data prevista do atendimento, no horário de Brasília.", filter_labels: { group_by: "Profissional" } };
  api.get.mockImplementation((url) => Promise.resolve({ data: url.includes("/document") ? generated : [] }));
  mount();
  fireEvent.change(screen.getByLabelText("Relatório"), { target: { value: id } });
  generate();
  const document = await screen.findByRole("region", { name: "Documento do relatório" });
  expect(within(document).getByRole("heading", { name })).toBeInTheDocument();
  expect(within(document).getByText(generated.date_basis)).toBeInTheDocument();
  expect(within(document).getByText("Agrupamento: Profissional")).toBeInTheDocument();
  expect(within(document).getByRole("button", { name: "Baixar PDF" })).toBeEnabled();
  expect(within(document).queryByRole("button", { name: "Imprimir" })).not.toBeInTheDocument();
  expect(within(document).getByRole("button", { name: "CSV" })).toBeEnabled();
  expect(within(document).getByRole("columnheader", { name: "Paciente" })).toHaveAttribute("scope", "col");
});

it("anuncia geração em andamento, bloqueia envio duplicado e limpa o estado ao concluir", async () => {
  let resolve;
  api.get.mockImplementation((url) => url.includes("/document") ? new Promise((done) => { resolve = done; }) : Promise.resolve({ data: [] }));
  mount(); generate();
  expect(screen.getByRole("status")).toHaveTextContent("Gerando relatório.");
  expect(screen.getByRole("button", { name: "Gerando…" })).toBeDisabled();
  await act(async () => resolve({ data: report }));
  expect(screen.queryByRole("status")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Gerar relatório" })).toBeEnabled();
});

it("expõe preparação de arquivo e impede exportações concorrentes", async () => {
  let resolve;
  api.get.mockImplementation((url) => url.includes("/export") ? new Promise((done) => { resolve = done; }) : Promise.resolve({ data: url.includes("/document") ? report : [] }));
  const click = jest.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  mount(); generate(); await screen.findByText("Ana Carolina Almeida");
  fireEvent.click(screen.getByRole("button", { name: "CSV" }));
  expect(screen.getByRole("status")).toHaveTextContent("Preparando arquivo…");
  expect(screen.getByRole("button", { name: "Baixar PDF" })).toBeDisabled();
  await act(async () => resolve({ data: new Blob(["CSV"], { type: "text/csv" }) }));
  expect(screen.queryByRole("status")).not.toBeInTheDocument();
  click.mockRestore();
});

it("baixa o PDF autenticado sem abrir outro fluxo de impressão", async () => {
  const opened = jest.spyOn(window, "open").mockImplementation(() => null);
  const pdfResponse = { data: new Blob(["%PDF"], { type: "application/pdf" }) };
  api.get.mockImplementation((url) => {
    if (url.includes("/export")) return Promise.resolve(pdfResponse);
    return Promise.resolve({ data: url.includes("/document") ? report : [] });
  });
  mount(); generate(); await screen.findByText("Ana Carolina Almeida");
  fireEvent.click(screen.getByRole("button", { name: "Baixar PDF" }));
  await waitFor(() => expect(downloadPdfResponse).toHaveBeenCalledWith(pdfResponse, "relatorio"));
  expect(api.get).toHaveBeenCalledWith("/reports/receipts/export", { params: { from: "2026-10-01", to: "2026-10-31", situation: "all", format: "pdf", version: report.version }, responseType: "blob" });
  expect(opened).not.toHaveBeenCalled();
  opened.mockRestore();
});

it("exibe nascimento completo e idade por ocorrência sem Convenção ou emissão no modelo mensal", async () => {
  const birthday = { ...report, kind: "anniversaries", title: "Aniversariantes", columns: [{ key: "patient", label: "Nome" }, { key: "birth_date", label: "Data de nascimento" }, { key: "turns_age", label: "Idade a completar", type: "age" }], rows: [{ patient: "Ana Carolina Almeida", birth_date: "1980-10-02", turns_age: 46 }], date_basis: "Idade a completar: idade em anos no aniversário do período selecionado." };
  api.get.mockImplementation((url) => Promise.resolve({ data: url.includes("/document") ? birthday : [] }));
  mount(); fireEvent.change(screen.getByLabelText("Relatório"), { target: { value: "anniversaries" } }); generate();
  const document = await screen.findByRole("region", { name: "Documento do relatório" });
  expect(within(document).getByText("02/10/1980")).toBeInTheDocument();
  expect(within(document).getByText("46 anos")).toBeInTheDocument();
  expect(within(document).getByRole("columnheader", { name: "Idade a completar" })).toBeInTheDocument();
  expect(within(document).queryByRole("columnheader", { name: "Convenção" })).not.toBeInTheDocument();
  expect(within(document).queryByRole("columnheader", { name: "Aniversário no período" })).not.toBeInTheDocument();
  expect(within(document).queryByText(/Gerado em/)).not.toBeInTheDocument();
});
