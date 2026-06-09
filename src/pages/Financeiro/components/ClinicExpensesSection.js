/* eslint-disable react/prop-types */
import React from "react";
import { FaPlus } from "react-icons/fa";

import { getExpenseDueAlertLabel } from "../helpers/expenseDueAlerts";
import { formatClinicExpenseStatus } from "../helpers/expenseStatus";

export default function ClinicExpensesSection({
  ui,
  loading,
  clinicExpenses,
  clinicExpenseCategories,
  clinicExpensesSummary,
  clinicExpensesMonth,
  clinicExpensesMonthLabel,
  clinicExpensesPeriodMode,
  clinicExpensesFilters,
  clinicExpensePayingId,
  formatCurrency,
  formatDateOnlyBR,
  getClinicExpenseStatus,
  handleClinicExpenseMonthChange,
  handleClinicExpensesPeriodModeChange,
  handleClinicExpensesPreviousPeriod,
  handleClinicExpensesNextPeriod,
  handleClinicExpensesFilterChange,
  openClinicExpensePaymentModal,
  handleUnpayClinicExpense,
  openClinicExpenseModal,
  openClinicExpenseDeleteModal,
  getClinicExpenseObservation,
  getClinicExpensePaidAmountCents,
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
    AttendanceMetricsGrid,
    AttendanceMetricCard,
    AttendanceMetricLabel,
    AttendanceMetricValue,
    AttendanceFilterGrid,
    AttendanceFilterField,
    AttendanceFilterLabel,
    AttendanceFilterSelect,
    AttendanceFilterInput,
    AttendanceTableCard,
    AttendanceDetailHeader,
    AttendanceDetailTitle,
    AttendanceTableScroll,
    AttendanceOverviewTable,
    AttendanceCellStack,
    AttendancePrimaryText,
    AttendanceStatusBadge,
    AttendanceRowActions,
    AttendanceEmptyState,
    AttendancePrimaryAction,
    BlockLoader,
    ActionMenu,
    ActionMenuTrigger,
    ActionMenuList,
    ActionMenuItem,
    closeActionMenu,
    handleActionMenuToggle,
  } = ui;

  const categoryFilterOptions = [
    ...(clinicExpenseCategories || []),
    ...clinicExpenses
      .filter((expense) => !expense.category_id && (expense.category_name || expense.category))
      .map((expense) => ({
        id: `legacy:${expense.category_name || expense.category}`,
        name: expense.category_name || expense.category,
        active: true,
      })),
  ].filter((category, index, list) =>
    list.findIndex((item) => String(item.id) === String(category.id)) === index);

  const renderTable = () => {
    if (clinicExpenses.length === 0) {
      return (
        <AttendanceEmptyState>
          <p>Nenhuma despesa cadastrada neste mês.</p>
          <AttendancePrimaryAction type="button" onClick={() => openClinicExpenseModal()}>
            Cadastrar despesa
          </AttendancePrimaryAction>
        </AttendanceEmptyState>
      );
    }

    return (
      <AttendanceTableScroll>
        <AttendanceOverviewTable>
          <thead>
            <tr>
              <th>Despesa</th>
              <th>Categoria</th>
              <th>Vencimento</th>
              <th>Valor</th>
              <th>Status</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {clinicExpenses.map((entry) => {
              const status = getClinicExpenseStatus(entry);
              const isPaying = clinicExpensePayingId === entry.id;
              const observation = getClinicExpenseObservation(entry);
              const hasObservation = observation !== "-";
              const paidAmountCents = getClinicExpensePaidAmountCents(entry);
              const originalAmountCents = Number(entry.amount_cents || 0);
              const shouldShowPaidAmount = Boolean(entry.paid_at)
                && paidAmountCents !== originalAmountCents;
              const dueDateOnly = String(entry.due_date || "").slice(0, 10);
              const paidDateOnly = String(entry.paid_at || "").slice(0, 10);
              const shouldShowPaidDate = Boolean(entry.paid_at)
                && Boolean(paidDateOnly)
                && paidDateOnly !== dueDateOnly;
              const dueAlertLabel = getExpenseDueAlertLabel(entry);

              return (
                <tr key={entry.id}>
                  <td>
                    <AttendanceCellStack>
                      <AttendancePrimaryText>{entry.name || "-"}</AttendancePrimaryText>
                      {hasObservation ? (
                        <ClinicExpenseTableHint title={observation}>Obs.</ClinicExpenseTableHint>
                      ) : null}
                    </AttendanceCellStack>
                  </td>
                  <td>{entry.category_name || entry.category || "-"}</td>
                  <td>
                    <AttendanceCellStack>
                      <span>{formatDateOnlyBR(entry.due_date)}</span>
                      {dueAlertLabel ? (
                        <ClinicExpenseDueHint>{dueAlertLabel}</ClinicExpenseDueHint>
                      ) : null}
                    </AttendanceCellStack>
                  </td>
                  <td>
                    <AttendanceCellStack>
                      <strong>{formatCurrency(entry.amount_cents)}</strong>
                      {shouldShowPaidAmount ? (
                        <ClinicExpenseTableHint>
                          Pago: {formatCurrency(paidAmountCents)}
                        </ClinicExpenseTableHint>
                      ) : null}
                    </AttendanceCellStack>
                  </td>
                  <td>
                    <AttendanceCellStack>
                      <AttendanceStatusBadge $status={status}>
                        {formatClinicExpenseStatus(status)}
                      </AttendanceStatusBadge>
                      {shouldShowPaidDate ? (
                        <ClinicExpenseTableHint>em {formatDateOnlyBR(entry.paid_at)}</ClinicExpenseTableHint>
                      ) : null}
                    </AttendanceCellStack>
                  </td>
                  <td>
                    <AttendanceRowActions>
                      <ActionMenu onToggle={handleActionMenuToggle}>
                        <ActionMenuTrigger>Ações</ActionMenuTrigger>
                        <ActionMenuList>
                          {status !== "paid" ? (
                            <ActionMenuItem
                              type="button"
                              onClick={(event) => {
                                closeActionMenu(event);
                                openClinicExpensePaymentModal(entry);
                              }}
                              disabled={isPaying}
                            >
                              {isPaying ? "Salvando..." : "Marcar como pago"}
                            </ActionMenuItem>
                          ) : (
                            <>
                              <ActionMenuItem
                                type="button"
                                onClick={(event) => {
                                  closeActionMenu(event);
                                  openClinicExpensePaymentModal(entry);
                                }}
                                disabled={isPaying}
                              >
                                {isPaying ? "Salvando..." : "Editar pagamento"}
                              </ActionMenuItem>
                              <ActionMenuItem
                                type="button"
                                onClick={(event) => {
                                  closeActionMenu(event);
                                  handleUnpayClinicExpense(entry);
                                }}
                                disabled={isPaying}
                              >
                                {isPaying ? "Salvando..." : "Desfazer pagamento"}
                              </ActionMenuItem>
                            </>
                          )}
                          <ActionMenuItem
                            type="button"
                            onClick={(event) => {
                              closeActionMenu(event);
                              openClinicExpenseModal(entry);
                            }}
                          >
                            Editar
                          </ActionMenuItem>
                          <ActionMenuItem
                            type="button"
                            onClick={(event) => {
                              closeActionMenu(event);
                              openClinicExpenseDeleteModal(entry);
                            }}
                          >
                            Excluir
                          </ActionMenuItem>
                        </ActionMenuList>
                      </ActionMenu>
                    </AttendanceRowActions>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </AttendanceOverviewTable>
      </AttendanceTableScroll>
    );
  };

  return (
    <AttendanceSectionSurface>
      <AttendancePeriodBlock>
        <AttendancePeriodBlockLeft>
          <AttendancePeriodBlockLabel>Competência financeira</AttendancePeriodBlockLabel>
          <AttendancePeriodBlockValue>{clinicExpensesMonthLabel}</AttendancePeriodBlockValue>
        </AttendancePeriodBlockLeft>
        <AttendancePeriodBlockRight>
          <AttendanceTabGroup>
            <AttendanceTabButton
              type="button"
              $active={clinicExpensesPeriodMode === "month"}
              onClick={() => handleClinicExpensesPeriodModeChange("month")}
            >
              Mês
            </AttendanceTabButton>
            <AttendanceTabButton
              type="button"
              $active={clinicExpensesPeriodMode === "year"}
              onClick={() => handleClinicExpensesPeriodModeChange("year")}
            >
              Visão anual
            </AttendanceTabButton>
          </AttendanceTabGroup>
          <AttendancePeriodControls>
            <AttendancePeriodButton type="button" onClick={handleClinicExpensesPreviousPeriod}>
              {"< Anterior"}
            </AttendancePeriodButton>
            <AttendancePeriodChip>
              {clinicExpensesMonthLabel}
              {clinicExpensesPeriodMode === "month" ? (
                <AttendancePeriodMonthInput
                  aria-label="Selecionar mês e ano"
                  type="month"
                  value={clinicExpensesMonth}
                  onChange={handleClinicExpenseMonthChange}
                />
              ) : null}
            </AttendancePeriodChip>
            <AttendancePeriodButton type="button" onClick={handleClinicExpensesNextPeriod}>
              {"Próximo >"}
            </AttendancePeriodButton>
          </AttendancePeriodControls>
        </AttendancePeriodBlockRight>
      </AttendancePeriodBlock>

      {loading ? (
        <BlockLoader>
          <Spinner />
          Carregando despesas...
        </BlockLoader>
      ) : (
        <>
          <AttendanceCard>
            <AttendanceCardHeader>
              <AttendanceCardTitle>Resumo de despesas</AttendanceCardTitle>
            </AttendanceCardHeader>
            <AttendanceMetricsGrid>
              <AttendanceMetricCard>
                <AttendanceMetricLabel>Total do mês</AttendanceMetricLabel>
                <AttendanceMetricValue>{formatCurrency(clinicExpensesSummary.totalCents)}</AttendanceMetricValue>
              </AttendanceMetricCard>
              <AttendanceMetricCard>
                <AttendanceMetricLabel>Pendente</AttendanceMetricLabel>
                <AttendanceMetricValue>{formatCurrency(clinicExpensesSummary.pendingCents)}</AttendanceMetricValue>
              </AttendanceMetricCard>
              <AttendanceMetricCard>
                <AttendanceMetricLabel>Pago</AttendanceMetricLabel>
                <AttendanceMetricValue>{formatCurrency(clinicExpensesSummary.paidCents)}</AttendanceMetricValue>
              </AttendanceMetricCard>
              <AttendanceMetricCard>
                <AttendanceMetricLabel>Vencido</AttendanceMetricLabel>
                <AttendanceMetricValue>{formatCurrency(clinicExpensesSummary.overdueCents)}</AttendanceMetricValue>
              </AttendanceMetricCard>
            </AttendanceMetricsGrid>
          </AttendanceCard>

          <AttendanceCard>
            <AttendanceCardHeader>
              <AttendanceCardTitle>Filtros</AttendanceCardTitle>
            </AttendanceCardHeader>
            <AttendanceFilterGrid>
              <AttendanceFilterField>
                <AttendanceFilterLabel htmlFor="clinic-expenses-status">Status financeiro</AttendanceFilterLabel>
                <AttendanceFilterSelect
                  id="clinic-expenses-status"
                  name="status"
                  value={clinicExpensesFilters.status}
                  onChange={handleClinicExpensesFilterChange}
                >
                  <option value="all">Todos</option>
                  <option value="pending">Pendente</option>
                  <option value="paid">Pago</option>
                  <option value="overdue">Vencido</option>
                </AttendanceFilterSelect>
              </AttendanceFilterField>
              <AttendanceFilterField>
                <AttendanceFilterLabel htmlFor="clinic-expenses-category">Categoria</AttendanceFilterLabel>
                <AttendanceFilterSelect
                  id="clinic-expenses-category"
                  name="category"
                  value={clinicExpensesFilters.category}
                  onChange={handleClinicExpensesFilterChange}
                >
                  <option value="all">Todas</option>
                  {categoryFilterOptions.map((category) => (
                    <option key={category.id} value={category.id}>{category.name}</option>
                  ))}
                </AttendanceFilterSelect>
              </AttendanceFilterField>
              <AttendanceFilterField>
                <AttendanceFilterLabel htmlFor="clinic-expenses-search">Pesquisar despesa</AttendanceFilterLabel>
                <AttendanceFilterInput
                  id="clinic-expenses-search"
                  name="search"
                  placeholder="Nome da despesa"
                  value={clinicExpensesFilters.search}
                  onChange={handleClinicExpensesFilterChange}
                />
              </AttendanceFilterField>
            </AttendanceFilterGrid>
          </AttendanceCard>

          <AttendanceTableCard>
            <AttendanceDetailHeader style={{ padding: "16px 16px 0" }}>
              <AttendanceDetailTitle>Resumo de despesas — {clinicExpensesMonthLabel}</AttendanceDetailTitle>
              <AttendancePrimaryAction type="button" onClick={() => openClinicExpenseModal()}>
                <FaPlus />
                Nova despesa
              </AttendancePrimaryAction>
            </AttendanceDetailHeader>
            {renderTable()}
          </AttendanceTableCard>
        </>
      )}
    </AttendanceSectionSurface>
  );
}

function ClinicExpenseTableHint({ children, title }) {
  return (
    <span
      title={title}
      style={{
        display: "inline-block",
        maxWidth: 180,
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
        verticalAlign: "middle",
        color: "#7a7a7a",
        fontSize: 12,
        lineHeight: "16px",
      }}
    >
      {children}
    </span>
  );
}

function ClinicExpenseDueHint({ children }) {
  return (
    <span
      style={{
        display: "inline-block",
        width: "fit-content",
        maxWidth: 180,
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
        verticalAlign: "middle",
        color: "#9a2f2f",
        background: "rgba(190, 58, 58, 0.12)",
        borderRadius: 999,
        padding: "2px 8px",
        fontSize: 12,
        lineHeight: "16px",
      }}
    >
      {children}
    </span>
  );
}
