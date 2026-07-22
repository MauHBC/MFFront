/* eslint-disable react/require-default-props, react/prop-types, react/no-array-index-key, no-param-reassign, no-nested-ternary */
import React, { useState } from "react";
import PropTypes from "prop-types";
import styled from "styled-components";
import {
  LandingEyebrow,
  LandingInner,
  LandingIntro,
  LandingSection,
  NumberMarker,
  paragraphsFrom,
} from "../PublicLanding/publicLandingPrimitives";

const contentType = PropTypes.shape({});
const visible = (items = []) => items.filter((item) => item.visible !== false);
const initialsFrom = (name) => String(name || "")
  .trim()
  .split(/\s+/)
  .slice(0, 2)
  .map((part) => part.charAt(0))
  .join("")
  .toUpperCase();

function SafeImage({ image, fallbackLabel, className = undefined }) {
  const [failed, setFailed] = useState(false);
  if (!image?.url || failed) {
    return <ImageFallback className={className} aria-hidden="true"><span>{fallbackLabel}</span></ImageFallback>;
  }
  return <img className={className} src={image.url} alt={image.alt_text || ""} onError={() => setFailed(true)} />;
}

SafeImage.propTypes = {
  className: PropTypes.string,
  fallbackLabel: PropTypes.string.isRequired,
  image: PropTypes.shape({ alt_text: PropTypes.string, url: PropTypes.string }),
};

export function WhatIsContent({ content }) {
  const paragraphs = paragraphsFrom(content.text);
  if (!content.eyebrow && !content.title && paragraphs.length === 0 && !content.image) return null;
  return (
    <Split $hasImage={Boolean(content.image)}>
      <LandingIntro $compact>
        {content.eyebrow && <LandingEyebrow>{content.eyebrow}</LandingEyebrow>}
        {content.title && <h2 id="public-what-is-title">{content.title}</h2>}
        {paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
      </LandingIntro>
      {content.image && <EditorialImage image={content.image} fallbackLabel="Imagem indisponível" />}
    </Split>
  );
}

export function WhatIs({ content }) {
  return (
    <LandingSection id="what-is" aria-label={content.title ? undefined : "O que é"} aria-labelledby={content.title ? "public-what-is-title" : undefined}>
      <LandingInner>
        <WhatIsContent content={content} />
      </LandingInner>
    </LandingSection>
  );
}

export function Audience({ content }) {
  const items = visible(content.items).filter((item) => item.title);
  if (items.length === 0) return null;
  return (
    <AudienceSection id="audience" aria-label={content.title ? undefined : "Para quem é"} aria-labelledby={content.title ? "public-audience-title" : undefined}>
      <LandingInner>
        <LandingIntro>
          {content.eyebrow && <LandingEyebrow>{content.eyebrow}</LandingEyebrow>}
          {content.title && <h2 id="public-audience-title">{content.title}</h2>}
          {content.text && <p>{content.text}</p>}
        </LandingIntro>
        <AudienceList>
          {items.map((item, index) => (
            <AudienceItem key={`${item.title}-${index}`}>
              <NumberMarker aria-hidden="true">{String(index + 1).padStart(2, "0")}</NumberMarker>
              <div><h3>{item.title}</h3>{item.description && <p>{item.description}</p>}</div>
            </AudienceItem>
          ))}
        </AudienceList>
      </LandingInner>
    </AudienceSection>
  );
}

export function Conversion({ content }) {
  if (!content.title && !content.text && !content.action) return null;
  return (
    <ConversionSection id="conversion" aria-label={content.title ? undefined : "Próximo passo"} aria-labelledby={content.title ? "public-conversion-title" : undefined} $tone={content.tone}>
      <LandingInner>
        <ConversionInner>
          <div>
            {content.title && <h2 id="public-conversion-title">{content.title}</h2>}
            {content.text && <p>{content.text}</p>}
          </div>
          {content.action && (
            <ConversionAction
              href={content.action.url}
              target={/^https?:\/\//i.test(content.action.url) ? "_blank" : undefined}
              rel={/^https?:\/\//i.test(content.action.url) ? "noopener noreferrer" : undefined}
            >{content.action.label}</ConversionAction>
          )}
        </ConversionInner>
      </LandingInner>
    </ConversionSection>
  );
}

export function Approach({ content }) {
  const steps = visible(content.steps).filter((item) => item.title);
  if (steps.length === 0) return null;
  return (
    <LandingSection id="approach" aria-label={content.title ? undefined : "Abordagem"} aria-labelledby={content.title ? "public-approach-title" : undefined}>
      <LandingInner>
        <LandingIntro>
          {content.eyebrow && <LandingEyebrow>{content.eyebrow}</LandingEyebrow>}
          {content.title && <h2 id="public-approach-title">{content.title}</h2>}
          {content.text && <p>{content.text}</p>}
        </LandingIntro>
        <Steps>
          {steps.map((step, index) => (
            <Step key={`${step.title}-${index}`}>
              <NumberMarker aria-hidden="true">{String(index + 1).padStart(2, "0")}</NumberMarker>
              <h3>{step.title}</h3>
              {step.description && <p>{step.description}</p>}
            </Step>
          ))}
        </Steps>
      </LandingInner>
    </LandingSection>
  );
}

export function Professionals({ content }) {
  const items = visible(content.items)
    .filter((item) => item.editorial_authorized === true && item.name);
  if (items.length === 0) return null;
  return (
    <LandingSection id="professionals" aria-label={content.title ? undefined : "Profissionais"} aria-labelledby={content.title ? "public-professionals-title" : undefined}>
      <LandingInner>
        <LandingIntro>
          {content.eyebrow && <LandingEyebrow>{content.eyebrow}</LandingEyebrow>}
          {content.title && <h2 id="public-professionals-title">{content.title}</h2>}
          {content.text && <p>{content.text}</p>}
        </LandingIntro>
        <ProfessionalsGrid>
          {items.map((item, index) => (
            <PersonCard key={`${item.name}-${index}`}>
              <PersonVisual image={item.image} fallbackLabel={initialsFrom(item.name) || "Pessoa"} />
              <CardCopy>
                <h3>{item.name}</h3>
                {item.role && <strong>{item.role}</strong>}
                {item.registration && <span>{item.registration}</span>}
                {item.bio && <p>{item.bio}</p>}
              </CardCopy>
            </PersonCard>
          ))}
        </ProfessionalsGrid>
      </LandingInner>
    </LandingSection>
  );
}

export function Testimonials({ content }) {
  const items = visible(content.items)
    .filter((item) => item.editorial_authorized === true && item.quote);
  if (items.length === 0) return null;
  return (
    <LandingSection id="testimonials" aria-label={content.title ? undefined : "Depoimentos"} aria-labelledby={content.title ? "public-testimonials-title" : undefined}>
      <LandingInner>
        <LandingIntro>
          {content.eyebrow && <LandingEyebrow>{content.eyebrow}</LandingEyebrow>}
          {content.title && <h2 id="public-testimonials-title">{content.title}</h2>}
        </LandingIntro>
        <CardGrid>
          {items.map((item, index) => (
            <TestimonialCard key={`${item.author || "depoimento"}-${index}`}>
              <QuoteMark aria-hidden="true">“</QuoteMark>
              <blockquote>{item.quote}</blockquote>
              {(item.author || item.description) && (
                <footer>{item.author && <strong>{item.author}</strong>}{item.description && <span>{item.description}</span>}</footer>
              )}
            </TestimonialCard>
          ))}
        </CardGrid>
      </LandingInner>
    </LandingSection>
  );
}

[WhatIsContent, WhatIs, Audience, Conversion, Approach, Professionals, Testimonials].forEach((Component) => {
  Component.propTypes = { content: contentType.isRequired };
});

const Split = styled.div`
  display: grid;
  grid-template-columns: ${({ $hasImage }) => ($hasImage ? "minmax(0, .9fr) minmax(300px, .72fr)" : "minmax(0, 780px)")};
  gap: clamp(32px, 6vw, 76px);
  align-items: center;
  @media (max-width: 820px) { grid-template-columns: 1fr; }
`;
const ImageFallback = styled.div`
  min-height: 280px; background: linear-gradient(145deg, #e8eee5, #d7e1d2); display: grid; place-items: center;
  span { color: #526054; font-weight: 700; }
`;
const EditorialImage = styled(SafeImage)`width: 100%; min-height: 300px; max-height: 440px; object-fit: cover; border-radius: 8px;`;
const AudienceList = styled.ul`
  margin: 0; padding: 0; list-style: none; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0 clamp(28px, 5vw, 64px);
  @media (max-width: 700px) { grid-template-columns: 1fr; }
`;
const AudienceSection = styled(LandingSection)`
  padding-top: clamp(32px, 4vw, 48px);
`;
const AudienceItem = styled.li`
  padding: 20px 0; border-top: 1px solid rgba(106,121,92,.2); display: grid; grid-template-columns: auto 1fr; gap: 16px;
  h3 { margin: 0; color: var(--landing-section-text, #18211d); font-size: 1.15rem; } p { margin: 8px 0 0; color: var(--landing-section-muted, #4b574d); line-height: 1.55; }
`;
const ConversionSection = styled(LandingSection)`
  background: ${({ $tone }) => ($tone === "neutral" ? "#263128" : $tone === "secondary" ? "var(--public-secondary-color, #3d5230)" : "var(--public-primary-color, #6a795c)")};
  color: #fff; padding: clamp(34px, 5vw, 56px) 0;
`;
const ConversionInner = styled.div`
  display: flex; align-items: center; justify-content: space-between; gap: 28px;
  h2 { margin: 0; color: #fff; font-size: clamp(1.8rem, 3.6vw, 3rem); line-height: 1.08; }
  p { max-width: 700px; margin: 12px 0 0; color: rgba(255,255,255,.9); line-height: 1.6; font-weight: 600; }
  @media (max-width: 700px) { align-items: flex-start; flex-direction: column; }
`;
const ConversionAction = styled.a`
  min-height: 48px; padding: 0 24px; border-radius: 999px; background: #fff; color: #172019; display: inline-flex; align-items: center; justify-content: center; font-weight: 800; text-decoration: none; white-space: nowrap;
  &:focus-visible { outline: 3px solid var(--public-accent-color, #a2b190); outline-offset: 3px; }
`;
const Steps = styled.ol`
  margin: 0; padding: 0; list-style: none; display: grid; grid-template-columns: repeat(auto-fit, minmax(min(220px, 100%), 1fr)); gap: 18px;
`;
const Step = styled.li`
  padding: clamp(22px, 3vw, 30px); border: 1px solid color-mix(in srgb, var(--landing-section-text, #151d17) 16%, transparent); background: var(--landing-section-surface, rgba(255,255,255,.68));
  h3 { margin: 14px 0 0; color: var(--landing-section-text, #18211d); font-size: 1.25rem; } p { margin: 10px 0 0; color: var(--landing-section-muted, #4b574d); line-height: 1.58; }
`;
const CardGrid = styled.div`
  display: grid; grid-template-columns: repeat(auto-fit, minmax(min(260px, 100%), 1fr)); gap: 18px;
`;
const ProfessionalsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(220px, 100%), 270px));
  justify-content: center;
  gap: clamp(18px, 2.4vw, 28px);

  @media (max-width: 620px) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  @media (max-width: 430px) {
    grid-template-columns: minmax(0, 320px);
  }
`;
const PersonCard = styled.article`
  min-width: 0;
  overflow: hidden;
  border: 1px solid color-mix(in srgb, var(--public-primary-color, #6a795c) 18%, transparent);
  border-radius: 8px;
  background: var(--landing-section-surface, #fff);
`;
const PersonVisual = styled(SafeImage)`
  width: 100%;
  min-height: 0;
  aspect-ratio: 4 / 5;
  object-fit: cover;

  span {
    width: clamp(72px, 34%, 108px);
    aspect-ratio: 1;
    border-radius: 50%;
    background: color-mix(in srgb, var(--public-primary-color, #6a795c) 18%, #fff);
    color: var(--landing-section-text, color-mix(in srgb, var(--public-secondary-color, #3d5230) 86%, #111));
    display: grid;
    place-items: center;
    font-size: clamp(1.4rem, 4vw, 2rem);
    letter-spacing: 0.05em;
  }
`;
const CardCopy = styled.div`
  padding: clamp(18px, 2.4vw, 24px); display: grid; gap: 7px;
  h3 { margin: 0; color: var(--landing-section-text, #18211d); font-size: clamp(1.2rem, 1.8vw, 1.42rem); line-height: 1.18; overflow-wrap: anywhere; }
  strong { color: var(--landing-section-accent, var(--public-secondary-color, #3d5230)); line-height: 1.35; }
  span { color: var(--landing-section-muted, #59645b); font-size: .9rem; overflow-wrap: anywhere; }
  p { margin: 8px 0 0; color: var(--landing-section-muted, #4b574d); line-height: 1.55; display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 5; overflow: hidden; }
`;
const TestimonialCard = styled.article`
  position: relative; padding: clamp(24px, 3.5vw, 34px); border: 1px solid color-mix(in srgb, var(--landing-section-text, #151d17) 16%, transparent); background: var(--landing-section-surface, rgba(255,255,255,.74));
  blockquote { margin: 0; color: var(--landing-section-text, #253027); font-size: 1.06rem; line-height: 1.7; font-weight: 600; }
  footer { margin-top: 22px; display: grid; gap: 3px; } footer strong { color: var(--landing-section-text, #18211d); } footer span { color: var(--landing-section-muted, #59645b); font-size: .9rem; }
`;
const QuoteMark = styled.span`display: block; height: 30px; color: var(--landing-section-accent, var(--public-primary-color, #6a795c)); font-family: Georgia, serif; font-size: 3.6rem; line-height: .8;`;
