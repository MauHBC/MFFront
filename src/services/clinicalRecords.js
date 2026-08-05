import api from "./axios";

const idempotencyKey = (prefix) => {
  if (globalThis.crypto?.randomUUID) return `${prefix}-${globalThis.crypto.randomUUID()}`;
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
};

export const getClinicalSigningIdentity = () => api
  .get("/clinical-records/signing-identity")
  .then((response) => response.data);

export const finalizeClinicalRecord = (recordType, recordId, version) => api.post(
  `/clinical-records/${recordType}/${recordId}/finalize`,
  { version },
  { headers: { "Idempotency-Key": idempotencyKey("finalize") } },
).then((response) => response.data);

export const addSignedClinicalAddendum = (
  recordType,
  recordId,
  { version, reason, content },
) => api.post(
  `/clinical-records/${recordType}/${recordId}/revisions`,
  { type: "addendum", version, reason, content },
  { headers: { "Idempotency-Key": idempotencyKey("addendum") } },
).then((response) => response.data);
