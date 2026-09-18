export const requiresExpenseSettlementAdjustment = (paidAmount, obligationAmountCents) =>
  Number.isFinite(paidAmount) && paidAmount > 0
  && Math.round(paidAmount * 100) !== obligationAmountCents;

export const buildClinicExpensePaymentInput = ({ form, paidAmount, obligationAmountCents }) => {
  if (!form.paid_at) return { error: "Informe a data do pagamento." };
  if (!Number.isFinite(paidAmount) || paidAmount <= 0) {
    return { error: "Informe o valor pago." };
  }
  const adjusted = !form.expense?.paid_at
    && requiresExpenseSettlementAdjustment(paidAmount, obligationAmountCents);
  if (adjusted && !form.adjusted_final_confirmed) {
    return { error: "Confirme que o valor informado quita integralmente a despesa." };
  }
  const reason = String(form.settlement_reason || "").trim();
  if (adjusted && !reason) return { error: "Informe o motivo da quitação com valor diferente." };
  return {
    payload: {
      paid_at: form.paid_at,
      paid_amount_cents: Math.round(paidAmount * 100),
      payment_notes: String(form.payment_notes || "").trim() || null,
      ...(adjusted ? { settlement_type: "adjusted_final", reason } : {}),
    },
  };
};
