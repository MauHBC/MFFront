import api from './axios';

export const listPaymentUnapplications = (body) => api.post('/financial-payments/unapplication-options', body);
export const previewPaymentUnapplication = (body) => api.post('/financial-payments/unapplication-preview', body);
export const confirmPaymentUnapplication = (body, key) => api.post('/financial-payments/unapply', body, {
  headers: { 'Idempotency-Key': key },
});
