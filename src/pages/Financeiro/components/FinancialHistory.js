import React, { useState } from "react";
import PropTypes from "prop-types";
import styled from "styled-components";
import FinancialReceiptDetails from "./FinancialReceiptDetails";
import { formatPaymentOperationIdentity } from "../helpers/financialOperationIdentity";
import { formatCivilDate } from "../../../utils/canonicalDateTime";
import {
  formatFinancialInstant,
  parseFinancialHistoricalValue,
} from "../helpers/financialDateTime";

const labels = {
  RECEIPT: "Recebimento",
  CREDIT_APPLIED: "Uso de crédito",
  CANCELLATION: "Cancelamento da sessão",
  CREDIT_RELEASE: "Liberação de crédito",
  PAYMENT_CORRECTION: "Correção de recebimento",
  PAYMENT_UNAPPLICATION: "Pagamento desfeito",
};

export const formatFinancialEventDate = (value, { dateOnly = false, short = false } = {}) => {
  if (!value) return "Data não registrada";
  const parsed = parseFinancialHistoricalValue(value);
  if (!parsed) return "Data não registrada";
  if (parsed.kind === "civil-date" || (parsed.kind === "legacy-paid-date" && dateOnly)) {
    const formatted = formatCivilDate(parsed.dateOnly);
    return short ? formatted.slice(0, 5) : formatted;
  }
  if (short) return formatFinancialInstant(parsed.date, "dd/MM");
  return formatFinancialInstant(parsed.date, dateOnly ? "dd/MM/yyyy" : "dd/MM/yyyy HH:mm:ss");
};

const detailDateLabels = {
  RECEIPT: "Recebido em",
  CREDIT_APPLIED: "Crédito usado em",
  CANCELLATION: "Cancelado em",
  CREDIT_RELEASE: "Crédito liberado em",
  PAYMENT_CORRECTION: "Corrigido em",
  PAYMENT_UNAPPLICATION: "Desfeito em",
};

const formatDetailDate = (value) => {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value || "")) {
    const formatted = formatCivilDate(value);
    if (formatted) return `${formatted} (horário não registrado)`;
  }
  return formatFinancialEventDate(value);
};

// Legacy compatibility presents real receipts without inventing other events.
const receiptEvents = (receipts) =>
  receipts.map(({ payment, amountCents, paymentMethodName }) => ({
    id: `receipt:${payment.id}`,
    type: "RECEIPT",
    amount_cents: amountCents,
    recorded_at: payment.recorded_at ?? payment.created_at ?? payment.createdAt ?? null,
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

const recordedTimestamp = (value) => {
  // A date without a proven time/offset is not a registration instant.
  if (typeof value !== "string"
    || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})$/.test(value)) return null;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
};

const orderHistoryRows = (rows) => rows.map((row, index) => ({
  row, index, recordedAt: recordedTimestamp(row.recorded_at),
})).sort((first, second) => {
  if (first.recordedAt === null && second.recordedAt === null) return first.index - second.index;
  if (first.recordedAt === null) return 1;
  if (second.recordedAt === null) return -1;
  return second.recordedAt - first.recordedAt || String(first.row.id).localeCompare(String(second.row.id));
}).map(({ row }) => row);

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
  discount_cents: PropTypes.number,
  surcharge_cents: PropTypes.number,
  recorded_at: PropTypes.string,
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
  applied_destinations: PropTypes.arrayOf(PropTypes.shape({
    kind: PropTypes.string,
    session_id: PropTypes.number,
    service_name: PropTypes.string,
    session_starts_at: PropTypes.string,
    billing_cycle_id: PropTypes.number,
    plan_name: PropTypes.string,
    cycle_start: PropTypes.string,
    cycle_end: PropTypes.string,
    due_date: PropTypes.string,
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
  reference: PropTypes.string,
  original_amount_cents: PropTypes.number,
  adjustment_reason: PropTypes.string,
  original_operation: PropTypes.shape({
    kind: PropTypes.string,
    reference: PropTypes.string,
    original_amount_cents: PropTypes.number,
    occurred_at: PropTypes.string,
    payment_method_name: PropTypes.string,
  }),
  historical_details_available: PropTypes.bool,
  voided: PropTypes.bool,
});

function EventDetails({ event, serviceName, formatCurrency }) {
  const isCreditUse = event.type === "CREDIT_APPLIED";
  const appliedSessions = isCreditUse && Array.isArray(event.applied_sessions) ? event.applied_sessions : [];
  const appliedDestinations = isCreditUse && Array.isArray(event.applied_destinations)
    ? event.applied_destinations
    : appliedSessions.map((session) => ({ kind: "session", ...session }));
  const hideGenericObservation = isCreditUse && event.reason?.trim() === "Aplicação de crédito em cobrança";
  const hasSession = Boolean(event.session_id || event.session_starts_at);
  const sessionDescription = [serviceName, formatDetailDate(event.session_starts_at)]
    .filter(Boolean).join(" — ");
  const reasonLabel = ["RECEIPT", "CREDIT_APPLIED"].includes(event.type) ? "Observação" : "Motivo";
  return (
    <EventDetail>
      <dl>
        {(event.type === "RECEIPT" || isCreditUse) && <><dt>Pagamento</dt><dd>{formatPaymentOperationIdentity(event, formatCurrency)}</dd></>}
        {event.type === "PAYMENT_UNAPPLICATION" && event.original_operation && <><dt>Pagamento original</dt><dd>{formatPaymentOperationIdentity(event.original_operation, formatCurrency)}</dd></>}
        {isCreditUse && <>
          <dt>Crédito consumido</dt><dd>{formatCurrency(event.amount_cents)}</dd>
          {event.discount_cents > 0 && <><dt>Desconto</dt><dd>{formatCurrency(event.discount_cents)}</dd><dt>Motivo do desconto</dt><dd>{event.adjustment_reason?.trim() || "Não registrado nesta operação"}</dd></>}
          <dt>{appliedDestinations.length > 1 ? "Destinos" : "Destino"}</dt>
          <dd>{appliedDestinations.length ? <AppliedSessionsList>
            {appliedDestinations.map((destination, index) => <li key={`${destination.kind || "destination"}:${destination.session_id || destination.billing_cycle_id || index}`}>
              <div>{destination.kind === "billing_cycle"
                ? [
                  destination.plan_name?.trim(),
                  [formatDetailDate(destination.cycle_start), formatDetailDate(destination.cycle_end)].filter(Boolean).join(" a "),
                  destination.due_date ? `Vencimento ${formatDetailDate(destination.due_date)}` : null,
                ].filter(Boolean).join(" — ")
                : [destination.service_name?.trim(), formatDetailDate(destination.session_starts_at)].filter(Boolean).join(" — ")}</div>
              <span>Crédito aplicado: <strong>{Number.isSafeInteger(destination.amount_cents)
                ? formatCurrency(destination.amount_cents) : "Valor não registrado"}</strong></span>
            </li>)}
          </AppliedSessionsList> : "Destino histórico indisponível"}</dd>
        </>}
        {!isCreditUse && hasSession && <><dt>Sessão</dt><dd>{sessionDescription}</dd></>}
        <dt>{detailDateLabels[event.type] || "Alterado em"}</dt><dd>{event.type === "RECEIPT"
          ? formatFinancialEventDate(event.occurred_at, { dateOnly: true })
          : formatDetailDate(event.occurred_at)}</dd>
        <dt>Responsável</dt><dd>{event.actor?.name?.trim() || "Não registrado"}</dd>
        {event.type === "RECEIPT" && <><dt>Forma de pagamento</dt><dd>{event.payment_method_name?.trim() || "—"}</dd></>}
        {event.type === "PAYMENT_UNAPPLICATION" && <><dt>Crédito restaurado</dt><dd>{formatCurrency(event.amount_cents)}</dd>{event.discount_cents > 0 && <><dt>Desconto desfeito</dt><dd>{formatCurrency(event.discount_cents)}</dd></>}{event.surcharge_cents > 0 && <><dt>Acréscimo desfeito</dt><dd>{formatCurrency(event.surcharge_cents)}</dd></>}</>}
        {!hideGenericObservation && <><dt>{reasonLabel}</dt><dd>{event.reason?.trim() || "Não registrado"}</dd></>}
      </dl>
    </EventDetail>
  );
}
EventDetails.propTypes = { event: eventType.isRequired, serviceName: PropTypes.string, formatCurrency: PropTypes.func.isRequired };
EventDetails.defaultProps = { serviceName: "" };

function HistoryDetails({ row, serviceName, formatCurrency }) {
  const [open, setOpen] = useState(false);
  const paymentId = Number(row.source?.payment_id);
  const hasReceiptDetails = row.type === "RECEIPT" && Number.isSafeInteger(paymentId) && paymentId > 0;
  const detailId = `financial-history-details-${String(row.id).replace(/[^a-zA-Z0-9_-]/g, "-")}`;
  return <div>
    <HistoryDetailButton type="button" onClick={() => setOpen((current) => !current)}
      aria-expanded={open} aria-controls={detailId}>
      {open ? "Ocultar detalhes" : "Ver detalhes"}
    </HistoryDetailButton>
    <div id={detailId} hidden={!open}>
      <EventDetails event={row} serviceName={serviceName} formatCurrency={formatCurrency} />
      {open && hasReceiptDetails && <ReceiptDetailBlock>
        <FinancialReceiptDetails paymentId={paymentId} formatCurrency={formatCurrency} />
      </ReceiptDetailBlock>}
    </div>
  </div>;
}
HistoryDetails.propTypes = {
  row: eventType.isRequired,
  serviceName: PropTypes.string,
  formatCurrency: PropTypes.func.isRequired,
};
HistoryDetails.defaultProps = { serviceName: "" };

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
  const displayed = orderHistoryRows(historyRows(unique.filter((event) => filter === "all" || event.type === "RECEIPT")));
  const movementLabel = (row) => {
    if (!row.session_id && row.package_unit_id && row.type === "CANCELLATION") return "Cobrança do direito encerrada";
    if (row.type === "RECEIPT" && row.voided) return "Recebimento anulado";
    return labels[row.type] || "Movimento financeiro";
  };
  return (
    <HistorySection aria-label="Histórico financeiro do paciente">
      {displayed.length === 0 ? <p>Nenhum evento financeiro encontrado neste contexto.</p> : (
        <TableScroll>
          <HistoryTable>
            <colgroup><col style={{ width: "20%" }} /><col style={{ width: "28%" }} /><col style={{ width: "18%" }} /><col style={{ width: "34%" }} /></colgroup>
            <thead><tr><th>Registrado em</th><th>Movimento</th><th>Valor</th><th>Detalhes</th></tr></thead>
            <tbody>{displayed.map((row) => (
              <tr key={row.id}>
                <td>{recordedTimestamp(row.recorded_at) === null ? "Registro não disponível" : <RecordedDate dateTime={row.recorded_at}>
                  <span>{formatFinancialEventDate(row.recorded_at, { dateOnly: true })}</span>{" "}
                  <small>· {new Date(row.recorded_at).toLocaleTimeString("pt-BR", {
                    timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
                  })}</small>
                </RecordedDate>}</td>
                <td>{movementLabel(row)}</td>
                <td>{Number.isSafeInteger(row.amount_cents) ? formatCurrency(row.amount_cents) : "Valor não registrado"}</td>
                <td><HistoryDetails row={row}
                  serviceName={sessionById.get(Number(row.session_id))?.Service?.name}
                  formatCurrency={formatCurrency} />

                </td>
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
    payment: PropTypes.shape({
      id: PropTypes.number.isRequired, recorded_at: PropTypes.string, created_at: PropTypes.string, createdAt: PropTypes.string,
      paid_at: PropTypes.string, note: PropTypes.string, voided: PropTypes.bool,
    }).isRequired,
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
const RecordedDate = styled.time`
  display: inline;
  white-space: normal;
  span { white-space: nowrap; }
  small { display: inline; color: #59645d; font-size: 0.8rem; white-space: nowrap; }
`;
const HistoryTable = styled.table`
  width: 100%;
  min-width: 620px;
  table-layout: fixed;
  border-collapse: collapse;
  text-align: left;
  font-size: 0.9rem;
  th, td { padding: 10px 12px; border-bottom: 1px solid #e2e7e1; vertical-align: top; }
  th { color: #59645d; font-weight: 600; }
  td { overflow-wrap: anywhere; }
  td:first-child, td:nth-child(3) { white-space: nowrap; }
`;
const HistoryDetailButton = styled.button`
  padding: 0;
  border: 0;
  background: transparent;
  color: #315b42;
  font: inherit;
  cursor: pointer;
  white-space: nowrap;
`;
const EventDetail = styled.div`
  min-width: 0;
  width: 100%;
  max-width: 420px;
  margin-top: 12px;
  overflow-wrap: anywhere;
  p { margin: 8px 0; }
  dl { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.5fr); gap: 6px 12px; margin: 10px 0; }
  dt { font-weight: 600; }
  dd { margin: 0; }
`;

const ReceiptDetailBlock = styled.div`
  min-width: 0;
  width: 100%;
  overflow-x: auto;
  max-width: 420px;
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px solid #e2e7e1;
`;

const AppliedSessionsList = styled.ul`
  list-style: none;
  padding: 0;
  margin: 0;
  li + li { margin-top: 10px; }
  span { display: block; margin-top: 3px; }
`;
