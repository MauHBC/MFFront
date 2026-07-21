/* eslint-env jest */
import React from "react";
import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import Contact from "./Contact";
import { usePublicClinicContext } from "../../contexts/PublicClinicContext";

jest.mock("../../contexts/PublicClinicContext", () => ({ usePublicClinicContext: jest.fn() }));

const renderContact = (profile) => {
  usePublicClinicContext.mockReturnValue({
    displayName: "Clínica Modelo",
    publicClinic: { public_profile: profile },
  });
  return render(<Contact />);
};

it("renders contact and zero one or multiple units without gallery", () => {
  [0, 1, 3].forEach((count) => {
    const { unmount } = renderContact({
      contact_title: "Contato",
      contact_email: "contato@clinica.test",
      public_units: Array.from({ length: count }, (_, index) => ({ name: `Unidade ${index + 1}` })),
      hero_image_urls: ["/estrutura.jpg"],
    });
    expect(screen.getByRole("heading", { name: "Contato" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Galeria da estrutura")).not.toBeInTheDocument();
    expect(screen.queryAllByRole("article")).toHaveLength(count);
    unmount();
  });
});

it("does not depend on photographs and omits an empty contact", () => {
  const { container } = renderContact({ hero_image_urls: ["/estrutura.jpg"] });
  expect(container).toBeEmptyDOMElement();
});
