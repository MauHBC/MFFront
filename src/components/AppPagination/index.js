import React from "react";
import PropTypes from "prop-types";
import styled from "styled-components";

import { alpha, colors, radii } from "../../styles/tokens";

export default function AppPagination({
  page,
  pageSize,
  total,
  totalPages,
  loading = false,
  onPageChange,
  ariaLabel,
}) {
  if (total <= 0) return null;

  const firstItem = Math.min(((page - 1) * pageSize) + 1, total);
  const lastItem = Math.min(page * pageSize, total);
  const previousDisabled = loading || page <= 1;
  const nextDisabled = loading || totalPages <= 0 || page >= totalPages;

  return (
    <PaginationNav aria-label={ariaLabel}>
      <PaginationInfo>
        Mostrando {firstItem}-{lastItem} de {total}
      </PaginationInfo>
      <PaginationActions>
        <PaginationButton
          type="button"
          disabled={previousDisabled}
          onClick={() => onPageChange(page - 1)}
        >
          Anterior
        </PaginationButton>
        <PaginationPage aria-live="polite">
          Página {page} de {totalPages}
        </PaginationPage>
        <PaginationButton
          type="button"
          disabled={nextDisabled}
          onClick={() => onPageChange(page + 1)}
        >
          Próxima
        </PaginationButton>
      </PaginationActions>
    </PaginationNav>
  );
}

AppPagination.propTypes = {
  page: PropTypes.number.isRequired,
  pageSize: PropTypes.number.isRequired,
  total: PropTypes.number.isRequired,
  totalPages: PropTypes.number.isRequired,
  loading: PropTypes.bool,
  onPageChange: PropTypes.func.isRequired,
  ariaLabel: PropTypes.string.isRequired,
};

AppPagination.defaultProps = {
  loading: false,
};

const PaginationNav = styled.nav`
  align-items: center;
  color: ${colors.brand};
  display: flex;
  gap: 14px;
  justify-content: space-between;
  margin-top: 18px;

  @media (max-width: 620px) {
    align-items: stretch;
    flex-direction: column;
  }
`;

const PaginationInfo = styled.span`
  font-size: 0.92rem;
`;

const PaginationActions = styled.div`
  align-items: center;
  display: flex;
  gap: 8px;

  @media (max-width: 620px) {
    justify-content: space-between;
  }
`;

const PaginationButton = styled.button`
  background: ${colors.surface};
  border: 1px solid ${alpha.brand030};
  border-radius: ${radii.md};
  color: ${colors.brand};
  cursor: pointer;
  font-weight: 700;
  min-width: 92px;
  padding: 9px 12px;

  &:disabled {
    background: ${colors.disabledBackground};
    color: ${colors.disabledText};
    cursor: not-allowed;
  }

  &:not(:disabled):hover,
  &:not(:disabled):focus-visible {
    border-color: rgba(106, 121, 92, 0.55);
    box-shadow: 0 0 0 3px ${alpha.brand014};
    outline: none;
  }
`;

const PaginationPage = styled.span`
  font-size: 0.92rem;
  font-weight: 700;
  min-width: 108px;
  text-align: center;
`;
