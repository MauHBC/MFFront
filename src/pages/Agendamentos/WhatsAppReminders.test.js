import React from 'react';
import '@testing-library/jest-dom';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import WhatsAppReminders from './WhatsAppReminders';
import api from '../../services/axios';
import { useAuthorization } from '../../contexts/AuthorizationContext';
import { isLocalWhatsAppSimulation } from '../../config/whatsappSimulation';

jest.mock('../../services/axios', () => ({ get: jest.fn(), post: jest.fn() }));
jest.mock('../../contexts/AuthorizationContext', () => ({ useAuthorization: jest.fn() }));
jest.mock('../../config/whatsappSimulation', () => ({ isLocalWhatsAppSimulation: jest.fn() }));
const sessions = [{ id: 1, patient_id: 2, patient_name: 'Ana Costa', status: 'scheduled', starts_at: '2099-10-12T12:00:00Z' }];
let items;
let contacts;
beforeEach(() => {
  jest.clearAllMocks(); items = []; contacts = [{ session_id: 1, patient_id: 2, authorized: true }];
  isLocalWhatsAppSimulation.mockReturnValue(false);
  useAuthorization.mockReturnValue({ status: 'ready', context: { authorization_state: 'authorized' }, canAccessModule: () => true });
  api.get.mockImplementation(async (path) => {
    if (path === '/sessions') return { data: sessions };
    if (path === '/whatsapp/settings') return { data: { enabled: true, simulation: true, can_authorize_contact: true } };
    if (path === '/whatsapp/reminders') return { data: items };
    return { data: contacts };
  });
  api.post.mockResolvedValue({ data: { review_id: 'review-1', items: [{ id: 'item-1', patient_name: 'Ana Costa', phone: '5527999990001', starts_at: sessions[0].starts_at, text: 'Clínica Horizonte: lembrete do seu atendimento.' }] } });
});
test('revisão obrigatória antes da confirmação de envio', async () => {
  render(<WhatsAppReminders sessions={sessions} />);
  fireEvent.click(await screen.findByRole('button', { name: 'Lembretes WhatsApp' }));
  await screen.findByRole('checkbox', { name: 'Selecionar Ana Costa' });
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
  await screen.findByRole('checkbox', { name: 'Selecionar Ana Costa' });
  await screen.findByText(/Resultado incerto.*Sem resposta/);
  expect(screen.queryByRole('button', { name: 'Solicitar nova tentativa' })).not.toBeInTheDocument();
});
test('perfil de leitura acompanha sem selecionar ou enviar', async () => {
  useAuthorization.mockReturnValue({ status: 'ready', context: { authorization_state: 'authorized' }, canAccessModule: (key, level) => level !== 'manage' });
  render(<WhatsAppReminders sessions={sessions} />);
  fireEvent.click(await screen.findByRole('button', { name: 'Lembretes WhatsApp' }));
  await screen.findByRole('checkbox', { name: 'Selecionar Ana Costa' });
  expect(screen.getByRole('checkbox', { name: 'Selecionar Ana Costa' })).toBeDisabled();
  expect(screen.queryByRole('button', { name: /Revisar envio/ })).not.toBeInTheDocument();
});
test('mudança de clínica fecha o painel e descarta respostas pendentes', async () => {
  const view = render(<WhatsAppReminders sessions={sessions} />);
  fireEvent.click(await screen.findByRole('button', { name: 'Lembretes WhatsApp' }));
  await screen.findByRole('checkbox', { name: 'Selecionar Ana Costa' });
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
  await screen.findByRole('checkbox', { name: 'Selecionar Ana Costa' });
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
  await screen.findByRole('checkbox', { name: 'Selecionar Ana Costa' });
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
  await screen.findByRole('checkbox', { name: 'Selecionar Ana Costa' });
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
  await screen.findByRole('checkbox', { name: 'Selecionar Ana Costa' });
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
  await screen.findByRole('checkbox', { name: 'Selecionar Ana Costa' });
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
  await screen.findByRole('checkbox', { name: 'Selecionar Ana Costa' });
  await waitFor(() => expect(api.get).toHaveBeenCalledWith('/whatsapp/contact-authorizations', expect.anything()));
  const previousCalls = api.get.mock.calls.length;
  useAuthorization.mockReturnValue({ status: 'ready', context: {}, canAccessModule: () => false });
  view.rerender(<WhatsAppReminders sessions={sessions} />);
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(document.body.style.overflow).not.toBe('hidden');
  expect(api.get).toHaveBeenCalledTimes(previousCalls);
});

test('quatro envios distintos conservam histórico e mostram confirmação uma vez por atendimento', async () => {
  items = [1, 2, 3, 4].map((id) => ({ id: `send-${id}`, session_id: 1, created_at: `2099-10-10T12:0${id}:00Z`, status: 'delivered', confirmation: 'confirm', attempts: 1 }));
  render(<WhatsAppReminders sessions={sessions} />);
  fireEvent.click(await screen.findByRole('button', { name: 'Lembretes WhatsApp' }));
  const group = await screen.findByTestId('whatsapp-session-1');
  expect(screen.getAllByText(/Presença confirmada/)).toHaveLength(1);
  expect(within(group).getByText('Histórico de 4 lembrete(s)')).toBeInTheDocument();
  expect(within(group).getAllByText(/Lembrete [1-4] ·/)).toHaveLength(4);
});

test('não reúne atendimentos distintos do mesmo paciente na mesma data e horário', async () => {
  const samePatientSessions = [...sessions, { ...sessions[0], id: 3 }];
  const oldGet = api.get.getMockImplementation();
  api.get.mockImplementation((path, options) => path === '/sessions' ? Promise.resolve({ data: samePatientSessions }) : oldGet(path, options));
  items = [1, 3].map((id) => ({ id: `send-${id}`, session_id: id, status: 'delivered', confirmation: 'confirm' }));
  render(<WhatsAppReminders sessions={samePatientSessions} />);
  fireEvent.click(await screen.findByRole('button', { name: 'Lembretes WhatsApp' }));
  expect(await screen.findByTestId('whatsapp-session-1')).toBeInTheDocument();
  expect(screen.getByTestId('whatsapp-session-3')).toBeInTheDocument();
  expect(screen.getAllByText(/Presença confirmada/)).toHaveLength(2);
});

test('abre na data selecionada e consulta o dia inteiro sem depender da pesquisa da Agenda', async () => {
  render(<WhatsAppReminders sessions={[]} selectedDate="2099-10-12" />);
  fireEvent.click(await screen.findByRole('button', { name: 'Lembretes WhatsApp' }));
  expect(screen.getByLabelText('Data dos atendimentos')).toHaveValue('2099-10-12');
  expect(await screen.findByRole('checkbox', { name: 'Selecionar Ana Costa' })).toBeInTheDocument();
  expect(api.get).toHaveBeenCalledWith('/sessions', { params: { from: '2099-10-12', to: '2099-10-13' } });
});

test('troca de dia descarta resposta HTTP atrasada e não exibe lembrete de outra data', async () => {
  const tomorrowSession = { ...sessions[0], id: 3, patient_name: 'Bia Lima', starts_at: '2099-10-13T12:00:00Z' };
  let resolveOld;
  const oldGet = api.get.getMockImplementation();
  api.get.mockImplementation((path, options) => {
    if (path === '/sessions') return options.params.from === '2099-10-12'
      ? new Promise((resolve) => { resolveOld = resolve; }) : Promise.resolve({ data: [tomorrowSession] });
    if (path === '/whatsapp/reminders') return Promise.resolve({ data: [{ id: 'new', session_id: 3, status: 'delivered', confirmation: 'pending' }, { id: 'foreign-day', session_id: 1, status: 'accepted', confirmation: 'confirm' }] });
    return oldGet(path, options);
  });
  render(<WhatsAppReminders sessions={sessions} selectedDate="2099-10-12" />);
  fireEvent.click(await screen.findByRole('button', { name: 'Lembretes WhatsApp' }));
  await waitFor(() => expect(resolveOld).toEqual(expect.any(Function)));
  fireEvent.change(screen.getByLabelText('Data dos atendimentos'), { target: { value: '2099-10-13' } });
  await screen.findByRole('checkbox', { name: 'Selecionar Bia Lima' });
  await act(async () => resolveOld({ data: sessions }));
  expect(screen.queryByRole('checkbox', { name: 'Selecionar Ana Costa' })).not.toBeInTheDocument();
  expect(screen.queryByTestId('whatsapp-session-1')).not.toBeInTheDocument();
  expect(screen.getByTestId('whatsapp-session-3')).toBeInTheDocument();
});

test('fechar e reabrir invalida a carga anterior e preserva uma única instância do drawer', async () => {
  let resolveOld; let calls = 0;
  const oldGet = api.get.getMockImplementation();
  api.get.mockImplementation((path, options) => {
    if (path === '/sessions') {
      calls += 1;
      if (calls === 1) return new Promise((resolve) => { resolveOld = resolve; });
    }
    return oldGet(path, options);
  });
  render(<WhatsAppReminders sessions={sessions} />);
  const opener = await screen.findByRole('button', { name: 'Lembretes WhatsApp' });
  fireEvent.click(opener);
  await waitFor(() => expect(resolveOld).toEqual(expect.any(Function)));
  closeBy('X'); fireEvent.click(opener); fireEvent.click(opener);
  await screen.findByRole('checkbox', { name: 'Selecionar Ana Costa' });
  await act(async () => resolveOld({ data: [] }));
  expect(screen.getAllByRole('dialog', { name: 'Lembretes WhatsApp' })).toHaveLength(1);
  expect(screen.getByRole('checkbox', { name: 'Selecionar Ana Costa' })).toBeInTheDocument();
});

test('clique repetido durante revisão e confirmação gera um único comando de cada', async () => {
  render(<WhatsAppReminders sessions={sessions} />);
  fireEvent.click(await screen.findByRole('button', { name: 'Lembretes WhatsApp' }));
  fireEvent.click(await screen.findByRole('checkbox', { name: 'Selecionar Ana Costa' }));
  let finishReview; let finishConfirm;
  api.post.mockImplementation((path) => new Promise((resolve) => {
    if (path === '/whatsapp/reviews') finishReview = resolve; else finishConfirm = resolve;
  }));
  const reviewButton = screen.getByRole('button', { name: /Revisar envio/ });
  act(() => { fireEvent.click(reviewButton); fireEvent.click(reviewButton); });
  expect(api.post).toHaveBeenCalledTimes(1);
  await act(async () => finishReview({ data: { review_id: 'one-review', items: [{ id: 'one', patient_name: 'Ana Costa', starts_at: sessions[0].starts_at, text: 'Mensagem revisada' }] } }));
  const confirmButton = screen.getByRole('button', { name: /Confirmar envio/ });
  act(() => { fireEvent.click(confirmButton); fireEvent.click(confirmButton); });
  expect(api.post.mock.calls.filter(([path]) => path === '/whatsapp/confirm')).toHaveLength(1);
  await act(async () => finishConfirm({ data: { queued: true } }));
  expect(screen.queryByText('Mensagem revisada')).not.toBeInTheDocument();
});

test('mudança de data protege seleção pendente e só descarta após decisão explícita', async () => {
  render(<WhatsAppReminders sessions={sessions} />);
  fireEvent.click(await screen.findByRole('button', { name: 'Lembretes WhatsApp' }));
  fireEvent.click(await screen.findByRole('checkbox', { name: 'Selecionar Ana Costa' }));
  fireEvent.change(screen.getByLabelText('Data dos atendimentos'), { target: { value: '2099-10-13' } });
  fireEvent.click(screen.getByRole('button', { name: 'Continuar editando' }));
  expect(screen.getByLabelText('Data dos atendimentos')).toHaveValue('2099-10-12');
  expect(screen.getByRole('checkbox', { name: 'Selecionar Ana Costa' })).toBeChecked();
  fireEvent.change(screen.getByLabelText('Data dos atendimentos'), { target: { value: '2099-10-13' } });
  fireEvent.click(screen.getByRole('button', { name: 'Descartar alterações' }));
  await waitFor(() => expect(screen.getByLabelText('Data dos atendimentos')).toHaveValue('2099-10-13'));
  expect(screen.queryByRole('checkbox', { name: 'Selecionar Ana Costa' })).not.toBeInTheDocument();
  expect(api.post).not.toHaveBeenCalled();
});

test('Hoje e Amanhã usam a data civil da Agenda e mostram vazio com contexto', async () => {
  const oldGet = api.get.getMockImplementation();
  api.get.mockImplementation((path, options) => path === '/sessions' ? Promise.resolve({ data: [] }) : oldGet(path, options));
  render(<WhatsAppReminders sessions={sessions} />);
  fireEvent.click(await screen.findByRole('button', { name: 'Lembretes WhatsApp' }));
  fireEvent.click(screen.getByRole('button', { name: 'Hoje' }));
  const today = screen.getByLabelText('Data dos atendimentos').value;
  fireEvent.click(screen.getByRole('button', { name: 'Amanhã' }));
  const tomorrow = screen.getByLabelText('Data dos atendimentos').value;
  expect(new Date(`${tomorrow}T12:00Z`).getTime() - new Date(`${today}T12:00Z`).getTime()).toBe(86400000);
  expect(await screen.findByText(/Nenhum lembrete enviado em/)).toBeInTheDocument();
  expect(screen.queryByText(/Carregando lembretes/)).not.toBeInTheDocument();
});

test('falha de carga mantém o dia visível e oferece nova tentativa sem enviar', async () => {
  const oldGet = api.get.getMockImplementation(); let fail = true;
  api.get.mockImplementation((path, options) => path === '/sessions' && fail ? Promise.reject(new Error('offline')) : oldGet(path, options));
  render(<WhatsAppReminders sessions={sessions} />);
  fireEvent.click(await screen.findByRole('button', { name: 'Lembretes WhatsApp' }));
  await screen.findByText('Não foi possível atualizar os lembretes desta data.');
  expect(screen.getByLabelText('Data dos atendimentos')).toHaveValue('2099-10-12');
  fail = false; fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }));
  await screen.findByRole('checkbox', { name: 'Selecionar Ana Costa' });
  expect(api.post).not.toHaveBeenCalled();
});

test('poll de status atualiza o mesmo resumo sem acumular linhas', async () => {
  jest.useFakeTimers();
  try {
    items = [{ id: 'one', session_id: 1, status: 'accepted', confirmation: 'pending' }];
    render(<WhatsAppReminders sessions={sessions} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Lembretes WhatsApp' }));
    await screen.findByTestId('whatsapp-session-1');
    items = [{ id: 'one', session_id: 1, status: 'delivered', confirmation: 'confirm' }];
    await act(async () => jest.advanceTimersByTime(3000));
    expect(screen.getAllByTestId('whatsapp-session-1')).toHaveLength(1);
    expect(screen.getAllByText(/Presença confirmada/)).toHaveLength(1);
  } finally { jest.useRealTimers(); }
});

test.each([
  [false, true, true], [true, false, true], [true, true, false],
])('ferramentas de simulação exigem prévia local, administrador e modo simulado (%s %s %s)', async (local, administrator, simulation) => {
  isLocalWhatsAppSimulation.mockReturnValue(local);
  useAuthorization.mockReturnValue({ status: 'ready', isAdministrator: administrator, context: {}, canAccessModule: () => true });
  const oldGet = api.get.getMockImplementation();
  api.get.mockImplementation((path, options) => path === '/whatsapp/settings' ? Promise.resolve({ data: { enabled: true, simulation } }) : oldGet(path, options));
  items = [{ id: 'one', session_id: 1, status: 'delivered', confirmation: 'confirm' }];
  render(<WhatsAppReminders sessions={sessions} />);
  fireEvent.click(await screen.findByRole('button', { name: 'Lembretes WhatsApp' }));
  await screen.findByTestId('whatsapp-session-1');
  expect(screen.queryByText('Simular resposta')).not.toBeInTheDocument();
});

test('administrador simula evento do lembrete específico sem duplicar comando ou mudar sessão', async () => {
  isLocalWhatsAppSimulation.mockReturnValue(true);
  useAuthorization.mockReturnValue({ status: 'ready', isAdministrator: true, context: {}, canAccessModule: () => true });
  items = [{ id: 'one', session_id: 1, status: 'delivered', confirmation: 'pending' }];
  render(<WhatsAppReminders sessions={sessions} />);
  fireEvent.click(await screen.findByRole('button', { name: 'Lembretes WhatsApp' }));
  await screen.findByText('Simular resposta');
  fireEvent.change(screen.getByLabelText('Evento'), { target: { value: 'unavailable' } });
  let finish;
  api.post.mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
  const button = screen.getByRole('button', { name: 'Aplicar simulação', hidden: true });
  act(() => { fireEvent.click(button); fireEvent.click(button); });
  expect(api.post.mock.calls).toEqual([['/whatsapp/simulation', { action: 'event', id: 'one', kind: 'unavailable' }]]);
  await act(async () => finish({ data: { processed: true } }));
});

test('Tab inclui histórico recolhido e ignora controles escondidos em details fechados', async () => {
  isLocalWhatsAppSimulation.mockReturnValue(true);
  useAuthorization.mockReturnValue({ status: 'ready', isAdministrator: true, context: {}, canAccessModule: () => true });
  items = [{ id: 'one', session_id: 1, status: 'delivered', confirmation: 'confirm' }];
  render(<WhatsAppReminders sessions={sessions} />);
  fireEvent.click(await screen.findByRole('button', { name: 'Lembretes WhatsApp' }));
  const summary = await screen.findByText('Histórico de 1 lembrete(s)');
  const close = screen.getByRole('button', { name: 'Fechar lembretes WhatsApp' });
  close.focus(); fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
  expect(summary).toHaveFocus();
  fireEvent.keyDown(document, { key: 'Tab' });
  expect(close).toHaveFocus();
  const details = summary.parentElement;
  details.open = true; fireEvent(details, new Event('toggle'));
  close.focus(); fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
  expect(screen.getByText('Simular resposta')).toHaveFocus();
  fireEvent.keyDown(document, { key: 'Tab' });
  expect(close).toHaveFocus();
});
