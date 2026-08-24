import React from "react";
import PropTypes from "prop-types";
import { Link } from "react-router-dom";
import styled from "styled-components";
import { FaPlus } from "react-icons/fa";

import { PrimaryButton } from "../../components/AppButton";
import { AppMetricCard } from "../../components/AppMetricCard";
import AppPagination from "../../components/AppPagination";
import DataLoadingState from "../../components/DataLoadingState";
import { InteractiveListRowSurface } from "../../components/InteractiveListRow";
import PatientSearchField from "../../components/PatientSearchField";
import { StatusPill } from "../../components/AppStatus";
import {
  alpha,
  colors,
  fontSizes,
  radii,
  shadows,
} from "../../styles/tokens";
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
  items: [],
  page_info: {
    page: 1,
    page_size: 10,
    total: 0,
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
  const { summary, items, page_info: pageInfo } = data;
  const hasFilters = Boolean(patientSearch.trim() || serviceId || status || agenda);
  const isCanceledFilter = status === "canceled";

  let emptyText = "Nenhum plano atual encontrado.";
  if (isCanceledFilter) emptyText = "Nenhum plano encerrado.";
  else if (hasFilters) emptyText = "Nenhum plano encontrado com estes filtros.";

  return (
    <OverviewRoot>
      <OperationalSummary role="group" aria-label="Resumo operacional de Planos">
        <AppMetricCard
          compact
          attention={false}
          label="Ativos"
          value={summary.active_plans}
          ariaLabel={`Filtrar Planos ativos: ${summary.active_plans}`}
          onClick={() => {
            onStatusChange("active");
            onPageChange(1);
          }}
        />
        <AppMetricCard
          compact
          attention={false}
          label="Pausados"
          value={summary.paused_plans}
          ariaLabel={`Filtrar Planos pausados: ${summary.paused_plans}`}
          onClick={() => {
            onStatusChange("paused");
            onPageChange(1);
          }}
        />
        <AppMetricCard
          compact
          attention={summary.pending_agendas > 0}
          label="Agendas pendentes"
          value={summary.pending_agendas}
          ariaLabel={`Filtrar Planos com Agenda pendente: ${summary.pending_agendas}`}
          onClick={() => {
            onAgendaChange("pending");
            onPageChange(1);
          }}
        />
      </OperationalSummary>

      <Filters aria-label="Filtros de Planos">
        <PatientFilter
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
            <option value="">Todos</option>
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
            <option value="">Todas</option>
            <option value="configured">Configurada</option>
            <option value="pending">Pendente</option>
          </select>
        </FilterField>
      </Filters>

      {loading && <DataLoadingState text="Carregando Planos..." compact />}
      {!loading && error && (
        <DataLoadingState tone="error" compact>{error}</DataLoadingState>
      )}
      {!loading && !error && items.length === 0 && (
        <EmptyState>
          <span>{emptyText}</span>
          {!isCanceledFilter && !hasFilters && canLinkPlan && (
            <PrimaryButton type="button" onClick={onLinkPlan}>
              <FaPlus aria-hidden="true" /> Vincular plano
            </PrimaryButton>
          )}
        </EmptyState>
      )}
      {!loading && !error && items.length > 0 && (
        <PlanList>
          <ListHeader aria-label="Colunas da lista de Planos">
            <span>Paciente</span>
            <span>Plano</span>
            <span>Agenda</span>
            <span>Status</span>
          </ListHeader>
          <PlanRows>
            {items.map((plan) => {
              const agendaInfo = getOverviewAgendaPresentation(plan.agenda_state);
              const statusInfo = getOverviewStatusPresentation(plan.status);
              const frequencySubtitle = getPlanFrequencySubtitle(plan);
              return (
                <PlanRow
                  as={Link}
                  key={plan.patient_plan_id}
                  to={`/planos/pacientes/${plan.patient_plan_id}`}
                  $clickable
                  aria-label={`${plan.patient.name}. ${plan.commercial_name}. Agenda ${agendaInfo.label}. Status ${statusInfo.label}.`}
                  onKeyDown={(event) => {
                    if (event.key === " ") {
                      event.preventDefault();
                      event.currentTarget.click();
                    }
                  }}
                >
                  <PatientIdentity>
                    <MobileLabel>Paciente</MobileLabel>
                    <strong>{plan.patient.name}</strong>
                  </PatientIdentity>
                  <PlanIdentity>
                    <MobileLabel>Plano</MobileLabel>
                    <strong>{plan.commercial_name}</strong>
                    {frequencySubtitle && <small>{frequencySubtitle}</small>}
                  </PlanIdentity>
                  <RowDatum>
                    <MobileLabel>Agenda</MobileLabel>
                    <AgendaState
                      $attention={plan.agenda_state === "pending"}
                      $tone={agendaInfo.tone}
                    >
                      {agendaInfo.label}
                    </AgendaState>
                  </RowDatum>
                  <RowDatum>
                    <MobileLabel>Status</MobileLabel>
                    <StatusPill $tone={statusInfo.tone}>{statusInfo.label}</StatusPill>
                  </RowDatum>
                </PlanRow>
              );
            })}
          </PlanRows>
        </PlanList>
      )}

      {!error && (
        <AppPagination
          page={pageInfo.page}
          pageSize={pageInfo.page_size}
          total={pageInfo.total}
          totalPages={pageInfo.total_pages}
          loading={loading}
          onPageChange={onPageChange}
          ariaLabel="Paginação de Planos"
        />
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
    items: PropTypes.arrayOf(PropTypes.shape({
      patient: PropTypes.shape({
        id: PropTypes.number,
        name: PropTypes.string,
      }),
      patient_plan_id: PropTypes.number,
    })),
    page_info: PropTypes.shape({
      page: PropTypes.number,
      page_size: PropTypes.number,
      total: PropTypes.number,
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
  gap: 12px;
`;

const OperationalSummary = styled.div`
  display: grid;
  gap: 10px;
  grid-template-columns: repeat(3, minmax(140px, 1fr));
  margin: 0;
  max-width: 720px;
  width: 100%;

  @media (max-width: 640px) {
    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  }
`;

const Filters = styled.div`
  align-items: end;
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
`;

const PatientFilter = styled(PatientSearchField)`
  color: ${colors.brandDark};
  flex: 1 1 320px;
  font-size: ${fontSizes.compact};
  font-weight: 700;
  max-width: 480px;
  min-width: 280px;

  @media (max-width: 640px) {
    max-width: none;
    min-width: 100%;
  }
`;

const FilterField = styled.label`
  color: ${colors.brandDark};
  display: flex;
  flex-direction: column;
  font-size: ${fontSizes.compact};
  font-weight: 700;
  gap: 6px;
  flex: 0 1 172px;
  min-width: 148px;

  select {
    background: ${colors.surface};
    border: 1px solid ${alpha.brand022};
    border-radius: ${radii.sm};
    color: ${colors.textPrimary};
    min-height: 40px;
    padding: 8px 11px;
  }
`;

const PlanList = styled.div`
  display: grid;
  gap: 4px;
`;

const ListHeader = styled.div`
  color: ${colors.textMuted};
  display: grid;
  font-size: ${fontSizes.tiny};
  font-weight: 700;
  gap: 16px;
  grid-template-columns: minmax(180px, 1fr) minmax(220px, 1.25fr) 140px 120px;
  padding: 0 12px 4px;
  text-transform: uppercase;

  @media (max-width: 720px) {
    display: none;
  }
`;

const PlanRows = styled.div`
  display: grid;
  gap: 2px;
`;

const PlanRow = styled(InteractiveListRowSurface)`
  align-items: center;
  background: transparent;
  border-color: transparent;
  border-bottom-color: ${alpha.brand014};
  border-radius: ${radii.sm};
  box-shadow: none;
  display: grid;
  gap: 16px;
  grid-template-columns: minmax(180px, 1fr) minmax(220px, 1.25fr) 140px 120px;
  min-height: 48px;
  padding: 7px 12px;

  &:hover,
  &:focus-within {
    box-shadow: ${shadows.subtle};
  }

  @media (max-width: 720px) {
    align-items: start;
    gap: 10px;
    grid-template-columns: 1fr 1fr;
    padding: 8px 10px;
  }
`;

const PatientIdentity = styled.div`
  min-width: 0;

  strong {
    color: ${colors.textPrimary};
    display: block;
    font-size: 0.95rem;
    font-weight: 700;
    overflow-wrap: anywhere;
  }

  @media (max-width: 720px) {
    grid-column: 1 / -1;
  }
`;

const PlanIdentity = styled.div`
  min-width: 0;

  strong {
    color: ${colors.textPrimary};
    display: block;
    font-size: 0.92rem;
    font-weight: 600;
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

const AgendaState = styled(StatusPill)`
  background: ${(props) => (props.$attention ? alpha.paused018 : "transparent")};
  color: ${(props) => (props.$attention ? colors.pausedText : colors.textSecondary)};
  font-weight: ${(props) => (props.$attention ? 700 : 600)};
  padding: ${(props) => (props.$attention ? "3px 9px" : "3px 0")};
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
