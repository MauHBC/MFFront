import React from "react";
import PropTypes from "prop-types";
import styled from "styled-components";
import { Link as ScrollLink } from "react-scroll";
import { FaArrowRight, FaWhatsapp } from "react-icons/fa";
import PublicHeroCarousel from "./PublicHeroCarousel";

export default function PublicHero({ config }) {
  const isAnchorAction = config.action.href.startsWith("#");
  const actionContent = (
    <>
      {config.action.type === "whatsapp" ? <FaWhatsapp /> : <FaArrowRight />}
      <span>{config.action.label}</span>
    </>
  );

  return (
    <Hero id="home">
      <HeroInner>
        <CopyColumn>
          <Eyebrow>{config.eyebrow}</Eyebrow>
          <Title>{config.title}</Title>
          <Subtitle>{config.subtitle}</Subtitle>
          <Actions>
            {isAnchorAction ? (
              <PrimaryScrollAction to={config.action.href.replace("#", "")} smooth offset={-88}>
                {actionContent}
              </PrimaryScrollAction>
            ) : (
              <PrimaryAction
                href={config.action.href}
                target={config.action.isExternal ? "_blank" : undefined}
                rel={config.action.isExternal ? "noreferrer" : undefined}
              >
                {actionContent}
              </PrimaryAction>
            )}
            {config.hasServices && (
              <SecondaryScrollAction to="services" smooth offset={-88}>
                Conhecer serviços
              </SecondaryScrollAction>
            )}
          </Actions>
          {config.quote && (
            <QuoteBlock>
              <p>{config.quote}</p>
              {config.quoteAuthor && <span>{config.quoteAuthor}</span>}
            </QuoteBlock>
          )}
        </CopyColumn>
        <MediaColumn>
          <PublicHeroCarousel images={config.images} displayName={config.displayName} />
        </MediaColumn>
      </HeroInner>
    </Hero>
  );
}

PublicHero.propTypes = {
  config: PropTypes.shape({
    action: PropTypes.shape({
      href: PropTypes.string.isRequired,
      isExternal: PropTypes.bool.isRequired,
      label: PropTypes.string.isRequired,
      type: PropTypes.string.isRequired,
    }).isRequired,
    displayName: PropTypes.string.isRequired,
    eyebrow: PropTypes.string.isRequired,
    images: PropTypes.arrayOf(PropTypes.shape({
      alt: PropTypes.string.isRequired,
      src: PropTypes.string.isRequired,
    })).isRequired,
    hasServices: PropTypes.bool.isRequired,
    quote: PropTypes.string,
    quoteAuthor: PropTypes.string,
    subtitle: PropTypes.string.isRequired,
    title: PropTypes.string.isRequired,
  }).isRequired,
};

const Hero = styled.section`
  position: relative;
  min-height: 100vh;
  padding: 128px 0 74px;
  background:
    linear-gradient(90deg, rgba(247, 248, 244, 0.98), rgba(255, 255, 255, 0.78) 48%, rgba(255, 255, 255, 0.54)),
    radial-gradient(circle at 12% 18%, rgba(106, 121, 92, 0.12), transparent 30%),
    #fbfbf8;
  overflow: hidden;

  &::after {
    content: "";
    position: absolute;
    inset: auto 0 0;
    height: 1px;
    background: rgba(106, 121, 92, 0.14);
  }

  @media (max-width: 900px) {
    min-height: auto;
    padding: 96px 0 42px;
  }
`;

const HeroInner = styled.div`
  width: min(1220px, calc(100% - 48px));
  margin: 0 auto;
  display: grid;
  grid-template-columns: minmax(0, 0.92fr) minmax(420px, 1.08fr);
  align-items: center;
  gap: clamp(28px, 5vw, 72px);

  @media (max-width: 960px) {
    width: min(720px, calc(100% - 32px));
    grid-template-columns: 1fr;
    gap: 24px;
  }
`;

const CopyColumn = styled.div`
  position: relative;
  z-index: 2;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
`;

const Eyebrow = styled.span`
  margin-bottom: 18px;
  color: var(--public-secondary-color, #3d5230);
  font-size: 0.78rem;
  font-weight: 800;
  letter-spacing: 0.12em;
  text-transform: uppercase;
`;

const Title = styled.h1`
  max-width: 640px;
  margin: 0;
  color: #151d17;
  font-size: clamp(2.5rem, 5.2vw, 4.95rem);
  line-height: 1.02;
  font-weight: 800;

  @media (max-width: 760px) {
    max-width: 100%;
    font-size: clamp(2.15rem, 10vw, 3.05rem);
    line-height: 1.04;
  }
`;

const Subtitle = styled.p`
  max-width: 590px;
  margin: 22px 0 0;
  color: #455046;
  font-size: clamp(1.02rem, 1.6vw, 1.22rem);
  line-height: 1.7;
  font-weight: 600;

  @media (max-width: 760px) {
    margin-top: 16px;
    font-size: 1rem;
    line-height: 1.5;
  }
`;

const Actions = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 28px;

  @media (max-width: 760px) {
    margin-top: 20px;
  }
`;

const actionStyles = `
  min-height: 48px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 9px;
  border-radius: 999px;
  padding: 0 20px;
  font-weight: 800;
  text-decoration: none;
`;

const PrimaryAction = styled.a`
  ${actionStyles}
  background: var(--public-primary-color, #6a795c);
  color: #fff;
  border: 1px solid var(--public-primary-color, #6a795c);
  box-shadow: 0 12px 28px rgba(36, 49, 39, 0.16);

  &:hover,
  &:focus-visible {
    background: var(--public-secondary-color, #3d5230);
    color: #fff;
    outline: none;
  }
`;

const PrimaryScrollAction = styled(ScrollLink)`
  ${actionStyles}
  background: var(--public-primary-color, #6a795c);
  color: #fff;
  border: 1px solid var(--public-primary-color, #6a795c);
  cursor: pointer;
  box-shadow: 0 12px 28px rgba(36, 49, 39, 0.16);

  &:hover,
  &:focus-visible {
    background: var(--public-secondary-color, #3d5230);
    color: #fff !important;
    outline: none;
  }

  &:hover svg,
  &:hover span,
  &:focus-visible svg,
  &:focus-visible span {
    color: #fff;
  }
`;

const SecondaryScrollAction = styled(ScrollLink)`
  ${actionStyles}
  background: rgba(255, 255, 255, 0.72);
  color: #29342c;
  border: 1px solid rgba(106, 121, 92, 0.2);
  cursor: pointer;
`;

const QuoteBlock = styled.aside`
  max-width: 520px;
  margin-top: 38px;
  padding-left: 18px;
  border-left: 3px solid var(--public-accent-color, #a2b190);
  color: #3a453c;

  p {
    margin: 0;
    font-size: 0.96rem;
    line-height: 1.55;
    font-style: italic;
  }

  span {
    display: block;
    margin-top: 8px;
    color: var(--public-secondary-color, #3d5230);
    font-size: 0.84rem;
    font-weight: 800;
  }

  @media (max-width: 760px) {
    display: none;
  }
`;

const MediaColumn = styled.div`
  min-width: 0;
`;
