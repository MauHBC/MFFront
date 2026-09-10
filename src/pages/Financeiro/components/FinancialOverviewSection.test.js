import React from "react";
import "@testing-library/jest-dom";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import FinancialOverviewSection from "./FinancialOverviewSection";

const passthrough =
  (Tag = "div") =>
    // eslint-disable-next-line react/prop-types
    ({ children }) =>
      <Tag>{children}</Tag>;

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

const buildAnnualMonths = (overrides = {}, year = "2026") => Array.from({ length: 12 }, (_, index) => ({
  month: `${year}-${String(index + 1).padStart(2, "0")}`,
  received: 0,
  receivable: 0,
  paidExpenses: 0,
  pendingExpenses: 0,
  currentResult: 0,
  pendingBalance: 0,
  ...(overrides[index + 1] || {}),
}));

const renderOverview = (
  overview,
  periodMode = "month",
  financialValuesVisible = true,
  options = {},
) => {
  const handleOverviewPeriodModeChange = jest.fn();
  const overviewYear = options.overviewYear || "2026";
  return {
    handleOverviewPeriodModeChange,
    ...render(
    <FinancialOverviewSection
      ui={ui}
      loading={false}
      overview={overview}
      overviewMonth="2026-06"
      overviewYear={overviewYear}
      overviewYearOptions={["2025", "2026", "2027"]}
      overviewPeriodLabel={periodMode === "year" ? overviewYear : "junho de 2026"}
      overviewPeriodMode={periodMode}
      currentDate={options.currentDate || new Date("2026-06-15T12:00:00-03:00")}
      financialValuesVisible={financialValuesVisible}
      formatCurrency={financialValuesVisible ? formatCurrency : () => "R$ ••••"}
      overviewMonthPickerRef={React.createRef()}
      handleOverviewMonthChange={jest.fn()}
      handleOverviewYearChange={jest.fn()}
      handleOverviewPeriodTagClick={jest.fn()}
      handleOverviewPeriodModeChange={handleOverviewPeriodModeChange}
      handleOverviewPreviousMonth={jest.fn()}
      handleOverviewNextMonth={jest.fn()}
    />,
    ),
  };
};

describe("FinancialOverviewSection", () => {
  it("expõe os modos principais como abas sem misturar controles de período", () => {
    const { rerender } = render(
      <FinancialOverviewSection
        ui={ui}
        loading={false}
        overview={{ summary: {}, hasMovement: false }}
        overviewMonth="2026-06"
        overviewYear="2026"
        overviewYearOptions={["2025", "2026", "2027"]}
        overviewPeriodLabel="junho de 2026"
        overviewPeriodMode="month"
        financialValuesVisible
        formatCurrency={formatCurrency}
        overviewMonthPickerRef={React.createRef()}
        handleOverviewMonthChange={jest.fn()}
        handleOverviewYearChange={jest.fn()}
        handleOverviewPeriodTagClick={jest.fn()}
        handleOverviewPeriodModeChange={jest.fn()}
        handleOverviewPreviousMonth={jest.fn()}
        handleOverviewNextMonth={jest.fn()}
      />,
    );

    expect(screen.getByRole("tab", { name: "Resumo mensal" }))
      .toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "Evolução anual" }))
      .toHaveAttribute("aria-selected", "false");
    expect(screen.getByLabelText("Selecionar mês e ano do resumo mensal")).toBeTruthy();
    expect(screen.queryByLabelText("Selecionar ano da evolução anual")).toBeNull();

    rerender(
      <FinancialOverviewSection
        ui={ui}
        loading={false}
        overview={{ summary: {}, months: buildAnnualMonths(), hasMonthlyBreakdown: true, hasMovement: false }}
        overviewMonth="2026-06"
        overviewYear="2027"
        overviewYearOptions={["2026", "2027", "2028"]}
        overviewPeriodLabel="2027"
        overviewPeriodMode="year"
        financialValuesVisible
        formatCurrency={formatCurrency}
        overviewMonthPickerRef={React.createRef()}
        handleOverviewMonthChange={jest.fn()}
        handleOverviewYearChange={jest.fn()}
        handleOverviewPeriodTagClick={jest.fn()}
        handleOverviewPeriodModeChange={jest.fn()}
        handleOverviewPreviousMonth={jest.fn()}
        handleOverviewNextMonth={jest.fn()}
      />,
    );

    expect(screen.getByRole("tab", { name: "Evolução anual" }))
      .toHaveAttribute("aria-selected", "true");
    expect(screen.getByLabelText("Selecionar ano da evolução anual")).toHaveValue("2027");
    expect(screen.queryByLabelText("Selecionar mês e ano do resumo mensal")).toBeNull();
  });

  it("permite alternar as abas principais pelo teclado", async () => {
    const { handleOverviewPeriodModeChange } = renderOverview({
      summary: {},
      hasMovement: false,
    });
    const monthlyTab = screen.getByRole("tab", { name: "Resumo mensal" });
    const annualTab = screen.getByRole("tab", { name: "Evolução anual" });

    monthlyTab.focus();
    await userEvent.keyboard("{ArrowRight}");

    expect(handleOverviewPeriodModeChange).toHaveBeenCalledWith("year");
    expect(annualTab).toHaveFocus();
  });

  it("renderiza os seis valores do resumo formatados", () => {
    renderOverview({
      summary: {
        received: 125000,
        receivable: 75000,
        paidExpenses: 30000,
        pendingExpenses: 50000,
        currentResult: 95000,
        pendingBalance: 25000,
      },
      hasMovement: true,
    });

    expect(screen.getByText("Recebido")).toBeTruthy();
    expect(screen.getByText("A receber")).toBeTruthy();
    expect(screen.getByText("Despesas pagas")).toBeTruthy();
    expect(screen.getByText("Despesas pendentes")).toBeTruthy();
    expect(screen.getByText("Resultado do mês atual")).toBeTruthy();
    expect(screen.getByText("Saldo pendente")).toBeTruthy();
    expect(screen.getByText("R$ 1.250,00")).toBeTruthy();
    expect(screen.getByText("R$ 750,00")).toBeTruthy();
    expect(screen.getByText("R$ 300,00")).toBeTruthy();
    expect(screen.getByText("R$ 500,00")).toBeTruthy();
    expect(screen.getByText("R$ 950,00")).toBeTruthy();
    expect(screen.getByText("R$ 250,00")).toBeTruthy();

    const compactSummary = screen.getByRole("region", { name: "Resumo financeiro mensal" });
    expect(within(compactSummary).getByRole("group", { name: "Atual" })).toBeTruthy();
    expect(within(compactSummary).getByRole("group", { name: "Pendente" })).toBeTruthy();
    expect(compactSummary.querySelectorAll("[data-summary-field]")).toHaveLength(6);
    expect(compactSummary.querySelector('[data-summary-field="currentResult"]'))
      .toHaveTextContent("Resultado do mês atualR$ 950,00");
  });

  it("mantem valores negativos formatados e nao exibe valores crus", () => {
    const { container } = renderOverview({
      summary: {
        received: 10000,
        receivable: 20000,
        paidExpenses: 30000,
        pendingExpenses: 50000,
        currentResult: -20000,
        pendingBalance: -30000,
      },
      hasMovement: true,
    });

    expect(screen.getByText("-R$ 200,00")).toBeTruthy();
    expect(screen.getByText("-R$ 300,00")).toBeTruthy();
    expect(container.textContent).not.toContain("NaN");
    expect(container.textContent).not.toContain("undefined");
    expect(container.textContent).not.toContain("20000");
    expect(container.textContent).not.toContain("30000");
  });

  it("usa títulos e estado vazio coerentes com a visão anual", () => {
    renderOverview({
      summary: {
        received: 0,
        receivable: 0,
        paidExpenses: 0,
        pendingExpenses: 0,
        currentResult: 0,
        pendingBalance: 0,
      },
      months: buildAnnualMonths(),
      hasMonthlyBreakdown: true,
      hasMovement: false,
    }, "year");

    expect(screen.getByText("Resumo do ano")).toBeTruthy();
    expect(screen.getByText("Resultado do ano atual")).toBeTruthy();
    expect(screen.getByRole("region", { name: "Resumo financeiro anual" })).toBeTruthy();
    expect(screen.getByText("Nenhuma movimentação encontrada para este ano.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "< Ano anterior" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Próximo ano >" })).toBeTruthy();
    expect(screen.queryByText("Resumo do mês")).toBeNull();
  });

  it("renderiza gráfico e tabela com os doze resultados mensais", () => {
    const months = buildAnnualMonths({
      1: { received: 123456, paidExpenses: 23456, currentResult: 100000 },
      2: { received: 10000, paidExpenses: 25000, currentResult: -15000 },
    });
    const { container } = renderOverview({
      summary: {
        received: 60000,
        receivable: 0,
        paidExpenses: 45000,
        pendingExpenses: 0,
        currentResult: 15000,
        pendingBalance: 0,
      },
      months,
      hasMonthlyBreakdown: true,
      hasMovement: true,
    }, "year");

    expect(screen.getByRole("img", { name: "Resultado financeiro por mês" })).toBeTruthy();
    const table = screen.getByRole("table", { name: "Evolução financeira mensal" });
    expect(within(table).getAllByRole("row")).toHaveLength(14);
    expect(within(table).getByText("Janeiro")).toBeTruthy();
    expect(within(table).getByText("Dezembro")).toBeTruthy();
    expect(within(table).getByText("-R$ 150,00")).toBeTruthy();
    const januaryRow = table.querySelector('[data-month="2026-01"]');
    const januaryReceived = januaryRow.querySelector('[data-field="received"]');
    const januaryPaidExpenses = januaryRow.querySelector('[data-field="paidExpenses"]');
    const januaryResult = januaryRow.querySelector('[data-field="currentResult"]');
    const januaryBar = container.querySelector('rect[data-month="2026-01"]');
    const januaryLabel = container.querySelector('text[data-month="2026-01"]');

    expect(januaryReceived).toHaveTextContent("R$ 1.234,56");
    expect(januaryPaidExpenses).toHaveTextContent("R$ 234,56");
    expect(januaryResult).toHaveTextContent("R$ 1.000,00");
    expect(januaryResult).toHaveAttribute("data-primary-metric", "true");
    expect(table.querySelectorAll('thead th[data-primary-metric="true"]')).toHaveLength(1);
    expect(table.querySelectorAll('tbody td[data-primary-metric="true"]')).toHaveLength(12);
    expect(januaryBar).toHaveAttribute("data-value-cents", "100000");
    expect(januaryLabel).toHaveAttribute("data-value-cents", "100000");
    expect(januaryLabel.textContent).toBe(januaryResult.textContent);

    const februaryRow = table.querySelector('[data-month="2026-02"]');
    const februaryResult = februaryRow.querySelector('[data-field="currentResult"]');
    const februaryBar = container.querySelector('rect[data-month="2026-02"]');
    const februaryLabel = container.querySelector('text[data-month="2026-02"]');
    expect(februaryResult).toHaveTextContent("-R$ 150,00");
    expect(februaryBar).toHaveAttribute("data-value-cents", "-15000");
    expect(februaryLabel.textContent).toBe(februaryResult.textContent);
    expect(container.querySelectorAll('[data-sign="positive"]')).toHaveLength(1);
    expect(container.querySelectorAll('[data-sign="negative"]')).toHaveLength(1);

    const annualTotal = table.querySelector('[data-annual-total="true"]');
    expect(annualTotal.querySelector('[data-field="received"]')).toHaveTextContent("R$ 600,00");
    expect(annualTotal.querySelector('[data-field="paidExpenses"]')).toHaveTextContent("R$ 450,00");
    expect(annualTotal.querySelector('[data-field="currentResult"]')).toHaveTextContent("R$ 150,00");
  });

  it("oculta completamente a geometria financeira do gráfico", () => {
    const { container } = renderOverview({
      summary: {
        received: 50000,
        receivable: 0,
        paidExpenses: 20000,
        pendingExpenses: 0,
        currentResult: 30000,
        pendingBalance: 0,
      },
      months: buildAnnualMonths({
        1: { received: 50000, paidExpenses: 20000, currentResult: 30000 },
      }),
      hasMonthlyBreakdown: true,
      hasMovement: true,
    }, "year", false);

    expect(screen.queryByRole("img", { name: "Resultado financeiro por mês" })).toBeNull();
    expect(screen.getByText("Mostre os valores financeiros para visualizar o gráfico."))
      .toBeTruthy();
    expect(screen.getAllByText("R$ ••••").length).toBeGreaterThan(6);
    expect(within(screen.getByRole("region", { name: "Resumo financeiro anual" }))
      .getAllByText("R$ ••••")).toHaveLength(6);
    expect(within(screen.getByRole("table", { name: "Evolução financeira mensal" }))
      .getAllByText("R$ ••••")).toHaveLength(21);
    expect(container.querySelector("[data-value-cents]")).toBeNull();
  });

  it("distingue meses realizados, futuro sem movimento e futuro com movimento no ano atual", () => {
    const months = buildAnnualMonths({
      8: { received: 50000, paidExpenses: 50000, currentResult: 0 },
    });
    const { container } = renderOverview({
      summary: {
        received: 50000,
        receivable: 0,
        paidExpenses: 50000,
        pendingExpenses: 0,
        currentResult: 0,
        pendingBalance: 0,
      },
      months,
      hasMonthlyBreakdown: true,
      hasMovement: true,
    }, "year");

    const table = screen.getByRole("table", { name: "Evolução financeira mensal" });
    const mayRow = table.querySelector('[data-month="2026-05"]');
    const juneRow = table.querySelector('[data-month="2026-06"]');
    const julyRow = table.querySelector('[data-month="2026-07"]');
    const augustRow = table.querySelector('[data-month="2026-08"]');

    expect(within(mayRow).getAllByText("R$ 0,00")).toHaveLength(3);
    expect(juneRow).toHaveAttribute("data-current-month", "true");
    expect(within(juneRow).getAllByText("R$ 0,00")).toHaveLength(3);
    expect(within(juneRow).getByText("Atual")).toBeTruthy();
    expect(julyRow).toHaveAttribute("data-future-empty", "true");
    expect(within(julyRow).getAllByText("—")).toHaveLength(3);
    expect(augustRow).not.toHaveAttribute("data-future-empty");
    expect(within(augustRow).getAllByText("R$ 500,00")).toHaveLength(2);
    expect(within(augustRow).getByText("R$ 0,00")).toBeTruthy();

    const chart = screen.getByRole("img", { name: "Resultado financeiro por mês" });
    const currentChartMonth = chart.querySelector('g[data-current-month="true"]');
    const futureEmptyChartMonth = chart.querySelector('g[data-month="2026-07"]');
    expect(currentChartMonth).toHaveAttribute("data-month", "2026-06");
    expect(within(currentChartMonth).getByText("Atual")).toBeTruthy();
    expect(currentChartMonth.querySelector('[data-current-axis-marker="true"]')).toBeTruthy();
    expect(chart.querySelectorAll('[data-current-axis-marker="true"]')).toHaveLength(1);
    expect(chart.querySelectorAll('g[data-current-month="true"]')).toHaveLength(1);
    expect(table.querySelectorAll('[data-current-month="true"]')).toHaveLength(1);
    expect(futureEmptyChartMonth).toHaveAttribute("data-future-empty", "true");
    expect(within(futureEmptyChartMonth).getByText("—")).toBeTruthy();
    expect(futureEmptyChartMonth.querySelector("rect[data-value-cents]")).toBeNull();
    expect(futureEmptyChartMonth.querySelector("text[data-value-cents]")).toBeNull();
    expect(container.querySelector('rect[data-month="2026-08"]'))
      .toHaveAttribute("data-value-cents", "0");
    expect(container.querySelector('text[data-month="2026-08"]'))
      .toHaveTextContent("R$ 0,00");
  });

  it("mantém zeros e não destaca mês atual em ano histórico", () => {
    renderOverview({
      summary: {
        received: 0,
        receivable: 0,
        paidExpenses: 0,
        pendingExpenses: 0,
        currentResult: 0,
        pendingBalance: 0,
      },
      months: buildAnnualMonths({}, "2025"),
      hasMonthlyBreakdown: true,
      hasMovement: false,
    }, "year", true, { overviewYear: "2025" });

    const table = screen.getByRole("table", { name: "Evolução financeira mensal" });
    const decemberRow = table.querySelector('[data-month="2025-12"]');
    const chart = screen.getByRole("img", { name: "Resultado financeiro por mês" });
    expect(within(decemberRow).getAllByText("R$ 0,00")).toHaveLength(3);
    expect(within(table).queryByText("—")).toBeNull();
    expect(table.querySelector('[data-current-month="true"]')).toBeNull();
    expect(chart.querySelector('g[data-current-month="true"]')).toBeNull();
    expect(chart.querySelector('[data-current-axis-marker="true"]')).toBeNull();
    expect(screen.getByText("Todos os resultados realizados do ano são R$ 0,00.")).toBeTruthy();
    expect(within(chart).getAllByText("R$ 0,00")).toHaveLength(12);
  });

  it("mantém resumo anual e falha de forma controlada sem months válido", () => {
    renderOverview({
      summary: {
        received: 50000,
        receivable: 0,
        paidExpenses: 20000,
        pendingExpenses: 0,
        currentResult: 30000,
        pendingBalance: 0,
      },
      months: [],
      hasMonthlyBreakdown: false,
      hasMovement: true,
    }, "year");

    expect(screen.getByText("Resumo do ano")).toBeTruthy();
    expect(screen.getByText("Não foi possível carregar a evolução mensal deste ano."))
      .toBeTruthy();
    expect(screen.queryByRole("table", { name: "Evolução financeira mensal" })).toBeNull();
  });
});
