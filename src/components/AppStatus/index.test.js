import React from "react";
import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";

import { PackagePill } from ".";

describe("AppStatus", () => {
  it("oferece a variante compartilhada de Package em tom lilás", () => {
    render(<PackagePill>Pacote de Maurício Titular</PackagePill>);

    const pill = screen.getByText("Pacote de Maurício Titular");
    expect(pill).toBeInTheDocument();
    expect(window.getComputedStyle(pill).backgroundColor).toBe("rgb(241, 234, 251)");
    expect(window.getComputedStyle(pill).color).toBe("rgb(101, 72, 149)");
  });
});
