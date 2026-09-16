import React from "react";
import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Register from ".";
import LegacyAccountForm from "./LegacyAccountForm";
import { useAuthorization } from "../../contexts/AuthorizationContext";

jest.mock("../../contexts/AuthorizationContext", () => ({ useAuthorization: jest.fn() }));
jest.mock("./LegacyAccountForm", () => jest.fn(() => <div>Formulário legacy</div>));

beforeEach(() => {
  jest.clearAllMocks();
  LegacyAccountForm.mockImplementation(() => <div>Formulário legacy</div>);
});

test.each(["idle", "loading", "error", "forbidden"])(
  "não monta efeitos/handlers legacy durante %s mesmo com contexto anterior",
  (status) => {
    useAuthorization.mockReturnValue({ status, isAdministrator: true, context: {} });
    render(<MemoryRouter><Register /></MemoryRouter>);
    expect(LegacyAccountForm).not.toHaveBeenCalled();
    expect(screen.queryByText("Formulário legacy")).not.toBeInTheDocument();
  },
);

test("membership monta somente o aviso e links reais, nunca o componente legacy", () => {
  useAuthorization.mockReturnValue({
    status: "ready", isAdministrator: true, context: { authorization_source: "membership" },
  });
  render(<MemoryRouter><Register /></MemoryRouter>);
  expect(screen.getByText("A edição da conta não está disponível nesta versão."))
    .toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Recuperar senha" }))
    .toHaveAttribute("href", "/recuperar-senha");
  expect(screen.getByRole("link", { name: "Voltar ao início" })).toHaveAttribute("href", "/menu");
  expect(LegacyAccountForm).not.toHaveBeenCalled();
});

test.each([null, { authorization_source: null }, { authorization_source: "unknown" }])(
  "contexto incoerente não vira fallback legacy: %j",
  (context) => {
    useAuthorization.mockReturnValue({ status: "ready", isAdministrator: true, context });
    render(<MemoryRouter><Register /></MemoryRouter>);
    expect(screen.getByRole("alert")).toHaveTextContent("Não foi possível validar");
    expect(LegacyAccountForm).not.toHaveBeenCalled();
  },
);

test.each([{}, { authorization_source: "legacy" }])("preserva contrato legacy resolvido: %j", (context) => {
  useAuthorization.mockReturnValue({ status: "ready", isAdministrator: true, context });
  render(<MemoryRouter><Register history={{ push: jest.fn() }} /></MemoryRouter>);
  expect(screen.getByText("Formulário legacy")).toBeInTheDocument();
});
