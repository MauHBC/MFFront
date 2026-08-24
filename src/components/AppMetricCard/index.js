import React from "react";
import PropTypes from "prop-types";
import styled, { css } from "styled-components";

import {
  alpha,
  colors,
  fontSizes,
  radii,
  shadows,
} from "../../styles/tokens";

export function AppMetricCard({
  label,
  value,
  compact,
  attention,
  onClick,
  ariaLabel,
}) {
  const interactive = typeof onClick === "function";

  return (
    <MetricCardSurface
      as={interactive ? "button" : "div"}
      type={interactive ? "button" : undefined}
      $compact={compact}
      $interactive={interactive}
      $attention={attention}
      onClick={onClick}
      aria-label={ariaLabel}
    >
      <MetricCardLabel $compact={compact}>{label}</MetricCardLabel>
      <MetricCardValue $compact={compact}>{value}</MetricCardValue>
    </MetricCardSurface>
  );
}

AppMetricCard.propTypes = {
  label: PropTypes.node.isRequired,
  value: PropTypes.node.isRequired,
  compact: PropTypes.bool.isRequired,
  attention: PropTypes.bool.isRequired,
  onClick: PropTypes.func.isRequired,
  ariaLabel: PropTypes.string.isRequired,
};

export const MetricCardSurface = styled.div`
  appearance: none;
  background: var(--app-metric-card-background, ${colors.surfaceSecondary});
  border: 1px solid var(--app-metric-card-border, ${colors.borderSubtle});
  border-radius: var(--app-metric-card-radius, ${radii.md});
  color: inherit;
  font-family: inherit;
  padding: ${(props) => (
    props.$compact ? "10px 12px" : "var(--app-metric-card-padding, 16px)"
  )};
  position: relative;
  text-align: left;
  width: 100%;

  ${(props) => props.$attention && css`
    background: ${alpha.paused018};
    border-color: rgba(165, 102, 8, 0.28);
  `}

  ${(props) => props.$interactive && css`
    cursor: pointer;
    transition: border-color 160ms ease, box-shadow 160ms ease, transform 160ms ease;

    &:hover {
      border-color: ${alpha.brand030};
      box-shadow: ${shadows.subtle};
      transform: translateY(-1px);
    }

    &:focus-visible {
      outline: 3px solid ${colors.focus};
      outline-offset: 2px;
    }
  `}
`;

export const MetricCardLabel = styled.span`
  color: var(--app-metric-label-color, ${colors.textMuted});
  display: block;
  font-size: ${(props) => (
    props.$compact ? fontSizes.tiny : "var(--app-metric-label-size, 0.75rem)"
  )};
  font-weight: var(--app-metric-label-weight, 600);
  letter-spacing: 0.05em;
  line-height: var(--app-metric-label-line-height, 1.35);
  text-transform: uppercase;
`;

export const MetricCardValue = styled.strong`
  color: var(--app-metric-value-color, ${colors.textPrimary});
  display: block;
  font-size: ${(props) => (
    props.$compact ? "1.35rem" : "var(--app-metric-value-size, 1.125rem)"
  )};
  font-weight: var(--app-metric-value-weight, 600);
  line-height: var(--app-metric-value-line-height, 1.35);
  margin-top: ${(props) => (
    props.$compact ? "2px" : "var(--app-metric-value-margin-top, 8px)"
  )};
`;
