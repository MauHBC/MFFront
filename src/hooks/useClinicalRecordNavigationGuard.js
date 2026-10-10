import { useCallback, useEffect, useRef } from "react";
import { useHistory } from "react-router-dom";
import { toast } from "react-toastify";
import { useClinicTransitionGuard } from "../contexts/ClinicTransitionGuardContext";
import {
  cancelClinicalRecordDiscard,
  createClinicalRecordDiscardPrompt,
  requestClinicalRecordDiscard,
} from "../services/clinicalRecordNavigationConfirmation";

export default function useClinicalRecordNavigationGuard({ dirty, saving }) {
  const history = useHistory();
  const owner = useRef(Symbol("clinical-record-discard"));
  const state = useRef({ dirty, saving, saved: false, active: true });
  state.current.dirty = dirty;
  state.current.saving = saving;
  useClinicTransitionGuard({ dirty, saving });

  useEffect(() => {
    const recordOwner = owner.current;
    const recordState = state.current;
    state.current.active = true;
    // These record pages inherit the previous page's scroll position otherwise.
    document.scrollingElement?.scrollTo(0, 0);
    const canDiscard = () => state.current.active && !state.current.saving;
    const unblock = history.block(() => {
      if (state.current.saved) return undefined;
      if (state.current.saving) {
        toast.info("Aguarde o salvamento terminar antes de sair do registro.");
        return false;
      }
      if (state.current.dirty) return createClinicalRecordDiscardPrompt(recordOwner, canDiscard);
      return undefined;
    });
    const beforeUnload = (event) => {
      if (state.current.saved || (!state.current.dirty && !state.current.saving)) return;
      event.preventDefault();
      // Closing/reloading the browser still requires its native warning.
      // eslint-disable-next-line no-param-reassign
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => {
      recordState.active = false;
      unblock();
      cancelClinicalRecordDiscard(recordOwner);
      window.removeEventListener("beforeunload", beforeUnload);
    };
  }, [history]);

  const markSaved = useCallback(() => {
    state.current.saved = true;
    cancelClinicalRecordDiscard(owner.current);
  }, []);
  const confirmDiscard = useCallback((onDiscard) => {
    if (state.current.saving) {
      toast.info("Aguarde o salvamento terminar antes de sair do registro.");
      return;
    }
    if (!state.current.dirty) {
      onDiscard();
      return;
    }
    requestClinicalRecordDiscard(owner.current, (accepted) => {
      if (accepted) onDiscard();
    }, () => state.current.active && !state.current.saving);
  }, []);
  return { markSaved, confirmDiscard };
}
