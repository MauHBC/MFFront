/* eslint-env jest */
import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route } from "react-router-dom";

import SchedulingEvents from "./index";
import { usePendingCenter } from "../../components/PendingCenter";
import {
  createSpecialSchedulingEvent,
  getUnitSchedulingPolicy,
  listSpecialSchedulingEvents,
  updateSpecialSchedulingEvent,
} from "../../services/scheduling";

jest.mock("../../components/AppShell", () => function AppShellMock({ children }) {
  return <div>{children}</div>;
});

jest.mock("../../components/PendingCenter", () => ({
  usePendingCenter: jest.fn(),
}));

jest.mock("react-toastify", () => ({
  toast: {
    error: jest.fn(),
    success: jest.fn(),
    warning: jest.fn(),
  },
}));

jest.mock("../../services/axios", () => ({
  getUserFacingApiError: jest.fn((error, fallback) => error?.response?.data?.error || fallback),
}));

jest.mock("../../services/scheduling", () => ({
  createSpecialSchedulingEvent: jest.fn(),
  getUnitSchedulingPolicy: jest.fn(),
  inactivateSpecialSchedulingEvent: jest.fn(),
  listSpecialSchedulingEvents: jest.fn(),
  updateUnitSchedulingPolicy: jest.fn(),
  updateSpecialSchedulingEvent: jest.fn(),
}));

const holiday = {
  id: 41,
  name: "Feriado local",
  source_type: "national",
  start_date: "2035-04-04",
  end_date: "2035-04-04",
  behavior_type: "INFO",
  affects_scheduling: false,
};

const preview = {
  error: "Existem 14 atendimentos agendados neste dia.",
  requires_confirmation: true,
  can_confirm: true,
  cancelable_sessions_count: 14,
  blocking_sessions_count: 0,
  confirmation_message: "Ao bloquear a agenda, os atendimentos agendados serão cancelados. Sessões avulsas e de pacote continuarão disponíveis para remarcação.",
  impact_confirmation_token: "preview-token-14",
  event_date: holiday.start_date,
};

const conflict = (data) => ({ response: { status: 409, data } });
const refreshOperationalAlerts = jest.fn();

const renderPage = () => render(
  <MemoryRouter initialEntries={["/configuracoes/agenda"]}>
    <Route exact path="/configuracoes/agenda">
      <SchedulingEvents />
    </Route>
    <Route
      path="/agendamentos"
      render={({ location }) => <div data-testid="agenda-location">{location.search}</div>}
    />
  </MemoryRouter>,
);

beforeEach(() => {
  jest.clearAllMocks();
  usePendingCenter.mockReturnValue({ refreshOperationalAlerts });
  refreshOperationalAlerts.mockResolvedValue(undefined);
  listSpecialSchedulingEvents.mockResolvedValue({ data: [holiday] });
  getUnitSchedulingPolicy.mockResolvedValue({ data: {} });
  updateSpecialSchedulingEvent.mockResolvedValue({ data: {} });
  createSpecialSchedulingEvent.mockResolvedValue({ data: {} });
});

test("bloqueio posterior confirma no único dialog com o token autoritativo", async () => {
  updateSpecialSchedulingEvent
    .mockRejectedValueOnce(conflict(preview))
    .mockResolvedValueOnce({ data: { auto_canceled_sessions: 14 } });
  renderPage();

  expect(screen.queryByRole("link", { name: "Voltar" })).not.toBeInTheDocument();
  fireEvent.click(await screen.findByRole("button", { name: "Bloquear agenda" }));

  expect(await screen.findByRole("dialog")).toHaveTextContent("Bloquear agenda neste dia?");
  expect(screen.getAllByRole("dialog")).toHaveLength(1);
  expect(screen.getByText("14 atendimentos serão cancelados")).toBeInTheDocument();
  expect(screen.queryByText(/Sessões avulsas e de pacote continuarão disponíveis/))
    .not.toBeInTheDocument();
  expect(within(screen.getByRole("dialog")).getByRole("button", { name: "Cancelar" }))
    .toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Revisar agenda" })).toBeInTheDocument();
  fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", {
    name: "Bloquear agenda",
  }));

  await waitFor(() => expect(updateSpecialSchedulingEvent).toHaveBeenLastCalledWith(41, {
    behavior_type: "BLOCK",
    affects_scheduling: true,
    confirm_cancel_sessions: true,
    impact_confirmation_token: "preview-token-14",
  }));
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  expect(refreshOperationalAlerts).toHaveBeenCalledTimes(1);
});

test("409 de impacto troca o conteúdo do mesmo dialog sem abrir outro", async () => {
  createSpecialSchedulingEvent.mockRejectedValueOnce(conflict({
    ...preview,
    cancelable_sessions_count: 2,
  }));
  renderPage();

  fireEvent.click(await screen.findByRole("button", { name: "Novo feriado" }));
  const formDialog = screen.getByRole("dialog");
  fireEvent.change(screen.getByLabelText("Nome"), { target: { value: "Feriado novo" } });
  fireEvent.change(screen.getByLabelText("Data"), { target: { value: "2035-05-01" } });
  fireEvent.click(screen.getByRole("button", { name: "Adicionar feriado" }));

  expect(await screen.findByText("2 atendimentos serão cancelados")).toBeInTheDocument();
  expect(screen.getByRole("dialog")).toBe(formDialog);
  expect(screen.getAllByRole("dialog")).toHaveLength(1);
  expect(screen.queryByLabelText("Nome")).not.toBeInTheDocument();
});

test("Cancelar restaura o formulário com todos os valores preservados", async () => {
  createSpecialSchedulingEvent.mockRejectedValueOnce(conflict(preview));
  renderPage();

  fireEvent.click(await screen.findByRole("button", { name: "Novo feriado" }));
  fireEvent.change(screen.getByLabelText("Nome"), { target: { value: "Aniversário local" } });
  fireEvent.change(screen.getByLabelText("Data"), { target: { value: "2035-05-01" } });
  fireEvent.change(screen.getByLabelText("Tipo"), { target: { value: "city" } });
  fireEvent.change(screen.getByLabelText("UF"), { target: { value: "ES" } });
  fireEvent.change(screen.getByLabelText("Cidade"), { target: { value: "Vitória" } });
  fireEvent.click(screen.getByRole("button", { name: "Adicionar feriado" }));

  fireEvent.click(await screen.findByRole("button", { name: "Cancelar" }));

  expect(screen.getByRole("dialog")).toHaveTextContent("Novo feriado");
  expect(screen.getAllByRole("dialog")).toHaveLength(1);
  expect(screen.getByLabelText("Nome")).toHaveValue("Aniversário local");
  expect(screen.getByLabelText("Data")).toHaveValue("2035-05-01");
  expect(screen.getByLabelText("Tipo")).toHaveValue("city");
  expect(screen.getByLabelText("UF")).toHaveValue("ES");
  expect(screen.getByLabelText("Cidade")).toHaveValue("Vitória");
  expect(screen.getByLabelText("Funcionamento da clínica")).toHaveValue("block");
  expect(refreshOperationalAlerts).not.toHaveBeenCalled();
});

test("criação confirmada reutiliza o payload e o token existentes", async () => {
  createSpecialSchedulingEvent
    .mockRejectedValueOnce(conflict({ ...preview, cancelable_sessions_count: 2 }))
    .mockResolvedValueOnce({ data: { auto_canceled_sessions: 2 } });
  renderPage();

  fireEvent.click(await screen.findByRole("button", { name: "Novo feriado" }));
  fireEvent.change(screen.getByLabelText("Nome"), { target: { value: "Feriado novo" } });
  fireEvent.change(screen.getByLabelText("Data"), { target: { value: "2035-05-01" } });
  fireEvent.click(screen.getByRole("button", { name: "Adicionar feriado" }));
  await screen.findByRole("heading", { name: "Bloquear agenda neste dia?" });
  fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", {
    name: "Bloquear agenda",
  }));

  await waitFor(() => expect(createSpecialSchedulingEvent).toHaveBeenLastCalledWith(
    expect.objectContaining({
      name: "Feriado novo",
      start_date: "2035-05-01",
      behavior_type: "BLOCK",
      affects_scheduling: true,
      confirm_cancel_sessions: true,
      impact_confirmation_token: "preview-token-14",
    }),
  ));
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  expect(refreshOperationalAlerts).toHaveBeenCalledTimes(1);
});

test("falha na confirmação não atualiza alertas operacionais", async () => {
  createSpecialSchedulingEvent
    .mockRejectedValueOnce(conflict(preview))
    .mockRejectedValueOnce({ response: { status: 500, data: { error: "Falha ao bloquear" } } });
  renderPage();

  fireEvent.click(await screen.findByRole("button", { name: "Novo feriado" }));
  fireEvent.change(screen.getByLabelText("Nome"), { target: { value: "Feriado novo" } });
  fireEvent.change(screen.getByLabelText("Data"), { target: { value: "2035-05-01" } });
  fireEvent.click(screen.getByRole("button", { name: "Adicionar feriado" }));
  await screen.findByRole("heading", { name: "Bloquear agenda neste dia?" });
  fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", {
    name: "Bloquear agenda",
  }));

  await waitFor(() => expect(createSpecialSchedulingEvent).toHaveBeenCalledTimes(2));
  expect(refreshOperationalAlerts).not.toHaveBeenCalled();
  expect(screen.getByRole("dialog")).toBeInTheDocument();
});

test("token invalidado atualiza a contagem e a confirmação no mesmo dialog", async () => {
  createSpecialSchedulingEvent
    .mockRejectedValueOnce(conflict({
      ...preview,
      cancelable_sessions_count: 7,
      impact_confirmation_token: "preview-token-7",
    }))
    .mockRejectedValueOnce(conflict({
      ...preview,
      cancelable_sessions_count: 9,
      impact_confirmation_token: "preview-token-9",
    }))
    .mockResolvedValueOnce({ data: { auto_canceled_sessions: 9 } });
  renderPage();

  fireEvent.click(await screen.findByRole("button", { name: "Novo feriado" }));
  const dialog = screen.getByRole("dialog");
  fireEvent.change(screen.getByLabelText("Nome"), { target: { value: "Feriado móvel" } });
  fireEvent.change(screen.getByLabelText("Data"), { target: { value: "2035-06-12" } });
  fireEvent.click(screen.getByRole("button", { name: "Adicionar feriado" }));
  await screen.findByRole("heading", { name: "Bloquear agenda neste dia?" });
  fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", {
    name: "Bloquear agenda",
  }));

  expect(await screen.findByText("9 atendimentos serão cancelados")).toBeInTheDocument();
  expect(screen.getByRole("dialog")).toBe(dialog);
  expect(screen.getAllByRole("dialog")).toHaveLength(1);
  fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", {
    name: "Bloquear agenda",
  }));

  await waitFor(() => expect(createSpecialSchedulingEvent).toHaveBeenLastCalledWith(
    expect.objectContaining({
      confirm_cancel_sessions: true,
      impact_confirmation_token: "preview-token-9",
    }),
  ));
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
});

test("bloqueadores ficam no mesmo dialog sem ação de cancelamento e revisão mantém a data", async () => {
  createSpecialSchedulingEvent.mockRejectedValueOnce(conflict({
    ...preview,
    error: "Existem atendimentos realizados que impedem o bloqueio da agenda.",
    requires_confirmation: false,
    can_confirm: false,
    cancelable_sessions_count: 0,
    blocking_sessions_count: 1,
    blocking_reasons: [{
      code: "SESSION_DONE",
      message: "Atendimento já realizado.",
      count: 1,
    }],
  }));
  renderPage();

  fireEvent.click(await screen.findByRole("button", { name: "Novo feriado" }));
  const dialog = screen.getByRole("dialog");
  fireEvent.change(screen.getByLabelText("Nome"), { target: { value: "Feriado bloqueado" } });
  fireEvent.change(screen.getByLabelText("Data"), { target: { value: "2035-05-01" } });
  fireEvent.click(screen.getByRole("button", { name: "Adicionar feriado" }));

  expect(await screen.findByText(
    "Existem atendimentos neste dia que não podem ser alterados automaticamente.",
  )).toBeInTheDocument();
  expect(await screen.findByText("Atendimento já realizado.")).toBeInTheDocument();
  expect(screen.queryByText(
    "Existem atendimentos realizados que impedem o bloqueio da agenda.",
  )).not.toBeInTheDocument();
  expect(screen.getByRole("dialog")).toBe(dialog);
  expect(screen.getAllByRole("dialog")).toHaveLength(1);
  expect(within(screen.getByRole("dialog")).getByRole("button", { name: "Cancelar" }))
    .toBeInTheDocument();
  expect(within(screen.getByRole("dialog")).queryByRole("button", { name: "Bloquear agenda" }))
    .not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
  expect(screen.getByLabelText("Nome")).toHaveValue("Feriado bloqueado");
  expect(screen.getByLabelText("Data")).toHaveValue("2035-05-01");

  createSpecialSchedulingEvent.mockRejectedValueOnce(conflict({
    ...preview,
    requires_confirmation: false,
    can_confirm: false,
    cancelable_sessions_count: 0,
    blocking_sessions_count: 1,
    blocking_reasons: [{
      code: "SESSION_DONE",
      message: "Atendimento já realizado.",
      count: 1,
    }],
  }));
  fireEvent.click(screen.getByRole("button", { name: "Adicionar feriado" }));
  await screen.findByText("Atendimento já realizado.");
  fireEvent.click(screen.getByRole("button", { name: "Revisar agenda" }));

  expect(await screen.findByTestId("agenda-location"))
    .toHaveTextContent("?date=2035-05-01&view=day");
});

test("fechar pelo X encerra todo o fluxo", async () => {
  createSpecialSchedulingEvent.mockRejectedValueOnce(conflict(preview));
  renderPage();

  fireEvent.click(await screen.findByRole("button", { name: "Novo feriado" }));
  fireEvent.change(screen.getByLabelText("Nome"), { target: { value: "Feriado novo" } });
  fireEvent.change(screen.getByLabelText("Data"), { target: { value: "2035-05-01" } });
  fireEvent.click(screen.getByRole("button", { name: "Adicionar feriado" }));

  const closeButton = await screen.findByRole("button", { name: "Fechar" });
  await waitFor(() => expect(closeButton).not.toBeDisabled());
  fireEvent.click(closeButton);

  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
});
