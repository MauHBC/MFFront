import React from "react";
import PropTypes from "prop-types";
import styled from "styled-components";
import { usePublicClinicContext } from "../../contexts/PublicClinicContext";
import PublicHeroCarousel from "../PublicLanding/PublicHeroCarousel";
import { WhatIsContent } from "./ModularSections";
import {
  LandingEyebrow,
  LandingInner,
  LandingIntro,
  LandingSection,
} from "../PublicLanding/publicLandingPrimitives";

export default function Gallery({ content, whatIsContent = null }) {
  const { displayName } = usePublicClinicContext();
  const images = (content.items || [])
    .filter((item) => item.visible !== false && item.url)
    .map((item) => ({ src: item.url, alt: item.alt_text || "" }));
  if (images.length === 0) return null;

  const hasIntro = Boolean(content.eyebrow || content.title || content.text);
  const vertical = content.layout === "vertical";
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
        <GalleryComposition $vertical={vertical} $paired={Boolean(whatIsContent)}>
          <GalleryFrame aria-label="Galeria da estrutura" $vertical={vertical}>
            <PublicHeroCarousel images={images} displayName={displayName} variant="section" />
          </GalleryFrame>
          {vertical && whatIsContent && <WhatIsContent content={whatIsContent} />}
        </GalleryComposition>
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
    layout: PropTypes.oneOf(["horizontal", "vertical"]),
  }).isRequired,
  // The function parameter supplies the runtime default; this project still uses an older lint rule.
  // eslint-disable-next-line react/require-default-props
  whatIsContent: PropTypes.shape({}),
};

const GalleryComposition = styled.div`
  display: grid;
  grid-template-columns: ${({ $vertical, $paired }) => ($vertical && $paired ? "minmax(0, 45fr) minmax(0, 55fr)" : "minmax(0, 1fr)")};
  gap: clamp(28px, 5vw, 64px);
  align-items: center;
  ${({ $vertical, $paired }) => ($vertical && !$paired ? "max-width: min(100%, 560px); margin-inline: auto;" : "")}

  @media (max-width: 820px) {
    grid-template-columns: minmax(0, 1fr);
  }
`;

const GalleryFrame = styled.div`
  width: min(100%, 1120px);
  min-width: 0;
  margin: 0 auto;

  > div {
    min-height: 0;
    aspect-ratio: ${({ $vertical }) => ($vertical ? "4 / 5" : "7 / 3")};
  }

  @media (max-width: 760px) {
    > div {
      aspect-ratio: ${({ $vertical }) => ($vertical ? "4 / 5" : "4 / 3")};
    }
  }
`;
