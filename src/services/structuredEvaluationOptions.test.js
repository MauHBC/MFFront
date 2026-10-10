import { resolveStructuredMultiSelection, structuredMultiSelectionForEditor } from "./structuredEvaluationOptions";

const options = [{ id: 12, value: "A", label: "Textual" }, { id: 22, value: "12", label: "Numeric code" }];
const block = { config: { options } };

test.each([
  [null, ["12"], ["22"]], [null, ["A"], ["12"]],
  [null, [12], ["22"]], [null, "A", ["12"]],
  ["option_ids_v1", [12], ["12"]], ["option_ids_v1", [22], ["22"]],
])("resolves selections according to explicit encoding %s and codes %j", (encoding, saved, expected) => {
  expect(structuredMultiSelectionForEditor(block, [{ value_json: saved }], encoding)).toEqual(expected);
});
test("explicit relational option IDs keep their meaning without a JSON marker", () => {
  expect(structuredMultiSelectionForEditor(block, [{ option_id: 22 }], null)).toEqual(["22"]);
});
test.each([["unknown"], [null], [{}], ["22"]])("does not infer IDs or discard unknown historical selections %j", (code) => {
  expect(() => resolveStructuredMultiSelection(options, [code], null)).toThrow(/interpretar/);
});
test("rejects duplicate historical codes and unknown future encodings", () => {
  expect(() => resolveStructuredMultiSelection([...options, { id: 32, value: "A" }], ["A"], null)).toThrow(/interpretar/);
  expect(() => resolveStructuredMultiSelection(options, [12], "unknown_v2")).toThrow(/interpretar/);
});
