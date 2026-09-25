/* eslint-env jest */
import React from "react";
import { render, screen } from "@testing-library/react";
import FinancialReceiptDetails from "./FinancialReceiptDetails";
import { getFinancialReceiptDetails } from "../../../services/financial";

jest.mock("../../../services/financial", () => ({ getFinancialReceiptDetails: jest.fn() }));
const currency = (value) => (value / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const show = (details) => {
  getFinancialReceiptDetails.mockResolvedValue({ data: { receipt_details: details } });
  render(<FinancialReceiptDetails paymentId={10} formatCurrency={currency} />);
};
beforeEach(() => jest.clearAllMocks());
test("mostra linhas compactas por grupo, sem tabela, cabeçalho ou totais históricos", async () => {
  show({ groups: [
    { kind: "entry", service_name: "Fisioterapia", reference_date: "2026-09-09", discount_cents: 299, paid_cents: 10801 },
    { kind: "series", service_name: "Fisioterapia", reference_date: "2026-09-11", discount_cents: 10785, paid_cents: 189199 },
  ], discount_cents: 11084, paid_cents: 200000, total_after_discount_cents: 400000, pending_after_cents: 200000, historical_totals_available: true });
  const lines = await screen.findAllByRole("listitem");
  expect(lines.map((line) => line.textContent.replace(/\s+/g, " "))).toEqual([
    "Avulsa · 09/09/2026 · Fisioterapia — R$ 108,01 pagos · desconto de R$ 2,99",
    "Pacote · 11/09/2026 · Fisioterapia — R$ 1.891,99 pagos · desconto de R$ 107,85",
  ]);
  expect(screen.queryByRole("table")).toBeNull();
  expect(screen.queryByRole("columnheader")).toBeNull();
  expect(screen.queryByText(/Total|Ficou a receber|4\.000,00|2\.000,00/)).toBeNull();
  expect(screen.queryByRole("dialog")).toBeNull();
});
test("preserva desconto sem aplicação e omite desconto zero", async () => {
  show({ groups: [
    { key: "entry-1", kind: "entry", service_name: "Fisio", reference_date: "2026-09-09", discount_cents: 0, paid_cents: 5000 },
    { key: "series-2", kind: "series", service_name: "Pilates", reference_date: "2026-09-11", discount_cents: 10785, paid_cents: 0 },
  ] });
  const lines = await screen.findAllByRole("listitem");
  expect(lines).toHaveLength(2);
  expect(lines[0].textContent).not.toMatch(/desconto/);
  expect(lines[1].textContent.replace(/\s+/g, " ")).toBe(
    "Pacote · 11/09/2026 · Pilates — R$ 0,00 pagos · desconto de R$ 107,85",
  );
});
test("crédito excedente mantém apenas o valor original junto às linhas compactas", async () => {
  show({ groups: [{ kind: "entry", reference_date: "2026-09-09", paid_cents: 10000, discount_cents: 0 }],
    original_credit_cents: 20000, creditAvailable: 500, historical_totals_available: true,
    pending_after_cents: 0, total_after_discount_cents: 10000 });
  expect((await screen.findByText(/Originalmente deixado como crédito/)).textContent.replace(/\s+/g, " "))
    .toBe("Originalmente deixado como crédito: R$ 200,00.");
  expect(screen.queryByText(/5,00|Total|Ficou a receber/)).toBeNull();
});
test("crédito original não é saldo disponível e não cria tabela fictícia", async () => {
  show({ credit_only: true, original_credit_cents: 20000, groups: [] });
  expect(await screen.findByText(/Recebido originalmente como crédito/)).toBeTruthy();
  expect(screen.queryByRole("table")).toBeNull();
  expect(screen.queryByText(/Ficou a receber/)).toBeNull();
});
test("seleção totalmente descontada mantém cobrança e crédito original sem novo layout", async () => {
  show({ groups: [{ kind: "entry", reference_date: "2026-09-09", paid_cents: 0, discount_cents: 11100 }],
    original_credit_cents: 20000, creditAvailable: 0, historical_totals_available: true });
  const line = await screen.findByRole("listitem");
  expect(line.textContent.replace(/\s+/g, " ")).toMatch(/R\$ 0,00 pagos · desconto de R\$ 111,00/);
  expect(screen.getByText(/Originalmente deixado como crédito/).textContent.replace(/\s+/g, " "))
    .toBe("Originalmente deixado como crédito: R$ 200,00.");
  expect(screen.queryByRole("table")).toBeNull();
  expect(screen.queryByText(/Recebido originalmente como crédito|Total|Ficou a receber/)).toBeNull();
});
test("histórico insuficiente não vira zero nem saldo atual", async () => {
  show({ groups: [], historical_totals_available: false, pending_after_cents: null, total_after_discount_cents: null });
  expect(await screen.findByText(/não comprovam/)).toBeTruthy();
  expect(screen.queryByText(/Total após desconto/)).toBeNull();
  expect(screen.queryByRole("table")).toBeNull();
});
test("falha de leitura é exibida sem valores inventados", async () => {
  getFinancialReceiptDetails.mockRejectedValue(new Error("unavailable"));
  render(<FinancialReceiptDetails paymentId={10} formatCurrency={currency} />);
  expect(await screen.findByRole("alert")).toBeTruthy();
  expect(screen.queryByRole("table")).toBeNull();
});
