import React, { useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import styled from 'styled-components';
import { v4 as uuidv4 } from 'uuid';
import { PrimaryButton, GhostButton } from '../../../components/AppButton';
import { Field, FieldHint } from '../../../components/AppForm';
import { formatFinancialInstant } from '../helpers/financialDateTime';
import { getUserFacingApiError } from '../../../services/axios';
import { listPaymentUnapplications, previewPaymentUnapplication, confirmPaymentUnapplication } from '../../../services/financialUnapplication';

const validMoney = (value) => Number.isSafeInteger(value) && value >= 0;
export default function FinancialPaymentUnapplicationModal({ target, formatCurrency, onClose, onCompleted }) {
  const [operations, setOperations] = useState(null);
  const [selected, setSelected] = useState('');
  const [reason, setReason] = useState('');
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [uncertain, setUncertain] = useState(false);
  const mounted = useRef(false);
  const inFlight = useRef(false);
  const attempt = useRef(null);
  const command = useRef(null);
  const dialog = useRef(null);
  const { query } = target;
  const load = async () => {
    if (inFlight.current) return;
    inFlight.current = true; setBusy(true); setError('');
    try {
      const { data } = await listPaymentUnapplications(query);
      if (data.patient_id !== query.patient_id || data.charge_key !== query.charge_key
        || !Array.isArray(data.operations) || data.operations.some((row) => !row.operation_key
          || !validMoney(row.amount_cents) || typeof row.eligible !== 'boolean' || !Array.isArray(row.blockers))) throw new Error('Invalid operations');
      if (mounted.current) setOperations(data.operations);
    } catch (failure) {
      if (mounted.current) setError(getUserFacingApiError(failure, 'Não foi possível conferir as baixas. Tente novamente.'));
    } finally { inFlight.current = false; if (mounted.current) setBusy(false); }
  };
  useEffect(() => {
    mounted.current = true;
    const prior = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.current?.focus();
    load();
    return () => {
      mounted.current = false; document.body.style.overflow = previousOverflow;
      if (prior?.isConnected) prior.focus();
    };
    // Target is immutable for the lifetime of this dialog.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const advance = async () => {
    if (inFlight.current || !selected || !reason.trim()) return;
    inFlight.current = true; setBusy(true); setError('');
    const body = { ...query, operation_key: selected, reason: reason.trim() };
    try {
      const { data } = await previewPaymentUnapplication(body);
      if (data.patient_id !== query.patient_id || data.charge_key !== query.charge_key
        || data.operation_key !== selected || !data.preview_fingerprint
        || !validMoney(data.amount_cents) || data.amount_cents <= 0
        || !validMoney(data.discount_cents) || !validMoney(data.surcharge_cents)
        || !validMoney(data.credit_before_cents) || data.credit_after_cents !== data.credit_before_cents + data.amount_cents) throw new Error('Invalid preview');
      if (!data.eligible) throw new Error(data.blockers?.join(' ') || 'Baixa não elegível.');
      if (mounted.current) { command.current = body; setPreview(data); }
    } catch (failure) {
      if (mounted.current) setError(getUserFacingApiError(failure, failure.message || 'Não foi possível conferir o desfazimento.'));
    } finally { inFlight.current = false; if (mounted.current) setBusy(false); }
  };
  const confirm = async () => {
    if (inFlight.current || !preview) return;
    if (!attempt.current) attempt.current = { key: uuidv4(), body: { ...command.current, preview_fingerprint: preview.preview_fingerprint } };
    inFlight.current = true; setBusy(true); setError('');
    try {
      const { data } = await confirmPaymentUnapplication(attempt.current.body, attempt.current.key);
      if (data.patient_id !== query.patient_id || data.charge_key !== query.charge_key
        || data.operation_key !== selected || data.amount_cents !== preview.amount_cents || !data.id) throw new Error('Invalid confirmation');
      if (mounted.current) onCompleted(data);
    } catch (failure) {
      if (!mounted.current) return;
      const ambiguous = !failure.response || failure.response.status >= 500;
      setUncertain(ambiguous);
      if (!ambiguous) { attempt.current = null; setPreview(null); }
      setError(getUserFacingApiError(failure, ambiguous
        ? 'O resultado ainda não foi confirmado. Verifique a mesma tentativa antes de sair.'
        : 'Não foi possível desfazer a baixa. Confira os dados novamente.'));
    } finally { inFlight.current = false; if (mounted.current) setBusy(false); }
  };
  const keyDown = (event) => {
    if (event.key === 'Escape' && !busy && !uncertain) { event.preventDefault(); onClose(); }
    if (event.key !== 'Tab') return;
    const items = [...dialog.current.querySelectorAll('button:not(:disabled), input:not(:disabled), textarea:not(:disabled)')];
    const first = items[0]; const last = items[items.length - 1];
    if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog.current)) { event.preventDefault(); last?.focus(); }
    if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  };
  return <Overlay><Dialog ref={dialog} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="unapplication-title" onKeyDown={keyDown}>
    <h2 id="unapplication-title">Desfazer pagamento</h2>
    <p><strong>{target.patientName}</strong> · {target.chargeName}</p>
    <p>Escolha uma baixa desta cobrança. O recebimento real permanece registrado; somente o dinheiro aplicado aqui volta ao crédito disponível. As outras cobranças da mesma operação permanecem preservadas.</p>
    <p>Não haverá devolução de dinheiro nem cancelamento de sessões, plano ou direitos.</p>
    {!preview && <>
      {operations?.length === 0 && <p>Nenhuma baixa monetária foi encontrada nesta cobrança.</p>}
      {operations?.map((row) => <Option key={row.operation_key}>
        <label htmlFor={`unapplication-${row.operation_key}`}><input id={`unapplication-${row.operation_key}`} type="radio" name="payment-operation" checked={selected === row.operation_key} disabled={busy || !row.eligible}
          onChange={() => setSelected(row.operation_key)} /> {row.label} — {formatCurrency(row.amount_cents)}</label>
        {row.occurred_at && <small>Data da baixa: {formatFinancialInstant(row.occurred_at, "dd/MM/yyyy HH:mm")}</small>}
        {row.blockers.map((message) => <small key={message}>{message}</small>)}
      </Option>)}
      {operations && <Field htmlFor="unapplication-reason">Motivo do desfazimento
        <textarea id="unapplication-reason" aria-label="Motivo do desfazimento" rows={3} maxLength={1000} value={reason} disabled={busy} onChange={(event) => setReason(event.target.value)} />
        <FieldHint>Obrigatório. A baixa escolhida será desfeita integralmente nesta cobrança.</FieldHint>
      </Field>}
    </>}
    {preview && <section aria-label="Conferir desfazimento">
      <p>Baixa: <strong>{operations?.find((row) => row.operation_key === selected)?.label}</strong></p>
      <p>Motivo: {reason.trim()}</p>
      <p>Crédito a restaurar: <strong>{formatCurrency(preview.amount_cents)}</strong></p>
      <p>Crédito disponível após confirmar: <strong>{formatCurrency(preview.credit_after_cents)}</strong></p>
      {preview.discount_cents > 0 && <p>Desconto a desfazer: {formatCurrency(preview.discount_cents)}. Desconto não vira crédito.</p>}
      {preview.surcharge_cents > 0 && <p>Acréscimo a desfazer: {formatCurrency(preview.surcharge_cents)}.</p>}
    </section>}
    {busy && <p role="status">Conferindo...</p>}
    {error && <Notice role="alert">{error}</Notice>}
    <Actions>
      <GhostButton type="button" disabled={busy || uncertain} onClick={onClose}>Cancelar</GhostButton>
      {!operations && !busy && <GhostButton type="button" onClick={load}>Tentar novamente</GhostButton>}
      {preview ? <>
        <GhostButton type="button" disabled={busy || uncertain} onClick={() => { setPreview(null); attempt.current = null; }}>Voltar</GhostButton>
        <PrimaryButton type="button" disabled={busy} onClick={confirm}>{uncertain ? 'Verificar resultado' : 'Confirmar desfazimento'}</PrimaryButton>
      </> : operations && <PrimaryButton type="button" disabled={busy || !selected || !reason.trim()} onClick={advance}>Conferir desfazimento</PrimaryButton>}
    </Actions>
  </Dialog></Overlay>;
}
FinancialPaymentUnapplicationModal.propTypes = {
  target: PropTypes.shape({ query: PropTypes.shape({ patient_id: PropTypes.number.isRequired, charge_key: PropTypes.string.isRequired, period_start: PropTypes.string.isRequired, period_end: PropTypes.string.isRequired }).isRequired, patientName: PropTypes.string.isRequired, chargeName: PropTypes.string.isRequired }).isRequired,
  formatCurrency: PropTypes.func.isRequired, onClose: PropTypes.func.isRequired, onCompleted: PropTypes.func.isRequired,
};
const Overlay = styled.div`position: fixed; inset: 0; z-index: 1400; background: rgba(0,0,0,.38); display: flex; align-items: center; justify-content: center; padding: 18px;`;
const Dialog = styled.div`background: white; color: #28372c; border-radius: 16px; padding: 24px; width: min(100%, 560px); max-height: 90vh; overflow-y: auto; h2 { margin-top: 0; } p { line-height: 1.5; }`;
const Option = styled.div`margin: 12px 0; small { display: block; margin: 4px 0; }`;
const Notice = styled.p`color: #80401d; background: #fff4e8; padding: 12px; border-radius: 8px;`;
const Actions = styled.div`display: flex; justify-content: flex-end; gap: 12px; margin-top: 20px; flex-wrap: wrap;`;
