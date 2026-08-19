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
    expect(presentation.moment).toMatch(/^Solicitada em 23 jul 2026, \d{2}:\d{2} · Leonardo$/);
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
    expect(schedule.vigency).toBe("A partir de 25 ago 2026");
    expect(schedule.changes).toEqual([
      "Agenda: Seg 08h → Ter 09h",
    ]);
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
    })).toEqual(expect.objectContaining({ stale: true, message: "Prévia expirada." }));
  });

  it("gera chave de idempotência válida e limitada", () => {
    const key = createScheduleChangeIdempotencyKey(41);
    expect(key).toMatch(/^schedule-change-41-/);
    expect(key.length).toBeGreaterThanOrEqual(8);
    expect(key.length).toBeLessThanOrEqual(100);
  });
});
