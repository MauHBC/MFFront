import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import styled from "styled-components";
import { toast } from "react-toastify";
import { FaPlus, FaTimes } from "react-icons/fa";
import { PageContent, PageWrapper } from "../../components/AppLayout";
import {
  ModuleBody,
  ModuleHeader,
  ModuleTabButton,
  ModuleTabs,
  ModuleTitle,
} from "../../components/AppModuleShell";
import { AppToolbar, AppToolbarRight } from "../../components/AppToolbar";
import { DataTable, TableWrap, TD, TH } from "../../components/AppTable";
import { GhostButton, PrimaryButton, RowActionButton } from "../../components/AppButton";
import { StatusPill } from "../../components/AppStatus";
import {
  AppDrawer,
  DrawerBackdrop,
  DrawerBody,
  DrawerCloseBtn,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "../../components/AppDrawer";
import { Field } from "../../components/AppForm";
import AppActionMenu, { AppActionMenuItem } from "../../components/AppActionMenu";
import DataLoadingState from "../../components/DataLoadingState";
import { useClinicContext } from "../../contexts/ClinicContext";
import {
  activateDocumentTemplate,
  ATTENDANCE_DECLARATION,
  createDocumentTemplate,
  deactivateDocumentTemplate,
  duplicateDocumentTemplate,
  getDocumentErrorMessage,
  listDocumentTemplates,
  updateDocumentTemplate,
} from "../../services/documents";
import { alpha, colors, radii, spacing } from "../../styles/tokens";
import {
  AUTOMATIC_INFORMATION,
  getDocumentTemplateEditorSegments,
  toCanonicalDocumentTemplateText,
  toDocumentTemplateEditorText,
} from "./automaticInformation";

const EMPTY_FORM = Object.freeze({
  name: "",
  document_title: "",
  body_text: "",
});

const renderTemplateState = (template) => {
  if (template.archived_at) {
    return <StatusPill $tone="canceled">Arquivado</StatusPill>;
  }
  if (template.is_active) {
    return <StatusPill $tone="active">Ativo</StatusPill>;
  }
  return <StatusPill $tone="paused">Inativo</StatusPill>;
};

export default function SettingsDocuments() {
  const { displayName: clinicDisplayName, logoSrc: clinicLogoSrc } = useClinicContext();
  const [load, setLoad] = useState({ status: "loading", error: "" });
  const [templates, setTemplates] = useState([]);
  const [drawer, setDrawer] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [actingId, setActingId] = useState(null);
  const nameInputRef = useRef(null);
  const documentTitleInputRef = useRef(null);
  const bodyTextRef = useRef(null);
  const bodyTextHighlightsRef = useRef(null);
  const pendingBodySelectionRef = useRef(null);

  const loadTemplates = useCallback(async (silent = false) => {
    if (!silent) setLoad({ status: "loading", error: "" });
    try {
      const data = await listDocumentTemplates({ includeArchived: true });
      setTemplates(Array.isArray(data) ? data : []);
      setLoad({ status: "ready", error: "" });
    } catch (error) {
      const message = await getDocumentErrorMessage(
        error,
        "Não foi possível carregar os modelos de documentos.",
      );
      setLoad({ status: "error", error: message });
    }
  }, []);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  useLayoutEffect(() => {
    const selection = pendingBodySelectionRef.current;
    if (selection === null || !bodyTextRef.current) return;
    bodyTextRef.current.focus();
    bodyTextRef.current.setSelectionRange(selection, selection);
    pendingBodySelectionRef.current = null;
  }, [form.body_text]);

  useEffect(() => {
    if (!drawer) return undefined;
    nameInputRef.current?.focus();
    const handleEscape = (event) => {
      if (event.key === "Escape" && !saving) setDrawer(null);
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [drawer, saving]);

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setDrawer({ mode: "create", template: null });
  };

  const openEdit = (template) => {
    setForm({
      name: template.name || "",
      document_title: template.document_title || "",
      body_text: toDocumentTemplateEditorText(template.body_text),
    });
    setDrawer({ mode: "edit", template });
  };

  const closeDrawer = () => {
    if (!saving) setDrawer(null);
  };

  const insertAutomaticInformation = (information) => {
    const textarea = bodyTextRef.current;
    const selectionStart = textarea?.selectionStart ?? form.body_text.length;
    const selectionEnd = textarea?.selectionEnd ?? selectionStart;
    const nextBodyText = `${form.body_text.slice(0, selectionStart)}`
      + `${information.editorText}${form.body_text.slice(selectionEnd)}`;

    pendingBodySelectionRef.current = selectionStart + information.editorText.length;
    setForm((current) => ({ ...current, body_text: nextBodyText }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!form.name.trim()) {
      toast.error("Informe o nome do modelo.");
      nameInputRef.current?.focus();
      return;
    }
    if (!form.document_title.trim()) {
      toast.error("Informe o título do documento.");
      documentTitleInputRef.current?.focus();
      return;
    }
    if (!form.body_text.trim()) {
      toast.error("Informe o texto do modelo.");
      return;
    }

    const canonicalBodyText = toCanonicalDocumentTemplateText(form.body_text);
    if (canonicalBodyText.length > 10000) {
      toast.error("O texto do modelo é muito longo. Reduza o conteúdo antes de salvar.");
      bodyTextRef.current?.focus();
      return;
    }
    setSaving(true);
    try {
      if (drawer.mode === "edit") {
        await updateDocumentTemplate(drawer.template.id, {
          name: form.name,
          document_title: form.document_title,
          body_text: canonicalBodyText,
        });
        toast.success("Modelo atualizado com sucesso.");
      } else {
        await createDocumentTemplate({
          document_type: ATTENDANCE_DECLARATION,
          name: form.name,
          document_title: form.document_title,
          body_text: canonicalBodyText,
        });
        toast.success("Modelo criado com sucesso.");
      }
      setDrawer(null);
      await loadTemplates(true);
    } catch (error) {
      toast.error(await getDocumentErrorMessage(error, "Não foi possível salvar o modelo."));
    } finally {
      setSaving(false);
    }
  };

  const runTemplateAction = async (template, action, successMessage, fallbackMessage) => {
    setActingId(template.id);
    try {
      await action();
      toast.success(successMessage);
      await loadTemplates(true);
    } catch (error) {
      toast.error(await getDocumentErrorMessage(error, fallbackMessage));
    } finally {
      setActingId(null);
    }
  };

  const handleDuplicate = (template) => runTemplateAction(
    template,
    () => duplicateDocumentTemplate(template.id),
    "Modelo duplicado com sucesso.",
    "Não foi possível duplicar o modelo.",
  );

  const handleActivate = (template) => runTemplateAction(
    template,
    () => activateDocumentTemplate(template.id),
    "Modelo ativado com sucesso.",
    "Não foi possível ativar o modelo.",
  );

  const handleDeactivate = (template) => runTemplateAction(
    template,
    () => deactivateDocumentTemplate(template.id),
    "Modelo desativado com sucesso.",
    "Não foi possível desativar o modelo.",
  );

  const renderActions = (template) => (
    <AppActionMenu label={`Ações do modelo ${template.name}`} compact>
      {!template.archived_at && (
        <AppActionMenuItem type="button" onClick={() => openEdit(template)}>
          Editar
        </AppActionMenuItem>
      )}
      <AppActionMenuItem
        type="button"
        disabled={actingId === template.id}
        onClick={() => handleDuplicate(template)}
      >
        Duplicar
      </AppActionMenuItem>
      {!template.archived_at && template.is_active === true && (
        <AppActionMenuItem
          type="button"
          disabled={actingId === template.id}
          onClick={() => handleDeactivate(template)}
        >
          Desativar
        </AppActionMenuItem>
      )}
      {!template.archived_at && template.is_active === false && (
        <AppActionMenuItem
          type="button"
          disabled={actingId === template.id}
          onClick={() => handleActivate(template)}
        >
          Ativar
        </AppActionMenuItem>
      )}
    </AppActionMenu>
  );

  return (
    <PageWrapper $paddingTop="0">
      <PageContent as="div">
        <ModuleHeader>
          <ModuleTitle>Configurações</ModuleTitle>
        </ModuleHeader>

        <ModuleTabs role="tablist" aria-label="Áreas de configurações">
          <ModuleTabButton type="button" role="tab" $active aria-selected="true">
            Documentos
          </ModuleTabButton>
        </ModuleTabs>

        <ModuleBody>
          <SectionHeading>
            <div>
              <h2>Modelos de documentos</h2>
            </div>
          </SectionHeading>

          <AppToolbar>
            <span />
            <AppToolbarRight>
              <PrimaryButton type="button" onClick={openCreate}>
                <FaPlus aria-hidden="true" /> Novo modelo
              </PrimaryButton>
            </AppToolbarRight>
          </AppToolbar>

          {load.status === "loading" && (
            <DataLoadingState text="Carregando modelos de documentos..." />
          )}
          {load.status === "error" && (
            <StatePanel>
              <DataLoadingState tone="error" text={load.error} compact />
              <GhostButton type="button" onClick={() => loadTemplates()}>
                Tentar novamente
              </GhostButton>
            </StatePanel>
          )}
          {load.status === "ready" && templates.length === 0 && (
            <DataLoadingState tone="empty" text="Nenhum modelo de documento encontrado." />
          )}
          {load.status === "ready" && templates.length > 0 && (
            <>
              <DesktopTableWrap>
                <DataTable>
                  <thead>
                    <tr>
                      <TH>Nome</TH>
                      <TH>Estado</TH>
                      <TH>Ações</TH>
                    </tr>
                  </thead>
                  <tbody>
                    {templates.map((template) => (
                      <tr key={template.id}>
                        <TD><strong>{template.name}</strong></TD>
                        <TD>{renderTemplateState(template)}</TD>
                        <TD>{renderActions(template)}</TD>
                      </tr>
                    ))}
                  </tbody>
                </DataTable>
              </DesktopTableWrap>
              <MobileList>
                {templates.map((template) => (
                  <TemplateCard key={template.id}>
                    <CardHeader>
                      <strong>{template.name}</strong>
                      {renderActions(template)}
                    </CardHeader>
                    <CardBadges>
                      {renderTemplateState(template)}
                    </CardBadges>
                  </TemplateCard>
                ))}
              </MobileList>
            </>
          )}
        </ModuleBody>
      </PageContent>

      {drawer && (
        <>
          <VisualEditorDrawer
            $open
            role="dialog"
            aria-modal="true"
            aria-labelledby="document-template-drawer-title"
          >
            <DrawerHeader>
              <DrawerTitle id="document-template-drawer-title">
                {drawer.mode === "edit" ? "Editar modelo" : "Novo modelo"}
              </DrawerTitle>
              <DrawerCloseBtn type="button" onClick={closeDrawer} aria-label="Fechar editor">
                <FaTimes aria-hidden="true" />
              </DrawerCloseBtn>
            </DrawerHeader>
            <DrawerBody>
              <form onSubmit={handleSubmit}>
                <CompactFields>
                  <Field>
                    Nome do modelo *
                    <input
                      ref={nameInputRef}
                      value={form.name}
                      maxLength={120}
                      onChange={(event) => setForm((current) => ({
                        ...current,
                        name: event.target.value,
                      }))}
                    />
                  </Field>
                  <Field>
                    Título do documento *
                    <input
                      ref={documentTitleInputRef}
                      value={form.document_title}
                      maxLength={160}
                      onChange={(event) => setForm((current) => ({
                        ...current,
                        document_title: event.target.value,
                      }))}
                    />
                  </Field>
                </CompactFields>
                <DocumentCanvas>
                  <DocumentSheet aria-label="Editor visual da declaração">
                    <DocumentHeader>
                      {clinicLogoSrc && (
                        <DocumentLogo
                          src={clinicLogoSrc}
                          alt={`Logo ${clinicDisplayName || "da clínica"}`}
                        />
                      )}
                      <DocumentClinicName>{clinicDisplayName || "Clínica"}</DocumentClinicName>
                      <DocumentTitle>{form.document_title}</DocumentTitle>
                    </DocumentHeader>
                    <DocumentBodyEditor>
                      <DocumentBodyHighlights ref={bodyTextHighlightsRef} aria-hidden="true">
                        {getDocumentTemplateEditorSegments(form.body_text).map((segment) => (
                          segment.isAutomaticInformation ? (
                            <AutomaticInformationHighlight
                              key={`${segment.start}-${segment.text}`}
                              data-automatic-information="true"
                            >
                              {segment.text}
                            </AutomaticInformationHighlight>
                          ) : (
                            <React.Fragment key={`${segment.start}-${segment.text}`}>
                              {segment.text}
                            </React.Fragment>
                          )
                        ))}
                      </DocumentBodyHighlights>
                      <DocumentBodyTextarea
                        ref={bodyTextRef}
                        aria-label="Texto do modelo"
                        value={form.body_text}
                        onChange={(event) => setForm((current) => ({
                          ...current,
                          body_text: event.target.value,
                        }))}
                        onScroll={(event) => {
                          if (bodyTextHighlightsRef.current) {
                            bodyTextHighlightsRef.current.scrollTop = event.currentTarget.scrollTop;
                            bodyTextHighlightsRef.current.scrollLeft = event.currentTarget.scrollLeft;
                          }
                        }}
                      />
                    </DocumentBodyEditor>
                  </DocumentSheet>
                </DocumentCanvas>
            <AutomaticInformationPanel>
              <strong>Informações automáticas</strong>
              <div>{AUTOMATIC_INFORMATION.map((information) => (
                <RowActionButton
                  key={information.canonical}
                  type="button"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => insertAutomaticInformation(information)}
                >
                  + {information.label}
                </RowActionButton>
              ))}</div>
            </AutomaticInformationPanel>
            <DrawerFooter>
              <GhostButton type="button" onClick={closeDrawer} disabled={saving}>
                Cancelar
              </GhostButton>
              <SaveButton type="submit" disabled={saving}>
                {saving ? "Salvando..." : "Salvar"}
              </SaveButton>
            </DrawerFooter>
              </form>
            </DrawerBody>
          </VisualEditorDrawer>
          <DrawerBackdrop onClick={closeDrawer} />
        </>
      )}
    </PageWrapper>
  );
}

// O editor documental precisa de mais largura que o drawer CRUD padrão para preservar a folha.
const VisualEditorDrawer = styled(AppDrawer)`
  width: min(760px, 96vw);
  max-width: 96vw;

  @media (max-width: 760px) {
    width: 100%;
    max-width: 100vw;
  }
`;

const CompactFields = styled.div`
  display: grid;
  gap: ${spacing.md};
  margin-bottom: ${spacing.lg};

  > label {
    min-width: 0;
    margin-bottom: 0;
  }
`;

const DocumentCanvas = styled.div`
  min-width: 0;
  overflow-x: hidden;
  padding: ${spacing.xl};
  border-radius: ${radii.lg};
  background: ${colors.surfaceSecondary};

  @media (max-width: 560px) {
    padding: ${spacing.sm};
  }
`;

const DocumentSheet = styled.section`
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

const DocumentHeader = styled.header`
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 40px;
  text-align: center;

  @media (max-width: 560px) {
    margin-bottom: 28px;
  }
`;

const DocumentLogo = styled.img`
  display: block;
  width: auto;
  max-width: min(180px, 70%);
  height: 64px;
  margin-bottom: ${spacing.md};
  object-fit: contain;
`;

const DocumentClinicName = styled.div`
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

const DocumentTitle = styled.h3`
  margin: 0;
  font-size: 1.08rem;
  font-weight: 700;
  letter-spacing: 0.04em;

  @media (max-width: 560px) {
    font-size: 0.96rem;
    letter-spacing: 0.02em;
  }
`;

const DocumentBodyEditor = styled.div`
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

const DocumentBodyHighlights = styled.div`
  position: absolute;
  inset: 0;
  z-index: 0;
  box-sizing: border-box;
  overflow: hidden;
  padding: ${spacing.sm};
  pointer-events: none;
  color: transparent;
  font: inherit;
  font-size: 0.94rem;
  line-height: 1.75;
  text-align: justify;
  white-space: pre-wrap;
  overflow-wrap: break-word;

  @media (max-width: 560px) {
    font-size: 0.9rem;
    line-height: 1.65;
  }
`;

const AutomaticInformationHighlight = styled.span`
  border-radius: 3px;
  background: ${alpha.brand014};
  box-shadow: inset 0 -1px 0 ${alpha.brand028};
  box-decoration-break: clone;
`;

const DocumentBodyTextarea = styled.textarea`
  position: relative;
  z-index: 1;
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

const SectionHeading = styled.div`
  display: flex;
  justify-content: space-between;
  gap: ${spacing.md};
  margin-bottom: ${spacing.lg};

  h2 {
    margin: 0;
    color: ${colors.ink};
    font-size: 1.25rem;
  }

`;

const DesktopTableWrap = styled(TableWrap)`
  overflow: visible;

  @media (max-width: 760px) {
    display: none;
  }
`;

const MobileList = styled.div`
  display: none;

  @media (max-width: 760px) {
    display: grid;
    gap: ${spacing.md};
  }
`;

const TemplateCard = styled.article`
  display: grid;
  gap: ${spacing.sm};
  padding: ${spacing.lg};
  border: 1px solid ${alpha.brand014};
  border-radius: ${radii.lg};
  background: ${colors.surface};
  color: ${colors.textSecondary};
`;

const CardHeader = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: ${spacing.md};
  color: ${colors.ink};
`;

const CardBadges = styled.div`
  display: flex;
  gap: ${spacing.sm};
  flex-wrap: wrap;
`;

const StatePanel = styled.div`
  display: grid;
  justify-items: center;
  gap: ${spacing.md};
`;

const AutomaticInformationPanel = styled.div`
  margin: ${spacing.md} 0;
  padding: ${spacing.md};
  border-radius: ${radii.md};
  background: ${colors.surfaceSecondary};
  color: ${colors.textSecondary};
  font-size: 0.82rem;

  div {
    display: flex;
    flex-wrap: wrap;
    gap: ${spacing.sm};
    margin-top: ${spacing.sm};
  }

`;

// Submit do drawer usa largura de conteúdo e padding próprio do formulário.
const SaveButton = styled(PrimaryButton)`
  padding: 9px 22px;
`;
