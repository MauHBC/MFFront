/* eslint-env jest */
import React from "react";
import userEvent from "@testing-library/user-event";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import FinancialPaymentModal from "./FinancialPaymentModal";
import useFinancialPaymentFlow from "../hooks/useFinancialPaymentFlow";
import { createFinancialEntry, createFinancialPayment } from "../../../services/financial";

jest.mock("react-toastify", () => ({ toast: { error: jest.fn(), success: jest.fn() } }));
jest.mock("../../../services/axios", () => ({ getUserFacingApiError: (error, fallback) => fallback }));
jest.mock("../../../services/financial", () => ({ createFinancialEntry: jest.fn(), createFinancialPayment: jest.fn() }));

const groups = [
  { key: "avulsa", kind: "entry", sourceId: 1, label: "Avulsa", referenceDate: "2026-09-09", entries: [{ entryId: 1, openCents: 11100 }] },
  { key: "pacote", kind: "series", sourceId: 2, label: "Pacote", referenceDate: "2026-09-11", entries: Array.from({ length: 24 }, (_, index) => ({ entryId: index + 2, openCents: 16666 })) },
];
const currency = (cents) => (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const harness = (choices = groups, selectionReady = true) => {
  function Harness() {
    const flow = useFinancialPaymentFlow({ onPaymentSaved: jest.fn() });
    return <>
      <button type="button" onClick={() => flow.openScopedPatientPaymentModal({ id: 3, full_name: "Paciente sintético" }, { groups: choices, selectionReady, periodLabel: "09/2026" })}>Abrir</button>
      <FinancialPaymentModal flow={flow} formatCurrency={currency} paymentMethods={[{ id: 4, name: "Pix" }]} onRequestClose={(close) => close()} />
    </>;
  }
  render(<Harness />);
  fireEvent.click(screen.getByText("Abrir"));
};
const enterPayment = () => {
  fireEvent.change(screen.getByLabelText("Valor recebido"), { target: { value: "2000,00" } });
  fireEvent.change(screen.getByLabelText("Desconto"), { target: { value: "110,84" } });
  fireEvent.change(screen.getByLabelText("Data do recebimento"), { target: { value: "2026-09-10" } });
  fireEvent.change(screen.getByLabelText("Forma de pagamento"), { target: { value: "4" } });
  fireEvent.change(screen.getByLabelText("Observações"), { target: { value: "Teste sintético" } });
};
beforeEach(() => {
  jest.clearAllMocks();
  createFinancialEntry.mockResolvedValue({ data: { id: 90 } });
  createFinancialPayment.mockResolvedValue({ data: { id: 91 } });
});
test("duas opções agrupadas, escolha explícita, avanço sem escrita e resumo sem tabela", async () => {
  harness();
  expect(screen.getAllByRole("checkbox")).toHaveLength(2);
  expect(screen.getAllByRole("checkbox").every((input) => !input.checked)).toBe(true);
  expect(screen.getByText("Avançar").disabled).toBe(false);
  screen.getAllByRole("checkbox").forEach((input) => fireEvent.click(input));
  fireEvent.click(screen.getByText("Avançar"));
  expect(createFinancialEntry).not.toHaveBeenCalled();
  expect(createFinancialPayment).not.toHaveBeenCalled();
  enterPayment();
  expect(screen.queryByRole("table")).toBeNull();
  expect(screen.queryByText("Revisão das cobranças selecionadas")).toBeNull();
  expect(screen.getByText("Valor original").parentElement.textContent).toContain(currency(411084));
  expect(screen.getByText("Total final").parentElement.textContent).toContain(currency(400000));
  expect(screen.getByText("Valor pendente").parentElement.textContent).toContain(currency(200000));
  expect(screen.queryByText("Saldo em credito")).toBeNull();
  fireEvent.click(screen.getByText("Voltar"));
  expect(screen.getAllByRole("checkbox").every((input) => input.checked)).toBe(true);
  fireEvent.click(screen.getByText("Avançar"));
  expect(screen.getByLabelText("Valor recebido").value).toBe("2000,00");
  expect(screen.getByLabelText("Desconto").value).toBe("110,84");
  expect(screen.getByLabelText("Observações").value).toBe("Teste sintético");
  expect(screen.getByLabelText("Data do recebimento").value).toBe("2026-09-10");
  fireEvent.click(screen.getByText("Confirmar recebimento"));
  await waitFor(() => expect(createFinancialPayment).toHaveBeenCalledTimes(1));
  const payload = createFinancialPayment.mock.calls[0][0];
  expect(payload.receipt_groups).toEqual([{ kind: "entry", id: 1 }, { kind: "series", id: 2 }]);
  expect(payload.adjustment_targets).toHaveLength(25);
  expect(payload.allocations.map((item) => item.amount_cents)).toEqual([10801, ...Array(11).fill(16217), 10812]);
});
test.each([["111,00", []], ["110,99", [{ entry_id: 1, amount_cents: 1 }]]])(
  "desconto %s preserva seleção, ajuste e dinheiro positivo mesmo sem aplicação", async (discount, allocations) => {
    harness();
    fireEvent.click(screen.getByRole("checkbox", { name: /Avulsa/ }));
    fireEvent.click(screen.getByText("Avançar"));
    enterPayment();
    fireEvent.change(screen.getByLabelText("Valor recebido"), { target: { value: "200,00" } });
    fireEvent.change(screen.getByLabelText("Desconto"), { target: { value: discount } });
    expect(screen.getByText("Confirmar recebimento").disabled).toBe(false);
    fireEvent.click(screen.getByText("Confirmar recebimento"));
    await waitFor(() => expect(createFinancialPayment).toHaveBeenCalledTimes(1));
    const payload = createFinancialPayment.mock.calls[0][0];
    expect(payload).toMatchObject({ amount_cents: 20000, allocation_mode: "manual", allocations,
      discount_cents: discount === "111,00" ? 11100 : 11099,
      adjustment_targets: [{ entry_id: 1, open_amount_cents: 11100 }],
      receipt_groups: [{ kind: "entry", id: 1 }],
    });
    expect(payload.receipt_intent).toBeUndefined();
  },
);

test("alterar seleção não sobrescreve dinheiro editado; excesso é mostrado", () => {
  harness();
  screen.getAllByRole("checkbox").forEach((input) => fireEvent.click(input));
  fireEvent.click(screen.getByText("Avançar"));
  enterPayment();
  fireEvent.click(screen.getByText("Voltar"));
  fireEvent.click(screen.getByRole("checkbox", { name: /Pacote/ }));
  fireEvent.click(screen.getByText("Avançar"));
  expect(screen.getByLabelText("Valor recebido").value).toBe("2000,00");
  expect(screen.getByText("Saldo em credito")).toBeTruthy();
  expect(screen.queryByRole("table")).toBeNull();
});
test("uma cobrança pré-selecionada e conflito impede confirmação sem nova revisão", async () => {
  createFinancialPayment.mockRejectedValue({ response: { status: 409 } });
  harness([groups[1]]);
  expect(screen.getByRole("checkbox").checked).toBe(true);
  fireEvent.click(screen.getByText("Avançar"));
  enterPayment();
  fireEvent.click(screen.getByText("Confirmar recebimento"));
  await waitFor(() => expect(screen.getByRole("alert").textContent).toMatch(/Atualize os dados/));
  expect(screen.getByText("Confirmar recebimento").disabled).toBe(true);
  fireEvent.click(screen.getByText("Confirmar recebimento"));
  expect(createFinancialPayment).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByText("Voltar"));
  fireEvent.click(screen.getByRole("checkbox"));
  expect(screen.getByText("Avançar").disabled).toBe(true);
});

test.each([{ choices: groups }, { choices: [] }])("sem seleção recebe somente crédito, sem anchor nem desconto", async ({ choices }) => {
  harness(choices);
  expect(screen.getByText("Avançar sem selecionar cobranças, o valor ficará como crédito do paciente.")).toBeTruthy();
  fireEvent.click(screen.getByText("Avançar"));
  expect(screen.getByLabelText("Valor recebido").value).toBe("");
  expect(screen.queryByLabelText("Desconto")).toBeNull();
  expect(screen.queryByRole("table")).toBeNull();
  fireEvent.change(screen.getByLabelText("Valor recebido"), { target: { value: "200,00" } });
  fireEvent.change(screen.getByLabelText("Forma de pagamento"), { target: { value: "4" } });
  fireEvent.click(screen.getByText("Voltar"));
  fireEvent.click(screen.getByText("Avançar"));
  expect(screen.getByLabelText("Valor recebido").value).toBe("200,00");
  expect(screen.getByText("Ficará como crédito").parentElement.textContent).toContain("200,00");
  fireEvent.click(screen.getByText("Confirmar recebimento"));
  await waitFor(() => expect(createFinancialPayment).toHaveBeenCalledTimes(1));
  expect(createFinancialEntry).not.toHaveBeenCalled();
  expect(createFinancialPayment.mock.calls[0][0]).toEqual(expect.objectContaining({
    receipt_intent: "credit_only", allocation_mode: "none", allocations: [],
    entry_id: null, amount_cents: 20000, discount_cents: undefined, receipt_groups: undefined,
  }));
});
test("remove desconto ao desmarcar tudo sem perder valor editado", () => {
  harness();
  screen.getAllByRole("checkbox").forEach((input) => fireEvent.click(input));
  fireEvent.click(screen.getByText("Avançar"));
  enterPayment();
  fireEvent.click(screen.getByText("Voltar"));
  screen.getAllByRole("checkbox").forEach((input) => fireEvent.click(input));
  fireEvent.click(screen.getByText("Avançar"));
  expect(screen.getByLabelText("Valor recebido").value).toBe("2000,00");
  expect(screen.queryByLabelText("Desconto")).toBeNull();
  fireEvent.click(screen.getByText("Voltar"));
  fireEvent.click(screen.getByRole("checkbox", { name: /Pacote/ }));
  fireEvent.click(screen.getByText("Avançar"));
  expect(screen.getByLabelText("Desconto").value).toBe("0,00");
});
test("valor automático da seleção anterior não entra no caminho de crédito", () => {
  harness();
  fireEvent.click(screen.getByRole("checkbox", { name: /Pacote/ }));
  fireEvent.click(screen.getByText("Avançar"));
  expect(screen.getByLabelText("Valor recebido").value).toBe("3.999,84");
  fireEvent.click(screen.getByText("Voltar"));
  fireEvent.click(screen.getByRole("checkbox", { name: /Pacote/ }));
  fireEvent.click(screen.getByText("Avançar"));
  expect(screen.getByLabelText("Valor recebido").value).toBe("");
});
test("falha de consulta não autoriza crédito por ausência aparente de cobranças", () => {
  harness([], false);
  expect(screen.getByText("Avançar").disabled).toBe(true);
  expect(screen.getByRole("alert").textContent).toMatch(/carregar as cobranças/);
  expect(screen.queryByText("Avançar sem selecionar cobranças, o valor ficará como crédito do paciente.")).toBeNull();
});
test("Desconto seleciona zero por clique/teclado, permite editar/colar e bloqueia acima do saldo", async () => {
  harness([groups[0]]);
  fireEvent.click(screen.getByText("Avançar"));
  const input = screen.getByLabelText("Desconto");
  expect(input.value).toBe("0,00");
  await userEvent.click(input);
  expect([input.selectionStart, input.selectionEnd]).toEqual([0, 4]);
  await userEvent.type(input, "10,50", { skipClick: true });
  expect(input.value).toBe("10,50");
  fireEvent.blur(input);
  fireEvent.focus(input);
  expect(input.value).toBe("10,50");
  await userEvent.clear(input);
  await userEvent.paste(input, "100,84");
  expect(input.value).toBe("100,84");
  fireEvent.change(input, { target: { value: "0,00" } });
  screen.getByLabelText("Forma de pagamento").focus();
  await userEvent.tab();
  expect(document.activeElement).toBe(input);
  expect([input.selectionStart, input.selectionEnd]).toEqual([0, 4]);
  fireEvent.change(screen.getByLabelText("Valor recebido"), { target: { value: "1,00" } });
  fireEvent.change(input, { target: { value: "110,00" } });
  expect(screen.getByText("Confirmar recebimento").disabled).toBe(false);
  fireEvent.change(input, { target: { value: "111,01" } });
  expect(screen.getByRole("alert").textContent.replace(/\s+/g, " ")).toBe("O desconto não pode ultrapassar R$ 111,00.");
  expect(screen.getByText("Confirmar recebimento").disabled).toBe(true);
});
