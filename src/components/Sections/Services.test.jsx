/* eslint-env jest */
import React from "react";
import "@testing-library/jest-dom";
import { fireEvent, render, screen } from "@testing-library/react";
import Services from "./Services";
import { usePublicClinicContext } from "../../contexts/PublicClinicContext";

jest.mock("../../contexts/PublicClinicContext", () => ({
  usePublicClinicContext: jest.fn(),
}));

const renderServices = (services, metadata = {}) => {
  usePublicClinicContext.mockReturnValue({
    displayName: "Clínica Modelo Local",
    publicClinic: {
      public_profile: {
        services,
        ...metadata,
      },
    },
  });

  return render(<Services />);
};

describe("Services", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("does not render the public services section without configured services", () => {
    const { container } = renderServices([], {
      services_label: "Especialidades",
      services_title: "Cuidados",
    });

    expect(container.querySelector("#services")).not.toBeInTheDocument();
  });

  it("renders configured service label and title", () => {
    renderServices([{ title: "Fisioterapia" }], {
      services_label: "Especialidades",
      services_title: "Cuidado feito para você",
    });

    expect(screen.getByText("Especialidades")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Cuidado feito para você" }))
      .toBeInTheDocument();
  });

  it("renders only the neutral title for old profiles without leaving a label", () => {
    renderServices([{ title: "Fisioterapia" }]);

    expect(screen.queryByText("Serviços públicos")).not.toBeInTheDocument();
    const heading = screen.getByRole("heading", { name: "Serviços" });
    expect(heading).toBeInTheDocument();
    expect(heading.parentElement).toHaveTextContent(/^Serviços$/);
  });

  it("renders service images with their configured alternative text", () => {
    renderServices([
      {
        title: "Acolhimento inicial",
        description: "Texto demonstrativo",
        image_url: "/assets/neutral/service.png",
        image_alt: "Atendimento demonstrativo em ambiente neutro",
      },
    ]);

    expect(screen.getByAltText("Atendimento demonstrativo em ambiente neutro"))
      .toHaveAttribute("src", "/assets/neutral/service.png");
    expect(screen.queryByTestId("service-visual-fallback")).not.toBeInTheDocument();
  });

  it("uses an inaccessible decorative visual fallback when a service has no image", () => {
    renderServices([
      {
        title: "Movimento orientado",
        description: "Texto demonstrativo",
      },
    ]);

    const fallback = screen.getByTestId("service-visual-fallback");

    expect(fallback).toHaveAttribute("aria-hidden", "true");
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.getByText("Movimento orientado")).toBeInTheDocument();
  });

  it("replaces a service image that fails to load with the decorative fallback", () => {
    renderServices([
      {
        title: "Terapia manual",
        image_url: "/assets/invalid/service.png",
        image_alt: "Profissional realizando terapia manual",
      },
    ]);

    const image = screen.getByAltText("Profissional realizando terapia manual");
    fireEvent.error(image);

    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.getByTestId("service-visual-fallback"))
      .toHaveAttribute("aria-hidden", "true");
    expect(screen.getByText("Terapia manual")).toBeInTheDocument();
  });
});
