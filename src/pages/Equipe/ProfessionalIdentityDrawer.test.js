import React from "react";
import "@testing-library/jest-dom";
import {
  fireEvent, render, screen, waitFor, within,
} from "@testing-library/react";
import ProfessionalIdentityDrawer, { validateProfessionalIdentity } from "./ProfessionalIdentityDrawer";
import { saveTeamProfessionalIdentity } from "../../services/team";

jest.mock("../../services/team", () => ({
  saveTeamProfessionalIdentity: jest.fn(),
}));
jest.mock("../../services/axios", () => ({
  getUserFacingApiError: (_error, fallback) => fallback,
}));

const pendingPerson = {
  id: 7,
  name: "Fisioterapeuta Teste",
  isProfessional: false,
  professionalActive: false,
  professionalIdentity: null,
};

describe("ProfessionalIdentityDrawer", () => {
  beforeEach(() => {
    saveTeamProfessionalIdentity.mockReset();
    saveTeamProfessionalIdentity.mockResolvedValue({ id: 17, is_active: true });
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
    fireEvent.click(within(drawer).getByRole("button", { name: "Cadastrar profissional" }));
    await waitFor(() => expect(saveTeamProfessionalIdentity).toHaveBeenCalledWith(7, {
      action: "save_pending",
      activate: true,
      profession: "physiotherapist",
      registrationRegion: "15",
      registrationNumber: "12345-f",
    }));
    await waitFor(() => {
      expect(onSaved).toHaveBeenCalledTimes(1);
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  it("edita e verifica profissional ativo sem solicitar nova ativação", async () => {
    const person = {
      ...pendingPerson,
      isProfessional: true,
      professionalActive: true,
      professionalIdentity: {
        profession: "physiotherapist",
        registrationRegion: "15",
        registrationNumber: "12345-F",
        verificationStatus: "pending",
      },
    };
    render(<ProfessionalIdentityDrawer
      person={person}
      onClose={jest.fn()}
      onSaved={jest.fn().mockResolvedValue(undefined)}
    />);
    const drawer = screen.getByRole("dialog", { name: "Dados profissionais" });
    expect(within(drawer).getByLabelText("Região do CREFITO")).toHaveValue("15");
    expect(within(drawer).getByLabelText("Número do CREFITO")).toHaveValue("12345-F");
    fireEvent.click(within(drawer).getByRole("button", { name: "Confirmar verificação" }));
    await waitFor(() => expect(saveTeamProfessionalIdentity).toHaveBeenCalledWith(7, {
      action: "verify",
      activate: false,
      profession: "physiotherapist",
      registrationRegion: "15",
      registrationNumber: "12345-F",
    }));
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
