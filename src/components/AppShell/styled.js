import styled, { css } from "styled-components";
import {
  colors,
  layout,
  radii,
  shadows,
  spacing,
  typography,
} from "../../styles/tokens";

const focusRing = css`
  &:focus-visible {
    outline: 3px solid ${colors.focus};
    outline-offset: 2px;
  }
`;

export const Shell = styled.div`
  --app-sidebar-width: ${(p) => (
    p.$pinned ? layout.appSidebarWidth : layout.appSidebarCollapsedWidth
  )};
  min-height: 100vh;
  background: ${colors.appBackground};
  color: ${colors.textPrimary};
  font-family: ${typography.family};
`;

export const SkipLink = styled.a`
  position: fixed;
  top: ${spacing.sm};
  left: ${spacing.sm};
  z-index: 1200;
  padding: ${spacing.sm} ${spacing.md};
  border-radius: ${radii.sm};
  background: ${colors.textPrimary};
  color: ${colors.white};
  transform: translateY(-160%);

  &:focus {
    transform: translateY(0);
  }
`;

export const Sidebar = styled.aside`
  position: fixed;
  inset: 0 auto 0 0;
  z-index: 900;
  width: var(--app-sidebar-width);
  display: flex;
  flex-direction: column;
  background: ${colors.navigationBackground};
  border-right: 1px solid ${colors.borderSubtle};
  box-shadow: ${shadows.navigation};
  transition: width 180ms ease, transform 220ms ease;

  ${(p) => p.$expanded && css`
    width: ${layout.appSidebarWidth};
    box-shadow: ${shadows.elevated};
  `}

  @media (max-width: ${layout.sidebarBreakpoint}) {
    width: min(${layout.appSidebarWidth}, 86vw);
    transform: translateX(${(p) => (p.$mobileOpen ? "0" : "-105%")});
  }

  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
`;

export const TenantArea = styled.div`
  min-height: ${layout.appHeaderHeight};
  display: flex;
  align-items: center;
  gap: ${spacing.md};
  padding: ${spacing.md};
  border-bottom: 1px solid ${colors.borderSubtle};
`;

export const TenantMark = styled.span`
  width: 40px;
  height: 40px;
  flex: 0 0 40px;
  border-radius: ${radii.md};
  display: inline-flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  background: ${colors.brand};
  color: ${colors.white};
  font-size: 0.82rem;
  font-weight: ${typography.weightBold};

  img {
    width: 100%;
    height: 100%;
    object-fit: contain;
    background: ${colors.surface};
  }
`;

export const TenantName = styled.span`
  flex: 1 1 auto;
  min-width: 0;
  color: ${colors.textPrimary};
  font-size: 0.94rem;
  line-height: 1.2;
  font-weight: ${typography.weightBold};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  display: ${(p) => (p.$expanded ? "block" : "none")};

  @media (max-width: ${layout.sidebarBreakpoint}) {
    display: block;
  }
`;

export const SidebarPinButton = styled.button`
  width: 36px;
  height: 36px;
  flex: 0 0 36px;
  display: ${(p) => (p.$expanded ? "inline-flex" : "none")};
  align-items: center;
  justify-content: center;
  margin-left: auto;
  padding: 0;
  border: 1px solid ${(p) => (p.$active ? colors.brand : colors.borderSubtle)};
  border-radius: ${radii.md};
  background: ${(p) => (p.$active ? colors.navigationActive : colors.surface)};
  color: ${(p) => (p.$active ? colors.navigationActiveText : colors.textSecondary)};
  cursor: pointer;
  transition: background 150ms ease, border-color 150ms ease, color 150ms ease;

  &:hover {
    color: ${colors.textPrimary};
    background: ${(p) => (p.$active ? colors.navigationActive : colors.navigationHover)};
  }

  ${focusRing}

  @media (max-width: ${layout.sidebarBreakpoint}) {
    display: none;
  }

  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
`;

export const CloseNavigationButton = styled.button`
  width: 40px;
  height: 40px;
  margin-left: auto;
  display: none;
  align-items: center;
  justify-content: center;
  border: 0;
  border-radius: ${radii.md};
  background: transparent;
  color: ${colors.textPrimary};
  cursor: pointer;
  ${focusRing}

  @media (max-width: ${layout.sidebarBreakpoint}) {
    display: inline-flex;
  }
`;

export const Navigation = styled.nav`
  flex: 1;
  padding: ${spacing.lg} ${spacing.md};
  overflow-y: auto;
`;

export const NavigationLabel = styled.p`
  margin: 0 0 ${spacing.sm};
  padding: 0 ${spacing.sm};
  color: ${colors.textMuted};
  font-size: 0.7rem;
  font-weight: ${typography.weightBold};
  letter-spacing: 0.08em;
  text-transform: uppercase;
  display: ${(p) => (p.$expanded ? "block" : "none")};

  @media (max-width: ${layout.sidebarBreakpoint}) {
    display: block;
  }
`;

export const NavigationList = styled.ul`
  display: grid;
  gap: ${spacing.xs};
  margin: 0;
  padding: 0;
  list-style: none;
`;

const navigationItemStyles = css`
  width: 100%;
  min-height: 44px;
  display: flex;
  align-items: center;
  gap: ${spacing.md};
  border: 0;
  border-radius: ${radii.md};
  font: inherit;
  font-weight: ${typography.weightSemibold};
  text-decoration: none;
  cursor: pointer;
  transition: background 150ms ease, color 150ms ease;

  svg {
    flex: 0 0 auto;
    font-size: 1.05rem;
  }

  ${focusRing}

  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
`;

export const NavigationLink = styled.a`
  ${navigationItemStyles}
  justify-content: ${(p) => (p.$expanded ? "flex-start" : "center")};
  padding: ${spacing.sm} ${(p) => (p.$expanded ? spacing.md : spacing.sm)};
  color: ${(p) => (p.$active ? colors.navigationActiveText : colors.textSecondary)};
  background: ${(p) => (p.$active ? colors.navigationActive : "transparent")};

  &:hover {
    color: ${(p) => (p.$active ? colors.navigationActiveText : colors.textPrimary)};
    background: ${(p) => (p.$active ? colors.navigationActive : colors.navigationHover)};
  }

  @media (max-width: ${layout.sidebarBreakpoint}) {
    justify-content: flex-start;
    padding: ${spacing.sm} ${spacing.md};
  }
`;

export const NavigationModuleButton = styled.button`
  ${navigationItemStyles}
  justify-content: ${(p) => (p.$expanded ? "flex-start" : "center")};
  padding: ${spacing.sm} ${(p) => (p.$expanded ? spacing.md : spacing.sm)};
  background: ${(p) => (p.$active ? colors.navigationActive : "transparent")};
  color: ${(p) => (p.$active ? colors.navigationActiveText : colors.textSecondary)};

  &:hover {
    color: ${(p) => (p.$active ? colors.navigationActiveText : colors.textPrimary)};
    background: ${(p) => (p.$active ? colors.navigationActive : colors.navigationHover)};
  }

  @media (max-width: ${layout.sidebarBreakpoint}) {
    justify-content: flex-start;
    padding: ${spacing.sm} ${spacing.md};
  }
`;

export const NavigationChevron = styled.span`
  margin-left: auto;
  display: ${(p) => (p.$expanded ? "inline-flex" : "none")};
  transform: rotate(${(p) => (p.$open ? "180deg" : "0deg")});
  transition: transform 150ms ease;

  @media (max-width: ${layout.sidebarBreakpoint}) {
    display: inline-flex;
  }

  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
`;

export const SubnavigationList = styled.ul`
  display: ${(p) => (p.$open && p.$expanded ? "grid" : "none")};
  gap: ${spacing.xs};
  margin: ${spacing.xs} 0 ${spacing.sm};
  padding: 0 0 0 44px;
  list-style: none;

  @media (max-width: ${layout.sidebarBreakpoint}) {
    display: ${(p) => (p.$open ? "grid" : "none")};
  }
`;

export const SubnavigationLink = styled.a`
  position: relative;
  min-height: 38px;
  display: flex;
  align-items: center;
  padding: ${spacing.xs} ${spacing.md};
  border-left: 3px solid ${(p) => (p.$active ? colors.brand : "transparent")};
  border-radius: 0 ${radii.sm} ${radii.sm} 0;
  background: ${(p) => (p.$active ? colors.navigationActive : "transparent")};
  color: ${(p) => (p.$active ? colors.navigationActiveText : colors.textSecondary)};
  font-size: 0.86rem;
  font-weight: ${(p) => (
    p.$active ? typography.weightBold : typography.weightSemibold
  )};
  text-decoration: none;

  &:hover {
    background: ${(p) => (p.$active ? colors.navigationActive : colors.navigationHover)};
    color: ${colors.textPrimary};
  }

  ${focusRing}
`;

export const SubnavigationBadge = styled.span`
  min-width: 20px;
  height: 20px;
  margin-left: auto;
  padding: 0 6px;
  border-radius: ${radii.pill};
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: ${colors.danger};
  color: ${colors.white};
  font-size: 0.7rem;
  font-weight: ${typography.weightBold};
`;

export const NavigationText = styled.span`
  display: ${(p) => (p.$expanded ? "inline" : "none")};

  @media (max-width: ${layout.sidebarBreakpoint}) {
    display: inline;
  }
`;

export const ContentColumn = styled.div`
  min-height: 100vh;
  margin-left: var(--app-sidebar-width);
  transition: margin-left 180ms ease;

  @media (max-width: ${layout.sidebarBreakpoint}) {
    margin-left: 0;
  }

  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
`;

export const Header = styled.header`
  position: sticky;
  top: 0;
  z-index: 700;
  min-height: ${layout.appHeaderHeight};
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${spacing.lg};
  padding: ${spacing.sm} ${spacing.xl};
  background: rgba(255, 255, 255, 0.94);
  border-bottom: 1px solid ${colors.borderSubtle};
  box-shadow: ${shadows.subtle};
  backdrop-filter: blur(12px);

  @media (max-width: ${layout.mobileBreakpoint}) {
    padding: ${spacing.sm} ${spacing.lg};
  }
`;

export const HeaderContext = styled.div`
  min-width: 0;
  display: flex;
  align-items: center;
  gap: ${spacing.md};
`;

export const MobileMenuButton = styled.button`
  width: 40px;
  height: 40px;
  flex: 0 0 auto;
  display: none;
  align-items: center;
  justify-content: center;
  border: 1px solid ${colors.borderSubtle};
  border-radius: ${radii.md};
  background: ${colors.surface};
  color: ${colors.textPrimary};
  cursor: pointer;
  ${focusRing}

  @media (max-width: ${layout.sidebarBreakpoint}) {
    display: inline-flex;
  }
`;

export const HeaderTitle = styled.div`
  min-width: 0;

  span {
    display: block;
    color: ${colors.textMuted};
    font-size: 0.72rem;
    font-weight: ${typography.weightBold};
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  strong {
    display: block;
    overflow: hidden;
    color: ${colors.textPrimary};
    font-size: 1.05rem;
    line-height: 1.25;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
`;

export const UserArea = styled.div`
  position: relative;
`;

export const UserButton = styled.button`
  min-height: 42px;
  max-width: 260px;
  display: flex;
  align-items: center;
  gap: ${spacing.sm};
  padding: ${spacing.sm} ${spacing.md};
  border: 1px solid ${colors.borderSubtle};
  border-radius: ${radii.pill};
  background: ${colors.surface};
  color: ${colors.textPrimary};
  cursor: pointer;
  ${focusRing}

  span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  @media (max-width: ${layout.mobileBreakpoint}) {
    width: 42px;
    padding: ${spacing.sm};
    justify-content: center;

    span,
    svg:last-child {
      display: none;
    }
  }
`;

export const UserPopover = styled.div`
  position: absolute;
  top: calc(100% + ${spacing.sm});
  right: 0;
  width: 220px;
  padding: ${spacing.sm};
  border: 1px solid ${colors.borderSubtle};
  border-radius: ${radii.lg};
  background: ${colors.surfaceElevated};
  box-shadow: ${shadows.elevated};
`;

export const UserMeta = styled.div`
  padding: ${spacing.sm} ${spacing.md} ${spacing.md};
  border-bottom: 1px solid ${colors.borderSubtle};

  small {
    display: block;
    color: ${colors.textMuted};
  }

  strong {
    display: block;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
`;

export const LogoutButton = styled.button`
  width: 100%;
  min-height: 40px;
  margin-top: ${spacing.sm};
  display: flex;
  align-items: center;
  gap: ${spacing.sm};
  padding: ${spacing.sm} ${spacing.md};
  border: 0;
  border-radius: ${radii.sm};
  background: transparent;
  color: ${colors.danger};
  cursor: pointer;
  font-weight: ${typography.weightSemibold};

  &:hover {
    background: rgba(163, 59, 50, 0.08);
  }

  ${focusRing}
`;

export const Main = styled.main`
  min-width: 0;
`;

export const Overlay = styled.button`
  position: fixed;
  inset: 0;
  z-index: 800;
  display: none;
  border: 0;
  background: rgba(15, 23, 19, 0.48);
  cursor: pointer;

  @media (max-width: ${layout.sidebarBreakpoint}) {
    display: block;
  }
`;
