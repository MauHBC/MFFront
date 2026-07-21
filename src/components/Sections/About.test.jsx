/* eslint-env jest */
import React from "react";
import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import About from "./About";
import { usePublicClinicContext } from "../../contexts/PublicClinicContext";

jest.mock("../../contexts/PublicClinicContext", () => ({
  usePublicClinicContext: jest.fn(),
}));

const renderAbout = (publicProfile, props = {}) => {
  usePublicClinicContext.mockReturnValue({
    displayName: "Clínica Modelo Local",
    publicClinic: {
      public_profile: publicProfile,
    },
  });

  return render(
    <About
      showAbout={props.showAbout}
      showDifferentials={props.showDifferentials}
    />,
  );
};

describe("About", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("does not render without institutional content or differentials", () => {
    const { container } = renderAbout({});

    expect(container.querySelector("#about")).not.toBeInTheDocument();
  });

  it("renders institutional content without reserving image space", () => {
    renderAbout({
      about_label: "Sobre",
      about_title: "Modelo institucional",
      about_text: "Texto neutro de apresentação.",
    });

    expect(screen.getByText("Modelo institucional")).toBeInTheDocument();
    expect(screen.getByText("Texto neutro de apresentação.")).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("renders one institutional image with alt text", () => {
    renderAbout({
      about_title: "Modelo institucional",
      about_image_urls: ["/one.jpg"],
      about_image_alt_texts: ["Imagem principal neutra"],
    });

    expect(screen.getByAltText("Imagem principal neutra")).toHaveAttribute("src", "/one.jpg");
  });

  it("renders two institutional images with alt text", () => {
    renderAbout({
      about_title: "Modelo institucional",
      about_image_urls: ["/one.jpg", "/two.jpg"],
      about_image_alt_texts: ["Imagem principal neutra", "Imagem complementar neutra"],
    });

    expect(screen.getByAltText("Imagem principal neutra")).toHaveAttribute("src", "/one.jpg");
    expect(screen.getByAltText("Imagem complementar neutra")).toHaveAttribute("src", "/two.jpg");
  });

  it("renders only public differentials when institutional content is absent", () => {
    renderAbout({
      differentials: [
        { title: "Primeiro diferencial", description: "Descrição curta.", order: 1 },
      ],
    });

    expect(screen.getByText("Diferenciais públicos")).toBeInTheDocument();
    expect(screen.getByText("Primeiro diferencial")).toBeInTheDocument();
    expect(screen.getByText("Descrição curta.")).toBeInTheDocument();
  });

  it("keeps About and Differentials independently configurable", () => {
    const profile = {
      about_title: "Institucional",
      differentials: [{ title: "Diferencial", order: 1 }],
    };
    const { rerender } = renderAbout(profile, { showAbout: false });
    expect(screen.queryByText("Institucional")).not.toBeInTheDocument();
    expect(screen.getByText("Diferencial")).toBeInTheDocument();
    rerender(<About showDifferentials={false} />);
    expect(screen.getByText("Institucional")).toBeInTheDocument();
    expect(screen.queryByText("Diferencial")).not.toBeInTheDocument();
  });
});
