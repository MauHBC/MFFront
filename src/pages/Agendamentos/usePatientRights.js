import { useCallback, useEffect, useState } from "react";
import axios from "../../services/axios";

export default function usePatientRights(patientId, enabled, selection = 0) {
  const [result, setResult] = useState({ key: "", status: "idle", options: [] });
  const [revision, setRevision] = useState(0);
  const key = `${patientId}:${selection}:${revision}`;
  const refresh = useCallback(() => {
    setResult({ key: "", status: "loading", options: [] });
    setRevision((value) => value + 1);
  }, []);
  useEffect(() => {
    if (!enabled || !patientId) {
      setResult({ key: "", status: "idle", options: [] });
      return undefined;
    }
    let cancelled = false;
    const id = String(patientId);
    setResult({ key, status: "loading", options: [] });
    axios.get(`/patients/${id}/available-rights`).then((response) => {
      if (!Array.isArray(response.data)) throw new Error("Resposta de direitos inválida.");
      if (!cancelled) setResult({ key, status: "ready", options: response.data });
    }).catch(() => {
      if (!cancelled) setResult({ key, status: "error", options: [] });
    });
    return () => { cancelled = true; };
  }, [patientId, enabled, key]);
  if (!enabled || !patientId) return { status: "idle", options: [], refresh };
  if (result.key !== key) return { status: "loading", options: [], refresh };
  return { ...result, refresh };
}
