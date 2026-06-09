import React from "react";
import { render, screen, within } from "@testing-library/react";

import ClinicExpensesSection from "./ClinicExpensesSection";
import { getClinicExpenseObservation, getClinicExpensePaidAmountCents } from "../helpers/expenseFormatters";
import { getClinicExpenseStatus } from "../helpers/expenseStatus";

const Div = ({ children }) => <div>{children}</div>;
const Span = ({ children, $status: _status }) => <span>{children}</span>;
const Button = ({ children, $active: _active, ...props }) => <button type="button" {...props}>{children}</button>;

const ui = {
  Spinner: Span,
  AttendanceSectionSurface: Div,
  AttendancePeriodBlock: Div,
  AttendancePeriodBlockLeft: Div,
  AttendancePeriodBlockLabel: Span,
  AttendancePeriodBlockValue: Span,
  AttendancePeriodBlockRight: Div,
  AttendanceTabGroup: Div,
  AttendanceTabButton: Button,
  AttendancePeriodControls: Div,
  AttendancePeriodButton: Button,
  AttendancePeriodChip: Span,
  AttendancePeriodMonthInput: (props) => <input {...props} />,
  AttendanceCard: Div,
  AttendanceCardHeader: Div,
  AttendanceCardTitle: Span,
  AttendanceMetricsGrid: Div,
  AttendanceMetricCard: Div,
  AttendanceMetricLabel: Span,
  AttendanceMetricValue: Span,
  AttendanceFilterGrid: Div,
  AttendanceFilterField: Div,
  AttendanceFilterLabel: ({ children, ...props }) => <label {...props}>{children}</label>,
  AttendanceFilterSelect: (props) => <select {...props} />,
  AttendanceFilterInput: (props) => <input {...props} />,
  AttendanceTableCard: Div,
  AttendanceDetailHeader: Div,
  AttendanceDetailTitle: Span,
  AttendanceTableScroll: Div,
  AttendanceOverviewTable: ({ children }) => <table>{children}</table>,
  AttendanceCellStack: Div,
  AttendancePrimaryText: Span,
  AttendanceStatusBadge: Span,
  AttendanceRowActions: Div,
  AttendanceEmptyState: Div,
  AttendancePrimaryAction: Button,
  BlockLoader: Div,
  ActionMenu: Div,
  ActionMenuTrigger: Button,
  ActionMenuList: Div,
  ActionMenuItem: Button,
  closeActionMenu: () => {},
  handleActionMenuToggle: () => {},
};

const formatCurrency = (value) => (Number(value || 0) / 100).toLocaleString("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const formatDateOnlyBR = (value) => {
  const [year, month, day] = String(value || "").slice(0, 10).split("-");
  return `${day}/${month}/${year}`;
};

const normalizeCellText = (value) => String(value || "").replace(/\u00a0/g, " ");

const addDays = (daysToAdd) => {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + daysToAdd);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
};

const defaultProps = {
  ui,
  loading: false,
  clinicExpenses: [],
  clinicExpenseCategories: [],
  clinicExpensesSummary: {
    totalCents: 0,
    pendingCents: 0,
    paidCents: 0,
    overdueCents: 0,
  },
  clinicExpensesMonth: "2026-06",
  clinicExpensesMonthLabel: "Junho de 2026",
  clinicExpensesPeriodMode: "month",
  clinicExpensesFilters: {
    status: "all",
    category: "all",
    search: "",
  },
  clinicExpensePayingId: null,
  formatCurrency,
  formatDateOnlyBR,
  getClinicExpenseStatus,
  handleClinicExpenseMonthChange: () => {},
  handleClinicExpensesPeriodModeChange: () => {},
  handleClinicExpensesPreviousPeriod: () => {},
  handleClinicExpensesNextPeriod: () => {},
  handleClinicExpensesFilterChange: () => {},
  openClinicExpensePaymentModal: () => {},
  handleUnpayClinicExpense: () => {},
  openClinicExpenseModal: () => {},
  openClinicExpenseDeleteModal: () => {},
  getClinicExpenseObservation,
  getClinicExpensePaidAmountCents,
};

describe("ClinicExpensesSection", () => {
  it("mantem detalhes de pagamento e observacao apenas como excecoes dentro das colunas principais", () => {
    render(
      <ClinicExpensesSection
        {...defaultProps}
        clinicExpenses={[
          {
            id: 1,
            name: "Internet",
            category_name: "Sistemas",
            due_date: addDays(0),
            amount_cents: 1300,
            paid_at: `${addDays(0)}T12:00:00.000Z`,
            paid_amount_cents: 1300,
            notes: "Contrato anual",
            recurrence_type: "monthly",
          },
          {
            id: 2,
            name: "Energia",
            category_name: "Energia",
            due_date: addDays(0),
            amount_cents: 1300,
            paid_at: `${addDays(1)}T12:00:00.000Z`,
            paid_amount_cents: 1500,
            payment_notes: "Pago acima do previsto",
          },
          {
            id: 3,
            name: "Condominio",
            category_name: "Condominio",
            due_date: addDays(5),
            amount_cents: 25000,
            paid_at: null,
            paid_amount_cents: null,
          },
        ]}
        clinicExpensesSummary={{
          totalCents: 2600,
          pendingCents: 0,
          paidCents: 2800,
          overdueCents: 0,
        }}
      />,
    );

    expect(screen.queryByRole("columnheader", { name: "Valor pago" })).toBeNull();
    expect(screen.queryByRole("columnheader", { name: "Pago em" })).toBeNull();
    expect(screen.queryByRole("columnheader", { name: "Obs." })).toBeNull();
    expect(screen.queryByText("Recorrente mensal")).toBeNull();

    const internetRow = screen.getByRole("row", { name: /Internet/ });
    const internetCells = within(internetRow).getAllByRole("cell");
    const internetObservation = within(internetCells[0]).getByText("Obs.");

    expect(internetObservation.getAttribute("title")).toBe("Contrato anual");
    expect(normalizeCellText(internetCells[3].textContent)).toBe("R$ 13,00");
    expect(internetCells[3].textContent).not.toContain("Pago:");
    expect(within(internetCells[4]).queryByText(/em /)).toBeNull();

    const energiaRow = screen.getByRole("row", { name: /Energia/ });
    const energiaCells = within(energiaRow).getAllByRole("cell");
    const energiaObservation = within(energiaCells[0]).getByText("Obs.");

    expect(energiaObservation.getAttribute("title")).toBe("Pago acima do previsto");
    expect(normalizeCellText(energiaCells[3].textContent)).toContain("R$ 13,00");
    expect(normalizeCellText(energiaCells[3].textContent)).toContain("Pago: R$ 15,00");
    expect(within(energiaCells[4]).getByText(`em ${formatDateOnlyBR(addDays(1))}`)).toBeTruthy();

    const condominioRow = screen.getByRole("row", { name: /Condominio/ });
    const condominioCells = within(condominioRow).getAllByRole("cell");
    expect(within(condominioCells[2]).getByText("Vence em 5 dias")).toBeTruthy();
  });
});
