import React from "react";
import "@testing-library/jest-dom";
import { fireEvent, render, screen, within } from "@testing-library/react";
import FinancialHistory from "./FinancialHistory";

const money = (amount) => `R$ ${(amount / 100).toFixed(2)}`;
const receipt = {
  id: "payment:81", type: "RECEIPT", amount_cents: 40000,
  occurred_at: "2026-11-05T13:00:00Z", actor: null,
  reason: "Pagamento original", source: { payment_id: 81 }, destination: null,
  context: "linked_obligation", historical_details_available: false,
};
const cancellation = {
  id: "cancel:1", type: "CANCELLATION", amount_cents: 10000,
  session_id: 9,
  occurred_at: "2026-11-10T12:00:00Z", session_starts_at: "2026-10-28T13:00:00Z",
  actor: { name: "Pessoa autorizada" }, reason: "Cancelamento definitivo",
  operation_id: "financial-cancellation:1", cancellation_resolution_id: 1,
  source: { session_id: 9, entry_id: 51, resolution_id: 1 },
  historical_details_available: true,
};
const release = {
  ...cancellation, id: "release:1", type: "CREDIT_RELEASE",
  source: { payment_ids: [81], entry_id: 51, allocation_ids: [70] },
  destination: { kind: "available_credit", patient_id: 30 },
};
const sessions = [{ id: 9, Service: { name: "Fisioterapia" }, starts_at: "2026-12-25T18:00:00Z" }];
const renderHistory = (props = {}) => render(<FinancialHistory events={[receipt]} receipts={[]}
  sessions={sessions} formatCurrency={money} {...props} />);
const rows = () => within(screen.getByRole("table")).getAllByRole("row").slice(1);
const mainValues = () => rows().map((row) => within(row).getAllByRole("cell")[2].textContent);

test("tabela compacta agrupa cancelamento e crédito da mesma operação sem somar duas vezes", () => {
  const events = [receipt, receipt, cancellation, release, {
    id: "usage:1", type: "CREDIT_APPLIED", amount_cents: 4000,
    occurred_at: "2026-12-01T12:00:00Z", actor: { membership_id: 3 },
    source: { credit_movement_id: 90 }, destination: { entry_id: 52, installment_id: 99 },
    historical_details_available: true,
  }];
  const { rerender } = renderHistory({ events });
  expect(screen.getAllByRole("columnheader").map((cell) => cell.textContent)).toEqual(["Data", "Movimento", "Valor", "Detalhes"]);
  expect(rows()).toHaveLength(3);
  expect(screen.queryByRole("list")).not.toBeInTheDocument();
  expect(screen.getByText("Sessão de 28/10 cancelada — R$ 100.00 liberados como crédito")).toBeInTheDocument();
  expect(mainValues()).toEqual(["R$ 400.00", "R$ 100.00", "R$ 40.00"]);
  expect(screen.queryByText("R$ 200.00")).not.toBeInTheDocument();
  const grouped = rows()[1];
  const cells = within(grouped).getAllByRole("cell");
  expect(cells.slice(0, 3).map((cell) => cell.textContent).join(" ")).not.toMatch(/#51|#81|financial-cancellation/);
  fireEvent.click(within(grouped).getByText("Ver detalhes"));
  expect(grouped.querySelectorAll("dl")).toHaveLength(1);
  expect([...grouped.querySelectorAll("dt")].map((item) => item.textContent)).toEqual([
    "Sessão", "Cancelado em", "Responsável", "Motivo",
  ]);
  expect(within(grouped).getByText("Sessão").nextSibling).toHaveTextContent(/Fisioterapia.*28\/10\/2026.*10:00/);
  expect(within(grouped).getByText("Cancelado em").nextSibling).toHaveTextContent(/10\/11\/2026.*09:00/);
  expect(within(grouped).getAllByText("Pessoa autorizada")).toHaveLength(1);
  expect(within(grouped).getAllByText("Cancelamento definitivo")).toHaveLength(1);
  expect(grouped).not.toHaveTextContent(/25\/12\/2026|financial-cancellation|#51|#81|#70|#30/);
  ["Cancelamento da sessão", "Liberação de crédito", "Valor registrado", "Origem", "Destino", "Operação", "Forma"].forEach((text) => {
    expect(within(grouped).queryByText(text)).not.toBeInTheDocument();
  });
  expect(screen.queryByText(/Contas consultadas:/)).not.toBeInTheDocument();
  expect(screen.queryByText("Filtrar histórico")).not.toBeInTheDocument();
  expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  rerender(<FinancialHistory events={events} filter="receipts" formatCurrency={money} />);
  expect(rows()).toHaveLength(1);
  expect(mainValues()).toEqual(["R$ 400.00"]);
  expect(screen.queryByText(/liberados como crédito/)).not.toBeInTheDocument();
  expect(screen.getByText("Pagamento original")).toBeInTheDocument();
  expect(screen.queryByText(/Vinculado à cobrança consultada/)).not.toBeInTheDocument();
  rerender(<FinancialHistory events={events} filter="all" formatCurrency={money} />);
  expect(rows()).toHaveLength(3);
  expect(mainValues()).toEqual(["R$ 400.00", "R$ 100.00", "R$ 40.00"]);
});

test("data e valor iguais não agrupam eventos sem vínculo explícito ou de operações distintas", () => {
  renderHistory({ events: [
    { ...cancellation, operation_id: undefined, cancellation_resolution_id: undefined },
    { ...release, operation_id: undefined, cancellation_resolution_id: undefined },
    { ...cancellation, id: "cancel:2", operation_id: "financial-cancellation:2", cancellation_resolution_id: 2 },
    { ...release, id: "release:3", operation_id: "financial-cancellation:3", cancellation_resolution_id: 3 },
  ] });
  expect(rows()).toHaveLength(4);
  expect(screen.queryByText(/liberados como crédito/)).not.toBeInTheDocument();
});

test("operation_id explícito agrupa sem exigir extração do identificador do evento", () => {
  renderHistory({ events: [
    { ...release, cancellation_resolution_id: undefined },
    { ...cancellation, cancellation_resolution_id: undefined },
  ] });
  expect(rows()).toHaveLength(1);
  expect(mainValues()).toEqual(["R$ 100.00"]);
});

test("dados antigos não ganham responsável nem data a partir de IDs, updated_at ou agendamento atual", () => {
  renderHistory({ events: [{ ...receipt, occurred_at: null, session_id: 9, session_starts_at: null,
    actor: { membership_id: 123, user_id: 456 }, reason: null, updated_at: "2026-09-23T12:00:00Z" }] });
  expect(within(rows()[0]).getAllByRole("cell")[0]).toHaveTextContent("Data não registrada");
  expect(screen.getByText("Responsável").nextSibling).toHaveTextContent("Não registrado");
  expect(screen.getByText("Recebido em").nextSibling).toHaveTextContent("Data não registrada");
  expect(screen.getByText("Sessão").nextSibling).toHaveTextContent("Fisioterapia");
  expect(screen.getByText("Sessão").nextSibling).toHaveTextContent("Data não registrada");
  expect(screen.getByText("Observação").nextSibling).toHaveTextContent("Não registrado");
  expect(screen.queryByText(/Detalhes históricos indisponíveis|Membership|Usuário|123|456/)).not.toBeInTheDocument();
  expect(screen.queryByText(/23\/09\/2026/)).not.toBeInTheDocument();
  expect(screen.queryByText(/25\/12\/2026/)).not.toBeInTheDocument();
});

test("preserva recebimentos originais separados, anulação e observação sem detalhes técnicos", () => {
  renderHistory({ events: null, receipts: [{
    payment: { id: 81, paid_at: receipt.occurred_at, voided: true, note: "Pagamento antigo" },
    amountCents: 40000, paymentMethodName: "Pix",
  }, {
    payment: { id: 82, paid_at: receipt.occurred_at, note: "Outro recebimento" },
    amountCents: 40000, paymentMethodName: "Dinheiro",
  }] });
  expect(mainValues()).toEqual(["R$ 400.00", "R$ 400.00"]);
  expect(screen.queryByText("Pix")).not.toBeInTheDocument();
  expect(screen.queryByText("Dinheiro")).not.toBeInTheDocument();
  expect(screen.getByText("Recebimento anulado")).toBeInTheDocument();
  expect(screen.getByText("Pagamento antigo")).toBeInTheDocument();
  expect(screen.getByText("Outro recebimento")).toBeInTheDocument();
  expect(screen.queryByText(/Recebimento anulado por correção|Valor original preservado/)).not.toBeInTheDocument();
  expect(screen.queryByText("Sessão")).not.toBeInTheDocument();
  expect(screen.queryByText("Uso de crédito")).not.toBeInTheDocument();
  expect(rows()).toHaveLength(2);
});

test.each([
  ["RECEIPT", "Recebido em", "Observação"],
  ["CANCELLATION", "Cancelado em", "Motivo"],
  ["CREDIT_RELEASE", "Crédito liberado em", "Motivo"],
  ["PAYMENT_CORRECTION", "Corrigido em", "Motivo"],
])("%s mantém a data real do movimento distinta da sessão e a identificação clara do motivo", (type, dateLabel, reasonLabel) => {
  renderHistory({ events: [{ ...cancellation, type }] });
  fireEvent.click(screen.getByText("Ver detalhes"));
  expect(screen.getByText("Sessão").nextSibling).toHaveTextContent(/Fisioterapia.*28\/10\/2026.*10:00/);
  expect(screen.getByText(dateLabel).nextSibling).toHaveTextContent(/10\/11\/2026.*09:00/);
  expect(screen.getByText(reasonLabel).nextSibling).toHaveTextContent("Cancelamento definitivo");
  expect(screen.getByText("Responsável").nextSibling).toHaveTextContent("Pessoa autorizada");
  expect(rows()[0].querySelectorAll("dl")).toHaveLength(1);
  expect(screen.queryByText(/25\/12\/2026/)).not.toBeInTheDocument();
});

test.each([undefined, 999])("serviço não é inferido de source.session_id nem de outra sessão (session_id=%s)", (sessionId) => {
  renderHistory({ events: [{ ...cancellation, session_id: sessionId }] });
  expect(screen.getByText("Sessão").nextSibling).toHaveTextContent(/28\/10\/2026.*10:00/);
  expect(screen.queryByText(/Fisioterapia/)).not.toBeInTheDocument();
});

test("datas sem horário não inventam meia-noite nem deslocam o dia pelo fuso", () => {
  renderHistory({ events: [{ ...cancellation, session_starts_at: "2026-10-28", occurred_at: "2026-11-10" }] });
  expect(screen.getByText("Sessão").nextSibling).toHaveTextContent("28/10/2026 (horário não registrado)");
  expect(screen.getByText("Cancelado em").nextSibling).toHaveTextContent("10/11/2026 (horário não registrado)");
  expect(screen.queryByText(/00:00|27\/10|09\/11/)).not.toBeInTheDocument();
});

test("privacidade mascara o movimento agrupado e histórico vazio válido não reconstrói recibos", () => {
  const { rerender } = renderHistory({ events: [cancellation, release], formatCurrency: () => "R$ ••••" });
  expect(mainValues()).toEqual(["R$ ••••"]);
  expect(screen.getByText("Sessão de 28/10 cancelada — R$ •••• liberados como crédito")).toBeInTheDocument();
  expect(screen.queryByText(/100.00/)).not.toBeInTheDocument();
  rerender(<FinancialHistory events={[]} receipts={[{ payment: { id: 81 }, amountCents: 40000 }]}
    formatCurrency={money} />);
  expect(screen.getByText(/Nenhum evento financeiro/)).toBeInTheDocument();
  expect(screen.queryByRole("table")).not.toBeInTheDocument();
});


test("uso de crédito mostra serviço, sessão e valor confirmados sem observação técnica genérica", () => {
  renderHistory({ events: [{
    id: "credit-command:1", type: "CREDIT_APPLIED", amount_cents: 5000,
    occurred_at: "2026-09-24T16:21:22.000Z", actor: { name: "Responsável local" },
    reason: "Aplicação de crédito em cobrança", session_id: 9, session_starts_at: "2026-12-25T18:00:00Z",
    applied_sessions: [{ session_id: 9, service_name: "Fisioterapia confirmada", session_starts_at: "2026-11-04T13:00:00.000Z", amount_cents: 5000 }],
  }] });
  fireEvent.click(screen.getByText("Ver detalhes"));
  expect(rows()).toHaveLength(1);
  expect(mainValues()).toEqual(["R$ 50.00"]);
  expect(screen.getByText("Sessão").nextSibling).toHaveTextContent(/Fisioterapia confirmada.*04\/11\/2026.*10:00:00.*Crédito aplicado: R\$ 50.00/);
  expect(screen.getByText("Crédito usado em").nextSibling).toHaveTextContent(/24\/09\/2026.*13:21:22/);
  expect(screen.getByText("Responsável").nextSibling).toHaveTextContent("Responsável local");
  expect(screen.queryByText("Observação")).not.toBeInTheDocument();
  expect(screen.queryByText("Aplicação de crédito em cobrança")).not.toBeInTheDocument();
  expect(screen.queryByText(/25\/12\/2026/)).not.toBeInTheDocument();
});

test("várias sessões do mesmo uso ficam nos mesmos detalhes com valores individuais e uma linha principal", () => {
  const applied = {
    id: "credit-command:2", type: "CREDIT_APPLIED", operation_id: "financial-credit-application:2", amount_cents: 15000,
    occurred_at: "2026-09-24T16:00:00.000Z", actor: { name: "Responsável local" }, reason: "Saldo usado conforme solicitado",
    applied_sessions: [
      { session_id: 9, service_name: "Fisioterapia", session_starts_at: "2026-11-04T13:00:00.000Z", amount_cents: 10000 },
      { session_id: 10, service_name: "Pilates", session_starts_at: "2026-11-11T14:30:00.000Z", amount_cents: 5000 },
    ],
  };
  const { rerender } = renderHistory({ events: [receipt, applied] });
  const creditRow = screen.getByText("Uso de crédito").closest("tr");
  fireEvent.click(within(creditRow).getByText("Ver detalhes"));
  expect(rows()).toHaveLength(2);
  expect(mainValues()).toEqual(["R$ 400.00", "R$ 150.00"]);
  expect(creditRow.querySelectorAll("dl")).toHaveLength(1);
  expect(creditRow.querySelectorAll("li")).toHaveLength(2);
  expect(creditRow.querySelectorAll("li")[0]).toHaveTextContent(/Fisioterapia.*04\/11\/2026.*10:00:00.*R\$ 100.00/);
  expect(creditRow.querySelectorAll("li")[1]).toHaveTextContent(/Pilates.*11\/11\/2026.*11:30:00.*R\$ 50.00/);
  expect(within(creditRow).getByText("Observação").nextSibling).toHaveTextContent("Saldo usado conforme solicitado");
  expect(screen.queryByText(/financial-credit-application|command:2|#9|#10|R\$ 300.00/)).not.toBeInTheDocument();
  rerender(<FinancialHistory events={[receipt, applied]} filter="receipts" formatCurrency={money} />);
  expect(rows()).toHaveLength(1);
  expect(screen.queryByText("Uso de crédito")).not.toBeInTheDocument();
  expect(mainValues()).toEqual(["R$ 400.00"]);
});

test("crédito sem snapshot mantém linha original e não inventa destino com sessão atual ou dados financeiros", () => {
  const old = { id: "credit-old:1", type: "CREDIT_APPLIED", amount_cents: 5000,
    occurred_at: "2026-09-24T13:00:00.000Z", actor: { name: "Pessoa autorizada" }, reason: "Observação real antiga",
    session_id: 9, session_starts_at: "2026-12-25T18:00:00Z", source: { session_id: 9 }, destination: { session_id: 9, entry_id: 51 },
  };
  renderHistory({ events: [old, { ...old, id: "credit-old:2" }] });
  expect(rows()).toHaveLength(2);
  expect(screen.getAllByText("Destino histórico indisponível")).toHaveLength(2);
  expect(screen.getAllByText("Pessoa autorizada")).toHaveLength(2);
  expect(screen.getAllByText("Observação real antiga")).toHaveLength(2);
  expect(screen.queryByText(/Fisioterapia|25\/12\/2026/)).not.toBeInTheDocument();
  expect(mainValues()).toEqual(["R$ 50.00", "R$ 50.00"]);
});

test("somente a frase genérica exata do uso de crédito é ocultada, preservando anotações reais e outros eventos", () => {
  renderHistory({ events: [
    { ...receipt, reason: "Aplicação de crédito em cobrança" },
    { id: "usage:1", type: "CREDIT_APPLIED", amount_cents: 5000, reason: "Aplicação de crédito em cobrança: solicitado pela paciente" },
    { id: "usage:2", type: "CREDIT_APPLIED", amount_cents: 5000, reason: "  Aplicação de crédito em cobrança  " },
  ] });
  expect(screen.getAllByText("Aplicação de crédito em cobrança")).toHaveLength(1);
  expect(screen.getByText("Aplicação de crédito em cobrança: solicitado pela paciente")).toBeInTheDocument();
  expect(rows()[2].querySelectorAll("dt")).toHaveLength(3);
  expect(rows()[2]).not.toHaveTextContent("Observação");
});

test("destinos históricos incompletos não recebem serviço, hora ou valor atuais e respeitam privacidade", () => {
  const applied = { id: "usage:1", type: "CREDIT_APPLIED", amount_cents: 5000, reason: null,
    applied_sessions: [{ session_id: 9, service_name: null, session_starts_at: "2026-11-04", amount_cents: null }],
  };
  const { rerender } = renderHistory({ events: [applied] });
  expect(screen.getByText("Sessão").nextSibling).toHaveTextContent("04/11/2026 (horário não registrado)");
  expect(screen.getByText("Sessão").nextSibling).toHaveTextContent("Valor não registrado");
  expect(screen.queryByText(/Fisioterapia|25\/12|00:00/)).not.toBeInTheDocument();
  expect(screen.getByText("Observação").nextSibling).toHaveTextContent("Não registrado");
  rerender(<FinancialHistory events={[{ ...applied, applied_sessions: [{ ...applied.applied_sessions[0], amount_cents: 5000 }] }]} formatCurrency={() => "R$ ••••"} />);
  expect(mainValues()).toEqual(["R$ ••••"]);
  expect(screen.getByText("Sessão").nextSibling).toHaveTextContent("Crédito aplicado: R$ ••••");
  expect(screen.queryByText(/50.00/)).not.toBeInTheDocument();
});
