/* eslint-env jest */
import React from "react";
import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import PublicLandingHeader from "./PublicLandingHeader";

const baseConfig = {
  action: {
    href: "#contact",
    isExternal: false,
    label: "Entrar em contato",
  },
  displayName: "Clínica Modelo",
  hasAbout: false,
  hasContact: false,
  hasServices: false,
  logoSrc: null,
};

const renderHeader = (config = {}) => render(
  <MemoryRouter>
    <PublicLandingHeader config={{ ...baseConfig, ...config }} />
  </MemoryRouter>,
);

describe("PublicLandingHeader", () => {
  it("renders the normalized configured logo", () => {
    renderHeader({ logoSrc: "/assets/clinics/modelo/header.png" });

    expect(screen.getByRole("img", { name: "Clínica Modelo" }))
      .toHaveAttribute("src", "/assets/clinics/modelo/header.png");
  });

  it("keeps the neutral visual fallback without a logo", () => {
    renderHeader();

    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.getByText("CL")).toHaveAttribute("aria-hidden", "true");
  });

  it("links the integrated structure section to its preserved contact id", () => {
    renderHeader({ hasContact: true });

    expect(screen.getByRole("link", { name: "Estrutura" }))
      .toHaveAttribute("href", "#contact");
  });
});
