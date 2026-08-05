import {
  formatClinicalRecordAuthor,
  formatClinicalRecordDateTime,
  formatClinicalRecordMeta,
} from "./clinicalRecordPresentation";

describe("clinical record presentation", () => {
  it("apresenta data, hora, profissional e CREFITO no mesmo metadado", () => {
    const date = new Date(2026, 7, 4, 14, 35, 0);
    const record = {
      created_at: date.toISOString(),
      clinicalAuthorProfessional: {
        registration_region: "15",
        registration_number: "12345-F",
        TeamPerson: { name: "Leonardo" },
      },
    };

    expect(formatClinicalRecordDateTime(record.created_at)).toContain("14:35");
    expect(formatClinicalRecordMeta(record)).toContain("04/08/2026");
    expect(formatClinicalRecordMeta(record)).toContain("Leonardo · CREFITO 15/12345-F");
  });

  it("usa nome da conta em registros legados sem atuação vinculada", () => {
    expect(formatClinicalRecordAuthor({
      clinicalAuthorUser: { name: "Profissional legado" },
    })).toBe("Profissional legado · CREFITO não informado");
  });

  it("resolve CREFITO canônico quando o legado registra somente a conta autora", () => {
    expect(formatClinicalRecordAuthor({
      clinicalAuthorUser: {
        name: "Nome legado da conta",
        TeamPerson: {
          name: "Profissional canônico",
          ClinicProfessional: {
            registration_region: "15",
            registration_number: "54321-F",
          },
        },
      },
    })).toBe("Profissional canônico · CREFITO 15/54321-F");
  });

  it("falha de forma explícita quando o legado não possui autoria", () => {
    expect(formatClinicalRecordAuthor({})).toBe(
      "Profissional não identificado · CREFITO não informado",
    );
    expect(formatClinicalRecordDateTime(null)).toBe("--/--/---- --:--");
  });
});
