import React, { useCallback, useEffect, useMemo, useState } from "react";
import PropTypes from "prop-types";
import styled from "styled-components";
import { FaTimes } from "react-icons/fa";
import { useAuthorization } from "../../contexts/AuthorizationContext";
import { loadTeamReadModel } from "../../services/team";
import { getUserFacingApiError } from "../../services/axios";
import { ModuleHeader, ModulePanel, ModuleSubtitle, ModuleTitle } from "../../components/AppModuleShell";
import DataLoadingState from "../../components/DataLoadingState";
import { StatusPill, NeutralPill } from "../../components/AppStatus";
import {
  AppDrawer,
  DrawerBackdrop,
  DrawerBody,
  DrawerCloseBtn,
  DrawerHeader,
  DrawerTitle,
} from "../../components/AppDrawer";
import { colors, layout } from "../../styles/tokens";

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
  (model.assignmentState?.assignments || []).forEach((assignment) => {
    const current = assignmentsByUser.get(assignment.user_id) || [];
    assignmentsByUser.set(assignment.user_id, [...current, assignment.profile_id]);
  });

  const people = (model.people || []).map((person) => {
    const account = person.account ? accountById.get(person.account.id) : null;
    const profileIds = person.account ? assignmentsByUser.get(person.account.id) || [] : [];
    return {
      id: person.id,
      name: person.name,
      isActive: person.is_active === true,
      isProfessional: Boolean(person.professional),
      professionalActive: person.professional?.is_active === true,
      account: person.account ? {
        id: person.account.id,
        login: account?.login_identifier || person.account.email || null,
        isActive: person.account.is_active === true,
      } : null,
      profiles: profileIds.map((id) => profileById.get(id)).filter(Boolean),
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
      account: { id: account.user_id, login: account.login_identifier, isActive: account.is_active },
      profiles: (assignmentsByUser.get(account.user_id) || [])
        .map((id) => profileById.get(id)).filter(Boolean),
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

export default function Equipe() {
  const authorization = useAuthorization();
  const [state, setState] = useState({ status: "idle", model: null, error: "" });
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [accessFilter, setAccessFilter] = useState("all");
  const [selectedProfileId, setSelectedProfileId] = useState(null);

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

  if (authorization.status === "loading" || authorization.status === "idle") {
    return <Page><DataLoadingState text="Verificando acesso à Equipe..." /></Page>;
  }
  if (!authorization.canViewTeam) return <AccessDenied />;

  return (
    <Page>
      <ModuleHeader>
        <ModuleTitle>Equipe</ModuleTitle>
        <ModuleSubtitle>Pessoas, acessos e perfis da clínica em modo de consulta.</ModuleSubtitle>
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
            {filteredPeople.length === 0 ? <DataLoadingState tone="empty" text="Nenhuma pessoa encontrada." /> : (
              <PeopleList>{filteredPeople.map((person) => (
                <PersonRow key={person.id}>
                  <PersonMain><strong>{person.name}</strong><small>{person.isPerson ? (person.account?.login || (person.isProfessional ? "Profissional sem login" : "Sem conta de acesso")) : `Conta sem pessoa vinculada · ${person.account?.login}`}</small></PersonMain>
                  <Badges>
                    {person.isProfessional && <NeutralPill>Profissional</NeutralPill>}
                    <StatusPill $tone={person.isActive ? "active" : "paused"}>{person.isActive ? "Ativo" : "Inativo"}</StatusPill>
                    <NeutralPill>{person.account ? "Com acesso" : "Sem acesso"}</NeutralPill>
                  </Badges>
                  <ProfileNames>{person.profiles.length ? person.profiles.map(({ name }) => name).join(", ") : "Sem perfil"}</ProfileNames>
                </PersonRow>
              ))}</PeopleList>
            )}
          </ModulePanel>

          <ModulePanel as="section">
            <SectionTitle>Perfis e permissões</SectionTitle>
            {presentation.profiles.length === 0 ? <DataLoadingState tone="empty" text="Nenhum perfil encontrado." /> : (
              <ProfileList>{presentation.profiles.map((profile) => (
                <ProfileButton type="button" key={profile.id} onClick={() => setSelectedProfileId(profile.id)}>
                  <span><strong>{profile.name}</strong><small>{profile.native_type ? "Perfil nativo" : "Perfil personalizado"}</small></span>
                  <span><StatusPill $tone={profile.is_active ? "active" : "paused"}>{profile.is_active ? "Ativo" : "Inativo"}</StatusPill><Count>{profile.assignmentCount} atribuição(ões)</Count></span>
                </ProfileButton>
              ))}</ProfileList>
            )}
          </ModulePanel>
        </Sections>
      )}

      {selectedProfile && (
        <><DrawerBackdrop onClick={() => setSelectedProfileId(null)} /><AppDrawer $open aria-label={`Permissões de ${selectedProfile.name}`}>
          <DrawerHeader><DrawerTitle>{selectedProfile.name}</DrawerTitle><DrawerCloseBtn type="button" aria-label="Fechar detalhes" onClick={() => setSelectedProfileId(null)}><FaTimes /></DrawerCloseBtn></DrawerHeader>
          <DrawerBody><ProfileDetails profile={selectedProfile} catalog={state.model.catalog} /></DrawerBody>
        </AppDrawer></>
      )}
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

const Page = styled.div`padding: 28px 32px 40px; @media (max-width: ${layout.moduleBreakpoint}) { padding: 20px 16px 32px; }`;
const Sections = styled.div`display: grid; gap: 20px;`;
const SectionHeader = styled.div`display: flex; justify-content: space-between; margin-bottom: 16px;`;
const SectionTitle = styled.h2`margin: 0; color: ${colors.ink}; font-size: 1.05rem;`;
const Count = styled.small`display: block; margin-top: 4px; color: ${colors.softText};`;
const Filters = styled.div`display: grid; grid-template-columns: minmax(220px, 1fr) auto auto; gap: 10px; margin-bottom: 16px; @media (max-width: 720px) { grid-template-columns: 1fr; }`;
const fieldCss = `min-height: 42px; border: 1px solid #d9ded5; border-radius: 8px; background: #fff; color: #263124; padding: 9px 12px; font: inherit;`;
const SearchInput = styled.input`${fieldCss}`;
const Select = styled.select`${fieldCss}`;
const PeopleList = styled.div`display: grid;`;
const PersonRow = styled.article`display: grid; grid-template-columns: minmax(180px, 1fr) auto minmax(160px, 0.8fr); gap: 16px; align-items: center; padding: 15px 0; border-top: 1px solid #e8ebe5; @media (max-width: 720px) { grid-template-columns: 1fr; gap: 8px; }`;
const PersonMain = styled.div`display: grid; gap: 3px; small { color: ${colors.softText}; }`;
const Badges = styled.div`display: flex; gap: 6px; flex-wrap: wrap;`;
const ProfileNames = styled.div`color: ${colors.softText}; font-size: 0.88rem;`;
const ProfileList = styled.div`display: grid; margin-top: 12px;`;
const ProfileButton = styled.button`display: flex; justify-content: space-between; gap: 16px; width: 100%; padding: 14px 4px; border: 0; border-top: 1px solid #e8ebe5; background: transparent; text-align: left; cursor: pointer; span { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; } small { color: ${colors.softText}; } &:hover { background: #f8f9f7; } &:focus-visible { outline: 3px solid rgba(106, 121, 92, 0.28); } @media (max-width: 620px) { flex-direction: column; }`;
const StatePanel = styled(ModulePanel)`text-align: center;`;
const RetryButton = styled.button`border: 1px solid ${colors.brand}; border-radius: 8px; background: ${colors.white}; color: ${colors.brandDark}; padding: 9px 14px; font-weight: 700; cursor: pointer;`;
const Details = styled.div`color: ${colors.ink}; p { color: ${colors.softText}; }`;
const DetailRow = styled.div`display: flex; justify-content: space-between; gap: 12px; padding: 12px 0; border-bottom: 1px solid #e8ebe5; span { color: ${colors.softText}; text-align: right; }`;
const DetailHeading = styled.h3`font-size: 0.95rem; margin: 24px 0 8px;`;
const SimpleList = styled.ul`margin: 0; padding-left: 20px; color: ${colors.softText}; li { margin: 7px 0; } em { font-style: normal; font-size: 0.76rem; font-weight: 700; }`;
