import React from 'react';
import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import WhatsAppReminders from './WhatsAppReminders';
import api from '../../services/axios';
import { useAuthorization } from '../../contexts/AuthorizationContext';

jest.mock('../../services/axios', () => ({ get: jest.fn(), post: jest.fn() }));
jest.mock('../../contexts/AuthorizationContext', () => ({ useAuthorization: jest.fn() }));
const sessions = [{ id: 1, patient_id: 2, patient_name: 'Ana Costa', status: 'scheduled', starts_at: '2099-10-12T12:00:00Z' }];
let items;
beforeEach(() => {
  jest.clearAllMocks(); items = [];
  useAuthorization.mockReturnValue({ status: 'ready', context: { authorization_state: 'authorized' }, canAccessModule: () => true });
  api.get.mockImplementation(async (path) => ({ data: path === '/whatsapp/settings'
    ? { enabled: true, can_authorize_contact: true }
    : path === '/whatsapp/reminders' ? items : [{ session_id: 1, patient_id: 2, authorized: true }] }));
  api.post.mockResolvedValue({ data: { review_id: 'review-1', items: [{ id: 'item-1', patient_name: 'Ana Costa', phone: '5527999990001', starts_at: sessions[0].starts_at, text: 'Clínica Horizonte: lembrete do seu atendimento.' }] } });
});
test('revisão obrigatória antes da confirmação de envio', async () => {
  render(<WhatsAppReminders sessions={sessions} />);
  fireEvent.click(await screen.findByRole('button', { name: 'Lembretes WhatsApp' }));
  fireEvent.click(screen.getByRole('checkbox', { name: 'Selecionar Ana Costa' }));
  fireEvent.click(screen.getByRole('button', { name: /Revisar envio/ }));
  await screen.findByText('Clínica Horizonte: lembrete do seu atendimento.');
  expect(api.post.mock.calls).toEqual([['/whatsapp/reviews', { session_ids: [1] }]]);
  fireEvent.click(screen.getByRole('button', { name: /Confirmar envio/ }));
  await waitFor(() => expect(api.post).toHaveBeenCalledWith('/whatsapp/confirm', { review_id: 'review-1' }));
});
test('resultado incerto não disponibiliza retentativa', async () => {
  items = [{ id: 'unknown-1', session_id: 1, status: 'unknown', confirmation: 'pending', follow_up: true }];
  render(<WhatsAppReminders sessions={sessions} />);
  fireEvent.click(await screen.findByRole('button', { name: 'Lembretes WhatsApp' }));
  await screen.findByText(/Resultado incerto/);
  expect(screen.queryByRole('button', { name: 'Solicitar nova tentativa' })).not.toBeInTheDocument();
});
test('perfil de leitura acompanha sem selecionar ou enviar', async () => {
  useAuthorization.mockReturnValue({ status: 'ready', context: { authorization_state: 'authorized' }, canAccessModule: (key, level) => level !== 'manage' });
  render(<WhatsAppReminders sessions={sessions} />);
  fireEvent.click(await screen.findByRole('button', { name: 'Lembretes WhatsApp' }));
  expect(screen.getByRole('checkbox', { name: 'Selecionar Ana Costa' })).toBeDisabled();
  expect(screen.queryByRole('button', { name: /Revisar envio/ })).not.toBeInTheDocument();
});
test('mudança de clínica fecha o painel e descarta respostas pendentes', async () => {
  const view = render(<WhatsAppReminders sessions={sessions} />);
  fireEvent.click(await screen.findByRole('button', { name: 'Lembretes WhatsApp' }));
  let resolveReview;
  api.post.mockImplementation(() => new Promise((resolve) => { resolveReview = resolve; }));
  fireEvent.click(screen.getByRole('checkbox', { name: 'Selecionar Ana Costa' }));
  fireEvent.click(screen.getByRole('button', { name: /Revisar envio/ }));
  useAuthorization.mockReturnValue({ status: 'ready', context: { authorization_state: 'authorized' }, canAccessModule: () => true });
  view.rerender(<WhatsAppReminders sessions={[]} />);
  resolveReview({ data: { items: [{ id: 'old', text: 'Dados da clínica anterior' }] } });
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect(screen.queryByText('Dados da clínica anterior')).not.toBeInTheDocument();
});

test('módulo indisponível não mostra botão nem consulta endpoints', async () => {
  useAuthorization.mockReturnValue({ status: 'ready', context: {}, canAccessModule: (key) => key !== 'whatsapp' });
  render(<WhatsAppReminders sessions={sessions} />);
  await Promise.resolve();
  expect(screen.queryByRole('button', { name: 'Lembretes WhatsApp' })).not.toBeInTheDocument();
  expect(api.get).not.toHaveBeenCalled();
});

test('entrada do módulo abre o painel integrado depois de validar disponibilidade', async () => {
  render(<WhatsAppReminders sessions={sessions} autoOpen />);
  expect(await screen.findByRole('dialog', { name: 'Lembretes WhatsApp' })).toBeInTheDocument();
});
