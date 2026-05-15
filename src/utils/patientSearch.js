export const normalizeSearchText = (value) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const firstPresentText = (values) => {
  const found = values
    .map((value) => String(value || "").trim())
    .find((value) => value.length > 0);
  return found || "Paciente";
};

export const getPatientDisplayName = (patient) =>
  firstPresentText([
    patient?.nickname,
    patient?.preferred_name,
    patient?.display_name,
    patient?.full_name,
    patient?.name,
  ]);

export const getPatientSearchText = (patient) =>
  normalizeSearchText([
    patient?.nickname,
    patient?.preferred_name,
    patient?.display_name,
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
