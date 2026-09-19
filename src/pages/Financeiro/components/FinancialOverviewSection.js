/* eslint-disable react/prop-types */
import React, { useEffect, useRef } from "react";
import styled from "styled-components";

import AnnualFinancialResultChart from "./AnnualFinancialResultChart";
import FinancialReceivedPaidSection from "./FinancialReceivedPaidSection";
import { useAuthorization } from "../../../contexts/AuthorizationContext";

const MONTH_NAMES = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

export default function FinancialOverviewSection({
  ui,
  loading,
  overview,
  overviewMonth,
  overviewYear,
  overviewYearOptions,
  overviewPeriodLabel,
  overviewPeriodMode,
  financialValuesVisible,
  formatCurrency,
  currentDate = new Date(),
  overviewMonthPickerRef,
  handleOverviewMonthChange,
  handleOverviewYearChange,
  handleOverviewPeriodTagClick,
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
    AttendancePeriodYearSelect,
    AttendanceCard,
    AttendanceCardHeader,
    AttendanceCardTitle,
    AttendanceEmptyState,
    BlockLoader,
    AttendanceTableCard,
    AttendanceTableScroll,
    AnnualOverviewTable,
    AttendanceMoneyText,
    attendancePalette,
  } = ui;

  const monthlyTabRef = useRef(null);
  const annualTabRef = useRef(null);
  const realizedTabRef = useRef(null);
  const authorization = useAuthorization();
  const canSeeRealized = authorization.isAdministrator === true;
  const isRealized = canSeeRealized && overviewPeriodMode === "realized";
  useEffect(() => {
    if (!canSeeRealized && overviewPeriodMode === "realized") {
      handleOverviewPeriodModeChange("month");
    }
  }, [canSeeRealized, overviewPeriodMode, handleOverviewPeriodModeChange]);
  const summary = overview.summary || {
    received: 0,
    receivable: 0,
    paidExpenses: 0,
    pendingExpenses: 0,
    currentResult: 0,
    pendingBalance: 0,
  };
  const isAnnual = overviewPeriodMode === "year";
  const activePanelId = isAnnual ? "financial-overview-annual-panel" : "financial-overview-monthly-panel";
  const activeTabId = isAnnual ? "financial-overview-annual-tab" : "financial-overview-monthly-tab";
  const validCurrentDate = currentDate instanceof Date && !Number.isNaN(currentDate.getTime())
    ? currentDate
    : new Date();
  const currentYear = String(validCurrentDate.getFullYear());
  const currentMonthNumber = validCurrentDate.getMonth() + 1;
  const isCurrentYearSelected = String(overviewYear) === currentYear;
  const monthPresentations = (overview.months || []).map((item) => {
    const monthNumber = Number(String(item.month || "").slice(5, 7));
    return {
      ...item,
      isCurrent: isCurrentYearSelected && monthNumber === currentMonthNumber,
      isFutureEmpty: isCurrentYearSelected
        && monthNumber > currentMonthNumber
        && Number(item.received) === 0
        && Number(item.paidExpenses) === 0,
    };
  });
  const summaryGroups = [
    {
      key: "current",
      label: "Atual",
      items: [
        { key: "received", label: "Recebido", value: summary.received },
        { key: "paidExpenses", label: "Despesas pagas", value: summary.paidExpenses },
        {
          key: "currentResult",
          label: isAnnual ? "Resultado do ano atual" : "Resultado do mês atual",
          value: summary.currentResult,
          emphasis: true,
        },
      ],
    },
    {
      key: "pending",
      label: "Pendente",
      items: [
        { key: "receivable", label: "A receber", value: summary.receivable },
        { key: "pendingExpenses", label: "Despesas pendentes", value: summary.pendingExpenses },
        {
          key: "pendingBalance",
          label: "Saldo pendente",
          value: summary.pendingBalance,
          emphasis: true,
        },
      ],
    },
  ];

  const handleModeKeyDown = (event, currentMode) => {
    const modes = canSeeRealized ? ["month", "year", "realized"] : ["month", "year"];
    const position = modes.indexOf(currentMode);
    let nextPosition = position;
    if (["ArrowLeft", "ArrowUp"].includes(event.key)) nextPosition = (position + modes.length - 1) % modes.length;
    else if (["ArrowRight", "ArrowDown"].includes(event.key)) nextPosition = (position + 1) % modes.length;
    else if (event.key === "Home") nextPosition = 0;
    else if (event.key === "End") nextPosition = modes.length - 1;
    else return;
    const nextMode = modes[nextPosition];
    event.preventDefault();
    if (nextMode === currentMode) return;
    handleOverviewPeriodModeChange(nextMode);
    ({ month: monthlyTabRef, year: annualTabRef, realized: realizedTabRef })[nextMode].current?.focus();
  };

  return (
    <AttendanceSectionSurface>
      <OverviewModeNavigation aria-label="Visualização da visão geral financeira">
        <AttendanceTabGroup role="tablist" aria-label="Período da visão geral">
          <AttendanceTabButton
            ref={monthlyTabRef}
            id="financial-overview-monthly-tab"
            type="button"
            role="tab"
            aria-selected={!isAnnual && !isRealized}
            aria-controls="financial-overview-monthly-panel"
            tabIndex={isAnnual || isRealized ? -1 : 0}
            $active={!isAnnual && !isRealized}
            onClick={() => handleOverviewPeriodModeChange("month")}
            onKeyDown={(event) => handleModeKeyDown(event, "month")}
          >
            Resumo mensal
          </AttendanceTabButton>
          <AttendanceTabButton
            ref={annualTabRef}
            id="financial-overview-annual-tab"
            type="button"
            role="tab"
            aria-selected={isAnnual}
            aria-controls="financial-overview-annual-panel"
            tabIndex={isAnnual ? 0 : -1}
            $active={isAnnual}
            onClick={() => handleOverviewPeriodModeChange("year")}
            onKeyDown={(event) => handleModeKeyDown(event, "year")}
          >
            Evolução anual
          </AttendanceTabButton>
          {canSeeRealized ? (
            <AttendanceTabButton
              ref={realizedTabRef}
              id="financial-realized-tab"
              type="button"
              role="tab"
              aria-selected={isRealized}
              aria-controls="financial-realized-panel"
              tabIndex={isRealized ? 0 : -1}
              $active={isRealized}
              onClick={() => handleOverviewPeriodModeChange("realized")}
              onKeyDown={(event) => handleModeKeyDown(event, "realized")}
            >
              Recebido e pago
            </AttendanceTabButton>
          ) : null}
        </AttendanceTabGroup>
      </OverviewModeNavigation>

      {isRealized ? (
        <div id="financial-realized-panel" role="tabpanel" aria-labelledby="financial-realized-tab" tabIndex={0}>
          <FinancialReceivedPaidSection
            ui={ui}
            year={overviewYear}
            yearOptions={overviewYearOptions}
            onYearChange={handleOverviewYearChange}
            onPreviousYear={handleOverviewPreviousMonth}
            onNextYear={handleOverviewNextMonth}
            valuesVisible={financialValuesVisible}
            formatCurrency={formatCurrency}
            currentDate={currentDate}
          />
        </div>
      ) : <div
        id={activePanelId}
        role="tabpanel"
        aria-labelledby={activeTabId}
        tabIndex={0}
      >
        <AttendancePeriodBlock>
          <AttendancePeriodBlockLeft>
            <AttendancePeriodBlockLabel>
              {isAnnual ? "Ano financeiro" : "Competência financeira"}
            </AttendancePeriodBlockLabel>
            <AttendancePeriodBlockValue>{overviewPeriodLabel}</AttendancePeriodBlockValue>
          </AttendancePeriodBlockLeft>
          <AttendancePeriodBlockRight>
            <AttendancePeriodControls>
              <AttendancePeriodButton type="button" onClick={handleOverviewPreviousMonth}>
                {isAnnual ? "< Ano anterior" : "< Anterior"}
              </AttendancePeriodButton>
              {isAnnual ? (
                <AttendancePeriodChip>
                  {overviewPeriodLabel}
                  <AttendancePeriodYearSelect
                    aria-label="Selecionar ano da evolução anual"
                    value={overviewYear}
                    onChange={handleOverviewYearChange}
                  >
                    {overviewYearOptions.map((year) => (
                      <option key={year} value={year}>{year}</option>
                    ))}
                  </AttendancePeriodYearSelect>
                </AttendancePeriodChip>
              ) : (
                <AttendancePeriodChip
                  role="button"
                  tabIndex={0}
                  onClick={handleOverviewPeriodTagClick}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      handleOverviewPeriodTagClick();
                    }
                  }}
                >
                  {overviewPeriodLabel}
                  <AttendancePeriodMonthInput
                    ref={overviewMonthPickerRef}
                    aria-label="Selecionar mês e ano do resumo mensal"
                    type="month"
                    value={overviewMonth}
                    onChange={handleOverviewMonthChange}
                  />
                </AttendancePeriodChip>
              )}
              <AttendancePeriodButton type="button" onClick={handleOverviewNextMonth}>
                {isAnnual ? "Próximo ano >" : "Próximo >"}
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
                <AttendanceCardTitle>
                  {isAnnual ? "Resumo do ano" : "Resumo do mês"}
                </AttendanceCardTitle>
              </AttendanceCardHeader>
              <CompactSummaryGrid
                aria-label={isAnnual ? "Resumo financeiro anual" : "Resumo financeiro mensal"}
                $palette={attendancePalette}
              >
                {summaryGroups.map((group) => (
                  <CompactSummaryGroup
                    key={group.key}
                    role="group"
                    aria-label={group.label}
                    data-summary-group={group.key}
                    $variant={group.key}
                    $palette={attendancePalette}
                  >
                    <CompactSummaryHeader $palette={attendancePalette}>
                      {group.label}
                    </CompactSummaryHeader>
                    <CompactSummaryList>
                      {group.items.map((item) => (
                        <CompactSummaryRow
                          key={item.key}
                          data-summary-field={item.key}
                          $emphasis={item.emphasis}
                          $variant={group.key}
                          $palette={attendancePalette}
                        >
                          <dt>{item.label}</dt>
                          <dd>{formatCurrency(item.value)}</dd>
                        </CompactSummaryRow>
                      ))}
                    </CompactSummaryList>
                  </CompactSummaryGroup>
                ))}
              </CompactSummaryGrid>
            </AttendanceCard>

            {isAnnual ? (
              <AttendanceCard>
                <EvolutionHeader>
                  <AttendanceCardTitle>Evolução mensal</AttendanceCardTitle>
                  <EvolutionSubtitle $color={attendancePalette.textSecondary}>
                    Resultado recebido menos despesas pagas em cada competência.
                  </EvolutionSubtitle>
                </EvolutionHeader>
                {overview.hasMonthlyBreakdown ? (
                  <>
                    <EvolutionChartBlock>
                      <AnnualFinancialResultChart
                        months={monthPresentations}
                        valuesVisible={financialValuesVisible}
                        formatCurrency={formatCurrency}
                        palette={attendancePalette}
                      />
                    </EvolutionChartBlock>
                    <AttendanceTableCard>
                      <AttendanceTableScroll>
                        <AnnualOverviewTable aria-label="Evolução financeira mensal">
                          <thead>
                            <tr>
                              <th>Mês</th>
                              <th>Recebido</th>
                              <th>Despesas pagas</th>
                              <th data-primary-metric="true">Resultado</th>
                            </tr>
                          </thead>
                          <tbody>
                            {monthPresentations.map((item, index) => (
                              <tr
                                key={item.month}
                                data-month={item.month}
                                data-current-month={item.isCurrent ? "true" : undefined}
                                data-future-empty={item.isFutureEmpty ? "true" : undefined}
                              >
                                <td>
                                  <MonthCellContent>
                                    <span>{MONTH_NAMES[index]}</span>
                                    {item.isCurrent ? (
                                      <CurrentMonthBadge $palette={attendancePalette}>
                                        Atual
                                      </CurrentMonthBadge>
                                    ) : null}
                                  </MonthCellContent>
                                </td>
                                <td data-field="received">
                                  {item.isFutureEmpty ? (
                                    <FutureMonthPlaceholder
                                      $color={attendancePalette.textMuted}
                                      aria-label="Sem movimentação realizada"
                                    >
                                      —
                                    </FutureMonthPlaceholder>
                                  ) : (
                                    <AttendanceMoneyText>{formatCurrency(item.received)}</AttendanceMoneyText>
                                  )}
                                </td>
                                <td data-field="paidExpenses">
                                  {item.isFutureEmpty ? (
                                    <FutureMonthPlaceholder
                                      $color={attendancePalette.textMuted}
                                      aria-label="Sem movimentação realizada"
                                    >
                                      —
                                    </FutureMonthPlaceholder>
                                  ) : (
                                    <AttendanceMoneyText>{formatCurrency(item.paidExpenses)}</AttendanceMoneyText>
                                  )}
                                </td>
                                <td data-field="currentResult" data-primary-metric="true">
                                  {item.isFutureEmpty ? (
                                    <FutureMonthPlaceholder
                                      $color={attendancePalette.textMuted}
                                      aria-label="Sem movimentação realizada"
                                    >
                                      —
                                    </FutureMonthPlaceholder>
                                  ) : (
                                    <AttendanceMoneyText>{formatCurrency(item.currentResult)}</AttendanceMoneyText>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot>
                            <tr data-annual-total="true">
                              <td>Acumulado anual</td>
                              <td data-field="received">{formatCurrency(summary.received)}</td>
                              <td data-field="paidExpenses">{formatCurrency(summary.paidExpenses)}</td>
                              <td data-field="currentResult" data-primary-metric="true">
                                {formatCurrency(summary.currentResult)}
                              </td>
                            </tr>
                          </tfoot>
                        </AnnualOverviewTable>
                      </AttendanceTableScroll>
                    </AttendanceTableCard>
                  </>
                ) : (
                  <AttendanceEmptyState>
                    Não foi possível carregar a evolução mensal deste ano.
                  </AttendanceEmptyState>
                )}
              </AttendanceCard>
            ) : null}

            {!overview.hasMovement ? (
              <AttendanceEmptyState>
                <p>
                  {isAnnual
                    ? "Nenhuma movimentação encontrada para este ano."
                    : "Nenhuma movimentação encontrada para este mês."}
                </p>
              </AttendanceEmptyState>
            ) : null}
          </>
        )}
      </div>}
    </AttendanceSectionSurface>
  );
}

const OverviewModeNavigation = styled.nav`
  margin-bottom: 16px;
`;

const CompactSummaryGrid = styled.section`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 18px;

  @media (max-width: 640px) {
    grid-template-columns: minmax(0, 1fr);
  }
`;

const CompactSummaryGroup = styled.div`
  min-width: 0;
  overflow: hidden;
  border: 1px solid ${(props) => props.$palette.border};
  border-radius: 12px;
  background: ${(props) => props.$palette.surface};
`;

const CompactSummaryHeader = styled.h4`
  margin: 0;
  padding: 8px 14px;
  border-bottom: 1px solid ${(props) => props.$palette.border};
  background: ${(props) => props.$palette.surfaceMuted};
  color: ${(props) => props.$palette.textTertiary};
  font-size: 12px;
  line-height: 16px;
  font-weight: 600;
  letter-spacing: 0.05em;
  text-transform: uppercase;
`;

const CompactSummaryList = styled.dl`
  margin: 0;
`;

const CompactSummaryRow = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 16px;
  min-height: 38px;
  padding: 8px 14px;
  border-top: 1px solid ${(props) => props.$palette.border};

  &:first-child {
    border-top: none;
  }

  dt {
    min-width: 0;
    color: ${(props) => props.$palette.textSecondary};
    font-size: 13px;
    line-height: 18px;
    font-weight: ${(props) => (props.$emphasis ? 600 : 500)};
  }

  dd {
    margin: 0;
    color: ${(props) => props.$palette.textPrimary};
    font-size: ${(props) => (props.$emphasis ? "15px" : "14px")};
    line-height: 20px;
    font-weight: ${(props) => (props.$emphasis ? 700 : 600)};
    text-align: right;
    white-space: nowrap;
  }

  ${(props) => props.$emphasis && `
    border-top-color: ${props.$palette.borderStrong};
    box-shadow: inset 3px 0 0 ${
  props.$variant === "pending" ? props.$palette.borderStrong : props.$palette.actionBorder
};
  `}

  @media (max-width: 420px) {
    gap: 10px;
    padding-inline: 12px;

    dt {
      font-size: 12px;
    }

    dd {
      font-size: ${(props) => (props.$emphasis ? "14px" : "13px")};
    }
  }
`;

const EvolutionHeader = styled.header`
  margin-bottom: 16px;
`;

const MonthCellContent = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 7px;
`;

const CurrentMonthBadge = styled.span`
  padding: 2px 6px;
  border: 1px solid ${(props) => props.$palette.actionBorder};
  border-radius: 999px;
  background: ${(props) => props.$palette.actionSoft};
  color: ${(props) => props.$palette.textSecondary};
  font-size: 10px;
  line-height: 14px;
  font-weight: 700;
  letter-spacing: 0.03em;
  text-transform: uppercase;
`;

const FutureMonthPlaceholder = styled.span`
  color: ${(props) => props.$color};
  font-weight: 600;
`;

const EvolutionSubtitle = styled.p`
  margin: 5px 0 0;
  color: ${(props) => props.$color};
  font-size: 13px;
  line-height: 18px;
`;

const EvolutionChartBlock = styled.div`
  margin-bottom: 16px;
`;
