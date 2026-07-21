/* eslint-disable react/require-default-props */
import React, { useState } from "react";
import PropTypes from "prop-types";
import styled from "styled-components";
import { usePublicClinicContext } from "../../contexts/PublicClinicContext";
import { normalizePublicLandingConfig } from "../../utils/publicLanding";
import {
  LandingEyebrow,
  LandingInner,
  LandingIntro,
  LandingSection,
  LandingVariantSurface,
  normalizeLandingBackgroundVariant,
  paragraphsFrom,
} from "../PublicLanding/publicLandingPrimitives";

function SafeAboutImage({ image, className = undefined }) {
  const [failed, setFailed] = useState(false);
  if (!image?.src || failed) return <ImageFallback className={className} aria-hidden="true" />;
  return <img className={className} src={image.src} alt={image.alt || ""} onError={() => setFailed(true)} />;
}

SafeAboutImage.propTypes = {
  className: PropTypes.string,
  image: PropTypes.shape({ alt: PropTypes.string, src: PropTypes.string }),
};

export default function About({ content }) {
  const { publicClinic, displayName } = usePublicClinicContext();
  const fallback = normalizePublicLandingConfig({ publicClinic, displayName }).about;
  const paragraphs = content?.content !== undefined
    ? paragraphsFrom(content.content)
    : fallback.paragraphs;
  const images = content?.images
    ? content.images.map((image) => ({ src: image.url, alt: image.alt_text || "" }))
    : fallback.images;
  const eyebrow = content?.eyebrow ?? fallback.label;
  const title = content?.title ?? fallback.title;
  const origin = content?.origin;
  const originVisible = Boolean(origin?.enabled && (
    origin.content?.eyebrow || origin.content?.title || origin.content?.text || origin.content?.image
  ));
  if (!eyebrow && !title && paragraphs.length === 0 && images.length === 0 && !originVisible) return null;

  return (
    <LandingSection id="about" aria-label="Sobre a clínica">
      <LandingInner>
        <Institutional $hasImages={images.length > 0}>
          <LandingIntro $compact>
            {eyebrow && <LandingEyebrow>{eyebrow}</LandingEyebrow>}
            {title && <h2>{title}</h2>}
            {paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
          </LandingIntro>
          {images.length > 0 && (
            <Images>
              <SafeAboutImage image={images[0]} />
              {images[1] && <SafeAboutImage image={images[1]} />}
            </Images>
          )}
        </Institutional>
        {originVisible && (
          <Origin backgroundVariant={origin.background_variant}>
            <LandingIntro $compact>
              {origin.content.eyebrow && <LandingEyebrow>{origin.content.eyebrow}</LandingEyebrow>}
              {origin.content.title && <h2>{origin.content.title}</h2>}
              {paragraphsFrom(origin.content.text).map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
            </LandingIntro>
            {origin.content.image && (
              <SafeAboutImage image={{ src: origin.content.image.url, alt: origin.content.image.alt_text || "" }} />
            )}
          </Origin>
        )}
      </LandingInner>
    </LandingSection>
  );
}

About.propTypes = {
  content: PropTypes.shape({
    content: PropTypes.string,
    eyebrow: PropTypes.string,
    images: PropTypes.arrayOf(PropTypes.shape({ alt_text: PropTypes.string, url: PropTypes.string })),
    origin: PropTypes.shape({
      content: PropTypes.shape({
        eyebrow: PropTypes.string,
        image: PropTypes.shape({ alt_text: PropTypes.string, url: PropTypes.string }),
        text: PropTypes.string,
        title: PropTypes.string,
      }),
      enabled: PropTypes.bool,
      background_variant: PropTypes.string,
    }),
    title: PropTypes.string,
  }).isRequired,
};

const Institutional = styled.div`
  display: grid;
  grid-template-columns: ${({ $hasImages }) => ($hasImages ? "minmax(0, .9fr) minmax(320px, .72fr)" : "minmax(0, 820px)")};
  gap: clamp(32px, 6vw, 76px);
  align-items: center;
  @media (max-width: 860px) { grid-template-columns: 1fr; }
`;
const Images = styled.figure`
  margin: 0; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px;
  img { width: 100%; height: clamp(240px, 32vw, 390px); object-fit: cover; border-radius: 8px; }
  img:only-child { grid-column: 1 / -1; }
`;
const ImageFallback = styled.div`min-height: 240px; border-radius: 8px; background: linear-gradient(145deg, #e8eee5, #d7e1d2);`;
const Origin = styled(LandingVariantSurface)`
  margin-top: clamp(32px, 5vw, 56px);
  padding: clamp(28px, 4vw, 44px);
  border-top: ${({ backgroundVariant }) => (normalizeLandingBackgroundVariant(backgroundVariant) === "default" ? "1px solid rgba(106,121,92,.2)" : "0")};
  border-radius: 8px;
  display: grid; grid-template-columns: minmax(0, 760px) minmax(0, 320px); gap: clamp(28px, 5vw, 60px); align-items: center;
  > img, > div:last-child { width: 100%; max-height: 320px; object-fit: cover; border-radius: 8px; }
  @media (max-width: 760px) { grid-template-columns: 1fr; }
`;
