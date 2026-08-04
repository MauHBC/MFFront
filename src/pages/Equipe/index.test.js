import React from "react";
import "@testing-library/jest-dom";
import {
  fireEvent, render, screen, waitFor, within,
} from "@testing-library/react";
import Equipe, { buildTeamPresentation } from ".";
import { useAuthorization } from "../../contexts/AuthorizationContext";
import {
  activateTeamPerson,
  assignAuthorizationProfile,
  blockTeamAccount,
  createAuthorizationProfile,
  createTeamAccount,
  createTeamPerson,
  confirmProfessionalInactivation,
  deactivateTeamPerson,
  loadTeamReadModel,
  previewProfessionalInactivation,
  resetTeamAccountPassword,
  setTeamProfessionalState,
  unassignAuthorizationProfile,
  updateAuthorizationProfile,
  updateTeamPerson,
  unblockTeamAccount,
} from "../../services/team";

jest.mock("../../contexts/AuthorizationContext", () => ({ useAuthorization: jest.fn() }));
jest.mock("./TeamAuditHistory", () => function TeamAuditHistoryMock() {
  return <section>Histórico administrativo</section>;
});
jest.mock("../../services/team", () => ({
  activateTeamPerson: jest.fn(),
  assignAuthorizationProfile: jest.fn(),
  blockTeamAccount: jest.fn(),
  createAuthorizationProfile: jest.fn(),
  createTeamAccount: jest.fn(),
  createTeamPerson: jest.fn(),
  confirmProfessionalInactivation: jest.fn(),
  deactivateTeamPerson: jest.fn(),
  loadTeamReadModel: jest.fn(),
  previewProfessionalInactivation: jest.fn(),
  resetTeamAccountPassword: jest.fn(),
  setTeamProfessionalState: jest.fn(),
  unassignAuthorizationProfile: jest.fn(),
  updateAuthorizationProfile: jest.fn(),
  updateTeamPerson: jest.fn(),
  unblockTeamAccount: jest.fn(),
}));
jest.mock("../../services/axios", () => ({
  getUserFacingApiError: (error, fallback) => fallback,
}));

const model = {
  people: [
    { id: 1, name: "Ana", email: "ana@clinica.test", phone: "2799999999", is_active: true, professional: { id: 101, is_active: true }, account: { id: 10, email: "ana@clinica.test", is_active: true, status: "active", linkage_type: "legacy", has_credential: true } },
    { id: 2, name: "Bia", email: "bia@clinica.test", phone: null, is_active: true, professional: { id: 102, is_active: true }, account: null },
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

const lifecycleModel = {
  ...model,
  people: model.people.map((person) => (person.id === 2 ? {
    ...person,
    account: {
      id: 11,
      email: "bia@clinica.test",
      is_active: true,
      status: "active",
      linkage_type: "canonical",
      has_credential: true,
    },
  } : person)),
  assignmentState: {
    ...model.assignmentState,
    users: [
      ...model.assignmentState.users,
      {
        user_id: 11,
        effective_permissions: {
          authorization_state: "authorized",
          is_administrator: false,
          modules: [{ module_key: "schedule", access_level: "manage" }],
        },
      },
    ],
  },
  accountState: {
    accounts: [
      ...model.accountState.accounts,
      {
        user_id: 11,
        name: "Bia",
        login_identifier: "bia@clinica.test",
        is_active: true,
        linked_person_id: 2,
      },
    ],
  },
};

const openActionsFor = async (name) => {
  const row = (await screen.findByText(name)).closest("article");
  const trigger = within(row).getByRole("button", { name: `Ações de ${name}` });
  if (trigger.getAttribute("aria-expanded") !== "true") fireEvent.click(trigger);
  return row;
};

describe("Equipe", () => {
  beforeEach(() => {
    useAuthorization.mockReturnValue({
      status: "ready",
      canViewTeam: true,
      canManageProfessionalLifecycle: true,
      reload: jest.fn(),
    });
    loadTeamReadModel.mockReset();
    loadTeamReadModel.mockResolvedValue(model);
    createTeamPerson.mockReset();
    createTeamAccount.mockReset();
    confirmProfessionalInactivation.mockReset();
    deactivateTeamPerson.mockReset();
    previewProfessionalInactivation.mockReset();
    updateTeamPerson.mockReset();
    activateTeamPerson.mockReset();
    blockTeamAccount.mockReset();
    assignAuthorizationProfile.mockReset();
    createAuthorizationProfile.mockReset();
    unassignAuthorizationProfile.mockReset();
    updateAuthorizationProfile.mockReset();
    resetTeamAccountPassword.mockReset();
    setTeamProfessionalState.mockReset();
    unblockTeamAccount.mockReset();
    createTeamPerson.mockResolvedValue({ id: 30 });
    createTeamAccount.mockResolvedValue({ user_id: 11, status: "active" });
    confirmProfessionalInactivation.mockResolvedValue({ professional_id: 101 });
    deactivateTeamPerson.mockResolvedValue({ id: 1 });
    previewProfessionalInactivation.mockResolvedValue({
      preview_token: "preview-token",
      counts: {},
      blockers: [],
    });
    updateTeamPerson.mockResolvedValue({ id: 1 });
    activateTeamPerson.mockResolvedValue({ id: 3 });
    blockTeamAccount.mockResolvedValue({ user_id: 10, status: "blocked" });
    assignAuthorizationProfile.mockResolvedValue({ id: 4 });
    createAuthorizationProfile.mockResolvedValue({ id: 23 });
    unassignAuthorizationProfile.mockResolvedValue(null);
    updateAuthorizationProfile.mockResolvedValue({ id: 22 });
    resetTeamAccountPassword.mockResolvedValue({ user_id: 10 });
    setTeamProfessionalState.mockResolvedValue({ id: 103, is_active: true });
    unblockTeamAccount.mockResolvedValue({ user_id: 10, status: "active" });
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

  it("ativa a atuação profissional de uma pessoa existente sem confundir com perfil", async () => {
    loadTeamReadModel.mockResolvedValue({
      ...model,
      people: [
        ...model.people,
        {
          id: 4,
          name: "Davi",
          email: "davi@clinica.test",
          phone: null,
          is_active: true,
          professional: null,
          account: null,
        },
      ],
    });
    render(<Equipe />);
    const personRow = await openActionsFor("Davi");
    fireEvent.click(within(personRow).getByRole("button", {
      name: "Ativar atuação profissional",
    }));
    await waitFor(() => expect(setTeamProfessionalState).toHaveBeenCalledWith(4, true));
    expect(within(await openActionsFor("Davi")).getByRole("button", {
      name: "Ativando atuação...",
    })).toBeDisabled();
    await waitFor(() => expect(screen.queryByRole("button", {
      name: "Ativando atuação...",
    })).not.toBeInTheDocument());
    const reloadedRow = await openActionsFor("Davi");
    expect(within(reloadedRow).getByRole("button", {
      name: "Ativar atuação profissional",
    })).not.toBeDisabled();
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
    const row = await openActionsFor("Ana");
    fireEvent.click(within(row).getByRole("button", { name: "Editar" }));
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
    const row = await openActionsFor("Caio");
    fireEvent.click(within(row).getByRole("button", { name: "Reativar pessoa" }));
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

  it("agrupa as ações de cada integrante em um único menu contextual", async () => {
    render(<Equipe />);
    const anaRow = (await screen.findByText("Ana")).closest("article");
    expect(within(anaRow).queryByRole("button", { name: "Editar" })).not.toBeInTheDocument();

    fireEvent.click(within(anaRow).getByRole("button", { name: "Ações de Ana" }));
    expect(within(anaRow).getByRole("button", { name: "Editar" })).toBeInTheDocument();
    expect(within(anaRow).getByRole("button", { name: "Gerenciar perfis" })).toBeInTheDocument();
    expect(within(anaRow).getByRole("button", { name: "Redefinir senha" })).toBeInTheDocument();
    expect(within(anaRow).getByRole("button", { name: "Bloquear" })).toBeInTheDocument();

    fireEvent.mouseDown(document.body);
    expect(within(anaRow).queryByRole("button", { name: "Editar" })).not.toBeInTheDocument();
  });

  it("cria acesso sem atribuir perfil e protege contra envio duplicado", async () => {
    let resolveRequest;
    createTeamAccount.mockImplementationOnce(() => new Promise((resolve) => {
      resolveRequest = resolve;
    }));
    render(<Equipe />);
    const row = await openActionsFor("Bia");
    fireEvent.click(within(row).getByRole("button", { name: "Criar acesso" }));
    const drawer = screen.getByRole("dialog", { name: "Criar acesso" });
    fireEvent.change(within(drawer).getByLabelText("E-mail de login"), {
      target: { value: " BIA@Example.Test " },
    });
    fireEvent.change(within(drawer).getByLabelText("Senha inicial"), {
      target: { value: "Senha@123" },
    });
    fireEvent.change(within(drawer).getByLabelText("Confirmar senha"), {
      target: { value: "Senha@123" },
    });
    fireEvent.click(within(drawer).getByRole("button", { name: "Criar acesso" }));
    const pending = await within(drawer).findByRole("button", { name: "Criando..." });
    expect(pending).toBeDisabled();
    fireEvent.click(pending);
    expect(createTeamAccount).toHaveBeenCalledTimes(1);
    expect(createTeamAccount).toHaveBeenCalledWith(2, {
      email: "BIA@Example.Test",
      password: "Senha@123",
      passwordConfirmation: "Senha@123",
    });
    expect(assignAuthorizationProfile).not.toHaveBeenCalled();
    resolveRequest({ user_id: 11 });
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Criar acesso" })).not.toBeInTheDocument());
  });

  it("preserva formulario quando o e-mail de login entra em conflito", async () => {
    createTeamAccount.mockRejectedValueOnce({
      response: { data: { error: "LOGIN_IDENTIFIER_UNAVAILABLE" } },
    });
    render(<Equipe />);
    const row = await openActionsFor("Bia");
    fireEvent.click(within(row).getByRole("button", { name: "Criar acesso" }));
    const drawer = screen.getByRole("dialog", { name: "Criar acesso" });
    fireEvent.change(within(drawer).getByLabelText("Senha inicial"), {
      target: { value: "Senha@123" },
    });
    fireEvent.change(within(drawer).getByLabelText("Confirmar senha"), {
      target: { value: "Senha@123" },
    });
    fireEvent.click(within(drawer).getByRole("button", { name: "Criar acesso" }));
    expect(await within(drawer).findByText("Este e-mail de login não está disponível.")).toBeInTheDocument();
    expect(within(drawer).getAllByDisplayValue("Senha@123")).toHaveLength(2);
    expect(within(drawer).getByRole("button", { name: "Criar acesso" })).not.toBeDisabled();
  });

  it("redefine senha com confirmação sem modificar perfis", async () => {
    render(<Equipe />);
    const row = await openActionsFor("Ana");
    fireEvent.click(within(row).getByRole("button", { name: "Redefinir senha" }));
    const drawer = screen.getByRole("dialog", { name: "Redefinir senha" });
    fireEvent.change(within(drawer).getByLabelText("Nova senha"), {
      target: { value: "Nova@123" },
    });
    fireEvent.change(within(drawer).getByLabelText("Confirmar senha"), {
      target: { value: "Nova@123" },
    });
    fireEvent.click(within(drawer).getByLabelText(/Confirmo esta operação/));
    fireEvent.click(within(drawer).getByRole("button", { name: "Redefinir senha" }));
    await waitFor(() => expect(resetTeamAccountPassword).toHaveBeenCalledWith(1, {
      password: "Nova@123",
      passwordConfirmation: "Nova@123",
    }));
    expect(assignAuthorizationProfile).not.toHaveBeenCalled();
    expect(unassignAuthorizationProfile).not.toHaveBeenCalled();
  });

  it("preserva confirmação quando o último Administrador não pode ser bloqueado", async () => {
    blockTeamAccount.mockRejectedValueOnce({
      response: { data: { error: "LAST_ADMINISTRATOR_REQUIRED" } },
    });
    render(<Equipe />);
    const row = await openActionsFor("Ana");
    fireEvent.click(within(row).getByRole("button", { name: "Bloquear" }));
    const drawer = screen.getByRole("dialog", { name: "Bloquear acesso" });
    const confirmation = within(drawer).getByLabelText(/Confirmo esta operação/);
    fireEvent.click(confirmation);
    fireEvent.click(within(drawer).getByRole("button", { name: "Bloquear acesso" }));
    expect(await within(drawer).findByText(/pelo menos um Administrador ativo/)).toBeInTheDocument();
    expect(confirmation).toBeChecked();
  });

  it("desbloqueia conta bloqueada e não oferece ações para vínculo inválido", async () => {
    const blockedModel = {
      ...model,
      people: model.people.map((person) => (person.id === 1 ? {
        ...person,
        account: { ...person.account, is_active: false, status: "blocked" },
      } : person)),
      accountState: {
        accounts: model.accountState.accounts.map((account) => ({
          ...account, is_active: false, status: "blocked", has_credential: true,
        })),
      },
    };
    loadTeamReadModel.mockResolvedValue(blockedModel);
    const { unmount } = render(<Equipe />);
    const blockedRow = await openActionsFor("Ana");
    fireEvent.click(within(blockedRow).getByRole("button", { name: "Desbloquear" }));
    const drawer = screen.getByRole("dialog", { name: "Desbloquear acesso" });
    fireEvent.click(within(drawer).getByLabelText(/Confirmo esta operação/));
    fireEvent.click(within(drawer).getByRole("button", { name: "Desbloquear acesso" }));
    await waitFor(() => expect(unblockTeamAccount).toHaveBeenCalledWith(1));
    unmount();

    loadTeamReadModel.mockResolvedValue({
      ...model,
      people: model.people.map((person) => (person.id === 1 ? {
        ...person,
        account: { ...person.account, status: "invalid", linkage_type: "invalid" },
      } : person)),
    });
    render(<Equipe />);
    expect(await screen.findByText("Vínculo inválido")).toBeInTheDocument();
    await openActionsFor("Ana");
    expect(screen.queryByRole("button", { name: "Redefinir senha" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Bloquear" })).not.toBeInTheDocument();
  });

  it("mostra impactos, cancela agenda futura e bloqueia duplo envio", async () => {
    loadTeamReadModel.mockResolvedValue(lifecycleModel);
    previewProfessionalInactivation.mockResolvedValueOnce({
      preview_token: "preview-cancel",
      counts: {
        affected_patients: 2,
        assignments: 2,
        mutable_future_sessions: 3,
        protected_future_sessions: 1,
        blocked_operational_sessions: 0,
        series: 1,
      },
      blockers: [],
    });
    let resolveCommand;
    confirmProfessionalInactivation.mockReturnValueOnce(new Promise((resolve) => {
      resolveCommand = resolve;
    }));
    render(<Equipe />);
    const anaRow = await openActionsFor("Ana");
    fireEvent.click(within(anaRow).getByRole("button", { name: "Inativar" }));
    fireEvent.click(screen.getByLabelText(/Cancelar .* futuras/));
    fireEvent.change(screen.getByLabelText("Motivo"), {
      target: { value: "Encerramento aprovado" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Visualizar impactos" }));
    await waitFor(() => expect(previewProfessionalInactivation).toHaveBeenCalledWith(
      101,
      expect.objectContaining({
        reason: "Encerramento aprovado",
        deactivate_person: true,
        destinations: { assignments: null, sessions: "cancel", series: "cancel" },
      }),
    ));
    expect(await screen.findByText("3")).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText(/Confirmo os impactos/));
    const confirmButton = screen.getByRole("button", { name: /Confirmar opera/ });
    fireEvent.click(confirmButton);
    fireEvent.click(confirmButton);
    expect(confirmProfessionalInactivation).toHaveBeenCalledTimes(1);
    resolveCommand({
      person_inactivated: true,
      account_blocked: true,
      canceled_session_ids: [1, 2, 3],
      preserved_session_ids: [4],
    });
    expect(await screen.findByText(/3 sess/)).toBeInTheDocument();
    expect(screen.getByText(/conta foi bloqueada/)).toBeInTheDocument();
  });

  it("exibe conflito na previa e exige nova previa quando o estado muda", async () => {
    loadTeamReadModel.mockResolvedValue(lifecycleModel);
    previewProfessionalInactivation
      .mockResolvedValueOnce({
        preview_token: "preview-conflict",
        counts: {},
        blockers: [{ code: "PROFESSIONAL_DESTINATION_AVAILABILITY_CONFLICT" }],
      })
      .mockResolvedValueOnce({ preview_token: "preview-stale", counts: {}, blockers: [] });
    confirmProfessionalInactivation.mockRejectedValueOnce({
      response: { data: { error: "PREVIEW_STATE_CHANGED" } },
    });
    render(<Equipe />);
    const anaRow = await openActionsFor("Ana");
    fireEvent.click(within(anaRow).getByRole("button", { name: "Inativar" }));
    fireEvent.change(screen.getByLabelText("Profissional de destino"), { target: { value: "102" } });
    fireEvent.change(screen.getByLabelText("Motivo"), { target: { value: "Transferir carteira" } });
    fireEvent.click(screen.getByRole("button", { name: "Visualizar impactos" }));
    await waitFor(() => expect(previewProfessionalInactivation).toHaveBeenCalledWith(
      101,
      expect.objectContaining({
        destinations: {
          assignments: 102,
          sessions: 102,
          series: 102,
          drafts: 102,
          plans: 102,
        },
      }),
    ));
    expect(await screen.findByText(/possui conflito na agenda futura/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Confirmar opera/ })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Atualizar prévia" }));
    await screen.findByLabelText(/Confirmo os impactos/);
    fireEvent.click(screen.getByLabelText(/Confirmo os impactos/));
    fireEvent.click(screen.getByRole("button", { name: /Confirmar opera/ }));
    expect(await screen.findByText(/estado mudou depois da prévia/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Visualizar impactos" })).toBeInTheDocument();
  });

  it("inativa pessoa sem atuacao profissional somente apos confirmacao", async () => {
    loadTeamReadModel.mockResolvedValue({
      ...model,
      people: [
        ...model.people,
        {
          id: 4,
          name: "Dora",
          email: null,
          phone: null,
          is_active: true,
          professional: null,
          account: null,
        },
      ],
    });
    render(<Equipe />);
    const row = await openActionsFor("Dora");
    fireEvent.click(within(row).getByRole("button", { name: "Inativar" }));
    const confirmButton = screen.getByRole("button", { name: /Confirmar inativa/ });
    expect(confirmButton).toBeDisabled();
    fireEvent.click(screen.getByLabelText(/Confirmo a inativa/));
    fireEvent.click(confirmButton);
    await waitFor(() => expect(deactivateTeamPerson).toHaveBeenCalledTimes(1));
  });

  it("mantem inativacao profissional indisponivel com a flag desligada", async () => {
    useAuthorization.mockReturnValue({
      status: "ready",
      canViewTeam: true,
      canManageProfessionalLifecycle: false,
    });
    render(<Equipe />);
    const row = await openActionsFor("Ana");
    expect(within(row).queryByRole("button", { name: "Inativar" })).not.toBeInTheDocument();
  });

  it("nega acesso direto sem carregar dados", () => {
    useAuthorization.mockReturnValue({
      status: "ready", canViewTeam: false, reload: jest.fn(),
    });
    render(<Equipe />);
    expect(screen.getByText("Acesso não permitido")).toBeInTheDocument();
    expect(loadTeamReadModel).not.toHaveBeenCalled();
  });

  it("mantém 403 distinto de falha de carregamento", () => {
    useAuthorization.mockReturnValue({
      status: "forbidden", canViewTeam: false, reload: jest.fn(),
    });
    render(<Equipe />);
    expect(screen.getByText("Acesso não permitido")).toBeInTheDocument();
    expect(screen.queryByText(/Não foi possível carregar a área Equipe/)).not.toBeInTheDocument();
    expect(loadTeamReadModel).not.toHaveBeenCalled();
  });

  it("exibe falha segura do contexto para rede ou 5xx e permite repetir", () => {
    const reload = jest.fn();
    useAuthorization.mockReturnValue({ status: "error", canViewTeam: false, reload });
    render(<Equipe />);
    expect(screen.getByText("Não foi possível carregar a área Equipe. Tente novamente."))
      .toBeInTheDocument();
    expect(screen.queryByText("Acesso não permitido")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect(reload).toHaveBeenCalledTimes(1);
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
    const row = await openActionsFor("Ana");
    fireEvent.click(within(row).getByRole("button", { name: "Gerenciar perfis" }));
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

test("payload real de atribuições expõe permissão efetiva de Agenda", async () => {
  useAuthorization.mockReturnValue({ status: "ready", canViewTeam: true });
  const scheduleModel = {
    ...model,
    profiles: [{
      id: 25,
      name: "Acesso Agenda",
      native_type: null,
      is_active: true,
      permissions: [{
        moduleKey: "schedule",
        accessLevel: "manage",
        scopeLevel: "clinic",
        canExport: false,
      }],
      capabilities: ["schedule.configure"],
    }],
    catalog: {
      ...model.catalog,
      modules: [{
        module_key: "schedule",
        valid_access_levels: ["none", "view", "manage"],
        valid_scopes: ["own", "clinic"],
        exportable: false,
      }],
    },
    assignmentState: {
      users: [{
        user_id: 10,
        assignment_ids: [8],
        effective_permissions: {
          authorization_state: "authorized",
          is_administrator: false,
          modules: [{
            module_key: "schedule",
            access_level: "manage",
            scope_level: "clinic",
            can_export: false,
          }],
          capabilities: ["schedule.configure"],
          administrative_powers: [],
        },
      }],
      assignments: [{ assignment_id: 8, user_id: 10, profile_id: 25 }],
    },
  };
  loadTeamReadModel.mockResolvedValue(scheduleModel);
  render(<Equipe />);
  const row = await openActionsFor("Ana");
  fireEvent.click(within(row).getByRole("button", { name: "Gerenciar perfis" }));
  expect(screen.getByText("Agenda")).toBeInTheDocument();
  expect(screen.getByText(/Gerenciar.*Toda a clínica/)).toBeInTheDocument();
  expect(screen.queryByText(/não possui permissões granulares/)).not.toBeInTheDocument();
});

test.each([
  ["no_permissions", "Esta conta não possui permissões granulares efetivas."],
  ["invalid", "Estado de autorização inválido. Nenhum acesso deve ser concedido."],
])("frontend distingue estado %s no contrato efetivo", async (stateName, expectedMessage) => {
  useAuthorization.mockReturnValue({ status: "ready", canViewTeam: true });
  loadTeamReadModel.mockResolvedValue({
    ...model,
    assignmentState: {
      users: [{
        user_id: 10,
        assignment_ids: stateName === "invalid" ? [1] : [],
        effective_permissions: {
          authorization_state: stateName,
          is_administrator: false,
          modules: [],
          capabilities: [],
          administrative_powers: [],
        },
      }],
      assignments: stateName === "invalid"
        ? [{ assignment_id: 1, user_id: 10, profile_id: 20 }]
        : [],
    },
  });
  render(<Equipe />);
  const row = await openActionsFor("Ana");
  fireEvent.click(within(row).getByRole("button", { name: "Gerenciar perfis" }));
  expect(screen.getByText(expectedMessage)).toBeInTheDocument();
});
