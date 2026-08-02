import React, { useEffect, useMemo, useState } from "react";
import PropTypes from "prop-types";
import styled from "styled-components";
import { FaTimes } from "react-icons/fa";
import {
  confirmProfessionalInactivation,
  deactivateTeamPerson,
  previewProfessionalInactivation,
} from "../../services/team";
import { getUserFacingApiError } from "../../services/axios";
import {
  AppDrawer,
  DrawerBackdrop,
  DrawerBody,
  DrawerCloseBtn,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "../../components/AppDrawer";
import { GhostButton, PrimaryButton } from "../../components/AppButton";
import { colors } from "../../styles/tokens";

const CATEGORY_LABELS = {
  assignments: "responsabilidades de pacientes",
  sessions: "sessões futuras",
  series: "recorrências futuras",
  drafts: "rascunhos clínicos",
  plans: "programações pendentes de planos",
};

const BLOCKER_LABELS = {
  CLINICAL_DRAFT_REPAIR_REQUIRED: "Existem rascunhos inconsistentes que exigem correção antes da inativação.",
  PROTECTED_FUTURE_SESSION: "Existem sessões futuras com proteção operacional ou financeira.",
  INVALID_INACTIVATION_DESTINATION: "O profissional de destino não é válido para esta clínica.",
  PROFESSIONAL_DESTINATION_NOT_AUTHORIZED: "O profissional de destino não possui acesso compatível com as responsabilidades.",
  PROFESSIONAL_DESTINATION_AVAILABILITY_CONFLICT: "O profissional de destino possui conflito na agenda futura.",
  PROFESSIONAL_DESTINATION_SERVICE_INCOMPATIBLE: "O destino não é compatível com um dos serviços afetados.",
};

const COUNT_LABELS = {
  affected_patients: "Pacientes afetados",
  assignments: "Responsabilidades ativas",
  mutable_future_sessions: "Sessões futuras tratáveis",
  protected_future_sessions: "Sessões protegidas preservadas",
  blocked_operational_sessions: "Sessões protegidas que bloqueiam",
  series: "Recorrências ativas",
  drafts: "Rascunhos editáveis",
  inconsistent_drafts: "Rascunhos inconsistentes",
  events: "Eventos futuros exclusivos",
  pending_plan_changes: "Alterações pendentes de planos",
};

const resultCount = (result, key) => Array.isArray(result?.[key]) ? result[key].length : 0;

const createIdempotencyKey = () => {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `team-inactivation-${Date.now()}-${Math.random().toString(36).slice(2)}`;
};

const blockerText = (blocker) => {
  if (blocker.code === "DESTINATION_REQUIRED") {
    return `Informe um destino para ${CATEGORY_LABELS[blocker.category] || blocker.category}.`;
  }
  return BLOCKER_LABELS[blocker.code] || "O estado atual impede esta inativação com segurança.";
};

export default function ProfessionalInactivationDrawer({
  person,
  targets,
  onClose,
  onCompleted,
}) {
  const simplePersonFlow = person.professionalActive !== true;
  const [values, setValues] = useState({
    scope: "person",
    resolution: "transfer",
    targetId: "",
    reason: "",
  });
  const [preview, setPreview] = useState(null);
  const [intent, setIntent] = useState(null);
  const [idempotencyKey, setIdempotencyKey] = useState(null);
  const [confirmed, setConfirmed] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const busy = previewing || submitting;
  const blockers = preview?.blockers || [];
  const canConfirm = preview && blockers.length === 0 && confirmed && !busy;

  const targetOptions = useMemo(() => targets.filter((target) => (
    target.professionalActive
    && target.account?.isActive
    && target.effectivePermissions?.authorization_state === "authorized"
    && target.professionalId !== person.professionalId
  )), [person.professionalId, targets]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Escape" && !busy) onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [busy, onClose]);

  const change = (field, value) => {
    if (busy) return;
    setValues((current) => ({ ...current, [field]: value }));
    setPreview(null);
    setIntent(null);
    setIdempotencyKey(null);
    setConfirmed(false);
    setError("");
  };

  const buildIntent = () => {
    const transfer = values.resolution === "transfer";
    const targetId = transfer ? Number(values.targetId) : null;
    return {
      effective_at: new Date().toISOString(),
      reason: values.reason.trim(),
      deactivate_person: values.scope === "person",
      destinations: transfer ? {
        assignments: targetId,
        sessions: targetId,
        series: targetId,
        drafts: targetId,
        plans: targetId,
      } : {
        assignments: null,
        sessions: "cancel",
        series: "cancel",
      },
      overrides: {},
    };
  };

  const requestPreview = async () => {
    if (previewing || submitting) return;
    if (values.reason.trim().length < 3) {
      setError("Informe um motivo com pelo menos 3 caracteres.");
      return;
    }
    if (values.resolution === "transfer" && !Number(values.targetId)) {
      setError("Selecione o profissional que receberá as sessões e responsabilidades.");
      return;
    }
    setPreviewing(true);
    setError("");
    const nextIntent = buildIntent();
    try {
      const nextPreview = await previewProfessionalInactivation(
        person.professionalId,
        nextIntent,
      );
      setIntent(nextIntent);
      setPreview(nextPreview);
      setIdempotencyKey(createIdempotencyKey());
      setConfirmed(false);
    } catch (apiError) {
      setError(getUserFacingApiError(apiError, "Não foi possível gerar a prévia."));
    } finally {
      setPreviewing(false);
    }
  };

  const confirm = async () => {
    if (!canConfirm) return;
    setSubmitting(true);
    setError("");
    try {
      const commandResult = await confirmProfessionalInactivation(
        person.professionalId,
        {
          intent,
          previewToken: preview.preview_token,
          idempotencyKey,
        },
      );
      setResult(commandResult);
      await onCompleted();
    } catch (apiError) {
      const code = apiError?.response?.data?.error;
      const stale = [
        "PREVIEW_STATE_CHANGED",
        "PREVIEW_TOKEN_CONFLICT",
        "PREVIEW_TOKEN_INVALID_OR_EXPIRED",
      ].includes(code);
      if (stale) {
        setPreview(null);
        setIntent(null);
        setIdempotencyKey(null);
        setConfirmed(false);
      }
      const messages = {
        PREVIEW_STATE_CHANGED: "O estado mudou depois da prévia. Revise e gere uma nova prévia.",
        PREVIEW_TOKEN_CONFLICT: "A confirmação não corresponde à prévia. Gere uma nova prévia.",
        PREVIEW_TOKEN_INVALID_OR_EXPIRED: "A prévia expirou. Gere uma nova prévia.",
        LAST_ADMINISTRATOR_REQUIRED: "A clínica precisa manter pelo menos um Administrador ativo.",
        PROFESSIONAL_DESTINATION_AVAILABILITY_CONFLICT: BLOCKER_LABELS.PROFESSIONAL_DESTINATION_AVAILABILITY_CONFLICT,
        PROFESSIONAL_DESTINATION_NOT_AUTHORIZED: BLOCKER_LABELS.PROFESSIONAL_DESTINATION_NOT_AUTHORIZED,
        PROTECTED_FUTURE_SESSION_BLOCKS_INACTIVATION: BLOCKER_LABELS.PROTECTED_FUTURE_SESSION,
        IDEMPOTENCY_CONFLICT: "Esta confirmação já foi usada com outra operação.",
      };
      setError(messages[code]
        || getUserFacingApiError(apiError, "Não foi possível concluir a inativação."));
    } finally {
      setSubmitting(false);
    }
  };

  const confirmSimplePerson = async () => {
    if (!confirmed || submitting) return;
    setSubmitting(true);
    setError("");
    try {
      await deactivateTeamPerson(person.id);
      setResult({ person_inactivated: true, account_blocked: Boolean(person.account) });
      await onCompleted();
    } catch (apiError) {
      const code = apiError?.response?.data?.error;
      setError(code === "LAST_ADMINISTRATOR_REQUIRED"
        ? "A clínica precisa manter pelo menos um Administrador ativo."
        : getUserFacingApiError(apiError, "Não foi possível inativar a pessoa."));
    } finally {
      setSubmitting(false);
    }
  };

  let previewButtonLabel = "Visualizar impactos";
  if (preview) previewButtonLabel = "Atualizar prévia";
  if (previewing) previewButtonLabel = "Gerando prévia...";

  return (
    <>
      <DrawerBackdrop onClick={busy ? undefined : onClose} />
      <AppDrawer $open role="dialog" aria-modal="true" aria-labelledby="team-inactivation-title">
        <DrawerHeader>
          <DrawerTitle id="team-inactivation-title">Inativar {person.name}</DrawerTitle>
          <DrawerCloseBtn type="button" aria-label="Fechar inativação" onClick={onClose} disabled={busy}>
            <FaTimes />
          </DrawerCloseBtn>
        </DrawerHeader>
        <DrawerBody>
          {result && (
            <ResultPanel>
              <h3>Operação concluída</h3>
              {result.person_inactivated && <p>A pessoa foi inativada.</p>}
              {result.account_blocked && <p>A conta foi bloqueada e as sessões de acesso foram invalidadas.</p>}
              {resultCount(result, "canceled_session_ids") > 0 && <p>{resultCount(result, "canceled_session_ids")} sessão(ões) futura(s) cancelada(s).</p>}
              {resultCount(result, "transferred_session_ids") > 0 && <p>{resultCount(result, "transferred_session_ids")} sessão(ões) transferida(s).</p>}
              {resultCount(result, "transferred_assignment_ids") > 0 && <p>{resultCount(result, "transferred_assignment_ids")} responsabilidade(s) transferida(s).</p>}
              {resultCount(result, "preserved_session_ids") > 0 && <p>{resultCount(result, "preserved_session_ids")} sessão(ões) protegida(s) preservada(s).</p>}
            </ResultPanel>
          )}
          {!result && simplePersonFlow && (
            <Flow>
              <Notice>Esta pessoa não possui atuação profissional ativa. Nenhum atendimento ou histórico será excluído. A conta vinculada, se existir, será bloqueada.</Notice>
              <ConfirmLabel>
                <input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} disabled={busy} />
                Confirmo a inativação desta pessoa e o bloqueio de seu acesso.
              </ConfirmLabel>
            </Flow>
          )}
          {!result && !simplePersonFlow && (
            <Flow>
              <Notice>Nenhuma pessoa, atendimento, prontuário ou histórico será excluído. O backend revalidará todo o estado dentro da transação.</Notice>
              <Field>
                <span>Alcance da inativação</span>
                <label htmlFor="team-inactivation-scope-person"><input id="team-inactivation-scope-person" type="radio" name="scope" value="person" checked={values.scope === "person"} onChange={(event) => change("scope", event.target.value)} disabled={busy} /> Pessoa, atuação e acesso</label>
                <label htmlFor="team-inactivation-scope-professional"><input id="team-inactivation-scope-professional" type="radio" name="scope" value="professional" checked={values.scope === "professional"} onChange={(event) => change("scope", event.target.value)} disabled={busy} /> Somente atuação profissional</label>
              </Field>
              <Field>
                <span>Tratamento operacional</span>
                <label htmlFor="team-inactivation-resolution-transfer"><input id="team-inactivation-resolution-transfer" type="radio" name="resolution" value="transfer" checked={values.resolution === "transfer"} onChange={(event) => change("resolution", event.target.value)} disabled={busy} /> Transferir sessões e responsabilidades</label>
                <label htmlFor="team-inactivation-resolution-cancel"><input id="team-inactivation-resolution-cancel" type="radio" name="resolution" value="cancel" checked={values.resolution === "cancel"} onChange={(event) => change("resolution", event.target.value)} disabled={busy} /> Cancelar sessões futuras e encerrar responsabilidades</label>
              </Field>
              {values.resolution === "transfer" && (
                <Field>
                  <span>Profissional de destino</span>
                  <select aria-label="Profissional de destino" id="team-inactivation-target" value={values.targetId} onChange={(event) => change("targetId", event.target.value)} disabled={busy}>
                    <option value="">Selecione</option>
                    {targetOptions.map((target) => <option key={target.professionalId} value={target.professionalId}>{target.name}</option>)}
                  </select>
                </Field>
              )}
              <Field>
                <span>Motivo</span>
                <textarea aria-label="Motivo" id="team-inactivation-reason" maxLength={160} value={values.reason} onChange={(event) => change("reason", event.target.value)} disabled={busy} />
              </Field>
              <PreviewButton type="button" onClick={requestPreview} disabled={busy}>
                {previewButtonLabel}
              </PreviewButton>
              {preview && (
                <PreviewPanel>
                  <h3>Impactos encontrados</h3>
                  <CountGrid>{Object.entries(COUNT_LABELS).map(([key, label]) => (
                    <div key={key}><strong>{preview.counts?.[key] || 0}</strong><span>{label}</span></div>
                  ))}</CountGrid>
                  {blockers.length > 0 ? (
                    <Blockers role="alert">{blockers.map((blocker, index) => <li key={`${blocker.code}-${blocker.category || index}`}>{blockerText(blocker)}</li>)}</Blockers>
                  ) : (
                    <ConfirmLabel>
                      <input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} disabled={busy} />
                      Confirmo os impactos desta prévia e desejo executar a operação integralmente.
                    </ConfirmLabel>
                  )}
                </PreviewPanel>
              )}
            </Flow>
          )}
          {error && <ErrorText role="alert">{error}</ErrorText>}
        </DrawerBody>
        <DrawerFooter>
          <GhostButton type="button" onClick={onClose} disabled={busy}>{result ? "Fechar" : "Cancelar"}</GhostButton>
          {!result && simplePersonFlow && <PrimaryButton type="button" onClick={confirmSimplePerson} disabled={!confirmed || busy}>{submitting ? "Inativando..." : "Confirmar inativação"}</PrimaryButton>}
          {!result && !simplePersonFlow && <PrimaryButton type="button" onClick={confirm} disabled={!canConfirm}>{submitting ? "Executando..." : "Confirmar operação"}</PrimaryButton>}
        </DrawerFooter>
      </AppDrawer>
    </>
  );
}

ProfessionalInactivationDrawer.propTypes = {
  person: PropTypes.shape({
    id: PropTypes.number.isRequired,
    name: PropTypes.string.isRequired,
    professionalId: PropTypes.number,
    professionalActive: PropTypes.bool,
    account: PropTypes.shape({}),
    effectivePermissions: PropTypes.shape({ authorization_state: PropTypes.string }),
  }).isRequired,
  targets: PropTypes.arrayOf(PropTypes.shape({
    name: PropTypes.string.isRequired,
    professionalId: PropTypes.number,
    professionalActive: PropTypes.bool,
    account: PropTypes.shape({ isActive: PropTypes.bool }),
    effectivePermissions: PropTypes.shape({ authorization_state: PropTypes.string }),
  })).isRequired,
  onClose: PropTypes.func.isRequired,
  onCompleted: PropTypes.func.isRequired,
};

const Flow = styled.div`display: grid; gap: 18px;`;
const Notice = styled.p`margin: 0; padding: 12px; border-radius: 8px; background: #f6f8f4; color: ${colors.softText}; font-size: 0.88rem; line-height: 1.45;`;
const Field = styled.div`display: grid; gap: 8px; color: ${colors.ink}; span, > label:first-child { font-size: 0.88rem; font-weight: 700; } label { display: flex; gap: 8px; align-items: flex-start; line-height: 1.4; } select, textarea { min-height: 42px; border: 1px solid #d9ded5; border-radius: 8px; padding: 9px 12px; font: inherit; } textarea { min-height: 84px; resize: vertical; }`;
const PreviewButton = styled(PrimaryButton)`justify-self: start;`;
const PreviewPanel = styled.section`display: grid; gap: 14px; border-top: 1px solid #e8ebe5; padding-top: 16px; h3 { margin: 0; font-size: 1rem; }`;
const CountGrid = styled.div`display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; div { display: grid; gap: 2px; padding: 9px; border-radius: 8px; background: #f8f9f7; } strong { font-size: 1.05rem; } span { color: ${colors.softText}; font-size: 0.78rem; }`;
const Blockers = styled.ul`margin: 0; padding: 12px 12px 12px 30px; border-radius: 8px; background: #fff1ef; color: #8e3028; font-size: 0.86rem; li + li { margin-top: 6px; }`;
const ConfirmLabel = styled.label`display: flex; gap: 9px; align-items: flex-start; color: ${colors.ink}; font-size: 0.88rem; line-height: 1.45; input { margin-top: 3px; }`;
const ErrorText = styled.p`margin: 16px 0 0; color: #9f342b; font-size: 0.88rem; font-weight: 700;`;
const ResultPanel = styled.div`display: grid; gap: 8px; padding: 16px; border-radius: 10px; background: #f1f7ef; color: ${colors.ink}; h3, p { margin: 0; } p { color: ${colors.softText}; }`;
