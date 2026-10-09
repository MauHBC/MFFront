import React from 'react';
import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import WhatsAppSimulation from './WhatsAppSimulation';

const fixture = {
  csrf: 'fictitious', items: [], control: { enabled: true, attempts: 0, contactAuthorized: true },
  appointments: [{ id: 1, name: 'Ana fictícia', startsAt: '2026-10-12T12:00:00Z', status: 'scheduled' }],
};
beforeEach(() => {
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => fixture });
});
afterEach(() => { jest.restoreAllMocks(); });

test('aviso de simulação e revisão obrigatória antes do comando', async () => {
  render(<WhatsAppSimulation />);
  expect(screen.getByText('Simulação — nenhuma mensagem será enviada')).toBeInTheDocument();
  await screen.findByText('Ana fictícia');
  const review = screen.getByRole('button', { name: /Revisar/ });
  expect(review).toBeDisabled();
  fireEvent.click(screen.getByRole('checkbox'));
  global.fetch.mockResolvedValueOnce({ ok: true, json: async () => ({
    token: 'review', items: [{ sessionId: 1, text: 'Lembrete fictício' }],
  }) });
  fireEvent.click(review);
  await screen.findByText('Revise antes de confirmar');
  const posts = global.fetch.mock.calls.filter(([, options]) => options?.method === 'POST');
  expect(posts).toHaveLength(1);
  expect(JSON.parse(posts[0][1].body)).toEqual({ action: 'review', ids: [1] });
  expect(posts[0][1].headers['X-Simulation-CSRF']).toBe('fictitious');
});

test('resultado desconhecido não apresenta ação de reenviar', async () => {
  global.fetch.mockResolvedValue({ ok: true, json: async () => ({ ...fixture,
    items: [{ id: '1', sessionId: 1, status: 'unknown', confirmation: 'pending', attempts: 1 }],
  }) });
  render(<WhatsAppSimulation />);
  await screen.findByText('Resultado desconhecido — não reenviar');
  expect(screen.queryByRole('button', { name: 'Simular aceitação' })).not.toBeInTheDocument();
});
