const WEEKDAY_LABELS = {
  0: 'Dom',
  1: 'Seg',
  2: 'Ter',
  3: 'Qua',
  4: 'Qui',
  5: 'Sex',
  6: 'Sáb',
};

const formatDateBR = (value) => {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : '—';
};

const formatDayMonth = (value) => {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[3]}/${match[2]}` : '—';
};

const formatTime = (value) => String(value || '').slice(0, 5);

const formatSchedule = (value) => (Array.isArray(value)
  ? value
    .map((item) => `${WEEKDAY_LABELS[Number(item.weekday)] || item.weekday} ${formatTime(item.time)}`)
    .join(' · ')
  : '');

export const buildPlanChangePreviewPresentation = ({
  status,
  preview,
  error,
}) => {
  const effectiveMode = preview?.effective_mode || 'next_cycle';
  const effectiveOn = preview?.commercial_effective_on
    || preview?.effective_on
    || preview?.next_cycle_start
    || null;
  const scheduleEffectiveFrom = preview?.schedule_effective_from || effectiveOn;
  const currentEndsOn = preview?.current_plan_ends_on || preview?.current_cycle_end || null;
  const currentStartsOn = preview?.current_cycle_start || null;
  const nextStartsOn = preview?.next_cycle_start || null;
  const nextEndsOn = preview?.next_cycle_end || null;
  const periodStartsOn = effectiveMode === 'current_cycle' ? currentStartsOn : nextStartsOn;
  const periodEndsOn = effectiveMode === 'current_cycle' ? currentEndsOn : nextEndsOn;
  const preservedSessionsThrough = preview?.preserved_sessions_through || null;
  const ready = status === 'success'
    && preview?.can_confirm !== false
    && !!effectiveOn
    && !!periodStartsOn
    && !!periodEndsOn
    && !!scheduleEffectiveFrom
    && !!preservedSessionsThrough
    && !!preview?.preview_token;

  if (status === 'loading') {
    return {
      ready: false,
      status_text: preview ? 'Atualizando...' : 'Carregando períodos...',
      effective_label: null,
      schedule_effective_label: null,
      current_ends_label: null,
      period_label: null,
      confirmation_text: null,
    };
  }
  if (status === 'error') {
    return {
      ready: false,
      status_text: error || 'Não foi possível calcular a vigência. Tente novamente.',
      effective_label: null,
      schedule_effective_label: null,
      current_ends_label: null,
      period_label: null,
      confirmation_text: null,
    };
  }
  if (!ready) {
    return {
      ready: false,
      status_text: status === 'success' && preview?.can_confirm === false
        ? preview?.current_cycle_eligibility?.message
          || 'Esta opção não pode ser aplicada automaticamente.'
        : '',
      effective_label: null,
      schedule_effective_label: null,
      current_ends_label: null,
      period_label: null,
      confirmation_text: null,
    };
  }

  const effectiveLabel = formatDayMonth(effectiveOn);
  const scheduleEffectiveLabel = formatDayMonth(scheduleEffectiveFrom);
  const currentEndsLabel = formatDayMonth(currentEndsOn);
  const periodStartsLabel = formatDayMonth(periodStartsOn);
  const periodEndsLabel = formatDayMonth(periodEndsOn);
  const preservedSessionsThroughLabel = formatDayMonth(preservedSessionsThrough);
  const periodLabel = `${periodStartsLabel} a ${periodEndsLabel}`;
  if (effectiveMode === 'current_cycle') {
    return {
      ready: true,
      effective_mode: effectiveMode,
      status_text: [
        `A alteração será aplicada ao ciclo atual, de ${periodLabel}.`,
        `A nova agenda começa em ${scheduleEffectiveLabel}.`,
        `Os atendimentos até ${preservedSessionsThroughLabel} permanecem como estão.`,
      ].join('\n'),
      effective_label: effectiveLabel,
      schedule_effective_label: scheduleEffectiveLabel,
      current_ends_label: currentEndsLabel,
      period_label: periodLabel,
      preserved_through_label: preservedSessionsThroughLabel,
      current_cycle_financial_impact: preview?.current_cycle_financial_impact || null,
      confirmation_text: `Atendimentos até ${preservedSessionsThroughLabel} não serão alterados.`,
    };
  }
  return {
    ready: true,
    effective_mode: effectiveMode,
    status_text: [
      `A alteração será aplicada ao próximo ciclo, de ${periodLabel}.`,
      `A nova agenda começa em ${scheduleEffectiveLabel}.`,
      `Os atendimentos até ${preservedSessionsThroughLabel} permanecem como estão.`,
    ].join('\n'),
    effective_label: effectiveLabel,
    schedule_effective_label: scheduleEffectiveLabel,
    current_ends_label: currentEndsLabel,
    period_label: periodLabel,
    preserved_through_label: preservedSessionsThroughLabel,
    current_cycle_financial_impact: preview?.current_cycle_financial_impact || null,
    confirmation_text: `Atendimentos até ${preservedSessionsThroughLabel} não serão alterados.`,
  };
};

export const buildPlanCommercialDisplay = ({ currentPlanName, pendingChange }) => {
  const currentSchedule = formatSchedule(pendingChange?.previous_schedule);
  const futureSchedule = formatSchedule(pendingChange?.new_schedule);
  const pendingChangeEditable = pendingChange?.lifecycle_state === 'future_editable';

  return {
    current_plan_name: currentPlanName || '—',
    has_pending_change: !!pendingChange,
    pending_plan_name: pendingChange?.service_plan_name || null,
    pending_effective_on: pendingChange?.effective_on || null,
    pending_effective_label: pendingChange ? formatDateBR(pendingChange.effective_on) : null,
    current_schedule_text: currentSchedule,
    pending_schedule_text: futureSchedule,
    action_label: pendingChangeEditable ? 'Editar troca agendada' : 'Trocar plano',
    show_create_action: !pendingChange,
    show_edit_action: pendingChangeEditable,
    show_cancel_action: pendingChangeEditable,
  };
};

export default buildPlanCommercialDisplay;
