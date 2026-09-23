import React from "react";
import "@testing-library/jest-dom";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import FinancialOverviewSection from "./FinancialOverviewSection";
import FinancialReceivedPaidSection from "./FinancialReceivedPaidSection";
import { useAuthorization } from "../../../contexts/AuthorizationContext";

jest.mock("../../../contexts/AuthorizationContext", () => ({ useAuthorization: jest.fn() }));
jest.mock("./FinancialReceivedPaidSection", () =>
  jest.fn(() => <div>Relatório realizado autorizado</div>),
);

const passthrough =
  (Tag = "div") =>
  // eslint-disable-next-line react/prop-types
  ({ children }) => <Tag>{children}</Tag>;

const ui = {
  Spinner: passthrough("span"),
  AttendanceSectionSurface: passthrough("section"),
  AttendancePeriodBlock: passthrough(),
  AttendancePeriodBlockLeft: passthrough(),
  AttendancePeriodBlockLabel: passthrough("span"),
  AttendancePeriodBlockValue: passthrough("strong"),
  AttendancePeriodBlockRight: passthrough(),
  AttendanceTabGroup:
    // eslint-disable-next-line react/prop-types
    ({ children, ...props }) => <div {...props}>{children}</div>,
  AttendanceTabButton: React.forwardRef(
    // eslint-disable-next-line react/prop-types
    ({ children, $active, ...props }, ref) => (
      <button ref={ref} {...props}>
        {children}
      </button>
    ),
  ),
  AttendancePeriodControls: passthrough(),
  AttendancePeriodButton:
    // eslint-disable-next-line react/prop-types
    ({ children, onClick, type }) => (
      <button type={type} onClick={onClick}>
        {children}
      </button>
    ),
  AttendancePeriodChip:
    // eslint-disable-next-line react/prop-types
    ({ children, ...props }) => <span {...props}>{children}</span>,
  AttendancePeriodMonthInput: React.forwardRef((props, ref) => <input ref={ref} {...props} />),
  AttendancePeriodYearSelect:
    // eslint-disable-next-line react/prop-types
    ({ children, ...props }) => <select {...props}>{children}</select>,
  AttendanceCard: passthrough("article"),
  AttendanceCardHeader: passthrough("header"),
  AttendanceCardTitle: passthrough("h3"),
  OverviewSummaryGrid: passthrough(),
  OverviewSummaryColumn: passthrough(),
  OverviewSummaryHeader: passthrough("strong"),
  AttendanceMetricCard: passthrough(),
  AttendanceMetricLabel: passthrough("span"),
  AttendanceMetricValue: passthrough("strong"),
  AttendanceEmptyState: passthrough(),
  BlockLoader: passthrough(),
  AttendanceTableCard: passthrough(),
  AttendanceTableScroll: passthrough(),
  AnnualOverviewTable:
    // eslint-disable-next-line react/prop-types
    ({ children, ...props }) => <table {...props}>{children}</table>,
  AttendanceMoneyText: passthrough("strong"),
  attendancePalette: {
    action: "#5f7957",
    actionBorder: "#c9d6c6",
    actionSoft: "#edf4ec",
    border: "#e3e8ef",
    borderStrong: "#d6dde8",
    dangerAccent: "#d16a56",
    surface: "#ffffff",
    surfaceMuted: "#f8fafc",
    textPrimary: "#111827",
    textMuted: "#8a94a6",
    textSecondary: "#4b5563",
    textTertiary: "#6b7280",
  },
};

const formatCurrency = (value) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(value || 0) / 100);

const summary = (overrides = {}) => ({
  incomeTotal: 0,
  expenseTotal: 0,
  periodResult: 0,
  received: 0,
  receivable: 0,
  paidExpenses: 0,
  pendingExpenses: 0,
  hasAccounts: false,
  ...overrides,
});
const buildAnnualMonths = (overrides = {}, year = "2026") =>
  Array.from({ length: 12 }, (_, index) => ({
    month: `${year}-${String(index + 1).padStart(2, "0")}`,
    ...summary(overrides[index + 1]),
  }));
const props = (overrides = {}) => ({
  ui,
  loading: false,
  overview: { summary: summary(), months: buildAnnualMonths(), hasMonthlyBreakdown: true },
  overviewTab: "summary",
  handleOverviewTabChange: jest.fn(),
  overviewMonth: "2026-10",
  overviewYear: "2026",
  overviewYearOptions: ["2025", "2026", "2027"],
  overviewPeriodLabel: "outubro de 2026",
  overviewPeriodMode: "month",
  currentDate: new Date("2026-09-22T12:00:00-03:00"),
  financialValuesVisible: true,
  formatCurrency,
  overviewMonthPickerRef: React.createRef(),
  handleOverviewMonthChange: jest.fn(),
  handleOverviewYearChange: jest.fn(),
  handleOverviewPeriodTagClick: jest.fn(),
  handleOverviewPeriodModeChange: jest.fn(),
  handleOverviewPreviousMonth: jest.fn(),
  handleOverviewNextMonth: jest.fn(),
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
  useAuthorization.mockReturnValue({ isAdministrator: false });
});

describe("FinancialOverviewSection", () => {
  it("reúne Mensal e Anual no Resumo com seleção clara do período", async () => {
    const options = props();
    const { rerender } = render(<FinancialOverviewSection {...options} />);
    expect(screen.getByRole("tab", { name: "Resumo" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getAllByRole("tab")).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Mensal" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByLabelText("Selecionar mês e ano do Resumo")).toHaveValue("2026-10");
    await userEvent.click(screen.getByRole("button", { name: "Anual" }));
    expect(options.handleOverviewPeriodModeChange).toHaveBeenCalledWith("year");
    rerender(
      <FinancialOverviewSection
        {...options}
        overviewPeriodMode="year"
        overviewPeriodLabel="2026"
      />,
    );
    expect(screen.getByRole("button", { name: "Anual" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByLabelText("Selecionar ano do Resumo")).toHaveValue("2026");
    expect(screen.queryByLabelText("Selecionar mês e ano do Resumo")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "< Ano anterior" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Próximo ano >" })).toBeInTheDocument();
  });

  it("navega as três abas pelo teclado e monta cada relatório somente na aba escolhida", async () => {
    useAuthorization.mockReturnValue({ isAdministrator: true });
    const options = props();
    const { rerender } = render(<FinancialOverviewSection {...options} />);
    expect(screen.getAllByRole("tab").map((tab) => tab.textContent)).toEqual([
      "Resumo",
      "Recebido e pago",
      "Distribuição",
    ]);
    expect(FinancialReceivedPaidSection).not.toHaveBeenCalled();
    screen.getByRole("tab", { name: "Resumo" }).focus();
    await userEvent.keyboard("{ArrowRight}");
    expect(options.handleOverviewTabChange).toHaveBeenCalledWith("received-paid");
    expect(screen.getByRole("tab", { name: "Recebido e pago" })).toHaveFocus();
    rerender(<FinancialOverviewSection {...options} overviewTab="received-paid" />);
    expect(FinancialReceivedPaidSection.mock.calls.at(-1)[0]).toMatchObject({
      view: "received-paid",
      year: "2026",
    });
    expect(screen.queryByRole("group", { name: "Período do Resumo" })).not.toBeInTheDocument();
    await userEvent.keyboard("{End}");
    expect(options.handleOverviewTabChange).toHaveBeenLastCalledWith("distribution");
    rerender(<FinancialOverviewSection {...options} overviewTab="distribution" />);
    expect(FinancialReceivedPaidSection.mock.calls.at(-1)[0]).toMatchObject({
      view: "distribution",
      year: "2026",
    });
    expect(screen.getByRole("tabpanel")).toHaveAttribute(
      "aria-labelledby",
      "financial-distribution-tab",
    );
    await userEvent.keyboard("{Home}");
    expect(options.handleOverviewTabChange).toHaveBeenLastCalledWith("summary");
  });

  it("usuário sem permissão não monta as abas restritas e seleção inválida volta ao Resumo", () => {
    const options = props({ overviewTab: "distribution" });
    render(<FinancialOverviewSection {...options} />);
    expect(screen.getAllByRole("tab")).toHaveLength(1);
    expect(screen.queryByText("Relatório realizado autorizado")).not.toBeInTheDocument();
    expect(FinancialReceivedPaidSection).not.toHaveBeenCalled();
    expect(options.handleOverviewTabChange).toHaveBeenCalledWith("summary");
  });

  it("mostra contas de outubro e sua situação sem deslocar a conta quando paga depois", () => {
    const open = summary({
      incomeTotal: 20000,
      receivable: 20000,
      periodResult: 20000,
      hasAccounts: true,
    });
    const options = props({ overview: { summary: open } });
    const { container, rerender } = render(<FinancialOverviewSection {...options} />);
    const field = (name) => container.querySelector(`[data-summary-field="${name}"]`);
    expect(field("incomeTotal")).toHaveTextContent("Total de receitasR$ 200,00");
    expect(field("received")).toHaveTextContent("LiquidadoR$ 0,00");
    expect(field("receivable")).toHaveTextContent("A receberR$ 200,00");
    rerender(
      <FinancialOverviewSection
        {...options}
        overview={{ summary: { ...open, received: 20000, receivable: 0 } }}
      />,
    );
    expect(field("incomeTotal")).toHaveTextContent("Total de receitasR$ 200,00");
    expect(field("received")).toHaveTextContent("LiquidadoR$ 200,00");
    expect(field("receivable")).toHaveTextContent("A receberR$ 0,00");
    expect(field("periodResult")).toHaveTextContent("Saldo das contasR$ 200,00");
    expect(
      screen.getByText("Contas que pertencem ao período, considerando a data em que foram lançadas"),
    ).toBeInTheDocument();
    expect(screen.queryByText("Recebido")).not.toBeInTheDocument();
  });

  it("gráfico, tabela e total anual usam totais autoritativos com futuro visível", () => {
    const months = buildAnnualMonths({
      10: {
        incomeTotal: 40000,
        receivable: 40000,
        expenseTotal: 10000,
        pendingExpenses: 10000,
        periodResult: 30000,
        hasAccounts: true,
      },
      12: { expenseTotal: 25000, pendingExpenses: 25000, periodResult: -25000, hasAccounts: true },
    });
    const { container } = render(
      <FinancialOverviewSection
        {...props({
          overviewPeriodMode: "year",
          overviewPeriodLabel: "2026",
          overview: {
            summary: summary({
              incomeTotal: 40000,
              receivable: 40000,
              expenseTotal: 35000,
              pendingExpenses: 35000,
              periodResult: 5000,
              hasAccounts: true,
            }),
            months,
            hasMonthlyBreakdown: true,
          },
        })}
      />,
    );
    const table = screen.getByRole("table", { name: "Contas por mês" });
    expect(within(table).getAllByRole("row")).toHaveLength(14);
    const october = table.querySelector('[data-month="2026-10"]');
    const november = table.querySelector('[data-month="2026-11"]');
    expect(october.querySelector('[data-field="incomeTotal"]')).toHaveTextContent("R$ 400,00");
    expect(october.querySelector('[data-field="expenseTotal"]')).toHaveTextContent("R$ 100,00");
    expect(october.querySelector('[data-field="periodResult"]')).toHaveTextContent("R$ 300,00");
    expect(within(november).getAllByText("R$ 0,00")).toHaveLength(3);
    expect(within(table).queryByText("—")).not.toBeInTheDocument();
    expect(container.querySelector('rect[data-month="2026-10"]')).toHaveAttribute(
      "data-value-cents",
      "30000",
    );
    expect(container.querySelector('rect[data-month="2026-12"]')).toHaveAttribute(
      "data-sign",
      "negative",
    );
    expect(container.querySelector('text[data-month="2026-10"]')).toHaveTextContent("R$ 300,00");
    const total = table.querySelector('[data-annual-total="true"]');
    expect(total.querySelector('[data-field="incomeTotal"]')).toHaveTextContent("R$ 400,00");
    expect(total.querySelector('[data-field="expenseTotal"]')).toHaveTextContent("R$ 350,00");
    expect(total.querySelector('[data-field="periodResult"]')).toHaveTextContent("R$ 50,00");
    expect(
      screen
        .getByRole("img", { name: "Saldo das contas por mês" })
        .querySelectorAll("rect[data-value-cents]"),
    ).toHaveLength(12);
  });

  it("preserva privacidade sem geometria, labels ou centavos expostos no gráfico", () => {
    const { container } = render(
      <FinancialOverviewSection
        {...props({
          overviewPeriodMode: "year",
          financialValuesVisible: false,
          formatCurrency: () => "R$ ••••",
          overview: {
            summary: summary({
              incomeTotal: 40000,
              receivable: 40000,
              periodResult: 40000,
              hasAccounts: true,
            }),
            months: buildAnnualMonths({
              10: { incomeTotal: 40000, receivable: 40000, periodResult: 40000, hasAccounts: true },
            }),
            hasMonthlyBreakdown: true,
          },
        })}
      />,
    );
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(
      screen.getByText("Mostre os valores financeiros para visualizar o gráfico."),
    ).toBeInTheDocument();
    expect(container.querySelector("[data-value-cents]")).toBeNull();
    expect(container.textContent).not.toContain("40000");
    expect(
      within(screen.getByRole("table", { name: "Contas por mês" })).getAllByText("R$ ••••"),
    ).toHaveLength(39);
  });

  it("mantém zeros sem bloco de ausência mensal e preserva carregamento e erros", () => {
    const emptyState = jest.fn(passthrough());
    const options = props({ ui: { ...ui, AttendanceEmptyState: emptyState } });
    const { container, rerender } = render(<FinancialOverviewSection {...options} />);
    expect(screen.queryByText("Nenhuma conta encontrada para este mês.")).not.toBeInTheDocument();
    expect(emptyState).not.toHaveBeenCalled();
    expect(screen.getAllByText("R$ 0,00")).toHaveLength(7);
    rerender(
      <FinancialOverviewSection
        {...options}
        overview={{ summary: summary({ hasAccounts: true }) }}
      />,
    );
    expect(screen.queryByText("Nenhuma conta encontrada para este mês.")).not.toBeInTheDocument();
    expect(screen.getAllByText("R$ 0,00")).toHaveLength(7);
    rerender(<FinancialOverviewSection {...options} loading />);
    expect(screen.getByText("Carregando contas do período...")).toBeInTheDocument();
    expect(container.querySelector("[data-summary-field]")).toBeNull();
    rerender(<FinancialOverviewSection {...options} error="Falha ao consultar contas" />);
    expect(screen.getByRole("alert")).toHaveTextContent("Falha ao consultar contas");
    expect(screen.queryByText("R$ 0,00")).not.toBeInTheDocument();
    rerender(<FinancialOverviewSection {...options} overview={{}} />);
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Não foi possível carregar as contas deste período.",
    );
    expect(screen.queryByText("R$ 0,00")).not.toBeInTheDocument();
  });

  it("preserva resumo anual quando detalhamento mensal não está disponível", () => {
    render(
      <FinancialOverviewSection
        {...props({
          overviewPeriodMode: "year",
          overview: { summary: summary(), months: [], hasMonthlyBreakdown: false },
        })}
      />,
    );
    expect(screen.getByText("Contas do ano")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Não foi possível carregar as contas por mês deste ano.",
    );
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("mostra zeros em todos os meses sem barras inválidas e sem destacar ano histórico", () => {
    const { container } = render(
      <FinancialOverviewSection
        {...props({
          overviewPeriodMode: "year",
          overviewYear: "2025",
          overviewPeriodLabel: "2025",
          overview: {
            summary: summary(),
            months: buildAnnualMonths({}, "2025"),
            hasMonthlyBreakdown: true,
          },
        })}
      />,
    );
    expect(screen.getByText("O saldo das contas é R$ 0,00 em todos os meses.")).toBeInTheDocument();
    expect(container.querySelector('[data-current-month="true"]')).toBeNull();
    expect(container.innerHTML).not.toContain("NaN");
    expect(screen.queryByText("—")).not.toBeInTheDocument();
    expect(screen.getByText("Nenhuma conta encontrada para este ano.")).toBeInTheDocument();
  });
});
