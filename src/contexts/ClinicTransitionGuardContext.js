import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
} from "react";
import PropTypes from "prop-types";

const ClinicTransitionGuardContext = createContext({
  hasDirtyState: () => false,
  hasSavingState: () => false,
  register: () => () => {},
});

export function ClinicTransitionGuardProvider({ children }) {
  const guards = useRef(new Map());
  const dirtyForms = useRef(new Set());
  useEffect(() => {
    const trackedForms = dirtyForms.current;
    const markDirty = (event) => {
      const form = event.target?.closest?.("form");
      if (form) trackedForms.add(form);
    };
    document.addEventListener("input", markDirty, true);
    document.addEventListener("change", markDirty, true);
    return () => {
      document.removeEventListener("input", markDirty, true);
      document.removeEventListener("change", markDirty, true);
      trackedForms.clear();
    };
  }, []);
  const register = useCallback((key, state) => {
    guards.current.set(key, state);
    return () => guards.current.delete(key);
  }, []);
  const value = useMemo(() => ({
    register,
    hasDirtyState: () => [...guards.current.values()].some(({ dirty }) => dirty === true)
      || [...dirtyForms.current].some((form) => document.documentElement.contains(form)),
    hasSavingState: () => [...guards.current.values()].some(({ saving }) => saving === true),
  }), [register]);
  return (
    <ClinicTransitionGuardContext.Provider value={value}>
      {children}
    </ClinicTransitionGuardContext.Provider>
  );
}

ClinicTransitionGuardProvider.propTypes = { children: PropTypes.node.isRequired };

export function useClinicTransitionGuard({ dirty = false, saving = false }) {
  const { register } = useContext(ClinicTransitionGuardContext);
  const key = useRef(Symbol("clinic-transition-guard"));
  useEffect(() => register(key.current, { dirty, saving }), [dirty, register, saving]);
}

export function useClinicTransitionGuardRegistry() {
  return useContext(ClinicTransitionGuardContext);
}
