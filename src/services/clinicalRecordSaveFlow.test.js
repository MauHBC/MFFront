import {
  CLINICAL_VERSION_CONFLICT_MESSAGE,
  getClinicalRecordSaveErrorMessage,
  saveClinicalRecordFlow,
  upsertSavedClinicalRecord,
} from "./clinicalRecordSaveFlow";

describe("clinicalRecordSaveFlow", () => {
  test("mantém o rascunho editável e não finaliza", async () => {
    const finalizeDraft = jest.fn();
    const result = await saveClinicalRecordFlow({
      saveDraft: jest.fn().mockResolvedValue({ id: 29, version: 2, clinical_state: "draft" }),
      finalizeDraft,
      shouldSign: false,
    });

    expect(result.saved.clinical_state).toBe("draft");
    expect(result.version).toBe(2);
    expect(finalizeDraft).not.toHaveBeenCalled();
  });

  test("usa na assinatura a versão devolvida pelo salvamento", async () => {
    const calls = [];
    const finalizeDraft = jest.fn(async ({ recordId, version }) => {
      calls.push(`finalize:${recordId}:${version}`);
      return { id: recordId, version: version + 1, clinical_state: "finalized" };
    });
    const result = await saveClinicalRecordFlow({
      saveDraft: async () => {
        calls.push("save:1");
        return { id: 29, version: 2, clinical_state: "draft" };
      },
      finalizeDraft,
      shouldSign: true,
    });

    expect(calls).toEqual(["save:1", "finalize:29:2"]);
    expect(finalizeDraft).toHaveBeenCalledWith({ recordId: 29, version: 2 });
    expect(result.finalized).toMatchObject({ version: 3, clinical_state: "finalized" });
  });

  test("substitui imediatamente a versão antiga no estado", () => {
    const current = [{ id: 29, version: 1, clinical_state: "draft", summary_text: "Antes" }];
    const next = upsertSavedClinicalRecord(current, {
      id: 29,
      version: 2,
      clinical_state: "draft",
      summary_text: "Depois",
    });

    expect(next).toEqual([expect.objectContaining({ id: 29, version: 2, summary_text: "Depois" })]);
    expect(current[0].version).toBe(1);
  });

  test("não finaliza, sobrescreve ou tenta novamente após conflito real no PUT", async () => {
    const conflict = { response: { data: { error: "CLINICAL_VERSION_CONFLICT" }, status: 409 } };
    const saveDraft = jest.fn().mockRejectedValue(conflict);
    const finalizeDraft = jest.fn();

    await expect(saveClinicalRecordFlow({
      saveDraft,
      finalizeDraft,
      shouldSign: true,
    })).rejects.toBe(conflict);
    expect(saveDraft).toHaveBeenCalledTimes(1);
    expect(finalizeDraft).not.toHaveBeenCalled();
    expect(getClinicalRecordSaveErrorMessage(conflict, "Falha")).toBe(
      CLINICAL_VERSION_CONFLICT_MESSAGE,
    );
  });

  test("não repete PUT nem finalização quando a concorrência muda antes de assinar", async () => {
    const conflict = { response: { data: { error: "CLINICAL_VERSION_CONFLICT" }, status: 409 } };
    const saveDraft = jest.fn().mockResolvedValue({ id: 29, version: 2 });
    const finalizeDraft = jest.fn().mockRejectedValue(conflict);

    await expect(saveClinicalRecordFlow({
      saveDraft,
      finalizeDraft,
      shouldSign: true,
    })).rejects.toBe(conflict);
    expect(saveDraft).toHaveBeenCalledTimes(1);
    expect(finalizeDraft).toHaveBeenCalledTimes(1);
    expect(finalizeDraft).toHaveBeenCalledWith({ recordId: 29, version: 2 });
  });

  test("orienta a completar a identidade sem expor o código técnico", () => {
    const error = {
      response: { data: { error: "INCOMPLETE_PROFESSIONAL_IDENTITY" }, status: 403 },
    };
    expect(getClinicalRecordSaveErrorMessage(error, "Falha")).toContain(
      "Complete o nome profissional",
    );
    expect(getClinicalRecordSaveErrorMessage(error, "Falha")).not.toContain(
      "INCOMPLETE_PROFESSIONAL_IDENTITY",
    );
  });
});
