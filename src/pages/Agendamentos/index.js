import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import styled from "styled-components";
import { Link } from "react-router-dom";
import { toast } from "react-toastify";
import {
  FaBell,
  FaCheckCircle,
  FaChevronLeft,
  FaChevronRight,
  FaPlus,
  FaTimes,
  FaTimesCircle,
} from "react-icons/fa";

import axios from "../../services/axios";
import Loading from "../../components/Loading";

const START_HOUR = 7;
const END_HOUR = 20;
const PROFESSIONAL_GROUP_SLUG = "profissional";
const ATTENDANCE_CONFIRMATION_TOLERANCE_MINUTES = 15;
const PENDING_STATUS_FALLBACK = [
  { code: "done", label: "Concluido" },
  { code: "no_show", label: "Falta" },
  { code: "canceled", label: "Cancelado" },
];

const WEEKDAY_OPTIONS = [
  { value: 1, label: "Seg" },
  { value: 2, label: "Ter" },
  { value: 3, label: "Qua" },
  { value: 4, label: "Qui" },
  { value: 5, label: "Sex" },
  { value: 6, label: "Sab" },
  { value: 7, label: "Dom" },
];

const emptyForm = {
  patient_id: "",
  professional_user_id: "",
  service_type: "",
  service_id: "",
  status: "scheduled",
  is_initial: false,
  starts_at: "",
  ends_at: "",
  notes: "",
  absence_reason: "",
};

const normalizeText = (value) => {
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
};

const toIsoWeekday = (date) => {
  const day = date.getDay();
  return day === 0 ? 7 : day;
};

const formatDateTime = (value) => {
  if (!value) return "Sem data";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Sem data";
  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatDateParam = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const formatDate = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
};

const formatPendingDayLabel = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
  });
};

const formatPendingTimeLabel = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  })}hrs`;
};

const formatMonthName = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("pt-BR", { month: "long" });
};

const formatWeekRange = (start, end) => {
  if (!start || !end) return "";
  const sameMonth = start.getMonth() === end.getMonth();
  if (sameMonth) {
    const monthName = start.toLocaleDateString("pt-BR", { month: "long" });
    return `Semana ${String(start.getDate()).padStart(2, "0")} a ${String(
      end.getDate(),
    ).padStart(2, "0")} de ${monthName}`;
  }
  const startLabel = start.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
  const endLabel = end.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
  return `Semana ${startLabel} a ${endLabel}`;
};

const toInputValue = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
};

const sameDay = (a, b) => {
  if (!a || !b) return false;
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
};

const startOfDay = (date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

const endOfDay = (date) => {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
};

const isScheduledStatus = (status) =>
  !status || status === "scheduled" || status === "open";

const getWeekDays = (baseDate) => {
  const start = startOfDay(baseDate);
  const day = start.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  start.setDate(start.getDate() + diff);
  return Array.from({ length: 7 }).map((_, index) => {
    const d = new Date(start);
    d.setDate(start.getDate() + index);
    return d;
  });
};

const getMonthDays = (baseDate) => {
  const first = new Date(baseDate.getFullYear(), baseDate.getMonth(), 1);
  const last = new Date(baseDate.getFullYear(), baseDate.getMonth() + 1, 0);
  const days = [];
  const start = new Date(first);
  const offset = start.getDay() === 0 ? -6 : 1 - start.getDay();
  start.setDate(start.getDate() + offset);
  while (start <= last || start.getDay() !== 1) {
    days.push(new Date(start));
    start.setDate(start.getDate() + 1);
  }
  return days;
};



export default function Agendamentos() {
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [sessions, setSessions] = useState([]);
  const [pendingSessionsSource, setPendingSessionsSource] = useState([]);
  const [patients, setPatients] = useState([]);
  const [professionals, setProfessionals] = useState([]);
  const [serviceLimits, setServiceLimits] = useState([]);
  const [services, setServices] = useState([]);
  const [statusOptions, setStatusOptions] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [filterPatientQuery, setFilterPatientQuery] = useState("");
  const [isFilterPatientListOpen, setIsFilterPatientListOpen] = useState(false);
  const [formPatientQuery, setFormPatientQuery] = useState("");
  const [isFormPatientListOpen, setIsFormPatientListOpen] = useState(false);
  const [absenceModal, setAbsenceModal] = useState({
    open: false,
    id: null,
    status: null,
    reason: "",
  });
  const [editingId, setEditingId] = useState(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState("form");
  const [groupContext, setGroupContext] = useState(null);
  const [view, setView] = useState("week");
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [currentTime, setCurrentTime] = useState(Date.now());
  const startsAtRef = useRef(null);
  const endsAtRef = useRef(null);
  const [filters, setFilters] = useState({
    status: "",
    patient_id: "",
    service_type: "",
  });
  const [repeatEnabled, setRepeatEnabled] = useState(false);
  const [repeatWeekdays, setRepeatWeekdays] = useState([]);
  const [repeatMode, setRepeatMode] = useState("count");
  const [repeatCount, setRepeatCount] = useState("10");
  const [repeatWeeks, setRepeatWeeks] = useState("4");

  const loadBaseData = useCallback(async () => {
    try {
      const [patientsResponse, usersResponse, limitsResponse, statusResponse, servicesResponse] = await Promise.all([
        axios.get("/patients"),
        axios.get("/users", { params: { group: PROFESSIONAL_GROUP_SLUG } }),
        axios.get("/service-limits"),
        axios.get("/session-statuses"),
        axios.get("/services"),
      ]);
      setPatients(Array.isArray(patientsResponse.data) ? patientsResponse.data : []);
      setProfessionals(Array.isArray(usersResponse.data) ? usersResponse.data : []);
      setServiceLimits(Array.isArray(limitsResponse.data) ? limitsResponse.data : []);
      setStatusOptions(Array.isArray(statusResponse.data) ? statusResponse.data : []);
      setServices(Array.isArray(servicesResponse.data) ? servicesResponse.data : []);
    } catch (error) {
      const message =
        error?.response?.data?.error ||
        "Nao foi possivel carregar pacientes ou profissionais.";
      toast.error(message);
    }
  }, []);

  const loadSessions = useCallback(
    async (fromDate, toDate) => {
      setIsLoading(true);
      try {
        const params = {};
        if (fromDate) params.from = formatDateParam(fromDate);
        if (toDate) params.to = formatDateParam(toDate);
        const response = await axios.get("/sessions", { params });
        setSessions(Array.isArray(response.data) ? response.data : []);
      } catch (error) {
        const message =
          error?.response?.data?.error || "Nao foi possivel carregar agendas.";
        toast.error(message);
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  const loadPendingSessions = useCallback(async () => {
    try {
      const response = await axios.get("/sessions");
      setPendingSessionsSource(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      const message =
        error?.response?.data?.error || "Nao foi possivel carregar as pendencias.";
      toast.error(message);
    }
  }, []);

  useEffect(() => {
    loadBaseData();
  }, [loadBaseData]);

  useEffect(() => {
    loadPendingSessions();
  }, [loadPendingSessions]);

  useEffect(() => {
    if (view === "month") {
      const from = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
      const to = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0);
      loadSessions(from, to);
      return;
    }
    if (view === "day") {
      loadSessions(startOfDay(selectedDate), endOfDay(selectedDate));
      return;
    }
    const weekDays = getWeekDays(selectedDate);
    loadSessions(startOfDay(weekDays[0]), endOfDay(weekDays[6]));
  }, [loadSessions, selectedDate, view]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setCurrentTime(Date.now());
    }, 60000);

    return () => window.clearInterval(intervalId);
  }, []);

  const patientOptions = useMemo(
    () =>
      patients.map((patient) => ({
        id: patient.id,
        name: patient.full_name || patient.name || "Paciente",
      })),
    [patients],
  );

  const filterPatientList = useCallback(
    (query) => {
      const normalized = query.trim().toLowerCase();
      if (!normalized) return patientOptions;
      return patientOptions.filter((patient) =>
        patient.name.toLowerCase().includes(normalized),
      );
    },
    [patientOptions],
  );

  const filteredPatientOptions = useMemo(
    () => filterPatientList(filterPatientQuery),
    [filterPatientQuery, filterPatientList],
  );

  const filteredFormPatientOptions = useMemo(
    () => filterPatientList(formPatientQuery),
    [formPatientQuery, filterPatientList],
  );

  const handleSelectPatient = useCallback((patient) => {
    setForm((prev) => ({ ...prev, patient_id: String(patient.id) }));
    setFormPatientQuery(patient.name);
    setIsFormPatientListOpen(false);
  }, []);

  const selectedPatient = useMemo(() => {
    if (!form.patient_id) return null;
    return patientOptions.find((patient) => String(patient.id) === form.patient_id) || null;
  }, [form.patient_id, patientOptions]);

  const professionalOptions = useMemo(
    () =>
      professionals.map((professional) => ({
        id: professional.id,
        name: professional.name || professional.email || "Profissional",
      })),
    [professionals],
  );

  const serviceOptions = useMemo(
    () =>
      services
        .filter((service) => service.is_active !== false)
        .map((service) => ({
          id: service.id,
          code: service.code,
          name: service.name,
          color: service.color,
          duration: service.default_duration_minutes,
        })),
    [services],
  );

  const fallbackServiceOptions = useMemo(
    () => [
      {
        id: null,
        code: "fisioterapia",
        name: "Fisioterapia",
        color: "#16A34A",
        duration: 60,
      },
      {
        id: null,
        code: "pilates",
        name: "Pilates",
        color: "#0EA5E9",
        duration: 60,
      },
      {
        id: null,
        code: "funcional",
        name: "Funcional",
        color: "#F97316",
        duration: 60,
      },
      {
        id: null,
        code: "outro",
        name: "Outro",
        color: "#8B5CF6",
        duration: 60,
      },
    ],
    [],
  );

  const allServiceOptions = useMemo(
    () => (serviceOptions.length > 0 ? serviceOptions : fallbackServiceOptions),
    [fallbackServiceOptions, serviceOptions],
  );

  const servicesByCode = useMemo(() => {
    const map = new Map();
    services.forEach((service) => {
      if (service?.code) map.set(service.code, service);
    });
    return map;
  }, [services]);

  const servicesById = useMemo(() => {
    const map = new Map();
    services.forEach((service) => {
      if (service?.id) map.set(service.id, service);
    });
    return map;
  }, [services]);

  const serviceLimitMap = useMemo(() => {
    const map = new Map();
    serviceLimits.forEach((limit) => {
      if (limit?.service_id) map.set(`id:${limit.service_id}`, limit.max_patients);
      if (limit?.service_type) map.set(`code:${limit.service_type}`, limit.max_patients);
    });
    return map;
  }, [serviceLimits]);

  const statusMap = useMemo(() => {
    const map = new Map();
    statusOptions.forEach((status) => {
      if (!status?.code) return;
      map.set(status.code, status.label || status.code);
    });
    return map;
  }, [statusOptions]);

  const statusLabel = useCallback(
    (status) => {
      if (!status) return "Agendado";
      return statusMap.get(status) || status;
    },
    [statusMap],
  );

  const pendingStatusOptions = useMemo(() => {
    const baseOptions =
      statusOptions.length > 0
        ? statusOptions.map((status) => ({
            code: status.code,
            label: status.label || status.code,
          }))
        : PENDING_STATUS_FALLBACK;

    const order = {
      done: 0,
      no_show: 1,
      canceled: 2,
    };

    return baseOptions
      .filter(
        (status) =>
          status?.code &&
          status.code !== "scheduled" &&
          status.code !== "open",
      )
      .sort((first, second) => {
        const firstOrder = order[first.code] ?? 99;
        const secondOrder = order[second.code] ?? 99;
        if (firstOrder !== secondOrder) return firstOrder - secondOrder;
        return first.label.localeCompare(second.label, "pt-BR");
      });
  }, [statusOptions]);

  const serviceName = useCallback(
    (value) => {
      if (!value) return "N/A";
      const service = servicesByCode.get(value);
      if (service?.name) return service.name;
      if (value === "fisioterapia") return "Fisioterapia";
      if (value === "pilates") return "Pilates";
      if (value === "funcional") return "Funcional";
      if (value === "outro") return "Outro";
      return value;
    },
    [servicesByCode],
  );

  const serviceColor = useCallback(
    (value) => servicesByCode.get(value)?.color || null,
    [servicesByCode],
  );

  const statusStyle = useCallback((status) => {
    if (status === "done") return "done";
    if (status === "canceled") return "canceled";
    if (status === "no_show") return "no_show";
    return "scheduled";
  }, []);

  const getSessionEndDate = useCallback(
    (session) => {
      if (session?.ends_at) {
        const endsAt = new Date(session.ends_at);
        if (!Number.isNaN(endsAt.getTime())) return endsAt;
      }
      if (!session?.starts_at) return null;
      const startsAt = new Date(session.starts_at);
      if (Number.isNaN(startsAt.getTime())) return null;
      const service =
        (session.service_id && servicesById.get(session.service_id)) ||
        (session.service_type && servicesByCode.get(session.service_type)) ||
        session.Service ||
        null;
      const durationMinutes = Number(service?.default_duration_minutes) || 60;
      return new Date(startsAt.getTime() + durationMinutes * 60000);
    },
    [servicesByCode, servicesById],
  );

  const needsAttendanceConfirmation = useCallback(
    (session) => {
      if (!isScheduledStatus(session?.status)) return false;
      const endsAt = getSessionEndDate(session);
      if (!endsAt) return false;
      const toleranceMs = ATTENDANCE_CONFIRMATION_TOLERANCE_MINUTES * 60000;
      return currentTime >= endsAt.getTime() + toleranceMs;
    },
    [currentTime, getSessionEndDate],
  );

  const filteredSessions = useMemo(() => {
    return sessions.filter((session) => {
      if (filters.status && session.status !== filters.status) return false;
      if (filters.service_type) {
        const sessionCode = session.service_type || session.Service?.code || "";
        if (sessionCode !== filters.service_type) return false;
      }
      if (filters.patient_id && String(session.patient_id) !== filters.patient_id) return false;
      return true;
    });
  }, [filters, sessions]);

  const sessionsByDay = useMemo(() => {
    const map = new Map();
    filteredSessions.forEach((session) => {
      const date = session.starts_at ? new Date(session.starts_at) : null;
      if (!date || Number.isNaN(date.getTime())) return;
      const key = startOfDay(date).toISOString();
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(session);
    });
    return map;
  }, [filteredSessions]);

  const daySessions = useMemo(() => {
    const key = startOfDay(selectedDate).toISOString();
    return sessionsByDay.get(key) || [];
  }, [selectedDate, sessionsByDay]);

  const pendingConfirmationSessions = useMemo(() => {
    const queue = pendingSessionsSource.filter((session) =>
      needsAttendanceConfirmation(session),
    );

    return queue.sort((first, second) => {
      const firstDate = getSessionEndDate(first)?.getTime() || 0;
      const secondDate = getSessionEndDate(second)?.getTime() || 0;
      return firstDate - secondDate;
    });
  }, [getSessionEndDate, needsAttendanceConfirmation, pendingSessionsSource]);

  const pendingConfirmationGroups = useMemo(() => {
    const groups = [];
    const dayMap = new Map();

    pendingConfirmationSessions.forEach((session) => {
      const startsAt = session?.starts_at ? new Date(session.starts_at) : null;
      if (!startsAt || Number.isNaN(startsAt.getTime())) return;

      const dayDate = startOfDay(startsAt);
      const dayKey = dayDate.toISOString();
      const minutes = startsAt.getHours() * 60 + startsAt.getMinutes();
      const timeKey = `${dayKey}-${minutes}`;
      const serviceCode = session.service_type || session.Service?.code || "outro";
      const professionalName = session?.professional?.name || "Profissional";
      const serviceKey = `${timeKey}-${serviceCode}-${professionalName}`;

      if (!dayMap.has(dayKey)) {
        const group = {
          key: dayKey,
          date: dayDate,
          sessionCount: 0,
          timeGroups: [],
          timeMap: new Map(),
        };
        dayMap.set(dayKey, group);
        groups.push(group);
      }

      const dayGroup = dayMap.get(dayKey);
      dayGroup.sessionCount += 1;

      if (!dayGroup.timeMap.has(timeKey)) {
        const timeGroup = {
          key: timeKey,
          startsAt,
          sortMinutes: minutes,
          sessionCount: 0,
          serviceGroups: [],
          serviceMap: new Map(),
        };
        dayGroup.timeMap.set(timeKey, timeGroup);
        dayGroup.timeGroups.push(timeGroup);
      }

      const timeGroup = dayGroup.timeMap.get(timeKey);
      timeGroup.sessionCount += 1;

      if (!timeGroup.serviceMap.has(serviceKey)) {
        const groupedService = {
          key: serviceKey,
          serviceCode,
          serviceLabel: serviceName(serviceCode),
          serviceColor: serviceColor(serviceCode),
          professionalName,
          sessions: [],
        };
        timeGroup.serviceMap.set(serviceKey, groupedService);
        timeGroup.serviceGroups.push(groupedService);
      }

      timeGroup.serviceMap.get(serviceKey).sessions.push(session);
    });

    return groups.map((group) => ({
      key: group.key,
      date: group.date,
      sessionCount: group.sessionCount,
      timeGroups: group.timeGroups
        .map((timeGroup) => ({
          key: timeGroup.key,
          startsAt: timeGroup.startsAt,
          sessionCount: timeGroup.sessionCount,
          sortMinutes: timeGroup.sortMinutes,
          serviceGroups: timeGroup.serviceGroups
            .map((serviceGroup) => ({
              ...serviceGroup,
              sessions: serviceGroup.sessions.sort((first, second) => {
                const firstName =
                  first?.Patient?.full_name || first?.Patient?.name || "Paciente";
                const secondName =
                  second?.Patient?.full_name || second?.Patient?.name || "Paciente";
                return firstName.localeCompare(secondName, "pt-BR");
              }),
            }))
            .sort((first, second) => {
              const firstLabel = `${first.serviceLabel}-${first.professionalName}`;
              const secondLabel = `${second.serviceLabel}-${second.professionalName}`;
              return firstLabel.localeCompare(secondLabel, "pt-BR");
            }),
        }))
        .sort((first, second) => first.sortMinutes - second.sortMinutes),
    }));
  }, [pendingConfirmationSessions, serviceColor, serviceName]);

  const getSlotGroups = useCallback(
    (day, hour) => {
      const key = startOfDay(day).toISOString();
      const dayList = sessionsByDay.get(key) || [];
      const groups = new Map();
      dayList.forEach((session) => {
        if (!session.starts_at) return;
        const sessionDate = new Date(session.starts_at);
        if (Number.isNaN(sessionDate.getTime())) return;
        if (sessionDate.getHours() !== hour) return;
        const service =
          (session.service_id && servicesById.get(session.service_id)) ||
          (session.service_type && servicesByCode.get(session.service_type)) ||
          null;
        const type = service?.code || session.service_type || "outro";
        if (!groups.has(type)) {
          groups.set(type, { service, sessions: [] });
        }
        groups.get(type).sessions.push(session);
      });
      return Array.from(groups.entries()).map(([type, bucket]) => {
        const items = bucket.sessions;
        const activeCount = items.filter(
          (item) => item.status !== "canceled" && item.status !== "no_show",
        ).length;
        const limitById =
          bucket.service?.id !== undefined
            ? serviceLimitMap.get(`id:${bucket.service.id}`)
            : undefined;
        const limitByCode = serviceLimitMap.get(`code:${type}`);
        return ({
          service_type: type,
          service: bucket.service,
          sessions: items,
          count: activeCount,
          total: items.length,
          limit: limitById ?? limitByCode,
        });
      });
    },
    [serviceLimitMap, sessionsByDay, servicesByCode, servicesById],
  );

  const groupSessions = useMemo(() => {
    if (!groupContext?.date) return [];
    const hour = groupContext.date.getHours();
    return getSlotGroups(groupContext.date, hour);
  }, [getSlotGroups, groupContext]);

  const handleFormChange = useCallback((event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }, []);

  const handleStartsAtChange = useCallback((event) => {
    const { value } = event.target;
    if (!value) {
      setForm((prev) => ({ ...prev, starts_at: value }));
      return;
    }
    const startDate = new Date(value);
    if (Number.isNaN(startDate.getTime())) {
      setForm((prev) => ({ ...prev, starts_at: value }));
      return;
    }
    const endsAt = new Date(startDate);
    endsAt.setHours(endsAt.getHours() + 1);
    setForm((prev) => ({
      ...prev,
      starts_at: value,
      ends_at: toInputValue(endsAt),
    }));
    if (repeatEnabled && repeatWeekdays.length === 0) {
      setRepeatWeekdays([toIsoWeekday(startDate)]);
    }
  }, [repeatEnabled, repeatWeekdays.length]);

  const handleFilterChange = useCallback((event) => {
    const { name, value } = event.target;
    setFilters((prev) => ({ ...prev, [name]: value }));
  }, []);

  const handleToggleWeekday = useCallback((value) => {
    setRepeatWeekdays((prev) => {
      if (prev.includes(value)) {
        return prev.filter((item) => item !== value);
      }
      return [...prev, value].sort((a, b) => a - b);
    });
  }, []);

  const openDrawer = useCallback(() => {
    setDrawerMode("form");
    setGroupContext(null);
    setIsDrawerOpen(true);
  }, []);

  const togglePendingDrawer = useCallback(() => {
    if (isDrawerOpen && drawerMode === "pending") {
      setIsDrawerOpen(false);
      return;
    }

    setDrawerMode("pending");
    setGroupContext(null);
    setIsDrawerOpen(true);
  }, [drawerMode, isDrawerOpen]);

  const closeDrawer = useCallback(() => {
    setIsDrawerOpen(false);
  }, []);

  const resetForm = useCallback(() => {
    setEditingId(null);
    setForm(emptyForm);
    setFormPatientQuery("");
    setIsFormPatientListOpen(false);
    setRepeatEnabled(false);
    setRepeatWeekdays([]);
    setRepeatMode("count");
    setRepeatCount("10");
    setRepeatWeeks("4");
  }, []);

  const handleCreateAt = useCallback(
    (date) => {
      resetForm();
      const endsAt = new Date(date);
      endsAt.setHours(endsAt.getHours() + 1);
      setDrawerMode("form");
      setGroupContext(null);
      setForm((prev) => ({
        ...prev,
        starts_at: toInputValue(date),
        ends_at: toInputValue(endsAt),
      }));
      setIsDrawerOpen(true);
    },
    [resetForm],
  );

  const handleOpenGroup = useCallback((date) => {
    setGroupContext({ date });
    setDrawerMode("group");
    setIsDrawerOpen(true);
  }, []);

  const handleDragStart = useCallback((event) => {
    const { id } = event.currentTarget.dataset;
    if (!id) return;
    const { dataTransfer } = event;
    dataTransfer.setData("text/plain", id);
    dataTransfer.effectAllowed = "move";
  }, []);

  const handleDropAt = useCallback(
    async (event, date) => {
      event.preventDefault();
      const id = event.dataTransfer.getData("text/plain");
      if (!id) return;
      const session = filteredSessions.find((item) => String(item.id) === id);
      if (!session) return;

      const startsAt = new Date(session.starts_at);
      const endsAt = session.ends_at ? new Date(session.ends_at) : null;
      const durationMs = endsAt && !Number.isNaN(endsAt.getTime())
        ? endsAt.getTime() - startsAt.getTime()
        : null;
      const newStart = new Date(date);
      const payload = {
        starts_at: newStart.toISOString(),
      };
      if (durationMs && durationMs > 0) {
        payload.ends_at = new Date(newStart.getTime() + durationMs).toISOString();
      }

      setIsSaving(true);
      try {
        await axios.put(`/sessions/${id}`, payload);
        toast.success("Agendamento reagendado.");
        if (view === "day") {
          await loadSessions(startOfDay(selectedDate), endOfDay(selectedDate));
        } else {
          await loadSessions();
        }
        await loadPendingSessions();
      } catch (error) {
        const message =
          error?.response?.data?.error ||
          "Nao foi possivel reagendar o agendamento.";
        toast.error(message);
      } finally {
        setIsSaving(false);
      }
    },
    [filteredSessions, loadPendingSessions, loadSessions, selectedDate, view],
  );

  const handleDragOver = useCallback((event) => {
    event.preventDefault();
    const { dataTransfer } = event;
    dataTransfer.dropEffect = "move";
  }, []);

  const handleEdit = useCallback(
    (event) => {
      const { id } = event.currentTarget.dataset;
      const session = filteredSessions.find((item) => String(item.id) === id);
      if (!session) return;
      setDrawerMode("form");
      setGroupContext(null);
      const patientName = session?.Patient?.full_name || session?.Patient?.name || "";
      const serviceFromCode = session.service_type
        ? servicesByCode.get(session.service_type)
        : null;
      let serviceIdValue = "";
      if (session.service_id) {
        serviceIdValue = String(session.service_id);
      } else if (serviceFromCode?.id) {
        serviceIdValue = String(serviceFromCode.id);
      }
      setEditingId(session.id);
      setRepeatEnabled(false);
      setRepeatWeekdays([]);
      setRepeatMode("count");
      setRepeatCount("10");
      setRepeatWeeks("4");
      setForm({
        patient_id: session.patient_id ? String(session.patient_id) : "",
        professional_user_id: session.professional_user_id
          ? String(session.professional_user_id)
          : "",
        service_type: session.service_type || session.Service?.code || "",
        service_id: serviceIdValue,
        status: session.status || "scheduled",
        is_initial: !!session.is_initial,
        starts_at: toInputValue(session.starts_at),
        ends_at: toInputValue(session.ends_at),
        notes: session.notes || "",
        absence_reason: session.absence_reason || "",
      });
      setFormPatientQuery(patientName);
      setIsFormPatientListOpen(false);
      setIsDrawerOpen(true);
    },
    [filteredSessions, servicesByCode],
  );

  const updateSessionStatus = useCallback(
    async ({ id, status, reason }) => {
      if (!id || !status) return;
      const payload = { status };
      if (reason) {
        payload.absence_reason = reason;
      }
      setIsSaving(true);
      try {
        await axios.put(`/sessions/${id}`, payload);
        toast.success("Agendamento atualizado.");
        if (view === "day") {
          await loadSessions(startOfDay(selectedDate), endOfDay(selectedDate));
        } else {
          await loadSessions();
        }
        await loadPendingSessions();
      } catch (error) {
        const message =
          error?.response?.data?.error ||
          "Nao foi possivel atualizar o agendamento.";
        toast.error(message);
      } finally {
        setIsSaving(false);
      }
    },
    [loadPendingSessions, loadSessions, selectedDate, view],
  );

  const handleQuickStatus = useCallback(
    async (event) => {
      const { id, status } = event.currentTarget.dataset;
      if (!id || !status) return;
      await updateSessionStatus({ id, status });
    },
    [updateSessionStatus],
  );

  const handleAbsence = useCallback((event) => {
    const { id, status } = event.currentTarget.dataset;
    if (!id || !status) return;
    setAbsenceModal({
      open: true,
      id,
      status,
      reason: "",
    });
  }, []);

  const handlePendingStatusChange = useCallback(
    async (id, status) => {
      if (!id || !status) return;

      if (status === "no_show" || status === "canceled") {
        setAbsenceModal({
          open: true,
          id,
          status,
          reason: "",
        });
        return;
      }

      await updateSessionStatus({ id, status });
    },
    [updateSessionStatus],
  );

  const handleConfirmAbsence = useCallback(async () => {
    if (!absenceModal.id || !absenceModal.status) return;
    if (!absenceModal.reason.trim()) {
      toast.error("Informe o motivo.");
      return;
    }
    await updateSessionStatus({
      id: absenceModal.id,
      status: absenceModal.status,
      reason: absenceModal.reason.trim(),
    });
    setAbsenceModal({ open: false, id: null, status: null, reason: "" });
  }, [absenceModal, updateSessionStatus]);

  const handleOpenPendingDay = useCallback((value) => {
    if (!value) return;
    const sessionDate = new Date(value);
    if (Number.isNaN(sessionDate.getTime())) return;
    setSelectedDate(sessionDate);
    setView("day");
    closeDrawer();
  }, [closeDrawer]);

  const handleSubmit = useCallback(
    async (event) => {
      event.preventDefault();
      if (!form.patient_id) {
        toast.error("Selecione o paciente.");
        return;
      }
      if (!form.starts_at) {
        toast.error("Informe a data e horario.");
        return;
      }
      if (!form.service_id && !form.service_type) {
        toast.error("Selecione o servico.");
        return;
      }
      const startsAtDate = new Date(form.starts_at);
      if (Number.isNaN(startsAtDate.getTime())) {
        toast.error("Data de inicio invalida.");
        return;
      }

      const isRecurring = repeatEnabled && !editingId;
      const endsAtDate = form.ends_at ? new Date(form.ends_at) : null;
      const hasValidEnd =
        endsAtDate && !Number.isNaN(endsAtDate.getTime()) && endsAtDate > startsAtDate;
      const durationMinutes = hasValidEnd
        ? Math.max(15, Math.round((endsAtDate - startsAtDate) / 60000))
        : 60;

      if (isRecurring) {
        if (repeatMode === "count") {
          const count = Number(repeatCount);
          if (!Number.isFinite(count) || count <= 0) {
            toast.error("Informe a quantidade de sessoes.");
            return;
          }
        }
        if (repeatMode === "weeks") {
          const weeks = Number(repeatWeeks);
          if (!Number.isFinite(weeks) || weeks <= 0) {
            toast.error("Informe o numero de semanas.");
            return;
          }
        }
      }

      const payload = {
        patient_id: Number(form.patient_id),
        professional_user_id: form.professional_user_id
          ? Number(form.professional_user_id)
          : null,
        service_type: form.service_type
          ? form.service_type.toLowerCase()
          : null,
        service_id: form.service_id ? Number(form.service_id) : null,
        status: form.status || "scheduled",
        is_initial: !!form.is_initial,
        starts_at: form.starts_at,
        ends_at: form.ends_at || null,
        notes: normalizeText(form.notes),
        absence_reason: normalizeText(form.absence_reason),
      };

      setIsSaving(true);
      try {
        if (isRecurring) {
          const weekdays = repeatWeekdays.length
            ? repeatWeekdays
            : [toIsoWeekday(startsAtDate)];
          let untilDate = null;
          if (repeatMode === "weeks") {
            const weeks = Math.max(1, Number(repeatWeeks) || 1);
            const endDate = new Date(startsAtDate);
            endDate.setHours(0, 0, 0, 0);
            endDate.setDate(endDate.getDate() + weeks * 7 - 1);
            untilDate = formatDateParam(endDate);
          }
          const seriesPayload = {
            patient_id: payload.patient_id,
            professional_user_id: payload.professional_user_id,
            service_type: payload.service_type,
            service_id: payload.service_id,
            status: payload.status,
            starts_at: startsAtDate.toISOString(),
            duration_minutes: durationMinutes,
            repeat_interval: 1,
            weekdays,
            until_date: repeatMode === "weeks" ? untilDate : null,
            occurrence_count: repeatMode === "count" ? Number(repeatCount) : null,
            notes: payload.notes,
          };
          const response = await axios.post("/session-series", seriesPayload);
          const total = response?.data?.total_sessions;
          toast.success(
            total ? `Serie criada (${total} sessoes).` : "Serie criada.",
          );
        } else if (editingId) {
          await axios.put(`/sessions/${editingId}`, payload);
          toast.success("Agendamento atualizado.");
        } else {
          await axios.post("/sessions", payload);
          toast.success("Agendamento criado.");
        }
        resetForm();
        closeDrawer();
        if (view === "day") {
          await loadSessions(startOfDay(selectedDate), endOfDay(selectedDate));
        } else {
          await loadSessions();
        }
        await loadPendingSessions();
      } catch (error) {
        const message =
          error?.response?.data?.error ||
          "Nao foi possivel salvar o agendamento.";
        toast.error(message);
      } finally {
        setIsSaving(false);
      }
    },
    [
      closeDrawer,
      editingId,
      form,
      loadSessions,
      loadPendingSessions,
      repeatEnabled,
      repeatMode,
      repeatCount,
      repeatWeeks,
      repeatWeekdays,
      resetForm,
      selectedDate,
      view,
    ],
  );

  const weekDays = useMemo(() => getWeekDays(selectedDate), [selectedDate]);
  const monthDays = useMemo(() => getMonthDays(selectedDate), [selectedDate]);

  const handlePrev = useCallback(() => {
    const next = new Date(selectedDate);
    if (view === "month") next.setMonth(next.getMonth() - 1);
    if (view === "week") next.setDate(next.getDate() - 7);
    if (view === "day") next.setDate(next.getDate() - 1);
    setSelectedDate(next);
  }, [selectedDate, view]);

  const handleNext = useCallback(() => {
    const next = new Date(selectedDate);
    if (view === "month") next.setMonth(next.getMonth() + 1);
    if (view === "week") next.setDate(next.getDate() + 7);
    if (view === "day") next.setDate(next.getDate() + 1);
    setSelectedDate(next);
  }, [selectedDate, view]);

  const handleToday = useCallback(() => {
    setSelectedDate(new Date());
  }, []);

  let drawerTitle = "Novo agendamento";
  if (drawerMode === "pending") {
    drawerTitle = "Pendencias";
  } else if (drawerMode === "group") {
    drawerTitle = "Detalhes do horario";
  } else if (editingId) {
    drawerTitle = `Editar #${editingId}`;
  }

  let drawerSubtitle = "Preencha os dados do atendimento.";
  if (drawerMode === "pending") {
    drawerSubtitle = "Confirme quem veio, faltou ou precisa de ajuste.";
  } else if (drawerMode === "group") {
    drawerSubtitle = "Gerencie os pacientes deste horario.";
  }

  return (
    <Wrapper>
      <Content>
        <Header>
          <div>
            <h1 className="font40 extraBold">Agendamentos</h1>
            <p className="font15">
              Visualize por semana, dia ou mes e edite com painel lateral.
            </p>
          </div>
          <BackLink to="/menu">Voltar</BackLink>
        </Header>

        <Toolbar>
          <ViewSwitch>
            <ToggleButton
              type="button"
              $active={view === "day"}
              onClick={() => setView("day")}
            >
              Dia
            </ToggleButton>
            <ToggleButton
              type="button"
              $active={view === "week"}
              onClick={() => setView("week")}
            >
              Semana
            </ToggleButton>
            <ToggleButton
              type="button"
              $active={view === "month"}
              onClick={() => setView("month")}
            >
              Mes
            </ToggleButton>
          </ViewSwitch>
          <DateNav>
            <NavButton type="button" onClick={handlePrev}>
              <FaChevronLeft />
            </NavButton>
            <DateLabel>
              {view === "day" && formatDate(selectedDate)}
              {view === "week" && formatWeekRange(weekDays[0], weekDays[6])}
              {view === "month" && formatMonthName(selectedDate)}
            </DateLabel>
            <NavButton type="button" onClick={handleNext}>
              <FaChevronRight />
            </NavButton>
            {view === "day" && (
              <SecondaryButton type="button" onClick={handleToday}>
                Hoje
              </SecondaryButton>
            )}
            {view === "week" && (
              <SecondaryButton type="button" onClick={handleToday}>
                Semana atual
              </SecondaryButton>
            )}
          </DateNav>
          <ToolbarActions>
            <NotificationButton
              type="button"
              onClick={togglePendingDrawer}
              $active={isDrawerOpen && drawerMode === "pending"}
              aria-label={`Abrir pendencias. ${pendingConfirmationSessions.length} pendencias.`}
            >
              <FaBell />
              <NotificationBadge $hasPending={pendingConfirmationSessions.length > 0}>
                {pendingConfirmationSessions.length}
              </NotificationBadge>
            </NotificationButton>
            <PrimaryButton type="button" onClick={openDrawer}>
              <FaPlus /> Novo agendamento
            </PrimaryButton>
          </ToolbarActions>
        </Toolbar>

        <FiltersRow>
          <FilterField>
            Status
            <select name="status" value={filters.status} onChange={handleFilterChange}>
              <option value="">Todos</option>
              {statusOptions.length === 0 && (
                <>
                  <option value="scheduled">Agendado</option>
                  <option value="done">Concluido</option>
                  <option value="canceled">Cancelado</option>
                  <option value="no_show">Falta</option>
                </>
              )}
              {statusOptions.map((status) => (
                <option key={status.code} value={status.code}>
                  {status.label || status.code}
                </option>
              ))}
            </select>
          </FilterField>
          <FilterField>
            Tipo
            <select
              name="service_type"
              value={filters.service_type}
              onChange={handleFilterChange}
            >
              <option value="">Todos</option>
              {allServiceOptions.map((service) => (
                <option
                  key={service.id ? `id-${service.id}` : `code-${service.code}`}
                  value={service.code}
                >
                  {service.name}
                </option>
              ))}
            </select>
          </FilterField>
          <FilterField>
            Paciente
            <AutoComplete>
              <SearchInput
                type="text"
                placeholder="Buscar paciente"
                value={filterPatientQuery}
                onChange={(event) => {
                  setFilterPatientQuery(event.target.value);
                  setIsFilterPatientListOpen(true);
                  if (filters.patient_id) {
                    setFilters((prev) => ({ ...prev, patient_id: "" }));
                  }
                }}
                onFocus={() => setIsFilterPatientListOpen(true)}
                onBlur={() => {
                  setTimeout(() => setIsFilterPatientListOpen(false), 150);
                }}
              />
              {isFilterPatientListOpen &&
                filteredPatientOptions.length > 0 &&
                filterPatientQuery && (
                  <AutoList>
                    {filteredPatientOptions.slice(0, 8).map((patient) => (
                      <AutoItem
                        key={patient.id}
                        type="button"
                        onClick={() => {
                          setFilters((prev) => ({
                            ...prev,
                            patient_id: String(patient.id),
                          }));
                          setFilterPatientQuery(patient.name);
                          setIsFilterPatientListOpen(false);
                        }}
                        onMouseDown={(event) => event.preventDefault()}
                      >
                        {patient.name}
                      </AutoItem>
                    ))}
                  </AutoList>
                )}
            </AutoComplete>
          </FilterField>
        </FiltersRow>
        <Legend>
          {allServiceOptions.map((service) => (
            <LegendItem
              key={service.id ? `id-${service.id}` : `code-${service.code}`}
            >
              <TypePill $type={service.code} $color={service.color}>
                {service.name}
              </TypePill>
            </LegendItem>
          ))}
        </Legend>

        <Loading isLoading={isLoading} />

        {view === "week" && (
          <WeekGrid>
            <WeekHeader>
              <div />
              {weekDays.map((day) => (
                <WeekHeaderCell key={day.toISOString()}>
                  <span>{day.toLocaleDateString("pt-BR", { weekday: "short" })}</span>
                  <strong>{day.getDate()}</strong>
                </WeekHeaderCell>
              ))}
            </WeekHeader>
            <WeekBody>
              {Array.from({ length: END_HOUR - START_HOUR + 1 }).map((_, index) => {
                const hour = START_HOUR + index;
                return (
                  <WeekRow key={hour}>
                    <TimeCell>{`${hour.toString().padStart(2, "0")}:00`}</TimeCell>
                    {weekDays.map((day) => {
                      const slotDate = new Date(day);
                      slotDate.setHours(hour, 0, 0, 0);
                      const groups = getSlotGroups(day, hour);
                      return (
                        <SlotCell
                          key={`${day.toISOString()}-${hour}`}
                          onClick={() => handleCreateAt(slotDate)}
                          onDragOver={handleDragOver}
                          onDrop={(event) => handleDropAt(event, slotDate)}
                        >
                          {groups.length === 0 && (
                            <SlotHint>+ Adicionar</SlotHint>
                          )}
                          {groups.map((group) => {
                            const { limit } = group;
                            const label = serviceName(group.service_type);
                            const countLabel = limit && limit > 0
                              ? `${group.count}/${limit}`
                              : `${group.count}`;
                            return (
                              <GroupPill
                                key={`${group.service_type}-${day.toISOString()}-${hour}`}
                                $type={group.service_type}
                                $color={group.service?.color || serviceColor(group.service_type)}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  handleOpenGroup(slotDate);
                                }}
                              >
                                <span>{label}</span>
                                <strong>{countLabel}</strong>
                              </GroupPill>
                            );
                          })}
                        </SlotCell>
                      );
                    })}
                  </WeekRow>
                );
              })}
            </WeekBody>
          </WeekGrid>
        )}
        {view === "day" && (
          <DayPanel>
            <DayHeader>
              <h2>{formatDate(selectedDate)}</h2>
              <SecondaryButton type="button" onClick={() => handleCreateAt(selectedDate)}>
                Adicionar horario
              </SecondaryButton>
            </DayHeader>
            {daySessions.length === 0 && (
              <EmptyState>Nenhum agendamento para este dia.</EmptyState>
            )}
            <DayList>
              {daySessions.map((session) => (
                <DayCard
                  key={session.id}
                  data-id={session.id}
                  draggable
                  onDragStart={handleDragStart}
                >
                  <DayCardInfo>
                    <TypePill
                      $type={session.service_type || session.Service?.code}
                      $color={serviceColor(session.service_type || session.Service?.code)}
                    >
                      {serviceName(session.service_type || session.Service?.code)}
                    </TypePill>
                    <h3>{session?.Patient?.full_name || "Paciente"}</h3>
                    <span>{formatDateTime(session.starts_at)}</span>
                    <span>{session?.professional?.name || "Profissional"}</span>
                  </DayCardInfo>
                  <DayCardActions>
                    <StatusPill $status={statusStyle(session.status)}>
                      {statusLabel(session.status)}
                    </StatusPill>
                    <ActionButton
                      type="button"
                      data-id={session.id}
                      onClick={handleEdit}
                    >
                      Editar
                    </ActionButton>
                    <QuickButton
                      type="button"
                      data-id={session.id}
                      data-status="done"
                      onClick={handleQuickStatus}
                    >
                      <FaCheckCircle /> Concluir
                    </QuickButton>
                    <QuickButton
                      type="button"
                      data-id={session.id}
                      data-status="no_show"
                      onClick={handleAbsence}
                    >
                      <FaTimesCircle /> Falta
                    </QuickButton>
                    <QuickButton
                      type="button"
                      data-id={session.id}
                      data-status="canceled"
                      onClick={handleQuickStatus}
                    >
                      <FaTimesCircle /> Cancelar
                    </QuickButton>
                  </DayCardActions>
                </DayCard>
              ))}
            </DayList>
          </DayPanel>
        )}

        {view === "month" && (
          <MonthPanel>
            <MonthGrid>
              {["Seg", "Ter", "Qua", "Qui", "Sex", "Sab", "Dom"].map((label) => (
                <MonthHeader key={label}>{label}</MonthHeader>
              ))}
              {monthDays.map((day) => {
                const key = startOfDay(day).toISOString();
                const count = (sessionsByDay.get(key) || []).length;
                const isCurrentMonth = day.getMonth() === selectedDate.getMonth();
                return (
                  <MonthCell
                    key={day.toISOString()}
                    $inactive={!isCurrentMonth}
                    $active={sameDay(day, selectedDate)}
                    onClick={() => {
                      setSelectedDate(day);
                      setView("day");
                    }}
                  >
                    <div>
                      <strong>{day.getDate()}</strong>
                      {count > 0 && <CountBadge>{count}</CountBadge>}
                    </div>
                  </MonthCell>
                );
              })}
            </MonthGrid>
            <MonthHint>
              Clique em um dia para abrir a agenda detalhada.
            </MonthHint>
          </MonthPanel>
        )}

        <Drawer $open={isDrawerOpen}>
          <DrawerHeader>
            <div>
              <h2>
                {drawerTitle}
              </h2>
              <span>
                {drawerSubtitle}
              </span>
            </div>
            <IconButton type="button" onClick={closeDrawer}>
              <FaTimes />
            </IconButton>
          </DrawerHeader>
          <DrawerBody>
            <Loading isLoading={isSaving} />
            {drawerMode === "pending" && (
              <PendingDrawerPanel>
                {pendingConfirmationSessions.length === 0 ? (
                  <EmptyState>Nenhuma pendencia no periodo carregado.</EmptyState>
                ) : (
                  <PendingGroupList>
                    {pendingConfirmationGroups.map((group) => (
                      <PendingGroup key={group.key}>
                        <PendingGroupHeader>
                          <div>
                            <PendingGroupTitle>
                              {formatPendingDayLabel(group.date)}
                            </PendingGroupTitle>
                            <PendingGroupMeta>
                              {group.sessionCount} pendencia
                              {group.sessionCount > 1 ? "s" : ""}
                            </PendingGroupMeta>
                          </div>
                          <SecondaryButton
                            type="button"
                            onClick={() => handleOpenPendingDay(group.date)}
                          >
                            Abrir dia
                          </SecondaryButton>
                        </PendingGroupHeader>
                        <PendingTimeList>
                          {group.timeGroups.map((timeGroup) => (
                            <PendingTimeGroup key={timeGroup.key}>
                              <PendingTimeHeader>
                                <div>
                                  <PendingTimeTitle>
                                    {formatPendingTimeLabel(timeGroup.startsAt)}
                                  </PendingTimeTitle>
                                  <PendingTimeMeta>
                                    {timeGroup.sessionCount} pendencia
                                    {timeGroup.sessionCount > 1 ? "s" : ""}
                                  </PendingTimeMeta>
                                </div>
                              </PendingTimeHeader>
                              <PendingServiceList>
                                {timeGroup.serviceGroups.map((serviceGroup) => (
                                  <PendingServiceGroup
                                    key={serviceGroup.key}
                                    $color={serviceGroup.serviceColor}
                                  >
                                    <PendingServiceHeader $color={serviceGroup.serviceColor}>
                                      <PendingServiceTitle>
                                        {serviceGroup.serviceLabel} - {serviceGroup.professionalName}
                                      </PendingServiceTitle>
                                      <PendingServiceCount>
                                        {serviceGroup.sessions.length}
                                      </PendingServiceCount>
                                    </PendingServiceHeader>
                                    <PendingList>
                                      {serviceGroup.sessions.map((session) => (
                                        <PendingCard key={session.id}>
                                          <PendingInfo>
                                            <strong>
                                              {session?.Patient?.full_name || "Paciente"}
                                            </strong>
                                          </PendingInfo>
                                          <PendingActionSection>
                                            <PendingActionTitle>
                                              Atualizar status
                                            </PendingActionTitle>
                                            <PendingStatusGrid>
                                              {pendingStatusOptions.map((status) => (
                                                <PendingStatusButton
                                                  key={`${session.id}-${status.code}`}
                                                  type="button"
                                                  $variant={statusStyle(status.code)}
                                                  onClick={() =>
                                                    handlePendingStatusChange(
                                                      String(session.id),
                                                      status.code,
                                                    )
                                                  }
                                                >
                                                  {status.label}
                                                </PendingStatusButton>
                                              ))}
                                            </PendingStatusGrid>
                                          </PendingActionSection>
                                        </PendingCard>
                                      ))}
                                    </PendingList>
                                  </PendingServiceGroup>
                                ))}
                              </PendingServiceList>
                            </PendingTimeGroup>
                          ))}
                        </PendingTimeList>
                      </PendingGroup>
                    ))}
                  </PendingGroupList>
                )}
              </PendingDrawerPanel>
            )}
            {drawerMode === "group" && (
              <GroupPanel>
                <GroupHeader>
                  <div>
                    <h3>{groupContext ? formatDateTime(groupContext.date) : ""}</h3>
                    <span>Visão completa do horário</span>
                  </div>
                  <SecondaryButton
                    type="button"
                    onClick={() => {
                      if (!groupContext?.date) return;
                      resetForm();
                      const endsAt = new Date(groupContext.date);
                      endsAt.setHours(endsAt.getHours() + 1);
                      setDrawerMode("form");
                      setGroupContext(null);
                      setForm((prev) => ({
                        ...prev,
                        starts_at: toInputValue(groupContext.date),
                        ends_at: toInputValue(endsAt),
                      }));
                      setFormPatientQuery("");
                      setIsFormPatientListOpen(false);
                    }}
                  >
                    <FaPlus /> Adicionar paciente
                  </SecondaryButton>
                </GroupHeader>
                {groupSessions.length === 0 && (
                  <EmptyState>Sem pacientes neste horÃ¡rio.</EmptyState>
                )}
                <GroupList>
                  {groupSessions.map((group) => (
                    <GroupSection
                      key={group.service_type}
                      $color={group.service?.color || serviceColor(group.service_type)}
                    >
                      <GroupSectionHeader
                        $color={group.service?.color || serviceColor(group.service_type)}
                      >
                        <div>
                          <GroupSectionTitle>
                            {serviceName(group.service_type)}
                          </GroupSectionTitle>
                          <GroupSectionMeta>
                            {group.count}
                            {group.limit && group.limit > 0 ? ` / ${group.limit}` : ""} pacientes
                          </GroupSectionMeta>
                        </div>
                        <GroupCountBadge>{group.count}</GroupCountBadge>
                      </GroupSectionHeader>
                      {group.sessions.map((session) => (
                        <GroupItem key={session.id}>
                          <PatientInfo>
                            <strong>{session?.Patient?.full_name || "Paciente"}</strong>
                            <span>{session?.professional?.name || "Profissional"}</span>
                          </PatientInfo>
                          <GroupActions>
                            <ActionGrid>
                              <StatusAction
                                type="button"
                                data-id={session.id}
                                data-status="scheduled"
                                $status="scheduled"
                                $active={session.status === "scheduled" || session.status === "open"}
                                onClick={handleQuickStatus}
                              >
                                Agendado
                              </StatusAction>
                              <StatusAction
                                type="button"
                                data-id={session.id}
                                data-status="done"
                                $status="done"
                                $active={session.status === "done"}
                                onClick={handleQuickStatus}
                              >
                                Concluido
                              </StatusAction>
                              <StatusAction
                                type="button"
                                data-id={session.id}
                                data-status="no_show"
                                $status="no_show"
                                $active={session.status === "no_show"}
                                onClick={handleAbsence}
                              >
                                Falta
                              </StatusAction>
                              <StatusAction
                                type="button"
                                data-id={session.id}
                                data-status="canceled"
                                $status="canceled"
                                $active={session.status === "canceled"}
                                onClick={handleAbsence}
                              >
                                Cancelado
                              </StatusAction>
                            </ActionGrid>
                            <SmallEdit
                              type="button"
                              data-id={session.id}
                              onClick={handleEdit}
                            >
                              Editar
                            </SmallEdit>
                          </GroupActions>
                        </GroupItem>
                      ))}
                    </GroupSection>
                  ))}
                </GroupList>
              </GroupPanel>
            )}
            {drawerMode !== "pending" && drawerMode !== "group" && (
              <Form onSubmit={handleSubmit}>
                <FormGrid>
                  <Field className="span-2">
                    Paciente *
                    <AutoComplete>
                      <SearchInput
                        type="text"
                        placeholder="Buscar paciente"
                        value={formPatientQuery}
                        onChange={(event) => {
                          setFormPatientQuery(event.target.value);
                          setIsFormPatientListOpen(true);
                          if (form.patient_id) {
                            setForm((prev) => ({ ...prev, patient_id: "" }));
                          }
                        }}
                        onFocus={() => setIsFormPatientListOpen(true)}
                        onBlur={() => {
                          setTimeout(() => setIsFormPatientListOpen(false), 150);
                        }}
                      />
                      {isFormPatientListOpen &&
                        filteredFormPatientOptions.length > 0 &&
                        formPatientQuery && (
                          <AutoList>
                            {filteredFormPatientOptions.slice(0, 8).map((patient) => (
                              <AutoItem
                                key={patient.id}
                                type="button"
                                onClick={() => handleSelectPatient(patient)}
                                onMouseDown={(event) => event.preventDefault()}
                              >
                                {patient.name}
                              </AutoItem>
                            ))}
                          </AutoList>
                        )}
                      {selectedPatient && (
                        <SelectedHint>
                          Selecionado: <strong>{selectedPatient.name}</strong>
                        </SelectedHint>
                      )}
                    </AutoComplete>
                  </Field>
                  <Field className="span-2">
                    Profissional
                    <select
                      name="professional_user_id"
                      value={form.professional_user_id}
                      onChange={handleFormChange}
                    >
                      <option value="" disabled hidden>
                        Selecionar
                      </option>
                      {professionalOptions.map((professional) => (
                        <option key={professional.id} value={professional.id}>
                          {professional.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field>
                    Tipo de atendimento
                    <select
                      name="service_id"
                      value={form.service_id}
                      onChange={(event) => {
                        const selectedId = event.target.value;
                        const service = serviceOptions.find(
                          (item) => String(item.id) === selectedId,
                        );
                        setForm((prev) => ({
                          ...prev,
                          service_id: selectedId,
                          service_type: service?.code || "",
                        }));
                      }}
                    >
                      <option value="" disabled hidden>
                        Selecionar
                      </option>
                      {serviceOptions.length === 0 && (
                        <>
                          <option value="fisioterapia">Fisioterapia</option>
                          <option value="funcional">Funcional</option>
                          <option value="pilates">Pilates</option>
                          <option value="outro">Outro</option>
                        </>
                      )}
                      {serviceOptions.map((service) => (
                        <option key={service.id} value={service.id}>
                          {service.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field>
                    Status
                    <select
                      name="status"
                      value={form.status}
                      onChange={handleFormChange}
                    >
                      {statusOptions.length === 0 && (
                        <>
                          <option value="scheduled">Agendado</option>
                          <option value="done">Concluido</option>
                          <option value="canceled">Cancelado</option>
                          <option value="no_show">Falta</option>
                        </>
                      )}
                      {statusOptions.map((status) => (
                        <option key={status.code} value={status.code}>
                          {status.label || status.code}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field>
                    Inicio *
                    <InputRow>
                      <input
                        ref={startsAtRef}
                        type="datetime-local"
                        name="starts_at"
                        value={form.starts_at}
                        onChange={handleStartsAtChange}
                      />
                      <OkButton
                        type="button"
                        onClick={() => startsAtRef.current && startsAtRef.current.blur()}
                        aria-label="Confirmar data de inicio"
                      >
                        OK
                      </OkButton>
                    </InputRow>
                  </Field>
                  <Field>
                    Fim
                    <InputRow>
                      <input
                        ref={endsAtRef}
                        type="datetime-local"
                        name="ends_at"
                        value={form.ends_at}
                        onChange={handleFormChange}
                      />
                      <OkButton
                        type="button"
                        onClick={() => endsAtRef.current && endsAtRef.current.blur()}
                        aria-label="Confirmar data de fim"
                      >
                        OK
                      </OkButton>
                    </InputRow>
                  </Field>
                  <Field className="span-2">
                    Tipo da sessao
                    <select
                      name="is_initial"
                      value={form.is_initial ? "true" : "false"}
                      onChange={(event) =>
                        setForm((prev) => ({
                          ...prev,
                          is_initial: event.target.value === "true",
                        }))
                      }
                    >
                      <option value="false">Sessao normal</option>
                      <option value="true">1a avaliacao</option>
                    </select>
                  </Field>
                  <RepeatCard className="span-2">
                    <RepeatHeader>
                      <div>
                        <strong>Repetição</strong>
                      </div>
                      <RepeatToggle>
                        <input
                          type="checkbox"
                          checked={repeatEnabled}
                          disabled={!!editingId}
                          onChange={(event) => {
                            const { checked } = event.target;
                            setRepeatEnabled(checked);
                            if (
                              checked &&
                              repeatWeekdays.length === 0 &&
                              form.starts_at
                            ) {
                              const start = new Date(form.starts_at);
                              if (!Number.isNaN(start.getTime())) {
                                setRepeatWeekdays([toIsoWeekday(start)]);
                              }
                            }
                          }}
                        />
                        <span>{repeatEnabled ? "Ativo" : "Inativo"}</span>
                      </RepeatToggle>
                    </RepeatHeader>
                    {!repeatEnabled && (
                      <RepeatHint>
                        {editingId ? "Repetição só em novos agendamentos." : "Ative para repetir."}
                      </RepeatHint>
                    )}
                    {repeatEnabled && (
                      <RepeatBody>
                        <RepeatRow>
                          <RepeatField className="full">
                            <RepeatLabel>Modo</RepeatLabel>
                            <RepeatModes>
                              <RepeatModeButton
                                type="button"
                                $active={repeatMode === "count"}
                                onClick={() => setRepeatMode("count")}
                              >
                                Quantidade
                              </RepeatModeButton>
                              <RepeatModeButton
                                type="button"
                                $active={repeatMode === "weeks"}
                                onClick={() => setRepeatMode("weeks")}
                              >
                                Por semanas
                              </RepeatModeButton>
                            </RepeatModes>
                          </RepeatField>
                        </RepeatRow>
                        <RepeatRow>
                          {repeatMode === "count" ? (
                            <RepeatField className="full">
                              <RepeatLabel>Quantas sessoes?</RepeatLabel>
                              <RepeatInline>
                                <input
                                  type="number"
                                  min="1"
                                  value={repeatCount}
                                  onChange={(event) =>
                                    setRepeatCount(event.target.value)
                                  }
                                  placeholder="Ex.: 10"
                                />
                                <span>sessoes</span>
                              </RepeatInline>
                              <RepeatHelper>Ex.: 10 sessoes, Seg/Qua/Sex.</RepeatHelper>
                            </RepeatField>
                          ) : (
                            <RepeatField className="full">
                              <RepeatLabel>Por quantas semanas?</RepeatLabel>
                              <RepeatInline>
                                <input
                                  type="number"
                                  min="1"
                                  value={repeatWeeks}
                                  onChange={(event) =>
                                    setRepeatWeeks(event.target.value)
                                  }
                                  placeholder="Ex.: 4"
                                />
                                <span>semanas</span>
                              </RepeatInline>
                              <RepeatHelper>
                                Ex.: Seg/Qua/Sex nas proximas 4 semanas.
                              </RepeatHelper>
                            </RepeatField>
                          )}
                        </RepeatRow>
                        <RepeatRow>
                          <RepeatField className="full">
                            <RepeatLabel>Quais dias?</RepeatLabel>
                            <RepeatHelper>Toque para selecionar.</RepeatHelper>
                            <WeekdayGrid>
                              {WEEKDAY_OPTIONS.map((option) => (
                                <WeekdayButton
                                  key={option.value}
                                  type="button"
                                  $active={repeatWeekdays.includes(option.value)}
                                  onClick={() => handleToggleWeekday(option.value)}
                                >
                                  {option.label}
                                </WeekdayButton>
                              ))}
                            </WeekdayGrid>
                          </RepeatField>
                        </RepeatRow>
                      </RepeatBody>
                    )}
                  </RepeatCard>
                  <Field className="span-2">
                    Observacoes
                    <textarea
                      name="notes"
                      value={form.notes}
                      onChange={handleFormChange}
                      rows={3}
                    />
                  </Field>
                </FormGrid>
                <DrawerActions>
                  <SecondaryButton type="button" onClick={closeDrawer}>
                    Cancelar
                  </SecondaryButton>
                  <PrimaryButton type="submit" disabled={isSaving}>
                    {editingId ? "Salvar" : "Criar agendamento"}
                  </PrimaryButton>
                </DrawerActions>
              </Form>
            )}
          </DrawerBody>
        </Drawer>
        {isDrawerOpen && <Backdrop onClick={closeDrawer} />}
        {absenceModal.open && (
          <ModalOverlay>
            <ModalCard>
              <ModalHeader>
                <h3>Motivo da falta/cancelamento</h3>
                <IconButton
                  type="button"
                  onClick={() =>
                    setAbsenceModal({ open: false, id: null, status: null, reason: "" })
                  }
                >
                  <FaTimes />
                </IconButton>
              </ModalHeader>
              <ModalBody>
                <textarea
                  rows={4}
                  placeholder="Descreva o motivo"
                  value={absenceModal.reason}
                  onChange={(event) =>
                    setAbsenceModal((prev) => ({ ...prev, reason: event.target.value }))
                  }
                />
              </ModalBody>
              <ModalActions>
                <SecondaryButton
                  type="button"
                  onClick={() =>
                    setAbsenceModal({ open: false, id: null, status: null, reason: "" })
                  }
                >
                  Cancelar
                </SecondaryButton>
                <PrimaryButton type="button" onClick={handleConfirmAbsence}>
                  Salvar
                </PrimaryButton>
              </ModalActions>
            </ModalCard>
          </ModalOverlay>
        )}
      </Content>
    </Wrapper>
  );
}
const Wrapper = styled.section`
  min-height: 100vh;
  background: #f7f8f4;
  padding: 90px 0 60px;
`;

const Content = styled.div`
  width: 100%;
  max-width: 1280px;
  margin: 0 auto;
  padding: 0 30px;
  @media only screen and (max-width: 859px) {
    padding: 0 15px;
  }
`;

const Header = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 24px;

  h1 {
    color: #1b1b1b;
    margin-bottom: 6px;
  }

  p {
    color: #6a795c;
  }

  @media (min-width: 720px) {
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
  }
`;

const BackLink = styled(Link)`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 10px 18px;
  border-radius: 10px;
  background: #fff;
  color: #6a795c;
  text-decoration: none;
  font-weight: 600;
  border: 1px solid rgba(106, 121, 92, 0.3);
`;

const Toolbar = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 16px;
  align-items: center;
  margin-bottom: 18px;
`;

const ViewSwitch = styled.div`
  display: inline-flex;
  background: #fff;
  border: 1px solid rgba(106, 121, 92, 0.2);
  border-radius: 12px;
  overflow: hidden;
  width: fit-content;
`;

const ToggleButton = styled.button`
  padding: 10px 16px;
  border: none;
  background: ${(props) => (props.$active ? "#6a795c" : "transparent")};
  color: ${(props) => (props.$active ? "#fff" : "#6a795c")};
  font-weight: 700;
  cursor: pointer;
`;

const DateNav = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  justify-content: center;
`;

const ToolbarActions = styled.div`
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 12px;
  flex-wrap: wrap;
`;

const NavButton = styled.button`
  width: 36px;
  height: 36px;
  border-radius: 10px;
  border: 1px solid rgba(106, 121, 92, 0.2);
  background: #fff;
  color: #6a795c;
  display: flex;
  align-items: center;
  justify-content: center;
`;

const DateLabel = styled.span`
  font-weight: 700;
  color: #1b1b1b;
  min-width: 120px;
  text-align: center;
`;

const FiltersRow = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 12px;
  margin-bottom: 20px;
`;

const NotificationButton = styled.button`
  position: relative;
  width: 46px;
  height: 46px;
  border-radius: 14px;
  border: 1px solid
    ${(props) =>
      props.$active ? "rgba(185, 120, 35, 0.35)" : "rgba(106, 121, 92, 0.2)"};
  background: ${(props) => (props.$active ? "#fff5e7" : "#fff")};
  color: ${(props) => (props.$active ? "#8a5718" : "#6a795c")};
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 1.15rem;
  transition: transform 120ms ease, box-shadow 120ms ease, border-color 120ms ease;
  cursor: pointer;

  &:hover {
    transform: translateY(-1px);
    box-shadow: 0 10px 20px rgba(42, 52, 35, 0.08);
  }
`;

const NotificationBadge = styled.span`
  position: absolute;
  top: -7px;
  right: -7px;
  min-width: 22px;
  height: 22px;
  padding: 0 6px;
  border-radius: 999px;
  background: ${(props) => (props.$hasPending ? "#c63b32" : "#dfe6d8")};
  color: #fff;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-weight: 800;
  font-size: 0.72rem;
`;

const PendingList = styled.div`
  display: grid;
  gap: 12px;
`;

const PendingDrawerPanel = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
`;

const PendingGroupList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 18px;
`;

const PendingGroup = styled.section`
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const PendingGroupHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding-bottom: 10px;
  border-bottom: 1px solid rgba(106, 121, 92, 0.14);
  flex-wrap: wrap;
`;

const PendingGroupTitle = styled.h3`
  margin: 0;
  color: #1b1b1b;
  font-size: 1rem;
  text-transform: capitalize;
`;

const PendingGroupMeta = styled.span`
  display: inline-block;
  margin-top: 4px;
  color: #6a795c;
  font-size: 0.84rem;
`;

const PendingTimeList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const PendingTimeGroup = styled.section`
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px;
  border-radius: 12px;
  background: #fbfcf8;
  border: 1px solid rgba(106, 121, 92, 0.12);
`;

const PendingTimeHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
`;

const PendingTimeTitle = styled.h4`
  margin: 0;
  color: #1b1b1b;
  font-size: 0.95rem;
`;

const PendingTimeMeta = styled.span`
  display: inline-block;
  margin-top: 4px;
  color: #6a795c;
  font-size: 0.8rem;
`;

const PendingServiceList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

const PendingServiceGroup = styled.section`
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 10px;
  border-radius: 12px;
  border: 1px solid
    ${(props) =>
      props.$color ? `${props.$color}55` : "rgba(106, 121, 92, 0.16)"};
  background: ${(props) =>
    props.$color ? `${props.$color}12` : "rgba(255, 255, 255, 0.92)"};
`;

const PendingServiceHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 12px;
  border-radius: 10px;
  background: ${(props) =>
    props.$color ? `${props.$color}22` : "rgba(106, 121, 92, 0.1)"};
`;

const PendingServiceTitle = styled.h5`
  margin: 0;
  color: #1b1b1b;
  font-size: 0.92rem;
`;

const PendingServiceCount = styled.span`
  min-width: 30px;
  height: 30px;
  padding: 0 8px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.78);
  color: #1b1b1b;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 0.78rem;
  font-weight: 800;
`;

const PendingCard = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 12px;
  border-radius: 12px;
  border: 1px solid rgba(214, 170, 104, 0.28);
  background: #fff;
`;

const PendingInfo = styled.div`
  display: grid;
  gap: 6px;

  strong {
    color: #1b1b1b;
    font-size: 1rem;
  }
`;

const PendingActionSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-top: 12px;
  border-top: 1px solid rgba(106, 121, 92, 0.12);
`;

const PendingActionTitle = styled.span`
  font-size: 0.76rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: #6a795c;
`;

const PendingStatusGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(96px, 1fr));
  gap: 8px;
`;

const PendingStatusButton = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 34px;
  padding: 7px 10px;
  border-radius: 9px;
  border: 1px solid
    ${(props) => {
      if (props.$variant === "done") return "rgba(94, 135, 90, 0.32)";
      if (props.$variant === "canceled") return "rgba(199, 102, 102, 0.3)";
      if (props.$variant === "no_show") return "rgba(214, 170, 104, 0.34)";
      return "rgba(106, 121, 92, 0.24)";
    }};
  background: ${(props) => {
    if (props.$variant === "done") return "rgba(94, 135, 90, 0.12)";
    if (props.$variant === "canceled") return "rgba(199, 102, 102, 0.11)";
    if (props.$variant === "no_show") return "rgba(214, 170, 104, 0.14)";
    return "#f7f8f4";
  }};
  color: ${(props) => {
    if (props.$variant === "done") return "#2f5a33";
    if (props.$variant === "canceled") return "#7b3a3a";
    if (props.$variant === "no_show") return "#8a5718";
    return "#516046";
  }};
  font-weight: 700;
  font-size: 0.82rem;
  cursor: pointer;
  transition: transform 120ms ease, box-shadow 120ms ease, filter 120ms ease;

  &:hover {
    transform: translateY(-1px);
    box-shadow: 0 8px 18px rgba(42, 52, 35, 0.08);
    filter: brightness(0.98);
  }
`;

const Legend = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 18px;
`;

const LegendItem = styled.div`
  display: inline-flex;
  align-items: center;
`;

const FilterField = styled.label`
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 0.9rem;
  color: #1b1b1b;

  select {
    height: 40px;
    border-radius: 10px;
    border: 1px solid rgba(106, 121, 92, 0.2);
    padding: 0 10px;
    background: #fff;
  }
`;

const WeekGrid = styled.div`
  border-radius: 16px;
  overflow: hidden;
  border: 1px solid rgba(106, 121, 92, 0.2);
  background: #fff;
`;

const WeekHeader = styled.div`
  display: grid;
  grid-template-columns: 80px repeat(7, 1fr);
  background: #f2f4ee;
  border-bottom: 1px solid rgba(106, 121, 92, 0.15);
`;

const WeekHeaderCell = styled.div`
  padding: 10px;
  text-align: center;
  span {
    display: block;
    color: #6a795c;
    font-size: 0.8rem;
  }
  strong {
    font-size: 1rem;
    color: #1b1b1b;
  }
`;

const WeekBody = styled.div`
  display: grid;
`;

const WeekRow = styled.div`
  display: grid;
  grid-template-columns: 80px repeat(7, 1fr);
  min-height: 80px;
  border-bottom: 1px solid rgba(106, 121, 92, 0.1);
`;

const TimeCell = styled.div`
  padding: 10px;
  color: #6a795c;
  font-weight: 600;
  border-right: 1px solid rgba(106, 121, 92, 0.1);
  background: #fafbf8;
`;

const SlotCell = styled.div`
  padding: 6px;
  border-right: 1px solid rgba(106, 121, 92, 0.08);
  display: flex;
  flex-direction: column;
  gap: 6px;
  cursor: pointer;
  &:hover {
    background: rgba(162, 177, 144, 0.08);
  }
`;

const SlotHint = styled.div`
  font-size: 0.75rem;
  color: #9aa58f;
`;

const GroupPill = styled.div`
  padding: 6px 8px;
  border-radius: 10px;
  background: ${(props) => {
    if (props.$color) return `${props.$color}33`;
    if (props.$type === "pilates") return "rgba(122, 156, 112, 0.22)";
    if (props.$type === "funcional") return "rgba(120, 145, 176, 0.22)";
    if (props.$type === "fisioterapia") return "rgba(162, 177, 144, 0.35)";
    if (props.$type === "outro") return "rgba(201, 188, 152, 0.25)";
    return "rgba(162, 177, 144, 0.2)";
  }};
  border: 1px solid rgba(106, 121, 92, 0.2);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  cursor: pointer;
  span {
    font-size: 0.75rem;
    font-weight: 700;
    color: #42523a;
  }
  strong {
    font-size: 0.75rem;
    color: #1b1b1b;
  }
`;

const DayPanel = styled.div`
  background: #fff;
  border-radius: 16px;
  border: 1px solid rgba(106, 121, 92, 0.18);
  padding: 20px;
`;

const DayHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
  h2 {
    margin: 0;
    color: #1b1b1b;
  }
`;

const DayList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const DayCard = styled.div`
  padding: 16px;
  border-radius: 12px;
  border: 1px solid rgba(106, 121, 92, 0.18);
  background: #fdfdfb;
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const DayCardInfo = styled.div`
  display: grid;
  gap: 6px;
  h3 {
    margin: 0;
    color: #1b1b1b;
  }
  span {
    color: #6a795c;
  }
`;

const DayCardActions = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;
`;

const MonthPanel = styled.div`
  background: #fff;
  border-radius: 16px;
  border: 1px solid rgba(106, 121, 92, 0.18);
  padding: 16px;
`;

const MonthGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 8px;
`;

const MonthHeader = styled.div`
  text-align: center;
  font-weight: 700;
  color: #6a795c;
  padding: 6px;
`;

const MonthCell = styled.div`
  min-height: 70px;
  border-radius: 12px;
  border: 1px solid rgba(106, 121, 92, 0.15);
  padding: 8px;
  cursor: pointer;
  background: ${(props) => (props.$active ? "rgba(162, 177, 144, 0.25)" : "#fff")};
  opacity: ${(props) => (props.$inactive ? 0.45 : 1)};
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  strong {
    color: #1b1b1b;
  }
`;

const CountBadge = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 4px 8px;
  border-radius: 999px;
  background: #6a795c;
  color: #fff;
  font-size: 0.7rem;
  margin-top: 6px;
`;

const MonthHint = styled.p`
  margin: 12px 0 0;
  color: #6a795c;
  font-size: 0.9rem;
`;

const Drawer = styled.aside`
  position: fixed;
  top: 80px;
  right: 0;
  width: 440px;
  max-width: 90vw;
  height: calc(100vh - 80px);
  background: #fff;
  box-shadow: -12px 0 24px rgba(0, 0, 0, 0.12);
  transform: ${(props) => (props.$open ? "translateX(0)" : "translateX(100%)")};
  transition: transform 0.3s ease;
  z-index: 20;
  display: flex;
  flex-direction: column;
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
  span {
    color: #6a795c;
    font-size: 0.9rem;
  }
`;

const DrawerBody = styled.div`
  padding: 28px 20px 20px;
  overflow-y: auto;
  flex: 1;
`;

const DrawerActions = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 16px;
`;

const GroupPanel = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
`;

const GroupHeader = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  h3 {
    margin: 0;
    color: #1b1b1b;
  }
  span {
    color: #6a795c;
  }
`;

const GroupList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const GroupSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 12px;
  border-radius: 14px;
  background: ${(props) =>
    props.$color ? `${props.$color}10` : "#ffffff"};
  border: 1px solid
    ${(props) =>
      props.$color ? `${props.$color}44` : "rgba(106, 121, 92, 0.22)"};
  box-shadow: 0 12px 24px rgba(0, 0, 0, 0.05);
`;

const GroupSectionHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  justify-content: space-between;
  padding: 10px 12px;
  border-radius: 12px;
  background: ${(props) =>
    props.$color ? `${props.$color}22` : "rgba(106, 121, 92, 0.1)"};
`;

const GroupSectionTitle = styled.h4`
  margin: 0;
  color: #1b1b1b;
  font-size: 0.95rem;
`;

const GroupSectionMeta = styled.span`
  display: inline-block;
  margin-top: 4px;
  color: #516046;
  font-size: 0.82rem;
  font-weight: 600;
`;

const GroupCountBadge = styled.span`
  min-width: 30px;
  height: 30px;
  padding: 0 8px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.8);
  color: #1b1b1b;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 0.78rem;
  font-weight: 800;
`;

const GroupItem = styled.div`
  padding: 12px;
  border-radius: 12px;
  border: 1px solid rgba(106, 121, 92, 0.1);
  background: rgba(255, 255, 255, 0.92);
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 12px;
  align-items: center;

  @media (max-width: 720px) {
    grid-template-columns: 1fr;
  }
`;

const PatientInfo = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
  strong {
    color: #1b1b1b;
  }
  span {
    color: #6a795c;
    font-size: 0.9rem;
  }
`;

const GroupActions = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 8px;

  @media (max-width: 720px) {
    align-items: stretch;
  }
`;

const ActionGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(96px, 1fr));
  gap: 8px;
`;

const StatusAction = styled.button`
  border: 1px solid
    ${(props) => {
      if (props.$status === "done") return "rgba(94, 135, 90, 0.32)";
      if (props.$status === "canceled") return "rgba(199, 102, 102, 0.3)";
      if (props.$status === "no_show") return "rgba(214, 170, 104, 0.34)";
      return "rgba(106, 121, 92, 0.24)";
    }};
  background: ${(props) => {
    if (props.$active && props.$status === "done") return "#2f5a33";
    if (props.$active && props.$status === "canceled") return "#7b3a3a";
    if (props.$active && props.$status === "no_show") return "#8a5718";
    if (props.$active) return "#6a795c";
    if (props.$status === "done") return "rgba(94, 135, 90, 0.12)";
    if (props.$status === "canceled") return "rgba(199, 102, 102, 0.11)";
    if (props.$status === "no_show") return "rgba(214, 170, 104, 0.14)";
    return "#fff";
  }};
  color: ${(props) => {
    if (props.$active) return "#fff";
    if (props.$status === "done") return "#2f5a33";
    if (props.$status === "canceled") return "#7b3a3a";
    if (props.$status === "no_show") return "#8a5718";
    return "#516046";
  }};
  padding: 7px 10px;
  border-radius: 9px;
  font-weight: 700;
  font-size: 0.82rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: transform 120ms ease, box-shadow 120ms ease, filter 120ms ease;

  &:hover {
    transform: translateY(-1px);
    box-shadow: 0 8px 18px rgba(42, 52, 35, 0.08);
    filter: brightness(0.98);
  }
`;

const SmallEdit = styled.button`
  border: 1px solid rgba(106, 121, 92, 0.18);
  background: #f5f7f1;
  color: #516046;
  font-size: 0.8rem;
  font-weight: 700;
  padding: 7px 10px;
  border-radius: 9px;
  cursor: pointer;

  &:hover {
    background: #eef2e7;
  }
`;

const Backdrop = styled.div`
  position: fixed;
  top: 80px;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.2);
  z-index: 10;
`;

const ModalOverlay = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.35);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 30;
`;

const ModalCard = styled.div`
  width: min(520px, 92vw);
  background: #fff;
  border-radius: 16px;
  border: 1px solid rgba(106, 121, 92, 0.2);
  box-shadow: 0 18px 40px rgba(0, 0, 0, 0.18);
  padding: 18px;
  display: flex;
  flex-direction: column;
  gap: 14px;
`;

const ModalHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;

  h3 {
    margin: 0;
    color: #1b1b1b;
  }
`;

const ModalBody = styled.div`
  textarea {
    width: 100%;
    box-sizing: border-box;
    border-radius: 12px;
    border: 1px solid rgba(106, 121, 92, 0.25);
    padding: 12px;
    font-size: 0.95rem;
    resize: vertical;
  }
`;

const ModalActions = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 10px;
`;

const Form = styled.form`
  display: flex;
  flex-direction: column;
  gap: 18px;
`;

const FormGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 12px;

  .span-2 {
    grid-column: span 2;
  }
`;

const Field = styled.label`
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 0.9rem;
  color: #1b1b1b;

  input,
  select,
  textarea {
    border-radius: 10px;
    border: 1px solid rgba(106, 121, 92, 0.2);
    padding: 10px 12px;
    font-size: 0.95rem;
    color: #1b1b1b;
    background: #fff;
  }

  textarea {
    resize: vertical;
  }
`;

const InputRow = styled.div`
  display: flex;
  gap: 8px;
  align-items: center;

  input {
    flex: 1;
  }
`;

const OkButton = styled.button`
  height: 40px;
  padding: 0 12px;
  border-radius: 10px;
  border: 1px solid rgba(106, 121, 92, 0.2);
  background: #f3f5f1;
  color: #42523a;
  font-weight: 700;
  cursor: pointer;
  white-space: nowrap;
`;

const RepeatCard = styled.div`
  border: 1px solid rgba(106, 121, 92, 0.18);
  border-radius: 14px;
  padding: 14px;
  background: #f9faf6;
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const RepeatHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;

  strong {
    display: block;
    font-size: 0.95rem;
    color: #1b1b1b;
  }

  span {
    color: #6a795c;
    font-size: 0.85rem;
  }
`;

const RepeatToggle = styled.label`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  color: #6a795c;

  input {
    width: 18px;
    height: 18px;
    accent-color: #6a795c;
  }
`;

const RepeatHint = styled.div`
  font-size: 0.85rem;
  color: #6a795c;
`;

const RepeatBody = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const RepeatRow = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 12px;
`;

const RepeatField = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 0.85rem;
  color: #1b1b1b;

  &.full {
    grid-column: 1 / -1;
  }

  input {
    border-radius: 10px;
    border: 1px solid rgba(106, 121, 92, 0.2);
    padding: 8px 10px;
    font-size: 0.9rem;
    background: #fff;
  }

  small {
    color: #6a795c;
  }
`;

const RepeatLabel = styled.span`
  font-size: 0.85rem;
  font-weight: 600;
  color: #1b1b1b;
`;

const RepeatHelper = styled.span`
  font-size: 0.8rem;
  color: #6a795c;
`;

const RepeatInline = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;

  input {
    width: 90px;
  }

  span {
    font-size: 0.85rem;
    color: #6a795c;
  }
`;

const RepeatModes = styled.div`
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
`;

const RepeatModeButton = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 0.85rem;
  color: #516046;
  border: 1px solid rgba(106, 121, 92, 0.25);
  background: ${(props) => (props.$active ? "rgba(106, 121, 92, 0.12)" : "#fff")};
  padding: 6px 10px;
  border-radius: 999px;
  cursor: pointer;
  font-weight: 600;
  transition: transform 120ms ease, box-shadow 120ms ease;

  &:hover {
    transform: translateY(-1px);
    box-shadow: 0 6px 12px rgba(42, 52, 35, 0.08);
  }
`;

const WeekdayGrid = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
`;

const WeekdayButton = styled.button`
  border: 1px solid rgba(106, 121, 92, 0.25);
  background: ${(props) => (props.$active ? "#6a795c" : "#fff")};
  color: ${(props) => (props.$active ? "#fff" : "#6a795c")};
  padding: 6px 10px;
  border-radius: 999px;
  font-weight: 600;
  cursor: pointer;
  transition: transform 120ms ease, box-shadow 120ms ease;

  &:hover {
    transform: translateY(-1px);
    box-shadow: 0 6px 12px rgba(42, 52, 35, 0.08);
  }
`;

const SearchInput = styled.input`
  height: 40px;
  border-radius: 10px;
  border: 1px solid rgba(106, 121, 92, 0.2);
  padding: 0 10px;
  font-size: 0.95rem;
  color: #1b1b1b;
  background: #fff;
  width: 100%;
  box-sizing: border-box;
`;

const AutoComplete = styled.div`
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 6px;
`;

const AutoList = styled.div`
  position: absolute;
  top: 46px;
  left: 0;
  right: 0;
  background: #fff;
  border: 1px solid rgba(106, 121, 92, 0.25);
  border-radius: 10px;
  box-shadow: 0 12px 24px rgba(0, 0, 0, 0.08);
  max-height: 220px;
  overflow-y: auto;
  z-index: 5;
`;

const AutoItem = styled.button`
  width: 100%;
  text-align: left;
  padding: 10px 12px;
  border: none;
  background: #fff;
  color: #1b1b1b;
  font-size: 0.95rem;
  cursor: pointer;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;

  &:hover {
    background: rgba(162, 177, 144, 0.2);
  }
`;

const SelectedHint = styled.div`
  font-size: 0.85rem;
  color: #6a795c;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;

  strong {
    color: #1b1b1b;
  }
`;

const PrimaryButton = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 10px 18px;
  border-radius: 10px;
  border: none;
  background: #6a795c;
  color: #fff;
  font-weight: 700;
  transition: filter 0.2s ease;

  &:hover:not(:disabled) {
    filter: brightness(0.95);
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;

const SecondaryButton = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 10px 18px;
  border-radius: 10px;
  background: #fff;
  color: #6a795c;
  border: 1px solid rgba(106, 121, 92, 0.3);
  font-weight: 600;
`;

const ActionButton = styled.button`
  border: none;
  background: #f0f3ec;
  color: #6a795c;
  padding: 8px 12px;
  border-radius: 10px;
  font-weight: 600;
`;

const QuickButton = styled(ActionButton)`
  display: inline-flex;
  align-items: center;
  gap: 6px;
`;

const IconButton = styled.button`
  border: none;
  background: transparent;
  color: #6a795c;
  font-size: 1.1rem;
`;

const EmptyState = styled.div`
  padding: 32px 16px;
  text-align: center;
  color: #6a795c;
`;

const StatusPill = styled.span`
  padding: 6px 10px;
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 700;
  color: ${(props) => {
    if (props.$status === "done") return "#2f5a33";
    if (props.$status === "canceled") return "#7b3a3a";
    if (props.$status === "no_show") return "#6b4a1e";
    return "#42523a";
  }};
  background: ${(props) => {
    if (props.$status === "done") return "rgba(94, 135, 90, 0.2)";
    if (props.$status === "canceled") return "rgba(199, 102, 102, 0.2)";
    if (props.$status === "no_show") return "rgba(214, 170, 104, 0.25)";
    return "rgba(162, 177, 144, 0.25)";
  }};
`;

const TypePill = styled.span`
  padding: 6px 10px;
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 700;
  color: #42523a;
  background: ${(props) => {
    if (props.$color) return `${props.$color}33`;
    if (props.$type === "pilates") return "rgba(116, 141, 189, 0.25)";
    if (props.$type === "funcional") return "rgba(120, 145, 176, 0.25)";
    if (props.$type === "fisioterapia") return "rgba(162, 177, 144, 0.35)";
    if (props.$type === "outro") return "rgba(201, 188, 152, 0.35)";
    return "rgba(162, 177, 144, 0.2)";
  }};
`;
