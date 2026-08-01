import api from "./axios";
import {
  activateTeamPerson,
  assignAuthorizationProfile,
  blockTeamAccount,
  createAuthorizationProfile,
  createTeamAccount,
  createTeamPerson,
  getAuthorizationContext,
  loadTeamReadModel,
  resetTeamAccountPassword,
  unassignAuthorizationProfile,
  updateAuthorizationProfile,
  updateTeamPerson,
  unblockTeamAccount,
} from "./team";

jest.mock("./axios", () => ({
  get: jest.fn(),
  post: jest.fn(),
  put: jest.fn(),
  patch: jest.fn(),
  delete: jest.fn(),
}));

describe("team read service", () => {
  beforeEach(() => {
    api.get.mockReset();
    api.post.mockReset();
    api.put.mockReset();
    api.patch.mockReset();
    api.delete.mockReset();
  });

  it("cria e edita perfil somente com a definição oficial", async () => {
    api.post.mockResolvedValueOnce({ data: { id: 8 } });
    api.put.mockResolvedValueOnce({ data: { id: 8 } });
    const definition = {
      name: "Recepção",
      permissions: [{ moduleKey: "patients", accessLevel: "view", scopeLevel: "clinic", canExport: false }],
      capabilities: [],
    };
    await createAuthorizationProfile(definition);
    await updateAuthorizationProfile(8, definition);
    expect(api.post).toHaveBeenCalledWith("/team/profiles", definition);
    expect(api.put).toHaveBeenCalledWith("/team/profiles/8", definition);
  });

  it("atribui e remove perfil sem enviar clinic_id", async () => {
    api.post.mockResolvedValueOnce({ data: { id: 11 } });
    api.delete.mockResolvedValueOnce({ data: null });
    await assignAuthorizationProfile(8, 4);
    await unassignAuthorizationProfile(8, 4);
    expect(api.post).toHaveBeenCalledWith("/team/profiles/8/assignments", { user_id: 4 });
    expect(api.delete).toHaveBeenCalledWith("/team/profiles/8/assignments/4");
  });

  it("consulta o contexto sem enviar identidade controlada pelo navegador", async () => {
    api.get.mockResolvedValueOnce({ data: { authorization_state: "authorized" } });
    await getAuthorizationContext();
    expect(api.get).toHaveBeenCalledWith("/team/authorization-context");
    expect(api.get.mock.calls[0]).toHaveLength(1);
  });

  it("carrega somente endpoints GET oficiais e existentes", async () => {
    api.get.mockResolvedValue({ data: [] });
    await loadTeamReadModel();
    expect(api.get.mock.calls.map(([path]) => path)).toEqual([
      "/team/people",
      "/team/profiles",
      "/team/authorization-catalog",
      "/team/profile-assignments",
      "/team/linkable-accounts",
    ]);
  });

  it("cria pessoa sem enviar clinic_id, conta, senha ou perfil", async () => {
    api.post.mockResolvedValueOnce({ data: { id: 1 } });
    await createTeamPerson({
      name: "Ana",
      email: "ana@example.test",
      phone: "2799999999",
      isProfessional: true,
    });
    expect(api.post).toHaveBeenCalledWith("/team/people", {
      name: "Ana",
      email: "ana@example.test",
      phone: "2799999999",
      is_professional: true,
    });
  });

  it("edita e reativa pessoa pelos contratos oficiais sem identidade do tenant", async () => {
    api.put.mockResolvedValueOnce({ data: { id: 4 } });
    api.patch.mockResolvedValueOnce({ data: { id: 4 } });
    await updateTeamPerson(4, { name: "Bia", email: "", phone: "" });
    await activateTeamPerson(4);
    expect(api.put).toHaveBeenCalledWith("/team/people/4", {
      name: "Bia",
      email: null,
      phone: null,
    });
    expect(api.patch).toHaveBeenCalledWith("/team/people/4/activate");
  });

  it("administra conta somente pelos contratos tenant-scoped de Equipe", async () => {
    api.post.mockResolvedValueOnce({ data: { user_id: 9 } });
    api.patch.mockResolvedValue({ data: { user_id: 9 } });
    await createTeamAccount(4, {
      email: "login@example.test",
      password: "Senha@123",
      passwordConfirmation: "Senha@123",
    });
    await resetTeamAccountPassword(4, {
      password: "Nova@123",
      passwordConfirmation: "Nova@123",
    });
    await blockTeamAccount(4);
    await unblockTeamAccount(4);
    expect(api.post).toHaveBeenCalledWith("/team/people/4/account", {
      email: "login@example.test",
      password: "Senha@123",
      password_confirmation: "Senha@123",
    });
    expect(api.patch.mock.calls).toEqual([
      ["/team/people/4/account/password", {
        password: "Nova@123",
        password_confirmation: "Nova@123",
        confirmed: true,
      }],
      ["/team/people/4/account/block", { confirmed: true }],
      ["/team/people/4/account/unblock", { confirmed: true }],
    ]);
  });
});
