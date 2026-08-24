import React from "react";
import "@testing-library/jest-dom";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { createMemoryHistory } from "history";
import { Router } from "react-router-dom";

import PatientPlansOverview from "./PatientPlansOverview";

const overview = {
  summary: {
    active_plans: 38,
    paused_plans: 4,
    pending_agendas: 3,
    scope: "current_patient_service_filters",
  },
  groups: [
    {
      patient: { id: 1, name: "Flávia de Souza da Ros", nickname: "Flávia" },
      plans: [
        {
          patient_plan_id: 101,
          commercial_name: "Pilates 2x na semana",
          service_id: 1,
          sessions_per_week: 2,
          frequency_label: "2x por semana",
          agenda_state: "configured",
          status: "active",
        },
        {
          patient_plan_id: 102,
          commercial_name: "Funcional recorrente",
          service_id: 2,
          sessions_per_week: 2,
          frequency_label: "2x por semana",
          agenda_state: "pending",
          status: "paused",
        },
      ],
    },
  ],
  page_info: {
    page: 1,
    page_size: 25,
    total_groups: 42,
    total_plans: 43,
    total_pages: 2,
  },
};

const defaultProps = {
  overview,
  loading: false,
  error: "",
  view: "current",
  onViewChange: jest.fn(),
  patientSearch: "",
  onPatientSearchChange: jest.fn(),
  serviceId: "",
  onServiceChange: jest.fn(),
  status: "",
  onStatusChange: jest.fn(),
  agenda: "",
  onAgendaChange: jest.fn(),
  services: [
    { id: 1, name: "Pilates" },
    { id: 2, name: "Funcional" },
  ],
  onPageChange: jest.fn(),
  canLinkPlan: true,
  onLinkPlan: jest.fn(),
};

const renderOverview = (props = {}) => {
  const history = createMemoryHistory({ initialEntries: ["/planos"] });
  render(
    <Router history={history}>
      <PatientPlansOverview {...defaultProps} {...props} />
    </Router>,
  );
  return history;
};

beforeEach(() => {
  Object.values(defaultProps).forEach((value) => {
    if (typeof value === "function") value.mockClear();
  });
});

it("renderiza resumo compacto, visões e paciente uma única vez", () => {
  renderOverview();
  const summary = screen.getByLabelText("Resumo operacional de Planos");
  expect(summary).toHaveTextContent("38 ativos");
  expect(summary).toHaveTextContent("4 pausados");
  expect(summary).toHaveTextContent("3 agendas pendentes");
  expect(screen.getByRole("tab", { name: "Atuais" })).toHaveAttribute("aria-selected", "true");
  expect(screen.getByRole("tab", { name: "Encerrados" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Vincular plano" })).toBeInTheDocument();
  expect(screen.getAllByRole("heading", { name: "Flávia de Souza da Ros" })).toHaveLength(1);
  expect(screen.getAllByRole("link")).toHaveLength(2);
});

it("usa a linha inteira como link e aceita Space", () => {
  const history = renderOverview();
  const funcional = screen.getByRole("link", {
    name: /Funcional recorrente de Flávia.*Agenda Pendente.*Status Pausado/i,
  });
  expect(funcional).toHaveAttribute("href", "/planos/pacientes/102");
  funcional.focus();
  expect(funcional).toHaveFocus();
  fireEvent.keyDown(funcional, { key: " " });
  expect(history.location.pathname).toBe("/planos/pacientes/102");
  expect(screen.queryByRole("button", { name: /Detalhes|Gerenciar/i })).not.toBeInTheDocument();
});

it("não duplica frequência no nome e preserva subtítulo quando necessário", () => {
  renderOverview();
  const pilates = screen.getByText("Pilates 2x na semana").closest("a");
  expect(within(pilates).queryByText("2x por semana")).not.toBeInTheDocument();
  const funcional = screen.getByText("Funcional recorrente").closest("a");
  expect(within(funcional).getByText("2x por semana")).toBeInTheDocument();
});

it("expõe filtros acessíveis e encaminha as alterações", () => {
  renderOverview();
  fireEvent.change(screen.getByLabelText("Paciente"), { target: { value: "Flávia" } });
  fireEvent.change(screen.getByLabelText("Serviço"), { target: { value: "2" } });
  fireEvent.change(screen.getByLabelText("Status"), { target: { value: "paused" } });
  fireEvent.change(screen.getByLabelText("Agenda"), { target: { value: "pending" } });
  fireEvent.click(screen.getByRole("tab", { name: "Encerrados" }));

  expect(defaultProps.onPatientSearchChange).toHaveBeenCalledWith("Flávia");
  expect(defaultProps.onServiceChange).toHaveBeenCalledWith("2");
  expect(defaultProps.onStatusChange).toHaveBeenCalledWith("paused");
  expect(defaultProps.onAgendaChange).toHaveBeenCalledWith("pending");
  expect(defaultProps.onViewChange).toHaveBeenCalledWith("closed");
});

it("pagina por pacientes com informação coerente", () => {
  renderOverview();
  expect(screen.getByText("1–25 de 42 pacientes")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Próxima" }));
  expect(defaultProps.onPageChange).toHaveBeenCalledWith(2);
});

it.each([
  ["current", "", "Nenhum plano atual encontrado."],
  ["current", "Flávia", "Nenhum plano encontrado com estes filtros."],
  ["closed", "", "Nenhum plano encerrado."],
])("renderiza vazio contextual para %s", (view, patientSearch, expected) => {
  renderOverview({
    overview: {
      ...overview,
      groups: [],
      page_info: { ...overview.page_info, total_groups: 0, total_plans: 0, total_pages: 0 },
    },
    view,
    patientSearch,
  });
  expect(screen.getByText(expected)).toBeInTheDocument();
});

it("renderiza estados de loading e erro pelo padrão do módulo", () => {
  const history = createMemoryHistory();
  const { rerender } = render(
    <Router history={history}>
      <PatientPlansOverview {...defaultProps} loading />
    </Router>,
  );
  expect(screen.getByRole("status")).toHaveTextContent("Carregando Planos...");
  rerender(
    <Router history={history}>
      <PatientPlansOverview {...defaultProps} loading={false} error="Falha segura" />
    </Router>,
  );
  expect(screen.getByRole("status")).toHaveTextContent("Falha segura");
});
