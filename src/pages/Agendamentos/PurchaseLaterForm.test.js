import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import PurchaseLaterForm from "./PurchaseLaterForm";
import axios from "../../services/axios";

jest.mock("../../services/axios", () => ({ post: jest.fn(), get: jest.fn(() => Promise.resolve({ data: [] })) }));
const props = { patients: [{ id: 1, full_name: "Paciente" }], services: [{ id: 2, name: "Fisioterapia" }],
  onSuccess: jest.fn(), onError: jest.fn() };
beforeEach(() => { jest.clearAllMocks(); axios.get.mockResolvedValue({ data: [] }); });
const fill = () => {
  fireEvent.change(screen.getByLabelText("Paciente"), { target: { value: "1" } });
  fireEvent.change(screen.getByLabelText("Tipo de atendimento"), { target: { value: "2" } });
};
test("launches all units without professional, session dates or copied session notes", async () => {
  axios.post.mockResolvedValue({ data: { id: 7 } });
  render(<PurchaseLaterForm {...props}/>); fill();
  fireEvent.change(screen.getByLabelText(/Quantidade/), { target: { value: "3" } });
  fireEvent.change(screen.getByLabelText(/Observação/), { target: { value: "Somente lançamento" } });
  fireEvent.click(screen.getByRole("button", { name: "Lançar e agendar depois" }));
  await waitFor(() => expect(props.onSuccess).toHaveBeenCalledWith({ id: 7 }));
  const body = axios.post.mock.calls[0][1];
  expect(body).toMatchObject({ patient_id: 1, service_id: 2, quantity: 3, launch_notes: "Somente lançamento" });
  expect(body).not.toHaveProperty("professional_user_id");
  expect(body).not.toHaveProperty("starts_at");
  expect(body).not.toHaveProperty("notes");
});
test("definite validation failure retries the same command and edited form creates a new key", async () => {
  axios.post.mockRejectedValue({ response: { status: 400, data: { error: "Confira os campos" } } });
  render(<PurchaseLaterForm {...props}/>); fill();
  const submit = () => fireEvent.click(screen.getByRole("button", { name: "Lançar e agendar depois" }));
  submit(); await waitFor(() => expect(props.onError).toHaveBeenCalledTimes(1));
  const key = axios.post.mock.calls[0][1].idempotency_key;
  submit(); await waitFor(() => expect(props.onError).toHaveBeenCalledTimes(2));
  expect(axios.post.mock.calls[1][1].idempotency_key).toBe(key);
  fireEvent.change(screen.getByLabelText(/Quantidade/), { target: { value: "2" } });
  submit(); await waitFor(() => expect(props.onError).toHaveBeenCalledTimes(3));
  expect(axios.post.mock.calls[2][1].idempotency_key).not.toBe(key);
});

test("uncertain launch freezes editing and verifies the same key", async () => {
  axios.post.mockRejectedValueOnce(new Error("Resposta perdida")).mockResolvedValueOnce({ data: { id: 7 } });
  const onPendingChange = jest.fn();
  render(<PurchaseLaterForm {...props} onPendingChange={onPendingChange}/>); fill();
  fireEvent.click(screen.getByRole("button", { name: "Lançar e agendar depois" }));
  await screen.findByRole("button", { name: "Verificar lançamento" });
  expect(screen.getByLabelText("Paciente").closest("fieldset").disabled).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Verificar lançamento" }));
  await waitFor(() => expect(props.onSuccess).toHaveBeenCalledTimes(1));
  expect(axios.post.mock.calls[1][1]).toEqual(axios.post.mock.calls[0][1]);
  expect(onPendingChange).toHaveBeenLastCalledWith(false);
});
