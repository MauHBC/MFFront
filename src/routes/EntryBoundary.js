import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import PropTypes from "prop-types";
import { Redirect, useLocation } from "react-router-dom";
import TenantLoading from "../components/TenantLoading";
import { CENTRAL_LOGIN, entryDestination, hostRole, loadEntryPolicy } from "../config/entryPolicy";

const EntryContext = createContext({ enabled: false, central: false, loginHref: "/login" });
export const useEntryPolicy = () => useContext(EntryContext);

const replaceLocation = (destination) => window.location.replace(destination);

export default function EntryBoundary({
  children, hostname, load, replace,
}) {
  const location = useLocation();
  const [state, setState] = useState({ status: "loading", enabled: false });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    setState({ status: "loading", enabled: false });
    load({ hostname, signal: controller.signal })
      .then((enabled) => { if (active) setState({ status: "ready", enabled, hostname }); })
      .catch(() => { if (active) setState({ status: "error", enabled: false, hostname }); })
      .finally(() => clearTimeout(timer));
    return () => { active = false; clearTimeout(timer); controller.abort(); };
  }, [attempt, hostname, load]);

  // Resolve activation once per document, not per route: normal navigation must
  // retain providers and state, including disabled legacy and local development.
  const current = state.hostname === hostname;
  const destination = current && state.status === "ready"
    ? entryDestination({ hostname, ...location, enabled: state.enabled }) : null;
  const external = destination === CENTRAL_LOGIN;
  const role = hostRole(hostname);
  const context = useMemo(() => ({
    enabled: state.enabled,
    central: state.enabled && role === "central",
    loginHref: state.enabled && ["site", "forwarding"].includes(role) ? CENTRAL_LOGIN : "/login",
  }), [role, state.enabled]);
  useEffect(() => {
    if (external) replace(CENTRAL_LOGIN);
  }, [external, replace]);

  // Gate is outside every tenant/session provider: redirects cannot mount or
  // load authenticated modules, including React-only navigation from a site.
  if (!current || state.status === "loading" || external) return <TenantLoading />;
  if (state.status === "error") {
    return <div role="alert">
      Não foi possível carregar a entrada do sistema.
      <button type="button" onClick={() => setAttempt((value) => value + 1)}>Tentar novamente</button>
    </div>;
  }
  if (destination) return <Redirect to={{ pathname: destination, search: "", hash: "" }} />;
  return <EntryContext.Provider value={context}>{children}</EntryContext.Provider>;
}

EntryBoundary.propTypes = {
  children: PropTypes.node.isRequired,
  hostname: PropTypes.string,
  load: PropTypes.func,
  replace: PropTypes.func,
};
EntryBoundary.defaultProps = {
  hostname: window.location.hostname,
  load: loadEntryPolicy,
  replace: replaceLocation,
};
