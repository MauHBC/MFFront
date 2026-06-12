import {
  getFinancialOverview,
  getFinancialRevenuePatientDetail,
  getFinancialRevenuesSummary,
} from "./financial";
import api from "./axios";

jest.mock("./axios", () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
  },
}));

describe("financial service", () => {
  beforeEach(() => {
    api.get.mockReset();
  });

  it("chama o endpoint de resumo financeiro por mes", () => {
    getFinancialOverview("2026-06");

    expect(api.get).toHaveBeenCalledWith("/financial-overview", {
      params: { month: "2026-06" },
    });
  });

  it("chama o endpoint agregado de receitas por mes", () => {
    getFinancialRevenuesSummary("2026-06");

    expect(api.get).toHaveBeenCalledWith("/financial-revenues-summary", {
      params: { month: "2026-06" },
    });
  });

  it("chama o endpoint agregado de receitas por ano", () => {
    getFinancialRevenuesSummary("2026", "year");

    expect(api.get).toHaveBeenCalledWith("/financial-revenues-summary", {
      params: { year: "2026" },
    });
  });

  it("chama o endpoint de detalhe financeiro do paciente por mes", () => {
    getFinancialRevenuePatientDetail(30, "2026-06");

    expect(api.get).toHaveBeenCalledWith("/financial-revenues/patient-detail", {
      params: { patient_id: 30, month: "2026-06" },
    });
  });

  it("chama o endpoint de detalhe financeiro do paciente por ano", () => {
    getFinancialRevenuePatientDetail(30, "2026", "year");

    expect(api.get).toHaveBeenCalledWith("/financial-revenues/patient-detail", {
      params: { patient_id: 30, year: "2026" },
    });
  });
});
