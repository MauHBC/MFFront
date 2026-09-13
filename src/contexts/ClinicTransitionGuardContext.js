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

const ClinicTransitionGuardContext = createContext({
  hasDirtyState: () => false,
  hasSavingState: () => false,
  register: () => () => {},
  revision: 0,
});

export function ClinicTransitionGuardProvider({ children }) {
  const guards = useRef(new Map());
  const dirtyForms = useRef(new Set());
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const trackedForms = dirtyForms.current;
    const markDirty = (event) => {
      const form = event.target?.closest?.("form");
      if (form && !trackedForms.has(form)) {
        trackedForms.add(form);
        setRevision((current) => current + 1);
      }
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
    setRevision((current) => current + 1);
    return () => {
      guards.current.delete(key);
      setRevision((current) => current + 1);
    };
  }, []);
  const value = useMemo(() => ({
    register,
    revision,
    hasDirtyState: () => [...guards.current.values()].some(({ dirty }) => dirty === true)
      || [...dirtyForms.current].some((form) => document.documentElement.contains(form)),
    hasSavingState: () => [...guards.current.values()].some(({ saving }) => saving === true),
  }), [register, revision]);
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
