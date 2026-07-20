import React, { useState } from "react";
import PropTypes from "prop-types";
import styled from "styled-components";
import { usePublicClinicContext } from "../../contexts/PublicClinicContext";
import { normalizePublicLandingConfig } from "../../utils/publicLanding";
import { publicLandingSpacing } from "../PublicLanding/publicLandingLayout";

const getServicesVariant = (servicesCount) => {
  if (servicesCount === 1) return "single";
  if (servicesCount === 2) return "pair";
  return "grid";
};

function ServiceVisual({ service, variant }) {
  const [imageFailed, setImageFailed] = useState(false);
  const showImage = Boolean(service.imageSrc) && !imageFailed;

  return (
    <ServiceVisualWrap $variant={variant}>
      {showImage ? (
        <img
          src={service.imageSrc}
          alt={service.imageAlt || service.title}
          onError={() => setImageFailed(true)}
        />
      ) : (
        <ServiceVisualFallback aria-hidden="true" data-testid="service-visual-fallback" />
      )}
    </ServiceVisualWrap>
  );
}

ServiceVisual.propTypes = {
  service: PropTypes.shape({
    imageAlt: PropTypes.string,
    imageSrc: PropTypes.string,
    title: PropTypes.string.isRequired,
  }).isRequired,
  variant: PropTypes.oneOf(["single", "pair", "grid"]).isRequired,
};

export default function Services() {
  const { publicClinic, displayName } = usePublicClinicContext();
  const config = normalizePublicLandingConfig({ publicClinic, displayName });
  const { services } = config;

  if (!config.hasServices) return null;

  const variant = getServicesVariant(services.length);

  return (
    <Wrapper id="services" aria-labelledby="public-services-title">
      <Inner>
        <SectionHeader>
          {config.servicesLabel && <Eyebrow>{config.servicesLabel}</Eyebrow>}
          <h2 id="public-services-title">{config.servicesTitle}</h2>
        </SectionHeader>
        <ServicesGrid $variant={variant}>
          {services.map((service, index) => (
            <ServiceCard key={service.id} $variant={variant}>
              <ServiceVisual service={service} variant={variant} />
              <ServiceIndex>{String(index + 1).padStart(2, "0")}</ServiceIndex>
              <ServiceContent>
                <h3>{service.title}</h3>
                {service.description && <p>{service.description}</p>}
              </ServiceContent>
            </ServiceCard>
          ))}
        </ServicesGrid>
      </Inner>
    </Wrapper>
  );
}

const Wrapper = styled.section`
  position: relative;
  width: 100%;
  scroll-margin-top: 104px;
  padding: ${publicLandingSpacing.sectionBlock} 0;
  background:
    linear-gradient(180deg, #fbfbf8 0%, #f4f7f2 100%);

  &::before {
    content: "";
    position: absolute;
    inset: 0 0 auto;
    height: 1px;
    background: rgba(106, 121, 92, 0.16);
  }
`;

const Inner = styled.div`
  width: min(1220px, calc(100% - 48px));
  margin: 0 auto;

  @media (max-width: 760px) {
    width: min(720px, calc(100% - 32px));
  }
`;

const SectionHeader = styled.div`
  max-width: 680px;
  margin-bottom: ${publicLandingSpacing.sectionGap};

  h2 {
    margin: 0;
    color: #151d17;
    font-size: clamp(2rem, 4vw, 3.45rem);
    line-height: 1.06;
    font-weight: 800;
  }
`;

const Eyebrow = styled.span`
  display: block;
  margin-bottom: 8px;
  color: color-mix(in srgb, var(--public-secondary-color, #3d5230) 88%, #111 12%);
  font-size: 0.78rem;
  font-weight: 800;
  letter-spacing: 0.12em;
  text-transform: uppercase;
`;

const ServicesGrid = styled.div`
  display: grid;
  gap: 18px;
  grid-template-columns: ${({ $variant }) => {
    if ($variant === "single") return "minmax(0, 760px)";
    if ($variant === "pair") return "repeat(2, minmax(0, 1fr))";
    return "repeat(auto-fit, minmax(250px, 1fr))";
  }};
  justify-content: ${({ $variant }) => ($variant === "single" ? "start" : "stretch")};

  @media (max-width: 760px) {
    grid-template-columns: 1fr;
  }
`;

const ServiceCard = styled.article`
  position: relative;
  min-height: 100%;
  border-radius: 8px;
  border: 1px solid rgba(106, 121, 92, 0.16);
  background:
    linear-gradient(145deg, rgba(255, 255, 255, 0.94), rgba(255, 255, 255, 0.72));
  box-shadow: 0 18px 50px rgba(22, 33, 28, 0.08);
  display: flex;
  flex-direction: column;
  overflow: hidden;

  @media (max-width: 760px) {
    min-height: 0;
  }
`;

const ServiceVisualWrap = styled.div`
  position: relative;
  height: ${({ $variant }) => ($variant === "single" ? "214px" : "176px")};
  overflow: hidden;
  background:
    linear-gradient(135deg, rgba(255, 255, 255, 0.42), rgba(255, 255, 255, 0) 48%),
    linear-gradient(150deg, var(--public-primary-color, #6a795c), var(--public-secondary-color, #3d5230));

  img {
    width: 100%;
    height: 100%;
    display: block;
    object-fit: cover;
  }

  @media (max-width: 760px) {
    height: ${({ $variant }) => ($variant === "single" ? "178px" : "154px")};
  }
`;

const ServiceVisualFallback = styled.div`
  position: absolute;
  inset: 0;
  background:
    linear-gradient(135deg, rgba(255, 255, 255, 0.62), rgba(255, 255, 255, 0.06) 48%, rgba(255, 255, 255, 0.18)),
    linear-gradient(90deg, color-mix(in srgb, var(--public-primary-color, #6a795c) 26%, #fff 74%), transparent 58%),
    linear-gradient(150deg, color-mix(in srgb, var(--public-secondary-color, #3d5230) 18%, #fff 82%), color-mix(in srgb, var(--public-accent-color, #a2b190) 34%, #fff 66%));

  &::before,
  &::after {
    content: "";
    position: absolute;
    inset: 18px;
    border: 1px solid rgba(255, 255, 255, 0.44);
    opacity: 0.72;
  }

  &::before {
    transform: skewX(-14deg) translateX(-16%);
    background:
      linear-gradient(90deg, rgba(255, 255, 255, 0.34), rgba(255, 255, 255, 0));
  }

  &::after {
    inset: 34px 24px 22px auto;
    width: 38%;
    transform: skewX(-14deg);
    background:
      linear-gradient(180deg, rgba(255, 255, 255, 0.26), rgba(255, 255, 255, 0.04));
  }
`;

const ServiceContent = styled.div`
  flex: 1;
  min-height: 188px;
  padding: 38px clamp(22px, 2.6vw, 30px) clamp(22px, 2.6vw, 30px);
  display: flex;
  flex-direction: column;

  h3 {
    margin: 0;
    color: #18211d;
    font-size: clamp(1.25rem, 1.8vw, 1.78rem);
    line-height: 1.12;
    font-weight: 800;
  }

  p {
    max-width: 560px;
    margin: 12px 0 0;
    color: #455046;
    font-size: 0.96rem;
    line-height: 1.56;
    font-weight: 600;
  }

  @media (max-width: 760px) {
    min-height: auto;
    padding: 34px 22px 24px;
  }
`;

const ServiceIndex = styled.span`
  position: absolute;
  top: ${({ $variant }) => ($variant === "single" ? "193px" : "155px")};
  left: clamp(22px, 2.6vw, 30px);
  width: 42px;
  height: 42px;
  border-radius: 999px;
  background: var(--public-primary-color, #6a795c);
  color: #fff;
  box-shadow: 0 10px 22px rgba(22, 33, 28, 0.16);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 0.82rem;
  font-weight: 800;
  z-index: 1;

  @media (max-width: 760px) {
    top: ${({ $variant }) => ($variant === "single" ? "157px" : "133px")};
    left: 22px;
  }
`;
