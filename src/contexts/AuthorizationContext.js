import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import PropTypes from "prop-types";
import { useSelector } from "react-redux";
import { getAuthorizationContext } from "../services/team";

const AuthorizationContext = createContext({
  status: "idle",
  context: null,
  canViewTeam: false,
  canManageProfessionalLifecycle: false,
  canAccessModule: () => false,
  hasCapability: () => false,
  reload: () => {},
});
const TEAM_POWER = "access_profiles.manage";
const AUTHORIZATION_CATALOG_VERSION = 6;
const ACCESS_LEVELS = Object.freeze({ none: 0, view: 1, edit: 2, manage: 3 });
const MODULE_KEYS = Object.freeze([
  "dashboard",
  "schedule",
  "patients",
  "clinical_records",
  "plans",
  "finance",
  "team",
  "settings",
]);

export function isValidAuthorizationContext(context) {
  if (context?.catalog_version !== AUTHORIZATION_CATALOG_VERSION) return false;
  if (!["authorized", "no_permissions"].includes(context?.authorization_state)) return false;
  if (typeof context?.is_administrator !== "boolean") return false;
  if (!Array.isArray(context?.modules) || context.modules.length !== MODULE_KEYS.length) return false;
  const moduleKeys = new Set();
  const validModules = context.modules.every((module) => {
    if (!MODULE_KEYS.includes(module?.module_key) || moduleKeys.has(module.module_key)) return false;
    moduleKeys.add(module.module_key);
    return Object.prototype.hasOwnProperty.call(ACCESS_LEVELS, module.access_level)
      && (module.scope_level === null || ["own", "clinic"].includes(module.scope_level))
      && typeof module.can_export === "boolean";
  });
  return validModules
    && Array.isArray(context.capabilities)
    && context.capabilities.every((capability) => typeof capability === "string")
    && Array.isArray(context.administrative_powers)
    && context.administrative_powers.every((power) => typeof power === "string");
}

export function contextCanAccessModule(context, moduleKey, minimumAccessLevel = "view") {
  if (!isValidAuthorizationContext(context) || context.authorization_state !== "authorized") {
    return false;
  }
  if (!MODULE_KEYS.includes(moduleKey)
    || !Object.prototype.hasOwnProperty.call(ACCESS_LEVELS, minimumAccessLevel)) return false;
  const permission = context.modules.find((module) => module.module_key === moduleKey);
  return ACCESS_LEVELS[permission?.access_level] >= ACCESS_LEVELS[minimumAccessLevel];
}

export function contextHasCapability(context, capability) {
  return isValidAuthorizationContext(context)
    && context.authorization_state === "authorized"
    && context.capabilities.includes(capability);
}

export function classifyAuthorizationContextFailure(error) {
  const status = error?.response?.status;
  if (status === 401) return "idle";
  if (status === 403) return "forbidden";
  return "error";
}

export function isTeamAdministrator(context) {
  return isValidAuthorizationContext(context)
    && context?.authorization_state === "authorized"
    && context?.is_administrator === true
    && Array.isArray(context?.administrative_powers)
    && context.administrative_powers.includes(TEAM_POWER);
}

export function canManageProfessionalLifecycle(context) {
  return isTeamAdministrator(context)
    && context?.professional_lifecycle_available === true
    && context?.capabilities?.includes("professionals.lifecycle.manage");
}

export function AuthorizationProvider({ children }) {
  const isLoggedIn = useSelector((state) => state.auth.isLoggedIn);
  const token = useSelector((state) => state.auth.token);
  const userId = useSelector((state) => state.auth.user?.id);
  const sessionIdentity = useMemo(
    () => (
      isLoggedIn
      && typeof token === "string"
      && token.length > 0
      && Number.isSafeInteger(Number(userId))
      && Number(userId) > 0
        ? Object.freeze({})
        : null
    ),
    [isLoggedIn, token, userId],
  );
  const activeIdentityRef = useRef(sessionIdentity);
  const requestGenerationRef = useRef(0);
  const mountedRef = useRef(false);
  const [state, setState] = useState({ status: "idle", context: null, identity: null });

  activeIdentityRef.current = sessionIdentity;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      requestGenerationRef.current += 1;
    };
  }, []);

  const reload = useCallback(async () => {
    const identity = sessionIdentity;
    const generation = requestGenerationRef.current + 1;
    requestGenerationRef.current = generation;
    if (!identity) {
      if (mountedRef.current) {
        setState({ status: "idle", context: null, identity: null });
      }
      return;
    }
    if (mountedRef.current) {
      setState({ status: "loading", context: null, identity });
    }
    try {
      const context = await getAuthorizationContext();
      if (
        mountedRef.current
        && requestGenerationRef.current === generation
        && activeIdentityRef.current === identity
      ) {
        setState({ status: "ready", context, identity });
      }
    } catch (error) {
      if (
        mountedRef.current
        && requestGenerationRef.current === generation
        && activeIdentityRef.current === identity
      ) {
        setState({
          status: classifyAuthorizationContextFailure(error),
          context: null,
          identity,
        });
      }
    }
  }, [sessionIdentity]);

  useEffect(() => {
    reload();
  }, [reload]);

  const visibleState = useMemo(() => (
    state.identity === sessionIdentity
      ? state
      : {
        status: sessionIdentity ? "loading" : "idle",
        context: null,
      }
  ), [sessionIdentity, state]);

  const value = useMemo(() => ({
    status: visibleState.status,
    context: visibleState.context,
    canViewTeam: visibleState.status === "ready" && isTeamAdministrator(visibleState.context),
    canManageProfessionalLifecycle: visibleState.status === "ready"
      && canManageProfessionalLifecycle(visibleState.context),
    canAccessModule: (moduleKey, minimumAccessLevel = "view") => (
      visibleState.status === "ready"
      && contextCanAccessModule(visibleState.context, moduleKey, minimumAccessLevel)
    ),
    hasCapability: (capability) => (
      visibleState.status === "ready" && contextHasCapability(visibleState.context, capability)
    ),
    reload,
  }), [reload, visibleState]);

  return (
    <AuthorizationContext.Provider value={value}>
      {children}
    </AuthorizationContext.Provider>
  );
}

AuthorizationProvider.propTypes = { children: PropTypes.node.isRequired };

export function useAuthorization() {
  return useContext(AuthorizationContext);
}
