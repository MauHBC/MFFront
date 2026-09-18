/* eslint-env jest */
import "@testing-library/jest-dom";
import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { useSelector } from "react-redux";
import axios from "../services/axios";
import { CommercialProvider, useCommercial } from "./CommercialContext";

jest.mock("react-redux", () => ({ useSelector: jest.fn() }));
jest.mock("../services/axios", () => ({ get: jest.fn() }));
let auth;
function Probe() {
  const { status, data, refresh } = useCommercial();
  return <><output>{status}:{data?.state || ""}</output><button onClick={refresh} type="button">Atualizar</button></>;
}
const tree = () => <MemoryRouter><CommercialProvider><Probe /></CommercialProvider></MemoryRouter>;
beforeEach(() => {
  jest.clearAllMocks();
  auth = { isLoggedIn: true, token: "synthetic-token-a" };
  useSelector.mockImplementation((selector) => selector({ auth }));
});
test("falha comercial não concede acesso e permite repetir a consulta com token explícito", async () => {
  axios.get.mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce({ data: { state: "trial_expired" } });
  render(tree());
  await screen.findByText("error:");
  fireEvent.click(screen.getByRole("button", { name: "Atualizar" }));
  await screen.findByText("ready:trial_expired");
  expect(axios.get).toHaveBeenLastCalledWith("/commercial", { headers: { Authorization: "Bearer synthetic-token-a" } });
});
test("resposta anterior não substitui a Agenda após troca de token", async () => {
  let resolveOld;
  axios.get.mockImplementationOnce(() => new Promise((resolve) => { resolveOld = resolve; }))
    .mockResolvedValueOnce({ data: { state: "trial_expired" } });
  const view = render(tree());
  await waitFor(() => expect(axios.get).toHaveBeenCalledTimes(1));
  auth = { ...auth, token: "synthetic-token-b" };
  view.rerender(tree());
  await screen.findByText("ready:trial_expired");
  await act(async () => { resolveOld({ data: { state: "trial_active" } }); });
  expect(screen.getByText("ready:trial_expired")).toBeInTheDocument();
});
test("evento de expiração recarrega o estado sem remover a autenticação", async () => {
  axios.get.mockResolvedValueOnce({ data: { state: "trial_active" } })
    .mockResolvedValueOnce({ data: { state: "trial_expired" } });
  render(tree());
  await screen.findByText("ready:trial_active");
  act(() => { window.dispatchEvent(new Event("motria:commercial-access-changed")); });
  await screen.findByText("ready:trial_expired");
  expect(auth.isLoggedIn).toBe(true);
});
