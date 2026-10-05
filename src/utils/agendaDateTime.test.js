import {
  formatAgendaDateInput,
  formatAgendaDateTimeInput,
  formatAgendaShortDate,
  formatAgendaTime,
  isAgendaWeekendInstant,
  parseAgendaDateTime,
  resolveAgendaFormInterval,
} from "./agendaDateTime";

describe("agendaDateTime", () => {
  it("apresenta instantes no fuso canônico da Agenda", () => {
    expect(formatAgendaDateTimeInput("2026-10-08T10:00:00.000Z"))
      .toBe("2026-10-08T07:00");
    expect(formatAgendaTime("2026-10-08T10:00:00.000Z")).toBe("07:00");
  });

  it("interpreta alteração explícita como horário civil da Agenda", () => {
    expect(parseAgendaDateTime("2026-10-08T10:00").toISOString())
      .toBe("2026-10-08T13:00:00.000Z");
  });

  it("preserva a data civil da Agenda perto da virada do dia", () => {
    expect(formatAgendaDateInput("2026-10-04T02:00:00.000Z")).toBe("2026-10-03");
    expect(formatAgendaTime("2026-10-04T02:00:00.000Z")).toBe("23:00");
    expect(isAgendaWeekendInstant(new Date("2026-10-04T02:00:00.000Z"))).toBe(true);
  });

  it("formata data curta distinguindo DATEONLY de instante com offset", () => {
    expect(formatAgendaShortDate("2026-10-01")).toBe("01/10/26");
    expect(formatAgendaShortDate("2026-10-01T01:30:00.000Z")).toBe("30/09/26");
    expect(formatAgendaShortDate("2026-10-01T01:30:00-00:00")).toBe("30/09/26");
  });

  it("mantém o instante de uma origem com offset explícito", () => {
    expect(formatAgendaDateTimeInput("2026-10-08T07:00:00-03:00"))
      .toBe("2026-10-08T07:00");
  });

  it("rejeita horário civil inexistente em transição histórica do fuso", () => {
    expect(parseAgendaDateTime("2018-11-04T00:30")).toBeNull();
  });

  it("rejeita instante com offset cuja data civil é impossível", () => {
    expect(parseAgendaDateTime("2026-02-30T10:00:00Z")).toBeNull();
  });

  it("preserva literalmente início e fim quando o horário civil não mudou", () => {
    const interval = resolveAgendaFormInterval({
      startInput: "2026-10-08T07:00",
      endInput: "2026-10-08T08:00",
      originalStart: "2026-10-08T10:00:12.345Z",
      originalEnd: "2026-10-08T11:00:45.678Z",
    });

    expect(interval).toMatchObject({
      valid: true,
      changed: false,
      starts_at: "2026-10-08T10:00:12.345Z",
      ends_at: "2026-10-08T11:00:45.678Z",
    });
  });

  it("serializa início e fim alterados pelo mesmo contrato", () => {
    const interval = resolveAgendaFormInterval({
      startInput: "2026-10-08T10:00",
      endInput: "2026-10-08T11:00",
      originalStart: "2026-10-08T10:00:00.000Z",
      originalEnd: "2026-10-08T11:00:00.000Z",
    });

    expect(interval).toMatchObject({
      valid: true,
      changed: true,
      starts_at: "2026-10-08T13:00:00.000Z",
      ends_at: "2026-10-08T14:00:00.000Z",
    });
  });

  it("preserva a duração exata quando o início é alterado", () => {
    const interval = resolveAgendaFormInterval({
      startInput: "2026-10-08T10:00",
      endInput: "2026-10-08T11:15",
      originalStart: "2026-10-08T10:00:12.345Z",
      originalEnd: "2026-10-08T11:15:45.678Z",
    });

    expect(interval).toMatchObject({
      valid: true,
      changed: true,
      starts_at: "2026-10-08T13:00:00.000Z",
      ends_at: "2026-10-08T14:15:33.333Z",
    });
  });
});
