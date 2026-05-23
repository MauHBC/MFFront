import styled from "styled-components";
import { alpha, colors, fontSizes, radii } from "../../styles/tokens";

/**
 * Badges e pills de status para módulos administrativos do app.
 */

const pillBase = `
  display: inline-block;
  padding: 3px 10px;
  border-radius: ${radii.pill};
  font-size: ${fontSizes.pill};
  font-weight: 700;
`;

export const StatusPill = styled.span`
  ${pillBase}
  background: ${(p) => {
    if (p.$tone === "active") return alpha.brand012;
    if (p.$tone === "paused") return alpha.paused018;
    return alpha.neutral014;
  }};
  color: ${(p) => {
    if (p.$tone === "active") return colors.brandDark;
    if (p.$tone === "paused") return colors.pausedText;
    return colors.neutralText;
  }};
`;

export const InfoPill = styled.span`
  ${pillBase}
  background: ${alpha.info012};
  color: ${colors.infoText};
`;

export const NeutralPill = styled.span`
  ${pillBase}
  background: ${alpha.neutral014};
  color: ${colors.neutralText};
`;
