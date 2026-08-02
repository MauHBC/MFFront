import React from "react";
import "@testing-library/jest-dom";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { createMemoryHistory } from "history";
import { MemoryRouter, Router } from "react-router-dom";
import AppShell, {
  OPEN_MODULES_STORAGE_KEY,
  PINNED_STORAGE_KEY,
} from ".";

const mockLogout = jest.fn();
const mockAuthorization = {
  canViewTeam: false,
  canAccessModule: () => true,
  hasCapability: () => true,
};

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

jest.mock("../../contexts/AuthorizationContext", () => ({
  useAuthorization: () => mockAuthorization,
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

afterEach(() => {
  mockAuthorization.canViewTeam = false;
});

it("exibe Equipe no App Shell somente quando autorizada", () => {
  renderShell();
  expect(screen.queryByRole("link", { name: "Equipe" })).not.toBeInTheDocument();
  cleanup();
  mockAuthorization.canViewTeam = true;
  renderShell();
  expect(screen.getByRole("link", { name: "Equipe" })).toHaveAttribute("href", "/equipe");
});

function renderShellWithHistory(pathname = "/painel") {
  const history = createMemoryHistory({ initialEntries: [pathname] });
  const result = render(
    <Router history={history}>
      <AppShell pageTitle="Painel">
        <p>Conteúdo operacional</p>
      </AppShell>
    </Router>,
  );

  return { ...result, history };
}

describe("AppShell", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    mockLogout.mockClear();
  });

  it("renderiza identidade, conteúdo e rota ativa", () => {
    renderShell();

    expect(screen.getByText("Clínica de Fisioterapia com Nome Longo")).toBeInTheDocument();
    expect(screen.getByText("Conteúdo operacional")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Painel" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("button", { name: "Agenda" })).not.toHaveAttribute("aria-current");
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

    fireEvent.focus(screen.getByRole("button", { name: "Agenda" }));
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

  it("preserva Financeiro expandido ao navegar para um módulo direto", () => {
    const { history } = renderShellWithHistory("/financeiro/receitas");
    const sidebar = screen.getByRole("complementary", { name: "Navegação principal" });

    fireEvent.mouseEnter(sidebar);
    expect(screen.getByRole("button", { name: "Financeiro" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );

    fireEvent.click(screen.getByRole("link", { name: "Pacientes" }));

    expect(history.location.pathname).toBe("/pacientes");
    expect(screen.getByRole("button", { name: "Financeiro" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    expect(screen.getByRole("link", { name: "Pacientes" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("sincroniza a rota ativa sem recolher módulos ao voltar e avançar", () => {
    const { history } = renderShellWithHistory("/financeiro/despesas");

    fireEvent.mouseEnter(
      screen.getByRole("complementary", { name: "Navegação principal" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Agenda" }));
    expect(screen.getByRole("button", { name: "Financeiro" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );

    act(() => history.goBack());
    expect(history.location.pathname).toBe("/financeiro/despesas");
    expect(screen.getByRole("button", { name: "Financeiro" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    expect(screen.getByRole("link", { name: "Despesas da clínica" })).toHaveAttribute(
      "aria-current",
      "page",
    );

    act(() => history.goForward());
    expect(history.location.pathname).toBe("/agendamentos");
    expect(screen.getByRole("button", { name: "Financeiro" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    expect(screen.getByRole("button", { name: "Agenda" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    expect(screen.getByRole("link", { name: "Agenda" })).toHaveAttribute(
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

  it("fecha o drawer mobile sem recolher os módulos já expandidos", () => {
    const { container, history } = renderShellWithHistory("/financeiro/visao-geral");
    const trigger = container.querySelector("[aria-controls='app-navigation']");

    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole("button", { name: "Planos" }));

    expect(history.location.pathname).toBe("/planos");
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByRole("button", { name: "Financeiro" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    expect(screen.getByRole("button", { name: "Planos" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
  });

  it("mantém expansões independentes e alterna somente o módulo clicado", () => {
    const { history } = renderShellWithHistory();
    fireEvent.mouseEnter(
      screen.getByRole("complementary", { name: "Navegação principal" }),
    );

    fireEvent.click(screen.getByRole("button", { name: "Agenda" }));
    expect(history.location.pathname).toBe("/agendamentos");
    expect(screen.getByRole("button", { name: "Agenda" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );

    fireEvent.click(screen.getByRole("button", { name: "Planos" }));
    expect(history.location.pathname).toBe("/planos");
    expect(screen.getByRole("button", { name: "Agenda" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    expect(screen.getByRole("button", { name: "Planos" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );

    fireEvent.click(screen.getByRole("button", { name: "Financeiro" }));
    expect(screen.getByRole("button", { name: "Planos" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    expect(screen.getByRole("button", { name: "Financeiro" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );

    fireEvent.click(screen.getByRole("button", { name: "Planos" }));
    expect(screen.getByRole("button", { name: "Planos" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    expect(screen.getByRole("button", { name: "Agenda" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    expect(screen.getByRole("button", { name: "Financeiro" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );

    fireEvent.click(screen.getByRole("link", { name: "Pacientes" }));
    expect(screen.getByRole("button", { name: "Financeiro" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
  });

  it("preserva módulos abertos quando a rota troca a instância do App Shell", () => {
    const { unmount } = renderShell();
    fireEvent.mouseEnter(
      screen.getByRole("complementary", { name: "Navegação principal" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Planos" }));
    fireEvent.click(screen.getByRole("button", { name: "Financeiro" }));

    expect(JSON.parse(
      window.sessionStorage.getItem(OPEN_MODULES_STORAGE_KEY),
    )).toEqual(["plans", "financial"]);

    unmount();
    renderShell("/agendamentos");

    expect(screen.getByRole("button", { name: "Agenda" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    expect(screen.getByRole("button", { name: "Planos" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    expect(screen.getByRole("button", { name: "Financeiro" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
  });

  it.each([
    ["/agendamentos/eventos", "Agenda", "Configurações"],
    ["/planos?tab=services", "Planos", "Serviços"],
    ["/financeiro/receitas", "Financeiro", "Receitas"],
  ])(
    "sincroniza o módulo e o único submenu ativo no acesso direto a %s",
    (pathname, moduleLabel, childLabel) => {
      renderShell(pathname);
      fireEvent.mouseEnter(
        screen.getByRole("complementary", { name: "Navegação principal" }),
      );

      const moduleButton = screen.getByRole("button", { name: moduleLabel });
      expect(moduleButton).toHaveAttribute("aria-expanded", "true");
      expect(moduleButton).not.toHaveAttribute("aria-current");
      expect(screen.getByRole("link", { name: childLabel })).toHaveAttribute(
        "aria-current",
        "page",
      );
      expect(screen.getAllByRole("link").filter(
        (link) => link.getAttribute("aria-current") === "page",
      )).toHaveLength(1);
    },
  );

  it("mantém o submenu semanticamente aninhado e o botão pai acessível por teclado", () => {
    renderShell();
    fireEvent.mouseEnter(
      screen.getByRole("complementary", { name: "Navegação principal" }),
    );
    const agendaButton = screen.getByRole("button", { name: "Agenda" });
    const parentItem = agendaButton.closest("li");
    const submenuId = agendaButton.getAttribute("aria-controls");

    agendaButton.focus();
    expect(agendaButton).toHaveFocus();
    expect(agendaButton).toHaveAttribute("type", "button");
    expect(parentItem.querySelector(`#${submenuId}`)).not.toBeNull();
  });
});
