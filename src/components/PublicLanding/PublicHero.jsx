/* eslint-disable no-use-before-define */
import React from "react";
import PropTypes from "prop-types";
import styled from "styled-components";
import { Link as ScrollLink } from "react-scroll";
import { FaArrowRight, FaWhatsapp } from "react-icons/fa";

const OVERLAY_OPACITY = {
  light: 42,
  medium: 58,
  strong: 72,
};

const OVERLAY_SOURCES = {
  "neutral-dark": "#18211d",
  primary: "var(--public-primary-color, #6a795c)",
  secondary: "var(--public-secondary-color, #3d5230)",
};

function ActionContent({ action }) {
  return (
    <>
      {action.type === "whatsapp" ? <FaWhatsapp /> : <FaArrowRight />}
      <span>{action.label}</span>
    </>
  );
}

ActionContent.propTypes = {
  action: PropTypes.shape({
    label: PropTypes.string.isRequired,
    type: PropTypes.string.isRequired,
  }).isRequired,
};

function HeroAction({ action, secondary = false }) {
  const content = <ActionContent action={action} />;
  if (action.href.startsWith("#")) {
    const target = action.href.replace("#", "");
    return secondary ? (
      <SecondaryScrollAction to={target} smooth offset={-88}>{content}</SecondaryScrollAction>
    ) : (
      <PrimaryScrollAction to={target} smooth offset={-88}>{content}</PrimaryScrollAction>
    );
  }

  return (
    secondary ? (
      <SecondaryAction
        href={action.href}
        target={action.isExternal ? "_blank" : undefined}
        rel={action.isExternal ? "noreferrer" : undefined}
      >
        {content}
      </SecondaryAction>
    ) : (
      <PrimaryAction
        href={action.href}
        target={action.isExternal ? "_blank" : undefined}
        rel={action.isExternal ? "noreferrer" : undefined}
      >
        {content}
      </PrimaryAction>
    )
  );
}

HeroAction.propTypes = {
  action: PropTypes.shape({
    href: PropTypes.string.isRequired,
    isExternal: PropTypes.bool.isRequired,
    label: PropTypes.string.isRequired,
    type: PropTypes.string.isRequired,
  }).isRequired,
  secondary: PropTypes.bool,
};

HeroAction.defaultProps = {
  secondary: false,
};

export default function PublicHero({ config }) {
  const presentation = config.heroPresentation;
  const overlaySource =
    OVERLAY_SOURCES[presentation.overlayColorSource] || OVERLAY_SOURCES["neutral-dark"];
  const overlayOpacity =
    OVERLAY_OPACITY[presentation.overlayStrength] || OVERLAY_OPACITY.medium;

  return (
    <Hero
      id="home"
      $hasImage={Boolean(config.bannerImage)}
      $overlaySource={overlaySource}
      $overlayOpacity={overlayOpacity}
      $textTone={presentation.textTone}
    >
      {config.bannerImage && (
        <BannerImage
          src={config.bannerImage.src}
          alt={config.bannerImage.alt}
          $position={presentation.imagePosition}
        />
      )}
      <HeroInner>
        <Copy>
          <Eyebrow $textTone={presentation.textTone}>{config.eyebrow}</Eyebrow>
          <Title $textTone={presentation.textTone}>{config.title}</Title>
          <Subtitle $textTone={presentation.textTone}>{config.subtitle}</Subtitle>
          <Actions>
            <HeroAction action={config.action} />
            {config.secondaryAction && (
              <HeroAction action={config.secondaryAction} secondary />
            )}
          </Actions>
        </Copy>
      </HeroInner>
      <NextSectionHint aria-hidden="true" $textTone={presentation.textTone}>
        <span />
      </NextSectionHint>
    </Hero>
  );
}

const actionShape = PropTypes.shape({
  href: PropTypes.string.isRequired,
  isExternal: PropTypes.bool.isRequired,
  label: PropTypes.string.isRequired,
  type: PropTypes.string.isRequired,
});

PublicHero.propTypes = {
  config: PropTypes.shape({
    action: actionShape.isRequired,
    bannerImage: PropTypes.shape({
      alt: PropTypes.string.isRequired,
      src: PropTypes.string.isRequired,
    }),
    eyebrow: PropTypes.string.isRequired,
    heroPresentation: PropTypes.shape({
      imagePosition: PropTypes.oneOf(["left", "center", "right"]).isRequired,
      overlayColorSource: PropTypes.oneOf(["neutral-dark", "primary", "secondary"]).isRequired,
      overlayStrength: PropTypes.oneOf(["light", "medium", "strong"]).isRequired,
      textTone: PropTypes.oneOf(["light", "dark"]).isRequired,
    }).isRequired,
    secondaryAction: actionShape,
    subtitle: PropTypes.string.isRequired,
    title: PropTypes.string.isRequired,
  }).isRequired,
};

const Hero = styled.section`
  position: relative;
  min-height: clamp(520px, 72svh, 760px);
  padding: clamp(72px, 10vw, 126px) 0 clamp(82px, 10vw, 118px);
  background: ${({ $hasImage }) => ($hasImage
    ? "#18211d"
    : "linear-gradient(135deg, var(--public-primary-color, #6a795c), var(--public-secondary-color, #3d5230))")};
  display: flex;
  align-items: center;
  overflow: hidden;
  isolation: isolate;
  scroll-margin-top: 104px;

  &::before {
    content: "";
    position: absolute;
    inset: 0;
    z-index: -1;
    background: ${({ $hasImage, $overlaySource, $overlayOpacity, $textTone }) => {
      if (!$hasImage) {
        return $textTone === "dark"
          ? "linear-gradient(90deg, rgba(255,255,255,.86), rgba(255,255,255,.66))"
          : "linear-gradient(90deg, rgba(0,0,0,.46), rgba(0,0,0,.22))";
      }
      if ($textTone === "dark") {
        return `linear-gradient(90deg, rgba(255,255,255,.92) 0%, rgba(255,255,255,.78) 48%, rgba(255,255,255,.58) 100%), linear-gradient(${$overlaySource}, ${$overlaySource})`;
      }
      return `linear-gradient(90deg, color-mix(in srgb, ${$overlaySource} ${$overlayOpacity}%, #000 ${100 - $overlayOpacity}%) 0%, rgba(0,0,0,.5) 52%, rgba(0,0,0,.34) 100%)`;
    }};
    opacity: ${({ $textTone }) => ($textTone === "dark" ? 0.94 : 1)};
  }

  @media (max-width: 760px) {
    min-height: 500px;
    padding: 66px 0 76px;
  }
`;

const BannerImage = styled.img`
  position: absolute;
  inset: 0;
  z-index: -2;
  width: 100%;
  height: 100%;
  display: block;
  object-fit: cover;
  object-position: ${({ $position }) => `${$position} center`};
`;

const HeroInner = styled.div`
  width: min(1220px, calc(100% - 48px));
  margin: 0 auto;

  @media (max-width: 760px) {
    width: min(720px, calc(100% - 32px));
  }
`;

const Copy = styled.div`
  max-width: min(720px, 76%);
  display: flex;
  flex-direction: column;
  align-items: flex-start;

  @media (max-width: 900px) {
    max-width: 88%;
  }

  @media (max-width: 620px) {
    max-width: 100%;
  }
`;

const Eyebrow = styled.span`
  margin-bottom: 16px;
  color: ${({ $textTone }) => ($textTone === "dark" ? "#243028" : "rgba(255,255,255,.9)")};
  font-size: 0.78rem;
  font-weight: 800;
  letter-spacing: 0.12em;
  text-transform: uppercase;
`;

const Title = styled.h1`
  margin: 0;
  color: ${({ $textTone }) => ($textTone === "dark" ? "#111914" : "#fff")};
  font-size: clamp(2.5rem, 5.2vw, 5rem);
  line-height: 1.01;
  font-weight: 800;
  text-wrap: balance;
  text-shadow: ${({ $textTone }) => ($textTone === "dark" ? "none" : "0 2px 24px rgba(0,0,0,.26)")};

  @media (max-width: 760px) {
    font-size: clamp(2.12rem, 10vw, 3.2rem);
    line-height: 1.04;
  }
`;

const Subtitle = styled.p`
  max-width: 660px;
  margin: 22px 0 0;
  color: ${({ $textTone }) => ($textTone === "dark" ? "#344139" : "rgba(255,255,255,.92)")};
  font-size: clamp(1rem, 1.6vw, 1.24rem);
  line-height: 1.65;
  font-weight: 650;
  text-shadow: ${({ $textTone }) => ($textTone === "dark" ? "none" : "0 1px 16px rgba(0,0,0,.24)")};

  @media (max-width: 760px) {
    margin-top: 16px;
    line-height: 1.52;
  }
`;

const Actions = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 28px;

  @media (max-width: 520px) {
    width: 100%;
    display: grid;
  }
`;

const actionStyles = `
  min-height: 48px;
  padding: 0 22px;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 9px;
  font-weight: 800;
  text-decoration: none;
  cursor: pointer;

  &:focus-visible {
    outline: 3px solid var(--public-accent-color, #a2b190);
    outline-offset: 3px;
  }
`;

const primaryStyles = `
  ${actionStyles}
  border: 1px solid var(--public-primary-color, #6a795c);
  background: var(--public-primary-color, #6a795c);
  color: #fff;
  box-shadow: 0 14px 30px rgba(0,0,0,.2);

  &:hover {
    border-color: var(--public-secondary-color, #3d5230);
    background: var(--public-secondary-color, #3d5230);
    color: #fff;
  }
`;

const secondaryStyles = `
  ${actionStyles}
  border: 1px solid rgba(255,255,255,.68);
  background: rgba(255,255,255,.14);
  color: #fff;
  backdrop-filter: blur(10px);

  &:hover {
    background: rgba(255,255,255,.24);
    color: #fff;
  }
`;

const PrimaryAction = styled.a`${primaryStyles}`;
const PrimaryScrollAction = styled(ScrollLink)`${primaryStyles}`;
const SecondaryAction = styled.a`${secondaryStyles}`;
const SecondaryScrollAction = styled(ScrollLink)`${secondaryStyles}`;

const NextSectionHint = styled.div`
  position: absolute;
  left: 50%;
  bottom: 20px;
  width: 26px;
  height: 42px;
  border: 1px solid ${({ $textTone }) => ($textTone === "dark" ? "rgba(20,30,24,.38)" : "rgba(255,255,255,.58)")};
  border-radius: 999px;
  transform: translateX(-50%);

  span {
    position: absolute;
    left: 50%;
    top: 8px;
    width: 4px;
    height: 8px;
    border-radius: 999px;
    background: ${({ $textTone }) => ($textTone === "dark" ? "#243028" : "#fff")};
    transform: translateX(-50%);
  }

  @media (max-height: 640px), (max-width: 520px) {
    display: none;
  }

  @media (prefers-reduced-motion: no-preference) {
    span {
      animation: public-banner-hint 1.8s ease-in-out infinite;
    }
  }

  @keyframes public-banner-hint {
    0%, 100% { transform: translate(-50%, 0); opacity: .55; }
    50% { transform: translate(-50%, 12px); opacity: 1; }
  }
`;
