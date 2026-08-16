import {
  AUTOMATIC_INFORMATION,
  getDocumentTemplateEditorSegments,
  toCanonicalDocumentTemplateText,
  toDocumentTemplateEditorText,
} from "./automaticInformation";

describe("informações automáticas de modelos de documentos", () => {
  it("mantém o mapeamento completo determinístico e reversível", () => {
    const canonicalText = AUTOMATIC_INFORMATION
      .map(({ canonical }, index) => `Trecho ${index + 1}: ${canonical}`)
      .join("\n");
    const editorText = AUTOMATIC_INFORMATION
      .map(({ editorText: information }, index) => `Trecho ${index + 1}: ${information}`)
      .join("\n");

    expect(toDocumentTemplateEditorText(canonicalText)).toBe(editorText);
    expect(toCanonicalDocumentTemplateText(editorText)).toBe(canonicalText);
  });

  it("preserva texto comum e todas as ocorrências ao converter nos dois sentidos", () => {
    const canonicalText = "Olá {{patient_name}}. Clínica: {{clinic_name}}. "
      + "Paciente: {{patient_name}}.";
    const editorText = "Olá [Nome do paciente]. Clínica: [Nome da clínica]. "
      + "Paciente: [Nome do paciente].";

    expect(toDocumentTemplateEditorText(canonicalText)).toBe(editorText);
    expect(toCanonicalDocumentTemplateText(editorText)).toBe(canonicalText);
    expect(toDocumentTemplateEditorText("Texto sem informações automáticas."))
      .toBe("Texto sem informações automáticas.");
  });

  it("separa informações automáticas do texto comum para o destaque visual", () => {
    expect(getDocumentTemplateEditorSegments(
      "Paciente [Nome do paciente] em [Data do atendimento].",
    )).toEqual([
      { text: "Paciente ", start: 0, isAutomaticInformation: false },
      { text: "[Nome do paciente]", start: 9, isAutomaticInformation: true },
      { text: " em ", start: 27, isAutomaticInformation: false },
      { text: "[Data do atendimento]", start: 31, isAutomaticInformation: true },
      { text: ".", start: 52, isAutomaticInformation: false },
    ]);
  });
});
