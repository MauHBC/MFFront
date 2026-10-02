import React from "react";
import PropTypes from "prop-types";

const cents = (value) => Number.isSafeInteger(value) && value >= 0;
const identifier = (value) => Number.isSafeInteger(value) && value > 0;
const validDate = (value) => typeof value === "string" && value.length > 0
  && !Number.isNaN(new Date(value).getTime());
const clinicalDate = (value, includeYear = false) => new Date(value).toLocaleDateString("pt-BR", {
  timeZone: "America/Sao_Paulo",
  day: "2-digit", month: "2-digit", ...(includeYear ? { year: "numeric" } : {}),
});
export const validCancellationPreview = (preview, target) => Boolean(
  preview && target
  && identifier(Number(target.financial_patient_id ?? target.patient_id))
  && typeof preview.eligible === "boolean"
  && Number(preview.patient?.id) === Number(target.financial_patient_id ?? target.patient_id)
  && (!target.attended_patient_id
    || Number(preview.session?.patient_id) === Number(target.attended_patient_id))
  && (!target.entry_id || Number(preview.entry?.id) === Number(target.entry_id))
  && (!target.session_id || Number(preview.session?.id) === Number(target.session_id))
  && Array.isArray(preview.blockers)
  && (!preview.eligible || (
    preview.blockers.length === 0
    && typeof preview.preview_fingerprint === "string" && preview.preview_fingerprint.trim().length > 0
    && identifier(preview.entry?.id)
    && identifier(preview.session?.id) && validDate(preview.session.starts_at)
    && Array.isArray(preview.affected_sessions)
    && preview.affected_sessions.every((session) => identifier(session?.id) && validDate(session.starts_at))
    && cents(preview.release_amount_cents)
    && cents(preview.credit_after_cents)
    && (preview.package === null || (
      cents(preview.package?.amount_before_cents) && cents(preview.package?.amount_after_cents)
      && preview.package.amount_after_cents <= preview.package.amount_before_cents
    ))
    && preview.consequences?.replacement_created === false
    && preview.consequences?.money_refunded === false
  ))
);

export default function SessionCancellationSummary({ preview, formatCurrency }) {
  const sessionDate = clinicalDate(preview.session.starts_at);
  return (
    <section aria-label="Prévia do cancelamento">
      <p><strong>Cancelar a sessão de {sessionDate}?</strong></p>
      {preview.package && (
        <p>O pacote passará de {formatCurrency(preview.package.amount_before_cents)} para {formatCurrency(preview.package.amount_after_cents)}.</p>
      )}
      {preview.release_amount_cents > 0 && (
        <p>{formatCurrency(preview.release_amount_cents)} ficarão como crédito para este paciente.</p>
      )}
      <p>Não haverá reposição nem devolução de dinheiro.</p>
      {(preview.affected_sessions || []).filter((session) => Number(session.id) !== Number(preview.session.id)).map((session) => (
        <p key={session.id}>A sessão agendada para {clinicalDate(session.starts_at, true)} também será cancelada.</p>
      ))}
    </section>
  );
}

SessionCancellationSummary.propTypes = {
  preview: PropTypes.shape({
    session: PropTypes.shape({ id: PropTypes.number, starts_at: PropTypes.string.isRequired }).isRequired,
    package: PropTypes.shape({ amount_before_cents: PropTypes.number.isRequired, amount_after_cents: PropTypes.number.isRequired }),
    release_amount_cents: PropTypes.number.isRequired,
    affected_sessions: PropTypes.arrayOf(PropTypes.shape({ id: PropTypes.number, starts_at: PropTypes.string })),
  }).isRequired,
  formatCurrency: PropTypes.func.isRequired,
};
