import React from "react";
import "@testing-library/jest-dom";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { toast } from "react-toastify";
import { usePublicClinicContext } from "../../contexts/PublicClinicContext";
import history from "../../services/history";
import Login from ".";

jest.mock("react-redux", () => ({ useDispatch: jest.fn(), useSelector: jest.fn() }));
jest.mock("react-toastify", () => ({ toast: { error: jest.fn() } }));
jest.mock("../../contexts/PublicClinicContext", () => ({ usePublicClinicContext: jest.fn() }));
jest.mock("../../services/history", () => ({ replace: jest.fn() }));
jest.mock("../../components/Loading", () => () => null);

const dispatch = jest.fn();
let state;
const renderLogin = (returnTo) => render(
  <MemoryRouter initialEntries={[{ pathname: "/login", state: { returnTo } }]}>
    <Login />
  </MemoryRouter>,
);

beforeEach(() => {
  jest.clearAllMocks();
  state = { auth: { isLoggedIn: false, isLoading: false } };
  useDispatch.mockReturnValue(dispatch);
  useSelector.mockImplementation((selector) => selector(state));
  usePublicClinicContext.mockReturnValue({
    publicClinic: { has_public_tenant: false },
    displayName: "Sistema de Gestão Clínica",
    loaded: true,
    loading: false,
    logoSrc: null,
  });
});

test("apresenta o login Motria sem os acessos ao trial e à recuperação", () => {
  renderLogin();

  expect(screen.getByRole("heading", { name: "Entrar na sua conta" })).toBeInTheDocument();
  expect(screen.getAllByAltText("Motria")).toHaveLength(2);
  expect(screen.queryByText(/Sistema de Gestão Clínica|\bSG\b/)).not.toBeInTheDocument();
  expect(screen.getByLabelText("E-mail")).toHaveAttribute("type", "email");
  expect(screen.getByLabelText("E-mail")).toHaveAttribute("autocomplete", "username");
  expect(screen.getByLabelText("Senha")).toHaveAttribute("autocomplete", "current-password");
  expect(screen.queryByRole("link", { name: "Esqueci minha senha" })).not.toBeInTheDocument();
  expect(screen.queryByRole("link", { name: "Começar teste grátis" })).not.toBeInTheDocument();
  expect(screen.queryByText(/Ainda não tem uma conta/)).not.toBeInTheDocument();
});

test("mostra e oculta a senha por botão acessível sem enviar o formulário", () => {
  renderLogin();
  const password = screen.getByLabelText("Senha");
  const reveal = screen.getByRole("button", { name: "Mostrar senha" });

  expect(password).toHaveAttribute("type", "password");
  fireEvent.click(reveal);
  expect(password).toHaveAttribute("type", "text");
  expect(screen.getByRole("button", { name: "Ocultar senha" })).toHaveAttribute("aria-pressed", "true");
  fireEvent.click(screen.getByRole("button", { name: "Ocultar senha" }));
  expect(password).toHaveAttribute("type", "password");
  expect(dispatch).not.toHaveBeenCalled();
});

test("validação comunica erros por campo e mantém os toasts funcionais", () => {
  renderLogin();
  fireEvent.click(screen.getByRole("button", { name: "Entrar" }));

  expect(screen.getByText("Informe um e-mail válido.")).toHaveAttribute("role", "alert");
  expect(screen.getByText("Informe sua senha.")).toHaveAttribute("role", "alert");
  expect(screen.getByLabelText("E-mail")).toHaveAttribute("aria-invalid", "true");
  expect(screen.getByLabelText("Senha")).toHaveAttribute("aria-invalid", "true");
  expect(toast.error).toHaveBeenCalledWith("Email inválido");
  expect(toast.error).toHaveBeenCalledWith("Senha inválida");
  expect(dispatch).not.toHaveBeenCalled();
});

test.each([
  [undefined, "/menu"],
  ["/cadastro", "/cadastro"],
  ["https://example.test/fora", "/menu"],
  ["/financeiro", "/menu"],
])("submit conserva o destino permitido para %s", (returnTo, expected) => {
  renderLogin(returnTo);
  fireEvent.change(screen.getByLabelText("E-mail"), { target: { value: "pessoa@example.test" } });
  fireEvent.change(screen.getByLabelText("Senha"), { target: { value: "Senha-atual-123" } });
  fireEvent.submit(screen.getByLabelText("Senha").closest("form"));

  expect(dispatch).toHaveBeenCalledWith({
    type: "LOGIN_REQUEST",
    payload: { email: "pessoa@example.test", password: "Senha-atual-123", redirectTo: expected },
  });
});

test("durante o login, desabilita novo submit e anuncia o estado", () => {
  state.auth.isLoading = true;
  renderLogin();
  expect(screen.getByRole("button", { name: "Entrando..." })).toBeDisabled();
  expect(screen.getByText("Validando seu acesso...")).toHaveAttribute("role", "status");
  expect(screen.getByLabelText("Senha").closest("form")).toHaveAttribute("aria-busy", "true");
  fireEvent.submit(screen.getByLabelText("Senha").closest("form"));
  expect(dispatch).not.toHaveBeenCalled();
});

test("sessão já autenticada mantém o retorno seguro do gate atual", () => {
  state.auth.isLoggedIn = true;
  renderLogin("/cadastro");
  expect(history.replace).toHaveBeenCalledWith("/cadastro");
});

test("domínio de clínica mantém o branding white-label legado", () => {
  usePublicClinicContext.mockReturnValue({
    publicClinic: { has_public_tenant: true }, displayName: "Clínica Exemplo",
    loaded: true, loading: false, logoSrc: "/logo-clinica.png",
  });
  renderLogin();
  expect(screen.getByRole("heading", { name: "Clínica Exemplo" })).toBeInTheDocument();
  expect(screen.getByAltText("Clínica Exemplo")).toHaveAttribute("src", "/logo-clinica.png");
  expect(screen.queryByRole("heading", { name: "Entrar na sua conta" })).not.toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Esqueci minha senha" })).toHaveAttribute("href", "/recuperar-senha");
});
