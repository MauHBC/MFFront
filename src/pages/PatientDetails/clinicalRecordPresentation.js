const value = (source, ...keys) => keys.reduce(
  (result, key) => (result === undefined || result === null ? source?.[key] : result),
  undefined,
);

export function formatClinicalRecordDateTime(input) {
  if (!input) return "--/--/---- --:--";
  if (typeof input === "string" && /^\d{4}-\d{2}-\d{2}$/.test(input)) return input.split("-").reverse().join("/");
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return "--/--/---- --:--";
  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
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
  const membership = value(record, "clinicalAuthorMembership", "clinical_author_membership");
  const authorPerson = value(membership, "person") || value(authorUser, "TeamPerson", "team_person");
  const legacyProfessional = value(
    authorPerson,
    "ClinicProfessional",
    "clinic_professional",
  );
  const identity = professional || legacyProfessional;
  const name = String(person?.name || authorPerson?.name || authorUser?.name || "").trim();
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
    : "";
  return [name, registration].filter(Boolean).join(" · ");
}

export function formatClinicalRecordMeta(record) {
  return [formatClinicalRecordDateTime(
    record?.created_at || record?.createdAt,
  ), formatClinicalRecordAuthor(record)].filter(Boolean).join(" · ");
}

export function formatClinicalCaseAuthor(clinicalCase) {
  const authorUser = value(clinicalCase, "createdByUser", "created_by_user");
  const membership = value(clinicalCase, "createdByMembership", "created_by_membership");
  const person = value(membership, "person") || value(authorUser, "TeamPerson", "team_person");
  const professional = value(person, "ClinicProfessional", "clinic_professional");

  if (!person) {
    return "";
  }

  const name = String(person.name || "").trim();
  const region = String(value(
    professional,
    "registration_region",
    "registrationRegion",
  ) || "").trim();
  const number = String(value(
    professional,
    "registration_number",
    "registrationNumber",
  ) || "").trim();
  const registration = region && number
    ? `CREFITO ${region}/${number}`
    : "";

  return [name, registration].filter(Boolean).join(" · ");
}

export function formatClinicalCaseMeta(clinicalCase) {
  return formatClinicalCaseAuthor(clinicalCase);
}
