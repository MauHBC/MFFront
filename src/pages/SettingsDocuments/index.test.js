import React from "react";
import "@testing-library/jest-dom";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { toast } from "react-toastify";
import SettingsDocuments from ".";
import {
  activateDocumentTemplate,
  createDocumentTemplate,
  deactivateDocumentTemplate,
  duplicateDocumentTemplate,
  listDocumentTemplates,
  updateDocumentTemplate,
} from "../../services/documents";

jest.mock("react-toastify", () => ({ toast: { error: jest.fn(), success: jest.fn() } }));
jest.mock("../../contexts/ClinicContext", () => ({
  useClinicContext: () => ({
    displayName: "Clínica Exemplo",
    logoSrc: "/logo-clinica.png",
  }),
}));
jest.mock("../../services/documents", () => ({
  activateDocumentTemplate: jest.fn(),
  ATTENDANCE_DECLARATION: "attendance_declaration",
  createDocumentTemplate: jest.fn(),
  deactivateDocumentTemplate: jest.fn(),
  duplicateDocumentTemplate: jest.fn(),
  getDocumentErrorMessage: jest.fn((error, fallback) => Promise.resolve(fallback)),
  listDocumentTemplates: jest.fn(),
  updateDocumentTemplate: jest.fn(),
}));

const templates = [
  {
    id: 1,
    name: "Modelo principal",
    document_type: "attendance_declaration",
    document_title: "Comprovante de comparecimento",
    body_text: "Olá {{patient_name}}",
    is_active: true,
    archived_at: null,
  },
  {
    id: 2,
    name: "Modelo alternativo",
    document_type: "attendance_declaration",
    document_title: "Atestado de presença",
    body_text: "Compareceu em {{session_date}}",
    is_active: false,
    archived_at: null,
  },
  {
    id: 3,
    name: "Modelo antigo",
    document_type: "attendance_declaration",
    document_title: "Documento arquivado",
    body_text: "Antigo",
    is_active: false,
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
    activateDocumentTemplate.mockResolvedValue({});
    deactivateDocumentTemplate.mockResolvedValue({});
  });

  it("lista estados ativo e inativo sem qualquer conceito visual de preferência", async () => {
    const { container } = render(<SettingsDocuments />);
    await screen.findAllByText("Modelo principal");
    const table = screen.getByRole("table");
    expect(listDocumentTemplates).toHaveBeenCalledWith({ includeArchived: true });
    expect(screen.getAllByText("Modelo principal")).toHaveLength(2);
    expect(within(table).queryByRole("columnheader", { name: "Padrão" }))
      .not.toBeInTheDocument();
    expect(screen.queryByText("Padrão")).not.toBeInTheDocument();
    expect(screen.getAllByText("Ativo")).toHaveLength(2);
    expect(screen.getAllByText("Inativo")).toHaveLength(2);
    expect(screen.getAllByText("Arquivado")).toHaveLength(2);
    expect(within(table).queryByRole("columnheader", { name: "Tipo" }))
      .not.toBeInTheDocument();
    expect(screen.queryByText("Declaração de comparecimento")).not.toBeInTheDocument();
    expect(container.querySelectorAll("table")).toHaveLength(1);
    expect(container.querySelectorAll("article")).toHaveLength(3);
  });

  it("carrega modelo existente com nomes amigáveis e sem sintaxe técnica visível", async () => {
    render(<SettingsDocuments />);
    await screen.findAllByText("Modelo principal");
    const menu = await openRowMenu("Modelo principal");
    fireEvent.click(within(menu).getByRole("menuitem", { name: "Editar" }));

    const dialog = screen.getByRole("dialog", { name: "Editar modelo" });
    expect(within(dialog).queryByText(/^Tipo$/)).not.toBeInTheDocument();
    expect(within(dialog).queryByRole("combobox")).not.toBeInTheDocument();
    const visualEditor = within(dialog).getByRole("region", {
      name: "Editor visual da declaração",
    });
    const nameInput = within(dialog).getByLabelText(/Nome do modelo/);
    const titleInput = within(dialog).getByLabelText(/Título do documento/);
    const body = within(visualEditor).getByLabelText("Texto do modelo");
    expect(nameInput).toHaveValue("Modelo principal");
    expect(titleInput).toHaveValue("Comprovante de comparecimento");
    expect(within(visualEditor).getByRole("img", { name: "Logo Clínica Exemplo" }))
      .toHaveAttribute("src", "/logo-clinica.png");
    expect(within(visualEditor).getByText("Clínica Exemplo")).toBeInTheDocument();
    expect(within(visualEditor).getByRole("heading", {
      name: "Comprovante de comparecimento",
    })).toBeInTheDocument();
    fireEvent.change(titleInput, { target: { value: "Título atualizado no documento" } });
    expect(within(visualEditor).getByRole("heading", {
      name: "Título atualizado no documento",
    })).toBeInTheDocument();
    expect(body).toHaveValue("Olá [Nome do paciente]");
    expect(body.value).not.toContain("{{");
    expect(within(visualEditor).getByText("[Nome do paciente]"))
      .toHaveAttribute("data-automatic-information", "true");
    expect(dialog).toHaveTextContent("Informações automáticas");
    expect(dialog).not.toHaveTextContent("placeholder");
    expect(dialog).not.toHaveTextContent("{{patient_name}}");
    expect(dialog).not.toHaveTextContent(
      "Escreva o texto como deseja que apareça no documento.",
    );
  });

  it("insere cada informação automática e salva os valores canônicos", async () => {
    render(<SettingsDocuments />);
    await screen.findAllByText("Modelo principal");
    fireEvent.click(screen.getByRole("button", { name: /Novo modelo/ }));
    const dialog = screen.getByRole("dialog", { name: "Novo modelo" });
    expect(within(dialog).queryByText(/^Tipo$/)).not.toBeInTheDocument();
    expect(within(dialog).queryByRole("combobox")).not.toBeInTheDocument();
    const visualEditor = within(dialog).getByRole("region", {
      name: "Editor visual da declaração",
    });
    const nameInput = within(dialog).getByLabelText(/Nome do modelo/);
    const titleInput = within(dialog).getByLabelText(/Título do documento/);
    expect(nameInput).toHaveValue("");
    expect(titleInput).toHaveValue("");
    expect(within(visualEditor).getByRole("heading", { level: 3 })).toBeEmptyDOMElement();
    expect(nameInput.compareDocumentPosition(titleInput))
      .toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(titleInput.compareDocumentPosition(visualEditor))
      .toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    fireEvent.change(nameInput, {
      target: { value: "Declaração curta" },
    });
    fireEvent.change(titleInput, {
      target: { value: "Declaração para atendimento" },
    });
    expect(within(visualEditor).getByRole("heading", {
      name: "Declaração para atendimento",
    })).toBeInTheDocument();

    const textarea = within(dialog).getByLabelText(/Texto do modelo/);
    const automaticInformation = [
      ["Nome do paciente", "[Nome do paciente]"],
      ["Nome da clínica", "[Nome da clínica]"],
      ["Data do atendimento", "[Data do atendimento]"],
      ["Horário inicial", "[Horário inicial]"],
      ["Horário final", "[Horário final]"],
    ];
    automaticInformation.forEach(([label]) => {
      fireEvent.click(within(dialog).getByRole("button", { name: `+ ${label}` }));
    });
    expect(textarea).toHaveValue(automaticInformation.map(([, text]) => text).join(""));
    expect(dialog.querySelectorAll("[data-automatic-information='true']"))
      .toHaveLength(automaticInformation.length);

    fireEvent.click(within(dialog).getByRole("button", { name: "Salvar" }));

    await waitFor(() => expect(createDocumentTemplate).toHaveBeenCalledWith({
      document_type: "attendance_declaration",
      name: "Declaração curta",
      document_title: "Declaração para atendimento",
      body_text: "{{patient_name}}{{clinic_name}}{{session_date}}{{start_time}}{{end_time}}",
    }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("exige nome e título antes de criar um modelo", async () => {
    render(<SettingsDocuments />);
    await screen.findAllByText("Modelo principal");
    fireEvent.click(screen.getByRole("button", { name: /Novo modelo/ }));
    const dialog = screen.getByRole("dialog", { name: "Novo modelo" });

    fireEvent.click(within(dialog).getByRole("button", { name: "Salvar" }));
    expect(toast.error).toHaveBeenLastCalledWith("Informe o nome do modelo.");
    expect(within(dialog).getByLabelText(/Nome do modelo/)).toHaveFocus();

    fireEvent.change(within(dialog).getByLabelText(/Nome do modelo/), {
      target: { value: "Modelo sem título" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Salvar" }));
    expect(toast.error).toHaveBeenLastCalledWith("Informe o título do documento.");
    expect(within(dialog).getByLabelText(/Título do documento/)).toHaveFocus();
    expect(createDocumentTemplate).not.toHaveBeenCalled();
  });

  it("insere na seleção atual e devolve foco e cursor ao textarea", async () => {
    render(<SettingsDocuments />);
    await screen.findAllByText("Modelo principal");
    fireEvent.click(screen.getByRole("button", { name: /Novo modelo/ }));
    const dialog = screen.getByRole("dialog", { name: "Novo modelo" });
    const textarea = within(dialog).getByLabelText(/Texto do modelo/);
    fireEvent.change(textarea, { target: { value: "Olá mundo" } });
    textarea.focus();
    textarea.setSelectionRange(4, 9);

    fireEvent.click(within(dialog).getByRole("button", { name: "+ Nome do paciente" }));

    expect(textarea).toHaveValue("Olá [Nome do paciente]");
    expect(textarea).toHaveFocus();
    expect(textarea.selectionStart).toBe("Olá [Nome do paciente]".length);
    expect(textarea.selectionEnd).toBe("Olá [Nome do paciente]".length);
  });

  it("edita, duplica, ativa e desativa sem oferecer preferência ou arquivamento", async () => {
    render(<SettingsDocuments />);
    await screen.findAllByText("Modelo alternativo");

    let menu = await openRowMenu("Modelo alternativo");
    expect(within(menu).queryByText(/Excluir/i)).not.toBeInTheDocument();
    fireEvent.click(within(menu).getByRole("menuitem", { name: "Editar" }));
    const dialog = screen.getByRole("dialog", { name: "Editar modelo" });
    fireEvent.change(within(dialog).getByLabelText(/Nome/), {
      target: { value: "Modelo revisado" },
    });
    expect(within(dialog).getByLabelText(/Título do documento/))
      .toHaveValue("Atestado de presença");
    fireEvent.change(within(dialog).getByLabelText(/Título do documento/), {
      target: { value: "Declaração de presença revisada" },
    });
    expect(within(dialog).getByLabelText(/Texto do modelo/))
      .toHaveValue("Compareceu em [Data do atendimento]");
    fireEvent.change(within(dialog).getByLabelText(/Texto do modelo/), {
      target: { value: "A pessoa compareceu em [Data do atendimento]." },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(updateDocumentTemplate).toHaveBeenCalledWith(2, {
      name: "Modelo revisado",
      document_title: "Declaração de presença revisada",
      body_text: "A pessoa compareceu em {{session_date}}.",
    }));
    expect(updateDocumentTemplate.mock.calls[0][1]).not.toHaveProperty("document_type");

    menu = await openRowMenu("Modelo alternativo");
    fireEvent.click(within(menu).getByRole("menuitem", { name: "Editar" }));
    expect(within(screen.getByRole("dialog", { name: "Editar modelo" }))
      .getByLabelText(/Texto do modelo/))
      .toHaveValue("Compareceu em [Data do atendimento]");
    expect(within(screen.getByRole("dialog", { name: "Editar modelo" }))
      .getByLabelText(/Título do documento/))
      .toHaveValue("Atestado de presença");
    fireEvent.click(screen.getByRole("button", { name: "Fechar editor" }));

    menu = await openRowMenu("Modelo alternativo");
    fireEvent.click(within(menu).getByRole("menuitem", { name: "Duplicar" }));
    await waitFor(() => expect(duplicateDocumentTemplate).toHaveBeenCalledWith(2));

    menu = await openRowMenu("Modelo alternativo");
    expect(within(menu).queryByRole("menuitem", { name: /padrão/i })).not.toBeInTheDocument();
    expect(within(menu).queryByRole("menuitem", { name: /arquivar/i })).not.toBeInTheDocument();
    fireEvent.click(within(menu).getByRole("menuitem", { name: "Ativar" }));
    await waitFor(() => expect(activateDocumentTemplate).toHaveBeenCalledWith(2));

    menu = await openRowMenu("Modelo principal");
    expect(within(menu).queryByRole("menuitem", { name: /arquivar/i })).not.toBeInTheDocument();
    fireEvent.click(within(menu).getByRole("menuitem", { name: "Desativar" }));
    await waitFor(() => expect(deactivateDocumentTemplate).toHaveBeenCalledWith(1));
  });
});
