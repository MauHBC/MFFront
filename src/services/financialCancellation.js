import api from "./axios";

export const previewSessionCancellation = (sessionId, command) =>
  api.post(`/sessions/${sessionId}/cancellation-preview`, command);

export const confirmSessionCancellation = (sessionId, command, idempotencyKey) =>
  api.post(`/sessions/${sessionId}/cancel-with-credit`, command, {
    headers: { "Idempotency-Key": idempotencyKey },
  });

export const previewFinancialCancellation = (entryId, command) =>
  api.post(`/financial-entries/${entryId}/cancellation-preview`, command);

export const confirmFinancialCancellation = (
  entryId,
  command,
  idempotencyKey,
) =>
  api.post(`/financial-entries/${entryId}/cancel-with-credit`, command, {
    headers: { "Idempotency-Key": idempotencyKey },
  });
