import api from "./axios";
import {
  activateTeamPerson,
  createTeamPerson,
  getAuthorizationContext,
  loadTeamReadModel,
  updateTeamPerson,
} from "./team";

jest.mock("./axios", () => ({
  get: jest.fn(),
  post: jest.fn(),
  put: jest.fn(),
  patch: jest.fn(),
}));

describe("team read service", () => {
  beforeEach(() => {
    api.get.mockReset();
    api.post.mockReset();
    api.put.mockReset();
    api.patch.mockReset();
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
});
