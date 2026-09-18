import {
  createFinancialPayment,
  deleteClinicExpense,
  createClinicExpenseWithPayment,
  getFinancialOverview,
  getFinancialRevenuePatientDetail,
  getFinancialRevenuesSummary,
  unpayClinicExpense,
} from "./financial";
import api from "./axios";

jest.mock("./axios", () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    delete: jest.fn(),
    patch: jest.fn(),
    post: jest.fn(),
  },
}));

describe("financial service", () => {
  beforeEach(() => {
    api.get.mockReset();
    api.delete.mockReset();
    api.patch.mockReset();
    api.post.mockReset();
  });

  it("chama o endpoint de resumo financeiro por mes", () => {
    getFinancialOverview("2026-06", "month");

    expect(api.get).toHaveBeenCalledWith("/financial-overview", {
      params: { month: "2026-06" },
    });
  });

  it("chama o endpoint de resumo financeiro por ano sem enviar month", () => {
    getFinancialOverview("2026", "year");

    expect(api.get).toHaveBeenCalledWith("/financial-overview", {
      params: { year: "2026" },
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

  it("envia o motivo ao desfazer o pagamento de uma despesa", () => {
    unpayClinicExpense(102, { reason: "Pagamento registrado em duplicidade" });

    expect(api.patch).toHaveBeenCalledWith("/clinic-expenses/102/unpay", {
      reason: "Pagamento registrado em duplicidade",
    });
  });

  it("exclui uma despesa sem enviar motivo ou outro payload", () => {
    deleteClinicExpense(101);

    expect(api.delete).toHaveBeenCalledWith("/clinic-expenses/101");
  });

  it("cadastra e paga uma despesa pelo comando atômico, sem segunda chamada de baixa", () => {
    const payload = { name: "Energia", payment: { paid_at: "2026-08-12", paid_amount_cents: 32050 } };
    createClinicExpenseWithPayment(payload);
    expect(api.post).toHaveBeenCalledWith("/clinic-expenses/with-payment", payload);
    expect(api.patch).not.toHaveBeenCalled();
  });

  it("envia Idempotency-Key ao criar recebimento", () => {
    createFinancialPayment({ amount_cents: 12000 }, "payment-attempt-1234");

    expect(api.post).toHaveBeenCalledWith(
      "/financial-payments",
      { amount_cents: 12000 },
      { headers: { "Idempotency-Key": "payment-attempt-1234" } },
    );
  });
});
