/* eslint-env jest */
import React from "react";
import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import Header from "./Header";

jest.mock("../../contexts/PublicClinicContext", () => ({
  usePublicClinicContext: () => ({
    displayName: "Clínica",
    publicClinic: {},
  }),
}));

jest.mock("../../utils/publicLanding", () => ({
  normalizePublicLandingConfig: () => ({
    action: {
      href: "#contact",
      isExternal: false,
      label: "Agendar",
      type: "schedule",
    },
    bannerImage: null,
    eyebrow: "Fallback antigo",
    heroPresentation: {
      imagePosition: "center",
      overlayColorSource: "neutral-dark",
      overlayStrength: "medium",
      textTone: "light",
    },
    secondaryAction: null,
    subtitle: "Subtítulo preservado",
    title: "Título legado",
    titleLine2: "",
  }),
}));

it("usa separadamente os três textos do documento editorial", () => {
  render(<Header content={{
    eyebrow: "Texto superior configurado",
    title: "Primeira parte",
    title_line_2: "Segunda parte",
  }} />);

  expect(screen.getByText("Texto superior configurado")).toBeInTheDocument();
  expect(screen.queryByText("Fallback antigo")).not.toBeInTheDocument();
  const heading = screen.getByRole("heading", { level: 1 });
  expect(heading.querySelectorAll("span")).toHaveLength(2);
  expect(heading.children[0]).toHaveTextContent("Primeira parte");
  expect(heading.children[1]).toHaveTextContent("Segunda parte");
  expect(window.getComputedStyle(heading.children[0]).display).toBe("block");
  expect(window.getComputedStyle(heading.children[1]).display).toBe("block");
});

it("respeita Texto superior vazio e omite a continuação ausente", () => {
  render(<Header content={{ eyebrow: "", title: "Título único", title_line_2: "" }} />);

  expect(screen.queryByText("Fallback antigo")).not.toBeInTheDocument();
  const heading = screen.getByRole("heading", { level: 1 });
  expect(heading.querySelectorAll("span")).toHaveLength(1);
  expect(heading).toHaveTextContent("Título único");
  expect(screen.getByText("Subtítulo preservado")).toBeInTheDocument();
});

it("renderiza duas partes iguais sem eliminar nenhuma delas", () => {
  render(<Header content={{
    eyebrow: "Superior",
    title: "Mesmo texto",
    title_line_2: "Mesmo texto",
  }} />);

  const heading = screen.getByRole("heading", { level: 1 });
  expect(heading.querySelectorAll("span")).toHaveLength(2);
  expect(screen.getAllByText("Mesmo texto")).toHaveLength(2);
});
