import React from "react";
import "@testing-library/jest-dom";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import FinancialCancellationModal from "./FinancialCancellationModal";
import {
  previewFinancialCancellation,
  confirmFinancialCancellation,
} from "../../../services/financialCancellation";

jest.mock("../../../services/financialCancellation", () => ({
  previewFinancialCancellation: jest.fn(),
  confirmFinancialCancellation: jest.fn(),
}));
jest.mock("../../../services/axios", () => ({
  getUserFacingApiError: (error, fallback) => fallback,
}));

const target = {
  entry_id: 501,
  patient_id: 30,
  patient_name: "Paciente fictício",
};
const money = (value) => `R$ ${(value / 100).toFixed(2)}`;
const preview = (extra = {}) => ({
  preview_fingerprint: "preview-1",
  eligible: true,
  blockers: [],
  patient: { id: 30, name: "Paciente fictício" },
  entry: {
    id: 501,
    session_id: 701,
    amount_cents: 9500,
    paid_cents: 5000,
    open_cents: 4500,
  },
  session: { id: 701, starts_at: "2026-10-28T13:00:00Z" },
  package: { amount_before_cents: 39500, amount_after_cents: 30000 },
  consequences: { replacement_created: false, money_refunded: false },
  release_amount_cents: 5000,
  credit_before_cents: 3000,
  credit_after_cents: 8000,
  allocations: [
    {
      id: 9,
      payment_id: 801,
      amount_cents: 5000,
      paid_at: "2026-11-05T12:00:00Z",
    },
  ],
  affected_sessions: [],
  replacements: [],
  requires_joint_cancellation: false,
  requires_late_policy_exception: false,
  can_override_late_policy: false,
  ...extra,
});
const renderModal = (extra = {}) =>
  render(
    <FinancialCancellationModal
      target={target}
      formatCurrency={money}
      onClose={jest.fn()}
      onCompleted={jest.fn()}
      {...extra}
    />,
  );
const enterReason = () =>
  fireEvent.change(screen.getByLabelText("Motivo do cancelamento"), {
    target: { value: "Pedido definitivo do paciente" },
  });
const confer = async () => {
  enterReason();
  fireEvent.click(
    screen.getByRole("button", { name: "Conferir cancelamento" }),
  );
  await screen.findByRole("button", { name: "Confirmar cancelamento" });
};

beforeEach(() => {
  jest.clearAllMocks();
  previewFinancialCancellation.mockResolvedValue({ data: preview() });
  confirmFinancialCancellation.mockResolvedValue({
    data: { id: 1, entry_id: 501, patient_id: 30 },
  });
});

test("exige motivo, apresenta valores do servidor e confirma uma única operação conjunta", async () => {
  let finish;
  confirmFinancialCancellation.mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  previewFinancialCancellation.mockResolvedValue({
    data: preview({
      affected_sessions: [
        { id: 888, starts_at: "2026-11-18T13:00:00Z", status: "scheduled" },
      ],
      replacements: [{ id: 77, status: "used" }],
      requires_joint_cancellation: true,
    }),
  });
  const completed = jest.fn();
  renderModal({ onCompleted: completed });
  fireEvent.click(
    screen.getByRole("button", { name: "Conferir cancelamento" }),
  );
  expect(screen.getByRole("alert")).toHaveTextContent("Informe o motivo");
  expect(previewFinancialCancellation).not.toHaveBeenCalled();
  await confer();
  expect(screen.getByRole("dialog", { name: "Resolver pendência" })).toBeInTheDocument();
  expect(screen.getByText("Cancelar a sessão de 28/10?")).toBeInTheDocument();
  expect(screen.getByText("O pacote passará de R$ 395.00 para R$ 300.00.")).toBeInTheDocument();
  expect(screen.getByText("R$ 50.00 ficarão como crédito para este paciente.")).toBeInTheDocument();
  expect(screen.getByText("Não haverá reposição nem devolução de dinheiro.")).toBeInTheDocument();
  expect(screen.getByText(/A sessão agendada para 18\/11\/2026 também será cancelada/)).toBeInTheDocument();
  expect(screen.queryByText(/#501|#701|#801|#888|#77/)).not.toBeInTheDocument();
  fireEvent.click(
    screen.getByRole("button", { name: "Confirmar cancelamento" }),
  );
  fireEvent.click(screen.getByRole("button", { name: "Confirmando..." }));
  expect(confirmFinancialCancellation).toHaveBeenCalledTimes(1);
  expect(confirmFinancialCancellation).toHaveBeenCalledWith(
    501,
    {
      reason: "Pedido definitivo do paciente",
      preview_fingerprint: "preview-1",
    },
    expect.any(String),
  );
  expect(completed).not.toHaveBeenCalled();
  await act(async () =>
    finish({ data: { id: 1, entry_id: 501, patient_id: 30 } }),
  );
  expect(completed).toHaveBeenCalledTimes(1);
});

test("prévia desatualizada exige nova conferência e editar motivo invalida a confirmação", async () => {
  confirmFinancialCancellation.mockRejectedValueOnce({
    response: { status: 409, data: { code: "CANCELLATION_PREVIEW_STALE" } },
  });
  renderModal();
  await confer();
  fireEvent.click(
    screen.getByRole("button", { name: "Confirmar cancelamento" }),
  );
  await screen.findByText(/Os dados mudaram/);
  expect(
    screen.queryByRole("button", { name: "Confirmar cancelamento" }),
  ).not.toBeInTheDocument();
  previewFinancialCancellation.mockResolvedValueOnce({
    data: preview({
      preview_fingerprint: "preview-2",
      release_amount_cents: 6000,
      credit_after_cents: 9000,
    }),
  });
  fireEvent.click(
    screen.getByRole("button", { name: "Conferir cancelamento" }),
  );
  await screen.findByRole("button", { name: "Confirmar cancelamento" });
  expect(screen.getByText("R$ 60.00 ficarão como crédito para este paciente.")).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Motivo do cancelamento"), {
    target: { value: "Outro motivo" },
  });
  expect(
    screen.queryByRole("button", { name: "Confirmar cancelamento" }),
  ).not.toBeInTheDocument();
  expect(confirmFinancialCancellation).toHaveBeenCalledTimes(1);
});

test("resultado ambíguo conserva a chave e o comando para retry", async () => {
  confirmFinancialCancellation.mockRejectedValueOnce(new Error("timeout"));
  renderModal();
  await confer();
  fireEvent.click(
    screen.getByRole("button", { name: "Confirmar cancelamento" }),
  );
  await screen.findByRole("alert");
  await waitFor(() =>
    expect(
      screen.getByRole("button", { name: "Verificar resultado" }),
    ).toBeEnabled(),
  );
  await act(async () => {
    fireEvent.click(
      screen.getByRole("button", { name: "Verificar resultado" }),
    );
  });
  expect(confirmFinancialCancellation).toHaveBeenCalledTimes(2);
  expect(confirmFinancialCancellation.mock.calls[1]).toEqual(
    confirmFinancialCancellation.mock.calls[0],
  );
});

test("resultado incerto bloqueia edição e saída até repetir a tentativa original", async () => {
  confirmFinancialCancellation.mockRejectedValueOnce(new Error("timeout"));
  const completed = jest.fn();
  const closed = jest.fn();
  renderModal({ onCompleted: completed, onClose: closed });
  await confer();
  fireEvent.click(screen.getByRole("button", { name: "Confirmar cancelamento" }));
  await screen.findByRole("alert");
  const firstAttempt = confirmFinancialCancellation.mock.calls[0];
  const reason = screen.getByLabelText("Motivo do cancelamento");
  expect(reason).toBeDisabled();
  expect(screen.getByRole("button", { name: "Voltar" })).toBeDisabled();
  fireEvent.change(reason, { target: { value: "Motivo revisado após timeout" } });
  expect(reason).toHaveValue("Pedido definitivo do paciente");
  fireEvent.click(screen.getByRole("button", { name: "Verificar resultado" }));
  await waitFor(() => expect(confirmFinancialCancellation).toHaveBeenCalledTimes(2));
  const nextAttempt = confirmFinancialCancellation.mock.calls[1];
  expect(nextAttempt).toEqual(firstAttempt);
  expect(previewFinancialCancellation).toHaveBeenCalledTimes(1);
  expect(closed).not.toHaveBeenCalled();
  await waitFor(() => expect(completed).toHaveBeenCalledTimes(1));
});

test("operação já resolvida ao verificar tentativa incerta atualiza a tela", async () => {
  confirmFinancialCancellation.mockRejectedValueOnce(new Error("timeout after commit"));
  confirmFinancialCancellation.mockRejectedValueOnce({
    response: {
      status: 409,
      data: { code: "FINANCIAL_CANCELLATION_ALREADY_RESOLVED" },
    },
  });
  const completed = jest.fn();
  renderModal({ onCompleted: completed });
  await confer();
  fireEvent.click(screen.getByRole("button", { name: "Confirmar cancelamento" }));
  await screen.findByRole("alert");
  fireEvent.click(screen.getByRole("button", { name: "Verificar resultado" }));
  await waitFor(() => expect(completed).toHaveBeenCalledWith({
    entry_id: 501,
    patient_id: 30,
    already_resolved: true,
  }));
  expect(confirmFinancialCancellation.mock.calls[1]).toEqual(
    confirmFinancialCancellation.mock.calls[0],
  );
  expect(previewFinancialCancellation).toHaveBeenCalledTimes(1);
});

test("bloqueio do servidor não permite confirmação nem interpreta used como atendimento concluído", async () => {
  previewFinancialCancellation.mockResolvedValue({
    data: preview({
      eligible: false,
      blockers: [
        {
          code: "SCHEDULE_PERMISSION_REQUIRED",
          message:
            "Solicite o tratamento prévio do agendamento a uma pessoa autorizada.",
        },
      ],
      affected_sessions: [
        { id: 888, starts_at: "2026-11-18T13:00:00Z", status: "scheduled" },
      ],
      replacements: [{ id: 77, status: "used" }],
    }),
  });
  renderModal();
  enterReason();
  fireEvent.click(
    screen.getByRole("button", { name: "Conferir cancelamento" }),
  );
  await screen.findByText(/Solicite o tratamento prévio/);
  expect(
    screen.queryByRole("button", { name: "Confirmar cancelamento" }),
  ).not.toBeInTheDocument();
  expect(confirmFinancialCancellation).not.toHaveBeenCalled();
});

test("exceção autorizada exige motivo e nova prévia antes de confirmar", async () => {
  previewFinancialCancellation.mockResolvedValueOnce({
    data: preview({
      eligible: false,
      requires_late_policy_exception: true,
      can_override_late_policy: true,
      blockers: [
        { code: "LATE", message: "É necessária uma exceção autorizada." },
      ],
    }),
  });
  renderModal();
  enterReason();
  fireEvent.click(
    screen.getByRole("button", { name: "Conferir cancelamento" }),
  );
  await screen.findByText("É necessária uma exceção autorizada.");
  fireEvent.click(screen.getByRole("checkbox"));
  fireEvent.click(
    screen.getByRole("button", { name: "Conferir cancelamento" }),
  );
  expect(previewFinancialCancellation).toHaveBeenCalledTimes(1);
  fireEvent.change(screen.getByLabelText("Motivo da exceção"), {
    target: { value: "Justificativa autorizada" },
  });
  fireEvent.click(
    screen.getByRole("button", { name: "Conferir cancelamento" }),
  );
  await screen.findByRole("button", { name: "Confirmar cancelamento" });
  expect(previewFinancialCancellation).toHaveBeenLastCalledWith(501, {
    reason: "Pedido definitivo do paciente",
    late_policy_exception_justified: true,
    late_policy_exception_reason: "Justificativa autorizada",
  });
});

test("resposta de outro paciente é rejeitada e privacidade mascara os valores da prévia válida", async () => {
  previewFinancialCancellation.mockResolvedValueOnce({
    data: preview({ patient: { id: 99 } }),
  });
  renderModal({ formatCurrency: () => "R$ ••••" });
  enterReason();
  fireEvent.click(
    screen.getByRole("button", { name: "Conferir cancelamento" }),
  );
  await screen.findByRole("alert");
  expect(
    screen.queryByRole("button", { name: "Confirmar cancelamento" }),
  ).not.toBeInTheDocument();
  fireEvent.click(
    screen.getByRole("button", { name: "Conferir cancelamento" }),
  );
  await screen.findByRole("button", { name: "Confirmar cancelamento" });
  expect(screen.getByText("O pacote passará de R$ •••• para R$ ••••.")).toBeInTheDocument();
  expect(screen.getByText("R$ •••• ficarão como crédito para este paciente.")).toBeInTheDocument();
  expect(screen.queryByText(/R\$ 50\.00|R\$ 395\.00|R\$ 300\.00/)).not.toBeInTheDocument();
});

test.each([
  ["sem consequências", { consequences: undefined }],
  ["sem valor do pacote", { package: undefined }],
  ["de outra cobrança", { entry: { id: 999 } }],
  ["com data inválida", { session: { id: 701, starts_at: "invalid" } }],
])("prévia %s falha fechada e mantém a confirmação indisponível", async (_label, override) => {
  previewFinancialCancellation.mockResolvedValueOnce({ data: preview(override) });
  renderModal();
  enterReason();
  fireEvent.click(screen.getByRole("button", { name: "Conferir cancelamento" }));
  await screen.findByRole("alert");
  expect(screen.queryByRole("button", { name: "Confirmar cancelamento" })).not.toBeInTheDocument();
  expect(screen.queryByRole("region", { name: "Prévia do cancelamento" })).not.toBeInTheDocument();
  expect(confirmFinancialCancellation).not.toHaveBeenCalled();
});
