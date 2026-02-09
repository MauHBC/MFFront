import React, { useCallback, useEffect, useMemo, useState } from "react";
import styled from "styled-components";
import { Link } from "react-router-dom";
import { toast } from "react-toastify";
import {
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
  const [patients, setPatients] = useState([]);
  const [professionals, setProfessionals] = useState([]);
  const [serviceLimits, setServiceLimits] = useState([]);
  const [services, setServices] = useState([]);
  const [statusOptions, setStatusOptions] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [patientQuery, setPatientQuery] = useState("");
  const [isPatientListOpen, setIsPatientListOpen] = useState(false);
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
  const [filters, setFilters] = useState({
    status: "",
    patient_id: "",
    service_type: "",
  });

  const loadBaseData = useCallback(async () => {
    try {
      const [patientsResponse, usersResponse, limitsResponse, statusResponse, servicesResponse] = await Promise.all([
        axios.get("/patients"),
        axios.get("/users"),
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
        if (fromDate) params.from = fromDate.toISOString().slice(0, 10);
        if (toDate) params.to = toDate.toISOString().slice(0, 10);
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

  useEffect(() => {
    loadBaseData();
  }, [loadBaseData]);

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

  const patientOptions = useMemo(
    () =>
      patients.map((patient) => ({
        id: patient.id,
        name: patient.full_name || patient.name || "Paciente",
      })),
    [patients],
  );

  const filteredPatientOptions = useMemo(() => {
    const query = patientQuery.trim().toLowerCase();
    if (!query) return patientOptions;
    return patientOptions.filter((patient) =>
      patient.name.toLowerCase().includes(query),
    );
  }, [patientOptions, patientQuery]);

  const handleSelectPatient = useCallback((patient) => {
    setForm((prev) => ({ ...prev, patient_id: String(patient.id) }));
    setPatientQuery(patient.name);
    setIsPatientListOpen(false);
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
        color: "#A2B190",
        duration: 60,
      },
      {
        id: null,
        code: "pilates",
        name: "Pilates",
        color: "#748DBD",
        duration: 60,
      },
      {
        id: null,
        code: "funcional",
        name: "Funcional",
        color: "#7891B0",
        duration: 60,
      },
      {
        id: null,
        code: "outro",
        name: "Outro",
        color: "#C9BC98",
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
  }, []);

  const handleFilterChange = useCallback((event) => {
    const { name, value } = event.target;
    setFilters((prev) => ({ ...prev, [name]: value }));
  }, []);

  const openDrawer = useCallback(() => {
    setDrawerMode("form");
    setGroupContext(null);
    setIsDrawerOpen(true);
  }, []);

  const closeDrawer = useCallback(() => {
    setIsDrawerOpen(false);
  }, []);

  const resetForm = useCallback(() => {
    setEditingId(null);
    setForm(emptyForm);
    setPatientQuery("");
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
      } catch (error) {
        const message =
          error?.response?.data?.error ||
          "Nao foi possivel reagendar o agendamento.";
        toast.error(message);
      } finally {
        setIsSaving(false);
      }
    },
    [filteredSessions, loadSessions, selectedDate, view],
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
      setPatientQuery(patientName);
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
      } catch (error) {
        const message =
          error?.response?.data?.error ||
          "Nao foi possivel atualizar o agendamento.";
        toast.error(message);
      } finally {
        setIsSaving(false);
      }
    },
    [loadSessions, selectedDate, view],
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
        if (editingId) {
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
      } catch (error) {
        const message =
          error?.response?.data?.error ||
          "Nao foi possivel salvar o agendamento.";
        toast.error(message);
      } finally {
        setIsSaving(false);
      }
    },
    [closeDrawer, editingId, form, loadSessions, resetForm, selectedDate, view],
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
  if (drawerMode === "group") {
    drawerTitle = "Detalhes do horario";
  } else if (editingId) {
    drawerTitle = `Editar #${editingId}`;
  }

  let drawerSubtitle = "Preencha os dados do atendimento.";
  if (drawerMode === "group") {
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
          </DateNav>
          <PrimaryButton type="button" onClick={openDrawer}>
            <FaPlus /> Novo agendamento
          </PrimaryButton>
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
                    value={patientQuery}
                    onChange={(event) => {
                      setPatientQuery(event.target.value);
                      setIsPatientListOpen(true);
                      if (filters.patient_id) {
                        setFilters((prev) => ({ ...prev, patient_id: "" }));
                      }
                    }}
                    onFocus={() => setIsPatientListOpen(true)}
                    onBlur={() => {
                      setTimeout(() => setIsPatientListOpen(false), 150);
                    }}
                  />
                  {isPatientListOpen && filteredPatientOptions.length > 0 && patientQuery && (
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
                            setPatientQuery(patient.name);
                            setIsPatientListOpen(false);
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
            {drawerMode === "group" ? (
              <GroupPanel>
                <GroupHeader>
                  <div>
                    <h3>{groupContext ? formatDateTime(groupContext.date) : ""}</h3>
                    <span>VisÃ£o completa do horÃ¡rio</span>
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
                      setPatientQuery("");
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
                    <GroupSection key={group.service_type}>
                      <GroupSectionHeader>
                        <TypePill $type={group.service_type} $color={group.service?.color || serviceColor(group.service_type)}>
                          {serviceName(group.service_type)}
                        </TypePill>
                        <span>
                          {group.count}
                          {group.limit && group.limit > 0 ? ` / ${group.limit}` : ""} pacientes
                        </span>
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
                                $active={session.status === "scheduled" || session.status === "open"}
                                onClick={handleQuickStatus}
                              >
                                Agendado
                              </StatusAction>
                              <StatusAction
                                type="button"
                                data-id={session.id}
                                data-status="done"
                                $active={session.status === "done"}
                                onClick={handleQuickStatus}
                              >
                                Concluido
                              </StatusAction>
                              <StatusAction
                                type="button"
                                data-id={session.id}
                                data-status="no_show"
                                $active={session.status === "no_show"}
                                onClick={handleAbsence}
                              >
                                Falta
                              </StatusAction>
                              <StatusAction
                                type="button"
                                data-id={session.id}
                                data-status="canceled"
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
            ) : (
              <Form onSubmit={handleSubmit}>
                <FormGrid>
                <Field>
                  Paciente *
                  <AutoComplete>
                    <SearchInput
                      type="text"
                      placeholder="Buscar paciente"
                      value={patientQuery}
                      onChange={(event) => {
                        setPatientQuery(event.target.value);
                        setIsPatientListOpen(true);
                        if (form.patient_id) {
                          setForm((prev) => ({ ...prev, patient_id: "" }));
                        }
                      }}
                      onFocus={() => setIsPatientListOpen(true)}
                      onBlur={() => {
                        setTimeout(() => setIsPatientListOpen(false), 150);
                      }}
                    />
                    {isPatientListOpen && filteredPatientOptions.length > 0 && patientQuery && (
                      <AutoList>
                        {filteredPatientOptions.slice(0, 8).map((patient) => (
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
                  <Field>
                    Profissional
                    <select
                      name="professional_user_id"
                      value={form.professional_user_id}
                      onChange={handleFormChange}
                    >
                      <option value="">Selecionar</option>
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
                    <option value="">Selecionar</option>
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
                  <input
                    type="datetime-local"
                    name="starts_at"
                    value={form.starts_at}
                    onChange={handleStartsAtChange}
                  />
                </Field>
                <Field>
                  Fim
                  <input
                    type="datetime-local"
                    name="ends_at"
                    value={form.ends_at}
                    onChange={handleFormChange}
                  />
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
                  <Field className="span-2">
                    Observacoes
                    <textarea
                      name="notes"
                      value={form.notes}
                      onChange={handleFormChange}
                      rows={3}
                    />
                  </Field>
                  <Field className="span-2">
                    Justificativa de falta
                    <textarea
                      name="absence_reason"
                      value={form.absence_reason}
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
  background: #ffffff;
  border: 1px solid rgba(106, 121, 92, 0.22);
  box-shadow: 0 12px 24px rgba(0, 0, 0, 0.08);
`;

const GroupSectionHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  justify-content: space-between;
  padding-bottom: 8px;
  border-bottom: 1px dashed rgba(106, 121, 92, 0.2);
  span {
    color: #6a795c;
    font-size: 0.9rem;
    font-weight: 600;
  }
`;

const GroupItem = styled.div`
  padding: 12px;
  border-radius: 12px;
  border: 1px solid rgba(106, 121, 92, 0.12);
  background: #f9faf6;
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 12px;
  align-items: center;
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
`;

const ActionGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(110px, 1fr));
  gap: 8px;
`;

const StatusAction = styled.button`
  border: 1px solid rgba(106, 121, 92, 0.25);
  background: ${(props) => (props.$active ? "#6a795c" : "#fff")};
  color: ${(props) => (props.$active ? "#fff" : "#6a795c")};
  padding: 7px 10px;
  border-radius: 10px;
  font-weight: 600;
  display: inline-flex;
  align-items: center;
  justify-content: center;
`;

const SmallEdit = styled.button`
  border: none;
  background: transparent;
  color: #6a795c;
  font-size: 0.85rem;
  text-decoration: underline;
  cursor: pointer;
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

const SearchInput = styled.input`
  height: 40px;
  border-radius: 10px;
  border: 1px solid rgba(106, 121, 92, 0.2);
  padding: 0 10px;
  font-size: 0.95rem;
  color: #1b1b1b;
  background: #fff;
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

  &:hover {
    background: rgba(162, 177, 144, 0.2);
  }
`;

const SelectedHint = styled.div`
  font-size: 0.85rem;
  color: #6a795c;

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
