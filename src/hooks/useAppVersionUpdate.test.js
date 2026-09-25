/* eslint-env jest */
import { act, renderHook } from "@testing-library/react";
import useAppVersionUpdate from "./useAppVersionUpdate";
import { fetchAppVersion, getLoadedAppVersionId, getAppVersionId } from "../services/appVersion";

let mockLocation = { pathname: "/financeiro", search: "" };
jest.mock("react-router-dom", () => ({ useLocation: () => mockLocation }));
jest.mock("../services/appVersion", () => ({
  APP_VERSION_CHECK_THROTTLE_MS: 15 * 60 * 1000,
  fetchAppVersion: jest.fn(), getLoadedAppVersionId: jest.fn(), getAppVersionId: jest.fn(),
}));
const originalLocation = window.location;
beforeEach(() => {
  jest.useFakeTimers(); jest.clearAllMocks();
  delete window.location;
  window.location = { pathname: "/financeiro", reload: jest.fn() };
  mockLocation = { pathname: "/financeiro", search: "" };
  getLoadedAppVersionId.mockReturnValue("old-assets");
  getAppVersionId.mockImplementation((value) => value.version);
  fetchAppVersion.mockResolvedValue({ version: "old-assets" });
});
afterEach(() => { jest.useRealTimers(); window.location = originalLocation; });
const flush = async () => { await act(async () => {}); };

test("checks on mount/events/navigation with 15-minute throttle, not periodic polling", async () => {
  const hook = renderHook(() => useAppVersionUpdate()); await flush();
  expect(fetchAppVersion).toHaveBeenCalledTimes(1);
  act(() => window.dispatchEvent(new Event("focus"))); await flush();
  expect(fetchAppVersion).toHaveBeenCalledTimes(1);
  act(() => jest.advanceTimersByTime(16 * 60 * 1000)); await flush();
  expect(fetchAppVersion).toHaveBeenCalledTimes(1);
  act(() => window.dispatchEvent(new Event("online"))); await flush();
  expect(fetchAppVersion).toHaveBeenCalledTimes(2);
  act(() => jest.advanceTimersByTime(16 * 60 * 1000));
  mockLocation = { pathname: "/pacientes", search: "" }; hook.rerender(); await flush();
  expect(fetchAppVersion).toHaveBeenCalledTimes(3);
  expect(window.location.reload).not.toHaveBeenCalled();
});

test("new version waits for financial modal and focused edit; does not submit anything", async () => {
  const modal = document.createElement("div"); modal.setAttribute("role", "dialog");
  const input = document.createElement("input"); modal.append(input); document.body.append(modal); input.focus();
  fetchAppVersion.mockResolvedValue({ version: "new-assets" });
  renderHook(() => useAppVersionUpdate()); await flush();
  expect(window.location.reload).not.toHaveBeenCalled();
  input.blur(); act(() => jest.runOnlyPendingTimers());
  expect(window.location.reload).not.toHaveBeenCalled();
  modal.remove();
  expect(window.location.reload).not.toHaveBeenCalled();
  act(() => window.dispatchEvent(new Event("focus"))); await flush();
  expect(window.location.reload).toHaveBeenCalledTimes(1);
  expect(fetchAppVersion).toHaveBeenCalledTimes(1);
});

test("sensitive path postpones reload until safe navigation", async () => {
  mockLocation = { pathname: "/pacientes/novo", search: "" };
  fetchAppVersion.mockResolvedValue({ version: "new-assets" });
  const hook = renderHook(() => useAppVersionUpdate()); await flush();
  expect(window.location.reload).not.toHaveBeenCalled();
  mockLocation = { pathname: "/financeiro", search: "" }; hook.rerender(); await flush();
  expect(window.location.reload).toHaveBeenCalledTimes(1);
});
