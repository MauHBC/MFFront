/* eslint-env jest */
import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import Agendamentos from "./index";
import axios from "../../services/axios";
import {
  checkSchedulingAvailability,
  listSpecialSchedulingEvents,
  previewSchedulingOccurrences,
} from "../../services/scheduling";
import { getCoveragePreview, listPatientPlans } from "../../services/financial";

jest.mock("react-toastify", () => ({
  toast: {
    error: jest.fn(),
    info: jest.fn(),
    success: jest.fn(),
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

const renderAgendamentos = () => render(
  <MemoryRouter>
    <Agendamentos />
  </MemoryRouter>,
);

describe("Agendamentos - editar agendamento", () => {
  let sessionsMockData;

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date("2026-06-29T06:00:00"));
    jest.clearAllMocks();
    sessionsMockData = [baseSession, canceledSession, noShowSession];

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
      if (url === "/patients") {
        return Promise.resolve({
          data: [
            { id: 20, full_name: "Paciente Teste" },
            { id: 21, full_name: "Paciente Cancelado" },
            { id: 22, full_name: "Paciente Falta" },
            { id: 23, full_name: "Paciente Concluido" },
            { id: 24, full_name: "Paciente Suspenso" },
            { id: 25, full_name: "Paciente Com Plano" },
            { id: 26, full_name: "Paciente Sem Vinculo" },
          ],
        });
      }
      if (url === "/users") {
        return Promise.resolve({ data: [{ id: 30, name: "Profissional Teste" }] });
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

    checkSchedulingAvailability.mockResolvedValue({
      data: {
        has_blocking_events: false,
        matched_events: [],
        severity: "info",
      },
    });
    listSpecialSchedulingEvents.mockResolvedValue({ data: [] });
    previewSchedulingOccurrences.mockResolvedValue({ data: { occurrences_preview: [] } });
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

  afterEach(() => {
    jest.useRealTimers();
  });

  it("usa PUT ao editar horario de uma sessao agendada pelo botao Editar agendamento", async () => {
    const { container } = renderAgendamentos();

    expect(await screen.findByText("Paciente Teste")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Dia" }));
    const scheduledCard = await waitFor(() => {
      const element = container.querySelector('[data-id="10"]');
      expect(element).toBeTruthy();
      return element;
    });
    const scheduledActionsButton = scheduledCard.querySelector("button[aria-label]");
    expect(scheduledActionsButton).toBeTruthy();
    fireEvent.click(scheduledActionsButton);
    fireEvent.click(await screen.findByRole("button", { name: "Editar agendamento" }));

    await screen.findByText("Motivo da alteração");
    const hourSelect = Array.from(container.querySelectorAll("select"))
      .find((select) => Array.from(select.options).some((option) => option.value === "10"));
    expect(hourSelect).toBeTruthy();
    fireEvent.change(hourSelect, { target: { value: "10" } });
    fireEvent.change(container.querySelector('textarea[name="notes"]'), {
      target: { value: "ajuste administrativo" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() => expect(axios.put).toHaveBeenCalledWith(
      "/sessions/10",
      expect.objectContaining({
        starts_at: "2026-06-29T10:00",
        ends_at: "2026-06-29T11:00",
        notes: "ajuste administrativo",
      }),
    ));

    const sessionPostCalls = axios.post.mock.calls.filter(([url]) => url === "/sessions");
    expect(sessionPostCalls).toHaveLength(0);
    expect(axios.put.mock.calls[0][1]).not.toHaveProperty("rescheduled_from_id");
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
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

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

  it("cria Novo agendamento como avulso mesmo para paciente com plano ativo", async () => {
    const { container } = renderAgendamentos();

    expect(await screen.findByText("Paciente Teste")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Novo agendamento" }));
    const patientInput = await screen.findByPlaceholderText("Buscar paciente");
    fireEvent.change(patientInput, { target: { value: "Paciente Com Plano" } });
    fireEvent.click(await screen.findByText("Paciente Com Plano"));

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

    fireEvent.click(screen.getByRole("button", { name: "Criar agendamento" }));

    await waitFor(() => expect(axios.post).toHaveBeenCalledWith(
      "/sessions",
      expect.objectContaining({
        patient_id: 25,
        service_id: 40,
        starts_at: "2026-06-30T10:00",
        ends_at: "2026-06-30T11:00",
        billing_mode: "per_session",
        patient_credit_id: null,
        session_replacement_credit_id: null,
      }),
    ));

    const payload = axios.post.mock.calls.find(([url]) => url === "/sessions")[1];
    expect(payload.billing_mode).not.toBe("covered_by_plan");
    expect(payload).not.toHaveProperty("billing_cycle_id");
    expect(listPatientPlans).not.toHaveBeenCalled();
    expect(getCoveragePreview).not.toHaveBeenCalled();
    expect(axios.get.mock.calls.some(([url]) => url === "/patient-credits")).toBe(false);
  });

  it("nao envia reposicao disponivel quando usuario nao escolhe usar reposicao", async () => {
    axios.get.mockImplementation((url, config = {}) => {
      if (url === "/patients") {
        return Promise.resolve({
          data: [
            { id: 20, full_name: "Paciente Teste" },
            { id: 26, full_name: "Paciente Sem Vinculo" },
          ],
        });
      }
      if (url === "/users") {
        return Promise.resolve({ data: [{ id: 30, name: "Profissional Teste" }] });
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

    fireEvent.change(container.querySelector('input[type="date"]'), {
      target: { value: "2026-06-30" },
    });
    const hourSelect = Array.from(container.querySelectorAll("select"))
      .find((select) => Array.from(select.options).some((option) => option.value === "10"));
    fireEvent.change(hourSelect, { target: { value: "10" } });

    fireEvent.click(screen.getByRole("button", { name: "Criar agendamento" }));

    await waitFor(() => expect(axios.post).toHaveBeenCalledWith(
      "/sessions",
      expect.objectContaining({
        patient_id: 26,
        service_id: 40,
        billing_mode: "per_session",
        patient_credit_id: null,
        session_replacement_credit_id: null,
      }),
    ));
  });

  it("mantem reposicao explicita quando usuario escolhe usar reposicao", async () => {
    axios.get.mockImplementation((url, config = {}) => {
      if (url === "/patients") {
        return Promise.resolve({ data: [{ id: 20, full_name: "Paciente Teste" }] });
      }
      if (url === "/users") {
        return Promise.resolve({ data: [{ id: 30, name: "Profissional Teste" }] });
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
	            source_billing_mode: "per_session",
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

	    fireEvent.click(screen.getByRole("button", { name: "Criar agendamento" }));

    await waitFor(() => expect(axios.post).toHaveBeenCalledWith(
      "/sessions",
      expect.objectContaining({
        patient_id: 20,
        service_id: 40,
        billing_mode: "per_session",
        patient_credit_id: null,
        session_replacement_credit_id: 901,
      }),
    ));
  });
});
