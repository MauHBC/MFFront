import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import PropTypes from "prop-types";
import styled from "styled-components";
import { Link, useHistory, useLocation } from "react-router-dom";
import { FaBell, FaBirthdayCake, FaTimes } from "react-icons/fa";
import { toast } from "react-toastify";

import axios, { getUserFacingApiError } from "../../services/axios";
import {
  AppDrawer,
  DrawerBackdrop,
} from "../AppDrawer";
import {
  colors,
  radii,
  typography,
} from "../../styles/tokens";

const ATTENDANCE_CONFIRMATION_TOLERANCE_MINUTES = 15;
const BIRTHDAY_ALERT_WINDOW_DAYS = 5;
const PENDING_CENTER_ACTION_STATE_KEY = "pendingCenterAction";

const OPERATIONAL_ALERT_SEVERITY_LABELS = {
  high: "Alta",
  medium: "Média",
  low: "Baixa",
};

const OPERATIONAL_ALERT_SEVERITY_ORDER = {
  high: 0,
  medium: 1,
  low: 2,
};

const PENDING_CENTER_CATEGORY_LABELS = {
  patient_plan_overdue: "Planos vencidos",
  patient_plan_expiring: "Planos vencendo",
  patient_plan_pause_overdue: "Pausas vencidas",
  patient_plan_pause_expiring: "Pausas terminando",
  standalone_session_credit_expiring: "Pacote de sessões acabando",
  replacement_credit: "Reposições pendentes",
  patient_birthday: "Aniversários",
  other: "Outros alertas",
};

const PENDING_CENTER_SECTION_LABELS = {
  urgent: "Urgentes",
  attention: "Atenção",
  reminders: "Lembretes",
};

const PENDING_CENTER_SECTION_ORDER = {
  urgent: 0,
  attention: 1,
  reminders: 2,
};

const PENDING_CENTER_MAIN_SECTIONS = [
  {
    key: "urgent",
    items: [
      { key: "attendance-to-finalize", kind: "attendance", label: "Atendimentos pendentes" },
      { key: "patient_plan_overdue", kind: "operational-alert", label: PENDING_CENTER_CATEGORY_LABELS.patient_plan_overdue },
      { key: "patient_plan_pause_overdue", kind: "operational-alert", label: PENDING_CENTER_CATEGORY_LABELS.patient_plan_pause_overdue },
    ],
  },
  {
    key: "attention",
    items: [
      { key: "patient_plan_expiring", kind: "operational-alert", label: PENDING_CENTER_CATEGORY_LABELS.patient_plan_expiring },
      { key: "patient_plan_pause_expiring", kind: "operational-alert", label: PENDING_CENTER_CATEGORY_LABELS.patient_plan_pause_expiring },
      { key: "standalone_session_credit_expiring", kind: "operational-alert", label: PENDING_CENTER_CATEGORY_LABELS.standalone_session_credit_expiring },
      { key: "replacement_credit", kind: "operational-alert", label: PENDING_CENTER_CATEGORY_LABELS.replacement_credit },
    ],
  },
  {
    key: "reminders",
    items: [
      { key: "patient_birthday", kind: "operational-alert", label: PENDING_CENTER_CATEGORY_LABELS.patient_birthday },
    ],
  },
];

const currentMonthKey = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
};

const getOperationalAlertCategory = (alert) => {
  const type = String(alert?.type || "");
  if (type === "patient_plan_overdue") return "patient_plan_overdue";
  if (type === "patient_plan_expiring") return "patient_plan_expiring";
  if (type === "patient_plan_pause_overdue") return "patient_plan_pause_overdue";
  if (type === "patient_plan_pause_expiring") return "patient_plan_pause_expiring";
  if (type.startsWith("standalone_session_credit")) return "standalone_session_credit_expiring";
  if (type.startsWith("replacement_credit")) return "replacement_credit";
  if (type.startsWith("patient_birthday")) return "patient_birthday";
  return "other";
};

const getOperationalAlertSection = (category) => {
  if (category === "patient_plan_overdue") return "urgent";
  if (category === "patient_plan_pause_overdue") return "urgent";
  if (category === "patient_birthday") return "reminders";
  return "attention";
};

const getOperationalAlertDueLabel = (alert) => {
  if (alert?.details?.due_date_label) return alert.details.due_date_label;
  if (String(alert?.type || "").startsWith("replacement_credit")) return "validade";
  return "data";
};

const pluralizeSession = (count) => `${count} ${count === 1 ? "sessão restante" : "sessões restantes"}`;

const getStandaloneCreditServiceName = (alert) => {
  if (alert?.details?.service_name) return alert.details.service_name;
  const [serviceName] = String(alert?.status || "").split(" - ");
  return serviceName || "Sessão avulsa";
};

const getStandaloneCreditQuantity = (alert) => {
  const remaining = Number(alert?.details?.remaining_sessions);
  if (Number.isFinite(remaining)) return remaining;
  const quantity = Number(alert?.quantity);
  return Number.isFinite(quantity) ? quantity : 0;
};

const groupStandaloneCreditAlerts = (alerts = []) => {
  const groupMap = new Map();
  alerts.forEach((alert) => {
    const serviceName = getStandaloneCreditServiceName(alert);
    const patientKey = `${alert.patient_id || alert.patient_name || "sem-paciente"}`;
    const existing = groupMap.get(patientKey) || {
      key: patientKey,
      patientId: alert.patient_id,
      patientName: alert.patient_name || "Paciente",
      services: new Map(),
    };
    const serviceKey = `${alert.details?.service_id || serviceName}`;
    const currentService = existing.services.get(serviceKey) || {
      key: serviceKey,
      serviceName,
      remainingSessions: 0,
      alertKeys: new Set(),
      alerts: [],
    };
    const alertKey = alert?.details?.alert_key || alert.centerKey;
    if (!currentService.alertKeys.has(alertKey)) {
      currentService.remainingSessions += getStandaloneCreditQuantity(alert);
      currentService.alertKeys.add(alertKey);
      currentService.alerts.push(alert);
    }
    existing.services.set(serviceKey, currentService);
    groupMap.set(patientKey, existing);
  });

  return Array.from(groupMap.values())
    .map((group) => ({
      ...group,
      services: Array.from(group.services.values())
        .filter((service) => service.remainingSessions === 1)
        .map((service) => ({ ...service, alertKeys: undefined })),
    }))
    .filter((group) => group.services.length > 0);
};

const countStandaloneCreditItems = (alerts = []) =>
  groupStandaloneCreditAlerts(alerts)
    .reduce((total, patientGroup) => total + patientGroup.services.length, 0);

const groupPlanAlertsByPatient = (alerts = []) => {
  const groupMap = new Map();
  alerts.forEach((alert) => {
    const patientKey = `${alert.patient_id || alert.patient_name || "sem-paciente"}`;
    const existing = groupMap.get(patientKey) || {
      key: patientKey,
      patientId: alert.patient_id,
      patientName: alert.patient_name || "Paciente",
      plans: new Map(),
    };
    const planKey = `${alert.details?.patient_plan_id || alert.centerKey}`;
    if (!existing.plans.has(planKey)) {
      existing.plans.set(planKey, { key: planKey, alert });
    }
    groupMap.set(patientKey, existing);
  });

  return Array.from(groupMap.values()).map((group) => ({
    ...group,
    plans: Array.from(group.plans.values()),
  }));
};

const countPlanAlertItems = (alerts = []) =>
  groupPlanAlertsByPatient(alerts)
    .reduce((total, patientGroup) => total + patientGroup.plans.length, 0);

const isPlanOperationalAlert = (key) => [
  "patient_plan_expiring",
  "patient_plan_overdue",
  "patient_plan_pause_expiring",
  "patient_plan_pause_overdue",
].includes(key);

const getBirthdayAlertDaysUntil = (alert) => {
  const daysUntil = Number(alert?.details?.days_until);
  return Number.isFinite(daysUntil) ? daysUntil : null;
};

const isBirthdayAlertInWindow = (alert) => {
  const daysUntil = getBirthdayAlertDaysUntil(alert);
  return daysUntil !== null && daysUntil >= 0 && daysUntil <= BIRTHDAY_ALERT_WINDOW_DAYS;
};

const formatDateOnlyLabel = (value) => {
  const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return "";
  return `${match[3]}/${match[2]}/${match[1]}`;
};

const getBirthdayGroupTitle = (group) => {
  if (group.daysUntil === 0) return "Aniversariante do dia";
  return formatDateOnlyLabel(group.dateKey) || group.birthdayLabel || "Próximos aniversários";
};

const getBirthdayGroupSubtitle = (group) => {
  if (group.daysUntil === 0) return group.birthdayLabel || "Hoje";
  if (group.daysUntil === 1) return "Amanhã";
  return `Em ${group.daysUntil} dias`;
};

const groupBirthdayAlertsByDate = (alerts = []) => {
  const groupMap = new Map();
  alerts.filter(isBirthdayAlertInWindow).forEach((alert) => {
    const daysUntil = getBirthdayAlertDaysUntil(alert);
    const dateKey = alert.due_date
      || alert.details?.next_birthday
      || alert.details?.birthday_label
      || `${daysUntil}`;
    const existing = groupMap.get(dateKey) || {
      key: dateKey,
      dateKey,
      daysUntil,
      birthdayLabel: alert.details?.birthday_label || "",
      alerts: [],
    };
    existing.alerts.push(alert);
    groupMap.set(dateKey, existing);
  });

  return Array.from(groupMap.values())
    .sort((first, second) => first.daysUntil - second.daysUntil)
    .map((group) => ({
      ...group,
      alerts: group.alerts.sort((first, second) =>
        String(first.patient_name || "").localeCompare(
          String(second.patient_name || ""),
          "pt-BR",
          { sensitivity: "base" },
        )),
    }));
};

const countBirthdayAlertItems = (alerts = []) => alerts.filter(isBirthdayAlertInWindow).length;

const getPlanAlertLink = (alert) => {
  const params = new URLSearchParams();
  if (alert?.type === "patient_plan_overdue") {
    params.set("view", "mensalidades");
    if (alert?.patient_name) params.set("patient_name", alert.patient_name);
    if (alert?.due_date) params.set("month", String(alert.due_date).slice(0, 7));
    return `/financeiro?${params.toString()}`;
  }
  params.set("tab", "patient-plans");
  if (alert?.patient_id) params.set("patient_id", String(alert.patient_id));
  if (alert?.patient_name) params.set("patient_name", alert.patient_name);
  if (alert?.details?.patient_plan_id) {
    params.set("patient_plan_id", String(alert.details.patient_plan_id));
  }
  return `/planos?${params.toString()}`;
};

const getPlanAlertDueText = (alert) => {
  if (!alert?.due_date) return alert?.status || "";
  if (alert?.type === "patient_plan_overdue") {
    return `Vencido desde ${formatDateOnlyLabel(alert.due_date) || alert.due_date}`;
  }
  if (alert?.type === "patient_plan_pause_overdue") {
    return `Fim previsto vencido desde ${formatDateOnlyLabel(alert.due_date) || alert.due_date}`;
  }
  if (alert?.type === "patient_plan_pause_expiring") {
    return `Pausa termina em ${formatDateOnlyLabel(alert.due_date) || alert.due_date}`;
  }
  return `Vence em ${alert.due_date}`;
};

const formatPendingDayLabel = (value) => {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
  });
};

const isScheduledStatus = (status) => !status || status === "scheduled" || status === "open";

const getSessionEndDate = (session, servicesById, servicesByCode) => {
  if (session?.ends_at) {
    const endsAt = new Date(session.ends_at);
    if (!Number.isNaN(endsAt.getTime())) return endsAt;
  }
  if (!session?.starts_at) return null;
  const startsAt = new Date(session.starts_at);
  if (Number.isNaN(startsAt.getTime())) return null;
  const service = servicesById.get(String(session.service_id || ""))
    || servicesByCode.get(String(session.service_type || ""))
    || session.Service
    || null;
  const durationMinutes = Number(service?.default_duration_minutes) || 60;
  return new Date(startsAt.getTime() + durationMinutes * 60000);
};

const fallbackContext = {
  pendingSessionsSource: [],
  updatePendingSessionsSource: () => {},
  updateServiceCatalog: () => {},
  refreshPendingSessions: async () => {},
  refreshOperationalAlerts: async () => {},
  setReferenceMonth: () => {},
  isOpen: false,
  total: 0,
  toggle: () => {},
  close: () => {},
  sections: PENDING_CENTER_MAIN_SECTIONS.map((section) => ({
    ...section,
    label: PENDING_CENTER_SECTION_LABELS[section.key],
    items: section.items.map((item) => ({ ...item, count: 0, alerts: [] })),
  })),
  selectedItem: null,
  setSelectedItemKey: () => {},
  pendingConfirmationGroups: [],
  isOperationalAlertsLoading: false,
  dismissStandaloneCreditAlerts: async () => {},
};

const PendingCenterContext = createContext(fallbackContext);

export function PendingCenterProvider({ children, enabled = true }) {
  const location = useLocation();
  const [pendingSessionsSource, setPendingSessionsSource] = useState([]);
  const [services, setServices] = useState([]);
  const [operationalAlerts, setOperationalAlerts] = useState([]);
  const [isOperationalAlertsLoading, setIsOperationalAlertsLoading] = useState(false);
  const [referenceMonth, setReferenceMonthState] = useState(currentMonthKey);
  const [currentTime, setCurrentTime] = useState(Date.now());
  const [isOpen, setIsOpen] = useState(false);
  const [selectedItemKey, setSelectedItemKey] = useState(null);
  const updatePendingSessionsSource = useCallback((updater) => {
    setPendingSessionsSource(updater);
  }, []);
  const updateServiceCatalog = useCallback((nextServices) => {
    setServices(Array.isArray(nextServices) ? nextServices : []);
  }, []);

  const setReferenceMonth = useCallback((month) => {
    const normalized = String(month || "");
    setReferenceMonthState(/^\d{4}-\d{2}$/.test(normalized) ? normalized : currentMonthKey());
  }, []);

  const refreshPendingSessions = useCallback(async () => {
    if (!enabled) return;
    try {
      const response = await axios.get("/sessions", {
        params: { status: "scheduled", to: new Date().toISOString() },
      });
      setPendingSessionsSource(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      toast.error(error?.response?.data?.error || "Não foi possível carregar as pendências.");
    }
  }, [enabled]);

  const refreshOperationalAlerts = useCallback(async (month = referenceMonth) => {
    if (!enabled) return;
    setIsOperationalAlertsLoading(true);
    try {
      const response = await axios.get("/operational-alerts", { params: { month } });
      setOperationalAlerts(Array.isArray(response.data?.alerts) ? response.data.alerts : []);
    } catch (error) {
      setOperationalAlerts([]);
      toast.error(
        error?.response?.data?.error || "Não foi possível carregar alertas operacionais.",
      );
    } finally {
      setIsOperationalAlertsLoading(false);
    }
  }, [enabled, referenceMonth]);

  useEffect(() => {
    if (!enabled) {
      setPendingSessionsSource([]);
      setOperationalAlerts([]);
      setIsOpen(false);
      return;
    }
    refreshPendingSessions();
  }, [enabled, refreshPendingSessions]);

  useEffect(() => {
    if (!enabled) {
      setServices([]);
      return;
    }
    if (location.pathname === "/agendamentos" || services.length > 0) return;
    axios.get("/services")
      .then((response) => setServices(Array.isArray(response.data) ? response.data : []))
      .catch(() => setServices([]));
  }, [enabled, location.pathname, services.length]);

  useEffect(() => {
    if (enabled) refreshOperationalAlerts(referenceMonth);
  }, [enabled, referenceMonth, refreshOperationalAlerts]);

  useEffect(() => {
    if (!enabled) return undefined;
    const intervalId = window.setInterval(() => setCurrentTime(Date.now()), 60000);
    return () => window.clearInterval(intervalId);
  }, [enabled]);

  const servicesById = useMemo(
    () => new Map(services.map((service) => [String(service.id), service])),
    [services],
  );
  const servicesByCode = useMemo(
    () => new Map(services.map((service) => [String(service.code || ""), service])),
    [services],
  );

  const pendingConfirmationSessions = useMemo(() => pendingSessionsSource
    .filter((session) => {
      if (!isScheduledStatus(session?.status)) return false;
      const endsAt = getSessionEndDate(session, servicesById, servicesByCode);
      if (!endsAt) return false;
      const toleranceMs = ATTENDANCE_CONFIRMATION_TOLERANCE_MINUTES * 60000;
      return currentTime >= endsAt.getTime() + toleranceMs;
    })
    .sort((first, second) => (
      (getSessionEndDate(first, servicesById, servicesByCode)?.getTime() || 0)
      - (getSessionEndDate(second, servicesById, servicesByCode)?.getTime() || 0)
    )), [currentTime, pendingSessionsSource, servicesByCode, servicesById]);

  const pendingConfirmationGroups = useMemo(() => {
    const dayMap = new Map();
    pendingConfirmationSessions.forEach((session) => {
      const startsAt = session?.starts_at ? new Date(session.starts_at) : null;
      if (!startsAt || Number.isNaN(startsAt.getTime())) return;
      const dayDate = new Date(startsAt);
      dayDate.setHours(0, 0, 0, 0);
      const key = dayDate.toISOString();
      const group = dayMap.get(key) || { key, date: dayDate, sessionCount: 0 };
      group.sessionCount += 1;
      dayMap.set(key, group);
    });
    return Array.from(dayMap.values());
  }, [pendingConfirmationSessions]);

  const operationalAlertGroups = useMemo(() => {
    const groupMap = new Map();
    [...operationalAlerts]
      .sort((first, second) => (
        (OPERATIONAL_ALERT_SEVERITY_ORDER[first.severity] ?? 9)
        - (OPERATIONAL_ALERT_SEVERITY_ORDER[second.severity] ?? 9)
      ))
      .forEach((alert, index) => {
        const category = getOperationalAlertCategory(alert);
        if (!groupMap.has(category)) {
          groupMap.set(category, {
            key: category,
            section: getOperationalAlertSection(category),
            label: PENDING_CENTER_CATEGORY_LABELS[category]
              || PENDING_CENTER_CATEGORY_LABELS.other,
            alerts: [],
          });
        }
        groupMap.get(category).alerts.push({
          ...alert,
          centerKey: `${alert.type}-${alert.patient_id || "sem-paciente"}-${alert.details?.audit_log_id || alert.details?.replacement_credit_id || index}`,
        });
      });

    return Array.from(groupMap.values()).sort((first, second) => {
      const sectionDiff = PENDING_CENTER_SECTION_ORDER[first.section]
        - PENDING_CENTER_SECTION_ORDER[second.section];
      if (sectionDiff !== 0) return sectionDiff;
      return first.label.localeCompare(second.label, "pt-BR", { sensitivity: "base" });
    });
  }, [operationalAlerts]);

  const sections = useMemo(() => {
    const operationalGroupMap = new Map(
      operationalAlertGroups.map((group) => [group.key, group]),
    );
    const fixedCategoryKeys = new Set();
    const getOperationalItemCount = (key, alerts = []) => {
      if (key === "standalone_session_credit_expiring") {
        return countStandaloneCreditItems(alerts);
      }
      if (isPlanOperationalAlert(key)) return countPlanAlertItems(alerts);
      if (key === "patient_birthday") return countBirthdayAlertItems(alerts);
      return alerts.length;
    };
    const result = PENDING_CENTER_MAIN_SECTIONS.map((section) => ({
      key: section.key,
      label: PENDING_CENTER_SECTION_LABELS[section.key],
      items: section.items.map((item) => {
        fixedCategoryKeys.add(item.key);
        if (item.kind === "attendance") {
          return { ...item, count: pendingConfirmationSessions.length };
        }
        const group = operationalGroupMap.get(item.key);
        const alerts = group?.alerts || [];
        return { ...item, count: getOperationalItemCount(item.key, alerts), alerts };
      }),
    }));

    operationalAlertGroups.forEach((group) => {
      if (fixedCategoryKeys.has(group.key) || group.key === "other") return;
      const targetSection = result.find((section) => section.key === group.section);
      if (!targetSection) return;
      targetSection.items.push({
        key: group.key,
        kind: "operational-alert",
        label: group.label,
        count: getOperationalItemCount(group.key, group.alerts),
        alerts: group.alerts,
      });
    });
    return result;
  }, [operationalAlertGroups, pendingConfirmationSessions.length]);

  const total = sections.reduce(
    (sectionTotal, section) => sectionTotal
      + section.items.reduce((itemTotal, item) => itemTotal + item.count, 0),
    0,
  );

  const selectedItem = useMemo(() => {
    if (!selectedItemKey) return null;
    return sections.flatMap((section) => section.items)
      .find((item) => item.key === selectedItemKey) || null;
  }, [sections, selectedItemKey]);

  const close = useCallback(() => {
    setIsOpen(false);
    setSelectedItemKey(null);
  }, []);
  const toggle = useCallback(() => {
    setIsOpen((current) => !current);
    setSelectedItemKey(null);
  }, []);

  const dismissStandaloneCreditAlerts = useCallback(async (alerts = []) => {
    const validAlerts = alerts.filter((alert) => alert?.details?.alert_key);
    if (validAlerts.length === 0) return;
    const dismissedKeys = new Set(validAlerts.map((alert) => alert.details.alert_key));
    const previousOperationalAlerts = operationalAlerts;
    setOperationalAlerts((previous) => previous
      .filter((alert) => !dismissedKeys.has(alert?.details?.alert_key)));
    try {
      await axios.post("/operational-alerts/dismiss-standalone-credit", {
        alerts: validAlerts,
      });
      toast.success("Alerta ocultado.");
    } catch (error) {
      setOperationalAlerts(previousOperationalAlerts);
      toast.error(getUserFacingApiError(error, "Não foi possível ocultar o alerta."));
    }
  }, [operationalAlerts]);

  const value = useMemo(() => ({
    pendingSessionsSource,
    updatePendingSessionsSource,
    updateServiceCatalog,
    refreshPendingSessions,
    refreshOperationalAlerts,
    setReferenceMonth,
    isOpen,
    total,
    toggle,
    close,
    sections,
    selectedItem,
    setSelectedItemKey,
    pendingConfirmationGroups,
    isOperationalAlertsLoading,
    dismissStandaloneCreditAlerts,
  }), [
    close,
    dismissStandaloneCreditAlerts,
    isOpen,
    isOperationalAlertsLoading,
    pendingConfirmationGroups,
    pendingSessionsSource,
    refreshOperationalAlerts,
    refreshPendingSessions,
    sections,
    selectedItem,
    setReferenceMonth,
    toggle,
    total,
    updatePendingSessionsSource,
    updateServiceCatalog,
  ]);

  return (
    <PendingCenterContext.Provider value={value}>
      {children}
    </PendingCenterContext.Provider>
  );
}

PendingCenterProvider.propTypes = {
  children: PropTypes.node.isRequired,
  enabled: PropTypes.bool.isRequired,
};

export const usePendingCenter = () => useContext(PendingCenterContext);

export function PendingCenterTrigger() {
  const { isOpen, total, toggle } = usePendingCenter();
  return (
    <NotificationButton
      type="button"
      onClick={toggle}
      $active={isOpen}
      aria-label={`Central de pendências. ${total} pendências.`}
      aria-expanded={isOpen}
      title="Central de pendências"
    >
      <FaBell aria-hidden="true" />
      {total > 0 && (
        <NotificationBadge aria-hidden="true">
          {total > 99 ? "99+" : total}
        </NotificationBadge>
      )}
    </NotificationButton>
  );
}

export function PendingCenterDrawer() {
  const history = useHistory();
  const {
    close,
    dismissStandaloneCreditAlerts,
    isOpen,
    isOperationalAlertsLoading,
    pendingConfirmationGroups,
    sections,
    selectedItem,
    setSelectedItemKey,
  } = usePendingCenter();

  const openAgendaAction = useCallback((action) => {
    close();
    history.push({
      pathname: "/agendamentos",
      state: { [PENDING_CENTER_ACTION_STATE_KEY]: action },
    });
  }, [close, history]);

  return (
    <>
      <AppDrawer
        $open={isOpen}
        aria-hidden={!isOpen}
        aria-label="Central de pendências"
      >
        <DrawerHeader>
          <h2>Central de pendências</h2>
          <IconButton type="button" onClick={close} aria-label="Fechar Central de pendências">
            <FaTimes aria-hidden="true" />
          </IconButton>
        </DrawerHeader>
        <DrawerBody>
          <PendingDrawerPanel>
            {isOperationalAlertsLoading && (
              <PendingCenterHint>Atualizando alertas operacionais...</PendingCenterHint>
            )}
            {selectedItem ? (
              <PendingCategoryDetails>
                <PendingBackButton type="button" onClick={() => setSelectedItemKey(null)}>
                  {"<-"} Voltar
                </PendingBackButton>
                <PendingDetailHeader>
                  <PendingGroupTitle>{selectedItem.label}</PendingGroupTitle>
                  <PendingCountBadge $empty={selectedItem.count === 0}>
                    {selectedItem.count}
                  </PendingCountBadge>
                </PendingDetailHeader>
                {selectedItem.count === 0 && (
                  <EmptyState>Nenhuma pendência nesta categoria.</EmptyState>
                )}
                {selectedItem.count > 0 && selectedItem.kind === "attendance" && (
                  <PendingGroupDetails>
                    {pendingConfirmationGroups.map((group) => (
                      <PendingDayRow key={group.key}>
                        <div>
                          <strong>{formatPendingDayLabel(group.date)}</strong>
                          <span>
                            {group.sessionCount} atendimento
                            {group.sessionCount > 1 ? "s" : ""}
                          </span>
                        </div>
                        <PendingOpenDayButton
                          type="button"
                          onClick={() => openAgendaAction({
                            type: "open-day",
                            value: group.date.toISOString(),
                          })}
                        >
                          Abrir na agenda
                        </PendingOpenDayButton>
                      </PendingDayRow>
                    ))}
                  </PendingGroupDetails>
                )}
                {selectedItem.count > 0
                  && selectedItem.key === "standalone_session_credit_expiring" && (
                    <PendingGroupDetails>
                      {groupStandaloneCreditAlerts(selectedItem.alerts).map((item) => (
                        <PendingPatientCard key={item.key}>
                          <PendingPatientName>
                            {item.patientId ? (
                              <Link to={`/pacientes/${item.patientId}`} onClick={close}>
                                {item.patientName}
                              </Link>
                            ) : item.patientName}
                          </PendingPatientName>
                          <PendingNestedList>
                            {item.services.map((service) => (
                              <PendingNestedRow key={service.key}>
                                <span>
                                  {service.serviceName} — {pluralizeSession(service.remainingSessions)}
                                </span>
                                <PendingDismissButton
                                  type="button"
                                  onClick={() => dismissStandaloneCreditAlerts(service.alerts)}
                                >
                                  Não renovar agora
                                </PendingDismissButton>
                              </PendingNestedRow>
                            ))}
                          </PendingNestedList>
                        </PendingPatientCard>
                      ))}
                    </PendingGroupDetails>
                  )}
                {selectedItem.count > 0 && isPlanOperationalAlert(selectedItem.key) && (
                  <PendingGroupDetails>
                    {groupPlanAlertsByPatient(selectedItem.alerts).map((item) => (
                      <PendingPatientCard key={item.key}>
                        <PendingPatientName>
                          {item.patientId ? (
                            <Link to={`/pacientes/${item.patientId}`} onClick={close}>
                              {item.patientName}
                            </Link>
                          ) : item.patientName}
                        </PendingPatientName>
                        <PendingNestedList>
                          {item.plans.map(({ key, alert }) => (
                            <PendingNestedRow key={key}>
                              <div>
                                <span>
                                  {alert.details?.plan_name
                                    || alert.status?.split(" - ")?.[0]
                                    || "Plano"}
                                </span>
                                <PendingPlanDueText
                                  $overdue={alert.type === "patient_plan_overdue"
                                    || alert.type === "patient_plan_pause_overdue"}
                                >
                                  {getPlanAlertDueText(alert)}
                                </PendingPlanDueText>
                              </div>
                              <PendingPlanLink to={getPlanAlertLink(alert)} onClick={close}>
                                Ver plano
                              </PendingPlanLink>
                            </PendingNestedRow>
                          ))}
                        </PendingNestedList>
                      </PendingPatientCard>
                    ))}
                  </PendingGroupDetails>
                )}
                {selectedItem.count > 0 && selectedItem.key === "patient_birthday" && (
                  <BirthdayAlertList>
                    {groupBirthdayAlertsByDate(selectedItem.alerts).map((group) => (
                      <BirthdayDateGroup key={group.key}>
                        <BirthdayDateHeader>
                          <strong>{getBirthdayGroupTitle(group)}</strong>
                          <span>{getBirthdayGroupSubtitle(group)}</span>
                        </BirthdayDateHeader>
                        <BirthdayPatientList>
                          {group.alerts.map((alert) => (
                            <BirthdayPatientRow key={alert.centerKey}>
                              <BirthdayIcon aria-hidden="true"><FaBirthdayCake /></BirthdayIcon>
                              <BirthdayPatientName>
                                {alert.patient_id ? (
                                  <Link to={`/pacientes/${alert.patient_id}`} onClick={close}>
                                    {alert.patient_name}
                                  </Link>
                                ) : alert.patient_name}
                              </BirthdayPatientName>
                            </BirthdayPatientRow>
                          ))}
                        </BirthdayPatientList>
                      </BirthdayDateGroup>
                    ))}
                  </BirthdayAlertList>
                )}
                {selectedItem.count > 0 && selectedItem.key === "replacement_credit" && (
                  <PendingGroupDetails>
                    {selectedItem.alerts.map((alert) => (
                      <PendingPatientCard key={alert.centerKey}>
                        <PendingPatientName>
                          {alert.patient_id ? (
                            <Link to={`/pacientes/${alert.patient_id}`} onClick={close}>
                              {alert.patient_name}
                            </Link>
                          ) : alert.patient_name}
                        </PendingPatientName>
                        <PendingNestedRow>
                          <div>
                            <span>{alert.details?.source_service_name || "Reposição pendente"}</span>
                            <small>{alert.status}</small>
                          </div>
                          <PendingDismissButton
                            type="button"
                            onClick={() => openAgendaAction({
                              type: "schedule-replacement",
                              alert,
                            })}
                          >
                            Agendar reposição
                          </PendingDismissButton>
                        </PendingNestedRow>
                      </PendingPatientCard>
                    ))}
                  </PendingGroupDetails>
                )}
                {selectedItem.kind === "operational-alert"
                  && selectedItem.count > 0
                  && selectedItem.key !== "standalone_session_credit_expiring"
                  && !isPlanOperationalAlert(selectedItem.key)
                  && selectedItem.key !== "patient_birthday"
                  && selectedItem.key !== "replacement_credit" && (
                    <PendingGroupDetails>
                      {selectedItem.alerts.map((alert) => (
                        <PendingAlertRow key={alert.centerKey} $severity={alert.severity}>
                          <OperationalAlertTopline>
                            <OperationalAlertSeverity $severity={alert.severity}>
                              {OPERATIONAL_ALERT_SEVERITY_LABELS[alert.severity] || "Alerta"}
                            </OperationalAlertSeverity>
                            <OperationalAlertType>{alert.type}</OperationalAlertType>
                            {alert.quantity !== null && alert.quantity !== undefined && (
                              <OperationalAlertQuantity>{alert.quantity}</OperationalAlertQuantity>
                            )}
                          </OperationalAlertTopline>
                          <OperationalAlertBody>
                            <OperationalAlertField>
                              <span>Paciente</span>
                              <strong>
                                {alert.patient_id ? (
                                  <Link to={`/pacientes/${alert.patient_id}`} onClick={close}>
                                    {alert.patient_name}
                                  </Link>
                                ) : alert.patient_name}
                              </strong>
                            </OperationalAlertField>
                            <OperationalAlertField>
                              <span>Info principal</span>
                              <strong>{alert.title}</strong>
                            </OperationalAlertField>
                            <OperationalAlertField>
                              <span>Estado atual</span>
                              <strong>
                                {alert.status}
                                {alert.due_date
                                  ? ` - ${getOperationalAlertDueLabel(alert)} ${alert.due_date}`
                                  : ""}
                              </strong>
                            </OperationalAlertField>
                            <OperationalAlertAction>
                              <span>Orientacao</span>
                              <strong>{alert.suggested_action}</strong>
                            </OperationalAlertAction>
                          </OperationalAlertBody>
                        </PendingAlertRow>
                      ))}
                    </PendingGroupDetails>
                  )}
              </PendingCategoryDetails>
            ) : (
              <PendingCenterSections>
                {sections.map((section) => (
                  <PendingCenterSection key={section.key}>
                    <PendingSectionTitle>{section.label}</PendingSectionTitle>
                    <PendingGroupList>
                      {section.items.map((item) => (
                        <PendingCategoryButton
                          key={item.key}
                          type="button"
                          disabled={item.count === 0}
                          onClick={() => item.count > 0 && setSelectedItemKey(item.key)}
                          $empty={item.count === 0}
                        >
                          <PendingGroupHeader>
                            <PendingGroupTitle>{item.label}</PendingGroupTitle>
                            <PendingCountBadge $empty={item.count === 0}>
                              {item.count}
                            </PendingCountBadge>
                          </PendingGroupHeader>
                        </PendingCategoryButton>
                      ))}
                    </PendingGroupList>
                  </PendingCenterSection>
                ))}
              </PendingCenterSections>
            )}
          </PendingDrawerPanel>
        </DrawerBody>
      </AppDrawer>
      {isOpen && <DrawerBackdrop onClick={close} />}
    </>
  );
}

const NotificationButton = styled.button`
  position: relative;
  width: 40px;
  height: 40px;
  flex: 0 0 40px;
  border: 1px solid ${colors.borderSubtle};
  border-radius: ${radii.pill};
  background: ${({ $active }) => ($active ? colors.appHeaderControlHover : "transparent")};
  color: ${colors.textPrimary};
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  cursor: pointer;
  transition: background 150ms ease, border-color 150ms ease;

  &:hover {
    background: ${colors.appHeaderControlHover};
  }

  &:focus-visible {
    outline: 3px solid ${colors.focus};
    outline-offset: 2px;
  }
`;

const NotificationBadge = styled.span`
  position: absolute;
  top: -5px;
  right: -5px;
  min-width: 20px;
  max-width: 32px;
  height: 20px;
  padding: 0 5px;
  border-radius: ${radii.pill};
  background: ${colors.danger};
  color: ${colors.white};
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-weight: ${typography.weightBold};
  font-size: 0.68rem;
  line-height: 1;
  white-space: nowrap;
`;

const DrawerHeader = styled.div`
  padding: 22px 20px;
  border-bottom: 1px solid rgba(106, 121, 92, 0.15);
  display: flex;
  justify-content: space-between;
  align-items: flex-start;

  h2 {
    margin: 0 0 6px;
  }
`;

const DrawerBody = styled.div`
  padding: 28px 20px 20px;
  overflow-y: auto;
  flex: 1;
`;

const IconButton = styled.button`
  border: none;
  background: transparent;
  color: #6a795c;
  font-size: 1.1rem;
  cursor: pointer;
`;

const PendingDrawerPanel = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
`;

const PendingCenterHint = styled.div`
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  background: #f8fafc;
  color: #64748b;
  font-size: 12px;
  font-weight: 700;
  padding: 10px 12px;
`;

const PendingCenterSections = styled.div`
  display: flex;
  flex-direction: column;
  gap: 18px;
`;

const PendingCenterSection = styled.section`
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

const PendingSectionTitle = styled.h3`
  margin: 0;
  color: #516046;
  font-size: 0.78rem;
  font-weight: 900;
  letter-spacing: 0.04em;
  text-transform: uppercase;
`;

const PendingGroupList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

const PendingCategoryDetails = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

const PendingBackButton = styled.button`
  align-self: flex-start;
  border: 1px solid rgba(106, 121, 92, 0.22);
  border-radius: 8px;
  background: #fff;
  color: #516046;
  cursor: pointer;
  font-size: 0.84rem;
  font-weight: 800;
  padding: 7px 10px;

  &:hover { background: #f6f9f2; }
`;

const PendingDetailHeader = styled.div`
  align-items: center;
  display: flex;
  gap: 12px;
  justify-content: space-between;
  padding: 2px 0 4px;
`;

const PendingCategoryButton = styled.button`
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px;
  border-radius: 10px;
  border: 1px solid ${({ $empty }) => ($empty ? "rgba(148, 163, 184, 0.18)" : "rgba(106, 121, 92, 0.16)")};
  background: ${({ $empty }) => ($empty ? "#f8fafc" : "#fbfcf8")};
  text-align: left;
  cursor: ${({ $empty }) => ($empty ? "default" : "pointer")};
  opacity: ${({ $empty }) => ($empty ? 0.68 : 1)};
  transition: border-color 120ms ease, background 120ms ease, transform 120ms ease;

  &:not(:disabled):hover {
    background: #f6f9f2;
    border-color: rgba(106, 121, 92, 0.28);
    transform: translateY(-1px);
  }
`;

const PendingGroupHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: nowrap;
  width: 100%;
`;

const PendingGroupTitle = styled.h3`
  margin: 0;
  color: #1b1b1b;
  font-size: 0.95rem;
`;

const PendingCountBadge = styled.span`
  min-width: 30px;
  height: 30px;
  padding: 0 8px;
  border-radius: 999px;
  background: ${({ $empty }) => ($empty ? "#e2e8f0" : "#c63b32")};
  color: ${({ $empty }) => ($empty ? "#64748b" : "#fff")};
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 0.78rem;
  font-weight: 800;
`;

const PendingGroupDetails = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const PendingDayRow = styled.div`
  align-items: center;
  border-top: 1px solid rgba(106, 121, 92, 0.12);
  display: flex;
  gap: 10px;
  justify-content: space-between;
  padding-top: 8px;

  strong { color: #1b1b1b; display: block; font-size: 0.9rem; }
  span { color: #6a795c; display: block; font-size: 0.78rem; margin-top: 2px; }
`;

const PendingOpenDayButton = styled.button`
  border: 1px solid rgba(106, 121, 92, 0.22);
  border-radius: 8px;
  background: #fff;
  color: #516046;
  cursor: pointer;
  font-size: 0.78rem;
  font-weight: 800;
  padding: 8px 10px;
  white-space: nowrap;

  &:hover { background: #f6f9f2; }
`;

const PendingPatientCard = styled.div`
  border: 1px solid rgba(106, 121, 92, 0.14);
  border-radius: 8px;
  background: #fff;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px 12px;
`;

const PendingPatientName = styled.strong`
  color: #1b1b1b;
  display: block;
  font-size: 0.92rem;

  a { color: inherit; text-decoration: none; }
`;

const PendingNestedList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const PendingNestedRow = styled.div`
  align-items: center;
  border-top: 1px solid rgba(106, 121, 92, 0.1);
  display: flex;
  gap: 10px;
  justify-content: space-between;
  min-width: 0;
  padding-top: 8px;

  div { min-width: 0; }
  span {
    color: #516046;
    display: block;
    font-size: 0.82rem;
    font-weight: 700;
    overflow-wrap: anywhere;
  }
  small {
    color: #6a795c;
    display: block;
    font-size: 0.78rem;
    font-weight: 700;
    margin-top: 3px;
  }

  @media (max-width: 520px) {
    align-items: flex-start;
    flex-direction: column;
  }
`;

const PendingDismissButton = styled.button`
  border: 1px solid rgba(106, 121, 92, 0.22);
  border-radius: 8px;
  background: #fff;
  color: #516046;
  cursor: pointer;
  flex: 0 0 auto;
  font-size: 0.78rem;
  font-weight: 800;
  padding: 8px 10px;
  white-space: nowrap;

  &:hover { background: #f6f9f2; }
`;

const PendingPlanLink = styled(Link)`
  border: 1px solid rgba(106, 121, 92, 0.22);
  border-radius: 8px;
  background: #fff;
  color: #516046;
  flex: 0 0 auto;
  font-size: 0.78rem;
  font-weight: 800;
  padding: 8px 10px;
  text-decoration: none;
  white-space: nowrap;

  &:hover { background: #f6f9f2; }
`;

const PendingPlanDueText = styled.small`
  color: ${({ $overdue }) => ($overdue ? "#b91c1c" : "#6a795c")} !important;
  display: block;
  font-size: 0.78rem;
  font-weight: 800;
  margin-top: 3px;
`;

const BirthdayAlertList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

const BirthdayDateGroup = styled.section`
  border: 1px solid rgba(185, 108, 63, 0.18);
  border-radius: 8px;
  background: #fffaf5;
  overflow: hidden;
`;

const BirthdayDateHeader = styled.div`
  align-items: center;
  background: #fff3e8;
  border-bottom: 1px solid rgba(185, 108, 63, 0.14);
  display: flex;
  gap: 10px;
  justify-content: space-between;
  padding: 10px 12px;

  strong { color: #7a3f1d; font-size: 0.88rem; font-weight: 900; }
  span { color: #9a5a32; flex: 0 0 auto; font-size: 0.76rem; font-weight: 800; }
`;

const BirthdayPatientList = styled.div`
  display: flex;
  flex-direction: column;
`;

const BirthdayPatientRow = styled.div`
  align-items: center;
  display: flex;
  gap: 10px;
  min-width: 0;
  padding: 10px 12px;

  & + & { border-top: 1px solid rgba(185, 108, 63, 0.12); }
`;

const BirthdayIcon = styled.span`
  align-items: center;
  background: #fff;
  border: 1px solid rgba(185, 108, 63, 0.2);
  border-radius: 999px;
  color: #b96c3f;
  display: inline-flex;
  flex: 0 0 auto;
  height: 28px;
  justify-content: center;
  width: 28px;

  svg { height: 13px; width: 13px; }
`;

const BirthdayPatientName = styled.strong`
  color: #1f2933;
  display: block;
  font-size: 0.91rem;
  font-weight: 800;
  min-width: 0;
  overflow-wrap: anywhere;

  a { color: inherit; text-decoration: none; }
`;

const PendingAlertRow = styled.div`
  border: 1px solid ${({ $severity }) => {
    if ($severity === "high") return "#fecaca";
    if ($severity === "medium") return "#fde68a";
    return "#d7dee8";
  }};
  border-left: 4px solid ${({ $severity }) => {
    if ($severity === "high") return "#dc2626";
    if ($severity === "medium") return "#d97706";
    return "#64748b";
  }};
  border-radius: 8px;
  background: #fff;
  padding: 8px 10px;
`;

const OperationalAlertSeverity = styled.span`
  align-self: start;
  border-radius: 999px;
  padding: 4px 8px;
  text-align: center;
  font-size: 11px;
  font-weight: 800;
  color: ${({ $severity }) => {
    if ($severity === "high") return "#991b1b";
    if ($severity === "medium") return "#92400e";
    return "#334155";
  }};
  background: ${({ $severity }) => {
    if ($severity === "high") return "#fee2e2";
    if ($severity === "medium") return "#fef3c7";
    return "#e2e8f0";
  }};
`;

const OperationalAlertBody = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 7px 12px;
  margin-top: 8px;
  min-width: 0;

  @media (max-width: 620px) { grid-template-columns: 1fr; }
`;

const OperationalAlertTopline = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  font-size: 13px;
  color: #0f172a;
`;

const OperationalAlertType = styled.span`
  color: #475569;
  font-size: 11px;
  font-weight: 800;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  text-transform: uppercase;
  white-space: nowrap;
`;

const OperationalAlertQuantity = styled.span`
  color: #0f172a;
  font-size: 12px;
  font-weight: 900;
  margin-left: auto;
`;

const OperationalAlertField = styled.div`
  min-width: 0;

  span {
    color: #64748b;
    display: block;
    font-size: 10px;
    font-weight: 800;
    margin-bottom: 2px;
    text-transform: uppercase;
  }
  strong {
    color: #0f172a;
    display: block;
    font-size: 12px;
    font-weight: 700;
    overflow-wrap: anywhere;
  }
  a { color: #2563eb; text-decoration: none; }
`;

const OperationalAlertAction = styled(OperationalAlertField)`
  grid-column: 1 / -1;
`;

const EmptyState = styled.div`
  padding: 32px 16px;
  text-align: center;
  color: #6a795c;
`;

export { PENDING_CENTER_ACTION_STATE_KEY };
