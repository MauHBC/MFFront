import React from "react";
import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import MyRoute from "./MyRoute";
import { useAuthorization } from "../contexts/AuthorizationContext";

jest.mock("../hooks/useAuthRedirect", () => ({ useAuthRedirect: () => null }));
jest.mock("../contexts/AuthorizationContext", () => ({
  useAuthorization: jest.fn(),
  isTeamAdministrator: (context) => context?.is_administrator === true,
}));

const ProtectedPage = () => <div>Conteúdo protegido</div>;

const renderRoute = (props = {}) => render(
  <MemoryRouter initialEntries={["/pacientes"]}>
    <MyRoute
      exact
      path="/pacientes"
      component={ProtectedPage}
      isClosed
      requiredModule="patients"
      {...props}
    />
  </MemoryRouter>,
);

describe("MyRoute authorization guard", () => {
  it.each(["forbidden", "ready"])(
    "falha fechado para %s sem permissao",
    (status) => {
      useAuthorization.mockReturnValue({
        status,
        context: status === "ready" ? { authorization_state: "no_permissions" } : null,
        canAccessModule: () => false,
        hasCapability: () => false,
      });
      renderRoute();
      expect(screen.getByText("Você não tem acesso")).toBeInTheDocument();
      expect(screen.queryByText("Conteúdo protegido")).not.toBeInTheDocument();
    },
  );

  it("nao monta a pagina enquanto carrega", () => {
    useAuthorization.mockReturnValue({ status: "loading" });
    renderRoute();
    expect(screen.getByRole("status")).toHaveTextContent("Validando acesso");
    expect(screen.queryByText("Conteúdo protegido")).not.toBeInTheDocument();
  });

  it("falha fechado em erro do contexto", () => {
    useAuthorization.mockReturnValue({ status: "error" });
    renderRoute();
    expect(screen.getByRole("alert")).toHaveTextContent("Não foi possível validar");
    expect(screen.queryByText("Conteúdo protegido")).not.toBeInTheDocument();
  });

  it("permite acesso direto apenas ao modulo oficial", () => {
    useAuthorization.mockReturnValue({
      status: "ready",
      context: { authorization_state: "authorized", is_administrator: false },
      canAccessModule: (moduleKey) => moduleKey === "schedule",
      hasCapability: () => true,
    });
    const { rerender } = renderRoute({ requiredModule: "schedule" });
    expect(screen.getByText("Conteúdo protegido")).toBeInTheDocument();

    rerender(
      <MemoryRouter initialEntries={["/pacientes"]}>
        <MyRoute
          exact
          path="/pacientes"
          component={ProtectedPage}
          isClosed
          requiredModule="patients"
        />
      </MemoryRouter>,
    );
    expect(screen.getByText("Você não tem acesso")).toBeInTheDocument();
  });

  it("exige capacidade adicional quando declarada", () => {
    useAuthorization.mockReturnValue({
      status: "ready",
      context: { authorization_state: "authorized", is_administrator: false },
      canAccessModule: () => true,
      hasCapability: () => false,
    });
    renderRoute({ requiredCapability: "finance.configure" });
    expect(screen.getByText("Você não tem acesso")).toBeInTheDocument();
  });
});
