import styled from "styled-components";

/**
 * Badges de status para o domínio financeiro.
 *
 * FinancialStatusPill — badge de status de cobrança/pagamento.
 *
 * Prop: $status
 * Valores:
 *   "paid"     → verde   (#e6efe0 / #4f6b45)
 *   "partial"  → azul    (#eef2ff / #4257a6)
 *   "canceled" → cinza   (#f3f3f3 / #6b6b6b)
 *   default    → laranja (#f6ece3 / #9a6a3a)  — pendente/aberto
 *
 * Uso:
 *   <FinancialStatusPill $status={entry.status}>
 *     {formatFinancialStatus(entry.status)}
 *   </FinancialStatusPill>
 */
export const FinancialStatusPill = styled.span`
  display: inline-block;
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  background: ${(p) => {
    if (p.$status === "paid") return "#e6efe0";
    if (p.$status === "partial") return "#eef2ff";
    if (p.$status === "canceled") return "#f3f3f3";
    return "#f6ece3";
  }};
  color: ${(p) => {
    if (p.$status === "paid") return "#4f6b45";
    if (p.$status === "partial") return "#4257a6";
    if (p.$status === "canceled") return "#6b6b6b";
    return "#9a6a3a";
  }};
`;
