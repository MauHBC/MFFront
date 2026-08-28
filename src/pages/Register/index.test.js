import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useDispatch, useSelector } from "react-redux";
import { toast } from "react-toastify";
import Register from ".";
import { deactivateOwnAccount, updateOwnAccount } from "../../services/account";

jest.mock("react-redux", () => ({
  useDispatch: jest.fn(),
  useSelector: jest.fn(),
}));
jest.mock("react-toastify", () => ({
  toast: { error: jest.fn(), success: jest.fn() },
}));
jest.mock("../../services/account", () => ({
  deactivateOwnAccount: jest.fn(),
  updateOwnAccount: jest.fn(),
}));
jest.mock("../../components/Loading", () => () => null);

const state = {
  auth: {
    user: {
      id: 7,
      name: "Usuário atual",
      email: "usuario@example.test",
      isLoading: false,
    },
  },
};

describe("proteção da própria conta", () => {
  let dispatch;
  let history;

  beforeEach(() => {
    jest.clearAllMocks();
    dispatch = jest.fn();
    history = { push: jest.fn() };
    useDispatch.mockReturnValue(dispatch);
    useSelector.mockImplementation((selector) => selector(state));
    updateOwnAccount.mockResolvedValue({ data: {} });
    deactivateOwnAccount.mockResolvedValue({ data: {} });
  });

  it("mantém atualização comum sem solicitar senha atual", async () => {
    render(<Register history={history} />);

    expect(screen.queryByLabelText(/Senha atual para confirmar/i)).toBeNull();
    fireEvent.change(screen.getByLabelText("Nome:"), { target: { value: "Nome atualizado" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() => expect(updateOwnAccount).toHaveBeenCalledWith({
      name: "Nome atualizado",
      email: "usuario@example.test",
      password: "",
      currentPassword: "",
    }));
    await waitFor(() => expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({
      type: "REGISTER_UPDATED_SUCCESS",
    })));
  });

  it("solicita senha atual somente após iniciar troca de e-mail", async () => {
    render(<Register history={history} />);

    fireEvent.change(screen.getByLabelText("E-mail:"), {
      target: { value: "novo@example.test" },
    });
    const confirmation = screen.getByLabelText(/Senha atual para confirmar/i);
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    expect(updateOwnAccount).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith(
      "Informe sua senha atual para confirmar esta alteração.",
    );

    fireEvent.change(confirmation, { target: { value: "Senha-atual-123!" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() => expect(updateOwnAccount).toHaveBeenCalledWith(expect.objectContaining({
      email: "novo@example.test",
      currentPassword: "Senha-atual-123!",
    })));
    await waitFor(() => expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: "LOGIN_FAILURE" }),
    ));
    expect(history.push).toHaveBeenCalledWith("/login");
  });

  it("protege troca de senha e não mantém a sessão revogada", async () => {
    render(<Register history={history} />);

    fireEvent.change(screen.getByLabelText(/Nova senha/i), {
      target: { value: "Senha-nova-456!" },
    });
    fireEvent.change(screen.getByLabelText(/Senha atual para confirmar/i), {
      target: { value: "Senha-atual-123!" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() => expect(updateOwnAccount).toHaveBeenCalledWith(expect.objectContaining({
      password: "Senha-nova-456!",
      currentPassword: "Senha-atual-123!",
    })));
    await waitFor(() => expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: "LOGIN_FAILURE" }),
    ));
    expect(history.push).toHaveBeenCalledWith("/login");
  });

  it("aplica o limite mínimo novo sem exigir composição", async () => {
    render(<Register history={history} />);

    fireEvent.change(screen.getByLabelText(/Nova senha/i), {
      target: { value: "sete777" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    expect(updateOwnAccount).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith("A senha deve ter entre 8 e 128 caracteres.");

    fireEvent.change(screen.getByLabelText(/Nova senha/i), {
      target: { value: "oitoletr" },
    });
    fireEvent.change(screen.getByLabelText(/Senha atual para confirmar/i), {
      target: { value: "Senha-atual-123!" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(updateOwnAccount).toHaveBeenCalledWith(expect.objectContaining({
      password: "oitoletr",
    })));
  });

  it("pede confirmação e senha atual antes da autodesativação", async () => {
    render(<Register history={history} />);

    expect(screen.queryByLabelText("Senha atual para confirmar:")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Desativar minha conta" }));
    const passwordInput = screen.getByLabelText("Senha atual para confirmar:");
    fireEvent.click(screen.getByRole("button", { name: "Confirmar desativação" }));
    expect(deactivateOwnAccount).not.toHaveBeenCalled();

    fireEvent.change(passwordInput, { target: { value: "Senha-atual-123!" } });
    fireEvent.click(screen.getByRole("button", { name: "Confirmar desativação" }));

    await waitFor(() => expect(deactivateOwnAccount).toHaveBeenCalledWith("Senha-atual-123!"));
    await waitFor(() => expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: "LOGIN_FAILURE" }),
    ));
    expect(history.push).toHaveBeenCalledWith("/login");
  });

  it("exibe erro genérico quando o backend recusa a senha atual", async () => {
    updateOwnAccount.mockRejectedValue({
      response: { status: 403, data: { error: "ACCOUNT_REAUTHENTICATION_FAILED" } },
    });
    render(<Register history={history} />);

    fireEvent.change(screen.getByLabelText("E-mail:"), {
      target: { value: "novo@example.test" },
    });
    fireEvent.change(screen.getByLabelText(/Senha atual para confirmar/i), {
      target: { value: "incorreta" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(
      "Não foi possível confirmar sua identidade.",
    ));
    expect(history.push).not.toHaveBeenCalled();
  });

  it("explica de forma segura a recusa de senha comprometida pelo backend", async () => {
    updateOwnAccount.mockRejectedValue({
      response: { status: 400, data: { error: "PASSWORD_COMMON_OR_COMPROMISED" } },
    });
    render(<Register history={history} />);

    fireEvent.change(screen.getByLabelText(/Nova senha/i), {
      target: { value: "password" },
    });
    fireEvent.change(screen.getByLabelText(/Senha atual para confirmar/i), {
      target: { value: "Senha-atual-123!" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(
      "Escolha uma senha menos comum e que não esteja comprometida.",
    ));
  });
});
