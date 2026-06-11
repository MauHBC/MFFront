import {
  emptyFinancialRevenuesSummary,
  mapRevenuesSummaryPatientsToAttendanceRows,
  mapRevenuesSummaryToAttendanceSummary,
  normalizeFinancialRevenuesSummary,
} from "./financialRevenuesSummary";

describe("financialRevenuesSummary helper", () => {
  it("normaliza total recebido pendente e pacientes do endpoint", () => {
    const result = normalizeFinancialRevenuesSummary({
      month: "2026-06",
      summary: {
        total: 560000,
        received: 210000,
        pending: 350000,
      },
      patients: [
        {
          patient_id: 1,
          patient_name: "Ana Lima",
          total: 150000,
          received: 100000,
          pending: 50000,
          entries_count: 2,
        },
      ],
    });

    expect(result.summary).toEqual({
      total: 560000,
      received: 210000,
      pending: 350000,
    });
    expect(result.patients).toEqual([
      {
        patient_id: 1,
        patient_name: "Ana Lima",
        total: 150000,
        received: 100000,
        pending: 50000,
        entries_count: 2,
      },
    ]);
  });

  it("mapeia pacientes agregados para as linhas usadas em Receitas", () => {
    const rows = mapRevenuesSummaryPatientsToAttendanceRows({
      patients: [
        {
          patient_id: 2,
          patient_name: "Bruno Costa",
          total: 200000,
          received: 70000,
          pending: 130000,
          entries_count: 1,
        },
      ],
    });

    expect(rows).toEqual([
      {
        patientId: 2,
        patientName: "Bruno Costa",
        sessions: 1,
        totalCents: 200000,
        openCents: 130000,
        paidCents: 70000,
        creditsAvailable: 0,
        lastSession: null,
      },
    ]);
  });

  it("mapeia o resumo agregado para os cards atuais sem valores crus", () => {
    const summary = mapRevenuesSummaryToAttendanceSummary({
      summary: {
        total: 560000,
        received: 210000,
        pending: 350000,
      },
      patients: [
        { patient_id: 1, entries_count: 2, pending: 50000 },
        { patient_id: 2, entries_count: 1, pending: 300000 },
      ],
    });

    expect(summary).toEqual({
      total: 3,
      openSessions: 3,
      openPatients: 2,
      pendingAmount: 350000,
      paidAmount: 210000,
      expectedAmount: 560000,
      creditsAvailable: 0,
    });
  });

  it("nao quebra quando patients vem vazio", () => {
    const payload = emptyFinancialRevenuesSummary("2026-06");

    expect(mapRevenuesSummaryPatientsToAttendanceRows(payload)).toEqual([]);
    expect(mapRevenuesSummaryToAttendanceSummary(payload)).toEqual({
      total: 0,
      openSessions: 0,
      openPatients: 0,
      pendingAmount: 0,
      paidAmount: 0,
      expectedAmount: 0,
      creditsAvailable: 0,
    });
  });
});
