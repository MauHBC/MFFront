import React from "react";
import "@testing-library/jest-dom";
import {
  act, fireEvent, render, screen, waitFor, within,
} from "@testing-library/react";
import { toast } from "react-toastify";
import ProfessionalIdentityDrawer, { validateProfessionalIdentity } from "./ProfessionalIdentityDrawer";
import { saveTeamProfessionalIdentity } from "../../services/team";

jest.mock("../../services/team", () => ({
  saveTeamProfessionalIdentity: jest.fn(),
}));
jest.mock("../../services/axios", () => ({
  getUserFacingApiError: (_error, fallback) => fallback,
}));
jest.mock("react-toastify", () => ({
  toast: { success: jest.fn() },
}));

const pendingPerson = {
  id: 7,
  name: "Fisioterapeuta Teste",
  email: "fisioterapeuta@example.test",
  account: null,
  isProfessional: false,
  professionalActive: false,
  professionalIdentity: null,
};

const activeProfessional = (verificationStatus = "pending") => ({
  ...pendingPerson,
  account: { login: "fisioterapeuta@example.test" },
  isProfessional: true,
  professionalActive: true,
  professionalIdentity: {
    profession: "physiotherapist",
    registrationRegion: "15",
    registrationNumber: "12345-F",
    verificationStatus,
  },
});

describe("ProfessionalIdentityDrawer", () => {
  beforeEach(() => {
    saveTeamProfessionalIdentity.mockReset();
    saveTeamProfessionalIdentity.mockResolvedValue({ id: 17, is_active: true });
    toast.success.mockReset();
  });

  it("exige profissão, região e número válidos", () => {
    expect(validateProfessionalIdentity({
      profession: "",
      registrationRegion: "abc",
      registrationNumber: "!",
    })).toEqual({
      profession: "Selecione uma profissão válida.",
      registrationRegion: "Informe a região do CREFITO com um ou dois dígitos.",
      registrationNumber: "Informe um número de CREFITO válido.",
    });
  });

  it("cadastra profissional e identidade em uma única requisição", async () => {
    saveTeamProfessionalIdentity.mockResolvedValueOnce({
      id: 17,
      is_active: true,
      account: { has_credential: false, status: "pending_credential" },
    });
    const onClose = jest.fn();
    const onSaved = jest.fn().mockResolvedValue(undefined);
    render(<ProfessionalIdentityDrawer person={pendingPerson} onClose={onClose} onSaved={onSaved} />);
    const drawer = screen.getByRole("dialog", { name: "Cadastrar como profissional" });
    fireEvent.change(within(drawer).getByLabelText("Região do CREFITO"), {
      target: { value: "15" },
    });
    fireEvent.change(within(drawer).getByLabelText("Número do CREFITO"), {
      target: { value: "12345-f" },
    });
    expect(within(drawer).queryByLabelText("Conferi os dados profissionais"))
      .not.toBeInTheDocument();
    fireEvent.click(within(drawer).getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(saveTeamProfessionalIdentity).toHaveBeenCalledWith(7, {
      action: "verify",
      activate: true,
      email: "fisioterapeuta@example.test",
      profession: "physiotherapist",
      registrationRegion: "15",
      registrationNumber: "12345-f",
    }));
    await waitFor(() => {
      expect(onSaved).toHaveBeenCalledTimes(1);
      expect(toast.success).toHaveBeenCalledWith(
        "Para o primeiro acesso ao Motria, enviaremos um e-mail para criar a senha.",
      );
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  it("autoriza pendente sem alteração textual e sem solicitar nova ativação", async () => {
    const person = activeProfessional();
    render(<ProfessionalIdentityDrawer
      person={person}
      onClose={jest.fn()}
      onSaved={jest.fn().mockResolvedValue(undefined)}
    />);
    const drawer = screen.getByRole("dialog", { name: "Dados profissionais" });
    expect(within(drawer).getByLabelText("Região do CREFITO")).toHaveValue("15");
    expect(within(drawer).getByLabelText("Número do CREFITO")).toHaveValue("12345-F");
    expect(within(drawer).queryByLabelText("Conferi os dados profissionais"))
      .not.toBeInTheDocument();
    expect(within(drawer).getByRole("button", { name: "Salvar" })).toBeEnabled();
    fireEvent.click(within(drawer).getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(saveTeamProfessionalIdentity).toHaveBeenCalledWith(7, {
      action: "verify",
      activate: false,
      profession: "physiotherapist",
      registrationRegion: "15",
      registrationNumber: "12345-F",
    }));
  });

  it("preserva a autorização e desabilita Salvar sem alterações", () => {
    render(<ProfessionalIdentityDrawer
      person={activeProfessional("verified")}
      onClose={jest.fn()}
      onSaved={jest.fn()}
    />);

    const drawer = screen.getByRole("dialog", { name: "Dados profissionais" });
    expect(within(drawer).getByText("Cadastro profissional autorizado")).toBeInTheDocument();
    expect(within(drawer).queryByLabelText("Conferi os dados profissionais"))
      .not.toBeInTheDocument();
    expect(within(drawer).getByRole("button", { name: "Salvar" })).toBeDisabled();
    expect(saveTeamProfessionalIdentity).not.toHaveBeenCalled();
  });

  it("trata dados alterados como pendentes até o salvamento automático", () => {
    render(<ProfessionalIdentityDrawer
      person={activeProfessional("verified")}
      onClose={jest.fn()}
      onSaved={jest.fn()}
    />);
    const drawer = screen.getByRole("dialog", { name: "Dados profissionais" });

    fireEvent.change(within(drawer).getByLabelText("Número do CREFITO"), {
      target: { value: "54321-F" },
    });

    expect(within(drawer).getByText("Cadastro profissional pendente de autorização"))
      .toBeInTheDocument();
    expect(within(drawer).queryByLabelText("Conferi os dados profissionais"))
      .not.toBeInTheDocument();
    expect(within(drawer).getByRole("button", { name: "Salvar" })).toBeEnabled();
  });

  it("ignora diferenças semânticas de caixa e espaços ao detectar alteração", () => {
    render(<ProfessionalIdentityDrawer
      person={activeProfessional("verified")}
      onClose={jest.fn()}
      onSaved={jest.fn()}
    />);
    const drawer = screen.getByRole("dialog", { name: "Dados profissionais" });

    fireEvent.change(within(drawer).getByLabelText("Região do CREFITO"), {
      target: { value: " CREFITO-15 " },
    });
    fireEvent.change(within(drawer).getByLabelText("Número do CREFITO"), {
      target: { value: " 12345-f " },
    });

    expect(within(drawer).queryByLabelText("Conferi os dados profissionais"))
      .not.toBeInTheDocument();
    expect(within(drawer).getByText("Cadastro profissional autorizado")).toBeInTheDocument();
    expect(within(drawer).getByRole("button", { name: "Salvar" })).toBeDisabled();
  });

  it("recarrega, mostra sucesso e fecha depois de autorizar", async () => {
    const onSaved = jest.fn().mockResolvedValue(undefined);
    const onClose = jest.fn();
    render(<ProfessionalIdentityDrawer
      person={activeProfessional()}
      onClose={onClose}
      onSaved={onSaved}
    />);

    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() => {
      expect(onSaved).toHaveBeenCalledTimes(1);
      expect(toast.success).toHaveBeenCalledWith(
        "Cadastro profissional autorizado.",
      );
      expect(onClose).toHaveBeenCalledTimes(1);
    });
    expect(onSaved.mock.invocationCallOrder[0]).toBeLessThan(toast.success.mock.invocationCallOrder[0]);
    expect(toast.success.mock.invocationCallOrder[0]).toBeLessThan(onClose.mock.invocationCallOrder[0]);
  });

  it("impede envio duplicado enquanto a confirmação está em andamento", async () => {
    let resolveRequest;
    saveTeamProfessionalIdentity.mockReturnValue(new Promise((resolve) => {
      resolveRequest = resolve;
    }));
    render(<ProfessionalIdentityDrawer
      person={activeProfessional()}
      onClose={jest.fn()}
      onSaved={jest.fn().mockResolvedValue(undefined)}
    />);
    const confirm = screen.getByRole("button", { name: "Salvar" });

    fireEvent.click(confirm);
    fireEvent.click(confirm);

    expect(saveTeamProfessionalIdentity).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Salvando..." })).toBeDisabled();
    await act(async () => {
      resolveRequest({ id: 17, is_active: true });
    });
    await waitFor(() => expect(toast.success).toHaveBeenCalledTimes(1));
  });

  it("mantém o drawer e os campos quando a API falha", async () => {
    saveTeamProfessionalIdentity.mockRejectedValue(new Error("network"));
    const onClose = jest.fn();
    render(<ProfessionalIdentityDrawer
      person={activeProfessional()}
      onClose={onClose}
      onSaved={jest.fn()}
    />);
    const drawer = screen.getByRole("dialog", { name: "Dados profissionais" });
    fireEvent.change(within(drawer).getByLabelText("Número do CREFITO"), {
      target: { value: "54321-F" },
    });

    fireEvent.click(within(drawer).getByRole("button", { name: "Salvar" }));

    expect(await within(drawer).findByRole("alert")).toHaveTextContent(
      "Não foi possível salvar os dados profissionais.",
    );
    expect(within(drawer).getByLabelText("Número do CREFITO")).toHaveValue("54321-F");
    expect(within(drawer).queryByLabelText("Conferi os dados profissionais"))
      .not.toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("salva e autoriza dados alterados pelo fluxo existente", async () => {
    render(<ProfessionalIdentityDrawer
      person={activeProfessional("verified")}
      onClose={jest.fn()}
      onSaved={jest.fn().mockResolvedValue(undefined)}
    />);

    fireEvent.change(screen.getByLabelText("Número do CREFITO"), {
      target: { value: "54321-F" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() => {
      expect(saveTeamProfessionalIdentity).toHaveBeenCalledWith(7, {
        action: "verify",
        activate: false,
        profession: "physiotherapist",
        registrationRegion: "15",
        registrationNumber: "54321-F",
      });
      expect(toast.success).toHaveBeenCalledWith(
        "Cadastro profissional autorizado.",
      );
    });
  });

  it("não exige confirmação separada para autorizar dados alterados", async () => {
    render(<ProfessionalIdentityDrawer
      person={activeProfessional("verified")}
      onClose={jest.fn()}
      onSaved={jest.fn().mockResolvedValue(undefined)}
    />);

    fireEvent.change(screen.getByLabelText("Número do CREFITO"), {
      target: { value: "67890-F" },
    });
    expect(screen.queryByLabelText("Conferi os dados profissionais")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() => expect(saveTeamProfessionalIdentity).toHaveBeenCalledWith(7, {
      action: "verify",
      activate: false,
      profession: "physiotherapist",
      registrationRegion: "15",
      registrationNumber: "67890-F",
    }));
  });

  it("reabrir usa o estado persistido recebido da Equipe", () => {
    const first = render(<ProfessionalIdentityDrawer
      person={activeProfessional()}
      onClose={jest.fn()}
      onSaved={jest.fn()}
    />);
    expect(screen.queryByLabelText("Conferi os dados profissionais")).not.toBeInTheDocument();
    expect(screen.getByText("Cadastro profissional pendente de autorização"))
      .toBeInTheDocument();
    first.unmount();

    render(<ProfessionalIdentityDrawer
      person={activeProfessional("verified")}
      onClose={jest.fn()}
      onSaved={jest.fn()}
    />);
    expect(screen.queryByLabelText("Conferi os dados profissionais"))
      .not.toBeInTheDocument();
    expect(screen.getByText("Cadastro profissional autorizado")).toBeInTheDocument();
  });

  it("cancelar não envia requisição", () => {
    const onClose = jest.fn();
    render(<ProfessionalIdentityDrawer
      person={pendingPerson}
      onClose={onClose}
      onSaved={jest.fn()}
    />);
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(saveTeamProfessionalIdentity).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
