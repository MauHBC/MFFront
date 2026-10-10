import { useCallback, useEffect, useRef } from "react";
import { useHistory } from "react-router-dom";
import { toast } from "react-toastify";
import { useClinicTransitionGuard } from "../contexts/ClinicTransitionGuardContext";

// Match the existing clinic switch confirmation; browser Escape keeps the draft.
export default function useClinicalRecordNavigationGuard({ dirty, saving }) {
  const history = useHistory();
  const state = useRef({ dirty, saving, saved: false });
  state.current.dirty = dirty;
  state.current.saving = saving;
  useClinicTransitionGuard({ dirty, saving });

  useEffect(() => {
    // These record pages inherit the previous page's scroll position otherwise.
    document.scrollingElement?.scrollTo(0, 0);
    const unblock = history.block(() => {
      if (state.current.saved) return undefined;
      if (state.current.saving) {
        toast.info("Aguarde o salvamento terminar antes de sair do registro.");
        return false;
      }
      // eslint-disable-next-line no-alert
      if (state.current.dirty && !window.confirm("Há alterações não salvas. Deseja descartá-las e sair do registro?")) return false;
      return undefined;
    });
    const beforeUnload = (event) => {
      if (state.current.saved || (!state.current.dirty && !state.current.saving)) return;
      event.preventDefault();
      // Required by browsers to request the native unsaved-changes warning.
      // eslint-disable-next-line no-param-reassign
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => {
      unblock();
      window.removeEventListener("beforeunload", beforeUnload);
    };
  }, [history]);

  return useCallback(() => { state.current.saved = true; }, []);
}
