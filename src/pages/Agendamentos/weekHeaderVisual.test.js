import fs from "fs";
import path from "path";

const source = fs.readFileSync(path.join(__dirname, "index.js"), "utf8");

const getStyledBlock = (name, nextName) => {
  const start = source.indexOf(`const ${name} = styled`);
  const end = source.indexOf(`const ${nextName} = styled`, start);

  expect(start).toBeGreaterThanOrEqual(0);
  expect(end).toBeGreaterThan(start);

  return source.slice(start, end);
};

describe("Agenda - cabeçalho visual da semana", () => {
  it("usa fundo branco e mantém a estrutura responsiva e a separação inferior", () => {
    const header = getStyledBlock("WeekHeader", "WeekHeaderCell");

    expect(header).toContain("display: grid;");
    expect(header).toContain("grid-template-columns: 80px repeat(");
    expect(header).toContain("colors.surface");
    expect(header).toContain("border-bottom: 1px solid");
    expect(header).toContain("alpha.brand022");
    expect(header).not.toContain("background: #f2f4ee;");
  });

  it("preserva o destaque interativo dos dias e os indicadores especiais", () => {
    const headerCell = getStyledBlock("WeekHeaderCell", "DaySpecialBadge");
    const specialBadge = getStyledBlock("DaySpecialBadge", "WeekBody");

    expect(headerCell).toContain("&:hover");
    expect(headerCell).toContain("background: rgba(162, 177, 144, 0.12);");
    expect(specialBadge).toContain('if (props.$severity === "block")');
    expect(specialBadge).toContain('if (props.$severity === "warn")');
  });

  it("mantém as faixas de período verdes e isola a mudança da visão semanal", () => {
    const periodRow = getStyledBlock("WeekPeriodRow", "WeekPeriodSpacer");
    const periodSpacer = getStyledBlock("WeekPeriodSpacer", "WeekPeriodToggle");
    const periodToggle = getStyledBlock("WeekPeriodToggle", "WeekPeriodLabel");
    const dayPanel = getStyledBlock("DayPanel", "DayHeader");
    const monthPanel = getStyledBlock("MonthPanel", "MonthGrid");

    expect(periodRow).toContain("colors.surfaceSecondary");
    expect(periodRow).toContain("alpha.brand028");
    expect(periodSpacer).toContain("alpha.brand014");
    expect(periodSpacer).toContain("alpha.brand028");
    expect(periodToggle).toContain(
      "props.$expanded ? alpha.brand022 : alpha.brand014",
    );
    expect(periodToggle).toContain("colors.brandDark");
    expect(dayPanel).toContain("background: #fff;");
    expect(monthPanel).toContain("background: #fff;");
    expect(source).toContain('{view === "week" && (');
  });

  it("reforça somente as divisórias da grade semanal", () => {
    const weekGrid = getStyledBlock("WeekGrid", "WeekHeader");
    const weekRow = getStyledBlock("WeekRow", "TimeCell");
    const timeCell = getStyledBlock("TimeCell", "HourExpandToggle");
    const slotCell = getStyledBlock("SlotCell", "GroupPill");
    const groupPill = getStyledBlock("GroupPill", "GroupPillContent");

    expect(weekGrid).toContain("alpha.brand028");
    expect(weekRow).toContain("alpha.brand030");
    expect(timeCell).toContain("alpha.brand028");
    expect(slotCell).toContain("alpha.brand022");
    expect(groupPill).not.toContain("alpha.brand028");
    expect(groupPill).not.toContain("alpha.brand030");
  });
});
