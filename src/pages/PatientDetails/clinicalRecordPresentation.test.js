import {
  formatClinicalCaseAuthor,
  formatClinicalCaseMeta,
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

  it("apresenta a data e a identidade canônica de quem criou o caso clínico", () => {
    const clinicalCase = {
      created_at: new Date(2026, 7, 5, 12, 0, 0).toISOString(),
      created_by: 8,
      createdByUser: {
        id: 8,
        TeamPerson: {
          name: "MHBC",
          ClinicProfessional: {
            registration_region: "15",
            registration_number: "123456789F",
          },
        },
      },
    };

    expect(formatClinicalCaseMeta(clinicalCase)).toContain("Adicionado em 05/08/2026");
    expect(formatClinicalCaseMeta(clinicalCase)).toContain(
      "MHBC · CREFITO 15/123456789F",
    );
  });

  it("mantém o criador original após edição posterior", () => {
    const clinicalCase = {
      created_at: new Date(2026, 7, 5, 12, 0, 0).toISOString(),
      updated_by: 99,
      updatedByUser: {
        TeamPerson: { name: "Pessoa que editou" },
      },
      createdByUser: {
        TeamPerson: {
          name: "Pessoa criadora",
          ClinicProfessional: {
            registration_region: "15",
            registration_number: "111-F",
          },
        },
      },
    };

    expect(formatClinicalCaseAuthor(clinicalCase)).toBe(
      "Pessoa criadora · CREFITO 15/111-F",
    );
  });

  it("não usa usuário autenticado como fallback e trata legado de modo neutro", () => {
    const legacyCase = {
      created_at: "2026-08-05T15:00:00.000Z",
      currentUser: {
        TeamPerson: {
          name: "Usuário atual",
          ClinicProfessional: {
            registration_region: "15",
            registration_number: "999-F",
          },
        },
      },
    };

    expect(formatClinicalCaseAuthor(legacyCase)).toBe(
      "Autoria não identificada · CREFITO não informado",
    );
    expect(formatClinicalCaseMeta(legacyCase)).not.toContain("Usuário atual");
  });
});
