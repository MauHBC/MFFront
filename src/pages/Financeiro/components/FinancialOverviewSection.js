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
const SUMMARY_FIELDS = [
  "incomeTotal",
  "expenseTotal",
  "periodResult",
  "received",
  "receivable",
  "paidExpenses",
  "pendingExpenses",
];

export default function FinancialOverviewSection({
  ui,
  loading,
  error = "",
  overview = {},
  overviewTab = "summary",
  handleOverviewTabChange,
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
  const summaryTabRef = useRef(null);
  const receivedPaidTabRef = useRef(null);
  const distributionTabRef = useRef(null);
  const authorization = useAuthorization();
  const canSeeRealized = authorization.isAdministrator === true;
  const activeTab =
    canSeeRealized && ["received-paid", "distribution"].includes(overviewTab)
      ? overviewTab
      : "summary";
  useEffect(() => {
    if (activeTab !== overviewTab) handleOverviewTabChange?.(activeTab);
  }, [activeTab, overviewTab, handleOverviewTabChange]);
  const tabs = [
    { key: "summary", label: "Resumo", ref: summaryTabRef },
    ...(canSeeRealized
      ? [
          { key: "received-paid", label: "Recebido e pago", ref: receivedPaidTabRef },
          { key: "distribution", label: "Distribuição", ref: distributionTabRef },
        ]
      : []),
  ];
  const isAnnual = overviewPeriodMode === "year";
  const { summary } = overview;
  const hasSummary = summary && SUMMARY_FIELDS.every((field) => Number.isFinite(summary[field]));
  const summaryError =
    error || (!hasSummary ? "Não foi possível carregar as contas deste período." : "");
  const validCurrentDate =
    currentDate instanceof Date && !Number.isNaN(currentDate.getTime()) ? currentDate : new Date();
  const monthPresentations = (overview.months || []).map((item) => ({
    ...item,
    isCurrent:
      String(overviewYear) === String(validCurrentDate.getFullYear()) &&
      Number(String(item.month || "").slice(5, 7)) === validCurrentDate.getMonth() + 1,
  }));
  const summaryGroups = [
    {
      key: "income",
      label: "Receitas",
      items: [
        { key: "incomeTotal", label: "Total de receitas", emphasis: true },
        { key: "received", label: "Liquidado" },
        { key: "receivable", label: "A receber" },
      ],
    },
    {
      key: "expense",
      label: "Despesas",
      items: [
        { key: "expenseTotal", label: "Total de despesas", emphasis: true },
        { key: "paidExpenses", label: "Pago" },
        { key: "pendingExpenses", label: "A pagar" },
      ],
    },
  ];
  const handleTabKeyDown = (event, key) => {
    const position = tabs.findIndex((tab) => tab.key === key);
    let nextPosition = position;
    if (["ArrowLeft", "ArrowUp"].includes(event.key))
      nextPosition = (position + tabs.length - 1) % tabs.length;
    else if (["ArrowRight", "ArrowDown"].includes(event.key))
      nextPosition = (position + 1) % tabs.length;
    else if (event.key === "Home") nextPosition = 0;
    else if (event.key === "End") nextPosition = tabs.length - 1;
    else return;
    event.preventDefault();
    const nextTab = tabs[nextPosition];
    if (nextTab.key !== key) handleOverviewTabChange?.(nextTab.key);
    nextTab.ref.current?.focus();
  };

  return (
    <AttendanceSectionSurface>
      <OverviewModeNavigation aria-label="Visualização da visão geral financeira">
        <AttendanceTabGroup role="tablist" aria-label="Abas da visão geral">
          {tabs.map((tab) => (
            <AttendanceTabButton
              key={tab.key}
              ref={tab.ref}
              id={`financial-${tab.key}-tab`}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.key}
              aria-controls={`financial-${tab.key}-panel`}
              tabIndex={activeTab === tab.key ? 0 : -1}
              $active={activeTab === tab.key}
              onClick={() => handleOverviewTabChange?.(tab.key)}
              onKeyDown={(event) => handleTabKeyDown(event, tab.key)}
            >
              {tab.label}
            </AttendanceTabButton>
          ))}
        </AttendanceTabGroup>
      </OverviewModeNavigation>
      <div
        id={`financial-${activeTab}-panel`}
        role="tabpanel"
        aria-labelledby={`financial-${activeTab}-tab`}
        tabIndex={0}
      >
        {activeTab !== "summary" ? (
          <FinancialReceivedPaidSection
            ui={ui}
            view={activeTab}
            year={overviewYear}
            yearOptions={overviewYearOptions}
            onYearChange={handleOverviewYearChange}
            onPreviousYear={handleOverviewPreviousMonth}
            onNextYear={handleOverviewNextMonth}
            valuesVisible={financialValuesVisible}
            formatCurrency={formatCurrency}
            currentDate={currentDate}
          />
        ) : (
          <>
            <SummaryPeriodNavigation>
              <AttendanceTabGroup role="group" aria-label="Período do Resumo">
                <AttendanceTabButton
                  type="button"
                  aria-pressed={!isAnnual}
                  $active={!isAnnual}
                  onClick={() => handleOverviewPeriodModeChange("month")}
                >
                  Mensal
                </AttendanceTabButton>
                <AttendanceTabButton
                  type="button"
                  aria-pressed={isAnnual}
                  $active={isAnnual}
                  onClick={() => handleOverviewPeriodModeChange("year")}
                >
                  Anual
                </AttendanceTabButton>
              </AttendanceTabGroup>
            </SummaryPeriodNavigation>
            <AttendancePeriodBlock>
              <AttendancePeriodBlockLeft>
                <AttendancePeriodBlockLabel>
                  {isAnnual ? "Ano das contas" : "Mês das contas"}
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
                        aria-label="Selecionar ano do Resumo"
                        value={overviewYear}
                        onChange={handleOverviewYearChange}
                      >
                        {overviewYearOptions.map((year) => (
                          <option key={year} value={year}>
                            {year}
                          </option>
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
                        aria-label="Selecionar mês e ano do Resumo"
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
            <SummaryExplanation $color={attendancePalette.textSecondary}>
              Contas que pertencem ao período, considerando a data em que foram lançadas
            </SummaryExplanation>
            {loading && (
              <BlockLoader>
                <Spinner />
                Carregando contas do período...
              </BlockLoader>
            )}
            {!loading && summaryError && <div role="alert">{summaryError}</div>}
            {!loading && !summaryError && (
              <>
                <AttendanceCard>
                  <AttendanceCardHeader>
                    <AttendanceCardTitle>
                      {isAnnual ? "Contas do ano" : "Contas do mês"}
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
                              $palette={attendancePalette}
                            >
                              <dt>{item.label}</dt>
                              <dd>{formatCurrency(summary[item.key])}</dd>
                            </CompactSummaryRow>
                          ))}
                        </CompactSummaryList>
                      </CompactSummaryGroup>
                    ))}
                  </CompactSummaryGrid>
                  <CompactSummaryList>
                    <CompactSummaryRow
                      data-summary-field="periodResult"
                      $emphasis
                      $palette={attendancePalette}
                    >
                      <dt>Saldo das contas</dt>
                      <dd>{formatCurrency(summary.periodResult)}</dd>
                    </CompactSummaryRow>
                  </CompactSummaryList>
                </AttendanceCard>
                {isAnnual ? (
                  <AttendanceCard>
                    <EvolutionHeader>
                      <AttendanceCardTitle>Contas por mês</AttendanceCardTitle>
                      <EvolutionSubtitle $color={attendancePalette.textSecondary}>
                        Saldo das contas: receitas menos despesas de cada mês.
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
                            <AnnualOverviewTable aria-label="Contas por mês">
                              <thead>
                                <tr>
                                  <th>Mês</th>
                                  <th>Receitas</th>
                                  <th>Despesas</th>
                                  <th data-primary-metric="true">Saldo das contas</th>
                                </tr>
                              </thead>
                              <tbody>
                                {monthPresentations.map((item, index) => (
                                  <tr
                                    key={item.month}
                                    data-month={item.month}
                                    data-current-month={item.isCurrent ? "true" : undefined}
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
                                    <td data-field="incomeTotal">
                                      <AttendanceMoneyText>
                                        {formatCurrency(item.incomeTotal)}
                                      </AttendanceMoneyText>
                                    </td>
                                    <td data-field="expenseTotal">
                                      <AttendanceMoneyText>
                                        {formatCurrency(item.expenseTotal)}
                                      </AttendanceMoneyText>
                                    </td>
                                    <td data-field="periodResult" data-primary-metric="true">
                                      <AttendanceMoneyText>
                                        {formatCurrency(item.periodResult)}
                                      </AttendanceMoneyText>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                              <tfoot>
                                <tr data-annual-total="true">
                                  <td>Total do ano</td>
                                  <td data-field="incomeTotal">
                                    {formatCurrency(summary.incomeTotal)}
                                  </td>
                                  <td data-field="expenseTotal">
                                    {formatCurrency(summary.expenseTotal)}
                                  </td>
                                  <td data-field="periodResult" data-primary-metric="true">
                                    {formatCurrency(summary.periodResult)}
                                  </td>
                                </tr>
                              </tfoot>
                            </AnnualOverviewTable>
                          </AttendanceTableScroll>
                        </AttendanceTableCard>
                      </>
                    ) : (
                      <div role="alert">Não foi possível carregar as contas por mês deste ano.</div>
                    )}
                  </AttendanceCard>
                ) : null}
                {isAnnual && summary.hasAccounts === false ? (
                  <AttendanceEmptyState>
                    Nenhuma conta encontrada para este ano.
                  </AttendanceEmptyState>
                ) : null}
              </>
            )}
          </>
        )}
      </div>
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

  ${(props) =>
    props.$emphasis &&
    `
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

const EvolutionSubtitle = styled.p`
  margin: 5px 0 0;
  color: ${(props) => props.$color};
  font-size: 13px;
  line-height: 18px;
`;

const EvolutionChartBlock = styled.div`
  margin-bottom: 16px;
`;

const SummaryPeriodNavigation = styled.div`
  margin-bottom: 12px;
`;

const SummaryExplanation = styled.p`
  margin: 0 0 16px;
  color: ${(props) => props.$color};
  font-size: 13px;
  line-height: 18px;
`;
