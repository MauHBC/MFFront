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
  { id: 1, name: "Alternativo", is_default: false },
  { id: 2, name: "Padrão comparecimento", is_default: true },
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
    previewAttendanceDeclaration.mockResolvedValue({
      patient: { name: "Maria Souza" },
      clinic: { display_name: "Espaço Cuidar" },
      session: { date: "15/08/2026", start_time: "11:30", end_time: "12:00" },
      template: { id: 2, name: "Padrão comparecimento" },
      final_text: "Maria Souza compareceu ao atendimento.",
    });
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

  it("permite ao profissional autorizado escolher modelos e seleciona o padrão", async () => {
    mockAuthorization = authorizationFor({ read: true, issue: true });
    render(<PatientDocumentsSection patientId="41" patientName="Maria Souza" />);
    await screen.findByText("Nenhum documento emitido para este paciente.");
    fireEvent.click(screen.getByRole("button", { name: /Novo documento/ }));
    const dialog = await screen.findByRole("dialog", { name: "Novo documento" });

    await waitFor(() => expect(within(dialog).getAllByRole("combobox")).toHaveLength(3));
    expect(listEligibleDocumentSessions).toHaveBeenCalledWith("41");
    expect(listIssuanceDocumentTemplates).toHaveBeenCalledTimes(1);
    const selects = within(dialog).getAllByRole("combobox");
    expect(selects[1]).toHaveValue("17");
    expect(selects[2]).toHaveValue("2");
    expect(within(dialog).getByText(/Dra\. Ana/)).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole("button", { name: "Visualizar preview" }));
    await waitFor(() => expect(previewAttendanceDeclaration).toHaveBeenCalledWith({
      session_id: 17,
      template_id: 2,
    }));
    expect(await within(dialog).findByText(/Espaço Cuidar/)).toBeInTheDocument();
    expect(within(dialog).getByText(/não modifica o modelo salvo/i)).toBeInTheDocument();
    fireEvent.change(within(dialog).getByRole("textbox"), {
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

  it("envia o modelo escolhido por perfil customizado no preview e na emissão", async () => {
    mockAuthorization = authorizationFor({ issue: true });
    previewAttendanceDeclaration.mockResolvedValue({
      patient: { name: "Maria Souza" },
      clinic: { display_name: "Espaço Cuidar" },
      session: { date: "15/08/2026", start_time: "11:30", end_time: "12:00" },
      template: { id: 1, name: "Alternativo" },
      final_text: "Texto do modelo alternativo.",
    });
    render(<PatientDocumentsSection patientId="41" patientName="Maria Souza" />);
    fireEvent.click(screen.getByRole("button", { name: /Novo documento/ }));
    const dialog = await screen.findByRole("dialog", { name: "Novo documento" });
    await waitFor(() => expect(within(dialog).getAllByRole("combobox")).toHaveLength(3));
    const templateSelect = within(dialog).getAllByRole("combobox")[2];
    expect(templateSelect).toHaveValue("2");

    fireEvent.change(templateSelect, { target: { value: "1" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Visualizar preview" }));
    await waitFor(() => expect(previewAttendanceDeclaration).toHaveBeenCalledWith({
      session_id: 17,
      template_id: 1,
    }));
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

  it("mantém o único modelo selecionado sem oferecer uma escolha desnecessária", async () => {
    listIssuanceDocumentTemplates.mockResolvedValue([
      { id: 7, name: "Modelo único", is_default: true },
    ]);
    mockAuthorization = authorizationFor({ issue: true });
    render(<PatientDocumentsSection patientId="41" patientName="Maria Souza" />);
    fireEvent.click(screen.getByRole("button", { name: /Novo documento/ }));
    const dialog = await screen.findByRole("dialog", { name: "Novo documento" });
    await waitFor(() => expect(within(dialog).getAllByRole("combobox")).toHaveLength(3));
    const templateSelect = within(dialog).getAllByRole("combobox")[2];

    expect(templateSelect).toHaveValue("7");
    expect(templateSelect).toBeDisabled();
    expect(within(templateSelect).getByRole("option", { name: "Modelo único (Padrão)" }))
      .toBeInTheDocument();
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

  it("não consulta modelos quando o usuário não possui documents.issue", async () => {
    mockAuthorization = authorizationFor({ read: true });
    render(<PatientDocumentsSection patientId="41" patientName="Maria Souza" />);

    expect(await screen.findByText("Nenhum documento emitido para este paciente."))
      .toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Novo documento/ })).not.toBeInTheDocument();
    expect(listIssuanceDocumentTemplates).not.toHaveBeenCalled();
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
    await waitFor(() => expect(within(dialog).getAllByRole("combobox")[1]).toHaveValue("17"));
    expect(listIssuanceDocumentTemplates).toHaveBeenCalledTimes(1);
    expect(within(dialog).getAllByRole("combobox")[2]).toHaveValue("2");
    fireEvent.click(within(dialog).getByRole("button", { name: "Visualizar preview" }));
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
