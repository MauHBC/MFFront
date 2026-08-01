import React from "react";
import "@testing-library/jest-dom";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import {
  MemoryRouter,
  Route as MockRoute,
  useLocation as mockUseLocation,
} from "react-router-dom";
import Routes from ".";

jest.mock("./MyRoute", () => function MyRouteMock({ component: Component, ...props }) {
  return <MockRoute {...props} render={(routeProps) => <Component {...routeProps} />} />;
});

jest.mock("../contexts/ClinicContext", () => ({
  useClinicContext: () => ({
    displayName: "Clínica de Teste",
    logoSrc: null,
    brandInitials: "CT",
  }),
}));
jest.mock("../hooks/useAuth", () => ({
  useAuth: () => ({ isLoggedIn: true, username: "Maurício" }),
}));
jest.mock("../hooks/useLogout", () => ({ useLogout: () => jest.fn() }));
jest.mock("../contexts/AuthorizationContext", () => ({
  useAuthorization: () => ({ canViewTeam: false }),
}));
jest.mock("../pages/Equipe", () => () => <div>Equipe</div>);

jest.mock("../pages/Financeiro", () => function FinanceRouteMock() {
  const location = mockUseLocation();
  return (
    <section aria-label="Conteúdo financeiro">
      <h1>Visão financeira</h1>
      <output data-testid="finance-location">
        {location.pathname}
        {location.search}
      </output>
    </section>
  );
});
jest.mock("../components/ImobNavbar/TopNavbar", () => () => (
  <nav data-testid="old-navbar">Navbar antiga</nav>
));
jest.mock("../pages/Home", () => () => <div>Home</div>);
jest.mock("../pages/Politica", () => () => <div>Política</div>);
jest.mock("../pages/Login", () => () => <div>Login</div>);
jest.mock("../pages/SemAcesso", () => () => <div>Sem acesso</div>);
jest.mock("../pages/Page404", () => () => <div>404</div>);
jest.mock("../pages/PatientSelfSignup", () => () => <div>Cadastro público</div>);
jest.mock("../pages/Register", () => () => <div>Registro</div>);
jest.mock("../pages/PatientsNew", () => () => <div>Novo paciente</div>);
jest.mock("../pages/PatientsSearch", () => () => <div>Pacientes</div>);
jest.mock("../pages/PatientDetails", () => () => <div>Paciente</div>);
jest.mock("../pages/Dashboard", () => () => <div>Painel</div>);
jest.mock("../pages/PatientEvaluationNew", () => () => <div>Nova avaliação</div>);
jest.mock("../pages/PatientEvaluationDetails", () => () => <div>Avaliação</div>);
jest.mock("../pages/Agendamentos", () => () => <div>Agenda</div>);
jest.mock("../pages/SchedulingEvents", () => () => <div>Eventos</div>);
jest.mock("../pages/Planos", () => () => <div>Planos</div>);
jest.mock("../pages/PlatformPaused", () => () => <div>Plataforma</div>);

function renderRoutes(pathname) {
  return render(
    <MemoryRouter initialEntries={[pathname]}>
      <Routes />
    </MemoryRouter>,
  );
}

describe("rota do Financeiro no App Shell", () => {
  afterEach(cleanup);

  it("navega do Menu para /financeiro pelo fluxo real e remove a navbar antiga", () => {
    renderRoutes("/menu");

    fireEvent.click(within(screen.getByRole("main")).getByRole("link", { name: "Financeiro" }));

    expect(screen.getByRole("heading", { name: "Visão financeira" })).toBeInTheDocument();
    fireEvent.mouseEnter(
      screen.getByRole("complementary", { name: "Navegação principal" }),
    );
    expect(screen.getByRole("button", { name: "Financeiro" })).not.toHaveAttribute(
      "aria-current",
    );
    expect(screen.getByRole("link", { name: "Visão geral" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.queryByTestId("old-navbar")).not.toBeInTheDocument();
    expect(document.querySelectorAll("main")).toHaveLength(1);
  });

  it("mantém o App Shell no acesso direto e refresh conceitual", () => {
    renderRoutes("/financeiro");

    fireEvent.mouseEnter(
      screen.getByRole("complementary", { name: "Navegação principal" }),
    );
    expect(screen.getByRole("link", { name: "Visão geral" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.queryByTestId("old-navbar")).not.toBeInTheDocument();
    expect(document.querySelectorAll("main")).toHaveLength(1);
  });

  it("preserva os parâmetros do deep link de mensalidades vindo da Agenda", () => {
    const pathname = "/financeiro?view=mensalidades&month=2026-07&patient_id=41&patient_name=Ana";
    renderRoutes(pathname);

    expect(screen.getByTestId("finance-location")).toHaveTextContent(
      "/financeiro/receitas?view=mensalidades&month=2026-07&patient_id=41&patient_name=Ana",
    );
    fireEvent.mouseEnter(
      screen.getByRole("complementary", { name: "Navegação principal" }),
    );
    expect(screen.getByRole("link", { name: "Receitas" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it.each([
    ["/financeiro/visao-geral", "Visão geral"],
    ["/financeiro/receitas", "Receitas"],
    ["/financeiro/despesas", "Despesas da clínica"],
    ["/financeiro/configuracoes", "Configurações"],
    ["/financeiro/configuracoes/formas-pagamento", "Configurações"],
    ["/financeiro/configuracoes/categorias-despesas", "Configurações"],
  ])("mantém Financeiro expandido e destaca %s", (pathname, activeLabel) => {
    renderRoutes(pathname);

    expect(screen.getByRole("button", { name: "Financeiro" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    fireEvent.mouseEnter(
      screen.getByRole("complementary", { name: "Navegação principal" }),
    );
    expect(screen.getByRole("link", { name: activeLabel })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(document.querySelectorAll(
      "#app-subnavigation-financial [aria-current='page']",
    )).toHaveLength(1);
    expect(screen.getAllByRole("link", {
      name: /^(Visão geral|Receitas|Despesas da clínica|Configurações)$/,
    })).toHaveLength(4);
  });
});
