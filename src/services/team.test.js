import api from "./axios";
import {
  getAuthorizationContext,
  loadTeamReadModel,
} from "./team";

jest.mock("./axios", () => ({ get: jest.fn() }));

describe("team read service", () => {
  beforeEach(() => api.get.mockReset());

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
    expect(Object.keys(api).filter((key) => ["post", "put", "patch", "delete"].includes(key)))
      .toHaveLength(0);
  });
});
