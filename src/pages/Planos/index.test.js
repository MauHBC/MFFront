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
    expect(source).toMatch(/expected_effective_on:\s*planChangePreview\.data\.effective_on/);
    expect(source).toMatch(/preview_token:\s*planChangePreview\.data\.preview_token/);
    expect(source).toMatch(/expected_version:\s*Number\(planChangeForm\.expected_version\)/);
    expect(source).toMatch(/future-sessions-removal-preview/);
    expect(source).toMatch(/change-plan\/cancel/);
  });

  it("não remonta a antiga sidebar interna nem cria um segundo main", () => {
    const source = fs.readFileSync(path.join(__dirname, "index.js"), "utf8");

    expect(source).not.toMatch(/SidebarShellWrapper|AppSidebar|<main/);
  });
});
