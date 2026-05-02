export const normalizeSearchText = (value) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

export const getPatientDisplayName = (patient) =>
  patient?.full_name || patient?.name || "Paciente";

export const getPatientSearchText = (patient) =>
  normalizeSearchText([
    patient?.full_name,
    patient?.name,
    patient?.phone,
    patient?.phone_number,
    patient?.mobile,
    patient?.cellphone,
    patient?.cpf,
    patient?.document,
    patient?.email,
  ]
    .filter(Boolean)
    .join(" "));

export const filterPatients = (patients = [], query = "") => {
  const needle = normalizeSearchText(query);
  if (!needle) return patients;
  return patients.filter((patient) => getPatientSearchText(patient).includes(needle));
};
