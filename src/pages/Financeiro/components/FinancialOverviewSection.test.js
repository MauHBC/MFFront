import React from "react";
import { render, screen } from "@testing-library/react";
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
  AttendanceTabGroup: passthrough(),
  AttendanceTabButton:
    // eslint-disable-next-line react/prop-types
    ({ children, onClick, type }) => (
      <button type={type} onClick={onClick}>
        {children}
      </button>
    ),
  AttendancePeriodControls: passthrough(),
  AttendancePeriodButton:
    // eslint-disable-next-line react/prop-types
    ({ children, onClick, type }) => (
      <button type={type} onClick={onClick}>
        {children}
      </button>
    ),
  AttendancePeriodChip: passthrough("span"),
  AttendancePeriodMonthInput:
    // eslint-disable-next-line react/prop-types
    ({ value, onChange }) => (
      <input aria-label="Selecionar mês e ano" type="month" value={value} onChange={onChange} />
    ),
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
};

const formatCurrency = (value) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(value || 0) / 100);

const renderOverview = (overview) =>
  render(
    <FinancialOverviewSection
      ui={ui}
      loading={false}
      overview={overview}
      overviewMonth="2026-06"
      overviewMonthLabel="junho de 2026"
      overviewPeriodMode="month"
      formatCurrency={formatCurrency}
      handleOverviewMonthChange={jest.fn()}
      handleOverviewPeriodModeChange={jest.fn()}
      handleOverviewPreviousMonth={jest.fn()}
      handleOverviewNextMonth={jest.fn()}
    />,
  );

describe("FinancialOverviewSection", () => {
  it("renderiza os seis valores do resumo formatados", () => {
    renderOverview({
      summary: {
        received: 125000,
        receivable: 75000,
        paidExpenses: 30000,
        pendingExpenses: 50000,
        currentBalance: 95000,
        forecastBalance: 25000,
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
  });

  it("mantem valores negativos formatados e nao exibe valores crus", () => {
    const { container } = renderOverview({
      summary: {
        received: 10000,
        receivable: 20000,
        paidExpenses: 30000,
        pendingExpenses: 50000,
        currentBalance: -20000,
        forecastBalance: -30000,
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
});
