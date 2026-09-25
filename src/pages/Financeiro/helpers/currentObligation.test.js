/* eslint-env jest */
import currentObligationCents from "./currentObligation";

describe("Valor da obrigação atual, separado do original", () => {
  it.each([
    [10801, 0, "paid", 10801],
    [5000, 5801, "partial", 10801],
    [0, 10801, "pending", 10801],
    [5000, 7100, "partial", 12100],
    [0, 0, "paid", 0],
    [5000, 6100, "canceled", 0],
  ])("paid=%i open=%i status=%s => %i", (paid, open, status, expected) => {
    expect(currentObligationCents({ paid, open }, 11100, status)).toBe(expected);
  });
  it("usa o consolidado de todas as parcelas, não apenas a primeira", () => {
    const installments = [{ paid: 3000, open: 0 }, { paid: 1000, open: 3000 }, { paid: 0, open: 2000 }];
    const totals = installments.reduce((sum, part) => ({ paid: sum.paid + part.paid, open: sum.open + part.open }), { paid: 0, open: 0 });
    expect(currentObligationCents(totals, 11100, "partial")).toBe(9000);
  });
  it("mantém fallback nominal apenas quando não existe projeção", () => {
    expect(currentObligationCents(null, 11100, "pending")).toBe(11100);
    expect(currentObligationCents({ paid: null, open: null }, 11100, "pending")).toBe(11100);
  });
  it("respeita projeções de parcelas com acréscimo e cancelamento, sem limitar ao nominal", () => {
    const financial = { paid: 11100, open: 0, installments: [
      { paid_amount_cents: 12100, open_amount_cents: 0, status: "paid" },
      { paid_amount_cents: 0, open_amount_cents: 1000, status: "canceled" },
    ] };
    expect(currentObligationCents(financial, 11100, "paid")).toBe(12100);
  });
});
