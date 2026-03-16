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

export const listFinancialPayments = (params) =>
  api.get('/financial-payments', { params });

export const createFinancialPayment = (payload) =>
  api.post('/financial-payments', payload);

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
  listFinancialPayments,
  createFinancialPayment,
  listPatientCredits,
  createPatientCredit,
  updatePatientCredit,
  createSessionFinancialEntry,
  listFinancialRecurringExpenses,
  createFinancialRecurringExpense,
  updateFinancialRecurringExpense,
};
