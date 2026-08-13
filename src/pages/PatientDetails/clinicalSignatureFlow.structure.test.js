import fs from "fs";
import path from "path";

const read = (relativePath) => fs.readFileSync(
  path.resolve(__dirname, relativePath),
  "utf8",
);

describe("integração visual da assinatura clínica", () => {
  const patientDetails = read("index.js");
  const evaluationDetails = read("../PatientEvaluationDetails/index.js");
  const evaluationNew = read("../PatientEvaluationNew/index.js");
  const signatureSources = [patientDetails, evaluationDetails, evaluationNew];

  test("as três telas usam o modal compartilhado e não a confirmação nativa", () => {
    signatureSources.forEach((source) => {
      expect(source).toContain("ClinicalSignatureConfirmModal");
      expect(source).not.toContain("window.confirm(SIGNATURE_WARNING)");
      expect(source).not.toContain("window.alert(SIGNATURE_WARNING)");
    });
  });

  test("evolução rápida atualiza o registro salvo antes da recarga", () => {
    expect(patientDetails).toMatch(
      /setEvaluations\(\(current\) => upsertSavedClinicalRecord\(current, saved\)\);[\s\S]*?return saved;/,
    );
    expect(patientDetails).toMatch(
      /finalizeClinicalRecord\("evaluation", recordId, version\)/,
    );
  });

  test("digitação no adendo não recarrega a identidade profissional", () => {
    expect(patientDetails).toMatch(
      /const isClinicalIdentityRequired = Boolean\([\s\S]*?quickEvolutionModal[\s\S]*?addendumModal[\s\S]*?canFinalizeClinicalRecords[\s\S]*?\);/,
    );
    expect(patientDetails).toContain("}, [isClinicalIdentityRequired]);");
    expect(patientDetails).not.toContain("}, [addendumModal, quickEvolutionModal]);");
  });

  test("avaliação existente armazena a versão do PUT antes de persistir respostas", () => {
    expect(evaluationDetails).toMatch(
      /const saved = evaluationResponse\.data;[\s\S]*?setRecordVersion\(getSavedClinicalRecordVersion\(saved\)\);[\s\S]*?Promise\.all/,
    );
    expect(evaluationDetails).toMatch(
      /finalizeClinicalRecord\("evaluation", evaluationId, version\)/,
    );
  });

  test("nova avaliação só executa o salvamento depois da confirmação", () => {
    expect(evaluationNew).toMatch(
      /setSignatureConfirmOpen\(true\);[\s\S]*?return;/,
    );
    expect(evaluationNew).toContain("onConfirm={() => saveEvaluation(true)}");
  });
});
