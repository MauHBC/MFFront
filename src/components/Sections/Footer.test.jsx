/* eslint-env jest */
import React from "react";
import "@testing-library/jest-dom";
import { render, screen, within } from "@testing-library/react";
import Footer from "./Footer";
import { usePublicClinicContext } from "../../contexts/PublicClinicContext";

jest.mock("../../contexts/PublicClinicContext", () => ({
  usePublicClinicContext: jest.fn(),
}));

const renderFooter = (profile) => {
  usePublicClinicContext.mockReturnValue({
    displayName: "Clínica Modelo Local",
    publicClinic: {
      public_profile: profile,
    },
  });

  return render(<Footer />);
};

describe("Footer", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("renders only sections that exist in the public landing", () => {
    renderFooter({
      services: [{ title: "Serviço público" }],
      contact_title: "Contato",
    });

    const navigation = screen.getByRole("heading", { name: "Navegação" }).parentElement;
    const links = within(navigation).getAllByRole("link").map((link) => link.textContent);

    expect(links).toEqual(["Início", "Serviços", "Contato"]);
    expect(screen.queryByRole("link", { name: "Sobre" })).not.toBeInTheDocument();
  });

  it("does not render empty contact or legal columns", () => {
    renderFooter({});

    expect(screen.queryByRole("heading", { name: "Contato" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Links" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Entrar" })).toHaveAttribute("href", "/login");
  });

  it("renders configured contact, social and legal links", () => {
    renderFooter({
      contact_email: "contato@clinica.test",
      contact_address: "Rua Fictícia, 100",
      contact_social_links: [
        { label: "Instagram", url: "https://example.com/social" },
      ],
      legal_links: [
        { label: "Privacidade", url: "/privacidade" },
      ],
    });

    expect(screen.getByRole("link", { name: "E-mail" }))
      .toHaveAttribute("href", "mailto:contato@clinica.test");
    expect(screen.getByText("Rua Fictícia, 100")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Instagram" }))
      .toHaveAttribute("href", "https://example.com/social");
    expect(screen.getByRole("link", { name: "Privacidade" }))
      .toHaveAttribute("href", "/privacidade");
  });
});
