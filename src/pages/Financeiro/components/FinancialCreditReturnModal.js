import React, { useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import styled from 'styled-components';
import { v4 as uuidv4 } from 'uuid';
import { PrimaryButton, GhostButton } from '../../../components/AppButton';
import { CurrencyInput, CurrencyInputGroup, CurrencyPrefix, PaymentField, PaymentLabel, PaymentTextArea } from './FinancialPaymentModal';
import { parseCurrencyInputToCents, sanitizePositiveCurrencyInput, formatCurrencyInputFromCents } from '../helpers/expenseFormatters';
import { getUserFacingApiError } from '../../../services/axios';
import { previewCreditReturn, confirmCreditReturn } from '../../../services/financialCreditReturn';

const validMoney = (value) => Number.isSafeInteger(value) && value >= 0;
export default function FinancialCreditReturnModal({ target, formatCurrency, onClose, onCompleted }) {
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [uncertain, setUncertain] = useState(false);
  const dialog = useRef(null);
  const mounted = useRef(false);
  const inFlight = useRef(false);
  const attempt = useRef(null);
  const value = parseCurrencyInputToCents(amount);
  const valid = Number.isSafeInteger(value) && value > 0 && value <= target.creditAvailableCents && reason.trim().length > 0;
  useEffect(() => {
    mounted.current = true;
    const prior = document.activeElement;
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden'; dialog.current?.focus();
    return () => { mounted.current = false; document.body.style.overflow = overflow; if (prior?.isConnected) prior.focus(); };
  }, []);
  const advance = async () => {
    if (inFlight.current || !valid) return;
    inFlight.current = true; setBusy(true); setError('');
    const body = { patient_id: target.patientId, amount_cents: value, reason: reason.trim() };
    try {
      const { data } = await previewCreditReturn(body);
      if (data.patient?.id !== target.patientId || data.amount_cents !== value || !data.preview_fingerprint
        || !validMoney(data.credit_before_cents) || !validMoney(data.credit_after_cents)
        || data.credit_after_cents !== data.credit_before_cents - value) throw new Error('Invalid preview');
      if (mounted.current) { attempt.current = { body: { ...body, preview_fingerprint: data.preview_fingerprint }, key: uuidv4() }; setPreview(data); }
    } catch (failure) { if (mounted.current) setError(getUserFacingApiError(failure, 'Não foi possível conferir o crédito. Atualize o saldo e tente novamente.')); }
    finally { inFlight.current = false; if (mounted.current) setBusy(false); }
  };
  const confirm = async () => {
    if (inFlight.current || !attempt.current) return;
    inFlight.current = true; setBusy(true); setError('');
    try {
      const { data } = await confirmCreditReturn(attempt.current.body, attempt.current.key);
      if (data.patient?.id !== target.patientId || data.amount_cents !== preview.amount_cents
        || data.credit_after_cents !== preview.credit_after_cents || !data.id) throw new Error('Invalid confirmation');
      if (mounted.current) await onCompleted(data);
    } catch (failure) {
      if (mounted.current) {
        const unknown = !failure.response || failure.response.status >= 500;
        setUncertain(unknown);
        setError(getUserFacingApiError(failure, unknown ? 'Resultado ainda não confirmado. Tente novamente para consultar a mesma operação.' : 'A devolução não foi registrada. Confira uma nova prévia.'));
        if (!unknown) { setPreview(null); attempt.current = null; }
      }
    } finally { inFlight.current = false; if (mounted.current) setBusy(false); }
  };
  const keyDown = (event) => {
    if (event.key === 'Escape' && !inFlight.current) onClose();
    if (event.key === 'Tab') {
      const controls = dialog.current.querySelectorAll('button:not([disabled]), input:not([disabled]), textarea:not([disabled])');
      const first = controls[0]; const last = controls[controls.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog.current)) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }
  };
  let actionLabel = 'Conferir devolução';
  if (preview) actionLabel = uncertain ? 'Tentar novamente' : 'Confirmar devolução de crédito';
  if (busy) actionLabel = 'Aguarde…';
  return <Overlay><Dialog ref={dialog} role="dialog" aria-modal="true" aria-labelledby="credit-return-title" tabIndex={-1} onKeyDown={keyDown}>
    <h2 id="credit-return-title">Registrar devolução de crédito</h2>
    <p><strong>{preview?.patient?.full_name || target.patientName}</strong></p>
    <Notice>Esta ação registra a retirada do crédito no sistema. Nenhuma transferência ou reembolso bancário será realizado.</Notice>
    {preview ? <>
      <p>Crédito disponível: <strong>{formatCurrency(preview.credit_before_cents)}</strong></p>
      <p>Devolução a registrar: <strong>{formatCurrency(preview.amount_cents)}</strong></p>
      <p>Saldo após o registro: <strong>{formatCurrency(preview.credit_after_cents)}</strong></p>
      <p>Motivo: {preview.reason}</p>
      <p>Confirme somente após conferir o paciente e o valor.</p>
    </> : <>
      <p>Crédito disponível: <strong>{formatCurrency(target.creditAvailableCents)}</strong></p>
      <PaymentField><PaymentLabel htmlFor="credit-return-amount">Valor da devolução</PaymentLabel>
        <CurrencyInputGroup><CurrencyPrefix aria-hidden="true">R$</CurrencyPrefix><CurrencyInput id="credit-return-amount" inputMode="decimal" value={amount} disabled={busy} onChange={(event) => setAmount(sanitizePositiveCurrencyInput(event.target.value))} /></CurrencyInputGroup>
        <GhostButton type="button" disabled={busy} onClick={() => setAmount(formatCurrencyInputFromCents(target.creditAvailableCents))}>Usar saldo total</GhostButton>
      </PaymentField>
      {value > target.creditAvailableCents && <p role="alert">O valor não pode ultrapassar o crédito disponível.</p>}
      <PaymentField><PaymentLabel htmlFor="credit-return-reason">Motivo obrigatório</PaymentLabel><PaymentTextArea id="credit-return-reason" maxLength={1000} value={reason} disabled={busy} onChange={(event) => setReason(event.target.value)} /></PaymentField>
    </>}
    {error && <p role="alert">{error}</p>}
    <Actions><GhostButton type="button" disabled={busy} onClick={onClose}>Fechar</GhostButton>
      {preview && !uncertain && <GhostButton type="button" disabled={busy} onClick={() => { setPreview(null); attempt.current = null; }}>Editar</GhostButton>}
      <PrimaryButton type="button" disabled={busy || (!preview && !valid)} onClick={preview ? confirm : advance}>{actionLabel}</PrimaryButton>
    </Actions>
  </Dialog></Overlay>;
}
FinancialCreditReturnModal.propTypes = {
  target: PropTypes.shape({ patientId: PropTypes.number.isRequired, patientName: PropTypes.string.isRequired, creditAvailableCents: PropTypes.number.isRequired }).isRequired,
  formatCurrency: PropTypes.func.isRequired, onClose: PropTypes.func.isRequired, onCompleted: PropTypes.func.isRequired,
};
const Overlay = styled.div`position: fixed; inset: 0; z-index: 1400; background: rgba(0,0,0,.38); display: flex; align-items: center; justify-content: center; padding: 18px;`;
const Dialog = styled.div`background: white; color: #1b1b1b; border-radius: 16px; padding: 20px; width: min(100%, 560px); max-height: 90vh; overflow-y: auto; h2 { margin: 0 0 12px; font-size: 20px; } p { line-height: 1.5; overflow-wrap: anywhere; }`;
const Notice = styled.p`color: #80401d; background: #fff4e8; padding: 12px; border-radius: 8px;`;
const Actions = styled.div`display: flex; justify-content: flex-end; gap: 12px; margin-top: 20px; flex-wrap: wrap;`;
