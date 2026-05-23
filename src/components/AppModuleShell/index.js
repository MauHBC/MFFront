import styled from "styled-components";
import { alpha, colors, fontSizes, layout, radii } from "../../styles/tokens";

/**
 * Shell visual dos módulos administrativos do app.
 *
 * Padrão de referência: Planos / Agendamentos.
 */

export const ModuleHeader = styled.div`
  margin-bottom: 24px;
`;

export const ModuleTitle = styled.h1`
  font-size: ${fontSizes.title};
  font-weight: 800;
  color: ${colors.ink};
  margin: 0;

  @media (max-width: ${layout.moduleBreakpoint}) {
    font-size: ${fontSizes.titleMobile};
  }
`;

export const ModuleSubtitle = styled.p`
  font-size: 0.938rem;
  color: ${colors.brand};
  margin: 6px 0 0;

  @media (max-width: ${layout.moduleBreakpoint}) {
    font-size: 0.813rem;
  }
`;

export const ModuleActions = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  margin-top: 12px;
`;

export const ModuleTabs = styled.div`
  display: flex;
  border-bottom: 2px solid ${alpha.brand014};
  margin-bottom: 24px;
  gap: 0;
`;

export const ModuleTabButton = styled.button`
  padding: 10px 22px;
  font-size: ${fontSizes.body};
  font-weight: 700;
  color: ${(p) => (p.$active ? colors.brandDark : colors.brand)};
  border: none;
  border-bottom: 2px solid ${(p) => (p.$active ? colors.brand : "transparent")};
  background: transparent;
  cursor: pointer;
  margin-bottom: -2px;
  transition: color 0.15s;

  &:hover {
    color: ${colors.brandDark};
  }
`;

export const ModuleBody = styled.div``;

export const ModulePanel = styled.div`
  background: ${colors.white};
  border: 1px solid ${alpha.brand014};
  border-radius: ${radii.lg};
  padding: 20px 24px;
`;
