/* eslint-env jest */
import React from "react";
import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import Gallery from "./Gallery";
import { usePublicClinicContext } from "../../contexts/PublicClinicContext";

jest.mock("../../contexts/PublicClinicContext", () => ({ usePublicClinicContext: jest.fn() }));
beforeEach(() => usePublicClinicContext.mockReturnValue({ displayName: "Clínica Modelo" }));

it("renders zero one and multiple visible images independently from contact", () => {
  [0, 1, 3].forEach((count) => {
    const { container, unmount } = render(<Gallery content={{
      title: "Estrutura",
      items: Array.from({ length: count }, (_, index) => ({
        url: `/foto-${index}.jpg`, alt_text: `Foto ${index + 1}`, visible: true,
      })),
    }} />);
    if (count === 0) expect(container).toBeEmptyDOMElement();
    else expect(screen.getByLabelText("Galeria da estrutura")).toBeInTheDocument();
    expect(screen.queryByText("Canais de contato")).not.toBeInTheDocument();
    unmount();
  });
});

it("does not expose hidden photographs", () => {
  render(<Gallery content={{ items: [
    { url: "/visivel.jpg", alt_text: "Visível", visible: true },
    { url: "/oculta.jpg", alt_text: "Oculta", visible: false },
  ] }} />);
  expect(screen.getByRole("img", { name: "Visível" })).toBeInTheDocument();
  expect(screen.queryByRole("img", { name: "Oculta" })).not.toBeInTheDocument();
});

it("combines a vertical gallery with What is content only once", () => {
  render(<Gallery content={{ layout: "vertical", items: [
    { url: "/vertical.jpg", alt_text: "Foto vertical", visible: true },
  ] }} whatIsContent={{ title: "O que é a clínica", text: "Conteúdo integrado." }} />);
  expect(screen.getByRole("img", { name: "Foto vertical" })).toBeInTheDocument();
  expect(screen.getAllByText("O que é a clínica")).toHaveLength(1);
  expect(screen.getByText("Conteúdo integrado.")).toBeInTheDocument();
});
