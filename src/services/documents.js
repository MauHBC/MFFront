import api, { getUserFacingApiError } from "./axios";

export const ATTENDANCE_DECLARATION = "attendance_declaration";

const DOCUMENT_ERROR_MESSAGES = Object.freeze({
  CLINICAL_ACCESS_DENIED: "Você não tem autorização para realizar esta operação.",
  CLINICAL_RESOURCE_NOT_FOUND: "O paciente ou atendimento não está disponível para seu acesso.",
  DOCUMENT_CONTEXT_NOT_FOUND: "Não foi possível localizar todos os dados necessários do documento.",
  DOCUMENT_INTEGRITY_CHECK_FAILED: "A integridade deste documento não pôde ser confirmada.",
  DOCUMENT_ISSUANCE_NOT_FOUND: "Documento não encontrado ou indisponível para seu acesso.",
  DOCUMENT_OPERATION_FAILED: "Não foi possível concluir a operação com o documento.",
  DOCUMENT_TEMPLATE_ADMIN_REQUIRED: "Somente administradores podem gerenciar modelos de documentos.",
  DOCUMENT_TEMPLATE_ARCHIVED: "Este modelo está arquivado e não pode mais ser alterado.",
  DOCUMENT_TEMPLATE_NOT_FOUND: "Modelo de documento não encontrado.",
  DOCUMENT_TEMPLATE_REQUIRED: "Escolha um modelo para continuar.",
  IDEMPOTENCY_KEY_CONFLICT: "Esta confirmação já foi usada com dados diferentes.",
  INVALID_DOCUMENT_FINAL_TEXT: "Revise o texto final do documento.",
  INVALID_DOCUMENT_TITLE: "Informe um título válido para o documento.",
  INVALID_DOCUMENT_PLACEHOLDER:
    "O modelo contém uma informação automática inválida ou incompleta.",
  INVALID_TEMPLATE_BODY: "Informe um texto válido para o modelo.",
  INVALID_TEMPLATE_NAME: "Informe um nome válido para o modelo.",
  SESSION_NOT_ELIGIBLE_FOR_DOCUMENT:
    "O atendimento não está mais elegível para emitir este documento.",
  SESSION_NOT_FOUND: "Atendimento não encontrado ou indisponível para seu acesso.",
  SESSION_SCHEDULE_INCOMPLETE: "O atendimento não possui horários completos.",
  UNKNOWN_DOCUMENT_FIELD: "A operação contém um campo que não é aceito.",
  UNSUPPORTED_DOCUMENT_TYPE: "Este tipo de documento ainda não está disponível.",
});

const unwrapData = (response) => response?.data?.data ?? response?.data;

export const listDocumentTemplates = ({ includeArchived = false } = {}) => api
  .get("/document-templates", {
    params: includeArchived ? { include_archived: true } : undefined,
  })
  .then(unwrapData);

export const listIssuanceDocumentTemplates = (
  documentType = ATTENDANCE_DECLARATION,
) => api
  .get("/documents/templates", {
    params: { document_type: documentType },
  })
  .then(unwrapData);

export const createDocumentTemplate = (payload) => api
  .post("/document-templates", payload)
  .then(unwrapData);

export const updateDocumentTemplate = (templateId, payload) => api
  .put(`/document-templates/${templateId}`, payload)
  .then(unwrapData);

export const duplicateDocumentTemplate = (templateId, payload = {}) => api
  .post(`/document-templates/${templateId}/duplicate`, payload)
  .then(unwrapData);

export const activateDocumentTemplate = (templateId) => api
  .post(`/document-templates/${templateId}/activate`)
  .then(unwrapData);

export const deactivateDocumentTemplate = (templateId) => api
  .post(`/document-templates/${templateId}/deactivate`)
  .then(unwrapData);

export const archiveDocumentTemplate = (templateId) => api
  .post(`/document-templates/${templateId}/archive`)
  .then(unwrapData);

export const listEligibleDocumentSessions = (patientId, { limit, date } = {}) => {
  const params = { document_type: ATTENDANCE_DECLARATION };
  if (limit !== undefined) params.limit = limit;
  if (date) params.date = date;

  return api
    .get(`/patients/${patientId}/documents/eligible-sessions`, { params })
    .then(unwrapData);
};

export const listPatientDocuments = (patientId) => api
  .get(`/patients/${patientId}/documents`)
  .then(unwrapData);

export const previewAttendanceDeclaration = (payload) => api
  .post("/documents/attendance-declarations/preview", payload)
  .then(unwrapData);

function readBlobText(blob) {
  if (typeof blob?.text === "function") return blob.text();
  if (typeof FileReader === "undefined") return Promise.resolve("");
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(blob);
  });
}

export async function normalizeDocumentError(error) {
  const responseData = error?.response?.data;
  if (!(typeof Blob !== "undefined" && responseData instanceof Blob)) return error;

  let parsedData = {};
  try {
    const text = await readBlobText(responseData);
    parsedData = JSON.parse(text);
  } catch {
    parsedData = { error: "DOCUMENT_OPERATION_FAILED" };
  }
  return {
    ...error,
    response: {
      ...error.response,
      data: parsedData,
    },
  };
}

export async function getDocumentErrorMessage(error, fallback) {
  const normalizedError = await normalizeDocumentError(error);
  const code = normalizedError?.response?.data?.error
    || normalizedError?.response?.data?.message;
  return DOCUMENT_ERROR_MESSAGES[code]
    || getUserFacingApiError(normalizedError, fallback);
}

function requestPdf(config) {
  return api({ ...config, responseType: "blob" }).catch(async (error) => {
    throw await normalizeDocumentError(error);
  });
}

export const issueAttendanceDeclaration = (payload, idempotencyKey) => requestPdf({
  method: "post",
  url: "/documents/attendance-declarations",
  data: payload,
  headers: { "Idempotency-Key": idempotencyKey },
});

export const downloadIssuedDocument = (issuanceId) => requestPdf({
  method: "get",
  url: `/documents/${issuanceId}/download`,
});

function responseHeader(response, name) {
  if (typeof response?.headers?.get === "function") return response.headers.get(name);
  return response?.headers?.[name.toLowerCase()] || response?.headers?.[name] || "";
}

export function parseDownloadFilename(contentDisposition) {
  const value = String(contentDisposition || "");
  const encodedMatch = value.match(/filename\*=UTF-8''([^;]+)/i);
  if (encodedMatch) {
    try {
      return decodeURIComponent(encodedMatch[1]);
    } catch {
      return encodedMatch[1];
    }
  }
  const quotedMatch = value.match(/filename="([^"]+)"/i);
  if (quotedMatch) return quotedMatch[1];
  const plainMatch = value.match(/filename=([^;]+)/i);
  return plainMatch ? plainMatch[1].trim() : "";
}

function safeFilename(value, fallback) {
  const normalized = String(value || "")
    .replace(/[\\/:*?"<>|]/g, "-")
    .trim();
  return normalized || fallback;
}

export function downloadPdfResponse(response, fallbackPrefix = "documento") {
  const contentType = responseHeader(response, "content-type") || response?.data?.type || "";
  if (!String(contentType).toLowerCase().includes("application/pdf")) {
    const error = new Error("INVALID_DOCUMENT_RESPONSE");
    error.response = {
      status: response?.status,
      data: { error: "DOCUMENT_OPERATION_FAILED" },
    };
    throw error;
  }

  const identifier = responseHeader(response, "x-document-identifier");
  const dispositionFilename = parseDownloadFilename(
    responseHeader(response, "content-disposition"),
  );
  const filename = safeFilename(
    dispositionFilename,
    `${fallbackPrefix}-${identifier || "emitido"}.pdf`,
  );
  const blob = response.data instanceof Blob
    ? response.data
    : new Blob([response.data], { type: "application/pdf" });
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(objectUrl);
  return { filename, identifier: identifier || null };
}

export function createDocumentIdempotencyKey() {
  if (globalThis.crypto?.randomUUID) return `document-${globalThis.crypto.randomUUID()}`;
  return `document-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export default {
  activateDocumentTemplate,
  archiveDocumentTemplate,
  createDocumentTemplate,
  deactivateDocumentTemplate,
  downloadIssuedDocument,
  downloadPdfResponse,
  duplicateDocumentTemplate,
  issueAttendanceDeclaration,
  listDocumentTemplates,
  listIssuanceDocumentTemplates,
  listEligibleDocumentSessions,
  listPatientDocuments,
  previewAttendanceDeclaration,
  updateDocumentTemplate,
};
