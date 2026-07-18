/* eslint-env jest */
import React from "react";
import "@testing-library/jest-dom";
import {
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import PublicHeroCarousel from "./PublicHeroCarousel";

const singleImage = [
  { src: "/one.jpg", alt: "Foto única" },
];

const multipleImages = [
  { src: "/one.jpg", alt: "Foto um" },
  { src: "/two.jpg", alt: "Foto dois" },
];

describe("PublicHeroCarousel", () => {
  it("renders one photo without carousel controls", () => {
    render(<PublicHeroCarousel images={singleImage} displayName="Clínica" />);

    expect(screen.getByAltText("Foto única")).toBeInTheDocument();
    expect(screen.queryByLabelText("Próxima foto")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Pausar troca automática")).not.toBeInTheDocument();
  });

  it("renders multiple photos with arrows, indicators and pause control", () => {
    render(<PublicHeroCarousel images={multipleImages} displayName="Clínica" />);

    expect(screen.getByLabelText("Próxima foto")).toBeInTheDocument();
    expect(screen.getByLabelText("Foto anterior")).toBeInTheDocument();
    expect(screen.getByLabelText("Mostrar foto 1")).toHaveAttribute("aria-current", "true");
    expect(screen.getByLabelText("Mostrar foto 2")).toHaveAttribute("aria-current", "false");
    expect(screen.getByLabelText("Pausar troca automática")).toBeInTheDocument();
  });

  it("toggles automatic rotation pause control", () => {
    render(<PublicHeroCarousel images={multipleImages} displayName="Clínica" />);

    fireEvent.click(screen.getByLabelText("Pausar troca automática"));

    expect(screen.getByLabelText("Retomar troca automática")).toBeInTheDocument();
  });

  it("allows keyboard navigation", () => {
    render(<PublicHeroCarousel images={multipleImages} displayName="Clínica" />);

    const carousel = screen.getByRole("region", { name: "Fotos de Clínica" });
    fireEvent.keyDown(carousel, { key: "ArrowRight" });

    expect(screen.getByLabelText("Mostrar foto 2")).toHaveAttribute("aria-current", "true");
  });

  it("allows touch swipe navigation", () => {
    render(<PublicHeroCarousel images={multipleImages} displayName="Clínica" />);

    const carousel = screen.getByRole("region", { name: "Fotos de Clínica" });
    fireEvent.touchStart(carousel, { touches: [{ clientX: 320 }] });
    fireEvent.touchEnd(carousel, { changedTouches: [{ clientX: 120 }] });

    expect(screen.getByLabelText("Mostrar foto 2")).toHaveAttribute("aria-current", "true");
  });

  it("renders a safe fallback without photos", () => {
    render(<PublicHeroCarousel images={[]} displayName="Clínica Sem Foto" />);

    expect(screen.getByLabelText("Resumo de Clínica Sem Foto")).toBeInTheDocument();
    expect(screen.getByText("Experiência integrada")).toBeInTheDocument();
  });
});
