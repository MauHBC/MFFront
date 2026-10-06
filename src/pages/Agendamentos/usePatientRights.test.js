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
