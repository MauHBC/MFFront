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
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: jest.fn().mockResolvedValue(undefined),
      },
    });
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
    expect(screen.getByRole("navigation", { name: "Paginação de pacientes" }))
      .toBeInTheDocument();
    expect(axios.get).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Próxima" }));
    expect(screen.getByText("Mostrando 11-12 de 12")).toBeInTheDocument();
    expect(axios.get).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "Layout grade" }));
    expect(screen.getByText("paciente12@teste.local")).toBeInTheDocument();
  });

  it("mantém busca e paginação locais sem novas consultas ao Backend", async () => {
    renderPage();
    expect(await screen.findByText("12 pacientes cadastrados")).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText("Digite para buscar"), {
      target: { value: "Paciente" },
    });
    expect(screen.getByText("12 resultados na busca")).toBeInTheDocument();
    expect(screen.getByText("Página 1 de 2")).toBeInTheDocument();
    expect(axios.get).toHaveBeenCalledTimes(1);
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

  it("gera o convite com o payload atual e exibe link, validade e sucesso", async () => {
    axios.post.mockResolvedValue({
      data: {
        invite_url: "https://cadastro.test/convite-ativo",
        expires_at: "2026-08-04T12:00:00.000Z",
      },
    });
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: "Gerar link" }));

    expect(axios.post).toHaveBeenCalledWith("/patient-invites", {
      expires_in_days: 7,
    });
    expect(await screen.findByDisplayValue("https://cadastro.test/convite-ativo"))
      .toBeInTheDocument();
    expect(screen.getByText("Expira em 04/08/2026")).toBeInTheDocument();
    expect(toast.success).toHaveBeenCalledWith("Link gerado.");
  });

  it("mantém o envio único durante o carregamento", async () => {
    let resolveInvite;
    axios.post.mockImplementation(() => new Promise((resolve) => {
      resolveInvite = resolve;
    }));
    renderPage();

    const generateButton = await screen.findByRole("button", { name: "Gerar link" });
    fireEvent.click(generateButton);

    const loadingButton = await screen.findByRole("button", { name: "Gerando..." });
    expect(loadingButton).toBeDisabled();
    fireEvent.click(loadingButton);
    expect(axios.post).toHaveBeenCalledTimes(1);

    resolveInvite({ data: { invite_url: "https://cadastro.test/convite-unico" } });
    expect(await screen.findByRole("button", { name: "Gerar link" })).toBeEnabled();
  });

  it("usa o código como fallback e copia o link gerado", async () => {
    axios.post.mockResolvedValue({ data: { code: "codigo-convite" } });
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: "Gerar link" }));
    const expectedLink = `${window.location.origin}/cadastro/paciente/codigo-convite`;
    expect(await screen.findByDisplayValue(expectedLink)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Copiar" }));
    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(expectedLink);
      expect(toast.success).toHaveBeenCalledWith("Link copiado.");
    });
  });

  it("informa erros amigáveis ao gerar e copiar o convite", async () => {
    axios.post.mockRejectedValueOnce({
      response: { data: { error: "Convite indisponível para teste." } },
    });
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: "Gerar link" }));
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Convite indisponível para teste.");
    });

    axios.post.mockResolvedValueOnce({
      data: { invite_url: "https://cadastro.test/convite-copia" },
    });
    navigator.clipboard.writeText.mockRejectedValueOnce(new Error("clipboard"));
    fireEvent.click(screen.getByRole("button", { name: "Gerar link" }));
    fireEvent.click(await screen.findByRole("button", { name: "Copiar" }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Não foi possível copiar o link.");
    });
  });
});
