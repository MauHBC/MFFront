import React from "react";
import "@testing-library/jest-dom";
import http from "http";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Provider } from "react-redux";
import { createStore } from "redux";
import { createMemoryHistory } from "history";
import { Router } from "react-router-dom";
import Routes from ".";
import { AuthorizationProvider } from "../contexts/AuthorizationContext";
import api from "../services/axios";

const realBackend = process.env.MOTRIA_ACCOUNT_REAL_BACKEND
  ? JSON.parse(process.env.MOTRIA_ACCOUNT_REAL_BACKEND) : null;

// Keep the real route declarations, MyRoute, AuthorizationProvider, account and
// recovery pages/services. Unrelated modules/chrome are outside this HTTP gate.
jest.mock("../components/ImobNavbar/TopNavbar", () => () => null);
jest.mock("../components/AppShell", () => ({ children }) => <div>{children}</div>);
jest.mock("../components/PendingCenter", () => ({ PendingCenterProvider: ({ children }) => children }));
jest.mock("../pages/Menu", () => () => <h1>Início autenticado</h1>);
jest.mock("../pages/Login", () => () => <h1>Login</h1>);
jest.mock("../pages/Home", () => () => null);
jest.mock("../pages/Politica", () => () => null);
jest.mock("../pages/PatientSelfSignup", () => () => null);
jest.mock("../pages/PatientsNew", () => () => null);
jest.mock("../pages/PatientsSearch", () => () => null);
jest.mock("../pages/PatientDetails", () => () => null);
jest.mock("../pages/Agendamentos", () => () => null);
jest.mock("../pages/Dashboard", () => () => null);
jest.mock("../pages/PatientEvaluationNew", () => () => null);
jest.mock("../pages/PatientEvaluationDetails", () => () => null);
jest.mock("../pages/Financeiro", () => () => null);
jest.mock("../pages/SchedulingEvents", () => () => null);
jest.mock("../pages/Planos", () => () => null);
jest.mock("../pages/PlatformPaused", () => () => null);
jest.mock("../pages/Equipe", () => () => null);
jest.mock("../pages/SettingsDocuments", () => () => null);
jest.mock("react-toastify", () => ({ toast: { error: jest.fn(), success: jest.fn() } }));

const contextFor = (source = "membership", isAdministrator = true) => ({
  catalog_version: 7,
  authorization_state: "authorized",
  is_administrator: isAdministrator,
  modules: ["dashboard", "schedule", "patients", "clinical_records", "plans", "finance", "team", "settings"]
    .map((moduleKey) => ({ module_key: moduleKey, access_level: "manage", scope_level: null, can_export: false })),
  capabilities: [],
  administrative_powers: ["access_profiles.manage"],
  ...(source === "membership" ? {
    authorization_source: source,
    own_scope: { available: false, unavailability_reason: "active_professional_link_required" },
  } : {}),
});

const auth = (token = "membership-session", isLoggedIn = true) => ({
  isLoggedIn, token,
  user: { id: 7, name: "Titular atual", email: "titular@example.test", group_ids: [] },
});

let server;
let requests;
let replies;
let holdContext;
let contextStatus;
let currentContext;
let originalBaseURL;

const respond = (res, status, body) => {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
};

beforeAll(async () => {
  originalBaseURL = api.defaults.baseURL;
  if (realBackend) { api.defaults.baseURL = realBackend.baseURL; return; }
  server = http.createServer((req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    if (req.method === "OPTIONS") { res.writeHead(204); res.end(); return; }
    let raw = "";
    req.on("data", (chunk) => { raw += chunk; });
    req.on("end", () => {
      requests.push({ method: req.method, path: req.url, body: raw ? JSON.parse(raw) : null });
      if (req.url === "/api/team/authorization-context") {
        if (holdContext) replies.push(res);
        else respond(res, contextStatus, currentContext);
      } else if (req.url === "/api/public/credential-recovery-requests") {
        respond(res, 202, { accepted: true });
      } else if (req.url === "/api/users") {
        respond(res, 200, { data: {} });
      } else respond(res, 404, { error: "fake_api_route_not_found" });
    });
  });
  await new Promise((resolve) => { server.listen(0, "127.0.0.1", resolve); });
  api.defaults.baseURL = `http://127.0.0.1:${server.address().port}/api`;
});

beforeEach(() => {
  requests = [];
  replies = [];
  holdContext = false;
  contextStatus = 200;
  currentContext = contextFor();
});

afterEach(() => {
  cleanup();
  replies.forEach((res) => respond(res, 503, {}));
});

afterAll(async () => {
  api.defaults.baseURL = originalBaseURL;
  if (server) await new Promise((resolve) => { server.close(resolve); });
});

const renderAccountRoute = (initialAuth = auth()) => {
  const actions = [];
  const store = createStore((state, action) => {
    const currentState = state || { auth: initialAuth };
    actions.push(action.type);
    if (action.type === "SET_AUTH") return { auth: action.payload };
    if (action.type === "LOGIN_FAILURE") return { auth: auth(false, false) };
    return currentState;
  });
  const history = createMemoryHistory({ initialEntries: ["/register/"] });
  render(
    <Provider store={store}>
      <Router history={history}>
        <AuthorizationProvider><Routes /></AuthorizationProvider>
      </Router>
    </Provider>,
  );
  return { actions, history, store };
};

const expectNoAccountRequests = () => expect(requests.filter((req) => req.path === "/api/users"))
  .toEqual([]);

const waitForLegacyForm = async () => {
  await screen.findByLabelText("E-mail:");
  await waitFor(() => expect(screen.getByLabelText("E-mail:")).toHaveValue("titular@example.test"));
};

// Normal CI keeps the existing fake-API suite. The isolated cross-repo gate
// supplies identities/tokens from the real Backend, without persisting them.
(realBackend ? describe.skip : describe)("API falsa loopback", () => {

test("admin membership por URL direta recebe aviso; recuperação autenticada usa HTTP público sem logout", async () => {
  const { actions, history, store } = renderAccountRoute();
  expect(await screen.findByText("A edição da conta não está disponível nesta versão."))
    .toBeInTheDocument();
  expect(screen.queryByLabelText("Nome:")).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Salvar" })).not.toBeInTheDocument();
  expectNoAccountRequests();
  fireEvent.click(screen.getByRole("link", { name: "Recuperar senha" }));
  expect(history.location.pathname).toBe("/recuperar-senha");
  fireEvent.change(screen.getByLabelText("E-mail"), { target: { value: "titular@example.test" } });
  fireEvent.click(screen.getByRole("button", { name: "Enviar link" }));
  expect(await screen.findByRole("status")).toHaveTextContent("Se a conta estiver apta");
  expect(requests.filter((req) => req.method === "POST")).toEqual([{
    method: "POST", path: "/api/public/credential-recovery-requests", body: { email: "titular@example.test" },
  }]);
  expect(store.getState().auth.isLoggedIn).toBe(true);
  expect(store.getState().auth.token).toBe("membership-session");
  expect(actions).not.toContain("LOGIN_FAILURE");
  expectNoAccountRequests();
});

test("voltar ao início usa a rota canônica sem logout", async () => {
  const { history, store } = renderAccountRoute();
  fireEvent.click(await screen.findByRole("link", { name: "Voltar ao início" }));
  expect(history.location.pathname).toBe("/menu");
  expect(screen.getByRole("heading", { name: "Início autenticado" })).toBeInTheDocument();
  expect(store.getState().auth.isLoggedIn).toBe(true);
  expectNoAccountRequests();
});

test.each([403, 500])("falha HTTP %s da autorização não revela formulário", async (status) => {
  contextStatus = status;
  renderAccountRoute();
  expect(await screen.findByRole(status === 500 ? "alert" : "heading"))
    .toHaveTextContent(status === 500 ? "Não foi possível validar" : "Você não tem acesso");
  expect(screen.queryByLabelText("Nome:")).not.toBeInTheDocument();
  expectNoAccountRequests();
});

test("sem login continua redirecionado sem chamadas HTTP", () => {
  const { history } = renderAccountRoute(auth(false, false));
  expect(history.location.pathname).toBe("/login");
  expect(screen.getByRole("heading", { name: "Login" })).toBeInTheDocument();
  expect(requests).toEqual([]);
});

test.each(["membership", "legacy"])("não administrador %s mantém a restrição", async (source) => {
  currentContext = contextFor(source, false);
  renderAccountRoute();
  expect(await screen.findByText("Você não tem acesso")).toBeInTheDocument();
  expect(screen.queryByText("A edição da conta não está disponível nesta versão."))
    .not.toBeInTheDocument();
  expectNoAccountRequests();
});

test("legacy preserva troca de e-mail com reautenticação e logout", async () => {
  currentContext = contextFor("legacy");
  const { history } = renderAccountRoute(auth("legacy-session"));
  await waitForLegacyForm();
  fireEvent.change(screen.getByLabelText("E-mail:"), { target: { value: "novo@example.test" } });
  fireEvent.change(screen.getByLabelText(/Senha atual para confirmar/), { target: { value: "Senha-local-123!" } });
  fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
  await waitFor(() => expect(history.location.pathname).toBe("/login"));
  expect(requests.filter((req) => req.method === "PUT")).toEqual([{
    method: "PUT", path: "/api/users",
    body: { name: "Titular atual", email: "novo@example.test", current_password: "Senha-local-123!" },
  }]);
});

test("mudança de sessão desmonta legacy imediatamente e ignora resposta antiga durante carregamento", async () => {
  currentContext = contextFor("legacy");
  const { store } = renderAccountRoute(auth("legacy-session"));
  expect(await screen.findByLabelText("Nome:")).toBeInTheDocument();
  holdContext = true;
  act(() => store.dispatch({ type: "SET_AUTH", payload: auth("intermediate-session") }));
  expect(screen.queryByLabelText("Nome:")).not.toBeInTheDocument();
  expect(screen.getByRole("status")).toHaveTextContent("Validando acesso");
  await waitFor(() => expect(replies).toHaveLength(1));
  act(() => store.dispatch({ type: "SET_AUTH", payload: auth("membership-session") }));
  await waitFor(() => expect(replies).toHaveLength(2));
  respond(replies.shift(), 200, contextFor("legacy"));
  await act(async () => { await new Promise((resolve) => { setTimeout(resolve, 20); }); });
  expect(screen.queryByLabelText("Nome:")).not.toBeInTheDocument();
  expect(screen.getByRole("status")).toHaveTextContent("Validando acesso");
  respond(replies.shift(), 200, contextFor());
  expect(await screen.findByRole("link", { name: "Recuperar senha" })).toBeInTheDocument();
  expectNoAccountRequests();
});

test("legacy mantém edição, troca de senha e desativação com HTTP observável", async () => {
  currentContext = contextFor("legacy");
  const { history, store } = renderAccountRoute(auth("legacy-session"));
  await waitForLegacyForm();
  fireEvent.change(screen.getByLabelText("Nome:"), { target: { value: "Nome atualizado" } });
  fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
  await waitFor(() => expect(requests.filter((req) => req.method === "PUT")).toHaveLength(1));
  await waitFor(() => expect(screen.getByRole("button", { name: "Salvar" })).not.toBeDisabled());
  expect(store.getState().auth.isLoggedIn).toBe(true);
  fireEvent.change(screen.getByLabelText(/Nova senha/), { target: { value: "Nova-senha-local-456!" } });
  fireEvent.change(screen.getByLabelText(/Senha atual para confirmar/), { target: { value: "Senha-local-123!" } });
  fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
  await waitFor(() => expect(history.location.pathname).toBe("/login"));
  expect(requests.filter((req) => req.method === "PUT").map((req) => req.body)).toEqual([
    { name: "Nome atualizado", email: "titular@example.test" },
    { name: "Nome atualizado", email: "titular@example.test", password: "Nova-senha-local-456!", current_password: "Senha-local-123!" },
  ]);
  act(() => {
    store.dispatch({ type: "SET_AUTH", payload: auth("legacy-new-session") });
    history.push("/register/");
  });
  fireEvent.click(await screen.findByRole("button", { name: "Desativar minha conta" }));
  fireEvent.change(screen.getByLabelText(/Senha atual para confirmar/), { target: { value: "Nova-senha-local-456!" } });
  fireEvent.click(screen.getByRole("button", { name: "Confirmar desativação" }));
  await waitFor(() => expect(history.location.pathname).toBe("/login"));
  expect(requests.filter((req) => req.method === "DELETE")).toEqual([{
    method: "DELETE", path: "/api/users", body: { current_password: "Nova-senha-local-456!" },
  }]);
});
});

(realBackend ? describe : describe.skip)("Backend real + MariaDB descartável", () => {
  beforeEach(() => {
    api.defaults.headers.Authorization = `Bearer ${realBackend.administrator.token}`;
  });
  afterEach(() => { delete api.defaults.headers.Authorization; });

  test("administrador recebe somente aviso e volta ao início sem logout", async () => {
    const { actions, history, store } = renderAccountRoute(realBackend.administrator);
    expect(await screen.findByText("A edição da conta não está disponível nesta versão."))
      .toBeInTheDocument();
    expect(screen.queryByLabelText("Nome:")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Salvar" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("link", { name: "Voltar ao início" }));
    expect(history.location.pathname).toBe("/menu");
    expect(store.getState().auth.token).toBe(realBackend.administrator.token);
    expect(actions).not.toContain("LOGIN_FAILURE");
  });

  test("não administrador permanece bloqueado pelo contexto real", async () => {
    api.defaults.headers.Authorization = `Bearer ${realBackend.nonAdministrator.token}`;
    renderAccountRoute(realBackend.nonAdministrator);
    expect(await screen.findByText("Você não tem acesso")).toBeInTheDocument();
    expect(screen.queryByLabelText("Nome:")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Recuperar senha" })).not.toBeInTheDocument();
  });

  test("recuperação autenticada retorna 202 real e mantém o token utilizável", async () => {
    const { actions, store } = renderAccountRoute(realBackend.administrator);
    fireEvent.click(await screen.findByRole("link", { name: "Recuperar senha" }));
    fireEvent.change(screen.getByLabelText("E-mail"), { target: { value: realBackend.administrator.user.email } });
    fireEvent.click(screen.getByRole("button", { name: "Enviar link" }));
    expect(await screen.findByRole("status")).toHaveTextContent("Se a conta estiver apta");
    expect(store.getState().auth.isLoggedIn).toBe(true);
    expect(actions).not.toContain("LOGIN_FAILURE");
    const response = await api.get("/team/authorization-context");
    expect(response.status).toBe(200);
    expect(response.data.is_administrator).toBe(true);
    expect(response.data.authorization_source).toBe("membership");
  });
});
