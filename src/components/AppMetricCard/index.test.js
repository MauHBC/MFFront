import React from "react";
import "@testing-library/jest-dom";
import { render, screen, within } from "@testing-library/react";

import { AppMetricCard } from ".";

it("renderiza a variante compacta interativa como botão acessível", () => {
  const onClick = jest.fn();
  render(
    <AppMetricCard
      compact
      attention={false}
      label="Ativos"
      value={22}
      ariaLabel="Filtrar Planos ativos: 22"
      onClick={onClick}
    />,
  );

  const card = screen.getByRole("button", { name: "Filtrar Planos ativos: 22" });
  expect(card).toHaveAttribute("type", "button");
  expect(within(card).getByText("Ativos")).toBeInTheDocument();
  expect(within(card).getByText("22")).toBeInTheDocument();
});
