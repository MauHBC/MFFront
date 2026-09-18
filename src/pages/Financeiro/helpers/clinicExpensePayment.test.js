import { buildClinicExpensePaymentInput } from "./clinicExpensePayment";

const input = (form = {}, paidAmount = 100) => buildClinicExpensePaymentInput({
  form: { paid_at: "2026-08-12", payment_notes: " Pix ", ...form },
  paidAmount,
  obligationAmountCents: 10000,
});

it("monta pagamento integral em centavos", () => {
  expect(input().payload).toEqual({
    paid_at: "2026-08-12", paid_amount_cents: 10000, payment_notes: "Pix",
  });
});

it.each([80, 120])("valor diferente %s exige confirmação e motivo", (amount) => {
  expect(input({}, amount).error).toMatch(/Confirme/);
  expect(input({ adjusted_final_confirmed: true }, amount).error).toMatch(/motivo/);
  expect(input({ adjusted_final_confirmed: true, settlement_reason: " Acordo " }, amount).payload)
    .toEqual({ paid_at: "2026-08-12", paid_amount_cents: amount * 100, payment_notes: "Pix", settlement_type: "adjusted_final", reason: "Acordo" });
});

it.each([0, -1, Number.NaN])("rejeita valor inválido %s", (amount) => {
  expect(input({}, amount).error).toMatch(/valor pago/);
});

it("exige data", () => {
  expect(input({ paid_at: "" }).error).toMatch(/data/);
});
