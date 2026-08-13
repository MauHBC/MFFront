import React from "react";
import "@testing-library/jest-dom";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Router, Route } from "react-router-dom";
import { createMemoryHistory } from "history";

import PatientDetails from ".";
import axios from "../../services/axios";
import { listPatientClinicalCases } from "../../services/patientClinicalCases";
import { listPatientClinicalReferences } from "../../services/patientClinicalReferences";
import { listPatientExternalProfessionals } from "../../services/patientExternalProfessionals";
import { getClinicalSigningIdentity } from "../../services/clinicalRecords";
import { useAuthorization } from "../../contexts/AuthorizationContext";

jest.mock("../../services/axios", () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn(), put: jest.fn() },
}));

jest.mock("../../services/patientClinicalCases", () => ({
  createPatientClinicalCase: jest.fn(),
  listPatientClinicalCases: jest.fn(),
  updatePatientClinicalCase: jest.fn(),
  updatePatientClinicalCaseStatus: jest.fn(),
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

jest.mock("../../contexts/AuthorizationContext", () => ({
  useAuthorization: jest.fn(),
}));

jest.mock("react-toastify", () => ({
  toast: { error: jest.fn(), success: jest.fn() },
}));

const patients = {
  101: { id: 101, full_name: "Ana Clínica", birth_date: "1990-04-15" },
  202: { id: 202, full_name: "Bruno Contexto", birth_date: "1988-09-20" },
};

const cases = {
  101: [{
    id: 11,
    patient_id: 101,
    title: "Lombar",
    chief_complaint: "Dor lombar mecânica",
    status: "active",
    started_on: "2026-08-01",
    created_at: "2026-08-01T12:00:00.000Z",
  }, {
    id: 12,
    patient_id: 101,
    title: "Joelho",
    chief_complaint: "Dor anterior no joelho",
    status: "active",
    started_on: "2026-08-02",
    created_at: "2026-08-02T12:00:00.000Z",
  }],
  202: [{
    id: 21,
    patient_id: 202,
    title: "Ombro",
    chief_complaint: "Dor no ombro",
    status: "active",
    started_on: "2026-08-03",
    created_at: "2026-08-03T12:00:00.000Z",
  }],
};

const evaluations = {
  101: [{
    id: 31,
    patient_id: 101,
    clinical_case_id: 11,
    record_type: "session",
    clinical_state: "draft",
    version: 2,
    summary_text: "Evolução editável da Ana",
    created_at: "2026-08-10T13:35:00.000Z",
    PatientClinicalCase: cases[101][0],
  }, {
    id: 32,
    patient_id: 101,
    clinical_case_id: 11,
    record_type: "session",
    clinical_state: "finalized",
    version: 4,
    summary_text: "Evolução assinada da Ana",
    created_at: "2026-08-11T14:20:00.000Z",
    PatientClinicalCase: cases[101][0],
    clinical_signature: { id: 70 },
    clinical_revisions: [],
  }],
  202: [],
};

const response = (data) => Promise.resolve({ data });

function idFromUrl(url, pattern) {
  const match = String(url).match(pattern);
  return match ? Number(match[1]) : null;
}

function configureBootstrap() {
  axios.get.mockImplementation((url) => {
    if (String(url).startsWith("/patients/")) {
      return response(patients[idFromUrl(url, /\/patients\/(\d+)/)]);
    }
    if (String(url).startsWith("/evaluations?")) {
      return response(evaluations[idFromUrl(url, /patient_id=(\d+)/)] || []);
    }
    if (url === "/sessions") return response([]);
    if (url === "/session-series") return response([]);
    if (url === "/session-replacement-credits") return response([]);
    if (url === "/unit-scheduling-policy") return response({});
    throw new Error(`Unexpected GET ${url}`);
  });
  axios.post.mockImplementation((url, payload) => response({
    id: 90,
    version: 1,
    record_type: "session",
    clinical_state: "draft",
    clinical_case_id: payload.clinical_case_id,
    summary_text: payload.evolution_text,
  }));
  axios.put.mockResolvedValue({ data: {} });
  listPatientClinicalCases.mockImplementation(({ patient_id: patientId }) => (
    response(cases[Number(patientId)] || [])
  ));
  listPatientClinicalReferences.mockResolvedValue({ data: [] });
  listPatientExternalProfessionals.mockResolvedValue({ data: [] });
  getClinicalSigningIdentity.mockResolvedValue({
    eligible_to_sign: true,
    name: "Dra. Beatriz",
    registration_region: "15",
    registration_number: "12345-F",
  });
}

function renderPage() {
  const history = createMemoryHistory({ initialEntries: ["/pacientes/101"] });
  render(
    <Router history={history}>
      <Route path="/pacientes/:id">
        <PatientDetails />
      </Route>
    </Router>,
  );
  return history;
}

async function waitForPatient(name) {
  expect(await screen.findByText(name)).toBeInTheDocument();
  await waitFor(() => {
    expect(screen.queryByText("Carregando paciente...")).not.toBeInTheDocument();
  });
}

async function openCaseAndEvolution() {
  fireEvent.click(screen.getByRole("button", { name: "Prontuário" }));
  fireEvent.click(await screen.findByRole("button", { name: /Lombar/ }));
  fireEvent.click(screen.getByRole("button", { name: "Evolução" }));
}

describe("PatientDetails patient-scoped clinical context", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    window.sessionStorage.clear();
    useAuthorization.mockReturnValue({
      canAccessModule: () => true,
      hasCapability: () => true,
    });
    configureBootstrap();
  });

  it("closes and clears an open evolution when the patient changes", async () => {
    const history = renderPage();
    await waitForPatient("Ana Clínica");
    await openCaseAndEvolution();

    const evolutionText = document.querySelector('textarea[name="evolution_text"]');
    fireEvent.change(evolutionText, {
      target: { name: "evolution_text", value: "Contexto clínico da Ana" },
    });
    await act(async () => {
      history.push("/pacientes/202");
    });
    await waitForPatient("Bruno Contexto");

    expect(screen.queryByDisplayValue("Contexto clínico da Ana")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Salvar rascunho" })).not.toBeInTheDocument();
    expect(axios.post).not.toHaveBeenCalled();
  });

  it("does not reuse the previous clinical_case_id after opening a new evolution", async () => {
    const history = renderPage();
    await waitForPatient("Ana Clínica");
    await openCaseAndEvolution();

    await act(async () => {
      history.push("/pacientes/202");
    });
    await waitForPatient("Bruno Contexto");

    fireEvent.click(screen.getByRole("button", { name: "Prontuário" }));
    fireEvent.click(await screen.findByRole("button", { name: /Ombro/ }));
    fireEvent.click(screen.getByRole("button", { name: "Evolução" }));
    fireEvent.change(document.querySelector('textarea[name="evolution_text"]'), {
      target: { name: "evolution_text", value: "Evolução exclusiva do Bruno" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Salvar rascunho" }));

    await waitFor(() => expect(axios.post).toHaveBeenCalledWith(
      "/evaluations/quick-evolution",
      expect.objectContaining({
        patient_id: "202",
        clinical_case_id: 21,
        evolution_text: "Evolução exclusiva do Bruno",
      }),
    ));
    expect(axios.post.mock.calls[0][1].clinical_case_id).not.toBe(11);
  });

  it("keeps case switching within the same patient", async () => {
    renderPage();
    await waitForPatient("Ana Clínica");
    fireEvent.click(screen.getByRole("button", { name: "Prontuário" }));
    fireEvent.click(await screen.findByRole("button", { name: /Lombar/ }));
    expect(screen.getByText("Dor lombar mecânica")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Voltar aos casos" }));
    fireEvent.click(screen.getByRole("button", { name: /Joelho/ }));

    expect(screen.getByText("Dor anterior no joelho")).toBeInTheDocument();
    expect(screen.queryByText("Dor lombar mecânica")).not.toBeInTheDocument();
    expect(window.sessionStorage.getItem("patient-details-active-case:101")).toBe("12");
  });

  it("restores selections from each patient namespace without overwriting either key", async () => {
    window.sessionStorage.setItem("patient-details-active-tab:101", "prontuario");
    window.sessionStorage.setItem("patient-details-active-case:101", "11");
    window.sessionStorage.setItem("patient-details-active-tab:202", "prontuario");
    window.sessionStorage.setItem("patient-details-active-case:202", "21");
    const history = renderPage();
    await waitForPatient("Ana Clínica");
    expect(await screen.findByText("Dor lombar mecânica")).toBeInTheDocument();

    await act(async () => {
      history.push("/pacientes/202");
    });
    await waitForPatient("Bruno Contexto");

    expect(await screen.findByText("Dor no ombro")).toBeInTheDocument();
    expect(window.sessionStorage.getItem("patient-details-active-case:101")).toBe("11");
    expect(window.sessionStorage.getItem("patient-details-active-case:202")).toBe("21");
  });

  it("dismisses selected draft, signature confirmation and addendum UI on patient change", async () => {
    const history = renderPage();
    await waitForPatient("Ana Clínica");
    fireEvent.click(screen.getByRole("button", { name: "Prontuário" }));
    fireEvent.click(await screen.findByRole("button", { name: /Lombar/ }));

    fireEvent.click(screen.getByRole("button", { name: "Editar rascunho" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Salvar e assinar" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "Salvar e assinar" }));
    expect(await screen.findByRole("dialog", { name: "Salvar e assinar?" })).toBeInTheDocument();

    await act(async () => {
      history.push("/pacientes/202");
    });
    await waitForPatient("Bruno Contexto");
    expect(screen.queryByRole("dialog", { name: "Salvar e assinar?" })).not.toBeInTheDocument();
    expect(screen.queryByDisplayValue("Evolução editável da Ana")).not.toBeInTheDocument();

    await act(async () => {
      history.push("/pacientes/101");
    });
    await waitForPatient("Ana Clínica");
    fireEvent.click(screen.getByRole("button", { name: "Prontuário" }));
    fireEvent.click(await screen.findByRole("button", { name: "Adicionar adendo" }));
    fireEvent.change(screen.getByText("Motivo do adendo").parentElement.querySelector("input"), {
      target: { value: "Complemento temporário" },
    });

    await act(async () => {
      history.push("/pacientes/202");
    });
    await waitForPatient("Bruno Contexto");
    expect(screen.queryByDisplayValue("Complemento temporário")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Salvar adendo" })).not.toBeInTheDocument();
  });
});
