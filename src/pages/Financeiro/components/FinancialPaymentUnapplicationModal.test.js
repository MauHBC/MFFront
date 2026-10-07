import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Modal from './FinancialPaymentUnapplicationModal';
import { listPaymentUnapplications, previewPaymentUnapplication, confirmPaymentUnapplication } from '../../../services/financialUnapplication';

jest.mock('../../../services/financialUnapplication', () => ({
  listPaymentUnapplications: jest.fn(), previewPaymentUnapplication: jest.fn(), confirmPaymentUnapplication: jest.fn(),
}));
jest.mock('../../../services/axios', () => ({ getUserFacingApiError: (_error, fallback) => fallback }));
const query = { patient_id: 1, charge_key: 'entry-10', period_start: '2026-09-01', period_end: '2026-09-30' };
const selected = { operation_key: 'receipt:7', label: 'Recebimento #7', amount_cents: 9000, eligible: true, blockers: [] };
const reviewed = { ...query, operation_key: selected.operation_key, eligible: true, amount_cents: 9000, discount_cents: 1000, surcharge_cents: 0, credit_before_cents: 0, credit_after_cents: 9000, preview_fingerprint: 'snapshot' };
const setup = () => {
  const onCompleted = jest.fn(); const onClose = jest.fn();
  render(<Modal target={{ query, patientName: 'Paciente sintético', chargeName: 'Avulsa' }} formatCurrency={(value) => `R$ ${value / 100}`} onCompleted={onCompleted} onClose={onClose} />);
  return { onCompleted, onClose };
};
const advance = async () => {
  await userEvent.click(await screen.findByRole('radio', { name: /Recebimento #7/ }));
  await userEvent.type(screen.getByLabelText('Motivo do desfazimento'), 'Destino errado');
  await userEvent.click(screen.getByRole('button', { name: 'Conferir desfazimento' }));
  await screen.findByRole('button', { name: 'Confirmar desfazimento' });
};
beforeEach(() => {
  jest.clearAllMocks();
  listPaymentUnapplications.mockResolvedValue({ data: { ...query, operations: [selected, { ...selected, operation_key: 'receipt:8', label: 'Recebimento #8', eligible: false, blockers: ['Origem sem rastreio seguro'] }] } });
  previewPaymentUnapplication.mockResolvedValue({ data: reviewed });
  confirmPaymentUnapplication.mockResolvedValue({ data: { ...reviewed, id: 2 } });
});
test('seleciona baixa identificada, explica bloqueio legado e restaura somente dinheiro', async () => {
  const { onCompleted } = setup();
  expect(await screen.findByText('Origem sem rastreio seguro')).toBeVisible();
  expect(screen.getByRole('radio', { name: /Recebimento #8/ })).toBeDisabled();
  await advance();
  expect(previewPaymentUnapplication).toHaveBeenCalledWith({ ...query, operation_key: 'receipt:7', reason: 'Destino errado' });
  expect(screen.getByText(/Desconto não vira crédito/)).toBeVisible();
  await userEvent.click(screen.getByRole('button', { name: 'Confirmar desfazimento' }));
  await waitFor(() => expect(onCompleted).toHaveBeenCalledTimes(1));
});
test('timeout mantém corpo e chave da mesma tentativa e impede saída ambígua', async () => {
  confirmPaymentUnapplication.mockRejectedValueOnce(new Error('timeout'));
  const { onCompleted, onClose } = setup();
  await advance();
  await userEvent.click(screen.getByRole('button', { name: 'Confirmar desfazimento' }));
  await screen.findByRole('button', { name: 'Verificar resultado' });
  expect(screen.getByRole('button', { name: 'Cancelar' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Voltar' })).toBeDisabled();
  await userEvent.keyboard('{Escape}');
  expect(onClose).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole('button', { name: 'Verificar resultado' }));
  await waitFor(() => expect(onCompleted).toHaveBeenCalledTimes(1));
  expect(confirmPaymentUnapplication.mock.calls[1]).toEqual(confirmPaymentUnapplication.mock.calls[0]);
});
test('resposta de outra cobrança não permite confirmação', async () => {
  previewPaymentUnapplication.mockResolvedValue({ data: { ...reviewed, charge_key: 'entry-99' } });
  setup();
  await userEvent.click(await screen.findByRole('radio', { name: /Recebimento #7/ }));
  await userEvent.type(screen.getByLabelText('Motivo do desfazimento'), 'Destino errado');
  await userEvent.click(screen.getByRole('button', { name: 'Conferir desfazimento' }));
  await screen.findByRole('alert');
  expect(screen.queryByRole('button', { name: 'Confirmar desfazimento' })).not.toBeInTheDocument();
  expect(confirmPaymentUnapplication).not.toHaveBeenCalled();
});
