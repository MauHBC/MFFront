import api from "./axios";

export const listPatientClinicalCases = (params) =>
  api.get("/patient-clinical-cases", { params });

export const createPatientClinicalCase = (payload) =>
  api.post("/patient-clinical-cases", payload);

export const updatePatientClinicalCase = (id, payload) =>
  api.put(`/patient-clinical-cases/${id}`, payload);

export const updatePatientClinicalCaseStatus = (id, status) =>
  api.patch(`/patient-clinical-cases/${id}/status`, { status });

export default {
  listPatientClinicalCases,
  createPatientClinicalCase,
  updatePatientClinicalCase,
  updatePatientClinicalCaseStatus,
};
