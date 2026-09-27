import api from "./axios";
import { getFinancialCreditDestinations, previewFinancialCreditApplication, confirmFinancialCreditApplication } from "./financialCredit";

jest.mock("./axios", () => ({ __esModule: true, default: { get: jest.fn(), post: jest.fn() } }));
beforeEach(() => jest.clearAllMocks());

test("consulta destinos e confere seleção explícita sem chamar confirmação", () => {
  const scope = { patient_id: 30, period_start: "2026-10-01", period_end: "2026-10-31" };
  const body = { ...scope, selected_entry_ids: [42, 43], amount_cents: 1250 };
  getFinancialCreditDestinations(scope);
  previewFinancialCreditApplication(body);
  expect(api.get).toHaveBeenCalledWith("/financial-payments/credit-destinations", { params: scope });
  expect(api.post.mock.calls).toEqual([["/financial-payments/credit-application-preview", body]]);
});

test("confirma plano revisado usando a chave exclusivamente no header", async () => {
  const body = { patient_id: 30, selected_entry_ids: [42], amount_cents: 1250, preview_fingerprint: "exact-plan" };
  const failure = new Error("Resposta perdida");
  api.post.mockRejectedValueOnce(failure);
  await expect(confirmFinancialCreditApplication(body, "same-attempt")).rejects.toBe(failure);
  expect(api.post).toHaveBeenCalledWith("/financial-payments/apply-selected-credit", body, { headers: { "Idempotency-Key": "same-attempt" } });
  expect(api.post).toHaveBeenCalledTimes(1);
});
