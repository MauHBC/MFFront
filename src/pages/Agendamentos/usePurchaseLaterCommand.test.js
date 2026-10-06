import { act, renderHook } from "@testing-library/react";
import usePurchaseLaterCommand from "./usePurchaseLaterCommand";
import axios from "../../services/axios";

jest.mock("../../services/axios", () => ({ post: jest.fn() }));
beforeEach(() => jest.clearAllMocks());
const body = { patient_id: 1, service_id: 2, quantity: 3, launch_notes: "Lançamento" };
const setup = () => {
  const callbacks = { onSuccess: jest.fn(), onError: jest.fn() };
  return { ...renderHook(() => usePurchaseLaterCommand(callbacks)), ...callbacks };
};
test("repeated definitive failure keeps the key; a changed command gets a new key", async () => {
  axios.post.mockRejectedValue({ response: { status: 400, data: { error: "Confira" } } });
  const { result } = setup();
  await act(async () => result.current.submit(body));
  const command = axios.post.mock.calls[0][1];
  await act(async () => result.current.submit(body));
  expect(axios.post.mock.calls[1][1]).toEqual(command);
  await act(async () => result.current.submit({ ...body, quantity: 2 }));
  expect(axios.post.mock.calls[2][1].idempotency_key).not.toBe(command.idempotency_key);
});
test("uncertain result rejects a changed command and verifies the original attempt", async () => {
  axios.post.mockRejectedValueOnce(new Error("Resposta perdida")).mockResolvedValueOnce({ data: { id: 7 } });
  const { result, onSuccess } = setup();
  await act(async () => result.current.submit(body));
  expect(result.current.uncertain).toBe(true);
  await act(async () => result.current.submit({ ...body, patient_id: 9 }));
  expect(axios.post).toHaveBeenCalledTimes(1);
  await act(async () => result.current.submit(body));
  expect(axios.post.mock.calls[1][1]).toEqual(axios.post.mock.calls[0][1]);
  expect(onSuccess).toHaveBeenCalledWith({ id: 7 });
});
test("double submit while saving issues one request", async () => {
  let resolve;
  axios.post.mockImplementation(() => new Promise((done) => { resolve = done; }));
  const { result } = setup();
  let pending;
  act(() => { pending = result.current.submit(body); });
  await act(async () => result.current.submit(body));
  expect(axios.post).toHaveBeenCalledTimes(1);
  await act(async () => { resolve({ data: {} }); await pending; });
});
