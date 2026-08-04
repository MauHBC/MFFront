import React, {
  useCallback, useEffect, useMemo, useRef, useState,
} from "react";
import PropTypes from "prop-types";
import styled from "styled-components";
import { FaEdit, FaPlus, FaTimes } from "react-icons/fa";
import { useAuthorization } from "../../contexts/AuthorizationContext";
import {
  activateTeamPerson,
  assignAuthorizationProfile,
  blockTeamAccount,
  createAuthorizationProfile,
  createTeamAccount,
  createTeamPerson,
  loadTeamReadModel,
  resetTeamAccountPassword,
  setTeamProfessionalState,
  unassignAuthorizationProfile,
  updateAuthorizationProfile,
  updateTeamPerson,
  unblockTeamAccount,
} from "../../services/team";
import { getUserFacingApiError } from "../../services/axios";
import { ModuleHeader, ModulePanel, ModuleSubtitle, ModuleTitle } from "../../components/AppModuleShell";
import DataLoadingState from "../../components/DataLoadingState";
import { StatusPill, NeutralPill } from "../../components/AppStatus";
import {
  AppDrawer,
  DrawerBackdrop,
  DrawerBody,
  DrawerCloseBtn,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  UnsavedChangesDialog,
} from "../../components/AppDrawer";
import { GhostButton, PrimaryButton, RowActionButton } from "../../components/AppButton";
import { colors, layout } from "../../styles/tokens";
import AccountAccessDrawer, { validateAccountAccessForm } from "./AccountAccessDrawer";
import ProfessionalInactivationDrawer from "./ProfessionalInactivationDrawer";
import TeamAuditHistory from "./TeamAuditHistory";

const MODULE_LABELS = {
  dashboard: "Painel",
  schedule: "Agenda",
  patients: "Pacientes",
  plans: "Planos",
  clinical_records: "Prontuário",
  finance: "Financeiro",
  team: "Equipe",
  settings: "Configurações",
};

const ACCESS_LABELS = { none: "Sem acesso", view: "Visualizar", manage: "Gerenciar" };
const SCOPE_LABELS = { own: "Somente próprios", clinic: "Toda a clínica" };
const POWER_LABELS = {
  "access_accounts.manage": "Gerenciar contas de acesso",
  "credentials.reset": "Redefinir credenciais",
  "access_profiles.assign": "Atribuir perfis",
  "access_profiles.manage": "Gerenciar perfis",
  "administrators.manage": "Gerenciar administradores",
  "security_history.view": "Consultar histórico de segurança",
};
const ACCOUNT_STATUS_LABELS = {
  active: "Acesso ativo",
  blocked: "Acesso bloqueado",
  invalid: "Vínculo inválido",
};

function PersonActionsMenu({ personName, children }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const closeOnOutsideClick = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    };
    const closeOnEscape = (event) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  return (
    <ActionsMenuRoot ref={rootRef}>
      <ActionsMenuTrigger
        type="button"
        aria-label={`Ações de ${personName}`}
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        Ações <span aria-hidden="true">•••</span>
      </ActionsMenuTrigger>
      {open && (
        <ActionsMenuPopover
          aria-label={`Opções de ${personName}`}
          onClickCapture={(event) => {
            if (event.target.closest("button:not(:disabled)")) setOpen(false);
          }}
        >
          {children}
        </ActionsMenuPopover>
      )}
    </ActionsMenuRoot>
  );
}

PersonActionsMenu.propTypes = {
  personName: PropTypes.string.isRequired,
  children: PropTypes.node.isRequired,
};

const EMPTY_PERSON_FORM = Object.freeze({
  name: "",
  email: "",
  phone: "",
  isProfessional: false,
});

export function validatePersonForm(values) {
  const errors = {};
  const name = values.name.trim();
  const email = values.email.trim();
  const phone = values.phone.trim();
  if (name.length < 2 || name.length > 255) {
    errors.name = "Informe um nome entre 2 e 255 caracteres.";
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.email = "Informe um e-mail válido.";
  }
  if (phone.length > 40) errors.phone = "O telefone deve ter no máximo 40 caracteres.";
  return errors;
}

const capabilityLabel = (key) => key.split(".").map((part) => ({
  view: "visualizar",
  manage: "gerenciar",
  configure: "configurar",
  settle: "liquidar",
  write: "registrar",
  read: "consultar",
  finalize: "finalizar",
  download: "baixar documentos",
  audit: "auditoria",
  bulk: "ações em lote",
  own: "próprios",
}[part] || MODULE_LABELS[part] || part.replaceAll("_", " "))).join(" · ");

export function buildTeamPresentation(model) {
  const accounts = model.accountState?.accounts || [];
  const accountById = new Map(accounts.map((account) => [account.user_id, account]));
  const profileById = new Map((model.profiles || []).map((profile) => [profile.id, profile]));
  const assignmentsByUser = new Map();
  const assignmentUsers = new Map((model.assignmentState?.users || [])
    .map((user) => [user.user_id, user]));
  (model.assignmentState?.assignments || []).forEach((assignment) => {
    const current = assignmentsByUser.get(assignment.user_id) || [];
    assignmentsByUser.set(assignment.user_id, [...current, assignment.profile_id]);
  });

  const people = (model.people || []).map((person) => {
    const account = person.account ? accountById.get(person.account.id) : null;
    const accountState = account || person.account;
    const profileIds = person.account ? assignmentsByUser.get(person.account.id) || [] : [];
    return {
      id: person.id,
      name: person.name,
      email: person.email || "",
      phone: person.phone || "",
      isActive: person.is_active === true,
      isProfessional: Boolean(person.professional),
      professionalId: person.professional ? Number(person.professional.id) : null,
      professionalActive: person.professional?.is_active === true,
      account: person.account ? {
        id: person.account.id,
        login: accountState?.login_identifier || person.account.email || null,
        isActive: person.account.is_active === true,
        status: person.account.status || accountState?.status
          || (person.account.is_active ? "active" : "blocked"),
        linkageType: person.account.linkage_type || accountState?.linkage_type || "legacy",
        hasCredential: person.account.has_credential ?? accountState?.has_credential ?? false,
      } : null,
      profiles: profileIds.map((id) => profileById.get(id)).filter(Boolean),
      effectivePermissions: person.account
        ? assignmentUsers.get(person.account.id)?.effective_permissions || null
        : null,
      isPerson: true,
    };
  });
  const unlinkedAccounts = accounts.filter(({ linked_person_id: personId }) => personId === null)
    .map((account) => ({
      id: `account-${account.user_id}`,
      name: account.name,
      isActive: account.is_active === true,
      isProfessional: false,
      professionalActive: false,
      isPerson: false,
      account: {
        id: account.user_id,
        login: account.login_identifier,
        isActive: account.is_active,
        status: account.status || (account.is_active ? "active" : "blocked"),
        linkageType: account.linkage_type || "legacy",
        hasCredential: account.has_credential === true,
      },
      profiles: (assignmentsByUser.get(account.user_id) || [])
        .map((id) => profileById.get(id)).filter(Boolean),
      effectivePermissions: assignmentUsers.get(account.user_id)?.effective_permissions || null,
    }));
  const assignmentCounts = (model.assignmentState?.assignments || []).reduce((counts, item) => ({
    ...counts,
    [item.profile_id]: (counts[item.profile_id] || 0) + 1,
  }), {});
  const profiles = (model.profiles || []).map((profile) => ({
    ...profile,
    assignmentCount: assignmentCounts[profile.id] || 0,
  }));
  return { people: [...people, ...unlinkedAccounts], profiles };
}

function AccessDenied() {
  return (
    <Page>
      <ModuleHeader>
        <ModuleTitle>Acesso não permitido</ModuleTitle>
        <ModuleSubtitle>Você não possui permissão para consultar a equipe desta clínica.</ModuleSubtitle>
      </ModuleHeader>
    </Page>
  );
}

function AuthorizationLoadError({ onRetry }) {
  return (
    <Page>
      <StatePanel>
        <DataLoadingState
          tone="error"
          text="Não foi possível carregar a área Equipe. Tente novamente."
          compact
        />
        <RetryButton type="button" onClick={onRetry}>Tentar novamente</RetryButton>
      </StatePanel>
    </Page>
  );
}

AuthorizationLoadError.propTypes = { onRetry: PropTypes.func.isRequired };

function PersonDrawer({ editor, onChange, onClose, onSubmit }) {
  const creating = editor.mode === "create";
  return (
    <>
      <DrawerBackdrop onClick={onClose} />
      <AppDrawer
        $open
        role="dialog"
        aria-modal="true"
        aria-labelledby="person-drawer-title"
      >
        <DrawerHeader>
          <DrawerTitle id="person-drawer-title">
            {creating ? "Nova pessoa" : "Editar pessoa"}
          </DrawerTitle>
          <DrawerCloseBtn type="button" aria-label="Fechar formulário" onClick={onClose}>
            <FaTimes />
          </DrawerCloseBtn>
        </DrawerHeader>
        <DrawerBody>
          <PersonForm onSubmit={onSubmit} noValidate>
            <FieldGroup>
              <FieldLabel htmlFor="team-person-name">Nome</FieldLabel>
              <FieldInput
                autoFocus
                id="team-person-name"
                value={editor.values.name}
                onChange={(event) => onChange("name", event.target.value)}
                aria-invalid={Boolean(editor.errors.name)}
                aria-describedby={editor.errors.name ? "team-person-name-error" : undefined}
                disabled={editor.submitting}
              />
              {editor.errors.name && <FieldError id="team-person-name-error">{editor.errors.name}</FieldError>}
            </FieldGroup>
            <FieldGroup>
              <FieldLabel htmlFor="team-person-email">E-mail</FieldLabel>
              <FieldInput
                id="team-person-email"
                type="email"
                value={editor.values.email}
                onChange={(event) => onChange("email", event.target.value)}
                aria-invalid={Boolean(editor.errors.email)}
                aria-describedby={editor.errors.email ? "team-person-email-error" : undefined}
                disabled={editor.submitting}
              />
              {editor.errors.email && <FieldError id="team-person-email-error">{editor.errors.email}</FieldError>}
            </FieldGroup>
            <FieldGroup>
              <FieldLabel htmlFor="team-person-phone">Telefone</FieldLabel>
              <FieldInput
                id="team-person-phone"
                value={editor.values.phone}
                onChange={(event) => onChange("phone", event.target.value)}
                aria-invalid={Boolean(editor.errors.phone)}
                aria-describedby={editor.errors.phone ? "team-person-phone-error" : undefined}
                disabled={editor.submitting}
              />
              {editor.errors.phone && <FieldError id="team-person-phone-error">{editor.errors.phone}</FieldError>}
            </FieldGroup>
            {creating && (
              <CheckboxLabel>
                <input
                  type="checkbox"
                  checked={editor.values.isProfessional}
                  onChange={(event) => onChange("isProfessional", event.target.checked)}
                  disabled={editor.submitting}
                />
                Registrar também como profissional, sem criar login
              </CheckboxLabel>
            )}
            <FormNotice>
              Esta operação não cria conta de acesso, senha, convite, perfil ou permissão.
            </FormNotice>
            {editor.apiError && <FormError role="alert">{editor.apiError}</FormError>}
            <DrawerFooter>
              <GhostButton type="button" onClick={onClose} disabled={editor.submitting}>
                Cancelar
              </GhostButton>
              <PrimaryButton type="submit" disabled={editor.submitting}>
                {editor.submitting ? "Salvando..." : "Salvar"}
              </PrimaryButton>
            </DrawerFooter>
          </PersonForm>
        </DrawerBody>
      </AppDrawer>
    </>
  );
}

PersonDrawer.propTypes = {
  editor: PropTypes.shape({
    mode: PropTypes.oneOf(["create", "edit"]).isRequired,
    values: PropTypes.shape({
      name: PropTypes.string,
      email: PropTypes.string,
      phone: PropTypes.string,
      isProfessional: PropTypes.bool,
    }).isRequired,
    errors: PropTypes.shape({
      name: PropTypes.string,
      email: PropTypes.string,
      phone: PropTypes.string,
    }).isRequired,
    apiError: PropTypes.string.isRequired,
    submitting: PropTypes.bool.isRequired,
  }).isRequired,
  onChange: PropTypes.func.isRequired,
  onClose: PropTypes.func.isRequired,
  onSubmit: PropTypes.func.isRequired,
};

const profileValues = (profile = null) => ({
  name: profile?.name || "",
  permissions: Object.fromEntries((profile?.permissions || []).map((item) => [
    item.moduleKey,
    { ...item },
  ])),
  capabilities: [...(profile?.capabilities || [])],
});

const profilePayload = (values) => ({
  name: values.name.trim(),
  permissions: Object.values(values.permissions).filter(
    ({ accessLevel }) => accessLevel && accessLevel !== "none",
  ),
  capabilities: [...values.capabilities],
});

function ProfileEditorDrawer({ editor: current, catalog, onChange, onClose, onSubmit }) {
  const accessRanks = new Map((catalog.access_levels || []).map(({ key, rank }) => [key, rank]));
  const capabilityEnabled = (rule) => {
    const permission = current.values.permissions[rule.module_key];
    return permission
      && (accessRanks.get(permission.accessLevel) || 0)
        >= (accessRanks.get(rule.minimum_access_level) || 0)
      && (rule.required_capabilities || []).every(
        (required) => current.values.capabilities.includes(required),
      );
  };
  return (
    <>
      <DrawerBackdrop onClick={onClose} />
      <AppDrawer $open role="dialog" aria-modal="true" aria-labelledby="profile-editor-title">
        <DrawerHeader>
          <DrawerTitle id="profile-editor-title">
            {current.mode === "create" ? "Novo perfil personalizado" : "Editar perfil personalizado"}
          </DrawerTitle>
          <DrawerCloseBtn type="button" aria-label="Fechar editor de perfil" onClick={onClose}><FaTimes /></DrawerCloseBtn>
        </DrawerHeader>
        <DrawerBody>
          <PersonForm onSubmit={onSubmit} noValidate>
            <FieldGroup>
              <FieldLabel htmlFor="profile-name">Nome do perfil</FieldLabel>
              <FieldInput
                autoFocus
                id="profile-name"
                value={current.values.name}
                onChange={(event) => onChange("name", event.target.value)}
                aria-invalid={Boolean(current.errors.name)}
                disabled={current.submitting}
              />
              {current.errors.name && <FieldError>{current.errors.name}</FieldError>}
            </FieldGroup>
            <DetailHeading>Módulos</DetailHeading>
            {(catalog.modules || []).map((module) => {
              const permission = current.values.permissions[module.module_key] || {
                moduleKey: module.module_key,
                accessLevel: "none",
                scopeLevel: null,
                canExport: false,
              };
              return (
                <PermissionEditorRow key={module.module_key}>
                  <strong>{MODULE_LABELS[module.module_key] || module.module_key}</strong>
                  <Select
                    aria-label={`Nível de ${MODULE_LABELS[module.module_key] || module.module_key}`}
                    value={permission.accessLevel}
                    disabled={current.submitting}
                    onChange={(event) => onChange("permission", {
                      module,
                      field: "accessLevel",
                      value: event.target.value,
                    })}
                  >
                    {(module.valid_access_levels || []).map((level) => (
                      <option key={level} value={level}>{ACCESS_LABELS[level] || level}</option>
                    ))}
                  </Select>
                  {permission.accessLevel !== "none" && (module.valid_scopes || []).length > 0 && (
                    <Select
                      aria-label={`Escopo de ${MODULE_LABELS[module.module_key] || module.module_key}`}
                      value={permission.scopeLevel || ""}
                      disabled={current.submitting}
                      onChange={(event) => onChange("permission", {
                        module, field: "scopeLevel", value: event.target.value || null,
                      })}
                    >
                      <option value="">Selecione o escopo</option>
                      {module.valid_scopes.map((scope) => (
                        <option key={scope} value={scope}>{SCOPE_LABELS[scope] || scope}</option>
                      ))}
                    </Select>
                  )}
                  {module.exportable && permission.accessLevel !== "none" && (
                    <CheckboxLabel>
                      <input
                        type="checkbox"
                        checked={permission.canExport === true}
                        disabled={current.submitting}
                        onChange={(event) => onChange("permission", {
                          module, field: "canExport", value: event.target.checked,
                        })}
                      />
                      Permitir exportação
                    </CheckboxLabel>
                  )}
                </PermissionEditorRow>
              );
            })}
            <DetailHeading>Capacidades adicionais</DetailHeading>
            <CapabilityGrid>
              {(catalog.distributable_capabilities || []).map((rule) => (
                <CheckboxLabel key={rule.capability_key}>
                  <input
                    type="checkbox"
                    checked={current.values.capabilities.includes(rule.capability_key)}
                    disabled={current.submitting || (!current.values.capabilities.includes(rule.capability_key) && !capabilityEnabled(rule))}
                    onChange={(event) => onChange("capability", {
                      key: rule.capability_key, checked: event.target.checked,
                    })}
                  />
                  {capabilityLabel(rule.capability_key)}
                </CheckboxLabel>
              ))}
            </CapabilityGrid>
            <FormNotice>Opções e dependências são fornecidas pelo catálogo oficial. Poderes exclusivos do Administrador não podem ser distribuídos.</FormNotice>
            {current.apiError && <FormError role="alert">{current.apiError}</FormError>}
            <DrawerFooter>
              <GhostButton type="button" onClick={onClose} disabled={current.submitting}>Cancelar</GhostButton>
              <PrimaryButton type="submit" disabled={current.submitting}>{current.submitting ? "Salvando..." : "Salvar perfil"}</PrimaryButton>
            </DrawerFooter>
          </PersonForm>
        </DrawerBody>
      </AppDrawer>
    </>
  );
}

ProfileEditorDrawer.propTypes = {
  editor: PropTypes.shape({
    mode: PropTypes.oneOf(["create", "edit"]),
    values: PropTypes.shape({
      name: PropTypes.string,
      permissions: PropTypes.objectOf(PropTypes.shape({})),
      capabilities: PropTypes.arrayOf(PropTypes.string),
    }),
    errors: PropTypes.shape({ name: PropTypes.string }),
    apiError: PropTypes.string,
    submitting: PropTypes.bool,
  }).isRequired,
  catalog: PropTypes.shape({
    access_levels: PropTypes.arrayOf(PropTypes.shape({})),
    modules: PropTypes.arrayOf(PropTypes.shape({})),
    distributable_capabilities: PropTypes.arrayOf(PropTypes.shape({})),
  }).isRequired,
  onChange: PropTypes.func.isRequired,
  onClose: PropTypes.func.isRequired,
  onSubmit: PropTypes.func.isRequired,
};

function AssignmentDrawer({ editor: current, profiles, onToggle, onClose, onSubmit }) {
  return (
    <>
      <DrawerBackdrop onClick={onClose} />
      <AppDrawer $open role="dialog" aria-modal="true" aria-labelledby="assignment-title">
        <DrawerHeader>
          <DrawerTitle id="assignment-title">Perfis de {current.person.name}</DrawerTitle>
          <DrawerCloseBtn type="button" aria-label="Fechar atribuições" onClick={onClose}><FaTimes /></DrawerCloseBtn>
        </DrawerHeader>
        <DrawerBody>
          <PersonForm onSubmit={onSubmit}>
            <FormNotice>A conta pode permanecer sem perfil e, nesse caso, não recebe permissões granulares.</FormNotice>
            <CapabilityGrid>
              {profiles.filter(({ is_active: active }) => active).map((profile) => (
                <CheckboxLabel key={profile.id}>
                  <input
                    type="checkbox"
                    checked={current.profileIds.includes(profile.id)}
                    onChange={(event) => onToggle(profile.id, event.target.checked)}
                    disabled={current.submitting}
                  />
                  {profile.name} {profile.native_type ? "(nativo)" : "(personalizado)"}
                </CheckboxLabel>
              ))}
            </CapabilityGrid>
            <DetailHeading>Permissões efetivas atuais</DetailHeading>
            <EffectiveDetails effective={current.person.effectivePermissions} />
            {current.apiError && <FormError role="alert">{current.apiError}</FormError>}
            <DrawerFooter>
              <GhostButton type="button" onClick={onClose} disabled={current.submitting}>Cancelar</GhostButton>
              <PrimaryButton type="submit" disabled={current.submitting}>{current.submitting ? "Salvando..." : "Salvar atribuições"}</PrimaryButton>
            </DrawerFooter>
          </PersonForm>
        </DrawerBody>
      </AppDrawer>
    </>
  );
}

AssignmentDrawer.propTypes = {
  editor: PropTypes.shape({
    person: PropTypes.shape({ name: PropTypes.string, effectivePermissions: PropTypes.shape({}) }),
    profileIds: PropTypes.arrayOf(PropTypes.number),
    apiError: PropTypes.string,
    submitting: PropTypes.bool,
  }).isRequired,
  profiles: PropTypes.arrayOf(PropTypes.shape({})).isRequired,
  onToggle: PropTypes.func.isRequired,
  onClose: PropTypes.func.isRequired,
  onSubmit: PropTypes.func.isRequired,
};

function EffectiveDetails({ effective }) {
  if (!effective || effective.authorization_state === "no_permissions") {
    return <FormNotice>Esta conta não possui permissões granulares efetivas.</FormNotice>;
  }
  if (effective.authorization_state === "invalid") {
    return <FormError role="alert">Estado de autorização inválido. Nenhum acesso deve ser concedido.</FormError>;
  }
  return (
    <Details>
      {effective.is_administrator && <FormNotice>Administrador: acesso estrutural completo.</FormNotice>}
      {(effective.modules || []).filter(({ access_level: level }) => level !== "none").map((module) => (
        <DetailRow key={module.module_key}>
          <strong>{MODULE_LABELS[module.module_key] || module.module_key}</strong>
          <span>{ACCESS_LABELS[module.access_level] || module.access_level}{module.scope_level ? ` · ${SCOPE_LABELS[module.scope_level]}` : ""}{module.can_export ? " · Pode exportar" : ""}</span>
        </DetailRow>
      ))}
    </Details>
  );
}

EffectiveDetails.propTypes = { effective: PropTypes.shape({
  authorization_state: PropTypes.string,
  is_administrator: PropTypes.bool,
  modules: PropTypes.arrayOf(PropTypes.shape({})),
}) };
EffectiveDetails.defaultProps = { effective: null };

export default function Equipe() {
  const authorization = useAuthorization();
  const [state, setState] = useState({ status: "idle", model: null, error: "" });
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [accessFilter, setAccessFilter] = useState("all");
  const [selectedProfileId, setSelectedProfileId] = useState(null);
  const [editor, setEditor] = useState(null);
  const [profileEditor, setProfileEditor] = useState(null);
  const [assignmentEditor, setAssignmentEditor] = useState(null);
  const [accountEditor, setAccountEditor] = useState(null);
  const [inactivationEditor, setInactivationEditor] = useState(null);
  const [confirmDiscard, setConfirmDiscard] = useState(null);
  const [activatingPersonId, setActivatingPersonId] = useState(null);
  const [activatingProfessionalId, setActivatingProfessionalId] = useState(null);
  const [actionError, setActionError] = useState("");

  const load = useCallback(async () => {
    if (!authorization.canViewTeam) return;
    setState({ status: "loading", model: null, error: "" });
    try {
      setState({ status: "ready", model: await loadTeamReadModel(), error: "" });
    } catch (error) {
      setState({
        status: "error",
        model: null,
        error: getUserFacingApiError(error, "Não foi possível carregar a equipe."),
      });
    }
  }, [authorization.canViewTeam]);

  useEffect(() => {
    load();
  }, [load]);

  const presentation = useMemo(
    () => (state.model ? buildTeamPresentation(state.model) : { people: [], profiles: [] }),
    [state.model],
  );
  const filteredPeople = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("pt-BR");
    return presentation.people.filter((person) => {
      const matchesText = !query || [person.name, person.account?.login]
        .filter(Boolean).some((value) => value.toLocaleLowerCase("pt-BR").includes(query));
      const matchesStatus = statusFilter === "all"
        || (statusFilter === "active" ? person.isActive : !person.isActive);
      const matchesAccess = accessFilter === "all"
        || (accessFilter === "with" ? Boolean(person.account) : !person.account);
      return matchesText && matchesStatus && matchesAccess;
    });
  }, [accessFilter, presentation.people, search, statusFilter]);
  const selectedProfile = presentation.profiles.find(({ id }) => id === selectedProfileId);
  const editorDirty = editor
    ? JSON.stringify(editor.values) !== JSON.stringify(editor.initialValues)
    : false;
  const profileEditorDirty = profileEditor
    ? JSON.stringify(profileEditor.values) !== JSON.stringify(profileEditor.initialValues)
    : false;
  const assignmentEditorDirty = assignmentEditor
    ? JSON.stringify([...assignmentEditor.profileIds].sort())
      !== JSON.stringify([...assignmentEditor.initialProfileIds].sort())
    : false;
  const accountEditorDirty = accountEditor
    ? JSON.stringify(accountEditor.values) !== JSON.stringify(accountEditor.initialValues)
    : false;

  const openCreate = () => setEditor({
    mode: "create",
    personId: null,
    values: { ...EMPTY_PERSON_FORM },
    initialValues: { ...EMPTY_PERSON_FORM },
    errors: {},
    apiError: "",
    submitting: false,
  });

  const openEdit = (person) => {
    const values = {
      name: person.name,
      email: person.email,
      phone: person.phone,
      isProfessional: person.isProfessional,
    };
    setEditor({
      mode: "edit",
      personId: person.id,
      values,
      initialValues: { ...values },
      errors: {},
      apiError: "",
      submitting: false,
    });
  };

  const requestEditorClose = () => {
    if (editor?.submitting) return;
    if (editorDirty) setConfirmDiscard("person");
    else setEditor(null);
  };

  useEffect(() => {
    if (!editor) return undefined;
    const handleKeyDown = (event) => {
      if (event.key !== "Escape" || editor.submitting) return;
      if (editorDirty) setConfirmDiscard("person");
      else setEditor(null);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [editor, editorDirty]);

  const changeEditorValue = (field, value) => setEditor((current) => ({
    ...current,
    values: { ...current.values, [field]: value },
    errors: { ...current.errors, [field]: undefined },
    apiError: "",
  }));

  const submitPerson = async (event) => {
    event.preventDefault();
    if (!editor || editor.submitting) return;
    const errors = validatePersonForm(editor.values);
    if (Object.keys(errors).length) {
      setEditor((current) => ({ ...current, errors }));
      return;
    }
    setEditor((current) => ({ ...current, submitting: true, apiError: "" }));
    const payload = {
      name: editor.values.name.trim(),
      email: editor.values.email.trim(),
      phone: editor.values.phone.trim(),
      isProfessional: editor.values.isProfessional,
    };
    try {
      if (editor.mode === "create") await createTeamPerson(payload);
      else await updateTeamPerson(editor.personId, payload);
      setEditor(null);
      await load();
    } catch (error) {
      const duplicate = error?.response?.data?.error === "TEAM_IDENTITY_ALREADY_EXISTS";
      setEditor((current) => ({
        ...current,
        submitting: false,
        apiError: duplicate
          ? "Já existe uma pessoa com este e-mail na clínica."
          : getUserFacingApiError(error, "Não foi possível salvar a pessoa."),
      }));
    }
  };

  const reactivatePerson = async (personId) => {
    if (activatingPersonId) return;
    setActionError("");
    setActivatingPersonId(personId);
    try {
      await activateTeamPerson(personId);
      await load();
    } catch (error) {
      setActionError(getUserFacingApiError(error, "Não foi possível reativar a pessoa."));
    } finally {
      setActivatingPersonId(null);
    }
  };

  const activateProfessional = async (personId) => {
    if (activatingProfessionalId) return;
    setActionError("");
    setActivatingProfessionalId(personId);
    try {
      await setTeamProfessionalState(personId, true);
      await load();
    } catch (error) {
      setActionError(getUserFacingApiError(
        error,
        "Não foi possível ativar a atuação profissional.",
      ));
    } finally {
      setActivatingProfessionalId(null);
    }
  };

  const openAccountAction = (mode, person) => {
    if (!person.isPerson || person.account?.linkageType === "invalid") return;
    const values = {
      email: mode === "create" ? person.email : "",
      password: "",
      passwordConfirmation: "",
      confirmed: false,
    };
    setAccountEditor({
      mode,
      person,
      values,
      initialValues: { ...values },
      errors: {},
      apiError: "",
      submitting: false,
    });
  };

  const changeAccountValue = (field, value) => setAccountEditor((current) => ({
    ...current,
    values: { ...current.values, [field]: value },
    errors: { ...current.errors, [field]: undefined },
    apiError: "",
  }));

  const requestAccountClose = () => {
    if (accountEditor?.submitting) return;
    if (accountEditorDirty) setConfirmDiscard("account");
    else setAccountEditor(null);
  };

  const submitAccount = async (event) => {
    event.preventDefault();
    if (!accountEditor || accountEditor.submitting) return;
    const errors = validateAccountAccessForm(accountEditor.mode, accountEditor.values);
    if (Object.keys(errors).length) {
      setAccountEditor((current) => ({ ...current, errors }));
      return;
    }
    setAccountEditor((current) => ({ ...current, submitting: true, apiError: "" }));
    const { mode, person, values } = accountEditor;
    try {
      if (mode === "create") {
        await createTeamAccount(person.id, {
          email: values.email.trim(),
          password: values.password,
          passwordConfirmation: values.passwordConfirmation,
        });
      } else if (mode === "reset") {
        await resetTeamAccountPassword(person.id, {
          password: values.password,
          passwordConfirmation: values.passwordConfirmation,
        });
      } else if (mode === "block") {
        await blockTeamAccount(person.id);
      } else {
        await unblockTeamAccount(person.id);
      }
      setAccountEditor(null);
      await load();
    } catch (error) {
      const code = error?.response?.data?.error;
      const messages = {
        LOGIN_IDENTIFIER_UNAVAILABLE: "Este e-mail de login não está disponível.",
        ACCOUNT_ACCESS_CONFLICT: "Não foi possível concluir porque o estado da conta mudou.",
        PERSON_ALREADY_HAS_ACCOUNT: "Esta pessoa já possui uma conta de acesso.",
        LAST_ADMINISTRATOR_REQUIRED: "A clínica precisa manter pelo menos um Administrador ativo.",
        INVALID_ACCOUNT_LINK: "O vínculo desta conta está inconsistente e não pode ser alterado.",
        TEAM_ADMINISTRATOR_REQUIRED: "Sua autorização administrativa não está mais válida.",
      };
      setAccountEditor((current) => ({
        ...current,
        submitting: false,
        apiError: messages[code]
          || getUserFacingApiError(error, "Não foi possível concluir a gestão do acesso."),
      }));
    }
  };

  const openProfileCreate = () => {
    const values = profileValues();
    setProfileEditor({ mode: "create", profileId: null, values, initialValues: profileValues(), errors: {}, apiError: "", submitting: false });
  };

  const openProfileEdit = (profile) => {
    if (profile.native_type) return;
    const values = profileValues(profile);
    setProfileEditor({ mode: "edit", profileId: profile.id, values, initialValues: profileValues(profile), errors: {}, apiError: "", submitting: false });
  };

  const changeProfileValue = (field, value) => setProfileEditor((current) => {
    if (field === "name") return { ...current, values: { ...current.values, name: value }, errors: {}, apiError: "" };
    if (field === "capability") {
      const capabilities = value.checked
        ? [...current.values.capabilities, value.key]
        : current.values.capabilities.filter((key) => key !== value.key);
      return { ...current, values: { ...current.values, capabilities }, apiError: "" };
    }
    const existing = current.values.permissions[value.module.module_key] || {
      moduleKey: value.module.module_key, accessLevel: "none", scopeLevel: null, canExport: false,
    };
    const next = { ...existing, [value.field]: value.value };
    if (value.field === "accessLevel") {
      if (value.value === "none") Object.assign(next, { scopeLevel: null, canExport: false });
      else if ((value.module.valid_scopes || []).length === 0) next.scopeLevel = null;
    }
    return {
      ...current,
      values: {
        ...current.values,
        permissions: { ...current.values.permissions, [value.module.module_key]: next },
      },
      apiError: "",
    };
  });

  const requestProfileClose = () => {
    if (profileEditor?.submitting) return;
    if (profileEditorDirty) setConfirmDiscard("profile");
    else setProfileEditor(null);
  };

  const submitProfile = async (event) => {
    event.preventDefault();
    if (!profileEditor || profileEditor.submitting) return;
    if (profileEditor.values.name.trim().length < 2 || profileEditor.values.name.trim().length > 120) {
      setProfileEditor((current) => ({ ...current, errors: { name: "Informe um nome entre 2 e 120 caracteres." } }));
      return;
    }
    setProfileEditor((current) => ({ ...current, submitting: true, apiError: "" }));
    try {
      const payload = profilePayload(profileEditor.values);
      if (profileEditor.mode === "create") await createAuthorizationProfile(payload);
      else await updateAuthorizationProfile(profileEditor.profileId, payload);
      setProfileEditor(null);
      await load();
    } catch (error) {
      const duplicate = error?.response?.data?.error === "AUTHORIZATION_PROFILE_ALREADY_EXISTS";
      setProfileEditor((current) => ({
        ...current,
        submitting: false,
        apiError: duplicate ? "Já existe um perfil com este nome na clínica." : getUserFacingApiError(error, "Não foi possível salvar o perfil."),
      }));
    }
  };

  const openAssignments = (person) => {
    if (!person.account || person.account.linkageType === "invalid") return;
    const ids = person.profiles.map(({ id }) => id);
    setAssignmentEditor({ person, profileIds: ids, initialProfileIds: [...ids], apiError: "", submitting: false });
  };

  const requestAssignmentClose = () => {
    if (assignmentEditor?.submitting) return;
    if (assignmentEditorDirty) setConfirmDiscard("assignment");
    else setAssignmentEditor(null);
  };

  useEffect(() => {
    if (!profileEditor && !assignmentEditor && !accountEditor) return undefined;
    const handleKeyDown = (event) => {
      if (event.key !== "Escape") return;
      if (profileEditor) requestProfileClose();
      else if (assignmentEditor) requestAssignmentClose();
      else requestAccountClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  });

  const submitAssignments = async (event) => {
    event.preventDefault();
    if (!assignmentEditor || assignmentEditor.submitting) return;
    setAssignmentEditor((current) => ({ ...current, submitting: true, apiError: "" }));
    const additions = assignmentEditor.profileIds.filter((id) => !assignmentEditor.initialProfileIds.includes(id));
    const removals = assignmentEditor.initialProfileIds.filter((id) => !assignmentEditor.profileIds.includes(id));
    try {
      await additions.reduce((previous, profileId) => previous.then(
        () => assignAuthorizationProfile(profileId, assignmentEditor.person.account.id),
      ), Promise.resolve());
      await removals.reduce((previous, profileId) => previous.then(
        () => unassignAuthorizationProfile(profileId, assignmentEditor.person.account.id),
      ), Promise.resolve());
      setAssignmentEditor(null);
      await load();
    } catch (error) {
      await load();
      setAssignmentEditor((current) => ({
        ...current,
        submitting: false,
        apiError: getUserFacingApiError(error, "Não foi possível concluir as atribuições. O estado atual foi recarregado."),
      }));
    }
  };

  const renderAccountLifecycleAction = (person) => {
    if (person.account.isActive) {
      return (
        <RowActionButton type="button" onClick={() => openAccountAction("block", person)}>
          Bloquear
        </RowActionButton>
      );
    }
    if (person.isActive && person.account.hasCredential) {
      return (
        <RowActionButton type="button" onClick={() => openAccountAction("unblock", person)}>
          Desbloquear
        </RowActionButton>
      );
    }
    return null;
  };

  const renderAccountActions = (person) => {
    if (!person.account) {
      if (person.isPerson && person.isActive) {
        return (
          <RowActionButton type="button" onClick={() => openAccountAction("create", person)}>
            Criar acesso
          </RowActionButton>
        );
      }
      return <NoAccessText>Sem conta de acesso</NoAccessText>;
    }
    if (person.account.linkageType === "invalid") return null;
    return (
      <>
        <RowActionButton type="button" onClick={() => openAssignments(person)}>
          Gerenciar perfis
        </RowActionButton>
        {person.isPerson && (
          <>
            <RowActionButton type="button" onClick={() => openAccountAction("reset", person)}>
              Redefinir senha
            </RowActionButton>
            {renderAccountLifecycleAction(person)}
          </>
        )}
      </>
    );
  };

  const canInactivate = (person) => (
    person.isPerson
    && person.isActive
    && person.account?.linkageType !== "invalid"
    && (
      person.professionalActive !== true
      || authorization.canManageProfessionalLifecycle
    )
  );

  if (authorization.status === "loading" || authorization.status === "idle") {
    return <Page><DataLoadingState text="Verificando acesso à Equipe..." /></Page>;
  }
  if (authorization.status === "error") {
    return <AuthorizationLoadError onRetry={authorization.reload} />;
  }
  if (!authorization.canViewTeam) return <AccessDenied />;

  return (
    <Page>
      <ModuleHeader>
        <ModuleTitle>Equipe</ModuleTitle>
        <ModuleSubtitle>Pessoas, profissionais, acessos e perfis da clínica.</ModuleSubtitle>
      </ModuleHeader>

      {state.status === "loading" && <DataLoadingState text="Carregando equipe..." />}
      {state.status === "error" && (
        <StatePanel>
          <DataLoadingState tone="error" text={state.error} compact />
          <RetryButton type="button" onClick={load}>Tentar novamente</RetryButton>
        </StatePanel>
      )}
      {state.status === "ready" && (
        <Sections>
          <ModulePanel as="section">
            <SectionHeader>
              <div><SectionTitle>Pessoas e acessos</SectionTitle><Count>{filteredPeople.length} encontrado(s)</Count></div>
              <PrimaryButton type="button" onClick={openCreate}><FaPlus /> Nova pessoa</PrimaryButton>
            </SectionHeader>
            <Filters aria-label="Filtros da equipe">
              <SearchInput
                aria-label="Buscar por nome ou identificador"
                placeholder="Buscar por nome ou login"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
              <Select aria-label="Filtrar por estado" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                <option value="all">Todos os estados</option><option value="active">Ativos</option><option value="inactive">Inativos</option>
              </Select>
              <Select aria-label="Filtrar por acesso" value={accessFilter} onChange={(event) => setAccessFilter(event.target.value)}>
                <option value="all">Com e sem acesso</option><option value="with">Com conta</option><option value="without">Sem conta</option>
              </Select>
            </Filters>
            {actionError && <FormError role="alert">{actionError}</FormError>}
            {filteredPeople.length === 0 ? <DataLoadingState tone="empty" text="Nenhuma pessoa encontrada." /> : (
              <PeopleList>{filteredPeople.map((person) => (
                <PersonRow key={person.id}>
                  <PersonMain><strong>{person.name}</strong><small>{person.isPerson ? (person.account?.login || (person.isProfessional ? "Profissional sem login" : "Sem conta de acesso")) : `Conta sem pessoa vinculada · ${person.account?.login}`}</small></PersonMain>
                  <Badges>
                    {person.isPerson && <NeutralPill>Pessoa</NeutralPill>}
                    {person.isProfessional && <NeutralPill>Profissional</NeutralPill>}
                    <StatusPill $tone={person.isActive ? "active" : "paused"}>{person.isActive ? "Ativo" : "Inativo"}</StatusPill>
                    <NeutralPill>
                      {person.account
                        ? (ACCOUNT_STATUS_LABELS[person.account.status] || "Com acesso")
                        : "Sem acesso"}
                    </NeutralPill>
                  </Badges>
                  <ProfileNames>{person.profiles.length ? person.profiles.map(({ name }) => name).join(", ") : "Sem perfil"}</ProfileNames>
                  <RowActions>
                    {(person.isPerson || (person.account && person.account.linkageType !== "invalid")) && (
                      <PersonActionsMenu personName={person.name}>
                        {person.isPerson && (
                          <RowActionButton type="button" onClick={() => openEdit(person)}>
                            <FaEdit /> Editar
                          </RowActionButton>
                        )}
                        {renderAccountActions(person)}
                        {person.isPerson && person.isActive && !person.isProfessional && (
                          <RowActionButton
                            type="button"
                            onClick={() => activateProfessional(person.id)}
                            disabled={activatingProfessionalId === person.id}
                          >
                            {activatingProfessionalId === person.id
                              ? "Ativando atuação..."
                              : "Ativar atuação profissional"}
                          </RowActionButton>
                        )}
                        {canInactivate(person) && (
                          <RowActionButton type="button" onClick={() => setInactivationEditor(person)}>
                            Inativar
                          </RowActionButton>
                        )}
                        {person.isPerson && !person.isActive && (
                          <RowActionButton
                            type="button"
                            onClick={() => reactivatePerson(person.id)}
                            disabled={activatingPersonId === person.id}
                          >
                            {activatingPersonId === person.id ? "Reativando..." : "Reativar pessoa"}
                          </RowActionButton>
                        )}
                      </PersonActionsMenu>
                    )}
                  </RowActions>
                </PersonRow>
              ))}</PeopleList>
            )}
          </ModulePanel>

          <ModulePanel as="section">
            <SectionHeader>
              <div><SectionTitle>Perfis e permissões</SectionTitle><Count>Definições da clínica</Count></div>
              <PrimaryButton type="button" onClick={openProfileCreate}><FaPlus /> Novo perfil</PrimaryButton>
            </SectionHeader>
            {presentation.profiles.length === 0 ? <DataLoadingState tone="empty" text="Nenhum perfil encontrado." /> : (
              <ProfileList>{presentation.profiles.map((profile) => (
                <ProfileRow key={profile.id}>
                  <ProfileButton type="button" onClick={() => setSelectedProfileId(profile.id)}>
                    <span><strong>{profile.name}</strong><small>{profile.native_type ? "Perfil nativo · definição bloqueada" : "Perfil personalizado"}</small></span>
                    <span><StatusPill $tone={profile.is_active ? "active" : "paused"}>{profile.is_active ? "Ativo" : "Inativo"}</StatusPill><Count>{profile.assignmentCount} atribuição(ões)</Count></span>
                  </ProfileButton>
                  {!profile.native_type && <RowActionButton type="button" onClick={() => openProfileEdit(profile)}><FaEdit /> Editar definição</RowActionButton>}
                </ProfileRow>
              ))}</ProfileList>
            )}
          </ModulePanel>

          <TeamAuditHistory people={presentation.people} />
        </Sections>
      )}

      {selectedProfile && (
        <><DrawerBackdrop onClick={() => setSelectedProfileId(null)} /><AppDrawer $open aria-label={`Permissões de ${selectedProfile.name}`}>
          <DrawerHeader><DrawerTitle>{selectedProfile.name}</DrawerTitle><DrawerCloseBtn type="button" aria-label="Fechar detalhes" onClick={() => setSelectedProfileId(null)}><FaTimes /></DrawerCloseBtn></DrawerHeader>
          <DrawerBody><ProfileDetails profile={selectedProfile} catalog={state.model.catalog} /></DrawerBody>
        </AppDrawer></>
      )}
      {editor && (
        <PersonDrawer
          editor={editor}
          onChange={changeEditorValue}
          onClose={requestEditorClose}
          onSubmit={submitPerson}
        />
      )}
      {profileEditor && (
        <ProfileEditorDrawer
          editor={profileEditor}
          catalog={state.model.catalog}
          onChange={changeProfileValue}
          onClose={requestProfileClose}
          onSubmit={submitProfile}
        />
      )}
      {assignmentEditor && (
        <AssignmentDrawer
          editor={assignmentEditor}
          profiles={presentation.profiles}
          onToggle={(profileId, checked) => setAssignmentEditor((current) => ({
            ...current,
            profileIds: checked
              ? [...current.profileIds, profileId]
              : current.profileIds.filter((id) => id !== profileId),
            apiError: "",
          }))}
          onClose={requestAssignmentClose}
          onSubmit={submitAssignments}
        />
      )}
      {accountEditor && (
        <AccountAccessDrawer
          editor={accountEditor}
          onChange={changeAccountValue}
          onClose={requestAccountClose}
          onSubmit={submitAccount}
        />
      )}
      {inactivationEditor && (
        <ProfessionalInactivationDrawer
          person={inactivationEditor}
          targets={presentation.people.filter(({ isPerson }) => isPerson)}
          onClose={() => setInactivationEditor(null)}
          onCompleted={load}
        />
      )}
      <UnsavedChangesDialog
        open={Boolean(confirmDiscard)}
        onKeepEditing={() => setConfirmDiscard(null)}
        onDiscard={() => {
          if (confirmDiscard === "person") setEditor(null);
          if (confirmDiscard === "profile") setProfileEditor(null);
          if (confirmDiscard === "assignment") setAssignmentEditor(null);
          if (confirmDiscard === "account") setAccountEditor(null);
          setConfirmDiscard(null);
        }}
      />
    </Page>
  );
}

function ProfileDetails({ profile, catalog }) {
  const permissions = new Map((profile.permissions || []).map((item) => [item.moduleKey, item]));
  const admin = profile.native_type === "administrator";
  const capabilityRules = new Map([
    ...(catalog.distributable_capabilities || []),
    ...(catalog.administrator_only_capabilities || []),
  ].map((item) => [item.capability_key, item]));
  return (
    <Details>
      <p>{admin ? "Administrador possui acesso estrutural completo." : "Permissões configuradas para este perfil."}</p>
      {(catalog.modules || []).map((module) => {
        const permission = permissions.get(module.module_key);
        return <DetailRow key={module.module_key}><strong>{MODULE_LABELS[module.module_key] || module.module_key}</strong><span>{admin ? "Gerenciar" : ACCESS_LABELS[permission?.accessLevel || "none"]}{permission?.scopeLevel ? ` · ${SCOPE_LABELS[permission.scopeLevel]}` : ""}{permission?.canExport ? " · Pode exportar" : ""}</span></DetailRow>;
      })}
      {(profile.capabilities || []).length > 0 && <><DetailHeading>Capacidades adicionais</DetailHeading><SimpleList>{profile.capabilities.map((capability) => { const dependencies = capabilityRules.get(capability)?.required_capabilities || []; return <li key={capability}>{capabilityLabel(capability)}{dependencies.length ? <small> Requer: {dependencies.map(capabilityLabel).join(", ")}</small> : null}</li>; })}</SimpleList></>}
      {admin && <><DetailHeading>Poderes exclusivos</DetailHeading><SimpleList>{(catalog.administrative_powers || []).map(({ power_key: key }) => <li key={key}>{POWER_LABELS[key] || "Poder administrativo estrutural"} <em>Não editável</em></li>)}</SimpleList></>}
    </Details>
  );
}

ProfileDetails.propTypes = {
  profile: PropTypes.shape({
    native_type: PropTypes.string,
    permissions: PropTypes.arrayOf(PropTypes.shape({})),
    capabilities: PropTypes.arrayOf(PropTypes.string),
  }).isRequired,
  catalog: PropTypes.shape({
    modules: PropTypes.arrayOf(PropTypes.shape({})),
    distributable_capabilities: PropTypes.arrayOf(PropTypes.shape({})),
    administrator_only_capabilities: PropTypes.arrayOf(PropTypes.shape({})),
    administrative_powers: PropTypes.arrayOf(PropTypes.shape({})),
  }).isRequired,
};

const Page = styled.div`
  width: 100%;
  max-width: 100%;
  min-width: 0;
  padding: 28px 32px 40px;

  @media (max-width: ${layout.moduleBreakpoint}) {
    padding: 20px 16px 32px;
  }
`;
const Sections = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 20px;
  min-width: 0;

  > * {
    min-width: 0;
  }
`;
const SectionHeader = styled.div`display: flex; justify-content: space-between; gap: 16px; align-items: center; margin-bottom: 16px; @media (max-width: 560px) { align-items: stretch; flex-direction: column; }`;
const SectionTitle = styled.h2`margin: 0; color: ${colors.ink}; font-size: 1.05rem;`;
const Count = styled.small`display: block; margin-top: 4px; color: ${colors.softText};`;
const Filters = styled.div`display: grid; grid-template-columns: minmax(220px, 1fr) auto auto; gap: 10px; margin-bottom: 16px; @media (max-width: 720px) { grid-template-columns: 1fr; }`;
const fieldCss = `min-height: 42px; border: 1px solid #d9ded5; border-radius: 8px; background: #fff; color: #263124; padding: 9px 12px; font: inherit;`;
const SearchInput = styled.input`${fieldCss}`;
const Select = styled.select`${fieldCss}`;
const PeopleList = styled.div`display: grid;`;
const PersonRow = styled.article`display: grid; grid-template-columns: minmax(180px, 1fr) auto minmax(140px, 0.7fr) auto; gap: 16px; align-items: center; padding: 15px 0; border-top: 1px solid #e8ebe5; @media (max-width: 900px) { grid-template-columns: minmax(180px, 1fr) auto; } @media (max-width: 620px) { grid-template-columns: 1fr; gap: 8px; }`;
const PersonMain = styled.div`display: grid; gap: 3px; small { color: ${colors.softText}; }`;
const Badges = styled.div`display: flex; gap: 6px; flex-wrap: wrap;`;
const ProfileNames = styled.div`color: ${colors.softText}; font-size: 0.88rem;`;
const RowActions = styled.div`display: flex; justify-content: flex-end;`;
const ActionsMenuRoot = styled.div`
  position: relative;
`;
const ActionsMenuTrigger = styled(RowActionButton)`
  display: inline-flex;
  align-items: center;
  gap: 7px;
  white-space: nowrap;
`;
const ActionsMenuPopover = styled.div`
  position: absolute;
  z-index: 20;
  top: calc(100% + 6px);
  right: 0;
  display: grid;
  min-width: 220px;
  padding: 6px;
  border: 1px solid #d9ded5;
  border-radius: 10px;
  background: ${colors.white};
  box-shadow: 0 12px 30px rgba(38, 49, 36, 0.16);

  ${RowActionButton} {
    display: inline-flex;
    justify-content: flex-start;
    align-items: center;
    gap: 7px;
    width: 100%;
    border-color: transparent;
    white-space: nowrap;
  }

  @media (max-width: 620px) {
    right: auto;
    left: 0;
    min-width: min(260px, calc(100vw - 64px));
  }
`;
const ProfileList = styled.div`display: grid; margin-top: 12px;`;
const ProfileButton = styled.button`display: flex; justify-content: space-between; gap: 16px; width: 100%; padding: 14px 4px; border: 0; border-top: 1px solid #e8ebe5; background: transparent; text-align: left; cursor: pointer; span { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; } small { color: ${colors.softText}; } &:hover { background: #f8f9f7; } &:focus-visible { outline: 3px solid rgba(106, 121, 92, 0.28); } @media (max-width: 620px) { flex-direction: column; }`;
const ProfileRow = styled.div`display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 12px; align-items: center; border-top: 1px solid #e8ebe5; ${ProfileButton} { border-top: 0; } @media (max-width: 620px) { grid-template-columns: 1fr; padding-bottom: 12px; }`;
const StatePanel = styled(ModulePanel)`text-align: center;`;
const RetryButton = styled.button`border: 1px solid ${colors.brand}; border-radius: 8px; background: ${colors.white}; color: ${colors.brandDark}; padding: 9px 14px; font-weight: 700; cursor: pointer;`;
const Details = styled.div`color: ${colors.ink}; p { color: ${colors.softText}; }`;
const DetailRow = styled.div`display: flex; justify-content: space-between; gap: 12px; padding: 12px 0; border-bottom: 1px solid #e8ebe5; span { color: ${colors.softText}; text-align: right; }`;
const DetailHeading = styled.h3`font-size: 0.95rem; margin: 24px 0 8px;`;
const SimpleList = styled.ul`margin: 0; padding-left: 20px; color: ${colors.softText}; li { margin: 7px 0; } em { font-style: normal; font-size: 0.76rem; font-weight: 700; }`;
const PersonForm = styled.form`display: grid; gap: 18px;`;
const FieldGroup = styled.div`display: grid; gap: 6px;`;
const FieldLabel = styled.label`color: ${colors.ink}; font-size: 0.88rem; font-weight: 700;`;
const FieldInput = styled.input`${fieldCss} &[aria-invalid="true"] { border-color: #b5473c; } &:focus-visible { outline: 3px solid rgba(106, 121, 92, 0.24); outline-offset: 1px; }`;
const FieldError = styled.small`color: #9f342b;`;
const CheckboxLabel = styled.label`display: flex; gap: 9px; align-items: flex-start; color: ${colors.ink}; font-size: 0.9rem; line-height: 1.4; cursor: pointer; input { margin-top: 3px; }`;
const FormNotice = styled.p`margin: 0; padding: 12px; border-radius: 8px; background: #f6f8f4; color: ${colors.softText}; font-size: 0.86rem; line-height: 1.45;`;
const FormError = styled.p`margin: 0; color: #9f342b; font-size: 0.88rem; font-weight: 700;`;
const NoAccessText = styled.small`color: ${colors.softText}; align-self: center;`;
const PermissionEditorRow = styled.div`display: grid; gap: 8px; padding: 14px 0; border-top: 1px solid #e8ebe5;`;
const CapabilityGrid = styled.div`display: grid; gap: 12px;`;
