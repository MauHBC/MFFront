/* eslint-env jest */
import React from "react";
import "@testing-library/jest-dom";
import { fireEvent, render, screen } from "@testing-library/react";
import { Approach, Audience, Conversion, Professionals, Testimonials, WhatIs } from "./ModularSections";

it("renders structured What is content and replaces an invalid image", () => {
  render(<WhatIs content={{ title: "O que é", text: "Parágrafo um.\nParágrafo dois.", image: { url: "/falha.jpg", alt_text: "Explicação" } }} />);
  const image = screen.getByRole("img", { name: "Explicação" });
  fireEvent.error(image);
  expect(screen.queryByRole("img", { name: "Explicação" })).not.toBeInTheDocument();
  expect(screen.getByText("Parágrafo dois.")).toBeInTheDocument();
});

it("renders audience and approach lists with partial and long content", () => {
  const longText = "Conteúdo demonstrativo extenso ".repeat(20);
  const { rerender } = render(<Audience content={{ title: "Para quem é", items: [
    { title: "Público A", description: longText, visible: true },
    { title: "Oculto", visible: false },
  ] }} />);
  expect(screen.getByText("Público A")).toBeInTheDocument();
  expect(screen.queryByText("Oculto")).not.toBeInTheDocument();
  rerender(<Approach content={{ title: "Abordagem", steps: [{ title: "Etapa um", visible: true }] }} />);
  expect(screen.getByText("Etapa um")).toBeInTheDocument();
});

it("renders one conversion CTA and no competing action", () => {
  render(<Conversion content={{ title: "Próximo passo", text: "Faixa compacta", tone: "primary", action: { label: "Conversar", url: "#contact" } }} />);
  expect(screen.getAllByRole("link")).toHaveLength(1);
  expect(screen.getByRole("link", { name: "Conversar" })).toHaveAttribute("href", "#contact");
});

it("filters unauthorized professionals and handles zero one and many authorized items", () => {
  const make = (count) => Array.from({ length: count }, (_, index) => ({ name: `Perfil demonstrativo ${index + 1}`, visible: true, editorial_authorized: true }));
  [0, 1, 3].forEach((count) => {
    const { container, unmount } = render(<Professionals content={{ title: "Profissionais", items: [
      ...make(count), { name: "Não autorizado", visible: true, editorial_authorized: false },
    ] }} />);
    expect(screen.queryByText("Não autorizado")).not.toBeInTheDocument();
    if (count === 0) expect(container).toBeEmptyDOMElement();
    else expect(screen.getAllByRole("article")).toHaveLength(count);
    unmount();
  });
});

it("filters unauthorized testimonials and renders zero one and many authorized items", () => {
  [0, 1, 3].forEach((count) => {
    const items = Array.from({ length: count }, (_, index) => ({ quote: `Relato ${index + 1}`, author: `Pessoa demonstrativa ${index + 1}`, visible: true, editorial_authorized: true }));
    const { container, unmount } = render(<Testimonials content={{ title: "Depoimentos", items: [
      ...items, { quote: "Não autorizado", visible: true, editorial_authorized: false },
    ] }} />);
    expect(screen.queryByText("Não autorizado")).not.toBeInTheDocument();
    if (count === 0) expect(container).toBeEmptyDOMElement();
    else expect(screen.getAllByRole("article")).toHaveLength(count);
    unmount();
  });
});
