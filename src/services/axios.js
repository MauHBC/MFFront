import axios from "axios";
import { toast } from "react-toastify";
import * as authActions from "../store/modules/auth/actions";

const api = axios.create({
  // testes locais
  // baseURL: "http://localhost:3006/api",

  // producao
  baseURL: "/api",
});

let responseInterceptorId = null;
let isHandlingUnauthorized = false;
let isToastErrorPatched = false;
let suppressErrorToastsUntil = 0;
const AUTH_TOAST_SUPPRESSION_MS = 2000;
const GENERIC_OPERATION_ERROR_MESSAGE =
  "Nao foi possivel concluir a operacao. Tente novamente em instantes.";
const TECHNICAL_ERROR_PATTERNS = [
  /sqlstate/i,
  /insert into/i,
  /update [`'"]/i,
  /delete from/i,
  /column ['"`]/i,
  /conn=/i,
  /traceback/i,
  /stack trace/i,
  /sequelize/i,
  /mariadb/i,
  /mysql/i,
  /not-?null/i,
  /foreign key/i,
  /duplicate (entry|key)/i,
];

function normalizeToastMessage(content) {
  if (typeof content === "string") return content.toLowerCase();
  if (content === null || content === undefined) return "";
  return String(content).toLowerCase();
}

function isAuthRelatedToast(content) {
  const message = normalizeToastMessage(content);
  return (
    message.includes("sess") ||
    message.includes("login novamente") ||
    message.includes("fazer login")
  );
}

function shouldSuppressErrorToast(content) {
  if (Date.now() >= suppressErrorToastsUntil) return false;
  return !isAuthRelatedToast(content);
}

function suppressRequestErrorToasts() {
  suppressErrorToastsUntil = Date.now() + AUTH_TOAST_SUPPRESSION_MS;
}

export function sanitizeUserFacingErrorMessage(
  message,
  fallback = GENERIC_OPERATION_ERROR_MESSAGE,
) {
  const normalizedMessage = String(message || "").trim();
  if (!normalizedMessage) return fallback;

  const isTechnicalMessage = TECHNICAL_ERROR_PATTERNS.some((pattern) =>
    pattern.test(normalizedMessage),
  );

  if (isTechnicalMessage) {
    return fallback;
  }

  return normalizedMessage;
}

function getRawApiErrorMessage(error) {
  const apiErrors = error?.response?.data?.errors;
  if (Array.isArray(apiErrors) && apiErrors.length > 0) return apiErrors[0];
  return error?.response?.data?.error || error?.response?.data?.message || "";
}

export function getUserFacingApiError(
  error,
  fallback = GENERIC_OPERATION_ERROR_MESSAGE,
) {
  return sanitizeUserFacingErrorMessage(getRawApiErrorMessage(error), fallback);
}

function patchToastError() {
  if (isToastErrorPatched) return;

  const originalToastError = toast.error.bind(toast);

  toast.error = (content, options) => {
    const sanitizedContent =
      typeof content === "string"
        ? sanitizeUserFacingErrorMessage(content, GENERIC_OPERATION_ERROR_MESSAGE)
        : content;

    if (shouldSuppressErrorToast(sanitizedContent)) {
      return null;
    }

    return originalToastError(sanitizedContent, options);
  };

  isToastErrorPatched = true;
}

function isLoginRequest(url = "") {
  return /\/tokens\/?$/.test(url);
}

function getAuthMessage(error) {
  return getRawApiErrorMessage(error);
}

export function setupAxiosInterceptors({ store, persistor, history }) {
  if (responseInterceptorId !== null) return;

  patchToastError();

  responseInterceptorId = api.interceptors.response.use(
    (response) => response,
    async (error) => {
      const status = error?.response?.status;
      const requestUrl = error?.config?.url || "";
      const authMessage = getAuthMessage(error);
      const shouldHandleUnauthorized =
        status === 401 &&
        !isLoginRequest(requestUrl) &&
        (!!api.defaults.headers.Authorization ||
          authMessage === "Login required" ||
          authMessage === "Token esperado ou invalido");

      if (!shouldHandleUnauthorized) {
        return Promise.reject(error);
      }

      suppressRequestErrorToasts();

      if (isHandlingUnauthorized) {
        return Promise.reject(error);
      }

      isHandlingUnauthorized = true;

      try {
        store.dispatch(authActions.loginFailure());
        await persistor.purge();
        toast.error("Sua sessão expirou. Faca login novamente.");
        history.push("/login");
      } finally {
        isHandlingUnauthorized = false;
      }

      return Promise.reject(error);
    },
  );
}

export default api;
