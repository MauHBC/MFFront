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

function PaymentFlowHarness({ onPaymentSaved }) {
  const flow = useFinancialPaymentFlow({ onPaymentSaved });
  return (
    <div>
      <button
        type="button"
        onClick={() => flow.openScopedPatientPaymentModal(patient, scopedPayment)}
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
};
