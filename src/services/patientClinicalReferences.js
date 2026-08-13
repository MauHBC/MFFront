import api from "./axios";

export const listPatientClinicalReferences = (params) =>
  api.get("/patient-clinical-references", { params });

export const createPatientClinicalReference = (payload) =>
  api.post("/patient-clinical-references", payload);

export const updatePatientClinicalReference = (id, payload) =>
  api.put(`/patient-clinical-references/${id}`, payload);

export const removePatientClinicalReference = (id, version) =>
  api.delete(`/patient-clinical-references/${id}`, { data: { version } });

export default {
  listPatientClinicalReferences,
  createPatientClinicalReference,
  updatePatientClinicalReference,
  removePatientClinicalReference,
};
