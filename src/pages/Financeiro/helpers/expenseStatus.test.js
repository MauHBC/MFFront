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
    const now = new Date();
    const today = [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, "0"),
      String(now.getDate()).padStart(2, "0"),
    ].join("-");
    const past = `${now.getFullYear() - 1}${today.slice(4)}`;
    const future = `${now.getFullYear() + 1}${today.slice(4)}`;

    expect(getClinicExpenseStatus({ due_date: past })).toBe("overdue");
    expect(getClinicExpenseStatus({ due_date: today })).toBe("pending");
    expect(getClinicExpenseStatus({ due_date: future })).toBe("pending");
  });
});
