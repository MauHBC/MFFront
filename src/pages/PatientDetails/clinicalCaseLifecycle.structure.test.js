import fs from "fs";
import path from "path";

const patientDetails = fs.readFileSync(path.resolve(__dirname, "index.js"), "utf8");
const caseService = fs.readFileSync(
  path.resolve(__dirname, "../../services/patientClinicalCases.js"),
  "utf8",
);

describe("clinical case lifecycle structure", () => {
  test("publishes draft, consolidated and legacy states", () => {
    expect(patientDetails).toContain('"Rascunho"');
    expect(patientDetails).toContain('"Consolidado"');
    expect(patientDetails).toContain('"Legado"');
  });

  test("keeps status out of the clinical content form", () => {
    expect(patientDetails).not.toContain('name="status"');
    expect(patientDetails).not.toContain("clinicalCaseForm.status");
  });

  test("publishes consolidation, addendum, status and history", () => {
    expect(patientDetails).toContain("Consolidar caso");
    expect(patientDetails).toContain("Adicionar adendo");
    expect(patientDetails).toContain("Alterar status");
    expect(patientDetails).toContain("Histórico do caso");
    expect(patientDetails).toContain("getPatientClinicalCaseHistory");
  });

  test("does not render the lifecycle management button", () => {
    expect(patientDetails).not.toContain("Gerenciar lifecycle");
  });

  test("status carries reason, version and idempotency", () => {
    expect(caseService).toMatch(/\{ status, version, reason \}/);
    expect(caseService).toContain('"Idempotency-Key"');
    expect(caseService).toContain("getPatientClinicalCaseHistory");
  });

  test("version conflict uses the canonical reload guidance without retry", () => {
    expect(patientDetails).toContain("getClinicalRecordSaveErrorMessage(");
    expect(patientDetails).not.toContain("clinicalCase.version + 1");
  });
});
