import {
  buildPausePresentation,
  buildPendingCommercialChangePresentation,
  buildPendingScheduleChangePresentation,
  buildPlanHistoryPresentation,
  buildProfessionalChangeText,
  buildScheduleRows,
  createScheduleChangeIdempotencyKey,
  findPlanHistoryEvent,
  formatAgendaPattern,
  formatCompactDate,
  formatPlanHistoryEventLabel,
  formatScheduleGrid,
  getVisiblePlanHistoryChanges,
  getScheduleChangeIssues,
  scheduleChangeErrorPresentation,
} from "./patientPlanDetailPresentation";

describe("patient plan detail presentation", () => {
  const pendingScheduleChange = {
    revision_id: 72,
    status: "scheduled",
    effective_on: "2030-08-25",
    current_grid: [
      { weekday: 1, time: "08:00", professional_user_id: 21, professional_name: "Leonardo" },
      { weekday: 3, time: "08:00", professional_user_id: 21, professional_name: "Leonardo" },
    ],
    proposed_grid: [
      { weekday: 2, time: "09:00", professional_user_id: 36, professional_name: "Mariana" },
      { weekday: 3, time: "10:00", professional_user_id: 36, professional_name: "Mariana" },
    ],
    current_professional: { id: 21, name: "Leonardo" },
    future_professional: { id: 36, name: "Mariana" },
    professional_name: "Mariana",
    professional_changed: true,
  };

  it("preserva o pattern_summary autoritativo e formata grades operacionais", () => {
    expect(formatAgendaPattern({
      pattern_summary: "Ter às 08:00 · Qui às 10:30",
      weekdays: [1],
      time: "07:00",
    })).toBe("Ter 08h · Qui 10:30");
    expect(formatScheduleGrid([
      { weekday: 4, time: "10:30:00" },
      { weekday: 2, time: "09:00:00" },
    ])).toBe("Ter 09h · Qui 10:30");
    expect(formatCompactDate("2026-08-25")).toContain("25");
  });

  it("constrói somente a grade informada pelo formulário", () => {
    expect(buildScheduleRows({
      weekdays: [4, 2],
      timesByWeekday: { 2: "09:00", 4: "10:00" },
      professionalUserId: "36",
    })).toEqual([
      { weekday: 2, time: "09:00", professional_user_id: 36 },
      { weekday: 4, time: "10:00", professional_user_id: 36 },
    ]);
  });

  it("não cria apresentação sem projeção autoritativa", () => {
    expect(buildPendingScheduleChangePresentation(null)).toBeNull();
    expect(buildPendingScheduleChangePresentation({
      effective_on: "2030-08-25",
      current_grid: [],
      proposed_grid: [],
    })).toBeNull();
    expect(buildPendingScheduleChangePresentation({
      effective_on: "2030-08-25",
      is_effective: true,
      current_grid: pendingScheduleChange.current_grid,
      proposed_grid: pendingScheduleChange.proposed_grid,
    })).toBeNull();
  });

  it("apresenta grade atual → futura e a mudança autoritativa de profissional", () => {
    expect(buildPendingScheduleChangePresentation(pendingScheduleChange)).toEqual({
      effectiveOn: "2030-08-25",
      currentPattern: "Seg 08h · Qua 08h",
      proposedPattern: "Ter 09h · Qua 10h",
      title: "Seg 08h · Qua 08h → Ter 09h · Qua 10h",
      professionalChange: "Profissional: Leonardo → Mariana",
    });
  });

  it("não anuncia troca de profissional quando professional_changed é falso", () => {
    const presentation = buildPendingScheduleChangePresentation({
      ...pendingScheduleChange,
      proposed_grid: pendingScheduleChange.proposed_grid.map((row) => ({
        ...row,
        professional_user_id: 21,
        professional_name: "Leonardo",
      })),
      future_professional: { id: 21, name: "Leonardo" },
      professional_name: "Leonardo",
      professional_changed: false,
    });
    expect(presentation.title).toBe("Seg 08h · Qua 08h → Ter 09h · Qua 10h");
    expect(presentation.professionalChange).toBe("");
  });

  it("não inventa nomes quando a projeção confirma troca de profissional sem resolvê-los", () => {
    const presentation = buildPendingScheduleChangePresentation({
      ...pendingScheduleChange,
      current_professional: null,
      future_professional: null,
      professional_name: null,
      current_grid: pendingScheduleChange.current_grid.map((row) => ({
        weekday: row.weekday,
        time: row.time,
        professional_user_id: row.professional_user_id,
      })),
      proposed_grid: pendingScheduleChange.proposed_grid.map((row) => ({
        weekday: row.weekday,
        time: row.time,
        professional_user_id: row.professional_user_id,
      })),
    });
    expect(presentation.professionalChange).toBe("");
  });

  it("separa solicitação e vigência na troca futura e mostra somente diferenças reais", () => {
    const presentation = buildPendingCommercialChangePresentation({
      currentPlanName: "Pilates 3x",
      pendingChange: {
        effective_on: "2026-08-18",
        requested_at: "2026-07-23T13:38:00.000Z",
        service_plan_name: "Funcional 2x",
        previous_configuration: { sessions_per_week: 3, price_cents: 60000 },
        new_configuration: { sessions_per_week: 2, price_cents: 48000 },
        previous_schedule: [{ weekday: 1, time: "08:00", professional_user_id: 21 }],
        new_schedule: [{ weekday: 2, time: "09:00", professional_user_id: 36 }],
      },
      historyEvent: { actor: { name: "Leonardo" } },
      professionals: [{ id: 21, name: "Leonardo" }, { id: 36, name: "Mariana" }],
    });

    expect(presentation.title).toBe("Pilates 3x → Funcional 2x");
    expect(presentation.metadata).toMatch(/^Solicitada em 23 jul · Leonardo$/);
    expect(presentation.details).toEqual(expect.arrayContaining([
      "Frequência: 3x → 2x por semana",
    ]));
    expect(presentation.details.join(" ")).toMatch(/Valor: R\$\s*600,00 → R\$\s*480,00/);
    expect(presentation.agendaComparison).toEqual({
      current: "Seg 08h",
      proposed: "Ter 09h",
    });
    expect(presentation.professionalChange).toBe("Profissional: Leonardo → Mariana");
  });

  it("apresenta pausa futura com fim e pausa indefinida sem confundir as datas", () => {
    const historyEvent = {
      occurred_at: "2026-07-23T13:38:00.000Z",
      actor: { name: "Leonardo" },
    };
    expect(buildPausePresentation({
      pause: {
        status: "scheduled",
        starts_on: "2026-08-18",
        ends_on: "2026-08-31",
        created_at: "2026-07-23T13:38:00.000Z",
        is_indefinite: false,
      },
      historyEvent,
    })).toEqual({
      title: "Pausa agendada",
      metadata: "Solicitada em 23 jul · Leonardo",
      period: "18 ago → 31 ago",
    });
    expect(buildPausePresentation({
      pause: {
        status: "scheduled",
        starts_on: "2026-08-18",
        created_at: "2026-07-23T13:38:00.000Z",
        is_indefinite: true,
      },
      historyEvent,
    }).period).toBe("A partir de 18 ago · sem data de retorno");
  });

  it("apresenta pausa ativa com retorno no dia seguinte ao fim ou sem retorno", () => {
    expect(buildPausePresentation({
      pause: {
        status: "active",
        starts_on: "2026-08-18",
        ends_on: "2026-08-31",
        is_indefinite: false,
      },
    })).toEqual({
      title: "Pausa ativa",
      metadata: "Desde 18 ago",
      period: "Retorno em 1 set",
    });
    expect(buildPausePresentation({
      pause: { status: "active", starts_on: "2026-08-18", is_indefinite: true },
    }).period).toBe("Sem data de retorno");
  });

  it("resolve profissional alterado e omite o inalterado ou sem nomes confiáveis", () => {
    const beforeGrid = [{ weekday: 1, time: "08:00", professional_user_id: 21 }];
    const afterGrid = [{ weekday: 2, time: "09:00", professional_user_id: 36 }];
    expect(buildProfessionalChangeText({
      beforeGrid,
      afterGrid,
      professionals: [{ id: 21, name: "Leonardo" }, { id: 36, name: "Mariana" }],
    })).toBe("Profissional: Leonardo → Mariana");
    expect(buildProfessionalChangeText({
      beforeGrid,
      afterGrid: [{ ...afterGrid[0], professional_user_id: 21 }],
      professionals: [{ id: 21, name: "Leonardo" }],
    })).toBe("");
    expect(buildProfessionalChangeText({ beforeGrid, afterGrid, professionals: [] }))
      .toBe("");
  });

  it("separa solicitação, vigência e mudanças do histórico sem duplicar frequência", () => {
    const presentation = buildPlanHistoryPresentation({
      type: "commercial_change_requested",
      occurred_at: "2026-07-23T13:38:00.000Z",
      origin: "manual",
      actor: { name: "Leonardo" },
      changes: [
        { field: "effective_on", label: "Data de vigência", before: null, after: "2026-08-18" },
        { field: "service_plan_name", label: "Plano comercial", before: "Pilates 3x", after: "Funcional 2x" },
        { field: "sessions_per_week", label: "Sessões por semana", before: 3, after: 2 },
        { field: "frequency_label", label: "Frequência", before: "3x por semana", after: "2x por semana" },
        { field: "price_cents", label: "Valor contratado", before: 60000, after: 48000 },
      ],
    });
    expect(presentation.singleLine)
      .toMatch(/^23 jul 2026, \d{1,2}h38 · Troca de plano agendada$/);
    expect(presentation.singleLine).not.toContain("Leonardo");
    expect(presentation.vigency).toBe("A partir de 18 ago 2026");
    expect(presentation.changes).toEqual(expect.arrayContaining([
      "Plano: Pilates 3x → Funcional 2x",
      "Frequência: 3x → 2x por semana",
    ]));
    expect(presentation.changes.join(" ")).toMatch(/Valor: R\$\s*600,00 → R\$\s*480,00/);
    expect(presentation.changes.filter((line) => line.startsWith("Frequência:"))).toHaveLength(1);
    expect(presentation.changes.join(" ")).not.toMatch(/Sessões por semana|Plano comercial|Valor contratado/);
  });

  it("explica cancelamento como último dia ativo e resume mudança operacional real", () => {
    const cancellation = buildPlanHistoryPresentation({
      type: "cancellation_scheduled",
      occurred_at: "2026-07-23T13:38:00.000Z",
      origin: "manual",
      actor: { name: "Leonardo" },
      changes: [{
        field: "cancellation_effective_on",
        label: "Data do cancelamento",
        before: null,
        after: "2026-08-31",
      }],
    });
    expect(cancellation.vigency).toBe("Último dia ativo: 31 ago 2026");

    const schedule = buildPlanHistoryPresentation({
      type: "schedule_changed",
      occurred_at: "2026-07-23T13:38:00.000Z",
      origin: "manual",
      actor: { name: "Leonardo" },
      changes: [
        { field: "schedule_revision_effective_from", before: null, after: "2026-08-25" },
        {
          field: "schedule_grid_summary",
          before: [{ weekday: 1, time: "08:00", professional_user_id: 21 }],
          after: [{ weekday: 2, time: "09:00", professional_user_id: 36 }],
        },
      ],
    }, []);
    expect(schedule.vigency).toBe("A partir de 25 ago");
    expect(schedule.changes).toEqual([
      "Agenda: Seg 08h → Ter 09h",
    ]);
  });

  it("apresenta pausa iniciada finita sem metadados técnicos", () => {
    const event = {
      type: "pause_started",
      label: "Rótulo do ledger",
      occurred_at: "2026-08-20T14:51:00.000Z",
      actor: { name: "LeoJoyce" },
      changes: [
        { field: "status", label: "Status do plano", before: "active", after: "paused" },
        { field: "pause_status", label: "Status da pausa", before: null, after: "active" },
        { field: "pause_version", label: "Versão da pausa", before: null, after: 1 },
        { field: "starts_on", before: null, after: "2026-08-20" },
        { field: "ends_on", before: null, after: "2026-08-28" },
        { field: "is_indefinite", before: null, after: false },
      ],
    };

    const presentation = buildPlanHistoryPresentation(event);
    expect(formatPlanHistoryEventLabel(event)).toBe("Pausa iniciada");
    expect(presentation.singleLine).toMatch(/^20 ago 2026, \d{1,2}h51 · Pausa iniciada$/);
    expect(presentation.singleLine).not.toContain("LeoJoyce");
    expect(presentation.vigency).toBe("Período: 20 ago → 28 ago");
    expect(presentation.changes).toEqual([]);
    expect(getVisiblePlanHistoryChanges(event)).toEqual([]);
  });

  it("apresenta pausa iniciada indefinida sem data de retorno", () => {
    const presentation = buildPlanHistoryPresentation({
      type: "pause_started",
      occurred_at: "2026-08-20T14:51:00.000Z",
      actor: { name: "LeoJoyce" },
      changes: [
        { field: "starts_on", before: null, after: "2026-08-20" },
        { field: "ends_on", before: null, after: null },
        { field: "is_indefinite", before: null, after: true },
      ],
    });

    expect(presentation.vigency).toBe("Desde 20 ago · sem data de retorno");
    expect(presentation.changes).toEqual([]);
  });

  it("apresenta retomada somente com a data útil ao usuário", () => {
    const event = {
      type: "plan_resumed",
      label: "Rótulo do ledger",
      occurred_at: "2026-08-20T14:57:00.000Z",
      actor: { name: "LeoJoyce" },
      changes: [
        { field: "status", label: "Status do plano", before: "paused", after: "active" },
        { field: "pause_status", label: "Status da pausa", before: "active", after: "ended" },
        { field: "pause_version", label: "Versão da pausa", before: 1, after: 2 },
        { field: "resumes_on", before: null, after: "2026-08-20" },
      ],
    };

    const presentation = buildPlanHistoryPresentation(event);
    expect(formatPlanHistoryEventLabel(event)).toBe("Plano retomado");
    expect(presentation.singleLine).toMatch(/^20 ago 2026, \d{1,2}h57 · Plano retomado$/);
    expect(presentation.singleLine).not.toContain("LeoJoyce");
    expect(presentation.vigency).toBe("Retomado em 20 ago");
    expect(presentation.changes).toEqual([]);
    expect(getVisiblePlanHistoryChanges(event)).toEqual([]);
  });

  it("apresenta somente mudanças reais de período e motivo na pausa alterada", () => {
    const presentation = buildPlanHistoryPresentation({
      type: "pause_updated",
      occurred_at: "2026-08-20T14:55:00.000Z",
      actor: { name: "LeoJoyce" },
      changes: [
        { field: "pause_status", label: "Status da pausa", before: "active", after: "active" },
        { field: "pause_version", label: "Versão da pausa", before: 1, after: 2 },
        { field: "ends_on", label: "Fim da pausa", before: "2026-08-28", after: "2026-09-04" },
        { field: "reason", label: "Motivo da pausa", before: null, after: "Recesso" },
      ],
    });

    expect(presentation.singleLine).toMatch(/^20 ago 2026, \d{1,2}h55 · Pausa alterada$/);
    expect(presentation.singleLine).not.toContain("LeoJoyce");
    expect(presentation.vigency).toBe("");
    expect(presentation.changes).toEqual([
      "Período: até 28 ago → até 4 set",
      "Motivo adicionado: Recesso",
    ]);
    expect(presentation.changes.join(" ")).not.toMatch(/status|versão|não informado/i);
  });

  it("descreve motivo alterado ou removido sem campos internos", () => {
    expect(buildPlanHistoryPresentation({
      type: "pause_updated",
      changes: [{ field: "reason", before: "Viagem", after: "Tratamento" }],
    }).changes).toEqual(["Motivo: Viagem → Tratamento"]);
    expect(buildPlanHistoryPresentation({
      type: "pause_updated",
      changes: [{ field: "reason", before: "Viagem", after: null }],
    }).changes).toEqual(["Motivo removido."]);
  });

  it.each(["pause_scheduled", "pause_started", "pause_updated", "pause_ended", "plan_resumed"])(
    "remove status e versão técnica de %s",
    (type) => {
      const event = {
        type,
        changes: [
          { field: "pause_status", label: "Status da pausa", before: "active", after: "ended" },
          { field: "pause_version", label: "Versão da pausa", before: 1, after: 2 },
          { field: "lifecycle_status", label: "Lifecycle", before: "open", after: "closed" },
        ],
      };
      expect(getVisiblePlanHistoryChanges(event)).toEqual([]);
      expect(buildPlanHistoryPresentation(event).changes).toEqual([]);
    },
  );

  it("renomeia a alteração de Agenda e oculta contagens técnicas", () => {
    const event = {
      type: "schedule_changed",
      label: "Grade mensal alterada",
      occurred_at: "2026-08-20T14:51:00.000Z",
      actor: { name: "LeoJoyce" },
      changes: [
        { field: "schedule_revision_effective_from", before: null, after: "2026-08-21" },
        {
          field: "schedule_grid_summary",
          before: [{ weekday: 3, time: "20:00" }, { weekday: 4, time: "20:00" }],
          after: [{ weekday: 4, time: "20:00" }, { weekday: 5, time: "20:00" }],
        },
        { field: "schedule_revision_id", before: 7, after: 8 },
        { field: "schedule_revision_status", before: "active", after: "scheduled" },
        { field: "schedule_replaced_sessions", before: null, after: 3 },
        { field: "schedule_preserved_sessions", before: null, after: 5 },
      ],
    };

    const presentation = buildPlanHistoryPresentation(event);
    expect(formatPlanHistoryEventLabel(event)).toBe("Agenda alterada");
    expect(presentation.singleLine).toMatch(/^20 ago 2026, \d{1,2}h51 · Agenda alterada$/);
    expect(presentation.singleLine).not.toContain("LeoJoyce");
    expect(presentation.vigency).toBe("A partir de 21 ago");
    expect(presentation.changes).toEqual([
      "Agenda: Qua 20h · Qui 20h → Qui 20h · Sex 20h",
    ]);
    expect(presentation.changes.join(" ")).not.toMatch(/substituídas|preservadas|revisão/i);
  });

  it("resume o cancelamento de alteração da Agenda em uma única linha sem detalhes técnicos", () => {
    const presentation = buildPlanHistoryPresentation({
      type: "schedule_change_canceled",
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
        { field: "schedule_revision_id", label: "Revisão da grade", before: 4, after: 6 },
        { field: "version", label: "Versão", before: 1, after: 2 },
        {
          field: "lifecycle_status",
          label: "Lifecycle",
          before: "pending",
          after: "canceled",
        },
      ],
    });

    expect(presentation).toEqual({
      singleLine: "20 ago 2026, 20h · Alteração de agenda cancelada",
      vigency: "",
      changes: [],
    });
  });

  it("apresenta a aplicação da Agenda como vigência em uma única linha", () => {
    const presentation = buildPlanHistoryPresentation({
      type: "schedule_change_applied",
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
        { field: "version", label: "Versão", before: 1, after: 2 },
        {
          field: "lifecycle_status",
          label: "Lifecycle",
          before: "future",
          after: "current",
        },
        { field: "materialized_sessions", label: "Sessões materializadas", after: 15 },
      ],
    });

    expect(presentation).toEqual({
      singleLine: "21 ago 2026, 00h05 · Nova agenda vigente",
      vigency: "",
      changes: [],
    });
  });

  it.each([
    ["schedule_changed", "2026-08-20T20:00:00", "20 ago 2026, 20h · Agenda alterada"],
    ["pause_started", "2026-08-20T15:59:00", "20 ago 2026, 15h59 · Pausa iniciada"],
    ["plan_resumed", "2026-08-20T16:00:00", "20 ago 2026, 16h · Plano retomado"],
    [
      "commercial_change_requested",
      "2026-07-23T10:38:00",
      "23 jul 2026, 10h38 · Troca de plano agendada",
    ],
  ])("padroniza a primeira linha de %s sem ator", (type, occurredAt, expected) => {
    const presentation = buildPlanHistoryPresentation({
      type,
      occurred_at: occurredAt,
      actor: { name: "Responsável interno" },
    });

    expect(presentation.singleLine).toBe(expected);
    expect(presentation.singleLine).not.toContain("Responsável interno");
  });

  it("correlaciona solicitação pelo recurso autoritativo ou pela vigência exata", () => {
    const events = [
      {
        id: 2,
        type: "schedule_changed",
        related_entity: { type: "schedule_revision", id: 72 },
      },
      {
        id: 1,
        type: "cancellation_scheduled",
        changes: [{ field: "cancellation_effective_on", after: "2026-08-31" }],
      },
    ];
    expect(findPlanHistoryEvent({
      events,
      types: ["schedule_changed"],
      relatedEntityType: "schedule_revision",
      relatedEntityId: 72,
    })?.id).toBe(2);
    expect(findPlanHistoryEvent({
      events,
      types: ["cancellation_scheduled"],
      effectiveOn: "2026-08-31",
    })?.id).toBe(1);
    expect(findPlanHistoryEvent({
      events,
      types: ["schedule_changed"],
      relatedEntityType: "schedule_revision",
      relatedEntityId: 99,
    })).toBeNull();
  });

  it.each([
    ["commercial_change_requested", "Troca de plano agendada"],
    ["commercial_change_replaced", "Troca de plano atualizada"],
    ["commercial_change_canceled", "Troca de plano cancelada"],
    ["commercial_change_applied", "Troca de plano realizada"],
    ["pause_started", "Pausa iniciada"],
    ["plan_resumed", "Plano retomado"],
    ["schedule_changed", "Agenda alterada"],
    ["schedule_change_canceled", "Alteração de agenda cancelada"],
    ["schedule_change_applied", "Nova agenda vigente"],
  ])("apresenta %s com linguagem de negócio", (type, expectedLabel) => {
    expect(formatPlanHistoryEventLabel({ type, label: "Rótulo técnico" })).toBe(expectedLabel);
  });

  it("oculta somente o status redundante do agendamento comercial", () => {
    const redundantStatus = {
      field: "change_status",
      label: "Status da alteração",
      before: null,
      after: "pending",
    };
    const planChange = {
      field: "service_plan_name",
      label: "Plano comercial",
      before: "Mensal 2x",
      after: "Mensal 3x",
    };
    expect(getVisiblePlanHistoryChanges({
      type: "commercial_change_requested",
      changes: [redundantStatus, planChange],
    })).toEqual([planChange]);
    expect(getVisiblePlanHistoryChanges({
      type: "commercial_change_applied",
      changes: [redundantStatus],
    })).toEqual([redundantStatus]);
  });

  it("traduz sessões protegidas, conflitos e stale sem expor detalhes técnicos", () => {
    const issues = getScheduleChangeIssues({
      protected_sessions: [{
        id: 9,
        starts_at: "2026-08-26T09:00:00",
        reasons: ["has_evaluation"],
      }],
      conflicts: [{ code: "PATIENT_SCHEDULE_CONFLICT", date: "2026-08-27", time: "10:00" }],
    });
    expect(issues).toHaveLength(2);
    expect(issues[0].detail).toMatch(/avaliação/);
    expect(issues[1].detail).toMatch(/paciente/);

    expect(scheduleChangeErrorPresentation({
      response: { data: { code: "SCHEDULE_CHANGE_PREVIEW_STALE", error: "Prévia expirada." } },
    })).toEqual(expect.objectContaining({
      stale: true,
      code: "SCHEDULE_CHANGE_PREVIEW_STALE",
      message: "Não foi possível alterar a agenda agora. Atualize a página e tente novamente.",
    }));
  });

  it("não transforma ocorrências puladas em impedimentos e preserva conflitos reais", () => {
    expect(getScheduleChangeIssues({
      skipped_occurrences: [{ date: "2026-09-07", reason: "Feriado" }],
      warnings: [{ date: "2026-10-12", reason: "Feriado" }],
      conflicts: [],
    })).toEqual([]);

    expect(getScheduleChangeIssues({
      conflicts: [{
        code: "PATIENT_SCHEDULE_CONFLICT",
        date: "2026-09-08",
        time: "09:00",
      }],
    })).toEqual([expect.objectContaining({
      detail: "O paciente já possui atendimento nesse horário.",
    })]);
  });

  it("oculta mensagem técnica e mantém erro acionável específico", () => {
    expect(scheduleChangeErrorPresentation({
      response: {
        data: {
          code: "SCHEDULE_CHANGE_CURRENT_REVISION_REQUIRED",
          error: "A grade atual não possui revisão autoritativa.",
          revision_id: 71,
          conflicts: [{ code: "SCHEDULE_CHANGE_SERIES_REVISION_CONFLICT" }],
        },
      },
    })).toEqual(expect.objectContaining({
      code: "SCHEDULE_CHANGE_CURRENT_REVISION_REQUIRED",
      message: "Não foi possível alterar a agenda agora. Atualize a página e tente novamente.",
      issues: [],
    }));

    expect(scheduleChangeErrorPresentation({
      response: {
        data: {
          code: "SCHEDULE_CHANGE_PROTECTED_SESSION",
          error: "Existem sessões futuras protegidas que impedem a alteração da grade.",
          protected_sessions: [{ id: 9, reasons: ["has_evaluation"] }],
        },
      },
    })).toEqual(expect.objectContaining({
      message: "Existem sessões futuras que precisam de revisão antes desta alteração.",
      issues: [expect.objectContaining({ detail: "possui avaliação vinculada" })],
    }));
  });

  it("gera chave de idempotência válida e limitada", () => {
    const key = createScheduleChangeIdempotencyKey(41);
    expect(key).toMatch(/^schedule-change-41-/);
    expect(key.length).toBeGreaterThanOrEqual(8);
    expect(key.length).toBeLessThanOrEqual(100);
  });
});
