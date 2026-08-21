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
        activeTab="plan"
        onBack={noop}
        onTabChange={onTabChange}
      />,
    );
    const tabs = screen.getAllByRole("tab");
    expect(screen.queryByText("Funcional 2x · Ativo")).not.toBeInTheDocument();
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
    const agendaCurrent = screen.getByText("Agenda Atual: Seg 11h · Qua 11h · Sex 11h");
    const agendaLines = agendaCurrent.parentElement;
    expect(agendaLines).toHaveTextContent("Agenda Atual: Seg 11h · Qua 11h · Sex 11h");
    expect(agendaLines).toHaveTextContent("Agenda Nova: Ter 08h · Qui 08h");
    expect(agendaLines).toHaveStyle({ paddingLeft: "8px" });
    expect(screen.getByText(/Agenda Atual: Seg 11h · Qua 11h · Sex 11h/)).toBeInTheDocument();
    expect(screen.getByText(/Agenda Nova: Ter 08h · Qui 08h/)).toBeInTheDocument();
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
        title="Agenda"
        statusLabel={statusLabel}
        pattern={pattern}
        supportingText={pattern ? "Profissional: Leonardo" : ""}
        empty={pattern ? "" : "Sem agenda recorrente"}
        primaryAction={actionLabel ? { label: actionLabel, onClick: noop } : null}
        menuActions={[]}
      />,
    );
    expect(screen.getByText(statusLabel)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Agenda" })).toBeInTheDocument();
    if (actionLabel) {
      expect(screen.getByRole("button", { name: new RegExp(actionLabel, "i") }))
        .toBeInTheDocument();
    } else {
      expect(screen.queryByRole("button")).not.toBeInTheDocument();
    }
    if (pattern) {
      const scheduleList = screen.getByRole("list", {
        name: "Horários da agenda recorrente",
      });
      expect(scheduleList).toHaveStyle({
        color: "#556159",
        fontSize: "0.9rem",
        fontWeight: "400",
        gap: "4px",
        paddingLeft: "16px",
      });
      expect(within(scheduleList).getAllByRole("listitem")).toHaveLength(2);
      expect(within(scheduleList).getByText("Ter 08h")).toBeInTheDocument();
      expect(within(scheduleList).getByText("Qui 08h")).toBeInTheDocument();
      expect(screen.queryByText(pattern)).not.toBeInTheDocument();
      const support = screen.getByLabelText("Informações da agenda");
      expect(support).toHaveStyle({
        color: "#78827b",
        fontSize: "0.81rem",
        fontWeight: "400",
        marginTop: "12px",
      });
      expect(within(support).getByText("Toda semana")).toBeInTheDocument();
      expect(within(support).getByText("Profissional: Leonardo")).toBeInTheDocument();
      expect(within(support).queryByText(/Próxima sessão:/)).not.toBeInTheDocument();
    }
    unmount();
  });

  it("mostra a alteração futura da Agenda em listas e com cancelamento direto", () => {
    const onCancel = jest.fn();
    render(
      <ScheduledChangePanel
        eyebrow="Nova agenda · a partir de 25 ago"
        agendaComparison={{
          current: "Ter 08h · Qui 08h",
          proposed: "Ter 18h · Qui 19h",
        }}
        verticalAgendaComparison
        cancelAction={{ label: "Cancelar alteração", onClick: onCancel }}
      />,
    );

    const currentAgenda = screen.getByRole("group", { name: "Agenda atual" });
    const newAgenda = screen.getByRole("group", { name: "Agenda nova" });
    expect(screen.getByText("Atual")).toBeInTheDocument();
    expect(screen.getByText("Nova")).toBeInTheDocument();
    expect(within(currentAgenda).getAllByRole("listitem")).toHaveLength(2);
    expect(within(currentAgenda).getByText("Ter 08h")).toBeInTheDocument();
    expect(within(currentAgenda).getByText("Qui 08h")).toBeInTheDocument();
    expect(within(newAgenda).getAllByRole("listitem")).toHaveLength(2);
    expect(within(newAgenda).getByText("Ter 18h")).toBeInTheDocument();
    expect(within(newAgenda).getByText("Qui 19h")).toBeInTheDocument();
    expect(screen.queryByText(/Alteração de agenda/i)).not.toBeInTheDocument();
    expect(screen.queryByText("Alteração programada")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Ações de Alteração de agenda/i }))
      .not.toBeInTheDocument();
    const cancelButton = screen.getByRole("button", { name: "Cancelar alteração" });
    expect(cancelButton).toBeVisible();
    fireEvent.click(cancelButton);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("oculta o cancelamento direto quando a Agenda futura não é cancelável", () => {
    render(
      <ScheduledChangePanel
        eyebrow="Nova agenda · a partir de 25 ago"
        agendaComparison={{
          current: "Ter 08h · Qui 08h",
          proposed: "Ter 18h · Qui 19h",
        }}
        verticalAgendaComparison
        cancelAction={null}
      />,
    );

    expect(screen.getByRole("group", { name: "Agenda atual" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Agenda nova" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cancelar alteração" }))
      .not.toBeInTheDocument();
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
        issues={[
          { key: "session-9", title: "Sessão de 26 ago", detail: "possui avaliação vinculada" },
          {
            key: "patient-schedule-conflicts",
            title: "Conflitos de horário",
            details: [
              "Terça às 18h · Pilates 2x/semana",
              "Quinta às 11h · Fisioterapia 2x/semana",
            ],
          },
        ]}
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
    expect(within(dialog).getByText("Conflitos de horário")).toBeInTheDocument();
    expect(within(dialog).getByText("Terça às 18h · Pilates 2x/semana"))
      .toBeInTheDocument();
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
