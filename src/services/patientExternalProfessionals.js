import api from "./axios";

export const listPatientExternalProfessionals = (params) =>
  api.get("/patient-external-professionals", { params });

export const createPatientExternalProfessional = (payload) =>
  api.post("/patient-external-professionals", payload);

export const updatePatientExternalProfessional = (id, payload) =>
  api.put(`/patient-external-professionals/${id}`, payload);

export const inactivatePatientExternalProfessional = (id) =>
  api.delete(`/patient-external-professionals/${id}`);

export default {
  listPatientExternalProfessionals,
  createPatientExternalProfessional,
  updatePatientExternalProfessional,
  inactivatePatientExternalProfessional,
};
