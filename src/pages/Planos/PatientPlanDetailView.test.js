import React from "react";
import "@testing-library/jest-dom";
import { fireEvent, render, screen, within } from "@testing-library/react";
import {
  AgendaSummaryCard,
  PatientPlanDetailHeader,
  PlanSummaryCard,
  ScheduleChangeDrawer,
  ScheduledChangePanel,
} from "./PatientPlanDetailView";

const noop = () => {};

describe("PatientPlanDetailView", () => {
  it("expõe tabs semânticas com navegação por teclado", () => {
    const onTabChange = jest.fn();
    render(
      <PatientPlanDetailHeader
        patientName="Ana Silva"
        planSummary="Funcional 2x · Ativo"
        activeTab="plan"
        onBack={noop}
        onTabChange={onTabChange}
      />,
    );
    const tabs = screen.getAllByRole("tab");
    expect(tabs[0]).toHaveAttribute("aria-selected", "true");
    expect(tabs[0]).toHaveAttribute("aria-controls", "patient-plan-panel-plan");
    fireEvent.keyDown(tabs[0], { key: "ArrowRight" });
    expect(onTabChange).toHaveBeenCalledWith("agenda");
    fireEvent.keyDown(tabs[0], { key: "End" });
    expect(onTabChange).toHaveBeenCalledWith("history");
  });

  it("representa estados do plano e mantém ações raras no menu", () => {
    render(
      <PlanSummaryCard
        title="Funcional 2x por semana"
        statusLabel="Pausado"
        statusTone="paused"
        billingSummary="R$ 480/mês · vence dia 18"
        startSummary="Plano iniciado em 18 mai 2026"
        stateNote="Pausa por tempo indeterminado"
        primaryAction={{ label: "Gerenciar pausa", onClick: noop }}
        secondaryAction={{ label: "Editar dados", onClick: noop }}
        menuActions={[{ label: "Cancelar plano", onClick: noop, critical: true }]}
      >
        <ScheduledChangePanel
          eyebrow="Cancelamento agendado"
          metadata="Solicitado em 23 jul · Leonardo"
          title="Último dia ativo: 25 ago"
          menuActions={[{ label: "Desprogramar cancelamento", onClick: noop }]}
        />
      </PlanSummaryCard>,
    );
    expect(screen.getByText("Pausado")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Gerenciar pausa" })).toBeInTheDocument();
    expect(screen.getByText("Cancelamento agendado")).toBeInTheDocument();
    expect(screen.getByText("Solicitado em 23 jul · Leonardo")).toBeInTheDocument();
    expect(screen.getByText("Último dia ativo: 25 ago")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Ações do plano" }));
    expect(screen.getByRole("menuitem", { name: "Cancelar plano" })).toBeInTheDocument();
  });

  it("resume o plano ativo e a troca futura sem tabela de chave/valor", () => {
    render(
      <PlanSummaryCard
        title="Funcional 2x por semana"
        statusLabel="Ativo"
        billingSummary="R$ 480/mês · vence dia 18"
        startSummary="Plano iniciado em 18 mai 2026"
        primaryAction={{ label: "Trocar plano", onClick: noop }}
        secondaryAction={{ label: "Editar dados", onClick: noop }}
        menuActions={[]}
      >
        <ScheduledChangePanel
          eyebrow="Troca agendada · a partir de 25 ago"
          metadata="Solicitada em 23 jul · Leonardo"
          title="Funcional 2x → Funcional 3x"
          agendaComparison={{
            current: "Seg 11h · Qua 11h · Sex 11h",
            proposed: "Ter 08h · Qui 08h",
          }}
          onEdit={noop}
          menuActions={[{ label: "Cancelar troca", onClick: noop }]}
        />
      </PlanSummaryCard>,
    );
    expect(screen.getByText("Ativo")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Trocar plano" })).toBeInTheDocument();
    expect(screen.getByText("Plano iniciado em 18 mai 2026")).toBeInTheDocument();
    expect(screen.getByText("Troca agendada · a partir de 25 ago")).toBeInTheDocument();
    const agendaLabel = screen.getByText("Agenda");
    const agendaLines = agendaLabel.nextElementSibling;
    expect(agendaLines).toHaveTextContent("Atual: Seg 11h · Qua 11h · Sex 11h");
    expect(agendaLines).toHaveTextContent("Nova: Ter 08h · Qui 08h");
    expect(agendaLines).toHaveStyle({ paddingLeft: "8px" });
    expect(screen.getByText(/Atual: Seg 11h · Qua 11h · Sex 11h/)).toBeInTheDocument();
    expect(screen.getByText(/Nova: Ter 08h · Qui 08h/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Editar" })).toBeInTheDocument();
  });

  it("mantém plano cancelado somente para leitura", () => {
    render(
      <PlanSummaryCard
        title="Funcional 2x"
        statusLabel="Cancelado"
        statusTone="canceled"
        menuActions={[]}
      />,
    );
    expect(screen.getByText("Cancelado")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it.each([
    ["Ativa", "Ter 08h · Qui 08h", "Alterar agenda"],
    ["Sem agenda", "", "Configurar agenda"],
    ["Sem sessões futuras", "", "Configurar nova agenda"],
    ["Pausada", "", null],
    ["Cancelada", "", null],
  ])("renderiza estado da Agenda %s", (statusLabel, pattern, actionLabel) => {
    const { unmount } = render(
      <AgendaSummaryCard
        title="Agenda recorrente"
        statusLabel={statusLabel}
        pattern={pattern}
        supportingText={pattern ? "Leonardo · próxima sessão 20 ago às 08h" : ""}
        empty={pattern ? "" : "Sem agenda recorrente"}
        primaryAction={actionLabel ? { label: actionLabel, onClick: noop } : null}
        menuActions={[]}
      />,
    );
    expect(screen.getByText(statusLabel)).toBeInTheDocument();
    if (actionLabel) {
      expect(screen.getByRole("button", { name: new RegExp(actionLabel, "i") }))
        .toBeInTheDocument();
    } else {
      expect(screen.queryByRole("button")).not.toBeInTheDocument();
    }
    if (pattern) expect(screen.getByText(pattern)).toBeInTheDocument();
    unmount();
  });

  it("mantém o dialog rotulado, campos associados e sem confirmação quando há bloqueio", () => {
    render(
      <ScheduleChangeDrawer
        open
        busy={false}
        form={{
          effective_on: "2026-08-25",
          minimum_effective_on: "2026-08-19",
          professional_user_id: "36",
          weekdays: [2],
          times_by_weekday: { 2: "09:00" },
        }}
        frequency={1}
        professionals={[{ id: 36, name: "Mariana" }]}
        professionalsLoading={false}
        weekdayOptions={[{ value: 2, label: "Ter" }]}
        timeOptions={[{ value: "09:00", label: "09h" }]}
        allowBrokenTime={false}
        preview={{ status: "success", data: { effective_on: "2026-08-25", can_confirm: false } }}
        previewPattern="Ter 09h"
        currentPattern="Seg 08h"
        issues={[{ key: "session-9", title: "Sessão de 26 ago", detail: "possui avaliação vinculada" }]}
        errorMessage="Resolva o impedimento antes de confirmar."
        onClose={noop}
        onFieldChange={noop}
        onWeekdayToggle={noop}
        onTimeChange={noop}
        onPreview={noop}
        onConfirm={noop}
      />,
    );
    const dialog = screen.getByRole("dialog", { name: "Alterar agenda" });
    expect(within(dialog).getByLabelText("Nova agenda a partir de")).toHaveAttribute("min", "2026-08-19");
    expect(within(dialog).getByLabelText("Profissional")).toHaveValue("36");
    expect(within(dialog).getByText("Sessão de 26 ago")).toBeInTheDocument();
    expect(within(dialog).queryByRole("button", { name: "Confirmar alteração" }))
      .not.toBeInTheDocument();
  });

  it("usa uma linha por dia selecionado no mesmo padrão de Configurar agenda", () => {
    render(
      <ScheduleChangeDrawer
        open
        busy={false}
        form={{
          effective_on: "2026-08-25",
          minimum_effective_on: "2026-08-19",
          professional_user_id: "36",
          weekdays: [2, 3],
          times_by_weekday: { 2: "08:00", 3: "08:00" },
        }}
        frequency={2}
        professionals={[{ id: 36, name: "Mariana" }]}
        professionalsLoading={false}
        weekdayOptions={[
          { value: 1, label: "Seg", fullLabel: "segunda" },
          { value: 2, label: "Ter", fullLabel: "terça" },
          { value: 3, label: "Qua", fullLabel: "quarta" },
          { value: 4, label: "Qui", fullLabel: "quinta" },
          { value: 5, label: "Sex", fullLabel: "sexta" },
        ]}
        timeOptions={[{ value: "08:00", label: "08h" }]}
        allowBrokenTime={false}
        preview={{ status: "idle", data: null }}
        previewPattern=""
        currentPattern="Ter 08h · Qua 08h"
        issues={[]}
        errorMessage=""
        onClose={noop}
        onFieldChange={noop}
        onWeekdayToggle={noop}
        onTimeChange={noop}
        onPreview={noop}
        onConfirm={noop}
      />,
    );

    const dialog = screen.getByRole("dialog", { name: "Alterar agenda" });
    expect(within(dialog).getByText("Horários por dia")).toBeInTheDocument();
    const weekdayButtons = ["Seg", "Ter", "Qua", "Qui", "Sex"]
      .map((name) => within(dialog).getByRole("button", { name }));
    expect(new Set(weekdayButtons.map((button) => button.parentElement))).toHaveProperty("size", 1);

    const tuesdaySelect = within(dialog).getByRole("combobox", { name: "Horário de terça" });
    const wednesdaySelect = within(dialog).getByRole("combobox", { name: "Horário de quarta" });
    const tuesdayRow = within(dialog).getByText("terça").closest("label");
    const wednesdayRow = within(dialog).getByText("quarta").closest("label");
    expect(tuesdayRow).not.toBe(wednesdayRow);
    expect(tuesdayRow).toContainElement(tuesdaySelect);
    expect(wednesdayRow).toContainElement(wednesdaySelect);
    expect(within(dialog).queryByText("Horário de Ter")).not.toBeInTheDocument();
    expect(within(dialog).queryByText("Horário de Qua")).not.toBeInTheDocument();
  });
});
