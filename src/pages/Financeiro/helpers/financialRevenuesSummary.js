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
    summary: {
      total: toCents(summary.total),
      received: toCents(summary.received),
      pending: toCents(summary.pending),
    },
    patients: patients.map((patient) => ({
      patient_id: Number(patient.patient_id || 0),
      patient_name: patient.patient_name || "Paciente",
      total: toCents(patient.total),
      received: toCents(patient.received),
      pending: toCents(patient.pending),
      entries_count: Number(patient.entries_count || 0),
    })).filter((patient) => patient.patient_id > 0),
  };
};

export const mapRevenuesSummaryPatientsToAttendanceRows = (payload = {}) => (
  Array.isArray(payload.patients) ? payload.patients : []
).map((patient) => ({
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
    total: patients.reduce((sum, patient) => sum + Number(patient.entries_count || 0), 0),
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
