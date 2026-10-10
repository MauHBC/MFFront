const unresolved = () => {
  const error = new Error("Não foi possível interpretar a seleção salva. Revise as opções do formulário antes de editar ou assinar. O registro não foi alterado.");
  error.code = "STRUCTURED_EVALUATION_OPTIONS_UNRESOLVED";
  return error;
};

// Without a marker, JSON selections are historical option codes, never inferred IDs.
export const resolveStructuredMultiSelection = (options, values, encoding) => {
  const codes = encoding == null && ["string", "number"].includes(typeof values) ? [values] : values;
  if (!Array.isArray(codes) || !Array.isArray(options)
    || (encoding != null && encoding !== "option_ids_v1")) throw unresolved();
  const selected = codes.map((value) => {
    if (!["string", "number"].includes(typeof value)) throw unresolved();
    const matches = options.filter((option) => (
      encoding === "option_ids_v1"
        ? String(option.id) === String(value)
        : option.value != null && String(option.value) === String(value)
    ));
    if (matches.length !== 1 || !Number.isSafeInteger(Number(matches[0].id))
      || Number(matches[0].id) <= 0) throw unresolved();
    return String(matches[0].id);
  });
  return [...new Set(selected)];
};

export const structuredMultiSelectionForEditor = (block, answers, encoding) => {
  const first = answers[0];
  if (!first) return [];
  if (first.value_json != null) {
    return resolveStructuredMultiSelection(block.config?.options, first.value_json, encoding);
  }
  const ids = answers.map((answer) => answer.option_id).filter((id) => id != null);
  return resolveStructuredMultiSelection(block.config?.options, ids, "option_ids_v1");
};
