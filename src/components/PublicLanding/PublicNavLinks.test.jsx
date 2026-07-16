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

  it("shows Contact only when the public contact section exists", () => {
    const { rerender } = render(<PublicNavLinks showContact={false} showServices />);

    expect(screen.queryByRole("link", { name: "Contato" })).not.toBeInTheDocument();

    rerender(<PublicNavLinks showContact showServices />);

    expect(screen.getByRole("link", { name: "Contato" })).toHaveAttribute("href", "#contact");
  });

  it("keeps the recommended public navigation order", () => {
    render(<PublicNavLinks showAbout showContact showServices />);

    expect(screen.getAllByRole("link").map((link) => link.textContent)).toEqual([
      "Início",
      "Serviços",
      "Sobre",
      "Contato",
    ]);
  });
});
