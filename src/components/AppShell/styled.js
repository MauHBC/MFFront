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

const chromeFocusRing = css`
  &:focus-visible {
    outline: 3px solid ${colors.appChromeFocus};
    outline-offset: 2px;
  }
`;

export const Shell = styled.div`
  --app-sidebar-width: ${(p) => (
    p.$pinned ? layout.appSidebarWidth : layout.appSidebarCollapsedWidth
  )};
  --app-chrome-background: ${colors.appChromeBackgroundFallback};
  min-height: 100vh;
  background: ${colors.workspaceBackground};
  color: ${colors.textPrimary};
  font-family: ${typography.family};

  @supports (color: oklch(from red 0.5 min(c, 0.05) h)) {
    --app-chrome-background: ${colors.appChromeBackground};
  }
`;

export const SkipLink = styled.a`
  position: fixed;
  top: ${spacing.sm};
  left: ${spacing.sm};
  z-index: 1200;
  padding: 7px ${spacing.md};
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
  background: var(--app-chrome-background);
  border-right: 0;
  transition: width 180ms ease, transform 220ms ease;

  &::after {
    content: "";
    position: absolute;
    inset: 0 0 0 auto;
    width: 1px;
    background: ${colors.appChromeBorder};
    pointer-events: none;
  }

  ${(p) => p.$expanded && css`
    width: ${layout.appSidebarWidth};
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
  height: ${layout.appHeaderHeight};
  min-height: ${layout.appHeaderHeight};
  display: flex;
  align-items: center;
  gap: ${spacing.md};
  padding: ${spacing.sm} ${spacing.md};
  border-bottom: 1px solid ${colors.appChromeBorder};
`;

export const TenantMark = styled.span`
  width: 36px;
  height: 36px;
  flex: 0 0 36px;
  border-radius: ${radii.md};
  display: inline-flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  border: 1px solid ${colors.appChromeBorder};
  background: ${colors.navigationModuleOpenBackgroundFallback};
  background: ${colors.navigationModuleOpenBackground};
  color: ${colors.appChromeForeground};
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
  color: ${colors.appChromeForeground};
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
  border: 1px solid ${colors.appChromeBorder};
  border-radius: ${radii.md};
  background: ${(p) => (
    p.$active ? colors.navigationSubmenuActiveBackground : "transparent"
  )};
  color: ${colors.appChromeForeground};
  cursor: pointer;
  transition: background 150ms ease, border-color 150ms ease, color 150ms ease;

  &:hover {
    color: ${colors.appChromeForeground};
    background: ${(p) => (
    p.$active
      ? colors.navigationSubmenuActiveBackground
      : colors.navigationHoverSurface
  )};
  }

  ${chromeFocusRing}

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
  color: ${colors.appChromeForeground};
  cursor: pointer;
  ${chromeFocusRing}

  @media (max-width: ${layout.sidebarBreakpoint}) {
    display: inline-flex;
  }
`;

const navigationTheme = css`
  --navigation-inline-padding: ${spacing.md};
  --navigation-item-inline-padding: ${spacing.md};
  --navigation-icon-column: 28px;
  --navigation-action-column: 24px;
  --navigation-brand-ink:
    ${colors.appChromeForeground};
  --navigation-hover-surface: ${colors.navigationHoverSurface};
  --navigation-module-open-surface: ${colors.navigationModuleOpenBackgroundFallback};
  --navigation-submenu-surface: ${colors.navigationSubmenuBackgroundFallback};
  --navigation-submenu-indicator: ${colors.navigationSubmenuIndicatorFallback};
  --navigation-page-surface:
    ${colors.navigationSubmenuActiveBackground};

  @supports (color: oklch(from red 0.5 clamp(0.01, c, 0.1) h)) {
    --navigation-module-open-surface: ${colors.navigationModuleOpenBackground};
    --navigation-submenu-surface: ${colors.navigationSubmenuBackground};
    --navigation-submenu-indicator: ${colors.navigationSubmenuIndicator};
  }
`;

export const Navigation = styled.nav`
  ${navigationTheme}
  flex: 1;
  padding: ${spacing.lg} var(--navigation-inline-padding);
  overflow-x: clip;
  overflow-y: auto;

`;

export const SidebarAdminNavigation = styled.nav`
  ${navigationTheme}
  flex: 0 0 auto;
  padding: ${spacing.md};
  border-top: 1px solid ${colors.appChromeBorder};
`;

export const SidebarFooterNavigation = SidebarAdminNavigation;

export const NavigationLabel = styled.p`
  height: 14px;
  margin: 0 0 ${spacing.sm};
  padding: 0 ${spacing.sm};
  color: ${colors.appChromeMutedForeground};
  font-size: ${(p) => (p.$expanded ? "0.7rem" : "0")};
  font-weight: ${typography.weightBold};
  letter-spacing: 0.08em;
  text-transform: uppercase;
  overflow: hidden;
  white-space: nowrap;
  visibility: ${(p) => (p.$expanded ? "visible" : "hidden")};

  @media (max-width: ${layout.sidebarBreakpoint}) {
    font-size: 0.7rem;
    visibility: visible;
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
  display: block;
  padding: ${spacing.sm} var(--navigation-item-inline-padding);
  border: 0;
  border-radius: ${radii.md};
  font: inherit;
  font-weight: ${typography.weightSemibold};
  text-align: left;
  text-decoration: none;
  cursor: pointer;
  box-shadow: none;
  filter: none;
  transition: background 150ms ease, color 150ms ease;

  &:hover {
    filter: none;
  }

  ${chromeFocusRing}

  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
`;

export const NavigationLink = styled.a`
  ${navigationItemStyles}
  color: ${(p) => (
    p.$active ? colors.appChromeForeground : colors.appChromeMutedForeground
  )};
  background: ${(p) => (
    p.$active ? "var(--navigation-module-open-surface)" : "transparent"
  )};
  font-weight: ${(p) => (
    p.$active ? typography.weightBold : typography.weightSemibold
  )};

  &:hover {
    color: ${colors.appChromeForeground};
    background: ${(p) => (
    p.$active
      ? "var(--navigation-module-open-surface)"
      : "var(--navigation-hover-surface)"
  )};
  }

`;

export const NavigationModuleButton = styled.button`
  ${navigationItemStyles}
  background: ${(p) => (
    p.$open || p.$active ? "var(--navigation-module-open-surface)" : "transparent"
  )};
  color: ${(p) => (
    p.$open || p.$active
      ? colors.appChromeForeground
      : colors.appChromeMutedForeground
  )};
  font-weight: ${(p) => (
    p.$active ? typography.weightBold : typography.weightSemibold
  )};

  &:hover {
    color: ${colors.appChromeForeground};
    background: ${(p) => (
    p.$open || p.$active
      ? "var(--navigation-module-open-surface)"
      : "var(--navigation-hover-surface)"
  )};
  }

`;

export const NavigationItemContent = styled.span`
  width: 100%;
  display: grid;
  grid-template-columns: ${(p) => (
    p.$expanded
      ? "var(--navigation-icon-column) minmax(0, 1fr) var(--navigation-action-column)"
      : "var(--navigation-icon-column)"
  )};
  column-gap: ${(p) => (p.$expanded ? spacing.md : "0")};
  align-items: center;

  @media (max-width: ${layout.sidebarBreakpoint}) {
    grid-template-columns:
      var(--navigation-icon-column)
      minmax(0, 1fr)
      var(--navigation-action-column);
    column-gap: ${spacing.md};
  }
`;

export const NavigationIcon = styled.span`
  width: var(--navigation-icon-column);
  height: 24px;
  display: inline-flex;
  align-items: center;
  justify-content: center;

  svg {
    flex: 0 0 auto;
    font-size: 1.05rem;
  }
`;

export const NavigationChevron = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transform: rotate(${(p) => (p.$open ? "0deg" : "-90deg")});
  transition: transform 150ms ease;

  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
`;

export const NavigationItemTrailing = styled.span`
  width: var(--navigation-action-column);
  height: 24px;
  display: ${(p) => (p.$expanded ? "inline-flex" : "none")};
  align-items: center;
  justify-content: center;

  @media (max-width: ${layout.sidebarBreakpoint}) {
    display: inline-flex;
  }
`;

export const SubnavigationList = styled.ul`
  display: ${(p) => (p.$open && p.$expanded ? "grid" : "none")};
  gap: ${spacing.xs};
  margin: 0 0 ${spacing.xs};
  padding: ${spacing.xs} 0 ${spacing.xs} 44px;
  border-left: 3px solid var(--navigation-submenu-indicator);
  border-radius: 0;
  background: var(--navigation-submenu-surface);
  list-style: none;

  @media (max-width: ${layout.sidebarBreakpoint}) {
    display: ${(p) => (p.$open ? "grid" : "none")};
  }
`;

export const SubnavigationLink = styled.a`
  position: relative;
  min-width: 0;
  min-height: 42px;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  column-gap: ${spacing.sm};
  padding: ${spacing.sm} ${spacing.md};
  border: 0;
  border-radius: 0;
  background: ${(p) => (
    p.$active ? "var(--navigation-page-surface)" : "transparent"
  )};
  color: ${(p) => (
    p.$active ? colors.appChromeForeground : colors.appChromeMutedForeground
  )};
  font-size: 0.86rem;
  font-weight: ${(p) => (
    p.$active ? typography.weightSemibold : typography.weightRegular
  )};
  line-height: 1.25;
  overflow-wrap: anywhere;
  text-decoration: none;

  &:hover {
    background: ${(p) => (
    p.$active ? "var(--navigation-page-surface)" : "var(--navigation-hover-surface)"
  )};
    color: ${colors.appChromeForeground};
  }

  ${chromeFocusRing}
`;

export const SubnavigationBadge = styled.span`
  min-width: 20px;
  height: 20px;
  flex: 0 0 auto;
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
  min-width: 0;
  display: ${(p) => (p.$expanded ? "inline" : "none")};
  justify-self: start;
  overflow-wrap: anywhere;
  text-align: left;

  @media (max-width: ${layout.sidebarBreakpoint}) {
    display: inline;
  }
`;

export const ContentColumn = styled.div`
  min-height: 100vh;
  margin-left: var(--app-sidebar-width);
  background: ${colors.workspaceBackground};
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
  height: ${layout.appHeaderHeight};
  min-height: ${layout.appHeaderHeight};
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${spacing.lg};
  padding: ${spacing.xs} ${spacing.xl};
  background: ${colors.surface};
  border-bottom: 1px solid ${colors.borderSubtle};

  @media (max-width: ${layout.mobileBreakpoint}) {
    padding: ${spacing.sm} ${spacing.lg};
  }
`;

export const HeaderContext = styled.div`
  flex: 1 1 auto;
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
  background: transparent;
  color: ${colors.textPrimary};
  cursor: pointer;

  &:hover {
    background: ${colors.appHeaderControlHover};
  }

  ${focusRing}

  @media (max-width: ${layout.sidebarBreakpoint}) {
    display: inline-flex;
  }
`;

export const HeaderTitle = styled.div`
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  align-items: baseline;
  overflow: hidden;
  white-space: nowrap;

  span {
    flex: 0 0 auto;
    color: ${colors.textSecondary};
    font-size: 0.72rem;
    font-weight: ${typography.weightBold};
    letter-spacing: 0.06em;
    text-transform: uppercase;

    &::after {
      content: "\\2014";
      margin: 0 ${spacing.sm};
      color: ${colors.textSecondary};
      font-weight: ${typography.weightRegular};
    }
  }

  strong {
    min-width: 0;
    display: block;
    overflow: hidden;
    color: ${colors.textPrimary};
    font-size: 0.94rem;
    line-height: 1.2;
    font-weight: ${typography.weightSemibold};
    text-overflow: ellipsis;
    white-space: nowrap;
  }
`;

export const UserArea = styled.div`
  position: relative;
`;

export const HeaderActions = styled.div`
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: ${spacing.sm};
`;

export const UserButton = styled.button`
  min-height: 42px;
  max-width: 260px;
  display: flex;
  align-items: center;
  gap: ${spacing.xs};
  padding: ${spacing.xs} 10px;
  border: 1px solid ${colors.borderSubtle};
  border-radius: ${radii.pill};
  background: transparent;
  color: ${colors.textPrimary};
  cursor: pointer;
  transition: background 150ms ease;

  &:hover {
    background: ${colors.appHeaderControlHover};
  }

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
