export const CLINICAL_VERSION_CONFLICT_MESSAGE =
  "Este registro foi alterado em outra tela ou sessão. Recarregue a página, confira as alterações e tente novamente. Nenhuma alteração concorrente foi sobrescrita.";

export const getClinicalRecordSaveErrorMessage = (error, fallback) => {
  const code = error?.response?.data?.error || error?.code;
  if (code === "CLINICAL_VERSION_CONFLICT") {
    return CLINICAL_VERSION_CONFLICT_MESSAGE;
  }
  if (code === "INCOMPLETE_PROFESSIONAL_IDENTITY") {
    return "Complete o nome profissional e o CREFITO na Equipe e solicite uma nova conferência administrativa antes de assinar.";
  }
  if (code === "VERIFIED_PROFESSIONAL_IDENTITY_REQUIRED") {
    return "A identidade profissional precisa ser conferida administrativamente antes da assinatura.";
  }
  return code || fallback;
};

export const getSavedClinicalRecordVersion = (record) => {
  const version = Number(record?.version);
  if (!Number.isSafeInteger(version) || version < 1) {
    const error = new Error("INVALID_CLINICAL_RECORD_SAVE_RESPONSE");
    error.code = "INVALID_CLINICAL_RECORD_SAVE_RESPONSE";
    throw error;
  }
  return version;
};

export const upsertSavedClinicalRecord = (records, savedRecord) => {
  if (!savedRecord?.id) return records;
  const current = Array.isArray(records) ? records : [];
  const found = current.some((record) => Number(record.id) === Number(savedRecord.id));
  if (!found) return [savedRecord, ...current];
  return current.map((record) => (
    Number(record.id) === Number(savedRecord.id)
      ? { ...record, ...savedRecord }
      : record
  ));
};

export const saveClinicalRecordFlow = async ({
  saveDraft,
  finalizeDraft,
  shouldSign,
}) => {
  const saved = await saveDraft();
  const version = getSavedClinicalRecordVersion(saved);
  if (!shouldSign) return { saved, version, finalized: null };

  const recordId = Number(saved?.id);
  if (!Number.isSafeInteger(recordId)) {
    const error = new Error("INVALID_CLINICAL_RECORD_SAVE_RESPONSE");
    error.code = "INVALID_CLINICAL_RECORD_SAVE_RESPONSE";
    throw error;
  }
  const finalized = await finalizeDraft({ recordId, version });
  return { saved, version, finalized };
};
