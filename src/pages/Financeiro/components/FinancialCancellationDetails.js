import React from "react";
import PropTypes from "prop-types";
import styled from "styled-components";
import { GhostButton } from "../../../components/AppButton";
import { formatFinancialEventDate } from "./FinancialHistory";

const belongsToPackage = (record, packageItem) => {
  if (!packageItem) return true;
  if (packageItem.kind === "series")
    return Number(record.series_id) === Number(packageItem.sourceId);
  if (packageItem.kind === "entry")
    return Number(record.entry_id) === Number(packageItem.sourceId);
  return (
    Number(record.session_id || record.source_session_id) ===
    Number(packageItem.sourceId)
  );
};

export default function FinancialCancellationDetails({
  pendingResolutions,
  packageItem,
  canResolve,
  onResolve,
}) {
  // Only the server's actual pending work enables a financial action. General
  // cancellation eligibility must never become a permanent list of charges.
  const pending = pendingResolutions.filter((item) =>
    belongsToPackage(item, packageItem),
  );
  if (!pending.length) return null;
  return (
    <Section aria-label="Situação do acerto financeiro">
      {pending.map((item) => (
        <Notice key={item.entry_id}>
          <span>
            {item.session_starts_at
              ? `Sessão de ${formatFinancialEventDate(item.session_starts_at, { dateOnly: true })}: `
              : "Sessão cancelada: "}
            acerto financeiro pendente.
          </span>
          {canResolve && item.can_resolve === true && (
            <GhostButton type="button" onClick={() => onResolve(item)}>
              Resolver pendência
            </GhostButton>
          )}
        </Notice>
      ))}
    </Section>
  );
}

FinancialCancellationDetails.propTypes = {
  pendingResolutions: PropTypes.arrayOf(
    PropTypes.shape({
      entry_id: PropTypes.number.isRequired,
      series_id: PropTypes.number,
      session_id: PropTypes.number,
      source_session_id: PropTypes.number,
      session_starts_at: PropTypes.string,
      can_resolve: PropTypes.bool,
    }),
  ),
  packageItem: PropTypes.shape({
    kind: PropTypes.string,
    sourceId: PropTypes.number,
  }),
  canResolve: PropTypes.bool.isRequired,
  onResolve: PropTypes.func.isRequired,
};
FinancialCancellationDetails.defaultProps = {
  pendingResolutions: [],
  packageItem: null,
};
const Section = styled.section`
  margin-top: 12px;
  color: #59645d;
  font-size: 0.875rem;
`;
const Notice = styled.div`
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px 12px;
  line-height: 1.5;
`;
