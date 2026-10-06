/* eslint-env jest */
import "@testing-library/jest-dom";
import {
  act, cleanup, fireEvent, render, screen, waitFor, within,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { toast } from "react-toastify";

import Agendamentos from "./index";
import axios, { getUserFacingApiError, sanitizeUserFacingErrorMessage } from "../../services/axios";
import {
  checkSchedulingAvailability,
  listSpecialSchedulingEvents,
  previewSchedulingOccurrences,
} from "../../services/scheduling";
import { getCoveragePreview, listPatientPlans } from "../../services/financial";
import { PENDING_CENTER_ACTION_STATE_KEY } from "../../components/PendingCenter";

let mockProfessionalAssigned = true;
let mockAuthorization = null;
let controlledFakeTimersEnabled = false;

const NativeDate = Date;
const DEFAULT_AGENDA_TEST_NOW = new NativeDate("2026-06-29T09:00:00.000Z");
let agendaTestNow = DEFAULT_AGENDA_TEST_NOW;

class FixedAgendaDate extends NativeDate {
  constructor(...args) {
    super(...(args.length > 0 ? args : [agendaTestNow.valueOf()]));
  }

  static now() {
    return agendaTestNow.valueOf();
  }
}

const enableControlledFakeTimers = () => {
  global.Date = NativeDate;
  jest.useFakeTimers().setSystemTime(agendaTestNow);
  controlledFakeTimersEnabled = true;
};

jest.mock("../../contexts/AuthorizationContext", () => ({
  useAuthorization: () => mockAuthorization,
}));

jest.mock("../../components/AppShell", () => function AppShellMock({ children }) {
  return <div data-testid="app-shell">{children}</div>;
});

jest.mock("react-toastify", () => ({
  toast: {
    error: jest.fn(),
    info: jest.fn(),
    success: jest.fn(),
    warning: jest.fn(),
  },
}));

jest.mock("../../services/axios", () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    patch: jest.fn(),
  },
  getUserFacingApiError: jest.fn((error, fallback) => fallback),
  sanitizeUserFacingErrorMessage: jest.fn((message) => message),
}));

jest.mock("../../services/scheduling", () => ({
  checkSchedulingAvailability: jest.fn(),
  listSpecialSchedulingEvents: jest.fn(),
  previewSchedulingOccurrences: jest.fn(),
}));

jest.mock("../../services/financial", () => ({
  getCoveragePreview: jest.fn(),
  listPatientPlans: jest.fn(),
}));

const baseSession = {
  id: 10,
  clinic_id: 1,
  patient_id: 20,
  professional_user_id: 30,
  service_id: 40,
  service_type: "spine_eval",
  status: "scheduled",
  starts_at: "2026-06-29T07:00:00",
  ends_at: "2026-06-29T08:00:00",
  billing_mode: "per_session",
  notes: "",
  Patient: {
    id: 20,
    full_name: "Paciente Teste",
  },
  Service: {
    id: 40,
    code: "spine_eval",
    name: "Avaliacao Coluna",
  },
  professional: {
    id: 30,
    name: "Profissional Teste",
  },
  reschedules: [],
};

const canceledSession = {
  ...baseSession,
  id: 11,
  patient_id: 21,
  status: "canceled",
  Patient: {
    id: 21,
    full_name: "Paciente Cancelado",
  },
};

const noShowSession = {
  ...baseSession,
  id: 12,
  patient_id: 22,
  status: "no_show",
  Patient: {
    id: 22,
    full_name: "Paciente Falta",
  },
};

const doneSession = {
  ...baseSession,
  id: 13,
  patient_id: 23,
  status: "done",
  Patient: {
    id: 23,
    full_name: "Paciente Concluido",
  },
};

const packageSession = {
  ...baseSession,
  PackageUnit: {
    id: 501,
    package_id: 701,
    position: 1,
    state: "reserved",
    Package: {
      id: 701,
      patient_id: 20,
      service_id: 40,
      quantity: 3,
      status: "active",
      Patient: {
        id: 20,
        full_name: "Paciente Teste",
      },
    },
  },
};

const absoluteBaseSession = {
  ...baseSession,
  starts_at: "2026-06-29T10:00:00.000Z",
  ends_at: "2026-06-29T11:00:00.000Z",
};

const absolutePackageSession = {
  ...packageSession,
  starts_at: absoluteBaseSession.starts_at,
  ends_at: absoluteBaseSession.ends_at,
};

const suspendedSession = {
  ...baseSession,
  id: 14,
  patient_id: 24,
  status: "suspended",
  Patient: {
    id: 24,
    full_name: "Paciente Suspenso",
  },
};

const renderAgendamentos = (initialEntry = "/agendamentos") => render(
  <MemoryRouter initialEntries={[initialEntry]}>
    <Agendamentos />
  </MemoryRouter>,
);

const buildAvailabilityValidation = ({
  canConfirm = true,
  blockingCode = null,
  blockingReason = null,
} = {}) => ({
  complete: true,
  patient_conflict_checked: true,
  can_confirm: canConfirm,
  blocking_code: blockingCode,
  blocking_reason: blockingReason,
});

const buildOperationalAvailability = ({
  hasBlockingEvents = false,
  hasWarningEvents = false,
  matchedEvents = [],
  blockingReason = null,
  allowAdminOverrideBlock = false,
} = {}) => {
  let severity = "info";
  if (hasWarningEvents) severity = "warn";
  if (hasBlockingEvents) severity = "block";
  return {
    allowed: !hasBlockingEvents,
    severity,
    matched_events: matchedEvents,
    requires_confirmation: hasWarningEvents,
    has_blocking_events: hasBlockingEvents,
    has_warning_events: hasWarningEvents,
    blocking_reason: blockingReason,
    policy: { allow_admin_override_block: allowAdminOverrideBlock },
  };
};

const buildPreviewOccurrence = (index, date) => {
  const availability = buildOperationalAvailability();
  return {
    index,
    date,
    start_time: "10:00",
    end_time: "11:00",
    starts_at: `${date}T13:00:00.000Z`,
    ends_at: `${date}T14:00:00.000Z`,
    status: "AVAILABLE",
    matched_events: [],
    requires_confirmation: false,
    blocking_reason: null,
    can_create: true,
    availability,
    can_override_block: false,
    blocking_code: null,
    validation: buildAvailabilityValidation(),
  };
};

const buildLegacyPreviewOccurrence = (index, date) => {
  const occurrence = buildPreviewOccurrence(index, date);
  delete occurrence.validation;
  return occurrence;
};

const buildPreviewSummary = ({
  total,
  available,
  info = 0,
  warn,
  blocked,
  overrideableBlocked = 0,
}) => ({
  total,
  available,
  info,
  warn,
  blocked,
  overrideable_blocked: overrideableBlocked,
  creatable: available + info,
  creatable_with_warning_confirmation: available + info + warn,
  creatable_with_override: available + info + warn + overrideableBlocked,
});

const buildSingleAvailabilityResponse = ({
  canConfirm = true,
  blockingCode = null,
  blockingReason = null,
  canOverrideBlock = false,
  hasBlockingEvents = false,
} = {}) => ({
  data: {
    ...buildOperationalAvailability({
      hasBlockingEvents,
      blockingReason,
      allowAdminOverrideBlock: canOverrideBlock,
    }),
    has_blocking_events: hasBlockingEvents,
    requires_confirmation: false,
    matched_events: [],
    can_override_block: canOverrideBlock,
	    blocking_code: blockingCode,
    blocking_reason: blockingReason,
    validation: buildAvailabilityValidation({ canConfirm, blockingCode, blockingReason }),
  },
});

const buildLegacySingleAvailabilityResponse = ({
  canOverrideBlock = false,
  hasBlockingEvents = false,
} = {}) => ({
  data: {
    has_blocking_events: hasBlockingEvents,
    requires_confirmation: false,
    matched_events: [],
    severity: "info",
    can_override_block: canOverrideBlock,
  },
});

const createDeferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
};

const submitAndConfirmReview = async () => {
  fireEvent.click(screen.getByRole("button", { name: "Revisar agendamento" }));
  expect(await screen.findByRole("heading", { name: "Revisar agendamento" }))
    .toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Confirmar agendamento" }));
};

const selectAssignedProfessional = async (container) => {
  await waitFor(() => expect(axios.get.mock.calls.some(
    ([url, config]) => url === "/schedule/references/professionals"
      && Number(config?.params?.patient_id) > 0,
  )).toBe(true));
  await waitFor(() => expect(container.querySelector('select[name="professional_user_id"]')).not.toBeNull());
  const select = container.querySelector('select[name="professional_user_id"]');
  await waitFor(() => expect(
    Array.from(select.options).some((option) => option.value === "30"),
  ).toBe(true));
  await waitFor(() => expect(
    Array.from(select.options).some((option) => option.textContent === "Validando profissionais..."),
  ).toBe(false));
  fireEvent.change(select, {
    target: { value: "30" },
  });
  expect(select.value).toBe("30");
};

const openNewSingleReview = async (container, {
  ownRight = false,
  date = "2026-07-20",
  hour = "10",
} = {}) => {
  await screen.findByText("Paciente Teste");
  fireEvent.click(screen.getByRole("button", { name: "Novo agendamento" }));
  fireEvent.change(await screen.findByPlaceholderText("Buscar paciente"), {
    target: { value: "Paciente Teste" },
  });
  const patientSuggestions = await screen.findAllByText("Paciente Teste");
  fireEvent.click(patientSuggestions.find((element) => element.tagName === "BUTTON"));
  if (ownRight) fireEvent.click(await screen.findByRole("radio", { name: /Fisioterapia/ }));
  await selectAssignedProfessional(container);
  fireEvent.change(container.querySelector('select[name="service_id"]'), {
    target: { value: "40" },
  });
  fireEvent.change(container.querySelector('input[type="date"]'), {
    target: { value: date },
  });
  const hourSelect = Array.from(container.querySelectorAll("select"))
    .find((select) => Array.from(select.options).some((option) => option.value === hour));
  fireEvent.change(hourSelect, { target: { value: hour } });
  fireEvent.click(screen.getByRole("button", { name: "Revisar agendamento" }));
};

const openCreationForm = async () => {
  await screen.findByText("Paciente Teste");
  fireEvent.click(screen.getByRole("button", { name: "Novo agendamento" }));
  return (await screen.findByPlaceholderText("Buscar paciente")).closest("form");
};
const selectCreationPatient = async (name = "Paciente Teste") => {
  fireEvent.change(screen.getByPlaceholderText("Buscar paciente"), { target: { value: name } });
  const matches = await screen.findAllByText(name);
  fireEvent.click(matches.find((element) => element.tagName === "BUTTON"));
};
const ownRights = [{ id: 701, quantity: 4, free_rights: 3, review_token: "own-review",
  service: { id: 41, code: "physio", name: "Fisioterapia" } },
{ id: 702, quantity: 2, free_rights: 2, review_token: "other-review",
  service: { id: 40, code: "spine_eval", name: "Avaliacao Coluna" } }];

const openNewRecurringReview = async (container, {
  count = "2",
  date = "2026-07-06",
  hour = "10",
} = {}) => {
  await screen.findByText("Paciente Teste");
  fireEvent.click(screen.getByRole("button", { name: "Novo agendamento" }));
  fireEvent.change(await screen.findByPlaceholderText("Buscar paciente"), {
    target: { value: "Paciente Teste" },
  });
  const patientSuggestions = await screen.findAllByText("Paciente Teste");
  fireEvent.click(patientSuggestions.find((element) => element.tagName === "BUTTON"));
  await selectAssignedProfessional(container);
  fireEvent.change(container.querySelector('select[name="service_id"]'), {
    target: { value: "40" },
  });
  fireEvent.change(container.querySelector('input[name="session_price"]'), {
    target: { value: "100,00" },
  });
  fireEvent.change(container.querySelector('input[type="date"]'), {
    target: { value: date },
  });
  const hourSelect = Array.from(container.querySelectorAll("select"))
    .find((select) => Array.from(select.options).some((option) => option.value === hour));
  fireEvent.change(hourSelect, { target: { value: hour } });
  fireEvent.click(screen.getByRole("button", { name: "+ Adicionar" }));
  fireEvent.change(screen.getByPlaceholderText("Ex.: 10"), {
    target: { value: count },
  });
  fireEvent.click(screen.getByRole("button", { name: "Revisar agendamento" }));
};

const openPackageShareReview = async (container) => {
  await screen.findByText("Paciente Teste");
  fireEvent.click(screen.getByRole("button", { name: "Novo agendamento" }));
  fireEvent.change(await screen.findByPlaceholderText("Buscar paciente"), {
    target: { value: "Paciente Teste" },
  });
  const patientSuggestions = await screen.findAllByText("Paciente Teste");
  fireEvent.click(patientSuggestions.find((element) => element.tagName === "BUTTON"));
  await selectAssignedProfessional(container);
  fireEvent.click(screen.getByLabelText("Usar pacote de outro paciente"));
  const ownerInput = (await screen.findAllByPlaceholderText("Buscar paciente"))[1];
  fireEvent.change(ownerInput, { target: { value: "Maurício" } });
  fireEvent.click(await screen.findByRole("button", { name: /Maurício Titular/ }));
  fireEvent.change(container.querySelector('select[name="service_id"]'), {
    target: { value: "41" },
  });
  fireEvent.change(container.querySelector('input[type="date"]'), {
    target: { value: "2026-10-20" },
  });
  const hourSelect = Array.from(container.querySelectorAll("select"))
    .find((select) => Array.from(select.options).some((option) => option.value === "10"));
  fireEvent.change(hourSelect, { target: { value: "10" } });
  fireEvent.click(screen.getByRole("button", { name: "Revisar agendamento" }));
  await screen.findByText("Qual pacote vamos usar?");
};

const openScheduledSessionEdit = async (container) => {
  expect(await screen.findByText("Paciente Teste")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Dia" }));
  const scheduledCard = await waitFor(() => {
    const element = container.querySelector('[data-id="10"]');
    expect(element).toBeTruthy();
    return element;
  });
  fireEvent.click(scheduledCard.querySelector("button[aria-label]"));
  fireEvent.click(await screen.findByRole("button", { name: "Editar agendamento" }));
  await screen.findByText("Motivo da alteração");
};

describe("Agendamentos - editar agendamento", () => {
  let sessionsMockData;

  beforeEach(() => {
    controlledFakeTimersEnabled = false;
    agendaTestNow = DEFAULT_AGENDA_TEST_NOW;
    global.Date = FixedAgendaDate;
    jest.clearAllMocks();
    getUserFacingApiError.mockImplementation((error, fallback) => fallback);
    sanitizeUserFacingErrorMessage.mockImplementation((message, fallback) => message || fallback);
    sessionsMockData = [baseSession, canceledSession, noShowSession];
    mockProfessionalAssigned = true;
    mockAuthorization = {
      status: "ready",
      context: {
        catalog_version: 8,
        is_administrator: true,
        authorization_source: "membership",
      },
      hasCapability: jest.fn(() => true),
    };

    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: jest.fn().mockImplementation((query) => ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        addListener: jest.fn(),
        removeListener: jest.fn(),
        dispatchEvent: jest.fn(),
      })),
    });

    axios.get.mockImplementation((url, config = {}) => {
      if (url === "/schedule/references/patients") {
        return Promise.resolve({
          data: [
            { id: 20, full_name: "Paciente Teste" },
            { id: 21, full_name: "Paciente Cancelado" },
            { id: 22, full_name: "Paciente Falta" },
            { id: 23, full_name: "Paciente Concluido" },
            { id: 24, full_name: "Paciente Suspenso" },
            { id: 25, full_name: "Paciente Com Plano" },
            { id: 26, full_name: "Paciente Sem Vinculo" },
            { id: 88, full_name: "Maurício Titular" },
          ],
        });
      }
      if (url === "/schedule/references/professionals") {
        return Promise.resolve({
          data: [
            {
              id: 30,
              name: "Profissional Teste",
              clinic_professional_id: 300,
              is_assigned: config?.params?.patient_id ? mockProfessionalAssigned : null,
            },
            {
              id: 31,
              name: "Profissional Alternativo",
              clinic_professional_id: 301,
              is_assigned: config?.params?.patient_id ? mockProfessionalAssigned : null,
              credential_status: "pending",
              professional_verification_status: "pending",
            },
          ],
        });
      }
      if (url === "/service-limits") {
        return Promise.resolve({ data: [] });
      }
      if (url === "/session-statuses") {
        return Promise.resolve({ data: [] });
      }
      if (url === "/services") {
        return Promise.resolve({
          data: [
            { id: 40, code: "spine_eval", name: "Avaliacao Coluna", is_active: true },
            { id: 41, code: "physio", name: "Fisioterapia", is_active: true },
          ],
        });
      }
      if (url === "/schedule/references/service-prices") {
        return Promise.resolve({
          data: [
            { id: 100, service_id: 40, price_cents: 12000, currency: "BRL", is_active: true },
            { id: 101, service_id: 41, price_cents: 9000, currency: "BRL", is_active: true },
          ],
        });
      }
      if (url === "/schedule/references/patient-service-agreements") {
        return Promise.resolve({ data: [] });
      }
      if (url === "/unit-scheduling-policy") {
        return Promise.resolve({
          data: {
            late_change_minimum_notice_hours: 24,
            monthly_reschedule_limit: 2,
            monthly_absence_limit: 2,
            replacement_credit_validity_days: 30,
            replacement_credit_expiring_alert_days: 7,
          },
        });
      }
      if (url === "/sessions") {
        if (config?.params?.status === "scheduled") {
          return Promise.resolve({ data: [] });
        }
        return Promise.resolve({ data: sessionsMockData });
      }
      if (url === "/session-replacement-credits") {
        return Promise.resolve({ data: [] });
      }
      if (url === "/operational-alerts") {
        return Promise.resolve({ data: [] });
      }
      if (String(url).includes("/package-scope-update-preview")) {
        return Promise.resolve({ data: { candidates: [] } });
      }
      return Promise.resolve({ data: [] });
    });

    axios.put.mockResolvedValue({
      data: {
        ...baseSession,
        starts_at: "2026-06-29T10:00:00",
        ends_at: "2026-06-29T11:00:00",
      },
    });
    axios.post.mockResolvedValue({ data: {} });
    axios.patch.mockResolvedValue({ data: {} });

	  checkSchedulingAvailability.mockResolvedValue(buildSingleAvailabilityResponse());
    listSpecialSchedulingEvents.mockResolvedValue({ data: [] });
	  previewSchedulingOccurrences.mockResolvedValue({
	    data: {
	      occurrences_preview: [],
	      summary: buildPreviewSummary({ total: 0, available: 0, warn: 0, blocked: 0 }),
	      validation: buildAvailabilityValidation(),
	    },
	  });
    listPatientPlans.mockResolvedValue({
      data: [{
        id: 1,
        starts_at: "2026-01-01",
        ends_at: null,
        ServicePlan: {
          service_id: 40,
          name: "Plano Fisioterapia",
          sessions_per_week: 2,
        },
      }],
    });
    getCoveragePreview.mockResolvedValue({ data: null });
  });

  it("carrega somente referencias reduzidas de pacientes e profissionais", async () => {
    renderAgendamentos();
    await waitFor(() => expect(axios.get).toHaveBeenCalledWith(
      "/schedule/references/patients",
    ));
    expect(axios.get).toHaveBeenCalledWith("/schedule/references/professionals");
    expect(axios.get.mock.calls.some(([url]) => url === "/patients")).toBe(false);
    expect(axios.get.mock.calls.some(([url]) => url === "/users")).toBe(false);
  });

  it("mantem Paciente somente leitura em sessao comum", async () => {
    const { container } = renderAgendamentos();
    await openScheduledSessionEdit(container);
    expect(screen.queryByRole("searchbox", { name: "Paciente" }))
      .not.toBeInTheDocument();
    expect(screen.getAllByText("Paciente Teste").length).toBeGreaterThan(0);
  });

  it("renderiza a Agenda dentro do App Shell", async () => {
    renderAgendamentos();

    expect(screen.getByTestId("app-shell")).toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: "Agendamentos" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Configurações da agenda" }))
      .not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Central de pendências/ }))
      .not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Novo agendamento" })).toBeInTheDocument();
  });

  it("não reutiliza requisições da clínica anterior ao remontar durante carregamento", async () => {
    const defaultGet = axios.get.getMockImplementation();
    let resolveOldPatients;
    let resolveOldSessions;
    let resolveOldSpecialEvents;
    let patientCalls = 0;
    let sessionCalls = 0;
    let specialEventCalls = 0;
    axios.get.mockImplementation((url, config) => {
      if (url === "/schedule/references/patients") {
        patientCalls += 1;
        if (patientCalls === 1) {
          return new Promise((resolve) => { resolveOldPatients = resolve; });
        }
        return Promise.resolve({ data: [{ id: 120, full_name: "Paciente Clínica B" }] });
      }
      if (url === "/sessions") {
        sessionCalls += 1;
        if (sessionCalls === 1) {
          return new Promise((resolve) => { resolveOldSessions = resolve; });
        }
        return Promise.resolve({
          data: [{
            ...baseSession,
            id: 210,
            patient_id: 120,
            Patient: { id: 120, full_name: "Paciente Clínica B" },
          }],
        });
      }
      return defaultGet(url, config);
    });
    listSpecialSchedulingEvents.mockImplementation(() => {
      specialEventCalls += 1;
      if (specialEventCalls === 1) {
        return new Promise((resolve) => { resolveOldSpecialEvents = resolve; });
      }
      return Promise.resolve({ data: [] });
    });

    const clinicA = renderAgendamentos();
    await waitFor(() => {
      expect(patientCalls).toBe(1);
      expect(sessionCalls).toBe(1);
      expect(specialEventCalls).toBe(1);
    });
    clinicA.unmount();

    renderAgendamentos();
    await waitFor(() => {
      expect(patientCalls).toBe(2);
      expect(sessionCalls).toBe(2);
      expect(specialEventCalls).toBe(2);
    });
    await act(async () => {
      resolveOldPatients({ data: [{ id: 20, full_name: "Paciente Clínica A" }] });
      resolveOldSessions({
        data: [{
          ...baseSession,
          Patient: { id: 20, full_name: "Paciente Clínica A" },
        }],
      });
      resolveOldSpecialEvents({ data: [{ id: 1, name: "Evento Clínica A" }] });
    });

    expect(screen.queryByText("Paciente Clínica A")).not.toBeInTheDocument();
  });

  it("abre a visão Dia na data recebida pela navegação de revisão do feriado", async () => {
    renderAgendamentos("/agendamentos?date=2035-04-04&view=day");

    expect(await screen.findByRole("heading", { name: "04/04/2035" }))
      .toBeInTheDocument();
    await waitFor(() => expect(listSpecialSchedulingEvents).toHaveBeenCalledWith(
      expect.objectContaining({
        from: "2035-04-04",
        to: "2035-04-04",
      }),
    ));
    await waitFor(() => expect(axios.get).toHaveBeenCalledWith(
      "/sessions",
      { params: { from: "2035-04-04", to: "2035-04-05" } },
    ));
  });

  it("agrupa no dia civil da Agenda uma sessão próxima da meia-noite UTC", async () => {
    sessionsMockData = [{
      ...baseSession,
      id: 111,
      patient_id: 77,
      Patient: { id: 77, full_name: "Paciente Limite" },
      starts_at: "2026-06-30T02:00:00.000Z",
      ends_at: "2026-06-30T03:00:00.000Z",
    }];

    renderAgendamentos("/agendamentos?date=2026-06-29&view=day");

    expect(await screen.findByText("Paciente Limite")).toBeInTheDocument();
    expect(screen.getByText("23:00")).toBeInTheDocument();
  });

  it("consulta o mês civil com início inclusivo e fim exclusivo", async () => {
    renderAgendamentos("/agendamentos?date=2026-06-01&view=month");

    await waitFor(() => expect(axios.get).toHaveBeenCalledWith(
      "/sessions",
      { params: { from: "2026-06-01", to: "2026-07-01" } },
    ));
  });

  it("consome o pedido global de agendar reposição no formulário existente", async () => {
    const defaultGet = axios.get.getMockImplementation();
    axios.get.mockImplementation((url, config) => {
      if (url === "/session-replacement-credits") {
        return Promise.resolve({
          data: [{
            id: 901,
            patient_id: 20,
            patient_name: "Paciente Teste",
            expires_at: "2026-07-30",
            source_service_id: 40,
            source_service_type: "spine_eval",
            source_service_name: "Avaliação Coluna",
            source_billing_mode: "per_session",
          }],
        });
      }
      return defaultGet(url, config);
    });

    renderAgendamentos({
      pathname: "/agendamentos",
      state: {
        [PENDING_CENTER_ACTION_STATE_KEY]: {
          type: "schedule-replacement",
          alert: {
            type: "replacement_credit_pending",
            patient_id: 20,
            patient_name: "Paciente Teste",
            title: "Reposição pendente",
            due_date: "2026-07-30",
            details: {
              replacement_credit_id: 901,
              source_service_id: 40,
              source_service_type: "spine_eval",
              source_service_name: "Avaliação Coluna",
              source_billing_mode: "per_session",
            },
          },
        },
      },
    });

    expect(await screen.findByRole("heading", { name: "Novo agendamento" }))
      .toBeInTheDocument();
    expect(screen.getByText("Reposição selecionada. Sem nova cobrança."))
      .toBeInTheDocument();
  });

  it("omite Mensal da frequência do plano na visão semanal", async () => {
    sessionsMockData = [{
      ...baseSession,
      billing_mode: "covered_by_plan",
      BillingCycle: {
        ServicePlan: { sessions_per_week: 2 },
      },
    }];

    renderAgendamentos();

    expect(await screen.findByText("2x")).toBeInTheDocument();
    expect(screen.queryByText("Mensal 2x")).not.toBeInTheDocument();
  });

  it("mostra mensagem curta e mantem bloqueada a exclusao com impacto financeiro", async () => {
    axios.post.mockResolvedValueOnce({
      data: {
        candidates: [{
          ...baseSession,
          can_delete: false,
          blocked_reason: "Este agendamento já possui impacto financeiro ou operacional. Use Cancelar, Estornar ou ajuste financeiro apropriado.",
        }],
      },
    });
    const { container } = renderAgendamentos();

    expect(await screen.findByText("Paciente Teste")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Dia" }));
    const scheduledCard = await waitFor(() => {
      const element = container.querySelector('[data-id="10"]');
      expect(element).toBeTruthy();
      return element;
    });
    fireEvent.click(scheduledCard.querySelector("button[aria-label]"));
    fireEvent.click(await screen.findByRole("button", { name: "Remover da agenda" }));
    fireEvent.click(await screen.findByRole("button", { name: "Apenas este agendamento" }));

    expect(await screen.findByRole("heading", { name: "Revisar exclusão" }))
      .toBeInTheDocument();
    expect(screen.getByText("Agendamento com impacto no Financeiro."))
      .toBeInTheDocument();
    expect(screen.queryByText(/Use Cancelar, Estornar/i)).not.toBeInTheDocument();
    expect(screen.getByText("0 de 0 selecionados")).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Selecionar todos" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Excluir selecionados" })).toBeDisabled();
  });

  afterEach(() => {
    cleanup();
    if (controlledFakeTimersEnabled) {
      jest.clearAllTimers();
      jest.useRealTimers();
    }
    global.Date = NativeDate;
  });

  it("usa uma unica remarcacao formal ao editar horario", async () => {
    sessionsMockData = [absoluteBaseSession, canceledSession, noShowSession];
    const { container } = renderAgendamentos();
    await openScheduledSessionEdit(container);
    const hourSelect = Array.from(container.querySelectorAll("select"))
      .find((select) => Array.from(select.options).some((option) => option.value === "10"));
    expect(hourSelect).toBeTruthy();
    fireEvent.change(hourSelect, { target: { value: "10" } });
    fireEvent.change(container.querySelector('textarea[name="notes"]'), {
      target: { value: "ajuste administrativo" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() => expect(axios.post).toHaveBeenCalledWith(
      "/sessions",
      expect.objectContaining({
        starts_at: "2026-06-29T13:00:00.000Z",
        ends_at: "2026-06-29T14:00:00.000Z",
        notes: "ajuste administrativo",
        status: "scheduled",
        rescheduled_from_id: 10,
      }),
    ));
    const payload = axios.post.mock.calls.find(([url]) => url === "/sessions")[1];
    expect(payload).not.toHaveProperty("is_initial");
    expect(payload).not.toHaveProperty("patient_credit_id");
    expect(payload).not.toHaveProperty("billing_mode");
    expect(payload).not.toHaveProperty("is_no_charge");
    expect(axios.put).not.toHaveBeenCalled();
    expect(axios.post.mock.calls.filter(([url]) => url === "/sessions")).toHaveLength(1);
  });

  it("reconhece alterar e voltar ao horario original como edicao nao temporal", async () => {
    sessionsMockData = [absoluteBaseSession, canceledSession, noShowSession];
    const { container } = renderAgendamentos();
    await openScheduledSessionEdit(container);
    const hourSelect = Array.from(container.querySelectorAll("select"))
      .find((select) => Array.from(select.options).some((option) => option.value === "10"));

    expect(hourSelect).toHaveValue("07");
    fireEvent.change(hourSelect, { target: { value: "10" } });
    expect(screen.getByLabelText("Tem justificativa")).toBeInTheDocument();
    fireEvent.change(hourSelect, { target: { value: "07" } });
    expect(screen.queryByLabelText("Tem justificativa")).not.toBeInTheDocument();
    fireEvent.change(container.querySelector('textarea[name="notes"]'), {
      target: { value: "horário original restaurado" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() => expect(axios.put).toHaveBeenCalledWith(
      "/sessions/10",
      expect.objectContaining({
        starts_at: absoluteBaseSession.starts_at,
        ends_at: absoluteBaseSession.ends_at,
      }),
    ));
    expect(axios.post.mock.calls.filter(([url]) => url === "/sessions")).toHaveLength(0);
  });

  it("mantem PUT quando somente a observacao muda", async () => {
    sessionsMockData = [absoluteBaseSession, canceledSession, noShowSession];
    const { container } = renderAgendamentos();
    await openScheduledSessionEdit(container);
    fireEvent.change(container.querySelector('textarea[name="notes"]'), {
      target: { value: "observacao sem mudanca temporal" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() => expect(axios.put).toHaveBeenCalledWith(
      "/sessions/10",
      expect.objectContaining({
        starts_at: absoluteBaseSession.starts_at,
        ends_at: absoluteBaseSession.ends_at,
        notes: "observacao sem mudanca temporal",
      }),
    ));
    const payload = axios.put.mock.calls.find(([url]) => url === "/sessions/10")[1];
    expect(payload).not.toHaveProperty("is_initial");
    expect(payload).not.toHaveProperty("patient_credit_id");
    expect(payload).not.toHaveProperty("billing_mode");
    expect(payload).not.toHaveProperty("is_no_charge");
    expect(axios.post.mock.calls.filter(([url]) => url === "/sessions")).toHaveLength(0);
  });

  it("preserva o formato legacy dos campos internos na edicao", async () => {
    mockAuthorization = {
      ...mockAuthorization,
      context: { ...mockAuthorization.context, authorization_source: "legacy" },
    };
    sessionsMockData = [{
      ...baseSession,
      is_initial: true,
      patient_credit_id: 501,
      is_no_charge: true,
    }];
    const { container } = renderAgendamentos();
    await openScheduledSessionEdit(container);
    fireEvent.change(container.querySelector('textarea[name="notes"]'), {
      target: { value: "edicao legacy" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() => expect(axios.put).toHaveBeenCalled());
    const payload = axios.put.mock.calls.find(([url]) => url === "/sessions/10")[1];
    expect(payload).toEqual(expect.objectContaining({
      is_initial: true,
      patient_credit_id: 501,
      is_no_charge: false,
    }));
  });

  it("mantem PUT quando somente o profissional muda", async () => {
    sessionsMockData = [absoluteBaseSession, canceledSession, noShowSession];
    const { container } = renderAgendamentos();
    await openScheduledSessionEdit(container);
    fireEvent.change(container.querySelector('select[name="professional_user_id"]'), {
      target: { value: "31" },
    });
    fireEvent.change(container.querySelector('textarea[name="notes"]'), {
      target: { value: "troca de profissional" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() => expect(axios.put).toHaveBeenCalledWith(
      "/sessions/10",
      expect.objectContaining({
        professional_user_id: 31,
        starts_at: absoluteBaseSession.starts_at,
        ends_at: absoluteBaseSession.ends_at,
      }),
    ));
    expect(axios.post.mock.calls.filter(([url]) => url === "/sessions")).toHaveLength(0);
  });

  it("combina horario profissional e observacao em uma unica remarcacao", async () => {
    sessionsMockData = [absoluteBaseSession, canceledSession, noShowSession];
    const { container } = renderAgendamentos();
    await openScheduledSessionEdit(container);
    const hourSelect = Array.from(container.querySelectorAll("select"))
      .find((select) => Array.from(select.options).some((option) => option.value === "10"));
    fireEvent.change(hourSelect, { target: { value: "10" } });
    fireEvent.change(container.querySelector('select[name="professional_user_id"]'), {
      target: { value: "31" },
    });
    fireEvent.change(container.querySelector('textarea[name="notes"]'), {
      target: { value: "excecao com outro profissional" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() => expect(axios.post).toHaveBeenCalledWith(
      "/sessions",
      expect.objectContaining({
        starts_at: "2026-06-29T13:00:00.000Z",
        ends_at: "2026-06-29T14:00:00.000Z",
        professional_user_id: 31,
        notes: "excecao com outro profissional",
        rescheduled_from_id: 10,
      }),
    ));
    const payload = axios.post.mock.calls.find(([url]) => url === "/sessions")[1];
    expect(payload).not.toHaveProperty("is_initial");
    expect(payload).not.toHaveProperty("patient_credit_id");
    expect(payload).not.toHaveProperty("billing_mode");
    expect(axios.post.mock.calls.filter(([url]) => url === "/sessions")).toHaveLength(1);
    expect(axios.put).not.toHaveBeenCalled();
  });

  it("mostra o erro funcional retornado pela remarcacao", async () => {
    const apiError = new Error("reschedule rejected");
    apiError.response = { data: { error: "Limite mensal de remarcações atingido." } };
    axios.post.mockImplementation((url) => (
      url === "/sessions" ? Promise.reject(apiError) : Promise.resolve({ data: {} })
    ));
    const { container } = renderAgendamentos();
    await openScheduledSessionEdit(container);
    const hourSelect = Array.from(container.querySelectorAll("select"))
      .find((select) => Array.from(select.options).some((option) => option.value === "10"));
    fireEvent.change(hourSelect, { target: { value: "10" } });
    fireEvent.change(container.querySelector('textarea[name="notes"]'), {
      target: { value: "tentativa bloqueada" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(
      "Limite mensal de remarcações atingido.",
    ));
    expect(axios.put).not.toHaveBeenCalled();
  });

  it("mantem drag-and-drop na mesma semantica formal de remarcacao", async () => {
    const { container } = renderAgendamentos();
    expect(await screen.findByText("Paciente Teste")).toBeInTheDocument();
    const source = await waitFor(() => {
      const element = container.querySelector('[data-id="10"][draggable="true"]');
      expect(element).toBeTruthy();
      return element;
    });
    const target = await screen.findByTestId("week-slot-2026-06-29-10");
    const transferData = {};
    const dataTransfer = {
      effectAllowed: "",
      dropEffect: "",
      setData: jest.fn((type, value) => { transferData[type] = value; }),
      getData: jest.fn((type) => transferData[type] || ""),
    };

    fireEvent.dragStart(source, { dataTransfer });
    fireEvent.drop(target, { dataTransfer });

    await waitFor(() => expect(axios.post).toHaveBeenCalledWith(
      "/sessions",
      expect.objectContaining({
        starts_at: "2026-06-29T13:00:00.000Z",
        ends_at: "2026-06-29T14:00:00.000Z",
        rescheduled_from_id: 10,
      }),
    ));
    const payload = axios.post.mock.calls.find(([url]) => url === "/sessions")[1];
    expect(payload).not.toHaveProperty("billing_mode");
    expect(axios.put).not.toHaveBeenCalled();
  });

  it("mostra cancelados e faltas na visao Dia apenas quando a opcao esta ativa", async () => {
    renderAgendamentos();

    expect(await screen.findByText("Paciente Teste")).toBeInTheDocument();
    expect(screen.queryByLabelText("Mostrar cancelados e faltas")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Dia" }));

    const historyToggle = await screen.findByLabelText("Mostrar cancelados e faltas");
    expect(historyToggle).not.toBeChecked();
    expect(screen.getByText("Paciente Teste")).toBeInTheDocument();
    expect(screen.queryByText("Paciente Cancelado")).not.toBeInTheDocument();
    expect(screen.queryByText("Paciente Falta")).not.toBeInTheDocument();

    fireEvent.click(historyToggle);

    expect(await screen.findByText("Paciente Cancelado")).toBeInTheDocument();
    expect(screen.getByText("Paciente Falta")).toBeInTheDocument();

    fireEvent.click(historyToggle);

    expect(screen.queryByText("Paciente Cancelado")).not.toBeInTheDocument();
    expect(screen.queryByText("Paciente Falta")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Semana" }));
    expect(screen.queryByLabelText("Mostrar cancelados e faltas")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /M.s/ }));
    expect(screen.queryByLabelText("Mostrar cancelados e faltas")).not.toBeInTheDocument();
  });

  it("mostra Editar agendamento apenas para sessoes agendadas", async () => {
    sessionsMockData = [
      baseSession,
      canceledSession,
      noShowSession,
      doneSession,
      suspendedSession,
    ];

    const { container } = renderAgendamentos();

    expect(await screen.findByText("Paciente Teste")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Dia" }));
    fireEvent.click(await screen.findByLabelText("Mostrar cancelados e faltas"));

    const openActionsForSession = async (sessionId) => {
      const card = await waitFor(() => {
        const element = container.querySelector(`[data-id="${sessionId}"]`);
        expect(element).toBeTruthy();
        return element;
      });
      const actionsButton = card.querySelector("button[aria-label]");
      expect(actionsButton).toBeTruthy();
      fireEvent.click(actionsButton);
    };

    await openActionsForSession(10);
    expect(await screen.findByRole("button", { name: "Editar agendamento" })).toBeInTheDocument();
    await openActionsForSession(10);

    await openActionsForSession(13);
    expect(screen.queryByRole("button", { name: "Editar agendamento" })).not.toBeInTheDocument();

    await openActionsForSession(11);
    expect(screen.queryByRole("button", { name: "Editar agendamento" })).not.toBeInTheDocument();

    await openActionsForSession(12);
    expect(screen.queryByRole("button", { name: "Editar agendamento" })).not.toBeInTheDocument();

    await openActionsForSession(14);
    expect(screen.queryByRole("button", { name: "Editar agendamento" })).not.toBeInTheDocument();
  });

  it("mostra acao unica de cancelamento/falta no menu de status", async () => {
    const { container } = renderAgendamentos();

    expect(await screen.findByText("Paciente Teste")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Dia" }));
    const scheduledCard = await waitFor(() => {
      const element = container.querySelector('[data-id="10"]');
      expect(element).toBeTruthy();
      return element;
    });
    const statusButton = Array.from(scheduledCard.querySelectorAll("button"))
      .find((button) => button.textContent.includes("Agendado"));
    expect(statusButton).toBeTruthy();
    fireEvent.click(statusButton);

    expect(await screen.findByRole("button", { name: "Concluir" })).toBeInTheDocument();
    expect(scheduledCard.textContent).toContain("Cancelamento/falta");
    expect(scheduledCard.textContent).not.toContain("Marcar falta");
    expect(scheduledCard.textContent).not.toContain("Cancelar");
  });

  it("registra cancelamento pelo fluxo unificado e restringe reposicao ao cancelamento", async () => {
    axios.put.mockResolvedValueOnce({
      data: {
        ...baseSession,
        status: "canceled",
        absence_reason: "Paciente avisou",
      },
    });
    const { container } = renderAgendamentos();

    expect(await screen.findByText("Paciente Teste")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Dia" }));
    const scheduledCard = await waitFor(() => {
      const element = container.querySelector('[data-id="10"]');
      expect(element).toBeTruthy();
      return element;
    });
    const statusButton = Array.from(scheduledCard.querySelectorAll("button"))
      .find((button) => button.textContent.includes("Agendado"));
    fireEvent.click(statusButton);
    fireEvent.click(await screen.findByRole("button", { name: "Cancelamento/falta" }));

    const modal = await screen.findByRole("heading", { name: "Cancelamento/falta" });
    expect(modal).toBeInTheDocument();
    expect(screen.getByText("O que aconteceu?")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Cancelamento/i })).toBeInTheDocument();
    expect(screen.getByText("Não conta falta.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Falta/i })).toBeInTheDocument();
    expect(screen.getByText("Conta falta.")).toBeInTheDocument();
    expect(screen.getByText("Menos de 24h. Sem justificativa vira falta.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Voltar" })).toBeInTheDocument();
    expect(screen.queryByText("Gerar reposição")).not.toBeInTheDocument();

    fireEvent.click(screen.getByText("Tem justificativa"));
    expect(screen.getByText("Gerar reposição")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Gerar reposição"));

    fireEvent.change(screen.getByPlaceholderText("Descreva o motivo"), {
      target: { value: "Paciente avisou" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Confirmar cancelamento" }));

    await waitFor(() => expect(axios.put).toHaveBeenCalledWith(
      "/sessions/10",
      expect.objectContaining({
        status: "canceled",
        absence_reason: "Paciente avisou",
        late_policy_exception_justified: true,
        late_policy_exception_reason: "Paciente avisou",
        generate_replacement_credit: true,
        replacement_credit_reason: "Paciente avisou",
      }),
    ));
    expect(toast.warning).not.toHaveBeenCalled();
  });

  it("avisa quando o backend preserva financeiro de sessao avulsa cancelada", async () => {
    axios.put.mockResolvedValueOnce({
      data: {
        ...baseSession,
        status: "canceled",
        absence_reason: "Paciente avisou",
        financial_regularization_pending: {
          required: true,
          code: "FIN-010",
          message: "Financeiro preservado; nenhuma devolução, crédito ou estorno foi realizado.",
        },
      },
    });
    const { container } = renderAgendamentos();

    expect(await screen.findByText("Paciente Teste")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Dia" }));
    const scheduledCard = await waitFor(() => {
      const element = container.querySelector('[data-id="10"]');
      expect(element).toBeTruthy();
      return element;
    });
    const statusButton = Array.from(scheduledCard.querySelectorAll("button"))
      .find((button) => button.textContent.includes("Agendado"));
    fireEvent.click(statusButton);
    fireEvent.click(await screen.findByRole("button", { name: "Cancelamento/falta" }));
    await screen.findByRole("heading", { name: "Cancelamento/falta" });
    fireEvent.change(screen.getByPlaceholderText("Descreva o motivo"), {
      target: { value: "Paciente avisou" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Confirmar cancelamento" }));

    await waitFor(() => expect(toast.warning).toHaveBeenCalledWith(
      "Sessão cancelada. Acerto financeiro pendente.",
    ));
    expect(toast.warning).toHaveBeenCalledTimes(1);
    expect(toast.success).not.toHaveBeenCalled();
    expect(toast.warning.mock.calls.flat().join(" ")).not.toMatch(/crédito gerado|estorno automático concluído/i);
  });

  const financialPreview = (release = 10000, extra = {}) => ({
    eligible: true, preview_fingerprint: "server-preview", blockers: [],
    patient: { id: 20, name: "Paciente Teste" },
    session: { id: 10, patient_id: 20, starts_at: baseSession.starts_at },
    entry: { id: 90, amount_cents: 10000, paid_cents: release, open_cents: 10000 - release },
    package: { series_id: 1, amount_before_cents: 40000, amount_after_cents: 30000 },
    release_amount_cents: release, credit_after_cents: release,
    consequences: { replacement_created: false, money_refunded: false },
    affected_sessions: [{ id: 10, starts_at: baseSession.starts_at }],
    requires_late_policy_exception: false,
    ...extra,
  });
  const openFinancialAbsence = async ({ finance = true, fillReason = true, justify = true } = {}) => {
    mockAuthorization.canAccessModule = jest.fn((module) => module !== "finance" || finance);
    const rendered = renderAgendamentos();
    await screen.findByText("Paciente Teste");
    fireEvent.click(screen.getByRole("button", { name: "Dia" }));
    const card = await waitFor(() => {
      const element = rendered.container.querySelector('[data-id="10"]');
      expect(element).toBeTruthy();
      return element;
    });
    fireEvent.click(Array.from(card.querySelectorAll("button")).find((button) => button.textContent.includes("Agendado")));
    fireEvent.click(await screen.findByRole("button", { name: "Cancelamento/falta" }));
    await screen.findByRole("heading", { name: "Cancelamento/falta" });
    enableControlledFakeTimers();
    if (justify) fireEvent.click(screen.getByText("Tem justificativa"));
    if (fillReason) fireEvent.change(screen.getByPlaceholderText("Descreva o motivo"), { target: { value: "Pedido definitivo" } });
    return rendered;
  };
  const confirmCancellationButton = () => screen.getByRole("button", { name: "Confirmar cancelamento" });
  const flushFinancialPreviewDebounce = async () => {
    await act(async () => {
      jest.advanceTimersByTime(250);
      await Promise.resolve();
    });
  };
  const readyToConfirmCancellation = async () => {
    await flushFinancialPreviewDebounce();
    await waitFor(() => expect(confirmCancellationButton()).toBeEnabled());
    return confirmCancellationButton();
  };
  const cancellationCalls = (suffix) => axios.post.mock.calls.filter(([url]) => url.endsWith(suffix));
  const apiFailure = (status, code) => Object.assign(new Error(code), { response: { status, data: { code } } });

  it.each([5000, 10000])("prepara pagamento de %s centavos automaticamente e um clique confirma só a operação conjunta", async (paid) => {
    axios.post.mockImplementation((url) => Promise.resolve({ data: url.endsWith("cancellation-preview")
      ? financialPreview(paid) : { id: 2, entry_id: 90, patient_id: 20 } }));
    await openFinancialAbsence();
    expect(screen.getAllByRole("button", { name: "Confirmar cancelamento" })).toHaveLength(1);
    expect(confirmCancellationButton()).toBeDisabled();
    expect(screen.getByText("O que aconteceu?")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Descreva o motivo")).toHaveValue("Pedido definitivo");
    expect(screen.getByText("Tem justificativa")).toBeInTheDocument();
    expect(screen.getByText("Gerar reposição")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Conferir cancelamento" })).not.toBeInTheDocument();
    await readyToConfirmCancellation();
    expect(cancellationCalls("cancellation-preview")).toHaveLength(1);
    expect(cancellationCalls("cancel-with-credit")).toHaveLength(0);
    expect(screen.queryByLabelText("Prévia do cancelamento")).not.toBeInTheDocument();
    expect(screen.queryByText(/O pacote passará|ficarão como crédito|Cobrança #/)).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Cancelamento/falta" }).parentElement.parentElement).not.toHaveTextContent(/R\$/);
    expect(screen.getByText("O que aconteceu?")).toBeInTheDocument();
    expect(axios.put).not.toHaveBeenCalled();
    fireEvent.click(confirmCancellationButton());
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Sessão cancelada."));
    expect(toast.success).toHaveBeenCalledTimes(1);
    expect(toast.warning).not.toHaveBeenCalled();
    expect(axios.post).toHaveBeenCalledWith("/sessions/10/cancel-with-credit", {
      reason: "Pedido definitivo", preview_fingerprint: "server-preview",
      late_policy_exception_justified: true, late_policy_exception_reason: "Pedido definitivo",
    }, { headers: { "Idempotency-Key": expect.any(String) } });
    expect(cancellationCalls("cancel-with-credit")).toHaveLength(1);
    expect(axios.put).not.toHaveBeenCalled();
  });

  it("valida separadamente atendido e titular financeiro ao cancelar sessão compartilhada", async () => {
    sessionsMockData = [{
      ...packageSession,
      patient_id: 20,
      Patient: { id: 20, full_name: "Paciente Teste" },
      PackageUnit: {
        ...packageSession.PackageUnit,
        Package: {
          ...packageSession.PackageUnit.Package,
          patient_id: 88,
          Patient: { id: 88, full_name: "Maurício Titular" },
        },
      },
    }];
    axios.post.mockImplementation((url) => Promise.resolve({
      data: url.endsWith("cancellation-preview")
        ? financialPreview(10000, {
          patient: { id: 88, name: "Maurício Titular" },
          session: { id: 10, patient_id: 20, starts_at: baseSession.starts_at },
        })
        : { id: 2, entry_id: 90, patient_id: 88 },
    }));

    await openFinancialAbsence();
    await readyToConfirmCancellation();
    fireEvent.click(confirmCancellationButton());

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Sessão cancelada."));
    expect(cancellationCalls("cancellation-preview")).toHaveLength(1);
    expect(cancellationCalls("cancel-with-credit")).toHaveLength(1);
    expect(axios.put).not.toHaveBeenCalled();
  });

  it("aguarda motivo válido e agrupa digitação antes da prévia automática", async () => {
    axios.post.mockResolvedValue({ data: financialPreview() });
    await openFinancialAbsence({ fillReason: false });
    await act(async () => { jest.advanceTimersByTime(300); });
    expect(cancellationCalls("cancellation-preview")).toHaveLength(0);
    fireEvent.click(confirmCancellationButton());
    expect(toast.error).toHaveBeenCalledWith("Informe o motivo.");
    expect(axios.put).not.toHaveBeenCalled();
    expect(cancellationCalls("cancel-with-credit")).toHaveLength(0);
    fireEvent.change(screen.getByPlaceholderText("Descreva o motivo"), { target: { value: "Primeiro motivo" } });
    await act(async () => { jest.advanceTimersByTime(200); });
    fireEvent.change(screen.getByPlaceholderText("Descreva o motivo"), { target: { value: "Motivo atualizado" } });
    await act(async () => { jest.advanceTimersByTime(249); });
    expect(cancellationCalls("cancellation-preview")).toHaveLength(0);
    await act(async () => { jest.advanceTimersByTime(1); });
    await readyToConfirmCancellation();
    expect(cancellationCalls("cancellation-preview")).toHaveLength(1);
    expect(cancellationCalls("cancellation-preview")[0][1]).toEqual({
      reason: "Motivo atualizado", late_policy_exception_justified: true, late_policy_exception_reason: "Motivo atualizado",
    });
    expect(cancellationCalls("cancel-with-credit")).toHaveLength(0);
    expect(axios.put).not.toHaveBeenCalled();
  });

  it("mantém reposição no formulário e no fluxo operacional mesmo com autorização financeira", async () => {
    axios.put.mockResolvedValue({ data: { ...baseSession, status: "canceled" } });
    await openFinancialAbsence();
    fireEvent.click(screen.getByText("Gerar reposição"));
    fireEvent.click(confirmCancellationButton());
    await waitFor(() => expect(axios.put).toHaveBeenCalledWith("/sessions/10", expect.objectContaining({
      generate_replacement_credit: true, replacement_credit_reason: "Pedido definitivo",
    })));
    await act(async () => { jest.advanceTimersByTime(300); });
    expect(cancellationCalls("cancel-with-credit")).toHaveLength(0);
    expect(cancellationCalls("cancellation-preview")).toHaveLength(0);
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Sessão cancelada."));
  });

  it.each(["manage", "settle"])("sem autorização financeira %s conserva cancelamento operacional sem chamar liberação", async (missing) => {
    if (missing === "settle") mockAuthorization.hasCapability = jest.fn((capability) => capability !== "finance.settle");
    axios.put.mockResolvedValue({ data: { ...baseSession, status: "canceled" } });
    await openFinancialAbsence({ finance: missing !== "manage" });
    fireEvent.click(confirmCancellationButton());
    await waitFor(() => expect(axios.put).toHaveBeenCalledWith("/sessions/10", expect.objectContaining({ status: "canceled", absence_reason: "Pedido definitivo" })));
    expect(cancellationCalls("cancellation-preview")).toHaveLength(0);
    expect(cancellationCalls("cancel-with-credit")).toHaveLength(0);
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Sessão cancelada."));
  });

  it("cancelamento tardio sem justificativa preserva penalidade operacional e não consulta prévia financeira", async () => {
    axios.put.mockResolvedValue({ data: { ...baseSession, status: "no_show" } });
    await openFinancialAbsence({ justify: false });
    fireEvent.click(confirmCancellationButton());
    await waitFor(() => expect(axios.put).toHaveBeenCalledWith("/sessions/10", expect.objectContaining({ status: "canceled", absence_reason: "Pedido definitivo" })));
    expect(cancellationCalls("cancellation-preview")).toHaveLength(0);
    expect(cancellationCalls("cancel-with-credit")).toHaveLength(0);
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Agendamento atualizado."));
    expect(toast.success).not.toHaveBeenCalledWith("Sessão cancelada.");
  });

  it("mostra outro agendamento afetado inline com paciente e data/hora do servidor", async () => {
    axios.post.mockResolvedValue({ data: financialPreview(10000, {
      patient: { id: 20, name: "Paciente retornado" },
      affected_sessions: [{ id: 10, starts_at: baseSession.starts_at }, { id: 12, starts_at: "2026-11-06T13:00:00Z" }],
    }) });
    await openFinancialAbsence();
    await readyToConfirmCancellation();
    expect(screen.getByLabelText("Outros agendamentos afetados")).toHaveTextContent(/Paciente retornado.*06\/11\/2026.*10:00/);
    expect(screen.getByText("O que aconteceu?")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Descreva o motivo")).toHaveValue("Pedido definitivo");
    expect(cancellationCalls("cancel-with-credit")).toHaveLength(0);
    expect(axios.put).not.toHaveBeenCalled();
  });

  it("prévia desatualizada recarrega escopo inline e exige novo clique sem cancelar separadamente", async () => {
    let previewCount = 0;
    let confirmCount = 0;
    axios.post.mockImplementation((url) => {
      if (url.endsWith("cancellation-preview")) {
        previewCount += 1;
        return Promise.resolve({ data: financialPreview(10000, previewCount === 1 ? {} : {
          preview_fingerprint: "updated-preview", patient: { id: 20, name: "Paciente atualizado" },
          affected_sessions: [{ id: 10, starts_at: baseSession.starts_at }, { id: 12, starts_at: "2026-11-06T13:00:00Z" }],
        }) });
      }
      confirmCount += 1;
      return confirmCount === 1 ? Promise.reject(apiFailure(409, "CANCELLATION_PREVIEW_STALE"))
        : Promise.resolve({ data: { id: 2, entry_id: 90, patient_id: 20 } });
    });
    await openFinancialAbsence();
    await readyToConfirmCancellation();
    fireEvent.click(confirmCancellationButton());
    await screen.findByText("O agendamento mudou. Confira as informações atualizadas e confirme novamente.");
	    await flushFinancialPreviewDebounce();
    await waitFor(() => expect(cancellationCalls("cancellation-preview")).toHaveLength(2));
	    await waitFor(() => expect(confirmCancellationButton()).toBeEnabled());
    expect(screen.getByLabelText("Outros agendamentos afetados")).toHaveTextContent(/Paciente atualizado.*06\/11\/2026.*10:00/);
    expect(cancellationCalls("cancel-with-credit")).toHaveLength(1);
    expect(screen.getByText("O que aconteceu?")).toBeInTheDocument();
    fireEvent.click(confirmCancellationButton());
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Sessão cancelada."));
    expect(cancellationCalls("cancel-with-credit")[1][1].preview_fingerprint).toBe("updated-preview");
    expect(cancellationCalls("cancel-with-credit")[1][2]).not.toEqual(cancellationCalls("cancel-with-credit")[0][2]);
    expect(axios.put).not.toHaveBeenCalled();
  });

  it("reutiliza chave e comando após resultado ambíguo, mantendo formulário bloqueado até retry", async () => {
    let confirmCount = 0;
    axios.post.mockImplementation((url) => {
      if (url.endsWith("cancellation-preview")) return Promise.resolve({ data: financialPreview() });
      confirmCount += 1;
      return confirmCount === 1 ? Promise.reject(new Error("timeout"))
        : Promise.resolve({ data: { id: 2, entry_id: 90, patient_id: 20 } });
    });
    await openFinancialAbsence();
    await readyToConfirmCancellation();
    fireEvent.click(confirmCancellationButton());
    await screen.findByRole("alert");
    expect(screen.getByPlaceholderText("Descreva o motivo")).toHaveValue("Pedido definitivo");
    expect(screen.getByPlaceholderText("Descreva o motivo")).toBeDisabled();
    fireEvent.click(confirmCancellationButton());
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Sessão cancelada."));
    const calls = cancellationCalls("cancel-with-credit");
    expect(calls).toHaveLength(2);
    expect(calls[0]).toEqual(calls[1]);
    expect(cancellationCalls("cancellation-preview")).toHaveLength(1);
    expect(axios.put).not.toHaveBeenCalled();
  });

  it.each([403, 500])("falha %s da prévia permite retry técnico mas nunca cancela automaticamente", async (status) => {
    axios.post.mockRejectedValue(apiFailure(status, "BLOCKED"));
    await openFinancialAbsence();
    await flushFinancialPreviewDebounce();
    await screen.findByRole("alert");
    expect(axios.put).not.toHaveBeenCalled();
    expect(cancellationCalls("cancel-with-credit")).toHaveLength(0);
    expect(screen.getByText("O que aconteceu?")).toBeInTheDocument();
    axios.post.mockImplementation((url) => Promise.resolve({ data: url.endsWith("cancellation-preview")
      ? financialPreview() : { id: 2, entry_id: 90, patient_id: 20 } }));
    fireEvent.click(confirmCancellationButton());
    await waitFor(() => expect(cancellationCalls("cancellation-preview")).toHaveLength(2));
    await readyToConfirmCancellation();
    expect(cancellationCalls("cancel-with-credit")).toHaveLength(0);
    expect(axios.put).not.toHaveBeenCalled();
    fireEvent.click(confirmCancellationButton());
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Sessão cancelada."));
  });

  it("origem sem obrigação financeira reconhecida em background aguarda clique para cancelar operacionalmente", async () => {
    axios.post.mockRejectedValue(apiFailure(409, "FINANCIAL_CANCELLATION_NOT_APPLICABLE"));
    await openFinancialAbsence();
    await flushFinancialPreviewDebounce();
    await waitFor(() => expect(cancellationCalls("cancellation-preview")).toHaveLength(1));
    await readyToConfirmCancellation();
    expect(axios.put).not.toHaveBeenCalled();
    fireEvent.click(confirmCancellationButton());
    await waitFor(() => expect(axios.put).toHaveBeenCalledWith("/sessions/10", expect.objectContaining({ status: "canceled" })));
    expect(cancellationCalls("cancel-with-credit")).toHaveLength(0);
  });

  it("bloqueador clínico deixa formulário aberto sem autorizar confirmação nem cancelamento separado", async () => {
    axios.post.mockResolvedValue({ data: financialPreview(10000, {
      eligible: false, blockers: [{ code: "CLINICAL_RECORD", message: "Sessão com registro clínico." }],
    }) });
    await openFinancialAbsence();
    await flushFinancialPreviewDebounce();
    await screen.findByText("Sessão com registro clínico.");
    expect(confirmCancellationButton()).toBeDisabled();
    expect(screen.getByText("O que aconteceu?")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Descreva o motivo")).toHaveValue("Pedido definitivo");
    expect(axios.put).not.toHaveBeenCalled();
    expect(cancellationCalls("cancel-with-credit")).toHaveLength(0);
  });

  it("duplo clique durante confirmação envia um único comando conjunto", async () => {
    let resolveConfirmation;
    axios.post.mockImplementation((url) => url.endsWith("cancellation-preview")
      ? Promise.resolve({ data: financialPreview() })
      : new Promise((resolve) => { resolveConfirmation = resolve; }));
    await openFinancialAbsence();
    await readyToConfirmCancellation();
    const button = confirmCancellationButton();
    fireEvent.click(button);
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(cancellationCalls("cancel-with-credit")).toHaveLength(1);
    expect(screen.getByText("O que aconteceu?")).toBeInTheDocument();
    await act(async () => { resolveConfirmation({ data: { id: 2, entry_id: 90, patient_id: 20 } }); });
    expect(toast.success).toHaveBeenCalledTimes(1);
    expect(axios.put).not.toHaveBeenCalled();
  });

  it("trocar para falta invalida confirmação financeira imediatamente enquanto consulta mensal está pendente", async () => {
    axios.post.mockResolvedValue({ data: financialPreview() });
    axios.put.mockResolvedValue({ data: { ...baseSession, status: "no_show" } });
    await openFinancialAbsence();
    await readyToConfirmCancellation();
    const previousConfirmation = confirmCancellationButton();
    const regularGet = axios.get.getMockImplementation();
    let resolveMonthly;
    axios.get.mockImplementation((url, config) => url === "/sessions" && !config?.params?.status
      ? new Promise((resolve) => { resolveMonthly = resolve; }) : regularGet(url, config));
    fireEvent.click(screen.getByRole("button", { name: /^Falta/i }));
    expect(resolveMonthly).toBeDefined();
    expect(previousConfirmation).toBeDisabled();
    fireEvent.click(previousConfirmation);
    expect(cancellationCalls("cancel-with-credit")).toHaveLength(0);
    expect(axios.put).not.toHaveBeenCalled();
    expect(screen.getByPlaceholderText("Descreva o motivo")).toHaveValue("Pedido definitivo");
    axios.get.mockImplementation(regularGet);
    await act(async () => { resolveMonthly({ data: [] }); });
    await waitFor(() => expect(screen.getByRole("button", { name: "Salvar" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(axios.put).toHaveBeenCalledWith("/sessions/10", expect.objectContaining({ status: "no_show" })));
    expect(cancellationCalls("cancel-with-credit")).toHaveLength(0);
  });

  it("resposta de motivo anterior não substitui a prévia do motivo atual", async () => {
    const pending = [];
    axios.post.mockImplementation((url) => url.endsWith("cancellation-preview")
      ? new Promise((resolve) => { pending.push(resolve); }) : Promise.resolve({ data: { id: 2, entry_id: 90, patient_id: 20 } }));
    await openFinancialAbsence();
    await act(async () => { jest.advanceTimersByTime(250); });
    expect(pending).toHaveLength(1);
    fireEvent.change(screen.getByPlaceholderText("Descreva o motivo"), { target: { value: "Pedido atualizado" } });
    await act(async () => { jest.advanceTimersByTime(250); });
    expect(pending).toHaveLength(2);
    await act(async () => { pending[1]({ data: financialPreview(5000, { preview_fingerprint: "current-preview" }) }); });
    await readyToConfirmCancellation();
    await act(async () => { pending[0]({ data: financialPreview(10000, {
      preview_fingerprint: "obsolete-preview", patient: { id: 20, name: "Paciente antigo" },
      affected_sessions: [{ id: 10, starts_at: baseSession.starts_at }, { id: 99, starts_at: "2026-12-25T13:00:00Z" }],
    }) }); });
    expect(screen.queryByText(/Paciente antigo|25\/12\/2026/)).not.toBeInTheDocument();
    fireEvent.click(confirmCancellationButton());
    await waitFor(() => expect(cancellationCalls("cancel-with-credit")).toHaveLength(1));
    expect(cancellationCalls("cancel-with-credit")[0][1]).toEqual({
      reason: "Pedido atualizado", preview_fingerprint: "current-preview",
      late_policy_exception_justified: true, late_policy_exception_reason: "Pedido atualizado",
    });
    expect(axios.put).not.toHaveBeenCalled();
  });

  it("ignora prévia automática que chega após mudança do contexto autorizado", async () => {
    let resolvePreview;
    axios.post.mockImplementation(() => new Promise((resolve) => { resolvePreview = resolve; }));
    const rendered = await openFinancialAbsence();
    await act(async () => { jest.advanceTimersByTime(250); });
    expect(confirmCancellationButton()).toBeDisabled();
    expect(cancellationCalls("cancellation-preview")).toHaveLength(1);
    mockAuthorization = { ...mockAuthorization, context: { ...mockAuthorization.context, clinic_id: 2 } };
    rendered.rerender(<MemoryRouter><Agendamentos /></MemoryRouter>);
    await act(async () => { resolvePreview({ data: financialPreview() }); });
    expect(screen.queryByRole("button", { name: "Confirmar cancelamento" })).not.toBeInTheDocument();
    expect(cancellationCalls("cancel-with-credit")).toHaveLength(0);
    expect(axios.put).not.toHaveBeenCalled();
  });

  it("ignora prévia automática recebida após desmontagem da Agenda", async () => {
    let resolvePreview;
    axios.post.mockImplementation(() => new Promise((resolve) => { resolvePreview = resolve; }));
    const rendered = await openFinancialAbsence();
    await act(async () => { jest.advanceTimersByTime(250); });
    expect(resolvePreview).toBeDefined();
    rendered.unmount();
    const getCount = axios.get.mock.calls.length;
    await act(async () => { resolvePreview({ data: financialPreview() }); });
    expect(toast.success).not.toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
    expect(axios.get).toHaveBeenCalledTimes(getCount);
    expect(cancellationCalls("cancel-with-credit")).toHaveLength(0);
    expect(axios.put).not.toHaveBeenCalled();
  });

  it("não publica confirmação nem atualiza dados após desmontagem da Agenda", async () => {
    let resolveConfirmation;
    axios.post.mockImplementation((url) => url.endsWith("cancellation-preview")
      ? Promise.resolve({ data: financialPreview() })
      : new Promise((resolve) => { resolveConfirmation = resolve; }));
    const rendered = await openFinancialAbsence();
    await readyToConfirmCancellation();
    fireEvent.click(confirmCancellationButton());
    expect(resolveConfirmation).toBeDefined();
    rendered.unmount();
    const getCount = axios.get.mock.calls.length;
    await act(async () => { resolveConfirmation({ data: { id: 2, entry_id: 90, patient_id: 20 } }); });
    expect(toast.success).not.toHaveBeenCalled();
    expect(axios.get).toHaveBeenCalledTimes(getCount);
    expect(axios.put).not.toHaveBeenCalled();
  });

  it("registra falta pelo fluxo unificado sem mostrar reposicao", async () => {
    axios.put.mockResolvedValueOnce({
      data: {
        ...baseSession,
        status: "no_show",
        absence_reason: "Nao compareceu",
      },
    });
    const { container } = renderAgendamentos();

    expect(await screen.findByText("Paciente Teste")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Dia" }));
    const scheduledCard = await waitFor(() => {
      const element = container.querySelector('[data-id="10"]');
      expect(element).toBeTruthy();
      return element;
    });
    const statusButton = Array.from(scheduledCard.querySelectorAll("button"))
      .find((button) => button.textContent.includes("Agendado"));
    fireEvent.click(statusButton);
    fireEvent.click(await screen.findByRole("button", { name: "Cancelamento/falta" }));
    fireEvent.click(await screen.findByRole("button", { name: /^Falta/i }));

    expect(await screen.findByText(/Faltas neste mês:\s*0\/2\./)).toBeInTheDocument();
    expect(screen.queryByText("Gerar reposição")).not.toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText("Descreva o motivo"), {
      target: { value: "Nao compareceu" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() => expect(axios.put).toHaveBeenCalledWith(
      "/sessions/10",
      expect.objectContaining({
        status: "no_show",
        absence_reason: "Nao compareceu",
      }),
    ));
    const payload = axios.put.mock.calls.find(([url]) => url === "/sessions/10")[1];
    expect(payload).not.toHaveProperty("generate_replacement_credit");
    expect(payload).not.toHaveProperty("late_policy_exception_justified");
  });

  it.each([true, false])("fixa o serviço da reposição de pacote e preserva campos independentes (profissional atribuído: %s)", async (assigned) => {
    mockProfessionalAssigned = assigned;
    const originalGet = axios.get.getMockImplementation();
    axios.get.mockImplementation((url, config) => {
      if (url === "/session-replacement-credits") {
        return Promise.resolve({ data: [{
          id: 901,
          package_unit_id: 501,
          patient_id: 20,
          status: "pending",
          sourceSession: {
            service_id: 41,
            service_type: "physio",
            starts_at: "2026-06-13T10:00:00",
            status: "canceled",
          },
        }] });
      }
      return originalGet(url, config);
    });
    const { container } = renderAgendamentos();
    await screen.findByText("Paciente Teste");
    fireEvent.click(screen.getByRole("button", { name: "Novo agendamento" }));
    fireEvent.change(await screen.findByPlaceholderText("Buscar paciente"), {
      target: { value: "Paciente Teste" },
    });
    const suggestions = await screen.findAllByText("Paciente Teste");
    fireEvent.click(suggestions.find((element) => element.tagName === "BUTTON"));
    await selectAssignedProfessional(container);
    const service = container.querySelector('select[name="service_id"]');
    const professional = container.querySelector('select[name="professional_user_id"]');
    const date = container.querySelector('input[type="date"]');
    const hour = Array.from(container.querySelectorAll("select"))
      .find((select) => Array.from(select.options).some((option) => option.value === "10"));
    const notes = container.querySelector('[name="notes"]');
    const replacement = container.querySelector('select[name="session_replacement_credit_id"]');
    fireEvent.change(service, { target: { value: "40" } });
    fireEvent.change(date, { target: { value: "2026-06-30" } });
    fireEvent.change(hour, { target: { value: "10" } });
    fireEvent.change(notes, { target: { value: "Observação preservada" } });
    fireEvent.change(replacement, { target: { value: "901" } });
    await waitFor(() => expect(service).toHaveValue("41"));
    expect(service).toBeDisabled();
    expect(service.closest("label")).toHaveClass("span-2");
    expect(professional.closest("label")).toHaveClass("span-2");
    expect(service).toHaveStyle({
      background: "#f4f5f2", color: "#888", appearance: "none",
      backgroundImage: "none", boxShadow: "none",
    });
    expect(professional).toHaveValue("30");
    expect(date).toHaveValue("2026-06-30");
    expect(hour).toHaveValue("10");
    expect(notes).toHaveValue("Observação preservada");

    // Mesmo um evento artificial não deve executar o reset do serviço bloqueado.
    fireEvent.change(service, { target: { value: "40" } });
    fireEvent.change(professional, { target: { value: "31" } });
    fireEvent.change(date, { target: { value: "2026-07-01" } });
    fireEvent.change(hour, { target: { value: "11" } });
    fireEvent.change(notes, { target: { value: "Outra observação" } });
    expect(replacement).toHaveValue("901");
    expect(service).toHaveValue("41");
    expect(professional).toHaveValue("31");
    expect(date).toHaveValue("2026-07-01");
    expect(hour).toHaveValue("11");
    expect(notes).toHaveValue("Outra observação");
    fireEvent.click(screen.getByRole("button", { name: "Revisar agendamento" }));
    await screen.findByRole("heading", { name: "Revisar agendamento" });
    fireEvent.click(screen.getByRole("button", { name: "Confirmar", exact: true }));
    await waitFor(() => expect(axios.post).toHaveBeenCalledWith("/sessions", expect.objectContaining({
      patient_id: 20,
      professional_user_id: 31,
      clinic_professional_id: 301,
      service_id: 41,
      service_type: "physio",
      session_replacement_credit_id: 901,
      starts_at: "2026-07-01T14:00:00.000Z",
      ends_at: "2026-07-01T15:00:00.000Z",
      notes: "Outra observação",
      assign_patient_care: !assigned,
    })));
  });

  it("remover explicitamente a reposição de pacote libera o serviço sem limpar os demais campos", async () => {
    const originalGet = axios.get.getMockImplementation();
    axios.get.mockImplementation((url, config) => url === "/session-replacement-credits"
      ? Promise.resolve({ data: [{
        id: 901, package_unit_id: 501, source_service_id: 41, source_service_type: "physio",
      }] })
      : originalGet(url, config));
    const { container } = renderAgendamentos();
    await screen.findByText("Paciente Teste");
    fireEvent.click(screen.getByRole("button", { name: "Novo agendamento" }));
    fireEvent.change(await screen.findByPlaceholderText("Buscar paciente"), {
      target: { value: "Paciente Teste" },
    });
    const suggestions = await screen.findAllByText("Paciente Teste");
    fireEvent.click(suggestions.find((element) => element.tagName === "BUTTON"));
    await selectAssignedProfessional(container);
    const replacement = container.querySelector('select[name="session_replacement_credit_id"]');
    const service = container.querySelector('select[name="service_id"]');
    const date = container.querySelector('input[type="date"]');
    const hour = Array.from(container.querySelectorAll("select"))
      .find((select) => Array.from(select.options).some((option) => option.value === "10"));
    const notes = container.querySelector('[name="notes"]');
    fireEvent.change(date, { target: { value: "2026-06-30" } });
    fireEvent.change(hour, { target: { value: "10" } });
    fireEvent.change(notes, { target: { value: "Manter observação" } });
    fireEvent.change(replacement, { target: { value: "901" } });
    await waitFor(() => expect(service).toBeDisabled());
    fireEvent.change(replacement, { target: { value: "" } });
    expect(service).not.toBeDisabled();
    expect(window.getComputedStyle(service).appearance).not.toBe("none");
    fireEvent.change(service, { target: { value: "40" } });
    expect(replacement).toHaveValue("");
    expect(container.querySelector('select[name="professional_user_id"]')).toHaveValue("30");
    expect(date).toHaveValue("2026-06-30");
    expect(hour).toHaveValue("10");
    expect(notes).toHaveValue("Manter observação");
    await submitAndConfirmReview();
    await waitFor(() => expect(axios.post).toHaveBeenCalledWith("/sessions", expect.objectContaining({
      service_id: 40, service_type: "spine_eval", session_replacement_credit_id: null,
      professional_user_id: 30, notes: "Manter observação",
    })));
  });

  it("cria Novo agendamento como avulso mesmo para paciente com plano ativo", async () => {
    const { container } = renderAgendamentos();

    expect(await screen.findByText("Paciente Teste")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Novo agendamento" }));
    const patientInput = await screen.findByPlaceholderText("Buscar paciente");
    fireEvent.change(patientInput, { target: { value: "Paciente Com Plano" } });
    fireEvent.click(await screen.findByText("Paciente Com Plano"));
    await selectAssignedProfessional(container);

    const serviceSelect = container.querySelector('select[name="service_id"]');
    expect(serviceSelect).toBeTruthy();
    fireEvent.change(serviceSelect, { target: { value: "40" } });

    const dateInput = container.querySelector('input[type="date"]');
    expect(dateInput).toBeTruthy();
    fireEvent.change(dateInput, { target: { value: "2026-06-30" } });

    const hourSelect = Array.from(container.querySelectorAll("select"))
      .find((select) => Array.from(select.options).some((option) => option.value === "10"));
    expect(hourSelect).toBeTruthy();
    fireEvent.change(hourSelect, { target: { value: "10" } });

    expect(screen.queryByText("Mensal")).not.toBeInTheDocument();
    expect(screen.queryByText("Pacote de sessões")).not.toBeInTheDocument();
    expect(screen.queryByText(/Cobrança prevista/i)).not.toBeInTheDocument();
    expect(screen.queryByText("Avulsa")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Revisar agendamento" }));

    expect(await screen.findByRole("heading", { name: "Revisar agendamento" }))
      .toBeInTheDocument();
    expect(screen.getByText("1 sessão selecionada")).toBeInTheDocument();
    expect(screen.getByText("Agendamento único")).toBeInTheDocument();
    expect(screen.getByText("Selecionadas 1")).toBeInTheDocument();
    expect(screen.getByText("Alertas 0")).toBeInTheDocument();
    expect(screen.getByText("Bloqueadas 0")).toBeInTheDocument();
    expect(axios.post.mock.calls.some(([url]) => url === "/sessions")).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "Confirmar agendamento" }));

    await waitFor(() => expect(axios.post).toHaveBeenCalledWith(
      "/sessions",
      expect.objectContaining({
        patient_id: 25,
        service_id: 40,
        starts_at: "2026-06-30T13:00:00.000Z",
        ends_at: "2026-06-30T14:00:00.000Z",
        billing_mode: "per_session",
        session_replacement_credit_id: null,
        assign_patient_care: false,
        clinic_professional_id: 300,
      }),
    ));

    const payload = axios.post.mock.calls.find(([url]) => url === "/sessions")[1];
    expect(payload).not.toHaveProperty("is_initial");
    expect(payload).not.toHaveProperty("patient_credit_id");
    expect(payload.billing_mode).not.toBe("covered_by_plan");
    expect(payload).not.toHaveProperty("price_override_cents");
    expect(payload).not.toHaveProperty("billing_cycle_id");
    expect(listPatientPlans).not.toHaveBeenCalled();
    expect(getCoveragePreview).not.toHaveBeenCalled();
    expect(axios.get.mock.calls.some(([url]) => url === "/patient-credits")).toBe(false);
  });

  it("agenda profissional novo com credencial e verificacao pendentes por atribuicao explicita", async () => {
    mockProfessionalAssigned = false;
    const { container } = renderAgendamentos();

    expect(await screen.findByText("Paciente Teste")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Novo agendamento" }));
    fireEvent.change(await screen.findByPlaceholderText("Buscar paciente"), {
      target: { value: "Paciente Teste" },
    });
    const patientSuggestions = await screen.findAllByText("Paciente Teste");
    fireEvent.click(patientSuggestions.find((element) => element.tagName === "BUTTON"));

    const assignmentOption = await screen.findByText("Profissional Alternativo");
    fireEvent.change(container.querySelector('select[name="professional_user_id"]'), {
      target: { value: assignmentOption.value },
    });
    fireEvent.change(container.querySelector('select[name="service_id"]'), {
      target: { value: "40" },
    });
    fireEvent.change(container.querySelector('input[type="date"]'), {
      target: { value: "2026-06-30" },
    });
    const hourSelect = Array.from(container.querySelectorAll("select"))
      .find((select) => Array.from(select.options).some((option) => option.value === "10"));
    fireEvent.change(hourSelect, { target: { value: "10" } });

    fireEvent.click(screen.getByRole("button", { name: "Revisar agendamento" }));
    expect(await screen.findByRole("button", { name: "Atribuir e agendar" }))
      .toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Atribuir e agendar" }));

    await waitFor(() => expect(axios.post).toHaveBeenCalledWith(
      "/sessions",
      expect.objectContaining({
        patient_id: 20,
        professional_user_id: 31,
        assign_patient_care: true,
        clinic_professional_id: 301,
      }),
    ));
    const payload = axios.post.mock.calls.find(([url]) => url === "/sessions")[1];
    expect(payload).not.toHaveProperty("is_initial");
    expect(payload).not.toHaveProperty("patient_credit_id");
  });

  it("trata estado de atribuicao diferente de true como atribuicao explicita", async () => {
    mockProfessionalAssigned = null;
    const { container } = renderAgendamentos();

    expect(await screen.findByText("Paciente Teste")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Novo agendamento" }));
    fireEvent.change(await screen.findByPlaceholderText("Buscar paciente"), {
      target: { value: "Paciente Teste" },
    });
    const patientSuggestions = await screen.findAllByText("Paciente Teste");
    fireEvent.click(patientSuggestions.find((element) => element.tagName === "BUTTON"));
    await selectAssignedProfessional(container);
    fireEvent.change(container.querySelector('select[name="service_id"]'), {
      target: { value: "40" },
    });
    fireEvent.change(container.querySelector('input[type="date"]'), {
      target: { value: "2026-06-30" },
    });
    const hourSelect = Array.from(container.querySelectorAll("select"))
      .find((select) => Array.from(select.options).some((option) => option.value === "10"));
    fireEvent.change(hourSelect, { target: { value: "10" } });

    fireEvent.click(screen.getByRole("button", { name: "Revisar agendamento" }));
    expect(await screen.findByRole("button", { name: "Atribuir e agendar" }))
      .toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Atribuir e agendar" }));

    await waitFor(() => expect(axios.post).toHaveBeenCalledWith(
      "/sessions",
      expect.objectContaining({
        patient_id: 20,
        professional_user_id: 30,
        assign_patient_care: true,
        clinic_professional_id: 300,
      }),
    ));
  });

  it("voltar da revisao nao envia atribuicao nem agendamento", async () => {
    mockProfessionalAssigned = false;
    const { container } = renderAgendamentos();

    expect(await screen.findByText("Paciente Teste")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Novo agendamento" }));
    fireEvent.change(await screen.findByPlaceholderText("Buscar paciente"), {
      target: { value: "Paciente Teste" },
    });
    const patientSuggestions = await screen.findAllByText("Paciente Teste");
    fireEvent.click(patientSuggestions.find((element) => element.tagName === "BUTTON"));
    await selectAssignedProfessional(container);
    fireEvent.change(container.querySelector('select[name="service_id"]'), {
      target: { value: "40" },
    });
    fireEvent.change(container.querySelector('input[type="date"]'), {
      target: { value: "2026-06-30" },
    });
    const hourSelect = Array.from(container.querySelectorAll("select"))
      .find((select) => Array.from(select.options).some((option) => option.value === "10"));
    fireEvent.change(hourSelect, { target: { value: "10" } });

    fireEvent.click(screen.getByRole("button", { name: "Revisar agendamento" }));
    expect(await screen.findByRole("button", { name: "Atribuir e agendar" }))
      .toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Voltar e editar" }));

    expect(axios.post.mock.calls.some(([url]) => url === "/sessions")).toBe(false);
  });

  it("envia valor por sessao negociado apenas quando usuario altera manualmente", async () => {
    const { container } = renderAgendamentos();

    expect(await screen.findByText("Paciente Teste")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Novo agendamento" }));
    fireEvent.change(await screen.findByPlaceholderText("Buscar paciente"), {
      target: { value: "Paciente Teste" },
    });
    const patientSuggestions = await screen.findAllByText("Paciente Teste");
    fireEvent.click(patientSuggestions.find((element) => element.tagName === "BUTTON"));

    await selectAssignedProfessional(container);
    const emptyPriceInput = container.querySelector('input[name="session_price"]');

    expect(emptyPriceInput).toBeTruthy();
    expect(emptyPriceInput).toBeDisabled();
    expect(emptyPriceInput.value).toBe("");
    expect(emptyPriceInput).toHaveAttribute("placeholder", "Selecione um atendimento");

    fireEvent.change(container.querySelector('select[name="service_id"]'), {
      target: { value: "40" },
    });
    const priceInput = container.querySelector('input[name="session_price"]');
    expect(priceInput).toBeTruthy();
    expect(screen.getByText("Valor da sessão")).toBeInTheDocument();
    expect(priceInput.value).toBe("120,00");
    fireEvent.change(priceInput, { target: { value: "100,00" } });

    fireEvent.change(container.querySelector('input[type="date"]'), {
      target: { value: "2026-06-30" },
    });
    const hourSelect = Array.from(container.querySelectorAll("select"))
      .find((select) => Array.from(select.options).some((option) => option.value === "10"));
    fireEvent.change(hourSelect, { target: { value: "10" } });

    await submitAndConfirmReview();

    await waitFor(() => expect(axios.post).toHaveBeenCalledWith(
      "/sessions",
      expect.objectContaining({
        patient_id: 20,
        service_id: 40,
        billing_mode: "per_session",
        price_override_cents: 10000,
      }),
    ));
  });

  it("envia agendamento sem cobranca sem price_override_cents", async () => {
    const { container } = renderAgendamentos();

    expect(await screen.findByText("Paciente Teste")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Novo agendamento" }));
    fireEvent.change(await screen.findByPlaceholderText("Buscar paciente"), {
      target: { value: "Paciente Teste" },
    });
    const patientSuggestions = await screen.findAllByText("Paciente Teste");
    fireEvent.click(patientSuggestions.find((element) => element.tagName === "BUTTON"));
    await selectAssignedProfessional(container);

    fireEvent.change(container.querySelector('select[name="service_id"]'), {
      target: { value: "40" },
    });
    fireEvent.click(screen.getByLabelText("Sem cobrança"));
    expect(container.querySelector('input[name="session_price"]')).not.toBeInTheDocument();
    expect(screen.getByLabelText("Sem cobrança")).toBeChecked();

    fireEvent.change(container.querySelector('input[type="date"]'), {
      target: { value: "2026-06-30" },
    });
    const hourSelect = Array.from(container.querySelectorAll("select"))
      .find((select) => Array.from(select.options).some((option) => option.value === "10"));
    fireEvent.change(hourSelect, { target: { value: "10" } });

    await submitAndConfirmReview();

    await waitFor(() => expect(axios.post).toHaveBeenCalledWith(
      "/sessions",
      expect.objectContaining({
        patient_id: 20,
        service_id: 40,
        billing_mode: "per_session",
        is_no_charge: true,
      }),
    ));
    const payload = axios.post.mock.calls.find(([url]) => url === "/sessions")[1];
    expect(payload).not.toHaveProperty("price_override_cents");
  });

  it("sanitiza e formata o campo Por sessao como moeda brasileira", async () => {
    const { container } = renderAgendamentos();

    expect(await screen.findByText("Paciente Teste")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Novo agendamento" }));
    fireEvent.change(await screen.findByPlaceholderText("Buscar paciente"), {
      target: { value: "Paciente Teste" },
    });
    const patientSuggestions = await screen.findAllByText("Paciente Teste");
    fireEvent.click(patientSuggestions.find((element) => element.tagName === "BUTTON"));
    await waitFor(() => expect(container.querySelector('select[name="service_id"]')).not.toBeNull());

    fireEvent.change(container.querySelector('select[name="service_id"]'), {
      target: { value: "40" },
    });
    const priceInput = container.querySelector('input[name="session_price"]');

    fireEvent.change(priceInput, { target: { value: "asdasdasd" } });
    expect(priceInput.value).toBe("");

    fireEvent.change(priceInput, { target: { value: "200,00555" } });
    expect(priceInput.value).toBe("200,00");
    fireEvent.blur(priceInput);
    expect(priceInput.value).toBe("200,00");

    fireEvent.change(priceInput, { target: { value: "100" } });
    fireEvent.blur(priceInput);
    expect(priceInput.value).toBe("100,00");

    fireEvent.change(priceInput, { target: { value: "100,5" } });
    fireEvent.blur(priceInput);
    expect(priceInput.value).toBe("100,50");

    fireEvent.change(priceInput, { target: { value: "1200" } });
    fireEvent.blur(priceInput);
    expect(priceInput.value).toBe("1.200,00");
  });

  it("remove Mais sessoes e volta para criacao unica", async () => {
    const { container } = renderAgendamentos();

    expect(await screen.findByText("Paciente Teste")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Novo agendamento" }));
    fireEvent.change(await screen.findByPlaceholderText("Buscar paciente"), {
      target: { value: "Paciente Teste" },
    });
    const patientSuggestions = await screen.findAllByText("Paciente Teste");
    fireEvent.click(patientSuggestions.find((element) => element.tagName === "BUTTON"));
    await selectAssignedProfessional(container);

    fireEvent.change(container.querySelector('select[name="service_id"]'), {
      target: { value: "40" },
    });
    fireEvent.change(container.querySelector('input[type="date"]'), {
      target: { value: "2026-06-30" },
    });
    const hourSelect = Array.from(container.querySelectorAll("select"))
      .find((select) => Array.from(select.options).some((option) => option.value === "10"));
    fireEvent.change(hourSelect, { target: { value: "10" } });

    fireEvent.click(screen.getByRole("button", { name: "+ Adicionar" }));
    expect(screen.getByText("Definir por")).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText("Ex.: 10"), {
      target: { value: "4" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Remover" }));
    expect(screen.queryByText("Definir por")).not.toBeInTheDocument();

    await submitAndConfirmReview();

    await waitFor(() => expect(axios.post).toHaveBeenCalledWith(
      "/sessions",
      expect.objectContaining({
        patient_id: 20,
        service_id: 40,
        status: "scheduled",
        billing_mode: "per_session",
      }),
    ));
    expect(previewSchedulingOccurrences).not.toHaveBeenCalled();
  });

  it("bloqueia criacao quando o valor manual fica vazio ou zerado", async () => {
    const { container } = renderAgendamentos();

    expect(await screen.findByText("Paciente Teste")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Novo agendamento" }));
    fireEvent.change(await screen.findByPlaceholderText("Buscar paciente"), {
      target: { value: "Paciente Teste" },
    });
    const patientSuggestions = await screen.findAllByText("Paciente Teste");
    fireEvent.click(patientSuggestions.find((element) => element.tagName === "BUTTON"));
    await selectAssignedProfessional(container);

    fireEvent.change(container.querySelector('select[name="service_id"]'), {
      target: { value: "40" },
    });
    fireEvent.change(container.querySelector('input[name="session_price"]'), {
      target: { value: "asdasdasd" },
    });
    fireEvent.change(container.querySelector('input[type="date"]'), {
      target: { value: "2026-06-30" },
    });
    const hourSelect = Array.from(container.querySelectorAll("select"))
      .find((select) => Array.from(select.options).some((option) => option.value === "10"));
    fireEvent.change(hourSelect, { target: { value: "10" } });

    fireEvent.click(screen.getByRole("button", { name: "Revisar agendamento" }));

    expect(toast.error).toHaveBeenCalledWith("Informe um valor por sessão válido.");
    expect(axios.post.mock.calls.some(([url]) => url === "/sessions")).toBe(false);
  });

  it("nao envia reposicao disponivel quando usuario nao escolhe usar reposicao", async () => {
    axios.get.mockImplementation((url, config = {}) => {
      if (url === "/schedule/references/patients") {
        return Promise.resolve({
          data: [
            { id: 20, full_name: "Paciente Teste" },
            { id: 26, full_name: "Paciente Sem Vinculo" },
          ],
        });
      }
      if (url === "/schedule/references/professionals") {
        return Promise.resolve({
          data: [{
            id: 30,
            name: "Profissional Teste",
            clinic_professional_id: 300,
            is_assigned: config?.params?.patient_id ? true : null,
          }],
        });
      }
      if (url === "/service-limits") return Promise.resolve({ data: [] });
      if (url === "/session-statuses") return Promise.resolve({ data: [] });
      if (url === "/services") {
        return Promise.resolve({
          data: [{ id: 40, code: "spine_eval", name: "Avaliacao Coluna", is_active: true }],
        });
      }
      if (url === "/unit-scheduling-policy") {
        return Promise.resolve({
          data: {
            late_change_minimum_notice_hours: 24,
            monthly_reschedule_limit: 2,
            monthly_absence_limit: 2,
            replacement_credit_validity_days: 30,
            replacement_credit_expiring_alert_days: 7,
          },
        });
      }
      if (url === "/sessions") {
        if (config?.params?.status === "scheduled") return Promise.resolve({ data: [] });
        return Promise.resolve({ data: sessionsMockData });
      }
      if (url === "/session-replacement-credits") {
        if (String(config?.params?.patient_id) === "20") {
          return Promise.resolve({
	            data: [{
	              id: 901,
	              patient_id: 20,
	              reason: "Reposicao",
	              expires_at: "2026-07-30",
	              source_service_id: 40,
	              source_service_type: "spine_eval",
                source_service_name: "Avaliação Coluna",
	              source_billing_mode: "per_session",
                sourceSession: {
                  id: 777,
                  starts_at: "2026-05-03T10:00:00",
                  status: "no_show",
                },
	            }],
	          });
	        }
        return Promise.resolve({ data: [] });
      }
      if (url === "/operational-alerts") return Promise.resolve({ data: [] });
      return Promise.resolve({ data: [] });
    });

    const { container } = renderAgendamentos();

    expect(await screen.findByText("Paciente Teste")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Novo agendamento" }));
    const patientInput = await screen.findByPlaceholderText("Buscar paciente");
    fireEvent.change(patientInput, { target: { value: "Paciente Teste" } });
    const patientSuggestions = await screen.findAllByText("Paciente Teste");
    fireEvent.click(patientSuggestions.find((element) => element.tagName === "BUTTON"));
    await selectAssignedProfessional(container);

    const serviceSelect = container.querySelector('select[name="service_id"]');
    fireEvent.change(serviceSelect, { target: { value: "40" } });

    await waitFor(() => {
	      const element = container.querySelector('select[name="session_replacement_credit_id"]');
	      expect(element).toBeTruthy();
	      return element;
	    });
      expect(screen.getByText("Não usar reposição")).toBeInTheDocument();
      expect(screen.getByText("Avaliação Coluna — falta em 03/05/26")).toBeInTheDocument();
      expect(screen.queryByText(/#901/)).not.toBeInTheDocument();
      expect(screen.queryByText(/vence em/i)).not.toBeInTheDocument();

    fireEvent.change(patientInput, { target: { value: "Paciente Sem Vinculo" } });
    fireEvent.click(await screen.findByText("Paciente Sem Vinculo"));
    await selectAssignedProfessional(container);

    fireEvent.change(container.querySelector('input[type="date"]'), {
      target: { value: "2026-06-30" },
    });
    const hourSelect = Array.from(container.querySelectorAll("select"))
      .find((select) => Array.from(select.options).some((option) => option.value === "10"));
    fireEvent.change(hourSelect, { target: { value: "10" } });

    await submitAndConfirmReview();

    await waitFor(() => expect(axios.post).toHaveBeenCalledWith(
      "/sessions",
      expect.objectContaining({
        patient_id: 26,
        service_id: 40,
        billing_mode: "per_session",
        session_replacement_credit_id: null,
      }),
    ));
    const payload = axios.post.mock.calls.find(([url]) => url === "/sessions")[1];
    expect(payload).not.toHaveProperty("is_initial");
    expect(payload).not.toHaveProperty("patient_credit_id");
  });

  it("mantem reposicao explicita quando usuario escolhe usar reposicao", async () => {
    axios.get.mockImplementation((url, config = {}) => {
      if (url === "/schedule/references/patients") {
        return Promise.resolve({ data: [{ id: 20, full_name: "Paciente Teste" }] });
      }
      if (url === "/schedule/references/professionals") {
        return Promise.resolve({
          data: [{
            id: 30,
            name: "Profissional Teste",
            clinic_professional_id: 300,
            is_assigned: config?.params?.patient_id ? true : null,
          }],
        });
      }
      if (url === "/service-limits") return Promise.resolve({ data: [] });
      if (url === "/session-statuses") return Promise.resolve({ data: [] });
      if (url === "/services") {
        return Promise.resolve({
          data: [{ id: 40, code: "spine_eval", name: "Avaliacao Coluna", is_active: true }],
        });
      }
      if (url === "/unit-scheduling-policy") {
        return Promise.resolve({
          data: {
            late_change_minimum_notice_hours: 24,
            monthly_reschedule_limit: 2,
            monthly_absence_limit: 2,
            replacement_credit_validity_days: 30,
            replacement_credit_expiring_alert_days: 7,
          },
        });
      }
      if (url === "/sessions") {
        if (config?.params?.status === "scheduled") return Promise.resolve({ data: [] });
        return Promise.resolve({ data: sessionsMockData });
      }
      if (url === "/session-replacement-credits") {
        return Promise.resolve({
          data: [{
            id: 901,
            patient_id: 20,
            reason: "Reposicao",
            expires_at: "2026-07-30",
	            source_service_id: 40,
	            source_service_type: "spine_eval",
	            source_billing_mode: "covered_by_plan",
              sourceSession: {
                id: 777,
                starts_at: "2026-05-03T10:00:00",
                status: "no_show",
                Service: {
                  id: 40,
                  code: "spine_eval",
                  name: "Avaliação Coluna",
                },
              },
	          }],
	        });
	      }
      if (url === "/operational-alerts") return Promise.resolve({ data: [] });
      return Promise.resolve({ data: [] });
    });

    const { container } = renderAgendamentos();

    expect(await screen.findByText("Paciente Teste")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Novo agendamento" }));
    const patientInput = await screen.findByPlaceholderText("Buscar paciente");
    fireEvent.change(patientInput, { target: { value: "Paciente Teste" } });
    const patientSuggestions = await screen.findAllByText("Paciente Teste");
    fireEvent.click(patientSuggestions.find((element) => element.tagName === "BUTTON"));
    await selectAssignedProfessional(container);

    const serviceSelect = container.querySelector('select[name="service_id"]');
    fireEvent.change(serviceSelect, { target: { value: "40" } });

    const replacementSelect = await waitFor(() => {
      const element = container.querySelector('select[name="session_replacement_credit_id"]');
      expect(element).toBeTruthy();
      return element;
	    });
      expect(screen.getByText("Avaliação Coluna — falta em 03/05/26")).toBeInTheDocument();
	    fireEvent.change(replacementSelect, { target: { value: "901" } });
      expect(screen.getByRole("heading", { name: "Novo agendamento" })).toBeInTheDocument();
      expect(screen.queryByRole("heading", { name: "Agendar reposição" })).not.toBeInTheDocument();
      expect(screen.getByText("Reposição selecionada. Sem nova cobrança.")).toBeInTheDocument();

      fireEvent.change(replacementSelect, { target: { value: "" } });
      expect(screen.queryByText("Reposição selecionada. Sem nova cobrança.")).not.toBeInTheDocument();

      fireEvent.change(replacementSelect, { target: { value: "901" } });

	    fireEvent.change(container.querySelector('input[type="date"]'), {
	      target: { value: "2026-06-30" },
    });
    const hourSelect = Array.from(container.querySelectorAll("select"))
      .find((select) => Array.from(select.options).some((option) => option.value === "10"));
    fireEvent.change(hourSelect, { target: { value: "10" } });

	    await submitAndConfirmReview();

    await waitFor(() => expect(axios.post).toHaveBeenCalledWith(
      "/sessions",
      expect.objectContaining({
        patient_id: 20,
        service_id: 40,
        session_replacement_credit_id: 901,
      }),
    ));
    const payload = axios.post.mock.calls.find(([url]) => url === "/sessions")[1];
    expect(payload).not.toHaveProperty("is_initial");
    expect(payload).not.toHaveProperty("patient_credit_id");
    expect(payload).not.toHaveProperty("billing_mode");
  });

  it("envia semana sim semana nao no preview e preserva repeat_interval na confirmacao", async () => {
    mockProfessionalAssigned = false;
    previewSchedulingOccurrences.mockResolvedValue({
      data: {
        occurrences_preview: [
          buildPreviewOccurrence(1, "2026-07-06"),
          buildPreviewOccurrence(2, "2026-07-09"),
          buildPreviewOccurrence(3, "2026-07-20"),
          buildPreviewOccurrence(4, "2026-07-23"),
        ],
        summary: buildPreviewSummary({ total: 4, available: 4, warn: 0, blocked: 0 }),
        validation: buildAvailabilityValidation(),
      },
    });
    axios.post.mockResolvedValue({ data: { total_created: 4 } });

    const { container } = renderAgendamentos();

    expect(await screen.findByText("Paciente Teste")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Novo agendamento" }));
    fireEvent.change(await screen.findByPlaceholderText("Buscar paciente"), {
      target: { value: "Paciente Teste" },
    });
    const patientSuggestions = await screen.findAllByText("Paciente Teste");
    fireEvent.click(patientSuggestions.find((element) => element.tagName === "BUTTON"));
    await selectAssignedProfessional(container);

	    fireEvent.change(container.querySelector('select[name="service_id"]'), {
	      target: { value: "40" },
	    });
    fireEvent.change(container.querySelector('input[name="session_price"]'), {
      target: { value: "100,00" },
    });
	    fireEvent.change(container.querySelector('input[type="date"]'), {
	      target: { value: "2026-07-06" },
    });
    const hourSelect = Array.from(container.querySelectorAll("select"))
      .find((select) => Array.from(select.options).some((option) => option.value === "10"));
    fireEvent.change(hourSelect, { target: { value: "10" } });

    fireEvent.click(screen.getByRole("button", { name: "+ Adicionar" }));
    expect(screen.getByText("Valor da sessão")).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText("Ex.: 10"), {
      target: { value: "4" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Semana sim, semana não" }));
    fireEvent.click(screen.getByRole("button", { name: "Qui" }));

    fireEvent.click(screen.getByRole("button", { name: "Revisar agendamento" }));

    await waitFor(() => expect(previewSchedulingOccurrences).toHaveBeenCalledWith(
      expect.objectContaining({
        starts_at: "2026-07-06T13:00:00.000Z",
        duration_minutes: 60,
        repeat_interval: 2,
        occurrence_count: 4,
	        weekdays: [1, 4],
        billing_mode: "per_session",
        price_override_cents: 10000,
        assign_patient_care: true,
        clinic_professional_id: 300,
      }),
    ));
    expect(await screen.findByText("Semana sim, semana não · primeira semana ativa · 4 sessões"))
      .toBeInTheDocument();
    expect(screen.getByText(/06\/07\/2026/)).toBeInTheDocument();
    expect(screen.getByText(/09\/07\/2026/)).toBeInTheDocument();
    expect(screen.getByText(/20\/07\/2026/)).toBeInTheDocument();
    expect(screen.getByText(/23\/07\/2026/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Atribuir e agendar" }));

    await waitFor(() => expect(axios.post).toHaveBeenCalledWith(
      "/session-series",
      expect.objectContaining({
        starts_at: "2026-07-06T13:00:00.000Z",
        duration_minutes: 60,
        repeat_interval: 2,
        occurrence_count: 4,
        billing_mode: "per_session",
        price_override_cents: 10000,
        assign_patient_care: true,
        clinic_professional_id: 300,
      }),
	    ));
    const seriesPayload = axios.post.mock.calls.find(([url]) => url === "/session-series")[1];
    expect(seriesPayload).toHaveProperty("patient_credit_id", null);
    expect(seriesPayload).not.toHaveProperty("patient_plan_id");
    expect(seriesPayload).not.toHaveProperty("included_cycle_weeks");
  });

  it("mantem conflito do paciente bloqueado na previa recorrente", async () => {
    previewSchedulingOccurrences.mockResolvedValue({
      data: {
        occurrences_preview: [
          buildPreviewOccurrence(1, "2026-07-06"),
          {
            ...buildPreviewOccurrence(2, "2026-07-13"),
            status: "BLOCK",
            can_override_block: false,
	            can_create: false,
            blocking_code: "PATIENT_SCHEDULE_CONFLICT",
            blocking_reason: "Paciente já agendado nesse horário",
	            availability: buildOperationalAvailability({
	              hasBlockingEvents: true,
	              blockingReason: "Paciente já agendado nesse horário",
	            }),
            validation: buildAvailabilityValidation({
              canConfirm: false,
              blockingCode: "PATIENT_SCHEDULE_CONFLICT",
              blockingReason: "Paciente já agendado nesse horário",
            }),
          },
        ],
        summary: buildPreviewSummary({ total: 2, available: 1, warn: 0, blocked: 1 }),
        validation: buildAvailabilityValidation({
          canConfirm: false,
          blockingCode: "PATIENT_SCHEDULE_CONFLICT",
          blockingReason: "Paciente já agendado nesse horário",
        }),
      },
    });

    const { container } = renderAgendamentos();
    await openNewRecurringReview(container);

    const conflictMessage = await screen.findByText("Paciente já agendado nesse horário");
    const conflictRow = conflictMessage.parentElement?.parentElement
      ?.parentElement?.parentElement;
    expect(conflictRow).toBeTruthy();
    expect(within(conflictRow).getByRole("checkbox")).not.toBeChecked();
    expect(within(conflictRow).getByRole("checkbox")).toBeDisabled();
    expect(screen.queryByText("Bloqueado")).not.toBeInTheDocument();
  });

  it("falha fechada quando a previa recorrente nao comprova validacao completa", async () => {
    previewSchedulingOccurrences.mockResolvedValue({
      data: {
        occurrences_preview: [{
          ...buildPreviewOccurrence(1, "2026-07-06"),
          ends_at: null,
        }],
        summary: buildPreviewSummary({ total: 1, available: 1, warn: 0, blocked: 0 }),
        validation: buildAvailabilityValidation(),
      },
    });

    const { container } = renderAgendamentos();
    await openNewRecurringReview(container);

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(
      "Não foi possível gerar a pré-visualização das ocorrências.",
    ));
    expect(screen.queryByRole("heading", { name: "Revisar agendamento" }))
      .not.toBeInTheDocument();
    expect(screen.queryByText("Disponível")).not.toBeInTheDocument();
  });

  it("invalida a previa recorrente quando o conflito surge na confirmacao", async () => {
    previewSchedulingOccurrences.mockResolvedValue({
      data: {
        occurrences_preview: [
          buildPreviewOccurrence(1, "2026-07-06"),
          buildPreviewOccurrence(2, "2026-07-13"),
        ],
        summary: buildPreviewSummary({ total: 2, available: 2, warn: 0, blocked: 0 }),
        validation: buildAvailabilityValidation(),
      },
    });
    const conflictError = new Error("Este paciente já possui um atendimento nesse horário.");
    conflictError.response = {
      status: 409,
      data: {
        code: "PATIENT_SCHEDULE_CONFLICT",
        error: "Este paciente já possui um atendimento nesse horário.",
        conflicts: [{ starts_at: "2026-07-13T13:00:00.000Z" }],
      },
    };
    axios.post.mockRejectedValue(conflictError);

    const { container } = renderAgendamentos();
    await openNewRecurringReview(container);
    expect(await screen.findAllByText("Disponível")).toHaveLength(2);
    fireEvent.click(screen.getByRole("button", { name: "Confirmar agendamento" }));

    const conflictMessage = await screen.findByText("Paciente já agendado nesse horário");
    const conflictRow = conflictMessage.parentElement?.parentElement
      ?.parentElement?.parentElement;
    expect(conflictRow).toBeTruthy();
    expect(within(conflictRow).getByRole("checkbox")).toBeDisabled();
    expect(screen.getAllByRole("checkbox").some(
      (checkbox) => checkbox.checked && checkbox.disabled,
    )).toBe(true);
    expect(screen.getByRole("button", { name: "Confirmar agendamento" })).toBeDisabled();
    expect(axios.post.mock.calls.filter(([url]) => url === "/session-series")).toHaveLength(1);
  });

  it("invalida escolhas e overrides quando a confirmacao devolve nova previa", async () => {
    previewSchedulingOccurrences.mockResolvedValue({
      data: {
        occurrences_preview: [
          buildPreviewOccurrence(1, "2026-07-06"),
          buildPreviewOccurrence(2, "2026-07-13"),
        ],
        summary: buildPreviewSummary({ total: 2, available: 2, warn: 0, blocked: 0 }),
        validation: buildAvailabilityValidation(),
      },
    });
    const changedError = new Error("A disponibilidade mudou. Revise novamente.");
    changedError.response = {
      status: 409,
      data: {
        code: "SCHEDULING_AVAILABILITY_CHANGED",
        error: "A disponibilidade mudou. Revise novamente.",
        occurrences_preview: [
          buildPreviewOccurrence(1, "2026-07-06"),
          {
            ...buildPreviewOccurrence(2, "2026-07-13"),
            status: "WARN_CONFIRM",
	            matched_events: [{ id: 901, name: "Alerta operacional" }],
	            requires_confirmation: true,
	            availability: buildOperationalAvailability({
	              hasWarningEvents: true,
	              matchedEvents: [{ id: 901, name: "Alerta operacional" }],
	            }),
          },
        ],
        summary: buildPreviewSummary({ total: 2, available: 1, warn: 1, blocked: 0 }),
        validation: buildAvailabilityValidation(),
      },
    };
    axios.post.mockRejectedValue(changedError);

    const { container } = renderAgendamentos();
    await openNewRecurringReview(container);
    expect(await screen.findAllByText("Disponível")).toHaveLength(2);
    expect(screen.getAllByRole("checkbox").filter((checkbox) => checkbox.checked))
      .toHaveLength(2);
    fireEvent.click(screen.getByRole("button", { name: "Confirmar agendamento" }));

    expect(await screen.findByText("Alerta")).toBeInTheDocument();
    expect(screen.getAllByRole("checkbox").filter((checkbox) => checkbox.checked))
      .toHaveLength(0);
    expect(screen.getAllByRole("checkbox").filter((checkbox) => checkbox.disabled).length)
      .toBeGreaterThanOrEqual(2);
    expect(screen.getByRole("button", { name: "Confirmar agendamento" })).toBeDisabled();
    expect(axios.post.mock.calls.filter(([url]) => url === "/session-series")).toHaveLength(1);
  });

  it("falha fechada quando a confirmacao devolve previa recorrente nao-array", async () => {
    previewSchedulingOccurrences.mockResolvedValue({
      data: {
        occurrences_preview: [
          buildPreviewOccurrence(1, "2026-07-06"),
          buildPreviewOccurrence(2, "2026-07-13"),
        ],
        summary: buildPreviewSummary({ total: 2, available: 2, warn: 0, blocked: 0 }),
        validation: buildAvailabilityValidation(),
      },
    });
    const malformedError = new Error("A disponibilidade mudou. Revise novamente.");
    malformedError.response = {
      status: 409,
      data: {
        code: "SCHEDULING_AVAILABILITY_CHANGED",
        error: "A disponibilidade mudou. Revise novamente.",
        occurrences_preview: {},
        summary: buildPreviewSummary({ total: 1, available: 1, warn: 0, blocked: 0 }),
        validation: buildAvailabilityValidation(),
      },
    };
    axios.post.mockRejectedValue(malformedError);

    const { container } = renderAgendamentos();
    await openNewRecurringReview(container);
    fireEvent.click(await screen.findByRole("button", { name: "Confirmar agendamento" }));

    expect(await screen.findAllByText("A disponibilidade mudou. Revise novamente."))
      .toHaveLength(2);
    expect(screen.getAllByRole("checkbox").filter((checkbox) => checkbox.checked))
      .toHaveLength(0);
    expect(screen.getAllByRole("checkbox").filter((checkbox) => checkbox.disabled).length)
      .toBeGreaterThanOrEqual(2);
    expect(screen.getByRole("button", { name: "Confirmar agendamento" })).toBeDisabled();
    expect(axios.post.mock.calls.filter(([url]) => url === "/session-series")).toHaveLength(1);
  });

  it("falha fechada para validacao agregada recorrente contraditoria", async () => {
    previewSchedulingOccurrences.mockResolvedValue({
      data: {
        occurrences_preview: [
          buildPreviewOccurrence(1, "2026-07-06"),
          buildPreviewOccurrence(2, "2026-07-13"),
        ],
        summary: buildPreviewSummary({ total: 2, available: 2, warn: 0, blocked: 0 }),
        validation: buildAvailabilityValidation({
          canConfirm: false,
          blockingCode: "PATIENT_SCHEDULE_CONFLICT",
          blockingReason: "Paciente já agendado nesse horário",
        }),
      },
    });

    const { container } = renderAgendamentos();
    await openNewRecurringReview(container);

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(
      "Não foi possível gerar a pré-visualização das ocorrências.",
    ));
    expect(screen.queryByRole("heading", { name: "Revisar agendamento" }))
      .not.toBeInTheDocument();
    expect(screen.queryByText("Disponível")).not.toBeInTheDocument();
  });

  it("falha fechada quando o codigo da ocorrencia diverge da validacao recorrente", async () => {
    previewSchedulingOccurrences.mockResolvedValue({
      data: {
        occurrences_preview: [{
          ...buildPreviewOccurrence(1, "2026-07-06"),
          status: "BLOCK",
          can_override_block: true,
	          can_create: false,
          blocking_code: "PATIENT_SCHEDULE_CONFLICT",
          blocking_reason: "Paciente já agendado nesse horário",
	          availability: buildOperationalAvailability({
	            hasBlockingEvents: true,
	            blockingReason: "Paciente já agendado nesse horário",
	            allowAdminOverrideBlock: true,
	          }),
        }],
        summary: buildPreviewSummary({
          total: 1,
          available: 0,
          warn: 0,
          blocked: 1,
          overrideableBlocked: 1,
        }),
        validation: buildAvailabilityValidation(),
      },
    });

    const { container } = renderAgendamentos();
    await openNewRecurringReview(container);

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(
      "Não foi possível gerar a pré-visualização das ocorrências.",
    ));
    expect(screen.queryByRole("heading", { name: "Revisar agendamento" }))
      .not.toBeInTheDocument();
    expect(screen.queryByText("Paciente já agendado nesse horário"))
      .not.toBeInTheDocument();
  });

  it("falha fechada quando o resumo recorrente diverge das ocorrencias", async () => {
    previewSchedulingOccurrences.mockResolvedValue({
      data: {
        occurrences_preview: [
          buildPreviewOccurrence(1, "2026-07-06"),
          buildPreviewOccurrence(2, "2026-07-13"),
        ],
        summary: buildPreviewSummary({ total: 2, available: 1, warn: 0, blocked: 0 }),
        validation: buildAvailabilityValidation(),
      },
    });

    const { container } = renderAgendamentos();
    await openNewRecurringReview(container);

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(
      "Não foi possível gerar a pré-visualização das ocorrências.",
    ));
    expect(screen.queryByRole("heading", { name: "Revisar agendamento" }))
      .not.toBeInTheDocument();
  });

  it("falha fechada quando a disponibilidade aninhada recorrente esta incompleta", async () => {
    const occurrence = buildPreviewOccurrence(1, "2026-07-06");
    delete occurrence.availability.has_warning_events;
    previewSchedulingOccurrences.mockResolvedValue({
      data: {
        occurrences_preview: [occurrence],
        summary: buildPreviewSummary({ total: 1, available: 1, warn: 0, blocked: 0 }),
        validation: buildAvailabilityValidation(),
      },
    });

    const { container } = renderAgendamentos();
    await openNewRecurringReview(container);

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(
      "Não foi possível gerar a pré-visualização das ocorrências.",
    ));
    expect(screen.queryByRole("heading", { name: "Revisar agendamento" }))
      .not.toBeInTheDocument();
  });

  it("falha fechada para indices recorrentes duplicados", async () => {
    previewSchedulingOccurrences.mockResolvedValue({
      data: {
        occurrences_preview: [
          buildPreviewOccurrence(1, "2026-07-06"),
          { ...buildPreviewOccurrence(2, "2026-07-13"), index: 1 },
        ],
        summary: buildPreviewSummary({ total: 2, available: 2, warn: 0, blocked: 0 }),
        validation: buildAvailabilityValidation(),
      },
    });

    const { container } = renderAgendamentos();
    await openNewRecurringReview(container);

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(
      "Não foi possível gerar a pré-visualização das ocorrências.",
    ));
    expect(screen.queryByRole("heading", { name: "Revisar agendamento" }))
      .not.toBeInTheDocument();
  });

  it("usa quantidade de meses como janela de vigencia no modo Por meses", async () => {
    const { container } = renderAgendamentos();

    expect(await screen.findByText("Paciente Teste")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Novo agendamento" }));
    fireEvent.change(await screen.findByPlaceholderText("Buscar paciente"), {
      target: { value: "Paciente Teste" },
    });
    const patientSuggestions = await screen.findAllByText("Paciente Teste");
    fireEvent.click(patientSuggestions.find((element) => element.tagName === "BUTTON"));
    await selectAssignedProfessional(container);

    fireEvent.change(container.querySelector('select[name="service_id"]'), {
      target: { value: "40" },
    });
    fireEvent.change(container.querySelector('input[type="date"]'), {
      target: { value: "2026-07-06" },
    });
    const hourSelect = Array.from(container.querySelectorAll("select"))
      .find((select) => Array.from(select.options).some((option) => option.value === "10"));
    fireEvent.change(hourSelect, { target: { value: "10" } });

    fireEvent.click(screen.getByRole("button", { name: "+ Adicionar" }));
    fireEvent.click(screen.getByRole("button", { name: "Por meses" }));
    fireEvent.change(screen.getByPlaceholderText("Ex.: 2"), {
      target: { value: "2" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Revisar agendamento" }));

    await waitFor(() => expect(previewSchedulingOccurrences).toHaveBeenCalledWith(
      expect.objectContaining({
        repeat_interval: 1,
        until_date: "2026-09-05",
        occurrence_count: null,
        billing_mode: "per_session",
      }),
    ));
  });

  it("mantem o agendamento comum no catalogo 7 sem exigir o contrato de conflito do catalogo 8", async () => {
    mockAuthorization = {
      ...mockAuthorization,
      context: { ...mockAuthorization.context, catalog_version: 7 },
      hasCapability: jest.fn(() => true),
    };
    checkSchedulingAvailability.mockResolvedValue(buildLegacySingleAvailabilityResponse());

    const { container } = renderAgendamentos();
    await openNewSingleReview(container);

    expect(await screen.findByText("Sem bloqueio operacional")).toBeInTheDocument();
    expect(screen.queryByText("Disponível")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Usar pacote de outro paciente")).not.toBeInTheDocument();
    expect(checkSchedulingAvailability.mock.calls.some(
      ([payload]) => Object.prototype.hasOwnProperty.call(payload, "patient_id"),
    )).toBe(false);

    fireEvent.click(screen.getByRole("button", { name: "Confirmar agendamento" }));
    await waitFor(() => expect(axios.post).toHaveBeenCalledWith(
      "/sessions",
      expect.objectContaining({
        patient_id: 20,
        force_override: false,
        override_reason: null,
      }),
    ));
  });

  it("mantem a revisao recorrente do catalogo 7 identificada como checagem operacional", async () => {
    mockAuthorization = {
      ...mockAuthorization,
      context: { ...mockAuthorization.context, catalog_version: 7 },
    };
    previewSchedulingOccurrences.mockResolvedValue({
      data: {
        occurrences_preview: [
          buildLegacyPreviewOccurrence(1, "2026-07-06"),
          buildLegacyPreviewOccurrence(2, "2026-07-13"),
        ],
        summary: { total: 2, available: 2, warn: 0, blocked: 0 },
      },
    });

    const { container } = renderAgendamentos();
    await openNewRecurringReview(container);

    expect(await screen.findAllByText("Sem bloqueio operacional")).toHaveLength(2);
    expect(screen.queryByText("Disponível")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Confirmar agendamento" })).toBeEnabled();
  });

	  it("bloqueia na revisao o conflito conhecido do paciente", async () => {
	    checkSchedulingAvailability.mockImplementation((payload) => Promise.resolve(
	      payload?.patient_id
	        ? buildSingleAvailabilityResponse({
	          canConfirm: false,
	          blockingCode: "PATIENT_SCHEDULE_CONFLICT",
	          blockingReason: "Paciente já agendado nesse horário",
	          canOverrideBlock: false,
	          hasBlockingEvents: true,
	        })
	        : buildSingleAvailabilityResponse(),
	    ));

	    const { container } = renderAgendamentos();
	    await openNewSingleReview(container);

	    expect(await screen.findByText("Paciente já agendado nesse horário"))
	      .toBeInTheDocument();
	    expect(screen.queryByText("Disponível")).not.toBeInTheDocument();
	  expect(screen.getAllByRole("checkbox").some((checkbox) => checkbox.disabled)).toBe(true);
	    expect(screen.getByRole("button", { name: "Confirmar agendamento" }))
	      .toBeDisabled();
	    expect(screen.queryByText("Motivo do override (obrigatório)"))
	      .not.toBeInTheDocument();
	    expect(checkSchedulingAvailability).toHaveBeenCalledWith(expect.objectContaining({
	      patient_id: 20,
	      professional_user_id: 30,
	      service_id: 40,
	    }));
	  });

  it("falha fechada para conflito unitario contraditorio no catalogo 8", async () => {
    checkSchedulingAvailability.mockImplementation((payload) => Promise.resolve(
      payload?.patient_id
        ? buildSingleAvailabilityResponse({
          canConfirm: true,
          blockingCode: "PATIENT_SCHEDULE_CONFLICT",
          blockingReason: "Paciente já agendado nesse horário",
          canOverrideBlock: false,
          hasBlockingEvents: true,
        })
        : buildSingleAvailabilityResponse(),
    ));

    const { container } = renderAgendamentos();
    await openNewSingleReview(container);

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(
      "Não foi possível validar disponibilidade.",
    ));
    expect(screen.queryByRole("heading", { name: "Revisar agendamento" }))
      .not.toBeInTheDocument();
    expect(screen.queryByText("Disponível")).not.toBeInTheDocument();
    expect(axios.post.mock.calls.some(([url]) => url === "/sessions")).toBe(false);
  });

  it("falha fechada quando o codigo unitario diverge da validacao no catalogo 8", async () => {
    checkSchedulingAvailability.mockImplementation((payload) => {
      if (!payload?.patient_id) return Promise.resolve(buildSingleAvailabilityResponse());
      const response = buildSingleAvailabilityResponse();
      response.data.blocking_code = "SCHEDULING_BLOCKED";
      response.data.blocking_reason = "Bloqueio divergente";
      return Promise.resolve(response);
    });

    const { container } = renderAgendamentos();
    await openNewSingleReview(container);

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(
      "Não foi possível validar disponibilidade.",
    ));
    expect(screen.queryByRole("heading", { name: "Revisar agendamento" }))
      .not.toBeInTheDocument();
    expect(axios.post.mock.calls.some(([url]) => url === "/sessions")).toBe(false);
  });

  it("falha fechada quando allowed contradiz o bloqueio unitario", async () => {
    checkSchedulingAvailability.mockImplementation((payload) => {
      if (!payload?.patient_id) return Promise.resolve(buildSingleAvailabilityResponse());
      const response = buildSingleAvailabilityResponse();
      response.data.allowed = false;
      return Promise.resolve(response);
    });

    const { container } = renderAgendamentos();
    await openNewSingleReview(container);

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(
      "Não foi possível validar disponibilidade.",
    ));
    expect(screen.queryByRole("heading", { name: "Revisar agendamento" }))
      .not.toBeInTheDocument();
  });

  it("propaga o override unitario somente apos selecao explicita e motivo", async () => {
    checkSchedulingAvailability.mockImplementation((payload) => Promise.resolve(
      payload?.patient_id
        ? buildSingleAvailabilityResponse({
          canConfirm: true,
          blockingCode: "SCHEDULING_BLOCKED",
          blockingReason: "Bloqueio operacional com exceção autorizada",
          canOverrideBlock: true,
          hasBlockingEvents: true,
        })
        : buildSingleAvailabilityResponse(),
    ));

    const { container } = renderAgendamentos();
    await openNewSingleReview(container);

    expect(await screen.findByText("Bloqueado")).toBeInTheDocument();
    const occurrenceCheckbox = screen.getAllByRole("checkbox").at(-1);
    expect(occurrenceCheckbox).not.toBeChecked();
    expect(screen.getByRole("button", { name: "Confirmar agendamento" })).toBeDisabled();

    fireEvent.click(occurrenceCheckbox);
    expect(screen.getByText("Motivo do override (obrigatório)")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Confirmar agendamento" }));
    expect(toast.error).toHaveBeenCalledWith(
      "Informe o motivo para override em ocorrencias bloqueadas.",
    );
    expect(axios.post.mock.calls.filter(([url]) => url === "/sessions")).toHaveLength(0);

    fireEvent.change(screen.getAllByRole("textbox").at(-1), {
      target: { value: "Recepção confirmou a exceção operacional" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Confirmar agendamento" }));

    await waitFor(() => expect(axios.post).toHaveBeenCalledWith(
      "/sessions",
      expect.objectContaining({
        force_override: true,
        override_reason: "Recepção confirmou a exceção operacional",
      }),
    ));
  });

  it("mantem bloqueado o override unitario quando o Backend nao o autoriza", async () => {
    checkSchedulingAvailability.mockImplementation((payload) => Promise.resolve(
      payload?.patient_id
        ? buildSingleAvailabilityResponse({
          canConfirm: false,
          blockingCode: "SCHEDULING_BLOCKED",
          blockingReason: "Bloqueio operacional sem exceção",
          canOverrideBlock: false,
          hasBlockingEvents: true,
        })
        : buildSingleAvailabilityResponse(),
    ));

    const { container } = renderAgendamentos();
    await openNewSingleReview(container);

    expect(await screen.findByText("Bloqueado")).toBeInTheDocument();
    expect(screen.getAllByRole("checkbox").at(-1)).toBeDisabled();
    expect(screen.getByRole("button", { name: "Confirmar agendamento" })).toBeDisabled();
    expect(screen.queryByText("Motivo do override (obrigatório)"))
      .not.toBeInTheDocument();
  });

  it("invalida o override unitario quando a data e reavaliada sem bloqueio", async () => {
    let completeChecks = 0;
    checkSchedulingAvailability.mockImplementation((payload) => {
      if (!payload?.patient_id) return Promise.resolve(buildSingleAvailabilityResponse());
      completeChecks += 1;
      return Promise.resolve(completeChecks === 1
        ? buildSingleAvailabilityResponse({
          canConfirm: true,
          blockingCode: "SCHEDULING_BLOCKED",
          blockingReason: "Bloqueio operacional com exceção autorizada",
          canOverrideBlock: true,
          hasBlockingEvents: true,
        })
        : buildSingleAvailabilityResponse());
    });

    const { container } = renderAgendamentos();
    await openNewSingleReview(container);
    await screen.findByText("Bloqueado");
    fireEvent.click(screen.getAllByRole("checkbox").at(-1));
    fireEvent.change(screen.getAllByRole("textbox").at(-1), {
      target: { value: "Exceção anterior" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Editar" }));
    fireEvent.change(document.getElementById("recurrence-edit-date-1"), {
      target: { value: "2026-07-21" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    expect(await screen.findByText("Disponível · Alterada")).toBeInTheDocument();
    expect(screen.queryByText("Motivo do override (obrigatório)"))
      .not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Confirmar agendamento" }));

    await waitFor(() => expect(axios.post).toHaveBeenCalledWith(
      "/sessions",
      expect.objectContaining({
        starts_at: "2026-07-21T13:00:00.000Z",
        force_override: false,
        override_reason: null,
      }),
    ));
  });

	  it("no catalogo 8 falha fechada para contrato incompleto e permite revisar novamente", async () => {
	    let completeChecks = 0;
	    checkSchedulingAvailability.mockImplementation((payload) => {
	      if (!payload?.patient_id) return Promise.resolve(buildSingleAvailabilityResponse());
	      completeChecks += 1;
	      if (completeChecks === 1) {
	        return Promise.resolve({
	          data: {
	            has_blocking_events: false,
	            requires_confirmation: false,
	            matched_events: [],
	            severity: "info",
	          },
	        });
	      }
	      return Promise.resolve(buildSingleAvailabilityResponse());
	    });

	    const { container } = renderAgendamentos();
	    await openNewSingleReview(container);
	    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(
	      "Não foi possível validar disponibilidade.",
	    ));
	    expect(screen.queryByRole("heading", { name: "Revisar agendamento" }))
	      .not.toBeInTheDocument();

	    fireEvent.click(screen.getByRole("button", { name: "Revisar agendamento" }));
	    expect(await screen.findByRole("heading", { name: "Revisar agendamento" }))
	      .toBeInTheDocument();
	    expect(screen.getByText("Disponível")).toBeInTheDocument();
	    expect(screen.getByRole("button", { name: "Confirmar agendamento" }))
	      .toBeEnabled();
	  });

	  it("transforma o conflito surgido na confirmacao em bloqueio da revisao", async () => {
	    axios.post.mockRejectedValueOnce({
	      response: {
	        status: 409,
	        data: {
	          code: "PATIENT_SCHEDULE_CONFLICT",
	          error: "Este paciente já possui um atendimento nesse horário.",
	        },
	      },
	    });

	    const { container } = renderAgendamentos();
	    await openNewSingleReview(container);
	    expect(await screen.findByText("Disponível")).toBeInTheDocument();
	    fireEvent.click(screen.getByRole("button", { name: "Confirmar agendamento" }));

	    expect(await screen.findByText("Paciente já agendado nesse horário"))
	      .toBeInTheDocument();
	    expect(screen.queryByText("Disponível")).not.toBeInTheDocument();
	  expect(screen.getAllByRole("checkbox").some((checkbox) => checkbox.disabled)).toBe(true);
	    expect(screen.getByRole("button", { name: "Confirmar agendamento" }))
	      .toBeDisabled();
	    expect(toast.error).toHaveBeenCalledWith(
	      "Este paciente já possui um atendimento nesse horário.",
	    );
	    expect(axios.post.mock.calls.filter(([url]) => url === "/sessions")).toHaveLength(1);
	  });

	  it("reavalia novo horario sem perder paciente profissional ou servico", async () => {
	    const { container } = renderAgendamentos();
	    await openNewSingleReview(container);
	  expect(await screen.findByText("Disponível")).toBeInTheDocument();
	    fireEvent.click(screen.getByRole("button", { name: "Editar" }));

	    const dateInput = document.getElementById("recurrence-edit-date-1");
	    fireEvent.change(dateInput, { target: { value: "2026-07-21" } });
	    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

	    await waitFor(() => expect(checkSchedulingAvailability).toHaveBeenCalledWith(
	      expect.objectContaining({
	        patient_id: 20,
	        professional_user_id: 30,
	        service_id: 40,
	        starts_at: "2026-07-21T13:00:00.000Z",
	      }),
	    ));
	  expect(await screen.findByText("Disponível · Alterada")).toBeInTheDocument();
	    expect(screen.getByText(/21\/07\/2026/)).toBeInTheDocument();
	  });

  it("fluxo aprovado: começa somente com paciente e não consulta direitos antes da seleção", async () => {
    renderAgendamentos();
    const form = await openCreationForm();
    expect(within(form).getAllByRole("searchbox")).toHaveLength(1);
    expect(form.querySelectorAll("input, select, textarea")).toHaveLength(1);
    expect(within(form).queryByRole("radio")).not.toBeInTheDocument();
    expect(within(form).queryByText("Tipo de atendimento")).not.toBeInTheDocument();
    expect(within(form).queryByText("Valor da sessão")).not.toBeInTheDocument();
    expect(within(form).queryByRole("button", { name: "Agendar depois" })).not.toBeInTheDocument();
    expect(axios.get.mock.calls.some(([url]) => String(url).includes("available-rights"))).toBe(false);
  });

  it("fluxo aprovado: loading e erro bloqueiam detalhes e comandos; retry resolve zero saldo sem confirmação", async () => {
    const get = axios.get.getMockImplementation();
    let reject;
    let requests = 0;
    axios.get.mockImplementation((url, config) => {
      if (url !== "/patients/20/available-rights") return get(url, config);
      requests += 1;
      if (requests > 1) return Promise.resolve({ data: [] });
      return new Promise((_, fail) => { reject = fail; });
    });
    renderAgendamentos();
    const form = await openCreationForm();
    await selectCreationPatient();
    expect(await within(form).findByText(/Consultando sessões/)).toBeInTheDocument();
    expect(within(form).queryByText("Tipo de atendimento")).not.toBeInTheDocument();
    fireEvent.submit(form);
    expect(axios.post).not.toHaveBeenCalled();
    await act(async () => reject(new Error("offline")));
    expect(await within(form).findByText(/Não foi possível consultar/)).toBeInTheDocument();
    expect(within(form).queryByText(/Nenhuma sessão disponível/)).not.toBeInTheDocument();
    fireEvent.submit(form);
    expect(axios.post).not.toHaveBeenCalled();
    fireEvent.click(within(form).getByRole("button", { name: "Tentar novamente" }));
    expect(await within(form).findByText(/Nenhuma sessão disponível/)).toBeInTheDocument();
    expect(await within(form).findByText("Tipo de atendimento")).toBeInTheDocument();
    expect(within(form).getByLabelText("Fazer novo lançamento")).toBeChecked();
    expect(within(form).getByLabelText("Usar pacote de outro paciente")).toBeEnabled();
  });

  it("fluxo aprovado: saldo exige origem explícita; próprio, outro e novo são exclusivos", async () => {
    const get = axios.get.getMockImplementation();
    axios.get.mockImplementation((url, config) => String(url).includes("available-rights")
      ? Promise.resolve({ data: ownRights }) : get(url, config));
    const { container } = renderAgendamentos();
    const form = await openCreationForm();
    await selectCreationPatient();
    await within(form).findByLabelText(/Fisioterapia - 3 sessões disponíveis/);
    expect(within(form).getAllByRole("radio").every((radio) => !radio.checked)).toBe(true);
    expect(within(form).queryByText("Tipo de atendimento")).not.toBeInTheDocument();
    fireEvent.submit(form);
    expect(axios.post).not.toHaveBeenCalled();
    fireEvent.click(within(form).getByLabelText("Fazer novo lançamento"));
    fireEvent.click(within(form).getByRole("button", { name: "+ Adicionar" }));
    fireEvent.change(container.querySelector('input[placeholder="Ex.: 10"]'), { target: { value: "3" } });
    fireEvent.click(within(form).getByLabelText(/Fisioterapia - 3 sessões disponíveis/));
    expect(within(form).getByLabelText("Fazer novo lançamento")).not.toBeChecked();
    expect(within(form).queryByText("Mais sessões")).not.toBeInTheDocument();
    expect(within(form).queryByRole("button", { name: "Agendar agora" })).not.toBeInTheDocument();
    expect(within(form).queryByRole("button", { name: "Agendar depois" })).not.toBeInTheDocument();
    expect(form.querySelector('select[name="service_id"]')).toBeDisabled();
    expect(within(form).queryByText("Valor da sessão")).not.toBeInTheDocument();
    fireEvent.click(within(form).getByLabelText("Usar pacote de outro paciente"));
    expect(within(form).getByLabelText(/Fisioterapia - 3 sessões disponíveis/)).not.toBeChecked();
    expect(within(form).getAllByRole("radio").filter((radio) => radio.checked)).toHaveLength(1);
    expect(within(form).getByText("De quem é o pacote?")).toBeInTheDocument();
    expect(within(form).queryByRole("button", { name: "Agendar depois" })).not.toBeInTheDocument();
    fireEvent.click(within(form).getByLabelText("Fazer novo lançamento"));
    expect(within(form).queryByText("De quem é o pacote?")).not.toBeInTheDocument();
    expect(within(form).getByRole("button", { name: "Agendar depois" })).toBeInTheDocument();
  });

  it("fluxo aprovado: resposta atrasada não escolhe origem do paciente seguinte; troca limpa origem e notas", async () => {
    const get = axios.get.getMockImplementation();
    let first;
    let second;
    axios.get.mockImplementation((url, config) => {
      if (url === "/patients/20/available-rights") return new Promise((resolve) => { first = resolve; });
      if (url === "/patients/21/available-rights") return new Promise((resolve) => { second = resolve; });
      return get(url, config);
    });
    renderAgendamentos();
    const form = await openCreationForm();
    await selectCreationPatient();
    await selectCreationPatient("Paciente Cancelado");
    await act(async () => first({ data: [] }));
    expect(within(form).queryByText("Tipo de atendimento")).not.toBeInTheDocument();
    await act(async () => second({ data: ownRights }));
    expect(await within(form).findByLabelText(/Fisioterapia - 3/)).not.toBeChecked();
    expect(within(form).getByLabelText("Fazer novo lançamento")).not.toBeChecked();
    fireEvent.click(within(form).getByLabelText("Fazer novo lançamento"));
    fireEvent.change(form.querySelector('textarea[name="launch_notes"]'), { target: { value: "Anterior" } });
    fireEvent.change(form.querySelector('textarea[name="notes"]'), { target: { value: "Sessão anterior" } });
    await selectCreationPatient();
    expect(within(form).queryByText("Tipo de atendimento")).not.toBeInTheDocument();
    await act(async () => first({ data: [] }));
    await within(form).findByText("Tipo de atendimento");
    expect(form.querySelector('textarea[name="launch_notes"]')).toHaveValue("");
    expect(form.querySelector('textarea[name="notes"]')).toHaveValue("");
    expect(form.querySelector('select[name="service_id"]')).toHaveValue("");
  });

  it("fluxo aprovado: agora/depois compartilham paciente e campos; lançamento não envia datas ou notas de sessão", async () => {
    mockAuthorization = { ...mockAuthorization, isAdministrator: true, canAccessModule: jest.fn(() => true) };
    const get = axios.get.getMockImplementation();
    axios.get.mockImplementation((url, config) => url === "/session-replacement-credits"
      ? Promise.resolve({ data: [{ id: 901, source_service_id: 40, source_service_type: "spine_eval" }] })
      : get(url, config));
    renderAgendamentos();
    const form = await openCreationForm();
    await selectCreationPatient();
    await within(form).findByText("Tipo de atendimento");
    fireEvent.change(form.querySelector('select[name="service_id"]'), { target: { value: "40" } });
    fireEvent.change(form.querySelector('textarea[name="launch_notes"]'), { target: { value: "Compra independente" } });
    fireEvent.change(form.querySelector('textarea[name="notes"]'), { target: { value: "Sessão independente" } });
    fireEvent.change(form.querySelector('input[name="session_price"]'), { target: { value: "" } });
    fireEvent.click(within(form).getByRole("button", { name: "Agendar depois" }));
    expect(within(form).getAllByRole("searchbox")).toHaveLength(1);
    expect(form.querySelector('select[name="professional_user_id"]')).toBeNull();
    expect(form.querySelector('input[type="date"]')).toBeNull();
    expect(form.querySelector('textarea[name="notes"]')).toBeNull();
    expect(form.querySelector('select[name="session_replacement_credit_id"]')).toBeNull();
    fireEvent.change(form.querySelector('input[name="purchase_quantity"]'), { target: { value: "3" } });
    fireEvent.click(within(form).getByRole("button", { name: "Agendar agora" }));
    expect(form.querySelector('textarea[name="notes"]')).toHaveValue("Sessão independente");
    expect(form.querySelector('textarea[name="launch_notes"]')).toHaveValue("Compra independente");
    expect(form.querySelector('input[placeholder="Ex.: 10"]')).toHaveValue(3);
    fireEvent.click(within(form).getByRole("button", { name: "Agendar depois" }));
    fireEvent.click(within(form).getByRole("button", { name: "Lançar e agendar depois" }));
    await waitFor(() => expect(axios.post).toHaveBeenCalledWith("/package-purchases", expect.objectContaining({
      patient_id: 20, service_id: 40, quantity: 3, launch_notes: "Compra independente",
    })));
    const body = axios.post.mock.calls.find(([url]) => url === "/package-purchases")[1];
    expect(body).not.toHaveProperty("starts_at");
    expect(body).not.toHaveProperty("professional_user_id");
    expect(body).not.toHaveProperty("notes");
    expect(body).not.toHaveProperty("price_override_cents");
    expect(axios.post.mock.calls.some(([url]) => url === "/sessions" || url === "/session-series")).toBe(false);
  });

  it("fluxo aprovado: resultado incerto congela origem e modo e verifica a mesma compra", async () => {
    mockAuthorization = { ...mockAuthorization, isAdministrator: true, canAccessModule: jest.fn(() => true) };
    axios.post.mockRejectedValueOnce(new Error("Resposta perdida")).mockResolvedValueOnce({ data: {} });
    renderAgendamentos();
    const form = await openCreationForm();
    await selectCreationPatient(); await within(form).findByText("Tipo de atendimento");
    fireEvent.change(form.querySelector('select[name="service_id"]'), { target: { value: "40" } });
    fireEvent.click(within(form).getByRole("button", { name: "Agendar depois" }));
    fireEvent.click(within(form).getByRole("button", { name: "Lançar e agendar depois" }));
    await within(form).findByRole("button", { name: "Verificar lançamento" });
    expect(form.querySelector("fieldset")).toBeDisabled();
    fireEvent.click(within(form).getByRole("button", { name: "Agendar agora" }));
    fireEvent.click(within(form).getByLabelText("Usar pacote de outro paciente"));
    expect(within(form).getByRole("button", { name: "Verificar lançamento" })).toBeInTheDocument();
    fireEvent.click(within(form).getByRole("button", { name: "Verificar lançamento" }));
    await waitFor(() => expect(axios.post).toHaveBeenCalledTimes(2));
    expect(axios.post.mock.calls[1][1]).toEqual(axios.post.mock.calls[0][1]);
  });

  it("agenda direito próprio pela revisão sem novo lançamento financeiro", async () => {
    const originalGet = axios.get.getMockImplementation();
    axios.get.mockImplementation((url, config) => url === "/patients/20/available-rights"
      ? Promise.resolve({ data: [{ id: 701, quantity: 2, free_rights: 2, review_token: "own-review",
        service: { id: 40, code: "physio", name: "Fisioterapia" } }] }) : originalGet(url, config));
    const { container } = renderAgendamentos();
    await openNewSingleReview(container, { ownRight: true });
    await screen.findByText("Disponível");
    fireEvent.click(screen.getByRole("button", { name: "Confirmar agendamento" }));
    await waitFor(() => expect(axios.post).toHaveBeenCalledWith("/sessions", expect.objectContaining({
      patient_id: 20, shared_package_id: 701, use_own_package: true,
    })));
    const payload = axios.post.mock.calls.find(([url]) => url === "/sessions")[1];
    expect(payload).not.toHaveProperty("purchase_launch");
    expect(payload).not.toHaveProperty("launch_notes");
    expect(payload.idempotency_key).toMatch(/^own-right:/);
  });

  it("fluxo aprovado: prévia tardia de nova série não reabre compra após selecionar direito próprio", async () => {
    const get = axios.get.getMockImplementation();
    axios.get.mockImplementation((url, config) => String(url).includes("available-rights")
      ? Promise.resolve({ data: ownRights }) : get(url, config));
    const pendingPreview = createDeferred();
    previewSchedulingOccurrences.mockReturnValueOnce(pendingPreview.promise);
    const { container } = renderAgendamentos();
    const form = await openCreationForm();
    await selectCreationPatient();
    fireEvent.click(await within(form).findByLabelText("Fazer novo lançamento"));
    await selectAssignedProfessional(container);
    fireEvent.change(form.querySelector('select[name="service_id"]'), { target: { value: "41" } });
    fireEvent.change(form.querySelector('input[type="date"]'), { target: { value: "2026-07-06" } });
    const hour = Array.from(form.querySelectorAll("select"))
      .find((select) => Array.from(select.options).some((option) => option.value === "10"));
    fireEvent.change(hour, { target: { value: "10" } });
    fireEvent.click(within(form).getByRole("button", { name: "+ Adicionar" }));
    fireEvent.change(form.querySelector('input[placeholder="Ex.: 10"]'), { target: { value: "2" } });
    fireEvent.click(within(form).getByRole("button", { name: "Revisar agendamento" }));
    await waitFor(() => expect(previewSchedulingOccurrences).toHaveBeenCalledTimes(1));
    fireEvent.click(within(form).getByLabelText(/Fisioterapia - 3 sessões disponíveis/));
    await act(async () => pendingPreview.resolve({ data: {
      occurrences_preview: [buildPreviewOccurrence(1, "2026-07-06"), buildPreviewOccurrence(2, "2026-07-13")],
      summary: buildPreviewSummary({ total: 2, available: 2, warn: 0, blocked: 0 }),
      validation: buildAvailabilityValidation(),
    } }));
    expect(screen.queryByRole("heading", { name: "Revisar agendamento" })).not.toBeInTheDocument();
    expect(within(form).queryByText("Mais sessões")).not.toBeInTheDocument();
    await submitAndConfirmReview();
    await waitFor(() => expect(axios.post).toHaveBeenCalledWith("/sessions", expect.objectContaining({
      use_own_package: true, shared_package_id: 701,
    })));
    expect(axios.post.mock.calls.some(([url]) => url === "/session-series" || url === "/package-purchases")).toBe(false);
    expect(axios.post.mock.calls.find(([url]) => url === "/sessions")[1]).not.toHaveProperty("purchase_launch");
  });

  it("fluxo aprovado: compra agora rejeita seleção parcial e lança todas as sessões na mesma confirmação", async () => {
    previewSchedulingOccurrences.mockResolvedValue({ data: {
      occurrences_preview: [buildPreviewOccurrence(1, "2026-07-06"), buildPreviewOccurrence(2, "2026-07-13")],
      summary: buildPreviewSummary({ total: 2, available: 2, warn: 0, blocked: 0 }),
      validation: buildAvailabilityValidation(),
    } });
    const { container } = renderAgendamentos();
    await openNewRecurringReview(container);
    await screen.findAllByText("Disponível");
    const selections = screen.getAllByRole("checkbox").filter((checkbox) => checkbox.checked);
    expect(selections).toHaveLength(2);
    fireEvent.click(selections[1]);
    fireEvent.click(screen.getByRole("button", { name: "Confirmar agendamento" }));
    expect(toast.error).toHaveBeenCalledWith("Agendar agora exige programar todas as sessões de uma vez. Revise as datas.");
    expect(axios.post).not.toHaveBeenCalled();
    fireEvent.click(selections[1]);
    fireEvent.click(screen.getByRole("button", { name: "Confirmar agendamento" }));
    await waitFor(() => expect(axios.post).toHaveBeenCalledWith("/session-series", expect.objectContaining({
      purchase_launch: true, quantity: 2, occurrence_count: 2,
    })));
    expect(axios.post.mock.calls.filter(([url]) => url === "/session-series")).toHaveLength(1);
  });

  it("mantem o novo agendamento compacto e escolhe na revisao um pacote disponivel", async () => {
    const originalGet = axios.get.getMockImplementation();
    axios.get.mockImplementation((url, config) => {
      if (url === "/package-sharing/owners") {
        return Promise.resolve({ data: [{ id: 88, name: "Maurício Titular" }] });
      }
      if (url === "/package-sharing/owners/88/packages") {
        return Promise.resolve({ data: [
          {
            id: 701,
            owner: { id: 88, name: "Maurício Titular" },
            service: { id: 41, code: "physio", name: "Fisioterapia" },
            contracted_at: "2026-09-05",
            quantity: 3,
            free_rights: 1,
            relocatable_sessions: 0,
            requires_scheduled_session: false,
            eligible_scheduled_sessions: [],
            review_token: "review-token-701",
          },
          {
            id: 702,
            owner: { id: 88, name: "Maurício Titular" },
            service: { id: 41, code: "physio", name: "Fisioterapia" },
            contracted_at: "2026-09-20",
            quantity: 4,
            free_rights: 2,
            relocatable_sessions: 0,
            requires_scheduled_session: false,
            eligible_scheduled_sessions: [],
            review_token: "review-token-702",
          },
          {
            id: 999,
            owner: { id: 88, name: "Maurício Titular" },
            service: { id: 40, code: "spine_eval", name: "Avaliação Coluna" },
            contracted_at: "2026-09-30",
            quantity: 8,
            free_rights: 8,
            relocatable_sessions: 0,
            requires_scheduled_session: false,
            eligible_scheduled_sessions: [],
            review_token: "review-token-999",
          },
        ] });
      }
      return originalGet(url, config);
    });

    const { container } = renderAgendamentos();
    await screen.findByText("Paciente Teste");
    fireEvent.click(screen.getByRole("button", { name: "Novo agendamento" }));
    expect(screen.queryByLabelText("Usar pacote de outro paciente")).not.toBeInTheDocument();
    fireEvent.change(await screen.findByPlaceholderText("Buscar paciente"), {
      target: { value: "Paciente Teste" },
    });
    const patientSuggestions = await screen.findAllByText("Paciente Teste");
    fireEvent.click(patientSuggestions.find((element) => element.tagName === "BUTTON"));
    await selectAssignedProfessional(container);
    const sharing = screen.getByLabelText("Usar pacote de outro paciente");
    expect(sharing).toBeVisible();
    expect(screen.getAllByText("Valor da sessão")).toHaveLength(1);
    expect(screen.queryByText("Pacote de outro paciente", { selector: "strong" }))
      .not.toBeInTheDocument();

    const noCharge = screen.getByLabelText("Sem cobrança");
    expect(sharing).toBeEnabled();
    fireEvent.click(noCharge);
    expect(noCharge).toBeChecked();
    expect(sharing).not.toBeChecked();
    fireEvent.click(sharing);
    expect(sharing).toBeChecked();
    expect(screen.queryByLabelText("Sem cobrança")).not.toBeInTheDocument();

    const ownerInput = (await screen.findAllByPlaceholderText("Buscar paciente"))[1];
    expect(screen.getByText("De quem é o pacote?")).toBeInTheDocument();
    expect(screen.queryByText("Qual pacote vamos usar?")).not.toBeInTheDocument();
    fireEvent.change(ownerInput, { target: { value: "Maurício" } });
    fireEvent.click(await screen.findByRole("button", { name: /Maurício Titular/ }));
    fireEvent.change(container.querySelector('select[name="service_id"]'), {
      target: { value: "41" },
    });
    fireEvent.change(container.querySelector('input[type="date"]'), {
      target: { value: "2026-07-20" },
    });
    const hourSelect = Array.from(container.querySelectorAll("select"))
      .find((select) => Array.from(select.options).some((option) => option.value === "10"));
    fireEvent.change(hourSelect, { target: { value: "10" } });
    fireEvent.change(container.querySelector('textarea[name="notes"]'), {
      target: { value: "Observação administrativa" },
    });
    expect(ownerInput).toHaveValue("Maurício Titular");

    fireEvent.click(screen.getByRole("button", { name: "Revisar agendamento" }));
    expect(await screen.findByText("Pacote de: Maurício Titular")).toBeInTheDocument();
    expect(screen.getByText("Atendimento: Fisioterapia")).toBeInTheDocument();
    expect(axios.get).toHaveBeenCalledWith(
      "/package-sharing/owners/88/packages",
      { params: { service_id: 41 } },
    );
    expect(screen.queryByText(/Avaliação Coluna/)).not.toBeInTheDocument();
    expect(document.body.textContent.indexOf("Pacote de Fisioterapia · 20/09/2026"))
      .toBeLessThan(document.body.textContent.indexOf("Pacote de Fisioterapia · 05/09/2026"));
    expect(screen.getByText("4 sessões · 2 livres"))
      .toBeInTheDocument();
    expect(document.body).not.toHaveTextContent("undefined");
    expect(screen.queryByText("Qual sessão do pacote será liberada?"))
      .not.toBeInTheDocument();
    expect(screen.queryByText(/^Selecionadas /)).not.toBeInTheDocument();
    expect(screen.queryByText(/^Alertas /)).not.toBeInTheDocument();
    expect(screen.queryByText(/^Bloqueadas /)).not.toBeInTheDocument();
    expect(screen.queryByText(/sessão selecionada/)).not.toBeInTheDocument();
    expect(screen.queryByText("Agendamento único")).not.toBeInTheDocument();
    fireEvent.click(screen.getByLabelText(/Pacote de Fisioterapia · 20\/09\/2026/));
    expect(screen.queryByText(/Todas as sessões desse pacote/)).not.toBeInTheDocument();
	  await waitFor(() => expect(checkSchedulingAvailability).toHaveBeenCalledWith(
	    expect.objectContaining({
	      patient_id: 20,
	      shared_package_id: 702,
	      shared_package_review_token: "review-token-702",
	    }),
	  ));
	  await waitFor(() => expect(
	    screen.getByRole("button", { name: "Confirmar", exact: true }),
	  ).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "Confirmar", exact: true }));
    await waitFor(() => expect(axios.post).toHaveBeenCalledWith(
      "/sessions",
      expect.objectContaining({
        patient_id: 20,
        service_id: 41,
        is_no_charge: false,
        shared_package_id: 702,
        shared_package_source_session_id: null,
        shared_package_review_token: "review-token-702",
        idempotency_key: expect.stringMatching(/^package-share:/),
      }),
    ));
    const payload = axios.post.mock.calls.find(([url]) => url === "/sessions")[1];
    expect(payload).not.toHaveProperty("billing_mode");
    expect(payload).not.toHaveProperty("price_override_cents");
  });

  it("invalida a revisao de pacote aberta quando o catalogo deixa de ser 8", async () => {
    const originalGet = axios.get.getMockImplementation();
    axios.get.mockImplementation((url, config) => {
      if (url === "/package-sharing/owners") {
        return Promise.resolve({ data: [{ id: 88, name: "Maurício Titular" }] });
      }
      if (url === "/package-sharing/owners/88/packages") {
        return Promise.resolve({ data: [{
          id: 701,
          owner: { id: 88, name: "Maurício Titular" },
          service: { id: 41, code: "physio", name: "Fisioterapia" },
          contracted_at: "2026-09-05",
          quantity: 3,
          free_rights: 1,
          relocatable_sessions: 0,
          requires_scheduled_session: false,
          eligible_scheduled_sessions: [],
          review_token: "review-token-701",
        }] });
      }
      return originalGet(url, config);
    });

    const view = renderAgendamentos();
    await openPackageShareReview(view.container);
    fireEvent.click(screen.getByLabelText(/Pacote de Fisioterapia · 05\/09\/2026/));
    await waitFor(() => expect(
      screen.getByRole("button", { name: "Confirmar", exact: true }),
    ).toBeEnabled());

    mockAuthorization = {
      ...mockAuthorization,
      context: { ...mockAuthorization.context, catalog_version: 7 },
    };
    view.rerender(
      <MemoryRouter initialEntries={["/agendamentos"]}>
        <Agendamentos />
      </MemoryRouter>,
    );

    await waitFor(() => expect(
      screen.queryByRole("heading", { name: "Revisar agendamento" }),
    ).not.toBeInTheDocument());
    expect(screen.queryByLabelText("Usar pacote de outro paciente")).not.toBeInTheDocument();
    expect(axios.post.mock.calls.some(([url]) => url === "/sessions")).toBe(false);
  });

	  it("mantem a revisao pendente e ignora resposta atrasada de outro pacote", async () => {
	    const firstRequest = createDeferred();
	    const secondRequest = createDeferred();
	    const packages = [
	      {
	        id: 701,
	        owner: { id: 88, name: "Maurício Titular" },
	        service: { id: 41, code: "physio", name: "Fisioterapia" },
	        contracted_at: "2026-09-05",
	        quantity: 3,
	        free_rights: 1,
	        relocatable_sessions: 0,
	        requires_scheduled_session: false,
	        eligible_scheduled_sessions: [],
	        review_token: "review-token-701",
	      },
	      {
	        id: 702,
	        owner: { id: 88, name: "Maurício Titular" },
	        service: { id: 41, code: "physio", name: "Fisioterapia" },
	        contracted_at: "2026-09-20",
	        quantity: 3,
	        free_rights: 1,
	        relocatable_sessions: 0,
	        requires_scheduled_session: false,
	        eligible_scheduled_sessions: [],
	        review_token: "review-token-702",
	      },
	    ];
	    const originalGet = axios.get.getMockImplementation();
	    axios.get.mockImplementation((url, config) => {
	      if (url === "/package-sharing/owners") {
	        return Promise.resolve({ data: [{ id: 88, name: "Maurício Titular" }] });
	      }
	      if (url === "/package-sharing/owners/88/packages") {
	        return Promise.resolve({ data: packages });
	      }
	      return originalGet(url, config);
	    });
	    checkSchedulingAvailability.mockImplementation((payload) => {
	      if (payload?.shared_package_id === 701) return firstRequest.promise;
	      if (payload?.shared_package_id === 702) return secondRequest.promise;
	      return Promise.resolve(buildSingleAvailabilityResponse());
	    });

	    const { container } = renderAgendamentos();
	    await openPackageShareReview(container);
	    fireEvent.click(screen.getByLabelText(/Pacote de Fisioterapia · 05\/09\/2026/));
	    expect(await screen.findByText("Verificando disponibilidade..."))
	      .toBeInTheDocument();
	    expect(screen.getByRole("button", { name: "Confirmar", exact: true })).toBeDisabled();
	    fireEvent.click(screen.getByLabelText(/Pacote de Fisioterapia · 20\/09\/2026/));

	    await act(async () => {
	      secondRequest.resolve(buildSingleAvailabilityResponse());
	      await secondRequest.promise;
	    });
	    expect(await screen.findByText("Disponível")).toBeInTheDocument();
	    expect(screen.getByLabelText(/Pacote de Fisioterapia · 20\/09\/2026/)).toBeChecked();
	    expect(screen.getByRole("button", { name: "Confirmar", exact: true })).toBeEnabled();

	    await act(async () => {
	      firstRequest.resolve(buildSingleAvailabilityResponse({
	        canConfirm: false,
	        blockingCode: "PATIENT_SCHEDULE_CONFLICT",
	        blockingReason: "Paciente já agendado nesse horário",
	      }));
	      await firstRequest.promise;
	    });
	    expect(screen.getByText("Disponível")).toBeInTheDocument();
	    expect(screen.queryByText("Paciente já agendado nesse horário"))
	      .not.toBeInTheDocument();
	    expect(screen.getByLabelText(/Pacote de Fisioterapia · 20\/09\/2026/)).toBeChecked();
	  });

	  it("falha fechada na revalidacao do pacote e permite tentar novamente", async () => {
	    const retryRequest = createDeferred();
	    const packageOption = {
	      id: 701,
	      owner: { id: 88, name: "Maurício Titular" },
	      service: { id: 41, code: "physio", name: "Fisioterapia" },
	      contracted_at: "2026-09-05",
	      quantity: 3,
	      free_rights: 1,
	      relocatable_sessions: 0,
	      requires_scheduled_session: false,
	      eligible_scheduled_sessions: [],
	      review_token: "review-token-701",
	    };
	    const originalGet = axios.get.getMockImplementation();
	    axios.get.mockImplementation((url, config) => {
	      if (url === "/package-sharing/owners") {
	        return Promise.resolve({ data: [{ id: 88, name: "Maurício Titular" }] });
	      }
	      if (url === "/package-sharing/owners/88/packages") {
	        return Promise.resolve({ data: [packageOption] });
	      }
	      return originalGet(url, config);
	    });
	    let packageChecks = 0;
	    checkSchedulingAvailability.mockImplementation((payload) => {
	      if (!payload?.shared_package_id) return Promise.resolve(buildSingleAvailabilityResponse());
	      packageChecks += 1;
	      if (packageChecks === 1) {
	        return Promise.resolve({ data: { matched_events: [] } });
	      }
	      return retryRequest.promise;
	    });

	    const { container } = renderAgendamentos();
	    await openPackageShareReview(container);
	    fireEvent.click(screen.getByLabelText(/Pacote de Fisioterapia · 05\/09\/2026/));
	    expect(await screen.findByText(
	      "Não foi possível verificar a disponibilidade. Tente novamente.",
	    )).toBeInTheDocument();
	    expect(screen.getByRole("button", { name: "Confirmar", exact: true })).toBeDisabled();

	    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
	    expect(await screen.findByText("Verificando disponibilidade..."))
	      .toBeInTheDocument();
	    expect(screen.getByRole("button", { name: "Confirmar", exact: true })).toBeDisabled();
	    await act(async () => {
	      retryRequest.resolve(buildSingleAvailabilityResponse());
	      await retryRequest.promise;
	    });
	    expect(await screen.findByText("Disponível")).toBeInTheDocument();
	    expect(screen.getByRole("button", { name: "Confirmar", exact: true })).toBeEnabled();
	  });

	  it("atualiza opcoes stale e limpa somente a escolha incompatível", async () => {
	    const initialPackage = {
	      id: 701,
	      owner: { id: 88, name: "Maurício Titular" },
	      service: { id: 41, code: "physio", name: "Fisioterapia" },
	      contracted_at: "2026-09-05",
	      quantity: 3,
	      free_rights: 1,
	      relocatable_sessions: 0,
	      requires_scheduled_session: false,
	      eligible_scheduled_sessions: [],
	      review_token: "review-token-701",
	    };
	    const refreshedPackage = {
	      ...initialPackage,
	      id: 702,
	      contracted_at: "2026-09-20",
	      review_token: "review-token-702",
	    };
	    const originalGet = axios.get.getMockImplementation();
	    let packageLoads = 0;
	    axios.get.mockImplementation((url, config) => {
	      if (url === "/package-sharing/owners") {
	        return Promise.resolve({ data: [{ id: 88, name: "Maurício Titular" }] });
	      }
	      if (url === "/package-sharing/owners/88/packages") {
	        packageLoads += 1;
	        return Promise.resolve({ data: packageLoads === 1 ? [initialPackage] : [refreshedPackage] });
	      }
	      return originalGet(url, config);
	    });
	    checkSchedulingAvailability.mockImplementation((payload) => {
	      if (!payload?.shared_package_id) return Promise.resolve(buildSingleAvailabilityResponse());
	      const error = new Error("A sessão escolhida mudou. Revise novamente.");
	      error.response = {
	        status: 409,
	        data: {
	          code: "PACKAGE_SHARE_SOURCE_CHANGED",
	          error: "A sessão escolhida mudou. Revise novamente.",
	        },
	      };
	      return Promise.reject(error);
	    });

	    const { container } = renderAgendamentos();
	    await openPackageShareReview(container);
	    fireEvent.click(screen.getByLabelText(/Pacote de Fisioterapia · 05\/09\/2026/));

	    expect(await screen.findByText("As opções mudaram. Escolha o pacote novamente"))
	      .toBeInTheDocument();
	    expect(screen.queryByLabelText(/Pacote de Fisioterapia · 05\/09\/2026/))
	      .not.toBeInTheDocument();
	    expect(screen.getByLabelText(/Pacote de Fisioterapia · 20\/09\/2026/))
	      .not.toBeChecked();
	    expect(screen.getByText("Paciente: Paciente Teste")).toBeInTheDocument();
	    expect(screen.getByText("Pacote de: Maurício Titular")).toBeInTheDocument();
	    expect(screen.getByText(/20\/10\/2026/)).toBeInTheDocument();
	    expect(screen.getByRole("button", { name: "Confirmar", exact: true })).toBeDisabled();
	    expect(packageLoads).toBe(2);
	  });

  it("exige na revisao a sessao futura quando o pacote esta totalmente reservado", async () => {
    const originalGet = axios.get.getMockImplementation();
    axios.get.mockImplementation((url, config) => {
      if (url === "/package-sharing/owners") {
        return Promise.resolve({ data: [{ id: 88, name: "Maurício Titular" }] });
      }
      if (url === "/package-sharing/owners/88/packages") {
        return Promise.resolve({ data: [{
          id: 701,
          owner: { id: 88, name: "Maurício Titular" },
          service: { id: 41, code: "physio", name: "Fisioterapia" },
          contracted_at: "2026-09-05",
          quantity: 2,
          free_rights: 0,
          relocatable_sessions: 2,
          requires_scheduled_session: true,
          eligible_scheduled_sessions: [
            {
              id: 801,
              starts_at: "2026-10-12T09:00:00",
              patient_name: "Maurício Titular",
              professional_name: "Profissional A",
            },
            {
              id: 802,
              starts_at: "2026-10-14T09:00:00",
              patient_name: "João Atendido",
              professional_name: "Profissional B",
            },
          ],
          review_token: "review-token-701",
        }] });
      }
      return originalGet(url, config);
    });

    const { container } = renderAgendamentos();
    await screen.findByText("Paciente Teste");
    fireEvent.click(screen.getByRole("button", { name: "Novo agendamento" }));
    fireEvent.change(await screen.findByPlaceholderText("Buscar paciente"), {
      target: { value: "Paciente Teste" },
    });
    const patientSuggestions = await screen.findAllByText("Paciente Teste");
    fireEvent.click(patientSuggestions.find((element) => element.tagName === "BUTTON"));
    await selectAssignedProfessional(container);
    fireEvent.click(screen.getByLabelText("Usar pacote de outro paciente"));
    const ownerInput = (await screen.findAllByPlaceholderText("Buscar paciente"))[1];
    fireEvent.change(ownerInput, { target: { value: "Maurício" } });
    fireEvent.click(await screen.findByRole("button", { name: /Maurício Titular/ }));
    fireEvent.change(container.querySelector('select[name="service_id"]'), {
      target: { value: "41" },
    });
    fireEvent.change(container.querySelector('input[type="date"]'), {
      target: { value: "2026-10-20" },
    });
    const hourSelect = Array.from(container.querySelectorAll("select"))
      .find((select) => Array.from(select.options).some((option) => option.value === "10"));
    fireEvent.change(hourSelect, { target: { value: "10" } });
    fireEvent.click(screen.getByRole("button", { name: "Revisar agendamento" }));
    await screen.findByText("Qual pacote vamos usar?");
    expect(screen.getByText("2 sessões · 2 agendadas")).toBeInTheDocument();
    expect(screen.queryByText("Qual sessão do pacote será liberada?"))
      .not.toBeInTheDocument();
    expect(screen.queryByLabelText("12/10/2026 às 09h · Maurício Titular · Profissional A"))
      .not.toBeInTheDocument();
    fireEvent.click(screen.getByLabelText(/Pacote de Fisioterapia · 05\/09\/2026/));

    expect(screen.getByText("Qual sessão do pacote será liberada?"))
      .toBeInTheDocument();
    expect(screen.queryByText(/Todas as sessões desse pacote/)).not.toBeInTheDocument();
    expect(document.body).not.toHaveTextContent("undefined");
    expect(screen.getByLabelText("14/10/2026 às 09h · João Atendido · Profissional B"))
      .toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Confirmar", exact: true })).toBeDisabled();
    fireEvent.click(screen.getByLabelText("12/10/2026 às 09h · Maurício Titular · Profissional A"));
    expect(screen.getByLabelText("12/10/2026 às 09h · Maurício Titular · Profissional A"))
      .toBeChecked();
	  await waitFor(() => expect(checkSchedulingAvailability).toHaveBeenCalledWith(
	    expect.objectContaining({
	      patient_id: 20,
	      starts_at: "2026-10-20T13:00:00.000Z",
	      ends_at: "2026-10-20T14:00:00.000Z",
	      shared_package_id: 701,
	      shared_package_source_session_id: 801,
	      shared_package_review_token: "review-token-701",
	    }),
	  ));
	  await waitFor(() => expect(
	    screen.getByRole("button", { name: "Confirmar", exact: true }),
	  ).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "Confirmar", exact: true }));
    await waitFor(() => expect(axios.post).toHaveBeenCalledWith(
      "/sessions",
      expect.objectContaining({
        patient_id: 20,
        starts_at: "2026-10-20T13:00:00.000Z",
        ends_at: "2026-10-20T14:00:00.000Z",
        shared_package_id: 701,
        shared_package_source_session_id: 801,
        shared_package_review_token: "review-token-701",
      }),
    ));
  });

  it("rejeita o contexto comercial quando ele não é a coleção canônica de pacotes", async () => {
    const originalGet = axios.get.getMockImplementation();
    axios.get.mockImplementation((url, config) => {
      if (url === "/package-sharing/owners") {
        return Promise.resolve({ data: [{ id: 88, name: "Maurício Titular" }] });
      }
      if (url === "/package-sharing/owners/88/packages") {
        return Promise.resolve({
          data: {
            managed: false,
            identity: {
              id: 1,
              name: "Administrador Pacotes",
              email: "admin.pacotes@example.test",
            },
          },
        });
      }
      return originalGet(url, config);
    });

    const { container } = renderAgendamentos();
    await screen.findByText("Paciente Teste");
    fireEvent.click(screen.getByRole("button", { name: "Novo agendamento" }));
    fireEvent.change(await screen.findByPlaceholderText("Buscar paciente"), {
      target: { value: "Paciente Teste" },
    });
    const patientSuggestions = await screen.findAllByText("Paciente Teste");
    fireEvent.click(patientSuggestions.find((element) => element.tagName === "BUTTON"));
    await selectAssignedProfessional(container);
    fireEvent.click(screen.getByLabelText("Usar pacote de outro paciente"));
    const ownerInput = (await screen.findAllByPlaceholderText("Buscar paciente"))[1];
    fireEvent.change(ownerInput, { target: { value: "Maurício" } });
    fireEvent.click(await screen.findByRole("button", { name: /Maurício Titular/ }));
    fireEvent.change(container.querySelector('select[name="service_id"]'), {
      target: { value: "41" },
    });
    fireEvent.change(container.querySelector('input[type="date"]'), {
      target: { value: "2026-10-20" },
    });
    const hourSelect = Array.from(container.querySelectorAll("select"))
      .find((select) => Array.from(select.options).some((option) => option.value === "10"));
    fireEvent.change(hourSelect, { target: { value: "10" } });
    fireEvent.click(screen.getByRole("button", { name: "Revisar agendamento" }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(
      "Não foi possível buscar os pacotes desse paciente.",
    ));
    expect(screen.queryByText("Qual pacote vamos usar?")).not.toBeInTheDocument();
    expect(document.body).not.toHaveTextContent("undefined");
  });

  it("mostra ausencia elegivel de forma humana e oculta a opcao sem capacidade", async () => {
    const originalGet = axios.get.getMockImplementation();
    axios.get.mockImplementation((url, config) => {
      if (url === "/package-sharing/owners") {
        return Promise.resolve({ data: [{ id: 88, name: "Maurício Titular" }] });
      }
      if (url === "/package-sharing/owners/88/packages") {
        return Promise.resolve({ data: [] });
      }
      return originalGet(url, config);
    });

    const { container, unmount } = renderAgendamentos();
    await screen.findByText("Paciente Teste");
    fireEvent.click(screen.getByRole("button", { name: "Novo agendamento" }));
    fireEvent.change(await screen.findByPlaceholderText("Buscar paciente"), {
      target: { value: "Paciente Teste" },
    });
    const patientSuggestions = await screen.findAllByText("Paciente Teste");
    fireEvent.click(patientSuggestions.find((element) => element.tagName === "BUTTON"));
    await selectAssignedProfessional(container);
    fireEvent.click(screen.getByLabelText("Usar pacote de outro paciente"));
    const ownerInput = (await screen.findAllByPlaceholderText("Buscar paciente"))[1];
    fireEvent.change(ownerInput, { target: { value: "Maurício" } });
    fireEvent.click(await screen.findByRole("button", { name: /Maurício Titular/ }));
    fireEvent.change(container.querySelector('select[name="service_id"]'), {
      target: { value: "41" },
    });
    fireEvent.change(container.querySelector('input[type="date"]'), {
      target: { value: "2026-10-20" },
    });
    const hourSelect = Array.from(container.querySelectorAll("select"))
      .find((select) => Array.from(select.options).some((option) => option.value === "10"));
    fireEvent.change(hourSelect, { target: { value: "10" } });
    fireEvent.click(screen.getByRole("button", { name: "Revisar agendamento" }));
    expect(await screen.findByText("Maurício não tem pacote disponível para Fisioterapia."))
      .toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Confirmar", exact: true })).toBeDisabled();
    unmount();

    mockAuthorization = {
      ...mockAuthorization,
      hasCapability: jest.fn((capability) => capability !== "schedule.package.share"),
    };
    renderAgendamentos();
    await screen.findByText("Paciente Teste");
    fireEvent.click(screen.getByRole("button", { name: "Novo agendamento" }));
    expect(screen.queryByLabelText("Usar pacote de outro paciente"))
      .not.toBeInTheDocument();
  });

  it("troca o paciente de uma sessao de pacote pelo mesmo comando e unidade", async () => {
    sessionsMockData = [absolutePackageSession];
    const originalGet = axios.get.getMockImplementation();
    axios.get.mockImplementation((url, config) => {
      if (url === "/package-sharing/owners/20/packages") {
        return Promise.resolve({ data: [{
          id: 701,
          owner: { id: 20, name: "Paciente Teste" },
          service: { id: 40, code: "spine_eval", name: "Avaliacao Coluna" },
          contracted_at: "2026-06-01",
          quantity: 3,
          free_rights: 1,
          relocatable_sessions: 0,
          requires_scheduled_session: false,
          eligible_scheduled_sessions: [],
          source_session_eligible: true,
          review_token: "review-token-edit-701",
        }] });
      }
      return originalGet(url, config);
    });

    const { container } = renderAgendamentos();
    await openScheduledSessionEdit(container);
    await waitFor(() => expect(axios.get).toHaveBeenCalledWith(
      "/package-sharing/owners/20/packages",
      { params: { service_id: 40, source_session_id: 10 } },
    ));
    const patientSearch = await screen.findByRole("searchbox", { name: "Paciente" });
    expect(patientSearch).toHaveValue("Paciente Teste");
    expect(screen.queryByText("Usar esta sessão para outro paciente"))
      .not.toBeInTheDocument();
    expect(screen.queryByText("Trocar paciente")).not.toBeInTheDocument();
    fireEvent.change(patientSearch, { target: { value: "Paciente Cancelado" } });
    fireEvent.click(await screen.findByRole("button", { name: /Paciente Cancelado/ }));

    const professionalSelect = container.querySelector('select[name="professional_user_id"]');
    await waitFor(() => expect(axios.get).toHaveBeenCalledWith(
      "/schedule/references/professionals",
      { params: { patient_id: 21 } },
    ));
    await waitFor(() => expect(
      Array.from(professionalSelect.options).some((option) => option.value === "31"),
    ).toBe(true));
    fireEvent.change(professionalSelect, {
      target: { value: "31" },
    });
    fireEvent.change(container.querySelector('input[type="date"]'), {
      target: { value: "2026-06-30" },
    });
    const hourSelect = Array.from(container.querySelectorAll("select"))
      .find((select) => Array.from(select.options).some((option) => option.value === "10"));
    fireEvent.change(hourSelect, { target: { value: "10" } });
    const latePolicyException = screen.getByLabelText("Tem justificativa");
    expect(latePolicyException).toBeInTheDocument();
    fireEvent.click(latePolicyException);
    fireEvent.change(screen.getByPlaceholderText("Motivo"), {
      target: { value: "Alteração de horário autorizada" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() => expect(axios.post).toHaveBeenCalledWith(
      "/sessions",
      expect.objectContaining({
        patient_id: 21,
        professional_user_id: 31,
        service_id: 40,
        starts_at: "2026-06-30T13:00:00.000Z",
        ends_at: "2026-06-30T14:00:00.000Z",
        shared_package_id: 701,
        shared_package_source_session_id: 10,
        shared_package_review_token: "review-token-edit-701",
        shared_package_preserve_source_unit: true,
        idempotency_key: expect.stringMatching(/^package-share:/),
        late_policy_exception_justified: true,
        late_policy_exception_reason: "Alteração de horário autorizada",
      }),
    ));
    expect(axios.put).not.toHaveBeenCalledWith(
      "/sessions/10",
      expect.objectContaining({ patient_id: 21 }),
    );
  });

  it("mantem data e horario ao trocar somente quem sera atendido", async () => {
    sessionsMockData = [absolutePackageSession];
    const originalGet = axios.get.getMockImplementation();
    axios.get.mockImplementation((url, config) => {
      if (url === "/package-sharing/owners/20/packages") {
        return Promise.resolve({ data: [{
          id: 701,
          owner: { id: 20, name: "Paciente Teste" },
          service: { id: 40, code: "spine_eval", name: "Avaliacao Coluna" },
          contracted_at: "2026-06-01",
          quantity: 3,
          free_rights: 1,
          relocatable_sessions: 0,
          requires_scheduled_session: false,
          eligible_scheduled_sessions: [],
          source_session_eligible: true,
          review_token: "review-token-edit-701",
        }] });
      }
      return originalGet(url, config);
    });

    const { container } = renderAgendamentos();
    await openScheduledSessionEdit(container);
    expect(container.querySelector('input[type="date"]')).toHaveValue("2026-06-29");
    const displayedHour = Array.from(container.querySelectorAll("select"))
      .find((select) => Array.from(select.options).some((option) => option.value === "10"));
    expect(displayedHour).toHaveValue("07");
    expect(screen.queryByText("Pacote de Paciente Teste")).not.toBeInTheDocument();
    const patientSearch = await screen.findByRole("searchbox", { name: "Paciente" });
    fireEvent.change(patientSearch, { target: { value: "Paciente Cancelado" } });
    fireEvent.click(await screen.findByRole("button", { name: /Paciente Cancelado/ }));
    expect(screen.queryByLabelText("Tem justificativa")).not.toBeInTheDocument();
    await waitFor(() => expect(axios.get).toHaveBeenCalledWith(
      "/schedule/references/professionals",
      { params: { patient_id: 21 } },
    ));
    const professionalSelect = container.querySelector('select[name="professional_user_id"]');
    await waitFor(() => expect(professionalSelect).toHaveValue("30"));
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() => expect(axios.post).toHaveBeenCalledWith(
      "/sessions",
      expect.objectContaining({
        patient_id: 21,
        professional_user_id: 30,
        starts_at: absolutePackageSession.starts_at,
        ends_at: absolutePackageSession.ends_at,
        shared_package_id: 701,
        shared_package_source_session_id: 10,
        shared_package_preserve_source_unit: true,
      }),
    ));
    const payload = axios.post.mock.calls.find(([url]) => url === "/sessions")[1];
    expect(payload).not.toHaveProperty("rescheduled_from_id");
    expect(payload.late_policy_exception_justified).toBe(false);
    expect(axios.put).not.toHaveBeenCalledWith(
      "/sessions/10",
      expect.objectContaining({ patient_id: 21 }),
    );
  });

  it("preserva os instantes ao trocar paciente de sessao passada ainda aberta", async () => {
    agendaTestNow = new NativeDate("2026-06-29T12:00:00.000Z");
    sessionsMockData = [absolutePackageSession];
    const originalGet = axios.get.getMockImplementation();
    axios.get.mockImplementation((url, config) => {
      if (url === "/package-sharing/owners/20/packages") {
        return Promise.resolve({ data: [{
          id: 701,
          owner: { id: 20, name: "Paciente Teste" },
          service: { id: 40, code: "spine_eval", name: "Avaliacao Coluna" },
          contracted_at: "2026-06-01",
          quantity: 3,
          free_rights: 1,
          relocatable_sessions: 0,
          requires_scheduled_session: false,
          eligible_scheduled_sessions: [],
          source_session_eligible: true,
          review_token: "review-token-edit-701",
        }] });
      }
      return originalGet(url, config);
    });

    const { container } = renderAgendamentos();
    await openScheduledSessionEdit(container);
    const patientSearch = await screen.findByRole("searchbox", { name: "Paciente" });
    fireEvent.change(patientSearch, { target: { value: "Paciente Cancelado" } });
    fireEvent.click(await screen.findByRole("button", { name: /Paciente Cancelado/ }));
    expect(screen.queryByLabelText("Tem justificativa")).not.toBeInTheDocument();
    await waitFor(() => expect(axios.get).toHaveBeenCalledWith(
      "/schedule/references/professionals",
      { params: { patient_id: 21 } },
    ));
    await waitFor(() => expect(
      container.querySelector('select[name="professional_user_id"]'),
    ).toHaveValue("30"));
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() => expect(axios.post).toHaveBeenCalledWith(
      "/sessions",
      expect.objectContaining({
        patient_id: 21,
        starts_at: absolutePackageSession.starts_at,
        ends_at: absolutePackageSession.ends_at,
        shared_package_id: 701,
        shared_package_source_session_id: 10,
        shared_package_preserve_source_unit: true,
      }),
    ));
    expect(axios.post.mock.calls.find(([url]) => url === "/sessions")[1])
      .not.toHaveProperty("rescheduled_from_id");
  });

  it.each([
    ["outro paciente", 21, "Paciente Cancelado"],
    ["o titular", 88, "Maurício Titular"],
  ])("permite trocar paciente compartilhado por %s", async (_label, targetId, targetName) => {
    const sharedSession = {
      ...packageSession,
      patient_id: 20,
      Patient: { id: 20, full_name: "Paciente Teste" },
      PackageUnit: {
        ...packageSession.PackageUnit,
        Package: {
          ...packageSession.PackageUnit.Package,
          patient_id: 88,
          Patient: { id: 88, full_name: "Maurício Titular" },
        },
      },
    };
    sessionsMockData = [sharedSession];
    const originalGet = axios.get.getMockImplementation();
    axios.get.mockImplementation((url, config) => {
      if (url === "/package-sharing/owners/88/packages") {
        return Promise.resolve({ data: [{
          id: 701,
          owner: { id: 88, name: "Maurício Titular" },
          service: { id: 40, code: "spine_eval", name: "Avaliacao Coluna" },
          contracted_at: "2026-06-01",
          quantity: 3,
          free_rights: 0,
          relocatable_sessions: 1,
          requires_scheduled_session: true,
          eligible_scheduled_sessions: [{
            id: 10,
            starts_at: baseSession.starts_at,
            patient_name: "Paciente Teste",
            professional_name: "Profissional Teste",
          }],
          source_session_eligible: true,
          review_token: "review-token-edit-701",
        }] });
      }
      return originalGet(url, config);
    });

    const { container } = renderAgendamentos();
    await openScheduledSessionEdit(container);
    const patientSearch = await screen.findByRole("searchbox", { name: "Paciente" });
    fireEvent.change(patientSearch, { target: { value: targetName } });
    fireEvent.click(await screen.findByRole("button", { name: targetName }));
    await waitFor(() => expect(axios.get).toHaveBeenCalledWith(
      "/schedule/references/professionals",
      { params: { patient_id: targetId } },
    ));
    await waitFor(() => expect(
      container.querySelector('select[name="professional_user_id"]'),
    ).toHaveValue("30"));
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() => expect(axios.post).toHaveBeenCalledWith(
      "/sessions",
      expect.objectContaining({
        patient_id: targetId,
        shared_package_id: 701,
        shared_package_source_session_id: 10,
        shared_package_preserve_source_unit: true,
      }),
    ));
    expect(axios.put).not.toHaveBeenCalledWith(
      "/sessions/10",
      expect.objectContaining({ patient_id: targetId }),
    );
  });

  it("restaura o paciente original quando a permissao some durante a edicao", async () => {
    sessionsMockData = [{
      ...packageSession,
      patient_id: 20,
      Patient: { id: 20, full_name: "Paciente Teste" },
      PackageUnit: {
        ...packageSession.PackageUnit,
        Package: {
          ...packageSession.PackageUnit.Package,
          patient_id: 88,
          Patient: { id: 88, full_name: "Maurício Titular" },
        },
      },
    }];
    const originalGet = axios.get.getMockImplementation();
    axios.get.mockImplementation((url, config) => {
      if (url === "/package-sharing/owners/88/packages") {
        return Promise.resolve({ data: [{
          id: 701,
          owner: { id: 88, name: "Maurício Titular" },
          service: { id: 40, code: "spine_eval", name: "Avaliacao Coluna" },
          contracted_at: "2026-06-01",
          quantity: 3,
          free_rights: 0,
          relocatable_sessions: 1,
          requires_scheduled_session: true,
          eligible_scheduled_sessions: [{
            id: 10,
            starts_at: baseSession.starts_at,
            patient_name: "Paciente Teste",
            professional_name: "Profissional Teste",
          }],
          source_session_eligible: true,
          review_token: "review-token-edit-701",
        }] });
      }
      return originalGet(url, config);
    });

    const view = renderAgendamentos();
    await openScheduledSessionEdit(view.container);
    const patientSearch = await screen.findByRole("searchbox", { name: "Paciente" });
    fireEvent.change(patientSearch, { target: { value: "Paciente Cancelado" } });
    fireEvent.click(await screen.findByRole("button", { name: /Paciente Cancelado/ }));
    fireEvent.change(view.container.querySelector('textarea[name="notes"]'), {
      target: { value: "Ajuste administrativo sem troca de paciente" },
    });

    mockAuthorization = {
      ...mockAuthorization,
      hasCapability: jest.fn((capability) => capability !== "schedule.package.share"),
    };
    view.rerender(
      <MemoryRouter initialEntries={["/agendamentos"]}>
        <Agendamentos />
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.queryByRole("searchbox", { name: "Paciente" }))
      .not.toBeInTheDocument());
    expect(screen.getAllByText("Paciente Teste").length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() => expect(axios.put).toHaveBeenCalledWith(
      "/sessions/10",
      expect.objectContaining({
        patient_id: 20,
        notes: "Ajuste administrativo sem troca de paciente",
      }),
    ));
    expect(axios.post.mock.calls.some(([url]) => url === "/sessions")).toBe(false);
  });

  it("identifica pacote compartilhado e limita a troca por elegibilidade e permissao", async () => {
    const sharedSession = {
      ...packageSession,
      patient_id: 20,
      Patient: { id: 20, full_name: "Paciente Teste" },
      PackageUnit: {
        ...packageSession.PackageUnit,
        Package: {
          ...packageSession.PackageUnit.Package,
          patient_id: 88,
          Patient: { id: 88, full_name: "Maurício Titular" },
        },
      },
    };
    sessionsMockData = [sharedSession];
    const originalGet = axios.get.getMockImplementation();
    let sourceEligible = true;
    axios.get.mockImplementation((url, config) => {
      if (url === "/package-sharing/owners/88/packages") {
        return Promise.resolve({ data: [{
          id: 701,
          owner: { id: 88, name: "Maurício Titular" },
          service: { id: 40, code: "spine_eval", name: "Avaliacao Coluna" },
          contracted_at: "2026-06-01",
          quantity: 3,
          free_rights: 0,
          relocatable_sessions: 1,
          requires_scheduled_session: true,
          eligible_scheduled_sessions: [{
            id: 10,
            starts_at: baseSession.starts_at,
            patient_name: "Paciente Teste",
            professional_name: "Profissional Teste",
          }],
          source_session_eligible: sourceEligible,
          review_token: "review-token-edit-701",
        }] });
      }
      return originalGet(url, config);
    });

    const first = renderAgendamentos();
    await screen.findByText("Paciente Teste");
    expect(screen.queryByText("Pacote de Maurício Titular")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Mês" }));
    expect(screen.queryByText("Pacote de Maurício Titular")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Semana" }));

    const compactGridCard = await waitFor(() => {
      const element = first.container.querySelector('[data-id="10"]');
      expect(element).toBeTruthy();
      return element;
    });
    expect(compactGridCard).not.toHaveTextContent("Pacote de Maurício Titular");
    fireEvent.click(compactGridCard);
    const detailsTitle = await screen.findByText("Detalhes do horário");
    expect(screen.getByText("Pacote de Maurício Titular")).toBeInTheDocument();
    fireEvent.click(detailsTitle.parentElement.parentElement.querySelector("button"));

    fireEvent.click(screen.getByRole("button", { name: "Dia" }));
    const dayCard = await waitFor(() => {
      const element = first.container.querySelector('[data-id="10"]');
      expect(element).toBeTruthy();
      return element;
    });
    expect(dayCard).toHaveTextContent("Pacote de Maurício Titular");
    fireEvent.click(dayCard.querySelector("button[aria-label]"));
    fireEvent.click(await screen.findByRole("button", { name: "Editar agendamento" }));
    await screen.findByText("Motivo da alteração");
    expect((await screen.findAllByText("Pacote de Maurício Titular")).length)
      .toBeGreaterThan(0);
    await waitFor(() => expect(axios.get).toHaveBeenCalledWith(
      "/package-sharing/owners/88/packages",
      { params: { service_id: 40, source_session_id: 10 } },
    ));
    const patientSearch = await screen.findByRole("searchbox", { name: "Paciente" });
    const editForm = patientSearch.closest("form");
    expect(patientSearch).toHaveValue("Paciente Teste");
    fireEvent.change(patientSearch, { target: { value: "Maurício" } });
    fireEvent.click(await screen.findByRole("button", { name: /Maurício Titular/ }));
    expect(within(editForm).queryByText("Pacote de Maurício Titular")).not.toBeInTheDocument();
    fireEvent.change(patientSearch, { target: { value: "Paciente Cancelado" } });
    fireEvent.click(await screen.findByRole("button", { name: /Paciente Cancelado/ }));
    expect(within(editForm).getByText("Pacote de Maurício Titular")).toBeInTheDocument();
    expect(screen.queryByText("Trocar paciente")).not.toBeInTheDocument();
    first.unmount();

    sourceEligible = false;
    const second = renderAgendamentos();
    await openScheduledSessionEdit(second.container);
    await waitFor(() => expect(axios.get.mock.calls.filter(
      ([url]) => url === "/package-sharing/owners/88/packages",
    )).toHaveLength(2));
    expect(screen.queryByRole("searchbox", { name: "Paciente" }))
      .not.toBeInTheDocument();
    second.unmount();

    mockAuthorization = {
      ...mockAuthorization,
      hasCapability: jest.fn((capability) => capability !== "schedule.package.share"),
    };
    const third = renderAgendamentos();
    await openScheduledSessionEdit(third.container);
    expect(screen.queryByRole("searchbox", { name: "Paciente" }))
      .not.toBeInTheDocument();
    expect(axios.get.mock.calls.filter(
      ([url]) => url === "/package-sharing/owners/88/packages",
    )).toHaveLength(2);
  });
});
