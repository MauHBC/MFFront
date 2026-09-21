import React from "react";
import "@testing-library/jest-dom";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
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

  expect(await screen.findByText("Se a conta estiver apta, enviaremos um link para o e-mail informado."))
    .toHaveAttribute("role", "status");
  expect(requestCredentialRecovery).toHaveBeenCalledWith("pessoa@example.test");
  expect(screen.getAllByAltText("Motria")).toHaveLength(2);
  expect(screen.getByRole("heading", { name: "Recuperar senha" })).toBeInTheDocument();
  expect(screen.getByText("Informe seu e-mail para receber o link de recuperação.")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Voltar para o login" })).toHaveAttribute("href", "/login");
});

test("recuperação valida e-mail e anuncia envio sem permitir novo submit", async () => {
  let resolveRequest;
  requestCredentialRecovery.mockImplementation(() => new Promise((resolve) => { resolveRequest = resolve; }));
  renderPublicPage(<RecoveryRequest />);
  expect(screen.getByLabelText("E-mail")).toHaveAttribute("autocomplete", "email");
  expect(screen.getByPlaceholderText("seu@email.com")).toBeInTheDocument();
  fireEvent.submit(screen.getByLabelText("E-mail").closest("form"));
  expect(screen.getByRole("alert")).toHaveTextContent("Informe um e-mail válido.");
  expect(requestCredentialRecovery).not.toHaveBeenCalled();

  fireEvent.change(screen.getByLabelText("E-mail"), { target: { value: "pessoa@example.test" } });
  fireEvent.submit(screen.getByLabelText("E-mail").closest("form"));
  expect(screen.getByRole("button", { name: "Enviando..." })).toBeDisabled();
  expect(screen.getByLabelText("E-mail").closest("form")).toHaveAttribute("aria-busy", "true");
  expect(screen.getByRole("status")).toHaveTextContent("Enviando solicitação...");
  fireEvent.submit(screen.getByLabelText("E-mail").closest("form"));
  expect(requestCredentialRecovery).toHaveBeenCalledTimes(1);
  await act(async () => { resolveRequest({ data: { accepted: true } }); });
  expect(screen.getByRole("status")).toHaveTextContent("Se a conta estiver apta");
});

test("falha na recuperação mantém o formulário e comunica erro", async () => {
  requestCredentialRecovery.mockRejectedValue(new Error("network"));
  renderPublicPage(<RecoveryRequest />);
  fireEvent.change(screen.getByLabelText("E-mail"), { target: { value: "pessoa@example.test" } });
  fireEvent.submit(screen.getByLabelText("E-mail").closest("form"));
  expect(await screen.findByRole("alert")).toHaveTextContent("Não foi possível solicitar o link agora.");
  expect(screen.getByRole("button", { name: "Enviar link" })).toBeEnabled();
});

test("consome o token do fragmento e o remove imediatamente da URL", async () => {
  window.history.replaceState(null, "", "/credencial#token=selector.proof");
  inspectCredentialAction.mockResolvedValue({ data: { purpose: "first_access" } });
  completeCredentialAction.mockResolvedValue({ data: { completed: true } });

  renderPublicPage(<CredentialAction />, { strict: true });

  expect(window.location.hash).toBe("");
  expect(inspectCredentialAction).toHaveBeenCalledWith("selector.proof");
  expect(await screen.findByRole("heading", { name: "Crie sua senha" })).toBeInTheDocument();
  expect(screen.getByText("Mínimo de 8 caracteres")).toBeInTheDocument();
  expect(screen.getByLabelText("Nova senha")).toHaveAttribute("autocomplete", "new-password");

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
  expect(screen.getByRole("link", { name: "Ir para o login" })).toHaveAttribute("href", "/login");
  expect(screen.getByRole("status")).toHaveTextContent("Sua senha foi definida.");
});

test("redefinição usa título e ação próprios, visibilidade acessível e conclusão correta", async () => {
  window.history.replaceState(null, "", "/credencial#token=selector.proof");
  inspectCredentialAction.mockResolvedValue({ data: { purpose: "password_reset" } });
  completeCredentialAction.mockResolvedValue({ data: { completed: true } });
  renderPublicPage(<CredentialAction />);
  expect(await screen.findByRole("heading", { name: "Defina uma nova senha" })).toBeInTheDocument();
  expect(screen.getByText("Mínimo de 8 caracteres")).toBeInTheDocument();
  expect(screen.getByLabelText("Confirmar senha")).toHaveAttribute("autocomplete", "new-password");
  fireEvent.click(screen.getByRole("button", { name: "Mostrar nova senha" }));
  expect(screen.getByLabelText("Nova senha")).toHaveAttribute("type", "text");
  expect(screen.getByRole("button", { name: "Ocultar nova senha" })).toHaveAttribute("aria-pressed", "true");
  fireEvent.click(screen.getByRole("button", { name: "Mostrar confirmação de senha" }));
  expect(screen.getByLabelText("Confirmar senha")).toHaveAttribute("type", "text");
  fireEvent.click(screen.getByRole("button", { name: "Ocultar confirmação de senha" }));
  expect(screen.getByLabelText("Confirmar senha")).toHaveAttribute("type", "password");
  fireEvent.change(screen.getByLabelText("Nova senha"), { target: { value: "uma senha forte 123" } });
  fireEvent.change(screen.getByLabelText("Confirmar senha"), { target: { value: "uma senha forte 123" } });
  fireEvent.submit(screen.getByLabelText("Nova senha").closest("form"));
  expect(await screen.findByRole("heading", { name: "Senha alterada" })).toBeInTheDocument();
  expect(screen.getByRole("status")).toHaveTextContent("Sua senha foi atualizada.");
  expect(dispatch).toHaveBeenCalledWith({ type: "LOGIN_FAILURE" });
  expect(dispatch).toHaveBeenCalledTimes(1);
  expect(screen.getByRole("link", { name: "Ir para o login" })).toHaveAttribute("href", "/login");
});

test("inspeção e conclusão anunciam loading e bloqueiam edição durante o request", async () => {
  let resolveInspect;
  let resolveComplete;
  window.history.replaceState(null, "", "/credencial#token=selector.proof");
  inspectCredentialAction.mockImplementation(() => new Promise((resolve) => { resolveInspect = resolve; }));
  completeCredentialAction.mockImplementation(() => new Promise((resolve) => { resolveComplete = resolve; }));
  renderPublicPage(<CredentialAction />);
  expect(screen.getByRole("heading", { name: "Verificando link" })).toBeInTheDocument();
  expect(screen.getByRole("status")).toHaveTextContent("Verificando link...");
  await act(async () => { resolveInspect({ data: { purpose: "password_reset" } }); });
  fireEvent.change(screen.getByLabelText("Nova senha"), { target: { value: "uma senha forte 123" } });
  fireEvent.change(screen.getByLabelText("Confirmar senha"), { target: { value: "uma senha forte 123" } });
  fireEvent.submit(screen.getByLabelText("Nova senha").closest("form"));
  expect(screen.getByLabelText("Nova senha")).toBeDisabled();
  expect(screen.getByLabelText("Confirmar senha")).toBeDisabled();
  expect(screen.getByRole("button", { name: "Mostrar nova senha" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Salvando..." })).toBeDisabled();
  expect(screen.getByLabelText("Nova senha").closest("form")).toHaveAttribute("aria-busy", "true");
  expect(screen.getByRole("status")).toHaveTextContent("Salvando senha...");
  await act(async () => { resolveComplete({ data: { completed: true } }); });
  expect(screen.getByRole("heading", { name: "Senha alterada" })).toBeInTheDocument();
});

test("comprimento e confirmação divergente impedem envio", async () => {
  window.history.replaceState(null, "", "/credencial#token=selector.proof");
  inspectCredentialAction.mockResolvedValue({ data: { purpose: "password_reset" } });
  renderPublicPage(<CredentialAction />);
  await screen.findByRole("heading", { name: "Defina uma nova senha" });
  fireEvent.change(screen.getByLabelText("Nova senha"), { target: { value: "curta" } });
  fireEvent.submit(screen.getByLabelText("Nova senha").closest("form"));
  expect(screen.getByRole("alert")).toHaveTextContent("entre 8 e 128 caracteres");
  fireEvent.change(screen.getByLabelText("Nova senha"), { target: { value: "senha válida 123" } });
  fireEvent.change(screen.getByLabelText("Confirmar senha"), { target: { value: "outra senha 123" } });
  fireEvent.submit(screen.getByLabelText("Nova senha").closest("form"));
  expect(screen.getByRole("alert")).toHaveTextContent("As senhas devem ser iguais.");
  fireEvent.change(screen.getByLabelText("Nova senha"), { target: { value: "a".repeat(129) } });
  fireEvent.change(screen.getByLabelText("Confirmar senha"), { target: { value: "a".repeat(129) } });
  fireEvent.submit(screen.getByLabelText("Nova senha").closest("form"));
  expect(screen.getByRole("alert")).toHaveTextContent("entre 8 e 128 caracteres");
  expect(completeCredentialAction).not.toHaveBeenCalled();
});

test("ação invalidada na conclusão volta ao estado de link inválido", async () => {
  window.history.replaceState(null, "", "/credencial#token=selector.proof");
  inspectCredentialAction.mockResolvedValue({ data: { purpose: "password_reset" } });
  completeCredentialAction.mockRejectedValue({
    response: { status: 404, data: { error: "CREDENTIAL_ACTION_INVALID" } },
  });
  renderPublicPage(<CredentialAction />);
  await screen.findByRole("heading", { name: "Defina uma nova senha" });
  fireEvent.change(screen.getByLabelText("Nova senha"), { target: { value: "uma senha forte 123" } });
  fireEvent.change(screen.getByLabelText("Confirmar senha"), { target: { value: "uma senha forte 123" } });
  fireEvent.submit(screen.getByLabelText("Nova senha").closest("form"));
  expect(await screen.findByRole("heading", { name: "Link inválido ou expirado" })).toBeInTheDocument();
  expect(screen.queryByLabelText("Nova senha")).not.toBeInTheDocument();
  expect(dispatch).not.toHaveBeenCalled();
});

test.each([429, 503])("erro %i na conclusão permite tentar novamente sem perder o token", async (status) => {
  window.history.replaceState(null, "", "/credencial#token=selector.proof");
  inspectCredentialAction.mockResolvedValue({ data: { purpose: "password_reset" } });
  completeCredentialAction.mockRejectedValue({ response: { status } });
  renderPublicPage(<CredentialAction />);
  await screen.findByRole("heading", { name: "Defina uma nova senha" });
  fireEvent.change(screen.getByLabelText("Nova senha"), { target: { value: "uma senha forte 123" } });
  fireEvent.change(screen.getByLabelText("Confirmar senha"), { target: { value: "uma senha forte 123" } });
  fireEvent.submit(screen.getByLabelText("Nova senha").closest("form"));
  expect(await screen.findByRole("alert")).toHaveTextContent("Não foi possível concluir agora.");
  expect(screen.getByRole("button", { name: "Salvar nova senha" })).toBeEnabled();
  expect(screen.getByLabelText("Nova senha")).toHaveValue("uma senha forte 123");
  expect(completeCredentialAction).toHaveBeenCalledWith({
    token: "selector.proof", password: "uma senha forte 123", passwordConfirmation: "uma senha forte 123",
  });
  expect(window.location.hash).toBe("");
  expect(document.body.textContent).not.toContain("selector.proof");
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
  fireEvent.click(screen.getByRole("button", { name: "Salvar nova senha" }));

  await waitFor(() => expect(screen.getByRole("alert"))
    .toHaveTextContent("Escolha uma senha menos comum."));
  expect(screen.getByLabelText("Nova senha")).toHaveValue("senha muito comum");
  expect(document.body.textContent).not.toContain("selector.proof");
});
