import {
  addCivilDays,
  addCivilMonths,
  civilDateInSaoPaulo,
  getCivilMonthRange,
  getCivilYearRange,
  saoPauloCivilDateTimeToInstant,
  todayInSaoPaulo,
} from "./canonicalDateTime";

describe("canonicalDateTime", () => {
  it("projects instants onto the Motria civil calendar", () => {
    expect(civilDateInSaoPaulo("2026-10-04T02:00:00.000Z")).toBe("2026-10-03");
    expect(todayInSaoPaulo(new Date("2027-01-01T01:30:00.000Z"))).toBe("2026-12-31");
  });

  it("keeps date-only arithmetic independent from the process timezone", () => {
    expect(addCivilDays("2028-02-28", 1)).toBe("2028-02-29");
    expect(addCivilDays("2028-02-29", 1)).toBe("2028-03-01");
    expect(addCivilMonths("2026-01-31", 1)).toBe("2026-02-28");
    expect(getCivilMonthRange("2028-02")).toEqual({
      start: "2028-02-01",
      end: "2028-02-29",
    });
    expect(getCivilMonthRange("2026-06")).toEqual({
      start: "2026-06-01",
      end: "2026-06-30",
    });
    expect(getCivilYearRange("2027")).toEqual({
      start: "2027-01-01",
      end: "2027-12-31",
    });
    expect(addCivilMonths("9999-12-01", 1)).toBe("");
    expect(addCivilMonths("1900-01-01", -1)).toBe("");
  });

  it("fails closed for invalid civil dates and competencies", () => {
    expect(civilDateInSaoPaulo("2026-02-30")).toBe("");
    expect(civilDateInSaoPaulo("2026-13-01")).toBe("");
    expect(civilDateInSaoPaulo("2026-02-30T10:00:00Z")).toBe("");
    expect(civilDateInSaoPaulo("2026-10-08T10:00:00")).toBe("");
    expect(getCivilMonthRange("2026-13")).toBeNull();
    expect(getCivilMonthRange("0000-01")).toBeNull();
    expect(getCivilYearRange("20260")).toBeNull();
    expect(getCivilYearRange("0000")).toBeNull();
  });

  it("serializes civil schedule and payment values in America/Sao_Paulo", () => {
    expect(saoPauloCivilDateTimeToInstant("2026-10-08", "10:00:00").toISOString())
      .toBe("2026-10-08T13:00:00.000Z");
  });

  it("honors historical Sao Paulo offsets and rejects a nonexistent DST time", () => {
    expect(saoPauloCivilDateTimeToInstant("2018-07-01", "10:00:00").toISOString())
      .toBe("2018-07-01T13:00:00.000Z");
    expect(saoPauloCivilDateTimeToInstant("2018-12-01", "10:00:00").toISOString())
      .toBe("2018-12-01T12:00:00.000Z");
    expect(saoPauloCivilDateTimeToInstant("2018-11-04", "00:30:00")).toBeNull();
  });
});
