import { useCallback, useMemo, useRef, useState } from "react";
import { getFinancialRevenuesSummary } from "../../../services/financial";
import { emptyFinancialRevenuesSummary, normalizeFinancialRevenuesSummary } from "../helpers/financialRevenuesSummary";
import { validateUnifiedRevenueSummary } from "../helpers/unifiedRevenueCharges";

export default function useRevenuePatientPages({ period, mode, types, status, search, professionalId, context }) {
  const periodKey = `${mode}:${period}`;
  const queryKey = JSON.stringify([periodKey, [...types].sort(), status, search.trim(), professionalId]);
  const current = useRef(null);
  current.current = { key: queryKey, context, period, mode, types, status, search, professionalId, periodKey };
  const request = useRef(0);
  const committed = useRef(null);
  const [state, setState] = useState(() => ({ summary: emptyFinancialRevenuesSummary(), query: null,
    failedQuery: null, error: "", loading: false, loadingMore: false, professionals: [] }));
  const reset = useCallback(() => {
    request.current += 1;
    committed.current = null;
    setState({ summary: emptyFinancialRevenuesSummary(), query: null, failedQuery: null,
      error: "", loading: false, loadingMore: false, professionals: [] });
  }, []);
  const load = useCallback(async (append = false) => {
    const query = current.current;
    const previous = committed.current;
    if (!query.period || (append && (!previous || previous.query.key !== query.key
      || previous.query.context !== query.context || !previous.summary.page_info?.has_more))) return;
    request.current += 1;
    const id = request.current;
    const valid = () => request.current === id && current.current.key === query.key
      && current.current.context === query.context;
    const page = append ? previous.summary.page_info.next_page : 1;
    setState((value) => ({ ...value, loading: !append, loadingMore: append, error: "", failedQuery: null }));
    try {
      const response = await getFinancialRevenuesSummary(query.period, query.mode, {
        origin: "all", charge_types: [...query.types].sort().join(","), financial_status: query.status,
        patient_query: query.search.trim(), page, page_size: 20,
        ...(query.professionalId ? { professional_id: query.professionalId } : {}),
      });
      if (!valid()) return;
      const payload = response.data;
      validateUnifiedRevenueSummary(payload);
      if (!payload.page_info || payload.page_info.page !== page || payload.page_info.page_size !== 20
        || !Number.isSafeInteger(payload.patients_count) || !Number.isSafeInteger(payload.charges_count)
        || payload.patients_count < 0 || payload.charges_count < 0
        || payload.page_info.total !== payload.patients_count || typeof payload.page_info.has_more !== "boolean"
        || payload.page_info.next_page !== (payload.page_info.has_more ? page + 1 : null)
        || typeof payload.result_version !== "string" || !payload.result_version
        || payload.patients.length !== Math.min(20, Math.max(0, payload.patients_count - (page - 1) * 20))
        || !payload.patients.every((patient) => ["upcoming", "overdue", "paid", "missing_due_date", "missing"]
          .includes(patient.revenue_status))) throw new Error("Paginação inválida");
      // A concurrent financial change invalidates every previously appended block.
      if (append && payload.result_version !== previous.summary.result_version) {
        await load(false);
        return;
      }
      const summary = normalizeFinancialRevenuesSummary(payload, query.period);
      if (append) {
        const seen = new Set(previous.summary.patients.map((patient) => patient.patient_id));
        summary.patients = [...previous.summary.patients, ...summary.patients.filter((patient) => !seen.has(patient.patient_id))];
      }
      const committedQuery = { ...query, period: query.periodKey };
      committed.current = { summary, query: committedQuery };
      setState({ summary, query: committedQuery, professionals: payload.professionals || [], error: "", failedQuery: null,
        loading: false, loadingMore: false });
    } catch (error) {
      if (valid()) setState((value) => ({ ...value, error: append
        ? "Não foi possível carregar mais pacientes." : "Não foi possível carregar o resumo de receitas.",
      failedQuery: query.key, loading: false, loadingMore: false }));
    }
  }, []);
  const loadFirst = useCallback(() => {
    if (current.current.key !== queryKey || current.current.context !== context) return undefined;
    return load(false);
  }, [load, queryKey, context]);
  const loadMore = useCallback(() => load(true), [load]);
  const presentation = useMemo(() => new Map(state.summary.patients.map((patient) => [patient.patient_id, {
    referenceItems: [{ referenceDate: patient.reference_date, openCents: 0 }],
    dueDate: patient.due_date, overdueCents: Number(patient.overdue_cents || 0),
  }])), [state.summary]);
  return { ...state, queryKey, periodKey, presentation, loadFirst, loadMore, reset };
}
