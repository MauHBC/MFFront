import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
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
  reload: () => {},
});
const TEAM_POWER = "access_profiles.manage";

export function classifyAuthorizationContextFailure(error) {
  const status = error?.response?.status;
  if (status === 401) return "idle";
  if (status === 403) return "forbidden";
  return "error";
}

export function isTeamAdministrator(context) {
  const validModules = Array.isArray(context?.modules)
    && context.modules.length > 0
    && context.modules.every((module) => (
      typeof module?.module_key === "string"
      && ["none", "view", "edit", "manage"].includes(module.access_level)
      && (module.scope_level === null || ["own", "clinic"].includes(module.scope_level))
      && typeof module.can_export === "boolean"
    ));
  return Number.isSafeInteger(context?.catalog_version)
    && context.catalog_version > 0
    && validModules
    && Array.isArray(context?.capabilities)
    && context.capabilities.every((capability) => typeof capability === "string")
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
  const [state, setState] = useState({ status: "idle", context: null });

  const reload = useCallback(async () => {
    if (!isLoggedIn) {
      setState({ status: "idle", context: null });
      return;
    }
    setState({ status: "loading", context: null });
    try {
      const context = await getAuthorizationContext();
      setState({ status: "ready", context });
    } catch (error) {
      setState({ status: classifyAuthorizationContextFailure(error), context: null });
    }
  }, [isLoggedIn]);

  useEffect(() => {
    reload();
  }, [reload]);

  const value = useMemo(() => ({
    ...state,
    canViewTeam: state.status === "ready" && isTeamAdministrator(state.context),
    canManageProfessionalLifecycle: state.status === "ready"
      && canManageProfessionalLifecycle(state.context),
    reload,
  }), [reload, state]);

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
