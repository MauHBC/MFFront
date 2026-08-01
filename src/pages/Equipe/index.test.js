import React from "react";
import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import Equipe, { buildTeamPresentation } from ".";
import { useAuthorization } from "../../contexts/AuthorizationContext";
import {
  activateTeamPerson,
  assignAuthorizationProfile,
  createAuthorizationProfile,
  createTeamPerson,
  loadTeamReadModel,
  unassignAuthorizationProfile,
  updateAuthorizationProfile,
  updateTeamPerson,
} from "../../services/team";

jest.mock("../../contexts/AuthorizationContext", () => ({ useAuthorization: jest.fn() }));
jest.mock("../../services/team", () => ({
  activateTeamPerson: jest.fn(),
  assignAuthorizationProfile: jest.fn(),
  createAuthorizationProfile: jest.fn(),
  createTeamPerson: jest.fn(),
  loadTeamReadModel: jest.fn(),
  unassignAuthorizationProfile: jest.fn(),
  updateAuthorizationProfile: jest.fn(),
  updateTeamPerson: jest.fn(),
}));
jest.mock("../../services/axios", () => ({
  getUserFacingApiError: (error, fallback) => fallback,
}));

const model = {
  people: [
    { id: 1, name: "Ana", email: "ana@clinica.test", phone: "2799999999", is_active: true, professional: { is_active: true }, account: { id: 10, email: "ana@clinica.test", is_active: true } },
    { id: 2, name: "Bia", email: "bia@clinica.test", phone: null, is_active: true, professional: { is_active: true }, account: null },
    { id: 3, name: "Caio", email: null, phone: null, is_active: false, professional: null, account: null },
  ],
  profiles: [
    { id: 20, name: "Administrador", native_type: "administrator", is_active: true, permissions: [], capabilities: [] },
    { id: 21, name: "Recepção", native_type: null, is_active: false, permissions: [{ moduleKey: "patients", accessLevel: "view", scopeLevel: "clinic", canExport: false }], capabilities: [] },
    { id: 22, name: "Atendimento", native_type: null, is_active: true, permissions: [], capabilities: [] },
  ],
  catalog: {
    access_levels: [{ key: "none", rank: 0 }, { key: "view", rank: 1 }, { key: "manage", rank: 2 }],
    modules: [{ module_key: "patients", valid_access_levels: ["none", "view", "manage"], valid_scopes: ["own", "clinic"], exportable: true }],
    distributable_capabilities: [],
    administrator_only_capabilities: [],
    administrative_powers: [{ power_key: "access_profiles.manage", editable: false }],
  },
  assignmentState: {
    users: [{ user_id: 10, effective_permissions: { authorization_state: "authorized", is_administrator: true, modules: [] } }],
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
    loadTeamReadModel.mockReset();
    loadTeamReadModel.mockResolvedValue(model);
    createTeamPerson.mockReset();
    updateTeamPerson.mockReset();
    activateTeamPerson.mockReset();
    assignAuthorizationProfile.mockReset();
    createAuthorizationProfile.mockReset();
    unassignAuthorizationProfile.mockReset();
    updateAuthorizationProfile.mockReset();
    createTeamPerson.mockResolvedValue({ id: 30 });
    updateTeamPerson.mockResolvedValue({ id: 1 });
    activateTeamPerson.mockResolvedValue({ id: 3 });
    assignAuthorizationProfile.mockResolvedValue({ id: 4 });
    createAuthorizationProfile.mockResolvedValue({ id: 23 });
    unassignAuthorizationProfile.mockResolvedValue(null);
    updateAuthorizationProfile.mockResolvedValue({ id: 22 });
  });

  it("cria pessoa comum sem campos de conta, perfil ou credencial", async () => {
    render(<Equipe />);
    fireEvent.click(await screen.findByRole("button", { name: /Nova pessoa/ }));
    fireEvent.change(screen.getByLabelText("Nome"), { target: { value: "Daniela" } });
    fireEvent.change(screen.getByLabelText("E-mail"), { target: { value: "daniela@example.test" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(createTeamPerson).toHaveBeenCalledTimes(1));
    expect(createTeamPerson).toHaveBeenCalledWith({
      name: "Daniela",
      email: "daniela@example.test",
      phone: "",
      isProfessional: false,
    });
    await waitFor(() => expect(screen.queryByLabelText("Nome")).not.toBeInTheDocument());
  });

  it("cria profissional sem login apenas quando marcado explicitamente", async () => {
    render(<Equipe />);
    fireEvent.click(await screen.findByRole("button", { name: /Nova pessoa/ }));
    fireEvent.change(screen.getByLabelText("Nome"), { target: { value: "Eduarda" } });
    fireEvent.click(screen.getByLabelText(/Registrar também como profissional/));
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(createTeamPerson).toHaveBeenCalledWith(expect.objectContaining({
      name: "Eduarda",
      isProfessional: true,
    })));
  });

  it("valida campos obrigatórios junto ao campo e não envia", async () => {
    render(<Equipe />);
    fireEvent.click(await screen.findByRole("button", { name: /Nova pessoa/ }));
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    expect(screen.getByText("Informe um nome entre 2 e 255 caracteres.")).toBeInTheDocument();
    expect(createTeamPerson).not.toHaveBeenCalled();
  });

  it("fecha formulário sem confirmação quando não existem alterações", async () => {
    render(<Equipe />);
    fireEvent.click(await screen.findByRole("button", { name: /Nova pessoa/ }));
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(screen.queryByRole("dialog", { name: "Nova pessoa" })).not.toBeInTheDocument();
    expect(screen.queryByText("Alterações não salvas")).not.toBeInTheDocument();
  });

  it("pede confirmação antes de descartar alterações pendentes", async () => {
    render(<Equipe />);
    fireEvent.click(await screen.findByRole("button", { name: /Nova pessoa/ }));
    fireEvent.change(screen.getByLabelText("Nome"), { target: { value: "Rascunho" } });
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(screen.getByText("Alterações não salvas")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Continuar editando" }));
    expect(screen.getByDisplayValue("Rascunho")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    fireEvent.click(screen.getByRole("button", { name: "Descartar alterações" }));
    expect(screen.queryByDisplayValue("Rascunho")).not.toBeInTheDocument();
  });

  it("preserva os dados quando a API rejeita a criação", async () => {
    createTeamPerson.mockRejectedValueOnce(new Error("offline"));
    render(<Equipe />);
    fireEvent.click(await screen.findByRole("button", { name: /Nova pessoa/ }));
    fireEvent.change(screen.getByLabelText("Nome"), { target: { value: "Fernanda" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    expect(await screen.findByText("Não foi possível salvar a pessoa.")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Fernanda")).toBeInTheDocument();
  });

  it("impede envio duplicado enquanto a criação está em andamento", async () => {
    let resolveRequest;
    createTeamPerson.mockImplementationOnce(() => new Promise((resolve) => {
      resolveRequest = resolve;
    }));
    render(<Equipe />);
    fireEvent.click(await screen.findByRole("button", { name: /Nova pessoa/ }));
    fireEvent.change(screen.getByLabelText("Nome"), { target: { value: "Gabriela" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    const savingButton = await screen.findByRole("button", { name: "Salvando..." });
    expect(savingButton).toBeDisabled();
    fireEvent.click(savingButton);
    expect(createTeamPerson).toHaveBeenCalledTimes(1);
    resolveRequest({ id: 31 });
    await waitFor(() => expect(screen.queryByLabelText("Nome")).not.toBeInTheDocument());
  });

  it("edita somente os campos permitidos da pessoa", async () => {
    render(<Equipe />);
    await screen.findByText("Ana");
    fireEvent.click(screen.getAllByRole("button", { name: /Editar/ })[0]);
    expect(screen.queryByLabelText(/Registrar também como profissional/)).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Nome"), { target: { value: "Ana editada" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(updateTeamPerson).toHaveBeenCalledWith(1, {
      name: "Ana editada",
      email: "ana@clinica.test",
      phone: "2799999999",
      isProfessional: true,
    }));
  });

  it("reativa pessoa pelo contrato oficial", async () => {
    render(<Equipe />);
    fireEvent.click(await screen.findByRole("button", { name: "Reativar pessoa" }));
    await waitFor(() => expect(activateTeamPerson).toHaveBeenCalledWith(3));
  });

  it("diferencia pessoa com conta, profissional sem login e múltiplos perfis", async () => {
    render(<Equipe />);
    expect(await screen.findByText("ana@clinica.test")).toBeInTheDocument();
    expect(screen.getByText("Profissional sem login")).toBeInTheDocument();
    expect(screen.getByText("Administrador, Recepção")).toBeInTheDocument();
    expect(screen.getAllByText("Perfil personalizado").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Inativo").length).toBeGreaterThan(0);
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
    expect(screen.getAllByText("Gerenciar perfis").length).toBeGreaterThan(0);
    expect(screen.getByText("Não editável")).toBeInTheDocument();
  });

  it("cria perfil personalizado usando somente o catálogo", async () => {
    render(<Equipe />);
    fireEvent.click(await screen.findByRole("button", { name: /Novo perfil/ }));
    fireEvent.change(screen.getByLabelText("Nome do perfil"), { target: { value: "Financeiro leitura" } });
    fireEvent.change(screen.getByLabelText("Nível de Pacientes"), { target: { value: "view" } });
    fireEvent.change(screen.getByLabelText("Escopo de Pacientes"), { target: { value: "clinic" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar perfil" }));
    await waitFor(() => expect(createAuthorizationProfile).toHaveBeenCalledWith({
      name: "Financeiro leitura",
      permissions: [{ moduleKey: "patients", accessLevel: "view", scopeLevel: "clinic", canExport: false }],
      capabilities: [],
    }));
  });

  it("não oferece edição para perfis nativos e edita personalizado", async () => {
    render(<Equipe />);
    await screen.findByText("Administrador");
    expect(screen.getAllByText(/definição bloqueada/).length).toBeGreaterThan(0);
    fireEvent.click(screen.getAllByRole("button", { name: /Editar definição/ })[0]);
    fireEvent.change(screen.getByLabelText("Nome do perfil"), { target: { value: "Atendimento atualizado" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar perfil" }));
    await waitFor(() => expect(updateAuthorizationProfile).toHaveBeenCalledWith(21, expect.objectContaining({
      name: "Atendimento atualizado",
    })));
  });

  it("atribui e remove perfis somente para pessoa com conta", async () => {
    render(<Equipe />);
    const manageButtons = await screen.findAllByRole("button", { name: "Gerenciar perfis" });
    expect(manageButtons).toHaveLength(1);
    fireEvent.click(manageButtons[0]);
    fireEvent.click(screen.getByLabelText(/Administrador/));
    fireEvent.click(screen.getByLabelText(/Atendimento/));
    fireEvent.click(screen.getByRole("button", { name: "Salvar atribuições" }));
    await waitFor(() => expect(assignAuthorizationProfile).toHaveBeenCalledWith(22, 10));
    expect(unassignAuthorizationProfile).toHaveBeenCalledWith(20, 10);
  });

  it("confirma descarte do perfil alterado e preserva dados após erro", async () => {
    createAuthorizationProfile.mockRejectedValueOnce(new Error("offline"));
    render(<Equipe />);
    fireEvent.click(await screen.findByRole("button", { name: /Novo perfil/ }));
    fireEvent.change(screen.getByLabelText("Nome do perfil"), { target: { value: "Rascunho perfil" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar perfil" }));
    expect(await screen.findByText("Não foi possível salvar o perfil.")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Rascunho perfil")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(screen.getByText("Alterações não salvas")).toBeInTheDocument();
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
