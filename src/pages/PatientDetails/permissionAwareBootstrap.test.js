import React from "react";
import "@testing-library/jest-dom";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { Router, Route } from "react-router-dom";
import { createMemoryHistory } from "history";

import PatientDetails from ".";
import axios from "../../services/axios";
import { useAuthorization } from "../../contexts/AuthorizationContext";
import { listPatientClinicalCases } from "../../services/patientClinicalCases";
import { listPatientClinicalReferences } from "../../services/patientClinicalReferences";
import { listPatientExternalProfessionals } from "../../services/patientExternalProfessionals";
import { listPatientDocuments } from "../../services/documents";

const PATIENT_DETAILS_TEST_NOW = new Date("2026-08-20T12:00:00-03:00");
const NativeDate = Date;
let patientDetailsTestNow = PATIENT_DETAILS_TEST_NOW.valueOf();

class FixedPatientDetailsDate extends NativeDate {
  constructor(...args) {
    super(...(args.length > 0 ? args : [patientDetailsTestNow]));
  }

  static now() {
    return patientDetailsTestNow;
  }
}

const setPatientDetailsTestNow = (value) => {
  patientDetailsTestNow = new NativeDate(value).valueOf();
};

const FREQUENCY_TEST_DATES = [
  { label: "antes da virada do mês", now: "2026-08-20T12:00:00-03:00" },
  { label: "depois da virada do mês", now: "2026-09-20T12:00:00-03:00" },
];

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
jest.mock("../../services/documents", () => ({
  ATTENDANCE_DECLARATION: "attendance_declaration",
  downloadIssuedDocument: jest.fn(),
  downloadPdfResponse: jest.fn(),
  getDocumentErrorMessage: jest.fn((error, fallback) => Promise.resolve(fallback)),
  issueAttendanceDeclaration: jest.fn(),
  listEligibleDocumentSessions: jest.fn(),
  listIssuanceDocumentTemplates: jest.fn(),
  listPatientDocuments: jest.fn(),
  previewAttendanceDeclaration: jest.fn(),
}));
jest.mock("react-toastify", () => ({
  toast: { error: jest.fn(), success: jest.fn() },
}));

const response = (data) => Promise.resolve({ data });

const buildValidPackageHistoryPayload = () => [{
  id: 501,
  service: { id: 40, name: "Fisioterapia", code: "physio" },
  quantity: 1,
  scheduled_count: 0,
  contracted_at: "2026-08-01",
  reference_date: "2026-08-01",
  status: "active",
  sessions: [{
    unit_id: 601,
    position: 1,
    unit_state: "available",
    current_session_id: null,
    id: null,
    starts_at: null,
    status: "available",
    professional_name: null,
    attended_patient: null,
    replacement: null,
  }],
}];

const buildPackageHistoryPayloadWithSession = (sessionChanges) => {
  const payload = buildValidPackageHistoryPayload();
  return [{
    ...payload[0],
    sessions: [{ ...payload[0].sessions[0], ...sessionChanges }],
  }];
};

function authorize(modules, {
  clinicalRead = modules.includes("clinical_records"),
  documentIssue = false,
  packageShare = false,
  catalogVersion = 8,
} = {}) {
  useAuthorization.mockReturnValue({
    status: "ready",
    context: { catalog_version: catalogVersion },
    isAdministrator: false,
    canAccessModule: (moduleKey) => modules.includes(moduleKey),
    hasCapability: (capability) => ({
      "clinical_records.read": clinicalRead,
      "clinical_records.documents.issue": documentIssue,
      "schedule.package.share": catalogVersion === 8 && packageShare,
    }[capability] === true),
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
    if (/^\/patients\/\d+\/package-history$/.test(String(url))) return response([]);
    throw new Error(`Unexpected GET ${url}`);
  });
  listPatientClinicalCases.mockResolvedValue({ data: [] });
  listPatientClinicalReferences.mockResolvedValue({ data: [] });
  listPatientExternalProfessionals.mockResolvedValue({ data: [] });
  listPatientDocuments.mockResolvedValue([]);
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
  if (/^\/patients\/\d+\/package-history$/.test(String(url))) return response([]);
  throw new Error(`Unexpected GET ${url}`);
}

describe("PatientDetails permission-aware bootstrap", () => {
  beforeEach(() => {
    setPatientDetailsTestNow(PATIENT_DETAILS_TEST_NOW);
    global.Date = FixedPatientDetailsDate;
    jest.clearAllMocks();
    window.sessionStorage.clear();
    configureSuccessfulRequests();
  });

  afterEach(() => {
    global.Date = NativeDate;
  });

  it("retorna do detalhe para a listagem de Pacientes", async () => {
    authorize(["patients"]);
    const history = renderPage();

    expect(await screen.findByRole("heading", { name: "Ana Modular" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Pacientes" }));

    expect(history.location.pathname).toBe("/pacientes");
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
    expect(requested("/patients/101/package-history")).toBe(schedule);
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

  it("no catálogo 7 mantém o Histórico legado sem consultar package-history", async () => {
    authorize(["patients", "schedule"], { catalogVersion: 7, packageShare: true });
    axios.get.mockImplementation((url, config) => {
      if (url === "/patients/101") {
        return response({ id: 101, full_name: "Ana Modular", birth_date: "1990-04-15" });
      }
      if (url === "/sessions") {
        if (config?.params?.from) return response([]);
        return response([{
          id: 941,
          patient_id: 101,
          billing_mode: "per_session",
          series_id: 801,
          starts_at: "2026-08-10T10:00:00",
          status: "scheduled",
          professional_name: "Dra. Paula",
          Patient: { id: 101, full_name: "Ana Modular" },
          Service: { id: 51, name: "Pilates legado", code: "pilates_legacy" },
          PackageUnit: { Package: { patient_id: 101 } },
        }]);
      }
      if (url === "/session-series") {
        return response([{
          id: 801,
          occurrence_count: 1,
          Service: { id: 51, name: "Pilates legado", code: "pilates_legacy" },
        }]);
      }
      if (url === "/session-replacement-credits") return response([]);
      if (url === "/unit-scheduling-policy") return response({});
      throw new Error(`Unexpected GET ${url}`);
    });

    renderPage();
    expect(await screen.findByRole("heading", { name: "Ana Modular" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Histórico" }));

    expect(await screen.findByText("Pilates legado")).toBeInTheDocument();
    expect(requested("/patients/101/package-history")).toBe(false);
  });

  it("no catálogo 8 não converte 404 de package-history em Histórico legado", async () => {
    authorize(["patients", "schedule"], { catalogVersion: 8 });
    axios.get.mockImplementation((url, config) => {
      if (url === "/patients/101/package-history") {
        const error = new Error("Contrato de pacote indisponível");
        error.response = { status: 404, data: { error: "Contrato de pacote indisponível" } };
        return Promise.reject(error);
      }
      return configureResponse(url, config);
    });

    renderPage();
    expect(await screen.findByRole("heading", { name: "Ana Modular" })).toBeInTheDocument();
    expect(await screen.findByRole("alert")).toHaveTextContent("Contrato de pacote indisponível");
    expect(requested("/patients/101/package-history")).toBe(true);
  });

  it.each([
    ["envelope objeto", {}],
    ["item incompleto", [{ id: 501, quantity: 3, scheduled_count: 0, sessions: [] }]],
    ["sessão sem data e paciente", [{
      id: 501,
      service: { id: 40, name: "Fisioterapia", code: "physio" },
      quantity: 1,
      scheduled_count: 1,
      sessions: [{
        unit_id: 601,
        unit_state: "reserved",
        current_session_id: 901,
        id: 901,
        starts_at: null,
        status: "scheduled",
        professional_name: null,
        attended_patient: null,
      }],
    }]],
  ])("no catálogo 8 rejeita package-history malformado: %s", async (_label, payload) => {
    authorize(["patients", "schedule"], { catalogVersion: 8 });
    axios.get.mockImplementation((url, config) => {
      if (url === "/patients/101/package-history") return response(payload);
      return configureResponse(url, config);
    });

    renderPage();
    expect(await screen.findByRole("heading", { name: "Ana Modular" })).toBeInTheDocument();
    expect(await screen.findByRole("alert"))
      .toHaveTextContent("Não foi possível carregar o histórico de agenda do paciente.");
    expect(requested("/patients/101/package-history")).toBe(true);
  });

  it.each([
	    ["metadata do pacote", () => {
	      const payload = buildValidPackageHistoryPayload();
	      return [{ ...payload[0], reference_date: null }];
	    }],
	    ["posição da unidade", () => buildPackageHistoryPayloadWithSession({ position: 2 })],
	    ["profissional", () => buildPackageHistoryPayloadWithSession({ professional_name: {} })],
	    ["reposição", () => buildPackageHistoryPayloadWithSession({
	      status: "replacement_pending",
	      replacement: {
        id: 701,
        status: "used",
        expires_at: "2026-11-30",
	      },
	    })],
	  ])("no catálogo 8 rejeita contrato malformado em %s", async (_label, buildPayload) => {
    authorize(["patients", "schedule"], { catalogVersion: 8 });
	    const payload = buildPayload();
    axios.get.mockImplementation((url, config) => {
      if (url === "/patients/101/package-history") return response(payload);
      return configureResponse(url, config);
    });

    renderPage();
    expect(await screen.findByRole("heading", { name: "Ana Modular" })).toBeInTheDocument();
    expect(await screen.findByRole("alert"))
      .toHaveTextContent("Não foi possível carregar o histórico de agenda do paciente.");
  });

  it("aceita status de sessão customizado no package-history válido", async () => {
    authorize(["patients", "schedule"], { catalogVersion: 8 });
    const payload = buildPackageHistoryPayloadWithSession({
      unit_state: "reserved",
      current_session_id: 901,
      id: 901,
      starts_at: "2026-08-25T10:00:00",
      status: "retorno_monitorado",
      professional_name: null,
      attended_patient: { id: 101, name: "Ana Modular", can_view_profile: true },
    });
    payload[0].scheduled_count = 1;
    axios.get.mockImplementation((url, config) => {
      if (url === "/patients/101/package-history") return response(payload);
      return configureResponse(url, config);
    });

    renderPage();
    expect(await screen.findByRole("heading", { name: "Ana Modular" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Histórico" }));
    expect(await screen.findByText("Fisioterapia")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Ver sessões" }));
    expect(screen.getByText("retorno_monitorado")).toBeInTheDocument();
  });

  it.each(FREQUENCY_TEST_DATES)(
    "deriva frequência e presença somente das respostas autorizadas da Agenda $label",
    async ({ now: currentTime }) => {
      setPatientDetailsTestNow(currentTime);
      authorize(["patients", "schedule"]);
      const now = new Date();
      const startsAt = (day, hour) => new Date(
        now.getFullYear(),
        now.getMonth(),
        day,
        hour,
        0,
        0,
        0,
      ).toISOString();
      axios.get.mockImplementation((url, config) => {
        if (url === "/sessions") {
          return response([
            {
              id: 1,
              status: "done",
              starts_at: startsAt(5, 9),
              billing_mode: "per_session",
              Service: { name: "Fisioterapia lombar" },
              reschedules: [],
            },
            {
              id: 2,
              status: "no_show",
              starts_at: startsAt(12, 9),
              billing_mode: "per_session",
              Service: { name: "Fisioterapia lombar" },
              reschedules: [{ id: 10 }],
            },
          ]);
        }
        return configureResponse(url, config);
      });

      renderPage();
      expect(await screen.findByRole("heading", { name: "Ana Modular" })).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "Histórico" }));

      expect(await screen.findByText("Frequência e presença")).toBeInTheDocument();
      expect(screen.getAllByText("50%").length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText("Fisioterapia lombar").length).toBeGreaterThanOrEqual(1);
    },
  );

  it("não carrega prontuário quando o módulo existe sem a capability de leitura", async () => {
    authorize(["patients", "clinical_records"], { clinicalRead: false });
    renderPage();

    expect(await screen.findByRole("heading", { name: "Ana Modular" })).toBeInTheDocument();
    expect(requested("/evaluations?")).toBe(false);
    expect(listPatientClinicalCases).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Prontuário" })).not.toBeInTheDocument();
  });

  it.each([
    ["pending", "Pendente"],
    ["used", "Usada"],
    ["expired", "Expirada"],
    ["canceled", "Cancelada"],
  ])("compacta estado %s e validade antes da sessão original e observação", async (status, label) => {
    authorize(["patients", "clinical_records", "schedule"]);
    axios.get.mockImplementation((url) => {
      if (url === "/session-replacement-credits") return response([{
        id: 901, patient_id: 101, source_session_id: 991, used_session_id: 992,
        status, expires_at: "2026-11-30", reason: "Observação registrada na reposição",
        canceled_reason: "Cancelamento posterior do direito",
        sourceSession: { id: 991, patient_id: 101, starts_at: "2026-10-28T10:00:00-03:00", Service: { name: "Fisioterapia" } },
        usedSession: { id: 992, patient_id: 101, starts_at: "2026-11-04T11:30:00-03:00", status: "done", absence_reason: "Justificativa posterior do agendamento" },
      }]);
      return configureResponse(url);
    });
    renderPage();
    expect(await screen.findByText("Reposições de sessão")).toBeInTheDocument();
    const observation = screen.getByText("Observação: Observação registrada na reposição");
    const card = observation.parentElement;
    const summary = within(card).getByText(label).parentElement;
    const source = within(card).getByText("Sessão original: Fisioterapia — 28/10/2026 às 10:00");
    expect([...summary.children].map((child) => child.textContent)).toEqual([label, "Validade: 30/11/2026"]);
    expect(summary).toHaveStyle({ display: "flex", flexWrap: "wrap" });
    expect([...card.children]).toEqual([summary, source, observation]);
    expect(card).not.toHaveTextContent(/Reposição agendada para|Estado do agendamento|04\/11\/2026|11:30|Realizada/);
    expect(card).not.toHaveTextContent(/sessão #|Origem:|Usada na sessão|991|992|Cancelamento posterior|Justificativa posterior/);
    if (status === "pending") expect(within(card.parentElement).getByRole("button", { name: "Cancelar" })).toBeInTheDocument();
    else expect(within(card.parentElement).queryByRole("button", { name: "Cancelar" })).not.toBeInTheDocument();
    expect(axios.get).toHaveBeenCalledWith("/session-replacement-credits", { params: { patient_id: "101" } });
    expect(axios.post).not.toHaveBeenCalled();
    expect(axios.put).not.toHaveBeenCalled();
  });

  it.each(["ausente", "outro vínculo", "outro paciente"])("não reconstrói sessões da reposição quando a relação é %s", async (missing) => {
    authorize(["patients", "clinical_records", "schedule"]);
    const session = missing === "ausente" ? null : {
      id: missing === "outro vínculo" ? 999 : 991,
      patient_id: missing === "outro paciente" ? 202 : 101,
      starts_at: new Date(2026, 9, 28, 10).toISOString(), status: "done",
      Service: { name: "Serviço de vínculo incorreto" },
    };
    axios.get.mockImplementation((url) => {
      if (url === "/session-replacement-credits") return response([{
        id: 901, patient_id: 101, source_session_id: 991, used_session_id: 992,
        status: "used", expires_at: "2026-11-30", reason: "Observação preservada",
        sourceSession: session, usedSession: session,
      }]);
      return configureResponse(url);
    });
    renderPage();
    expect(await screen.findByText("Reposições de sessão")).toBeInTheDocument();
    const card = screen.getByText("Observação: Observação preservada").parentElement;
    expect(within(card).getByText("Sessão original: Informações indisponíveis")).toBeInTheDocument();
    expect(card).not.toHaveTextContent(/Reposição agendada para|Estado do agendamento/);
    expect(card).not.toHaveTextContent(/28\/10|10:00|Serviço de vínculo incorreto|Realizada|991|992|999/);
  });

  it("mantém datas sem hora e não inventa serviço, horário ou rótulo para estado desconhecido", async () => {
    authorize(["patients", "clinical_records", "schedule"]);
    axios.get.mockImplementation((url) => {
      if (url === "/session-replacement-credits") return response([{
        id: 901, patient_id: 101, source_session_id: 991, used_session_id: 992,
        status: "used", expires_at: "2026-11-30", reason: "Reposição parcial",
        sourceSession: { id: 991, patient_id: 101, starts_at: "2026-10-28", Service: null },
        usedSession: { id: 992, patient_id: 101, starts_at: "data inválida", status: "technical_unknown_status" },
      }]);
      return configureResponse(url);
    });
    renderPage();
    expect(await screen.findByText("Reposições de sessão")).toBeInTheDocument();
    const card = screen.getByText("Observação: Reposição parcial").parentElement;
    expect(card).toHaveTextContent("Sessão original: Serviço não informado — 28/10/2026 (horário não informado)");
    expect(card).not.toHaveTextContent(/Reposição agendada para|Estado do agendamento/);
    expect(card).not.toHaveTextContent(/00:00|technical_unknown_status|991|992/);
  });

  it("mantém várias reposições compactas e omite observações nulas, vazias ou com espaços sem reservar linha", async () => {
    authorize(["patients", "clinical_records", "schedule"]);
    const states = ["pending", "used", "expired", "canceled"];
    const labels = ["Pendente", "Usada", "Expirada", "Cancelada"];
    const reasons = [null, "", "   ", "  Texto realmente registrado  "];
    axios.get.mockImplementation((url) => {
      if (url === "/session-replacement-credits") return response(states.map((status, index) => ({
        id: 901 + index, patient_id: 101, source_session_id: 991 + index, used_session_id: 1991 + index,
        status, expires_at: "2026-11-30", reason: reasons[index], canceled_reason: "Não usar como observação",
        sourceSession: { id: 991 + index, patient_id: 101, starts_at: new Date(2026, 9, 20 + index, 10).toISOString(), Service: { name: `Fisio compacto ${index + 1}` } },
        usedSession: { id: 1991 + index, patient_id: 101, starts_at: new Date(2026, 10, 4, 11, 30).toISOString(), status: "scheduled" },
      })));
      return configureResponse(url);
    });
    renderPage();
    expect(await screen.findByText("Reposições de sessão")).toBeInTheDocument();
    const sources = screen.getAllByText(/Sessão original: Fisio compacto/);
    expect(sources).toHaveLength(4);
    sources.forEach((source, index) => {
      const card = source.parentElement;
      const summary = within(card).getByText(labels[index]).parentElement;
      expect([...summary.children].map((child) => child.textContent)).toEqual([labels[index], "Validade: 30/11/2026"]);
      expect(card.children[0]).toBe(summary);
      expect(card.children[1]).toBe(source);
      expect(card.children).toHaveLength(index === 3 ? 3 : 2);
      expect(card.querySelectorAll("p")).toHaveLength(index === 3 ? 1 : 0);
      expect(card).not.toHaveTextContent(/Reposição agendada para|Estado do agendamento|Não usar como observação|Usada na sessão|sessão #|199[1-4]|99[1-4]/);
      expect(within(card.parentElement).queryAllByRole("button", { name: "Cancelar" })).toHaveLength(index === 0 ? 1 : 0);
    });
    expect(screen.getByText("Observação: Texto realmente registrado")).toBeInTheDocument();
    expect(screen.getAllByText(/^Observação:/)).toHaveLength(1);
    expect(axios.post).not.toHaveBeenCalled();
    expect(axios.put).not.toHaveBeenCalled();
  });

  it("preserva estado, validade e ação da reposição manual sem inventar sessão de origem", async () => {
    authorize(["patients", "clinical_records", "schedule"]);
    axios.get.mockImplementation((url) => {
      if (url === "/session-replacement-credits") return response([{
        id: 901, patient_id: 101, source_session_id: null, used_session_id: null,
        status: "pending", expires_at: "2026-11-30", reason: "Reposição manual",
      }]);
      return configureResponse(url);
    });
    renderPage();
    expect(await screen.findByText("Reposições de sessão")).toBeInTheDocument();
    const card = screen.getByText("Observação: Reposição manual").parentElement.parentElement;
    expect(within(card).getByText("Pendente")).toBeInTheDocument();
    expect(within(card).getByText("Validade: 30/11/2026")).toBeInTheDocument();
    expect(within(card).getByRole("button", { name: "Cancelar" })).toBeInTheDocument();
    expect(card).not.toHaveTextContent(/Sessão original|Reposição agendada|Estado do agendamento|901/);
  });

  it("expõe Documentos como tab de primeiro nível e preserva a seleção por paciente", async () => {
    authorize(["patients", "clinical_records"], { clinicalRead: false, documentIssue: true });
    const history = renderPage();
    expect(await screen.findByRole("heading", { name: "Ana Modular" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Documentos" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Prontuário" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Documentos" }));
    expect(await screen.findByText(/histórico documental não está disponível/i))
      .toBeInTheDocument();
    expect(window.sessionStorage.getItem("patient-details-active-tab:101"))
      .toBe("documentos");

    await act(async () => { history.push("/pacientes/202"); });
    expect(await screen.findByRole("heading", { name: "Bruno Modular" })).toBeInTheDocument();
    expect(window.sessionStorage.getItem("patient-details-active-tab:202"))
      .not.toBe("documentos");
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

  it("mantém o pacote no histórico do titular e identifica o paciente atendido", async () => {
    authorize(["patients", "schedule"]);
    axios.get.mockImplementation((url, config) => {
      if (url === "/patients/101/package-history") {
        return response([{
          id: 501,
          service: { id: 40, name: "Fisioterapia", code: "physio" },
          quantity: 3,
          scheduled_count: 1,
          contracted_at: "2026-08-01",
	          reference_date: "2026-08-01",
          status: "active",
          sessions: [{
            unit_id: 601,
            position: 1,
            unit_state: "reserved",
            current_session_id: 901,
            id: 901,
            starts_at: "2026-08-25T10:00:00",
            status: "scheduled",
            professional_name: "Dra. Paula",
            attended_patient: {
              id: 202,
              name: "Bruno Modular",
              can_view_profile: true,
            },
	            replacement: null,
          }, {
            unit_id: 602,
            position: 2,
            unit_state: "available",
            current_session_id: null,
            id: null,
            starts_at: null,
            status: "available",
            professional_name: null,
            attended_patient: null,
	            replacement: null,
          }, {
            unit_id: 603,
            position: 3,
            unit_state: "available",
            current_session_id: null,
            id: null,
            starts_at: null,
            status: "available",
            professional_name: null,
            attended_patient: null,
	            replacement: null,
          }],
        }]);
      }
      return configureResponse(url, config);
    });
    const history = renderPage();
    expect(await screen.findByRole("heading", { name: "Ana Modular" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Histórico" }));
    const packageRow = (await screen.findByText("Fisioterapia")).closest("tr");
    const packageOverviewTable = within(packageRow).getByRole("button", { name: "Ver sessões" })
      .closest("table");
    expect(within(packageOverviewTable).getAllByRole("columnheader").map((header) => header.textContent))
      .toEqual([
        "Tipo",
        "Serviço",
        "Data inicial",
        "Total",
        "Agendadas",
        "Realizadas",
        "Faltas",
        "Canceladas",
        "Ações",
      ]);
    expect(within(packageRow).getAllByRole("cell").slice(3, 8).map((cell) => cell.textContent))
      .toEqual(["3", "1", "0", "0", "0"]);
    fireEvent.click(screen.getByRole("button", { name: "Ver sessões" }));
    expect(await screen.findByRole("columnheader", { name: "Paciente atendido" }))
      .toBeInTheDocument();
    expect(screen.getByText("Bruno Modular")).toBeInTheDocument();
    const packageTable = screen.getByRole("columnheader", { name: "Paciente atendido" })
      .closest("table");
    const rows = within(packageTable).getAllByRole("row");
    expect(rows).toHaveLength(4);
    const scheduledRow = rows.find((row) => within(row).queryByText("Agendada"));
    expect(scheduledRow).toHaveTextContent("25/08/2026");
    expect(scheduledRow).toHaveTextContent("10:00");
    expect(scheduledRow).toHaveTextContent("Dra. Paula");
    expect(scheduledRow).toHaveTextContent("Bruno Modular");
    const unscheduledRows = within(packageTable).getAllByText("Não agendada")
      .map((label) => label.closest("tr"));
    expect(unscheduledRows).toHaveLength(2);
    unscheduledRows.forEach((row) => {
      expect(within(row).getAllByRole("cell").map((cell) => cell.textContent))
        .toEqual(["—", "—", "—", "Não agendada", "—"]);
    });
    expect(within(packageTable).queryByText("Disponível")).not.toBeInTheDocument();
    expect(within(packageTable).queryByRole("link", { name: "—" })).not.toBeInTheDocument();
    expect(screen.getByText("0/3 realizadas")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("link", { name: "Bruno Modular" }));
    expect(history.location.pathname).toBe("/pacientes/202");
    expect(await screen.findByRole("heading", { name: "Bruno Modular" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Sessões do pacote" })).not.toBeInTheDocument();

    await act(async () => { history.goBack(); });
    expect(history.location.pathname).toBe("/pacientes/101");
    expect(await screen.findByRole("heading", { name: "Ana Modular" })).toBeInTheDocument();
    expect(await screen.findByText("Fisioterapia")).toBeInTheDocument();
  });

  it.each([
    {
      label: "o Backend não autoriza o paciente alvo",
      modules: ["patients", "schedule"],
      authorizationOptions: {},
      backendAllowsProfile: false,
    },
    {
      label: "há somente a capacidade de compartilhar pacote",
      modules: ["schedule"],
      authorizationOptions: { packageShare: true },
      backendAllowsProfile: true,
    },
  ])("mantém o paciente atendido como texto quando $label", async ({
    modules,
    authorizationOptions,
    backendAllowsProfile,
  }) => {
    authorize(modules, authorizationOptions);
    axios.get.mockImplementation((url, config) => {
      if (url === "/patients/101/package-history") {
        return response([{
          id: 511,
          service: { id: 45, name: "Terapia manual", code: "manual" },
          quantity: 1,
          scheduled_count: 1,
          contracted_at: "2026-08-01",
	          reference_date: "2026-08-01",
          status: "active",
          sessions: [{
            unit_id: 621,
            position: 1,
            unit_state: "reserved",
            current_session_id: 921,
            id: 921,
            starts_at: "2026-08-25T10:00:00",
            status: "scheduled",
            professional_name: "Dra. Paula",
            attended_patient: {
              id: 202,
              name: "Bruno Modular",
              can_view_profile: backendAllowsProfile,
            },
	            replacement: null,
          }],
        }]);
      }
      return configureResponse(url, config);
    });

    renderPage();
    expect(await screen.findByRole("heading", { name: "Ana Modular" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Histórico" }));
    expect(await screen.findByText("Terapia manual")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Ver sessões" }));
    expect(screen.getByText("Bruno Modular")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Bruno Modular" })).not.toBeInTheDocument();
  });

  it("usa o agregado autoritativo com sessão passada e detalhes parciais", async () => {
    authorize(["patients", "schedule"]);
    axios.get.mockImplementation((url, config) => {
      if (url === "/patients/101/package-history") {
        return response([{
          id: 512,
          service: { id: 46, name: "RPG", code: "rpg" },
          quantity: 3,
          scheduled_count: 2,
          contracted_at: "2026-08-01",
	          reference_date: "2026-08-01",
          status: "active",
          sessions: [{
            unit_id: 631,
            position: 1,
            unit_state: "reserved",
            current_session_id: 931,
            id: 931,
            starts_at: "2026-08-10T10:00:00",
            status: "scheduled",
            professional_name: "Dra. Paula",
            attended_patient: { id: 101, name: "Ana Modular", can_view_profile: true },
	            replacement: null,
          }, {
            unit_id: 632,
            position: 2,
            unit_state: "reserved",
            current_session_id: 932,
            id: null,
            starts_at: null,
            status: "reserved",
            professional_name: null,
            attended_patient: null,
	            replacement: null,
          }, {
            unit_id: 633,
            position: 3,
            unit_state: "available",
            current_session_id: null,
            id: null,
            starts_at: null,
            status: "available",
            professional_name: null,
            attended_patient: null,
	            replacement: null,
          }],
        }]);
      }
      return configureResponse(url, config);
    });

    renderPage();
    expect(await screen.findByRole("heading", { name: "Ana Modular" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Histórico" }));
    const packageRow = (await screen.findByText("RPG")).closest("tr");
    expect(within(packageRow).getAllByRole("cell").slice(3, 8).map((cell) => cell.textContent))
      .toEqual(["3", "2", "0", "0", "0"]);
  });

  it("preserva estados e contadores das unidades que não são direitos livres", async () => {
    authorize(["patients", "schedule"]);
    axios.get.mockImplementation((url, config) => {
      if (url === "/patients/101/package-history") {
        return response([{
          id: 502,
          service: { id: 41, name: "Pilates", code: "pilates" },
          quantity: 6,
          scheduled_count: 1,
          contracted_at: "2026-08-01",
	          reference_date: "2026-08-01",
          status: "active",
          sessions: [{
            unit_id: 611,
	            position: 1,
            unit_state: "reserved",
            current_session_id: 911,
            id: 911,
            starts_at: "2026-08-25T10:00:00",
            status: "scheduled",
            professional_name: "Dra. Paula",
            attended_patient: { id: 101, name: "Ana Modular", can_view_profile: true },
	            replacement: null,
          }, {
            unit_id: 612,
	            position: 2,
            unit_state: "consumed",
            current_session_id: 912,
            id: 912,
            starts_at: "2026-08-26T10:00:00",
            status: "done",
            professional_name: "Dra. Paula",
            attended_patient: { id: 101, name: "Ana Modular", can_view_profile: true },
	            replacement: null,
          }, {
            unit_id: 613,
	            position: 3,
            unit_state: "consumed",
            current_session_id: 913,
            id: 913,
            starts_at: "2026-08-27T10:00:00",
            status: "no_show",
            professional_name: "Dra. Paula",
            attended_patient: { id: 101, name: "Ana Modular", can_view_profile: true },
	            replacement: null,
          }, {
            unit_id: 614,
	            position: 4,
            unit_state: "available",
            current_session_id: null,
            id: 914,
            starts_at: "2026-08-28T10:00:00",
            status: "canceled",
            professional_name: "Dra. Paula",
            attended_patient: { id: 101, name: "Ana Modular", can_view_profile: true },
	            replacement: null,
          }, {
            unit_id: 615,
	            position: 5,
            unit_state: "closed",
            current_session_id: null,
            id: null,
            starts_at: null,
            status: "closed",
            professional_name: null,
            attended_patient: null,
	            replacement: null,
          }, {
            unit_id: 616,
	            position: 6,
            unit_state: "available",
            current_session_id: null,
            id: null,
            starts_at: null,
            status: "replacement_pending",
            professional_name: null,
            attended_patient: null,
            replacement: {
              id: 701,
              status: "pending",
              expires_at: "2026-11-30",
            },
          }],
        }]);
      }
      return configureResponse(url, config);
    });

    renderPage();
    expect(await screen.findByRole("heading", { name: "Ana Modular" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Histórico" }));
    const packageRow = (await screen.findByText("Pilates")).closest("tr");
    const packageCells = within(packageRow).getAllByRole("cell");
    expect(packageCells[3]).toHaveTextContent("6");
    expect(packageCells[4]).toHaveTextContent("1");
    expect(packageCells[5]).toHaveTextContent("1");
    expect(packageCells[6]).toHaveTextContent("1");
    expect(packageCells[7]).toHaveTextContent("1");
    fireEvent.click(within(packageRow).getByRole("button", { name: "Ver sessões" }));
    expect(screen.getByText("1/6 realizadas")).toBeInTheDocument();
    [
      "Agendada",
      "Realizada",
      "Falta",
      "Cancelada · disponível",
      "Encerrada",
      "Reposição até 30/11/2026",
    ].forEach((label) => expect(screen.getByText(label)).toBeInTheDocument());
    expect(screen.queryByText("Não agendada")).not.toBeInTheDocument();
  });

  it("preserva a contagem efetiva de pacote legacy e sessão avulsa", async () => {
    authorize(["patients", "schedule"]);
    axios.get.mockImplementation((url, config) => {
      if (url === "/sessions") {
        return response([{
          id: 941,
          patient_id: 101,
          billing_mode: "per_session",
          series_id: 801,
          starts_at: "2026-08-10T10:00:00",
          status: "scheduled",
          professional_name: "Dra. Paula",
          Patient: { id: 101, full_name: "Ana Modular" },
          Service: { id: 51, name: "Pilates legado", code: "pilates_legacy" },
        }, {
          id: 942,
          patient_id: 101,
          billing_mode: "per_session",
          series_id: 801,
          starts_at: "2026-08-11T10:00:00",
          status: "done",
          professional_name: "Dra. Paula",
          Patient: { id: 101, full_name: "Ana Modular" },
          Service: { id: 51, name: "Pilates legado", code: "pilates_legacy" },
        }, {
          id: 943,
          patient_id: 101,
          billing_mode: "per_session",
          starts_at: "2026-08-12T10:00:00",
          status: "canceled",
          professional_name: "Dra. Paula",
          Patient: { id: 101, full_name: "Ana Modular" },
          Service: { id: 52, name: "Massagem avulsa", code: "massage" },
        }]);
      }
      if (url === "/session-series") {
        return response([{
          id: 801,
          occurrence_count: 2,
          Service: { id: 51, name: "Pilates legado", code: "pilates_legacy" },
        }]);
      }
      return configureResponse(url, config);
    });

    renderPage();
    expect(await screen.findByRole("heading", { name: "Ana Modular" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Histórico" }));
    const legacyRow = (await screen.findByText("Pilates legado")).closest("tr");
    const singleRow = screen.getByText("Massagem avulsa").closest("tr");
    expect(within(legacyRow).getAllByRole("cell").slice(3, 8).map((cell) => cell.textContent))
      .toEqual(["2", "1", "1", "0", "0"]);
    expect(within(singleRow).getAllByRole("cell").slice(3, 8).map((cell) => cell.textContent))
      .toEqual(["1", "0", "0", "0", "1"]);
  });

  it("identifica o titular do pacote no histórico do paciente atendido", async () => {
    authorize(["patients", "schedule"]);
    axios.get.mockImplementation((url, config) => {
      if (url === "/sessions") {
        return response([{
          id: 902,
          patient_id: 101,
          billing_mode: "per_session",
          starts_at: "2026-08-25T10:00:00",
          status: "scheduled",
          professional_name: "Dra. Paula",
          Patient: { id: 101, full_name: "Ana Modular" },
          Service: { id: 40, name: "Fisioterapia", code: "physio" },
          PackageUnit: {
            id: 601,
            Package: {
              id: 501,
              patient_id: 202,
              Patient: { id: 202, full_name: "Bruno Modular" },
            },
          },
        }]);
      }
      return configureResponse(url, config);
    });
    renderPage();
    expect(await screen.findByRole("heading", { name: "Ana Modular" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Histórico" }));
    const sharedPackagePill = await screen.findByText("Pacote de Bruno Modular");
    const attendedPatientRow = sharedPackagePill.closest("tr");
    expect(within(attendedPatientRow).getAllByRole("cell").slice(3, 8).map((cell) => cell.textContent))
      .toEqual(["1", "1", "0", "0", "0"]);
    expect(screen.queryByRole("button", { name: "Ver sessões" })).not.toBeInTheDocument();
  });
});
