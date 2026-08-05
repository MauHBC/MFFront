import fs from "fs";
import path from "path";

const read = (relativePath) => fs.readFileSync(
  path.resolve(__dirname, relativePath),
  "utf8",
);

describe("metadados visuais do prontuário", () => {
  const patientDetails = read("index.js");
  const evaluationDetails = read("../PatientEvaluationDetails/index.js");

  test("evoluções e avaliações usam tags separadas de tipo e status", () => {
    expect(patientDetails).toMatch(
      /<RecordTypePill[^>]*>\s*Evolução\s*<\/RecordTypePill>\s*<RecordStatusPill/,
    );
    expect(patientDetails).toMatch(
      /<RecordTypePill[^>]*>\s*Avaliação\s*<\/RecordTypePill>\s*<RecordStatusPill/,
    );
    expect(patientDetails).toContain('let recordStatusLabel = "Não assinado"');
    expect(patientDetails).toContain('recordStatusLabel = "Rascunho"');
  });

  test("rascunho usa vermelho e assinado usa verde", () => {
    expect(patientDetails).toContain('props.$status === "signed"');
    expect(patientDetails).toContain('return "#4f7c42"');
    expect(patientDetails).toContain('return "#a83f3f"');
    expect(patientDetails).toContain("gap: 7px");
  });

  test("remove o bloco repetitivo sem remover os metadados resumidos", () => {
    expect(patientDetails).not.toContain("ClinicalSignatureBlock");
    expect(evaluationDetails).not.toContain("SignatureBlock");
    expect(patientDetails).not.toContain("Assinado eletronicamente por:");
    expect(evaluationDetails).not.toContain("Assinado eletronicamente por:");
    expect(patientDetails).toContain("formatClinicalRecordMeta(evaluation)");
    expect(patientDetails).toContain("evaluation.clinical_signature");
  });

  test("casos clínicos exibem o metadado persistido de criação", () => {
    expect(patientDetails).toContain("formatClinicalCaseMeta(selectedRecordCase)");
  });

  test("registros legados permanecem neutros e não viram rascunhos", () => {
    expect(patientDetails).toContain('let recordStatus = "legacy"');
    expect(patientDetails).toContain('(recordStatus === "legacy" || (isFinalized && !signature))');
  });
});
