import api from "./axios";
import {
  archiveDocumentTemplate,
  createDocumentTemplate,
  downloadIssuedDocument,
  downloadPdfResponse,
  duplicateDocumentTemplate,
  getDocumentErrorMessage,
  issueAttendanceDeclaration,
  listDocumentTemplates,
  listEligibleDocumentSessions,
  listIssuanceDocumentTemplates,
  listPatientDocuments,
  parseDownloadFilename,
  previewAttendanceDeclaration,
  setDefaultDocumentTemplate,
  updateDocumentTemplate,
} from "./documents";

jest.mock("./axios", () => {
  const callable = jest.fn();
  callable.get = jest.fn();
  callable.post = jest.fn();
  callable.put = jest.fn();
  return {
    __esModule: true,
    default: callable,
    getUserFacingApiError: jest.fn((error, fallback) => (
      error?.response?.data?.message || fallback
    )),
  };
});

describe("documents service", () => {
  beforeEach(() => {
    api.mockReset();
    api.get.mockReset();
    api.post.mockReset();
    api.put.mockReset();
    api.get.mockResolvedValue({ data: { data: [] } });
    api.post.mockResolvedValue({ data: { data: {} } });
    api.put.mockResolvedValue({ data: { data: {} } });
  });

  it("integra templates e ações administrativas sem enviar clinic_id", async () => {
    await listDocumentTemplates({ includeArchived: true });
    await createDocumentTemplate({ name: "Modelo", body_text: "Texto" });
    await updateDocumentTemplate(7, { name: "Atualizado", body_text: "Texto" });
    await duplicateDocumentTemplate(7);
    await setDefaultDocumentTemplate(7);
    await archiveDocumentTemplate(7);

    expect(api.get).toHaveBeenCalledWith("/document-templates", {
      params: { include_archived: true },
    });
    expect(api.post).toHaveBeenCalledWith(
      "/document-templates",
      { name: "Modelo", body_text: "Texto" },
    );
    expect(api.put).toHaveBeenCalledWith(
      "/document-templates/7",
      { name: "Atualizado", body_text: "Texto" },
    );
    expect(api.post).toHaveBeenCalledWith("/document-templates/7/duplicate", {});
    expect(api.post).toHaveBeenCalledWith("/document-templates/7/set-default");
    expect(api.post).toHaveBeenCalledWith("/document-templates/7/archive");
    expect(JSON.stringify([api.get.mock.calls, api.post.mock.calls, api.put.mock.calls]))
      .not.toContain("clinic_id");
  });

  it("usa somente endpoints documentais do paciente e de preview", async () => {
    await listEligibleDocumentSessions(41);
    await listIssuanceDocumentTemplates();
    await listPatientDocuments(41);
    await previewAttendanceDeclaration({ session_id: 9 });

    expect(api.get).toHaveBeenNthCalledWith(
      1,
      "/patients/41/documents/eligible-sessions",
      { params: { document_type: "attendance_declaration" } },
    );
    expect(api.get).toHaveBeenNthCalledWith(
      2,
      "/documents/templates",
      { params: { document_type: "attendance_declaration" } },
    );
    expect(api.get).toHaveBeenNthCalledWith(3, "/patients/41/documents");
    expect(api.post).toHaveBeenCalledWith(
      "/documents/attendance-declarations/preview",
      { session_id: 9 },
    );
    expect(JSON.stringify([api.get.mock.calls, api.post.mock.calls]))
      .not.toMatch(/clinic_id|\/sessions|agendamentos/i);
  });

  it("mantém separadas as listagens de modelos administrativa e de emissão", async () => {
    await listDocumentTemplates({ includeArchived: true });
    await listIssuanceDocumentTemplates("attendance_declaration");

    expect(api.get).toHaveBeenNthCalledWith(
      1,
      "/document-templates",
      { params: { include_archived: true } },
    );
    expect(api.get).toHaveBeenNthCalledWith(
      2,
      "/documents/templates",
      { params: { document_type: "attendance_declaration" } },
    );
    expect(JSON.stringify(api.get.mock.calls)).not.toContain("clinic_id");
  });

  it("envia emissão idempotente e distingue a segunda via", async () => {
    api.mockResolvedValue({ data: new Blob([], { type: "application/pdf" }) });
    await issueAttendanceDeclaration({ session_id: 9, final_text: "Texto" }, "document-key");
    await downloadIssuedDocument(88);

    expect(api).toHaveBeenNthCalledWith(1, {
      method: "post",
      url: "/documents/attendance-declarations",
      data: { session_id: 9, final_text: "Texto" },
      headers: { "Idempotency-Key": "document-key" },
      responseType: "blob",
    });
    expect(api).toHaveBeenNthCalledWith(2, {
      method: "get",
      url: "/documents/88/download",
      responseType: "blob",
    });
  });

  it("normaliza erros JSON recebidos como Blob, inclusive 403, 404 e 409", async () => {
    await expect(getDocumentErrorMessage({
      response: { status: 403, data: new Blob([
        JSON.stringify({ error: "DOCUMENT_TEMPLATE_ADMIN_REQUIRED" }),
      ], { type: "application/json" }) },
    }, "Falha")).resolves.toMatch(/administradores/);
    await expect(getDocumentErrorMessage({
      response: { status: 404, data: new Blob([
        JSON.stringify({ error: "DOCUMENT_ISSUANCE_NOT_FOUND" }),
      ], { type: "application/json" }) },
    }, "Falha")).resolves.toMatch(/não encontrado/);
    await expect(getDocumentErrorMessage({
      response: { status: 409, data: new Blob([
        JSON.stringify({ error: "IDEMPOTENCY_KEY_CONFLICT" }),
      ], { type: "application/json" }) },
    }, "Falha")).resolves.toMatch(/dados diferentes/);
  });

  it("valida PDF, usa nome de Content-Disposition e revoga a URL", () => {
    const createObjectURL = jest.fn(() => "blob:pdf");
    const revokeObjectURL = jest.fn();
    Object.defineProperty(URL, "createObjectURL", { configurable: true, value: createObjectURL });
    Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: revokeObjectURL });
    const click = jest.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    expect(parseDownloadFilename("attachment; filename*=UTF-8''declara%C3%A7%C3%A3o.pdf"))
      .toBe("declaração.pdf");
    expect(downloadPdfResponse({
      data: new Blob(["pdf"], { type: "application/pdf" }),
      headers: {
        "content-type": "application/pdf",
        "content-disposition": "attachment; filename=declaracao-41.pdf",
        "x-document-identifier": "DOC-41",
      },
    })).toEqual({ filename: "declaracao-41.pdf", identifier: "DOC-41" });
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:pdf");
    click.mockRestore();

    expect(() => downloadPdfResponse({
      data: new Blob(["erro"], { type: "application/json" }),
      headers: { "content-type": "application/json" },
    })).toThrow("INVALID_DOCUMENT_RESPONSE");
  });
});
