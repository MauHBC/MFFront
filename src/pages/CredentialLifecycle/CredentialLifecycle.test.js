import React from "react";
import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { useDispatch } from "react-redux";
import {
  completeCredentialAction,
  inspectCredentialAction,
  requestCredentialRecovery,
} from "../../services/credentialLifecycle";
import CredentialAction from "./CredentialAction";
import RecoveryRequest from "./RecoveryRequest";

jest.mock("../../services/credentialLifecycle", () => ({
  completeCredentialAction: jest.fn(),
  inspectCredentialAction: jest.fn(),
  requestCredentialRecovery: jest.fn(),
}));
jest.mock("react-redux", () => ({ useDispatch: jest.fn() }));

const dispatch = jest.fn();

const renderPublicPage = (component, { strict = false } = {}) => render(
  strict
    ? <React.StrictMode><MemoryRouter>{component}</MemoryRouter></React.StrictMode>
    : <MemoryRouter>{component}</MemoryRouter>,
);

beforeEach(() => {
  dispatch.mockReset();
  useDispatch.mockReturnValue(dispatch);
  completeCredentialAction.mockReset();
  inspectCredentialAction.mockReset();
  requestCredentialRecovery.mockReset();
  window.history.replaceState(null, "", "/");
});

test("solicitação de recuperação exibe resposta neutra", async () => {
  requestCredentialRecovery.mockResolvedValue({ data: { accepted: true } });
  renderPublicPage(<RecoveryRequest />);

  fireEvent.change(screen.getByLabelText("E-mail"), {
    target: { value: "pessoa@example.test" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Enviar link" }));

  expect(await screen.findByRole("status")).toHaveTextContent(
    "Se a conta estiver apta, enviaremos um link para o e-mail informado.",
  );
  expect(requestCredentialRecovery).toHaveBeenCalledWith("pessoa@example.test");
});

test("consome o token do fragmento e o remove imediatamente da URL", async () => {
  window.history.replaceState(null, "", "/credencial#token=selector.proof");
  inspectCredentialAction.mockResolvedValue({ data: { purpose: "first_access" } });
  completeCredentialAction.mockResolvedValue({ data: { completed: true } });

  renderPublicPage(<CredentialAction />, { strict: true });

  expect(window.location.hash).toBe("");
  expect(inspectCredentialAction).toHaveBeenCalledWith("selector.proof");
  expect(await screen.findByRole("heading", { name: "Crie sua senha" })).toBeInTheDocument();

  fireEvent.change(screen.getByLabelText("Nova senha"), {
    target: { value: "senha de primeiro acesso" },
  });
  fireEvent.change(screen.getByLabelText("Confirmar senha"), {
    target: { value: "senha de primeiro acesso" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Criar senha" }));

  expect(await screen.findByRole("heading", { name: "Senha criada" })).toBeInTheDocument();
  expect(completeCredentialAction).toHaveBeenCalledWith({
    token: "selector.proof",
    password: "senha de primeiro acesso",
    passwordConfirmation: "senha de primeiro acesso",
  });
  expect(dispatch).toHaveBeenCalledWith({ type: "LOGIN_FAILURE" });
  expect(screen.getByRole("link", { name: "Ir para o login" })).toHaveAttribute("href", "/login/");
});

test("link recusado termina em estado inválido sem formulário", async () => {
  window.history.replaceState(null, "", "/credencial#token=revogado.proof");
  inspectCredentialAction.mockRejectedValue({ response: { status: 404 } });

  renderPublicPage(<CredentialAction />);

  expect(await screen.findByRole("heading", { name: "Link inválido ou expirado" }))
    .toBeInTheDocument();
  expect(screen.queryByLabelText("Nova senha")).not.toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Solicitar novo link" }))
    .toHaveAttribute("href", "/recuperar-senha");
});

test("falha transitória ao inspecionar permite tentar novamente sem perder o token", async () => {
  window.history.replaceState(null, "", "/credencial#token=selector.proof");
  inspectCredentialAction
    .mockRejectedValueOnce({ response: { status: 503 } })
    .mockResolvedValueOnce({ data: { purpose: "password_reset" } });

  renderPublicPage(<CredentialAction />);
  expect(await screen.findByRole("heading", { name: "Não foi possível verificar o link" }))
    .toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));

  expect(await screen.findByRole("heading", { name: "Defina uma nova senha" }))
    .toBeInTheDocument();
  expect(inspectCredentialAction).toHaveBeenLastCalledWith("selector.proof");
  expect(window.location.hash).toBe("");
});

test("erro de política preserva o formulário sem expor detalhes do token", async () => {
  window.history.replaceState(null, "", "/credencial#token=selector.proof");
  inspectCredentialAction.mockResolvedValue({ data: { purpose: "password_reset" } });
  completeCredentialAction.mockRejectedValue({
    response: { status: 400, data: { error: "PASSWORD_COMMON_OR_COMPROMISED" } },
  });

  renderPublicPage(<CredentialAction />);
  await screen.findByRole("heading", { name: "Defina uma nova senha" });
  fireEvent.change(screen.getByLabelText("Nova senha"), {
    target: { value: "senha muito comum" },
  });
  fireEvent.change(screen.getByLabelText("Confirmar senha"), {
    target: { value: "senha muito comum" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Criar senha" }));

  await waitFor(() => expect(screen.getByRole("alert"))
    .toHaveTextContent("Escolha uma senha menos comum."));
  expect(screen.getByLabelText("Nova senha")).toHaveValue("senha muito comum");
  expect(document.body.textContent).not.toContain("selector.proof");
});
