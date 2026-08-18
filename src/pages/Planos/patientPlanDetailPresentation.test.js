import {
  buildPendingScheduleChangePresentation,
  buildScheduleRows,
  createScheduleChangeIdempotencyKey,
  formatAgendaPattern,
  formatCompactDate,
  formatScheduleGrid,
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
