import React from "react";
import "@testing-library/jest-dom";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { Provider } from "react-redux";
import { createStore } from "redux";
import FinancialReceivedPaidSection from "./FinancialReceivedPaidSection";
import FinancialOverviewSection from "./FinancialOverviewSection";
import {
  getReceivedPaid,
  getDistributionConfiguration,
  saveDistributionConfiguration,
} from "../../../services/financialReceivedPaid";

let mockAuthorization;
jest.mock("../../../contexts/AuthorizationContext", () => ({
  useAuthorization: () => mockAuthorization,
}));
jest.mock("../../../services/financialReceivedPaid", () => ({
  getReceivedPaid: jest.fn(),
  getDistributionConfiguration: jest.fn(),
  saveDistributionConfiguration: jest.fn(),
}));
jest.mock("../../../services/axios", () => ({
  getUserFacingApiError: (error, fallback) => fallback,
}));
jest.mock("./AnnualFinancialResultChart", () => () => (
  <div data-testid="existing-chart" />
));

const element = (tag) =>
  React.forwardRef(({ children, $active, ...props }, ref) =>
    React.createElement(tag, { ...props, ref }, children),
  );
const ui = Object.fromEntries(
  Object.entries({
    Spinner: "span",
    AttendanceSectionSurface: "section",
    AttendancePeriodBlock: "div",
    AttendancePeriodBlockLeft: "div",
    AttendancePeriodBlockLabel: "span",
    AttendancePeriodBlockValue: "strong",
    AttendancePeriodBlockRight: "div",
    AttendanceTabGroup: "div",
    AttendanceTabButton: "button",
    AttendancePeriodControls: "div",
    AttendancePeriodButton: "button",
    AttendancePeriodChip: "span",
    AttendancePeriodMonthInput: "input",
    AttendancePeriodYearSelect: "select",
    AttendanceCard: "article",
    AttendanceCardHeader: "header",
    AttendanceCardTitle: "h3",
    AttendanceEmptyState: "div",
    BlockLoader: "div",
    AttendanceTableCard: "div",
    AttendanceTableScroll: "div",
    AnnualOverviewTable: "table",
    AttendanceMoneyText: "strong",
    ModalOverlay: "div",
    ModalCard: "div",
    ModalHeader: "header",
    ModalTitle: "h3",
    ModalBody: "div",
    ModalActions: "div",
    Field: "div",
    Label: "label",
    Input: "input",
    IconButton: "button",
    PrimaryButton: "button",
    SecondaryButton: "button",
  }).map(([name, tag]) => [name, element(tag)]),
);
ui.attendancePalette = {
  textSecondary: "#555",
  border: "#ddd",
  borderStrong: "#aaa",
  action: "#575",
};
const currency = (cents) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" })
    .format(cents / 100)
    .replace(/\u00a0/g, " ");
const participant = (id, name, percentage = "50.00") => ({
  participant_id: id,
  name,
  percentage,
  percentage_basis_points: Number(percentage) * 100,
});
const configured = (extra = {}) => ({
  configured: true,
  revision: 3,
  current_month: "2026-09",
  current_rule: {
    participants: [
      participant("empresa", "Empresa"),
      participant("rildo", "Rildo"),
    ],
  },
  pending_rule: null,
  history: [],
  ...extra,
});
const unconfigured = () => ({
  configured: false,
  revision: 0,
  current_rule: null,
  pending_rule: null,
});
const report = (year = "2026", distribution = false) => {
  const months = Array.from({ length: 12 }, (_, index) => ({
    month: `${year}-${String(index + 1).padStart(2, "0")}`,
    received_cents: index === 3 ? 12345 : 0,
    paid_cents: index === 4 ? 20000 : 0,
    realized_result_cents: { 3: 12345, 4: -20000 }[index] || 0,
    distribution: distribution
      ? {
          distributable_cents: index === 3 ? 12345 : 0,
          has_available_result: index === 3,
          participants:
            index < 6
              ? [
                  {
                    ...participant("empresa", "Empresa", "100.00"),
                    amount_cents: index === 3 ? 12345 : 0,
                  },
                ]
              : [
                  {
                    ...participant("rildo", "Rildo", "100.00"),
                    amount_cents: 0,
                  },
                ],
        }
      : null,
  }));
  return {
    year: Number(year),
    months,
    totals: {
      received_cents: 12345,
      paid_cents: 20000,
      realized_result_cents: -7655,
    },
    distribution: distribution
      ? {
          distributable_cents: 12345,
          participants: [
            { participant_id: "empresa", name: "Empresa", amount_cents: 12345 },
            { participant_id: "rildo", name: "Rildo", amount_cents: 0 },
          ],
        }
      : null,
  };
};
const deferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
};
const props = {
  ui,
  year: "2026",
  yearOptions: ["2025", "2026", "2027"],
  valuesVisible: true,
  formatCurrency: currency,
  currentDate: new Date(2026, 8, 18),
  onYearChange: jest.fn(),
  onPreviousYear: jest.fn(),
  onNextYear: jest.fn(),
};
const renderPanel = (overrides = {}) => {
  const store = createStore((state, action) =>
    action.type === "SESSION"
      ? { auth: { token: action.token } }
      : state || { auth: { token: "session-a" } },
  );
  const draw = (changes = {}) => (
    <Provider store={store}>
      <FinancialReceivedPaidSection {...props} {...overrides} {...changes} />
    </Provider>
  );
  const view = render(draw());
  return { ...view, store, update: (changes) => view.rerender(draw(changes)) };
};
const ready = () =>
  screen.findByRole("table", { name: "Recebido e pago por mês" });
const openConfiguration = async () => {
  await screen.findByRole("button", { name: "Configurar distribuição" });
  fireEvent.click(
    screen.getByRole("button", { name: "Configurar distribuição" }),
  );
  return screen.getByRole("dialog", { name: "Configurar distribuição" });
};

beforeEach(() => {
  jest.clearAllMocks();
  mockAuthorization = {
    isAdministrator: true,
    context: { clinic_id: 1 },
    reload: jest.fn(),
  };
  getReceivedPaid.mockImplementation((year) =>
    Promise.resolve({ data: report(year) }),
  );
  getDistributionConfiguration.mockResolvedValue({ data: unconfigured() });
  saveDistributionConfiguration.mockResolvedValue({ data: configured() });
});

test("não Administrador não monta dados nem consulta endpoints, mesmo com permissões financeiras", () => {
  mockAuthorization.isAdministrator = false;
  mockAuthorization.canAccessModule = () => true;
  renderPanel();
  expect(getReceivedPaid).not.toHaveBeenCalled();
  expect(getDistributionConfiguration).not.toHaveBeenCalled();
  expect(
    screen.queryByText("Distribuição do resultado"),
  ).not.toBeInTheDocument();
});

test("Administrador vê a terceira aba e não Administrador mantém as duas atuais", () => {
  const defaults = {
    ...props,
    overview: {},
    overviewMonth: "2026-09",
    overviewYear: "2026",
    overviewYearOptions: ["2026"],
    overviewPeriodLabel: "Setembro de 2026",
    overviewPeriodMode: "month",
    loading: true,
    handleOverviewPeriodModeChange: jest.fn(),
  };
  const view = render(<FinancialOverviewSection {...defaults} />);
  expect(screen.getAllByRole("tab").map((tab) => tab.textContent)).toEqual([
    "Resumo mensal",
    "Evolução anual",
    "Recebido e pago",
  ]);
  fireEvent.click(screen.getByRole("tab", { name: "Recebido e pago" }));
  expect(defaults.handleOverviewPeriodModeChange).toHaveBeenCalledWith(
    "realized",
  );
  fireEvent.keyDown(screen.getByRole("tab", { name: "Evolução anual" }), {
    key: "ArrowRight",
  });
  expect(screen.getByRole("tab", { name: "Recebido e pago" })).toHaveFocus();
  fireEvent.keyDown(screen.getByRole("tab", { name: "Resumo mensal" }), {
    key: "Home",
  });
  expect(defaults.handleOverviewPeriodModeChange).toHaveBeenCalledTimes(2);
  mockAuthorization = { ...mockAuthorization, isAdministrator: false };
  view.rerender(<FinancialOverviewSection {...defaults} />);
  expect(screen.getAllByRole("tab")).toHaveLength(2);
  expect(getReceivedPaid).not.toHaveBeenCalled();
});

test("12 meses e totais vêm do backend, com resultado negativo e sem gráfico", async () => {
  renderPanel();
  const table = await ready();
  expect(table.querySelectorAll("tbody tr")).toHaveLength(12);
  expect(
    within(table).getByRole("columnheader", { name: "Realizado" }),
  ).toBeInTheDocument();
  expect(
    within(table).queryByRole("columnheader", { name: "Resultado realizado" }),
  ).not.toBeInTheDocument();
  const april = within(table).getByRole("row", { name: /Abril/ });
  expect(april).toHaveTextContent(currency(12345));
  expect(within(table).getByRole("row", { name: /Maio/ })).toHaveTextContent(
    currency(-20000),
  );
  expect(table.querySelector("tfoot")).toHaveTextContent(currency(-7655));
  expect(screen.queryByTestId("existing-chart")).not.toBeInTheDocument();
  expect(screen.getByText(/Recebido é o que entrou/)).toBeInTheDocument();
});

test("meses futuros seguem apresentação anual, sem esconder movimentos registrados", async () => {
  const data = report();
  data.months[10] = {
    ...data.months[10],
    received_cents: 98765,
    realized_result_cents: 98765,
  };
  getReceivedPaid.mockResolvedValue({ data });
  renderPanel();
  const table = await ready();
  expect(within(table).getByRole("row", { name: /Outubro/ })).toHaveTextContent(
    "—",
  );
  expect(
    within(table).getByRole("row", { name: /Novembro/ }),
  ).toHaveTextContent(currency(98765));
});

test("privacidade oculta todos os valores, totais, atributos e sinais auxiliares", async () => {
  getDistributionConfiguration.mockResolvedValue({ data: configured() });
  getReceivedPaid.mockResolvedValue({ data: report("2026", true) });
  const view = renderPanel();
  await ready();
  await screen.findByRole("table", {
    name: "Distribuição do resultado por mês",
  });
  view.update({ valuesVisible: false });
  expect(view.container).not.toHaveTextContent("R$");
  expect(view.container.innerHTML).not.toContain("12345");
  expect(view.container.innerHTML).not.toContain("20000");
  expect(
    screen.queryByText(/Sem resultado disponível/),
  ).not.toBeInTheDocument();
  expect(screen.getAllByText("••••").length).toBeGreaterThan(30);
  expect(getReceivedPaid).toHaveBeenCalledTimes(1);
});

test("troca de ano limpa dados anteriores imediatamente e descarta respostas atrasadas", async () => {
  const previous = deferred();
  const next = deferred();
  getReceivedPaid.mockImplementation((year) =>
    year === "2026" ? previous.promise : next.promise,
  );
  const view = renderPanel();
  expect(screen.getByText("Carregando Recebido e pago...")).toBeInTheDocument();
  view.update({ year: "2027" });
  await act(async () => {
    previous.resolve({ data: report("2026") });
  });
  expect(
    screen.queryByRole("table", { name: "Recebido e pago por mês" }),
  ).not.toBeInTheDocument();
  await act(async () => {
    next.resolve({ data: report("2027") });
  });
  await ready();
  expect(getReceivedPaid.mock.calls.map(([year]) => year)).toEqual([
    "2026",
    "2027",
  ]);
});

test("mudança de clínica descarta respostas e dados anteriores inclusive modal", async () => {
  const next = deferred();
  getDistributionConfiguration.mockResolvedValue({ data: configured() });
  const view = renderPanel();
  await ready();
  await openConfiguration();
  getReceivedPaid.mockReturnValue(next.promise);
  getDistributionConfiguration.mockReturnValue(next.promise);
  mockAuthorization = { ...mockAuthorization, context: { clinic_id: 2 } };
  view.update();
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(screen.queryByText("Empresa")).not.toBeInTheDocument();
  expect(screen.queryByRole("table")).not.toBeInTheDocument();
});

test("perda de autorização limpa a aba e não aceita recebimento atrasado", async () => {
  const pending = deferred();
  getReceivedPaid.mockReturnValue(pending.promise);
  const view = renderPanel();
  mockAuthorization = {
    ...mockAuthorization,
    isAdministrator: false,
    context: null,
  };
  view.update();
  await act(async () => {
    pending.resolve({ data: report() });
  });
  expect(screen.queryByRole("table")).not.toBeInTheDocument();
  expect(getReceivedPaid).toHaveBeenCalledTimes(1);
});

test("troca de token limpa valores sem persistir dados da sessão anterior", async () => {
  const view = renderPanel();
  await ready();
  const next = deferred();
  getReceivedPaid.mockReturnValue(next.promise);
  act(() => {
    view.store.dispatch({ type: "SESSION", token: "session-b" });
  });
  expect(screen.queryByRole("table")).not.toBeInTheDocument();
  expect(getReceivedPaid).toHaveBeenCalledTimes(2);
});

test("erro de carregamento oferece nova tentativa; falha de configuração não remove a tabela principal", async () => {
  getReceivedPaid.mockRejectedValueOnce(new Error("Unavailable"));
  getDistributionConfiguration.mockRejectedValue(new Error("Unavailable"));
  renderPanel();
  await screen.findByText("Não foi possível carregar Recebido e pago.");
  fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
  await ready();
  expect(
    screen.getByText(/Não foi possível carregar a configuração/),
  ).toBeInTheDocument();
});

test("403 em consulta limpa valores e solicita atualização da autorização", async () => {
  getDistributionConfiguration.mockRejectedValue({ response: { status: 403 } });
  renderPanel();
  await screen.findByRole("alert");
  expect(screen.queryByRole("table")).not.toBeInTheDocument();
  expect(mockAuthorization.reload).toHaveBeenCalledTimes(1);
});

test("sem configuração oferece ação simples, mantém visão e primeira regra não tem vigência", async () => {
  renderPanel();
  await ready();
  const dialog = await openConfiguration();
  expect(dialog).toHaveTextContent(/meses anteriores disponíveis/);
  expect(within(dialog).queryByRole("radio")).not.toBeInTheDocument();
  fireEvent.change(within(dialog).getByLabelText("Participante 1"), {
    target: { value: "Empresa" },
  });
  fireEvent.click(
    within(dialog).getByRole("button", { name: "Salvar distribuição" }),
  );
  await waitFor(() =>
    expect(saveDistributionConfiguration).toHaveBeenCalledWith({
      expected_revision: 0,
      participants: [{ name: "Empresa", percentage: "100" }],
    }),
  );
  await waitFor(() =>
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
  );
  await ready();
  expect(
    screen.queryByText("Distribuição atualizada."),
  ).not.toBeInTheDocument();
});

test("resposta de gravação da clínica anterior não recarrega nem altera o novo painel", async () => {
  const oldSave = deferred();
  getDistributionConfiguration.mockResolvedValue({ data: configured() });
  saveDistributionConfiguration.mockReturnValue(oldSave.promise);
  const view = renderPanel();
  const dialog = await openConfiguration();
  fireEvent.click(
    within(dialog).getByRole("button", { name: "Salvar distribuição" }),
  );
  expect(saveDistributionConfiguration).toHaveBeenCalledTimes(1);
  mockAuthorization = { ...mockAuthorization, context: { clinic_id: 2 } };
  getReceivedPaid.mockReturnValue(new Promise(() => {}));
  getDistributionConfiguration.mockReturnValue(new Promise(() => {}));
  view.update();
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  await act(async () => {
    oldSave.resolve({ data: configured() });
  });
  expect(getReceivedPaid).toHaveBeenCalledTimes(2);
  expect(getDistributionConfiguration).toHaveBeenCalledTimes(2);
  expect(
    screen.queryByText("Distribuição atualizada."),
  ).not.toBeInTheDocument();
  expect(screen.queryByRole("table")).not.toBeInTheDocument();
});

test("primeira configuração aceita três percentuais com soma exata e envia apenas dados editáveis", async () => {
  renderPanel();
  const dialog = await openConfiguration();
  fireEvent.change(within(dialog).getByLabelText("Participante 1"), {
    target: { value: "Empresa" },
  });
  fireEvent.change(within(dialog).getByLabelText("Percentual 1 (%)"), {
    target: { value: "33,33" },
  });
  fireEvent.click(
    within(dialog).getByRole("button", { name: "Adicionar participante" }),
  );
  fireEvent.change(within(dialog).getByLabelText("Participante 2"), {
    target: { value: "Rildo" },
  });
  fireEvent.change(within(dialog).getByLabelText("Percentual 2 (%)"), {
    target: { value: "33,33" },
  });
  fireEvent.click(
    within(dialog).getByRole("button", { name: "Adicionar participante" }),
  );
  fireEvent.change(within(dialog).getByLabelText("Participante 3"), {
    target: { value: "Thiago" },
  });
  fireEvent.change(within(dialog).getByLabelText("Percentual 3 (%)"), {
    target: { value: "33,34" },
  });
  expect(dialog).toHaveTextContent("100,00%");
  fireEvent.click(
    within(dialog).getByRole("button", { name: "Salvar distribuição" }),
  );
  await waitFor(() =>
    expect(saveDistributionConfiguration).toHaveBeenCalledWith({
      expected_revision: 0,
      participants: [
        { name: "Empresa", percentage: "33.33" },
        { name: "Rildo", percentage: "33.33" },
        { name: "Thiago", percentage: "33.34" },
      ],
    }),
  );
});

test("validação impede salvar soma inválida, nomes duplicados, zero e excesso de precisão", async () => {
  getDistributionConfiguration.mockResolvedValue({ data: configured() });
  renderPanel();
  const dialog = await openConfiguration();
  const save = within(dialog).getByRole("button", {
    name: "Salvar distribuição",
  });
  fireEvent.change(within(dialog).getByLabelText("Percentual 1 (%)"), {
    target: { value: "49,99" },
  });
  expect(save).toBeDisabled();
  expect(dialog).toHaveTextContent("99,99%");
  fireEvent.change(within(dialog).getByLabelText("Percentual 1 (%)"), {
    target: { value: "50" },
  });
  fireEvent.change(within(dialog).getByLabelText("Participante 2"), {
    target: { value: " empresa " },
  });
  expect(save).toBeDisabled();
  expect(dialog).toHaveTextContent("Não use nomes duplicados.");
  fireEvent.change(within(dialog).getByLabelText("Participante 2"), {
    target: { value: "Rildo" },
  });
  ["0", "-1", "50.001", "1e2"].forEach((value) => {
    fireEvent.change(within(dialog).getByLabelText("Percentual 1 (%)"), {
      target: { value },
    });
    expect(save).toBeDisabled();
  });
  expect(saveDistributionConfiguration).not.toHaveBeenCalled();
});

test.each([
  ["Aplicar neste mês", "current_month"],
  ["Aplicar no próximo mês", "next_month"],
])("alteração envia identidade e revisão, opção %s", async (label, apply) => {
  getDistributionConfiguration.mockResolvedValue({ data: configured() });
  renderPanel();
  const dialog = await openConfiguration();
  fireEvent.change(within(dialog).getByLabelText("Participante 1"), {
    target: { value: "Empresa corrigida" },
  });
  fireEvent.click(within(dialog).getByLabelText(label));
  fireEvent.click(
    within(dialog).getByRole("button", { name: "Salvar distribuição" }),
  );
  await waitFor(() =>
    expect(saveDistributionConfiguration).toHaveBeenCalledWith({
      expected_revision: 3,
      apply,
      participants: [
        {
          participant_id: "empresa",
          name: "Empresa corrigida",
          percentage: "50.00",
        },
        { participant_id: "rildo", name: "Rildo", percentage: "50.00" },
      ],
    }),
  );
});

test("regra pendente é visível, avisa substituição e abre com seus participantes", async () => {
  getDistributionConfiguration.mockResolvedValue({
    data: configured({
      pending_rule: {
        effective_month: "2026-10",
        participants: [participant("thiago", "Thiago", "100.00")],
      },
    }),
  });
  renderPanel();
  const dialog = await openConfiguration();
  expect(dialog).toHaveTextContent("Alteração programada para 10/2026");
  expect(dialog).toHaveTextContent(
    "Uma nova configuração substituirá esta alteração",
  );
  expect(within(dialog).getByLabelText("Participante 1")).toHaveValue("Thiago");
  expect(within(dialog).getByLabelText("Aplicar no próximo mês")).toBeChecked();
});

test("remover e adicionar omite identidade antiga, sem criar vínculo operacional", async () => {
  getDistributionConfiguration.mockResolvedValue({ data: configured() });
  renderPanel();
  const dialog = await openConfiguration();
  fireEvent.click(
    within(dialog).getByRole("button", { name: "Remover participante 2" }),
  );
  fireEvent.click(
    within(dialog).getByRole("button", { name: "Adicionar participante" }),
  );
  fireEvent.change(within(dialog).getByLabelText("Participante 2"), {
    target: { value: "Nova pessoa" },
  });
  fireEvent.change(within(dialog).getByLabelText("Percentual 2 (%)"), {
    target: { value: "50" },
  });
  fireEvent.click(
    within(dialog).getByRole("button", { name: "Salvar distribuição" }),
  );
  await waitFor(() => expect(saveDistributionConfiguration).toHaveBeenCalled());
  expect(
    saveDistributionConfiguration.mock.calls[0][0].participants[1],
  ).toEqual({ name: "Nova pessoa", percentage: "50" });
});

test("tabela reúne participantes do ano, usa headers curtos e traços sem percentuais nos meses sem resultado", async () => {
  getDistributionConfiguration.mockResolvedValue({ data: configured() });
  getReceivedPaid.mockResolvedValue({ data: report("2026", true) });
  renderPanel();
  const table = await screen.findByRole("table", {
    name: "Distribuição do resultado por mês",
  });
  expect(
    within(table).getByRole("columnheader", { name: "Empresa" }),
  ).toBeInTheDocument();
  expect(
    within(table).getByRole("columnheader", { name: "Rildo" }),
  ).toBeInTheDocument();
  expect(
    within(table).getByRole("columnheader", { name: "Resultado" }),
  ).toBeInTheDocument();
  expect(
    within(table).queryByRole("columnheader", {
      name: "Resultado distribuível",
    }),
  ).not.toBeInTheDocument();
  expect(table.querySelectorAll("tbody tr")).toHaveLength(12);
  const april = within(table).getByRole("row", { name: /Abril/ });
  expect(april).toHaveTextContent(currency(12345));
  expect(april).toHaveTextContent("—");
  [/Maio/, /Janeiro/].forEach((month) => {
    const row = within(table).getByRole("row", { name: month });
    expect(
      within(row)
        .getAllByRole("cell")
        .slice(1)
        .map((cell) => cell.textContent),
    ).toEqual(["—", "—", "—"]);
  });
  expect(table).not.toHaveTextContent(
    "Sem resultado disponível para distribuição",
  );
  expect(table).not.toHaveTextContent("%");
  expect(table.querySelector("tfoot")).toHaveTextContent(currency(12345));
  expect(table.querySelector("tfoot")).toHaveTextContent(currency(0));
  expect(table).not.toHaveTextContent(currency(-20000));
});

test("valor explícito zero de participante em mês com resultado continua numérico", async () => {
  const data = report("2026", true);
  data.months[3].distribution.participants.push({
    ...participant("rildo", "Rildo", "0.01"),
    amount_cents: 0,
  });
  getDistributionConfiguration.mockResolvedValue({ data: configured() });
  getReceivedPaid.mockResolvedValue({ data });
  renderPanel();
  const table = await screen.findByRole("table", {
    name: "Distribuição do resultado por mês",
  });
  const april = within(table).getByRole("row", { name: /Abril/ });
  expect(within(april).getAllByRole("cell")[3]).toHaveTextContent(currency(0));
  expect(april).not.toHaveTextContent("%");
});

test("conflito de revisão recarrega configuração sem reaplicar comando automaticamente", async () => {
  getDistributionConfiguration.mockResolvedValue({ data: configured() });
  saveDistributionConfiguration.mockRejectedValue({
    response: { status: 409 },
  });
  renderPanel();
  const dialog = await openConfiguration();
  fireEvent.click(
    within(dialog).getByRole("button", { name: "Salvar distribuição" }),
  );
  await screen.findByText(/A configuração mudou enquanto você editava/);
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  await waitFor(() =>
    expect(getDistributionConfiguration).toHaveBeenCalledTimes(2),
  );
  expect(saveDistributionConfiguration).toHaveBeenCalledTimes(1);
});

test("falha ao salvar preserva formulário e 403 posterior limpa tudo", async () => {
  getDistributionConfiguration.mockResolvedValue({ data: configured() });
  saveDistributionConfiguration.mockRejectedValueOnce(new Error("Unavailable"));
  renderPanel();
  let dialog = await openConfiguration();
  fireEvent.change(within(dialog).getByLabelText("Participante 1"), {
    target: { value: "Nome editado" },
  });
  fireEvent.click(
    within(dialog).getByRole("button", { name: "Salvar distribuição" }),
  );
  await within(dialog).findByRole("alert");
  expect(within(dialog).getByLabelText("Participante 1")).toHaveValue(
    "Nome editado",
  );
  saveDistributionConfiguration.mockRejectedValueOnce({
    response: { status: 403 },
  });
  dialog = screen.getByRole("dialog");
  fireEvent.click(
    within(dialog).getByRole("button", { name: "Salvar distribuição" }),
  );
  await screen.findByText(
    "Você não tem autorização para acessar Recebido e pago.",
  );
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(screen.queryByRole("table")).not.toBeInTheDocument();
});
