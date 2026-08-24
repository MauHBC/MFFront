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
  getPatientPlansOverview,
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
jest.mock("../../contexts/AuthorizationContext", () => ({
  useAuthorization: () => ({
    canAccessModule: () => true,
    hasCapability: () => true,
  }),
}));
jest.mock("../../services/financial", () => ({
  listServicePlans: jest.fn(),
  createServicePlan: jest.fn(),
  updateServicePlan: jest.fn(),
  deactivateServicePlan: jest.fn(),
  listServicePrices: jest.fn(),
  createServicePrice: jest.fn(),
  updateServicePrice: jest.fn(),
  getPatientPlansOverview: jest.fn(),
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

const overviewFor = (patientPlans = []) => ({
  data: {
    summary: {
      active_plans: patientPlans.filter((plan) => plan.status === "active").length,
      paused_plans: patientPlans.filter((plan) => plan.status === "paused").length,
      pending_agendas: 0,
      scope: "current_patient_service_filters",
    },
    groups: patientPlans.length > 0 ? [{
      patient: {
        id: patientPlans[0].patient_id,
        name: patientPlans[0].Patient?.full_name || patientPlans[0].Patient?.name || "Ana",
      },
      plans: patientPlans.map((plan) => ({
        patient_plan_id: plan.id,
        commercial_name: plan.ServicePlan?.name || "Plano",
        service_id: plan.ServicePlan?.service_id || 7,
        sessions_per_week: plan.ServicePlan?.sessions_per_week || null,
        frequency_label: plan.ServicePlan?.frequency_label || null,
        agenda_state: plan.agenda_summary?.status === "not_configured" ? "pending" : "configured",
        status: plan.status,
        starts_at: plan.starts_at || null,
      })),
    }] : [],
    page_info: {
      page: 1,
      page_size: 25,
      total_groups: patientPlans.length > 0 ? 1 : 0,
      total_plans: patientPlans.length,
      total_pages: patientPlans.length > 0 ? 1 : 0,
    },
  },
});

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
    getPatientPlansOverview.mockResolvedValue(overviewFor([{
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
      }]));
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
    expect(screen.getByRole("heading", { name: "Planos" })).toBeInTheDocument();
    expect(await screen.findByText("Ana")).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText("Nome do paciente"), {
      target: { value: "inexistente" },
    });

    await waitFor(() => expect(getPatientPlansOverview).toHaveBeenLastCalledWith(
      expect.objectContaining({ patient_query: "inexistente" }),
    ));
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

  it("consulta o read-model ao alternar visão e filtros operacionais", async () => {
    renderPlans();
    expect((await screen.findAllByText("Mensal 2x")).length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("tab", { name: "Encerrados" }));
    fireEvent.change(screen.getByLabelText("Serviço"), { target: { value: "7" } });
    fireEvent.change(screen.getByLabelText("Status"), { target: { value: "canceled" } });
    fireEvent.change(screen.getByLabelText("Agenda"), { target: { value: "pending" } });

    await waitFor(() => expect(getPatientPlansOverview).toHaveBeenLastCalledWith({
      view: "closed",
      page: 1,
      page_size: 25,
      service_id: "7",
      status: "canceled",
      agenda: "pending",
    }));
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
              id: 16,
              sequence: 16,
              type: "schedule_revision_cutover",
              label: "Estrutura versionada da Agenda iniciada",
              occurred_at: "2026-08-20T00:00:00.000Z",
              origin: "backfill",
              changes: [{
                field: "schedule_cutover_series_count",
                label: "Séries legadas adotadas",
                before: null,
                after: 2,
              }],
              legacy: { is_legacy: true, is_incomplete: false },
            },
            {
              id: 15,
              sequence: 15,
              type: "legacy_pause_financial_regularized",
              label: "Estado legado após pausa regularizado",
              occurred_at: "2026-08-20T00:00:00.000Z",
              origin: "backfill",
              changes: [{
                field: "legacy_regularization_reactivated_sessions",
                label: "Sessões reativadas",
                before: 0,
                after: 10,
              }],
              legacy: { is_legacy: true, is_incomplete: false },
            },
            {
              id: 14,
              sequence: 14,
              type: "schedule_change_applied",
              label: "Alteração de agenda aplicada",
              occurred_at: "2026-08-21T00:05:00",
              origin: "automatic",
              actor: { name: "Sistema" },
              changes: [
                {
                  field: "schedule_change_status",
                  label: "Estado da alteração da Agenda",
                  before: "pending",
                  after: "applied",
                },
                { field: "schedule_revision_id", label: "Revisão", before: 4, after: 6 },
                { field: "lifecycle_status", label: "Lifecycle", before: "future", after: "current" },
                { field: "version", label: "Versão", before: 1, after: 2 },
              ],
              legacy: { is_legacy: false, is_incomplete: true },
            },
            {
              id: 13,
              sequence: 13,
              type: "schedule_change_canceled",
              label: "Alteração futura da Agenda cancelada",
              occurred_at: "2026-08-20T20:00:00",
              origin: "manual",
              actor: { name: "MHBC" },
              changes: [
                {
                  field: "schedule_change_status",
                  label: "Estado da alteração da Agenda",
                  before: "pending",
                  after: "canceled",
                },
                {
                  field: "schedule_change_restored_sessions",
                  label: "Sessões restauradas da Agenda",
                  before: null,
                  after: 15,
                },
                {
                  field: "schedule_revision_id",
                  label: "Revisão da grade",
                  before: 4,
                  after: 6,
                },
                { field: "version", label: "Versão", before: 1, after: 2 },
                {
                  field: "lifecycle_status",
                  label: "Lifecycle",
                  before: "pending",
                  after: "canceled",
                },
              ],
              legacy: { is_legacy: false, is_incomplete: false },
            },
            {
              id: 12,
              sequence: 12,
              type: "commercial_change_requested",
              label: "Alteração comercial solicitada",
              occurred_at: "2026-08-06T12:00:00.000Z",
              origin: "manual",
              actor: { name: "Leonardo" },
              changes: [
                {
                  field: "change_status",
                  label: "Status da alteração",
                  before: null,
                  after: "pending",
                },
                {
                  field: "service_plan_name",
                  label: "Plano comercial",
                  before: "Mensal 2x",
                  after: "Mensal 3x",
                },
                {
                  field: "effective_on",
                  label: "Data de vigência",
                  before: null,
                  after: "2026-08-18",
                },
                {
                  field: "sessions_per_week",
                  label: "Sessões por semana",
                  before: 2,
                  after: 3,
                },
                {
                  field: "frequency_label",
                  label: "Frequência",
                  before: "2x por semana",
                  after: "3x por semana",
                },
                {
                  field: "price_cents",
                  label: "Valor contratado",
                  before: 48000,
                  after: 60000,
                },
                {
                  field: "change_version",
                  label: "Versão da alteração",
                  before: 1,
                  after: 2,
                },
              ],
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
            changes: [
              { field: "starts_on", before: null, after: "2026-07-01" },
              { field: "ends_on", before: null, after: null },
              { field: "is_indefinite", before: null, after: true },
              { field: "pause_status", before: null, after: "ended" },
              { field: "pause_version", before: null, after: 2 },
            ],
            legacy: { is_legacy: true, is_incomplete: true },
          }],
          page_info: { has_more: false, next_cursor: null },
        },
      });

    renderPlans("/planos/pacientes/41");
    fireEvent.click(await screen.findByRole("tab", { name: "Histórico" }));

    const appliedScheduleChange = await screen.findByText(
      "21 ago 2026, 00h05 · Nova agenda vigente",
    );
    expect(appliedScheduleChange.closest("article").children).toHaveLength(1);
    const canceledScheduleChange = await screen.findByText(
      "20 ago 2026, 20h · Alteração de agenda cancelada",
    );
    const canceledBlock = canceledScheduleChange.closest("article");
    expect(canceledBlock).toBeInTheDocument();
    expect(canceledBlock.children).toHaveLength(1);
    expect(canceledScheduleChange).toHaveStyle({
      fontSize: "0.9rem",
      fontWeight: "800",
    });
    expect(screen.queryByText(/Registrado em 20 ago 2026/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Estado da alteração da Agenda/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Sessões restauradas da Agenda/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Revisão da grade|Lifecycle/)).not.toBeInTheDocument();
    expect(screen.queryByText("MHBC")).not.toBeInTheDocument();
    const scheduled = await screen.findByText(/· Troca de plano agendada$/);
    const endedPause = screen.getByText(/· Pausa encerrada automaticamente$/);
    expect(scheduled.compareDocumentPosition(endedPause))
      .toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(screen.getByText(/Mensal 2x → Mensal 3x/)).toBeInTheDocument();
    expect(scheduled).toHaveTextContent(/^6 ago 2026, \d{1,2}h · Troca de plano agendada$/);
    expect(screen.queryByText(/Leonardo|Sistema|MHBC/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Solicitada em|Registrado em/)).not.toBeInTheDocument();
    const scheduledBlock = scheduled.closest("article");
    const vigency = screen.getByText("A partir de 18 ago 2026");
    const changeDetail = screen.getByText("Frequência: 2x → 3x por semana");
    expect(scheduledBlock).toHaveStyle({
      background: "rgba(106, 121, 92, 0.055)",
      borderRadius: "10px",
      gap: "5px",
      padding: "10px 12px",
    });
    expect(vigency).toHaveStyle({
      fontSize: "0.86rem",
      fontWeight: "400",
    });
    expect(changeDetail).toHaveStyle({
      color: "#78827b",
      fontSize: "0.86rem",
      fontWeight: "400",
    });
    expect(screen.queryByText(/Sessões por semana:/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Plano comercial:/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Valor contratado:/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Não informado → Pendente/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Estrutura versionada|Séries legadas adotadas/))
      .not.toBeInTheDocument();
    expect(screen.queryByText(/Estado legado após pausa|Sessões reativadas/))
      .not.toBeInTheDocument();
    expect(screen.queryByText(/Status da pausa|Não informado → Encerrada|Versão da pausa/i))
      .not.toBeInTheDocument();
    expect(screen.queryByText(/\{"/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Carregar eventos anteriores" }));
    expect(await screen.findByText(/· Pausa iniciada$/)).toBeInTheDocument();
    expect(screen.getByText("A partir de 1 jul")).toBeInTheDocument();
    expect(screen.getByText("Sem data de retorno")).toBeInTheDocument();
    expect(screen.queryByText(/Evidência histórica incompleta/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Versão da alteração/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Registro legado/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/snapshot|backfill/i)).not.toBeInTheDocument();
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
    getPatientPlansOverview.mockResolvedValue(overviewFor([patientPlan]));
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
    fireEvent.click(await screen.findByRole("link", { name: /Mensal 1x de Ana/i }));
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
    expect(within(confirmation).queryByText(/será atribuído explicitamente ao paciente/i))
      .not.toBeInTheDocument();
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

  it("agrupa conflitos recorrentes e mantém bloqueada a confirmação da Agenda inicial", async () => {
    const patientPlan = {
      id: 41,
      patient_id: 11,
      service_plan_id: 31,
      starts_at: "2030-02-01",
      status: "active",
      Patient: { id: 11, name: "Ana", surname: "Silva" },
      ServicePlan: {
        id: 31,
        name: "Fisioterapia 1x",
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
    getPatientPlansOverview.mockResolvedValue(overviewFor([patientPlan]));
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
        return Promise.resolve({ data: {
          header_summary: { patient_name: "Ana Silva" },
          plan_data_summary: { service_plan_name: "Fisioterapia 1x", sessions_per_week: 1 },
          agenda_summary: patientPlan.agenda_summary,
        } });
      }
      if (url === "/schedule/references/professionals") {
        return Promise.resolve({ data: [{
          id: 36,
          name: "Leonardo",
          clinic_professional_id: 99,
          is_assigned: true,
        }] });
      }
      return Promise.resolve({ data: {} });
    });
    const conflictingPlan = {
      patient_plan_id: 82,
      service_plan_id: 42,
      service_id: 8,
      service_name: "Pilates",
      service_plan_name: "Pilates recorrente",
      sessions_per_week: 2,
    };
    axios.post.mockRejectedValueOnce({ response: { data: {
      error: "Este paciente já possui um atendimento nesse horário.",
      code: "PATIENT_SCHEDULE_CONFLICT",
      conflicts: [101, 108, 115].map((sessionId) => ({
        code: "PATIENT_SCHEDULE_CONFLICT",
        session_id: sessionId,
        weekday: 1,
        time: "08:00",
        conflicting_patient_plan: conflictingPlan,
      })),
    } } });

    renderPlans();
    fireEvent.click(await screen.findByRole("link", { name: /Fisioterapia 1x de Ana/i }));
    expect(await screen.findByRole("heading", { name: "Ana Silva" })).toBeInTheDocument();
    await waitFor(() => expect(axios.get).toHaveBeenCalledWith("/patient-plans/41/admin-summary"));
    fireEvent.click(await screen.findByRole("tab", { name: "Agenda" }));
    fireEvent.click(await screen.findByRole("button", { name: /Configurar.*agenda/i }));
    const drawer = screen.getByRole("heading", { name: "Agendar Sessões do Plano" })
      .closest("aside");
    const professionalSelect = await within(drawer).findByLabelText("Profissional *");
    await within(drawer).findByRole("option", { name: "Leonardo" });
    fireEvent.change(professionalSelect, {
      target: { value: "36" },
    });
    fireEvent.change(within(drawer).getByLabelText("Data da primeira sessão *"), {
      target: { value: "2030-02-04" },
    });
    fireEvent.click(within(drawer).getByRole("button", { name: "Seg" }));
    fireEvent.click(within(drawer).getByRole("button", { name: "Toda semana" }));
    fireEvent.submit(within(drawer).getByRole("button", { name: "Salvar" }).closest("form"));
    const confirmation = (await screen.findByRole("heading", { name: "Confirmar agenda" }))
      .parentElement;
    fireEvent.click(within(confirmation).getByRole("button", { name: "Confirmar lançamento" }));

    expect(await within(confirmation).findByText("Conflito de horário")).toBeInTheDocument();
    expect(within(confirmation).getByText(
      "Segunda às 8h já está ocupada pelo plano Pilates 2x/semana deste paciente.",
    )).toBeInTheDocument();
    expect(within(confirmation).getByRole("button", { name: "Confirmar lançamento" }))
      .toBeDisabled();
  });

  it("bloqueia edição da troca vencida e remove o painel quando o resumo não traz pendência", async () => {
    const patientPlan = {
      id: 41,
      patient_id: 11,
      service_plan_id: 31,
      starts_at: "2026-05-18",
      status: "active",
      Patient: { id: 11, name: "Ana", surname: "Silva" },
      ServicePlan: { id: 31, name: "Mensal 2x", sessions_per_week: 2 },
    };
    let pendingPlanChange = {
      id: 77,
      version: 3,
      status: "pending",
      service_plan_id: 32,
      service_plan_name: "Mensal 3x",
      effective_on: "2026-08-18",
      lifecycle_state: "overdue_awaiting_lifecycle",
      can_replace: false,
      requested_at: "2026-08-10T13:00:00.000Z",
      previous_configuration: {
        service_plan_name: "Mensal 2x",
        sessions_per_week: 2,
        price_cents: 48000,
      },
      new_configuration: {
        service_plan_name: "Mensal 3x",
        sessions_per_week: 3,
        price_cents: 60000,
      },
      previous_schedule: [
        { weekday: 1, time: "11:00", professional_user_id: 21 },
        { weekday: 3, time: "11:00", professional_user_id: 21 },
        { weekday: 5, time: "11:00", professional_user_id: 21 },
      ],
      new_schedule: [
        { weekday: 2, time: "08:00", professional_user_id: 36 },
        { weekday: 4, time: "08:00", professional_user_id: 36 },
      ],
    };
    getPatientPlanHistory.mockResolvedValue({
      data: {
        events: [{
          id: 91,
          type: "commercial_change_requested",
          occurred_at: "2026-08-10T13:00:00.000Z",
          actor: { name: "Leonardo" },
          related_entity: { type: "patient_plan_change", id: 77 },
        }],
        page_info: { has_more: false, next_cursor: null },
      },
    });
    axios.get.mockImplementation((url) => {
      if (url === "/patient-plans/41") return Promise.resolve({ data: patientPlan });
      if (url === "/patient-plans/41/admin-summary") {
        return Promise.resolve({
          data: {
            plan_data_summary: {
              service_plan_name: "Mensal 2x",
              starts_at: "2026-05-18",
            },
            pending_plan_change: pendingPlanChange,
          },
        });
      }
      if (url === "/schedule/references/professionals") {
        return Promise.resolve({
          data: [
            { id: 21, name: "Leonardo", clinic_professional_id: 80 },
            { id: 36, name: "Mariana", clinic_professional_id: 99 },
          ],
        });
      }
      if (url === "/services") return Promise.resolve({ data: [] });
      if (url === "/patients") return Promise.resolve({ data: [patientPlan.Patient] });
      if (url === "/users") return Promise.resolve({ data: [] });
      if (url === "/unit-scheduling-policy") return Promise.resolve({ data: {} });
      return Promise.resolve({ data: {} });
    });

    const firstRender = renderPlans("/planos/pacientes/41");
    const overdueTitle = await screen.findByText("Troca aguardando atualização");
    const overduePanel = overdueTitle.closest("section");
    expect(overduePanel).toHaveTextContent("Solicitada em 10 ago · Leonardo");
    expect(overduePanel).toHaveTextContent("Vigência: 18 ago");
    expect(overduePanel).toHaveTextContent("Mensal 2x → Mensal 3x");
    expect(overduePanel).toHaveTextContent("Frequência: 2x → 3x por semana");
    expect(overduePanel).toHaveTextContent(/Valor: R\$\s*480,00 → R\$\s*600,00/);
    expect(overduePanel).toHaveTextContent("Agenda Atual: Seg 11h · Qua 11h · Sex 11h");
    expect(overduePanel).toHaveTextContent("Agenda Nova: Ter 08h · Qui 08h");
    await waitFor(() => {
      expect(overduePanel).toHaveTextContent("Profissional: Leonardo → Mariana");
    });
    expect(screen.queryByRole("button", { name: "Revisar troca" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Editar" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cancelar troca" })).not.toBeInTheDocument();

    firstRender.unmount();
    pendingPlanChange = null;
    renderPlans("/planos/pacientes/41");
    await waitFor(() => {
      expect(screen.queryByText("Troca aguardando atualização")).not.toBeInTheDocument();
    });
    expect(await screen.findByRole("button", { name: "Trocar plano" })).toBeInTheDocument();
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
    expect(await screen.findByText("Plano iniciado em 18 mai 2026")).toBeInTheDocument();
    fireEvent.click(await screen.findByRole("tab", { name: "Agenda" }));
    const recurringSchedule = await screen.findByRole("list", {
      name: "Horários da agenda recorrente",
    });
    expect(within(recurringSchedule).getByText("Seg 08h")).toBeInTheDocument();
    expect(within(recurringSchedule).getByText("Qua 08h")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Alterar agenda/i }));

    const dialog = await screen.findByRole("dialog", { name: "Alterar agenda" });
    const professional = await within(dialog).findByLabelText("Profissional");
    fireEvent.change(within(dialog).getByLabelText("Nova agenda a partir de"), {
      target: { name: "effective_on", value: "2030-08-25" },
    });
    fireEvent.change(professional, { target: { name: "professional_user_id", value: "36" } });
    expect(within(dialog).queryByText(
      "Ao confirmar, o profissional será atribuído ao paciente.",
    )).not.toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "Seg" }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Ter" }));
    fireEvent.change(within(dialog).getByLabelText("Horário de terça"), {
      target: { value: "09:00" },
    });
    fireEvent.change(within(dialog).getByLabelText("Horário de quarta"), {
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
    expect(await screen.findByText(/Nova agenda · a partir de/)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Agenda" }).closest("section"))
      .toHaveTextContent("Ativa");
    const scheduledCurrentAgenda = screen.getByRole("group", { name: "Agenda atual" });
    const scheduledNewAgenda = screen.getByRole("group", { name: "Agenda nova" });
    expect(within(scheduledCurrentAgenda).getByText("Seg 08h")).toBeInTheDocument();
    expect(within(scheduledCurrentAgenda).getByText("Qua 08h")).toBeInTheDocument();
    expect(within(scheduledNewAgenda).getByText("Ter 09h")).toBeInTheDocument();
    expect(within(scheduledNewAgenda).getByText("Qua 10h")).toBeInTheDocument();
    expect(screen.getByText("Profissional: Leonardo → Mariana")).toBeInTheDocument();
    expect(axios.get.mock.calls.filter(([url]) => url === "/patient-plans/41/admin-summary").length)
      .toBeGreaterThanOrEqual(2);

    firstRender.unmount();
    const refreshedRender = renderPlans("/planos/pacientes/41");
    fireEvent.click(await screen.findByRole("tab", { name: "Agenda" }));
    expect(await screen.findByText(/Nova agenda · a partir de/)).toBeInTheDocument();
    const refreshedCurrentAgenda = screen.getByRole("group", { name: "Agenda atual" });
    const refreshedNewAgenda = screen.getByRole("group", { name: "Agenda nova" });
    expect(within(refreshedCurrentAgenda).getByText("Seg 08h")).toBeInTheDocument();
    expect(within(refreshedCurrentAgenda).getByText("Qua 08h")).toBeInTheDocument();
    expect(within(refreshedNewAgenda).getByText("Ter 09h")).toBeInTheDocument();
    expect(within(refreshedNewAgenda).getByText("Qua 10h")).toBeInTheDocument();

    refreshedRender.unmount();
    pendingScheduleChange = null;
    renderPlans("/planos/pacientes/41");
    fireEvent.click(await screen.findByRole("tab", { name: "Agenda" }));
    await waitFor(() => {
      expect(screen.queryByText(/Nova agenda · a partir de/)).not.toBeInTheDocument();
    });
    expect(await screen.findByRole("button", { name: /Alterar agenda/i })).toBeInTheDocument();
  });

  it("mantém Agenda ativa quando a troca é amanhã e a grade atual não tem mais sessões", async () => {
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
        status: "no_future_sessions",
        status_message: "Configure uma nova agenda para continuar os atendimentos deste plano.",
        pattern_summary: "Ter às 09:00 · Qua às 10:00",
        weekdays: [1, 3],
        time: "08:00",
        professional_user_id: 21,
        professional_name: "Leonardo",
        next_session: null,
        future_sessions_count: 0,
        can_configure_agenda: true,
        primary_action: "configure_new_agenda",
        can_remove_future_sessions: true,
      },
    };
    const currentGrid = [
      { weekday: 1, time: "08:00", professional_user_id: 21, professional_name: "Leonardo" },
      { weekday: 3, time: "08:00", professional_user_id: 21, professional_name: "Leonardo" },
    ];
    let pendingScheduleChange = {
      schedule_change_id: 91,
      revision_id: 72,
      status: "pending",
      effective_on: "2026-08-22",
      is_effective: false,
      awaiting_promotion: false,
      current_grid: currentGrid,
      proposed_grid: [
        { weekday: 2, time: "09:00", professional_user_id: 36, professional_name: "Mariana" },
        { weekday: 3, time: "10:00", professional_user_id: 36, professional_name: "Mariana" },
      ],
      current_professional: { id: 21, name: "Leonardo" },
      future_professional: { id: 36, name: "Mariana" },
      professional_changed: true,
      can_cancel: true,
      command_token: "opaque-command-token",
    };
    axios.get.mockImplementation((url) => {
      if (url === "/patient-plans/41") return Promise.resolve({ data: patientPlan });
      if (url === "/patient-plans/41/admin-summary") {
        return Promise.resolve({
          data: {
            header_summary: { patient_name: "Ana Silva", plan_status_label: "Plano ativo" },
            plan_data_summary: { service_plan_name: "Funcional 2x", sessions_per_week: 2 },
            agenda_summary: patientPlan.agenda_summary,
            pending_schedule_change: pendingScheduleChange,
          },
        });
      }
      if (url === "/schedule/references/professionals") {
        return Promise.resolve({
          data: [
            { id: 21, name: "Leonardo", clinic_professional_id: 80, is_assigned: true },
            { id: 36, name: "Mariana", clinic_professional_id: 99, is_assigned: true },
          ],
        });
      }
      if (url === "/services") return Promise.resolve({ data: [] });
      if (url === "/patients") return Promise.resolve({ data: [patientPlan.Patient] });
      if (url === "/unit-scheduling-policy") return Promise.resolve({ data: {} });
      return Promise.resolve({ data: {} });
    });
    axios.post.mockImplementation((url) => {
      if (url.endsWith("/schedule-change/cancel")) {
        pendingScheduleChange = null;
        patientPlan.agenda_summary.status = "active_recurrence";
        patientPlan.agenda_summary.pattern_summary = "Seg às 08:00 · Qua às 08:00";
        patientPlan.agenda_summary.future_sessions_count = 8;
        return Promise.resolve({ data: { ok: true } });
      }
      return Promise.resolve({ data: {} });
    });

    renderPlans("/planos/pacientes/41");
    expect(await screen.findByText(
      "Para alterações no plano, primeiro cancele a troca de agenda.",
    )).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Trocar plano" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Editar dados" })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "Ações do plano" }));
    expect(screen.getByRole("menuitem", { name: "Pausar plano" })).toBeDisabled();
    expect(screen.getByRole("menuitem", { name: "Cancelar plano" })).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Cancelar alteração" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "Agenda" }));
    const agendaCard = (await screen.findByRole("heading", { name: "Agenda" }))
      .closest("section");
    expect(agendaCard).toHaveTextContent("Ativa");
    expect(within(agendaCard).queryByText("Sem sessões futuras")).not.toBeInTheDocument();
    expect(within(agendaCard).queryByText(
      "Configure uma nova agenda para continuar os atendimentos deste plano.",
    )).not.toBeInTheDocument();
    const recurringSchedule = screen.getByRole("list", {
      name: "Horários da agenda recorrente",
    });
    expect(within(recurringSchedule).getByText("Seg 08h")).toBeInTheDocument();
    expect(within(recurringSchedule).getByText("Qua 08h")).toBeInTheDocument();
    expect(within(recurringSchedule).queryByText("Ter 09h")).not.toBeInTheDocument();
    expect(within(recurringSchedule).queryByText("Qua 10h")).not.toBeInTheDocument();
    const agendaSupport = screen.getByLabelText("Informações da agenda");
    expect(within(agendaSupport).getByText("Toda semana")).toBeInTheDocument();
    expect(within(agendaSupport).getByText("Profissional: Leonardo")).toBeInTheDocument();
    expect(within(agendaSupport).queryByText(/Próxima sessão:/)).not.toBeInTheDocument();
    expect(screen.getByText(/Nova agenda · a partir de/)).toBeInTheDocument();
    expect(screen.queryByText(/Alteração de agenda · a partir de/)).not.toBeInTheDocument();
    expect(screen.queryByText("Alteração programada")).not.toBeInTheDocument();
    const currentAgenda = await screen.findByRole("group", { name: "Agenda atual" });
    const newAgenda = screen.getByRole("group", { name: "Agenda nova" });
    expect(within(currentAgenda).getAllByRole("listitem")).toHaveLength(2);
    expect(within(currentAgenda).getByText("Seg 08h")).toBeInTheDocument();
    expect(within(currentAgenda).getByText("Qua 08h")).toBeInTheDocument();
    expect(within(newAgenda).getAllByRole("listitem")).toHaveLength(2);
    expect(within(newAgenda).getByText("Ter 09h")).toBeInTheDocument();
    expect(within(newAgenda).getByText("Qua 10h")).toBeInTheDocument();
    expect(screen.getByText("Profissional: Leonardo → Mariana")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Editar alteração" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Ações de Alteração de agenda/i }))
      .not.toBeInTheDocument();
    expect(screen.queryByText("Já existe uma alteração de Agenda agendada."))
      .not.toBeInTheDocument();
    expect(axios.post.mock.calls.some(([url]) => url.endsWith("/schedule-change/replace")))
      .toBe(false);

    const cancelScheduleChangeButton = screen.getByRole("button", {
      name: "Cancelar alteração",
    });
    expect(cancelScheduleChangeButton).toBeVisible();
    fireEvent.click(cancelScheduleChangeButton);
    const confirmation = screen.getByRole("dialog", {
      name: "Cancelar alteração de agenda?",
    });
    expect(within(confirmation).getByText("A agenda atual será mantida.")).toBeInTheDocument();
    expect(within(confirmation).getByRole("button", { name: "Voltar" })).toBeInTheDocument();
    fireEvent.click(within(confirmation).getByRole("button", { name: "Cancelar alteração" }));
    await waitFor(() => expect(axios.post).toHaveBeenCalledWith(
      "/patient-plans/41/schedule-change/cancel",
      {
        schedule_change_id: 91,
        schedule_change_token: "opaque-command-token",
      },
      { headers: { "Idempotency-Key": expect.stringMatching(/^schedule-change-41-/) } },
    ));
    await waitFor(() => {
      expect(screen.queryByText(/Nova agenda · a partir de/)).not.toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: /Alterar agenda/i })).toBeInTheDocument();
  });

  it("mantém Sem sessões futuras quando não há alteração programada", async () => {
    const patientPlan = {
      id: 41,
      patient_id: 11,
      service_plan_id: 31,
      starts_at: "2026-05-18",
      status: "active",
      Patient: { id: 11, name: "Ana", surname: "Silva" },
      ServicePlan: { id: 31, name: "Funcional 2x", sessions_per_week: 2 },
    };
    axios.get.mockImplementation((url) => {
      if (url === "/patient-plans/41") return Promise.resolve({ data: patientPlan });
      if (url === "/patient-plans/41/admin-summary") {
        return Promise.resolve({
          data: {
            header_summary: { patient_name: "Ana Silva", plan_status_label: "Plano ativo" },
            plan_data_summary: { service_plan_name: "Funcional 2x", sessions_per_week: 2 },
            agenda_summary: {
              status: "no_future_sessions",
              status_message: "Configure uma nova agenda para continuar os atendimentos deste plano.",
              future_sessions_count: 0,
              can_configure_agenda: true,
              primary_action: "configure_new_agenda",
            },
            pending_schedule_change: null,
          },
        });
      }
      if (url === "/schedule/references/professionals") {
        return Promise.resolve({ data: [] });
      }
      if (url === "/services") return Promise.resolve({ data: [] });
      if (url === "/patients") return Promise.resolve({ data: [patientPlan.Patient] });
      if (url === "/unit-scheduling-policy") return Promise.resolve({ data: {} });
      return Promise.resolve({ data: {} });
    });

    renderPlans("/planos/pacientes/41");
    fireEvent.click(await screen.findByRole("tab", { name: "Agenda" }));

    const agendaCard = (await screen.findByRole("heading", { name: "Agenda" }))
      .closest("section");
    expect(within(agendaCard).getByText("Sem sessões futuras")).toBeInTheDocument();
    expect(within(agendaCard).getByText(
      "Configure uma nova agenda para continuar os atendimentos deste plano.",
    )).toBeInTheDocument();
    expect(within(agendaCard).getByRole("button", { name: "Configurar nova agenda" }))
      .toBeInTheDocument();
    expect(within(agendaCard).queryByText(/Nova agenda · a partir de/))
      .not.toBeInTheDocument();
  });

  it("mantém o bloqueio enquanto a Agenda vigente aguarda promoção e libera depois", async () => {
    const patientPlan = {
      id: 41,
      patient_id: 11,
      status: "active",
      Patient: { id: 11, name: "Ana", surname: "Silva" },
      ServicePlan: { id: 31, name: "Funcional 1x", sessions_per_week: 1 },
      agenda_summary: {
        status: "active_recurrence",
        pattern_summary: "Ter às 09:00",
        weekdays: [2],
        time: "09:00",
        professional_user_id: 21,
        future_sessions_count: 4,
      },
    };
    let pending = {
      schedule_change_id: 91,
      status: "pending",
      effective_on: "2000-08-25",
      is_effective: true,
      awaiting_promotion: true,
      current_grid: [{ weekday: 2, time: "09:00", professional_user_id: 21 }],
      effective_grid: [{ weekday: 2, time: "09:00", professional_user_id: 21 }],
      predecessor_grid: [{ weekday: 1, time: "08:00", professional_user_id: 21 }],
      proposed_grid: [{ weekday: 2, time: "09:00", professional_user_id: 21 }],
      professional_changed: false,
      can_cancel: false,
    };
    axios.get.mockImplementation((url) => {
      if (url === "/patient-plans/41") return Promise.resolve({ data: patientPlan });
      if (url === "/patient-plans/41/admin-summary") {
        return Promise.resolve({
          data: {
            plan_data_summary: { service_plan_name: "Funcional 1x", sessions_per_week: 1 },
            agenda_summary: patientPlan.agenda_summary,
            pending_schedule_change: pending,
          },
        });
      }
      return Promise.resolve({ data: {} });
    });

    const awaitingPromotionRender = renderPlans("/planos/pacientes/41");
    expect(await screen.findByText(
      "A nova Agenda já está vigente. Alterações no plano serão liberadas após a atualização automática.",
    )).toBeInTheDocument();
    expect(screen.queryByText(
      "Para alterações no plano, primeiro cancele a troca de agenda.",
    )).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Trocar plano" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Ações do plano" }));
    expect(screen.getByRole("menuitem", { name: "Pausar plano" })).toBeDisabled();
    expect(screen.getByRole("menuitem", { name: "Cancelar plano" })).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Cancelar alteração" })).not.toBeInTheDocument();

    fireEvent.click(await screen.findByRole("tab", { name: "Agenda" }));
    const recurringSchedule = await screen.findByRole("list", {
      name: "Horários da agenda recorrente",
    });
    expect(within(recurringSchedule).getByText("Ter 09h")).toBeInTheDocument();
    expect(within(recurringSchedule).queryByText("Seg 08h")).not.toBeInTheDocument();
    expect(screen.queryByText(/Nova agenda · a partir de/)).not.toBeInTheDocument();
    expect(screen.queryByText(/awaiting|promotion|overdue|lifecycle|pending|revisão/i))
      .not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Editar alteração" })).not.toBeInTheDocument();
    expect(screen.queryByText("Cancelar alteração")).not.toBeInTheDocument();

    awaitingPromotionRender.unmount();
    pending = null;
    renderPlans("/planos/pacientes/41");
    expect(await screen.findByRole("button", { name: "Trocar plano" })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "Ações do plano" }));
    expect(screen.getByRole("menuitem", { name: "Pausar plano" })).toBeEnabled();
    expect(screen.getByRole("menuitem", { name: "Cancelar plano" })).toBeEnabled();
    expect(screen.queryByText(
      "A nova Agenda já está vigente. Alterações no plano serão liberadas após a atualização automática.",
    )).not.toBeInTheDocument();
    expect(screen.queryByText(
      "Para alterações no plano, primeiro cancele a troca de agenda.",
    )).not.toBeInTheDocument();
  });

  it("mantém o painel da alteração futura legada, sem oferecer cancelamento", async () => {
    const patientPlan = {
      id: 41,
      patient_id: 11,
      status: "active",
      Patient: { id: 11, name: "Ana", surname: "Silva" },
      ServicePlan: { id: 31, name: "Funcional 1x", sessions_per_week: 1 },
      agenda_summary: {
        status: "active_recurrence",
        pattern_summary: "Seg às 08:00",
        weekdays: [1],
        time: "08:00",
        professional_user_id: 21,
      },
    };
    const pending = {
      revision_id: 92,
      status: "pending",
      effective_on: "2030-08-25",
      is_effective: false,
      current_grid: [{ weekday: 1, time: "08:00", professional_user_id: 21 }],
      proposed_grid: [{ weekday: 2, time: "09:00", professional_user_id: 21 }],
      professional_changed: false,
      legacy_without_manifest: true,
      can_cancel: false,
    };
    axios.get.mockImplementation((url) => {
      if (url === "/patient-plans/41") return Promise.resolve({ data: patientPlan });
      if (url === "/patient-plans/41/admin-summary") {
        return Promise.resolve({
          data: {
            plan_data_summary: { service_plan_name: "Funcional 1x", sessions_per_week: 1 },
            agenda_summary: patientPlan.agenda_summary,
            pending_schedule_change: pending,
          },
        });
      }
      return Promise.resolve({ data: {} });
    });

    renderPlans("/planos/pacientes/41");
    fireEvent.click(await screen.findByRole("tab", { name: "Agenda" }));
    expect(await screen.findByText(/Nova agenda · a partir de/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Editar alteração" })).not.toBeInTheDocument();
    expect(screen.queryByText("Cancelar alteração")).not.toBeInTheDocument();
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
    fireEvent.change(await within(dialog).findByLabelText("Horário de segunda"), {
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
      "Não foi possível alterar a agenda agora. Atualize a página e tente novamente.",
    );
    expect(within(dialog).queryByRole("button", { name: "Confirmar alteração" }))
      .not.toBeInTheDocument();
  });

  it("não remonta a antiga sidebar interna nem cria um segundo main", () => {
    const source = fs.readFileSync(path.join(__dirname, "index.js"), "utf8");

    expect(source).not.toMatch(/SidebarShellWrapper|AppSidebar|<main/);
  });
});
