/* eslint-disable react/require-default-props */
import React from "react";
import PropTypes from "prop-types";
import styled from "styled-components";
import { usePublicClinicContext } from "../../contexts/PublicClinicContext";
import { normalizePublicLandingConfig } from "../../utils/publicLanding";
import { publicLandingSpacing } from "../PublicLanding/publicLandingLayout";

function FooterLink({ children, href, isExternal = false }) {
  return (
    <a
      href={href}
      rel={isExternal ? "noopener noreferrer" : undefined}
      target={isExternal ? "_blank" : undefined}
    >
      {children}
    </a>
  );
}

FooterLink.propTypes = {
  children: PropTypes.node.isRequired,
  href: PropTypes.string.isRequired,
  isExternal: PropTypes.bool,
};

function FooterColumn({ children, title }) {
  if (!children) return null;

  return (
    <Column>
      <h2>{title}</h2>
      {children}
    </Column>
  );
}

FooterColumn.propTypes = {
  children: PropTypes.node.isRequired,
  title: PropTypes.string.isRequired,
};

export default function Footer() {
  const { publicClinic, displayName } = usePublicClinicContext();
  const config = normalizePublicLandingConfig({ publicClinic, displayName });
  const currentYear = new Date().getFullYear();
  const contactLinks = config.contact.methods.filter((method) => method.href);
  const address = config.contact.methods.find((method) => method.id === "address");
  const hasContactColumn = contactLinks.length > 0 || address;
  const hasSocialColumn = config.contact.socialLinks.length > 0 || config.footer.legalLinks.length > 0;

  return (
    <Wrapper>
      <Inner>
        <Brand>
          {config.logoSrc ? (
            <img src={config.logoSrc} alt={config.displayName} />
          ) : (
            <BrandMark aria-hidden="true">{config.displayName.slice(0, 1)}</BrandMark>
          )}
          <div>
            <h1>{config.displayName}</h1>
            {config.footer.content && <p>{config.footer.content}</p>}
            <p>{currentYear} © {config.displayName}</p>
          </div>
        </Brand>

        <FooterColumn title="Navegação">
          <LinkList>
            {config.footer.navigation.map((item) => (
              <li key={item.href}>
                <FooterLink href={item.href}>{item.label}</FooterLink>
              </li>
            ))}
          </LinkList>
        </FooterColumn>

        {hasContactColumn && (
          <FooterColumn title="Contato">
            <LinkList>
              {contactLinks.map((method) => (
                <li key={method.id}>
                  <FooterLink href={method.href} isExternal={method.isExternal}>
                    {method.label}
                  </FooterLink>
                </li>
              ))}
              {address && <li><address>{address.value}</address></li>}
            </LinkList>
          </FooterColumn>
        )}

        {hasSocialColumn && (
          <FooterColumn title="Links">
            <LinkList>
              {config.contact.socialLinks.map((link) => (
                <li key={link.id}>
                  <FooterLink href={link.href} isExternal={link.isExternal}>
                    {link.label}
                  </FooterLink>
                </li>
              ))}
              {config.footer.legalLinks.map((link) => (
                <li key={link.id}>
                  <FooterLink href={link.href} isExternal={link.isExternal}>
                    {link.label}
                  </FooterLink>
                </li>
              ))}
            </LinkList>
          </FooterColumn>
        )}

        <FooterColumn title="Acesso">
          <LinkList>
            <li>
              <FooterLink href="/login">Entrar</FooterLink>
            </li>
          </LinkList>
        </FooterColumn>
      </Inner>
    </Wrapper>
  );
}

const Wrapper = styled.footer`
  width: 100%;
  padding: ${publicLandingSpacing.footerBlock} 0;
  background: #151d17;
  color: #f7f8f5;
`;

const Inner = styled.div`
  width: min(1220px, calc(100% - 48px));
  margin: 0 auto;
  display: grid;
  grid-template-columns: minmax(240px, 1.25fr) repeat(auto-fit, minmax(150px, 0.65fr));
  gap: clamp(24px, 4vw, 44px);

  @media (max-width: 760px) {
    width: min(720px, calc(100% - 32px));
    grid-template-columns: 1fr;
  }
`;

const Brand = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 14px;

  img,
  span {
    width: 44px;
    height: 44px;
    flex: 0 0 auto;
  }

  img {
    object-fit: contain;
  }

  h1 {
    margin: 0;
    color: #fff;
    font-size: 1.06rem;
    line-height: 1.25;
    font-weight: 800;
  }

  p {
    margin: 8px 0 0;
    color: rgba(247, 248, 245, 0.68);
    font-size: 0.88rem;
    line-height: 1.45;
    font-weight: 600;
  }
`;

const BrandMark = styled.span`
  border-radius: 8px;
  background: var(--public-primary-color, #6a795c);
  color: #fff;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 1rem;
  font-weight: 800;
  text-transform: uppercase;
`;

const Column = styled.div`
  min-width: 0;

  h2 {
    margin: 0 0 12px;
    color: #fff;
    font-size: 0.78rem;
    font-weight: 800;
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }
`;

const LinkList = styled.ul`
  margin: 0;
  padding: 0;
  list-style: none;
  display: grid;
  gap: 8px;

  a,
  address {
    color: rgba(247, 248, 245, 0.74);
    font-size: 0.92rem;
    line-height: 1.45;
    font-style: normal;
    font-weight: 700;
    text-decoration: none;
  }

  a:hover,
  a:focus-visible {
    color: #fff;
  }
`;
