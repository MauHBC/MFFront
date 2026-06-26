import React, { useCallback, useEffect, useMemo, useState } from "react";
import PropTypes from "prop-types";
import styled from "styled-components";
import {
  FaCalendarAlt,
  FaEye,
  FaEyeSlash,
  FaExclamationTriangle,
  FaRegCalendarCheck,
  FaUserPlus,
} from "react-icons/fa";

import axios from "../../services/axios";
import {
  listFinancialEntries,
  listFinancialPayments,
} from "../../services/financial";

const PROFESSIONAL_GROUP_SLUG = "profissional";

const ACTIVE_SESSION_STATUSES = new Set(["scheduled", "done", "no_show"]);
const CANCELED_SESSION_STATUSES = new Set(["canceled"]);
const SCHEDULED_SESSION_STATUSES = new Set(["scheduled"]);
const DONE_SESSION_STATUSES = new Set(["done"]);
const NO_SHOW_SESSION_STATUSES = new Set(["no_show"]);

const startOfMonth = (date) => new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0);

const endOfMonth = (date) => new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);

const formatDateParam = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const formatMonthParam = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
};

const getMonthlyRange = (monthValue) => {
  const [year, month] = String(monthValue || "").split("-").map(Number);
  const baseDate = Number.isFinite(year) && Number.isFinite(month)
    ? new Date(year, month - 1, 1)
    : new Date();

  return { from: startOfMonth(baseDate), to: endOfMonth(baseDate) };
};

const toDate = (value) => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const isDateInRange = (value, from, to) => {
  const parsed = toDate(value);
  if (!parsed) return false;
  return parsed >= from && parsed <= to;
};

const isDateOnlyInRange = (value, start, end) => {
  const dateOnly = String(value || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOnly)) return false;
  if (start && dateOnly < start) return false;
  if (end && dateOnly > end) return false;
  return true;
};

const normalizeId = (value) => (value === undefined || value === null ? "" : String(value));

const formatCurrency = (cents) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(cents || 0) / 100);

const MASKED_CURRENCY = "R$ ••••";
const MASKED_VALUE = "•••";

const getProfessionalName = (session, professionalsById) => {
  const professionalId = normalizeId(session?.professional_user_id);
  if (professionalId && professionalsById.has(professionalId)) return professionalsById.get(professionalId).name;
  return session?.professional?.name || session?.User?.name || "Sem profissional";
};

const getEntryAllocatedCents = (entryId, payments) => {
  const id = Number(entryId);
  if (!Number.isFinite(id)) return 0;

  return payments.reduce((sum, payment) => {
    let allocations = [];

    if (Array.isArray(payment?.FinancialPaymentAllocations)) {
      allocations = payment.FinancialPaymentAllocations;
    } else if (Array.isArray(payment?.FinancialPaymentAllocation)) {
      allocations = payment.FinancialPaymentAllocation;
    } else if (Array.isArray(payment?.allocations)) {
      allocations = payment.allocations;
    }

    return sum + allocations.reduce((allocationSum, allocation) => {
      const allocationEntryId = Number(allocation?.entry_id || allocation?.FinancialEntry?.id);
      if (allocationEntryId !== id) return allocationSum;
      return allocationSum + Number(allocation?.amount_cents || 0);
    }, 0);
  }, 0);
};

const getOperationalAlertCategory = (alert) => {
  const type = String(alert?.type || "");
  if (type === "patient_plan_overdue") return "patient_plan_overdue";
  if (type === "patient_plan_expiring") return "patient_plan_expiring";
  if (type.startsWith("replacement_credit")) return "replacement_credit";
  return "other";
};

export default function Dashboard() {
  const [selectedMonth, setSelectedMonth] = useState(formatMonthParam(new Date()));
  const [professionalId, setProfessionalId] = useState("all");
  const [serviceId, setServiceId] = useState("all");
  const [sessions, setSessions] = useState([]);
  const [todaySessions, setTodaySessions] = useState([]);
  const [pendingSessions, setPendingSessions] = useState([]);
  const [patients, setPatients] = useState([]);
  const [professionals, setProfessionals] = useState([]);
  const [services, setServices] = useState([]);
  const [operationalAlerts, setOperationalAlerts] = useState([]);
  const [financialEntries, setFinancialEntries] = useState([]);
  const [financialPayments, setFinancialPayments] = useState([]);
  const [dashboardValuesVisible, setDashboardValuesVisible] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const range = useMemo(() => getMonthlyRange(selectedMonth), [selectedMonth]);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const sessionParams = {
        from: formatDateParam(range.from),
        to: formatDateParam(range.to),
      };

      if (professionalId !== "all") sessionParams.professional_user_id = professionalId;
      if (serviceId !== "all") sessionParams.service_id = serviceId;

      const todayParams = {
        from: formatDateParam(new Date()),
        to: formatDateParam(new Date()),
      };

      if (professionalId !== "all") todayParams.professional_user_id = professionalId;
      if (serviceId !== "all") todayParams.service_id = serviceId;

      const pendingParams = {
        status: "scheduled",
        from: formatDateParam(range.from),
        to: formatDateParam(range.to),
      };

      if (professionalId !== "all") pendingParams.professional_user_id = professionalId;
      if (serviceId !== "all") pendingParams.service_id = serviceId;

      const [
        sessionsResponse,
        todaySessionsResponse,
        pendingSessionsResponse,
        patientsResponse,
        professionalsResponse,
        servicesResponse,
        alertsResponse,
        entriesResponse,
        paymentsResponse,
      ] = await Promise.all([
        axios.get("/sessions", { params: sessionParams }),
        axios.get("/sessions", { params: todayParams }),
        axios.get("/sessions", { params: pendingParams }),
        axios.get("/patients"),
        axios.get("/users", { params: { group: PROFESSIONAL_GROUP_SLUG } }),
        axios.get("/services"),
        axios.get("/operational-alerts", { params: { month: selectedMonth } }),
        listFinancialEntries(),
        listFinancialPayments(),
      ]);

      setSessions(Array.isArray(sessionsResponse.data) ? sessionsResponse.data : []);
      setTodaySessions(Array.isArray(todaySessionsResponse.data) ? todaySessionsResponse.data : []);
      setPendingSessions(Array.isArray(pendingSessionsResponse.data) ? pendingSessionsResponse.data : []);
      setPatients(Array.isArray(patientsResponse.data) ? patientsResponse.data : []);
      setProfessionals(Array.isArray(professionalsResponse.data) ? professionalsResponse.data : []);
      setServices(Array.isArray(servicesResponse.data) ? servicesResponse.data : []);
      setOperationalAlerts(Array.isArray(alertsResponse.data?.alerts) ? alertsResponse.data.alerts : []);
      setFinancialEntries(Array.isArray(entriesResponse.data) ? entriesResponse.data : []);
      setFinancialPayments(Array.isArray(paymentsResponse.data) ? paymentsResponse.data : []);
    } catch (_err) {
      setError("Não foi possível carregar o painel.");
    } finally {
      setLoading(false);
    }
  }, [professionalId, range.from, range.to, selectedMonth, serviceId]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const professionalsById = useMemo(
    () => new Map(professionals.map((item) => [normalizeId(item.id), item])),
    [professionals],
  );

  const activeSessions = useMemo(
    () => sessions.filter((session) => ACTIVE_SESSION_STATUSES.has(session?.status)),
    [sessions],
  );

  const todayActiveSessions = useMemo(
    () => todaySessions.filter((session) => ACTIVE_SESSION_STATUSES.has(session?.status)),
    [todaySessions],
  );

  const scheduledCount = activeSessions.filter((session) => SCHEDULED_SESSION_STATUSES.has(session?.status)).length;
  const doneCount = activeSessions.filter((session) => DONE_SESSION_STATUSES.has(session?.status)).length;
  const noShowCount = activeSessions.filter((session) => NO_SHOW_SESSION_STATUSES.has(session?.status)).length;
  const canceledCount = sessions.filter((session) => CANCELED_SESSION_STATUSES.has(session?.status)).length;

  const filteredPendingSessions = useMemo(
    () => pendingSessions.filter((session) => (
      session?.status === "scheduled"
      && isDateInRange(session?.starts_at, range.from, range.to)
      && toDate(session?.starts_at) <= new Date()
    )),
    [pendingSessions, range.from, range.to],
  );

  const alertCounts = useMemo(() => {
    const counts = {
      replacement_credit: 0,
      patient_plan_overdue: 0,
      patient_plan_expiring: 0,
      highOrMedium: 0,
    };

    operationalAlerts.forEach((alert) => {
      const category = getOperationalAlertCategory(alert);
      if (counts[category] !== undefined) counts[category] += 1;
      if (alert?.severity === "high" || alert?.severity === "medium") counts.highOrMedium += 1;
    });

    return counts;
  }, [operationalAlerts]);

  const financialSummary = useMemo(() => {
    const periodStart = formatDateParam(range.from);
    const periodEnd = formatDateParam(range.to);

    const eligibleEntries = financialEntries.filter((entry) => (
      entry?.type === "income"
      && entry?.status !== "canceled"
      && isDateOnlyInRange(entry?.reference_date || entry?.due_date, periodStart, periodEnd)
    ));

    const receivedCents = eligibleEntries.reduce((sum, entry) => {
      const amount = Number(entry?.amount_cents || 0);
      const allocated = getEntryAllocatedCents(entry?.id, financialPayments);
      return sum + Math.min(amount, allocated);
    }, 0);

    const receivableCents = eligibleEntries.reduce((sum, entry) => {
      const amount = Number(entry?.amount_cents || 0);
      const allocated = getEntryAllocatedCents(entry?.id, financialPayments);
      return sum + Math.max(0, amount - allocated);
    }, 0);

    return {
      receivedCents,
      receivableCents,
    };
  }, [financialEntries, financialPayments, range.from, range.to]);

  const professionalRows = useMemo(() => {
    const groups = new Map();

    activeSessions.forEach((session) => {
      const key = normalizeId(session?.professional_user_id) || "none";
      const current = groups.get(key) || {
        key,
        name: getProfessionalName(session, professionalsById),
        scheduled: 0,
        done: 0,
      };

      if (session.status === "scheduled") current.scheduled += 1;
      if (session.status === "done") current.done += 1;
      groups.set(key, current);
    });

    return Array.from(groups.values())
      .sort((a, b) => (b.scheduled + b.done) - (a.scheduled + a.done))
      .slice(0, 6);
  }, [activeSessions, professionalsById]);

  const totalPending =
    filteredPendingSessions.length
    + alertCounts.replacement_credit
    + alertCounts.patient_plan_expiring
    + alertCounts.patient_plan_overdue
    + alertCounts.highOrMedium;
  const hasData = activeSessions.length > 0 || patients.length > 0 || operationalAlerts.length > 0 || financialSummary.receivedCents > 0 || financialSummary.receivableCents > 0;

  return (
    <Page>
      <Header>
        <div>
          <HeaderTitleRow>
            <Title>Painel</Title>
            <PrivacyToggle
              type="button"
              onClick={() => setDashboardValuesVisible((visible) => !visible)}
              aria-label={dashboardValuesVisible ? "Ocultar dados do painel" : "Mostrar dados do painel"}
              title={dashboardValuesVisible ? "Ocultar dados" : "Mostrar dados"}
            >
              {dashboardValuesVisible ? <FaEyeSlash /> : <FaEye />}
            </PrivacyToggle>
          </HeaderTitleRow>
        </div>

        <FilterBar aria-label="Filtros do Painel">
          <Field>
            <span>Período</span>
            <input
              aria-label="Período mensal"
              type="month"
              value={selectedMonth}
              onChange={(event) => setSelectedMonth(event.target.value || formatMonthParam(new Date()))}
            />
          </Field>

          <Field>
            <span>Profissional</span>
            <select
              aria-label="Profissional"
              value={professionalId}
              onChange={(event) => setProfessionalId(event.target.value)}
            >
              <option value="all">Todos</option>
              {professionals.map((professional) => (
                <option key={professional.id} value={professional.id}>{professional.name}</option>
              ))}
            </select>
          </Field>

          <Field>
            <span>Serviço</span>
            <select aria-label="Serviço" value={serviceId} onChange={(event) => setServiceId(event.target.value)}>
              <option value="all">Todos</option>
              {services.map((service) => (
                <option key={service.id} value={service.id}>{service.name}</option>
              ))}
            </select>
          </Field>
        </FilterBar>
      </Header>

      {loading && <StateBox>Carregando painel...</StateBox>}
      {!loading && error && <StateBox $error>{error}</StateBox>}
      {!loading && !error && !hasData && (
        <StateBox>Não há dados para este período.</StateBox>
      )}

      {!loading && !error && (
        <>
          <MetricGrid>
            <MetricCard
              tone="blue"
              icon={<FaCalendarAlt />}
              label="Atendimentos hoje"
              value={dashboardValuesVisible ? todayActiveSessions.length : MASKED_VALUE}
            />
            <MetricCard
              tone="green"
              icon={<FaRegCalendarCheck />}
              label="Atendimentos no mês"
              value={dashboardValuesVisible ? activeSessions.length : MASKED_VALUE}
            />
            <MetricCard
              tone="teal"
              icon={<FaUserPlus />}
              label="Pacientes cadastrados"
              value={dashboardValuesVisible ? patients.length : MASKED_VALUE}
            />
            <MetricCard
              tone="amber"
              icon={<FaExclamationTriangle />}
              label="Pendências abertas"
              value={dashboardValuesVisible ? totalPending : MASKED_VALUE}
            />
          </MetricGrid>

          <TwoColumn>
            <Section>
              <SectionTitle>Agenda</SectionTitle>
              <MiniGrid>
                <MiniStat $tone="blue">
                  <span>Agendadas</span>
                  <strong>{dashboardValuesVisible ? scheduledCount : MASKED_VALUE}</strong>
                </MiniStat>
                <MiniStat $tone="green">
                  <span>Realizadas</span>
                  <strong>{dashboardValuesVisible ? doneCount : MASKED_VALUE}</strong>
                </MiniStat>
                <MiniStat $tone="amber">
                  <span>Faltas</span>
                  <strong>{dashboardValuesVisible ? noShowCount : MASKED_VALUE}</strong>
                </MiniStat>
                <MiniStat $tone="red">
                  <span>Cancelamentos</span>
                  <strong>{dashboardValuesVisible ? canceledCount : MASKED_VALUE}</strong>
                </MiniStat>
              </MiniGrid>
            </Section>

            <Section>
              <SectionTitle>Financeiro</SectionTitle>
              <FinancialGrid>
                <FinancialCard>
                  <span>Recebido no mês</span>
                  <strong>{dashboardValuesVisible ? formatCurrency(financialSummary.receivedCents) : MASKED_CURRENCY}</strong>
                </FinancialCard>
                <FinancialCard>
                  <span>A receber no mês</span>
                  <strong>{dashboardValuesVisible ? formatCurrency(financialSummary.receivableCents) : MASKED_CURRENCY}</strong>
                </FinancialCard>
              </FinancialGrid>
            </Section>
          </TwoColumn>

          <TwoColumn>
            <Section>
              <SectionTitleRow>
                <SectionTitle>Pendências</SectionTitle>
                <PendingTotal>{dashboardValuesVisible ? totalPending : MASKED_VALUE}</PendingTotal>
              </SectionTitleRow>
              <PendingList>
                <PendingItem>
                  <span>Atendimentos a finalizar</span>
                  <strong>{dashboardValuesVisible ? filteredPendingSessions.length : MASKED_VALUE}</strong>
                </PendingItem>
                <PendingItem>
                  <span>Reposições pendentes</span>
                  <strong>{dashboardValuesVisible ? alertCounts.replacement_credit : MASKED_VALUE}</strong>
                </PendingItem>
                <PendingItem>
                  <span>Planos vencendo/vencidos</span>
                  <strong>{dashboardValuesVisible ? alertCounts.patient_plan_expiring + alertCounts.patient_plan_overdue : MASKED_VALUE}</strong>
                </PendingItem>
                <PendingItem>
                  <span>Alertas operacionais</span>
                  <strong>{dashboardValuesVisible ? alertCounts.highOrMedium : MASKED_VALUE}</strong>
                </PendingItem>
              </PendingList>
            </Section>

            <Section>
              <SectionTitle>Profissionais</SectionTitle>
              <ProfessionalsTable>
                <thead>
                  <tr>
                    <th>Profissional</th>
                    <th>Agendadas</th>
                    <th>Realizadas</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {professionalRows.length === 0 && (
                    <tr>
                      <td colSpan="4">Sem atendimentos no período.</td>
                    </tr>
                  )}
                  {professionalRows.map((row) => (
                    <tr key={row.key}>
                      <td>{row.name}</td>
                      <td>{dashboardValuesVisible ? row.scheduled : MASKED_VALUE}</td>
                      <td>{dashboardValuesVisible ? row.done : MASKED_VALUE}</td>
                      <td>{dashboardValuesVisible ? row.scheduled + row.done : MASKED_VALUE}</td>
                    </tr>
                  ))}
                </tbody>
              </ProfessionalsTable>
            </Section>
          </TwoColumn>
        </>
      )}
    </Page>
  );
}

function MetricCard({
  icon, label, value, tone,
}) {
  return (
    <Card $tone={tone}>
      <CardIcon>{icon}</CardIcon>
      <CardContent>
        <span>{label}</span>
        <strong>{value}</strong>
      </CardContent>
    </Card>
  );
}

MetricCard.propTypes = {
  icon: PropTypes.node.isRequired,
  label: PropTypes.string.isRequired,
  tone: PropTypes.string.isRequired,
  value: PropTypes.node.isRequired,
};

const Page = styled.main`
  min-height: 100vh;
  padding: 112px 24px 52px;
  background:
    radial-gradient(circle at top left, rgba(227, 241, 236, 0.7), transparent 34%),
    #f6f8fb;
  color: #18211d;
`;

const Header = styled.header`
  width: min(1180px, 100%);
  margin: 0 auto 24px;
  display: grid;
  grid-template-columns: minmax(220px, 1fr) minmax(620px, 1.35fr);
  align-items: end;
  gap: 24px;

  @media (max-width: 980px) {
    grid-template-columns: 1fr;
    align-items: start;
  }
`;

const Title = styled.h1`
  margin: 0 0 6px;
  font-size: 36px;
  line-height: 1.1;
  letter-spacing: 0;
  color: #142017;
  font-weight: 800;
`;

const HeaderTitleRow = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;

  ${Title} {
    margin-bottom: 0;
  }
`;

const FilterBar = styled.div`
  width: 100%;
  margin: 0;
  display: grid;
  grid-template-columns: minmax(170px, 0.72fr) minmax(190px, 1fr) minmax(190px, 1fr);
  gap: 10px;
  padding: 10px;
  background: rgba(255, 255, 255, 0.86);
  border: 1px solid rgba(76, 94, 84, 0.1);
  border-radius: 14px;
  box-shadow: 0 16px 34px rgba(35, 48, 42, 0.08);
  backdrop-filter: blur(10px);

  @media (max-width: 760px) {
    grid-template-columns: 1fr;
  }
`;

const Field = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;

  span {
    font-size: 10px;
    font-weight: 800;
    color: #748078;
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }

  input,
  select {
    width: 100%;
    min-width: 0;
    box-sizing: border-box;
    min-height: 40px;
    border-radius: 10px;
    border: 1px solid transparent;
    background: #f8faf8;
    color: #17231c;
    padding: 0 12px;
    font-weight: 700;
    font-size: 14px;
    line-height: 40px;
    outline: none;
    transition: border-color 0.18s ease, background 0.18s ease, box-shadow 0.18s ease;

    &:focus {
      border-color: var(--clinic-primary-color, #6a795c);
      background: #fff;
      box-shadow: 0 0 0 3px rgba(106, 121, 92, 0.13);
    }
  }

  input[type="month"] {
    appearance: none;
    -webkit-appearance: none;
    font-family: inherit;
    text-transform: none;

    &::-webkit-calendar-picker-indicator {
      opacity: 0.72;
      cursor: pointer;
    }
  }
`;

const StateBox = styled.div`
  width: min(1180px, 100%);
  margin: 0 auto 20px;
  padding: 16px 18px;
  border-radius: 14px;
  background: ${(props) => (props.$error ? "#fff4f0" : "#fff")};
  color: ${(props) => (props.$error ? "#9a3f2d" : "#66705f")};
  border: 1px solid ${(props) => (props.$error ? "rgba(154, 63, 45, 0.16)" : "rgba(106, 121, 92, 0.1)")};
  font-weight: 700;
`;

const Section = styled.section`
  width: 100%;
  margin: 0;
  background: #fff;
  border: 1px solid rgba(37, 51, 44, 0.07);
  border-radius: 16px;
  padding: 20px;
  box-shadow: 0 18px 38px rgba(24, 33, 29, 0.06);
`;

const SectionTitle = styled.h2`
  margin: 0 0 16px;
  color: #18211d;
  font-size: 18px;
  line-height: 1.25;
  letter-spacing: 0;
  font-weight: 800;
`;

const SectionTitleRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;

  ${SectionTitle} {
    margin-bottom: 0;
  }
`;

const PendingTotal = styled.span`
  min-width: 36px;
  height: 32px;
  padding: 0 10px;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: #fff7e8;
  color: #b87918;
  font-weight: 850;
  font-size: 16px;
`;

const PrivacyToggle = styled.button`
  width: 36px;
  height: 36px;
  border-radius: 999px;
  border: 1px solid rgba(37, 51, 44, 0.1);
  background: #f8faf8;
  color: #5d6f63;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background 0.16s ease, border-color 0.16s ease, color 0.16s ease;

  &:hover,
  &:focus-visible {
    background: #eef5ef;
    border-color: rgba(95, 121, 87, 0.35);
    color: #314036;
    outline: none;
  }
`;

const MetricGrid = styled.div`
  width: min(1180px, 100%);
  margin: 0 auto 18px;
  display: grid;
  grid-template-columns: repeat(4, minmax(160px, 1fr));
  gap: 14px;

  @media (max-width: 1100px) {
    grid-template-columns: repeat(2, minmax(160px, 1fr));
  }

  @media (max-width: 640px) {
    grid-template-columns: 1fr;
  }
`;

const Card = styled.div`
  --tone: ${(props) => {
    if (props.$tone === "blue") return "#3f7ea6";
    if (props.$tone === "amber") return "#c98a1f";
    if (props.$tone === "teal") return "#2f8a76";
    return "#5f8f5f";
  }};
  --tone-bg: ${(props) => {
    if (props.$tone === "blue") return "#edf6fb";
    if (props.$tone === "amber") return "#fff7e8";
    if (props.$tone === "teal") return "#eaf7f4";
    return "#eff7ef";
  }};
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  min-height: 116px;
  padding: 18px;
  border: 1px solid rgba(37, 51, 44, 0.06);
  border-radius: 16px;
  background: #fff;
  box-shadow: 0 18px 38px rgba(24, 33, 29, 0.06);
  overflow: hidden;

  &::before {
    content: "";
    position: absolute;
    inset: 0 auto 0 0;
    width: 4px;
    background: var(--tone);
    opacity: 0.78;
  }
`;

const CardIcon = styled.div`
  width: 38px;
  height: 38px;
  border-radius: 12px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  background: var(--tone-bg);
  color: var(--tone);
  font-size: 15px;
`;

const CardContent = styled.div`
  display: flex;
  flex-direction: column-reverse;
  gap: 5px;
  min-width: 0;

  span {
    color: #748078;
    font-size: 12px;
    font-weight: 800;
    line-height: 1.2;
    letter-spacing: 0;
  }

  strong {
    color: #132017;
    font-size: 34px;
    line-height: 1;
    font-weight: 850;
  }
`;

const TwoColumn = styled.div`
  width: min(1180px, 100%);
  margin: 0 auto;
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 18px;

  ${Section} {
    width: 100%;
  }

  & + & {
    margin-top: 18px;
  }

  @media (max-width: 900px) {
    grid-template-columns: 1fr;
  }
`;

const MiniGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;

  @media (max-width: 520px) {
    grid-template-columns: 1fr;
  }
`;

const MiniStat = styled.div`
  --mini-tone: ${(props) => {
    if (props.$tone === "blue") return "#3f7ea6";
    if (props.$tone === "amber") return "#c98a1f";
    if (props.$tone === "red") return "#c65f55";
    return "#5f8f5f";
  }};
  min-height: 92px;
  padding: 14px;
  border-radius: 14px;
  background: #f9fbfa;
  border: 1px solid rgba(37, 51, 44, 0.06);
  display: flex;
  flex-direction: column-reverse;
  justify-content: space-between;

  span {
    color: #748078;
    font-size: 12px;
    font-weight: 800;
  }

  strong {
    color: var(--mini-tone);
    font-size: 30px;
    line-height: 1;
  }
`;

const PendingList = styled.div`
  display: grid;
  gap: 4px;
`;

const PendingItem = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-height: 46px;
  padding: 10px 0;
  border-bottom: 1px solid rgba(37, 51, 44, 0.07);

  &:last-child {
    border-bottom: none;
  }

  strong {
    color: #1f2a24;
    font-size: 22px;
  }

  span {
    color: #5e6962;
    font-weight: 700;
  }
`;

const FinancialGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;

  @media (max-width: 560px) {
    grid-template-columns: 1fr;
  }
`;

const FinancialCard = styled.div`
  min-height: 116px;
  padding: 16px;
  border: 1px solid rgba(37, 51, 44, 0.06);
  border-radius: 14px;
  background: linear-gradient(135deg, #f7fbf8, #ffffff);
  display: flex;
  flex-direction: column;
  justify-content: space-between;

  span {
    color: #66736a;
    font-weight: 800;
    font-size: 12px;
    letter-spacing: 0;
  }

  strong {
    color: #1b2a20;
    font-size: 30px;
    line-height: 1.15;
  }
`;

const ProfessionalsTable = styled.table`
  width: 100%;
  border-collapse: collapse;
  overflow: hidden;

  th,
  td {
    padding: 13px 8px;
    border-bottom: 1px solid rgba(37, 51, 44, 0.07);
    text-align: left;
  }

  th {
    color: #7b867f;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }

  td {
    color: #223129;
    font-weight: 700;
  }

  th:not(:first-child),
  td:not(:first-child) {
    text-align: right;
  }

  @media (max-width: 640px) {
    display: block;
    overflow-x: auto;
    white-space: nowrap;

    th,
    td {
      padding: 11px 8px;
      font-size: 13px;
    }
  }
`;
