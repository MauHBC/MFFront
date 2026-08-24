import React from "react";
import PropTypes from "prop-types";
import { Link } from "react-router-dom";
import styled from "styled-components";
import { FaPlus } from "react-icons/fa";

import { PrimaryButton } from "../../components/AppButton";
import DataLoadingState from "../../components/DataLoadingState";
import { InteractiveListRowSurface } from "../../components/InteractiveListRow";
import PatientSearchField from "../../components/PatientSearchField";
import { StatusPill } from "../../components/AppStatus";
import { alpha, colors, fontSizes, radii } from "../../styles/tokens";
import {
  getOverviewAgendaPresentation,
  getOverviewStatusPresentation,
  getPlanFrequencySubtitle,
} from "./patientPlanOverviewPresentation";

export const EMPTY_PATIENT_PLAN_OVERVIEW = {
  summary: {
    active_plans: 0,
    paused_plans: 0,
    pending_agendas: 0,
    scope: "current_patient_service_filters",
  },
  groups: [],
  page_info: {
    page: 1,
    page_size: 25,
    total_groups: 0,
    total_plans: 0,
    total_pages: 0,
  },
};

export default function PatientPlansOverview({
  overview = EMPTY_PATIENT_PLAN_OVERVIEW,
  loading = false,
  error = "",
  patientSearch,
  onPatientSearchChange,
  serviceId,
  onServiceChange,
  status,
  onStatusChange,
  agenda,
  onAgendaChange,
  services,
  onPageChange,
  canLinkPlan = false,
  onLinkPlan,
}) {
  const data = overview || EMPTY_PATIENT_PLAN_OVERVIEW;
  const { summary, groups, page_info: pageInfo } = data;
  const hasFilters = Boolean(patientSearch.trim() || serviceId || status || agenda);
  const isCanceledFilter = status === "canceled";
  const firstGroup = pageInfo.total_groups === 0
    ? 0
    : ((pageInfo.page - 1) * pageInfo.page_size) + 1;
  const lastGroup = Math.min(
    pageInfo.page * pageInfo.page_size,
    pageInfo.total_groups,
  );

  let emptyText = "Nenhum plano atual encontrado.";
  if (isCanceledFilter) emptyText = "Nenhum plano encerrado.";
  else if (hasFilters) emptyText = "Nenhum plano encontrado com estes filtros.";

  return (
    <OverviewRoot>
      <OverviewTopLine>
        <OperationalSummary aria-label="Resumo operacional de Planos">
          <strong>{summary.active_plans}</strong> ativos
          <SummaryDivider aria-hidden="true">·</SummaryDivider>
          <strong>{summary.paused_plans}</strong> pausados
          <SummaryDivider aria-hidden="true">·</SummaryDivider>
          <strong>{summary.pending_agendas}</strong> agendas pendentes
        </OperationalSummary>
        {canLinkPlan && (
          <PrimaryButton type="button" onClick={onLinkPlan}>
            <FaPlus aria-hidden="true" /> Vincular plano
          </PrimaryButton>
        )}
      </OverviewTopLine>

      <Filters aria-label="Filtros de Planos">
        <PatientSearchField
          mode="filter"
          inputId="patient-plans-search"
          label="Paciente"
          value={patientSearch}
          onChange={onPatientSearchChange}
        />
        <FilterField>
          <span>Serviço</span>
          <select
            aria-label="Serviço"
            value={serviceId}
            onChange={(event) => onServiceChange(event.target.value)}
          >
            <option value="">Todos os serviços</option>
            {services.map((service) => (
              <option key={service.id} value={service.id}>{service.name}</option>
            ))}
          </select>
        </FilterField>
        <FilterField>
          <span>Status</span>
          <select
            aria-label="Status"
            value={status}
            onChange={(event) => onStatusChange(event.target.value)}
          >
            <option value="">Ativos e pausados</option>
            <option value="active">Ativos</option>
            <option value="paused">Pausados</option>
            <option value="canceled">Cancelados</option>
          </select>
        </FilterField>
        <FilterField>
          <span>Agenda</span>
          <select
            aria-label="Agenda"
            value={agenda}
            onChange={(event) => onAgendaChange(event.target.value)}
          >
            <option value="">Todas as situações</option>
            <option value="configured">Configurada</option>
            <option value="pending">Pendente</option>
          </select>
        </FilterField>
      </Filters>

      {loading && <DataLoadingState text="Carregando Planos..." compact />}
      {!loading && error && (
        <DataLoadingState tone="error" compact>{error}</DataLoadingState>
      )}
      {!loading && !error && groups.length === 0 && (
        <EmptyState>
          <span>{emptyText}</span>
          {!isCanceledFilter && !hasFilters && canLinkPlan && (
            <PrimaryButton type="button" onClick={onLinkPlan}>
              <FaPlus aria-hidden="true" /> Vincular plano
            </PrimaryButton>
          )}
        </EmptyState>
      )}
      {!loading && !error && groups.length > 0 && (
        <PlanList>
          <ColumnLabels aria-label="Colunas da lista de Planos">
            <span>Plano</span>
            <span>Agenda</span>
            <span>Status</span>
          </ColumnLabels>
          <Groups>
            {groups.map((group) => {
              const headingId = `patient-plan-group-${group.patient.id}`;
              return (
                <PatientGroup key={group.patient.id} aria-labelledby={headingId}>
                  <PatientHeading id={headingId}>{group.patient.name}</PatientHeading>
                  <PlanRows>
                    {group.plans.map((plan) => {
                      const agendaInfo = getOverviewAgendaPresentation(plan.agenda_state);
                      const statusInfo = getOverviewStatusPresentation(plan.status);
                      const frequencySubtitle = getPlanFrequencySubtitle(plan);
                      return (
                        <PlanRow
                          as={Link}
                          key={plan.patient_plan_id}
                          to={`/planos/pacientes/${plan.patient_plan_id}`}
                          $clickable
                          aria-label={`${plan.commercial_name} de ${group.patient.name}. Agenda ${agendaInfo.label}. Status ${statusInfo.label}.`}
                          onKeyDown={(event) => {
                            if (event.key === " ") {
                              event.preventDefault();
                              event.currentTarget.click();
                            }
                          }}
                        >
                          <PlanIdentity>
                            <strong>{plan.commercial_name}</strong>
                            {frequencySubtitle && <small>{frequencySubtitle}</small>}
                          </PlanIdentity>
                          <RowDatum>
                            <MobileLabel>Agenda</MobileLabel>
                            <StatusPill $tone={agendaInfo.tone}>{agendaInfo.label}</StatusPill>
                          </RowDatum>
                          <RowDatum>
                            <MobileLabel>Status</MobileLabel>
                            <StatusPill $tone={statusInfo.tone}>{statusInfo.label}</StatusPill>
                          </RowDatum>
                        </PlanRow>
                      );
                    })}
                  </PlanRows>
                </PatientGroup>
              );
            })}
          </Groups>
        </PlanList>
      )}

      {!loading && !error && pageInfo.total_groups > 0 && (
        <Pagination aria-label="Paginação de pacientes com Planos">
          <span>{firstGroup}–{lastGroup} de {pageInfo.total_groups} pacientes</span>
          <PaginationActions>
            <PaginationButton
              type="button"
              disabled={pageInfo.page <= 1}
              onClick={() => onPageChange(pageInfo.page - 1)}
            >
              Anterior
            </PaginationButton>
            <PaginationPage>
              Página {pageInfo.page} de {pageInfo.total_pages}
            </PaginationPage>
            <PaginationButton
              type="button"
              disabled={pageInfo.page >= pageInfo.total_pages}
              onClick={() => onPageChange(pageInfo.page + 1)}
            >
              Próxima
            </PaginationButton>
          </PaginationActions>
        </Pagination>
      )}
    </OverviewRoot>
  );
}

PatientPlansOverview.propTypes = {
  overview: PropTypes.shape({
    summary: PropTypes.shape({
      active_plans: PropTypes.number,
      paused_plans: PropTypes.number,
      pending_agendas: PropTypes.number,
    }),
    groups: PropTypes.arrayOf(PropTypes.shape({
      patient: PropTypes.shape({
        id: PropTypes.number,
        name: PropTypes.string,
      }),
      plans: PropTypes.arrayOf(PropTypes.shape({
        patient_plan_id: PropTypes.number,
      })),
    })),
    page_info: PropTypes.shape({
      page: PropTypes.number,
      page_size: PropTypes.number,
      total_groups: PropTypes.number,
      total_pages: PropTypes.number,
    }),
  }).isRequired,
  loading: PropTypes.bool.isRequired,
  error: PropTypes.string.isRequired,
  patientSearch: PropTypes.string.isRequired,
  onPatientSearchChange: PropTypes.func.isRequired,
  serviceId: PropTypes.string.isRequired,
  onServiceChange: PropTypes.func.isRequired,
  status: PropTypes.string.isRequired,
  onStatusChange: PropTypes.func.isRequired,
  agenda: PropTypes.string.isRequired,
  onAgendaChange: PropTypes.func.isRequired,
  services: PropTypes.arrayOf(PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    name: PropTypes.string,
  })).isRequired,
  onPageChange: PropTypes.func.isRequired,
  canLinkPlan: PropTypes.bool.isRequired,
  onLinkPlan: PropTypes.func.isRequired,
};

const OverviewRoot = styled.div`
  display: grid;
  gap: 14px;
`;

const OverviewTopLine = styled.div`
  align-items: center;
  display: flex;
  gap: 16px;
  justify-content: space-between;

  @media (max-width: 640px) {
    align-items: flex-start;
    flex-direction: column;
  }
`;

const OperationalSummary = styled.p`
  color: ${colors.textSecondary};
  font-size: ${fontSizes.body};
  margin: 0;

  strong {
    color: ${colors.textPrimary};
    font-weight: 800;
  }
`;

const SummaryDivider = styled.span`
  color: ${colors.textMuted};
  margin: 0 8px;
`;

const Filters = styled.div`
  align-items: end;
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
`;

const FilterField = styled.label`
  color: ${colors.brandDark};
  display: flex;
  flex-direction: column;
  font-size: ${fontSizes.compact};
  font-weight: 700;
  gap: 6px;
  min-width: 160px;

  select {
    background: ${colors.surface};
    border: 1px solid ${alpha.brand022};
    border-radius: ${radii.sm};
    color: ${colors.textPrimary};
    min-height: 40px;
    padding: 8px 11px;
  }
`;

const Groups = styled.div`
  display: grid;
  gap: 24px;
`;

const PlanList = styled.div`
  display: grid;
  gap: 10px;
`;

const PatientGroup = styled.section`
  display: grid;
  gap: 8px;
`;

const PatientHeading = styled.h2`
  color: ${colors.textPrimary};
  font-size: 1rem;
  font-weight: 800;
  margin: 0;
  padding: 0 10px;
`;

const ColumnLabels = styled.div`
  color: ${colors.textMuted};
  display: grid;
  font-size: ${fontSizes.tiny};
  font-weight: 700;
  gap: 16px;
  grid-template-columns: minmax(0, 1fr) 140px 120px;
  padding: 0 14px;
  text-transform: uppercase;

  @media (max-width: 720px) {
    display: none;
  }
`;

const PlanRows = styled.div`
  display: grid;
  gap: 7px;
`;

const PlanRow = styled(InteractiveListRowSurface)`
  align-items: center;
  display: grid;
  gap: 16px;
  grid-template-columns: minmax(0, 1fr) 140px 120px;
  min-height: 54px;
  padding: 10px 14px;

  @media (max-width: 720px) {
    align-items: start;
    gap: 10px;
    grid-template-columns: 1fr 1fr;
  }
`;

const PlanIdentity = styled.div`
  min-width: 0;

  strong {
    color: ${colors.textPrimary};
    display: block;
    font-size: 0.94rem;
    font-weight: 700;
    overflow-wrap: anywhere;
  }

  small {
    color: ${colors.textMuted};
    display: block;
    font-size: ${fontSizes.small};
    margin-top: 2px;
  }

  @media (max-width: 720px) {
    grid-column: 1 / -1;
  }
`;

const RowDatum = styled.div`
  align-items: flex-start;
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

const MobileLabel = styled.span`
  color: ${colors.textMuted};
  display: none;
  font-size: ${fontSizes.tiny};
  font-weight: 700;
  text-transform: uppercase;

  @media (max-width: 720px) {
    display: inline;
  }
`;

const EmptyState = styled.div`
  align-items: center;
  border: 1px dashed ${alpha.brand022};
  border-radius: ${radii.lg};
  color: ${colors.textSecondary};
  display: flex;
  flex-direction: column;
  gap: 14px;
  justify-content: center;
  min-height: 150px;
  padding: 24px;
  text-align: center;
`;

const Pagination = styled.nav`
  align-items: center;
  color: ${colors.textSecondary};
  display: flex;
  font-size: ${fontSizes.compact};
  gap: 16px;
  justify-content: space-between;

  @media (max-width: 640px) {
    align-items: stretch;
    flex-direction: column;
  }
`;

const PaginationActions = styled.div`
  align-items: center;
  display: flex;
  gap: 8px;
`;

const PaginationButton = styled.button`
  background: ${colors.surface};
  border: 1px solid ${alpha.brand022};
  border-radius: ${radii.sm};
  color: ${colors.brand};
  cursor: pointer;
  font-weight: 700;
  padding: 7px 11px;

  &:disabled {
    background: ${colors.disabledBackground};
    color: ${colors.disabledText};
    cursor: not-allowed;
  }

  &:focus-visible {
    outline: 2px solid ${colors.focus};
    outline-offset: 2px;
  }
`;

const PaginationPage = styled.span`
  min-width: 112px;
  text-align: center;
`;
