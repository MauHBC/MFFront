export const AUTOMATIC_INFORMATION = Object.freeze([
  Object.freeze({
    canonical: "{{patient_name}}",
    editorText: "[Nome do paciente]",
    label: "Nome do paciente",
  }),
  Object.freeze({
    canonical: "{{clinic_name}}",
    editorText: "[Nome da clínica]",
    label: "Nome da clínica",
  }),
  Object.freeze({
    canonical: "{{session_date}}",
    editorText: "[Data do atendimento]",
    label: "Data do atendimento",
  }),
  Object.freeze({
    canonical: "{{start_time}}",
    editorText: "[Horário inicial]",
    label: "Horário inicial",
  }),
  Object.freeze({
    canonical: "{{end_time}}",
    editorText: "[Horário final]",
    label: "Horário final",
  }),
]);

const replaceAll = (value, source, replacement) => value.split(source).join(replacement);
const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const AUTOMATIC_INFORMATION_EDITOR_TEXTS = new Set(
  AUTOMATIC_INFORMATION.map(({ editorText }) => editorText),
);
const AUTOMATIC_INFORMATION_EDITOR_PATTERN = new RegExp(
  `(${AUTOMATIC_INFORMATION.map(({ editorText }) => escapeRegExp(editorText)).join("|")})`,
  "g",
);

export const toDocumentTemplateEditorText = (bodyText = "") => (
  AUTOMATIC_INFORMATION.reduce(
    (text, information) => replaceAll(text, information.canonical, information.editorText),
    String(bodyText),
  )
);

export const toCanonicalDocumentTemplateText = (editorText = "") => (
  AUTOMATIC_INFORMATION.reduce(
    (text, information) => replaceAll(text, information.editorText, information.canonical),
    String(editorText),
  )
);

export const getDocumentTemplateEditorSegments = (editorText = "") => {
  let start = 0;
  return String(editorText)
    .split(AUTOMATIC_INFORMATION_EDITOR_PATTERN)
    .filter(Boolean)
    .map((text) => {
      const segment = {
        text,
        start,
        isAutomaticInformation: AUTOMATIC_INFORMATION_EDITOR_TEXTS.has(text),
      };
      start += text.length;
      return segment;
    });
};
