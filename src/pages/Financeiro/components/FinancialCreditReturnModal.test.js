import React from 'react';
import '@testing-library/jest-dom';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import FinancialCreditReturnModal from './FinancialCreditReturnModal';
import { previewCreditReturn, confirmCreditReturn } from '../../../services/financialCreditReturn';

jest.mock('../../../services/financialCreditReturn', () => ({ previewCreditReturn: jest.fn(), confirmCreditReturn: jest.fn() }));
jest.mock('../../../services/axios', () => ({ getUserFacingApiError: (_, fallback) => fallback }));
const target = { patientId: 30, patientName: 'Paciente sintético', creditAvailableCents: 10000 };
const currency = (value) => `R$ ${(value / 100).toFixed(2).replace('.', ',')}`;
const proposed = (amount) => ({ patient: { id: 30, full_name: 'Paciente sintético' }, amount_cents: amount, reason: 'Solicitação sintética', credit_before_cents: 10000, credit_after_cents: 10000 - amount, preview_fingerprint: 'a'.repeat(64) });
const prepare = async (amount = '25,00') => {
  fireEvent.change(screen.getByLabelText('Valor da devolução'), { target: { value: amount } });
  fireEvent.change(screen.getByLabelText('Motivo obrigatório'), { target: { value: 'Solicitação sintética' } });
  fireEvent.click(screen.getByText('Avançar'));
  await screen.findByText('Confirmar');
};
beforeEach(() => { jest.clearAllMocks(); previewCreditReturn.mockImplementation((body) => Promise.resolve({ data: proposed(body.amount_cents) })); });
test('partial confirmation identifies patient, money and remaining balance', async () => {
  const completed = jest.fn(); confirmCreditReturn.mockResolvedValue({ data: { ...proposed(2500), id: 1 } });
  render(<FinancialCreditReturnModal target={target} formatCurrency={currency} onClose={jest.fn()} onCompleted={completed} />);
  expect(screen.getByRole('heading', { name: 'Devolver valor' })).toBeInTheDocument();
  expect(screen.getAllByText('Esse valor será descontado do crédito do paciente. A devolução do dinheiro deve ser feita por fora do sistema.')).toHaveLength(1);
  expect(screen.getByText('Avançar')).toBeDisabled();
  await prepare(); expect(screen.getByText('R$ 75,00')).toBeInTheDocument();
  expect(screen.getAllByText('Esse valor será descontado do crédito do paciente. A devolução do dinheiro deve ser feita por fora do sistema.')).toHaveLength(1);
  fireEvent.click(screen.getByText('Confirmar'));
  await waitFor(() => expect(completed).toHaveBeenCalledTimes(1));
  expect(confirmCreditReturn.mock.calls[0][0]).toMatchObject({ patient_id: 30, amount_cents: 2500, reason: 'Solicitação sintética' });
});
test('full balance, invalid amount and missing reason', async () => {
  render(<FinancialCreditReturnModal target={target} formatCurrency={currency} onClose={jest.fn()} onCompleted={jest.fn()} />);
  fireEvent.click(screen.getByText('Usar saldo total'));
  expect(screen.getByText('Avançar')).toBeDisabled();
  fireEvent.change(screen.getByLabelText('Motivo obrigatório'), { target: { value: 'Solicitação sintética' } });
  fireEvent.click(screen.getByText('Avançar'));
  await screen.findByText('Confirmar'); expect(screen.getByText('R$ 0,00')).toBeInTheDocument();
  fireEvent.click(screen.getByText('Editar'));
  fireEvent.change(screen.getByLabelText('Valor da devolução'), { target: { value: '101,00' } });
  expect(screen.getByText('Avançar')).toBeDisabled();
});
test('double click guarded and unknown response retries same body and key', async () => {
  let reject; confirmCreditReturn.mockImplementationOnce(() => new Promise((_, failure) => { reject = failure; }));
  confirmCreditReturn.mockResolvedValueOnce({ data: { ...proposed(2500), id: 1 } });
  render(<FinancialCreditReturnModal target={target} formatCurrency={currency} onClose={jest.fn()} onCompleted={jest.fn()} />);
  await prepare(); const button = screen.getByText('Confirmar');
  fireEvent.click(button); fireEvent.click(button); expect(confirmCreditReturn).toHaveBeenCalledTimes(1);
  await act(async () => reject(new Error('Network interrupted')));
  fireEvent.click(await screen.findByText('Tentar novamente'));
  await waitFor(() => expect(confirmCreditReturn).toHaveBeenCalledTimes(2));
  expect(confirmCreditReturn.mock.calls[1]).toEqual(confirmCreditReturn.mock.calls[0]);
});
test('stale response requires fresh preview and no silent confirmation', async () => {
  confirmCreditReturn.mockRejectedValue({ response: { status: 409 } });
  render(<FinancialCreditReturnModal target={target} formatCurrency={currency} onClose={jest.fn()} onCompleted={jest.fn()} />);
  await prepare(); fireEvent.click(screen.getByText('Confirmar'));
  await screen.findByText('Avançar'); expect(screen.queryByText('Confirmar')).not.toBeInTheDocument();
  expect(confirmCreditReturn).toHaveBeenCalledTimes(1);
});
