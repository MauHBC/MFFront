import React, { useRef, useState } from "react";
import PropTypes from "prop-types";
import styled from "styled-components";
import { v4 as uuidv4 } from "uuid";
import axios from "../../services/axios";
import RightsOriginPicker from "./RightsOriginPicker";

const Fields = styled.form`
  display: grid; gap: 18px; padding: 20px;
  label { display: grid; gap: 8px; font-weight: 600; }
  input, select, textarea { padding: 10px; border: 1px solid #cbd5e1; border-radius: 8px; font: inherit; }
  button { padding: 12px; border: 0; border-radius: 8px; background: #176b61; color: white; font: inherit; }
  small { font-weight: 400; color: #64748b; }
`;

export default function PurchaseLaterForm({ patients, services, patientId, onSuccess, onError, onScheduleRight, onShare, canShare, canCancel, onPatientChange, onPendingChange }) {
  const [form, setForm] = useState({ patient_id: patientId || "", service_id: "", quantity: "1", price: "", notes: "" });
  const [saving, setSaving] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const attempt = useRef(null);
  const lock = useRef(false);
  const change = (event) => {
    setForm((previous) => ({ ...previous, [event.target.name]: event.target.value }));
    if (event.target.name === "patient_id") onPatientChange(event.target.value);
  };
  const submit = async (event) => {
    event.preventDefault();
    if (lock.current) return;
    const price = form.price.trim() ? Math.round(Number(form.price.replace(",", ".")) * 100) : null;
    if (price != null && (!Number.isSafeInteger(price) || price < 0)) {
      onError("Informe um valor por sessão válido."); return;
    }
    const body = { patient_id: Number(form.patient_id), service_id: Number(form.service_id),
      quantity: Number(form.quantity), launch_notes: form.notes.trim() || null,
      ...(price == null ? {} : { price_override_cents: price }) };
    const fingerprint = JSON.stringify(body);
    if (attempt.current?.fingerprint !== fingerprint) {
      attempt.current = { fingerprint, key: `purchase:${uuidv4()}` };
    }
    lock.current = true; setSaving(true); onPendingChange(true);
    try {
      const response = await axios.post("/package-purchases", { ...body, idempotency_key: attempt.current.key });
      setUncertain(false); onPendingChange(false);
      try { await onSuccess(response.data); }
      catch (_) { onError("Lançamento registrado. Recarregue os dados para conferir."); }
    } catch (error) {
      const ambiguous = !error.response || error.response.status >= 500;
      setUncertain(ambiguous); onPendingChange(ambiguous);
      onError(error?.response?.data?.error || "Verifique o resultado da mesma tentativa antes de editar ou sair.");
    }
    finally { lock.current = false; setSaving(false); }
  };
  let label = uncertain ? "Verificar lançamento" : "Lançar e agendar depois";
  if (saving) label = "Registrando...";
  return <Fields onSubmit={submit}>
    <fieldset disabled={saving || uncertain} style={{ display: "grid", gap: 18, border: 0, padding: 0, margin: 0, minWidth: 0 }}>
    <label htmlFor="purchase-later-patient">Paciente<select id="purchase-later-patient" name="patient_id" value={form.patient_id} onChange={change} required disabled={saving}>
      <option value="">Selecionar</option>{patients.map((patient) => <option key={patient.id} value={patient.id}>
        {patient.nickname || patient.full_name || patient.name}</option>)}
    </select></label>
    <RightsOriginPicker patientId={form.patient_id} selectedId="" onSelect={(pkg) => { if (pkg) onScheduleRight(pkg, form.patient_id); }}
      canShare={canShare} sharing={false} onShare={() => onShare(form.patient_id)} canCancel={canCancel}/>
    <label htmlFor="purchase-later-service">Tipo de atendimento<select id="purchase-later-service" name="service_id" value={form.service_id} onChange={change} required disabled={saving}>
      <option value="">Selecionar</option>{services.map((service) => <option key={service.id} value={service.id}>{service.name}</option>)}
    </select></label>
    <label htmlFor="purchase-later-quantity">Quantidade de sessões<input id="purchase-later-quantity" name="quantity" type="number" min="1" max="200" step="1" value={form.quantity} onChange={change} required disabled={saving}/>
      <small>{Number(form.quantity) === 1 ? "Sessão avulsa" : "Pacote"} — todas disponíveis para agendar depois.</small></label>
    <label htmlFor="purchase-later-price">Valor por sessão<input id="purchase-later-price" name="price" inputMode="decimal" value={form.price} onChange={change} placeholder="Preço cadastrado do serviço" disabled={saving}/></label>
    <label htmlFor="purchase-later-notes">Observação do lançamento (opcional)<textarea id="purchase-later-notes" name="notes" value={form.notes} onChange={change} maxLength={2000} rows={3} disabled={saving}/></label>
    <small>A compra será registrada hoje no Financeiro. O profissional e o horário serão definidos ao agendar cada sessão.</small>
    </fieldset>
    {uncertain && <small role="status">O resultado está pendente. Verifique a mesma tentativa para evitar outro lançamento.</small>}
    <button type="submit" disabled={saving}>{label}</button>
  </Fields>;
}
PurchaseLaterForm.propTypes = {
  patients: PropTypes.arrayOf(PropTypes.shape({ id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
    nickname: PropTypes.string, full_name: PropTypes.string, name: PropTypes.string })).isRequired,
  services: PropTypes.arrayOf(PropTypes.shape({ id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
    name: PropTypes.string })).isRequired,
  patientId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  onSuccess: PropTypes.func.isRequired, onError: PropTypes.func.isRequired,
  onScheduleRight: PropTypes.func, onShare: PropTypes.func, onPatientChange: PropTypes.func,
  onPendingChange: PropTypes.func,
  canShare: PropTypes.bool, canCancel: PropTypes.bool,
};
PurchaseLaterForm.defaultProps = { patientId: "", canShare: false, canCancel: false,
  onScheduleRight: () => {}, onShare: () => {}, onPatientChange: () => {}, onPendingChange: () => {} };
