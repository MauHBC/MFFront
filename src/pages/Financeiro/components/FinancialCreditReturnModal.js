import React, { useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import styled from 'styled-components';
import { v4 as uuidv4 } from 'uuid';
import { PrimaryButton, GhostButton } from '../../../components/AppButton';
import { CurrencyInput, CurrencyInputGroup, CurrencyPrefix, PaymentField, PaymentLabel, PaymentTextArea } from './FinancialPaymentModal';
import { parseCurrencyInputToCents, sanitizePositiveCurrencyInput } from '../helpers/expenseFormatters';
import { colors } from '../../../styles/tokens';
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
  let actionLabel = 'Avançar';
  if (preview) actionLabel = uncertain ? 'Tentar novamente' : 'Confirmar';
  if (busy) actionLabel = 'Aguarde…';
  return <Overlay><Dialog ref={dialog} role="dialog" aria-modal="true" aria-labelledby="credit-return-title" tabIndex={-1} onKeyDown={keyDown}>
    <Header><h2 id="credit-return-title">Devolver valor</h2>
      <PatientName>{preview?.patient?.full_name || target.patientName}</PatientName>
    </Header>
    <Body>
    {preview ? <>
      <Summary>
        <SummaryLine><span>Crédito disponível:</span> <strong>{formatCurrency(preview.credit_before_cents)}</strong></SummaryLine>
        <SummaryLine><span>Valor da devolução:</span> <strong>{formatCurrency(preview.amount_cents)}</strong></SummaryLine>
        <SummaryLine><span>Saldo após a devolução:</span> <strong>{formatCurrency(preview.credit_after_cents)}</strong></SummaryLine>
      </Summary>
      <ReasonSummary><PaymentLabel as="span">Motivo</PaymentLabel><p>{preview.reason}</p></ReasonSummary>
    </> : <>
      <SummaryLine><span>Crédito disponível:</span> <strong>{formatCurrency(target.creditAvailableCents)}</strong></SummaryLine>
      <Field><PaymentLabel htmlFor="credit-return-amount">Valor da devolução</PaymentLabel>
        <CurrencyInputGroup><CurrencyPrefix aria-hidden="true">R$</CurrencyPrefix><CurrencyInput id="credit-return-amount" inputMode="decimal" value={amount} disabled={busy} onChange={(event) => setAmount(sanitizePositiveCurrencyInput(event.target.value))} /></CurrencyInputGroup>
      {validMoney(value) && value <= target.creditAvailableCents && <RemainingLine><span>Saldo após a devolução:</span> <strong>{formatCurrency(target.creditAvailableCents - value)}</strong></RemainingLine>}
      {value > target.creditAvailableCents && <p role="alert">O valor não pode ultrapassar o crédito disponível.</p>}
      </Field>
      <Field><PaymentLabel htmlFor="credit-return-reason">Motivo</PaymentLabel><PaymentTextArea id="credit-return-reason" aria-required="true" maxLength={1000} value={reason} disabled={busy} onChange={(event) => setReason(event.target.value)} /></Field>
    </>}
    {error && <p role="alert">{error}</p>}
    </Body>
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
const Dialog = styled.div`background: ${colors.surface}; color: ${colors.textPrimary}; border-radius: 16px; width: min(100%, 560px); max-height: 92dvh; min-height: 0; display: flex; flex-direction: column; overflow: hidden; p { margin: 0; line-height: 1.5; overflow-wrap: anywhere; }`;
const Header = styled.div`padding: 18px 20px 16px; border-bottom: 1px solid ${colors.borderSubtle}; flex-shrink: 0; h2 { margin: 0 0 8px; font-size: 20px; }`;
const PatientName = styled.p`color: ${colors.textSecondary};`;
const Body = styled.div`padding: 20px; display: flex; flex-direction: column; gap: 20px; overflow-y: auto; min-height: 0; @media (max-width: 440px) { padding: 16px; gap: 16px; }`;
const Field = styled(PaymentField)`display: flex; flex-direction: column; gap: 8px; margin: 0; min-width: 0;`;
const Summary = styled.div`display: flex; flex-direction: column; gap: 12px;`;
const SummaryLine = styled.p`display: flex; justify-content: space-between; align-items: baseline; gap: 8px 16px; flex-wrap: wrap; strong { white-space: nowrap; }`;
const RemainingLine = styled(SummaryLine)`font-size: 14px; color: ${colors.textSecondary};`;
const ReasonSummary = styled.div`display: flex; flex-direction: column; gap: 8px;`;
const Actions = styled.div`padding: 16px 20px; border-top: 1px solid ${colors.borderSubtle}; display: flex; justify-content: flex-end; gap: 12px; flex-shrink: 0; flex-wrap: wrap; @media (max-width: 440px) { padding: 12px 16px; button { white-space: normal; } }`;
