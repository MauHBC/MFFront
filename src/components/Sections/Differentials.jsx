/* eslint-disable react/no-array-index-key */
import React from "react";
import PropTypes from "prop-types";
import styled from "styled-components";
import {
  LandingEyebrow,
  LandingInner,
  LandingIntro,
  LandingSection,
  NumberMarker,
} from "../PublicLanding/publicLandingPrimitives";

export default function Differentials({ content }) {
  const items = (content.items || []).filter((item) => item.visible !== false && item.title);
  if (items.length === 0) return null;
  return (
    <DifferentialsSection id="differentials" aria-labelledby="public-differentials-title">
      <LandingInner>
        <LandingIntro>
          {content.eyebrow && <LandingEyebrow>{content.eyebrow}</LandingEyebrow>}
          <h2 id="public-differentials-title">{content.title || "Diferenciais"}</h2>
        </LandingIntro>
        <List>
          {items.map((item, index) => (
            <Item key={`${item.title}-${index}`}>
              <NumberMarker aria-hidden="true">{String(index + 1).padStart(2, "0")}</NumberMarker>
              <div>
                <h3>{item.title}</h3>
                {item.description && <p>{item.description}</p>}
              </div>
            </Item>
          ))}
        </List>
      </LandingInner>
    </DifferentialsSection>
  );
}

Differentials.propTypes = {
  content: PropTypes.shape({
    eyebrow: PropTypes.string,
    items: PropTypes.arrayOf(PropTypes.shape({
      description: PropTypes.string,
      title: PropTypes.string,
      visible: PropTypes.bool,
    })),
    title: PropTypes.string,
  }).isRequired,
};

const List = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(260px, 100%), 1fr));
  gap: 18px;
`;

const DifferentialsSection = styled(LandingSection)`
  padding-bottom: clamp(32px, 4vw, 48px);
`;

const Item = styled.article`
  min-width: 0;
  padding: clamp(22px, 3vw, 32px);
  border-top: 1px solid color-mix(in srgb, var(--landing-section-text, #151d17) 18%, transparent);
  background: var(--landing-section-surface, rgba(255,255,255,.54));
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 18px;

  h3 { margin: 0; color: var(--landing-section-text, #18211d); font-size: clamp(1.18rem, 1.6vw, 1.52rem); line-height: 1.16; }
  p { margin: 10px 0 0; color: var(--landing-section-muted, #4b574d); line-height: 1.55; font-weight: 600; }
`;
