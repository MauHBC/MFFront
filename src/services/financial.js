import api from './axios';

export const listFinancialCategories = (params) =>
  api.get('/financial-categories', { params });

export const createFinancialCategory = (payload) =>
  api.post('/financial-categories', payload);

export const updateFinancialCategory = (id, payload) =>
  api.put(`/financial-categories/${id}`, payload);

export const listPaymentMethods = (params) =>
  api.get('/payment-methods', { params });

export const createPaymentMethod = (payload) =>
  api.post('/payment-methods', payload);

export const updatePaymentMethod = (id, payload) =>
  api.put(`/payment-methods/${id}`, payload);

export const listServicePrices = (params) =>
  api.get('/service-prices', { params });

export const createServicePrice = (payload) =>
  api.post('/service-prices', payload);

export const updateServicePrice = (id, payload) =>
  api.put(`/service-prices/${id}`, payload);

export const listFinancialEntries = (params) =>
  api.get('/financial-entries', { params });

export const createFinancialEntry = (payload) =>
  api.post('/financial-entries', payload);

export const updateFinancialEntry = (id, payload) =>
  api.put(`/financial-entries/${id}`, payload);

export const listFinancialPayments = (params) =>
  api.get('/financial-payments', { params });

export const createFinancialPayment = (payload) =>
  api.post('/financial-payments', payload);

export const applyCreditToFinancialEntry = (id) =>
  api.post(`/financial-entries/${id}/apply-credit`);

export const listPatientCredits = (params) =>
  api.get('/patient-credits', { params });

export const createPatientCredit = (payload) =>
  api.post('/patient-credits', payload);

export const updatePatientCredit = (id, payload) =>
  api.put(`/patient-credits/${id}`, payload);

export const createSessionFinancialEntry = (sessionId) =>
  api.post(`/sessions/${sessionId}/financial-entry`);

export const listFinancialRecurringExpenses = (params) =>
  api.get('/financial-recurring-expenses', { params });

export const createFinancialRecurringExpense = (payload) =>
  api.post('/financial-recurring-expenses', payload);

export const updateFinancialRecurringExpense = (id, payload) =>
  api.put(`/financial-recurring-expenses/${id}`, payload);

export const listPatientPlans = (params) =>
  api.get('/patient-plans', { params });

export const listServicePlans = (params) =>
  api.get('/service-plans', { params });

export const createServicePlan = (payload) =>
  api.post('/service-plans', payload);

export const updateServicePlan = (id, payload) =>
  api.put(`/service-plans/${id}`, payload);

export const deactivateServicePlan = (id) =>
  api.post(`/service-plans/${id}/deactivate`);

export const createPatientPlan = (payload) =>
  api.post('/patient-plans', payload);

export const updatePatientPlan = (id, payload) =>
  api.put(`/patient-plans/${id}`, payload);

export const pausePatientPlan = (id) =>
  api.post(`/patient-plans/${id}/pause`);

export const resumePatientPlan = (id) =>
  api.post(`/patient-plans/${id}/resume`);

export const cancelPatientPlan = (id, payload = {}) =>
  api.post(`/patient-plans/${id}/cancel`, payload);

export const listBillingCycles = (params) =>
  api.get('/billing-cycles', { params });

export const getCoveragePreview = (params) =>
  api.get('/billing-cycles/coverage-preview', { params });

export default {
  listFinancialCategories,
  createFinancialCategory,
  updateFinancialCategory,
  listPaymentMethods,
  createPaymentMethod,
  updatePaymentMethod,
  listServicePrices,
  createServicePrice,
  updateServicePrice,
  listFinancialEntries,
  createFinancialEntry,
  updateFinancialEntry,
  listFinancialPayments,
  createFinancialPayment,
  applyCreditToFinancialEntry,
  listPatientCredits,
  createPatientCredit,
  updatePatientCredit,
  createSessionFinancialEntry,
  listFinancialRecurringExpenses,
  createFinancialRecurringExpense,
  updateFinancialRecurringExpense,
  listPatientPlans,
  listServicePlans,
  createServicePlan,
  updateServicePlan,
  deactivateServicePlan,
  createPatientPlan,
  updatePatientPlan,
  pausePatientPlan,
  resumePatientPlan,
  cancelPatientPlan,
  listBillingCycles,
  getCoveragePreview,
};
