import {
  financialCivilBoundaryToInstant,
  financialCivilDateRangeToInstants,
  financialCivilDayStartInstant,
  financialPaidAtInstant,
  financialTodayDate,
  parseFinancialHistoricalValue,
} from "./financialDateTime";

describe("financialDateTime", () => {
  it("usa o calendário financeiro de São Paulo para hoje e para os limites civis", () => {
    expect(financialTodayDate(new Date("2027-01-01T01:30:00.000Z"))).toBe("2026-12-31");
    expect(financialCivilBoundaryToInstant("2026-06-01", "00:00:00").toISOString())
      .toBe("2026-06-01T03:00:00.000Z");
    expect(financialCivilBoundaryToInstant("2026-06-30", "23:59:59.999").toISOString())
      .toBe("2026-07-01T02:59:59.999Z");
  });

  it("preserva a âncora técnica vigente de paid_at", () => {
    expect(financialPaidAtInstant("2026-09-10")).toBe("2026-09-10T12:00:00.000Z");
  });

  it("usa o primeiro instante representável quando o dia civil começa em um gap", () => {
    expect(financialCivilDayStartInstant("2018-11-04")?.toISOString())
      .toBe("2018-11-04T03:00:00.000Z");

    const range = financialCivilDateRangeToInstants({
      start: "2018-11-04",
      end: "2018-11-04",
    });
    expect(range.start?.toISOString()).toBe("2018-11-04T03:00:00.000Z");
    expect(range.endExclusive?.toISOString()).toBe("2018-11-05T02:00:00.000Z");
    expect(new Date("2018-11-04T02:59:59.999Z") >= range.start).toBe(false);
    expect(new Date("2018-11-04T03:00:00.000Z") >= range.start).toBe(true);
    expect(new Date("2018-11-05T02:00:00.000Z") < range.endExclusive).toBe(false);
  });

  it("distingue data civil, instante e a representação legada conhecida", () => {
    expect(parseFinancialHistoricalValue("2026-10-25")).toMatchObject({
      kind: "civil-date",
      dateOnly: "2026-10-25",
    });
    expect(parseFinancialHistoricalValue("2026-10-25T09:00:00")).toMatchObject({
      kind: "legacy-paid-date",
      dateOnly: "2026-10-25",
    });
    expect(parseFinancialHistoricalValue("2026-10-25T12:00:00.000Z")?.date.toISOString())
      .toBe("2026-10-25T12:00:00.000Z");
    expect(parseFinancialHistoricalValue("2026-02-30T12:00:00.000Z")).toBeNull();
    expect(parseFinancialHistoricalValue("2026-10-25T10:00:00")).toBeNull();
  });
});
