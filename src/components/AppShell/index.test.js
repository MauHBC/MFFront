import React from "react";
import "@testing-library/jest-dom";
import {
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import AppShell, { PINNED_STORAGE_KEY } from ".";

const mockLogout = jest.fn();

jest.mock("../../contexts/ClinicContext", () => ({
  useClinicContext: () => ({
    displayName: "Clínica de Fisioterapia com Nome Longo",
    logoSrc: null,
    brandInitials: "CF",
  }),
}));

jest.mock("../../hooks/useAuth", () => ({
  useAuth: () => ({
    isLoggedIn: true,
    username: "Maurício",
  }),
}));

jest.mock("../../hooks/useLogout", () => ({
  useLogout: () => mockLogout,
}));

function renderShell(pathname = "/painel") {
  return render(
    <MemoryRouter initialEntries={[pathname]}>
      <AppShell pageTitle="Painel">
        <p>Conteúdo operacional</p>
      </AppShell>
    </MemoryRouter>,
  );
}

describe("AppShell", () => {
  beforeEach(() => {
    window.localStorage.clear();
    mockLogout.mockClear();
  });

  it("renderiza identidade, conteúdo e rota ativa", () => {
    renderShell();

    expect(screen.getByText("Clínica de Fisioterapia com Nome Longo")).toBeInTheDocument();
    expect(screen.getByText("Conteúdo operacional")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Painel" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Agenda" })).not.toHaveAttribute("aria-current");
  });

  it("inicia compacta, expande temporariamente e fixa a navegação sem perder a preferência", () => {
    const { container } = renderShell();
    const sidebar = screen.getByRole("complementary", { name: "Navegação principal" });

    expect(container.firstChild).toHaveAttribute("data-sidebar-pinned", "false");
    expect(screen.queryByRole("button", { name: "Fixar sidebar" })).not.toBeInTheDocument();

    fireEvent.mouseEnter(sidebar);
    expect(screen.getByRole("button", { name: "Fixar sidebar" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );

    expect(screen.getByText("Clínica de Fisioterapia com Nome Longo")).toBeVisible();
    fireEvent.mouseLeave(sidebar);

    fireEvent.focus(screen.getByRole("link", { name: "Agenda" }));
    expect(screen.getByText("Clínica de Fisioterapia com Nome Longo")).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Fixar sidebar" }));
    expect(screen.getByRole("button", { name: "Desafixar sidebar" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(window.localStorage.getItem(PINNED_STORAGE_KEY)).toBe("true");

    fireEvent.click(screen.getByRole("button", { name: "Desafixar sidebar" }));
    expect(window.localStorage.getItem(PINNED_STORAGE_KEY)).toBe("false");
  });

  it("restaura a preferência fixada em uma nova montagem", () => {
    window.localStorage.setItem(PINNED_STORAGE_KEY, "true");

    const { container } = renderShell();

    expect(container.firstChild).toHaveAttribute("data-sidebar-pinned", "true");
    expect(screen.getByRole("button", { name: "Desafixar sidebar" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("exibe no cabeçalho apenas o controle de ícone, com tooltip e foco por teclado", () => {
    renderShell();
    const sidebar = screen.getByRole("complementary", { name: "Navegação principal" });

    fireEvent.mouseEnter(sidebar);
    const pinButton = screen.getByRole("button", { name: "Fixar sidebar" });

    expect(pinButton).toHaveAttribute("title", "Fixar sidebar");
    expect(pinButton).toHaveAttribute("aria-pressed", "false");
    expect(pinButton.querySelector("svg")).not.toBeNull();
    expect(pinButton.querySelector("span")).toBeNull();
    expect(screen.queryByText("Fixar aberta")).not.toBeInTheDocument();

    pinButton.focus();
    expect(pinButton).toHaveFocus();

    fireEvent.click(pinButton);
    expect(screen.getByRole("button", { name: "Desafixar sidebar" })).toHaveAttribute(
      "title",
      "Desafixar sidebar",
    );
  });

  it("abre e fecha a navegação mobile por botão, overlay e Escape", () => {
    const { container } = renderShell();

    const trigger = container.querySelector("[aria-controls='app-navigation']");
    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(container.querySelector("button[aria-label='Fechar navegação']")).not.toBeNull();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(trigger).toHaveAttribute(
      "aria-expanded",
      "false",
    );
  });

  it("oferece logout no menu do usuário", () => {
    renderShell();

    fireEvent.click(screen.getByRole("button", { name: "Abrir menu do usuário" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Sair" }));

    expect(mockLogout).toHaveBeenCalledTimes(1);
  });

  it("expande Financeiro no modo compacto e abre a Visão geral sem fixar a sidebar", () => {
    const { container } = renderShell();
    const financialButton = screen.getByRole("button", { name: "Financeiro" });

    expect(financialButton).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(financialButton);

    expect(financialButton).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("link", { name: "Visão geral" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "Receitas" })).toHaveAttribute(
      "href",
      "/financeiro/receitas",
    );
    expect(screen.getByRole("link", { name: "Despesas da clínica" })).toHaveAttribute(
      "href",
      "/financeiro/despesas",
    );
    expect(screen.getByRole("link", { name: "Configurações" })).toHaveAttribute(
      "href",
      "/financeiro/configuracoes",
    );
    expect(container.firstChild).toHaveAttribute("data-sidebar-pinned", "false");
  });

  it("deriva a expansão e o submenu ativo de uma rota financeira direta", () => {
    renderShell("/financeiro/despesas");

    expect(screen.getByRole("button", { name: "Financeiro" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    fireEvent.mouseEnter(
      screen.getByRole("complementary", { name: "Navegação principal" }),
    );
    expect(screen.getByRole("link", { name: "Despesas da clínica" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("fecha o drawer mobile ao navegar por um submenu", () => {
    const { container } = renderShell("/financeiro/visao-geral");
    const trigger = container.querySelector("[aria-controls='app-navigation']");

    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    fireEvent.click(screen.getByRole("link", { name: "Receitas" }));

    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });
});
