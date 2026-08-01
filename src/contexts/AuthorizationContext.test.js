import { isTeamAdministrator } from "./AuthorizationContext";

jest.mock("../services/team", () => ({ getAuthorizationContext: jest.fn() }));

describe("AuthorizationContext", () => {
  const administrator = {
    authorization_state: "authorized",
    catalog_version: 6,
    is_administrator: true,
    modules: [{
      module_key: "team",
      access_level: "manage",
      scope_level: "clinic",
      can_export: false,
    }],
    capabilities: [],
    administrative_powers: ["access_profiles.manage"],
  };

  it("aceita somente Administrador com o poder oficial", () => {
    expect(isTeamAdministrator(administrator)).toBe(true);
  });

  it.each([
    null,
    {},
    { ...administrator, authorization_state: "no_permissions" },
    { ...administrator, is_administrator: false },
    { ...administrator, administrative_powers: [] },
    { ...administrator, modules: [] },
    { ...administrator, capabilities: null },
  ])("falha fechado para contexto ausente, profissional ou sem perfil", (context) => {
    expect(isTeamAdministrator(context)).toBe(false);
  });
});
