import { isPatientInvitePath } from "./patientInvite";

test("only complete public invite routes own page identity", () => {
  expect(isPatientInvitePath("/c/nome-1/synthetic")).toBe(true);
  expect(isPatientInvitePath("/cadastro/paciente/synthetic")).toBe(true);
  expect(isPatientInvitePath("/pacientes/novo")).toBe(false);
  expect(isPatientInvitePath("/c/synthetic")).toBe(true);
  expect(isPatientInvitePath("/c/")).toBe(false);
  expect(isPatientInvitePath("/c/a/b/extra")).toBe(false);
});
