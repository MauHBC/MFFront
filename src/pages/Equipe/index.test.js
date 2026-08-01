import React from "react";
import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import Equipe, { buildTeamPresentation } from ".";
import { useAuthorization } from "../../contexts/AuthorizationContext";
import { loadTeamReadModel } from "../../services/team";

jest.mock("../../contexts/AuthorizationContext", () => ({ useAuthorization: jest.fn() }));
jest.mock("../../services/team", () => ({ loadTeamReadModel: jest.fn() }));
jest.mock("../../services/axios", () => ({
  getUserFacingApiError: (error, fallback) => fallback,
}));

const model = {
  people: [
    { id: 1, name: "Ana", is_active: true, professional: { is_active: true }, account: { id: 10, email: "ana@clinica.test", is_active: true } },
    { id: 2, name: "Bia", is_active: true, professional: { is_active: true }, account: null },
  ],
  profiles: [
    { id: 20, name: "Administrador", native_type: "administrator", is_active: true, permissions: [], capabilities: [] },
    { id: 21, name: "Recepção", native_type: null, is_active: false, permissions: [{ moduleKey: "patients", accessLevel: "view", scopeLevel: "clinic", canExport: false }], capabilities: [] },
  ],
  catalog: {
    modules: [{ module_key: "patients" }],
    distributable_capabilities: [],
    administrator_only_capabilities: [],
    administrative_powers: [{ power_key: "access_profiles.manage", editable: false }],
  },
  assignmentState: {
    assignments: [
      { assignment_id: 1, user_id: 10, profile_id: 20 },
      { assignment_id: 2, user_id: 10, profile_id: 21 },
    ],
  },
  accountState: { accounts: [{ user_id: 10, name: "Ana", login_identifier: "ana@clinica.test", is_active: true, linked_person_id: 1 }] },
};

describe("Equipe", () => {
  beforeEach(() => {
    useAuthorization.mockReturnValue({ status: "ready", canViewTeam: true });
    loadTeamReadModel.mockResolvedValue(model);
  });

  it("diferencia pessoa com conta, profissional sem login e múltiplos perfis", async () => {
    render(<Equipe />);
    expect(await screen.findByText("ana@clinica.test")).toBeInTheDocument();
    expect(screen.getByText("Profissional sem login")).toBeInTheDocument();
    expect(screen.getByText("Administrador, Recepção")).toBeInTheDocument();
    expect(screen.getByText("Perfil personalizado")).toBeInTheDocument();
    expect(screen.getByText("Inativo")).toBeInTheDocument();
  });

  it("nega acesso direto sem carregar dados", () => {
    useAuthorization.mockReturnValue({ status: "ready", canViewTeam: false });
    render(<Equipe />);
    expect(screen.getByText("Acesso não permitido")).toBeInTheDocument();
    expect(loadTeamReadModel).not.toHaveBeenCalled();
  });

  it("apresenta erro e permite tentar novamente", async () => {
    loadTeamReadModel.mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce(model);
    render(<Equipe />);
    expect(await screen.findByText("Não foi possível carregar a equipe.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    await waitFor(() => expect(loadTeamReadModel).toHaveBeenCalledTimes(2));
    expect(await screen.findByText("Ana")).toBeInTheDocument();
  });

  it("apresenta permissões pelo catálogo e poderes não editáveis", async () => {
    render(<Equipe />);
    fireEvent.click(await screen.findByRole("button", { name: /Administrador/ }));
    expect(screen.getByText("Pacientes")).toBeInTheDocument();
    expect(screen.getByText("Gerenciar perfis")).toBeInTheDocument();
    expect(screen.getByText("Não editável")).toBeInTheDocument();
  });

  it("mantém estado vazio após filtros sem correspondência", async () => {
    render(<Equipe />);
    await screen.findByText("Ana");
    fireEvent.change(screen.getByLabelText("Buscar por nome ou identificador"), { target: { value: "ninguém" } });
    expect(screen.getByText("Nenhuma pessoa encontrada.")).toBeInTheDocument();
  });
});

test("normalização preserva perfis nativos, personalizados e inativos", () => {
  const result = buildTeamPresentation(model);
  expect(result.people[0].profiles).toHaveLength(2);
  expect(result.profiles.find(({ id }) => id === 21)).toMatchObject({ native_type: null, is_active: false, assignmentCount: 1 });
});
