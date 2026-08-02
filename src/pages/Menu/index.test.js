import React from "react";
import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Menu from ".";

jest.mock("../../components/AppShell", () => function AppShellMock({ children }) {
  return <div data-testid="app-shell">{children}</div>;
});

const mockCanAccessModule = jest.fn(() => true);
jest.mock("../../contexts/AuthorizationContext", () => ({
  useAuthorization: () => ({ canAccessModule: mockCanAccessModule }),
}));

describe("Menu", () => {
  beforeEach(() => mockCanAccessModule.mockImplementation(() => true));

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
});
