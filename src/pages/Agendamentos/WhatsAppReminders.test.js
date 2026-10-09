import React from 'react';
import '@testing-library/jest-dom';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import WhatsAppReminders from './WhatsAppReminders';
import api from '../../services/axios';
import { useAuthorization } from '../../contexts/AuthorizationContext';

jest.mock('../../services/axios', () => ({ get: jest.fn(), post: jest.fn() }));
jest.mock('../../contexts/AuthorizationContext', () => ({ useAuthorization: jest.fn() }));
const sessions = [{ id: 1, patient_id: 2, patient_name: 'Ana Costa', status: 'scheduled', starts_at: '2099-10-12T12:00:00Z' }];
let items;
let contacts;
beforeEach(() => {
  jest.clearAllMocks(); items = []; contacts = [{ session_id: 1, patient_id: 2, authorized: true }];
  useAuthorization.mockReturnValue({ status: 'ready', context: { authorization_state: 'authorized' }, canAccessModule: () => true });
  api.get.mockImplementation(async (path) => {
    if (path === '/whatsapp/settings') return { data: { enabled: true, simulation: true, can_authorize_contact: true } };
    if (path === '/whatsapp/reminders') return { data: items };
    return { data: contacts };
  });
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

const closeBy = (action) => {
  if (action === 'X') fireEvent.click(screen.getByRole('button', { name: 'Fechar lembretes WhatsApp' }));
  else if (action === 'fundo') fireEvent.click(screen.getByTestId('whatsapp-drawer-backdrop'));
  else fireEvent.keyDown(document, { key: 'Escape' });
};

test.each(['X', 'fundo', 'Escape'])('fecha painel limpo por %s e restaura foco/scroll', async (action) => {
  document.body.style.overflow = 'auto';
  render(<WhatsAppReminders sessions={sessions} />);
  const opener = await screen.findByRole('button', { name: 'Lembretes WhatsApp' });
  opener.focus(); fireEvent.click(opener);
  expect(screen.getByRole('button', { name: 'Fechar lembretes WhatsApp' })).toHaveFocus();
  expect(document.body.style.overflow).toBe('hidden');
  expect(screen.queryByRole('button', { name: 'Voltar à Agenda' })).not.toBeInTheDocument();
  closeBy(action);
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(opener).toHaveFocus();
  expect(document.body.style.overflow).toBe('auto');
  expect(api.post).not.toHaveBeenCalled();
});

test.each(['X', 'fundo', 'Escape'])('protege seleção pendente ao fechar por %s', async (action) => {
  render(<WhatsAppReminders sessions={sessions} />);
  fireEvent.click(await screen.findByRole('button', { name: 'Lembretes WhatsApp' }));
  fireEvent.click(screen.getByRole('checkbox', { name: 'Selecionar Ana Costa' }));
  closeBy(action);
  expect(screen.getByRole('dialog', { name: 'Alterações não salvas' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Continuar editando' }));
  expect(screen.getByRole('checkbox', { name: 'Selecionar Ana Costa' })).toBeChecked();
  closeBy(action);
  fireEvent.click(screen.getByRole('button', { name: 'Descartar alterações' }));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(api.post).not.toHaveBeenCalled();
});

test.each(['X', 'fundo', 'Escape'])('não fecha enquanto a operação está em curso por %s', async (action) => {
  let finishReview;
  api.post.mockImplementation(() => new Promise((resolve) => { finishReview = resolve; }));
  render(<WhatsAppReminders sessions={sessions} />);
  fireEvent.click(await screen.findByRole('button', { name: 'Lembretes WhatsApp' }));
  fireEvent.click(screen.getByRole('checkbox', { name: 'Selecionar Ana Costa' }));
  fireEvent.click(screen.getByRole('button', { name: /Revisar envio/ }));
  expect(screen.getByRole('button', { name: 'Fechar lembretes WhatsApp' })).toBeDisabled();
  closeBy(action);
  expect(screen.getByRole('dialog', { name: 'Lembretes WhatsApp' })).toBeInTheDocument();
  expect(screen.queryByRole('dialog', { name: 'Alterações não salvas' })).not.toBeInTheDocument();
  await act(async () => finishReview({ data: { review_id: 'pending', items: [] } }));
  expect(api.post).toHaveBeenCalledTimes(1);
});

test('Tab permanece no painel e Escape da confirmação mantém a edição', async () => {
  render(<WhatsAppReminders sessions={sessions} />);
  fireEvent.click(await screen.findByRole('button', { name: 'Lembretes WhatsApp' }));
  const close = screen.getByRole('button', { name: 'Fechar lembretes WhatsApp' });
  fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
  expect(screen.getByRole('checkbox', { name: 'Selecionar Ana Costa' })).toHaveFocus();
  fireEvent.keyDown(document, { key: 'Tab' });
  expect(close).toHaveFocus();
  fireEvent.click(screen.getByRole('checkbox', { name: 'Selecionar Ana Costa' }));
  closeBy('X');
  expect(screen.getByRole('button', { name: 'Continuar editando' })).toHaveFocus();
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(screen.queryByRole('dialog', { name: 'Alterações não salvas' })).not.toBeInTheDocument();
  expect(screen.getByRole('checkbox', { name: 'Selecionar Ana Costa' })).toBeChecked();
});

test('protege edição da autorização de contato sem perder referência', async () => {
  contacts = [{ session_id: 1, patient_id: 2, authorized: false }];
  render(<WhatsAppReminders sessions={sessions} />);
  fireEvent.click(await screen.findByRole('button', { name: 'Lembretes WhatsApp' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Autorizar contato' }));
  fireEvent.change(screen.getByLabelText('Referência da autorização'), { target: { value: 'registro:teste' } });
  closeBy('fundo');
  fireEvent.click(screen.getByRole('button', { name: 'Continuar editando' }));
  expect(screen.getByLabelText('Referência da autorização')).toHaveValue('registro:teste');
  fireEvent.click(screen.getByRole('button', { name: 'Voltar', exact: true }));
  fireEvent.click(screen.getByRole('button', { name: 'Descartar alterações' }));
  expect(screen.queryByLabelText('Referência da autorização')).not.toBeInTheDocument();
  expect(screen.getByRole('dialog', { name: 'Lembretes WhatsApp' })).toBeInTheDocument();
  expect(api.post).not.toHaveBeenCalled();
});

test('revogação do acesso desmonta painel e libera scroll sem consultar novamente', async () => {
  const view = render(<WhatsAppReminders sessions={sessions} />);
  fireEvent.click(await screen.findByRole('button', { name: 'Lembretes WhatsApp' }));
  await waitFor(() => expect(api.get).toHaveBeenCalledWith('/whatsapp/contact-authorizations', expect.anything()));
  const previousCalls = api.get.mock.calls.length;
  useAuthorization.mockReturnValue({ status: 'ready', context: {}, canAccessModule: () => false });
  view.rerender(<WhatsAppReminders sessions={sessions} />);
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(document.body.style.overflow).not.toBe('hidden');
  expect(api.get).toHaveBeenCalledTimes(previousCalls);
});
