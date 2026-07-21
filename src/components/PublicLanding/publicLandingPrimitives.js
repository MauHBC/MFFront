/* eslint-disable react/require-default-props */
import React, { createContext, useContext } from "react";
import PropTypes from "prop-types";
import styled from "styled-components";
import { publicLandingSpacing } from "./publicLandingLayout";

export const LANDING_BACKGROUND_VARIANTS = Object.freeze([
  "default",
  "neutral",
  "brand_soft",
  "brand_solid",
]);

export const normalizeLandingBackgroundVariant = (value) => (
  LANDING_BACKGROUND_VARIANTS.includes(value) ? value : "default"
);

const VariantContext = createContext("default");

const normalizeHex = (value) => {
  const raw = String(value || "").trim().replace(/^#/, "");
  if (/^[a-f\d]{3}$/i.test(raw)) return raw.split("").map((item) => item + item).join("");
  return /^[a-f\d]{6}$/i.test(raw) ? raw : "6a795c";
};

const readableText = (background) => {
  const hex = normalizeHex(background);
  const rgb = [0, 2, 4].map((offset) => parseInt(hex.slice(offset, offset + 2), 16) / 255);
  const luminance = rgb
    .map((channel) => (channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4))
    .reduce((sum, channel, index) => sum + channel * [0.2126, 0.7152, 0.0722][index], 0);
  const whiteContrast = 1.05 / (luminance + 0.05);
  const darkLuminance = 0.009;
  const darkContrast = (luminance + 0.05) / (darkLuminance + 0.05);
  return whiteContrast >= darkContrast ? "#ffffff" : "#151d17";
};

const variantTokens = (variant, primaryColor) => {
  const safeVariant = normalizeLandingBackgroundVariant(variant);
  if (safeVariant === "neutral") {
    return { background: "#e7ece6", text: "#151d17", muted: "#3f4a41", surface: "rgba(255,255,255,.72)", accent: "var(--public-secondary-color, #3d5230)" };
  }
  if (safeVariant === "brand_soft") {
    return { background: "linear-gradient(135deg, color-mix(in srgb, var(--public-primary-color, #6a795c) 18%, #e5ebe2 82%), color-mix(in srgb, var(--public-secondary-color, #3d5230) 12%, #f1f4ee 88%))", text: "#151d17", muted: "#3c493f", surface: "rgba(255,255,255,.64)", accent: "color-mix(in srgb, var(--public-secondary-color, #3d5230) 84%, #111 16%)" };
  }
  if (safeVariant === "brand_solid") {
    const text = readableText(primaryColor);
    const lightText = text === "#ffffff";
    return { background: "var(--public-primary-color, #6a795c)", text, muted: lightText ? "rgba(255,255,255,.84)" : "rgba(21,29,23,.78)", surface: lightText ? "rgba(255,255,255,.14)" : "rgba(255,255,255,.48)", accent: text };
  }
  return { background: "#fbfbf8", text: "#151d17", muted: "#455046", surface: "#ffffff", accent: "color-mix(in srgb, var(--public-secondary-color, #3d5230) 88%, #111 12%)" };
};

const useVariantStyle = (requestedVariant) => {
  const inheritedVariant = useContext(VariantContext);
  const variant = normalizeLandingBackgroundVariant(requestedVariant ?? inheritedVariant);
  const primaryColor = typeof document === "undefined"
    ? null
    : getComputedStyle(document.documentElement).getPropertyValue("--public-primary-color");
  const tokens = variantTokens(variant, primaryColor);
  return {
    variant,
    style: {
      "--landing-section-background": tokens.background,
      "--landing-section-text": tokens.text,
      "--landing-section-muted": tokens.muted,
      "--landing-section-surface": tokens.surface,
      "--landing-section-accent": tokens.accent,
    },
  };
};

export function LandingBackgroundVariantProvider({ children, variant }) {
  return <VariantContext.Provider value={normalizeLandingBackgroundVariant(variant)}>{children}</VariantContext.Provider>;
}

LandingBackgroundVariantProvider.propTypes = {
  children: PropTypes.node.isRequired,
  variant: PropTypes.string,
};

const SectionRoot = styled.section`
  position: relative;
  width: 100%;
  scroll-margin-top: 104px;
  padding: ${publicLandingSpacing.sectionBlock} 0;
  background: var(--landing-section-background);
  color: var(--landing-section-text);

  &:focus-within a:focus-visible,
  &:focus-within button:focus-visible {
    outline-color: var(--landing-section-accent);
  }
`;

export function LandingSection({ $backgroundVariant, style, ...props }) {
  const variant = useVariantStyle($backgroundVariant);
  return React.createElement(SectionRoot, {
    ...props,
    "data-background-variant": variant.variant,
    style: { ...variant.style, ...style },
  });
}

LandingSection.propTypes = {
  $backgroundVariant: PropTypes.string,
  style: PropTypes.shape({}),
};

const VariantSurfaceRoot = styled.div`
  background: var(--landing-section-background);
  color: var(--landing-section-text);
`;

export function LandingVariantSurface({ backgroundVariant, style, ...props }) {
  const variant = useVariantStyle(backgroundVariant);
  return React.createElement(VariantSurfaceRoot, {
    ...props,
    "data-background-variant": variant.variant,
    style: { ...variant.style, ...style },
  });
}

LandingVariantSurface.propTypes = {
  backgroundVariant: PropTypes.string,
  style: PropTypes.shape({}),
};

export const LandingInner = styled.div`
  width: min(1220px, calc(100% - 48px));
  margin: 0 auto;

  @media (max-width: 760px) {
    width: min(720px, calc(100% - 32px));
  }
`;

export const LandingIntro = styled.header`
  max-width: 780px;
  margin-bottom: ${({ $compact }) => ($compact ? "0" : publicLandingSpacing.sectionGap)};

  h2 {
    margin: 0;
    color: var(--landing-section-text, #151d17);
    font-size: clamp(2rem, 4vw, 3.55rem);
    line-height: 1.06;
    font-weight: 800;
    overflow-wrap: anywhere;
  }

  p {
    max-width: 720px;
    margin: 16px 0 0;
    color: var(--landing-section-muted, #455046);
    font-size: clamp(1rem, 1.35vw, 1.12rem);
    line-height: 1.7;
    font-weight: 600;
  }
`;

export const LandingEyebrow = styled.span`
  display: block;
  margin-bottom: 10px;
  color: var(--landing-section-accent, color-mix(in srgb, var(--public-secondary-color, #3d5230) 88%, #111 12%));
  font-size: 0.78rem;
  font-weight: 800;
  letter-spacing: 0.12em;
  text-transform: uppercase;
`;

export const NumberMarker = styled.span`
  color: var(--landing-section-accent, var(--public-primary-color, #6a795c));
  font-size: 0.82rem;
  font-weight: 800;
  letter-spacing: 0.08em;
`;

export const paragraphsFrom = (value) => String(value || "")
  .split(/\n+/)
  .map((paragraph) => paragraph.trim())
  .filter(Boolean);
