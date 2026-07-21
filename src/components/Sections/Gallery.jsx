import React from "react";
import PropTypes from "prop-types";
import styled from "styled-components";
import { usePublicClinicContext } from "../../contexts/PublicClinicContext";
import PublicHeroCarousel from "../PublicLanding/PublicHeroCarousel";
import {
  LandingEyebrow,
  LandingInner,
  LandingIntro,
  LandingSection,
} from "../PublicLanding/publicLandingPrimitives";

export default function Gallery({ content }) {
  const { displayName } = usePublicClinicContext();
  const images = (content.items || [])
    .filter((item) => item.visible !== false && item.url)
    .map((item) => ({ src: item.url, alt: item.alt_text || "" }));
  if (images.length === 0) return null;

  const hasIntro = Boolean(content.eyebrow || content.title || content.text);
  return (
    <LandingSection id="gallery" aria-label="Estrutura">
      <LandingInner>
        {hasIntro && (
          <LandingIntro>
            {content.eyebrow && <LandingEyebrow>{content.eyebrow}</LandingEyebrow>}
            {content.title && <h2>{content.title}</h2>}
            {content.text && <p>{content.text}</p>}
          </LandingIntro>
        )}
        <GalleryFrame aria-label="Galeria da estrutura">
          <PublicHeroCarousel images={images} displayName={displayName} variant="section" />
        </GalleryFrame>
      </LandingInner>
    </LandingSection>
  );
}

Gallery.propTypes = {
  content: PropTypes.shape({
    eyebrow: PropTypes.string,
    items: PropTypes.arrayOf(PropTypes.shape({
      alt_text: PropTypes.string,
      url: PropTypes.string,
      visible: PropTypes.bool,
    })),
    text: PropTypes.string,
    title: PropTypes.string,
  }).isRequired,
};

const GalleryFrame = styled.div`
  width: min(100%, 1120px);
  min-width: 0;
  margin: 0 auto;

  > div {
    min-height: 0;
    aspect-ratio: 7 / 3;
  }

  @media (max-width: 760px) {
    > div {
      aspect-ratio: 4 / 3;
    }
  }
`;
