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
jest.mock("../../contexts/ClinicContext", () => ({
  useClinicContext: () => ({
    displayName: "Clínica Exemplo",
    logoSrc: "/logo-clinica.png",
  }),
}));
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

  it("carrega modelo existente com nomes amigáveis e sem sintaxe técnica visível", async () => {
    render(<SettingsDocuments />);
    await screen.findAllByText("Modelo padrão");
    const menu = await openRowMenu("Modelo padrão");
    fireEvent.click(within(menu).getByRole("menuitem", { name: "Editar" }));

    const dialog = screen.getByRole("dialog", { name: "Editar modelo" });
    const visualEditor = within(dialog).getByRole("region", {
      name: "Editor visual da declaração",
    });
    const body = within(visualEditor).getByLabelText("Texto do modelo");
    expect(within(visualEditor).getByRole("img", { name: "Logo Clínica Exemplo" }))
      .toHaveAttribute("src", "/logo-clinica.png");
    expect(within(visualEditor).getByText("Clínica Exemplo")).toBeInTheDocument();
    expect(within(visualEditor).getByRole("heading", {
      name: "DECLARA\u00c7\u00c3O DE COMPARECIMENTO",
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
    await screen.findAllByText("Modelo padrão");
    fireEvent.click(screen.getByRole("button", { name: /Novo modelo/ }));
    const dialog = screen.getByRole("dialog", { name: "Novo modelo" });
    expect(within(dialog).getByRole("region", { name: "Editor visual da declaração" }))
      .toBeInTheDocument();
    fireEvent.change(within(dialog).getByLabelText(/Nome/), {
      target: { value: "Declaração curta" },
    });

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

    fireEvent.click(within(dialog).getByLabelText("Definir como padrão"));
    fireEvent.click(within(dialog).getByRole("button", { name: "Salvar" }));

    await waitFor(() => expect(createDocumentTemplate).toHaveBeenCalledWith({
      document_type: "attendance_declaration",
      name: "Declaração curta",
      body_text: "{{patient_name}}{{clinic_name}}{{session_date}}{{start_time}}{{end_time}}",
      is_default: true,
    }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("insere na seleção atual e devolve foco e cursor ao textarea", async () => {
    render(<SettingsDocuments />);
    await screen.findAllByText("Modelo padrão");
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
    expect(within(dialog).getByLabelText(/Texto do modelo/))
      .toHaveValue("Compareceu em [Data do atendimento]");
    fireEvent.change(within(dialog).getByLabelText(/Texto do modelo/), {
      target: { value: "A pessoa compareceu em [Data do atendimento]." },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(updateDocumentTemplate).toHaveBeenCalledWith(2, {
      name: "Modelo revisado",
      body_text: "A pessoa compareceu em {{session_date}}.",
    }));

    menu = await openRowMenu("Modelo alternativo");
    fireEvent.click(within(menu).getByRole("menuitem", { name: "Editar" }));
    expect(within(screen.getByRole("dialog", { name: "Editar modelo" }))
      .getByLabelText(/Texto do modelo/))
      .toHaveValue("Compareceu em [Data do atendimento]");
    fireEvent.click(screen.getByRole("button", { name: "Fechar editor" }));

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
