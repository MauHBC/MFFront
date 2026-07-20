import React, { useEffect, useRef, useState } from "react";
import PropTypes from "prop-types";
import styled from "styled-components";
import { Link as RouterLink } from "react-router-dom";
import { FaBars, FaTimes } from "react-icons/fa";
import PublicNavLinks from "./PublicNavLinks";

export default function PublicLandingHeader({ config }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const closeButtonRef = useRef(null);

  useEffect(() => {
    if (!mobileOpen) return undefined;
    closeButtonRef.current?.focus();
    const handleKeyDown = (event) => {
      if (event.key === "Escape") setMobileOpen(false);
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [mobileOpen]);

  const cta = config.action;

  return (
    <>
      <Header>
        <HeaderInner>
          <BrandLink to="/" aria-label={config.displayName}>
            {config.logoSrc ? (
              <Logo src={config.logoSrc} alt={config.displayName} />
            ) : (
              <BrandFallback aria-hidden="true">
                {config.displayName.slice(0, 2).toUpperCase()}
              </BrandFallback>
            )}
            <BrandName>{config.displayName}</BrandName>
          </BrandLink>

          <DesktopNav>
            <PublicNavLinks
              showAbout={config.hasAbout}
              showContact={config.hasContact}
              showServices={config.hasServices}
            />
          </DesktopNav>

          <DesktopActions>
            <HeaderCta
              href={cta.href}
              target={cta.isExternal ? "_blank" : undefined}
              rel={cta.isExternal ? "noreferrer" : undefined}
            >
              {cta.label}
            </HeaderCta>
            <LoginLink to="/login">Entrar</LoginLink>
          </DesktopActions>

          <MobileMenuButton
            type="button"
            aria-label="Abrir menu"
            aria-expanded={mobileOpen}
            aria-controls="public-mobile-menu"
            onClick={() => setMobileOpen(true)}
          >
            <FaBars />
          </MobileMenuButton>
        </HeaderInner>
      </Header>

      {mobileOpen && (
        <>
          <MobileOverlay onClick={() => setMobileOpen(false)} />
          <MobilePanel id="public-mobile-menu" role="dialog" aria-modal="true" aria-label="Menu principal">
            <MobilePanelHeader>
              <strong>{config.displayName}</strong>
              <MobileCloseButton
                ref={closeButtonRef}
                type="button"
                aria-label="Fechar menu"
                onClick={() => setMobileOpen(false)}
              >
                <FaTimes />
              </MobileCloseButton>
            </MobilePanelHeader>
            <MobileNav>
              <PublicNavLinks
                showAbout={config.hasAbout}
                showContact={config.hasContact}
                showServices={config.hasServices}
                onNavigate={() => setMobileOpen(false)}
              />
            </MobileNav>
            <MobileActions>
              <HeaderCta
                href={cta.href}
                target={cta.isExternal ? "_blank" : undefined}
                rel={cta.isExternal ? "noreferrer" : undefined}
                onClick={() => setMobileOpen(false)}
              >
                {cta.label}
              </HeaderCta>
              <LoginLink to="/login" onClick={() => setMobileOpen(false)}>
                Entrar
              </LoginLink>
            </MobileActions>
          </MobilePanel>
        </>
      )}
    </>
  );
}

PublicLandingHeader.propTypes = {
  config: PropTypes.shape({
    action: PropTypes.shape({
      href: PropTypes.string.isRequired,
      isExternal: PropTypes.bool.isRequired,
      label: PropTypes.string.isRequired,
    }).isRequired,
    displayName: PropTypes.string.isRequired,
    hasAbout: PropTypes.bool.isRequired,
    hasContact: PropTypes.bool.isRequired,
    hasServices: PropTypes.bool.isRequired,
    logoSrc: PropTypes.string,
  }).isRequired,
};

const Header = styled.header`
  position: relative;
  z-index: 1000;
  padding: 16px 0;
  background: #fbfbf8;

  @media (max-width: 760px) {
    padding: 10px 0;
  }
`;

const HeaderInner = styled.div`
  width: min(1220px, calc(100% - 48px));
  min-height: 72px;
  margin: 0 auto;
  padding: 10px 12px 10px 18px;
  border: 1px solid rgba(106, 121, 92, 0.14);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.86);
  backdrop-filter: blur(18px);
  box-shadow: 0 16px 42px rgba(28, 36, 30, 0.08);
  display: grid;
  grid-template-columns: minmax(180px, 1fr) auto minmax(250px, 1fr);
  align-items: center;
  gap: 18px;

  @media (max-width: 900px) {
    width: calc(100% - 24px);
    grid-template-columns: 1fr auto;
  }
`;

const BrandLink = styled(RouterLink)`
  min-width: 0;
  display: inline-flex;
  align-items: center;
  gap: 12px;
  color: #18211d;
  text-decoration: none;
`;

const Logo = styled.img`
  width: auto;
  height: 48px;
  max-width: 150px;
  object-fit: contain;
  padding: 0;
`;

const BrandFallback = styled.span`
  width: 44px;
  height: 44px;
  border-radius: 8px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: var(--public-primary-color, #6a795c);
  color: #fff;
  font-weight: 800;
`;

const BrandName = styled.span`
  overflow: hidden;
  color: #1b1b1b;
  font-size: 1rem;
  font-weight: 800;
  text-overflow: ellipsis;
  white-space: nowrap;

  @media (max-width: 520px) {
    max-width: 170px;
  }
`;

const DesktopNav = styled.nav`
  justify-self: center;

  ul {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }

  li a {
    display: inline-flex;
    padding: 10px 12px;
    border-radius: 999px;
    color: #4b574d;
    font-size: 0.92rem;
    font-weight: 800;
    text-decoration: none;
  }

  li a:hover,
  li a:focus-visible {
    background: rgba(106, 121, 92, 0.08);
    color: var(--public-secondary-color, #3d5230) !important;
    border-bottom: 0;
    outline: none;
  }

  @media (max-width: 900px) {
    display: none;
  }
`;

const DesktopActions = styled.div`
  justify-self: end;
  display: inline-flex;
  align-items: center;
  gap: 10px;

  @media (max-width: 900px) {
    display: none;
  }
`;

const HeaderCta = styled.a`
  min-height: 42px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  padding: 0 16px;
  background: var(--public-primary-color, #6a795c);
  color: #fff;
  font-size: 0.9rem;
  font-weight: 800;
  text-decoration: none;
  white-space: nowrap;

  &:hover,
  &:focus-visible {
    background: var(--public-secondary-color, #3d5230);
    color: #fff;
    outline: none;
  }
`;

const LoginLink = styled(RouterLink)`
  min-height: 42px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  padding: 0 14px;
  border: 1px solid rgba(106, 121, 92, 0.2);
  background: rgba(255, 255, 255, 0.74);
  color: #2c362f;
  font-size: 0.9rem;
  font-weight: 800;
  text-decoration: none;
`;

const MobileMenuButton = styled.button`
  width: 44px;
  height: 44px;
  border-radius: 999px;
  border: 1px solid rgba(106, 121, 92, 0.18);
  background: #fff;
  color: #1f2a23;
  display: none;
  align-items: center;
  justify-content: center;
  cursor: pointer;

  @media (max-width: 900px) {
    display: inline-flex;
  }
`;

const MobileOverlay = styled.div`
  position: fixed;
  inset: 0;
  z-index: 1100;
  background: rgba(19, 28, 22, 0.34);
`;

const MobilePanel = styled.aside`
  position: fixed;
  top: 0;
  right: 0;
  z-index: 1101;
  width: min(380px, 92vw);
  height: 100dvh;
  padding: 22px;
  background: #fff;
  box-shadow: -18px 0 44px rgba(20, 29, 23, 0.18);
  display: flex;
  flex-direction: column;
  gap: 22px;
`;

const MobilePanelHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;

  strong {
    color: #18211d;
    font-size: 1.08rem;
  }
`;

const MobileCloseButton = styled.button`
  width: 42px;
  height: 42px;
  border-radius: 999px;
  border: 1px solid rgba(106, 121, 92, 0.18);
  background: #f8faf7;
  color: #1f2a23;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
`;

const MobileNav = styled.nav`
  ul {
    display: grid;
    gap: 8px;
  }

  li a {
    display: flex;
    width: 100%;
    padding: 14px 0;
    border-bottom: 1px solid rgba(106, 121, 92, 0.12);
    color: #2a352e;
    font-size: 1.2rem;
    font-weight: 800;
    text-decoration: none;
    text-align: left;
  }
`;

const MobileActions = styled.div`
  margin-top: auto;
  display: grid;
  gap: 10px;

  ${HeaderCta},
  ${LoginLink} {
    width: 100%;
  }
`;
