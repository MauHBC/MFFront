import api from "./axios";
import { updatePatientClinicalCaseStatus } from "./patientClinicalCases";
import { removePatientClinicalReference } from "./patientClinicalReferences";

jest.mock("./axios", () => ({
  __esModule: true,
  default: {
    patch: jest.fn(),
    delete: jest.fn(),
  },
}));

describe("clinical resource version transport", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("sends the loaded version when changing a clinical case status", () => {
    updatePatientClinicalCaseStatus(11, "resolved", 2);

    expect(api.patch).toHaveBeenCalledWith(
      "/patient-clinical-cases/11/status",
      { status: "resolved", version: 2, reason: undefined },
      { headers: { "Idempotency-Key": expect.stringMatching(/^case-status-/) } },
    );
  });

  test("sends the loaded version in the clinical reference delete body", () => {
    removePatientClinicalReference(51, 4);

    expect(api.delete).toHaveBeenCalledWith(
      "/patient-clinical-references/51",
      { data: { version: 4 } },
    );
  });
});
