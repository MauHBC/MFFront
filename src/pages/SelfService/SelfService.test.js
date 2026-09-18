/* eslint-env jest */
import "@testing-library/jest-dom";
import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { useSelector } from "react-redux";
import axios from "../../services/axios";
import { useCommercial } from "../../contexts/CommercialContext";
import Signup from "./Signup";
import Confirmation from "./Confirmation";
import TrialPanel, { TrialIndicator } from "./TrialPanel";
import CommercialBoundary from "./CommercialBoundary";
import Commercial from "./Commercial";

jest.mock("react-redux", () => ({ useSelector: jest.fn() }));
jest.mock("../../services/axios", () => ({ get: jest.fn(), post: jest.fn() }));
jest.mock("../../contexts/CommercialContext", () => ({ useCommercial: jest.fn() }));
jest.mock("../../components/AppShell", () => ({ children }) => <div aria-label="Shell com seletor de Agenda">{children}</div>);
const legal = { terms_version: "draft-terms.v1", privacy_version: "draft-privacy.v1",
  legal_ready: false, terms_url: "/termos", privacy_url: "/privacidade" };
const refresh = jest.fn();
const active = {
  managed: true, state: "trial_active", owner: true, remaining_days: 10,
  ends_at: "2026-09-28T12:00:00Z", retention_ends_at: "2026-12-27T12:00:00Z",
  timezone: "America/Sao_Paulo", data_actions_available: true,
  orientation: { completed: false },
  milestones: { services: false, patients: false, sessions: false, completed: 0, total: 3 },
};
const wrap = (component) => render(<MemoryRouter>{component}</MemoryRouter>);
beforeEach(() => {
  jest.clearAllMocks();
  window.history.replaceState({}, "", "/");
  useSelector.mockImplementation((selector) => selector({ auth: { isLoggedIn: false } }));
  useCommercial.mockReturnValue({ status: "ready", data: { managed: false }, refresh });
  axios.get.mockResolvedValue({ data: legal });
  axios.post.mockResolvedValue({ data: { accepted: true } });
});
const fill = async () => {
  await screen.findByText("Ambiente de revisão técnica: os documentos legais ainda aguardam aprovação para abertura comercial.");
  act(() => { userEvent.type(screen.getByLabelText("Nome"), "Pessoa de Teste"); });
  act(() => { userEvent.type(screen.getByLabelText("E-mail"), "pessoa@example.test"); });
  act(() => { userEvent.type(screen.getByLabelText(/^Senha/), "SenhaForteTeste!28"); });
};
test("confirmação distingue bloqueio jurídico de falha temporária de provisionamento", async () => {
  window.history.replaceState({}, "", "/confirmar-email#token=synthetic-proof");
  axios.post.mockRejectedValueOnce({ response: { status: 503, data: { error: "SELF_SERVICE_LEGAL_NOT_APPROVED" } } });
  wrap(<Confirmation />);
  fireEvent.click(screen.getByRole("button", { name: "Confirmar e criar minha Agenda" }));
  await screen.findByRole("heading", { name: "Cadastro em revisão" });
  expect(screen.getByRole("alert")).toHaveTextContent("documentos legais aprovados");
  expect(screen.queryByRole("button", { name: "Tentar novamente" })).not.toBeInTheDocument();
});
test("cadastro começa sem aceite e contém somente nome, e-mail e senha, com links legais", async () => {
  wrap(<Signup />);
  await fill();
  expect(screen.getByRole("checkbox")).not.toBeChecked();
  expect(screen.getByRole("link", { name: "Termos de Uso" })).toHaveAttribute("href", "/termos");
  expect(screen.getByRole("link", { name: "Política de Privacidade" })).toHaveAttribute("href", "/privacidade");
  expect(screen.queryByLabelText(/CREFITO|Telefone|Nome da Agenda|Profissão/)).not.toBeInTheDocument();
  act(() => { userEvent.click(screen.getByRole("button", { name: "Confirmar e-mail para criar Agenda" })); });
  expect(await screen.findByRole("alert")).toHaveTextContent("aceite");
  expect(axios.post).not.toHaveBeenCalled();
});
test("teclado em viewport móvel envia as versões e impede duplo envio durante loading", async () => {
  Object.defineProperty(window, "innerWidth", { configurable: true, value: 375 });
  let resolve;
  axios.post.mockReturnValue(new Promise((done) => { resolve = done; }));
  wrap(<Signup />);
  await fill();
  screen.getByLabelText(/^Senha/).focus();
  act(() => { userEvent.tab(); }); // Checkbox obrigatório.
  expect(screen.getByRole("checkbox")).toHaveFocus();
  act(() => { userEvent.keyboard(" "); });
  expect(screen.getByRole("checkbox")).toBeChecked();
  act(() => { userEvent.click(screen.getByRole("button", { name: "Confirmar e-mail para criar Agenda" })); });
  expect(screen.getByRole("button", { name: "Enviando…" })).toBeDisabled();
  expect(axios.post).toHaveBeenCalledTimes(1);
  expect(axios.post).toHaveBeenCalledWith("/public/self-service/registrations", expect.objectContaining({
    legal_accepted: true, terms_version: legal.terms_version, privacy_version: legal.privacy_version,
    name: "Pessoa de Teste", email: "pessoa@example.test",
  }));
  await act(async () => resolve({ data: { accepted: true } }));
  expect(await screen.findByRole("heading", { name: "Confira seu e-mail" })).toBeInTheDocument();
  expect(screen.queryByLabelText(/^Senha/)).not.toBeInTheDocument();
  expect(screen.getByText(/Se já possui uma conta/)).toBeInTheDocument();
});
test("falha de metadados permite retry e falha de submissão mantém formulário para correção", async () => {
  axios.get.mockRejectedValueOnce(new Error("offline"));
  wrap(<Signup />);
  const retry = await screen.findByRole("button", { name: "Tentar novamente" });
  act(() => { userEvent.click(retry); });
  await fill();
  act(() => { userEvent.click(screen.getByRole("checkbox")); });
  axios.post.mockRejectedValueOnce({ response: { status: 400, data: { error: "PASSWORD_COMMON_OR_COMPROMISED" } } });
  act(() => { userEvent.click(screen.getByRole("button", { name: "Confirmar e-mail para criar Agenda" })); });
  expect(await screen.findByRole("alert")).toHaveTextContent("menos comum");
  expect(screen.getByLabelText("Nome")).toHaveValue("Pessoa de Teste");
});
test("conta autenticada usa identidade canônica e não transmite senha nova", async () => {
  useSelector.mockImplementation((selector) => selector({ auth: { isLoggedIn: true } }));
  useCommercial.mockReturnValue({ status: "ready", data: { managed: false,
    identity: { name: "Conta Existente", email: "existente@example.test" } }, refresh });
  wrap(<Signup />);
  await screen.findByText(/Ambiente de revisão técnica/);
  expect(screen.getByLabelText("Nome")).toHaveValue("Conta Existente");
  expect(screen.queryByLabelText(/^Senha/)).not.toBeInTheDocument();
  act(() => { userEvent.click(screen.getByRole("checkbox")); });
  act(() => { userEvent.click(screen.getByRole("button", { name: "Confirmar e-mail para criar Agenda" })); });
  await screen.findByRole("heading", { name: "Confira seu e-mail" });
  expect(axios.post.mock.calls[0][0]).toBe("/commercial/registrations");
  expect(axios.post.mock.calls[0][1]).not.toHaveProperty("password");
});
test("confirmação remove bearer do histórico, exige ação e recupera falha de provisionamento", async () => {
  window.history.replaceState({}, "", "/confirmar-email#token=confirmation-test");
  axios.post.mockRejectedValueOnce({ response: { status: 503, data: { error: "AGENDA_PROVISIONING_RETRYABLE" } } });
  wrap(<Confirmation />);
  expect(window.location.hash).toBe("");
  expect(axios.post).not.toHaveBeenCalled();
  act(() => { userEvent.click(screen.getByRole("button", { name: "Confirmar e criar minha Agenda" })); });
  expect(await screen.findByRole("heading", { name: "Ainda estamos preparando sua Agenda" })).toBeInTheDocument();
  act(() => { userEvent.click(screen.getByRole("button", { name: "Tentar novamente" })); });
  expect(await screen.findByRole("heading", { name: "Sua Agenda está pronta" })).toBeInTheDocument();
  expect(axios.post.mock.calls.every((call) => call[1].token === "confirmation-test")).toBe(true);
});
test("link expirado permite solicitar novo link sem refazer o cadastro", async () => {
  window.history.replaceState({}, "", "/confirmar-email#token=expired-test");
  axios.post.mockRejectedValueOnce({ response: { status: 410, data: { error: "CONFIRMATION_LINK_EXPIRED" } } });
  wrap(<Confirmation />);
  act(() => { userEvent.click(screen.getByRole("button", { name: "Confirmar e criar minha Agenda" })); });
  await screen.findByRole("heading", { name: "Este link expirou" });
  act(() => { userEvent.type(screen.getByLabelText("E-mail do cadastro"), "pessoa@example.test"); });
  act(() => { userEvent.click(screen.getByRole("button", { name: "Solicitar novo link" })); });
  await waitFor(() => expect(axios.post).toHaveBeenLastCalledWith("/public/self-service/resend", { email: "pessoa@example.test" }));
});
test("checklist usa os marcos do servidor, é recolhível e desaparece em 3/3", () => {
  useCommercial.mockReturnValue({ data: active, refresh });
  const view = wrap(<TrialPanel />);
  const summary = screen.getByText("Comece por aqui · 0/3");
  expect(summary.closest("details")).toHaveAttribute("open");
  fireEvent.click(summary);
  expect(screen.getByRole("link", { name: "Criar primeiro serviço" })).toHaveAttribute("href", "/planos?tab=services");
  useCommercial.mockReturnValue({ data: { ...active, milestones: { ...active.milestones, completed: 3 } }, refresh });
  view.rerender(<MemoryRouter><TrialPanel /></MemoryRouter>);
  expect(screen.queryByText(/Comece por aqui/)).not.toBeInTheDocument();
});
test("orientação não bloqueia módulos e resposta não é usada para decidir acesso", async () => {
  useCommercial.mockReturnValue({ data: active, refresh });
  wrap(<TrialPanel />);
  act(() => { userEvent.type(screen.getByLabelText("Cidade"), "Curitiba"); });
  act(() => { userEvent.selectOptions(screen.getByLabelText("UF"), "PR"); });
  act(() => { userEvent.selectOptions(screen.getByLabelText("Você realiza atendimentos?"), "no"); });
  act(() => { userEvent.click(screen.getByRole("button", { name: "Salvar informações" })); });
  await waitFor(() => expect(axios.post).toHaveBeenCalledWith("/commercial/orientation", { city: "Curitiba", state: "PR", performs_care: false }));
  await waitFor(() => expect(refresh).toHaveBeenCalled());
});
test("indicador usa datas no fuso da Agenda e destaca os últimos três dias", () => {
  useCommercial.mockReturnValue({ data: { ...active, remaining_days: 3 }, refresh });
  wrap(<TrialIndicator />);
  expect(screen.getByRole("link")).toHaveAttribute("data-urgent", "true");
  expect(screen.getByRole("link")).toHaveTextContent("28 de setembro de 2026");
  expect(screen.getByRole("link")).toHaveTextContent("09:00");
});
test("expiração impede montagem de módulo, preserva shell e não promete checkout", () => {
  useSelector.mockImplementation((selector) => selector({ auth: { isLoggedIn: true } }));
  useCommercial.mockReturnValue({ status: "ready", data: { ...active, state: "trial_expired" }, refresh });
  const moduleMount = jest.fn(() => <p>Módulo operacional</p>);
  const Module = moduleMount;
  wrap(<CommercialBoundary><Module /></CommercialBoundary>);
  expect(moduleMount).not.toHaveBeenCalled();
  expect(screen.getByRole("heading", { name: "Seu teste gratuito terminou" })).toBeInTheDocument();
  expect(screen.getByText(/Nenhuma cobrança automática/)).toBeInTheDocument();
});
test("somente titular vê ações e exclusão exige confirmação da solicitação", async () => {
  useCommercial.mockReturnValue({ data: { ...active, state: "trial_expired" }, refresh });
  wrap(<Commercial />);
  act(() => { userEvent.click(screen.getByRole("button", { name: "Solicitar exclusão dos dados" })); });
  expect(axios.post).not.toHaveBeenCalled();
  act(() => { userEvent.click(screen.getByRole("button", { name: "Confirmar solicitação de exclusão" })); });
  await waitFor(() => expect(axios.post).toHaveBeenCalledWith("/commercial/data-requests", { action: "deletion" }));
});
