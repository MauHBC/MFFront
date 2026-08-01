import React, { useCallback, useEffect, useRef, useState } from "react";
import PropTypes from "prop-types";
import { Link, useHistory, useLocation } from "react-router-dom";
import {
  FaBars,
  FaChevronDown,
  FaSignOutAlt,
  FaThumbtack,
  FaTimes,
  FaUserCircle,
} from "react-icons/fa";
import { useClinicContext } from "../../contexts/ClinicContext";
import { useAuth } from "../../hooks/useAuth";
import { useLogout } from "../../hooks/useLogout";
import { useAuthorization } from "../../contexts/AuthorizationContext";
import {
  getVisibleNavigationItems,
  isNavigationItemActive,
  NAVIGATION_BADGE_EVENT,
} from "./navigation";
import {
  CloseNavigationButton,
  ContentColumn,
  Header,
  HeaderContext,
  HeaderTitle,
  LogoutButton,
  Main,
  MobileMenuButton,
  Navigation,
  NavigationLabel,
  NavigationChevron,
  NavigationIcon,
  NavigationItemContent,
  NavigationItemTrailing,
  NavigationLink,
  NavigationList,
  NavigationModuleButton,
  NavigationText,
  Overlay,
  Shell,
  Sidebar,
  SidebarPinButton,
  SkipLink,
  SubnavigationLink,
  SubnavigationBadge,
  SubnavigationList,
  TenantArea,
  TenantMark,
  TenantName,
  UserArea,
  UserButton,
  UserMeta,
  UserPopover,
} from "./styled";

const PINNED_STORAGE_KEY = "multifisio:app-shell:sidebar-pinned";
const OPEN_MODULES_STORAGE_KEY = "multifisio:app-shell:open-modules";

function NavigationItemPresentation({
  expanded,
  icon: Icon,
  label,
  trailing,
}) {
  return (
    <NavigationItemContent $expanded={expanded}>
      <NavigationIcon aria-hidden="true">
        <Icon />
      </NavigationIcon>
      <NavigationText $expanded={expanded}>{label}</NavigationText>
      <NavigationItemTrailing $expanded={expanded}>
        {trailing}
      </NavigationItemTrailing>
    </NavigationItemContent>
  );
}

NavigationItemPresentation.propTypes = {
  expanded: PropTypes.bool.isRequired,
  icon: PropTypes.elementType.isRequired,
  label: PropTypes.string.isRequired,
  trailing: PropTypes.node.isRequired,
};

function readPinnedPreference() {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(PINNED_STORAGE_KEY) === "true";
}

export default function AppShell({ children, pageTitle }) {
  const history = useHistory();
  const location = useLocation();
  const { username } = useAuth();
  const handleLogout = useLogout();
  const { canViewTeam } = useAuthorization();
  const {
    displayName,
    logoSrc,
    brandInitials,
  } = useClinicContext();
  const [pinned, setPinned] = useState(readPinnedPreference);
  const [temporarilyExpanded, setTemporarilyExpanded] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [navigationBadges, setNavigationBadges] = useState({});
  const navigationItems = getVisibleNavigationItems({ canViewTeam });
  const activeExpandableItem = navigationItems.find(
    (item) => item.children
      && isNavigationItemActive(item, location.pathname, location.search),
  );
  const [openModuleKeys, setOpenModuleKeys] = useState(() => {
    let storedKeys = [];
    try {
      const parsedKeys = JSON.parse(
        window.sessionStorage.getItem(OPEN_MODULES_STORAGE_KEY) || "[]",
      );
      if (Array.isArray(parsedKeys)) storedKeys = parsedKeys;
    } catch {
      storedKeys = [];
    }
    const expandableKeys = navigationItems
      .filter((item) => item.children?.length)
      .map((item) => item.key);
    const validStoredKeys = storedKeys.filter((key) => expandableKeys.includes(key));
    if (activeExpandableItem && !validStoredKeys.includes(activeExpandableItem.key)) {
      return [...validStoredKeys, activeExpandableItem.key];
    }
    return validStoredKeys;
  });
  const mobileTriggerRef = useRef(null);
  const sidebarRef = useRef(null);
  const navigationRef = useRef(null);
  const userButtonRef = useRef(null);
  const expanded = pinned || temporarilyExpanded;

  useEffect(() => {
    window.localStorage.setItem(PINNED_STORAGE_KEY, String(pinned));
  }, [pinned]);

  useEffect(() => {
    try {
      window.sessionStorage.setItem(
        OPEN_MODULES_STORAGE_KEY,
        JSON.stringify(openModuleKeys),
      );
    } catch {
      // Storage may be unavailable in privacy-restricted environments.
    }
  }, [openModuleKeys]);

  useEffect(() => {
    const handleNavigationBadge = (event) => {
      const { key, value } = event.detail || {};
      if (!key) return;
      setNavigationBadges((current) => ({ ...current, [key]: value || null }));
    };
    window.addEventListener(NAVIGATION_BADGE_EVENT, handleNavigationBadge);
    return () => window.removeEventListener(NAVIGATION_BADGE_EVENT, handleNavigationBadge);
  }, []);

  const handleSidebarBlur = useCallback((event) => {
    if (!event.currentTarget.contains(event.relatedTarget)) {
      setTemporarilyExpanded(false);
    }
  }, []);
  const handleSidebarEnter = useCallback(() => setTemporarilyExpanded(true), []);
  const handleSidebarLeave = useCallback(() => setTemporarilyExpanded(false), []);
  const handleMobileClose = useCallback(() => {
    setMobileOpen(false);
    mobileTriggerRef.current?.focus();
  }, []);
  const handlePinnedToggle = useCallback(() => {
    setPinned((current) => !current);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
    setUserMenuOpen(false);
    const activeExpandable = getVisibleNavigationItems({ canViewTeam }).find(
      (item) => item.children
        && isNavigationItemActive(item, location.pathname, location.search),
    );
    if (activeExpandable) {
      setOpenModuleKeys((currentKeys) => (
        currentKeys.includes(activeExpandable.key)
          ? currentKeys
          : [...currentKeys, activeExpandable.key]
      ));
    }
  }, [canViewTeam, location.pathname, location.search]);

  useEffect(() => {
    if (!mobileOpen && !userMenuOpen) return undefined;

    function handleKeyDown(event) {
      if (event.key === "Tab" && mobileOpen && sidebarRef.current) {
        const focusableItems = sidebarRef.current.querySelectorAll(
          "a[href], button:not([disabled]):not(.app-shell-desktop-only)",
        );
        const firstItem = focusableItems[0];
        const lastItem = focusableItems[focusableItems.length - 1];

        if (event.shiftKey && document.activeElement === firstItem) {
          event.preventDefault();
          lastItem?.focus();
        } else if (!event.shiftKey && document.activeElement === lastItem) {
          event.preventDefault();
          firstItem?.focus();
        }
        return;
      }

      if (event.key !== "Escape") return;

      if (userMenuOpen) {
        setUserMenuOpen(false);
        userButtonRef.current?.focus();
      } else if (mobileOpen) {
        setMobileOpen(false);
        mobileTriggerRef.current?.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [mobileOpen, userMenuOpen]);

  useEffect(() => {
    if (!mobileOpen) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    navigationRef.current?.querySelector("a")?.focus();

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [mobileOpen]);

  return (
    <Shell $pinned={pinned} data-sidebar-pinned={pinned}>
      <SkipLink href="#app-main-content">Pular para o conteúdo</SkipLink>

      <Sidebar
        ref={sidebarRef}
        id="app-navigation"
        $expanded={expanded}
        $mobileOpen={mobileOpen}
        aria-label="Navegação principal"
        aria-modal={mobileOpen ? "true" : undefined}
        onMouseEnter={handleSidebarEnter}
        onMouseLeave={handleSidebarLeave}
        onFocus={handleSidebarEnter}
        onBlur={handleSidebarBlur}
      >
        <TenantArea title={displayName || "Clínica"}>
          <TenantMark aria-hidden={!logoSrc}>
            {logoSrc ? <img src={logoSrc} alt="" /> : brandInitials}
          </TenantMark>
          <TenantName $expanded={expanded}>{displayName || "Clínica"}</TenantName>
          <SidebarPinButton
            type="button"
            className="app-shell-desktop-only"
            $expanded={expanded}
            $active={pinned}
            onClick={handlePinnedToggle}
            aria-label={pinned ? "Desafixar sidebar" : "Fixar sidebar"}
            aria-pressed={pinned}
            title={pinned ? "Desafixar sidebar" : "Fixar sidebar"}
          >
            <FaThumbtack aria-hidden="true" />
          </SidebarPinButton>
          <CloseNavigationButton
            type="button"
            aria-label="Fechar navegação"
            onClick={handleMobileClose}
          >
            <FaTimes aria-hidden="true" />
          </CloseNavigationButton>
        </TenantArea>

        <Navigation ref={navigationRef} aria-label="Módulos">
          <NavigationLabel $expanded={expanded}>Módulos</NavigationLabel>
          <NavigationList>
            {navigationItems.map((item) => {
              const active = isNavigationItemActive(
                item,
                location.pathname,
                location.search,
              );
              const Icon = item.icon;
              const hasChildren = Boolean(item.children?.length);
              const isOpen = openModuleKeys.includes(item.key);

              return (
                <li key={item.key}>
                  {hasChildren ? (
                    <>
                      <NavigationModuleButton
                        type="button"
                        $active={active}
                        $open={isOpen}
                        $expanded={expanded}
                        aria-expanded={isOpen}
                        aria-controls={`app-subnavigation-${item.key}`}
                        aria-label={!expanded ? item.label : undefined}
                        title={!expanded ? item.label : undefined}
                        onClick={() => {
                          if (!expanded) {
                            setTemporarilyExpanded(true);
                            setOpenModuleKeys((currentKeys) => (
                              currentKeys.includes(item.key)
                                ? currentKeys
                                : [...currentKeys, item.key]
                            ));
                            if (!active) history.push(item.path);
                            return;
                          }
                          setOpenModuleKeys((currentKeys) => (
                            currentKeys.includes(item.key)
                              ? currentKeys.filter((key) => key !== item.key)
                              : [...currentKeys, item.key]
                          ));
                          if (!isOpen) {
                            if (!active) {
                              history.push(item.path);
                            }
                          }
                        }}
                      >
                        <NavigationItemPresentation
                          expanded={expanded}
                          icon={Icon}
                          label={item.label}
                          trailing={(
                            <NavigationChevron $open={isOpen}>
                              <FaChevronDown aria-hidden="true" />
                            </NavigationChevron>
                          )}
                        />
                      </NavigationModuleButton>
                      <SubnavigationList
                        id={`app-subnavigation-${item.key}`}
                        $open={isOpen}
                        $expanded={expanded}
                      >
                        {item.children.map((child) => {
                          const childActive = isNavigationItemActive(
                            child,
                            location.pathname,
                            location.search,
                          );
                          return (
                            <li key={child.key}>
                              <SubnavigationLink
                                as={Link}
                                to={child.path}
                                $active={childActive}
                                aria-current={childActive ? "page" : undefined}
                              >
                                {child.label}
                                {navigationBadges[child.key] ? (
                                  <SubnavigationBadge aria-label={`${navigationBadges[child.key]} alertas`}>
                                    {navigationBadges[child.key]}
                                  </SubnavigationBadge>
                                ) : null}
                              </SubnavigationLink>
                            </li>
                          );
                        })}
                      </SubnavigationList>
                    </>
                  ) : (
                    <NavigationLink
                      as={Link}
                      to={item.path}
                      $active={active}
                      $expanded={expanded}
                      aria-current={active ? "page" : undefined}
                      aria-label={!expanded ? item.label : undefined}
                      title={!expanded ? item.label : undefined}
                    >
                      <NavigationItemPresentation
                        expanded={expanded}
                        icon={Icon}
                        label={item.label}
                        trailing={false}
                      />
                    </NavigationLink>
                  )}
                </li>
              );
            })}
          </NavigationList>
        </Navigation>

      </Sidebar>

      {mobileOpen && (
        <Overlay
          type="button"
          aria-label="Fechar navegação"
          onClick={() => {
            setMobileOpen(false);
            mobileTriggerRef.current?.focus();
          }}
        />
      )}

      <ContentColumn>
        <Header>
          <HeaderContext>
            <MobileMenuButton
              ref={mobileTriggerRef}
              type="button"
              onClick={() => setMobileOpen((current) => !current)}
              aria-label={mobileOpen ? "Fechar navegação" : "Abrir navegação"}
              aria-expanded={mobileOpen}
              aria-controls="app-navigation"
            >
              <FaBars aria-hidden="true" />
            </MobileMenuButton>
            <HeaderTitle>
              <span>Área da clínica</span>
              <strong>{pageTitle}</strong>
            </HeaderTitle>
          </HeaderContext>

          <UserArea>
            <UserButton
              ref={userButtonRef}
              type="button"
              onClick={() => setUserMenuOpen((current) => !current)}
              aria-label="Abrir menu do usuário"
              aria-haspopup="menu"
              aria-expanded={userMenuOpen}
            >
              <FaUserCircle aria-hidden="true" />
              <span>{username || "Usuário"}</span>
              <FaChevronDown aria-hidden="true" />
            </UserButton>

            {userMenuOpen && (
              <UserPopover role="menu">
                <UserMeta>
                  <small>Usuário autenticado</small>
                  <strong>{username || "Usuário"}</strong>
                </UserMeta>
                <LogoutButton type="button" role="menuitem" onClick={handleLogout}>
                  <FaSignOutAlt aria-hidden="true" />
                  Sair
                </LogoutButton>
              </UserPopover>
            )}
          </UserArea>
        </Header>

        <Main id="app-main-content" tabIndex="-1">
          {children}
        </Main>
      </ContentColumn>
    </Shell>
  );
}

AppShell.propTypes = {
  children: PropTypes.node.isRequired,
  pageTitle: PropTypes.string.isRequired,
};

export { OPEN_MODULES_STORAGE_KEY, PINNED_STORAGE_KEY };
