/* eslint-env jest */
import React from "react";
import "@testing-library/jest-dom";
import { fireEvent, render, screen } from "@testing-library/react";
import About from "./About";
import { usePublicClinicContext } from "../../contexts/PublicClinicContext";

jest.mock("../../contexts/PublicClinicContext", () => ({ usePublicClinicContext: jest.fn() }));

beforeEach(() => {
  usePublicClinicContext.mockReturnValue({ displayName: "Clínica Modelo", publicClinic: { public_profile: {} } });
});

it("renders institutional content and the structured origin without differentials", () => {
  render(<About content={{
    eyebrow: "Sobre",
    title: "Institucional",
    content: "Primeiro parágrafo.\nSegundo parágrafo.",
    images: [],
    origin: { enabled: true, content: { title: "Como surgiu", text: "Origem demonstrativa." } },
  }} />);
  expect(screen.getByRole("heading", { name: "Institucional" })).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "Como surgiu" })).toBeInTheDocument();
  expect(screen.queryByText("Diferenciais públicos")).not.toBeInTheDocument();
});

it("does not render disabled empty origin and handles invalid images", () => {
  render(<About content={{
    title: "Sobre",
    content: null,
    images: [{ url: "/invalid.jpg", alt_text: "Ambiente" }],
    origin: { enabled: false, content: { title: "Oculto" } },
  }} />);
  const image = screen.getByRole("img", { name: "Ambiente" });
  fireEvent.error(image);
  expect(screen.queryByRole("img", { name: "Ambiente" })).not.toBeInTheDocument();
  expect(screen.queryByText("Oculto")).not.toBeInTheDocument();
});
