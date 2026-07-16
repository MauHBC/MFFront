/* eslint-env jest */
import React from "react";
import "@testing-library/jest-dom";
import { render, screen, within } from "@testing-library/react";
import Contact from "./Contact";
import { usePublicClinicContext } from "../../contexts/PublicClinicContext";

jest.mock("../../contexts/PublicClinicContext", () => ({
  usePublicClinicContext: jest.fn(),
}));

const renderContact = (profile) => {
  usePublicClinicContext.mockReturnValue({
    displayName: "Clínica Modelo Local",
    publicClinic: {
      public_profile: profile,
    },
  });

  return render(<Contact />);
};

describe("Contact", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("does not render without public contact content", () => {
    const { container } = renderContact({});

    expect(container.querySelector("#contact")).not.toBeInTheDocument();
  });

  it("renders only the configured CTA when no methods are available", () => {
    renderContact({
      primary_action_label: "Enviar mensagem",
      primary_action_url: "/contato",
    });

    expect(screen.getByRole("link", { name: "Enviar mensagem" }))
      .toHaveAttribute("href", "/contato");
    expect(screen.queryByLabelText("Canais de contato")).not.toBeInTheDocument();
  });

  it("renders only the CTA in the section when CTA and WhatsApp share the same destination", () => {
    renderContact({
      contact_title: "Fale com a clínica",
      primary_action_label: "Enviar mensagem",
      primary_action_url: "https://wa.me/5527999990000",
      primary_action_type: "whatsapp",
      contact_whatsapp: "(27) 99999-0000",
    });

    expect(screen.getByRole("link", { name: "Enviar mensagem" }))
      .toHaveAttribute("href", "https://wa.me/5527999990000");
    expect(screen.queryByText("WhatsApp")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Canais de contato")).not.toBeInTheDocument();
  });

  it("keeps CTA and WhatsApp method when destinations are different", () => {
    renderContact({
      contact_title: "Fale com a clínica",
      primary_action_label: "Agendar avaliação",
      primary_action_url: "/agendar",
      primary_action_type: "link",
      contact_whatsapp: "(27) 99999-0000",
    });

    expect(screen.getByRole("link", { name: "Agendar avaliação" }))
      .toHaveAttribute("href", "/agendar");
    expect(screen.getByText("WhatsApp")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /enviar mensagem/i }))
      .toHaveAttribute("href", "https://wa.me/5527999990000");
  });

  it("deduplicates WhatsApp despite phone formatting differences", () => {
    renderContact({
      primary_action_label: "Enviar mensagem",
      primary_action_url: "https://api.whatsapp.com/send?phone=5527999990000",
      primary_action_type: "whatsapp",
      contact_whatsapp: "27 99999-0000",
    });

    expect(screen.getByRole("link", { name: "Enviar mensagem" }))
      .toHaveAttribute("href", "https://api.whatsapp.com/send?phone=5527999990000");
    expect(screen.queryByText("WhatsApp")).not.toBeInTheDocument();
  });

  it("renders WhatsApp as the CTA when it is the only configured contact action", () => {
    renderContact({
      contact_whatsapp: "(27) 99999-0000",
    });

    expect(screen.getByRole("link", { name: "Falar pelo WhatsApp" }))
      .toHaveAttribute("href", "https://wa.me/5527999990000");
    expect(screen.queryByText("WhatsApp")).not.toBeInTheDocument();
  });

  it("renders one configured contact method", () => {
    renderContact({
      contact_email: "contato@clinica.test",
    });

    expect(screen.getByRole("link", { name: /contato@clinica.test/i }))
      .toHaveAttribute("href", "mailto:contato@clinica.test");
    expect(screen.getByText("E-mail")).toBeInTheDocument();
  });

  it("renders several methods when CTA is absent", () => {
    renderContact({
      contact_phone: "(27) 3333-0000",
      contact_email: "contato@clinica.test",
      contact_address: "Rua Fictícia, 100",
    });

    expect(screen.queryByRole("link", { name: "Entrar em contato" })).not.toBeInTheDocument();
    expect(screen.getByText("Telefone")).toBeInTheDocument();
    expect(screen.getByText("E-mail")).toBeInTheDocument();
    expect(screen.getByText("Endereço")).toBeInTheDocument();
  });

  it("renders multiple contact methods and public units", () => {
    renderContact({
      contact_title: "Fale com a clínica",
      contact_whatsapp: "(27) 99999-0000",
      contact_phone: "(27) 3333-0000",
      contact_address: "Rua Fictícia, 100",
      public_units: [
        {
          name: "Unidade Norte",
          address: "Rua Norte, 100",
          hours: "Segunda a sexta",
          map_url: "https://example.com/mapa",
        },
        {
          name: "Unidade Sul",
          address: "Rua Sul, 200",
          phone: "(27) 3333-1111",
        },
      ],
    });

    expect(screen.getByRole("heading", { name: "Fale com a clínica" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Falar pelo WhatsApp" }))
      .toHaveAttribute("href", "https://wa.me/5527999990000");
    expect(screen.queryByText("WhatsApp")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /\(27\) 3333-0000/i }))
      .toHaveAttribute("href", "tel:2733330000");
    expect(screen.getByText("Rua Fictícia, 100")).toBeInTheDocument();

    const units = screen.getByLabelText("Unidades públicas");
    expect(within(units).getByText("Unidade Norte")).toBeInTheDocument();
    expect(within(units).getByText("Unidade Sul")).toBeInTheDocument();
    expect(within(units).getByRole("link", { name: "Ver mapa" }))
      .toHaveAttribute("href", "https://example.com/mapa");
  });

  it("keeps the mobile reading order as intro, CTA, methods and units", () => {
    const { container } = renderContact({
      contact_title: "Fale com a clínica",
      contact_text: "Texto introdutório",
      primary_action_label: "Agendar avaliação",
      primary_action_url: "/agendar",
      contact_email: "contato@clinica.test",
      public_units: [{ name: "Unidade Norte", address: "Rua Norte, 100" }],
    });

    const text = container.textContent;
    expect(text.indexOf("Fale com a clínica")).toBeLessThan(text.indexOf("Texto introdutório"));
    expect(text.indexOf("Texto introdutório")).toBeLessThan(text.indexOf("Agendar avaliação"));
    expect(text.indexOf("Agendar avaliação")).toBeLessThan(text.indexOf("E-mail"));
    expect(text.indexOf("E-mail")).toBeLessThan(text.indexOf("Unidade Norte"));
  });
});
