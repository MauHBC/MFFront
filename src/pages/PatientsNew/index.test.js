import React from "react";
import "@testing-library/jest-dom";
import {
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { toast } from "react-toastify";
import PatientsNew from ".";
import axios from "../../services/axios";

jest.mock("../../services/axios", () => ({
  __esModule: true,
  default: { post: jest.fn() },
}));
jest.mock("react-toastify", () => ({
  toast: {
    error: jest.fn(),
    success: jest.fn(),
  },
}));

function renderPage() {
  return render(
    <MemoryRouter>
      <PatientsNew />
    </MemoryRouter>,
  );
}

describe("PatientsNew", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    axios.post.mockResolvedValue({ data: { id: 123 } });
  });

  it("preserva validações obrigatórias sem enviar payload inválido", () => {
    renderPage();

    fireEvent.submit(screen.getByRole("button", { name: "Salvar paciente" }).closest("form"));

    expect(toast.error).toHaveBeenCalledWith("Informe o nome completo do paciente.");
    expect(axios.post).not.toHaveBeenCalled();
  });

  it("preserva normalização, payload e destino do cadastro", async () => {
    renderPage();

    fireEvent.change(screen.getByLabelText("Nome completo *"), {
      target: { value: "  Paciente de Teste  " },
    });
    fireEvent.change(screen.getByLabelText("Data de nascimento"), {
      target: { value: "02/01/1990" },
    });
    fireEvent.change(screen.getByLabelText("Sexo"), {
      target: { value: "F" },
    });
    fireEvent.change(screen.getByLabelText("Atenção do paciente *"), {
      target: { value: "high" },
    });
    fireEvent.change(screen.getByLabelText("UF"), {
      target: { value: "es" },
    });
    fireEvent.click(screen.getByRole("checkbox", { name: "WhatsApp" }));
    fireEvent.click(screen.getByRole("button", { name: "Salvar paciente" }));

    await waitFor(() => {
      expect(axios.post).toHaveBeenCalledWith("/patients", expect.objectContaining({
        full_name: "Paciente de Teste",
        birth_date: "1990-01-02",
        sex: "F",
        attention_level: "high",
        address_state: "ES",
        contact_via_whatsapp: true,
      }));
    });
    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith("Paciente cadastrado com sucesso.");
    });
  });
});
