import { act, renderHook, waitFor } from "@testing-library/react";
import usePatientRights from "./usePatientRights";
import axios from "../../services/axios";

jest.mock("../../services/axios", () => ({ get: jest.fn() }));
beforeEach(() => jest.clearAllMocks());
test("queries only selected patients and ignores late results after switching or clearing", async () => {
  const pending = {};
  axios.get.mockImplementation((url) => new Promise((resolve) => { pending[url] = resolve; }));
  const { result, rerender } = renderHook(({ id }) => usePatientRights(id, true), { initialProps: { id: "" } });
  expect(axios.get).not.toHaveBeenCalled();
  rerender({ id: "1" });
  expect(result.current.status).toBe("loading");
  rerender({ id: "2" });
  await act(async () => pending["/patients/1/available-rights"]({ data: [] }));
  expect(result.current.status).toBe("loading");
  await act(async () => pending["/patients/2/available-rights"]({ data: [{ id: 2 }] }));
  expect(result.current.options).toEqual([{ id: 2 }]);
  rerender({ id: "3" }); rerender({ id: "" });
  await act(async () => pending["/patients/3/available-rights"]({ data: [] }));
  expect(result.current.status).toBe("idle");
});
test("invalid payload and network error fail closed; retry can resolve empty rights", async () => {
  axios.get.mockResolvedValueOnce({ data: {} }).mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce({ data: [] });
  const { result } = renderHook(() => usePatientRights("1", true));
  await waitFor(() => expect(result.current.status).toBe("error"));
  act(() => result.current.refresh());
  await waitFor(() => expect(result.current.status).toBe("error"));
  act(() => result.current.refresh());
  await waitFor(() => expect(result.current.status).toBe("ready"));
  expect(result.current.options).toEqual([]);
});
test("selecting the same patient again invalidates the previous empty result immediately", async () => {
  let resolve;
  axios.get.mockResolvedValueOnce({ data: [] }).mockImplementationOnce(() => new Promise((done) => { resolve = done; }));
  const { result, rerender } = renderHook(({ selection }) => usePatientRights("1", true, selection), {
    initialProps: { selection: 1 },
  });
  await waitFor(() => expect(result.current.status).toBe("ready"));
  rerender({ selection: 2 });
  expect(result.current.status).toBe("loading");
  await act(async () => resolve({ data: [{ id: 7 }] }));
  expect(result.current.options).toEqual([{ id: 7 }]);
});

test("joint consultation waits for replacement response and retries both after failure", async () => {
 let resolveCredits;
 axios.get.mockImplementation((url) => url.includes("available-rights") ? Promise.resolve({ data: [] }) : new Promise((resolve) => { resolveCredits = resolve; }));
 const { result } = renderHook(() => usePatientRights("20", true, 1, true));
 await act(async () => {});
 expect(result.current.status).toBe("loading");
 await act(async () => resolveCredits({ data: {} }));
 expect(result.current.status).toBe("error");
 expect(result.current.options).toEqual([]);
 axios.get.mockResolvedValue({ data: [] });
 act(() => result.current.refresh());
 await waitFor(() => expect(result.current.status).toBe("ready"));
 expect(axios.get).toHaveBeenCalledTimes(4);
});
test("late joint consultation after changing patient cannot restore previous credits", async () => {
 const pending = {};
 axios.get.mockImplementation((url, config) => new Promise((resolve) => { pending[url.includes("available-rights") ? url : `credits-${config.params.patient_id}`] = resolve; }));
 const { result, rerender } = renderHook(({ id }) => usePatientRights(id, true, 1, true), { initialProps: { id: "20" } });
 rerender({ id: "21" });
 await act(async () => { pending["/patients/21/available-rights"]({ data: [] }); pending["credits-21"]({ data: [] }); });
 expect(result.current.status).toBe("ready");
 await act(async () => { pending["/patients/20/available-rights"]({ data: [] }); pending["credits-20"]({ data: [{ id: 9, patient_id: 20, status: "pending", expires_at: "2099-01-01" }] }); });
 expect(result.current.replacements).toEqual([]);
});
