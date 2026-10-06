import { useCallback, useRef, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import axios from "../../services/axios";

// The Agenda owns the fields. This hook only preserves the purchase attempt.
export default function usePurchaseLaterCommand({ onSuccess, onError }) {
  const [saving, setSaving] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const attempt = useRef(null);
  const lock = useRef(false);
  const reset = useCallback(() => { attempt.current = null; setUncertain(false); }, []);
  const submit = async (body) => {
    if (lock.current) return;
    const fingerprint = JSON.stringify(body);
    if (uncertain && attempt.current?.fingerprint !== fingerprint) return;
    if (attempt.current?.fingerprint !== fingerprint) {
      attempt.current = { fingerprint, body, key: `purchase:${uuidv4()}` };
    }
    lock.current = true; setSaving(true);
    try {
      const response = await axios.post("/package-purchases", {
        ...attempt.current.body, idempotency_key: attempt.current.key,
      });
      setUncertain(false);
      try { await onSuccess(response.data); }
      catch (_) { onError("Lançamento registrado. Recarregue os dados para conferir."); }
    } catch (error) {
      setUncertain(!error.response || error.response.status >= 500);
      onError(error?.response?.data?.error || "Verifique o resultado da mesma tentativa antes de editar ou sair.");
    } finally { lock.current = false; setSaving(false); }
  };
  return { saving, uncertain, submit, reset };
}
