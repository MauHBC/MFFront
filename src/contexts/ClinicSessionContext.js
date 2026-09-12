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
import { useDispatch, useSelector } from "react-redux";
import { toast } from "react-toastify";
import axios from "../services/axios";
import history from "../services/history";
import * as authActions from "../store/modules/auth/actions";
import {
  hasPendingMutationRequest,
  subscribeToMutationRequests,
} from "../services/requestActivity";
import {
  publishClinicSession,
  subscribeToClinicSession,
} from "../services/clinicSessionSync";
import { useClinicTransitionGuardRegistry } from "./ClinicTransitionGuardContext";

const ClinicSessionContext = createContext({
  session: null,
  loading: false,
  switching: false,
  mutationPending: false,
  switchClinic: async () => false,
});

export function ClinicSessionProvider({ children }) {
  const dispatch = useDispatch();
  const isLoggedIn = useSelector((state) => state.auth.isLoggedIn);
  const token = useSelector((state) => state.auth.token);
  const user = useSelector((state) => state.auth.user);
  const persistedSession = useSelector((state) => state.auth.clinicSession);
  const membershipSession = Number.isSafeInteger(Number(user?.membership_id))
    && Number(user?.membership_id) > 0;
  const { hasDirtyState, hasSavingState } = useClinicTransitionGuardRegistry();
  const [session, setSession] = useState(persistedSession || null);
  const [loading, setLoading] = useState(membershipSession);
  const [switching, setSwitching] = useState(false);
  const [mutationPending, setMutationPending] = useState(false);
  const activeRequest = useRef(0);

  useEffect(() => subscribeToMutationRequests((count) => setMutationPending(count > 0)), []);

  useEffect(() => subscribeToClinicSession((payload) => {
    if (Number(payload.user.id) !== Number(user?.id)) return;
    axios.defaults.headers.Authorization = `Bearer ${payload.token}`;
    dispatch(authActions.loginSuccess(payload));
    history.replace("/menu");
  }), [dispatch, user?.id]);

  useEffect(() => {
    const generation = activeRequest.current + 1;
    activeRequest.current = generation;
    if (!isLoggedIn || !membershipSession) {
      setSession(null);
      setLoading(false);
      return undefined;
    }
    setLoading(true);
    axios.get("/clinic-session").then((response) => {
      if (activeRequest.current === generation) setSession(response.data);
    }).catch(() => {
      if (activeRequest.current === generation) setSession(persistedSession || null);
    }).finally(() => {
      if (activeRequest.current === generation) setLoading(false);
    });
    return () => {
      activeRequest.current += 1;
    };
  }, [isLoggedIn, membershipSession, persistedSession, token]);

  const switchClinic = useCallback(async (membershipId) => {
    const target = Number(membershipId);
    if (
      !membershipSession
      || !Number.isSafeInteger(target)
      || target <= 0
      || target === Number(session?.active_membership_id)
      || switching
    ) return false;
    if (hasPendingMutationRequest() || hasSavingState()) {
      toast.info("Aguarde o salvamento terminar antes de trocar de clínica.");
      return false;
    }
    // Native confirmation is intentional: it blocks navigation until the discard decision.
    // eslint-disable-next-line no-alert
    if (hasDirtyState() && !window.confirm(
      "Há alterações não salvas. Deseja descartá-las e trocar de clínica?",
    )) return false;

    setSwitching(true);
    try {
      const response = await axios.post("/clinic-session/active-membership", {
        membership_id: target,
      });
      const payload = response.data;
      axios.defaults.headers.Authorization = `Bearer ${payload.token}`;
      dispatch(authActions.loginSuccess(payload));
      history.replace("/menu");
      publishClinicSession(payload);
      return true;
    } catch (error) {
      toast.error("Não foi possível trocar de clínica.");
      setSwitching(false);
      return false;
    }
  }, [dispatch, hasDirtyState, hasSavingState, membershipSession, session, switching]);

  const value = useMemo(() => ({
    session,
    loading,
    switching,
    mutationPending,
    switchClinic,
  }), [loading, mutationPending, session, switchClinic, switching]);

  return <ClinicSessionContext.Provider value={value}>{children}</ClinicSessionContext.Provider>;
}

ClinicSessionProvider.propTypes = { children: PropTypes.node.isRequired };

export function useClinicSession() {
  return useContext(ClinicSessionContext);
}
