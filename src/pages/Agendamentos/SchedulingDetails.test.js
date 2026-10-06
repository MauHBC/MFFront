import React from "react";
import "@testing-library/jest-dom";
import { render, screen, within } from "@testing-library/react";
import SchedulingDetails from "./SchedulingDetails";

test("details have one accessible contextual section containing timing and fields", () => {
  render(<SchedulingDetails separated title="Novas sessões"><div role="group" aria-label="Quando agendar"><button type="button">Agendar agora</button></div><label>Serviço<input/></label></SchedulingDetails>);
  const section = screen.getByRole("region", { name: "Novas sessões" });
  expect(within(section).getByRole("heading", { name: "Novas sessões", level: 3 })).toBeInTheDocument();
  expect(within(section).getByRole("group", { name: "Quando agendar" })).toBeInTheDocument();
  expect(within(section).getByLabelText("Serviço")).toBeInTheDocument();
  expect(section).toHaveStyle({ minWidth: "0", gridTemplateColumns: "repeat(2, minmax(0, 1fr))" });
});
test("legacy editing preserves its children without a new section or heading", () => {
  const { container } = render(<SchedulingDetails separated={false} title="Agendar sessão"><label>Serviço<input/></label></SchedulingDetails>);
  expect(container.firstElementChild.tagName).toBe("LABEL");
  expect(screen.queryByRole("region")).not.toBeInTheDocument();
  expect(screen.queryByRole("heading")).not.toBeInTheDocument();
});
