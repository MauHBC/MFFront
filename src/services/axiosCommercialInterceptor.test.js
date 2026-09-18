/* eslint-env jest */
import { createStore } from "redux";
import api, { setupAxiosInterceptors } from "./axios";
import authReducer from "../store/modules/auth/reducer";
import { loginSuccess } from "../store/modules/auth/actions";

jest.mock("react-toastify", () => ({ toast: { error: jest.fn() } }));

test("real Axios 403 commercial interceptor preserves Redux/session/token and does not navigate", async () => {
  const store = createStore((state, action) => ({ auth: authReducer(state?.auth, action) }));
  store.dispatch(loginSuccess({ token: "synthetic-local-token", user: { id: 1, name: "Titular" } }));
  const previous = store.getState();
  const persistor = { purge: jest.fn() };
  const history = { push: jest.fn() };
  const changed = jest.fn();
  window.addEventListener("motria:commercial-access-changed", changed);
  setupAxiosInterceptors({ store, persistor, history });
  api.defaults.headers.Authorization = "Bearer synthetic-local-token";
  try {
    await expect(api.get("/patients", { adapter: async (config) => {
      const error = new Error("Commercial denial");
      error.config = config;
      error.response = { status: 403, data: { error: "TRIAL_OPERATIONAL_ACCESS_EXPIRED" } };
      throw error;
    } })).rejects.toThrow("Commercial denial");
    expect(store.getState()).toEqual(previous);
    expect(api.defaults.headers.Authorization).toBe("Bearer synthetic-local-token");
    expect(persistor.purge).not.toHaveBeenCalled();
    expect(history.push).not.toHaveBeenCalled();
    expect(changed).toHaveBeenCalledTimes(1);
  } finally { window.removeEventListener("motria:commercial-access-changed", changed); }
});
