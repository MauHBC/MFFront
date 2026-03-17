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

function isLoginRequest(url = "") {
  return /\/tokens\/?$/.test(url);
}

function getAuthMessage(error) {
  const apiErrors = error?.response?.data?.errors;
  if (Array.isArray(apiErrors) && apiErrors.length > 0) return apiErrors[0];
  return error?.response?.data?.error || "";
}

export function setupAxiosInterceptors({ store, persistor, history }) {
  if (responseInterceptorId !== null) return;

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

      if (isHandlingUnauthorized) {
        return Promise.reject(error);
      }

      isHandlingUnauthorized = true;

      try {
        store.dispatch(authActions.loginFailure());
        await persistor.purge();
        toast.error("Sua sessao expirou. Faca login novamente.");
        history.push("/login");
      } finally {
        isHandlingUnauthorized = false;
      }

      return Promise.reject(error);
    },
  );
}

export default api;
