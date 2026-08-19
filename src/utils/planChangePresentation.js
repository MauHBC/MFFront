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
  const effectiveOn = preview?.effective_on || preview?.next_cycle_start || null;
  const currentEndsOn = preview?.current_plan_ends_on || preview?.current_cycle_end || null;
  const ready = status === 'success' && !!effectiveOn && !!currentEndsOn && !!preview?.preview_token;

  if (status === 'loading') {
    return {
      ready: false,
      status_text: 'Calculando a vigência...',
      effective_label: null,
      current_ends_label: null,
      confirmation_text: null,
    };
  }
  if (status === 'error') {
    return {
      ready: false,
      status_text: error || 'Não foi possível calcular a vigência. Tente novamente.',
      effective_label: null,
      current_ends_label: null,
      confirmation_text: null,
    };
  }
  if (!ready) {
    return {
      ready: false,
      status_text: 'Selecione o novo plano para calcular a vigência.',
      effective_label: null,
      current_ends_label: null,
      confirmation_text: null,
    };
  }

  const effectiveLabel = formatDateBR(effectiveOn);
  const currentEndsLabel = formatDateBR(currentEndsOn);
  return {
    ready: true,
    status_text: `Plano atual até ${currentEndsLabel} · Novo em ${effectiveLabel}`,
    effective_label: effectiveLabel,
    current_ends_label: currentEndsLabel,
    confirmation_text: `Plano atual segue até ${currentEndsLabel}.`,
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
