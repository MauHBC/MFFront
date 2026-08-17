import React from "react";
import "@testing-library/jest-dom";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { Router, Route } from "react-router-dom";
import { createMemoryHistory } from "history";

import PatientDetails from ".";
import axios from "../../services/axios";
import { useAuthorization } from "../../contexts/AuthorizationContext";
import {
  createPatientClinicalCase,
  getPatientClinicalCaseHistory,
  listPatientClinicalCases,
  updatePatientClinicalCase,
} from "../../services/patientClinicalCases";
import {
  createPatientClinicalReference,
  listPatientClinicalReferences,
  removePatientClinicalReference,
  updatePatientClinicalReference,
} from "../../services/patientClinicalReferences";
import {
  createPatientExternalProfessional,
  inactivatePatientExternalProfessional,
  listPatientExternalProfessionals,
  updatePatientExternalProfessional,
} from "../../services/patientExternalProfessionals";
import {
  addSignedClinicalAddendum,
  getClinicalSigningIdentity,
} from "../../services/clinicalRecords";

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

const LEVELS = { none: 0, view: 1, edit: 2, manage: 3 };
const patient = {
  id: 101,
  full_name: "Ana Clínica",
  birth_date: "1990-04-15",
  main_complaint: "Dor lombar",
  relevant_conditions: "Sem comorbidades",
  treatment_goal_options: ["pain_relief"],
};
const clinicalCase = {
  id: 11,
  patient_id: 101,
  title: "Lombar",
  status: "active",
  chief_complaint: "Dor lombar mecânica",
  started_on: "2026-08-01",
  clinical_state: "draft",
  version: 2,
  created_by: 7,
};
const finalizedClinicalCase = {
  ...clinicalCase,
  clinical_state: "finalized",
  version: 3,
};
const evaluations = [
  {
    id: 31,
    patient_id: 101,
    clinical_case_id: 11,
    record_type: "session",
    clinical_state: "draft",
    version: 2,
    summary_text: "Evolução em rascunho",
    created_at: "2026-08-10T13:35:00.000Z",
    PatientClinicalCase: clinicalCase,
  },
  {
    id: 32,
    patient_id: 101,
    clinical_case_id: 11,
    record_type: "session",
    clinical_state: "finalized",
    version: 4,
    summary_text: "Evolução assinada",
    created_at: "2026-08-11T14:20:00.000Z",
    PatientClinicalCase: clinicalCase,
    clinical_signature: { id: 70 },
    clinical_revisions: [],
  },
];
const reference = {
  id: 51,
  patient_id: 101,
  title: "Guideline lombar",
  reference_text: "https://example.test/guideline",
  reference_type: "guideline",
  created_at: "2026-08-05T10:00:00.000Z",
};
const externalProfessional = {
  id: 61,
  patient_id: 101,
  professional_type: "personal_trainer",
  professional_name: "Carlos Personal",
  contact: "(27) 99999-0000",
  contact_authorized: true,
  is_active: true,
};
const eligibleIdentity = {
  eligible_to_sign: true,
  user_id: 7,
  name: "Dra. Beatriz",
  registration_region: "15",
  registration_number: "12345-F",
};

const response = (data) => Promise.resolve({ data });

function authorize({
  clinicalLevel = "view",
  patientsLevel = "view",
  capabilities = ["clinical_records.read"],
} = {}) {
  const levels = { clinical_records: clinicalLevel, patients: patientsLevel, schedule: "none" };
  const canAccessModule = jest.fn((moduleKey, minimum = "view") => (
    LEVELS[levels[moduleKey] || "none"] >= LEVELS[minimum]
  ));
  const hasCapability = jest.fn((capability) => capabilities.includes(capability));
  const authorization = {
    status: "ready",
    context: {
      authorization_state: "authorized",
      capabilities,
    },
    canAccessModule,
    hasCapability,
  };
  useAuthorization.mockReturnValue(authorization);
  return authorization;
}

function configureRequests() {
  axios.get.mockImplementation((url) => {
    if (url === "/patients/101") return response(patient);
    if (url === "/evaluations?patient_id=101") return response(evaluations);
    throw new Error(`Unexpected GET ${url}`);
  });
  axios.post.mockImplementation((url, payload) => {
    if (url === "/evaluations/quick-evolution") {
      return response({
        id: 90,
        patient_id: 101,
        record_type: "session",
        clinical_state: "draft",
        version: 1,
        summary_text: payload.evolution_text,
        clinical_case_id: payload.clinical_case_id,
      });
    }
    throw new Error(`Unexpected POST ${url}`);
  });
  axios.put.mockResolvedValue(response(patient));
  listPatientClinicalCases.mockResolvedValue(response([clinicalCase]));
  getPatientClinicalCaseHistory.mockResolvedValue({ events: [] });
  listPatientClinicalReferences.mockResolvedValue(response([reference]));
  listPatientExternalProfessionals.mockResolvedValue(response([externalProfessional]));
  createPatientClinicalCase.mockResolvedValue(response({ id: 99 }));
  updatePatientClinicalCase.mockResolvedValue(response(clinicalCase));
  createPatientClinicalReference.mockResolvedValue(response({ id: 52 }));
  updatePatientClinicalReference.mockResolvedValue(response(reference));
  removePatientClinicalReference.mockResolvedValue({ status: 204 });
  createPatientExternalProfessional.mockResolvedValue(response({ id: 62 }));
  updatePatientExternalProfessional.mockResolvedValue(response(externalProfessional));
  inactivatePatientExternalProfessional.mockResolvedValue({ status: 204 });
  getClinicalSigningIdentity.mockResolvedValue(eligibleIdentity);
  addSignedClinicalAddendum.mockResolvedValue({ id: 80 });
}

function renderPage() {
  const history = createMemoryHistory({ initialEntries: ["/pacientes/101"] });
  render(
    <Router history={history}>
      <Route path="/pacientes/:id"><PatientDetails /></Route>
    </Router>,
  );
  return history;
}

async function waitForPatient() {
  expect(await screen.findByRole("heading", { name: "Ana Clínica" })).toBeInTheDocument();
  await waitFor(() => expect(screen.queryByText("Carregando prontuário...")).not.toBeInTheDocument());
}

async function openCase() {
  fireEvent.click(screen.getByRole("button", { name: "Prontuário" }));
  const caseButton = await screen.findByRole("button", { name: /Lombar/ });
  fireEvent.click(caseButton);
  expect(await screen.findByText("Dor lombar mecânica")).toBeInTheDocument();
}

function clinicalInformationCard() {
  const title = screen.getByText("Informacoes clinicas");
  return title.parentElement.parentElement.parentElement;
}

describe("PatientDetails clinical write controls permission matrix", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    window.sessionStorage.clear();
    configureRequests();
  });

  test("read-only preserves clinical reading and hides every clinical mutation entry", async () => {
    authorize();
    renderPage();
    await waitForPatient();

    expect(screen.queryByRole("button", { name: "Adicionar profissional" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Editar" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Inativar" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Prontuário" }));
    expect(await screen.findByRole("button", { name: /Lombar/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Caso clínico" })).not.toBeInTheDocument();
    await openCase();

    expect(screen.queryByRole("button", { name: "Editar caso" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Evolução" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Avaliação" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Editar rascunho" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Adicionar adendo" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Salvar e assinar" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "Referências" }));
    expect(screen.queryByRole("button", { name: "Adicionar referência" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Guideline lombar/ }));
    expect(screen.getByText("https://example.test/guideline")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Editar" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Excluir" })).not.toBeInTheDocument();

    expect(axios.post).not.toHaveBeenCalled();
    expect(createPatientClinicalCase).not.toHaveBeenCalled();
    expect(createPatientClinicalReference).not.toHaveBeenCalled();
    expect(createPatientExternalProfessional).not.toHaveBeenCalled();
    expect(addSignedClinicalAddendum).not.toHaveBeenCalled();
  });

  test("edit + write exposes draft and clinical mutations but hides signature and addendum", async () => {
    authorize({
      clinicalLevel: "edit",
      capabilities: ["clinical_records.read", "clinical_records.write"],
    });
    renderPage();
    await waitForPatient();
    await openCase();

    expect(screen.getByRole("button", { name: "Evolução" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Avaliação" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Editar rascunho" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Adicionar adendo" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Evolução" }));
    expect(screen.getByRole("button", { name: "Salvar rascunho" })).toBeEnabled();
    expect(screen.queryByRole("button", { name: "Salvar e assinar" })).not.toBeInTheDocument();
  });

  test("edit + write + finalize preserves signature and addendum with eligible identity", async () => {
    authorize({
      clinicalLevel: "edit",
      capabilities: [
        "clinical_records.read",
        "clinical_records.write",
        "clinical_records.finalize",
      ],
    });
    renderPage();
    await waitForPatient();
    await openCase();

    fireEvent.click(screen.getByRole("button", { name: "Evolução" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Salvar e assinar" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "Fechar" }));

    fireEvent.click(screen.getByRole("button", { name: "Adicionar adendo" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Salvar adendo" })).toBeEnabled());
  });

  test.each([
    ["active", "resolved"],
    ["resolved", "active"],
  ])("eligible finalizer exposes the dedicated lifecycle action from %s to %s", async (
    status,
    expectedStatus,
  ) => {
    listPatientClinicalCases.mockResolvedValue(response([{
      ...finalizedClinicalCase,
      status,
    }]));
    authorize({
      clinicalLevel: "edit",
      capabilities: [
        "clinical_records.read",
        "clinical_records.write",
        "clinical_records.finalize",
      ],
    });
    renderPage();
    await waitForPatient();
    await openCase();

    fireEvent.click(screen.getByRole("button", { name: "Alterar status" }));
    expect(screen.getByRole("combobox", { name: "Novo status" })).toHaveValue(expectedStatus);
    cleanup();
  });

  test("eligible professional without finalize cannot change or reactivate case status", async () => {
    listPatientClinicalCases.mockResolvedValue(response([finalizedClinicalCase]));
    authorize({
      clinicalLevel: "edit",
      capabilities: ["clinical_records.read", "clinical_records.write"],
    });
    renderPage();
    await waitForPatient();
    await openCase();

    expect(screen.queryByRole("button", { name: "Alterar status" })).not.toBeInTheDocument();
  });

  test("finalize capability without eligible professional identity hides signed case actions", async () => {
    listPatientClinicalCases.mockResolvedValue(response([finalizedClinicalCase]));
    getClinicalSigningIdentity.mockResolvedValue({
      ...eligibleIdentity,
      eligible_to_sign: false,
    });
    authorize({
      clinicalLevel: "edit",
      capabilities: [
        "clinical_records.read",
        "clinical_records.write",
        "clinical_records.finalize",
      ],
    });
    renderPage();
    await waitForPatient();
    await openCase();

    await waitFor(() => expect(getClinicalSigningIdentity).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole("button", { name: "Alterar status" })).not.toBeInTheDocument();
  });

  test("writer cannot edit another professional's clinical case draft", async () => {
    listPatientClinicalCases.mockResolvedValue(response([{
      ...clinicalCase,
      created_by: 999,
    }]));
    authorize({
      clinicalLevel: "edit",
      capabilities: ["clinical_records.read", "clinical_records.write"],
    });
    renderPage();
    await waitForPatient();
    await openCase();

    expect(screen.queryByRole("button", { name: "Editar caso" })).not.toBeInTheDocument();
  });

  test("edit + write exposes case, reference and external-professional mutation entries", async () => {
    authorize({
      clinicalLevel: "edit",
      capabilities: ["clinical_records.read", "clinical_records.write"],
    });
    renderPage();
    await waitForPatient();

    expect(screen.getByRole("button", { name: "Adicionar profissional" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Editar" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Inativar" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Prontuário" }));
    expect(await screen.findByRole("button", { name: "Caso clínico" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Lombar/ }));
    expect(screen.getByRole("button", { name: "Editar caso" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "Referências" }));
    expect(screen.getByRole("button", { name: "Adicionar referência" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Guideline lombar/ }));
    expect(screen.getByRole("button", { name: "Editar" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Excluir" })).toBeInTheDocument();
  });

  test("creates a case for the current patient without a client-controlled tenant", async () => {
    authorize({
      clinicalLevel: "edit",
      capabilities: ["clinical_records.read", "clinical_records.write"],
    });
    renderPage();
    await waitForPatient();

    fireEvent.click(screen.getByRole("button", { name: "Prontuário" }));
    fireEvent.click(await screen.findByRole("button", { name: "Caso clínico" }));
    fireEvent.change(screen.getByPlaceholderText(/Lombar, Joelho direito/), {
      target: { value: "Cervical" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() => expect(createPatientClinicalCase).toHaveBeenCalledTimes(1));
    const payload = createPatientClinicalCase.mock.calls[0][0];
    expect(payload).toEqual(expect.objectContaining({
      patient_id: "101",
      title: "Cervical",
    }));
    expect(payload).not.toHaveProperty("clinic_id");
  });

  test.each([
    ["patients view with clinical write", {
      patientsLevel: "view",
      clinicalLevel: "edit",
      capabilities: ["clinical_records.read", "clinical_records.write"],
    }],
    ["patients manage with clinical read-only", {
      patientsLevel: "manage",
      clinicalLevel: "view",
      capabilities: ["clinical_records.read"],
    }],
    ["patients manage with clinical write", {
      patientsLevel: "manage",
      clinicalLevel: "edit",
      capabilities: ["clinical_records.read", "clinical_records.write"],
    }],
  ])("clinical Data editing requires the effective combination: %s", async (
    _label,
    scenario,
  ) => {
    const authorization = authorize(scenario);
    renderPage();
    await waitForPatient();
    fireEvent.click(screen.getByRole("button", { name: "Dados" }));

    const editButton = within(clinicalInformationCard()).queryByRole("button", { name: "Editar" });
    if (scenario.patientsLevel === "manage" && scenario.clinicalLevel === "edit") {
      expect(editButton).toBeInTheDocument();
    } else {
      expect(editButton).not.toBeInTheDocument();
    }
    expect(authorization.canAccessModule).toHaveBeenCalledWith("patients", "manage");
    expect(authorization.canAccessModule).toHaveBeenCalledWith("clinical_records", "edit");
    cleanup();
  });
});
