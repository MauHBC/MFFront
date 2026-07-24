/* eslint-env jest */
import React from "react";
import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import Contact from "./Contact";
import { usePublicClinicContext } from "../../contexts/PublicClinicContext";

jest.mock("../../contexts/PublicClinicContext", () => ({ usePublicClinicContext: jest.fn() }));

const renderContact = (profile, content = {}) => {
  usePublicClinicContext.mockReturnValue({
    displayName: "Clínica Modelo",
    publicClinic: { public_profile: profile },
  });
  return render(<Contact content={content} />);
};

it("renders zero, one or multiple units and numbers only multiple units", () => {
  [0, 1, 3].forEach((count) => {
    const { unmount } = renderContact({
      contact_title: "Contato",
      contact_email: "contato@clinica.test",
      public_units: Array.from({ length: count }, (_, index) => ({ name: `Unidade ${index + 1}` })),
    });
    expect(screen.getByRole("heading", { name: "Contato" })).toBeInTheDocument();
    expect(screen.queryAllByRole("article")).toHaveLength(count);
    if (count <= 1) expect(screen.queryByText("01")).not.toBeInTheDocument();
    if (count > 1) expect(screen.getByText("01")).toBeInTheDocument();
    unmount();
  });
});

it("separates backgrounds and keeps a units-only anchor without empty contact area", () => {
  renderContact({ public_units: [{ name: "Unidade Centro" }] }, {
    contact_background_variant: "neutral",
    units_background_variant: "brand_solid",
  });
  expect(screen.queryByLabelText("Contato")).not.toBeInTheDocument();
  expect(screen.getByLabelText("Unidades")).toHaveAttribute("id", "contact");
  expect(screen.getByLabelText("Unidades")).toHaveAttribute("data-background-variant", "brand_solid");
});

it("does not repeat the general address when the visible unit has the same address", () => {
  renderContact({
    contact_title: "Contato",
    contact_address: "Rua Fictícia, 100",
    public_units: [{ name: "Matriz", address: "Rua Fictícia, 100", hours: "8h às 18h" }],
  }, { contact_background_variant: "neutral", units_background_variant: "brand_soft" });
  expect(screen.getAllByText("Rua Fictícia, 100")).toHaveLength(1);
  expect(screen.getByLabelText("Contato")).toHaveAttribute("data-background-variant", "neutral");
  expect(screen.getByLabelText("Unidades")).toHaveAttribute("data-background-variant", "brand_soft");
});

it("handles units without map or hours and omits a completely empty module", () => {
  const rendered = renderContact({ public_units: [{ name: "Sem opcionais" }] });
  expect(screen.queryByRole("link", { name: "Ver mapa" })).not.toBeInTheDocument();
  rendered.unmount();
  const { container } = renderContact({ hero_image_urls: ["/estrutura.jpg"] });
  expect(container).toBeEmptyDOMElement();
});

it("renders configured Instagram and WhatsApp only in Contact", () => {
  const { container } = renderContact({
    contact_title: "Contato",
    contact_whatsapp: "27999999999",
    contact_social_links: [
      { label: "Instagram", url: "https://instagram.com/clinica", visible: true },
    ],
    landing_sections_json: {
      sections: {
        contact: {
          content: {
            contact_channels: {
              instagram: { visible: true, url: "https://instagram.com/clinica" },
              whatsapp: { visible: true, url: "27999999999" },
            },
          },
        },
      },
    },
  });

  expect(screen.getByRole("link", { name: "Abrir Instagram" }))
    .toHaveAttribute("href", "https://instagram.com/clinica");
  expect(screen.getByRole("link", { name: "Conversar pelo WhatsApp" }))
    .toHaveAttribute("href", "https://wa.me/5527999999999");
  expect(screen.queryByRole("link", { name: "Instagram" })).not.toBeInTheDocument();
  expect(screen.getByRole("navigation", { name: "Instagram e WhatsApp" }))
    .toBeInTheDocument();
  expect(container.querySelectorAll("nav[aria-label='Instagram e WhatsApp'] svg[aria-hidden='true']"))
    .toHaveLength(2);
});

it("allows Instagram and WhatsApp to appear independently", () => {
  const instagramOnly = renderContact({
    contact_title: "Contato",
    landing_sections_json: {
      sections: {
        contact: {
          content: {
            contact_channels: {
              instagram: { visible: true, url: "https://instagram.com/clinica" },
              whatsapp: { visible: false, url: "27999999999" },
            },
          },
        },
      },
    },
  });
  expect(screen.getByRole("link", { name: "Abrir Instagram" })).toBeInTheDocument();
  expect(screen.queryByRole("link", { name: "Conversar pelo WhatsApp" })).not.toBeInTheDocument();
  instagramOnly.unmount();

  renderContact({
    contact_title: "Contato",
    landing_sections_json: {
      sections: {
        contact: {
          content: {
            contact_channels: {
              instagram: { visible: false, url: "https://instagram.com/clinica" },
              whatsapp: { visible: true, url: "27999999999" },
            },
          },
        },
      },
    },
  });
  expect(screen.queryByRole("link", { name: "Abrir Instagram" })).not.toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Conversar pelo WhatsApp" })).toBeInTheDocument();
});

it("does not reserve a social channel container when both channels are hidden", () => {
  renderContact({
    contact_title: "Contato",
    landing_sections_json: {
      sections: {
        contact: {
          content: {
            contact_channels: {
              instagram: { visible: false, url: "https://instagram.com/clinica" },
              whatsapp: { visible: false, url: "27999999999" },
            },
          },
        },
      },
    },
  });

  expect(screen.queryByRole("navigation", { name: "Instagram e WhatsApp" }))
    .not.toBeInTheDocument();
});
