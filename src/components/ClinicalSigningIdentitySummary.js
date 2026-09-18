import React from "react";
import PropTypes from "prop-types";

export default function ClinicalSigningIdentitySummary({ identity }) {
  const verified = identity.verification_status === "verified"
    && identity.registration_region && identity.registration_number;
  const pending = identity.eligibility === "temporary_trial_owner"
    ? "Credenciais profissionais pendentes — uso liberado durante o teste gratuito."
    : "Credenciais profissionais pendentes.";
  return <span>{identity.name} · {verified
    ? `CREFITO-${identity.registration_region} nº ${identity.registration_number} · identidade verificada`
    : pending}</span>;
}

ClinicalSigningIdentitySummary.propTypes = {
  identity: PropTypes.shape({
    name: PropTypes.string,
    eligibility: PropTypes.string,
    verification_status: PropTypes.string,
    registration_region: PropTypes.string,
    registration_number: PropTypes.string,
  }).isRequired,
};
