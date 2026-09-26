import api from "./axios";

export const getFinancialCreditDestinations = (params) =>
  api.get("/financial-payments/credit-destinations", { params });

export const previewFinancialCreditApplication = (command) =>
  api.post("/financial-payments/credit-application-preview", command);

export const confirmFinancialCreditApplication = (command, idempotencyKey) =>
  api.post("/financial-payments/apply-selected-credit", command, {
    headers: { "Idempotency-Key": idempotencyKey },
  });
