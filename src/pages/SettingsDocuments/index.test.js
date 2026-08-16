import React from "react";
import "@testing-library/jest-dom";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import SettingsDocuments from ".";
import {
  archiveDocumentTemplate,
  createDocumentTemplate,
  duplicateDocumentTemplate,
  listDocumentTemplates,
  setDefaultDocumentTemplate,
  updateDocumentTemplate,
} from "../../services/documents";

jest.mock("react-toastify", () => ({ toast: { error: jest.fn(), success: jest.fn() } }));
jest.mock("../../services/documents", () => ({
  archiveDocumentTemplate: jest.fn(),
  ATTENDANCE_DECLARATION: "attendance_declaration",
  createDocumentTemplate: jest.fn(),
  duplicateDocumentTemplate: jest.fn(),
  getDocumentErrorMessage: jest.fn((error, fallback) => Promise.resolve(fallback)),
  listDocumentTemplates: jest.fn(),
  setDefaultDocumentTemplate: jest.fn(),
  updateDocumentTemplate: jest.fn(),
}));

const templates = [
  {
    id: 1,
    name: "Modelo padrão",
    document_type: "attendance_declaration",
    body_text: "Olá {{patient_name}}",
    is_default: true,
    archived_at: null,
  },
  {
    id: 2,
    name: "Modelo alternativo",
    document_type: "attendance_declaration",
    body_text: "Compareceu em {{session_date}}",
    is_default: false,
    archived_at: null,
  },
  {
    id: 3,
    name: "Modelo antigo",
    document_type: "attendance_declaration",
    body_text: "Antigo",
    is_default: false,
    archived_at: "2026-08-01T10:00:00Z",
  },
];

function getDesktopRow(name) {
  const cell = screen.getAllByText(name).find((element) => element.closest("td"));
  return cell.closest("tr");
}

async function openRowMenu(name) {
  await screen.findAllByText(name);
  const row = getDesktopRow(name);
  fireEvent.click(within(row).getByRole("button", { name: `Ações do modelo ${name}` }));
  const menu = screen.getByRole("menu", { name: `Ações do modelo ${name}` });
  await waitFor(() => expect(
    within(menu).getAllByRole("menuitem").every((item) => !item.disabled),
  ).toBe(true));
  return menu;
}

describe("SettingsDocuments", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    listDocumentTemplates.mockResolvedValue(templates);
    createDocumentTemplate.mockResolvedValue({});
    updateDocumentTemplate.mockResolvedValue({});
    duplicateDocumentTemplate.mockResolvedValue({});
    setDefaultDocumentTemplate.mockResolvedValue({});
    archiveDocumentTemplate.mockResolvedValue({});
  });

  it("lista modelos ativos e arquivados em tabela e composição mobile", async () => {
    const { container } = render(<SettingsDocuments />);
    await screen.findAllByText("Modelo padrão");
    expect(listDocumentTemplates).toHaveBeenCalledWith({ includeArchived: true });
    expect(screen.getAllByText("Modelo padrão")).toHaveLength(2);
    expect(screen.getAllByText("Arquivado")).toHaveLength(2);
    expect(container.querySelectorAll("table")).toHaveLength(1);
    expect(container.querySelectorAll("article")).toHaveLength(3);
  });

  it("cria modelo com texto simples, placeholders e opção de padrão", async () => {
    render(<SettingsDocuments />);
    await screen.findAllByText("Modelo padrão");
    fireEvent.click(screen.getByRole("button", { name: /Novo modelo/ }));
    const dialog = screen.getByRole("dialog", { name: "Novo modelo" });
    expect(within(dialog).getByText("{{patient_name}}")).toBeInTheDocument();
    expect(within(dialog).getByText("{{end_time}}")).toBeInTheDocument();
    fireEvent.change(within(dialog).getByLabelText(/Nome/), {
      target: { value: "Declaração curta" },
    });
    fireEvent.change(within(dialog).getByLabelText(/Texto do modelo/), {
      target: { value: "Paciente {{patient_name}} compareceu." },
    });
    fireEvent.click(within(dialog).getByLabelText("Definir como padrão"));
    fireEvent.click(within(dialog).getByRole("button", { name: "Salvar" }));

    await waitFor(() => expect(createDocumentTemplate).toHaveBeenCalledWith({
      document_type: "attendance_declaration",
      name: "Declaração curta",
      body_text: "Paciente {{patient_name}} compareceu.",
      is_default: true,
    }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("edita, duplica, define padrão e arquiva sem oferecer exclusão", async () => {
    render(<SettingsDocuments />);
    await screen.findAllByText("Modelo alternativo");

    let menu = await openRowMenu("Modelo alternativo");
    expect(within(menu).queryByText(/Excluir/i)).not.toBeInTheDocument();
    fireEvent.click(within(menu).getByRole("menuitem", { name: "Editar" }));
    const dialog = screen.getByRole("dialog", { name: "Editar modelo" });
    fireEvent.change(within(dialog).getByLabelText(/Nome/), {
      target: { value: "Modelo revisado" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(updateDocumentTemplate).toHaveBeenCalledWith(2, {
      name: "Modelo revisado",
      body_text: "Compareceu em {{session_date}}",
    }));

    menu = await openRowMenu("Modelo alternativo");
    fireEvent.click(within(menu).getByRole("menuitem", { name: "Duplicar" }));
    await waitFor(() => expect(duplicateDocumentTemplate).toHaveBeenCalledWith(2));

    menu = await openRowMenu("Modelo alternativo");
    fireEvent.click(within(menu).getByRole("menuitem", { name: "Definir como padrão" }));
    await waitFor(() => expect(setDefaultDocumentTemplate).toHaveBeenCalledWith(2));

    menu = await openRowMenu("Modelo alternativo");
    fireEvent.click(within(menu).getByRole("menuitem", { name: "Arquivar" }));
    const confirmation = screen.getByRole("dialog", { name: "Arquivar modelo" });
    fireEvent.click(within(confirmation).getByRole("button", { name: "Arquivar modelo" }));
    await waitFor(() => expect(archiveDocumentTemplate).toHaveBeenCalledWith(2));
  });
});
