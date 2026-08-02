import React, {
  useEffect, useMemo, useRef, useState,
} from "react";
import PropTypes from "prop-types";
import styled from "styled-components";
import { FaTimes } from "react-icons/fa";
import { getUserFacingApiError } from "../../services/axios";
import { getTeamAuditEvents } from "../../services/team";
import { ModulePanel } from "../../components/AppModuleShell";
import DataLoadingState from "../../components/DataLoadingState";
import {
  AppDrawer,
  DrawerBackdrop,
  DrawerBody,
  DrawerCloseBtn,
  DrawerHeader,
  DrawerTitle,
} from "../../components/AppDrawer";
import { GhostButton, PrimaryButton, RowActionButton } from "../../components/AppButton";
import { StatusPill } from "../../components/AppStatus";
import { colors } from "../../styles/tokens";

const EMPTY_FILTERS = Object.freeze({
  from: "",
  to: "",
  actor: "",
  action: "",
  person_id: "",
});

const FILTER_LABELS = Object.freeze({
  from: "A partir de",
  to: "Até",
  actor: "Ator",
  action: "Ação",
  person_id: "Pessoa",
});

const AUDIT_ERROR_MESSAGES = Object.freeze({
  INVALID_AUDIT_PERIOD: "Revise o período informado.",
  AUDIT_PERIOD_TOO_LARGE: "O período máximo para consulta é de 366 dias.",
  INVALID_AUDIT_ACTOR: "Selecione um ator válido.",
  INVALID_AUDIT_ACTION: "Selecione uma ação válida.",
  INVALID_AUDIT_PERSON: "Selecione uma pessoa válida.",
  INVALID_AUDIT_LIMIT: "A quantidade por página não é válida.",
  INVALID_AUDIT_CURSOR: "A página solicitada expirou. Aplique os filtros novamente.",
  INVALID_AUDIT_FILTERS: "Revise os filtros informados.",
  UNKNOWN_AUDIT_FILTER: "A consulta contém um filtro não permitido.",
  AUTHORIZATION_DENIED: "Você não possui permissão para consultar este histórico.",
});

const auditErrorMessage = (error) => (
  AUDIT_ERROR_MESSAGES[error?.response?.data?.error]
  || getUserFacingApiError(error, "Não foi possível carregar o histórico administrativo.")
);

export const formatAuditValue = (value) => {
  if (value === null || value === undefined || value === "") return "Não informado";
  if (value === true) return "Sim";
  if (value === false) return "Não";
  if (typeof value === "number") return String(value);
  return String(value);
};

const formatDateTime = (value) => new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
}).format(new Date(value));

const auditQuery = (filters, cursor) => ({
  ...filters,
  limit: 10,
  ...(cursor ? { cursor } : {}),
});

function AuditDetailsDrawer({ event, onClose }) {
  useEffect(() => {
    const handleKeyDown = ({ key }) => {
      if (key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <>
      <DrawerBackdrop onClick={onClose} />
      <AppDrawer $open role="dialog" aria-modal="true" aria-labelledby="audit-detail-title">
        <DrawerHeader>
          <DrawerTitle id="audit-detail-title">Detalhes da ação</DrawerTitle>
          <DrawerCloseBtn type="button" aria-label="Fechar detalhes da auditoria" onClick={onClose}>
            <FaTimes />
          </DrawerCloseBtn>
        </DrawerHeader>
        <DrawerBody>
          <DetailSummary>
            <strong>{event.action.label}</strong>
            <span>{formatDateTime(event.occurred_at)}</span>
            <span>Realizada por {event.actor.name}</span>
            <span>
              {event.people.length
                ? `Pessoa afetada: ${event.people.map(({ name }) => name).join(", ")}`
                : "Sem pessoa diretamente associada"}
            </span>
          </DetailSummary>
          {event.details.length === 0 ? (
            <DataLoadingState
              tone="empty"
              compact
              text="Este evento não possui comparação administrativa para exibir."
            />
          ) : (
            <DetailList>
              {event.details.map((detail) => (
                <DetailItem key={detail.field}>
                  <strong>{detail.label}</strong>
                  <div>
                    <span>Antes</span>
                    <p>{formatAuditValue(detail.before)}</p>
                  </div>
                  <div>
                    <span>Depois</span>
                    <p>{formatAuditValue(detail.after)}</p>
                  </div>
                </DetailItem>
              ))}
            </DetailList>
          )}
        </DrawerBody>
      </AppDrawer>
    </>
  );
}

AuditDetailsDrawer.propTypes = {
  event: PropTypes.shape({
    occurred_at: PropTypes.string.isRequired,
    action: PropTypes.shape({ label: PropTypes.string.isRequired }).isRequired,
    actor: PropTypes.shape({ name: PropTypes.string.isRequired }).isRequired,
    people: PropTypes.arrayOf(PropTypes.shape({ name: PropTypes.string.isRequired })).isRequired,
    details: PropTypes.arrayOf(PropTypes.shape({
      field: PropTypes.string.isRequired,
      label: PropTypes.string.isRequired,
      before: PropTypes.oneOfType([PropTypes.string, PropTypes.number, PropTypes.bool]),
      after: PropTypes.oneOfType([PropTypes.string, PropTypes.number, PropTypes.bool]),
    })).isRequired,
  }).isRequired,
  onClose: PropTypes.func.isRequired,
};

export default function TeamAuditHistory({ people }) {
  const [draftFilters, setDraftFilters] = useState({ ...EMPTY_FILTERS });
  const [appliedFilters, setAppliedFilters] = useState({ ...EMPTY_FILTERS });
  const [cursor, setCursor] = useState(null);
  const [cursorHistory, setCursorHistory] = useState([]);
  const [reloadKey, setReloadKey] = useState(0);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [state, setState] = useState({
    status: "loading",
    data: null,
    error: "",
  });
  const requestId = useRef(0);

  useEffect(() => {
    const currentRequest = requestId.current + 1;
    requestId.current = currentRequest;
    setState((current) => ({ ...current, status: "loading", error: "" }));
    getTeamAuditEvents(auditQuery(appliedFilters, cursor))
      .then((data) => {
        if (requestId.current !== currentRequest) return;
        setState({ status: "ready", data, error: "" });
      })
      .catch((error) => {
        if (requestId.current !== currentRequest) return;
        setState((current) => ({
          status: "error",
          data: current.data,
          error: auditErrorMessage(error),
        }));
      });
    return () => {
      if (requestId.current === currentRequest) requestId.current += 1;
    };
  }, [appliedFilters, cursor, reloadKey]);

  const actions = useMemo(
    () => state.data?.filter_options?.actions || [],
    [state.data],
  );
  const actors = useMemo(
    () => state.data?.filter_options?.actors || [],
    [state.data],
  );
  const actionByKey = useMemo(
    () => new Map(actions.map((action) => [action.key, action.label])),
    [actions],
  );
  const actorByKey = useMemo(
    () => new Map(actors.map((actor) => [actor.key, actor.name])),
    [actors],
  );
  const personById = useMemo(
    () => new Map(people.filter(({ isPerson }) => isPerson).map((person) => [String(person.id), person.name])),
    [people],
  );
  const appliedDescriptions = Object.entries(appliedFilters)
    .filter(([, value]) => value)
    .map(([key, value]) => {
      if (key === "action") return `${FILTER_LABELS[key]}: ${actionByKey.get(value) || value}`;
      if (key === "actor") return `${FILTER_LABELS[key]}: ${actorByKey.get(value) || value}`;
      if (key === "person_id") return `${FILTER_LABELS[key]}: ${personById.get(value) || value}`;
      return `${FILTER_LABELS[key]}: ${value.split("-").reverse().join("/")}`;
    });

  const applyFilters = (event) => {
    event.preventDefault();
    setCursor(null);
    setCursorHistory([]);
    setAppliedFilters({ ...draftFilters });
    setReloadKey((value) => value + 1);
  };

  const clearFilters = () => {
    setDraftFilters({ ...EMPTY_FILTERS });
    setAppliedFilters({ ...EMPTY_FILTERS });
    setCursor(null);
    setCursorHistory([]);
    setReloadKey((value) => value + 1);
  };

  const nextPage = () => {
    if (state.status !== "ready") return;
    const nextCursor = state.data?.pagination?.next_cursor;
    if (!nextCursor) return;
    setCursorHistory((current) => [...current, cursor]);
    setCursor(nextCursor);
  };

  const previousPage = () => {
    if (state.status !== "ready" || !cursorHistory.length) return;
    setCursor(cursorHistory[cursorHistory.length - 1]);
    setCursorHistory((current) => current.slice(0, -1));
  };

  const rows = state.data?.items || [];

  return (
    <AuditPanel as="section">
      <SectionHeader>
        <div>
          <SectionTitle>Histórico administrativo</SectionTitle>
          <SectionDescription>
            Registro somente leitura das ações de segurança desta clínica.
          </SectionDescription>
        </div>
      </SectionHeader>
      <FiltersForm aria-label="Filtros do histórico administrativo" onSubmit={applyFilters}>
        <Field>
          <FieldLabel htmlFor="audit-from">De</FieldLabel>
          <Input
            id="audit-from"
            type="date"
            value={draftFilters.from}
            onChange={(event) => setDraftFilters((current) => ({
              ...current,
              from: event.target.value,
            }))}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="audit-to">Até</FieldLabel>
          <Input
            id="audit-to"
            type="date"
            value={draftFilters.to}
            onChange={(event) => setDraftFilters((current) => ({
              ...current,
              to: event.target.value,
            }))}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="audit-actor">Ator</FieldLabel>
          <Select
            id="audit-actor"
            value={draftFilters.actor}
            onChange={(event) => setDraftFilters((current) => ({
              ...current,
              actor: event.target.value,
            }))}
          >
            <option value="">Todos os atores</option>
            {actors.map((actor) => (
              <option key={actor.key} value={actor.key}>{actor.name}</option>
            ))}
          </Select>
        </Field>
        <Field>
          <FieldLabel htmlFor="audit-action">Ação</FieldLabel>
          <Select
            id="audit-action"
            value={draftFilters.action}
            onChange={(event) => setDraftFilters((current) => ({
              ...current,
              action: event.target.value,
            }))}
          >
            <option value="">Todas as ações</option>
            {actions.map((action) => (
              <option key={action.key} value={action.key}>{action.label}</option>
            ))}
          </Select>
        </Field>
        <Field>
          <FieldLabel htmlFor="audit-person">Pessoa afetada</FieldLabel>
          <Select
            id="audit-person"
            value={draftFilters.person_id}
            onChange={(event) => setDraftFilters((current) => ({
              ...current,
              person_id: event.target.value,
            }))}
          >
            <option value="">Todas as pessoas</option>
            {people.filter(({ isPerson }) => isPerson).map((person) => (
              <option key={person.id} value={person.id}>{person.name}</option>
            ))}
          </Select>
        </Field>
        <FilterActions>
          <PrimaryButton type="submit">Aplicar filtros</PrimaryButton>
          <GhostButton type="button" onClick={clearFilters}>Limpar</GhostButton>
        </FilterActions>
      </FiltersForm>

      {appliedDescriptions.length > 0 && (
        <AppliedFilters aria-label="Filtros aplicados">
          <strong>Filtros aplicados:</strong>
          {appliedDescriptions.map((description) => <span key={description}>{description}</span>)}
        </AppliedFilters>
      )}

      {state.status === "loading" && <DataLoadingState text="Carregando histórico..." />}
      {state.status === "error" && (
        <ErrorState>
          <DataLoadingState tone="error" compact text={state.error} />
          <GhostButton type="button" onClick={() => setReloadKey((value) => value + 1)}>
            Tentar novamente
          </GhostButton>
        </ErrorState>
      )}
      {state.status === "ready" && rows.length === 0 && (
        <DataLoadingState tone="empty" text="Nenhuma ação administrativa encontrada." />
      )}
      {state.status === "ready" && rows.length > 0 && (
        <>
          <TableWrap>
            <Table>
              <thead>
                <tr>
                  <th>Data e hora</th>
                  <th>Ator</th>
                  <th>Ação</th>
                  <th>Pessoa afetada</th>
                  <th>Resultado</th>
                  <th aria-label="Detalhes" />
                </tr>
              </thead>
              <tbody>
                {rows.map((event) => (
                  <tr key={event.id}>
                    <td>{formatDateTime(event.occurred_at)}</td>
                    <td>
                      {event.actor.name}
                      {event.actor.is_active === false && <small>Ator inativo</small>}
                    </td>
                    <td>{event.action.label}</td>
                    <td>
                      {event.people.length
                        ? event.people.map(({ name }) => name).join(", ")
                        : "Não se aplica"}
                    </td>
                    <td><StatusPill $tone="active">{event.result.label}</StatusPill></td>
                    <td>
                      <RowActionButton type="button" onClick={() => setSelectedEvent(event)}>
                        Ver detalhes
                      </RowActionButton>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
          <Pagination aria-label="Paginação do histórico">
            <GhostButton
              type="button"
              onClick={previousPage}
              disabled={state.status !== "ready" || !cursorHistory.length}
            >
              Anterior
            </GhostButton>
            <span>Página {cursorHistory.length + 1}</span>
            <GhostButton
              type="button"
              onClick={nextPage}
              disabled={state.status !== "ready" || !state.data.pagination.has_more}
            >
              Próxima
            </GhostButton>
          </Pagination>
        </>
      )}

      {selectedEvent && (
        <AuditDetailsDrawer event={selectedEvent} onClose={() => setSelectedEvent(null)} />
      )}
    </AuditPanel>
  );
}

TeamAuditHistory.propTypes = {
  people: PropTypes.arrayOf(PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
    name: PropTypes.string.isRequired,
    isPerson: PropTypes.bool,
  })).isRequired,
};

const SectionHeader = styled.div`
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: center;
  margin-bottom: 16px;
`;
const SectionTitle = styled.h2`
  margin: 0;
  color: ${colors.ink};
  font-size: 1.05rem;
`;
const SectionDescription = styled.p`
  margin: 4px 0 0;
  color: ${colors.softText};
  font-size: 0.86rem;
`;
const FiltersForm = styled.form`
  display: grid;
  grid-template-columns: repeat(5, minmax(130px, 1fr));
  gap: 12px;
  align-items: end;
  margin-bottom: 16px;

  @media (max-width: 1050px) {
    grid-template-columns: repeat(2, minmax(180px, 1fr));
  }

  @media (max-width: 620px) {
    grid-template-columns: 1fr;
  }
`;
const Field = styled.div`
  display: grid;
  gap: 5px;
`;
const FieldLabel = styled.label`
  color: ${colors.ink};
  font-size: 0.82rem;
  font-weight: 700;
`;
const fieldCss = `
  min-height: 42px;
  width: 100%;
  border: 1px solid #d9ded5;
  border-radius: 8px;
  background: #fff;
  color: #263124;
  padding: 9px 10px;
  font: inherit;
`;
const Input = styled.input`${fieldCss}`;
const Select = styled.select`${fieldCss}`;
const FilterActions = styled.div`
  display: flex;
  gap: 8px;
  grid-column: 1 / -1;
`;
const AppliedFilters = styled.div`
  display: flex;
  align-items: center;
  gap: 7px;
  flex-wrap: wrap;
  margin-bottom: 14px;
  color: ${colors.softText};
  font-size: 0.82rem;

  span {
    background: #f1f4ee;
    border-radius: 999px;
    padding: 5px 9px;
  }
`;
const ErrorState = styled.div`
  display: grid;
  justify-items: center;
  gap: 8px;
`;
const AuditPanel = styled(ModulePanel)`
  width: 100%;
  max-width: 100%;
  min-width: 0;
`;
const TableWrap = styled.div`
  width: 100%;
  max-width: 100%;
  min-width: 0;
  overflow-x: auto;
`;
const Table = styled.table`
  width: 100%;
  min-width: 850px;
  border-collapse: collapse;

  th,
  td {
    padding: 12px 10px;
    border-top: 1px solid #e8ebe5;
    text-align: left;
    vertical-align: middle;
    color: ${colors.ink};
  }

  th {
    color: ${colors.softText};
    font-size: 0.78rem;
    text-transform: uppercase;
  }

  td {
    font-size: 0.88rem;
  }

  td small {
    display: block;
    margin-top: 3px;
    color: ${colors.softText};
  }
`;
const Pagination = styled.nav`
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 16px;

  span {
    color: ${colors.softText};
    font-size: 0.86rem;
  }
`;
const DetailSummary = styled.div`
  display: grid;
  gap: 7px;
  padding-bottom: 16px;
  border-bottom: 1px solid #e8ebe5;

  span {
    color: ${colors.softText};
    font-size: 0.88rem;
  }
`;
const DetailList = styled.div`
  display: grid;
`;
const DetailItem = styled.article`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  padding: 16px 0;
  border-bottom: 1px solid #e8ebe5;

  > strong {
    grid-column: 1 / -1;
  }

  span {
    color: ${colors.softText};
    font-size: 0.76rem;
    font-weight: 700;
    text-transform: uppercase;
  }

  p {
    margin: 4px 0 0;
    overflow-wrap: anywhere;
    color: ${colors.ink};
    font-size: 0.88rem;
  }
`;
