const value = (source, ...keys) => keys.reduce(
  (result, key) => (result === undefined || result === null ? source?.[key] : result),
  undefined,
);

export function formatClinicalRecordDateTime(input) {
  if (!input) return "--/--/---- --:--";
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return "--/--/---- --:--";
  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatClinicalRecordAuthor(record) {
  const professional = value(
    record,
    "clinicalAuthorProfessional",
    "clinical_author_professional",
  );
  const authorUser = value(record, "clinicalAuthorUser", "clinical_author_user");
  const person = value(professional, "TeamPerson", "team_person");
  const authorPerson = value(authorUser, "TeamPerson", "team_person");
  const legacyProfessional = value(
    authorPerson,
    "ClinicProfessional",
    "clinic_professional",
  );
  const identity = professional || legacyProfessional;
  const name = String(person?.name || authorPerson?.name || authorUser?.name || "").trim()
    || "Profissional não identificado";
  const region = String(value(
    identity,
    "registration_region",
    "registrationRegion",
  ) || "").trim();
  const number = String(value(
    identity,
    "registration_number",
    "registrationNumber",
  ) || "").trim();
  const registration = region && number
    ? `CREFITO ${region}/${number}`
    : "CREFITO não informado";
  return `${name} · ${registration}`;
}

export function formatClinicalRecordMeta(record) {
  return `${formatClinicalRecordDateTime(
    record?.created_at || record?.createdAt,
  )} · ${formatClinicalRecordAuthor(record)}`;
}
