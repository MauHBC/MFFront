import {
  canManageProfessionalLifecycle,
  classifyAuthorizationContextFailure,
  contextCanAccessModule,
  contextHasCapability,
  isValidAuthorizationContext,
  isTeamAdministrator,
} from "./AuthorizationContext";

jest.mock("../services/team", () => ({ getAuthorizationContext: jest.fn() }));

describe("AuthorizationContext", () => {
  const modules = [
    "dashboard", "schedule", "patients", "clinical_records",
    "plans", "finance", "team", "settings",
  ].map((moduleKey) => ({
    module_key: moduleKey,
    access_level: "manage",
    scope_level: ["dashboard", "finance", "team", "settings"].includes(moduleKey)
      ? null
      : "clinic",
    can_export: false,
  }));
  const administrator = {
    authorization_state: "authorized",
    catalog_version: 6,
    is_administrator: true,
    modules,
    capabilities: [],
    administrative_powers: ["access_profiles.manage"],
  };

  it("aceita somente Administrador com o poder oficial", () => {
    expect(isTeamAdministrator(administrator)).toBe(true);
  });

  it("resolve modulos e capacidades apenas em payload oficial completo", () => {
    const agendaOnly = {
      ...administrator,
      is_administrator: false,
      administrative_powers: [],
      modules: modules.map((module) => ({
        ...module,
        access_level: module.module_key === "schedule" ? "manage" : "none",
        scope_level: module.module_key === "schedule" ? "clinic" : null,
      })),
      capabilities: ["schedule.configure"],
    };
    expect(isValidAuthorizationContext(agendaOnly)).toBe(true);
    expect(contextCanAccessModule(agendaOnly, "schedule", "manage")).toBe(true);
    expect(contextCanAccessModule(agendaOnly, "patients")).toBe(false);
    expect(contextHasCapability(agendaOnly, "schedule.configure")).toBe(true);
    expect(isValidAuthorizationContext({ ...agendaOnly, modules: agendaOnly.modules.slice(1) }))
      .toBe(false);
    expect(isValidAuthorizationContext({ ...agendaOnly, catalog_version: 7 })).toBe(false);
    expect(contextCanAccessModule({ ...agendaOnly, authorization_state: "invalid" }, "schedule"))
      .toBe(false);
  });

  it("libera ciclo profissional somente com gate e capacidade oficiais", () => {
    expect(canManageProfessionalLifecycle({
      ...administrator,
      professional_lifecycle_available: true,
      capabilities: ["professionals.lifecycle.manage"],
    })).toBe(true);
    expect(canManageProfessionalLifecycle({
      ...administrator,
      professional_lifecycle_available: false,
      capabilities: ["professionals.lifecycle.manage"],
    })).toBe(false);
    expect(canManageProfessionalLifecycle({
      ...administrator,
      professional_lifecycle_available: true,
    })).toBe(false);
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

  it.each([
    [{ response: { status: 401 } }, "idle"],
    [{ response: { status: 403 } }, "forbidden"],
    [{ response: { status: 500 } }, "error"],
    [new Error("network unavailable"), "error"],
  ])("classifica falha do contexto sem confundir autorização e indisponibilidade", (
    error,
    expectedStatus,
  ) => {
    expect(classifyAuthorizationContextFailure(error)).toBe(expectedStatus);
  });
});
