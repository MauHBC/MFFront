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
  Link as MockLink,
  MemoryRouter,
  Route as MockRoute,
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

jest.mock("../pages/Planos", () => function PlansRouteMock() {
  return (
    <section aria-label="Conteúdo de Planos">
      <h1>Administração de Planos</h1>
      <MockLink to="/planos/pacientes/41">Detalhes do plano</MockLink>
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
jest.mock("../pages/Financeiro", () => () => <div>Financeiro</div>);
jest.mock("../pages/SchedulingEvents", () => () => <div>Eventos</div>);
jest.mock("../pages/PlatformPaused", () => () => <div>Plataforma</div>);

function renderRoutes(pathname) {
  return render(
    <MemoryRouter initialEntries={[pathname]}>
      <Routes />
    </MemoryRouter>,
  );
}

describe("rotas de Planos no App Shell", () => {
  afterEach(cleanup);

  it("navega do Menu para /planos pelo fluxo real e remove a navbar antiga", () => {
    renderRoutes("/menu");

    fireEvent.click(within(screen.getByRole("main")).getByRole("link", { name: "Planos" }));

    expect(screen.getByRole("heading", { name: "Administração de Planos" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Planos" })).toHaveAttribute("aria-current", "page");
    expect(screen.queryByTestId("old-navbar")).not.toBeInTheDocument();
    expect(document.querySelectorAll("main")).toHaveLength(1);
  });

  it.each(["/planos", "/planos/pacientes/41"])(
    "mantém o App Shell e Planos ativo no acesso direto a %s",
    (pathname) => {
      renderRoutes(pathname);

      expect(screen.getByRole("link", { name: "Planos" })).toHaveAttribute(
        "aria-current",
        "page",
      );
      expect(screen.queryByTestId("old-navbar")).not.toBeInTheDocument();
      expect(document.querySelectorAll("main")).toHaveLength(1);
    },
  );

  it("preserva a instância do App Shell entre a lista e o detalhe", () => {
    renderRoutes("/planos");
    const sidebar = screen.getByRole("complementary", { name: "Navegação principal" });

    fireEvent.click(screen.getByRole("link", { name: "Detalhes do plano" }));

    expect(screen.getByRole("complementary", { name: "Navegação principal" })).toBe(sidebar);
    expect(screen.getByRole("link", { name: "Planos" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });
});
