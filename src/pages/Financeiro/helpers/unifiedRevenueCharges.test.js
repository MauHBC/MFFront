import { mergeUnifiedRevenueSummaries } from "./unifiedRevenueCharges";

const patient = (id, extra = {}) => ({ patient_id: id, patient_name: `Paciente ${id}`,
  total: 1000, received: 200, pending: 800, entries_count: 1, overdue_cents: 0,
  reference_date: "2026-09-10", due_date: null, ...extra });
const projection = (patients, professionals = []) => ({
  origin: "all", month: "2026-09", professionals, patients,
  summary: patients.reduce((sum, row) => ({ total: sum.total + row.total,
    received: sum.received + row.received, pending: sum.pending + row.pending }),
  { total: 0, received: 0, pending: 0 }),
});

test("combina pacientes mistos, conserva exclusivos e datas sem alterar as respostas", () => {
  const first = projection([patient(1), patient(2)], [{ id: 8 }]);
  const second = projection([patient(1, { total: 2000, received: 1000, pending: 1000,
    overdue_cents: 1000, reference_date: "2026-09-01", due_date: "2026-09-05" }), patient(3)],
  [{ id: 8 }, { id: 9 }]);
  const original = JSON.stringify([first, second]);
  const merged = mergeUnifiedRevenueSummaries([first, second], "2026-09");
  expect(merged.summary).toEqual({ total: 5000, received: 1600, pending: 3400 });
  expect(merged.patients.map((row) => row.patient_id)).toEqual([1, 2, 3]);
  expect(merged.patients[0]).toMatchObject({ total: 3000, received: 1200, pending: 1800,
    entries_count: 2, overdue_cents: 1000, reference_date: "2026-09-01", due_date: "2026-09-05" });
  expect(merged.professionals.map((row) => row.id)).toEqual([8, 9]);
  expect(JSON.stringify([first, second])).toBe(original);
});

test("nenhum tipo entrega resumo vazio; uma projeção preserva o contrato integral", () => {
  expect(mergeUnifiedRevenueSummaries([], "2026-09")).toEqual({ origin: "all", month: "2026-09",
    summary: { total: 0, received: 0, pending: 0 }, patients: [], professionals: [] });
  const payload = { ...projection([patient(1)]), creditAvailable: 500 };
  expect(mergeUnifiedRevenueSummaries([payload], "2026-09")).toBe(payload);
});

test("resposta inválida em qualquer tipo impede apresentar resumo parcial", () => {
  expect(() => mergeUnifiedRevenueSummaries([projection([patient(1)]),
    projection([patient(2, { total: -1 })])], "2026-09"))
    .toThrow("Não foi possível conferir os valores do resumo de receitas.");
});
