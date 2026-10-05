import { formatClinicExpenseStatus, getClinicExpenseStatus } from "./expenseStatus";

describe("expenseStatus", () => {
  it("exibe labels amigaveis", () => {
    expect(formatClinicExpenseStatus("paid")).toBe("Pago");
    expect(formatClinicExpenseStatus("pending")).toBe("Pendente");
    expect(formatClinicExpenseStatus("open")).toBe("Pendente");
    expect(formatClinicExpenseStatus("overdue")).toBe("Pendente");
  });

  it("prioriza status e pagamento existente", () => {
    expect(getClinicExpenseStatus({ status: "paid", due_date: "2020-01-01" })).toBe("paid");
    expect(getClinicExpenseStatus({ paid_at: "2026-06-05T12:00:00.000Z", due_date: "2020-01-01" })).toBe("paid");
  });

  it("calcula vencido, hoje e futuro sem deslocar data", () => {
    const now = new Date("2027-01-01T01:30:00.000Z");
    const today = "2026-12-31";
    const past = "2026-12-30";
    const future = "2027-01-01";

    expect(getClinicExpenseStatus({ due_date: past }, now)).toBe("overdue");
    expect(getClinicExpenseStatus({ due_date: today }, now)).toBe("pending");
    expect(getClinicExpenseStatus({ due_date: future }, now)).toBe("pending");
  });
});
