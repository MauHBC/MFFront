import React from "react";
import "@testing-library/jest-dom";
import { act, render, screen } from "@testing-library/react";
import { Provider } from "react-redux";
import { createStore } from "redux";
import {
  AuthorizationProvider,
  canManageProfessionalLifecycle,
  classifyAuthorizationContextFailure,
  contextCanAccessModule,
  contextHasCapability,
  contextIsAdministrator,
  isValidAuthorizationContext,
  isTeamAdministrator,
  useAuthorization,
} from "./AuthorizationContext";
import { getAuthorizationContext } from "../services/team";

jest.mock("../services/team", () => ({ getAuthorizationContext: jest.fn() }));

const deferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
};

const authState = ({
  isLoggedIn = true,
  token = "token",
  userId = 1,
} = {}) => ({
  isLoggedIn,
  token,
  user: userId ? { id: userId } : {},
});

const createAuthStore = (initialAuth) => createStore((state, action) => {
  const currentState = state || { auth: initialAuth };
  return action.type === "SET_AUTH" ? { auth: action.payload } : currentState;
});

function AuthorizationProbe() {
  const authorization = useAuthorization();
  return (
    <div>
      <span data-testid="status">{authorization.status}</span>
      <span data-testid="administrator">{String(authorization.canViewTeam)}</span>
      <span data-testid="native-administrator">{String(authorization.isAdministrator)}</span>
      <span data-testid="schedule">{String(authorization.canAccessModule("schedule"))}</span>
      <span data-testid="patients">{String(authorization.canAccessModule("patients"))}</span>
    </div>
  );
}

const renderProvider = (store) => render(
  <Provider store={store}>
    <AuthorizationProvider>
      <AuthorizationProbe />
    </AuthorizationProvider>
  </Provider>,
);

const dispatchAuth = (store, nextAuth) => {
  act(() => {
    store.dispatch({ type: "SET_AUTH", payload: nextAuth });
  });
};

const settle = async (pending, value, reject = false) => {
  await act(async () => {
    if (reject) pending.reject(value);
    else pending.resolve(value);
    await pending.promise.catch(() => undefined);
  });
};

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
    catalog_version: 7,
    is_administrator: true,
    modules,
    capabilities: [],
    administrative_powers: ["access_profiles.manage"],
  };
  const scheduleOnly = {
    ...administrator,
    is_administrator: false,
    modules: modules.map((module) => ({
      ...module,
      access_level: module.module_key === "schedule" ? "manage" : "none",
      scope_level: module.module_key === "schedule" ? "clinic" : null,
    })),
    capabilities: ["schedule.configure"],
    administrative_powers: [],
  };

  beforeEach(() => {
    getAuthorizationContext.mockReset();
  });

  it("aceita somente Administrador com o poder oficial", () => {
    expect(isTeamAdministrator(administrator)).toBe(true);
  });

  it("expõe Administrador nativo sem depender de poder administrativo não relacionado", () => {
    const nativeAdministrator = { ...administrator, administrative_powers: [] };
    expect(contextIsAdministrator(nativeAdministrator)).toBe(true);
    expect(isTeamAdministrator(nativeAdministrator)).toBe(false);
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
    expect(isValidAuthorizationContext({ ...agendaOnly, catalog_version: 6 })).toBe(false);
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

  it("ignora resposta administrativa anterior depois de logout e novo login", async () => {
    const oldAdministrator = deferred();
    const currentUser = deferred();
    getAuthorizationContext
      .mockImplementationOnce(() => oldAdministrator.promise)
      .mockImplementationOnce(() => currentUser.promise);
    const store = createAuthStore(authState({ token: "admin-token", userId: 1 }));
    renderProvider(store);
    expect(screen.getByTestId("status")).toHaveTextContent("loading");

    dispatchAuth(store, authState({ isLoggedIn: false, token: false, userId: null }));
    expect(screen.getByTestId("status")).toHaveTextContent("idle");
    expect(screen.getByTestId("administrator")).toHaveTextContent("false");
    expect(screen.getByTestId("native-administrator")).toHaveTextContent("false");

    dispatchAuth(store, authState({ token: "common-token", userId: 13 }));
    expect(screen.getByTestId("status")).toHaveTextContent("loading");
    await settle(oldAdministrator, administrator);
    expect(screen.getByTestId("status")).toHaveTextContent("loading");
    expect(screen.getByTestId("administrator")).toHaveTextContent("false");

    await settle(currentUser, scheduleOnly);
    expect(screen.getByTestId("status")).toHaveTextContent("ready");
    expect(screen.getByTestId("administrator")).toHaveTextContent("false");
    expect(screen.getByTestId("schedule")).toHaveTextContent("true");
    expect(screen.getByTestId("patients")).toHaveTextContent("false");
  });

  it("mantem a resposta mais nova entre dois usuarios pendentes", async () => {
    const first = deferred();
    const second = deferred();
    getAuthorizationContext
      .mockImplementationOnce(() => first.promise)
      .mockImplementationOnce(() => second.promise);
    const store = createAuthStore(authState({ token: "first-token", userId: 1 }));
    renderProvider(store);
    dispatchAuth(store, authState({ token: "second-token", userId: 2 }));
    await settle(second, scheduleOnly);
    await settle(first, administrator);
    expect(screen.getByTestId("administrator")).toHaveTextContent("false");
    expect(screen.getByTestId("schedule")).toHaveTextContent("true");
  });

  it("troca de token do mesmo usuario invalida a resposta anterior", async () => {
    const first = deferred();
    const second = deferred();
    getAuthorizationContext
      .mockImplementationOnce(() => first.promise)
      .mockImplementationOnce(() => second.promise);
    const store = createAuthStore(authState({ token: "old-token", userId: 13 }));
    renderProvider(store);
    dispatchAuth(store, authState({ token: "new-token", userId: 13 }));
    await settle(second, scheduleOnly);
    await settle(first, administrator);
    expect(screen.getByTestId("administrator")).toHaveTextContent("false");
  });

  it("logout invalida sucesso pendente e remove modulos imediatamente", async () => {
    const pending = deferred();
    getAuthorizationContext.mockImplementationOnce(() => pending.promise);
    const store = createAuthStore(authState({ token: "admin-token", userId: 1 }));
    renderProvider(store);
    dispatchAuth(store, authState({ isLoggedIn: false, token: false, userId: null }));
    await settle(pending, administrator);
    expect(screen.getByTestId("status")).toHaveTextContent("idle");
    expect(screen.getByTestId("administrator")).toHaveTextContent("false");
  });

  it("erro antigo nao substitui sucesso da identidade atual", async () => {
    const oldRequest = deferred();
    const currentRequest = deferred();
    getAuthorizationContext
      .mockImplementationOnce(() => oldRequest.promise)
      .mockImplementationOnce(() => currentRequest.promise);
    const store = createAuthStore(authState({ token: "old-token", userId: 1 }));
    renderProvider(store);
    dispatchAuth(store, authState({ token: "new-token", userId: 13 }));
    await settle(currentRequest, scheduleOnly);
    await settle(oldRequest, { response: { status: 403 } }, true);
    expect(screen.getByTestId("status")).toHaveTextContent("ready");
    expect(screen.getByTestId("schedule")).toHaveTextContent("true");
  });

  it("desmontagem invalida requisicao pendente", async () => {
    const pending = deferred();
    getAuthorizationContext.mockImplementationOnce(() => pending.promise);
    const store = createAuthStore(authState({ token: "token", userId: 1 }));
    const view = renderProvider(store);
    view.unmount();
    await settle(pending, administrator);
    expect(view.container).toBeEmptyDOMElement();
  });

  it("identidade temporariamente incompleta permanece fechada", () => {
    const store = createAuthStore(authState({ token: false, userId: null }));
    renderProvider(store);
    expect(screen.getByTestId("status")).toHaveTextContent("idle");
    expect(screen.getByTestId("administrator")).toHaveTextContent("false");
    expect(screen.getByTestId("schedule")).toHaveTextContent("false");
    expect(getAuthorizationContext).not.toHaveBeenCalled();
  });
});
