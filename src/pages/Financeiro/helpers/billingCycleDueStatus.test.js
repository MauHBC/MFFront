import {
  formatBillingDueDate,
  getBillingDueStatus,
  getGroupedBillingDuePresentation,
  getGroupedReferenceDatePresentation,
  getLocalTodayDateOnly,
  getTemporalDateStatus,
  normalizeDateOnly,
} from "./billingCycleDueStatus";

const TODAY = "2026-08-27";

describe("billingCycleDueStatus", () => {
  it("classifica vencimento passado, hoje e futuro sem converter DATEONLY por fuso", () => {
    expect(getBillingDueStatus({ dueDate: "2026-08-20", openCents: 100, today: TODAY }))
      .toMatchObject({ state: "overdue", alertLabel: "Vencida há 7 dias" });
    expect(getBillingDueStatus({ dueDate: TODAY, openCents: 100, today: TODAY }))
      .toMatchObject({ state: "today", alertLabel: "Vence hoje" });
    expect(getBillingDueStatus({ dueDate: "2026-08-30", openCents: 100, today: TODAY }))
      .toMatchObject({ state: "upcoming", alertLabel: "A vencer" });
  });

  it("classifica uma data operacional sem alterar a semântica do helper de vencimento", () => {
    expect(getTemporalDateStatus({ date: "2026-08-20", openCents: 100, today: TODAY }))
      .toMatchObject({ state: "overdue", alertLabel: "Vencida há 7 dias" });
    expect(getTemporalDateStatus({ date: TODAY, openCents: 100, today: TODAY }))
      .toMatchObject({ state: "today", alertLabel: "Vence hoje" });
    expect(getTemporalDateStatus({ date: "2026-08-30", openCents: 100, today: TODAY }))
      .toMatchObject({ state: "upcoming", alertLabel: "A vencer" });
  });

  it("mantem apenas a data para obrigação paga mesmo quando o vencimento passou", () => {
    expect(getBillingDueStatus({ dueDate: "2026-08-20", openCents: 0, today: TODAY }))
      .toEqual({
        dateOnly: "2026-08-20",
        formattedDate: "20/08/2026",
        state: "settled",
        alertLabel: "",
        daysOverdue: 0,
      });
  });

  it("resume um único vencimento e preserva alerta enquanto houver saldo aberto", () => {
    expect(getGroupedBillingDuePresentation([
      { dueDate: "2026-08-20", openCents: 400 },
    ], { today: TODAY })).toMatchObject({
      count: 1,
      primaryLabel: "20/08/2026",
      secondaryLabel: "Vencida há 7 dias",
      state: "overdue",
    });
  });

  it("usa o vencimento mais antigo em aberto entre várias datas distintas", () => {
    expect(getGroupedBillingDuePresentation([
      { dueDate: "2026-09-20", openCents: 500 },
      { dueDate: "2026-07-20", openCents: 0 },
      { dueDate: "2026-08-20", openCents: 200 },
    ], { today: TODAY })).toMatchObject({
      count: 3,
      primaryLabel: "3 vencimentos",
      secondaryLabel: "Mais antigo em aberto: 20/08/2026 · Vencida há 7 dias",
      state: "overdue",
    });
  });

  it("não mostra alerta de atraso quando todos os vencimentos estão pagos", () => {
    expect(getGroupedBillingDuePresentation([
      { dueDate: "2026-07-20", openCents: 0 },
      { dueDate: "2026-08-20", openCents: 0 },
    ], { today: TODAY })).toEqual({
      count: 2,
      primaryLabel: "2 vencimentos",
      secondaryLabel: "",
      state: "settled",
      oldestOpenDue: null,
    });
  });

  it("usa a menor data operacional ainda aberta e ignora item pago mais antigo", () => {
    expect(getGroupedReferenceDatePresentation([
      { referenceDate: "2026-08-05", openCents: 0 },
      { referenceDate: "2026-08-18", openCents: 300 },
      { referenceDate: "2026-08-25", openCents: 500 },
    ], { today: TODAY })).toEqual({
      dateOnly: "2026-08-18",
      formattedDate: "18/08/2026",
      state: "overdue",
      alertLabel: "Vencida há 9 dias",
      daysOverdue: 9,
    });
  });

  it("mantém a menor data operacional e nenhum alerta quando o agrupamento está pago", () => {
    expect(getGroupedReferenceDatePresentation([
      { referenceDate: "2026-08-12", openCents: 0 },
      { referenceDate: "2026-08-20", openCents: 0 },
    ], { today: TODAY })).toEqual({
      dateOnly: "2026-08-12",
      formattedDate: "12/08/2026",
      state: "settled",
      alertLabel: "",
      daysOverdue: 0,
    });
  });

  it("tolera agrupamento operacional sem data", () => {
    expect(getGroupedReferenceDatePresentation([
      { referenceDate: null, openCents: 100 },
    ], { today: TODAY })).toEqual({
      dateOnly: "",
      formattedDate: "-",
      state: "missing",
      alertLabel: "",
    });
  });

  it("tolera ausência ou invalidade do vencimento sem quebrar a apresentação", () => {
    expect(getBillingDueStatus({ dueDate: null, openCents: 100, today: TODAY }))
      .toMatchObject({ state: "missing", formattedDate: "-", alertLabel: "" });
    expect(getGroupedBillingDuePresentation([
      { dueDate: null, openCents: 100 },
      { dueDate: "2026-02-30", openCents: 100 },
    ], { today: TODAY })).toMatchObject({
      count: 0,
      primaryLabel: "-",
      secondaryLabel: "",
      state: "missing",
    });
  });

  it("formata e captura a data local sem round-trip por ISO", () => {
    const lateLocalDate = new Date(2026, 7, 27, 23, 30, 0);
    expect(getLocalTodayDateOnly(lateLocalDate)).toBe("2026-08-27");
    expect(normalizeDateOnly("2026-08-27T00:00:00.000Z")).toBe("2026-08-27");
    expect(formatBillingDueDate("2026-08-27")).toBe("27/08/2026");
  });
});
