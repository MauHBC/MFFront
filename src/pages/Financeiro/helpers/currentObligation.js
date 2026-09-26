// The nominal amount is retained separately. Never substitute only the money paid.
export function currentObligationFinancial(financial) {
  if (!financial?.installments?.length) return financial;
  const eligible = financial.installments.filter((part) => part.status !== "canceled");
  return { ...financial,
    paid: eligible.reduce((sum, part) => sum + Number(part.paid_amount_cents || 0), 0),
    open: eligible.reduce((sum, part) => sum + Number(part.open_amount_cents || 0), 0) };
}

export default function currentObligationCents(financial, originalCents, status) {
  if (status === "canceled" || financial?.status === "canceled") return 0;
  const current = currentObligationFinancial(financial);
  if (current?.paid != null && current?.open != null && Number.isFinite(Number(current.paid))
    && Number.isFinite(Number(current.open))) {
    return Number(current.paid) + Number(current.open);
  }
  return Number(originalCents || 0);
}
