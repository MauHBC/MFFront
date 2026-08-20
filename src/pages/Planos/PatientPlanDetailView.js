import React, { useEffect, useRef } from "react";
import PropTypes from "prop-types";
import styled from "styled-components";
import { FaArrowLeft, FaCalendarAlt, FaTimes } from "react-icons/fa";

import AppActionMenu, { AppActionMenuItem } from "../../components/AppActionMenu";
import { PrimaryButton, GhostButton } from "../../components/AppButton";
import {
  AppDrawer,
  DrawerBackdrop,
  DrawerHeader,
  DrawerTitle,
  DrawerCloseBtn,
  DrawerBody,
  DrawerFooter,
} from "../../components/AppDrawer";
import { Field, FieldHint } from "../../components/AppForm";
import { StatusPill } from "../../components/AppStatus";
import DataLoadingState from "../../components/DataLoadingState";
import { alpha, colors, fontSizes, radii, shadows, spacing } from "../../styles/tokens";
import { formatCompactDate } from "./patientPlanDetailPresentation";

const TABS = [
  { id: "plan", label: "Plano" },
  { id: "agenda", label: "Agenda" },
  { id: "history", label: "Histórico" },
];

export function PatientPlanDetailHeader({
  patientName,
  planSummary,
  activeTab,
  onBack,
  onTabChange,
}) {
  const tabRefs = useRef({});
  const handleTabKeyDown = (event, currentIndex) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    let nextIndex = currentIndex;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = TABS.length - 1;
    if (event.key === "ArrowRight") nextIndex = (currentIndex + 1) % TABS.length;
    if (event.key === "ArrowLeft") nextIndex = (currentIndex - 1 + TABS.length) % TABS.length;
    const nextTab = TABS[nextIndex];
    onTabChange(nextTab.id);
    tabRefs.current[nextTab.id]?.focus();
  };

  return (
    <DetailHeader>
      <BackButton type="button" onClick={onBack}>
        <FaArrowLeft aria-hidden="true" /> Pacientes com plano
      </BackButton>
      <PatientName>{patientName || "—"}</PatientName>
      {planSummary && <PatientPlanSummary>{planSummary}</PatientPlanSummary>}
      <DetailTabs role="tablist" aria-label="Seções do plano mensal">
        {TABS.map((tab, index) => (
          <DetailTab
            key={tab.id}
            ref={(element) => { tabRefs.current[tab.id] = element; }}
            id={`patient-plan-tab-${tab.id}`}
            type="button"
            role="tab"
            $active={activeTab === tab.id}
            aria-selected={activeTab === tab.id}
            aria-controls={`patient-plan-panel-${tab.id}`}
            tabIndex={activeTab === tab.id ? 0 : -1}
            onClick={() => onTabChange(tab.id)}
            onKeyDown={(event) => handleTabKeyDown(event, index)}
          >
            {tab.label}
          </DetailTab>
        ))}
      </DetailTabs>
    </DetailHeader>
  );
}

PatientPlanDetailHeader.propTypes = {
  patientName: PropTypes.string,
  planSummary: PropTypes.string,
  activeTab: PropTypes.oneOf(TABS.map((tab) => tab.id)).isRequired,
  onBack: PropTypes.func.isRequired,
  onTabChange: PropTypes.func.isRequired,
};

PatientPlanDetailHeader.defaultProps = {
  patientName: "",
  planSummary: "",
};

export function PatientPlanTabPanel({ tabId, activeTab, children }) {
  if (tabId !== activeTab) return null;
  return (
    <DetailPanel
      id={`patient-plan-panel-${tabId}`}
      role="tabpanel"
      aria-labelledby={`patient-plan-tab-${tabId}`}
      tabIndex={0}
    >
      {children}
    </DetailPanel>
  );
}

PatientPlanTabPanel.propTypes = {
  tabId: PropTypes.oneOf(TABS.map((tab) => tab.id)).isRequired,
  activeTab: PropTypes.oneOf(TABS.map((tab) => tab.id)).isRequired,
  children: PropTypes.node.isRequired,
};

function DetailActionMenu({ label, actions }) {
  const visibleActions = actions.filter((action) => action?.visible !== false);
  if (!visibleActions.length) return null;
  return (
    <AppActionMenu label={label} compact>
      {visibleActions.map((action) => (
        <DetailMenuItem
          key={action.label}
          type="button"
          $critical={action.critical}
          disabled={action.disabled}
          onClick={action.onClick}
        >
          {action.label}
        </DetailMenuItem>
      ))}
    </AppActionMenu>
  );
}

DetailActionMenu.propTypes = {
  label: PropTypes.string.isRequired,
  actions: PropTypes.arrayOf(PropTypes.shape({
    label: PropTypes.string.isRequired,
    onClick: PropTypes.func.isRequired,
    visible: PropTypes.bool,
    critical: PropTypes.bool,
    disabled: PropTypes.bool,
  })),
};

DetailActionMenu.defaultProps = { actions: [] };

export function ScheduledChangePanel({
  eyebrow,
  metadata,
  title,
  detail,
  agendaComparison,
  trailingDetail,
  secondaryDetail,
  onEdit,
  menuActions,
}) {
  return (
    <FuturePanel>
      <FuturePanelContent>
        <FutureEyebrow>{eyebrow}</FutureEyebrow>
        {metadata && <FutureSecondary>{metadata}</FutureSecondary>}
        <FutureTitle>{title}</FutureTitle>
        {detail && <FutureDetail>{detail}</FutureDetail>}
        {agendaComparison && (
          <FutureAgendaGroup>
            <FutureAgendaLabel>Agenda</FutureAgendaLabel>
            <FutureAgendaLines>
              <span>Atual: {agendaComparison.current}</span>
              <span>Nova: {agendaComparison.proposed}</span>
            </FutureAgendaLines>
          </FutureAgendaGroup>
        )}
        {trailingDetail && <FutureDetail>{trailingDetail}</FutureDetail>}
        {secondaryDetail && <FutureSecondary>{secondaryDetail}</FutureSecondary>}
      </FuturePanelContent>
      {(onEdit || menuActions.length > 0) && (
        <CompactActions>
          {onEdit && <InlineAction type="button" onClick={onEdit}>Editar</InlineAction>}
          <DetailActionMenu label={`Ações de ${eyebrow}`} actions={menuActions} />
        </CompactActions>
      )}
    </FuturePanel>
  );
}

ScheduledChangePanel.propTypes = {
  eyebrow: PropTypes.string.isRequired,
  metadata: PropTypes.string,
  title: PropTypes.string.isRequired,
  detail: PropTypes.string,
  agendaComparison: PropTypes.shape({
    current: PropTypes.string.isRequired,
    proposed: PropTypes.string.isRequired,
  }),
  trailingDetail: PropTypes.string,
  secondaryDetail: PropTypes.string,
  onEdit: PropTypes.func,
  menuActions: PropTypes.arrayOf(PropTypes.shape({})),
};

ScheduledChangePanel.defaultProps = {
  metadata: "",
  detail: "",
  agendaComparison: null,
  trailingDetail: "",
  secondaryDetail: "",
  onEdit: null,
  menuActions: [],
};

export function PlanSummaryCard({
  loading,
  title,
  statusLabel,
  statusTone,
  billingSummary,
  startSummary,
  notes,
  stateNote,
  primaryAction,
  secondaryAction,
  menuActions,
  children,
}) {
  if (loading) return <SummaryCard><DataLoadingState text="Carregando plano..." compact /></SummaryCard>;
  return (
    <SummaryCard>
      <SummaryHeader>
        <SummaryHeadingGroup>
          <SummaryTitleLine>
            <SummaryTitle>{title}</SummaryTitle>
            <StatusPill $tone={statusTone}>{statusLabel}</StatusPill>
          </SummaryTitleLine>
          {billingSummary && <SummaryLead>{billingSummary}</SummaryLead>}
          {startSummary && <SummaryMeta>{startSummary}</SummaryMeta>}
        </SummaryHeadingGroup>
        <ContextActions>
          {primaryAction && (
            <PrimaryButton
              type="button"
              disabled={primaryAction.disabled}
              onClick={primaryAction.onClick}
            >
              {primaryAction.label}
            </PrimaryButton>
          )}
          {secondaryAction && (
            <InlineAction
              type="button"
              disabled={secondaryAction.disabled}
              onClick={secondaryAction.onClick}
            >
              {secondaryAction.label}
            </InlineAction>
          )}
          <DetailActionMenu label="Ações do plano" actions={menuActions} />
        </ContextActions>
      </SummaryHeader>
      {stateNote && <StateNote>{stateNote}</StateNote>}
      {notes && (
        <NotesDisclosure>
          <summary>Observações</summary>
          <p>{notes}</p>
        </NotesDisclosure>
      )}
      {children}
    </SummaryCard>
  );
}

PlanSummaryCard.propTypes = {
  loading: PropTypes.bool,
  title: PropTypes.string.isRequired,
  statusLabel: PropTypes.string.isRequired,
  statusTone: PropTypes.string,
  billingSummary: PropTypes.string,
  startSummary: PropTypes.string,
  notes: PropTypes.string,
  stateNote: PropTypes.node,
  primaryAction: PropTypes.shape({
    label: PropTypes.string.isRequired,
    onClick: PropTypes.func.isRequired,
    disabled: PropTypes.bool,
  }),
  secondaryAction: PropTypes.shape({
    label: PropTypes.string.isRequired,
    onClick: PropTypes.func.isRequired,
    disabled: PropTypes.bool,
  }),
  menuActions: PropTypes.arrayOf(PropTypes.shape({})),
  children: PropTypes.node,
};

PlanSummaryCard.defaultProps = {
  loading: false,
  statusTone: "neutral",
  billingSummary: "",
  startSummary: "",
  notes: "",
  stateNote: "",
  primaryAction: null,
  secondaryAction: null,
  menuActions: [],
  children: null,
};

export function AgendaSummaryCard({
  loading,
  title,
  statusLabel,
  statusTone,
  pattern,
  supportingText,
  empty,
  primaryAction,
  onOpenAgenda,
  menuActions,
  blockedMessage,
  children,
}) {
  if (loading) return <SummaryCard><DataLoadingState text="Carregando agenda..." compact /></SummaryCard>;
  return (
    <SummaryCard>
      <SummaryHeader>
        <SummaryHeadingGroup>
          <SummaryTitleLine>
            <SummaryTitle>{title}</SummaryTitle>
            {statusLabel && <StatusPill $tone={statusTone}>{statusLabel}</StatusPill>}
          </SummaryTitleLine>
          {pattern && <AgendaPattern>{pattern}</AgendaPattern>}
          {supportingText && <SummaryMeta>{supportingText}</SummaryMeta>}
        </SummaryHeadingGroup>
        <ContextActions>
          {primaryAction && (
            <PrimaryButton
              type="button"
              disabled={primaryAction.disabled}
              onClick={primaryAction.onClick}
            >
              <FaCalendarAlt aria-hidden="true" /> {primaryAction.label}
            </PrimaryButton>
          )}
          {onOpenAgenda && (
            <InlineAction type="button" onClick={onOpenAgenda}>Abrir Agenda</InlineAction>
          )}
          <DetailActionMenu label="Ações da agenda recorrente" actions={menuActions} />
        </ContextActions>
      </SummaryHeader>
      {empty && !pattern && <CompactEmpty>{empty}</CompactEmpty>}
      {blockedMessage && <BlockedNote role="status">{blockedMessage}</BlockedNote>}
      {children}
    </SummaryCard>
  );
}

AgendaSummaryCard.propTypes = {
  loading: PropTypes.bool,
  title: PropTypes.string.isRequired,
  statusLabel: PropTypes.string,
  statusTone: PropTypes.string,
  pattern: PropTypes.string,
  supportingText: PropTypes.string,
  empty: PropTypes.string,
  primaryAction: PropTypes.shape({
    label: PropTypes.string.isRequired,
    onClick: PropTypes.func.isRequired,
    disabled: PropTypes.bool,
  }),
  onOpenAgenda: PropTypes.func,
  menuActions: PropTypes.arrayOf(PropTypes.shape({})),
  blockedMessage: PropTypes.string,
  children: PropTypes.node,
};

AgendaSummaryCard.defaultProps = {
  loading: false,
  statusLabel: "",
  statusTone: "neutral",
  pattern: "",
  supportingText: "",
  empty: "",
  primaryAction: null,
  onOpenAgenda: null,
  menuActions: [],
  blockedMessage: "",
  children: null,
};

export function HistoryTimelineCard({ children }) {
  return (
    <SummaryCard>
      <SummaryTitle>Linha do tempo</SummaryTitle>
      {children}
    </SummaryCard>
  );
}

HistoryTimelineCard.propTypes = {
  children: PropTypes.node.isRequired,
};

const FOCUSABLE = [
  "button:not(:disabled)",
  "input:not(:disabled)",
  "select:not(:disabled)",
  "textarea:not(:disabled)",
  "[href]",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

export function ScheduleChangeDrawer({
  open,
  busy,
  form,
  frequency,
  professionals,
  professionalsLoading,
  professionalError,
  weekdayOptions,
  timeOptions,
  allowBrokenTime,
  preview,
  previewPattern,
  currentPattern,
  professionalChange,
  issues,
  errorMessage,
  onClose,
  onFieldChange,
  onWeekdayToggle,
  onTimeChange,
  onPreview,
  onConfirm,
}) {
  const drawerRef = useRef(null);
  const titleRef = useRef(null);
  const restoreFocusRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    restoreFocusRef.current = document.activeElement;
    titleRef.current?.focus();
    const handleKeyDown = (event) => {
      if (event.key === "Escape" && !busy) {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = Array.from(drawerRef.current?.querySelectorAll(FOCUSABLE) || []);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      restoreFocusRef.current?.focus?.();
    };
  }, [busy, onClose, open]);

  if (!open) return null;

  return (
    <>
      <AppDrawer
        ref={drawerRef}
        $open={open}
        role="dialog"
        aria-modal="true"
        aria-labelledby="schedule-change-title"
      >
        <DrawerHeader>
          <DrawerTitle id="schedule-change-title" ref={titleRef} tabIndex={-1}>
            Alterar agenda
          </DrawerTitle>
          <DrawerCloseBtn type="button" onClick={onClose} disabled={busy} aria-label="Fechar">
            <FaTimes aria-hidden="true" />
          </DrawerCloseBtn>
        </DrawerHeader>
        <DrawerBody>
          <ScheduleChangeForm onSubmit={(event) => { event.preventDefault(); onPreview(); }}>
            <Field htmlFor="schedule-change-effective-on">
              Nova agenda a partir de
              <input
                id="schedule-change-effective-on"
                type="date"
                min={form.minimum_effective_on}
                name="effective_on"
                value={form.effective_on}
                disabled={busy}
                onChange={onFieldChange}
              />
            </Field>
            <Field htmlFor="schedule-change-professional">
              Profissional
              <select
                id="schedule-change-professional"
                name="professional_user_id"
                value={form.professional_user_id}
                disabled={busy || professionalsLoading}
                onChange={onFieldChange}
              >
                <option value="">Selecione...</option>
                {professionals.map((professional) => (
                  <option key={professional.id} value={professional.id}>{professional.name}</option>
                ))}
              </select>
              {professionalError && <FieldHint>{professionalError}</FieldHint>}
            </Field>
            <fieldset>
              <legend>Dias da semana</legend>
              <WeekdayGrid>
                {weekdayOptions.map((option) => {
                  const selected = form.weekdays.includes(option.value);
                  return (
                    <WeekdayButton
                      key={option.value}
                      type="button"
                      $selected={selected}
                      aria-pressed={selected}
                      disabled={busy || (!selected && form.weekdays.length >= frequency)}
                      onClick={() => onWeekdayToggle(option.value)}
                    >
                      {option.label}
                    </WeekdayButton>
                  );
                })}
              </WeekdayGrid>
              <FieldHint>Selecione {frequency} dia(s).</FieldHint>
            </fieldset>
            {form.weekdays.length > 0 && (
              <ScheduleTimes>
                {form.weekdays.slice().sort((a, b) => a - b).map((weekday) => {
                  const option = weekdayOptions.find((item) => item.value === weekday);
                  const inputId = `schedule-change-time-${weekday}`;
                  return (
                    <Field key={weekday} htmlFor={inputId}>
                      Horário de {option?.label || weekday}
                      {allowBrokenTime ? (
                        <input
                          id={inputId}
                          type="time"
                          value={form.times_by_weekday[String(weekday)] || ""}
                          disabled={busy}
                          onChange={(event) => onTimeChange(weekday, event.target.value)}
                        />
                      ) : (
                        <select
                          id={inputId}
                          value={form.times_by_weekday[String(weekday)] || ""}
                          disabled={busy}
                          onChange={(event) => onTimeChange(weekday, event.target.value)}
                        >
                          {timeOptions.map((optionItem) => (
                            <option key={optionItem.value} value={optionItem.value}>
                              {optionItem.label}
                            </option>
                          ))}
                        </select>
                      )}
                    </Field>
                  );
                })}
              </ScheduleTimes>
            )}
            {errorMessage && <ErrorNote role="alert">{errorMessage}</ErrorNote>}
            {issues.length > 0 && (
              <IssueList aria-label="Impedimentos da alteração">
                {issues.map((issue) => (
                  <IssueItem key={issue.key}>
                    <strong>{issue.title}</strong>
                    <span>{issue.detail}</span>
                  </IssueItem>
                ))}
              </IssueList>
            )}
            {preview?.status === "loading" && (
              <DataLoadingState text="Revisando nova agenda..." compact />
            )}
            {preview?.status === "success" && (
              <PreviewPanel aria-live="polite">
                <PreviewColumn>
                  <span>Atual</span>
                  <strong>{currentPattern || "—"}</strong>
                </PreviewColumn>
                <PreviewColumn>
                  <span>Nova · a partir de {formatCompactDate(preview.data?.effective_on)}</span>
                  <strong>{previewPattern || "—"}</strong>
                </PreviewColumn>
                {professionalChange && <PreviewProfessional>{professionalChange}</PreviewProfessional>}
              </PreviewPanel>
            )}
          </ScheduleChangeForm>
          <DrawerFooter>
            <GhostButton type="button" onClick={onClose} disabled={busy}>Voltar</GhostButton>
            {preview?.status === "success" && preview.data?.can_confirm ? (
              <PrimaryButton type="button" onClick={onConfirm} disabled={busy}>
                {busy ? "Confirmando..." : "Confirmar alteração"}
              </PrimaryButton>
            ) : (
              <PrimaryButton type="button" onClick={onPreview} disabled={busy}>
                {preview?.status === "loading" ? "Revisando..." : "Revisar alteração"}
              </PrimaryButton>
            )}
          </DrawerFooter>
        </DrawerBody>
      </AppDrawer>
      <DrawerBackdrop onClick={busy ? undefined : onClose} />
    </>
  );
}

ScheduleChangeDrawer.propTypes = {
  open: PropTypes.bool.isRequired,
  busy: PropTypes.bool.isRequired,
  form: PropTypes.shape({
    effective_on: PropTypes.string.isRequired,
    minimum_effective_on: PropTypes.string.isRequired,
    professional_user_id: PropTypes.string.isRequired,
    weekdays: PropTypes.arrayOf(PropTypes.number).isRequired,
    times_by_weekday: PropTypes.objectOf(PropTypes.string).isRequired,
  }).isRequired,
  frequency: PropTypes.number.isRequired,
  professionals: PropTypes.arrayOf(PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
    name: PropTypes.string.isRequired,
  })).isRequired,
  professionalsLoading: PropTypes.bool.isRequired,
  professionalError: PropTypes.string,
  weekdayOptions: PropTypes.arrayOf(PropTypes.shape({
    value: PropTypes.number.isRequired,
    label: PropTypes.string.isRequired,
  })).isRequired,
  timeOptions: PropTypes.arrayOf(PropTypes.shape({
    value: PropTypes.string.isRequired,
    label: PropTypes.string.isRequired,
  })).isRequired,
  allowBrokenTime: PropTypes.bool.isRequired,
  preview: PropTypes.shape({
    status: PropTypes.string,
    data: PropTypes.shape({
      effective_on: PropTypes.string,
      can_confirm: PropTypes.bool,
    }),
  }).isRequired,
  previewPattern: PropTypes.string,
  currentPattern: PropTypes.string,
  professionalChange: PropTypes.string,
  issues: PropTypes.arrayOf(PropTypes.shape({
    key: PropTypes.string.isRequired,
    title: PropTypes.string.isRequired,
    detail: PropTypes.string.isRequired,
  })).isRequired,
  errorMessage: PropTypes.string,
  onClose: PropTypes.func.isRequired,
  onFieldChange: PropTypes.func.isRequired,
  onWeekdayToggle: PropTypes.func.isRequired,
  onTimeChange: PropTypes.func.isRequired,
  onPreview: PropTypes.func.isRequired,
  onConfirm: PropTypes.func.isRequired,
};

ScheduleChangeDrawer.defaultProps = {
  professionalError: "",
  previewPattern: "",
  currentPattern: "",
  professionalChange: "",
  errorMessage: "",
};

const DetailHeader = styled.header`
  display: grid;
  gap: ${spacing.xs};
  max-width: 960px;
`;

const BackButton = styled.button`
  align-items: center;
  background: transparent;
  border: 0;
  color: ${colors.brandDark};
  cursor: pointer;
  display: inline-flex;
  font-size: ${fontSizes.small};
  font-weight: 700;
  gap: 7px;
  justify-self: start;
  margin: 0 0 ${spacing.sm};
  padding: 4px 0;

  &:focus-visible {
    border-radius: ${radii.xs};
    outline: 3px solid ${alpha.brand014};
    outline-offset: 3px;
  }
`;

const PatientName = styled.h1`
  color: ${colors.textPrimary};
  font-size: clamp(1.45rem, 3vw, 2rem);
  line-height: 1.15;
  margin: 0;
`;

const PatientPlanSummary = styled.p`
  color: ${colors.textSecondary};
  font-size: ${fontSizes.body};
  margin: 2px 0 ${spacing.lg};
`;

const DetailTabs = styled.div`
  border-bottom: 1px solid ${colors.borderSubtle};
  display: flex;
  gap: ${spacing.xl};
`;

const DetailTab = styled.button`
  background: transparent;
  border: 0;
  border-bottom: 3px solid ${(props) => (props.$active ? colors.brand : "transparent")};
  color: ${(props) => (props.$active ? colors.textPrimary : colors.textSecondary)};
  cursor: pointer;
  font: inherit;
  font-weight: 700;
  min-height: 42px;
  padding: 0 0 9px;

  &:focus-visible {
    border-radius: ${radii.xs};
    outline: 3px solid ${alpha.brand014};
    outline-offset: 2px;
  }
`;

const DetailPanel = styled.section`
  max-width: 960px;
  padding-top: ${spacing.lg};

  &:focus {
    outline: none;
  }
`;

const SummaryCard = styled.section`
  background: ${colors.surface};
  border: 1px solid ${colors.borderSubtle};
  border-radius: ${radii.xl};
  box-shadow: ${shadows.subtle};
  display: grid;
  gap: ${spacing.lg};
  padding: ${spacing.xl};

  @media (max-width: 640px) {
    padding: ${spacing.lg};
  }
`;

const SummaryHeader = styled.div`
  align-items: flex-start;
  display: flex;
  gap: ${spacing.lg};
  justify-content: space-between;

  @media (max-width: 700px) {
    flex-direction: column;
  }
`;

const SummaryHeadingGroup = styled.div`
  display: grid;
  gap: ${spacing.sm};
  min-width: 0;
`;

const SummaryTitleLine = styled.div`
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: ${spacing.sm};
`;

const SummaryTitle = styled.h2`
  color: ${colors.textPrimary};
  font-size: 1.12rem;
  line-height: 1.3;
  margin: 0;
`;

const SummaryLead = styled.p`
  color: ${colors.textPrimary};
  font-size: 1rem;
  font-weight: 700;
  margin: 0;
`;

const AgendaPattern = styled(SummaryLead)`
  font-size: 1.08rem;
`;

const SummaryMeta = styled.p`
  color: ${colors.textSecondary};
  font-size: ${fontSizes.body};
  margin: 0;
`;

const ContextActions = styled.div`
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: ${spacing.sm};
  justify-content: flex-end;

  @media (max-width: 700px) {
    justify-content: flex-start;
    width: 100%;

    > ${PrimaryButton} {
      justify-content: center;
      min-height: 44px;
      width: 100%;
    }
  }
`;

const InlineAction = styled.button`
  background: transparent;
  border: 0;
  color: ${colors.brandDark};
  cursor: pointer;
  font: inherit;
  font-size: ${fontSizes.small};
  font-weight: 700;
  padding: 7px 5px;

  &:hover { text-decoration: underline; }
  &:disabled { cursor: not-allowed; opacity: 0.55; }
  &:focus-visible {
    border-radius: ${radii.xs};
    outline: 3px solid ${alpha.brand014};
  }
`;

const DetailMenuItem = styled(AppActionMenuItem)`
  color: ${(props) => (props.$critical ? colors.dangerText : colors.brandDark)};
`;

const StateNote = styled.div`
  background: ${alpha.paused018};
  border-radius: ${radii.md};
  color: ${colors.pausedText};
  display: grid;
  font-size: ${fontSizes.body};
  gap: ${spacing.xs};
  padding: 10px 12px;

  strong { font-weight: 800; }
  span { color: ${colors.textSecondary}; }
`;

const NotesDisclosure = styled.details`
  border-top: 1px solid ${colors.borderSubtle};
  color: ${colors.textSecondary};
  padding-top: ${spacing.md};

  summary {
    color: ${colors.brandDark};
    cursor: pointer;
    font-size: ${fontSizes.small};
    font-weight: 700;
  }

  p { margin: ${spacing.sm} 0 0; white-space: pre-wrap; }
`;

const FuturePanel = styled.section`
  align-items: flex-start;
  background: ${colors.surfaceSecondary};
  border: 1px solid ${alpha.brand014};
  border-radius: ${radii.lg};
  display: flex;
  gap: ${spacing.lg};
  justify-content: space-between;
  padding: ${spacing.lg};

  @media (max-width: 640px) { flex-direction: column; }
`;

const FuturePanelContent = styled.div`
  display: grid;
  gap: ${spacing.xs};
`;

const FutureEyebrow = styled.span`
  color: ${colors.infoText};
  font-size: ${fontSizes.tiny};
  font-weight: 800;
  letter-spacing: 0.03em;
  text-transform: uppercase;
`;

const FutureTitle = styled.strong`
  color: ${colors.textPrimary};
  font-size: ${fontSizes.body};
`;

const FutureDetail = styled.span`
  color: ${colors.textSecondary};
  font-size: ${fontSizes.body};
  white-space: pre-line;
`;

const FutureAgendaGroup = styled.div`
  display: grid;
  gap: 2px;
`;

const FutureAgendaLabel = styled.span`
  color: ${colors.textSecondary};
  font-size: ${fontSizes.small};
  font-weight: 700;
`;

const FutureAgendaLines = styled.div`
  color: ${colors.textSecondary};
  display: grid;
  font-size: ${fontSizes.body};
  gap: 2px;
  padding-left: ${spacing.sm};
`;

const FutureSecondary = styled.span`
  color: ${colors.textMuted};
  font-size: ${fontSizes.small};
`;

const CompactActions = styled.div`
  align-items: center;
  display: flex;
  gap: ${spacing.sm};
`;

const CompactEmpty = styled.p`
  color: ${colors.textSecondary};
  margin: 0;
`;

const BlockedNote = styled.div`
  background: ${alpha.paused018};
  border-radius: ${radii.md};
  color: ${colors.pausedText};
  font-size: ${fontSizes.body};
  padding: 10px 12px;
`;

const ScheduleChangeForm = styled.form`
  display: grid;
  gap: ${spacing.lg};

  fieldset {
    border: 0;
    margin: 0;
    padding: 0;
  }

  legend {
    color: ${colors.textPrimary};
    font-size: ${fontSizes.body};
    font-weight: 700;
    margin-bottom: ${spacing.sm};
  }
`;

const WeekdayGrid = styled.div`
  display: grid;
  gap: ${spacing.sm};
  grid-template-columns: repeat(5, minmax(0, 1fr));

  @media (max-width: 640px) { grid-template-columns: repeat(3, minmax(0, 1fr)); }
`;

const WeekdayButton = styled.button`
  background: ${(props) => (props.$selected ? colors.brand : colors.surface)};
  border: 1px solid ${(props) => (props.$selected ? colors.brand : alpha.brand028)};
  border-radius: ${radii.sm};
  color: ${(props) => (props.$selected ? colors.white : colors.brandDark)};
  cursor: pointer;
  font-weight: 700;
  min-height: 40px;

  &:disabled { cursor: not-allowed; opacity: 0.5; }
  &:focus-visible { outline: 3px solid ${alpha.brand014}; outline-offset: 2px; }
`;

const ScheduleTimes = styled.div`
  display: grid;
  gap: ${spacing.md};
  grid-template-columns: repeat(2, minmax(0, 1fr));

  @media (max-width: 520px) { grid-template-columns: 1fr; }
`;

const ErrorNote = styled.div`
  background: ${colors.dangerBackgroundHover};
  border: 1px solid ${colors.dangerBorder};
  border-radius: ${radii.md};
  color: ${colors.dangerText};
  font-size: ${fontSizes.body};
  font-weight: 700;
  padding: 10px 12px;
`;

const IssueList = styled.div`
  display: grid;
  gap: ${spacing.sm};
`;

const IssueItem = styled.div`
  border-left: 3px solid ${colors.warning};
  display: grid;
  gap: 2px;
  padding: 6px 10px;

  strong { color: ${colors.textPrimary}; font-size: ${fontSizes.small}; }
  span { color: ${colors.textSecondary}; font-size: ${fontSizes.small}; }
`;

const PreviewPanel = styled.section`
  background: ${colors.surfaceSecondary};
  border: 1px solid ${colors.borderSubtle};
  border-radius: ${radii.lg};
  display: grid;
  gap: ${spacing.lg};
  padding: ${spacing.lg};
`;

const PreviewColumn = styled.div`
  display: grid;
  gap: ${spacing.xs};

  span { color: ${colors.textMuted}; font-size: ${fontSizes.tiny}; font-weight: 800; text-transform: uppercase; }
  strong { color: ${colors.textPrimary}; font-size: ${fontSizes.body}; }
`;

const PreviewProfessional = styled.p`
  border-top: 1px solid ${colors.borderSubtle};
  color: ${colors.textSecondary};
  font-size: ${fontSizes.small};
  margin: 0;
  padding-top: ${spacing.md};
`;
