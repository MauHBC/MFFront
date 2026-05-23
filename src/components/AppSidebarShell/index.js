import styled from "styled-components";
import { colors, layout } from "../../styles/tokens";

/**
 * Shell de layout para módulos com sidebar lateral colapsável.
 */

export const SidebarShellWrapper = styled.div`
  min-height: 100vh;
  background: ${colors.sidebarBackground};
  --topbar-height: ${layout.topbarHeight};
  --sidebar-width: ${(p) =>
    p.$collapsed ? layout.sidebarCollapsedWidth : layout.sidebarWidth};
  padding-top: var(--topbar-height);
`;

export const SidebarShellLayout = styled.div`
  display: flex;
  align-items: stretch;
  width: 100%;
  min-height: calc(100vh - var(--topbar-height));
  box-sizing: border-box;
  padding-left: var(--sidebar-width);

  @media (max-width: ${layout.sidebarBreakpoint}) {
    flex-direction: column;
    padding-left: 0;
  }
`;

export const SidebarMainArea = styled.div`
  display: flex;
  flex-direction: column;
  gap: 24px;
  flex: 1;
  padding: 24px 32px 64px;
  min-width: 0;

  @media (max-width: ${layout.sidebarBreakpoint}) {
    padding: 24px 20px 64px;
  }
`;
