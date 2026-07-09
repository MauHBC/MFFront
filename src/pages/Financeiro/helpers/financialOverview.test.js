import { calculateFinancialOverview } from "./financialOverview";

const buildFinancialMap = (items) => new Map(items.map((item) => [item.id, item]));

describe("calculateFinancialOverview", () => {
  it("retorna zeros quando nao ha receitas nem despesas", () => {
    const overview = calculateFinancialOverview({ month: "2026-06" });

    expect(overview.revenues).toEqual({ expected: 0, received: 0, pending: 0 });
    expect(overview.expenses).toEqual({ total: 0, paid: 0, open: 0, overdue: 0 });
    expect(overview.result).toEqual({ expected: 0, realized: 0 });
    expect(overview.summary).toEqual({
      received: 0,
      receivable: 0,
      paidExpenses: 0,
      pendingExpenses: 0,
      currentBalance: 0,
      forecastBalance: 0,
    });
    expect(overview.hasMovement).toBe(false);
  });

  it("calcula receitas, despesas e resultados do mes", () => {
    const overview = calculateFinancialOverview({
      month: "2026-06",
      entries: [
        { id: 1, type: "income", amount_cents: 200000, reference_date: "2026-06-10" },
        { id: 2, type: "income", amount_cents: 90000, reference_date: "2026-07-01" },
      ],
      entryFinancialMap: buildFinancialMap([
        { id: 1, amount: 200000, paid: 125000, open: 75000, status: "partial" },
        { id: 2, amount: 90000, paid: 90000, open: 0, status: "paid" },
      ]),
      clinicExpensesSummary: {
        totalCents: 80000,
        paidCents: 30000,
        pendingCents: 20000,
        overdueCents: 30000,
      },
    });

    expect(overview.revenues).toEqual({ expected: 200000, received: 125000, pending: 75000 });
    expect(overview.expenses).toEqual({ total: 80000, paid: 30000, open: 20000, overdue: 30000 });
    expect(overview.result).toEqual({ expected: 120000, realized: 95000 });
    expect(overview.summary).toEqual({
      received: 125000,
      receivable: 75000,
      paidExpenses: 30000,
      pendingExpenses: 50000,
      currentBalance: 95000,
      forecastBalance: 25000,
    });
    expect(overview.hasMovement).toBe(true);
  });

  it("calcula resultado previsto e realizado positivo sem despesas", () => {
    const overview = calculateFinancialOverview({
      month: "2026-06",
      entries: [
        { id: 1, type: "income", amount_cents: 150000, reference_date: "2026-06-10" },
      ],
      entryFinancialMap: buildFinancialMap([
        { id: 1, amount: 150000, paid: 150000, open: 0, status: "paid" },
      ]),
    });

    expect(overview.result.expected).toBe(150000);
    expect(overview.result.realized).toBe(150000);
  });

  it("calcula resultado previsto e realizado negativo sem receitas", () => {
    const overview = calculateFinancialOverview({
      month: "2026-06",
      clinicExpensesSummary: {
        totalCents: 90000,
        paidCents: 70000,
        pendingCents: 20000,
        overdueCents: 0,
      },
    });

    expect(overview.revenues).toEqual({ expected: 0, received: 0, pending: 0 });
    expect(overview.result.expected).toBe(-90000);
    expect(overview.result.realized).toBe(-70000);
  });

  it("calcula resultado realizado com valor pago real da despesa", () => {
    const overview = calculateFinancialOverview({
      month: "2026-06",
      entries: [
        { id: 1, type: "income", amount_cents: 200000, reference_date: "2026-06-10" },
      ],
      entryFinancialMap: buildFinancialMap([
        { id: 1, amount: 200000, paid: 200000, open: 0, status: "paid" },
      ]),
      clinicExpensesSummary: {
        totalCents: 120000,
        paidCents: 90000,
        pendingCents: 0,
        overdueCents: 0,
      },
    });

    expect(overview.result.expected).toBe(80000);
    expect(overview.result.realized).toBe(110000);
  });

  it("usa R$ 15,00 como despesa paga quando valor original era R$ 13,00", () => {
    const overview = calculateFinancialOverview({
      month: "2026-06",
      entries: [
        { id: 1, type: "income", amount_cents: 5000, reference_date: "2026-06-10" },
      ],
      entryFinancialMap: buildFinancialMap([
        { id: 1, amount: 5000, paid: 5000, open: 0, status: "paid" },
      ]),
      clinicExpensesSummary: {
        totalCents: 1300,
        paidCents: 1500,
        pendingCents: 0,
        overdueCents: 0,
      },
    });

    expect(overview.expenses.total).toBe(1300);
    expect(overview.summary.paidExpenses).toBe(1500);
    expect(overview.summary.currentBalance).toBe(3500);
  });

  it("ignora despesas antigas em financial_entries e usa apenas despesas da clinica", () => {
    const overview = calculateFinancialOverview({
      month: "2026-06",
      entries: [
        { id: 1, type: "income", amount_cents: 200000, reference_date: "2026-06-10" },
        { id: 2, type: "expense", amount_cents: 999000, reference_date: "2026-06-12" },
      ],
      entryFinancialMap: buildFinancialMap([
        { id: 1, amount: 200000, paid: 200000, open: 0, status: "paid" },
        { id: 2, amount: 999000, paid: 999000, open: 0, status: "paid" },
      ]),
      clinicExpensesSummary: {
        totalCents: 50000,
        paidCents: 20000,
        pendingCents: 30000,
        overdueCents: 0,
      },
    });

    expect(overview.revenues).toEqual({ expected: 200000, received: 200000, pending: 0 });
    expect(overview.expenses).toEqual({ total: 50000, paid: 20000, open: 30000, overdue: 0 });
    expect(overview.result).toEqual({ expected: 150000, realized: 180000 });
  });

  it("soma mensalidades sem duplicar financial_entry vinculada", () => {
    const overview = calculateFinancialOverview({
      month: "2026-06",
      entries: [
        { id: 10, type: "income", amount_cents: 120000, reference_date: "2026-06-01" },
        { id: 11, type: "income", amount_cents: 50000, reference_date: "2026-06-15" },
      ],
      entryFinancialMap: buildFinancialMap([
        { id: 10, amount: 120000, paid: 70000, open: 50000, status: "partial" },
        { id: 11, amount: 50000, paid: 50000, open: 0, status: "paid" },
      ]),
      entryMap: buildFinancialMap([
        { id: 10, amount_cents: 120000, status: "pending" },
        { id: 11, amount_cents: 50000, status: "paid" },
      ]),
      billingCycles: [
        { id: 1, cycle_start: "2026-06-01", amount_cents: 120000, financial_entry_id: 10 },
      ],
    });

    expect(overview.revenues.expected).toBe(170000);
    expect(overview.revenues.received).toBe(120000);
    expect(overview.revenues.pending).toBe(50000);
  });

  it("ignora mensalidade marcada como sem cobranca", () => {
    const overview = calculateFinancialOverview({
      month: "2026-06",
      billingCycles: [
        {
          id: 1,
          cycle_start: "2026-06-01",
          amount_cents: 0,
          financial_entry_id: null,
          is_no_charge: true,
        },
      ],
    });

    expect(overview.revenues).toEqual({ expected: 0, received: 0, pending: 0 });
    expect(overview.summary.receivable).toBe(0);
    expect(overview.hasMovement).toBe(false);
  });

  it("soma apenas a ocorrencia de despesa recorrente do mes selecionado via summary recebido", () => {
    const june = calculateFinancialOverview({
      month: "2026-06",
      clinicExpensesSummary: { totalCents: 350000, paidCents: 0, pendingCents: 350000, overdueCents: 0 },
    });
    const july = calculateFinancialOverview({
      month: "2026-07",
      clinicExpensesSummary: { totalCents: 350000, paidCents: 350000, pendingCents: 0, overdueCents: 0 },
    });

    expect(june.expenses.total).toBe(350000);
    expect(july.expenses.total).toBe(350000);
    expect(june.result.expected).toBe(-350000);
    expect(july.result.realized).toBe(-350000);
  });

  it("ignora datas fora do mes e valores cancelados", () => {
    const overview = calculateFinancialOverview({
      month: "2026-06",
      entries: [
        { id: 1, type: "income", amount_cents: 100000, reference_date: "2026-06-05", status: "canceled" },
        { id: 2, type: "income", amount_cents: 200000, reference_date: "2026-07-05" },
      ],
      entryFinancialMap: buildFinancialMap([
        { id: 1, amount: 100000, paid: 100000, open: 0, status: "canceled" },
        { id: 2, amount: 200000, paid: 0, open: 200000, status: "pending" },
      ]),
      billingCycles: [
        { id: 1, cycle_start: "2026-07-01", amount_cents: 300000, status: "pending" },
      ],
    });

    expect(overview.revenues).toEqual({ expected: 0, received: 0, pending: 0 });
    expect(overview.hasMovement).toBe(false);
  });

  it("calcula resumo anual quando periodMode e year", () => {
    const overview = calculateFinancialOverview({
      month: "2026-06",
      periodMode: "year",
      entries: [
        { id: 1, type: "income", amount_cents: 100000, reference_date: "2026-01-10" },
        { id: 2, type: "income", amount_cents: 200000, reference_date: "2026-12-10" },
        { id: 3, type: "income", amount_cents: 300000, reference_date: "2027-01-10" },
      ],
      entryFinancialMap: buildFinancialMap([
        { id: 1, amount: 100000, paid: 100000, open: 0, status: "paid" },
        { id: 2, amount: 200000, paid: 50000, open: 150000, status: "partial" },
        { id: 3, amount: 300000, paid: 300000, open: 0, status: "paid" },
      ]),
      clinicExpensesSummary: {
        totalCents: 90000,
        paidCents: 40000,
        pendingCents: 30000,
        overdueCents: 20000,
      },
    });

    expect(overview.revenues).toEqual({ expected: 300000, received: 150000, pending: 150000 });
    expect(overview.summary).toEqual({
      received: 150000,
      receivable: 150000,
      paidExpenses: 40000,
      pendingExpenses: 50000,
      currentBalance: 110000,
      forecastBalance: 100000,
    });
  });
});
