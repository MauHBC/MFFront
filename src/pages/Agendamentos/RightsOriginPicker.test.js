import React from "react";
import "@testing-library/jest-dom";
import { fireEvent, render, screen } from "@testing-library/react";
import RightsOriginPicker from "./RightsOriginPicker";

const options = [{ id: 3, quantity: 4, free_rights: 3, service: { name: "Fisioterapia" } },
  { id: 4, quantity: 2, free_rights: 2, service: { name: "Pilates" } }];
const props = { rights: { status: "ready", options, refresh: jest.fn() }, origin: "",
  onSelect: jest.fn(), onShare: jest.fn(), canShare: true };
beforeEach(() => jest.clearAllMocks());
test("own, shared and new origins are explicit radios with no implicit new choice", () => {
  render(<RightsOriginPicker {...props}/>);
  expect(screen.getByLabelText(/Fisioterapia - 3 sessões disponíveis/)).not.toBeChecked();
  expect(screen.getByLabelText(/Pilates - 2 sessões disponíveis/)).not.toBeChecked();
  expect(screen.getByText("Como deseja continuar?")).toBeInTheDocument();
  expect(screen.getByText("Comprar sessões para agendar agora ou depois")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Cancelar unidades disponíveis" })).not.toBeInTheDocument();
  expect(screen.getByLabelText(/Usar sessão disponível.*Fisioterapia.*#3/)).toBeInTheDocument();
  expect(screen.getByLabelText("Fazer novo lançamento")).not.toBeChecked();
  const shared = screen.getByLabelText("Usar pacote de outro paciente");
  expect(shared.type).toBe("radio");
  fireEvent.click(shared);
  expect(props.onShare).toHaveBeenCalledTimes(1);
  expect(props.onSelect).not.toHaveBeenCalled();
  fireEvent.click(screen.getByLabelText(/Pilates/));
  expect(props.onSelect).toHaveBeenCalledWith(options[1]);
});
test("loading and errors expose no origin options; retry does not imply absence", () => {
  const { rerender } = render(<RightsOriginPicker {...props} rights={{ ...props.rights, status: "loading" }}/>);
  expect(screen.queryByRole("radio")).not.toBeInTheDocument();
  rerender(<RightsOriginPicker {...props} rights={{ ...props.rights, status: "error" }}/>);
  expect(screen.queryByText(/Nenhuma sessão disponível/)).not.toBeInTheDocument();
  expect(screen.queryByRole("radio")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
  expect(props.rights.refresh).toHaveBeenCalledTimes(1);
});
