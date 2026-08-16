import React from "react";
import "@testing-library/jest-dom";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route as MockRoute } from "react-router-dom";
import MockAppShell from "../components/AppShell";
import Routes from ".";

jest.mock("./MyRoute", () => function MyRouteMock({ component: Component, ...props }) {
  return <MockRoute {...props} render={(routeProps) => <Component {...routeProps} />} />;
});

jest.mock("../contexts/ClinicContext", () => ({
  useClinicContext: () => ({
    displayName: "Clínica de Teste com Nome Extenso",
    logoSrc: null,
    brandInitials: "CT",
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
jest.mock("../pages/SettingsDocuments", () => () => <div>Configurações</div>);

jest.mock("../pages/Agendamentos", () => function AgendaRouteMock() {
  return (
    <MockAppShell pageTitle="Agenda">
      <h1>Agendamentos</h1>
    </MockAppShell>
  );
});
jest.mock("../components/ImobNavbar/TopNavbar", () => function OldNavbarMock() {
  return <nav data-testid="old-navbar">Navbar antiga</nav>;
});
jest.mock("../pages/Home", () => () => <div>Home</div>);
jest.mock("../pages/Politica", () => () => <div>Política</div>);
jest.mock("../pages/Login", () => () => <div>Login</div>);
jest.mock("../pages/SemAcesso", () => () => <div>Sem acesso</div>);
jest.mock("../pages/Page404", () => () => <div>404</div>);
jest.mock("../pages/PatientSelfSignup", () => () => <div>Cadastro</div>);
jest.mock("../pages/Register", () => () => <div>Registro</div>);
jest.mock("../pages/PatientsNew", () => () => <div>Novo paciente</div>);
jest.mock("../pages/PatientsSearch", () => () => <div>Pacientes</div>);
jest.mock("../pages/PatientDetails", () => () => <div>Paciente</div>);
jest.mock("../pages/Dashboard", () => () => <div>Painel</div>);
jest.mock("../pages/PatientEvaluationNew", () => () => <div>Nova avaliação</div>);
jest.mock("../pages/PatientEvaluationDetails", () => () => <div>Avaliação</div>);
jest.mock("../pages/Financeiro", () => () => <div>Financeiro</div>);
jest.mock("../pages/SchedulingEvents", () => () => <div>Eventos</div>);
jest.mock("../pages/Planos", () => () => <div>Planos</div>);
jest.mock("../pages/PlatformPaused", () => () => <div>Plataforma</div>);

describe("fluxo real Menu para Agenda", () => {
  it("navega para /agendamentos, renderiza a Agenda no App Shell e não monta a navbar antiga", () => {
    render(
      <MemoryRouter initialEntries={["/menu"]}>
        <Routes />
      </MemoryRouter>,
    );

    const main = screen.getByRole("main");
    fireEvent.click(within(main).getByRole("link", { name: "Agenda" }));

    expect(screen.getByRole("heading", { name: "Agendamentos" })).toBeInTheDocument();
    fireEvent.mouseEnter(
      screen.getByRole("complementary", { name: "Navegação principal" }),
    );
    expect(screen.getByRole("button", { name: "Agenda" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    expect(screen.getByRole("button", { name: "Agenda" })).not.toHaveAttribute(
      "aria-current",
    );
    expect(screen.getByRole("link", { name: "Agenda" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.queryByTestId("old-navbar")).not.toBeInTheDocument();
  });
});
