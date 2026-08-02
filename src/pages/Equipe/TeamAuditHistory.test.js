import React from "react";
import "@testing-library/jest-dom";
import {
  fireEvent, render, screen, waitFor,
} from "@testing-library/react";
import TeamAuditHistory, { formatAuditValue } from "./TeamAuditHistory";
import { getTeamAuditEvents } from "../../services/team";

jest.mock("../../services/team", () => ({ getTeamAuditEvents: jest.fn() }));
jest.mock("../../services/axios", () => ({
  getUserFacingApiError: (error, fallback) => fallback,
}));

const people = [
  { id: 7, name: "Pessoa Inativa", isPerson: true },
  { id: "account-12", name: "Conta sem pessoa", isPerson: false },
];

const event = {
  id: "101",
  occurred_at: "2026-08-01T15:30:00.000Z",
  action: { key: "team.account.blocked", label: "Conta de acesso bloqueada", category: "accounts" },
  actor: {
    key: "clinic_user:4", type: "clinic_user", name: "Administradora", is_active: false,
  },
  people: [{ id: 7, name: "Pessoa Inativa", is_active: false }],
  result: { key: "success", label: "Concluída" },
  details: [{
    field: "account.is_active", label: "Conta ativa", before: true, after: false,
  }],
};

const response = ({
  items = [event], hasMore = false, cursor = null,
} = {}) => ({
  items,
  pagination: { limit: 10, has_more: hasMore, next_cursor: cursor },
  filter_options: {
    actions: [{ key: "team.account.blocked", label: "Conta de acesso bloqueada", category: "accounts" }],
    actors: [{
      key: "clinic_user:4", type: "clinic_user", name: "Administradora", is_active: false,
    }],
  },
});

const EMPTY_QUERY = {
  from: "",
  to: "",
  actor: "",
  action: "",
  person_id: "",
};

describe("TeamAuditHistory", () => {
  beforeEach(() => {
    getTeamAuditEvents.mockReset();
  });

  it("apresenta carregamento enquanto a consulta esta pendente", () => {
    getTeamAuditEvents.mockImplementation(() => new Promise(() => {}));
    render(<TeamAuditHistory people={people} />);
    expect(screen.getByText("Carregando histórico...")).toBeInTheDocument();
  });

  it("apresenta estado vazio", async () => {
    getTeamAuditEvents.mockResolvedValue(response({ items: [] }));
    render(<TeamAuditHistory people={people} />);
    expect(await screen.findByText("Nenhuma ação administrativa encontrada.")).toBeInTheDocument();
  });

  it("apresenta erro seguro e permite repetir", async () => {
    getTeamAuditEvents
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce(response({ items: [] }));
    render(<TeamAuditHistory people={people} />);
    expect(await screen.findByText("Não foi possível carregar o histórico administrativo.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect(await screen.findByText("Nenhuma ação administrativa encontrada.")).toBeInTheDocument();
    expect(getTeamAuditEvents).toHaveBeenCalledTimes(2);
  });

  it("traduz erros de filtro sem exibir codigo interno", async () => {
    getTeamAuditEvents.mockRejectedValue({
      response: { data: { error: "AUDIT_PERIOD_TOO_LARGE" } },
    });
    render(<TeamAuditHistory people={people} />);
    expect(await screen.findByText("O período máximo para consulta é de 366 dias.")).toBeInTheDocument();
    expect(screen.queryByText("AUDIT_PERIOD_TOO_LARGE")).not.toBeInTheDocument();
  });

  it("exibe sucesso, inativos e detalhes administrativos sanitizados", async () => {
    getTeamAuditEvents.mockResolvedValue(response());
    render(<TeamAuditHistory people={people} />);
    expect((await screen.findAllByText("Conta de acesso bloqueada")).length).toBeGreaterThan(0);
    expect(screen.getAllByText("Administradora").length).toBeGreaterThan(0);
    expect(screen.getByText("Ator inativo")).toBeInTheDocument();
    expect(screen.getAllByText("Pessoa Inativa").length).toBeGreaterThan(0);
    expect(screen.getByText("Concluída")).toBeInTheDocument();
    expect(screen.queryByText("team.account.blocked")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Ver detalhes" }));
    expect(screen.getByRole("dialog", { name: "Detalhes da ação" })).toBeInTheDocument();
    expect(screen.getByText("Conta ativa")).toBeInTheDocument();
    expect(screen.getByText("Sim")).toBeInTheDocument();
    expect(screen.getByText("Não")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Fechar detalhes da auditoria" }));
    expect(screen.queryByRole("dialog", { name: "Detalhes da ação" })).not.toBeInTheDocument();
  });

  it("combina filtros sem permitir parametro tenant", async () => {
    getTeamAuditEvents.mockResolvedValue(response({ items: [] }));
    render(<TeamAuditHistory people={people} />);
    await screen.findByText("Nenhuma ação administrativa encontrada.");
    fireEvent.change(screen.getByLabelText("De"), { target: { value: "2026-07-01" } });
    fireEvent.change(screen.getByLabelText("Até"), { target: { value: "2026-07-31" } });
    fireEvent.change(screen.getByLabelText("Ator"), { target: { value: "clinic_user:4" } });
    fireEvent.change(screen.getByLabelText("Ação"), { target: { value: "team.account.blocked" } });
    fireEvent.change(screen.getByLabelText("Pessoa afetada"), { target: { value: "7" } });
    fireEvent.click(screen.getByRole("button", { name: "Aplicar filtros" }));
    await waitFor(() => expect(getTeamAuditEvents).toHaveBeenCalledTimes(2));
    expect(getTeamAuditEvents).toHaveBeenLastCalledWith({
      from: "2026-07-01",
      to: "2026-07-31",
      actor: "clinic_user:4",
      action: "team.account.blocked",
      person_id: "7",
      limit: 10,
    });
    expect(JSON.stringify(getTeamAuditEvents.mock.calls)).not.toContain("clinic_id");
    expect(screen.getByLabelText("Filtros aplicados")).toHaveTextContent("Administradora");
    expect(screen.getByLabelText("Filtros aplicados")).toHaveTextContent("Pessoa Inativa");
  });

  it("navega por cursores sem usar offset", async () => {
    getTeamAuditEvents
      .mockResolvedValueOnce(response({ hasMore: true, cursor: "cursor-2" }))
      .mockResolvedValueOnce(response({ items: [{ ...event, id: "100" }] }))
      .mockResolvedValueOnce(response({ hasMore: true, cursor: "cursor-2" }));
    render(<TeamAuditHistory people={people} />);
    await waitFor(() => expect(
      screen.getByRole("navigation", { name: "Paginação do histórico" }),
    ).toHaveTextContent("Página 1"));
    fireEvent.click(screen.getByRole("button", { name: "Próxima" }));
    await waitFor(() => expect(getTeamAuditEvents).toHaveBeenLastCalledWith({
      ...EMPTY_QUERY,
      limit: 10,
      cursor: "cursor-2",
    }));
    await waitFor(() => expect(
      screen.getByRole("navigation", { name: "Paginação do histórico" }),
    ).toHaveTextContent("Página 2"));
    fireEvent.click(screen.getByRole("button", { name: "Anterior" }));
    await waitFor(() => expect(getTeamAuditEvents).toHaveBeenCalledTimes(3));
    await waitFor(() => expect(
      screen.getByRole("navigation", { name: "Paginação do histórico" }),
    ).toHaveTextContent("Página 1"));
    expect(JSON.stringify(getTeamAuditEvents.mock.calls)).not.toContain("offset");
  });

  it("formata somente valores escalares do contrato", () => {
    expect(formatAuditValue(null)).toBe("Não informado");
    expect(formatAuditValue(true)).toBe("Sim");
    expect(formatAuditValue(false)).toBe("Não");
    expect(formatAuditValue(3)).toBe("3");
  });
});
