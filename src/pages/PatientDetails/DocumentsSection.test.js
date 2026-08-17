import React from "react";
import "@testing-library/jest-dom";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import PatientDocumentsSection from "./DocumentsSection";
import {
  createDocumentIdempotencyKey,
  downloadIssuedDocument,
  downloadPdfResponse,
  getDocumentErrorMessage,
  issueAttendanceDeclaration,
  listEligibleDocumentSessions,
  listIssuanceDocumentTemplates,
  listPatientDocuments,
  previewAttendanceDeclaration,
} from "../../services/documents";

let mockAuthorization;

jest.mock("react-toastify", () => ({
  toast: { error: jest.fn(), success: jest.fn() },
}));
jest.mock("../../contexts/AuthorizationContext", () => ({
  useAuthorization: () => mockAuthorization,
}));
jest.mock("../../contexts/ClinicContext", () => ({
  useClinicContext: () => ({ logoSrc: "/logo-clinica.png" }),
}));
jest.mock("../../services/documents", () => ({
  ATTENDANCE_DECLARATION: "attendance_declaration",
  createDocumentIdempotencyKey: jest.fn(() => "document-logical-attempt"),
  downloadIssuedDocument: jest.fn(),
  downloadPdfResponse: jest.fn(),
  getDocumentErrorMessage: jest.fn((error, fallback) => Promise.resolve(
    error?.friendlyMessage || fallback,
  )),
  issueAttendanceDeclaration: jest.fn(),
  listEligibleDocumentSessions: jest.fn(),
  listIssuanceDocumentTemplates: jest.fn(),
  listPatientDocuments: jest.fn(),
  previewAttendanceDeclaration: jest.fn(),
}));

const historyItem = {
  id: 88,
  document_type: "attendance_declaration",
  session_id: 17,
  issued_at: "2026-08-15T14:30:00Z",
  snapshot: {
    session: { date: "15/08/2026", start_time: "11:30", end_time: "12:00" },
    issuer: { name: "Dra. Ana" },
  },
};

const eligibleSessions = [{
  id: 17,
  starts_at: "2026-08-15T14:30:00Z",
  ends_at: "2026-08-15T15:00:00Z",
  professional: { id: 4, name: "Dra. Ana" },
}];

const templates = [
  {
    id: 1,
    name: "Alternativo",
    document_title: "Comprovante alternativo",
    is_active: true,
  },
  {
    id: 2,
    name: "Comparecimento principal",
    document_title: "Comprovante de presença",
    is_active: true,
  },
  {
    id: 3,
    name: "Modelo inativo",
    document_title: "Título indisponível",
    is_active: false,
  },
];

const authorizationFor = ({ read = false, issue = false, download = false, admin = false }) => ({
  isAdministrator: admin,
  canAccessModule: (moduleKey) => moduleKey === "clinical_records",
  hasCapability: (capability) => ({
    "clinical_records.read": read,
    "clinical_records.documents.issue": issue,
    "clinical_records.documents.download": download,
  }[capability] === true),
});

const deferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
};

const selectTemplate = async (dialog, templateId = "2") => {
  const select = await within(dialog).findByRole("combobox", { name: "Modelo" });
  fireEvent.change(select, { target: { value: templateId } });
  return select;
};

const previewResponse = ({
  templateId = 2,
  templateName = "Comparecimento principal",
  documentTitle = "Comprovante de presença",
  finalText = "Maria Souza compareceu ao atendimento.",
} = {}) => ({
  patient: { name: "Maria Souza" },
  clinic: { display_name: "Espaço Cuidar" },
  session: { date: "15/08/2026", start_time: "11:30", end_time: "12:00" },
  template: { id: templateId, name: templateName, document_title: documentTitle },
  final_text: finalText,
});

describe("PatientDocumentsSection", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    createDocumentIdempotencyKey.mockReturnValue("document-logical-attempt");
    getDocumentErrorMessage.mockImplementation((error, fallback) => Promise.resolve(
      error?.friendlyMessage || fallback,
    ));
    mockAuthorization = authorizationFor({ read: true });
    listPatientDocuments.mockResolvedValue([]);
    listEligibleDocumentSessions.mockResolvedValue(eligibleSessions);
    listIssuanceDocumentTemplates.mockResolvedValue(templates);
    previewAttendanceDeclaration.mockResolvedValue(previewResponse());
    issueAttendanceDeclaration.mockResolvedValue({ data: new Blob([]) });
    downloadIssuedDocument.mockResolvedValue({ data: new Blob([]) });
  });

  it("mantém leitura, emissão e download como permissões independentes", async () => {
    const { rerender } = render(
      <PatientDocumentsSection patientId="41" patientName="Maria Souza" />,
    );
    expect(await screen.findByText("Nenhum documento emitido para este paciente."))
      .toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Novo documento/ }))
      .not.toBeInTheDocument();

    mockAuthorization = authorizationFor({ issue: true });
    rerender(<PatientDocumentsSection patientId="42" patientName="Joana Lima" />);
    expect(await screen.findByText(/histórico documental não está disponível/i))
      .toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Novo documento/ })).toBeInTheDocument();
    expect(listPatientDocuments).toHaveBeenCalledTimes(1);
  });

  it("mostra histórico e oferece segunda via somente com capability própria", async () => {
    listPatientDocuments.mockResolvedValue([historyItem]);
    mockAuthorization = authorizationFor({ read: true, download: true });
    render(<PatientDocumentsSection patientId="41" patientName="Maria Souza" />);

    expect((await screen.findAllByText("Declaração de comparecimento")).length)
      .toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText("Dra. Ana").length).toBeGreaterThanOrEqual(2);
    fireEvent.click(screen.getAllByRole("button", { name: /Baixar novamente/ })[0]);
    await waitFor(() => expect(downloadIssuedDocument).toHaveBeenCalledWith(88));
    expect(issueAttendanceDeclaration).not.toHaveBeenCalled();
    await waitFor(() => expect(downloadPdfResponse).toHaveBeenCalledTimes(1));
  });

  it("abre com Modelo primeiro, sem Tipo ou modelo pré-selecionado e preserva a ordem ativa", async () => {
    mockAuthorization = authorizationFor({ read: true, issue: true });
    render(<PatientDocumentsSection patientId="41" patientName="Maria Souza" />);
    await screen.findByText("Nenhum documento emitido para este paciente.");
    fireEvent.click(screen.getByRole("button", { name: /Novo documento/ }));
    const dialog = await screen.findByRole("dialog", { name: "Novo documento" });

    const templateSelect = await within(dialog).findByRole("combobox", { name: "Modelo" });
    expect(listEligibleDocumentSessions).toHaveBeenCalledWith("41", { limit: 5 });
    expect(listIssuanceDocumentTemplates).toHaveBeenCalledTimes(1);
    expect(templateSelect).toHaveValue("");
    expect(templateSelect).toHaveDisplayValue("Selecione um modelo");
    expect(within(templateSelect).getAllByRole("option").map((option) => option.textContent))
      .toEqual(["Alternativo", "Comparecimento principal"]);
    expect(within(templateSelect).queryByRole("option", { name: "Selecione um modelo" }))
      .not.toBeInTheDocument();
    expect(templateSelect.querySelector('option[value=""]')).toBeDisabled();
    expect(templateSelect.querySelector('option[value=""]')).toHaveAttribute("hidden");
    expect(within(templateSelect).queryByRole("option", { name: "Modelo inativo" }))
      .not.toBeInTheDocument();
    expect(within(dialog).getByText("Maria Souza").tagName).toBe("STRONG");
    expect(within(dialog).queryByText("Tipo")).not.toBeInTheDocument();
    expect(within(dialog).queryByText("Declaração de comparecimento"))
      .not.toBeInTheDocument();
    expect(dialog.querySelector("select")).toBe(templateSelect);
    expect(within(dialog).getAllByText(/^(Modelo|Atendimentos mais recentes)$/).map(
      (element) => element.textContent,
    )).toEqual(["Modelo", "Atendimentos mais recentes"]);
    expect(within(dialog).queryByText("Atendimento")).not.toBeInTheDocument();
    expect(within(dialog).getByRole("group", { name: "Atendimentos mais recentes" }))
      .toBeInTheDocument();
    const sessionDate = within(dialog).getByText("15/08/2026 · 11:30–12:00");
    const professional = within(dialog).getByText("Dra. Ana");
    expect(sessionDate.tagName).toBe(professional.tagName);
    expect(sessionDate.className).toBe(professional.className);
    expect(within(dialog).getByRole("radio", { name: /15\/08\/2026.*Dra\. Ana/ }))
      .not.toBeChecked();
    expect(within(dialog).queryByRole("button", { name: "Visualizar preview" }))
      .not.toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Gerar e baixar PDF" }))
      .toBeDisabled();

    fireEvent.change(templateSelect, { target: { value: "2" } });
    fireEvent.click(within(dialog).getByRole("radio", { name: /Dra\. Ana/ }));
    await waitFor(() => expect(previewAttendanceDeclaration).toHaveBeenCalledWith({
      session_id: 17,
      template_id: 2,
    }));
    const previewSheet = await within(dialog).findByRole("region", {
      name: "Prévia visual da declaração",
    });
    expect(within(previewSheet).getByRole("img", { name: "Logo Espaço Cuidar" }))
      .toBeInTheDocument();
    expect(within(previewSheet).getByText("Espaço Cuidar")).toBeInTheDocument();
    expect(within(previewSheet).getByRole("heading", { name: "Comprovante de presença" }))
      .toBeInTheDocument();
    expect(within(dialog).queryByText("Preview")).not.toBeInTheDocument();
    expect(within(dialog).queryByText("Pronto para emitir")).not.toBeInTheDocument();
    expect(within(dialog).queryByText(/^Paciente:/)).not.toBeInTheDocument();
    expect(within(dialog).queryByText(/^Clínica:/)).not.toBeInTheDocument();
    expect(within(dialog).queryByText(/^Atendimento:/)).not.toBeInTheDocument();
    expect(within(dialog).getByText(/não modifica o modelo salvo/i)).toBeInTheDocument();
    fireEvent.change(within(previewSheet).getByRole("textbox"), {
      target: { value: "Texto ajustado somente nesta emissão." },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Gerar e baixar PDF" }));

    await waitFor(() => expect(issueAttendanceDeclaration).toHaveBeenCalledWith({
      session_id: 17,
      template_id: 2,
      final_text: "Texto ajustado somente nesta emissão.",
    }, "document-logical-attempt"));
    await waitFor(() => expect(downloadPdfResponse).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(listPatientDocuments).toHaveBeenCalledTimes(2));
    expect(screen.queryByRole("dialog", { name: "Novo documento" }))
      .not.toBeInTheDocument();
  });

  it("não carrega preview com somente um modelo selecionado", async () => {
    mockAuthorization = authorizationFor({ issue: true });
    render(<PatientDocumentsSection patientId="41" patientName="Maria Souza" />);
    fireEvent.click(screen.getByRole("button", { name: /Novo documento/ }));
    const dialog = await screen.findByRole("dialog", { name: "Novo documento" });
    await selectTemplate(dialog);
    expect(within(dialog).getByRole("button", { name: "Buscar outro atendimento" }))
      .toBeInTheDocument();
    expect(within(dialog).queryByRole("button", { name: "Visualizar preview" }))
      .not.toBeInTheDocument();
    expect(previewAttendanceDeclaration).not.toHaveBeenCalled();
    expect(within(dialog).getByRole("button", { name: "Gerar e baixar PDF" }))
      .toBeDisabled();
  });

  it("limita a apresentação inicial aos cinco atendimentos mais recentes", async () => {
    listEligibleDocumentSessions.mockResolvedValue(Array.from({ length: 7 }, (_, index) => ({
      ...eligibleSessions[0],
      id: index + 1,
      professional: { name: `Profissional ${index + 1}` },
    })));
    mockAuthorization = authorizationFor({ issue: true });
    render(<PatientDocumentsSection patientId="41" patientName="Maria Souza" />);
    fireEvent.click(screen.getByRole("button", { name: /Novo documento/ }));
    const dialog = await screen.findByRole("dialog", { name: "Novo documento" });

    expect(await within(dialog).findAllByRole("radio")).toHaveLength(5);
    expect(within(dialog).queryByText("Profissional 6")).not.toBeInTheDocument();
  });

  it("busca por data, mantém o modelo e permite múltiplos atendimentos done", async () => {
    const sessionsOnDate = [
      {
        id: 21,
        starts_at: "2026-08-16T12:00:00Z",
        ends_at: "2026-08-16T13:00:00Z",
        status: "done",
        professional: { name: "Maria" },
      },
      {
        id: 22,
        starts_at: "2026-08-16T20:00:00Z",
        ends_at: "2026-08-16T21:00:00Z",
        status: "done",
        professional: { name: "Leonardo" },
      },
      {
        id: 23,
        starts_at: "2026-08-16T22:00:00Z",
        ends_at: "2026-08-16T23:00:00Z",
        status: "scheduled",
        professional: { name: "Não realizado" },
      },
    ];
    listEligibleDocumentSessions.mockImplementation((patientId, options) => (
      options.date ? Promise.resolve(sessionsOnDate) : Promise.resolve(eligibleSessions)
    ));
    mockAuthorization = authorizationFor({ issue: true });
    render(<PatientDocumentsSection patientId="41" patientName="Maria Souza" />);
    fireEvent.click(screen.getByRole("button", { name: /Novo documento/ }));
    const dialog = await screen.findByRole("dialog", { name: "Novo documento" });
    await selectTemplate(dialog);

    fireEvent.click(within(dialog).getByRole("button", { name: "Buscar outro atendimento" }));
    expect(within(dialog).getByLabelText("Data")).toBeInTheDocument();
    fireEvent.change(within(dialog).getByLabelText("Data"), {
      target: { value: "2026-08-16" },
    });

    await waitFor(() => expect(listEligibleDocumentSessions).toHaveBeenCalledWith(
      "41",
      { date: "2026-08-16" },
    ));
    expect(await within(dialog).findByRole("radio", { name: /Maria/ })).toBeInTheDocument();
    expect(within(dialog).getByRole("radio", { name: /Leonardo/ })).toBeInTheDocument();
    expect(within(dialog).queryByText("Não realizado")).not.toBeInTheDocument();
    expect(within(dialog).getByRole("combobox", { name: "Modelo" })).toHaveValue("2");

    fireEvent.click(within(dialog).getByRole("radio", { name: /Leonardo/ }));
    await waitFor(() => expect(previewAttendanceDeclaration).toHaveBeenCalledWith({
      session_id: 22,
      template_id: 2,
    }));
  });

  it("informa quando a busca por data não encontra atendimento realizado", async () => {
    listEligibleDocumentSessions.mockImplementation((patientId, options) => (
      options.date ? Promise.resolve([]) : Promise.resolve(eligibleSessions)
    ));
    mockAuthorization = authorizationFor({ issue: true });
    render(<PatientDocumentsSection patientId="41" patientName="Maria Souza" />);
    fireEvent.click(screen.getByRole("button", { name: /Novo documento/ }));
    const dialog = await screen.findByRole("dialog", { name: "Novo documento" });

    fireEvent.click(await within(dialog).findByRole("button", {
      name: "Buscar outro atendimento",
    }));
    fireEvent.change(within(dialog).getByLabelText("Data"), {
      target: { value: "2026-08-14" },
    });

    expect(await within(dialog).findByText("Nenhum atendimento realizado nesta data."))
      .toBeInTheDocument();
  });

  it("trocar o modelo invalida e atualiza automaticamente o preview", async () => {
    listEligibleDocumentSessions.mockResolvedValue([
      eligibleSessions[0],
      { ...eligibleSessions[0], id: 18, professional: { name: "Dr. Paulo" } },
    ]);
    previewAttendanceDeclaration.mockImplementation(({ template_id: templateId }) => (
      Promise.resolve(templateId === 1
        ? previewResponse({
          templateId: 1,
          templateName: "Alternativo",
          documentTitle: "Comprovante alternativo",
          finalText: "Texto alternativo.",
        })
        : previewResponse())
    ));
    mockAuthorization = authorizationFor({ issue: true });
    render(<PatientDocumentsSection patientId="41" patientName="Maria Souza" />);
    fireEvent.click(screen.getByRole("button", { name: /Novo documento/ }));
    const dialog = await screen.findByRole("dialog", { name: "Novo documento" });
    await selectTemplate(dialog);
    const firstSession = await within(dialog).findByRole("radio", { name: /Dra\. Ana/ });
    fireEvent.click(firstSession);
    expect(await within(dialog).findByDisplayValue("Maria Souza compareceu ao atendimento."))
      .toBeInTheDocument();

    fireEvent.change(within(dialog).getByRole("combobox", { name: "Modelo" }), {
      target: { value: "1" },
    });
    expect(within(dialog).queryByRole("textbox")).not.toBeInTheDocument();
    expect(await within(dialog).findByDisplayValue("Texto alternativo.")).toBeInTheDocument();
    expect(previewAttendanceDeclaration).toHaveBeenLastCalledWith({
      session_id: 17,
      template_id: 1,
    });
  });

  it("trocar o atendimento invalida e atualiza automaticamente o preview", async () => {
    listEligibleDocumentSessions.mockResolvedValue([
      eligibleSessions[0],
      { ...eligibleSessions[0], id: 18, professional: { name: "Dr. Paulo" } },
    ]);
    previewAttendanceDeclaration.mockImplementation(({ session_id: sessionId }) => (
      Promise.resolve(previewResponse({
        finalText: sessionId === 18 ? "Atendimento de Paulo." : "Atendimento de Ana.",
      }))
    ));
    mockAuthorization = authorizationFor({ issue: true });
    render(<PatientDocumentsSection patientId="41" patientName="Maria Souza" />);
    fireEvent.click(screen.getByRole("button", { name: /Novo documento/ }));
    const dialog = await screen.findByRole("dialog", { name: "Novo documento" });
    await selectTemplate(dialog);
    fireEvent.click(await within(dialog).findByRole("radio", { name: /Dra\. Ana/ }));
    expect(await within(dialog).findByDisplayValue("Atendimento de Ana.")).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole("radio", { name: /Dr\. Paulo/ }));
    expect(within(dialog).queryByRole("textbox")).not.toBeInTheDocument();
    expect(await within(dialog).findByDisplayValue("Atendimento de Paulo."))
      .toBeInTheDocument();
    expect(previewAttendanceDeclaration).toHaveBeenLastCalledWith({
      session_id: 18,
      template_id: 2,
    });
  });

  it("ignora resposta antiga quando uma seleção mais recente já gerou outro preview", async () => {
    const oldPreview = deferred();
    const newPreview = deferred();
    previewAttendanceDeclaration.mockImplementation(({ template_id: templateId }) => (
      templateId === 2 ? oldPreview.promise : newPreview.promise
    ));
    mockAuthorization = authorizationFor({ issue: true });
    render(<PatientDocumentsSection patientId="41" patientName="Maria Souza" />);
    fireEvent.click(screen.getByRole("button", { name: /Novo documento/ }));
    const dialog = await screen.findByRole("dialog", { name: "Novo documento" });
    const templateSelect = await selectTemplate(dialog);
    fireEvent.click(await within(dialog).findByRole("radio", { name: /Dra\. Ana/ }));
    await waitFor(() => expect(previewAttendanceDeclaration).toHaveBeenCalledTimes(1));

    fireEvent.change(templateSelect, { target: { value: "1" } });
    await waitFor(() => expect(previewAttendanceDeclaration).toHaveBeenCalledTimes(2));
    await act(async () => {
      newPreview.resolve(previewResponse({
        templateId: 1,
        templateName: "Alternativo",
        documentTitle: "Comprovante alternativo",
        finalText: "Preview mais recente.",
      }));
    });
    expect(await within(dialog).findByDisplayValue("Preview mais recente."))
      .toBeInTheDocument();

    await act(async () => {
      oldPreview.resolve(previewResponse({ finalText: "Preview antigo." }));
    });
    expect(within(dialog).getByDisplayValue("Preview mais recente.")).toBeInTheDocument();
    expect(within(dialog).queryByDisplayValue("Preview antigo.")).not.toBeInTheDocument();
  });

  it("envia o modelo escolhido por perfil customizado no preview e na emissão", async () => {
    mockAuthorization = authorizationFor({ issue: true });
    previewAttendanceDeclaration.mockResolvedValue(previewResponse({
      templateId: 1,
      templateName: "Alternativo",
      documentTitle: "Título exclusivo do modelo alternativo",
      finalText: "Texto do modelo alternativo.",
    }));
    render(<PatientDocumentsSection patientId="41" patientName="Maria Souza" />);
    fireEvent.click(screen.getByRole("button", { name: /Novo documento/ }));
    const dialog = await screen.findByRole("dialog", { name: "Novo documento" });
    const templateSelect = await within(dialog).findByRole("combobox", { name: "Modelo" });
    expect(templateSelect).toHaveValue("");

    fireEvent.change(templateSelect, { target: { value: "1" } });
    fireEvent.click(within(dialog).getByRole("radio", { name: /Dra\. Ana/ }));
    await waitFor(() => expect(previewAttendanceDeclaration).toHaveBeenCalledWith({
      session_id: 17,
      template_id: 1,
    }));
    const previewSheet = await within(dialog).findByRole("region", {
      name: "Prévia visual da declaração",
    });
    expect(within(previewSheet).getByRole("heading", {
      name: "Título exclusivo do modelo alternativo",
    })).toBeInTheDocument();
    const issueButton = await within(dialog).findByRole("button", {
      name: "Gerar e baixar PDF",
    });
    await waitFor(() => expect(issueButton).toBeEnabled());
    fireEvent.click(issueButton);
    await waitFor(() => expect(issueAttendanceDeclaration).toHaveBeenCalledWith({
      session_id: 17,
      template_id: 1,
      final_text: "Texto do modelo alternativo.",
    }, "document-logical-attempt"));
  });

  it("não pré-seleciona nem mesmo quando existe somente um modelo ativo", async () => {
    listIssuanceDocumentTemplates.mockResolvedValue([
      {
        id: 7,
        name: "Modelo único",
        document_title: "Título único",
        is_active: true,
      },
    ]);
    mockAuthorization = authorizationFor({ issue: true });
    render(<PatientDocumentsSection patientId="41" patientName="Maria Souza" />);
    fireEvent.click(screen.getByRole("button", { name: /Novo documento/ }));
    const dialog = await screen.findByRole("dialog", { name: "Novo documento" });
    const templateSelect = await within(dialog).findByRole("combobox", { name: "Modelo" });

    expect(templateSelect).toHaveValue("");
    expect(templateSelect).toBeEnabled();
    expect(templateSelect).toHaveDisplayValue("Selecione um modelo");
    expect(within(templateSelect).queryByRole("option", { name: "Selecione um modelo" }))
      .not.toBeInTheDocument();
    expect(within(templateSelect).getByRole("option", { name: "Modelo único" }))
      .toBeInTheDocument();
    expect(within(dialog).queryByRole("button", { name: "Visualizar preview" }))
      .not.toBeInTheDocument();
  });

  it("exibe erro quando a listagem de modelos para emissão falha", async () => {
    const failure = new Error("templates unavailable");
    failure.friendlyMessage = "Não foi possível carregar os modelos ativos.";
    listIssuanceDocumentTemplates.mockRejectedValue(failure);
    mockAuthorization = authorizationFor({ issue: true });
    render(<PatientDocumentsSection patientId="41" patientName="Maria Souza" />);
    fireEvent.click(screen.getByRole("button", { name: /Novo documento/ }));

    expect(await screen.findByText("Não foi possível carregar os modelos ativos."))
      .toBeInTheDocument();
  });

  it("não consulta modelos nem atendimentos sem documents.issue", async () => {
    mockAuthorization = authorizationFor({ read: true });
    render(<PatientDocumentsSection patientId="41" patientName="Maria Souza" />);

    expect(await screen.findByText("Nenhum documento emitido para este paciente."))
      .toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Novo documento/ })).not.toBeInTheDocument();
    expect(listIssuanceDocumentTemplates).not.toHaveBeenCalled();
    expect(listEligibleDocumentSessions).not.toHaveBeenCalled();
  });

  it("impede double-submit e mantém a chave na repetição da mesma confirmação", async () => {
    const firstFailure = new Error("conflict");
    firstFailure.friendlyMessage = "Tente novamente.";
    const retry = deferred();
    issueAttendanceDeclaration
      .mockRejectedValueOnce(firstFailure)
      .mockImplementationOnce(() => retry.promise);
    mockAuthorization = authorizationFor({ issue: true });
    render(<PatientDocumentsSection patientId="41" patientName="Maria Souza" />);
    fireEvent.click(screen.getByRole("button", { name: /Novo documento/ }));
    const dialog = await screen.findByRole("dialog", { name: "Novo documento" });
    await selectTemplate(dialog);
    expect(listIssuanceDocumentTemplates).toHaveBeenCalledTimes(1);
    fireEvent.click(within(dialog).getByRole("radio", { name: /Dra\. Ana/ }));
    await waitFor(() => expect(within(dialog).getByRole("textbox"))
      .toBeInTheDocument());

    fireEvent.click(within(dialog).getByRole("button", { name: "Gerar e baixar PDF" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("Tente novamente.");
    const retryButton = within(dialog).getByRole("button", { name: "Gerar e baixar PDF" });
    fireEvent.click(retryButton);
    fireEvent.click(retryButton);
    expect(issueAttendanceDeclaration).toHaveBeenCalledTimes(2);
    expect(issueAttendanceDeclaration.mock.calls[0][1])
      .toBe(issueAttendanceDeclaration.mock.calls[1][1]);

    await act(async () => { retry.resolve({ data: new Blob([]) }); });
    await waitFor(() => expect(downloadPdfResponse).toHaveBeenCalledTimes(1));
  });

  it("limpa a seleção e o preview ao trocar de paciente com o modal aberto", async () => {
    mockAuthorization = authorizationFor({ issue: true });
    const { rerender } = render(
      <PatientDocumentsSection patientId="41" patientName="Maria Souza" />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Novo documento/ }));
    const dialog = await screen.findByRole("dialog", { name: "Novo documento" });
    await selectTemplate(dialog);
    fireEvent.click(await within(dialog).findByRole("radio", { name: /Dra\. Ana/ }));
    expect(await within(dialog).findByRole("textbox")).toBeInTheDocument();

    rerender(<PatientDocumentsSection patientId="42" patientName="Joana Lima" />);

    expect(await within(dialog).findByText("Joana Lima")).toBeInTheDocument();
    await waitFor(() => expect(within(dialog).queryByRole("textbox")).not.toBeInTheDocument());
    expect(await within(dialog).findByRole("radio", { name: /Dra\. Ana/ })).not.toBeChecked();
    expect(listEligibleDocumentSessions).toHaveBeenCalledWith("42", { limit: 5 });
  });

  it("descarta resposta pendente do paciente anterior na troca de rota", async () => {
    const oldPatient = deferred();
    listPatientDocuments.mockImplementation((patientId) => (
      patientId === "41" ? oldPatient.promise : Promise.resolve([{ ...historyItem, id: 99 }])
    ));
    const { rerender } = render(
      <PatientDocumentsSection patientId="41" patientName="Maria Souza" />,
    );
    rerender(<PatientDocumentsSection patientId="42" patientName="Joana Lima" />);
    expect((await screen.findAllByText("Declaração de comparecimento")).length)
      .toBeGreaterThanOrEqual(2);
    await act(async () => { oldPatient.resolve([]); });
    expect(screen.queryByText("Nenhum documento emitido para este paciente."))
      .not.toBeInTheDocument();
    expect(listPatientDocuments).toHaveBeenCalledWith("42");
  });
});
