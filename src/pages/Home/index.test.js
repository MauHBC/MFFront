/* eslint-env jest */
import React from "react";
import "@testing-library/jest-dom";
import { render } from "@testing-library/react";
import HomePage from "./index";
import { usePublicClinicContext } from "../../contexts/PublicClinicContext";

jest.mock("../../contexts/PublicClinicContext", () => ({ usePublicClinicContext: jest.fn() }));
jest.mock("../../components/Nav/TopNavbar", () => () => <div>Navigation</div>);
jest.mock("../../components/Sections/Header", () => () => <div>Hero</div>);
jest.mock("../../components/Sections/Gallery", () => () => <div>Gallery</div>);
jest.mock("../../components/Sections/Services", () => () => <div>Landing Services</div>);
jest.mock("../../components/Sections/Differentials", () => () => <div>Differentials</div>);
jest.mock("../../components/Sections/About", () => () => <div>About</div>);
jest.mock("../../components/Sections/Contact", () => () => <div>Contact</div>);
jest.mock("../../components/Sections/Footer", () => () => <div>Footer</div>);
jest.mock("../../components/Sections/ModularSections", () => ({
  WhatIs: () => <div>What Is</div>,
  Audience: () => <div>Audience</div>,
  Conversion: () => <div>Conversion</div>,
  Approach: () => <div>Approach</div>,
  Professionals: () => <div>Professionals</div>,
  Testimonials: () => <div>Testimonials</div>,
}));

it("renders all thirteen modules in the fixed order", () => {
  const item = { title: "Item", visible: true };
  usePublicClinicContext.mockReturnValue({ loaded: true, loading: false, publicClinic: {
    public_profile: { landing_sections: { schema_version: 1, sections: {
      hero: { content: {} },
      gallery: { enabled: true, content: { items: [{ url: "/gallery.jpg", visible: true }] } },
      what_is: { enabled: true, content: { title: "O que é" } },
      landing_services: { enabled: true, content: { items: [item] } },
      differentials: { enabled: true, content: { items: [item] } },
      audience: { enabled: true, content: { items: [item] } },
      conversion: { enabled: true, content: { title: "Conversão" } },
      about: { enabled: true, content: { title: "Sobre" } },
      approach: { enabled: true, content: { steps: [item] } },
      professionals: { enabled: true, content: { items: [{ ...item, editorial_authorized: true }] } },
      testimonials: { enabled: true, content: { items: [{ quote: "Relato", visible: true, editorial_authorized: true }] } },
      contact: { enabled: true, content: { units: [{ name: "Unidade" }] } },
      footer: { content: {} },
    } } },
  } });
  const { container } = render(<HomePage />);
  const expected = ["Navigation", "Hero", "Gallery", "What Is", "Landing Services", "Differentials", "Audience", "Conversion", "About", "Approach", "Professionals", "Testimonials", "Contact", "Footer"];
  const text = container.textContent;
  expected.slice(0, -1).forEach((label, index) => {
    expect(text.indexOf(label)).toBeLessThan(text.indexOf(expected[index + 1]));
  });
});
