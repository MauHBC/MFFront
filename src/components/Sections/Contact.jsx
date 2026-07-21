/* eslint-disable react/require-default-props */
import React from "react";
import PropTypes from "prop-types";
import styled from "styled-components";
import { usePublicClinicContext } from "../../contexts/PublicClinicContext";
import { normalizePublicLandingConfig } from "../../utils/publicLanding";
import PublicHeroCarousel from "../PublicLanding/PublicHeroCarousel";
import { publicLandingSpacing } from "../PublicLanding/publicLandingLayout";

function ExternalLink({
  children,
  href,
  className = undefined,
  isExternal = false,
}) {
  return (
    <a
      className={className}
      href={href}
      rel={isExternal ? "noopener noreferrer" : undefined}
      target={isExternal ? "_blank" : undefined}
    >
      {children}
    </a>
  );
}

ExternalLink.propTypes = {
  children: PropTypes.node.isRequired,
  className: PropTypes.string,
  href: PropTypes.string.isRequired,
  isExternal: PropTypes.bool,
};

function ContactMethod({ method }) {
  const content = (
    <>
      <span>{method.label}</span>
      <strong>{method.value}</strong>
    </>
  );

  return (
    <MethodItem>
      {method.href ? (
        <ExternalLink href={method.href} isExternal={method.isExternal}>
          {content}
        </ExternalLink>
      ) : (
        <address>{content}</address>
      )}
    </MethodItem>
  );
}

ContactMethod.propTypes = {
  method: PropTypes.shape({
    href: PropTypes.string,
    isExternal: PropTypes.bool,
    label: PropTypes.string.isRequired,
    value: PropTypes.string.isRequired,
  }).isRequired,
};

function UnitCard({ unit, index }) {
  return (
    <Unit>
      <UnitIndex aria-hidden="true">{String(index + 1).padStart(2, "0")}</UnitIndex>
      {unit.name && <h3>{unit.name}</h3>}
      {unit.address && <address>{unit.address}</address>}
      {unit.reference && <p>{unit.reference}</p>}
      {unit.hours && <p>{unit.hours}</p>}
      <UnitActions>
        {unit.phone && unit.phoneHref && (
          <ExternalLink href={unit.phoneHref}>{unit.phone}</ExternalLink>
        )}
        {unit.mapHref && (
          <ExternalLink href={unit.mapHref} isExternal>
            Ver mapa
          </ExternalLink>
        )}
      </UnitActions>
    </Unit>
  );
}

UnitCard.propTypes = {
  index: PropTypes.number.isRequired,
  unit: PropTypes.shape({
    address: PropTypes.string,
    hours: PropTypes.string,
    mapHref: PropTypes.string,
    name: PropTypes.string,
    phone: PropTypes.string,
    phoneHref: PropTypes.string,
    reference: PropTypes.string,
  }).isRequired,
};

const getUnitsVariant = (count) => {
  if (count === 1) return "single";
  if (count === 2) return "pair";
  return "grid";
};

export default function Contact({ showContact = true, showGallery = true }) {
  const { publicClinic, displayName } = usePublicClinicContext();
  const config = normalizePublicLandingConfig({ publicClinic, displayName });
  const { contact } = config;
  const hasGallery = showGallery && config.images.length > 0;

  if ((!showContact || !config.hasContact) && !hasGallery) return null;

  const unitsVariant = getUnitsVariant(contact.units.length);
  const hasHeading = showContact && Boolean(contact.label || contact.title || contact.text);
  const visibleMethods = contact.sectionMethods || contact.methods;
  const hasContactMethods = visibleMethods.length > 0 || contact.socialLinks.length > 0;
  const hasContactDetails = showContact && Boolean(contact.primaryAction || hasContactMethods);

  return (
    <Wrapper id="contact" aria-label="Estrutura, unidades e contato">
      <Inner>
        {hasHeading && (
          <SectionIntro>
            {contact.label && <Eyebrow>{contact.label}</Eyebrow>}
            {contact.title && <h2>{contact.title}</h2>}
            {contact.text && <p>{contact.text}</p>}
          </SectionIntro>
        )}

        <StructureGrid $hasGallery={hasGallery} $hasDetails={hasContactDetails}>
          {hasGallery && (
            <Gallery aria-label="Galeria da estrutura">
              <PublicHeroCarousel
                images={config.images}
                displayName={config.displayName}
                variant="section"
              />
            </Gallery>
          )}

          {hasContactDetails && (
            <ContactPanel>
              {contact.primaryAction && (
                <PrimaryAction
                  href={contact.primaryAction.href}
                  isExternal={contact.primaryAction.isExternal}
                >
                  {contact.primaryAction.label}
                </PrimaryAction>
              )}
              {hasContactMethods && (
                <ContactActions>
                  {visibleMethods.length > 0 && (
                    <Methods aria-label="Canais de contato">
                      {visibleMethods.map((method) => (
                        <ContactMethod key={method.id} method={method} />
                      ))}
                    </Methods>
                  )}
                  {contact.socialLinks.length > 0 && (
                    <SocialLinks aria-label="Redes sociais">
                      {contact.socialLinks.map((link) => (
                        <ExternalLink
                          key={link.id}
                          href={link.href}
                          isExternal={link.isExternal}
                        >
                          {link.label}
                        </ExternalLink>
                      ))}
                    </SocialLinks>
                  )}
                </ContactActions>
              )}
            </ContactPanel>
          )}
        </StructureGrid>

        {showContact && contact.units.length > 0 && (
          <UnitsBlock aria-label="Unidades públicas">
            <UnitsGrid $variant={unitsVariant}>
              {contact.units.map((unit, index) => (
                <UnitCard key={unit.id} unit={unit} index={index} />
              ))}
            </UnitsGrid>
          </UnitsBlock>
        )}
      </Inner>
    </Wrapper>
  );
}

Contact.propTypes = {
  showContact: PropTypes.bool,
  showGallery: PropTypes.bool,
};

const Wrapper = styled.section`
  position: relative;
  width: 100%;
  scroll-margin-top: 104px;
  padding: ${publicLandingSpacing.sectionBlock} 0;
  background:
    linear-gradient(180deg, #fbfbf8 0%, #eef4eb 100%);
`;

const Inner = styled.div`
  width: min(1220px, calc(100% - 48px));
  margin: 0 auto;
  display: grid;
  gap: ${publicLandingSpacing.sectionGap};

  @media (max-width: 760px) {
    width: min(720px, calc(100% - 32px));
  }
`;

const SectionIntro = styled.div`
  max-width: 820px;
  display: grid;
  justify-items: start;

  h2 {
    margin: 0;
    color: #151d17;
    font-size: clamp(2rem, 4.3vw, 3.85rem);
    line-height: 1.05;
    font-weight: 800;
  }

  p {
    max-width: 700px;
    margin: 18px 0 0;
    color: #465248;
    font-size: clamp(1rem, 1.35vw, 1.12rem);
    line-height: 1.7;
    font-weight: 600;
  }
`;

const StructureGrid = styled.div`
  display: grid;
  grid-template-columns: ${({ $hasGallery, $hasDetails }) => (
    $hasGallery && $hasDetails
      ? "minmax(0, 1.15fr) minmax(300px, .72fr)"
      : "minmax(0, 860px)"
  )};
  gap: ${publicLandingSpacing.contentGap};
  align-items: stretch;
  padding-bottom: ${publicLandingSpacing.sectionGap};
  border-bottom: 1px solid rgba(106, 121, 92, 0.18);

  @media (max-width: 860px) {
    grid-template-columns: 1fr;
  }
`;

const Gallery = styled.div`
  min-width: 0;
`;

const ContactPanel = styled.div`
  display: grid;
  align-content: start;
  justify-items: start;
  gap: 18px;
`;

const Eyebrow = styled.span`
  display: inline-flex;
  margin-bottom: 14px;
  color: color-mix(in srgb, var(--public-secondary-color, #3d5230) 88%, #111 12%);
  font-size: 0.78rem;
  font-weight: 800;
  letter-spacing: 0.12em;
  text-transform: uppercase;
`;

const ContactActions = styled.div`
  display: grid;
  gap: 18px;
  justify-items: start;
`;

const PrimaryAction = styled(ExternalLink)`
  min-height: 48px;
  padding: 0 24px;
  border-radius: 999px;
  background: var(--public-primary-color, #6a795c);
  color: #fff;
  box-shadow: 0 14px 30px rgba(22, 33, 28, 0.13);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 0.96rem;
  font-weight: 800;
  text-decoration: none;
  transition: transform 180ms ease, box-shadow 180ms ease, background 180ms ease;

  &:hover,
  &:focus-visible {
    color: #fff;
    background: var(--public-secondary-color, #3d5230);
    box-shadow: 0 16px 34px rgba(22, 33, 28, 0.18);
    transform: translateY(-1px);
  }

  &:focus-visible {
    outline: 3px solid var(--public-accent-color, #a2b190);
    outline-offset: 3px;
  }
`;

const Methods = styled.ul`
  width: 100%;
  margin: 0;
  padding: 0;
  list-style: none;
  display: grid;
  gap: 10px;
`;

const MethodItem = styled.li`
  a,
  address {
    min-height: 76px;
    padding: 16px 18px;
    border: 1px solid rgba(106, 121, 92, 0.16);
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.62);
    color: #1c271f;
    display: grid;
    gap: 4px;
    text-decoration: none;
    font-style: normal;
  }

  span {
    color: color-mix(in srgb, var(--public-secondary-color, #3d5230) 84%, #111 16%);
    font-size: 0.74rem;
    font-weight: 800;
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }

  strong {
    color: #243028;
    font-size: 1rem;
    line-height: 1.35;
    font-weight: 800;
    overflow-wrap: anywhere;
  }
`;

const SocialLinks = styled.nav`
  display: flex;
  flex-wrap: wrap;
  gap: 10px;

  a {
    min-height: 44px;
    padding: 0 14px;
    border: 1px solid rgba(106, 121, 92, 0.2);
    border-radius: 999px;
    color: #263128;
    background: rgba(255, 255, 255, 0.48);
    display: inline-flex;
    align-items: center;
    font-size: 0.88rem;
    font-weight: 800;
    text-decoration: none;
  }
`;

const UnitsBlock = styled.div`
  display: grid;
`;

const UnitsGrid = styled.div`
  display: grid;
  grid-template-columns: ${({ $variant }) => {
    if ($variant === "single") return "minmax(0, 760px)";
    if ($variant === "pair") return "repeat(2, minmax(0, 1fr))";
    return "repeat(auto-fit, minmax(250px, 1fr))";
  }};
  gap: 18px;

  @media (max-width: 760px) {
    grid-template-columns: 1fr;
  }
`;

const Unit = styled.article`
  min-height: 210px;
  padding: clamp(22px, 3vw, 30px);
  border-radius: 8px;
  border: 1px solid rgba(106, 121, 92, 0.16);
  background:
    linear-gradient(145deg, rgba(255, 255, 255, 0.82), rgba(255, 255, 255, 0.48));
  box-shadow: 0 18px 42px rgba(22, 33, 28, 0.07);
  display: flex;
  flex-direction: column;

  h3 {
    margin: 12px 0 0;
    color: #18211d;
    font-size: clamp(1.2rem, 1.7vw, 1.52rem);
    line-height: 1.14;
    font-weight: 800;
  }

  address,
  p {
    margin: 12px 0 0;
    color: #485449;
    font-size: 0.96rem;
    line-height: 1.52;
    font-style: normal;
    font-weight: 600;
  }
`;

const UnitIndex = styled.span`
  color: var(--public-primary-color, #6a795c);
  font-size: 0.82rem;
  font-weight: 800;
  letter-spacing: 0.08em;
`;

const UnitActions = styled.div`
  margin-top: auto;
  padding-top: 18px;
  display: flex;
  flex-wrap: wrap;
  gap: 10px;

  a {
    min-height: 44px;
    padding: 0 14px;
    border-radius: 999px;
    border: 1px solid rgba(106, 121, 92, 0.2);
    color: #263128;
    display: inline-flex;
    align-items: center;
    font-size: 0.88rem;
    font-weight: 800;
    text-decoration: none;

    &:focus-visible {
      outline: 3px solid var(--public-accent-color, #a2b190);
      outline-offset: 2px;
    }
  }
`;
