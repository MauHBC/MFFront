/* eslint-env jest */
import "@testing-library/jest-dom";
import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Switch } from "react-router-dom";
import { useSelector } from "react-redux";
import axios from "../../services/axios";
import { useCommercial } from "../../contexts/CommercialContext";
import Signup from "./Signup";
import Terms from "./Terms";
import Privacy from "./Privacy";
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
  await waitFor(() => expect(screen.getByRole("button", { name: "Confirmar e-mail para criar Agenda" })).toBeEnabled());
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
  expect(screen.getByRole("heading", { name: "Crie sua conta" })).toBeInTheDocument();
  expect(screen.getByLabelText("Nome")).toBeInTheDocument();
  expect(screen.getByLabelText("E-mail")).toBeInTheDocument();
  expect(screen.getByLabelText(/^Senha/)).toBeInTheDocument();
  expect(screen.getByText("Mínimo de 8 caracteres")).toBeInTheDocument();
  expect(screen.queryByText(/Entre 8 e 128 caracteres/)).not.toBeInTheDocument();
  expect(screen.getByLabelText(/^Senha/)).toHaveAttribute("minlength", "8");
  expect(screen.getByLabelText(/^Senha/)).toHaveAttribute("maxlength", "128");
  expect(screen.queryByText(/Confirme seu e-mail e receba uma Agenda vazia/)).not.toBeInTheDocument();
  expect(screen.queryByText(/Ambiente de revisão técnica/)).not.toBeInTheDocument();
  expect(screen.queryByText(/Usaremos sua conta autenticada/)).not.toBeInTheDocument();
  expect(screen.queryByText("Entrar na minha conta")).not.toBeInTheDocument();
  expect(screen.getByText(/Já tenho uma conta/)).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Ir para o login" })).toHaveAttribute("href", "/login");
  expect(screen.getByRole("checkbox")).not.toBeChecked();
  expect(screen.getByRole("link", { name: "Termos de Uso" })).toHaveAttribute("href", "/termos");
  expect(screen.getByRole("link", { name: "Política de Privacidade" })).toHaveAttribute("href", "/privacidade");
  expect(screen.queryByLabelText(/CREFITO|Telefone|Nome da Agenda|Profissão/)).not.toBeInTheDocument();
  act(() => { userEvent.click(screen.getByRole("button", { name: "Confirmar e-mail para criar Agenda" })); });
  expect(await screen.findByRole("alert")).toHaveTextContent("aceite");
  expect(axios.post).not.toHaveBeenCalled();
});
test.each([
  ["/termos", "Termos de Uso da Motria", 24,
    "Estes Termos de Uso regulam o cadastro, o teste gratuito, a contratação e a utilização da plataforma Motria.",
    "Endereço empresarial: Av. Paulista, 1471, CXPST 7703, Sala 1110, Bela Vista, São Paulo/SP, CEP 01311-927."],
  ["/privacidade", "Política de Privacidade da Motria", 16,
    "Esta Política de Privacidade explica como a MAURICIO HENRIQUE BORGES CORREA SOLUCOES EM TECNOLOGIA LTDA",
    "Encarregado pelo tratamento de dados: Maurício Henrique Borges Corrêa"],
])("%s publica o documento completo e volta ao cadastro", (path, title, headings, opening, ending) => {
  render(<MemoryRouter initialEntries={[path]}>
    <Switch>
      <Route exact path="/termos" component={Terms} />
      <Route exact path="/privacidade" component={Privacy} />
      <Route exact path="/cadastro" render={() => <div>Cadastro público</div>} />
    </Switch>
  </MemoryRouter>);
  expect(screen.getByRole("heading", { level: 1, name: title })).toBeInTheDocument();
  expect(screen.getByText("Última atualização: 2026-09-20")).toBeInTheDocument();
  expect(screen.getAllByRole("heading", { level: 2 })).toHaveLength(headings);
  expect(screen.getByRole("article")).toHaveTextContent(opening);
  expect(screen.getByRole("article")).toHaveTextContent(ending);
  expect(screen.queryByText(/Documento aguardando aprovação|placeholder|revisão técnica/i)).not.toBeInTheDocument();
  const back = screen.getByRole("link", { name: "Voltar ao cadastro" });
  expect(back).toHaveAttribute("href", "/cadastro");
  fireEvent.click(back);
  expect(screen.getByText("Cadastro público")).toBeInTheDocument();
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
test("conta autenticada sai de /cadastro para /menu sem montar o formulário ou provisionar", () => {
  useSelector.mockImplementation((selector) => selector({ auth: { isLoggedIn: true } }));
  useCommercial.mockReturnValue({ status: "ready", data: { managed: false,
    identity: { name: "Conta Existente", email: "existente@example.test" } }, refresh });
  render(<MemoryRouter initialEntries={["/cadastro"]}>
    <Switch>
      <Route exact path="/cadastro" component={Signup} />
      <Route exact path="/menu" render={() => <div>Menu autenticado</div>} />
    </Switch>
  </MemoryRouter>);
  expect(screen.getByText("Menu autenticado")).toBeInTheDocument();
  expect(screen.queryByRole("heading", { name: "Crie sua conta" })).not.toBeInTheDocument();
  expect(screen.queryByLabelText("Nome")).not.toBeInTheDocument();
  expect(screen.queryByLabelText(/^Senha/)).not.toBeInTheDocument();
  expect(axios.get).not.toHaveBeenCalled();
  expect(axios.post).not.toHaveBeenCalled();
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
test.each([["yes", true], ["no", false]])("orientação visível não bloqueia módulos: resposta %s", async (choice, answer) => {
  useCommercial.mockReturnValue({ data: active, refresh });
  wrap(<TrialPanel />);
  expect(screen.getByText("Complete as informações iniciais da Agenda").closest("details")).toHaveAttribute("open");
  act(() => { userEvent.type(screen.getByLabelText("Cidade"), "Curitiba"); });
  act(() => { userEvent.selectOptions(screen.getByLabelText("UF"), "PR"); });
  act(() => { userEvent.selectOptions(screen.getByLabelText("Você realiza atendimentos?"), choice); });
  act(() => { userEvent.click(screen.getByRole("button", { name: "Salvar informações" })); });
  await waitFor(() => expect(axios.post).toHaveBeenCalledWith("/commercial/orientation", { city: "Curitiba", state: "PR", performs_care: answer }));
  await waitFor(() => expect(refresh).toHaveBeenCalled());
});

test("preencher depois fecha somente a orientação, sem escrita ou alteração de acesso", () => {
  useCommercial.mockReturnValue({ data: active, refresh });
  const { container } = wrap(<TrialPanel />);
  fireEvent.click(screen.getByRole("button", { name: "Preencher depois" }));
  expect(screen.getByText("Complete as informações iniciais da Agenda").closest("details")).not.toHaveAttribute("open");
  expect(axios.post).not.toHaveBeenCalled();
  expect(screen.getByRole("link", { name: "Cadastrar primeiro paciente" })).toBeInTheDocument();
  expect(container).not.toHaveTextContent(/CEP|endereço completo|telefone|CREFITO/i);
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
