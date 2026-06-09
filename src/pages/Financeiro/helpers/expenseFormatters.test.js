import {
  emptyClinicExpenseSummary,
  formatDateOnlyBR,
  formatCurrencyInput,
  getClinicExpenseObservation,
  getClinicExpensePaidAmountCents,
  normalizeClinicExpenseSummary,
  parseCurrencyInputToCents,
  sanitizePositiveCurrencyInput,
  shouldShowClinicExpensePaidAmount,
} from "./expenseFormatters";

describe("expenseFormatters", () => {
  it("converte moeda pt-BR para centavos", () => {
    expect(parseCurrencyInputToCents("3.500,00")).toBe(350000);
    expect(parseCurrencyInputToCents("3500")).toBe(350000);
    expect(parseCurrencyInputToCents("R$ 3.100,50")).toBe(310050);
    expect(parseCurrencyInputToCents("R$ 0,00")).toBe(0);
  });

  it("formata input monetario sem expor centavos crus", () => {
    expect(formatCurrencyInput("3500")).toBe("3.500,00");
    expect(formatCurrencyInput("0")).toBe("0,00");
  });

  it("sanitiza valores positivos", () => {
    expect(sanitizePositiveCurrencyInput("-3.500,00")).toBe("3500,00");
    expect(sanitizePositiveCurrencyInput("R$ 200,9a")).toBe("200,9");
  });

  it("normaliza summary vazio e preenchido", () => {
    expect(emptyClinicExpenseSummary).toEqual({
      totalCents: 0,
      pendingCents: 0,
      paidCents: 0,
      overdueCents: 0,
    });
    expect(normalizeClinicExpenseSummary({
      total_cents: 1000,
      open_cents: 200,
      paid_cents: 700,
      overdue_cents: 100,
    })).toEqual({
      totalCents: 1000,
      pendingCents: 200,
      paidCents: 700,
      overdueCents: 100,
    });
  });

  it("identifica valor pago diferente do valor original", () => {
    const expense = {
      amount_cents: 1300,
      paid_at: "2026-06-09T12:00:00.000Z",
      paid_amount_cents: 1500,
    };

    expect(getClinicExpensePaidAmountCents(expense)).toBe(1500);
    expect(shouldShowClinicExpensePaidAmount(expense)).toBe(true);
    expect(shouldShowClinicExpensePaidAmount({ ...expense, paid_amount_cents: 1300 })).toBe(false);
  });

  it("usa valor original como fallback para despesa paga antiga", () => {
    expect(getClinicExpensePaidAmountCents({
      amount_cents: 1300,
      paid_at: "2026-06-09T12:00:00.000Z",
      paid_amount_cents: null,
    })).toBe(1300);
    expect(getClinicExpensePaidAmountCents({
      amount_cents: 1300,
      paid_at: null,
      paid_amount_cents: null,
    })).toBe(0);
  });

  it("usa payment_notes na coluna Obs com fallback para notes", () => {
    expect(getClinicExpenseObservation({
      payment_notes: "Pago com desconto",
      notes: "Contrato anual",
    })).toBe("Pago com desconto");
    expect(getClinicExpenseObservation({ notes: "Contrato anual" })).toBe("Contrato anual");
    expect(getClinicExpenseObservation({})).toBe("-");
  });

  it("formata paid_at sem mudar o dia por timezone", () => {
    expect(formatDateOnlyBR("2026-06-09T00:30:00.000Z")).toBe("09/06/2026");
    expect(formatDateOnlyBR("2026-06-09")).toBe("09/06/2026");
  });
});
