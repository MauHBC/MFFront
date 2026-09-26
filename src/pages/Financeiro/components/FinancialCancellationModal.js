import React, { useEffect, useRef, useState } from "react";
import PropTypes from "prop-types";
import styled from "styled-components";
import { v4 as uuidv4 } from "uuid";
import { PrimaryButton, GhostButton } from "../../../components/AppButton";
import { getUserFacingApiError } from "../../../services/axios";
import {
  confirmFinancialCancellation,
  previewFinancialCancellation,
} from "../../../services/financialCancellation";
import SessionCancellationSummary, { validCancellationPreview } from "../../../components/SessionCancellationSummary";

export default function FinancialCancellationModal({
  target,
  formatCurrency,
  onClose,
  onCompleted,
}) {
  const [reason, setReason] = useState("");
  const [exception, setException] = useState(false);
  const [exceptionReason, setExceptionReason] = useState("");
  const [preview, setPreview] = useState(null);
  const [policy, setPolicy] = useState(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [uncertain, setUncertain] = useState(false);
  const inFlight = useRef(false);
  const attempt = useRef(null);
  const mounted = useRef(true);
  const reasonInput = useRef(null);

  useEffect(() => {
    mounted.current = true;
    reasonInput.current?.focus();
    return () => {
      mounted.current = false;
    };
  }, []);

  const invalidate = () => {
    if (uncertain) return;
    setPreview(null);
    setError("");
    attempt.current = null;
  };
  const command = () => ({
    reason: reason.trim(),
    ...(exception
      ? {
          late_policy_exception_justified: true,
          late_policy_exception_reason: exceptionReason.trim(),
        }
      : {}),
  });

  const requestPreview = async () => {
    if (inFlight.current) return;
    if (!reason.trim()) {
      setError("Informe o motivo do cancelamento financeiro.");
      return;
    }
    if (exception && !exceptionReason.trim()) {
      setError("Informe o motivo da exceção de antecedência.");
      return;
    }
    inFlight.current = true;
    setBusy("preview");
    setError("");
    setPreview(null);
    attempt.current = null;
    setUncertain(false);
    try {
      const { data } = await previewFinancialCancellation(
        target.entry_id,
        command(),
      );
      if (!mounted.current) return;
      if (!validCancellationPreview(data, target))
        throw new Error("Invalid cancellation preview");
      setPreview(data);
      setPolicy({
        required: data.requires_late_policy_exception,
        canOverride: data.can_override_late_policy,
      });
    } catch (failure) {
      if (mounted.current)
        setError(
          getUserFacingApiError(
            failure,
            "Não foi possível conferir o cancelamento. Tente novamente.",
          ),
        );
    } finally {
      inFlight.current = false;
      if (mounted.current) setBusy("");
    }
  };

  const confirm = async () => {
    if (inFlight.current || !preview?.eligible) return;
    const body = {
      ...command(),
      preview_fingerprint: preview.preview_fingerprint,
    };
    if (!attempt.current) attempt.current = { key: uuidv4(), body };
    inFlight.current = true;
    setBusy("confirm");
    setError("");
    try {
      const { data } = await confirmFinancialCancellation(
        target.entry_id,
        attempt.current.body,
        attempt.current.key,
      );
      if (
        Number(data?.entry_id) !== Number(target.entry_id) ||
        Number(data?.patient_id) !== Number(target.patient_id)
      ) {
        throw new Error("Invalid cancellation confirmation");
      }
      if (mounted.current) onCompleted(data);
    } catch (failure) {
      if (!mounted.current) return;
      const code = failure?.response?.data?.code;
      if (
        code === "CANCELLATION_PREVIEW_STALE" ||
        code === "FINANCIAL_CANCELLATION_ALREADY_RESOLVED"
      ) {
        setPreview(null);
        attempt.current = null;
        setUncertain(false);
        if (code === "FINANCIAL_CANCELLATION_ALREADY_RESOLVED") {
          onCompleted({
            entry_id: target.entry_id,
            patient_id: target.patient_id,
            already_resolved: true,
          });
        } else {
          setError("Os dados mudaram. Confira novamente os valores e impactos antes de confirmar.");
        }
      } else {
        // An ambiguous result must reuse the same key and exact command.
        setUncertain(true);
        setError(getUserFacingApiError(
          failure,
          "O resultado da tentativa ainda não foi confirmado. Verifique o resultado da mesma operação antes de editar ou sair.",
        ));
      }
    } finally {
      inFlight.current = false;
      if (mounted.current) setBusy("");
    }
  };

  let confirmLabel = "Confirmar cancelamento";
  if (uncertain) confirmLabel = "Verificar resultado";
  if (busy === "confirm") confirmLabel = "Confirmando...";

  return (
    <Overlay>
      <Dialog
        role="dialog"
        aria-modal="true"
        aria-labelledby="financial-cancellation-title"
      >
        <h2 id="financial-cancellation-title">Resolver pendência</h2>
        <p><strong>{target.patient_name}</strong></p>
        <label htmlFor="financial-cancellation-reason">
          Motivo do cancelamento
          <textarea
            ref={reasonInput}
            id="financial-cancellation-reason"
            rows={3}
            value={reason}
            disabled={Boolean(busy) || uncertain}
            onChange={(event) => {
              if (uncertain) return;
              setReason(event.target.value);
              invalidate();
            }}
          />
        </label>
        {policy?.required && policy.canOverride && (
          <PolicyBox>
            <label htmlFor="financial-cancellation-authorized-exception">
              <input
                id="financial-cancellation-authorized-exception"
                type="checkbox"
                checked={exception}
                disabled={Boolean(busy) || uncertain}
                onChange={(event) => {
                  if (uncertain) return;
                  setException(event.target.checked);
                  invalidate();
                }}
              />
              Registrar exceção autorizada de antecedência
            </label>
            {exception && (
              <label htmlFor="financial-cancellation-exception">
                Motivo da exceção
                <textarea
                  id="financial-cancellation-exception"
                  rows={2}
                  value={exceptionReason}
                  disabled={Boolean(busy) || uncertain}
                  onChange={(event) => {
                    if (uncertain) return;
                    setExceptionReason(event.target.value);
                    invalidate();
                  }}
                />
              </label>
            )}
          </PolicyBox>
        )}
        {error && <Notice role="alert">{error}</Notice>}
        {preview?.blockers.map((blocker) => (
          <Notice role="alert" key={blocker.code}>{blocker.message}</Notice>
        ))}
        {preview?.eligible && (
          <SessionCancellationSummary preview={preview} formatCurrency={formatCurrency} />
        )}
        <Actions>
          <GhostButton type="button" disabled={Boolean(busy) || uncertain} onClick={onClose}>
            Voltar
          </GhostButton>
          {!preview?.eligible ? (
            <PrimaryButton
              type="button"
              disabled={Boolean(busy)}
              onClick={requestPreview}
            >
              {busy === "preview" ? "Conferindo..." : "Conferir cancelamento"}
            </PrimaryButton>
          ) : (
            <PrimaryButton
              type="button"
              disabled={Boolean(busy)}
              onClick={confirm}
            >
              {confirmLabel}
            </PrimaryButton>
          )}
        </Actions>
      </Dialog>
    </Overlay>
  );
}

FinancialCancellationModal.propTypes = {
  target: PropTypes.shape({
    entry_id: PropTypes.number.isRequired,
    patient_id: PropTypes.number.isRequired,
    patient_name: PropTypes.string.isRequired,
  }).isRequired,
  formatCurrency: PropTypes.func.isRequired,
  onClose: PropTypes.func.isRequired,
  onCompleted: PropTypes.func.isRequired,
};

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  z-index: 1400;
  background: rgba(0, 0, 0, 0.38);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 18px;
`;
const Dialog = styled.div`
  background: white;
  color: #28372c;
  border-radius: 16px;
  padding: 24px;
  width: min(100%, 520px);
  max-height: 90vh;
  overflow-y: auto;
  h2 {
    margin-top: 0;
  }
  p {
    line-height: 1.5;
  }
  label {
    display: block;
    margin: 10px 0 6px;
    font-weight: 600;
  }
  textarea {
    box-sizing: border-box;
    width: 100%;
    padding: 10px;
    border: 1px solid #bcc7be;
    border-radius: 8px;
    resize: vertical;
  }
`;
const PolicyBox = styled.div`
  margin-top: 12px;
`;
const Notice = styled.p`
  color: #80401d;
  background: #fff4e8;
  padding: 12px;
  border-radius: 8px;
`;
const Actions = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 20px;
  flex-wrap: wrap;
`;
