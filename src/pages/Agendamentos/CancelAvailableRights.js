import React, { useRef, useState } from "react";
import PropTypes from "prop-types";
import { v4 as uuidv4 } from "uuid";
import axios from "../../services/axios";

export default function CancelAvailableRights({ packageId, onCompleted }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [uncertain, setUncertain] = useState(false);
  const attempt = useRef(null);
  const lock = useRef(false);
  const execute = async () => {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError("");
    try {
      const url = `/packages/${packageId}/cancel-available`;
      if (!preview) {
        const response = await axios.post(`${url}/preview`, { reason: reason.trim() || null });
        if (Number(response.data?.package_id) !== Number(packageId) || !response.data?.eligible
          || !Number.isInteger(response.data?.available_count) || !response.data?.preview_fingerprint) {
          throw new Error("Nenhuma unidade disponível para cancelar.");
        }
        setPreview(response.data);
      } else {
        if (!attempt.current) attempt.current = { reason: reason.trim() || null,
          preview_fingerprint: preview.preview_fingerprint, idempotency_key: `cancel:${uuidv4()}` };
        const response = await axios.post(url, attempt.current);
        if (Number(response.data?.package_id) !== Number(packageId)) throw new Error("Resposta incompatível.");
        await onCompleted(); setOpen(false);
      }
    } catch (failure) {
      const code = failure.response?.data?.code;
      if (code === "PACKAGE_CANCEL_PREVIEW_STALE" || code === "PACKAGE_NO_AVAILABLE_RIGHTS") {
        setPreview(null); attempt.current = null; setUncertain(false);
      } else if (attempt.current) setUncertain(true);
      setError(failure.response?.data?.error || failure.message || "Não foi possível cancelar.");
    } finally { lock.current = false; setBusy(false); }
  };
  if (!open) return <button type="button" onClick={() => { setOpen(true); setPreview(null); setReason(""); setError(""); setUncertain(false); attempt.current = null; }}>Cancelar unidades disponíveis</button>;
  let label = preview ? "Confirmar cancelamento" : "Conferir unidades";
  if (uncertain) label = "Verificar resultado";
  return <div role="dialog" aria-label="Cancelar unidades disponíveis" style={{ padding: 16, border: "1px solid #cbd5e1", borderRadius: 8 }}>
    <p>As unidades usadas ou agendadas serão preservadas. As cobranças abertas ou pagas permanecerão no Financeiro. Qualquer acerto será feito separadamente, sem devolução automática.</p>
    <label htmlFor={`cancel-right-reason-${packageId}`}>Motivo (opcional)<textarea id={`cancel-right-reason-${packageId}`} value={reason} maxLength={1000} disabled={busy || uncertain}
      onChange={(event) => { setReason(event.target.value); setPreview(null); attempt.current = null; }}/></label>
    {preview && <p>{preview.available_count} unidade(s) serão canceladas; {preview.preserved_count} preservadas.</p>}
    {error && <p role="alert">{error}</p>}
    <button type="button" disabled={busy} onClick={execute}>{label}</button>{" "}
    <button type="button" disabled={busy || uncertain} onClick={() => setOpen(false)}>Voltar</button>
  </div>;
}
CancelAvailableRights.propTypes = { packageId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  onCompleted: PropTypes.func.isRequired };
