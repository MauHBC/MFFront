import api from "./axios";

export const listPatientClinicalCases = (params) =>
  api.get("/patient-clinical-cases", { params });

export const createPatientClinicalCase = (payload) =>
  api.post("/patient-clinical-cases", payload);

export const updatePatientClinicalCase = (id, payload) =>
  api.put(`/patient-clinical-cases/${id}`, payload);

const idempotencyKey = (prefix) => {
  if (globalThis.crypto?.randomUUID) return `${prefix}-${globalThis.crypto.randomUUID()}`;
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
};

export const updatePatientClinicalCaseStatus = (id, status, version, reason) =>
  api.patch(
    `/patient-clinical-cases/${id}/status`,
    { status, version, reason },
    { headers: { "Idempotency-Key": idempotencyKey("case-status") } },
  );

export const getPatientClinicalCaseHistory = (id) =>
  api.get(`/patient-clinical-cases/${id}/history`).then((response) => response.data);

export default {
  listPatientClinicalCases,
  createPatientClinicalCase,
  updatePatientClinicalCase,
  updatePatientClinicalCaseStatus,
  getPatientClinicalCaseHistory,
};
