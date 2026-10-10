import React from 'react';
import '@testing-library/jest-dom';
import { act, fireEvent, render, screen } from '@testing-library/react';
import api from '../../services/axios';
import WhatsAppReminderHistory from './WhatsAppReminderHistory';

jest.mock('../../services/axios', () => ({ get: jest.fn() }));
beforeEach(() => jest.clearAllMocks());
const openHistory = (container) => fireEvent(container.querySelector('details'), new Event('toggle'));

test('histórico só consulta eventos do lembrete expandido e preserva eventos iguais', async () => {
  api.get.mockResolvedValue({ data: [
    { kind: 'confirm', occurred_at: '2099-10-12T12:00Z', received_at: '2099-10-12T12:00Z', disposition: 'obsolete' },
    { kind: 'confirm', occurred_at: '2099-10-12T12:00Z', received_at: '2099-10-12T12:00Z', disposition: 'obsolete' },
  ] });
  const { container } = render(<WhatsAppReminderHistory id="specific-reminder" authorizationContext={{}} />);
  expect(api.get).not.toHaveBeenCalled();
  container.querySelector('details').open = true; openHistory(container);
  expect(await screen.findAllByText(/Confirmação de presença/)).toHaveLength(2);
  expect(api.get).toHaveBeenCalledWith('/whatsapp/reminder-history', { params: { id: 'specific-reminder' } });
  expect(screen.getAllByText(/sem alterar a confirmação vigente/)).toHaveLength(2);
});

test('resposta histórica atrasada é descartada ao desmontar o detalhe', async () => {
  let finish;
  api.get.mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
  const view = render(<WhatsAppReminderHistory id="one" authorizationContext={{}} />);
  view.container.querySelector('details').open = true; openHistory(view.container);
  expect(api.get).toHaveBeenCalledTimes(1);
  view.unmount();
  await act(async () => finish({ data: [{ kind: 'confirm' }] }));
  expect(screen.queryByText(/Confirmação de presença/)).not.toBeInTheDocument();
});

test('erro de histórico oferece nova consulta sem comandos de envio', async () => {
  api.get.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({ data: [] });
  const { container } = render(<WhatsAppReminderHistory id="one" authorizationContext={{}} />);
  container.querySelector('details').open = true; openHistory(container);
  await screen.findByText('Não foi possível carregar o histórico.');
  fireEvent.click(screen.getByRole('button', { name: 'Atualizar histórico' }));
  expect(await screen.findByText('Nenhum evento recebido.')).toBeInTheDocument();
  expect(api.get).toHaveBeenCalledTimes(2);
});
