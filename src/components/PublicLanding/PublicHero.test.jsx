/* eslint-env jest */
import React from "react";
import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import PublicHero from "./PublicHero";

const baseConfig = {
  action: {
    href: "/agendar",
    isExternal: false,
    label: "Agendar",
    type: "schedule",
  },
  bannerImage: {
    src: "/banner.jpg",
    alt: "Sala principal",
  },
  eyebrow: "Cuidado",
  heroPresentation: {
    imagePosition: "right",
    overlayColorSource: "primary",
    overlayStrength: "strong",
    textTone: "light",
  },
  secondaryAction: null,
  titleLine2: "",
  subtitle: "Texto de apoio",
  title: "Título principal",
};

describe("PublicHero", () => {
  it("renders a static banner with configured presentation and no quote", () => {
    const { container } = render(
      <PublicHero
        config={{
          ...baseConfig,
          quote: "Não deve aparecer",
          quoteAuthor: "Autor legado",
        }}
      />,
    );

    const banner = screen.getByRole("img", { name: "Sala principal" });
    expect(banner).toHaveAttribute("src", "/banner.jpg");
    expect(banner).toHaveStyle("object-position: right center");
    expect(screen.getByRole("heading", { name: "Título principal" })).toBeInTheDocument();
    expect(screen.queryByText("Não deve aparecer")).not.toBeInTheDocument();
    expect(screen.queryByText("Autor legado")).not.toBeInTheDocument();
    expect(container.querySelectorAll("[role='region']")).toHaveLength(0);
  });

  it("renders without an image and keeps the primary CTA", () => {
    render(<PublicHero config={{ ...baseConfig, bannerImage: null }} />);

    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Agendar/i })).toHaveAttribute("href", "/agendar");
  });

  it("only renders an explicitly configured secondary CTA", () => {
    const { rerender } = render(<PublicHero config={baseConfig} />);
    expect(screen.queryByRole("link", { name: /Conhecer/i })).not.toBeInTheDocument();

    rerender(
      <PublicHero
        config={{
          ...baseConfig,
          secondaryAction: {
            href: "/conhecer",
            isExternal: false,
            label: "Conhecer",
            type: "link",
          },
        }}
      />,
    );
    expect(screen.getByRole("link", { name: /Conhecer/i }))
      .toHaveAttribute("href", "/conhecer");
  });

  it("renders an optional editorial continuation inside the same heading", () => {
    render(<PublicHero config={{ ...baseConfig, titleLine2: "Segunda linha" }} />);
    const heading = screen.getByRole("heading", { level: 1 });
    expect(heading).toHaveTextContent("Título principalSegunda linha");
    expect(heading.querySelectorAll("span")).toHaveLength(2);
  });});
