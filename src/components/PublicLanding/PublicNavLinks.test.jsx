/* eslint-env jest */
import React from "react";
import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import PublicNavLinks from "./PublicNavLinks";

describe("PublicNavLinks", () => {
  it("shows About only when the public about section exists", () => {
    const { rerender } = render(<PublicNavLinks showAbout={false} showServices />);

    expect(screen.queryByRole("link", { name: "Sobre" })).not.toBeInTheDocument();

    rerender(<PublicNavLinks showAbout showServices />);

    expect(screen.getByRole("link", { name: "Sobre" })).toHaveAttribute("href", "#about");
  });

  it("shows Structure only when Gallery exists and Contact independently", () => {
    const { rerender } = render(<PublicNavLinks showContact={false} showGallery={false} showServices />);

    expect(screen.queryByRole("link", { name: "Estrutura" })).not.toBeInTheDocument();

    rerender(<PublicNavLinks showContact showGallery showServices />);

    expect(screen.getByRole("link", { name: "Estrutura" })).toHaveAttribute("href", "#gallery");
    expect(screen.getByRole("link", { name: "Contato" })).toHaveAttribute("href", "#contact");
  });

  it("keeps the recommended public navigation order", () => {
    render(<PublicNavLinks showAbout showContact showGallery showServices />);

    expect(screen.getAllByRole("link").map((link) => link.textContent)).toEqual([
      "Início",
      "Estrutura",
      "Serviços",
      "Sobre",
      "Contato",
    ]);
  });
});
