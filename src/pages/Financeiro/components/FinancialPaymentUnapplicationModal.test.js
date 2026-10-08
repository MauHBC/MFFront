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
const selected = { operation_key: 'receipt:7', label: 'Recebimento', kind: 'receipt', reference: 'Rec. 01', occurred_at: '2026-09-28T12:00:00Z', payment_method_name: 'Pix', original_amount_cents: 9000, amount_cents: 9000, eligible: true, blockers: [] };
const reviewed = { ...query, operation_key: selected.operation_key, eligible: true, amount_cents: 9000, discount_cents: 1000, surcharge_cents: 0, credit_before_cents: 0, credit_after_cents: 9000, preview_fingerprint: 'snapshot' };
const setup = () => {
  const onCompleted = jest.fn(); const onClose = jest.fn();
  render(<Modal target={{ query, patientName: 'Paciente sintético', chargeName: 'Avulsa' }} formatCurrency={(value) => `R$ ${value / 100}`} onCompleted={onCompleted} onClose={onClose} />);
  return { onCompleted, onClose };
};
const advance = async () => {
  await userEvent.click(await screen.findByRole('radio', { name: /Rec. 01/ }));
  await userEvent.type(screen.getByLabelText('Motivo'), 'Destino errado');
  await userEvent.click(screen.getByRole('button', { name: 'Avançar' }));
  await screen.findByRole('button', { name: 'Confirmar' });
};
beforeEach(() => {
  jest.clearAllMocks();
  listPaymentUnapplications.mockResolvedValue({ data: { ...query, operations: [selected, { ...selected, operation_key: 'receipt:8', label: 'Recebimento #8', eligible: false, blockers: ['Origem sem rastreio seguro'] }] } });
  previewPaymentUnapplication.mockResolvedValue({ data: reviewed });
  confirmPaymentUnapplication.mockResolvedValue({ data: { ...reviewed, id: 2 } });
});
test('seleciona baixa rastreável, omite inelegíveis e restaura somente dinheiro', async () => {
  const { onCompleted } = setup();
  await screen.findByRole('radio', { name: /Rec. 01/ });
  expect(screen.queryByText('Origem sem rastreio seguro')).not.toBeInTheDocument();
  expect(screen.getAllByRole('radio')).toHaveLength(1);
  await advance();
  expect(previewPaymentUnapplication).toHaveBeenCalledWith({ ...query, operation_key: 'receipt:7', reason: 'Destino errado' });
  expect(screen.getByText(/^Selecionado:/)).toHaveTextContent(/Recebimento.*R\$ 90.*Pix.*Rec\. 01/);
  expect(screen.getByText(/Crédito a restaurar/)).toHaveTextContent('R$ 90');
  expect(screen.queryByText(/Crédito disponível após confirmar/)).not.toBeInTheDocument();
  expect(screen.queryByText(/Desconto a desfazer/)).not.toBeInTheDocument();
  expect(screen.queryByText(/Não haverá devolução/)).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Confirmar' }));
  await waitFor(() => expect(onCompleted).toHaveBeenCalledTimes(1));
});
test('uso de crédito omite origem redundante na seleção e na confirmação', async () => {
  const credit = { ...selected, operation_key: 'credit:9', kind: 'credit', reference: 'Créd. 01', payment_method_name: 'Crédito disponível' };
  listPaymentUnapplications.mockResolvedValue({ data: { ...query, operations: [credit] } });
  previewPaymentUnapplication.mockResolvedValue({ data: { ...reviewed, operation_key: credit.operation_key } });
  setup();
  const option = await screen.findByRole('radio', { name: /Uso de crédito.*Créd\. 01/ });
  expect(option).not.toHaveAccessibleName(/Crédito disponível/);
  await userEvent.click(option);
  await userEvent.type(screen.getByLabelText('Motivo'), 'Destino errado');
  await userEvent.click(screen.getByRole('button', { name: 'Avançar' }));
  await screen.findByRole('button', { name: 'Confirmar' });
  expect(screen.getByText(/^Selecionado:/)).toHaveTextContent(/Uso de crédito.*R\$ 90.*Créd\. 01/);
  expect(screen.getByText(/^Selecionado:/)).not.toHaveTextContent('Crédito disponível');
  expect(screen.getByText(/Crédito a restaurar/)).toHaveTextContent('R$ 90');
  expect(confirmPaymentUnapplication).not.toHaveBeenCalled();
});
test('timeout mantém corpo e chave da mesma tentativa e impede saída ambígua', async () => {
  confirmPaymentUnapplication.mockRejectedValueOnce(new Error('timeout'));
  const { onCompleted, onClose } = setup();
  await advance();
  await userEvent.click(screen.getByRole('button', { name: 'Confirmar' }));
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
  await userEvent.click(await screen.findByRole('radio', { name: /Rec. 01/ }));
  await userEvent.type(screen.getByLabelText('Motivo'), 'Destino errado');
  await userEvent.click(screen.getByRole('button', { name: 'Avançar' }));
  await screen.findByRole('alert');
  expect(screen.queryByRole('button', { name: 'Confirmar' })).not.toBeInTheDocument();
  expect(confirmPaymentUnapplication).not.toHaveBeenCalled();
});

test('abertura repetida sem operações elegíveis não oferece baixas já desfeitas', async () => {
  listPaymentUnapplications.mockResolvedValue({ data: { ...query, operations: [{ ...selected, eligible: false, blockers: ['Já desfeita'] }] } });
  setup();
  expect(await screen.findByText('Nenhum pagamento disponível para desfazer nesta cobrança.')).toBeVisible();
  expect(screen.queryByRole('radio')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Avançar' })).toBeDisabled();
});
