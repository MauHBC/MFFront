import React from "react";
import "@testing-library/jest-dom";
import { fireEvent, render, screen } from "@testing-library/react";
import RightsOriginPicker from "./RightsOriginPicker";
import axios from "../../services/axios";

jest.mock("../../services/axios", () => ({ get: jest.fn() }));
beforeEach(() => jest.clearAllMocks());
const props = { patientId: "1", onSelect: jest.fn(), onShare: jest.fn(), canShare: true, sharing: false };
test("automatically queries rights and never auto-selects between services or contracts", async () => {
  const packages = [{ id: 3, quantity: 4, free_rights: 3, service: { name: "Fisioterapia" } },
    { id: 4, quantity: 2, free_rights: 2, service: { name: "Pilates" } }];
  axios.get.mockResolvedValue({ data: packages });
  render(<RightsOriginPicker {...props}/>);
  expect(await screen.findByText(/Fisioterapia — 3 sessões disponíveis/)).toBeInTheDocument();
  expect(screen.getByText(/Pilates — 2 sessões disponíveis/)).toBeInTheDocument();
  expect(axios.get).toHaveBeenCalledWith("/patients/1/available-rights");
  expect(props.onSelect).not.toHaveBeenCalled();
  fireEvent.click(screen.getByLabelText(/Pilates/));
  expect(props.onSelect).toHaveBeenCalledWith(packages[1]);
});
test("absence is discreet and does not add a confirmation; failure is not absence", async () => {
  axios.get.mockResolvedValueOnce({ data: [] }).mockRejectedValueOnce(new Error("offline"));
  const { rerender } = render(<RightsOriginPicker {...props}/>);
  expect(await screen.findByText(/Nenhuma sessão disponível/)).toBeInTheDocument();
  expect(props.onSelect).not.toHaveBeenCalled();
  rerender(<RightsOriginPicker {...props} patientId="2"/>);
  expect(await screen.findByText(/Não foi possível consultar/)).toBeInTheDocument();
  expect(screen.queryByText(/Nenhuma sessão disponível/)).not.toBeInTheDocument();
});
