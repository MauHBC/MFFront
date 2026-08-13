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

describe("PatientDetails clinical write controls permission matrix characterization", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    window.sessionStorage.clear();
    configureRequests();
  });

  test("read-only currently exposes evaluation, evolution, draft, signature, addendum and case controls", async () => {
    authorize();
    const history = renderPage();
    await waitForPatient();
    await openCase();

    expect(screen.getByRole("button", { name: "Editar caso" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Evolução" })).toBeInTheDocument();
    const evaluationEntry = screen.getByRole("button", { name: "Avaliação" });
    expect(evaluationEntry).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Editar rascunho" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Adicionar adendo" })).toBeInTheDocument();

    fireEvent.click(evaluationEntry);
    expect(history.location.pathname).toBe("/pacientes/101/avaliacoes/nova");
  });

  test("read-only with eligible identity can currently submit a draft and enables signing", async () => {
    const authorization = authorize();
    renderPage();
    await waitForPatient();
    await openCase();
    fireEvent.click(screen.getByRole("button", { name: "Evolução" }));

    const evolution = document.querySelector('textarea[name="evolution_text"]');
    fireEvent.change(evolution, {
      target: { name: "evolution_text", value: "Evolução acionável em leitura" },
    });
    expect(screen.getByRole("button", { name: "Salvar rascunho" })).toBeEnabled();
    await waitFor(() => expect(
      screen.getByRole("button", { name: "Salvar e assinar" }),
    ).toBeEnabled());
    expect(authorization.hasCapability("clinical_records.finalize")).toBe(false);

    fireEvent.click(screen.getByRole("button", { name: "Salvar rascunho" }));
    await waitFor(() => expect(axios.post).toHaveBeenCalledWith(
      "/evaluations/quick-evolution",
      expect.objectContaining({ evolution_text: "Evolução acionável em leitura" }),
    ));
  });

  test.each([
    {
      label: "edit + write without finalize",
      clinicalLevel: "edit",
      capabilities: ["clinical_records.read", "clinical_records.write"],
      canFinalize: false,
    },
    {
      label: "edit + write + finalize",
      clinicalLevel: "edit",
      capabilities: [
        "clinical_records.read",
        "clinical_records.write",
        "clinical_records.finalize",
      ],
      canFinalize: true,
    },
  ])("$label keeps write controls available while current signing UI follows identity", async ({
    clinicalLevel,
    capabilities,
    canFinalize,
  }) => {
    const authorization = authorize({ clinicalLevel, capabilities });
    renderPage();
    await waitForPatient();
    await openCase();

    expect(screen.getByRole("button", { name: "Evolução" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Editar rascunho" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Adicionar adendo" })).toBeInTheDocument();
    expect(authorization.hasCapability("clinical_records.finalize")).toBe(canFinalize);

    fireEvent.click(screen.getByRole("button", { name: "Evolução" }));
    await waitFor(() => expect(
      screen.getByRole("button", { name: "Salvar e assinar" }),
    ).toBeEnabled());
  });

  test("addendum is currently exposed without correction.own and is actionable from identity alone", async () => {
    const authorization = authorize({
      clinicalLevel: "edit",
      capabilities: ["clinical_records.read", "clinical_records.write"],
    });
    renderPage();
    await waitForPatient();
    await openCase();

    expect(authorization.hasCapability("clinical_records.correction.own")).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "Adicionar adendo" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Salvar adendo" })).toBeEnabled());
    fireEvent.change(screen.getByText("Motivo do adendo").parentElement.querySelector("input"), {
      target: { value: "Complemento clínico" },
    });
    fireEvent.change(screen.getByText("Conteúdo do adendo").parentElement.querySelector("textarea"), {
      target: { value: "Orientação complementar" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Salvar adendo" }));

    await waitFor(() => expect(addSignedClinicalAddendum).toHaveBeenCalledWith(
      "evaluation",
      32,
      expect.objectContaining({ version: 4 }),
    ));
  });

  test("read-only currently exposes case, reference and external-professional mutation entries", async () => {
    authorize();
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
  ])("clinical Data editing currently ignores the effective combination: %s", async (
    _label,
    scenario,
  ) => {
    const authorization = authorize(scenario);
    renderPage();
    await waitForPatient();
    fireEvent.click(screen.getByRole("button", { name: "Dados" }));

    expect(within(clinicalInformationCard()).getByRole("button", { name: "Editar" }))
      .toBeInTheDocument();
    expect(authorization.canAccessModule).not.toHaveBeenCalledWith("patients", "manage");
    expect(authorization.canAccessModule).not.toHaveBeenCalledWith("clinical_records", "edit");
    cleanup();
  });
});
