import React, { useEffect, useRef, useState } from "react";
import PropTypes from "prop-types";
import styled from "styled-components";
import { v4 as uuidv4 } from "uuid";
import { PrimaryButton, GhostButton } from "../../../components/AppButton";
import { Field, FieldHint } from "../../../components/AppForm";
import { getFinancialReceiptDetails, voidFinancialPayment } from "../../../services/financial";
import { getUserFacingApiError } from "../../../services/axios";
import { formatCivilDate } from "../../../utils/canonicalDateTime";
import { formatFinancialInstant, parseFinancialHistoricalValue } from "../helpers/financialDateTime";

const paymentDate = (value) => {
  const parsed = parseFinancialHistoricalValue(value);
  if (!parsed) return "Data não registrada";
  return parsed.dateOnly ? formatCivilDate(parsed.dateOnly) : formatFinancialInstant(parsed.date, "dd/MM/yyyy");
};

export default function FinancialPaymentVoidModal({ target, formatCurrency, onClose, onCompleted }) {
  const [payment, setPayment] = useState(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [uncertain, setUncertain] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const attempt = useRef(null);
  const inFlight = useRef(false);
  const mounted = useRef(false);
  const input = useRef(null);
  const dialog = useRef(null);
  useEffect(() => {
    mounted.current = true;
    const previousFocus = document.activeElement;
    dialog.current?.focus();
    getFinancialReceiptDetails(target.paymentId).then(({ data }) => {
      if (!mounted.current) return;
      if (Number(data?.id) !== target.paymentId || Number(data?.patient_id) !== target.patientId
        || !Number.isSafeInteger(Number(data?.amount_cents)) || Number(data.amount_cents) <= 0
        || typeof data.voided !== "boolean") throw new Error("Invalid payment");
      setPayment(data);
    }).catch(() => {
      if (mounted.current) {
        setLoadFailed(true);
        setError("Não foi possível conferir este recebimento. Volte ao Histórico e tente novamente.");
      }
    });
    return () => { mounted.current = false; previousFocus?.focus?.(); };
  }, [target.paymentId, target.patientId]);
  useEffect(() => { if (payment && !payment.voided) input.current?.focus(); }, [payment]);
  const confirm = async () => {
    if (inFlight.current || !payment || payment.voided) return;
    if (!attempt.current) {
      if (!reason.trim()) { setError("Informe o motivo da anulação."); input.current?.focus(); return; }
      attempt.current = { key: uuidv4(), body: { correction_type: "VOID_WRONG_PAYMENT", reason: reason.trim() } };
    }
    inFlight.current = true;
    setBusy(true);
    setError("");
    try {
      const { data } = await voidFinancialPayment(target.paymentId, attempt.current.body, attempt.current.key);
      if (Number(data?.payment_id) !== target.paymentId || data?.correction_type !== "VOID_WRONG_PAYMENT"
        || Number(data?.amount_cents) !== Number(payment.amount_cents)) throw new Error("Invalid confirmation");
      if (mounted.current) onCompleted();
    } catch (failure) {
      if (!mounted.current) return;
      if (failure?.response?.data?.code === "FINANCIAL_PAYMENT_ALREADY_VOIDED") {
        onCompleted();
        return;
      }
      // Timeout, network errors and server failures retain the exact attempt.
      const ambiguous = !failure?.response || failure.response.status >= 500;
      setUncertain(ambiguous);
      if (!ambiguous) attempt.current = null;
      setError(getUserFacingApiError(failure, ambiguous
        ? "O resultado ainda não foi confirmado. Verifique a mesma tentativa antes de sair."
        : "Não foi possível anular o recebimento."));
    } finally {
      inFlight.current = false;
      if (mounted.current) setBusy(false);
    }
  };
  const keepFocus = (event) => {
    if (event.key === "Escape" && !busy && !uncertain) { event.preventDefault(); onClose(); }
    if (event.key !== "Tab") return;
    const focusable = [...dialog.current.querySelectorAll("button:not(:disabled), textarea:not(:disabled)")];
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  };
  let confirmLabel = uncertain ? "Verificar resultado" : "Confirmar anulação integral";
  if (busy) confirmLabel = "Confirmando...";
  return <Overlay>
    <Dialog ref={dialog} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="payment-void-title" onKeyDown={keepFocus}>
      <h2 id="payment-void-title">Anular recebimento</h2>
      <p><strong>{target.patientName}</strong> · Recebimento #{target.paymentId}</p>
      {!payment && !loadFailed && <p role="status">Conferindo recebimento...</p>}
      {payment && <>
        <p>Valor integral: <strong>{formatCurrency(Number(payment.amount_cents))}</strong><br />
          Recebido em {paymentDate(payment.paid_at)}</p>
        {payment.voided ? <p role="status">Este recebimento já foi anulado.</p> : <>
          <p>Use esta ação para um recebimento lançado errado. O original, as aplicações e o motivo serão preservados no Histórico. As cobranças afetadas serão recalculadas; obrigações encerradas definitivamente permanecem canceladas.</p>
          <p>Esta ação não devolve dinheiro. Plano, ciclo, cobertura e sessões da mensalidade permanecem preservados. Se necessário, registre o recebimento correto separadamente.</p>
          <Field htmlFor="payment-void-reason">Motivo da anulação
            <textarea ref={input} id="payment-void-reason" rows={3} maxLength={1000}
              value={reason} disabled={busy || uncertain} onChange={(event) => setReason(event.target.value)} />
            <FieldHint>Obrigatório. A anulação é integral e não pode ser desfeita nesta tela.</FieldHint>
          </Field>
        </>}
      </>}
      {error && <Notice role="alert">{error}</Notice>}
      <Actions>
        <GhostButton type="button" disabled={busy || uncertain} onClick={onClose}>Voltar</GhostButton>
        {payment && !payment.voided && <PrimaryButton type="button" disabled={busy || (!uncertain && !reason.trim())} onClick={confirm}>
          {confirmLabel}
        </PrimaryButton>}
      </Actions>
    </Dialog>
  </Overlay>;
}
FinancialPaymentVoidModal.propTypes = {
  target: PropTypes.shape({ paymentId: PropTypes.number.isRequired, patientId: PropTypes.number.isRequired, patientName: PropTypes.string.isRequired }).isRequired,
  formatCurrency: PropTypes.func.isRequired,
  onClose: PropTypes.func.isRequired,
  onCompleted: PropTypes.func.isRequired,
};
const Overlay = styled.div`
  position: fixed; inset: 0; z-index: 1400; background: rgba(0,0,0,.38);
  display: flex; align-items: center; justify-content: center; padding: 18px;
`;
const Dialog = styled.div`
  background: white; color: #28372c; border-radius: 16px; padding: 24px;
  width: min(100%, 520px); max-height: 90vh; overflow-y: auto;
  h2 { margin-top: 0; } p { line-height: 1.5; }
`;
const Notice = styled.p`color: #80401d; background: #fff4e8; padding: 12px; border-radius: 8px;`;
const Actions = styled.div`display: flex; justify-content: flex-end; gap: 12px; margin-top: 20px; flex-wrap: wrap;`;
