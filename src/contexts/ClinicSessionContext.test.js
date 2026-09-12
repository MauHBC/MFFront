import React from "react";
import "@testing-library/jest-dom";
import {
  act, fireEvent, render, screen, waitFor,
} from "@testing-library/react";
import { Provider } from "react-redux";
import { combineReducers, createStore } from "redux";
import { toast } from "react-toastify";
import authReducer from "../store/modules/auth/reducer";
import axios from "../services/axios";
import history from "../services/history";
import {
  publishClinicSession,
  subscribeToClinicSession,
} from "../services/clinicSessionSync";
import { hasPendingMutationRequest } from "../services/requestActivity";
import {
  ClinicSessionProvider,
  useClinicSession,
} from "./ClinicSessionContext";
import { useClinicTransitionGuardRegistry } from "./ClinicTransitionGuardContext";

jest.mock("../services/axios", () => ({
  defaults: { headers: {} },
  get: jest.fn(),
  post: jest.fn(),
}));
jest.mock("react-toastify", () => ({
  toast: { error: jest.fn(), info: jest.fn() },
}));
jest.mock("../services/history", () => ({ replace: jest.fn() }));
jest.mock("../services/clinicSessionSync", () => ({
  publishClinicSession: jest.fn(),
  subscribeToClinicSession: jest.fn(),
}));
jest.mock("../services/requestActivity", () => ({
  hasPendingMutationRequest: jest.fn(),
  subscribeToMutationRequests: jest.fn(() => () => {}),
}));
jest.mock("./ClinicTransitionGuardContext", () => ({
  useClinicTransitionGuardRegistry: jest.fn(),
}));

const clinicSession = {
  authorization_source: "membership",
  active_membership_id: 10,
  active_clinic_id: 1,
  clinics: [
    { membership_id: 10, clinic_id: 1, clinic_name: "Norte" },
    { membership_id: 20, clinic_id: 2, clinic_name: "Sul" },
  ],
};

function Probe() {
  const value = useClinicSession();
  return (
    <div>
      <span data-testid="active">{value.session?.active_membership_id || "none"}</span>
      <span data-testid="switching">{String(value.switching)}</span>
      <button type="button" onClick={() => value.switchClinic(20)}>Trocar</button>
    </div>
  );
}

const renderProvider = () => {
  const store = createStore(combineReducers({ auth: authReducer }), {
    auth: {
      isLoggedIn: true,
      token: "token-norte",
      user: { id: 7, membership_id: 10 },
      isLoading: false,
      clinicSession,
      sessionRevision: 1,
    },
  });
  return {
    store,
    ...render(
      <Provider store={store}>
        <ClinicSessionProvider><Probe /></ClinicSessionProvider>
      </Provider>,
    ),
  };
};

describe("ClinicSessionContext", () => {
  let synchronizedListener;

  beforeEach(() => {
    jest.clearAllMocks();
    synchronizedListener = null;
    subscribeToClinicSession.mockImplementation((listener) => {
      synchronizedListener = listener;
      return () => {};
    });
    useClinicTransitionGuardRegistry.mockReturnValue({
      hasDirtyState: () => false,
      hasSavingState: () => false,
    });
    hasPendingMutationRequest.mockReturnValue(false);
    axios.get.mockResolvedValue({ data: clinicSession });
    window.confirm = jest.fn(() => true);
  });

  it("troca pelo membership, substitui a sessão e volta ao menu", async () => {
    const payload = {
      token: "token-sul",
      user: { id: 7, membership_id: 20 },
      clinic_session: { ...clinicSession, active_membership_id: 20, active_clinic_id: 2 },
    };
    axios.post.mockResolvedValue({ data: payload });
    const { store } = renderProvider();
    await waitFor(() => expect(axios.get).toHaveBeenCalledWith("/clinic-session"));

    fireEvent.click(screen.getByRole("button", { name: "Trocar" }));

    await waitFor(() => expect(axios.post).toHaveBeenCalledWith(
      "/clinic-session/active-membership",
      { membership_id: 20 },
    ));
    await waitFor(() => expect(store.getState().auth.token).toBe("token-sul"));
    expect(axios.defaults.headers.Authorization).toBe("Bearer token-sul");
    expect(history.replace).toHaveBeenCalledWith("/menu");
    expect(publishClinicSession).toHaveBeenCalledWith(payload);
  });

  it("bloqueia a troca enquanto há uma gravação pendente", async () => {
    hasPendingMutationRequest.mockReturnValue(true);
    renderProvider();
    await waitFor(() => expect(screen.getByTestId("active")).toHaveTextContent("10"));

    fireEvent.click(screen.getByRole("button", { name: "Trocar" }));

    expect(axios.post).not.toHaveBeenCalled();
    expect(toast.info).toHaveBeenCalledWith(
      "Aguarde o salvamento terminar antes de trocar de clínica.",
    );
  });

  it("respeita o cancelamento ao descartar alterações não salvas", async () => {
    useClinicTransitionGuardRegistry.mockReturnValue({
      hasDirtyState: () => true,
      hasSavingState: () => false,
    });
    window.confirm.mockReturnValue(false);
    renderProvider();
    await waitFor(() => expect(screen.getByTestId("active")).toHaveTextContent("10"));

    fireEvent.click(screen.getByRole("button", { name: "Trocar" }));

    expect(window.confirm).toHaveBeenCalled();
    expect(axios.post).not.toHaveBeenCalled();
  });

  it("aplica em outra aba somente uma sessão sincronizada válida", async () => {
    const payload = {
      token: "token-sul",
      user: { id: 7, membership_id: 20 },
      clinic_session: { ...clinicSession, active_membership_id: 20, active_clinic_id: 2 },
    };
    const { store } = renderProvider();
    await waitFor(() => expect(synchronizedListener).toEqual(expect.any(Function)));

    act(() => synchronizedListener(payload));

    expect(store.getState().auth.token).toBe("token-sul");
    expect(axios.defaults.headers.Authorization).toBe("Bearer token-sul");
    expect(history.replace).toHaveBeenCalledWith("/menu");
  });

  it("ignora uma sessão sincronizada pertencente a outra identidade", async () => {
    const { store } = renderProvider();
    await waitFor(() => expect(synchronizedListener).toEqual(expect.any(Function)));

    act(() => synchronizedListener({
      token: "token-alheio",
      user: { id: 99, clinic_id: 2, membership_id: 20 },
      clinic_session: {
        ...clinicSession,
        active_membership_id: 20,
        active_clinic_id: 2,
      },
    }));

    expect(store.getState().auth.token).toBe("token-norte");
    expect(history.replace).not.toHaveBeenCalled();
  });
});
