import React from "react";
import "@testing-library/jest-dom";
import { fireEvent, render, screen } from "@testing-library/react";
import AppActionMenu, { AppActionMenuItem, AgendaActionMenuItem } from ".";

function MenuFixture() {
  return (
    <div>
      <AppActionMenu label="Ações do registro">
        <AppActionMenuItem type="button">Editar</AppActionMenuItem>
        <AppActionMenuItem type="button">Duplicar</AppActionMenuItem>
        <AppActionMenuItem type="button">Arquivar</AppActionMenuItem>
      </AppActionMenu>
      <button type="button">Fora</button>
    </div>
  );
}

describe("AppActionMenu", () => {
  it("permite Ações sem indicador com itens neutros e mantém navegação", () => {
    render(<AppActionMenu label="Ações da cobrança" showIndicator={false} agendaAppearance>
      <AgendaActionMenuItem type="button">Ver sessões</AgendaActionMenuItem>
      <AgendaActionMenuItem type="button">Desfazer pagamento</AgendaActionMenuItem>
    </AppActionMenu>);
    const trigger = screen.getByRole("button", { name: "Ações da cobrança" });
    expect(trigger.textContent).toBe("Ações");
    fireEvent.click(trigger);
    expect(screen.getByRole("menuitem", { name: "Ver sessões" })).toHaveFocus();
    fireEvent.keyDown(screen.getByRole("menu"), { key: "ArrowDown" });
    expect(screen.getByRole("menuitem", { name: "Desfazer pagamento" })).toHaveFocus();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(trigger).toHaveFocus();
  });
  it("abre com foco inicial, navega por teclado e restaura foco com Escape", () => {
    render(<MenuFixture />);
    const trigger = screen.getByRole("button", { name: "Ações do registro" });
    fireEvent.click(trigger);
    expect(screen.getByRole("menu")).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Editar" })).toHaveFocus();

    fireEvent.keyDown(screen.getByRole("menu"), { key: "ArrowDown" });
    expect(screen.getByRole("menuitem", { name: "Duplicar" })).toHaveFocus();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it("fecha por clique externo", () => {
    render(<MenuFixture />);
    fireEvent.click(screen.getByRole("button", { name: "Ações do registro" }));
    fireEvent.mouseDown(screen.getByRole("button", { name: "Fora" }));
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("não abre quando o acionador está desabilitado", () => {
    render(
      <AppActionMenu label="Ações indisponíveis" disabled>
        <AppActionMenuItem type="button">Arquivar</AppActionMenuItem>
      </AppActionMenu>,
    );

    const trigger = screen.getByRole("button", { name: "Ações indisponíveis" });
    expect(trigger).toBeDisabled();
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(trigger);
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });
});
