/* eslint-env jest */
import React from "react";
import PropTypes from "prop-types";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "react-toastify";

import useFinancialPaymentFlow from "./useFinancialPaymentFlow";
import {
  createFinancialEntry,
  createFinancialPayment,
} from "../../../services/financial";

jest.mock("react-toastify", () => ({
  toast: { error: jest.fn(), success: jest.fn() },
}));

jest.mock("../../../services/axios", () => ({
  getUserFacingApiError: jest.fn((error, fallback) => fallback),
}));

jest.mock("../../../services/financial", () => ({
  createFinancialEntry: jest.fn(),
  createFinancialPayment: jest.fn(),
}));

const patient = { id: 30, full_name: "Maria Silva" };
const scopedPayment = {
  patientId: 30,
  patientName: "Maria Silva",
  totalOpenCents: 10000,
  entries: [{ entryId: 501, openCents: 10000 }],
};

function PaymentFlowHarness({ onPaymentSaved, payment = scopedPayment }) {
  const flow = useFinancialPaymentFlow({ onPaymentSaved });
  return (
    <div>
      <button
        type="button"
        onClick={() => flow.openScopedPatientPaymentModal(patient, payment)}
      >
        Abrir
      </button>
      {flow.isOpen && (
        <>
          <input
            aria-label="Forma"
            name="payment_method_id"
            value={flow.form.payment_method_id}
            onChange={flow.handleChange}
          />
          <input
            aria-label="Valor"
            name="amount"
            value={flow.form.amount}
            onChange={flow.handleChange}
          />
          <input
            aria-label="Data"
            name="paid_at"
            value={flow.form.paid_at}
            onChange={flow.handleChange}
          />
          <input
            aria-label="Desconto"
            name="discount"
            value={flow.form.discount}
            onChange={flow.handleChange}
          />
          <button type="button" onClick={flow.save}>Confirmar</button>
        </>
      )}
    </div>
  );
}

const prepareValidAttempt = async () => {
  await userEvent.click(screen.getByRole("button", { name: "Abrir" }));
  fireEvent.change(screen.getByLabelText("Forma"), { target: { value: "3" } });
  fireEvent.change(screen.getByLabelText("Data"), { target: { value: "2026-08-15" } });
};

describe("useFinancialPaymentFlow - idempotência da confirmação", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    createFinancialEntry.mockResolvedValue({ data: { id: 990 } });
    createFinancialPayment.mockResolvedValue({ data: { id: 991 } });
  });

  it.each([
    [8690, "86,90"],
    [107702, "1.077,02"],
  ])("preenche recebimento de %i centavos e preserva valor ao confirmar", async (cents, formatted) => {
    const payment = { ...scopedPayment, totalOpenCents: cents,
      entries: [{ entryId: 501, openCents: cents }] };
    render(<PaymentFlowHarness onPaymentSaved={jest.fn()} payment={payment} />);
    await userEvent.click(screen.getByRole("button", { name: "Abrir" }));
    expect(screen.getByLabelText("Valor").value).toBe(formatted);
    fireEvent.change(screen.getByLabelText("Forma"), { target: { value: "3" } });
    fireEvent.change(screen.getByLabelText("Data"), { target: { value: "2026-08-15" } });
    await userEvent.click(screen.getByRole("button", { name: "Confirmar" }));
    await waitFor(() => expect(createFinancialPayment).toHaveBeenCalledWith(
      expect.objectContaining({ amount_cents: cents }), expect.any(String),
    ));
  });

  it("reutiliza chave e anchor quando o retry sucede após erro ambíguo", async () => {
    createFinancialPayment
      .mockRejectedValueOnce(new Error("timeout após envio"))
      .mockResolvedValueOnce({ data: { id: 991 } });
    const onPaymentSaved = jest.fn().mockResolvedValue(undefined);
    render(<PaymentFlowHarness onPaymentSaved={onPaymentSaved} />);
    await prepareValidAttempt();

    await userEvent.click(screen.getByRole("button", { name: "Confirmar" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledTimes(1));
    const firstKey = createFinancialPayment.mock.calls[0][1];

    await userEvent.click(screen.getByRole("button", { name: "Confirmar" }));
    await waitFor(() => expect(createFinancialPayment).toHaveBeenCalledTimes(2));

    expect(createFinancialEntry).toHaveBeenCalledTimes(1);
    expect(createFinancialPayment.mock.calls[1][0].entry_id).toBe(990);
    expect(createFinancialPayment.mock.calls[1][1]).toBe(firstKey);
    expect(firstKey).toEqual(expect.any(String));
  });

  it("envia as 25 cobranças do desconto mesmo quando só 13 recebem dinheiro", async () => {
    const entries = [11100, ...Array(24).fill(16666)]
      .map((openCents, index) => ({ entryId: 501 + index, openCents }));
    createFinancialPayment.mockRejectedValue(new Error("resposta indisponível"));
    render(<PaymentFlowHarness onPaymentSaved={jest.fn()} payment={{
      ...scopedPayment, totalOpenCents: 411084, entries,
    }} />);
    await prepareValidAttempt();
    fireEvent.change(screen.getByLabelText("Valor"), { target: { value: "2000,00" } });
    fireEvent.change(screen.getByLabelText("Desconto"), { target: { value: "110,84" } });
    fireEvent.change(screen.getByLabelText("Data"), { target: { value: "2026-09-10" } });
    await userEvent.click(screen.getByRole("button", { name: "Confirmar" }));
    await waitFor(() => expect(createFinancialPayment).toHaveBeenCalledTimes(1));
    const [payload, key] = createFinancialPayment.mock.calls[0];
    expect(payload.amount_cents).toBe(200000);
    expect(payload.discount_cents).toBe(11084);
    expect(payload.note).toBeNull();
    expect(payload.paid_at).toBe(new Date("2026-09-10T09:00:00").toISOString());
    expect(payload.adjustment_targets).toEqual(entries.map((item) => ({
      entry_id: item.entryId, open_amount_cents: item.openCents,
    })));
    expect(payload.allocations.map((item) => item.amount_cents))
      .toEqual([10801, ...Array(11).fill(16217), 10812]);
    await userEvent.click(screen.getByRole("button", { name: "Confirmar" }));
    await waitFor(() => expect(createFinancialPayment).toHaveBeenCalledTimes(2));
    expect(createFinancialPayment.mock.calls[1]).toEqual([payload, key]);
    expect(createFinancialEntry).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText("Valor").value).toBe("2000,00");
  });

  it("bloqueia duplo clique antes do React desabilitar o botão", async () => {
    let resolveAnchor;
    createFinancialEntry.mockImplementation(() => new Promise((resolve) => {
      resolveAnchor = resolve;
    }));
    render(<PaymentFlowHarness onPaymentSaved={jest.fn()} />);
    await prepareValidAttempt();

    const confirm = screen.getByRole("button", { name: "Confirmar" });
    fireEvent.click(confirm);
    fireEvent.click(confirm);
    expect(createFinancialEntry).toHaveBeenCalledTimes(1);

    resolveAnchor({ data: { id: 990 } });
    await waitFor(() => expect(createFinancialPayment).toHaveBeenCalledTimes(1));
  });

  it("gera nova chave somente depois que uma nova operação é aberta", async () => {
    createFinancialEntry
      .mockResolvedValueOnce({ data: { id: 990 } })
      .mockResolvedValueOnce({ data: { id: 992 } });
    render(<PaymentFlowHarness onPaymentSaved={jest.fn().mockResolvedValue(undefined)} />);
    await prepareValidAttempt();
    await userEvent.click(screen.getByRole("button", { name: "Confirmar" }));
    await waitFor(() => expect(createFinancialPayment).toHaveBeenCalledTimes(1));
    const firstKey = createFinancialPayment.mock.calls[0][1];

    await prepareValidAttempt();
    await userEvent.click(screen.getByRole("button", { name: "Confirmar" }));
    await waitFor(() => expect(createFinancialPayment).toHaveBeenCalledTimes(2));
    const secondKey = createFinancialPayment.mock.calls[1][1];

    expect(secondKey).not.toBe(firstKey);
    expect(createFinancialEntry).toHaveBeenCalledTimes(2);
  });
});

PaymentFlowHarness.propTypes = {
  onPaymentSaved: PropTypes.func.isRequired,
  payment: PropTypes.shape({
    totalOpenCents: PropTypes.number,
  }),
};

PaymentFlowHarness.defaultProps = {
  payment: scopedPayment,
};
