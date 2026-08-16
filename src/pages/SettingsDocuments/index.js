import React, { useCallback, useEffect, useRef, useState } from "react";
import styled from "styled-components";
import { toast } from "react-toastify";
import { FaPlus, FaTimes } from "react-icons/fa";
import { PageContent, PageWrapper } from "../../components/AppLayout";
import {
  ModuleBody,
  ModuleHeader,
  ModuleSubtitle,
  ModuleTabButton,
  ModuleTabs,
  ModuleTitle,
} from "../../components/AppModuleShell";
import { AppToolbar, AppToolbarRight } from "../../components/AppToolbar";
import { DataTable, TableWrap, TD, TH } from "../../components/AppTable";
import { GhostButton, PrimaryButton } from "../../components/AppButton";
import { NeutralPill, StatusPill } from "../../components/AppStatus";
import {
  AppDrawer,
  DrawerBackdrop,
  DrawerBody,
  DrawerCloseBtn,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "../../components/AppDrawer";
import { Field, FieldHint } from "../../components/AppForm";
import AppActionMenu, { AppActionMenuItem } from "../../components/AppActionMenu";
import DataLoadingState from "../../components/DataLoadingState";
import {
  archiveDocumentTemplate,
  ATTENDANCE_DECLARATION,
  createDocumentTemplate,
  duplicateDocumentTemplate,
  getDocumentErrorMessage,
  listDocumentTemplates,
  setDefaultDocumentTemplate,
  updateDocumentTemplate,
} from "../../services/documents";
import { alpha, colors, radii, spacing } from "../../styles/tokens";

const PLACEHOLDERS = [
  "{{patient_name}}",
  "{{clinic_name}}",
  "{{session_date}}",
  "{{start_time}}",
  "{{end_time}}",
];

const EMPTY_FORM = Object.freeze({ name: "", body_text: "", is_default: false });

const documentTypeLabel = (type) => (
  type === ATTENDANCE_DECLARATION ? "Declaração de comparecimento" : type
);

export default function SettingsDocuments() {
  const [load, setLoad] = useState({ status: "loading", error: "" });
  const [templates, setTemplates] = useState([]);
  const [drawer, setDrawer] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [archiveCandidate, setArchiveCandidate] = useState(null);
  const [saving, setSaving] = useState(false);
  const [actingId, setActingId] = useState(null);
  const nameInputRef = useRef(null);
  const archiveCancelRef = useRef(null);

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

  useEffect(() => {
    if (!drawer) return undefined;
    nameInputRef.current?.focus();
    const handleEscape = (event) => {
      if (event.key === "Escape" && !saving) setDrawer(null);
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [drawer, saving]);

  useEffect(() => {
    if (!archiveCandidate) return undefined;
    archiveCancelRef.current?.focus();
    const handleEscape = (event) => {
      if (event.key === "Escape" && !actingId) setArchiveCandidate(null);
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [actingId, archiveCandidate]);

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setDrawer({ mode: "create", template: null });
  };

  const openEdit = (template) => {
    setForm({
      name: template.name || "",
      body_text: template.body_text || "",
      is_default: template.is_default === true,
    });
    setDrawer({ mode: "edit", template });
  };

  const closeDrawer = () => {
    if (!saving) setDrawer(null);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!form.name.trim()) {
      toast.error("Informe o nome do modelo.");
      nameInputRef.current?.focus();
      return;
    }
    if (!form.body_text.trim()) {
      toast.error("Informe o texto do modelo.");
      return;
    }

    setSaving(true);
    try {
      if (drawer.mode === "edit") {
        await updateDocumentTemplate(drawer.template.id, {
          name: form.name,
          body_text: form.body_text,
        });
        toast.success("Modelo atualizado com sucesso.");
      } else {
        await createDocumentTemplate({
          document_type: ATTENDANCE_DECLARATION,
          name: form.name,
          body_text: form.body_text,
          is_default: form.is_default,
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

  const handleSetDefault = (template) => runTemplateAction(
    template,
    () => setDefaultDocumentTemplate(template.id),
    "Modelo definido como padrão.",
    "Não foi possível definir o modelo como padrão.",
  );

  const handleArchive = (template) => setArchiveCandidate(template);

  const confirmArchive = () => {
    const template = archiveCandidate;
    if (!template) return;
    setArchiveCandidate(null);
    runTemplateAction(
      template,
      () => archiveDocumentTemplate(template.id),
      "Modelo arquivado com sucesso.",
      "Não foi possível arquivar o modelo.",
    );
  };

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
      {!template.archived_at && !template.is_default && (
        <AppActionMenuItem
          type="button"
          disabled={actingId === template.id}
          onClick={() => handleSetDefault(template)}
        >
          Definir como padrão
        </AppActionMenuItem>
      )}
      {!template.archived_at && !template.is_default && (
        <AppActionMenuItem
          type="button"
          disabled={actingId === template.id}
          onClick={() => handleArchive(template)}
        >
          Arquivar
        </AppActionMenuItem>
      )}
    </AppActionMenu>
  );

  return (
    <PageWrapper $paddingTop="0">
      <PageContent as="div">
        <ModuleHeader>
          <ModuleTitle>Configurações</ModuleTitle>
          <ModuleSubtitle>Preferências administrativas da clínica.</ModuleSubtitle>
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
              <p>Gerencie os textos usados nas emissões da clínica.</p>
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
                      <TH>Tipo</TH>
                      <TH>Padrão</TH>
                      <TH>Estado</TH>
                      <TH>Ações</TH>
                    </tr>
                  </thead>
                  <tbody>
                    {templates.map((template) => (
                      <tr key={template.id}>
                        <TD><strong>{template.name}</strong></TD>
                        <TD>{documentTypeLabel(template.document_type)}</TD>
                        <TD>{template.is_default ? <NeutralPill>Padrão</NeutralPill> : "—"}</TD>
                        <TD>
                          <StatusPill $tone={template.archived_at ? "canceled" : "active"}>
                            {template.archived_at ? "Arquivado" : "Ativo"}
                          </StatusPill>
                        </TD>
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
                    <span>{documentTypeLabel(template.document_type)}</span>
                    <CardBadges>
                      {template.is_default && <NeutralPill>Padrão</NeutralPill>}
                      <StatusPill $tone={template.archived_at ? "canceled" : "active"}>
                        {template.archived_at ? "Arquivado" : "Ativo"}
                      </StatusPill>
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
          <AppDrawer
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
            <Field>
              Tipo
              <select value={ATTENDANCE_DECLARATION} disabled>
                <option value={ATTENDANCE_DECLARATION}>Declaração de comparecimento</option>
              </select>
            </Field>
            <Field>
              Nome *
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
              Texto do modelo *
              <textarea
                rows={10}
                value={form.body_text}
                maxLength={10000}
                onChange={(event) => setForm((current) => ({
                  ...current,
                  body_text: event.target.value,
                }))}
              />
              <FieldHint>Texto simples. Máximo de 10.000 caracteres.</FieldHint>
            </Field>
            <PlaceholderHelp>
              <strong>Placeholders disponíveis</strong>
              <div>{PLACEHOLDERS.map((placeholder) => (
                <code key={placeholder}>{placeholder}</code>
              ))}</div>
            </PlaceholderHelp>
            {drawer.mode === "create" && (
              <DefaultOption>
                <input
                  type="checkbox"
                  checked={form.is_default}
                  onChange={(event) => setForm((current) => ({
                    ...current,
                    is_default: event.target.checked,
                  }))}
                />
                Definir como padrão
              </DefaultOption>
            )}
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
          </AppDrawer>
          <DrawerBackdrop onClick={closeDrawer} />
        </>
      )}
      {archiveCandidate && (
        <ConfirmOverlay
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !actingId) {
              setArchiveCandidate(null);
            }
          }}
        >
          <ConfirmCard role="dialog" aria-modal="true" aria-labelledby="archive-template-title">
            <h2 id="archive-template-title">Arquivar modelo</h2>
            <p>
              Arquivar o modelo “{archiveCandidate.name}”? Ele deixará de aparecer em novas
              emissões.
            </p>
            <ConfirmActions>
              <GhostButton
                ref={archiveCancelRef}
                type="button"
                onClick={() => setArchiveCandidate(null)}
              >
                Cancelar
              </GhostButton>
              <PrimaryButton type="button" onClick={confirmArchive}>
                Arquivar modelo
              </PrimaryButton>
            </ConfirmActions>
          </ConfirmCard>
        </ConfirmOverlay>
      )}
    </PageWrapper>
  );
}

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

  p {
    margin: ${spacing.xs} 0 0;
    color: ${colors.textSecondary};
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

const PlaceholderHelp = styled.div`
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

  code {
    padding: 3px 6px;
    border-radius: ${radii.xs};
    background: ${colors.surface};
    color: ${colors.brandDark};
  }
`;

const DefaultOption = styled.label`
  display: flex;
  align-items: center;
  gap: ${spacing.sm};
  color: ${colors.textPrimary};
  font-weight: 600;
`;

const ConfirmOverlay = styled.div`
  position: fixed;
  inset: 0;
  z-index: 5000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 18px;
  background: rgba(0, 0, 0, 0.38);
`;

const ConfirmCard = styled.div`
  width: min(100%, 430px);
  overflow: hidden;
  border: 1px solid ${alpha.brand014};
  border-radius: ${radii.lg};
  background: ${colors.surface};
  box-shadow: 0 18px 45px rgba(0, 0, 0, 0.18);

  h2,
  p {
    margin: 0;
    padding: ${spacing.lg};
  }

  h2 {
    border-bottom: 1px solid ${alpha.brand012};
    color: ${colors.ink};
    font-size: 1rem;
  }

  p {
    color: ${colors.textPrimary};
    line-height: 1.5;
  }
`;

const ConfirmActions = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: ${spacing.sm};
  padding: 0 ${spacing.lg} ${spacing.lg};
`;

// Submit do drawer usa largura de conteúdo e padding próprio do formulário.
const SaveButton = styled(PrimaryButton)`
  padding: 9px 22px;
`;
