import React from "react";
import "@testing-library/jest-dom";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Router, Route } from "react-router-dom";
import { createMemoryHistory } from "history";

import PatientDetails from ".";
import axios from "../../services/axios";
import { useAuthorization } from "../../contexts/AuthorizationContext";
import { listPatientClinicalCases } from "../../services/patientClinicalCases";
import { listPatientClinicalReferences } from "../../services/patientClinicalReferences";
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

const response = (data) => Promise.resolve({ data });

function authorize(modules, { clinicalRead = modules.includes("clinical_records") } = {}) {
  useAuthorization.mockReturnValue({
    canAccessModule: (moduleKey) => modules.includes(moduleKey),
    hasCapability: (capability) => (
      capability === "clinical_records.read" && clinicalRead
    ),
  });
}

function configureSuccessfulRequests() {
  axios.get.mockImplementation((url) => {
    if (url === "/patients/101") {
      return response({ id: 101, full_name: "Ana Modular", birth_date: "1990-04-15" });
    }
    if (url === "/patients/202") {
      return response({ id: 202, full_name: "Bruno Modular", birth_date: "1988-09-20" });
    }
    if (String(url).startsWith("/evaluations?")) return response([]);
    if ([
      "/sessions",
      "/session-series",
      "/session-replacement-credits",
    ].includes(url)) return response([]);
    if (url === "/unit-scheduling-policy") return response({});
    throw new Error(`Unexpected GET ${url}`);
  });
  listPatientClinicalCases.mockResolvedValue({ data: [] });
  listPatientClinicalReferences.mockResolvedValue({ data: [] });
  listPatientExternalProfessionals.mockResolvedValue({ data: [] });
}

function renderPage(path = "/pacientes/101") {
  const history = createMemoryHistory({ initialEntries: [path] });
  render(
    <Router history={history}>
      <Route path="/pacientes/:id"><PatientDetails /></Route>
    </Router>,
  );
  return history;
}

function requested(path) {
  return axios.get.mock.calls.some(([url]) => String(url).startsWith(path));
}

function apiError(message) {
  const error = new Error(message);
  error.response = { data: { error: message } };
  return error;
}

function configureResponse(url) {
  if (url === "/patients/101") {
    return response({ id: 101, full_name: "Ana Modular", birth_date: "1990-04-15" });
  }
  if (url === "/patients/202") {
    return response({ id: 202, full_name: "Bruno Modular", birth_date: "1988-09-20" });
  }
  if (String(url).startsWith("/evaluations?")) return response([]);
  if (["/sessions", "/session-series", "/session-replacement-credits"].includes(url)) {
    return response([]);
  }
  if (url === "/unit-scheduling-policy") return response({});
  throw new Error(`Unexpected GET ${url}`);
}

describe("PatientDetails permission-aware bootstrap", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    window.sessionStorage.clear();
    configureSuccessfulRequests();
  });

  it.each([
    {
      label: "patients + clinical_records + schedule",
      modules: ["patients", "clinical_records", "schedule"],
      clinical: true,
      schedule: true,
    },
    {
      label: "somente patients",
      modules: ["patients"],
      clinical: false,
      schedule: false,
    },
    {
      label: "patients + clinical_records",
      modules: ["patients", "clinical_records"],
      clinical: true,
      schedule: false,
    },
    {
      label: "patients + schedule",
      modules: ["patients", "schedule"],
      clinical: false,
      schedule: true,
    },
  ])("carrega apenas os módulos autorizados: $label", async ({ modules, clinical, schedule }) => {
    authorize(modules);
    renderPage();

    expect(await screen.findByRole("heading", { name: "Ana Modular" })).toBeInTheDocument();
    await waitFor(() => expect(requested("/patients/101")).toBe(true));
    expect(requested("/evaluations?")).toBe(clinical);
    expect(listPatientClinicalCases).toHaveBeenCalledTimes(clinical ? 1 : 0);
    expect(listPatientClinicalReferences).toHaveBeenCalledTimes(clinical ? 1 : 0);
    expect(listPatientExternalProfessionals).toHaveBeenCalledTimes(clinical ? 1 : 0);
    expect(requested("/sessions")).toBe(schedule);
    expect(requested("/session-series")).toBe(schedule);
    expect(requested("/session-replacement-credits")).toBe(schedule);
    expect(requested("/unit-scheduling-policy")).toBe(schedule);
    expect(screen.queryByRole("button", { name: "Prontuário" })).toBe(
      clinical ? screen.getByRole("button", { name: "Prontuário" }) : null,
    );
    expect(screen.queryByRole("button", { name: "Histórico" })).toBe(
      schedule ? screen.getByRole("button", { name: "Histórico" }) : null,
    );

    const serializedCalls = JSON.stringify({
      axios: axios.get.mock.calls,
      cases: listPatientClinicalCases.mock.calls,
      references: listPatientClinicalReferences.mock.calls,
      external: listPatientExternalProfessionals.mock.calls,
    });
    expect(serializedCalls).not.toContain("clinic_id");
  });

  it("não carrega prontuário quando o módulo existe sem a capability de leitura", async () => {
    authorize(["patients", "clinical_records"], { clinicalRead: false });
    renderPage();

    expect(await screen.findByRole("heading", { name: "Ana Modular" })).toBeInTheDocument();
    expect(requested("/evaluations?")).toBe(false);
    expect(listPatientClinicalCases).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Prontuário" })).not.toBeInTheDocument();
  });

  it("mantém o perfil e mostra erro clínico quando uma request clínica autorizada falha", async () => {
    authorize(["patients", "clinical_records", "schedule"]);
    axios.get.mockImplementation((url, config) => {
      if (String(url).startsWith("/evaluations?")) {
        return Promise.reject(apiError("Falha clínica observável"));
      }
      return configureResponse(url, config);
    });
    renderPage();

    expect(await screen.findByRole("heading", { name: "Ana Modular" })).toBeInTheDocument();
    expect(await screen.findByRole("alert")).toHaveTextContent("Falha clínica observável");
    expect(screen.getByRole("button", { name: "Histórico" })).toBeInTheDocument();
  });

  it("mantém o perfil e mostra erro de agenda quando uma request autorizada falha", async () => {
    authorize(["patients", "clinical_records", "schedule"]);
    axios.get.mockImplementation((url, config) => {
      if (url === "/session-series") {
        return Promise.reject(apiError("Falha de agenda observável"));
      }
      return configureResponse(url, config);
    });
    renderPage();

    expect(await screen.findByRole("heading", { name: "Ana Modular" })).toBeInTheDocument();
    expect(await screen.findByRole("alert")).toHaveTextContent("Falha de agenda observável");
    expect(screen.getByRole("button", { name: "Prontuário" })).toBeInTheDocument();
  });

  it("falha a página principal quando /patients/:id falha", async () => {
    authorize(["patients", "clinical_records", "schedule"]);
    axios.get.mockImplementation((url, config) => {
      if (url === "/patients/101") {
        return Promise.reject(apiError("Paciente indisponível"));
      }
      return configureResponse(url, config);
    });
    renderPage();

    expect(await screen.findByRole("alert")).toHaveTextContent("Paciente indisponível");
    expect(screen.queryByRole("button", { name: "Dados" })).not.toBeInTheDocument();
  });

  it("não mantém dados do paciente anterior durante a troca", async () => {
    authorize(["patients", "clinical_records"]);
    listPatientClinicalCases
      .mockResolvedValueOnce({ data: [{ id: 11, title: "Caso exclusivo da Ana", status: "active" }] })
      .mockRejectedValueOnce(apiError("Prontuário de Bruno indisponível"));
    const history = renderPage();
    expect(await screen.findByRole("heading", { name: "Ana Modular" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Prontuário" }));
    expect(await screen.findByRole("button", { name: /Caso exclusivo da Ana/ })).toBeInTheDocument();

    await act(async () => { history.push("/pacientes/202"); });
    expect(await screen.findByRole("heading", { name: "Bruno Modular" })).toBeInTheDocument();
    expect(await screen.findByRole("alert")).toHaveTextContent("Prontuário de Bruno indisponível");
    expect(screen.queryByText("Caso exclusivo da Ana")).not.toBeInTheDocument();
  });
});
