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

let mockAuthorization = null;

jest.mock("../../contexts/AuthorizationContext", () => ({
  useAuthorization: () => mockAuthorization,
}));

jest.mock("../../services/axios", () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn() },
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
    mockAuthorization = {
      status: "ready",
      context: {
        is_administrator: false,
        modules: [{ module_key: "patients", scope_level: "own" }],
      },
      hasCapability: jest.fn(() => false),
    };
    axios.get.mockResolvedValue({ data: [] });
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

  it("exige e envia profissional responsável no cadastro administrativo", async () => {
    mockAuthorization = {
      status: "ready",
      context: {
        is_administrator: true,
        modules: [{ module_key: "patients", scope_level: "clinic" }],
      },
      hasCapability: jest.fn(() => true),
    };
    axios.get.mockResolvedValue({
      data: [{
        id: 30,
        name: "Profissional responsável",
        clinic_professional_id: 300,
      }],
    });
    renderPage();

    fireEvent.change(screen.getByLabelText("Nome completo *"), {
      target: { value: "Paciente administrativo" },
    });
    fireEvent.change(screen.getByLabelText("Atenção do paciente *"), {
      target: { value: "medium" },
    });
    fireEvent.submit(screen.getByRole("button", { name: "Salvar paciente" }).closest("form"));
    expect(toast.error).toHaveBeenCalledWith("Selecione o profissional responsável.");
    expect(axios.post).not.toHaveBeenCalled();

    const responsibleSelect = await screen.findByLabelText("Profissional responsável *");
    await waitFor(() => expect(responsibleSelect).not.toBeDisabled());
    fireEvent.change(responsibleSelect, {
      target: { value: "300" },
    });
    expect(responsibleSelect.value).toBe("300");
    fireEvent.submit(screen.getByRole("button", { name: "Salvar paciente" }).closest("form"));

    await waitFor(() => expect(axios.post).toHaveBeenCalledWith(
      "/patients",
      expect.objectContaining({ clinic_professional_id: 300 }),
    ));
  });
});
