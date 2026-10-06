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
  expect(screen.getByLabelText(/Fisioterapia.*4 sessões.*3 não agendadas/)).not.toBeChecked();
  expect(screen.getByLabelText(/Pilates.*2 sessões.*2 não agendadas/)).not.toBeChecked();
  expect(screen.getByText("Como deseja continuar?")).toBeInTheDocument();
  expect(screen.queryByText("Comprar sessões para agendar agora ou depois")).not.toBeInTheDocument();
  expect(screen.queryByText(/Use uma sessão disponível, utilize/)).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Cancelar unidades disponíveis" })).not.toBeInTheDocument();
  expect(screen.queryByText(/Usar sessão disponível/)).not.toBeInTheDocument();
  expect(screen.queryByText(/#3/)).not.toBeInTheDocument();
  expect(screen.getByLabelText("Registrar novas sessões")).not.toBeChecked();
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


test("same-service packages carry a discreet identity; totals and unscheduled balances remain separate", () => {
  const sameService = [
    { id: 3, quantity: 10, free_rights: 2, service: { id: 40, name: "Pilates" } },
    { id: 4, quantity: 1, free_rights: 1, service: { id: 40, name: "Pilates" } },
  ];
  render(<RightsOriginPicker {...props} rights={{ ...props.rights, options: sameService }}/>);
  const first = screen.getByLabelText(/Pilates.*10 sessões.*2 não agendadas.*#3/);
  const second = screen.getByLabelText(/Pilates.*1 sessão.*1 não agendada.*#4/);
  expect(first).not.toBeChecked();
  fireEvent.click(second);
  expect(props.onSelect).toHaveBeenCalledWith(sameService[1]);
});

test("missing contract total never becomes a guessed total or package type", () => {
  render(<RightsOriginPicker {...props} rights={{ ...props.rights, options: [
    { id: 5, free_rights: 2, service: { id: 40, name: "Pilates" } },
  ] }}/>);
  expect(screen.getByLabelText(/Pilates.*2 não agendadas/)).toBeInTheDocument();
  expect(screen.queryByText(/Pacote de|NaN|undefined|2 sessões/)).not.toBeInTheDocument();
  expect(screen.queryByText(/#5/)).not.toBeInTheDocument();
});
