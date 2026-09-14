import React from "react";
import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Menu from ".";

jest.mock("../../components/AppShell", () => function AppShellMock({ children }) {
  return <div data-testid="app-shell">{children}</div>;
});

const mockCanAccessModule = jest.fn(() => true);
let mockAuthorizationContext;
jest.mock("../../contexts/AuthorizationContext", () => ({
  useAuthorization: () => mockAuthorizationContext,
}));

describe("Menu", () => {
  beforeEach(() => {
    mockCanAccessModule.mockImplementation(() => true);
    mockAuthorizationContext = {
      status: "ready",
      context: { authorization_state: "authorized" },
      canAccessModule: mockCanAccessModule,
    };
  });

  it("mantém os atalhos operacionais dentro do App Shell", () => {
    render(
      <MemoryRouter>
        <Menu />
      </MemoryRouter>,
    );

    expect(screen.getByTestId("app-shell")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Agenda" })).toHaveAttribute("href", "/agendamentos");
    expect(screen.getByRole("link", { name: "Painel" })).toHaveAttribute("href", "/painel");
    expect(screen.getByRole("link", { name: "Financeiro" })).toHaveAttribute("href", "/financeiro");
    expect(screen.getByRole("link", { name: "Pacientes" })).toHaveAttribute("href", "/pacientes");
    expect(screen.getByRole("link", { name: "Planos" })).toHaveAttribute("href", "/planos");
  });

  it("exibe somente o atalho da Agenda para um perfil restrito a Agenda", () => {
    mockCanAccessModule.mockImplementation((moduleKey) => moduleKey === "schedule");

    render(
      <MemoryRouter>
        <Menu />
      </MemoryRouter>,
    );

    expect(screen.getByRole("link", { name: "Agenda" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Painel" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Financeiro" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Pacientes" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Planos" })).not.toBeInTheDocument();
  });

  it("apresenta estado explícito e nenhum atalho para membership sem perfil", () => {
    mockCanAccessModule.mockImplementation(() => false);
    mockAuthorizationContext = {
      status: "ready",
      context: { authorization_source: "membership", authorization_state: "no_permissions" },
      canAccessModule: mockCanAccessModule,
    };

    render(
      <MemoryRouter>
        <Menu />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { name: "Sem permissões atribuídas" }))
      .toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(
      "ainda não possui acesso aos módulos desta clínica",
    );
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("oculta atalhos own indisponíveis e preserva módulos independentes de atuação", () => {
    mockCanAccessModule.mockImplementation((moduleKey) => moduleKey === "dashboard");
    mockAuthorizationContext = {
      status: "ready",
      context: {
        authorization_source: "membership",
        authorization_state: "authorized",
        own_scope: {
          available: false,
          unavailability_reason: "active_professional_link_required",
        },
      },
      canAccessModule: mockCanAccessModule,
    };

    render(
      <MemoryRouter>
        <Menu />
      </MemoryRouter>,
    );

    expect(screen.getByRole("link", { name: "Painel" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Agenda" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Pacientes" })).not.toBeInTheDocument();
  });
});
