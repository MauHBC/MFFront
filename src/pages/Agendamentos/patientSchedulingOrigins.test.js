import { normalizeReplacementCredit, partitionPatientOrigins } from "./patientSchedulingOrigins";

const now = new Date("2026-06-30T15:00:00Z");
const pkg = { id: 7, quantity: 10, purchased_free_rights: 2, free_rights: 3, review_token: "review", service: { id: 40, name: "Pilates" } };
const credit = { id: 9, patient_id: 20, status: "pending", expires_at: "2026-06-30", package_unit_id: 70 };
test("uses backend ordinary balance without counting replacement units twice", () => {
 const result = partitionPatientOrigins([pkg, { ...pkg, id: 8, purchased_free_rights: 0 }], [credit], 20, now);
 expect(result.options).toEqual([{ ...pkg, free_rights: 2 }]); expect(result.replacements).toHaveLength(1);
});
test.each([{ ...credit, status: "used" }, { ...credit, status: "expired" }, { ...credit, status: "canceled" }, { ...credit, expires_at: "2026-06-29" }, { ...credit, used_session_id: 55 }])("excludes ineligible replacement %o", (item) => {
 expect(partitionPatientOrigins([], [item], 20, now).replacements).toEqual([]);
});
test.each([{ ...credit, patient_id: 21 }, { ...credit, expires_at: "2026-02-30" }, { ...credit, status: "unknown" }])("invalid owner or metadata fails closed: %o", (item) => {
 expect(() => partitionPatientOrigins([], [item], 20, now)).toThrow();
});
test("missing ordinary contract cannot be guessed by subtracting credits", () => {
 expect(() => partitionPatientOrigins([{ ...pkg, purchased_free_rights: undefined }], [credit], 20, now)).toThrow();
 expect(() => partitionPatientOrigins([], [credit, credit], 20, now)).toThrow();
});
test("normalizes actual source service and monthly cycle while preserving pending-center metadata", () => {
 expect(normalizeReplacementCredit({ ...credit, sourceSession: { service_id: 40, billing_mode: "covered_by_plan", Service: { name: "Pilates", code: "pilates" }, BillingCycle: { cycle_start: "2026-06-01", cycle_end: "2026-06-30" } } })).toMatchObject({ source_service_id: 40, source_service_name: "Pilates", source_billing_mode: "covered_by_plan", source_billing_cycle_end: "2026-06-30" });
 expect(normalizeReplacementCredit(credit, { source_billing_cycle_end: "2026-06-30" })).toHaveProperty("source_billing_cycle_end", "2026-06-30");
});

test("expiry compares clinic civil day near UTC midnight in every process timezone", () => {
 expect(partitionPatientOrigins([], [{ ...credit, expires_at: "2026-06-30" }], 20, new Date("2026-07-01T01:00:00Z")).replacements).toHaveLength(1);
 expect(partitionPatientOrigins([], [{ ...credit, expires_at: "2026-06-30" }], 20, new Date("2026-07-01T03:00:00Z")).replacements).toHaveLength(0);
});

test("explicit null cycle from backend clears older pending-center metadata", () => {
 expect(normalizeReplacementCredit({ ...credit, source_billing_cycle_start: null, source_billing_cycle_end: null }, { source_billing_cycle_start: "2026-06-01", source_billing_cycle_end: "2026-06-30" })).toMatchObject({ source_billing_cycle_start: null, source_billing_cycle_end: null });
});
