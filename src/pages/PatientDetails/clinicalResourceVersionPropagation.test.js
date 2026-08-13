import React from "react";
import "@testing-library/jest-dom";
import fs from "fs";
import path from "path";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Router, Route } from "react-router-dom";
import { createMemoryHistory } from "history";
import { toast } from "react-toastify";

import PatientDetails from ".";
import axios from "../../services/axios";
import { useAuthorization } from "../../contexts/AuthorizationContext";
import {
  createPatientClinicalCase,
  getPatientClinicalCaseHistory,
  listPatientClinicalCases,
  updatePatientClinicalCase,
} from "../../services/patientClinicalCases";
import { getClinicalSigningIdentity } from "../../services/clinicalRecords";
import {
  createPatientClinicalReference,
  listPatientClinicalReferences,
  removePatientClinicalReference,
  updatePatientClinicalReference,
} from "../../services/patientClinicalReferences";
import { listPatientExternalProfessionals } from "../../services/patientExternalProfessionals";

jest.mock("../../services/axios", () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn(), put: jest.fn() },
}));
jest.mock("../../contexts/AuthorizationContext", () => ({ useAuthorization: jest.fn() }));
jest.mock("../../services/patientClinicalCases", () => ({
  createPatientClinicalCase: jest.fn(),
  listPatientClinicalCases: jest.fn(),
  updatePatientClinicalCase: jest.fn(),
  updatePatientClinicalCaseStatus: jest.fn(),
  getPatientClinicalCaseHistory: jest.fn(),
}));
jest.mock("../../services/patientClinicalReferences", () => ({
  createPatientClinicalReference: jest.fn(),
  listPatientClinicalReferences: jest.fn(),
  removePatientClinicalReference: jest.fn(),
  updatePatientClinicalReference: jest.fn(),
}));
jest.mock("../../services/patientExternalProfessionals", () => ({
  createPatientExternalProfessional: jest.fn(),
  inactivatePatientExternalProfessional: jest.fn(),
  listPatientExternalProfessionals: jest.fn(),
  updatePatientExternalProfessional: jest.fn(),
}));
jest.mock("../../services/clinicalRecords", () => ({
  addSignedClinicalAddendum: jest.fn(),
  finalizeClinicalRecord: jest.fn(),
  getClinicalSigningIdentity: jest.fn(),
}));
jest.mock("react-toastify", () => ({
  toast: { error: jest.fn(), success: jest.fn() },
}));

const patient = {
  id: 101,
  full_name: "Ana Clínica",
  birth_date: "1990-04-15",
  treatment_goal_options: [],
};
const clinicalCase = {
  id: 11,
  patient_id: 101,
  title: "Lombar",
  status: "active",
  chief_complaint: "Dor lombar",
  started_on: "2026-08-01",
  version: 2,
  clinical_state: "draft",
  created_by: 8,
};
const reference = {
  id: 51,
  patient_id: 101,
  title: "Guideline lombar",
  reference_text: "https://example.test/guideline",
  reference_type: "guideline",
  version: 4,
  created_at: "2026-08-05T10:00:00.000Z",
};
const response = (data) => Promise.resolve({ data });
const patientDetailsSource = fs.readFileSync(path.resolve(__dirname, "index.js"), "utf8");

function configureRequests() {
  axios.get.mockImplementation((url) => {
    if (url === "/patients/101") return response(patient);
    if (url === "/evaluations?patient_id=101") return response([]);
    throw new Error(`Unexpected GET ${url}`);
  });
  axios.post.mockImplementation((url) => {
    throw new Error(`Unexpected POST ${url}`);
  });
  axios.put.mockResolvedValue(response(patient));
  listPatientClinicalCases.mockResolvedValue(response([clinicalCase]));
  getPatientClinicalCaseHistory.mockResolvedValue({ events: [] });
  getClinicalSigningIdentity.mockResolvedValue({
    eligible_to_sign: true,
    user_id: 8,
    name: "Dra. Ana",
    registration_region: "ES",
    registration_number: "1234",
  });
  listPatientClinicalReferences.mockResolvedValue(response([reference]));
  listPatientExternalProfessionals.mockResolvedValue(response([]));
  createPatientClinicalCase.mockResolvedValue(response({ ...clinicalCase, id: 12, version: 1 }));
  createPatientClinicalReference.mockResolvedValue(response({ ...reference, id: 52, version: 1 }));
  removePatientClinicalReference.mockResolvedValue({ status: 204 });
}

function renderPage() {
  useAuthorization.mockReturnValue({
    status: "ready",
    context: {
      authorization_state: "authorized",
      capabilities: ["clinical_records.read", "clinical_records.write"],
    },
    canAccessModule: jest.fn((moduleKey, minimum = "view") => (
      moduleKey === "clinical_records" && ["view", "edit"].includes(minimum)
    )),
    hasCapability: jest.fn((capability) => [
      "clinical_records.read",
      "clinical_records.write",
    ].includes(capability)),
  });
  const history = createMemoryHistory({ initialEntries: ["/pacientes/101"] });
  render(
    <Router history={history}>
      <Route path="/pacientes/:id"><PatientDetails /></Route>
    </Router>,
  );
}

async function openClinicalRecord() {
  expect(await screen.findByRole("heading", { name: "Ana Clínica" })).toBeInTheDocument();
  await waitFor(() => expect(screen.queryByText("Carregando prontuário...")).not.toBeInTheDocument());
  fireEvent.click(screen.getByRole("button", { name: "Prontuário" }));
}

describe("PatientDetails clinical resource version propagation", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    window.sessionStorage.clear();
    configureRequests();
  });

  test("uses the case version returned by the backend in the next update", async () => {
    updatePatientClinicalCase
      .mockResolvedValueOnce(response({ ...clinicalCase, version: 3 }))
      .mockResolvedValueOnce(response({ ...clinicalCase, version: 4 }));

    renderPage();
    await openClinicalRecord();
    fireEvent.click(await screen.findByRole("button", { name: /Lombar/ }));

    fireEvent.click(screen.getByRole("button", { name: "Editar caso" }));
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(updatePatientClinicalCase).toHaveBeenCalledTimes(1));
    expect(updatePatientClinicalCase.mock.calls[0][1]).toEqual(expect.objectContaining({ version: 2 }));
    await waitFor(() => expect(
      screen.queryByRole("heading", { name: "Editar caso clínico" }),
    ).not.toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "Editar caso" }));
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(updatePatientClinicalCase).toHaveBeenCalledTimes(2));
    expect(updatePatientClinicalCase.mock.calls[1][1]).toEqual(expect.objectContaining({ version: 3 }));
  });

  test("uses the reference version returned by the backend in the next update", async () => {
    updatePatientClinicalReference
      .mockResolvedValueOnce(response({ ...reference, version: 5 }))
      .mockResolvedValueOnce(response({ ...reference, version: 6 }));

    renderPage();
    await openClinicalRecord();
    fireEvent.click(screen.getByRole("tab", { name: "Referências" }));
    fireEvent.click(await screen.findByRole("button", { name: /Guideline lombar/ }));

    fireEvent.click(screen.getByRole("button", { name: "Editar" }));
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(updatePatientClinicalReference).toHaveBeenCalledTimes(1));
    expect(updatePatientClinicalReference.mock.calls[0][1]).toEqual(expect.objectContaining({ version: 4 }));
    await waitFor(() => expect(
      screen.queryByRole("heading", { name: "Editar referência clínica" }),
    ).not.toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: /Guideline lombar/ }));
    fireEvent.click(screen.getByRole("button", { name: "Editar" }));
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(updatePatientClinicalReference).toHaveBeenCalledTimes(2));
    expect(updatePatientClinicalReference.mock.calls[1][1]).toEqual(expect.objectContaining({ version: 5 }));
  });

  test("shows a real version conflict without retrying automatically", async () => {
    updatePatientClinicalCase.mockRejectedValue({
      response: { data: { error: "CLINICAL_VERSION_CONFLICT" }, status: 409 },
    });

    renderPage();
    await openClinicalRecord();
    fireEvent.click(await screen.findByRole("button", { name: /Lombar/ }));
    fireEvent.click(screen.getByRole("button", { name: "Editar caso" }));
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("CLINICAL_VERSION_CONFLICT"));
    expect(updatePatientClinicalCase).toHaveBeenCalledTimes(1);
  });

  test("passes the loaded case version to the status mutation", () => {
    expect(patientDetailsSource).toMatch(
      /updatePatientClinicalCaseStatus\(\s*clinicalCase\.id,\s*status,\s*clinicalCase\.version,\s*reason,\s*\)/,
    );
  });

  test("passes the loaded reference version to delete", async () => {
    renderPage();
    await openClinicalRecord();
    fireEvent.click(screen.getByRole("tab", { name: "Referências" }));
    fireEvent.click(await screen.findByRole("button", { name: /Guideline lombar/ }));
    fireEvent.click(screen.getByRole("button", { name: "Excluir" }));
    const deleteButtons = screen.getAllByRole("button", { name: "Excluir" });
    fireEvent.click(deleteButtons[deleteButtons.length - 1]);

    await waitFor(() => expect(removePatientClinicalReference).toHaveBeenCalledWith(51, 4));
    await waitFor(() => expect(
      screen.queryByRole("button", { name: /Guideline lombar/ }),
    ).not.toBeInTheDocument());
  });
});
