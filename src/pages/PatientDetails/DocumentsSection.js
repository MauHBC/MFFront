import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import PropTypes from "prop-types";
import styled from "styled-components";
import { toast } from "react-toastify";
import { FaDownload, FaFileAlt, FaPlus, FaTimes } from "react-icons/fa";
import { useAuthorization } from "../../contexts/AuthorizationContext";
import { GhostButton, PrimaryButton, RowActionButton } from "../../components/AppButton";
import { StatusPill } from "../../components/AppStatus";
import DataLoadingState from "../../components/DataLoadingState";
import {
  ATTENDANCE_DECLARATION,
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
import { alpha, colors, radii, spacing } from "../../styles/tokens";

const DOCUMENT_TYPES = Object.freeze([{
  value: ATTENDANCE_DECLARATION,
  label: "Declaração de comparecimento",
}]);

const dateTimeFormatter = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "America/Sao_Paulo",
});
const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "long",
  timeZone: "America/Sao_Paulo",
});
const timeFormatter = new Intl.DateTimeFormat("pt-BR", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Sao_Paulo",
});

function formatDateTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : dateTimeFormatter.format(date);
}

function formatEligibleSession(session) {
  const startsAt = new Date(session.starts_at);
  const endsAt = new Date(session.ends_at);
  if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) {
    return `Atendimento #${session.id}`;
  }
  return `${dateFormatter.format(startsAt)}, ${timeFormatter.format(startsAt)}–${timeFormatter.format(endsAt)}`;
}

function documentTypeLabel(type) {
  return DOCUMENT_TYPES.find((item) => item.value === type)?.label || type || "Documento";
}

function documentSessionLabel(document) {
  const session = document?.snapshot?.session;
  if (session?.date && session?.start_time && session?.end_time) {
    return `${session.date}, ${session.start_time}–${session.end_time}`;
  }
  return document?.session_id ? `Atendimento #${document.session_id}` : "—";
}

function issuerLabel(document) {
  return document?.snapshot?.issuer?.name || "Emissor não informado";
}

function DocumentIssueModal({
  patientId,
  patientName,
  onClose,
  onIssued,
}) {
  const [resources, setResources] = useState({ status: "loading", error: "" });
  const [sessions, setSessions] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [sessionId, setSessionId] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [preview, setPreview] = useState(null);
  const [finalText, setFinalText] = useState("");
  const [previewing, setPreviewing] = useState(false);
  const [issuing, setIssuing] = useState(false);
  const [operationError, setOperationError] = useState("");
  const [idempotencyKey, setIdempotencyKey] = useState(null);
  const sessionSelectRef = useRef(null);

  useEffect(() => {
    let active = true;
    setResources({ status: "loading", error: "" });
    Promise.all([
      listEligibleDocumentSessions(patientId),
      listIssuanceDocumentTemplates(),
    ])
      .then(([sessionData, templateData]) => {
        if (!active) return;
        const availableSessions = Array.isArray(sessionData) ? sessionData : [];
        const availableTemplates = Array.isArray(templateData) ? templateData : [];
        setSessions(availableSessions);
        setTemplates(availableTemplates);
        setSessionId(availableSessions[0] ? String(availableSessions[0].id) : "");
        const defaultTemplate = availableTemplates.find((template) => template.is_default)
          || availableTemplates[0];
        setTemplateId(defaultTemplate ? String(defaultTemplate.id) : "");
        setResources({ status: "ready", error: "" });
        window.setTimeout(() => sessionSelectRef.current?.focus(), 0);
      })
      .catch(async (error) => {
        if (!active) return;
        const message = await getDocumentErrorMessage(
          error,
          "Não foi possível preparar a emissão do documento.",
        );
        if (!active) return;
        setResources({
          status: "error",
          error: message,
        });
      });
    return () => { active = false; };
  }, [patientId]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleEscape = (event) => {
      if (event.key === "Escape" && !issuing) onClose();
    };
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleEscape);
    };
  }, [issuing, onClose]);

  const invalidatePreview = () => {
    setPreview(null);
    setFinalText("");
    setOperationError("");
    setIdempotencyKey(null);
  };

  const handlePreview = async () => {
    if (!sessionId || !templateId || previewing) return;
    setPreviewing(true);
    setOperationError("");
    try {
      const data = await previewAttendanceDeclaration({
        session_id: Number(sessionId),
        template_id: Number(templateId),
      });
      setPreview(data);
      setFinalText(data?.final_text || "");
      setIdempotencyKey(null);
    } catch (error) {
      setOperationError(await getDocumentErrorMessage(
        error,
        "Não foi possível gerar o preview do documento.",
      ));
    } finally {
      setPreviewing(false);
    }
  };

  const handleIssue = async () => {
    if (!preview || !templateId || !finalText.trim() || issuing) return;
    const commandKey = idempotencyKey || createDocumentIdempotencyKey();
    if (!idempotencyKey) setIdempotencyKey(commandKey);
    setIssuing(true);
    setOperationError("");
    try {
      const response = await issueAttendanceDeclaration({
        session_id: Number(sessionId),
        template_id: Number(templateId),
        final_text: finalText,
      }, commandKey);
      downloadPdfResponse(response, "declaracao");
      toast.success("Documento emitido e baixado com sucesso.");
      await onIssued();
      onClose();
    } catch (error) {
      setOperationError(await getDocumentErrorMessage(
        error,
        "Não foi possível emitir o documento.",
      ));
    } finally {
      setIssuing(false);
    }
  };

  return (
    <ModalOverlay
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !issuing) onClose();
      }}
    >
      <ModalCard role="dialog" aria-modal="true" aria-labelledby="document-issue-title">
        <ModalHeader>
          <div>
            <ModalTitle id="document-issue-title">Novo documento</ModalTitle>
            <ModalSubtitle>{patientName}</ModalSubtitle>
          </div>
          <CloseButton type="button" onClick={onClose} disabled={issuing} aria-label="Fechar">
            <FaTimes aria-hidden="true" />
          </CloseButton>
        </ModalHeader>
        <ModalBody>
          {resources.status === "loading" && (
            <DataLoadingState text="Preparando emissão..." compact />
          )}
          {resources.status === "error" && (
            <DataLoadingState tone="error" text={resources.error} compact />
          )}
          {resources.status === "ready" && (
            <FlowFields>
              <FlowField>
                <span>Tipo</span>
                <select value={ATTENDANCE_DECLARATION} disabled>
                  <option value={ATTENDANCE_DECLARATION}>Declaração de comparecimento</option>
                </select>
              </FlowField>
              <FlowField>
                <span>Atendimento</span>
                <select
                  ref={sessionSelectRef}
                  value={sessionId}
                  onChange={(event) => {
                    setSessionId(event.target.value);
                    invalidatePreview();
                  }}
                  disabled={sessions.length === 0 || previewing || issuing}
                >
                  {sessions.length === 0 && <option value="">Nenhum atendimento elegível</option>}
                  {sessions.map((session) => (
                    <option key={session.id} value={session.id}>
                      {formatEligibleSession(session)}
                      {session.professional?.name ? ` · ${session.professional.name}` : ""}
                    </option>
                  ))}
                </select>
              </FlowField>
              <FlowField>
                <span>Modelo</span>
                <select
                  value={templateId}
                  onChange={(event) => {
                    setTemplateId(event.target.value);
                    invalidatePreview();
                  }}
                  disabled={templates.length <= 1 || previewing || issuing}
                >
                  {templates.length === 0 && <option value="">Nenhum modelo ativo disponível</option>}
                  {templates.map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.name}{template.is_default ? " (Padrão)" : ""}
                    </option>
                  ))}
                </select>
              </FlowField>

              {sessions.length === 0 && (
                <InlineEmpty>Nenhum atendimento concluído está disponível para emissão.</InlineEmpty>
              )}
              {templates.length === 0 && (
                <InlineEmpty>Nenhum modelo ativo está disponível para emissão.</InlineEmpty>
              )}

              <PreviewAction>
                <GhostButton
                  type="button"
                  onClick={handlePreview}
                  disabled={!sessionId || !templateId || previewing || issuing}
                >
                  {previewing ? "Gerando preview..." : "Visualizar preview"}
                </GhostButton>
              </PreviewAction>

              {preview && (
                <PreviewPanel>
                  <PreviewHeading>
                    <div>
                      <strong>Preview</strong>
                      <span>{preview.template?.name || "Modelo padrão"}</span>
                    </div>
                    <StatusPill $tone="active">Pronto para emitir</StatusPill>
                  </PreviewHeading>
                  <PreviewIdentity>
                    <span><strong>Paciente:</strong> {preview.patient?.name || patientName}</span>
                    <span><strong>Clínica:</strong> {preview.clinic?.display_name || "—"}</span>
                    <span>
                      <strong>Atendimento:</strong>{" "}
                      {preview.session?.date || "—"}, {preview.session?.start_time || "—"}–{preview.session?.end_time || "—"}
                    </span>
                  </PreviewIdentity>
                  <FlowField>
                    <span>Texto deste documento</span>
                    <textarea
                      rows={9}
                      value={finalText}
                      maxLength={10000}
                      onChange={(event) => {
                        setFinalText(event.target.value);
                        setIdempotencyKey(null);
                        setOperationError("");
                      }}
                      disabled={issuing}
                    />
                    <small>
                      Esta alteração vale somente para este documento e não modifica o modelo salvo.
                    </small>
                  </FlowField>
                </PreviewPanel>
              )}

              {operationError && <OperationError role="alert">{operationError}</OperationError>}
            </FlowFields>
          )}
        </ModalBody>
        <ModalFooter>
          <GhostButton type="button" onClick={onClose} disabled={issuing}>Cancelar</GhostButton>
          <PrimaryButton
            type="button"
            onClick={handleIssue}
            disabled={!preview || !templateId || !finalText.trim() || issuing}
          >
            <FaDownload aria-hidden="true" />
            {issuing ? "Gerando PDF..." : "Gerar e baixar PDF"}
          </PrimaryButton>
        </ModalFooter>
      </ModalCard>
    </ModalOverlay>
  );
}

DocumentIssueModal.propTypes = {
  patientId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  patientName: PropTypes.string.isRequired,
  onClose: PropTypes.func.isRequired,
  onIssued: PropTypes.func.isRequired,
};

export default function PatientDocumentsSection({ patientId, patientName }) {
  const authorization = useAuthorization();
  const canRead = authorization.canAccessModule("clinical_records", "view")
    && authorization.hasCapability("clinical_records.read");
  const canIssue = authorization.canAccessModule("clinical_records", "view")
    && authorization.hasCapability("clinical_records.documents.issue");
  const canDownload = authorization.canAccessModule("clinical_records", "view")
    && authorization.hasCapability("clinical_records.documents.download");
  const [history, setHistory] = useState([]);
  const [load, setLoad] = useState({ patientId, status: canRead ? "loading" : "unavailable", error: "" });
  const [issueOpen, setIssueOpen] = useState(false);
  const [downloadingId, setDownloadingId] = useState(null);
  const newButtonRef = useRef(null);

  const loadHistory = useCallback(async () => {
    if (!canRead) {
      setHistory([]);
      setLoad({ patientId, status: "unavailable", error: "" });
      return;
    }
    setLoad({ patientId, status: "loading", error: "" });
    try {
      const data = await listPatientDocuments(patientId);
      setHistory(Array.isArray(data) ? data : []);
      setLoad({ patientId, status: "ready", error: "" });
    } catch (error) {
      setHistory([]);
      setLoad({
        patientId,
        status: "error",
        error: await getDocumentErrorMessage(
          error,
          "Não foi possível carregar os documentos do paciente.",
        ),
      });
    }
  }, [canRead, patientId]);

  useEffect(() => {
    let active = true;
    if (!canRead) {
      setHistory([]);
      setLoad({ patientId, status: "unavailable", error: "" });
      return () => { active = false; };
    }
    setHistory([]);
    setLoad({ patientId, status: "loading", error: "" });
    listPatientDocuments(patientId)
      .then((data) => {
        if (!active) return;
        setHistory(Array.isArray(data) ? data : []);
        setLoad({ patientId, status: "ready", error: "" });
      })
      .catch(async (error) => {
        if (!active) return;
        const message = await getDocumentErrorMessage(
          error,
          "Não foi possível carregar os documentos do paciente.",
        );
        if (!active) return;
        setLoad({
          patientId,
          status: "error",
          error: message,
        });
      });
    return () => { active = false; };
  }, [canRead, patientId]);

  const closeIssueModal = useCallback(() => {
    setIssueOpen(false);
    window.setTimeout(() => newButtonRef.current?.focus(), 0);
  }, []);

  const handleDownload = async (document) => {
    if (!canDownload || downloadingId) return;
    setDownloadingId(document.id);
    try {
      const response = await downloadIssuedDocument(document.id);
      downloadPdfResponse(response, "declaracao");
      toast.success("Segunda via baixada com sucesso.");
    } catch (error) {
      toast.error(await getDocumentErrorMessage(
        error,
        "Não foi possível baixar a segunda via.",
      ));
    } finally {
      setDownloadingId(null);
    }
  };

  const visibleLoad = load.patientId === patientId
    ? load
    : { status: canRead ? "loading" : "unavailable", error: "" };

  return (
    <DocumentsArea>
      <SectionHeader>
        <div>
          <h2><FaFileAlt aria-hidden="true" /> Documentos</h2>
          <p>Documentos emitidos para este paciente.</p>
        </div>
        {canIssue && (
          <PrimaryButton ref={newButtonRef} type="button" onClick={() => setIssueOpen(true)}>
            <FaPlus aria-hidden="true" /> Novo documento
          </PrimaryButton>
        )}
      </SectionHeader>

      {visibleLoad.status === "loading" && (
        <DataLoadingState text="Carregando documentos..." compact />
      )}
      {visibleLoad.status === "error" && (
        <StatePanel>
          <DataLoadingState tone="error" text={visibleLoad.error} compact />
          <GhostButton type="button" onClick={loadHistory}>Tentar novamente</GhostButton>
        </StatePanel>
      )}
      {visibleLoad.status === "unavailable" && (
        <PermissionNotice>
          O histórico documental não está disponível para seu perfil.
        </PermissionNotice>
      )}
      {visibleLoad.status === "ready" && history.length === 0 && (
        <DataLoadingState
          tone="empty"
          text="Nenhum documento emitido para este paciente."
          compact
        />
      )}
      {visibleLoad.status === "ready" && history.length > 0 && (
        <>
          <HistoryTableWrap>
            <HistoryTable>
              <thead>
                <tr>
                  <th>Tipo</th>
                  <th>Atendimento</th>
                  <th>Data de emissão</th>
                  <th>Emitido por</th>
                  {canDownload && <th>Ação</th>}
                </tr>
              </thead>
              <tbody>
                {history.map((document) => (
                  <tr key={document.id}>
                    <td><strong>{documentTypeLabel(document.document_type)}</strong></td>
                    <td>{documentSessionLabel(document)}</td>
                    <td>{formatDateTime(document.issued_at)}</td>
                    <td>{issuerLabel(document)}</td>
                    {canDownload && (
                      <td>
                        <RowActionButton
                          type="button"
                          disabled={Boolean(downloadingId)}
                          onClick={() => handleDownload(document)}
                        >
                          <FaDownload aria-hidden="true" />
                          {downloadingId === document.id ? "Baixando..." : "Baixar novamente"}
                        </RowActionButton>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </HistoryTable>
          </HistoryTableWrap>
          <HistoryCards>
            {history.map((document) => (
              <HistoryCard key={document.id}>
                <strong>{documentTypeLabel(document.document_type)}</strong>
                <dl>
                  <div><dt>Atendimento</dt><dd>{documentSessionLabel(document)}</dd></div>
                  <div><dt>Emissão</dt><dd>{formatDateTime(document.issued_at)}</dd></div>
                  <div><dt>Emitido por</dt><dd>{issuerLabel(document)}</dd></div>
                </dl>
                {canDownload && (
                  <RowActionButton
                    type="button"
                    disabled={Boolean(downloadingId)}
                    onClick={() => handleDownload(document)}
                  >
                    <FaDownload aria-hidden="true" />
                    {downloadingId === document.id ? "Baixando..." : "Baixar novamente"}
                  </RowActionButton>
                )}
              </HistoryCard>
            ))}
          </HistoryCards>
        </>
      )}

      {issueOpen && (
        <DocumentIssueModal
          patientId={patientId}
          patientName={patientName}
          onClose={closeIssueModal}
          onIssued={loadHistory}
        />
      )}
    </DocumentsArea>
  );
}

PatientDocumentsSection.propTypes = {
  patientId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  patientName: PropTypes.string.isRequired,
};

const DocumentsArea = styled.div`
  display: grid;
  gap: ${spacing.lg};
  min-width: 0;
`;

const SectionHeader = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: ${spacing.lg};
  padding: 18px;
  border: 1px solid ${alpha.brand014};
  border-radius: ${radii.xl};
  background: ${colors.surface};

  h2 {
    display: flex;
    align-items: center;
    gap: ${spacing.sm};
    margin: 0;
    color: ${colors.ink};
    font-size: 1.2rem;
  }

  p {
    margin: ${spacing.xs} 0 0;
    color: ${colors.textSecondary};
  }

  @media (max-width: 620px) {
    align-items: stretch;
    flex-direction: column;
  }
`;

const StatePanel = styled.div`
  display: grid;
  justify-items: center;
  gap: ${spacing.md};
`;

const PermissionNotice = styled.div`
  padding: ${spacing.xl};
  border: 1px solid ${alpha.brand014};
  border-radius: ${radii.lg};
  background: ${colors.surface};
  color: ${colors.textSecondary};
  text-align: center;
`;

const HistoryTableWrap = styled.div`
  overflow: hidden;
  border: 1px solid ${alpha.brand014};
  border-radius: ${radii.lg};
  background: ${colors.surface};

  @media (max-width: 760px) {
    display: none;
  }
`;

const HistoryTable = styled.table`
  width: 100%;
  border-collapse: collapse;
  font-size: 0.88rem;

  th,
  td {
    padding: 12px 14px;
    border-bottom: 1px solid ${alpha.brand010};
    text-align: left;
    vertical-align: middle;
  }

  th {
    background: ${colors.tableHeaderBackground};
    color: ${colors.brand};
    font-size: 0.76rem;
    text-transform: uppercase;
  }

  tr:last-child td {
    border-bottom: 0;
  }
`;

const HistoryCards = styled.div`
  display: none;

  @media (max-width: 760px) {
    display: grid;
    gap: ${spacing.md};
  }
`;

const HistoryCard = styled.article`
  display: grid;
  gap: ${spacing.md};
  padding: ${spacing.lg};
  border: 1px solid ${alpha.brand014};
  border-radius: ${radii.lg};
  background: ${colors.surface};

  dl {
    display: grid;
    gap: ${spacing.sm};
    margin: 0;
  }

  dl div {
    display: grid;
    grid-template-columns: 92px minmax(0, 1fr);
    gap: ${spacing.sm};
  }

  dt {
    color: ${colors.textMuted};
    font-size: 0.78rem;
    font-weight: 700;
  }

  dd {
    margin: 0;
    color: ${colors.textPrimary};
  }
`;

const ModalOverlay = styled.div`
  position: fixed;
  inset: 0;
  z-index: 1200;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  background: rgba(27, 27, 27, 0.42);
`;

const ModalCard = styled.div`
  width: min(860px, 100%);
  max-height: calc(100vh - 40px);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid ${alpha.brand014};
  border-radius: ${radii.xl};
  background: ${colors.surface};
  box-shadow: 0 24px 70px rgba(0, 0, 0, 0.22);
`;

const ModalHeader = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: ${spacing.lg};
  padding: 18px;
  border-bottom: 1px solid ${alpha.brand012};
`;

const ModalTitle = styled.h2`
  margin: 0;
  color: ${colors.ink};
  font-size: 1.25rem;
`;

const ModalSubtitle = styled.p`
  margin: ${spacing.xs} 0 0;
  color: ${colors.textSecondary};
`;

const CloseButton = styled.button`
  width: 36px;
  height: 36px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid ${alpha.brand022};
  border-radius: ${radii.md};
  background: ${colors.surface};
  color: ${colors.brandDark};
  cursor: pointer;

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const ModalBody = styled.div`
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 18px;
`;

const ModalFooter = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: ${spacing.sm};
  padding: 14px 18px 18px;
  border-top: 1px solid ${alpha.brand012};

  @media (max-width: 560px) {
    align-items: stretch;
    flex-direction: column-reverse;
  }
`;

const FlowFields = styled.div`
  display: grid;
  gap: ${spacing.lg};
`;

const FlowField = styled.label`
  display: grid;
  gap: 5px;
  color: ${colors.textPrimary};
  font-size: 0.88rem;
  font-weight: 700;

  select,
  textarea {
    width: 100%;
    padding: 9px 11px;
    border: 1px solid ${alpha.brand022};
    border-radius: ${radii.sm};
    background: ${colors.surface};
    color: ${colors.textPrimary};
    font: inherit;
    font-weight: 400;
  }

  textarea {
    resize: vertical;
    line-height: 1.5;
  }

  small {
    color: ${colors.textSecondary};
    font-weight: 400;
  }
`;

const InlineEmpty = styled.div`
  padding: ${spacing.md};
  border-radius: ${radii.md};
  background: ${colors.surfaceSecondary};
  color: ${colors.textSecondary};
`;

const PreviewAction = styled.div`
  display: flex;
  justify-content: flex-end;
`;

const PreviewPanel = styled.section`
  display: grid;
  gap: ${spacing.lg};
  padding: ${spacing.lg};
  border: 1px solid ${alpha.brand022};
  border-radius: ${radii.lg};
  background: ${colors.surfaceSecondary};
`;

const PreviewHeading = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: ${spacing.md};

  div {
    display: grid;
    gap: ${spacing.xs};
  }

  span {
    color: ${colors.textSecondary};
    font-size: 0.82rem;
  }
`;

const PreviewIdentity = styled.div`
  display: grid;
  gap: ${spacing.xs};
  color: ${colors.textSecondary};
  font-size: 0.88rem;
`;

const OperationError = styled.div`
  padding: ${spacing.md};
  border: 1px solid ${colors.dangerBorder};
  border-radius: ${radii.md};
  background: ${colors.dangerBackgroundHover};
  color: ${colors.dangerText};
  font-weight: 600;
`;
