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
import PatientsSearch from ".";
import axios from "../../services/axios";

jest.mock("../../services/axios", () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    post: jest.fn(),
  },
}));
jest.mock("react-toastify", () => ({
  toast: {
    error: jest.fn(),
    success: jest.fn(),
  },
}));

const patients = Array.from({ length: 12 }, (_, index) => ({
  id: index + 1,
  full_name: index === 0 ? "Ágata Teste" : `Paciente ${String(index + 1).padStart(2, "0")}`,
  phone: `(27) 99999-${String(index).padStart(4, "0")}`,
  email: `paciente${index + 1}@teste.local`,
}));

function renderPage() {
  return render(
    <MemoryRouter>
      <PatientsSearch />
    </MemoryRouter>,
  );
}

describe("PatientsSearch", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    axios.get.mockResolvedValue({ data: patients });
  });

  it("carrega, pesquisa sem diferenciar acentos e preserva os links reais", async () => {
    renderPage();

    expect(await screen.findByText("12 pacientes cadastrados")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Novo paciente" })).toHaveAttribute(
      "href",
      "/pacientes/novo",
    );

    fireEvent.change(screen.getByPlaceholderText("Digite para buscar"), {
      target: { value: "agata" },
    });

    expect(screen.getByText("1 resultado na busca")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ágata Teste Ver detalhes" })).toBeInTheDocument();
  });

  it("mantém paginação e alternância entre lista e grade", async () => {
    renderPage();

    expect(await screen.findByText("Mostrando 1-10 de 12")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Próxima" }));
    expect(screen.getByText("Mostrando 11-12 de 12")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Layout grade" }));
    expect(screen.getByText("paciente12@teste.local")).toBeInTheDocument();
  });

  it("mostra o estado vazio sem remover as ações da página", async () => {
    axios.get.mockResolvedValue({ data: [] });
    renderPage();

    expect(await screen.findByText("Nenhum paciente encontrado.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Novo paciente" })).toBeInTheDocument();
  });

  it("informa erro de carregamento e mantém estado vazio seguro", async () => {
    axios.get.mockRejectedValue({
      response: { data: { error: "Falha de teste ao carregar pacientes." } },
    });
    renderPage();

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Falha de teste ao carregar pacientes.");
    });
    expect(screen.getByText("Nenhum paciente encontrado.")).toBeInTheDocument();
  });
});
