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
    displayName: "Clínica de Fisioterapia com Nome Longo",
    logoSrc: null,
    brandInitials: "CF",
  }),
}));
jest.mock("../hooks/useAuth", () => ({
  useAuth: () => ({ isLoggedIn: true, username: "Maurício" }),
}));
jest.mock("../hooks/useLogout", () => ({ useLogout: () => jest.fn() }));
jest.mock("../contexts/AuthorizationContext", () => ({
  useAuthorization: () => ({
    canViewTeam: false, canAccessModule: () => true, hasCapability: () => true,
  }),
}));
jest.mock("../pages/Equipe", () => () => <div>Equipe</div>);

jest.mock("../pages/PatientsSearch", () => function PatientsSearchMock() {
  return (
    <div>
      <h1>Consultar paciente</h1>
      <MockLink to="/pacientes/novo">Novo paciente</MockLink>
    </div>
  );
});
jest.mock("../pages/PatientsNew", () => () => <h1>Novo paciente</h1>);
jest.mock("../pages/PatientDetails", () => () => <h1>Perfil do paciente</h1>);
jest.mock("../pages/PatientEvaluationNew", () => () => <h1>Nova avaliação</h1>);
jest.mock("../pages/PatientEvaluationDetails", () => () => <h1>Avaliação</h1>);
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
jest.mock("../pages/Dashboard", () => () => <div>Painel</div>);
jest.mock("../pages/Agendamentos", () => () => <div>Agenda</div>);
jest.mock("../pages/Financeiro", () => () => <div>Financeiro</div>);
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

describe("rotas de Pacientes no App Shell", () => {
  afterEach(cleanup);

  it("navega do Menu para a rota real de Pacientes sem mockar o App Shell", () => {
    renderRoutes("/menu");

    fireEvent.click(within(screen.getByRole("main")).getByRole("link", { name: "Pacientes" }));

    expect(screen.getByRole("heading", { name: "Consultar paciente" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Pacientes" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.queryByTestId("old-navbar")).not.toBeInTheDocument();
    expect(document.querySelectorAll("main")).toHaveLength(1);
  });

  it.each([
    ["/pacientes", "Consultar paciente"],
    ["/pacientes/consultar", "Consultar paciente"],
    ["/pacientes/novo", "Novo paciente"],
    ["/pacientes/115", "Perfil do paciente"],
    ["/pacientes/115/avaliacoes/nova", "Nova avaliação"],
    ["/pacientes/115/avaliacoes/20", "Avaliação"],
  ])("mantém Pacientes ativo no acesso direto a %s", (pathname, heading) => {
    renderRoutes(pathname);

    expect(screen.getByRole("heading", { name: heading })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Pacientes" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.queryByTestId("old-navbar")).not.toBeInTheDocument();
    expect(document.querySelectorAll("main")).toHaveLength(1);
  });

  it("preserva a mesma instância do App Shell entre subrotas de Pacientes", () => {
    renderRoutes("/pacientes");
    const sidebar = screen.getByRole("complementary", { name: "Navegação principal" });

    fireEvent.click(screen.getByRole("link", { name: "Novo paciente" }));

    expect(screen.getByRole("complementary", { name: "Navegação principal" })).toBe(sidebar);
    expect(screen.getByRole("heading", { name: "Novo paciente" })).toBeInTheDocument();
  });
});
