import { normalizeSearchText } from "../../../utils/patientSearch";

export const emptyFinancialRevenuesSummary = (month = "") => ({
  month,
  summary: {
    total: 0,
    received: 0,
    pending: 0,
  },
  patients: [],
});

const toCents = (value) => Number(value || 0);

export const normalizeFinancialRevenuesSummary = (payload = {}, fallbackMonth = "") => {
  const summary = payload.summary || {};
  const patients = Array.isArray(payload.patients) ? payload.patients : [];

  return {
    month: payload.month || fallbackMonth,
    ...(payload.page_info ? { page_info: payload.page_info, patients_count: payload.patients_count,
      charges_count: payload.charges_count, result_version: payload.result_version } : {}),
    summary: {
      total: toCents(summary.total),
      received: toCents(summary.received),
      pending: toCents(summary.pending),
    },
    patients: patients.map((patient) => ({
      ...(payload.page_info ? { reference_date: patient.reference_date, due_date: patient.due_date,
        overdue_cents: patient.overdue_cents, revenue_status: patient.revenue_status } : {}),
      patient_id: Number(patient.patient_id || 0),
      patient_name: patient.patient_name || "Paciente",
      patient_full_name: patient.patient_full_name || patient.patient_name || "Paciente",
      total: toCents(patient.total),
      received: toCents(patient.received),
      pending: toCents(patient.pending),
      entries_count: Number(patient.entries_count || 0),
    })).filter((patient) => patient.patient_id > 0),
  };
};

export const filterFinancialRevenuesSummary = (payload = {}, query = "") => {
  const search = normalizeSearchText(query);
  if (!search) return payload;

  const patients = (payload.patients || []).filter((patient) => (
    [patient.patient_name, patient.patient_full_name]
      .some((name) => normalizeSearchText(name).includes(search))
  ));

  return {
    ...payload,
    patients,
    summary: patients.reduce((summary, patient) => ({
      total: summary.total + toCents(patient.total),
      received: summary.received + toCents(patient.received),
      pending: summary.pending + toCents(patient.pending),
    }), { total: 0, received: 0, pending: 0 }),
  };
};

export const mapRevenuesSummaryPatientsToAttendanceRows = (payload = {}) => (
  Array.isArray(payload.patients) ? payload.patients : []
).map((patient) => ({
  ...(patient.revenue_status ? { revenueStatus: patient.revenue_status } : {}),
  patientId: Number(patient.patient_id || 0),
  patientName: patient.patient_name || "Paciente",
  sessions: Number(patient.entries_count || 0),
  totalCents: toCents(patient.total),
  openCents: toCents(patient.pending),
  paidCents: toCents(patient.received),
  creditsAvailable: 0,
  lastSession: null,
})).filter((patient) => patient.patientId > 0);

export const mapRevenuesSummaryToAttendanceSummary = (payload = {}) => {
  const summary = payload.summary || {};
  const patients = Array.isArray(payload.patients) ? payload.patients : [];
  const pendingAmount = toCents(summary.pending);

  return {
    total: payload.charges_count ?? patients.reduce((sum, patient) => sum + Number(patient.entries_count || 0), 0),
    openSessions: patients
      .filter((patient) => toCents(patient.pending) > 0)
      .reduce((sum, patient) => sum + Number(patient.entries_count || 0), 0),
    openPatients: patients.filter((patient) => toCents(patient.pending) > 0).length,
    pendingAmount,
    paidAmount: toCents(summary.received),
    expectedAmount: toCents(summary.total),
    creditsAvailable: 0,
  };
};
