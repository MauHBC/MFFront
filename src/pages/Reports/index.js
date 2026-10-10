import React, { useEffect, useRef, useState } from "react";
import styled from "styled-components";
import { FaFilePdf, FaFileCsv } from "react-icons/fa";
import AppShell from "../../components/AppShell";
import { PrimaryButton, GhostButton } from "../../components/AppButton";
import { Field } from "../../components/AppForm";
import { PageContent } from "../../components/AppLayout";
import { ModuleHeader, ModuleTitle, ModulePanel } from "../../components/AppModuleShell";
import { AppToolbar, AppToolbarRight } from "../../components/AppToolbar";
import AppPagination from "../../components/AppPagination";
import DataLoadingState from "../../components/DataLoadingState";
import { TableWrap, DataTable, TH, TD } from "../../components/AppTable";
import { colors, spacing, fontSizes } from "../../styles/tokens";
import { useAuthorization } from "../../contexts/AuthorizationContext";
import api from "../../services/axios";
import { downloadPdfResponse } from "../../services/documents";
import { todayInSaoPaulo, getCivilMonthRange } from "../../utils/canonicalDateTime";

export const catalog = [
  { id: "receipts", name: "Recebimentos e devoluções", module: "finance", admin: true, category: "Financeiro" },
  { id: "cash", name: "Movimentação de caixa", module: "finance", admin: true, category: "Financeiro" },
  { id: "receivables", name: "Contas a receber e atrasos", module: "finance", category: "Financeiro" },
  { id: "production", name: "Produção por profissional e serviço", module: "schedule", category: "Atendimentos" },
  { id: "absences", name: "Faltas e cancelamentos", module: "schedule", category: "Atendimentos" },
  { id: "anniversaries", name: "Aniversariantes", module: "patients", category: "Pacientes" },
];
export const cellLabel = (value, type) => {
  if (type === "age") return `${value} anos`;
  if (type === "money") return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value || 0) / 100);
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value.split("-").reverse().join("/");
  return String(value ?? "");
};
const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const groupValue = (kind, value) => { if (kind === "cash") return value === "month" ? "month" : "day"; return ["professional", "service", "patient"].includes(value) ? value : "professional"; };
const situationOptions = { receipts: ["receipt", "return"], receivables: ["overdue", "upcoming", "missing_due_date"], absences: ["no_show", "canceled"] };
const grouped = (kind) => ["cash", "production", "absences"].includes(kind);
const filterValues = { all: "Todos", day: "Dia", month: "Mês", professional: "Profissional", service: "Serviço", patient: "Paciente", overdue: "Vencidos", upcoming: "A vencer", missing_due_date: "Sem vencimento", no_show: "Faltas", canceled: "Cancelamentos", receipt: "Recebimentos", return: "Devoluções", entry: "Avulsas", series: "Pacotes", billing_cycle: "Mensalidades" };
const filterNames = { professional_user_id: "Profissional", service_id: "Serviço", payment_method_id: "Meio", group_by: "Agrupamento", situation: "Situação", charge_type: "Cobrança" };

export default function Reports() {
  const { canAccessModule, context, isAdministrator } = useAuthorization();
  const available = catalog.filter((r) => r.admin ? isAdministrator : canAccessModule(r.module));
  const today = todayInSaoPaulo();
  const [kind, setKind] = useState(available[0]?.id || "production");
  const [mode, setMode] = useState("month");
  const [month, setMonth] = useState(Number(today.slice(5, 7)));
  const [year, setYear] = useState(today.slice(0, 4));
  const initialRange = getCivilMonthRange(today.slice(0, 7));
  const [from, setFrom] = useState(initialRange?.start || today);
  const [to, setTo] = useState(initialRange?.end || today);
  const [professional, setProfessional] = useState("");
  const [method, setMethod] = useState("");
  const [situation, setSituation] = useState("all");
  const [chargeType, setChargeType] = useState("all");
  const [groupBy, setGroupBy] = useState("day");
  const [references, setReferences] = useState(null);
  const [response, setResponse] = useState(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [detailPage, setDetailPage] = useState(1);
  const [creditReturnPage, setCreditReturnPage] = useState(1);
  const generation = useRef(0);
  const mounted = useRef(true);
  const selected = available.find((r) => r.id === kind);
  const monthRange = getCivilMonthRange(`${year}-${String(month).padStart(2, "0")}`);
  const range = mode === "month" ? { from: monthRange?.start || "", to: monthRange?.end || "" } : { from, to };
  const params = { ...range,
    ...(grouped(kind) ? { group_by: groupValue(kind, groupBy) } : {}),
    ...(["production", "absences"].includes(kind) && professional ? { professional_user_id: professional } : {}),
    ...(kind === "receipts" && method ? { payment_method_id: method } : {}),
    ...(["receipts", "receivables", "absences"].includes(kind) ? { situation } : {}),
    ...(kind === "receivables" ? { charge_type: chargeType } : {}),
  };
  const filterKey = JSON.stringify([kind, params]);
  const currentKey = useRef(filterKey);
  currentKey.current = filterKey;
  const currentContext = useRef(context);
  currentContext.current = context;
  const report = response?.context === context && response?.key === filterKey && selected ? response.data : null;
  const canExport = context?.authorization_source === "legacy" || context?.modules?.find((m) => m.module_key === selected?.module)?.can_export === true;

  useEffect(() => { mounted.current = true; return () => { mounted.current = false; generation.current += 1; }; }, []);
  useEffect(() => { generation.current += 1; setLoading(false); setResponse(null); setError(""); }, [filterKey, context]);
  useEffect(() => {
    if (!selected && available.length) setKind(available[0].id);
  }, [selected, available]);
  useEffect(() => {
    let active = true;
    setReferences(null);
    const requests = [canAccessModule("schedule") ? api.get("/schedule/references/professionals") : Promise.resolve({ data: [] }), isAdministrator ? api.get("/payment-methods") : Promise.resolve({ data: [] })];
    Promise.all(requests).then(([professionals, methods]) => { if (active) setReferences({ context, professionals: Array.isArray(professionals.data) ? professionals.data : [], methods: Array.isArray(methods.data) ? methods.data : [] }); }).catch(() => { if (active) setReferences({ context, professionals: [], methods: [] }); });
    return () => { active = false; };
  }, [context, canAccessModule, isAdministrator]);
  const refs = references?.context === context ? references : { professionals: [], methods: [] };
  const changeReport = (value) => { setKind(value); setSituation("all"); setProfessional(""); setMethod(""); setChargeType("all"); setGroupBy(value === "cash" ? "day" : "professional"); };
  const generate = async (event) => {
    event.preventDefault();
    if (!selected) return;
    generation.current += 1;
    const requestId = generation.current;
    const key = filterKey;
    const capturedContext = context;
    setLoading(true); setError(""); setResponse(null);
    try {
      const { data } = await api.get(`/reports/${kind}/document`, { params });
      if (mounted.current && requestId === generation.current && currentKey.current === key && currentContext.current === capturedContext) { setResponse({ context: capturedContext, key, data }); setPage(1); setDetailPage(1); setCreditReturnPage(1); }
    } catch (failure) {
      if (mounted.current && requestId === generation.current) setError(failure.response?.status === 400 ? "Confira o período e os filtros." : "Não foi possível gerar o relatório. Tente novamente.");
    } finally { if (mounted.current && requestId === generation.current) setLoading(false); }
  };
  const exportReport = async (format) => {
    if (!report || !canExport) return;
    const key = filterKey;
    const capturedContext = context;
    setExporting(true); setError("");
    try {
      const result = await api.get(`/reports/${kind}/export`, { params: { ...params, format, version: report.version }, responseType: "blob" });
      if (!mounted.current || currentKey.current !== key || currentContext.current !== capturedContext) return;
      if (format === "pdf") downloadPdfResponse(result, "relatorio");
      else {
        const url = URL.createObjectURL(result.data);
        const link = document.createElement("a"); link.href = url; link.download = `relatorio-${kind}-${range.from}-${range.to}.csv`; link.click(); URL.revokeObjectURL(url);
      }
    } catch (failure) {
      if (mounted.current && currentKey.current === key && currentContext.current === capturedContext) setError(failure.response?.status === 409 ? "Os dados mudaram. Gere novamente antes de exportar." : "Não foi possível exportar. Confira seu acesso e tente novamente.");
    } finally { if (mounted.current) setExporting(false); }
  };
  const activeFilterLabels = report ? Object.entries(report.filters)
    .filter(([key]) => filterNames[key])
    .map(([key, value]) => `${filterNames[key]}: ${report.filter_labels?.[key] || filterValues[value] || (key === "professional_user_id" ? refs.professionals?.find((p) => Number(p.id) === Number(value))?.name : null) || value}`) : [];
  const renderTable = (columns, rows, currentPage, updatePage, label) => <TableSection>
    <TableWrap><DataTable><caption>{label}</caption><thead><tr>{columns.map((c) => <TH scope="col" key={c.key} style={["money", "number", "age"].includes(c.type) ? { textAlign: "right" } : undefined}>{c.label}</TH>)}</tr></thead><tbody>{rows.slice((currentPage - 1) * 20, currentPage * 20).map((row, index) => <tr key={JSON.stringify([index, row])}>{columns.map((c) => <TD key={c.key} style={["money", "number", "age"].includes(c.type) ? { textAlign: "right", whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" } : undefined}>{cellLabel(row[c.key], c.type)}</TD>)}</tr>)}</tbody></DataTable></TableWrap>
    {!rows.length && <DataLoadingState tone="empty" compact>Nenhum registro para os filtros selecionados.</DataLoadingState>}
    {rows.length > 20 && <AppPagination ariaLabel={`Paginação de ${label}`} page={currentPage} pageSize={20} total={rows.length} totalPages={Math.ceil(rows.length / 20)} onPageChange={updatePage} />}
  </TableSection>;
  return <AppShell pageTitle="Relatórios"><Page as="div">
    <ModuleHeader><ModuleTitle>Relatórios</ModuleTitle></ModuleHeader>
    {!available.length ? <DataLoadingState tone="empty" compact>Você não tem acesso aos relatórios disponíveis.</DataLoadingState> : <>
      <Configuration as="form" onSubmit={generate} aria-label="Configuração do relatório">
        <ReportChoice htmlFor="report-kind">Relatório<select id="report-kind" value={kind} onChange={(e) => changeReport(e.target.value)}>{["Financeiro", "Atendimentos", "Pacientes"].map((category) => <optgroup label={category} key={category}>{available.filter((r) => r.category === category).map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</optgroup>)}</select></ReportChoice>
        <Filters>
          <ReportField $width="156px" htmlFor="report-period">Período<select id="report-period" value={mode} onChange={(e) => setMode(e.target.value)}><option value="month">Mês e ano</option><option value="range">Intervalo</option></select></ReportField>
          {mode === "month" ? <><ReportField $width="148px" htmlFor="report-month">Mês<select id="report-month" value={month} onChange={(e) => setMonth(Number(e.target.value))}>{monthNames.map((m, index) => <option value={index + 1} key={m}>{m}</option>)}</select></ReportField><ReportField $width="96px" $compact htmlFor="report-year">Ano<input id="report-year" type="number" min="1900" max="9998" required value={year} onChange={(e) => setYear(e.target.value)} /></ReportField></> : <><ReportField $width="164px" htmlFor="report-from">De<input id="report-from" type="date" required value={from} onChange={(e) => setFrom(e.target.value)} /></ReportField><ReportField $width="164px" htmlFor="report-to">Até<input id="report-to" type="date" min={from} required value={to} onChange={(e) => setTo(e.target.value)} /></ReportField></>}
          {["production", "absences"].includes(kind) && <ReportField $width="208px" htmlFor="report-professional">Profissional<select id="report-professional" value={professional} onChange={(e) => setProfessional(e.target.value)}><option value="">Todos</option>{(refs.professionals || []).map((p) => <option value={p.id} key={p.id}>{p.name}</option>)}</select></ReportField>}
          {kind === "receipts" && <ReportField $width="180px" htmlFor="report-method">Meio de pagamento<select id="report-method" value={method} onChange={(e) => setMethod(e.target.value)}><option value="">Todos</option>{(refs.methods || []).map((m) => <option value={m.id} key={m.id}>{m.name}</option>)}</select></ReportField>}
          {grouped(kind) && <ReportField $width="156px" htmlFor="report-group">Agrupar por<select id="report-group" value={groupValue(kind, groupBy)} onChange={(e) => setGroupBy(e.target.value)}>{(kind === "cash" ? ["day", "month"] : ["professional", "service", "patient"]).map((value) => <option value={value} key={value}>{filterValues[value]}</option>)}</select></ReportField>}
          {["receipts", "receivables", "absences"].includes(kind) && <ReportField $width="164px" htmlFor="report-situation">Situação<select id="report-situation" value={situation} onChange={(e) => setSituation(e.target.value)}>{["all", ...(situationOptions[kind] || [])].map((value) => <option value={value} key={value}>{filterValues[value]}</option>)}</select></ReportField>}
          {kind === "receivables" && <ReportField $width="156px" htmlFor="report-charge">Cobrança<select id="report-charge" value={chargeType} onChange={(e) => setChargeType(e.target.value)}>{["all", "entry", "series", "billing_cycle"].map((value) => <option key={value} value={value}>{filterValues[value]}</option>)}</select></ReportField>}
          <GenerateButton type="submit" disabled={loading || !selected}>{loading ? "Gerando…" : "Gerar relatório"}</GenerateButton>
        </Filters>
      </Configuration>
      {loading && <DataLoadingState compact>Gerando relatório.</DataLoadingState>}
      {error && <ErrorMessage role="alert">{error}</ErrorMessage>}
      {report && <Document as="section" aria-label="Documento do relatório" aria-busy={exporting}>
        <DocumentHeader>
          <DocumentIdentity><ClinicName>{report.clinic.name}</ClinicName><DocumentTitle>{report.title}</DocumentTitle></DocumentIdentity>
          <ExportActions aria-label="Ações do relatório">
            <GhostButton type="button" disabled={!canExport || exporting} onClick={() => exportReport("pdf")}><FaFilePdf aria-hidden="true" />Baixar PDF</GhostButton>
            <GhostButton type="button" disabled={!canExport || exporting} onClick={() => exportReport("csv")}><FaFileCsv aria-hidden="true" />CSV</GhostButton>
          </ExportActions>
        </DocumentHeader>
        <DocumentMetadata><span>{cellLabel(report.filters.from)} a {cellLabel(report.filters.to)}</span>{activeFilterLabels.length > 0 && <span>{activeFilterLabels.join(" · ")}</span>}</DocumentMetadata>
        <DateBasis>{report.date_basis}</DateBasis>
        {!canExport && <Note>Exportação não autorizada para seu perfil.</Note>}
        {exporting && <ExportStatus role="status">Preparando arquivo…</ExportStatus>}
        {renderTable(report.columns, report.rows, page, setPage, report.rows_title || "Resultado")}
        <Totals>{report.totals.map((t) => <div key={t.key}><span>{t.label}</span><strong>{cellLabel(t.value, t.type)}</strong></div>)}</Totals>
        {report.detail?.length > 0 && renderTable(report.detail_columns, report.detail, detailPage, setDetailPage, "Detalhamento")}
        {report.credit_returns_columns?.length > 0 && renderTable(report.credit_returns_columns, report.credit_returns || [], creditReturnPage, setCreditReturnPage, report.credit_returns_title)}
        {report.notes.map((note) => <Note key={note}>{note}</Note>)}
        {report.kind !== "anniversaries" && <Note>Gerado em {new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" }).format(new Date(report.generated_at))}</Note>}
      </Document>}
    </>}
  </Page></AppShell>;
}
const Page = styled(PageContent)`
  min-width: 0;
  color: ${colors.ink};
  button, input, select { font-family: inherit; }
  button:focus-visible, input:focus-visible, select:focus-visible { outline: 2px solid ${colors.focus}; outline-offset: 2px; }
`;
const Configuration = styled(ModulePanel)`
  @media (max-width: 600px) { padding: ${spacing.lg}; }
`;
const ReportField = styled(Field)`
  flex: 0 1 ${p => p.$width || "180px"};
  min-width: 0;
  margin-bottom: 0;
  input, select { box-sizing: border-box; height: 42px; width: 100%; min-width: 0; }
  @media (max-width: 600px) { flex: ${p => p.$compact ? "0 0 96px" : "1 1 150px"}; }
`;
const ReportChoice = styled(ReportField)`
  width: min(100%, 440px);
  margin-bottom: ${spacing.lg};
`;
const Filters = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: end;
  gap: ${spacing.md};
`;
const GenerateButton = styled(PrimaryButton)`
  min-height: 42px;
  justify-content: center;
  @media (max-width: 600px) { width: 100%; }
`;
const Document = styled(ModulePanel)`
  min-width: 0;
  margin-top: ${spacing.lg};
  caption { text-align: left; font-weight: 700; padding: 10px 14px; color: ${colors.ink}; }
  thead { display: table-header-group; }
  @media (max-width: 600px) { padding: ${spacing.lg}; }
  @media print { border: 0; padding: 0; }
`;
const DocumentHeader = styled(AppToolbar)`
  align-items: flex-start;
  margin-bottom: ${spacing.sm};
`;
const DocumentIdentity = styled.div`
  flex: 1 1 240px;
  min-width: 0;
`;
const ClinicName = styled.p`
  color: ${colors.brand};
  font-size: ${fontSizes.small};
  font-weight: 600;
  margin: 0 0 2px;
`;
const DocumentTitle = styled.h2`
  color: ${colors.ink};
  font-size: 1.125rem;
  font-weight: 800;
  line-height: 1.3;
  margin: 0;
`;
const ExportActions = styled(AppToolbarRight)`
  gap: ${spacing.sm};
  button { display: inline-flex; align-items: center; justify-content: center; gap: 6px; }
  button:disabled { opacity: .55; cursor: not-allowed; }
  @media print { display: none; }
`;
const DocumentMetadata = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 4px ${spacing.md};
  font-size: ${fontSizes.small};
  color: ${colors.ink};
  line-height: 1.4;
`;
const DateBasis = styled.p`
  font-size: ${fontSizes.small};
  color: ${colors.textSecondary};
  line-height: 1.4;
  margin: 4px 0 ${spacing.md};
`;
const TableSection = styled.div`
  margin-top: ${spacing.md};
  min-width: 0;
  @media (max-width: 480px) {
    nav > div { flex-wrap: wrap; }
    nav > div > span { order: -1; flex-basis: 100%; min-width: 0; text-align: left; }
    nav button { flex: 1; min-width: 0; }
  }
`;
const Totals = styled.div`
  display: flex;
  gap: ${spacing.lg} ${spacing.xl};
  flex-wrap: wrap;
  padding: ${spacing.lg} 0;
  div { display: flex; flex-direction: column; gap: 2px; }
  span { font-size: ${fontSizes.small}; color: ${colors.textSecondary}; }
  strong { font-size: 18px; font-variant-numeric: tabular-nums; }
`;
const Note = styled.p`
  font-size: ${fontSizes.small};
  color: ${colors.textSecondary};
  line-height: 1.4;
  margin: ${spacing.sm} 0 0;
`;
const ExportStatus = styled(Note)`margin-bottom: ${spacing.sm};`;
const ErrorMessage = styled.p`
  font-size: ${fontSizes.body};
  color: ${colors.dangerText};
  margin: ${spacing.md} 0;
`;
