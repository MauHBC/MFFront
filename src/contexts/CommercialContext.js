import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import PropTypes from "prop-types";
import { useSelector } from "react-redux";
import { useLocation } from "react-router-dom";
import axios from "../services/axios";

const Context = createContext({ status: "ready", data: { managed: false }, refresh: async () => {} });
export const useCommercial = () => useContext(Context);
export function CommercialProvider({ children }) {
  const logged = useSelector((state) => state.auth.isLoggedIn);
  const token = useSelector((state) => state.auth.token);
  const { pathname } = useLocation();
  const [state, setState] = useState({ status: "loading", data: null });
  const generation = useRef(0);
  const refresh = useCallback(async () => {
    generation.current += 1;
    const {current} = generation;
    if (!logged) {
      setState({ status: "ready", data: { managed: false } });
      return;
    }
    try {
      const { data } = await axios.get("/commercial", { headers: { Authorization: `Bearer ${token}` } });
      if (generation.current === current) setState({ status: "ready", data });
    } catch (_) {
      if (generation.current === current) setState({ status: "error", data: null });
    }
  }, [logged, token]);
  useEffect(() => {
    setState({ status: "loading", data: null });
    return () => { generation.current += 1; };
  }, [refresh]);
  useEffect(() => { refresh(); }, [pathname, refresh]);
  useEffect(() => {
    if (!logged) return undefined;
    const timer = setInterval(refresh, 60000);
    window.addEventListener("focus", refresh);
    window.addEventListener("motria:commercial-access-changed", refresh);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("motria:commercial-access-changed", refresh);
    };
  }, [logged, refresh]);
  const value = useMemo(() => ({ ...state, refresh }), [state, refresh]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
CommercialProvider.propTypes = { children: PropTypes.node.isRequired };
