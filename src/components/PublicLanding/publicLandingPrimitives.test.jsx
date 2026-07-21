/* eslint-env jest */
import React from "react";
import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import {
  LandingBackgroundVariantProvider,
  LandingSection,
  LandingVariantSurface,
} from "./publicLandingPrimitives";

beforeEach(() => {
  document.documentElement.style.setProperty("--public-primary-color", "#24422d");
});

it("renders the four controlled background variants", () => {
  ["default", "neutral", "brand_soft", "brand_solid"].forEach((variant) => {
    const { unmount } = render(
      <LandingBackgroundVariantProvider variant={variant}>
        <LandingSection aria-label={variant}>Conteúdo</LandingSection>
      </LandingBackgroundVariantProvider>,
    );
    expect(screen.getByLabelText(variant)).toHaveAttribute("data-background-variant", variant);
    unmount();
  });
});

it("keeps neutral and brand soft visually distinct from default", () => {
  const { rerender } = render(<LandingSection aria-label="surface" $backgroundVariant="default" />);
  const section = screen.getByLabelText("surface");
  const defaultBackground = section.style.getPropertyValue("--landing-section-background");
  rerender(<LandingSection aria-label="surface" $backgroundVariant="neutral" />);
  const neutralBackground = section.style.getPropertyValue("--landing-section-background");
  rerender(<LandingSection aria-label="surface" $backgroundVariant="brand_soft" />);
  const brandBackground = section.style.getPropertyValue("--landing-section-background");
  expect(neutralBackground).not.toBe(defaultBackground);
  expect(brandBackground).not.toBe(defaultBackground);
  expect(brandBackground).not.toBe(neutralBackground);
});

it("selects readable solid text for dark and light tenant identities", () => {
  const { rerender } = render(<LandingSection aria-label="solid" $backgroundVariant="brand_solid" />);
  expect(screen.getByLabelText("solid").style.getPropertyValue("--landing-section-text")).toBe("#ffffff");
  document.documentElement.style.setProperty("--public-primary-color", "#ffffff");
  rerender(<LandingSection aria-label="solid" $backgroundVariant="brand_solid" />);
  expect(screen.getByLabelText("solid").style.getPropertyValue("--landing-section-text")).toBe("#151d17");
});

it("normalizes missing and hostile values without exposing them as styles", () => {
  const hostile = "url(javascript:alert(1))";
  const { rerender } = render(<LandingSection aria-label="safe" $backgroundVariant={hostile} />);
  expect(screen.getByLabelText("safe")).toHaveAttribute("data-background-variant", "default");
  expect(screen.getByLabelText("safe").getAttribute("style")).not.toContain(hostile);
  rerender(<LandingSection aria-label="safe" />);
  expect(screen.getByLabelText("safe")).toHaveAttribute("data-background-variant", "default");
});

it("allows About origin to override the inherited module variant", () => {
  render(
    <LandingBackgroundVariantProvider variant="default">
      <LandingVariantSurface aria-label="origin" backgroundVariant="brand_soft" />
    </LandingBackgroundVariantProvider>,
  );
  expect(screen.getByLabelText("origin")).toHaveAttribute("data-background-variant", "brand_soft");
});
