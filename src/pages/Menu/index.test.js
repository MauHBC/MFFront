import React from "react";
import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Menu from ".";

jest.mock("../../components/AppShell", () => function AppShellMock({ children }) {
  return <div data-testid="app-shell">{children}</div>;
});

describe("Menu", () => {
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
});
