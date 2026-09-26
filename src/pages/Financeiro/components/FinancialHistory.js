import React from "react";
import PropTypes from "prop-types";
import styled from "styled-components";

const labels = {
  RECEIPT: "Recebimento",
  CREDIT_APPLIED: "Uso de crédito",
  CANCELLATION: "Cancelamento da sessão",
  CREDIT_RELEASE: "Liberação de crédito",
  PAYMENT_CORRECTION: "Correção de recebimento",
};

export const formatFinancialEventDate = (value, { dateOnly = false, short = false } = {}) => {
  if (!value) return "Data não registrada";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Data não registrada";
  const options = { timeZone: /^\d{4}-\d{2}-\d{2}$/.test(value) ? "UTC" : "America/Sao_Paulo" };
  if (short) return date.toLocaleDateString("pt-BR", { ...options, day: "2-digit", month: "2-digit" });
  return dateOnly ? date.toLocaleDateString("pt-BR", options) : date.toLocaleString("pt-BR", options);
};

const detailDateLabels = {
  RECEIPT: "Recebido em",
  CREDIT_APPLIED: "Crédito usado em",
  CANCELLATION: "Cancelado em",
  CREDIT_RELEASE: "Crédito liberado em",
  PAYMENT_CORRECTION: "Corrigido em",
};

const formatDetailDate = (value) => {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value || "")) {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) {
      return `${date.toLocaleDateString("pt-BR", { timeZone: "UTC" })} (horário não registrado)`;
    }
  }
  return formatFinancialEventDate(value);
};

// Legacy compatibility presents real receipts without inventing other events.
const receiptEvents = (receipts) =>
  receipts.map(({ payment, amountCents, paymentMethodName }) => ({
    id: `receipt:${payment.id}`,
    type: "RECEIPT",
    amount_cents: amountCents,
    occurred_at: payment.paid_at,
    actor: null,
    reason: payment.note || null,
    source: { payment_id: payment.id },
    destination: null,
    historical_details_available: false,
    payment_method_name: paymentMethodName,
    voided: payment.voided === true,
  }));

const operationKey = (event) => {
  if (event.cancellation_resolution_id) return `resolution:${event.cancellation_resolution_id}`;
  if (event.operation_id) return `operation:${event.operation_id}`;
  return null;
};

// No matching by date, amount, patient, or charge. The server provides the
// operation relationship; each row retains its original events internally.
const historyRows = (events) => {
  const operations = new Map();
  events.forEach((event) => {
    if (!["CANCELLATION", "CREDIT_RELEASE"].includes(event.type)) return;
    const key = operationKey(event);
    if (!key) return;
    operations.set(key, [...(operations.get(key) || []), event]);
  });
  const rendered = new Set();
  return events.flatMap((event) => {
    const key = operationKey(event);
    const linked = operations.get(key) || [];
    const cancellations = linked.filter((item) => item.type === "CANCELLATION");
    const releases = linked.filter((item) => item.type === "CREDIT_RELEASE");
    if (!["CANCELLATION", "CREDIT_RELEASE"].includes(event.type)
      || cancellations.length !== 1 || !releases.length) {
      return [{ ...event, events: [event] }];
    }
    if (rendered.has(key)) return [];
    rendered.add(key);
    return [{
      ...cancellations[0],
      id: key,
      groupedCancellation: true,
      amount_cents: releases.every((item) => Number.isSafeInteger(item.amount_cents))
        ? releases.reduce((sum, item) => sum + item.amount_cents, 0) : null,
      events: [cancellations[0], ...releases],
    }];
  });
};

const referenceType = PropTypes.shape({
  payment_id: PropTypes.number,
  entry_id: PropTypes.number,
  installment_id: PropTypes.number,
  credit_movement_id: PropTypes.number,
  session_id: PropTypes.number,
  series_id: PropTypes.number,
  resolution_id: PropTypes.number,
  patient_id: PropTypes.number,
  payment_ids: PropTypes.arrayOf(PropTypes.number),
  entry_ids: PropTypes.arrayOf(PropTypes.number),
  credit_movement_ids: PropTypes.arrayOf(PropTypes.number),
  allocation_ids: PropTypes.arrayOf(PropTypes.number),
  kind: PropTypes.string,
  untraced_amount_cents: PropTypes.number,
});

const eventType = PropTypes.shape({
  id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  type: PropTypes.string.isRequired,
  amount_cents: PropTypes.number,
  occurred_at: PropTypes.string,
  session_id: PropTypes.number,
  session_starts_at: PropTypes.string,
  cancellation_resolution_id: PropTypes.number,
  operation_id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  applied_sessions: PropTypes.arrayOf(PropTypes.shape({
    session_id: PropTypes.number.isRequired,
    service_name: PropTypes.string,
    session_starts_at: PropTypes.string,
    amount_cents: PropTypes.number,
  })),
  actor: PropTypes.shape({
    name: PropTypes.string,
    user_id: PropTypes.number,
    membership_id: PropTypes.number,
  }),
  source: referenceType,
  destination: referenceType,
  reason: PropTypes.string,
  context: PropTypes.string,
  payment_method_name: PropTypes.string,
  historical_details_available: PropTypes.bool,
  voided: PropTypes.bool,
});

function EventDetails({ event, serviceName, formatCurrency }) {
  const isCreditUse = event.type === "CREDIT_APPLIED";
  const appliedSessions = isCreditUse && Array.isArray(event.applied_sessions) ? event.applied_sessions : [];
  const hideGenericObservation = isCreditUse && event.reason?.trim() === "Aplicação de crédito em cobrança";
  const hasSession = Boolean(event.session_id || event.session_starts_at);
  const sessionDescription = [serviceName, formatDetailDate(event.session_starts_at)]
    .filter(Boolean).join(" — ");
  const reasonLabel = ["RECEIPT", "CREDIT_APPLIED"].includes(event.type) ? "Observação" : "Motivo";
  return (
    <EventDetail>
      <dl>
        {isCreditUse && <>
          <dt>{appliedSessions.length > 1 ? "Sessões" : "Sessão"}</dt>
          <dd>{appliedSessions.length ? <AppliedSessionsList>
            {appliedSessions.map((session) => <li key={session.session_id}>
              <div>{[session.service_name?.trim(), formatDetailDate(session.session_starts_at)].filter(Boolean).join(" — ")}</div>
              <span>Crédito aplicado: <strong>{Number.isSafeInteger(session.amount_cents)
                ? formatCurrency(session.amount_cents) : "Valor não registrado"}</strong></span>
            </li>)}
          </AppliedSessionsList> : "Destino histórico indisponível"}</dd>
        </>}
        {!isCreditUse && hasSession && <><dt>Sessão</dt><dd>{sessionDescription}</dd></>}
        <dt>{detailDateLabels[event.type] || "Alterado em"}</dt><dd>{formatDetailDate(event.occurred_at)}</dd>
        <dt>Responsável</dt><dd>{event.actor?.name?.trim() || "Não registrado"}</dd>
        {!hideGenericObservation && <><dt>{reasonLabel}</dt><dd>{event.reason?.trim() || "Não registrado"}</dd></>}
      </dl>
    </EventDetail>
  );
}
EventDetails.propTypes = { event: eventType.isRequired, serviceName: PropTypes.string, formatCurrency: PropTypes.func.isRequired };
EventDetails.defaultProps = { serviceName: "" };

export default function FinancialHistory({ events, receipts, sessions, filter, formatCurrency }) {
  const sessionById = new Map(sessions.map((session) => [Number(session.id), session]));
  const receiptById = new Map(receipts.map((item) => [Number(item.payment.id), item]));
  const source = Array.isArray(events)
    ? events.map((event) => {
        const receipt = receiptById.get(Number(event.source?.payment_id));
        return event.type === "RECEIPT" && receipt ? {
          ...event,
          payment_method_name: event.payment_method_name || receipt.paymentMethodName,
          voided: event.voided === true || receipt.payment.voided === true,
        } : event;
      }) : receiptEvents(receipts);
  const unique = [...new Map(source.filter((event) => event?.id)
    .map((event) => [String(event.id), event])).values()];
  const displayed = historyRows(unique.filter((event) => filter === "all" || event.type === "RECEIPT"));
  const movementLabel = (row) => {
    const session = row.session_starts_at ? `Sessão de ${formatFinancialEventDate(row.session_starts_at, { short: true })}` : "Sessão";
    if (row.groupedCancellation) return `${session} cancelada — ${Number.isSafeInteger(row.amount_cents) ? `${formatCurrency(row.amount_cents)} liberados como crédito` : "crédito liberado"}`;
    if (row.type === "CANCELLATION") return `${session} cancelada`;
    if (row.type === "RECEIPT" && row.voided) return "Recebimento anulado";
    return labels[row.type] || "Movimento financeiro";
  };
  return (
    <HistorySection aria-label="Histórico financeiro do paciente">
      {displayed.length === 0 ? <p>Nenhum evento financeiro encontrado neste contexto.</p> : (
        <TableScroll>
          <HistoryTable>
            <thead><tr><th>Data</th><th>Movimento</th><th>Valor</th><th>Detalhes</th></tr></thead>
            <tbody>{displayed.map((row) => (
              <tr key={row.id}>
                <td>{formatFinancialEventDate(row.occurred_at, { dateOnly: true })}</td>
                <td>{movementLabel(row)}</td>
                <td>{Number.isSafeInteger(row.amount_cents) ? formatCurrency(row.amount_cents) : "Valor não registrado"}</td>
                <td><details><summary>Ver detalhes</summary>
                  <EventDetails event={row} serviceName={sessionById.get(Number(row.session_id))?.Service?.name} formatCurrency={formatCurrency} />
                </details></td>
              </tr>
            ))}</tbody>
          </HistoryTable>
        </TableScroll>
      )}
    </HistorySection>
  );
}

FinancialHistory.propTypes = {
  events: PropTypes.arrayOf(eventType),
  receipts: PropTypes.arrayOf(PropTypes.shape({
    payment: PropTypes.shape({ id: PropTypes.number.isRequired, paid_at: PropTypes.string, note: PropTypes.string, voided: PropTypes.bool }).isRequired,
    amountCents: PropTypes.number,
    paymentMethodName: PropTypes.string,
  })),
  filter: PropTypes.oneOf(["all", "receipts"]),
  sessions: PropTypes.arrayOf(PropTypes.shape({
    id: PropTypes.number.isRequired,
    Service: PropTypes.shape({ name: PropTypes.string }),
  })),
  formatCurrency: PropTypes.func.isRequired,
};
FinancialHistory.defaultProps = { events: null, receipts: [], sessions: [], filter: "all" };

const HistorySection = styled.section`
  min-width: 0;
  p { color: #59645d; line-height: 1.5; }
`;
const TableScroll = styled.div`overflow-x: auto;`;
const HistoryTable = styled.table`
  width: 100%;
  border-collapse: collapse;
  text-align: left;
  font-size: 0.9rem;
  th, td { padding: 10px 12px; border-bottom: 1px solid #e2e7e1; vertical-align: top; }
  th { color: #59645d; font-weight: 600; }
  td:first-child, td:nth-child(3) { white-space: nowrap; }
  summary { cursor: pointer; color: #315b42; white-space: nowrap; }
`;
const EventDetail = styled.div`
  min-width: 230px;
  max-width: 420px;
  margin-top: 12px;
  overflow-wrap: anywhere;
  p { margin: 8px 0; }
  dl { display: grid; grid-template-columns: minmax(75px, auto) minmax(0, 1fr); gap: 6px 12px; margin: 10px 0; }
  dt { font-weight: 600; }
  dd { margin: 0; }
`;

const AppliedSessionsList = styled.ul`
  list-style: none;
  padding: 0;
  margin: 0;
  li + li { margin-top: 10px; }
  span { display: block; margin-top: 3px; }
`;
