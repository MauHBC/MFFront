import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { Router, Route, Switch } from "react-router-dom";
import { createMemoryHistory } from "history";
import AuthenticatedEntry from "./AuthenticatedEntry";
import { useAuthorization } from "../contexts/AuthorizationContext";

jest.mock("../contexts/AuthorizationContext", () => ({ useAuthorization: jest.fn() }));
jest.mock("../pages/Menu", () => () => <div>Fallback de módulos</div>);
jest.mock("../pages/SemAcesso", () => () => <div>Acesso negado</div>);

function renderEntry(path = "/menu") {
  const history = createMemoryHistory({ initialEntries: [path] });
  render(
    <Router history={history}>
      <Switch>
        <Route exact path="/menu" component={AuthenticatedEntry} />
        <Route path="/agendamentos" render={() => <div>Agenda protegida</div>} />
        <Route path="/pacientes/:id" render={() => <div>Link interno</div>} />
      </Switch>
    </Router>,
  );
  return history;
}

beforeEach(() => useAuthorization.mockReturnValue({ status: "ready", canAccessModule: () => true }));

it("substitui a entrada pela Agenda apenas com acesso oficial", () => {
  const history = renderEntry();
  expect(history.location.pathname).toBe("/agendamentos");
  expect(history.action).toBe("REPLACE");
  expect(screen.queryByText("Fallback de módulos")).not.toBeInTheDocument();
});

it("preserva o fallback quando Agenda não é permitida, inclusive own indisponível", () => {
  useAuthorization.mockReturnValue({ status: "ready", canAccessModule: () => false });
  expect(renderEntry().location.pathname).toBe("/menu");
  expect(screen.getByText("Fallback de módulos")).toBeInTheDocument();
});

it.each(["idle", "loading", "error", "invalid", "forbidden"])("não navega ou monta módulos em %s", (status) => {
  useAuthorization.mockReturnValue({ status, canAccessModule: () => true });
  expect(renderEntry().location.pathname).toBe("/menu");
  expect(screen.queryByText("Agenda protegida")).not.toBeInTheDocument();
  expect(screen.queryByText("Fallback de módulos")).not.toBeInTheDocument();
});

it("aguarda a nova autorização antes de escolher a entrada", () => {
  useAuthorization.mockReturnValue({ status: "loading", canAccessModule: () => false });
  const history = createMemoryHistory({ initialEntries: ["/menu"] });
  const { rerender } = render(<Router history={history}><AuthenticatedEntry /></Router>);
  expect(history.location.pathname).toBe("/menu");
  useAuthorization.mockReturnValue({ status: "ready", canAccessModule: () => true });
  rerender(<Router history={history}><AuthenticatedEntry /></Router>);
  expect(history.location.pathname).toBe("/agendamentos");
});

it("preserva pathname, query e fragmento de links internos", () => {
  const history = renderEntry("/pacientes/42?tab=historico#avaliacao");
  expect(history.location).toMatchObject({ pathname: "/pacientes/42", search: "?tab=historico", hash: "#avaliacao" });
  expect(useAuthorization).not.toHaveBeenCalled();
});
