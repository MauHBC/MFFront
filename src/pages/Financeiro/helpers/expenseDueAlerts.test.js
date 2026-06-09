import {
  formatExpenseAlertCount,
  getExpenseDueAlertLabel,
  isExpenseDueAlert,
} from "./expenseDueAlerts";

const today = "2026-06-09";

describe("expenseDueAlerts", () => {
  it("nao mostra alerta para despesa paga", () => {
    const expense = {
      due_date: "2026-06-09",
      paid_at: "2026-06-09T12:00:00.000Z",
    };

    expect(isExpenseDueAlert(expense, today)).toBe(false);
    expect(getExpenseDueAlertLabel(expense, today)).toBe("");
  });

  it("mostra alerta para despesa vencida", () => {
    expect(getExpenseDueAlertLabel({ due_date: "2026-06-05" }, today)).toBe("Vencida há 4 dias");
  });

  it("mostra alerta para despesa vencendo hoje", () => {
    expect(getExpenseDueAlertLabel({ due_date: "2026-06-09" }, today)).toBe("Vence hoje");
  });

  it("mostra alerta para despesa vencendo amanha", () => {
    expect(getExpenseDueAlertLabel({ due_date: "2026-06-10" }, today)).toBe("Vence amanhã");
  });

  it("mostra alerta para despesa vencendo em 5 dias", () => {
    expect(getExpenseDueAlertLabel({ due_date: "2026-06-14" }, today)).toBe("Vence em 5 dias");
  });

  it("nao mostra alerta para despesa vencendo em 6 dias", () => {
    expect(isExpenseDueAlert({ due_date: "2026-06-15" }, today)).toBe(false);
    expect(getExpenseDueAlertLabel({ due_date: "2026-06-15" }, today)).toBe("");
  });

  it("formata badge do menu", () => {
    expect(formatExpenseAlertCount(0)).toBeNull();
    expect(formatExpenseAlertCount(3)).toBe("3");
    expect(formatExpenseAlertCount(100)).toBe("99+");
  });
});
