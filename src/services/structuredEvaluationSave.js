import api from "./axios";

export const structuredEvaluationSaveMessage = (error) => {
  const code = error?.response?.data?.code || error?.response?.data?.error;
  if (code === "IDEMPOTENCY_CONFLICT") {
    return "Esta tentativa já corresponde a outra versão. Abra o rascunho salvo e confira os dados antes de continuar.";
  }
  if (code === "STRUCTURED_EVALUATION_INCOMPLETE") {
    return "Preencha as respostas obrigatórias antes de assinar a avaliação.";
  }
  if (code === "STRUCTURED_EVALUATION_OPTIONS_UNRESOLVED") {
    return "Não foi possível interpretar a seleção salva. Revise as opções do formulário antes de editar ou assinar. O registro não foi alterado.";
  }
  if (code === "CLINICAL_VERSION_CONFLICT") {
    return "Este rascunho foi alterado em outra sessão. Recarregue e confira as alterações antes de salvar novamente.";
  }
  if (["CLINICAL_DRAFT_REQUIRED", "CLINICAL_RECORD_STATE_CONFLICT"].includes(code)) {
    return "Este registro já foi concluído ou está indisponível para edição. Recarregue para conferir seu estado.";
  }
  if (error?.savedRecord) {
    return "O rascunho foi salvo, mas a assinatura não foi confirmada. Abra o rascunho para conferir e tentar novamente.";
  }
  return "Não foi possível confirmar o salvamento. Seus dados continuam nesta tela. Tente novamente para conferir a mesma tentativa.";
};

// One attempt per mounted editor. Concurrent clicks share the same promise and key.
// The caller retains this object in a ref, and retains its fields until confirmation.
export const createStructuredEvaluationSaveKey = () => (
  globalThis.crypto?.randomUUID
    ? globalThis.crypto.randomUUID()
    : `evaluation-${Date.now()}-${Math.random().toString(36).slice(2)}`
);

export const normalizeStructuredEvaluationAnswers = (answers) => answers.map((answer) => ({
  ...answer,
  form_question_id: Number(answer.form_question_id),
  ...(answer.option_id == null ? {} : { option_id: Number(answer.option_id) }),
}));
const contentKey = ({ evaluation, forms }) => JSON.stringify({ evaluation, forms });

export const createStructuredEvaluationSaveAttempt = ({ key, recordId, client = api }) => {
  let inFlight = null;
  let originalPayload = null;
  let savedRecord = null;
  const save = ({ evaluation, forms, version, shouldSign = false }) => {
    if (inFlight) return inFlight;
    const nextPayload = JSON.stringify({ evaluation, forms, ...(version ? { version } : {}) });
    const sameContent = !originalPayload || contentKey({ evaluation, forms }) === contentKey(JSON.parse(originalPayload));
    if (originalPayload && (!sameContent || (!savedRecord && originalPayload !== nextPayload))) {
      const error = new Error("IDEMPOTENCY_CONFLICT");
      error.response = { data: { code: "IDEMPOTENCY_CONFLICT" } };
      return Promise.reject(error);
    }
    if (!originalPayload) originalPayload = nextPayload;
    inFlight = (async () => {
      try {
        if (!savedRecord) {
          const method = recordId ? "put" : "post";
          const url = recordId ? `/evaluations/${recordId}/structured` : "/evaluations/structured";
          const response = await client[method](url, {
            ...JSON.parse(originalPayload), idempotency_key: key,
          });
          savedRecord = response.data;
          if (!Number.isSafeInteger(Number(savedRecord?.id))
            || Number(savedRecord?.id) <= 0
            || !Number.isSafeInteger(Number(savedRecord?.version))
            || Number(savedRecord?.version) <= 0
            || !["draft", "finalized"].includes(savedRecord?.clinical_state)) {
            savedRecord = null;
            throw new Error("INVALID_CLINICAL_RECORD_SAVE_RESPONSE");
          }
        }
        if (savedRecord.clinical_state === "finalized") {
          return { saved: savedRecord, finalized: savedRecord };
        }
        if (!shouldSign) return { saved: savedRecord, finalized: null };
        const response = await client.post(
          `/clinical-records/evaluation/${savedRecord.id}/finalize`,
          { version: savedRecord.version },
          { headers: { "Idempotency-Key": `sign-${key}` } },
        );
        if (response.data?.clinical_state !== "finalized"
          || Number(response.data?.id) !== Number(savedRecord.id)
          || !Number.isSafeInteger(Number(response.data?.version))
          || Number(response.data.version) <= Number(savedRecord.version)) {
          throw new Error("INVALID_CLINICAL_RECORD_FINALIZATION_RESPONSE");
        }
        const draft = savedRecord;
        savedRecord = response.data;
        return { saved: draft, finalized: savedRecord };
      } catch (error) {
        if (savedRecord) error.savedRecord = savedRecord;
        else if ([400, 403, 404].includes(error?.response?.status)) originalPayload = null;
        throw error;
      } finally {
        inFlight = null;
      }
    })();
    return inFlight;
  };
  const hasSameContent = ({ evaluation, forms }) => !originalPayload
    || contentKey({ evaluation, forms }) === contentKey(JSON.parse(originalPayload));
  return { save, getSavedRecord: () => savedRecord, hasSameContent };
};

// Only an opaque retry key is retained across reload; clinical fields stay in the editor.
export const structuredEvaluationPendingKey = (patientId, create = false) => {
  const storageKey = `motria:structured-evaluation:new:${patientId}`;
  try {
    const pending = sessionStorage.getItem(storageKey);
    if (pending && /^[A-Za-z0-9_-]{8,100}$/.test(pending)) return pending;
    if (!create) return null;
    const key = createStructuredEvaluationSaveKey();
    sessionStorage.setItem(storageKey, key);
    return key;
  } catch {
    return create ? createStructuredEvaluationSaveKey() : null;
  }
};

export const clearStructuredEvaluationPendingKey = (patientId) => {
  try { sessionStorage.removeItem(`motria:structured-evaluation:new:${patientId}`); } catch { /* Storage may be disabled. */ }
};
