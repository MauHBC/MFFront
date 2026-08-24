import React from "react";
import "@testing-library/jest-dom";
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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
  items: [
    {
      patient: { id: 1, name: "Alda Borges", nickname: "Alda" },
      patient_plan_id: 100,
      commercial_name: "Pilates 2x na semana",
      service_id: 1,
      sessions_per_week: 2,
      frequency_label: "2x por semana",
      agenda_state: "configured",
      status: "active",
    },
    {
      patient: { id: 2, name: "Carla FerreiraA", nickname: "Carla" },
      patient_plan_id: 101,
      commercial_name: "Pilates 2x na semana",
      service_id: 1,
      sessions_per_week: 2,
      frequency_label: "2x por semana",
      agenda_state: "configured",
      status: "active",
    },
    {
      patient: { id: 2, name: "Carla FerreiraA", nickname: "Carla" },
      patient_plan_id: 102,
      commercial_name: "Funcional recorrente",
      service_id: 2,
      sessions_per_week: 2,
      frequency_label: "2x por semana",
      agenda_state: "pending",
      status: "paused",
    },
  ],
  page_info: {
    page: 1,
    page_size: 10,
    total: 43,
    total_pages: 5,
  },
};

const defaultProps = {
  overview,
  loading: false,
  error: "",
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

it("renderiza os três cards com os valores do summary e uma linha por PatientPlan", () => {
  renderOverview();
  const summary = screen.getByLabelText("Resumo operacional de Planos");
  const activeCard = within(summary).getByRole("button", { name: /Planos ativos: 38/i });
  const pausedCard = within(summary).getByRole("button", { name: /Planos pausados: 4/i });
  const pendingCard = within(summary).getByRole("button", { name: /Agenda pendente: 3/i });
  expect(within(activeCard).getByText("Ativos")).toBeInTheDocument();
  expect(within(activeCard).getByText("38")).toBeInTheDocument();
  expect(within(pausedCard).getByText("Pausados")).toBeInTheDocument();
  expect(within(pausedCard).getByText("4")).toBeInTheDocument();
  expect(within(pendingCard).getByText("Agendas pendentes")).toBeInTheDocument();
  expect(within(pendingCard).getByText("3")).toBeInTheDocument();
  expect(within(summary).getAllByRole("button")).toHaveLength(3);
  expect(screen.queryByRole("tablist", { name: "Visão dos Planos" })).not.toBeInTheDocument();
  expect(screen.queryByText("Atuais")).not.toBeInTheDocument();
  expect(screen.queryByText("Encerrados")).not.toBeInTheDocument();
  expect(screen.getByLabelText("Status")).toHaveValue("");
  expect(screen.getByRole("option", { name: "Ativos e pausados" })).toBeInTheDocument();
  expect(screen.queryByRole("option", { name: /Todos os status/i })).not.toBeInTheDocument();
  expect(screen.getAllByText("Alda Borges")).toHaveLength(1);
  expect(screen.getAllByText("Carla FerreiraA")).toHaveLength(2);
  expect(screen.getAllByRole("link")).toHaveLength(3);
  expect(screen.getAllByRole("link", { name: /Agenda Configurada/i })).toHaveLength(2);
  expect(screen.getByRole("link", { name: /Agenda Pendente/i })).toBeInTheDocument();
  expect(screen.queryByText(/Agenda Configurada/i)).not.toBeInTheDocument();
  expect(screen.getByRole("link", { name: /Alda Borges.*Pilates/i }))
    .toHaveAttribute("href", "/planos/pacientes/100");
  expect(screen.getByRole("link", { name: /Carla FerreiraA.*Pilates/i }))
    .toHaveAttribute("href", "/planos/pacientes/101");
  expect(screen.getByRole("link", { name: /Carla FerreiraA.*Funcional/i }))
    .toHaveAttribute("href", "/planos/pacientes/102");
});

it.each([
  ["Filtrar Planos ativos: 38", "onStatusChange", "active"],
  ["Filtrar Planos pausados: 4", "onStatusChange", "paused"],
  ["Filtrar Planos com Agenda pendente: 3", "onAgendaChange", "pending"],
])("usa o card %s como atalho e volta à página 1", (accessibleName, handlerName, value) => {
  renderOverview({
    patientSearch: "Alda",
    serviceId: "2",
    status: "paused",
    agenda: "configured",
  });

  fireEvent.click(screen.getByRole("button", { name: accessibleName }));

  expect(defaultProps[handlerName]).toHaveBeenCalledWith(value);
  expect(defaultProps.onPageChange).toHaveBeenCalledWith(1);
  expect(defaultProps.onPatientSearchChange).not.toHaveBeenCalled();
  expect(defaultProps.onServiceChange).not.toHaveBeenCalled();
  expect(screen.getByLabelText("Paciente")).toHaveValue("Alda");
  expect(screen.getByLabelText("Serviço")).toHaveValue("2");
});

it("mantém o card de Agendas pendentes visível quando o valor é zero", () => {
  renderOverview({
    overview: {
      ...overview,
      summary: { ...overview.summary, pending_agendas: 0 },
    },
  });

  const pendingCard = screen.getByRole("button", { name: /Agenda pendente: 0/i });
  expect(within(pendingCard).getByText("Agendas pendentes")).toBeInTheDocument();
  expect(within(pendingCard).getByText("0")).toBeInTheDocument();
});

it("permite acionar os atalhos por teclado com foco no card", () => {
  renderOverview();
  const activeCard = screen.getByRole("button", { name: /Planos ativos: 38/i });
  const pendingCard = screen.getByRole("button", { name: /Agenda pendente: 3/i });

  activeCard.focus();
  expect(activeCard).toHaveFocus();
  userEvent.type(activeCard, "{enter}", { skipClick: true });
  expect(defaultProps.onStatusChange).toHaveBeenCalledWith("active");

  pendingCard.focus();
  expect(pendingCard).toHaveFocus();
  userEvent.type(pendingCard, " ", { skipClick: true });
  expect(defaultProps.onAgendaChange).toHaveBeenCalledWith("pending");
});

it("usa a linha inteira como link e aceita Space", () => {
  const history = renderOverview();
  const funcional = screen.getByRole("link", {
    name: /Carla FerreiraA.*Funcional recorrente.*Agenda Pendente.*Status Pausado/i,
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
  const pilatesRows = screen.getAllByText("Pilates 2x na semana")
    .map((element) => element.closest("a"));
  pilatesRows.forEach((row) => {
    expect(within(row).queryByText("2x por semana")).not.toBeInTheDocument();
  });
  const funcional = screen.getByText("Funcional recorrente").closest("a");
  expect(within(funcional).getByText("2x por semana")).toBeInTheDocument();
});

it("expõe filtros acessíveis e todas as opções operacionais de Status", () => {
  renderOverview();
  expect(screen.getByRole("option", { name: "Todos" })).toBeInTheDocument();
  expect(screen.getByRole("option", { name: "Todas" })).toBeInTheDocument();
  expect(screen.queryByRole("option", { name: "Todos os serviços" })).not.toBeInTheDocument();
  expect(screen.queryByRole("option", { name: "Todas as situações" })).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Paciente"), { target: { value: "Flávia" } });
  fireEvent.change(screen.getByLabelText("Serviço"), { target: { value: "2" } });
  fireEvent.change(screen.getByLabelText("Status"), { target: { value: "paused" } });
  fireEvent.change(screen.getByLabelText("Agenda"), { target: { value: "pending" } });

  expect(defaultProps.onPatientSearchChange).toHaveBeenCalledWith("Flávia");
  expect(defaultProps.onServiceChange).toHaveBeenCalledWith("2");
  expect(defaultProps.onStatusChange).toHaveBeenCalledWith("paused");
  expect(defaultProps.onAgendaChange).toHaveBeenCalledWith("pending");
  expect(screen.getByRole("option", { name: "Ativos" })).toBeInTheDocument();
  expect(screen.getByRole("option", { name: "Pausados" })).toBeInTheDocument();
  expect(screen.getByRole("option", { name: "Cancelados" })).toBeInTheDocument();
});

it("mostra um cabeçalho único e não cria agrupamento por paciente", () => {
  renderOverview();
  const header = screen.getByLabelText("Colunas da lista de Planos");
  expect(within(header).getByText("Paciente")).toBeInTheDocument();
  expect(within(header).getByText("Plano")).toBeInTheDocument();
  expect(within(header).getByText("Agenda")).toBeInTheDocument();
  expect(within(header).getByText("Status")).toBeInTheDocument();
  expect(screen.getAllByLabelText("Colunas da lista de Planos")).toHaveLength(1);
  expect(screen.queryByText(/^Plano comercial$/i)).not.toBeInTheDocument();
  expect(screen.queryByRole("heading", { name: "Carla FerreiraA" })).not.toBeInTheDocument();
  expect(screen.getAllByText("Carla FerreiraA")).toHaveLength(2);
});

it("pagina PatientPlans com o padrão textual de Pacientes", () => {
  renderOverview();
  expect(screen.getByText("Mostrando 1-10 de 43")).toBeInTheDocument();
  expect(screen.getByText("Página 1 de 5")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Próxima" }));
  expect(defaultProps.onPageChange).toHaveBeenCalledWith(2);
});

it.each([
  ["", "", "Nenhum plano atual encontrado."],
  ["", "Flávia", "Nenhum plano encontrado com estes filtros."],
  ["canceled", "", "Nenhum plano encerrado."],
])("renderiza vazio contextual para status %s", (status, patientSearch, expected) => {
  renderOverview({
    overview: {
      ...overview,
      items: [],
      page_info: { ...overview.page_info, total: 0, total_pages: 0 },
    },
    status,
    patientSearch,
  });
  expect(screen.getByText(expected)).toBeInTheDocument();
});

it("mantém estrutura responsiva sem tabela rígida e com rótulos internos", () => {
  renderOverview();
  expect(document.querySelector("table")).not.toBeInTheDocument();
  const summary = screen.getByLabelText("Resumo operacional de Planos");
  expect(summary).toHaveStyle("display: grid");
  expect(summary).toHaveStyle("width: 100%");
  expect(within(summary).getAllByRole("button")).toHaveLength(3);
  const funcional = screen.getByText("Funcional recorrente").closest("a");
  expect(within(funcional).getAllByText("Agenda").length).toBeGreaterThan(0);
  expect(within(funcional).getByText("Status")).toBeInTheDocument();
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
