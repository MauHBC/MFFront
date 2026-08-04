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
    expect(await screen.findByRole("heading", { name: "Administração do plano mensal" }))
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

  it("não remonta a antiga sidebar interna nem cria um segundo main", () => {
    const source = fs.readFileSync(path.join(__dirname, "index.js"), "utf8");

    expect(source).not.toMatch(/SidebarShellWrapper|AppSidebar|<main/);
  });
});
