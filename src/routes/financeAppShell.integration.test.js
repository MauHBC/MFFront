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
    expect(screen.getByRole("link", { name: "Financeiro" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.queryByTestId("old-navbar")).not.toBeInTheDocument();
    expect(document.querySelectorAll("main")).toHaveLength(1);
  });

  it("mantém o App Shell no acesso direto e refresh conceitual", () => {
    renderRoutes("/financeiro");

    expect(screen.getByRole("link", { name: "Financeiro" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.queryByTestId("old-navbar")).not.toBeInTheDocument();
    expect(document.querySelectorAll("main")).toHaveLength(1);
  });

  it("preserva os parâmetros do deep link de mensalidades vindo da Agenda", () => {
    const pathname = "/financeiro?view=mensalidades&month=2026-07&patient_id=41&patient_name=Ana";
    renderRoutes(pathname);

    expect(screen.getByTestId("finance-location")).toHaveTextContent(pathname);
    expect(screen.getByRole("link", { name: "Financeiro" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });
});
