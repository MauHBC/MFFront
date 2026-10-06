import creationCommand from "./creationCommand";

test.each([false, true])("own right always schedules one unit despite stale repeat=%s and later drafts", (repeat) => {
  expect(creationCommand({ ready: true, origin: "own", own: true, packageId: 7, repeat, later: true })).toBe("/sessions");
});
test("shared right cannot become a purchase or series through timing or recurrence", () => {
  expect(creationCommand({ ready: true, origin: "shared", sharing: true, repeat: true, later: true })).toBe("/sessions");
});
test.each([
  { ready: false, origin: "new" },
  { ready: true, origin: "" },
  { ready: true, origin: "new", own: true, packageId: 7 },
  { ready: true, origin: "new", sharing: true },
  { ready: true, origin: "own", own: true },
  { ready: true, origin: "shared", sharing: false },
])("unresolved or inconsistent origin fails closed: %o", (draft) => {
  expect(creationCommand(draft)).toBeNull();
});
test("only an explicit new origin can choose deferred or integral scheduled purchase", () => {
  expect(creationCommand({ ready: true, origin: "new", later: true, repeat: true })).toBe("/package-purchases");
  expect(creationCommand({ ready: true, origin: "new", repeat: true })).toBe("/session-series");
  expect(creationCommand({ ready: true, origin: "new" })).toBe("/sessions");
});
