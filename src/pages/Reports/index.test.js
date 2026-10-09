import React from "react";
import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Reports from ".";
import api from "../../services/axios";

jest.mock("../../components/AppShell", () => function Shell({ children }) { return <div>{children}</div>; });
jest.mock("../../services/axios", () => ({ __esModule: true, default: { get: jest.fn() } }));
const mockAccess = jest.fn(() => true);
let mockContext = null;
jest.mock("../../contexts/AuthorizationContext", () => ({ useAuthorization: () => ({ canAccessModule: mockAccess, context: mockContext }) }));
jest.mock("../../utils/canonicalDateTime", () => ({ todayInSaoPaulo: () => "2026-10-09" }));

const daily = {
  from: "2026-10-09", to: "2026-10-09", counts: { scheduled: 2, done: 1, no_show: 0, canceled: 0 },
  total_sessions: 3, unique_patients: 2, excluded_sessions: 1, total_rows: 3, total_pages: 1,
  rows: [{ session_id: 1, patient_id: 1, patient_name: "Paciente sintético", starts_at: "2026-10-10T02:30:00Z", date: "2026-10-09", professional_name: "Profissional", service_name: "Serviço", status: "done" }],
};
const birthdays = { month: 2, total_rows: 1, total_pages: 1, coverage: { total_patients: 2, missing_birth_date: 1 }, rows: [{ patient_id: 2, name: "Bia sintética", day: 29, month: 2 }] };
const mount = () => render(<MemoryRouter><Reports /></MemoryRouter>);

beforeEach(() => {
  jest.clearAllMocks();
  mockContext = null;
  Element.prototype.scrollIntoView = jest.fn();
  mockAccess.mockImplementation(() => true);
  api.get.mockImplementation((url) => {
    if (url.includes("references")) return Promise.resolve({ data: [{ id: 10, name: "Profissional" }] });
    return Promise.resolve({ data: url.includes("birthdays") ? birthdays : daily });
  });
});

it("não consulta relatórios nem referências sem acesso", () => {
  mockAccess.mockImplementation(() => false);
  mount();
  expect(screen.getByText("Você não tem acesso aos relatórios disponíveis.")).toBeInTheDocument();
  expect(api.get).not.toHaveBeenCalled();
});

it("consulta somente pacientes permitidos, filtra mês e preserva 29/02", async () => {
  mockAccess.mockImplementation((key) => key === "patients");
  mount();
  expect(await screen.findByText("Bia sintética")).toBeInTheDocument();
  expect(screen.getByText("29/02")).toBeInTheDocument();
  expect(screen.queryByLabelText("Data")).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Mês"), { target: { value: "2" } });
  await waitFor(() => expect(api.get).toHaveBeenLastCalledWith("/reports/birthdays", { params: { month: 2, page: 1 } }));
  expect(api.get.mock.calls.every(([url]) => url === "/reports/birthdays")).toBe(true);
  expect(await screen.findByRole("link", { name: "Bia sintética" })).toHaveAttribute("href", "/pacientes/2");
});

it("usa hoje, explica exclusões e permite abrir o estado contado", async () => {
  mount();
  expect(await screen.findByText("Paciente sintético")).toBeInTheDocument();
  expect(screen.getByText(/1 sessões suspensas/)).toBeInTheDocument();
  expect(screen.getByText("09/10/2026 · 23:30")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /Realizados 1 Ver registros/ }));
  await waitFor(() => expect(api.get).toHaveBeenLastCalledWith("/reports/schedule", { params: { from: "2026-10-09", to: "2026-10-09", status: "done", page: 1 } }));
});

it("aplica intervalo e profissional e pagina com filtros preservados", async () => {
  mount();
  await screen.findByText("Paciente sintético");
  api.get.mockImplementation((url) => Promise.resolve({ data: url.includes("references") ? [] : { ...daily, total_pages: 2, total_rows: 21 } }));
  fireEvent.click(screen.getByRole("button", { name: /Agenda e presença/ }));
  fireEvent.change(screen.getByLabelText("De"), { target: { value: "2026-10-01" } });
  fireEvent.change(screen.getByLabelText("Profissional"), { target: { value: "10" } });
  await screen.findByRole("button", { name: "Próxima" });
  fireEvent.click(screen.getByRole("button", { name: "Próxima" }));
  await waitFor(() => expect(api.get).toHaveBeenLastCalledWith("/reports/schedule", { params: { from: "2026-10-01", to: "2026-10-09", professional_user_id: "10", status: "all", page: 2 } }));
});

it("mostra vazio e erro sem manter números antigos", async () => {
  api.get.mockResolvedValue({ data: { ...daily, rows: [], total_sessions: 0, unique_patients: 0 } });
  mount();
  expect(await screen.findByText("Nenhum registro para os filtros selecionados.")).toBeInTheDocument();
  api.get.mockRejectedValue({ response: { status: 400 } });
  fireEvent.change(screen.getByLabelText("Data"), { target: { value: "" } });
  expect(await screen.findByRole("alert")).toHaveTextContent("Confira o período");
  expect(screen.queryByText("Nenhum registro para os filtros selecionados.")).not.toBeInTheDocument();
});

it("atalho de receitas preserva o contrato mensal existente", async () => {
  mount();
  await screen.findByText("Paciente sintético");
  expect(screen.getByRole("link", { name: /Receitas por paciente/ })).toHaveAttribute("href", "/financeiro/receitas?month=2026-10");
});

it("remove imediatamente o resultado anterior ao trocar o contexto autorizado", async () => {
  const view = mount();
  await screen.findByText("Paciente sintético");
  let resolveNewReport;
  api.get.mockImplementation((url) => {
    if (url.includes("references")) return Promise.resolve({ data: [] });
    return new Promise((resolve) => { resolveNewReport = resolve; });
  });
  mockContext = { clinic_id: 22 };
  view.rerender(<MemoryRouter><Reports /></MemoryRouter>);
  expect(screen.queryByText("Paciente sintético")).not.toBeInTheDocument();
  await waitFor(() => expect(resolveNewReport).toBeDefined());
  resolveNewReport({ data: { ...daily, rows: [] } });
  await screen.findByText("Nenhum registro para os filtros selecionados.");
});

it("ignora resposta interrompida quando o filtro já mudou", async () => {
  let resolveOld;
  api.get.mockImplementation((url, options) => {
    if (url.includes("references")) return Promise.resolve({ data: [] });
    if (options.params.from === "2026-10-09") return new Promise((resolve) => { resolveOld = resolve; });
    return Promise.resolve({ data: { ...daily, rows: [{ ...daily.rows[0], patient_name: "Resultado atual" }] } });
  });
  mount();
  await waitFor(() => expect(resolveOld).toBeDefined());
  fireEvent.change(screen.getByLabelText("Data"), { target: { value: "2026-10-08" } });
  await screen.findByText("Resultado atual");
  resolveOld({ data: daily });
  await waitFor(() => expect(screen.queryByText("Paciente sintético")).not.toBeInTheDocument());
  expect(screen.getByText("Resultado atual")).toBeInTheDocument();
});

it("troca para relatório permitido quando o acesso à Agenda é revogado", async () => {
  const view = mount();
  await screen.findByText("Paciente sintético");
  mockAccess.mockImplementation((key) => key === "patients");
  mockContext = { clinic_id: 1, permissions_version: 2 };
  view.rerender(<MemoryRouter><Reports /></MemoryRouter>);
  expect(screen.queryByText("Paciente sintético")).not.toBeInTheDocument();
  await screen.findByText("Bia sintética");
  expect(screen.queryByLabelText("Profissional")).not.toBeInTheDocument();
  expect(api.get).toHaveBeenLastCalledWith("/reports/birthdays", { params: { month: 10, page: 1 } });
});

it("o total de um estado abre a primeira página correspondente e rola após carregar", async () => {
  mount();
  await screen.findByText("Paciente sintético");
  let resolveFiltered;
  api.get.mockImplementation(() => new Promise((resolve) => { resolveFiltered = resolve; }));
  fireEvent.click(screen.getByRole("button", { name: /Realizados 1 Ver registros/ }));
  await waitFor(() => expect(resolveFiltered).toBeDefined());
  expect(Element.prototype.scrollIntoView).not.toHaveBeenCalled();
  resolveFiltered({ data: { ...daily, total_rows: 1 } });
  await screen.findByText("Paciente sintético");
  await waitFor(() => expect(Element.prototype.scrollIntoView).toHaveBeenCalledWith({ block: "nearest", behavior: "smooth" }));
  expect(screen.getByLabelText("Situação")).toHaveValue("done");
});
