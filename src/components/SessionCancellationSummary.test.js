import React from "react";
import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import SessionCancellationSummary, { validCancellationPreview } from "./SessionCancellationSummary";

const target = { patient_id: 30, session_id: 701 };
const preview = (override = {}) => ({
  eligible: true,
  blockers: [],
  preview_fingerprint: "server-preview",
  patient: { id: 30 },
  entry: { id: 501 },
  session: { id: 701, starts_at: "2026-10-28T13:00:00Z" },
  package: { amount_before_cents: 39500, amount_after_cents: 30000 },
  release_amount_cents: 5000,
  credit_after_cents: 8000,
  affected_sessions: [],
  consequences: { replacement_created: false, money_refunded: false },
  ...override,
});
const money = (value) => `R$ ${(value / 100).toFixed(2)}`;

test("mostra valor do pacote e crédito da prévia sem deduzir um do outro", () => {
  render(<SessionCancellationSummary preview={preview()} formatCurrency={money} />);
  expect(screen.getByRole("region", { name: "Prévia do cancelamento" })).toHaveTextContent("Cancelar a sessão de 28/10?");
  expect(screen.getByText("O pacote passará de R$ 395.00 para R$ 300.00.")).toBeInTheDocument();
  expect(screen.getByText("R$ 50.00 ficarão como crédito para este paciente.")).toBeInTheDocument();
  expect(screen.getByText("Não haverá reposição nem devolução de dinheiro.")).toBeInTheDocument();
  expect(screen.queryByText(/R\$ 95\.00|R\$ 80\.00/)).not.toBeInTheDocument();
});

test("cancelamento sem crédito não anuncia liberação nem fabrica valor de pacote para sessão avulsa", () => {
  const data = preview({ package: null, release_amount_cents: 0, credit_after_cents: 0 });
  expect(validCancellationPreview(data, target)).toBe(true);
  render(<SessionCancellationSummary preview={data} formatCurrency={money} />);
  expect(screen.queryByText(/O pacote passará|ficarão como crédito/)).not.toBeInTheDocument();
  expect(screen.getByText("Não haverá reposição nem devolução de dinheiro.")).toBeInTheDocument();
});

test("identifica a sessão escolhida e avisa sobre outra sessão afetada sem repetir a escolhida", () => {
  const data = preview({ affected_sessions: [
    { id: 701, starts_at: "2026-10-28T13:00:00Z" },
    { id: 888, starts_at: "2026-11-06T13:00:00Z" },
  ] });
  expect(validCancellationPreview(data, target)).toBe(true);
  render(<SessionCancellationSummary preview={data} formatCurrency={money} />);
  expect(screen.getByText("Cancelar a sessão de 28/10?")).toBeInTheDocument();
  expect(screen.getAllByText(/também será cancelada/)).toHaveLength(1);
  expect(screen.getByText("A sessão agendada para 06/11/2026 também será cancelada.")).toBeInTheDocument();
  expect(screen.queryByText(/#701|#888/)).not.toBeInTheDocument();
});

test("datas próximas da meia-noite UTC usam o dia clínico de São Paulo", () => {
  render(<SessionCancellationSummary preview={preview({
    session: { id: 701, starts_at: "2026-10-29T01:30:00Z" },
    affected_sessions: [{ id: 888, starts_at: "2026-11-07T01:30:00Z" }],
  })} formatCurrency={money} />);
  expect(screen.getByText("Cancelar a sessão de 28/10?")).toBeInTheDocument();
  expect(screen.getByText("A sessão agendada para 06/11/2026 também será cancelada.")).toBeInTheDocument();
});

test("aceita bloqueio identificado pelo servidor mesmo sem os valores de uma prévia elegível", () => {
  const data = { eligible: false, patient: { id: 30 }, session: { id: 701 }, blockers: [{ code: "FORBIDDEN", message: "Sem autorização" }] };
  expect(validCancellationPreview(data, target)).toBe(true);
});

test("distingue o paciente atendido do titular financeiro em sessão compartilhada", () => {
  const sharedTarget = {
    financial_patient_id: 30,
    attended_patient_id: 31,
    session_id: 701,
  };
  const data = preview({
    patient: { id: 30 },
    session: { id: 701, patient_id: 31, starts_at: "2026-10-28T13:00:00Z" },
  });

  expect(validCancellationPreview(data, sharedTarget)).toBe(true);
  expect(validCancellationPreview({ ...data, patient: { id: 31 } }, sharedTarget)).toBe(false);
  expect(validCancellationPreview({
    ...data,
    session: { ...data.session, patient_id: 30 },
  }, sharedTarget)).toBe(false);
  expect(validCancellationPreview({
    ...data,
    session: { id: 701, starts_at: data.session.starts_at },
  }, sharedTarget)).toBe(false);
});

test.each([
  ["ausente", null],
  ["paciente incorreto", preview({ patient: { id: 99 } })],
  ["sessão incorreta", preview({ session: { id: 702, starts_at: "2026-10-28T13:00:00Z" } })],
  ["sessão sem data", preview({ session: { id: 701 } })],
  ["sessão sem identidade", preview({ session: { starts_at: "2026-10-28T13:00:00Z" } })],
  ["data inválida", preview({ session: { id: 701, starts_at: "invalid" } })],
  ["sem fingerprint", preview({ preview_fingerprint: undefined })],
  ["sem consequências", preview({ consequences: undefined })],
  ["devolução divergente", preview({ consequences: { replacement_created: false, money_refunded: true } })],
  ["reposição divergente", preview({ consequences: { replacement_created: true, money_refunded: false } })],
  ["pacote desconhecido", preview({ package: undefined })],
  ["valor negativo", preview({ package: { amount_before_cents: 40000, amount_after_cents: -1 } })],
  ["crédito não inteiro", preview({ release_amount_cents: 5000.5 })],
  ["crédito ausente", preview({ release_amount_cents: undefined })],
  ["bloqueio contraditório", preview({ blockers: [{ code: "BLOCKED", message: "Não permitido" }] })],
  ["outra sessão sem data", preview({ affected_sessions: [{ id: 888 }] })],
  ["outra sessão sem identidade", preview({ affected_sessions: [{ starts_at: "2026-11-06T13:00:00Z" }] })],
  ["outra sessão com data inválida", preview({ affected_sessions: [{ id: 888, starts_at: "invalid" }] })],
  ["sessões em contrato inválido", preview({ affected_sessions: {} })],
])("prévia %s não pode habilitar confirmação", (_label, data) => {
  expect(validCancellationPreview(data, target)).toBe(false);
});
