import React from "react";
import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import CancelAvailableRights from "./CancelAvailableRights";
import axios from "../../services/axios";

jest.mock("../../services/axios", () => ({ post: jest.fn() }));
const preview = { package_id: 7, eligible: true, available_count: 2, preserved_count: 1, preview_fingerprint: "snapshot" };
beforeEach(() => jest.clearAllMocks());
test("explicit preview preserves money and repeated interrupted confirmation reuses its command", async () => {
  const completed = jest.fn();
  axios.post.mockResolvedValueOnce({ data: preview }).mockRejectedValueOnce(new Error("Resposta perdida"))
    .mockResolvedValueOnce({ data: { package_id: 7, canceled_count: 2, replayed: true } });
  render(<CancelAvailableRights packageId={7} onCompleted={completed}/>);
  fireEvent.click(screen.getByRole("button", { name: "Cancelar unidades disponíveis" }));
  expect(screen.getByText(/cobranças abertas ou pagas permanecerão/)).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Motivo (opcional)"), { target: { value: "Encerrar restantes" } });
  fireEvent.click(screen.getByRole("button", { name: "Conferir unidades" }));
  await screen.findByText(/2 unidade\(s\) serão canceladas; 1 preservadas/);
  fireEvent.click(screen.getByRole("button", { name: "Confirmar cancelamento" }));
  await screen.findByRole("button", { name: "Verificar resultado" });
  expect(screen.getByLabelText("Motivo (opcional)")).toBeDisabled();
  expect(screen.getByRole("button", { name: "Voltar" })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Verificar resultado" }));
  await waitFor(() => expect(completed).toHaveBeenCalledTimes(1));
  expect(axios.post.mock.calls[2][1]).toEqual(axios.post.mock.calls[1][1]);
});
test("concurrent right changes invalidate preview and require a fresh review", async () => {
  axios.post.mockResolvedValueOnce({ data: preview }).mockRejectedValueOnce({ response: { data: { code: "PACKAGE_CANCEL_PREVIEW_STALE", error: "Confira novamente" } } });
  render(<CancelAvailableRights packageId={7} onCompleted={jest.fn()}/>);
  fireEvent.click(screen.getByRole("button", { name: "Cancelar unidades disponíveis" }));
  fireEvent.click(screen.getByRole("button", { name: "Conferir unidades" }));
  fireEvent.click(await screen.findByRole("button", { name: "Confirmar cancelamento" }));
  await screen.findByText("Confira novamente");
  expect(screen.getByRole("button", { name: "Conferir unidades" })).toBeEnabled();
});
