import { useCallback, useEffect, useState } from "react";
import axios from "../../services/axios";
import { partitionPatientOrigins } from "./patientSchedulingOrigins";

export default function usePatientRights(patientId, enabled, selection = 0, includeReplacements = false) {
  const [result, setResult] = useState({ key: "", status: "idle", options: [], replacements: [] });
  const [revision, setRevision] = useState(0);
  const key = `${patientId}:${selection}:${revision}:${includeReplacements}`;
  const refresh = useCallback(() => {
    setResult({ key: "", status: "loading", options: [], replacements: [] });
    setRevision((value) => value + 1);
  }, []);
  useEffect(() => {
    if (!enabled || !patientId) {
      setResult({ key: "", status: "idle", options: [], replacements: [] });
      return undefined;
    }
    let cancelled = false;
    const id = String(patientId);
    setResult({ key, status: "loading", options: [], replacements: [] });
    const requests = [axios.get(`/patients/${id}/available-rights`)];
    if (includeReplacements) requests.push(axios.get("/session-replacement-credits", {
      params: { patient_id: id, status: "pending" },
    }));
    Promise.all(requests).then(([rights, credits]) => {
      if (!Array.isArray(rights.data)) throw new Error("Resposta de direitos inválida.");
      const origins = includeReplacements
        ? partitionPatientOrigins(rights.data, credits.data, id)
        : { options: rights.data, replacements: [] };
      if (!cancelled) setResult({ key, status: "ready", ...origins });
    }).catch(() => {
      if (!cancelled) setResult({ key, status: "error", options: [], replacements: [] });
    });
    return () => { cancelled = true; };
  }, [patientId, enabled, key, includeReplacements]);
  if (!enabled || !patientId) return { status: "idle", options: [], replacements: [], refresh };
  if (result.key !== key) return { status: "loading", options: [], replacements: [], refresh };
  return { ...result, refresh };
}
