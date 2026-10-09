import api from './axios';

export const previewCreditReturn = (command) =>
  api.post('/financial-payments/credit-return-preview', command);
export const confirmCreditReturn = (command, idempotencyKey) =>
  api.post('/financial-payments/return-credit', command, {
    headers: { 'Idempotency-Key': idempotencyKey },
  });
