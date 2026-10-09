import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import styled from "styled-components";
import { GhostButton } from "../../components/AppButton";
import { MetricCardSurface, MetricCardLabel, MetricCardValue } from "../../components/AppMetricCard";
import { TableWrap, DataTable, TH, TD } from "../../components/AppTable";
import { colors, alpha, radii, layout, spacing, fontSizes } from "../../styles/tokens";
import AppShell from "../../components/AppShell";
import { useAuthorization } from "../../contexts/AuthorizationContext";
import api from "../../services/axios";
import { todayInSaoPaulo } from "../../utils/canonicalDateTime";

const statuses = { scheduled: "Agendados", done: "Realizados", no_show: "Faltas", canceled: "Cancelados" };
const months = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const civilLabel = (date) => String(date || "").split("-").reverse().join("/");
const timeLabel = (instant) => new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit",
}).format(new Date(instant));

export default function Reports() {
  const { canAccessModule, context } = useAuthorization();
  const scheduleAllowed = canAccessModule("schedule");
  const patientsAllowed = canAccessModule("patients");
  const today = todayInSaoPaulo();
  const [report, setReport] = useState(scheduleAllowed ? "daily" : "birthdays");
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [month, setMonth] = useState(Number(today.slice(5, 7)));
  const [professional, setProfessional] = useState("");
  const [professionalResponse, setProfessionals] = useState(null);
  const professionals = professionalResponse?.context === context ? professionalResponse?.data || [] : [];
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const [response, setResult] = useState(null);
  const filterKey = JSON.stringify([report, from, to, month, professional, status, page]);
  const result = response?.context === context && response?.filterKey === filterKey ? response?.data : null;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const tableRef = useRef(null);
  const scrollPending = useRef(null);
  const allowed = report === "birthdays" ? patientsAllowed : scheduleAllowed;

  useEffect(() => {
    if (allowed || (!scheduleAllowed && !patientsAllowed)) return;
    setReport(scheduleAllowed ? "daily" : "birthdays");
    setStatus("all");
    setPage(1);
  }, [allowed, scheduleAllowed, patientsAllowed]);

  useEffect(() => {
    if (!result || scrollPending.current !== filterKey) return;
    tableRef.current?.scrollIntoView?.({ block: "nearest", behavior: "smooth" });
    scrollPending.current = null;
  }, [result, filterKey]);

  useEffect(() => {
    setProfessional("");
    if (!scheduleAllowed) { setProfessionals(null); return undefined; }
    let active = true;
    api.get("/schedule/references/professionals")
      .then(({ data }) => { if (active) setProfessionals({ context, data: Array.isArray(data) ? data : [] }); })
      .catch(() => { if (active) setProfessionals(null); });
    return () => { active = false; };
  }, [scheduleAllowed, context]);

  useEffect(() => {
    let active = true;
    setResult(null);
    setError("");
    if (!allowed) { setLoading(false); return undefined; }
    setLoading(true);
    const params = report === "birthdays" ? { month, page } : {
      from, to: report === "daily" ? from : to, page, status,
      ...(professional ? { professional_user_id: professional } : {}),
    };
    api.get(`/reports/${report === "birthdays" ? "birthdays" : "schedule"}`, { params })
      .then(({ data }) => { if (active) setResult({ context, filterKey, data }); })
      .catch((failure) => {
        if (active) setError(failure.response?.status === 400
          ? "Confira o período: início até fim, com no máximo 367 dias."
          : "Não foi possível carregar o relatório. Tente novamente alterando o filtro.");
      }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [allowed, context, filterKey, report, from, to, month, professional, status, page]);

  const changeReport = (value) => { setReport(value); setPage(1); setStatus("all"); };
  const filterStatus = (value) => {
    if (value === status && page === 1 && result) {
      tableRef.current?.scrollIntoView?.({ block: "nearest", behavior: "smooth" });
      return;
    }
    scrollPending.current = JSON.stringify([report, from, to, month, professional, value, 1]);
    setStatus(value); setPage(1);
  };
  const changePage = (value) => {
    scrollPending.current = JSON.stringify([report, from, to, month, professional, status, value]);
    setPage(value);
  };
  const title = { daily: "Resumo do dia", schedule: "Agenda e presença", birthdays: "Aniversariantes" }[report];

  return (
    <AppShell pageTitle="Relatórios">
      <Page>
        <header><h1>Relatórios</h1></header>
        {!scheduleAllowed && !patientsAllowed ? <Panel>Você não tem acesso aos relatórios disponíveis.</Panel> : <>
          <Chooser aria-label="Escolher relatório">
            {scheduleAllowed && <><Choice type="button" $active={report === "daily"} aria-pressed={report === "daily"} onClick={() => changeReport("daily")}>Resumo do dia</Choice>
              <Choice type="button" $active={report === "schedule"} aria-pressed={report === "schedule"} onClick={() => changeReport("schedule")}>Agenda e presença</Choice></>}
            {patientsAllowed && <Choice type="button" $active={report === "birthdays"} aria-pressed={report === "birthdays"} onClick={() => changeReport("birthdays")}>Aniversariantes</Choice>}
          </Chooser>
          {allowed && <Panel>
            <h2>{title}</h2>
            <Filters aria-label="Filtros do relatório">
              {report === "birthdays" ? <label htmlFor="report-month">Mês<select id="report-month" value={month} onChange={(event) => { setMonth(Number(event.target.value)); setPage(1); }}>{months.map((name, index) => <option key={name} value={index + 1}>{name}</option>)}</select></label>
                : <><label htmlFor="report-from">{report === "daily" ? "Data" : "De"}<input id="report-from" type="date" value={from} onChange={(event) => { setFrom(event.target.value); setPage(1); }} /></label>
                  {report === "schedule" && <label htmlFor="report-to">Até<input id="report-to" type="date" min={from} value={to} onChange={(event) => { setTo(event.target.value); setPage(1); }} /></label>}
                  <label htmlFor="report-professional">Profissional<select id="report-professional" value={professional} onChange={(event) => { setProfessional(event.target.value); setPage(1); }}><option value="">Todos os profissionais</option>{professionals.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label></>}
            </Filters>
            {loading && <p role="status">Carregando relatório…</p>}
            {error && <p role="alert">{error}</p>}
            {result && <>
              {report !== "birthdays" && <>
                <Metrics>{Object.entries(statuses).map(([key, label]) => <Metric as="button" type="button" key={key} $active={status === key} aria-pressed={status === key} aria-label={`${label} ${result.counts[key]} Ver registros`} onClick={() => filterStatus(key)}><MetricCardLabel>{label}</MetricCardLabel><MetricCardValue>{result.counts[key]}</MetricCardValue></Metric>)}</Metrics>
                <p>{result.total_sessions} atendimentos · {result.unique_patients} pacientes</p>
                {result.excluded_sessions > 0 && <p>{result.excluded_sessions} sessões suspensas ou em outros estados, fora do total.</p>}
                <Filters><label htmlFor="report-status">Situação<select id="report-status" value={status} onChange={(event) => filterStatus(event.target.value)}><option value="all">Todos</option>{Object.entries(statuses).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label></Filters>
              </>}
              {report === "birthdays" && <p>{result.total_rows} aniversariantes · {result.coverage.missing_birth_date} cadastros sem data de nascimento</p>}
              <div ref={tableRef}>
                <TableWrap><DataTable><caption>{title} · {report === "birthdays" ? months[month - 1] : `${civilLabel(result.from)} a ${civilLabel(result.to)}`}</caption>
                  <thead><tr>{report === "birthdays" ? <><TH>Dia</TH><TH>Paciente</TH></> : <><TH>Data e hora</TH><TH>Paciente</TH><TH>Profissional</TH><TH>Serviço</TH><TH>Situação</TH></>}</tr></thead>
                  <tbody>{result.rows.map((row) => <tr key={row.session_id || row.patient_id}>{report === "birthdays" ? <><TD>{String(row.day).padStart(2, "0")}/{String(row.month).padStart(2, "0")}</TD><TD><Link to={`/pacientes/${row.patient_id}`}>{row.name}</Link></TD></>
                    : <><TD>{civilLabel(row.date)} · {timeLabel(row.starts_at)}</TD><TD>{row.patient_name}</TD><TD>{row.professional_name}</TD><TD>{row.service_name}</TD><TD><StatusLabel $status={row.status}>{statuses[row.status]}</StatusLabel></TD></>}</tr>)}</tbody>
                </DataTable></TableWrap>
                {!result.rows.length && <Empty>Nenhum registro para os filtros selecionados.</Empty>}
                {result.total_pages > 1 && <Pagination aria-label="Paginação"><GhostButton type="button" disabled={page === 1} onClick={() => changePage(page - 1)}>Anterior</GhostButton><span>Página {page} de {result.total_pages} · {result.total_rows} registros</span><GhostButton type="button" disabled={page >= result.total_pages} onClick={() => changePage(page + 1)}>Próxima</GhostButton></Pagination>}
              </div>
            </>}
          </Panel>}
        </>}
        {canAccessModule("finance") && <Panel><h2>Financeiro</h2><Link to={`/financeiro/receitas?month=${(from || today).slice(0, 7)}`}>Receitas por paciente · {(from || today).slice(0, 7)}</Link><p><Link to="/financeiro/visao-geral">Abrir visão geral financeira</Link></p></Panel>}
      </Page>
    </AppShell>
  );
}

const Page = styled.main`max-width: ${layout.pageMaxWidth}; margin: 0 auto; padding: ${spacing.xl}; color: ${colors.textPrimary}; h1 { margin: 0; font-size: 28px; } h2 { font-size: 18px; margin: 0 0 ${spacing.md}; } p { margin: ${spacing.md} 0; color: ${colors.textSecondary}; font-size: ${fontSizes.body}; } a { color: ${colors.brandDark}; } button, input, select { font-family: inherit; } button:focus-visible, input:focus-visible, select:focus-visible { outline: 3px solid ${colors.focus}; outline-offset: 2px; } @media(max-width:768px) { padding: ${spacing.lg}; }`;
const Panel = styled.section`background: ${colors.surface}; border: 1px solid ${colors.borderSubtle}; border-radius: ${radii.lg}; padding: ${spacing.lg}; margin-top: ${spacing.lg};`;
const Chooser = styled.div`display: flex; gap: ${spacing.sm}; flex-wrap: wrap; margin-top: ${spacing.lg};`;
const Choice = styled(GhostButton)`min-height: 44px; background: ${(p) => p.$active ? colors.brand : colors.surface}; color: ${(p) => p.$active ? colors.white : colors.brandDark}; &:hover { background: ${(p) => p.$active ? colors.brandDark : colors.surfaceSecondary}; }`;
const Filters = styled.div`display:flex; flex-wrap:wrap; gap:${spacing.md}; margin:${spacing.md} 0; label { display:flex; flex-direction:column; gap:${spacing.xs}; font-size:${fontSizes.small}; font-weight:600; flex: 1 1 150px; max-width:260px; } input,select { height:44px; padding:8px 12px; border:1px solid ${colors.borderSubtle}; border-radius:${radii.sm}; background:${colors.surface}; color:${colors.textPrimary}; font-size:${fontSizes.body}; min-width:0; } @media(max-width:600px) { label { max-width:none; } }`;
const Metrics = styled.div`display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:${spacing.md}; margin:${spacing.lg} 0; @media(max-width:700px) { grid-template-columns:repeat(2,minmax(0,1fr)); }`;
const Metric = styled(MetricCardSurface)`cursor:pointer; --app-metric-value-size:1.75rem; background:${(p) => p.$active ? alpha.brand010 : colors.surfaceSecondary}; border-color:${(p) => p.$active ? colors.brand : colors.borderSubtle}; &:hover { border-color:${colors.brand}; }`;
const StatusLabel = styled.span`font-size:${fontSizes.small}; white-space:nowrap; color:${(p) => ({ done: colors.success, no_show: colors.warning, canceled: colors.danger, scheduled: colors.info }[p.$status] || colors.textSecondary)};`;
const Empty = styled.p`padding:${spacing.xl}; text-align:center; background:${colors.surfaceSecondary}; border-radius:${radii.sm};`;
const Pagination = styled.nav`display:flex; gap:${spacing.md}; flex-wrap:wrap; align-items:center; justify-content:flex-end; margin-top:${spacing.md}; font-size:${fontSizes.small}; button { min-height:44px; } button:disabled { opacity:.5; cursor:not-allowed; }`;
