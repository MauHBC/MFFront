/* eslint-env jest */
import React from "react";
import "@testing-library/jest-dom";
import {
  act,
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
  afterEach(() => {
    jest.useRealTimers();
    delete window.matchMedia;
  });

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

  it("does not reserve space without photos", () => {
    const { container } = render(
      <PublicHeroCarousel images={[]} displayName="Clínica Sem Foto" />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("pauses on pointer interaction and resumes after it ends", () => {
    jest.useFakeTimers();
    render(<PublicHeroCarousel images={multipleImages} displayName="Clínica" />);

    const carousel = screen.getByRole("region", { name: "Fotos de Clínica" });
    fireEvent.mouseEnter(carousel);
    act(() => jest.advanceTimersByTime(5200));
    expect(screen.getByLabelText("Mostrar foto 1")).toHaveAttribute("aria-current", "true");

    fireEvent.mouseLeave(carousel);
    act(() => jest.advanceTimersByTime(5200));
    expect(screen.getByLabelText("Mostrar foto 2")).toHaveAttribute("aria-current", "true");
  });

  it("pauses while focus is inside and resumes after focus leaves", () => {
    jest.useFakeTimers();
    render(<PublicHeroCarousel images={multipleImages} displayName="Clínica" />);

    const nextButton = screen.getByLabelText("Próxima foto");
    fireEvent.focus(nextButton);
    act(() => jest.advanceTimersByTime(5200));
    expect(screen.getByLabelText("Mostrar foto 1")).toHaveAttribute("aria-current", "true");

    fireEvent.blur(nextButton, { relatedTarget: document.body });
    act(() => jest.advanceTimersByTime(5200));
    expect(screen.getByLabelText("Mostrar foto 2")).toHaveAttribute("aria-current", "true");
  });

  it("does not auto-rotate when reduced motion is preferred", () => {
    jest.useFakeTimers();
    window.matchMedia = jest.fn().mockReturnValue({
      matches: true,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    });

    render(<PublicHeroCarousel images={multipleImages} displayName="Clínica" />);
    act(() => jest.advanceTimersByTime(10400));

    expect(screen.getByLabelText("Mostrar foto 1")).toHaveAttribute("aria-current", "true");
  });
});
