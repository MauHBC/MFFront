import React from "react";
import PropTypes from "prop-types";
import styled from "styled-components";
import { usePublicClinicContext } from "../../contexts/PublicClinicContext";
import { normalizePublicLandingConfig } from "../../utils/publicLanding";
import { publicLandingSpacing } from "../PublicLanding/publicLandingLayout";

const getDifferentialsVariant = (count) => {
  if (count === 1) return "single";
  if (count === 2) return "pair";
  return "list";
};

function AboutImages({ images }) {
  if (images.length === 0) return null;

  return (
    <ImageComposition $count={images.length}>
      <PrimaryImage src={images[0].src} alt={images[0].alt} />
      {images[1] && (
        <SecondaryImageWrap>
          <img src={images[1].src} alt={images[1].alt} />
        </SecondaryImageWrap>
      )}
    </ImageComposition>
  );
}

AboutImages.propTypes = {
  images: PropTypes.arrayOf(PropTypes.shape({
    alt: PropTypes.string.isRequired,
    src: PropTypes.string.isRequired,
  })).isRequired,
};

function Differentials({ items }) {
  if (items.length === 0) return null;

  const variant = getDifferentialsVariant(items.length);

  return (
    <DifferentialsBlock $variant={variant} aria-labelledby="public-about-differentials-title">
      <DifferentialsHeader>
        <span aria-hidden="true" />
        <h3 id="public-about-differentials-title">Diferenciais públicos</h3>
      </DifferentialsHeader>
      <DifferentialsList $variant={variant}>
        {items.map((item, index) => (
          <DifferentialItem key={item.id} $variant={variant}>
            <DifferentialMarker aria-hidden="true">{String(index + 1).padStart(2, "0")}</DifferentialMarker>
            <div>
              <h4>{item.title}</h4>
              {item.description && <p>{item.description}</p>}
            </div>
          </DifferentialItem>
        ))}
      </DifferentialsList>
    </DifferentialsBlock>
  );
}

Differentials.propTypes = {
  items: PropTypes.arrayOf(PropTypes.shape({
    description: PropTypes.string,
    id: PropTypes.string.isRequired,
    title: PropTypes.string.isRequired,
  })).isRequired,
};

export default function About() {
  const { publicClinic, displayName } = usePublicClinicContext();
  const config = normalizePublicLandingConfig({ publicClinic, displayName });
  const { about, differentials } = config;

  if (!config.hasAbout) return null;

  const hasInstitutionalContent = about.hasContent;
  const hasImages = about.images.length > 0;

  return (
    <Wrapper id="about" aria-label="Sobre a clínica">
      <Inner $hasInstitutionalContent={hasInstitutionalContent} $hasImages={hasImages}>
        {hasInstitutionalContent && (
          <Institutional $hasImages={hasImages}>
            <Copy>
              {about.label && <Eyebrow>{about.label}</Eyebrow>}
              {about.title && <h2 id="public-about-title">{about.title}</h2>}
              {about.paragraphs.length > 0 && (
                <TextBlock>
                  {about.paragraphs.map((paragraph) => (
                    <p key={paragraph}>{paragraph}</p>
                  ))}
                </TextBlock>
              )}
            </Copy>
            <AboutImages images={about.images} />
          </Institutional>
        )}
        <Differentials items={differentials} />
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
    linear-gradient(180deg, #f4f7f2 0%, #fbfbf8 100%);
`;

const Inner = styled.div`
  width: min(1220px, calc(100% - 48px));
  margin: 0 auto;
  display: grid;
  gap: ${({ $hasInstitutionalContent }) => (
    $hasInstitutionalContent ? publicLandingSpacing.contentGap : "0"
  )};

  @media (max-width: 760px) {
    width: min(720px, calc(100% - 32px));
  }
`;

const Institutional = styled.div`
  display: grid;
  grid-template-columns: ${({ $hasImages }) => ($hasImages ? "minmax(0, 0.88fr) minmax(360px, 0.72fr)" : "minmax(0, 820px)")};
  align-items: center;
  gap: clamp(32px, 6vw, 78px);

  @media (max-width: 920px) {
    grid-template-columns: 1fr;
  }
`;

const Copy = styled.div`
  min-width: 0;

  h2 {
    max-width: 760px;
    margin: 0;
    color: #151d17;
    font-size: clamp(2rem, 4.4vw, 4rem);
    line-height: 1.04;
    font-weight: 800;
  }
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

const TextBlock = styled.div`
  max-width: 720px;
  margin-top: 22px;
  display: grid;
  gap: 14px;

  p {
    margin: 0;
    color: #455046;
    font-size: clamp(1rem, 1.35vw, 1.12rem);
    line-height: 1.72;
    font-weight: 600;
  }
`;

const ImageComposition = styled.figure`
  position: relative;
  min-height: ${({ $count }) => ($count > 1 ? "438px" : "390px")};
  margin: 0;

  @media (max-width: 920px) {
    min-height: ${({ $count }) => ($count > 1 ? "390px" : "300px")};
  }

  @media (max-width: 560px) {
    min-height: ${({ $count }) => ($count > 1 ? "330px" : "240px")};
  }
`;

const PrimaryImage = styled.img`
  width: 86%;
  height: 390px;
  display: block;
  border-radius: 8px;
  object-fit: cover;
  box-shadow: 0 22px 54px rgba(22, 33, 28, 0.14);

  @media (max-width: 920px) {
    width: 100%;
    height: 300px;
  }

  @media (max-width: 560px) {
    height: 240px;
  }
`;

const SecondaryImageWrap = styled.div`
  position: absolute;
  right: 0;
  bottom: 0;
  width: 46%;
  min-width: 180px;
  height: 210px;
  border: 8px solid #fbfbf8;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 16px 42px rgba(22, 33, 28, 0.12);

  img {
    width: 100%;
    height: 100%;
    display: block;
    object-fit: cover;
  }

  @media (max-width: 560px) {
    width: 52%;
    min-width: 150px;
    height: 160px;
    border-width: 6px;
  }
`;

const DifferentialsBlock = styled.div`
  display: grid;
  gap: 20px;
`;

const DifferentialsHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 14px;

  span {
    width: 44px;
    height: 1px;
    background: var(--public-primary-color, #6a795c);
  }

  h3 {
    margin: 0;
    color: #253027;
    font-size: 0.92rem;
    font-weight: 800;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }
`;

const DifferentialsList = styled.div`
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

const DifferentialItem = styled.article`
  min-height: ${({ $variant }) => ($variant === "single" ? "132px" : "156px")};
  padding: clamp(22px, 3vw, 32px);
  border-top: 1px solid rgba(106, 121, 92, 0.22);
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.5), rgba(255, 255, 255, 0.16));
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 18px;

  h4 {
    margin: 0;
    color: #18211d;
    font-size: clamp(1.18rem, 1.6vw, 1.52rem);
    line-height: 1.16;
    font-weight: 800;
  }

  p {
    margin: 10px 0 0;
    color: #4b574d;
    font-size: 0.96rem;
    line-height: 1.55;
    font-weight: 600;
  }

  @media (max-width: 560px) {
    min-height: 0;
    padding: 20px 0;
  }
`;

const DifferentialMarker = styled.span`
  color: var(--public-primary-color, #6a795c);
  font-size: 0.82rem;
  font-weight: 800;
  letter-spacing: 0.08em;
`;
