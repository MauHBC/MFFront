/* eslint-disable react/prop-types */
import React from "react";

export default function FinancialOverviewSection({
  ui,
  loading,
  overview,
  overviewMonth,
  overviewMonthLabel,
  overviewPeriodMode,
  formatCurrency,
  handleOverviewMonthChange,
  handleOverviewPeriodModeChange,
  handleOverviewPreviousMonth,
  handleOverviewNextMonth,
}) {
  const {
    Spinner,
    AttendanceSectionSurface,
    AttendancePeriodBlock,
    AttendancePeriodBlockLeft,
    AttendancePeriodBlockLabel,
    AttendancePeriodBlockValue,
    AttendancePeriodBlockRight,
    AttendanceTabGroup,
    AttendanceTabButton,
    AttendancePeriodControls,
    AttendancePeriodButton,
    AttendancePeriodChip,
    AttendancePeriodMonthInput,
    AttendanceCard,
    AttendanceCardHeader,
    AttendanceCardTitle,
    OverviewSummaryGrid,
    OverviewSummaryColumn,
    OverviewSummaryHeader,
    AttendanceMetricCard,
    AttendanceMetricLabel,
    AttendanceMetricValue,
    AttendanceEmptyState,
    BlockLoader,
  } = ui;

  const pendingExpenses = (overview.expenses?.open || 0) + (overview.expenses?.overdue || 0);
  const currentBalance = (overview.revenues?.received || 0) - (overview.expenses?.paid || 0);
  const summary = overview.summary || {
    received: overview.revenues?.received || 0,
    receivable: overview.revenues?.pending || 0,
    paidExpenses: overview.expenses?.paid || 0,
    pendingExpenses,
    currentBalance,
    forecastBalance: (overview.revenues?.pending || 0) - pendingExpenses,
  };

  return (
    <AttendanceSectionSurface>
      <AttendancePeriodBlock>
        <AttendancePeriodBlockLeft>
          <AttendancePeriodBlockLabel>Competência financeira</AttendancePeriodBlockLabel>
          <AttendancePeriodBlockValue>{overviewMonthLabel}</AttendancePeriodBlockValue>
        </AttendancePeriodBlockLeft>
        <AttendancePeriodBlockRight>
          <AttendanceTabGroup>
            <AttendanceTabButton
              type="button"
              $active={overviewPeriodMode === "month"}
              onClick={() => handleOverviewPeriodModeChange("month")}
            >
              Mês
            </AttendanceTabButton>
            <AttendanceTabButton
              type="button"
              $active={overviewPeriodMode === "year"}
              onClick={() => handleOverviewPeriodModeChange("year")}
            >
              Visão anual
            </AttendanceTabButton>
          </AttendanceTabGroup>
          <AttendancePeriodControls>
            <AttendancePeriodButton type="button" onClick={handleOverviewPreviousMonth}>
              {"< Anterior"}
            </AttendancePeriodButton>
            <AttendancePeriodChip>
              {overviewMonthLabel}
              {overviewPeriodMode === "month" ? (
                <AttendancePeriodMonthInput
                  aria-label="Selecionar mês e ano"
                  type="month"
                  value={overviewMonth}
                  onChange={handleOverviewMonthChange}
                />
              ) : null}
            </AttendancePeriodChip>
            <AttendancePeriodButton type="button" onClick={handleOverviewNextMonth}>
              {"Próximo >"}
            </AttendancePeriodButton>
          </AttendancePeriodControls>
        </AttendancePeriodBlockRight>
      </AttendancePeriodBlock>

      {loading ? (
        <BlockLoader>
          <Spinner />
          Carregando financeiro...
        </BlockLoader>
      ) : (
        <>
          <AttendanceCard>
            <AttendanceCardHeader>
              <AttendanceCardTitle>Resumo do mês</AttendanceCardTitle>
            </AttendanceCardHeader>
            <OverviewSummaryGrid>
              <OverviewSummaryColumn $variant="current">
                <OverviewSummaryHeader>Atual</OverviewSummaryHeader>
                <AttendanceMetricCard>
                  <AttendanceMetricLabel>Recebido</AttendanceMetricLabel>
                  <AttendanceMetricValue>{formatCurrency(summary.received)}</AttendanceMetricValue>
                </AttendanceMetricCard>
                <AttendanceMetricCard>
                  <AttendanceMetricLabel>Despesas pagas</AttendanceMetricLabel>
                  <AttendanceMetricValue>{formatCurrency(summary.paidExpenses)}</AttendanceMetricValue>
                </AttendanceMetricCard>
                <AttendanceMetricCard $summaryFinal>
                  <AttendanceMetricLabel>Resultado do mês atual</AttendanceMetricLabel>
                  <AttendanceMetricValue>{formatCurrency(summary.currentBalance)}</AttendanceMetricValue>
                </AttendanceMetricCard>
              </OverviewSummaryColumn>

              <OverviewSummaryColumn $variant="pending">
                <OverviewSummaryHeader>Pendente</OverviewSummaryHeader>
                <AttendanceMetricCard>
                  <AttendanceMetricLabel>A receber</AttendanceMetricLabel>
                  <AttendanceMetricValue>{formatCurrency(summary.receivable)}</AttendanceMetricValue>
                </AttendanceMetricCard>
                <AttendanceMetricCard>
                  <AttendanceMetricLabel>Despesas pendentes</AttendanceMetricLabel>
                  <AttendanceMetricValue>{formatCurrency(summary.pendingExpenses)}</AttendanceMetricValue>
                </AttendanceMetricCard>
                <AttendanceMetricCard $summaryFinal>
                  <AttendanceMetricLabel>Saldo pendente</AttendanceMetricLabel>
                  <AttendanceMetricValue>{formatCurrency(summary.forecastBalance)}</AttendanceMetricValue>
                </AttendanceMetricCard>
              </OverviewSummaryColumn>
            </OverviewSummaryGrid>
          </AttendanceCard>

          {!overview.hasMovement ? (
            <AttendanceEmptyState>
              <p>Nenhuma movimentação encontrada para este mês.</p>
            </AttendanceEmptyState>
          ) : null}
        </>
      )}
    </AttendanceSectionSurface>
  );
}
