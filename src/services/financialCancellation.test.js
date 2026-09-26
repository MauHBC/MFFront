import {
  previewFinancialCancellation,
  confirmFinancialCancellation,
  previewSessionCancellation,
  confirmSessionCancellation,
} from "./financialCancellation";
import api from "./axios";

jest.mock("./axios", () => ({
  __esModule: true,
  default: { post: jest.fn() },
}));

beforeEach(() => jest.clearAllMocks());

test("prévia e confirmação usam comandos próprios, com idempotência somente na confirmação", () => {
  const command = { reason: "Cancelamento definitivo" };
  previewFinancialCancellation(42, command);
  expect(api.post).toHaveBeenCalledWith(
    "/financial-entries/42/cancellation-preview",
    command,
  );
  const confirmation = { ...command, preview_fingerprint: "current-preview" };
  confirmFinancialCancellation(42, confirmation, "logical-attempt");
  expect(api.post).toHaveBeenCalledWith(
    "/financial-entries/42/cancel-with-credit",
    confirmation,
    {
      headers: { "Idempotency-Key": "logical-attempt" },
    },
  );
});

test("cancelamento iniciado na Agenda mantém o alvo sessão e uma única confirmação atômica", async () => {
  const previewResponse = { data: { preview_fingerprint: "session-preview" } };
  const confirmationResponse = { data: { id: 10, patient_id: 42 } };
  api.post.mockResolvedValueOnce(previewResponse).mockResolvedValueOnce(confirmationResponse);
  const command = {
    reason: "Cancelamento definitivo solicitado",
    late_policy_exception_justified: true,
    late_policy_exception_reason: "Exceção autorizada",
  };
  await expect(previewSessionCancellation(701, command)).resolves.toBe(previewResponse);
  const confirmation = { ...command, preview_fingerprint: "session-preview" };
  await expect(confirmSessionCancellation(701, confirmation, "same-operation")).resolves.toBe(confirmationResponse);
  expect(api.post.mock.calls).toEqual([
    ["/sessions/701/cancellation-preview", command],
    ["/sessions/701/cancel-with-credit", confirmation, { headers: { "Idempotency-Key": "same-operation" } }],
  ]);
});

test("falha na confirmação da Agenda retorna ao chamador sem cancelar ou liberar crédito separadamente", async () => {
  const failure = { response: { status: 409, data: { code: "CANCELLATION_PREVIEW_STALE" } } };
  api.post.mockRejectedValueOnce(failure);
  await expect(confirmSessionCancellation(701, { reason: "Motivo", preview_fingerprint: "stale" }, "attempt-1")).rejects.toBe(failure);
  expect(api.post).toHaveBeenCalledTimes(1);
});
