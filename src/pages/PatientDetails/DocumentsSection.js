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
import { useClinicContext } from "../../contexts/ClinicContext";
import { GhostButton, PrimaryButton, RowActionButton } from "../../components/AppButton";
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
const eligibleDateFormatter = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
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
  return `${eligibleDateFormatter.format(startsAt)} · ${timeFormatter.format(startsAt)}–${timeFormatter.format(endsAt)}`;
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
  const { logoSrc: clinicLogoSrc } = useClinicContext();
  const [resources, setResources] = useState({ status: "loading", error: "" });
  const [recentSessions, setRecentSessions] = useState([]);
  const [dateSearchOpen, setDateSearchOpen] = useState(false);
  const [searchDate, setSearchDate] = useState("");
  const [dateSessions, setDateSessions] = useState([]);
  const [dateSearch, setDateSearch] = useState({ status: "idle", error: "" });
  const [templates, setTemplates] = useState([]);
  const [sessionId, setSessionId] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [preview, setPreview] = useState(null);
  const [previewSelectionKey, setPreviewSelectionKey] = useState("");
  const [finalText, setFinalText] = useState("");
  const [previewing, setPreviewing] = useState(false);
  const [issuing, setIssuing] = useState(false);
  const [operationError, setOperationError] = useState("");
  const [idempotencyKey, setIdempotencyKey] = useState(null);
  const templateSelectRef = useRef(null);
  const previewRequestIdRef = useRef(0);

  const invalidatePreview = useCallback(() => {
    previewRequestIdRef.current += 1;
    setPreview(null);
    setPreviewSelectionKey("");
    setFinalText("");
    setPreviewing(false);
    setOperationError("");
    setIdempotencyKey(null);
  }, []);

  useEffect(() => {
    let active = true;
    setResources({ status: "loading", error: "" });
    setRecentSessions([]);
    setDateSearchOpen(false);
    setSearchDate("");
    setDateSessions([]);
    setDateSearch({ status: "idle", error: "" });
    setTemplates([]);
    setSessionId("");
    setTemplateId("");
    invalidatePreview();
    Promise.all([
      listEligibleDocumentSessions(patientId, { limit: 5 }),
      listIssuanceDocumentTemplates(),
    ])
      .then(([sessionData, templateData]) => {
        if (!active) return;
        const availableSessions = Array.isArray(sessionData) ? sessionData : [];
        const availableTemplates = Array.isArray(templateData)
          ? templateData.filter((template) => template.is_active !== false)
          : [];
        setRecentSessions(availableSessions.slice(0, 5));
        setTemplates(availableTemplates);
        setSessionId("");
        setTemplateId("");
        setResources({ status: "ready", error: "" });
        window.setTimeout(() => templateSelectRef.current?.focus(), 0);
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
  }, [invalidatePreview, patientId]);

  useEffect(() => {
    if (!dateSearchOpen || !searchDate) return undefined;

    let active = true;
    setDateSessions([]);
    setDateSearch({ status: "loading", error: "" });
    listEligibleDocumentSessions(patientId, { date: searchDate })
      .then((sessionData) => {
        if (!active) return;
        const availableSessions = Array.isArray(sessionData) ? sessionData : [];
        setDateSessions(availableSessions.filter(
          (session) => String(session.status || "").toLowerCase() === "done",
        ));
        setDateSearch({ status: "ready", error: "" });
      })
      .catch(async (error) => {
        const message = await getDocumentErrorMessage(
          error,
          "Não foi possível buscar os atendimentos desta data.",
        );
        if (!active) return;
        setDateSearch({ status: "error", error: message });
      });

    return () => { active = false; };
  }, [dateSearchOpen, patientId, searchDate]);

  useEffect(() => {
    if (!sessionId || !templateId) return undefined;

    const requestId = previewRequestIdRef.current + 1;
    const selectionKey = `${templateId}:${sessionId}`;
    previewRequestIdRef.current = requestId;
    setPreviewing(true);
    setOperationError("");

    const loadPreview = async () => {
      try {
        const data = await previewAttendanceDeclaration({
          session_id: Number(sessionId),
          template_id: Number(templateId),
        });
        if (previewRequestIdRef.current !== requestId) return;
        setPreview(data);
        setPreviewSelectionKey(selectionKey);
        setFinalText(data?.final_text || "");
        setIdempotencyKey(null);
      } catch (error) {
        const message = await getDocumentErrorMessage(
          error,
          "Não foi possível gerar o preview do documento.",
        );
        if (previewRequestIdRef.current !== requestId) return;
        setOperationError(message);
      } finally {
        if (previewRequestIdRef.current === requestId) setPreviewing(false);
      }
    };

    loadPreview();

    return () => {
      if (previewRequestIdRef.current === requestId) {
        previewRequestIdRef.current += 1;
      }
    };
  }, [sessionId, templateId]);

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

  const handleSessionChange = (event) => {
    if (event.target.value === sessionId) return;
    setSessionId(event.target.value);
    invalidatePreview();
  };

  const currentSelectionKey = sessionId && templateId ? `${templateId}:${sessionId}` : "";
  const hasValidPreview = Boolean(
    preview && previewSelectionKey && previewSelectionKey === currentSelectionKey,
  );

  const handleIssue = async () => {
    if (!hasValidPreview || !finalText.trim() || issuing) return;
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
            <PatientName>{patientName}</PatientName>
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
                <span>Modelo</span>
                <select
                  ref={templateSelectRef}
                  value={templateId}
                  onChange={(event) => {
                    setTemplateId(event.target.value);
                    invalidatePreview();
                  }}
                  disabled={templates.length === 0 || issuing}
                >
                  <option value="" disabled hidden>
                    {templates.length > 0
                      ? "Selecione um modelo"
                      : "Nenhum modelo ativo disponível"}
                  </option>
                  {templates.map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.name}
                    </option>
                  ))}
                </select>
              </FlowField>

              <AttendanceGroup
                role="group"
                aria-labelledby="recent-document-sessions-title"
              >
                <RecentSessionsBlock>
                  <RecentSessionsHeading id="recent-document-sessions-title">
                    Atendimentos mais recentes
                  </RecentSessionsHeading>
                  {recentSessions.length === 0 && (
                    <InlineEmpty>Nenhum atendimento concluído recente está disponível.</InlineEmpty>
                  )}
                  {recentSessions.length > 0 && (
                    <SessionOptions>
                      {recentSessions.map((session) => (
                        <SessionOption key={`recent-${session.id}`} $selected={sessionId === String(session.id)}>
                          <input
                            type="radio"
                            name="eligible-session"
                            value={session.id}
                            checked={sessionId === String(session.id)}
                            onChange={handleSessionChange}
                            disabled={issuing}
                          />
                          <SessionCopy>
                            <SessionDetail>{formatEligibleSession(session)}</SessionDetail>
                            {session.professional?.name && (
                              <SessionProfessional>
                                <SessionDetail>{session.professional.name}</SessionDetail>
                              </SessionProfessional>
                            )}
                          </SessionCopy>
                        </SessionOption>
                      ))}
                    </SessionOptions>
                  )}
                </RecentSessionsBlock>

                <SearchSection>
                  <GhostButton
                    type="button"
                    aria-expanded={dateSearchOpen}
                    aria-controls="document-session-date-search"
                    onClick={() => setDateSearchOpen((open) => !open)}
                    disabled={issuing}
                  >
                    {dateSearchOpen ? "Ocultar busca por data" : "Buscar outro atendimento"}
                  </GhostButton>

                  {dateSearchOpen && (
                    <DateSearch id="document-session-date-search">
                      <FlowField>
                        <span>Data</span>
                        <input
                          type="date"
                          value={searchDate}
                          onChange={(event) => {
                            const selectedIsRecent = recentSessions.some(
                              (session) => String(session.id) === sessionId,
                            );
                            if (sessionId && !selectedIsRecent) {
                              setSessionId("");
                              invalidatePreview();
                            }
                            setDateSessions([]);
                            setDateSearch({ status: "idle", error: "" });
                            setOperationError("");
                            setSearchDate(event.target.value);
                          }}
                          disabled={issuing}
                        />
                      </FlowField>

                      {dateSearch.status === "loading" && (
                        <SearchStatus role="status">Buscando atendimentos...</SearchStatus>
                      )}
                      {dateSearch.status === "error" && (
                        <OperationError role="alert">{dateSearch.error}</OperationError>
                      )}
                      {dateSearch.status === "ready" && dateSessions.length === 0 && (
                        <InlineEmpty>Nenhum atendimento realizado nesta data.</InlineEmpty>
                      )}
                      {dateSearch.status === "ready" && dateSessions.length > 0 && (
                        <SessionOptions>
                          {dateSessions.map((session) => (
                            <SessionOption key={`date-${session.id}`} $selected={sessionId === String(session.id)}>
                              <input
                                type="radio"
                                name="eligible-session"
                                value={session.id}
                                checked={sessionId === String(session.id)}
                                onChange={handleSessionChange}
                                disabled={issuing}
                              />
                              <SessionCopy>
                                <SessionDetail>{formatEligibleSession(session)}</SessionDetail>
                                {session.professional?.name && (
                                  <SessionProfessional>
                                    <SessionDetail>{session.professional.name}</SessionDetail>
                                  </SessionProfessional>
                                )}
                              </SessionCopy>
                            </SessionOption>
                          ))}
                        </SessionOptions>
                      )}
                    </DateSearch>
                  )}
                </SearchSection>
              </AttendanceGroup>

              {templates.length === 0 && (
                <InlineEmpty>Nenhum modelo ativo está disponível para emissão.</InlineEmpty>
              )}

              {previewing && <SearchStatus role="status">Gerando preview...</SearchStatus>}

              {hasValidPreview && (
                <PreviewPanel>
                  <PreviewDocumentCanvas>
                    <PreviewDocumentSheet aria-label="Prévia visual da declaração">
                      <PreviewDocumentHeader>
                        {(preview.clinic?.logo_url || clinicLogoSrc) && (
                          <PreviewDocumentLogo
                            src={preview.clinic?.logo_url || clinicLogoSrc}
                            alt={`Logo ${preview.clinic?.display_name || "da clínica"}`}
                          />
                        )}
                        <PreviewClinicName>
                          {preview.clinic?.display_name || "Clínica"}
                        </PreviewClinicName>
                        <PreviewDocumentTitle>
                          {preview.template?.document_title || ""}
                        </PreviewDocumentTitle>
                      </PreviewDocumentHeader>
                      <PreviewTextEditor>
                        <PreviewTextArea
                          aria-label="Texto deste documento"
                          value={finalText}
                          maxLength={10000}
                          onChange={(event) => {
                            setFinalText(event.target.value);
                            setIdempotencyKey(null);
                            setOperationError("");
                          }}
                          disabled={issuing}
                        />
                      </PreviewTextEditor>
                    </PreviewDocumentSheet>
                  </PreviewDocumentCanvas>
                  <PreviewEditHint>
                    Esta alteração vale somente para este documento e não modifica o modelo salvo.
                  </PreviewEditHint>
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
            disabled={!hasValidPreview || !finalText.trim() || issuing}
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

  @media (max-width: 560px) {
    padding: ${spacing.sm};
  }
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

  @media (max-width: 560px) {
    max-height: calc(100dvh - 16px);
  }
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

const PatientName = styled.strong`
  display: block;
  margin: ${spacing.xs} 0 0;
  color: ${colors.textPrimary};
  font-size: 1.08rem;
  font-weight: 800;
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
  min-width: 0;
  display: grid;
  gap: ${spacing.lg};
`;

const FlowField = styled.label`
  width: 100%;
  min-width: 0;
  display: grid;
  gap: 5px;
  color: ${colors.textPrimary};
  font-size: 0.88rem;
  font-weight: 700;

  select,
  input,
  textarea {
    box-sizing: border-box;
    width: 100%;
    min-width: 0;
    max-width: 100%;
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

const AttendanceGroup = styled.div`
  width: 100%;
  min-width: 0;
  display: grid;
  gap: ${spacing.md};
`;

const RecentSessionsBlock = styled.div`
  min-width: 0;
  display: grid;
  gap: ${spacing.sm};
`;

const RecentSessionsHeading = styled.h3`
  margin: 0;
  color: ${colors.textPrimary};
  font-size: 0.95rem;
`;

const SessionOptions = styled.div`
  max-height: 280px;
  display: grid;
  gap: ${spacing.sm};
  overflow-y: auto;
  padding: 2px;
`;

const SessionOption = styled.label`
  min-width: 0;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  gap: ${spacing.md};
  padding: 11px 12px;
  border: 1px solid ${({ $selected }) => ($selected ? colors.brand : alpha.brand022)};
  border-radius: ${radii.md};
  background: ${({ $selected }) => ($selected ? alpha.brand010 : colors.surface)};
  color: ${colors.textPrimary};
  cursor: pointer;

  &:focus-within {
    outline: 2px solid ${colors.focus};
    outline-offset: 2px;
  }

  input {
    width: 18px;
    height: 18px;
    margin: 0;
    accent-color: ${colors.brand};
  }
`;

const SessionDetail = styled.span`
  color: ${colors.textPrimary};
  font-size: 0.92rem;
  font-weight: 600;
`;

const SessionProfessional = styled.span`
  margin-left: auto;
  text-align: right;
`;

const SessionCopy = styled.span`
  min-width: 0;
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: ${spacing.md};

  @media (max-width: 560px) {
    align-items: flex-start;
    flex-direction: column;
    gap: 2px;

    ${SessionProfessional} {
      margin-left: 0;
      text-align: left;
    }
  }
`;

const SearchSection = styled.div`
  box-sizing: border-box;
  width: 100%;
  min-width: 0;
  display: grid;
  justify-items: start;
  gap: ${spacing.md};
  padding-top: ${spacing.md};
  border-top: 1px solid ${alpha.brand012};
`;

const DateSearch = styled.div`
  box-sizing: border-box;
  width: 100%;
  min-width: 0;
  display: grid;
  gap: ${spacing.md};
`;

const SearchStatus = styled.div`
  padding: ${spacing.md};
  border-radius: ${radii.md};
  background: ${colors.surfaceSecondary};
  color: ${colors.textSecondary};
`;

const InlineEmpty = styled.div`
  padding: ${spacing.md};
  border-radius: ${radii.md};
  background: ${colors.surfaceSecondary};
  color: ${colors.textSecondary};
`;

const PreviewPanel = styled.section`
  display: grid;
  gap: ${spacing.lg};
  padding: ${spacing.lg};
  border: 1px solid ${alpha.brand022};
  border-radius: ${radii.lg};
  background: ${colors.surfaceSecondary};
`;

const PreviewDocumentCanvas = styled.div`
  min-width: 0;
  padding: ${spacing.xl};
  border-radius: ${radii.lg};
  background: ${colors.surfaceSecondary};

  @media (max-width: 560px) {
    padding: ${spacing.sm};
  }
`;

const PreviewDocumentSheet = styled.section`
  box-sizing: border-box;
  width: 100%;
  max-width: 640px;
  min-width: 0;
  min-height: 560px;
  margin: 0 auto;
  padding: 48px 54px;
  overflow: hidden;
  border: 1px solid rgba(27, 27, 27, 0.12);
  background: ${colors.white};
  box-shadow: 0 10px 28px rgba(27, 27, 27, 0.1);
  color: ${colors.ink};
  font-family: Arial, Helvetica, sans-serif;

  @media (max-width: 560px) {
    min-height: 460px;
    padding: 30px 20px;
    box-shadow: 0 4px 14px rgba(27, 27, 27, 0.08);
  }
`;

const PreviewDocumentHeader = styled.header`
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 40px;
  text-align: center;

  @media (max-width: 560px) {
    margin-bottom: 28px;
  }
`;

const PreviewDocumentLogo = styled.img`
  display: block;
  width: auto;
  max-width: min(180px, 70%);
  height: 64px;
  margin-bottom: ${spacing.md};
  object-fit: contain;
`;

const PreviewClinicName = styled.div`
  max-width: 100%;
  margin-bottom: 34px;
  overflow-wrap: anywhere;
  font-size: 1rem;
  font-weight: 700;

  @media (max-width: 560px) {
    margin-bottom: 26px;
    font-size: 0.92rem;
  }
`;

const PreviewDocumentTitle = styled.h3`
  margin: 0;
  font-size: 1.08rem;
  font-weight: 700;
  letter-spacing: 0.04em;

  @media (max-width: 560px) {
    font-size: 0.96rem;
    letter-spacing: 0.02em;
  }
`;

const PreviewTextEditor = styled.div`
  position: relative;
  min-width: 0;
  overflow: hidden;
  border: 1px solid ${alpha.brand014};
  border-radius: ${radii.xs};

  &:hover {
    border-color: ${alpha.brand028};
  }

  &:focus-within {
    border-color: ${colors.focus};
    box-shadow: 0 0 0 2px rgba(47, 111, 237, 0.12);
  }
`;

const PreviewTextArea = styled.textarea`
  position: relative;
  display: block;
  box-sizing: border-box;
  width: 100%;
  min-width: 0;
  min-height: 270px;
  padding: ${spacing.sm};
  resize: vertical;
  border: 0;
  border-radius: inherit;
  outline: none;
  background: transparent;
  color: ${colors.ink};
  font: inherit;
  font-size: 0.94rem;
  line-height: 1.75;
  text-align: justify;
  overflow-wrap: break-word;

  @media (max-width: 560px) {
    min-height: 240px;
    font-size: 0.9rem;
    line-height: 1.65;
  }
`;

const PreviewEditHint = styled.small`
  color: ${colors.textSecondary};
`;

const OperationError = styled.div`
  padding: ${spacing.md};
  border: 1px solid ${colors.dangerBorder};
  border-radius: ${radii.md};
  background: ${colors.dangerBackgroundHover};
  color: ${colors.dangerText};
  font-weight: 600;
`;
