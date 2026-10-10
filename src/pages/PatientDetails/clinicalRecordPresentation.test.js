import {
  formatClinicalCaseAuthor,
  formatClinicalCaseMeta,
  formatClinicalRecordAuthor,
  formatClinicalRecordDateTime,
  formatClinicalRecordMeta,
} from "./clinicalRecordPresentation";

describe("clinical record presentation", () => {
  it("apresenta data, hora, profissional e CREFITO no mesmo metadado", () => {
    const date = new Date("2026-08-04T17:35:00Z");
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
    })).toBe("Profissional legado");
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
      "",
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

    expect(formatClinicalCaseMeta(clinicalCase)).not.toContain("Adicionado em");
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
      "",
    );
    expect(formatClinicalCaseMeta(legacyCase)).not.toContain("Usuário atual");
  });
});

test("preserva a data clínica date-only e omite placeholders e separadores órfãos", () => {
  expect(formatClinicalRecordDateTime("2026-06-08")).toBe("08/06/2026");
  expect(formatClinicalRecordMeta({ created_at: "2026-06-08", updated_at: "2026-06-09T15:00:00Z" })).toBe("08/06/2026");
  expect(formatClinicalRecordDateTime("2026-06-09T01:00:00Z")).toContain("08/06/2026");
  expect(formatClinicalCaseMeta({ created_at: "2026-06-09T15:00:00Z", started_on: "2026-06-08" })).toBe("");
});

test("uses the tenant-scoped membership author for clinical records and cases", () => {
  const person = { name: "Autoria sintética do membership" };
  expect(formatClinicalRecordAuthor({ clinicalAuthorMembership: { person } })).toBe("Autoria sintética do membership");
  expect(formatClinicalCaseAuthor({ createdByMembership: { person } })).toBe("Autoria sintética do membership");
});
