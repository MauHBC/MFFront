import fs from "fs";
import path from "path";
import React from "react";
import "@testing-library/jest-dom";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { createMemoryHistory } from "history";
import { Router, Route } from "react-router-dom";
import Planos from ".";
import {
  listPatientPlans,
  listServicePlans,
  listServicePrices,
  getPatientPlanHistory,
  pausePatientPlan,
} from "../../services/financial";
import axios from "../../services/axios";

jest.mock("../../services/axios", () => ({
  get: jest.fn(),
  post: jest.fn(),
  put: jest.fn(),
}));
jest.mock("../../services/financial", () => ({
  listServicePlans: jest.fn(),
  createServicePlan: jest.fn(),
  updateServicePlan: jest.fn(),
  deactivateServicePlan: jest.fn(),
  listServicePrices: jest.fn(),
  createServicePrice: jest.fn(),
  updateServicePrice: jest.fn(),
  listPatientPlans: jest.fn(),
  createPatientPlan: jest.fn(),
  updatePatientPlan: jest.fn(),
  pausePatientPlan: jest.fn(),
  updatePatientPlanPause: jest.fn(),
  previewResumePatientPlan: jest.fn(),
  resumePatientPlan: jest.fn(),
  cancelPatientPlan: jest.fn(),
  unschedulePatientPlanCancellation: jest.fn(),
  getPatientPlanHistory: jest.fn(),
}));

function renderPlans(pathname = "/planos") {
  const history = createMemoryHistory({ initialEntries: [pathname] });
  const result = render(
    <Router history={history}>
      <Route exact path="/planos" component={Planos} />
      <Route exact path="/planos/pacientes/:patientPlanId" component={Planos} />
    </Router>,
  );
  return { ...result, history };
}

describe("Planos no contêiner do App Shell", () => {
  beforeEach(() => {
    axios.get.mockImplementation((url) => {
      if (url === "/services") {
        return Promise.resolve({ data: [{ id: 7, name: "Fisioterapia", is_active: true }] });
      }
      if (url === "/patients") {
        return Promise.resolve({
          data: [{ id: 11, name: "Ana", surname: "Silva" }],
        });
      }
      if (url === "/users?group=professional") {
        return Promise.resolve({ data: [{ id: 21, username: "Dra. Lia" }] });
      }
      if (url === "/unit-scheduling-policy") {
        return Promise.resolve({ data: { allow_broken_time_scheduling: false } });
      }
      return Promise.resolve({ data: {} });
    });
    listServicePrices.mockResolvedValue({ data: [] });
    listServicePlans.mockResolvedValue({
      data: [{
        id: 31,
        name: "Mensal 2x",
        service_id: 7,
        sessions_per_week: 2,
        price_cents: 50000,
        is_active: true,
        Service: { id: 7, name: "Fisioterapia" },
      }],
    });
    listPatientPlans.mockResolvedValue({
      data: [{
        id: 41,
        patient_id: 11,
        service_plan_id: 31,
        status: "active",
        Patient: { id: 11, name: "Ana", surname: "Silva" },
        ServicePlan: {
          id: 31,
          name: "Mensal 2x",
          sessions_per_week: 2,
        },
      }],
    });
    getPatientPlanHistory.mockResolvedValue({
      data: { events: [], page_info: { has_more: false, next_cursor: null } },
    });
  });

  afterEach(() => {
    cleanup();
    jest.clearAllMocks();
  });

  it("carrega a seção padrão sem duplicar a navegação lateral e aplica a pesquisa", async () => {
    renderPlans();

    expect(screen.queryByRole("tablist", { name: "Seções de Planos" })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Pacientes com plano" })).toBeInTheDocument();
    expect(await screen.findByText("Ana")).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText("Nome do paciente"), {
      target: { value: "inexistente" },
    });

    await waitFor(() => {
      expect(screen.getByText("Nenhum vínculo encontrado.")).toBeInTheDocument();
    });
  });

  it("preserva planos mensais e serviços como destinos controlados pela rota", async () => {
    const { history } = renderPlans();

    act(() => history.push("/planos?tab=service-plans"));
    expect(history.location.search).toBe("?tab=service-plans");
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Planos mensais" })).toBeInTheDocument();
    });
    expect((await screen.findAllByText("Mensal 2x")).length).toBeGreaterThan(0);

    act(() => history.push("/planos?tab=services"));
    expect(history.location.search).toBe("?tab=services");
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Serviços" })).toBeInTheDocument();
    });
    expect((await screen.findAllByText("Fisioterapia")).length).toBeGreaterThan(0);
  });

  it("exige confirmação explícita antes de enviar pausa retroativa", async () => {
    const patientPlan = {
      id: 41,
      patient_id: 11,
      service_plan_id: 31,
      status: "active",
      Patient: { id: 11, name: "Ana", surname: "Silva" },
      ServicePlan: {
        id: 31,
        name: "Mensal 2x",
        service_id: 7,
        sessions_per_week: 2,
      },
      agenda_summary: { status: "active_recurrence", future_sessions_count: 2 },
    };
    axios.get.mockImplementation((url) => {
      if (url === "/patient-plans/41") return Promise.resolve({ data: patientPlan });
      if (url === "/patient-plans/41/admin-summary") return Promise.resolve({ data: {} });
      if (url === "/services") return Promise.resolve({ data: [] });
      if (url === "/patients") return Promise.resolve({ data: [patientPlan.Patient] });
      if (url === "/users") return Promise.resolve({ data: [] });
      if (url === "/unit-scheduling-policy") return Promise.resolve({ data: {} });
      return Promise.resolve({ data: {} });
    });
    pausePatientPlan.mockResolvedValue({ data: {} });

    renderPlans("/planos/pacientes/41");
    fireEvent.click(await screen.findByRole("button", { name: "Ações do plano" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Pausar plano" }));
    fireEvent.change(document.getElementById("pause-starts-on"), {
      target: { value: "2000-01-01" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Confirmar pausa" }));

    const confirmation = await screen.findByRole("dialog", {
      name: "Pausa com data retroativa",
    });
    expect(within(confirmation).getByText(
      "Você está iniciando a pausa em uma data anterior. Deseja continuar?",
    )).toBeInTheDocument();
    expect(within(confirmation).getByText(
      "Sessões agendadas nesse período serão suspensas. Sessões já concluídas, faltas ou canceladas não serão alteradas.",
    )).toBeInTheDocument();
    expect(pausePatientPlan).not.toHaveBeenCalled();

    fireEvent.click(within(confirmation).getByRole("button", { name: "Confirmar pausa" }));
    await waitFor(() => expect(pausePatientPlan).toHaveBeenCalledWith(41, expect.objectContaining({
      starts_on: "2000-01-01",
      retroactive_confirmed: true,
    })));
  });

  it("restaura a seção indicada pela query no acesso direto", async () => {
    renderPlans("/planos?tab=services");

    expect(screen.queryByRole("tablist", { name: "Seções de Planos" })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Serviços" })).toBeInTheDocument();
    expect((await screen.findAllByText("Fisioterapia")).length).toBeGreaterThan(0);
  });

  it("mantém no código os contratos críticos de vínculo, agenda e troca de plano", () => {
    const source = fs.readFileSync(path.join(__dirname, "index.js"), "utf8");

    expect(source).toMatch(/patient_id:\s*Number\(ppForm\.patient_id\)/);
    expect(source).toMatch(/service_plan_id:\s*Number\(ppForm\.service_plan_id\)/);
    expect(source).toMatch(/is_no_charge:\s*ppForm\.is_no_charge === true/);
    expect(source).toMatch(/billing_mode:\s*"covered_by_plan"/);
    expect(source).toMatch(/assign_patient_care:\s*schedConfirmation\.requiresCareAssignment/);
    expect(source).toMatch(/clinic_professional_id:\s*schedConfirmation\.clinicProfessionalId/);
    expect(source).toMatch(/Atribuir e agendar sessões/);
    expect(source).toMatch(/schedule\/references\/professionals/);
    expect(source).toMatch(/expected_effective_on:\s*planChangePreview\.data\.effective_on/);
    expect(source).toMatch(/preview_token:\s*planChangePreview\.data\.preview_token/);
    expect(source).toMatch(/expected_version:\s*Number\(planChangeForm\.expected_version\)/);
    expect(source).toMatch(/future-sessions-removal-preview/);
    expect(source).toMatch(/change-plan\/cancel/);
    expect(source).toMatch(/getPatientPlanHistory/);
    expect(source).toMatch(/expected_pause_version/);
    expect(source).toMatch(/Desprogramar cancelamento/);
  });

  it("renderiza a linha do tempo paginada sem expor JSON bruto", async () => {
    const patientPlan = {
      id: 41,
      patient_id: 11,
      service_plan_id: 31,
      status: "active",
      Patient: { id: 11, name: "Ana", surname: "Silva" },
      ServicePlan: { id: 31, name: "Mensal 2x", sessions_per_week: 2 },
      agenda_summary: { status: "not_configured", future_sessions_count: 0 },
    };
    axios.get.mockImplementation((url) => {
      if (url === "/patient-plans/41") return Promise.resolve({ data: patientPlan });
      if (url === "/patient-plans/41/admin-summary") return Promise.resolve({ data: {} });
      if (url === "/services") return Promise.resolve({ data: [] });
      if (url === "/patients") return Promise.resolve({ data: [patientPlan.Patient] });
      if (url === "/users") return Promise.resolve({ data: [] });
      if (url === "/unit-scheduling-policy") return Promise.resolve({ data: {} });
      return Promise.resolve({ data: {} });
    });
    getPatientPlanHistory
      .mockResolvedValueOnce({
        data: {
          events: [
            {
              id: 12,
              sequence: 12,
              type: "commercial_change_applied",
              label: "Alteração comercial aplicada",
              occurred_at: "2026-08-06T12:00:00.000Z",
              origin: "automatic",
              actor: null,
              changes: [{
                field: "change_status",
                label: "Status da alteração",
                before: "pending",
                after: "applied",
              }],
              legacy: { is_legacy: false, is_incomplete: false },
            },
            {
              id: 11,
              sequence: 11,
              type: "pause_ended",
              label: "Pausa encerrada automaticamente",
              occurred_at: "2026-08-05T12:00:00.000Z",
              origin: "automatic",
              actor: null,
              changes: [{
                field: "pause_status",
                label: "Status da pausa",
                before: "active",
                after: "ended",
              }],
              legacy: { is_legacy: false, is_incomplete: false },
            },
          ],
          page_info: { has_more: true, next_cursor: "cursor-11" },
        },
      })
      .mockResolvedValueOnce({
        data: {
          events: [{
            id: 3,
            sequence: 3,
            type: "legacy_pause_snapshot",
            label: "Registro legado de pausa",
            occurred_at: "2026-07-01T12:00:00.000Z",
            origin: "backfill",
            actor: null,
            changes: [],
            legacy: { is_legacy: true, is_incomplete: true },
          }],
          page_info: { has_more: false, next_cursor: null },
        },
      });

    renderPlans("/planos/pacientes/41");
    fireEvent.click(await screen.findByRole("tab", { name: "Histórico" }));

    const applied = await screen.findByText("Alteração comercial aplicada");
    const endedPause = screen.getByText("Pausa encerrada automaticamente");
    expect(applied.compareDocumentPosition(endedPause))
      .toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(screen.getByText(/Pendente → Aplicada/)).toBeInTheDocument();
    expect(screen.getAllByText(/Sistema/).length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText(/\{"/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Carregar eventos anteriores" }));
    expect(await screen.findByText("Registro legado de pausa")).toBeInTheDocument();
    expect(screen.getByText(/evidência histórica incompleta/)).toBeInTheDocument();
    expect(getPatientPlanHistory).toHaveBeenLastCalledWith("41", {
      limit: 20,
      cursor: "cursor-11",
    });
  });

  it("só exibe o estado vazio quando a API confirma ausência de eventos", async () => {
    axios.get.mockImplementation((url) => {
      if (url === "/patient-plans/41") {
        return Promise.resolve({ data: { id: 41, status: "active", patient_id: 11 } });
      }
      if (url === "/patient-plans/41/admin-summary") return Promise.resolve({ data: {} });
      return Promise.resolve({ data: {} });
    });
    getPatientPlanHistory.mockResolvedValueOnce({
      data: { events: [], page_info: { has_more: false, next_cursor: null } },
    });

    renderPlans("/planos/pacientes/41");
    fireEvent.click(await screen.findByRole("tab", { name: "Histórico" }));
    expect(await screen.findByText("Nenhum evento registrado para este plano."))
      .toBeInTheDocument();
  });

  it("exibe erro de autorização ou carregamento sem declarar histórico vazio", async () => {
    axios.get.mockImplementation((url) => {
      if (url === "/patient-plans/41") {
        return Promise.resolve({ data: { id: 41, status: "active", patient_id: 11 } });
      }
      if (url === "/patient-plans/41/admin-summary") return Promise.resolve({ data: {} });
      return Promise.resolve({ data: {} });
    });
    getPatientPlanHistory.mockRejectedValueOnce({
      response: { status: 403, data: { error: "Acesso negado ao histórico." } },
    });

    renderPlans("/planos/pacientes/41");
    fireEvent.click(await screen.findByRole("tab", { name: "Histórico" }));

    expect(await screen.findByText("Acesso negado ao histórico.")).toBeInTheDocument();
    expect(screen.queryByText("Nenhum evento registrado para este plano."))
      .not.toBeInTheDocument();
  });

  it("falha fechado e entrega a atribuição explícita ao cliente HTTP quando o vínculo não foi confirmado", async () => {
    const patientPlan = {
      id: 41,
      patient_id: 11,
      service_plan_id: 31,
      starts_at: "2030-02-01",
      status: "active",
      Patient: { id: 11, name: "Ana", surname: "Silva" },
      ServicePlan: {
        id: 31,
        name: "Mensal 1x",
        service_id: 7,
        sessions_per_week: 1,
      },
      agenda_summary: {
        status: "not_configured",
        can_configure_agenda: true,
        can_manage_agenda: false,
        primary_action: "configure_new_agenda",
        future_sessions_count: 0,
      },
    };
    listPatientPlans.mockResolvedValue({ data: [patientPlan] });
    listServicePlans.mockResolvedValue({ data: [patientPlan.ServicePlan] });
    axios.get.mockImplementation((url) => {
      if (url === "/services") {
        return Promise.resolve({ data: [{ id: 7, name: "Fisioterapia", is_active: true }] });
      }
      if (url === "/patients") return Promise.resolve({ data: [patientPlan.Patient] });
      if (url === "/users") return Promise.resolve({ data: [] });
      if (url === "/unit-scheduling-policy") {
        return Promise.resolve({ data: { allow_broken_time_scheduling: false } });
      }
      if (url === "/patient-plans/41") return Promise.resolve({ data: patientPlan });
      if (url === "/patient-plans/41/admin-summary") {
        return Promise.resolve({
          data: {
            header_summary: { patient_name: "Ana Silva" },
            plan_data_summary: { service_plan_name: "Mensal 1x" },
            agenda_summary: {
              status: "not_configured",
              can_configure_agenda: true,
              can_manage_agenda: false,
              primary_action: "configure_new_agenda",
              future_sessions_count: 0,
            },
          },
        });
      }
      if (url === "/schedule/references/professionals") {
        return Promise.resolve({
          data: [{
            id: 36,
            name: "Leonardo",
            clinic_professional_id: 99,
            is_assigned: null,
          }],
        });
      }
      return Promise.resolve({ data: {} });
    });
    axios.post.mockResolvedValue({ data: { total_created: 4, total_skipped: 0 } });

    renderPlans();
    fireEvent.click(await screen.findByRole("button", { name: "Detalhes" }));
    expect(await screen.findByRole("heading", { name: "Ana Silva" }))
      .toBeInTheDocument();
    await waitFor(() => expect(axios.get).toHaveBeenCalledWith("/patient-plans/41/admin-summary"));
    fireEvent.click(screen.getByRole("tab", { name: "Agenda" }));
    fireEvent.click(await screen.findByRole("button", { name: /Configurar.*agenda/i }));
    const scheduleDrawer = screen.getByRole("heading", { name: "Agendar Sessões do Plano" })
      .closest("aside");
    const professionalSelect = await within(scheduleDrawer).findByLabelText("Profissional *");
    await within(scheduleDrawer).findByRole("option", { name: "Leonardo" });
    expect(axios.get).toHaveBeenCalledWith("/schedule/references/professionals", {
      params: { patient_id: 11 },
    });
    fireEvent.change(professionalSelect, { target: { value: "36" } });
    fireEvent.change(within(scheduleDrawer).getByLabelText("Data da primeira sessão *"), {
      target: { value: "2030-02-04" },
    });
    fireEvent.click(within(scheduleDrawer).getByRole("button", { name: "Seg" }));
    fireEvent.click(within(scheduleDrawer).getByRole("button", { name: "Toda semana" }));
    const saveButton = within(scheduleDrawer).getByRole("button", { name: "Salvar" });
    fireEvent.submit(saveButton.closest("form"));

    const confirmation = (await screen.findByRole("heading", { name: "Confirmar agenda" }))
      .parentElement;
    expect(within(confirmation).getByText("Leonardo")).toBeInTheDocument();
    expect(within(confirmation).getByText(/será atribuído explicitamente ao paciente/i))
      .toBeInTheDocument();
    fireEvent.click(within(confirmation).getByRole("button", { name: "Voltar" }));
    expect(axios.post).not.toHaveBeenCalled();

    fireEvent.submit(saveButton.closest("form"));
    const reopenedConfirmation = (await screen.findByRole("heading", { name: "Confirmar agenda" }))
      .parentElement;
    fireEvent.click(within(reopenedConfirmation).getByRole("button", {
      name: "Atribuir e agendar sessões",
    }));

    await waitFor(() => expect(axios.post).toHaveBeenCalledTimes(1));
    const [requestUrl, requestPayload] = axios.post.mock.calls[0];
    expect(requestUrl).toBe("/session-series/plan-bulk");
    expect(requestPayload).toEqual(expect.objectContaining({
      assign_patient_care: true,
      clinic_professional_id: 99,
      series: [expect.objectContaining({
        patient_id: 11,
        patient_plan_id: 41,
        professional_user_id: 36,
        starts_at: "2030-02-04T08:00:00",
        weekdays: [1],
        included_cycle_weeks: [1, 2, 3, 4],
      })],
    }));
    expect(Object.keys(requestPayload).sort()).toEqual([
      "assign_patient_care",
      "clinic_professional_id",
      "series",
    ]);
    expect(requestPayload.series.every((item) => (
      !Object.prototype.hasOwnProperty.call(item, "assign_patient_care")
      && !Object.prototype.hasOwnProperty.call(item, "clinic_professional_id")
    ))).toBe(true);
  });

  it("executa preview e confirmação idempotente da alteração operacional da Agenda", async () => {
    const patientPlan = {
      id: 41,
      patient_id: 11,
      service_plan_id: 31,
      starts_at: "2026-05-18",
      anchor_day: 18,
      status: "active",
      Patient: { id: 11, name: "Ana", surname: "Silva" },
      ServicePlan: { id: 31, name: "Funcional 2x", sessions_per_week: 2 },
      agenda_summary: {
        status: "active_recurrence",
        pattern_summary: "Seg às 08:00 · Qua às 08:00",
        weekdays: [1, 3],
        time: "08:00",
        professional_user_id: 21,
        professional_name: "Leonardo",
        future_sessions_count: 8,
        can_remove_future_sessions: true,
      },
    };
    const adminSummary = {
      header_summary: { patient_name: "Ana Silva", plan_status_label: "Plano ativo" },
      plan_data_summary: {
        service_plan_name: "Funcional 2x",
        sessions_per_week: 2,
        price_cents: 48000,
        anchor_day: 18,
        starts_at: "2026-05-18",
      },
      agenda_summary: patientPlan.agenda_summary,
      pending_schedule_change: null,
    };
    const projectedScheduleChange = {
      revision_id: 72,
      status: "scheduled",
      effective_on: "2030-08-25",
      current_grid: [
        {
          weekday: 1,
          time: "08:00",
          professional_user_id: 21,
          professional_name: "Leonardo",
        },
        {
          weekday: 3,
          time: "08:00",
          professional_user_id: 21,
          professional_name: "Leonardo",
        },
      ],
      proposed_grid: [
        {
          weekday: 2,
          time: "09:00",
          professional_user_id: 36,
          professional_name: "Mariana",
        },
        {
          weekday: 3,
          time: "10:00",
          professional_user_id: 36,
          professional_name: "Mariana",
        },
      ],
      current_professional: { id: 21, name: "Leonardo" },
      future_professional: { id: 36, name: "Mariana" },
      professional_name: "Mariana",
      professional_changed: true,
    };
    let pendingScheduleChange = null;
    axios.get.mockImplementation((url) => {
      if (url === "/patient-plans/41") return Promise.resolve({ data: patientPlan });
      if (url === "/patient-plans/41/admin-summary") {
        return Promise.resolve({
          data: {
            ...adminSummary,
            pending_schedule_change: pendingScheduleChange,
          },
        });
      }
      if (url === "/schedule/references/professionals") {
        return Promise.resolve({
          data: [
            { id: 21, name: "Leonardo", clinic_professional_id: 80, is_assigned: true },
            { id: 36, name: "Mariana", clinic_professional_id: 99, is_assigned: false },
          ],
        });
      }
      if (url === "/services") return Promise.resolve({ data: [] });
      if (url === "/patients") return Promise.resolve({ data: [patientPlan.Patient] });
      if (url === "/unit-scheduling-policy") return Promise.resolve({ data: {} });
      return Promise.resolve({ data: {} });
    });
    axios.post.mockImplementation((url, payload) => {
      if (url.endsWith("/schedule-change-preview")) {
        return Promise.resolve({
          data: {
            can_confirm: true,
            effective_on: payload.effective_on,
            current_grid: [
              { weekday: 1, time: "08:00", professional_user_id: 21 },
              { weekday: 3, time: "08:00", professional_user_id: 21 },
            ],
            proposed_grid: payload.schedule,
            observed_revision_id: 71,
            expected_version: 4,
            preview_token: "preview-token",
            protected_sessions: [],
            conflicts: [],
          },
        });
      }
      if (url.endsWith("/schedule-change")) {
        pendingScheduleChange = projectedScheduleChange;
        return Promise.resolve({ data: { effective_on: payload.effective_on } });
      }
      return Promise.resolve({ data: {} });
    });

    const firstRender = renderPlans("/planos/pacientes/41");
    fireEvent.click(await screen.findByRole("tab", { name: "Agenda" }));
    expect(await screen.findByText("Seg 08h · Qua 08h")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Alterar agenda/i }));

    const dialog = await screen.findByRole("dialog", { name: "Alterar agenda" });
    const professional = await within(dialog).findByLabelText("Profissional");
    fireEvent.change(within(dialog).getByLabelText("Nova agenda a partir de"), {
      target: { name: "effective_on", value: "2030-08-25" },
    });
    fireEvent.change(professional, { target: { name: "professional_user_id", value: "36" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Seg" }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Ter" }));
    fireEvent.change(within(dialog).getByLabelText("Horário de Ter"), {
      target: { value: "09:00" },
    });
    fireEvent.change(within(dialog).getByLabelText("Horário de Qua"), {
      target: { value: "10:00" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Revisar alteração" }));

    expect(await within(dialog).findByText("Ter 09h · Qua 10h")).toBeInTheDocument();
    expect(within(dialog).getByText("Profissional: Leonardo → Mariana")).toBeInTheDocument();
    expect(axios.post).toHaveBeenCalledWith(
      "/patient-plans/41/schedule-change-preview",
      expect.objectContaining({
        effective_on: "2030-08-25",
        schedule: [
          { weekday: 2, time: "09:00", professional_user_id: 36 },
          { weekday: 3, time: "10:00", professional_user_id: 36 },
        ],
      }),
    );

    fireEvent.click(within(dialog).getByRole("button", { name: "Confirmar alteração" }));
    await waitFor(() => expect(axios.post).toHaveBeenCalledWith(
      "/patient-plans/41/schedule-change",
      expect.objectContaining({
        observed_revision_id: 71,
        expected_version: 4,
        preview_token: "preview-token",
        assign_patient_care: true,
      }),
      { headers: { "Idempotency-Key": expect.stringMatching(/^schedule-change-41-/) } },
    ));
    expect(await screen.findByText(/Alteração agendada/)).toBeInTheDocument();
    expect(screen.getByText(
      "Seg 08h · Qua 08h → Ter 09h · Qua 10h",
    )).toBeInTheDocument();
    expect(screen.getByText("Profissional: Leonardo → Mariana")).toBeInTheDocument();
    expect(axios.get.mock.calls.filter(([url]) => url === "/patient-plans/41/admin-summary").length)
      .toBeGreaterThanOrEqual(2);

    firstRender.unmount();
    const refreshedRender = renderPlans("/planos/pacientes/41");
    fireEvent.click(await screen.findByRole("tab", { name: "Agenda" }));
    expect(await screen.findByText(/Alteração agendada/)).toBeInTheDocument();
    expect(screen.getByText(
      "Seg 08h · Qua 08h → Ter 09h · Qua 10h",
    )).toBeInTheDocument();

    refreshedRender.unmount();
    pendingScheduleChange = null;
    renderPlans("/planos/pacientes/41");
    fireEvent.click(await screen.findByRole("tab", { name: "Agenda" }));
    await waitFor(() => {
      expect(screen.queryByText(/Alteração agendada/)).not.toBeInTheDocument();
    });
    expect(await screen.findByRole("button", { name: /Alterar agenda/i })).toBeInTheDocument();
  });

  it("mantém impedimento inline e invalida confirmação quando o backend acusa stale", async () => {
    const patientPlan = {
      id: 41,
      patient_id: 11,
      service_plan_id: 31,
      status: "active",
      Patient: { id: 11, name: "Ana", surname: "Silva" },
      ServicePlan: { id: 31, name: "Funcional 1x", sessions_per_week: 1 },
      agenda_summary: {
        status: "active_recurrence",
        pattern_summary: "Seg às 08:00",
        weekdays: [1],
        time: "08:00",
        professional_user_id: 21,
        professional_name: "Leonardo",
        future_sessions_count: 4,
      },
    };
    axios.get.mockImplementation((url) => {
      if (url === "/patient-plans/41") return Promise.resolve({ data: patientPlan });
      if (url === "/patient-plans/41/admin-summary") {
        return Promise.resolve({
          data: {
            plan_data_summary: { service_plan_name: "Funcional 1x", sessions_per_week: 1 },
            agenda_summary: patientPlan.agenda_summary,
          },
        });
      }
      if (url === "/schedule/references/professionals") {
        return Promise.resolve({
          data: [{ id: 21, name: "Leonardo", clinic_professional_id: 80, is_assigned: true }],
        });
      }
      return Promise.resolve({ data: {} });
    });
    axios.post
      .mockResolvedValueOnce({
        data: {
          can_confirm: false,
          effective_on: "2030-08-25",
          current_grid: [{ weekday: 1, time: "08:00", professional_user_id: 21 }],
          proposed_grid: [{ weekday: 1, time: "09:00", professional_user_id: 21 }],
          protected_sessions: [{
            id: 9,
            starts_at: "2030-08-26T09:00:00",
            reasons: ["has_evaluation"],
          }],
          conflicts: [],
        },
      })
      .mockResolvedValueOnce({
        data: {
          can_confirm: true,
          effective_on: "2030-08-25",
          current_grid: [{ weekday: 1, time: "08:00", professional_user_id: 21 }],
          proposed_grid: [{ weekday: 1, time: "09:00", professional_user_id: 21 }],
          observed_revision_id: 71,
          expected_version: 4,
          preview_token: "preview-token",
          protected_sessions: [],
          conflicts: [],
        },
      })
      .mockRejectedValueOnce({
        response: {
          data: { code: "SCHEDULE_CHANGE_PREVIEW_STALE", error: "A Agenda mudou. Revise novamente." },
        },
      });

    renderPlans("/planos/pacientes/41");
    fireEvent.click(await screen.findByRole("tab", { name: "Agenda" }));
    fireEvent.click(await screen.findByRole("button", { name: /Alterar agenda/i }));
    const dialog = await screen.findByRole("dialog", { name: "Alterar agenda" });
    fireEvent.change(await within(dialog).findByLabelText("Horário de Seg"), {
      target: { value: "09:00" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Revisar alteração" }));
    expect(await within(dialog).findByText(/possui avaliação vinculada/)).toBeInTheDocument();
    expect(within(dialog).queryByRole("button", { name: "Confirmar alteração" }))
      .not.toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole("button", { name: "Revisar alteração" }));
    const confirm = await within(dialog).findByRole("button", { name: "Confirmar alteração" });
    fireEvent.click(confirm);
    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "A Agenda mudou. Revise novamente.",
    );
    expect(within(dialog).queryByRole("button", { name: "Confirmar alteração" }))
      .not.toBeInTheDocument();
  });

  it("não remonta a antiga sidebar interna nem cria um segundo main", () => {
    const source = fs.readFileSync(path.join(__dirname, "index.js"), "utf8");

    expect(source).not.toMatch(/SidebarShellWrapper|AppSidebar|<main/);
  });
});
