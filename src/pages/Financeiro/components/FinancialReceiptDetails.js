import React, { useEffect, useState } from "react";
import PropTypes from "prop-types";
import styled from "styled-components";
import { getFinancialReceiptDetails } from "../../../services/financial";

export default function FinancialReceiptDetails({ paymentId, formatCurrency }) {
  const [state, setState] = useState({ loading: true });
  useEffect(() => {
    let active = true;
    setState({ loading: true });
    getFinancialReceiptDetails(paymentId).then((response) => {
      if (active) setState({ details: response.data?.receipt_details });
    }).catch(() => {
      if (active) setState({ error: true });
    });
    return () => { active = false; };
  }, [paymentId]);
  if (state.loading) return <p>Carregando detalhes...</p>;
  if (state.error) return <p role="alert">Não foi possível consultar os detalhes deste recebimento.</p>;
  const detail = state.details;
  if (detail?.credit_only) return <Container><p>Recebido originalmente como crédito do paciente: {formatCurrency(detail.original_credit_cents)}.</p></Container>;
  const groups = detail?.groups || [];
  return <Container>
    {groups.length > 0 && <div role="list" aria-label="Detalhes do recebimento">
      {groups.map((group) => <p role="listitem" key={group.key || `${group.kind}-${group.service_name}-${group.reference_date}`}>
        {group.kind === "series" ? "Pacote" : "Avulsa"} · {String(group.reference_date || "").split("-").reverse().join("/")}
        {group.service_name && group.service_name !== "Cobrança" && ` · ${group.service_name}`}
        {` — ${formatCurrency(group.paid_cents)} pagos`}
        {group.discount_cents > 0 && ` · desconto de ${formatCurrency(group.discount_cents)}`}
      </p>)}
    </div>}
    {!groups.length && !(detail?.original_credit_cents > 0) && <p>Os registros disponíveis não comprovam a distribuição original deste recebimento.</p>}
    {detail?.original_credit_cents > 0 && <p>Originalmente deixado como crédito: {formatCurrency(detail.original_credit_cents)}.</p>}
  </Container>;
}
FinancialReceiptDetails.propTypes = {
  paymentId: PropTypes.number.isRequired,
  formatCurrency: PropTypes.func.isRequired,
};
const Container = styled.div`
  padding: 0;
  text-align: left;
  white-space: normal;
  overflow-wrap: anywhere;
  font-size: 13px;
  line-height: 1.45;
  p { margin: 2px 0; }
`;
