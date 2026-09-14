import React from "react";
import "@testing-library/jest-dom";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { createMemoryHistory } from "history";
import { Router } from "react-router-dom";
import { toast } from "react-toastify";

import axios from "../../services/axios";
import { useAuthorization } from "../../contexts/AuthorizationContext";
import {
  PENDING_CENTER_ACTION_STATE_KEY,
  PendingCenterDrawer,
  PendingCenterProvider,
  PendingCenterTrigger,
  usePendingCenter,
} from ".";

jest.mock("../../services/axios", () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    post: jest.fn(),
  },
  getUserFacingApiError: (error, fallback) => (
    error?.response?.data?.error === "CLINICAL_ACCESS_DENIED"
      ? "Você não tem autorização para realizar esta operação."
      : fallback
  ),
}));

jest.mock("../../contexts/AuthorizationContext", () => ({
  useAuthorization: jest.fn(),
}));

jest.mock("react-toastify", () => ({
  toast: {
    error: jest.fn(),
    isActive: jest.fn(),
    success: jest.fn(),
  },
}));

const authorizationContext = ({
  source = "membership",
  status = "ready",
  schedule = true,
} = {}) => ({
  status,
  context: status === "ready" ? {
    authorization_source: source,
    authorization_state: schedule ? "authorized" : "no_permissions",
  } : null,
  canAccessModule: jest.fn((moduleKey) => schedule && moduleKey === "schedule"),
});

function RefreshOperationalAlertsButton() {
  const { refreshOperationalAlerts } = usePendingCenter();
  return (
    <button type="button" onClick={() => refreshOperationalAlerts()}>
      Atualizar alertas
    </button>
  );
}

function renderPendingCenter({ withRefreshButton = false } = {}) {
  const history = createMemoryHistory({ initialEntries: ["/painel"] });
  const tree = () => (
    <Router history={history}>
      <PendingCenterProvider enabled>
        <PendingCenterTrigger />
        <PendingCenterDrawer />
        {withRefreshButton && <RefreshOperationalAlertsButton />}
      </PendingCenterProvider>
    </Router>
  );
  const result = render(tree());
  return { ...result, history, rerenderPendingCenter: () => result.rerender(tree()) };
}

function mockSources(alerts = [], sessions = []) {
  axios.get.mockImplementation((url) => {
    if (url === "/sessions") return Promise.resolve({ data: sessions });
    if (url === "/services") return Promise.resolve({ data: [] });
    if (url === "/operational-alerts") {
      return Promise.resolve({ data: { alerts } });
    }
    return Promise.resolve({ data: [] });
  });
}

const replacementAlert = (index) => ({
  type: "replacement_credit_pending",
  severity: "medium",
  patient_id: index + 1,
  patient_name: `Paciente ${index + 1}`,
  title: "Reposição pendente",
  status: "Pendente",
  due_date: "2026-09-30",
  suggested_action: "Agendar reposição",
  details: {
    replacement_credit_id: index + 100,
    source_service_id: 40,
    source_service_type: "physio",
    source_service_name: "Fisioterapia",
  },
});

beforeEach(() => {
  jest.clearAllMocks();
  useAuthorization.mockReturnValue(authorizationContext());
  toast.isActive.mockImplementation((toastId) => toast.error.mock.calls.some(
    ([, options]) => options?.toastId === toastId,
  ));
});

it("membership sem perfil não carrega recursos clínicos nem exibe a Central", async () => {
  useAuthorization.mockReturnValue(authorizationContext({ schedule: false }));
  mockSources();
  renderPendingCenter();

  await waitFor(() => expect(axios.get).not.toHaveBeenCalled());
  expect(screen.queryByTitle("Central de pendências")).not.toBeInTheDocument();
  expect(screen.queryByRole("heading", { name: "Central de pendências" }))
    .not.toBeInTheDocument();
  expect(toast.error).not.toHaveBeenCalled();
});

it("aguarda o contexto e carrega somente depois que Agenda está autorizada", async () => {
  useAuthorization.mockReturnValue(authorizationContext({ status: "loading", schedule: false }));
  mockSources();
  const { rerenderPendingCenter } = renderPendingCenter();

  expect(axios.get).not.toHaveBeenCalled();

  useAuthorization.mockReturnValue(authorizationContext({ schedule: true }));
  rerenderPendingCenter();

  await waitFor(() => {
    expect(axios.get.mock.calls.filter(([url]) => url === "/sessions")).toHaveLength(1);
    expect(axios.get.mock.calls.filter(([url]) => url === "/services")).toHaveLength(1);
    expect(axios.get.mock.calls.filter(([url]) => url === "/operational-alerts"))
      .toHaveLength(1);
  });
});

it("troca de contexto fecha a Central e recarrega apenas quando a nova permissão autoriza", async () => {
  mockSources();
  const { rerenderPendingCenter } = renderPendingCenter();

  await waitFor(() => expect(axios.get).toHaveBeenCalledTimes(3));
  expect(screen.getByTitle("Central de pendências")).toBeVisible();

  useAuthorization.mockReturnValue(authorizationContext({ status: "loading", schedule: false }));
  rerenderPendingCenter();
  expect(screen.queryByTitle("Central de pendências")).not.toBeInTheDocument();

  jest.clearAllMocks();
  mockSources();
  useAuthorization.mockReturnValue(authorizationContext({ schedule: true }));
  rerenderPendingCenter();

  await waitFor(() => expect(axios.get).toHaveBeenCalledTimes(3));
  expect(screen.getByTitle("Central de pendências")).toBeVisible();
});

it("ignora respostas e erros atrasados do contexto anterior", async () => {
  const pending = {};
  axios.get.mockImplementation((url) => new Promise((resolve, reject) => {
    pending[url] = { resolve, reject };
  }));
  const { rerenderPendingCenter } = renderPendingCenter();
  await waitFor(() => expect(axios.get).toHaveBeenCalledTimes(3));

  useAuthorization.mockReturnValue(authorizationContext({ status: "loading", schedule: false }));
  rerenderPendingCenter();

  await act(async () => {
    pending["/sessions"].reject({ response: { data: { error: "CLINICAL_ACCESS_DENIED" } } });
    pending["/operational-alerts"].reject({
      response: { data: { error: "CLINICAL_ACCESS_DENIED" } },
    });
    pending["/services"].resolve({ data: [{ id: 1 }] });
    await Promise.resolve();
  });

  expect(toast.error).not.toHaveBeenCalled();
  expect(screen.queryByTitle("Central de pendências")).not.toBeInTheDocument();
});

it("legacy autorizado preserva o carregamento da Central", async () => {
  useAuthorization.mockReturnValue(authorizationContext({ source: "legacy" }));
  mockSources();
  renderPendingCenter();

  await waitFor(() => expect(axios.get).toHaveBeenCalledTimes(3));
  expect(screen.getByTitle("Central de pendências")).toBeVisible();
});

it("deduplica falhas equivalentes e nunca exibe o código técnico", async () => {
  const denied = { response: { data: { error: "CLINICAL_ACCESS_DENIED" } } };
  axios.get.mockRejectedValue(denied);
  renderPendingCenter();

  await waitFor(() => expect(toast.error).toHaveBeenCalledTimes(1));
  expect(toast.error).toHaveBeenCalledWith(
    "Você não tem autorização para realizar esta operação.",
    { toastId: "pending-center-load-error" },
  );
  expect(toast.error).not.toHaveBeenCalledWith(
    "CLINICAL_ACCESS_DENIED",
    expect.anything(),
  );
});

it("mantém o sino visível sem pendências, sem badge, e abre o drawer existente", async () => {
  mockSources();
  renderPendingCenter();

  await waitFor(() => {
    expect(axios.get).toHaveBeenCalledWith(
      "/operational-alerts",
      expect.objectContaining({ params: expect.objectContaining({ month: expect.any(String) }) }),
    );
  });

  const trigger = screen.getByTitle("Central de pendências");
  expect(trigger).toBeVisible();
  expect(trigger.querySelector("span")).toBeNull();

  fireEvent.click(trigger);

  expect(trigger).toHaveAttribute("aria-expanded", "true");
  expect(screen.getByRole("heading", { name: "Central de pendências" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /Atendimentos pendentes.*0/ })).toBeDisabled();
  expect(screen.getByRole("button", { name: /Reposições pendentes.*0/ })).toBeDisabled();

  expect(axios.get.mock.calls.filter(([url]) => url === "/sessions")).toHaveLength(1);
  expect(axios.get.mock.calls.filter(([url]) => url === "/operational-alerts")).toHaveLength(1);
});

it("preserva o limite 99+ e encaminha o agendamento de reposição para a Agenda", async () => {
  mockSources(Array.from({ length: 100 }, (_, index) => replacementAlert(index)));
  const { history } = renderPendingCenter();

  expect(await screen.findByText("99+")).toBeInTheDocument();
  const trigger = screen.getByTitle("Central de pendências");
  expect(trigger).toHaveAttribute("aria-label", "Central de pendências. 100 pendências.");

  fireEvent.click(trigger);
  fireEvent.click(screen.getByRole("button", { name: /Reposições pendentes.*100/ }));
  fireEvent.click(screen.getAllByRole("button", { name: "Agendar reposição" })[0]);

  expect(history.location.pathname).toBe("/agendamentos");
  expect(history.location.state[PENDING_CENTER_ACTION_STATE_KEY]).toMatchObject({
    type: "schedule-replacement",
    alert: replacementAlert(0),
  });
});

it("refresh global atualiza imediatamente badge e lista de reposições", async () => {
  let operationalAlertRequests = 0;
  axios.get.mockImplementation((url) => {
    if (url === "/sessions") return Promise.resolve({ data: [] });
    if (url === "/services") return Promise.resolve({ data: [] });
    if (url === "/operational-alerts") {
      operationalAlertRequests += 1;
      return Promise.resolve({
        data: { alerts: operationalAlertRequests === 1 ? [] : [replacementAlert(0)] },
      });
    }
    return Promise.resolve({ data: [] });
  });
  renderPendingCenter({ withRefreshButton: true });

  const trigger = screen.getByTitle("Central de pendências");
  await waitFor(() => expect(trigger).toHaveAttribute(
    "aria-label",
    "Central de pendências. 0 pendências.",
  ));

  fireEvent.click(screen.getByRole("button", { name: "Atualizar alertas" }));

  await waitFor(() => expect(trigger).toHaveAttribute(
    "aria-label",
    "Central de pendências. 1 pendências.",
  ));
  fireEvent.click(trigger);
  expect(screen.getByRole("button", { name: /Reposições pendentes.*1/ })).toBeEnabled();
});
