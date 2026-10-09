import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/axios';
import { useAuthorization } from '../../contexts/AuthorizationContext';
import AppShell from '../../components/AppShell';
import { whatsappLabels } from './WhatsAppReminders';

export default function WhatsAppScenarioTools() {
  const authorization = useAuthorization();
  const {context} = authorization;
  const activeContext = useRef(context);
  activeContext.current = context;
  const [items, setItems] = useState([]);
  const [result, setResult] = useState('');
  const [busy, setBusy] = useState(false);
  const load = async () => {
    const requestedContext = context;
    const { data } = await api.get('/whatsapp/reminders');
    if (activeContext.current === requestedContext) setItems(Array.isArray(data) ? data : []);
  };
  useEffect(() => {
    setItems([]); setResult(''); setBusy(false);
    if (authorization.isAdministrator) load().catch(() => {});
  }, [authorization.isAdministrator, context]); // eslint-disable-line react-hooks/exhaustive-deps
  const command = async (body) => {
    const requestedContext = context;
    setBusy(true); setResult('');
    try {
      await api.post('/whatsapp/simulation', body);
      if (activeContext.current !== requestedContext) return;
      await load();
      if (activeContext.current === requestedContext) setResult('Cenário aplicado. Volte à Agenda para conferir.');
    } catch { if (activeContext.current === requestedContext) setResult('Não foi possível aplicar este cenário.'); }
    finally { if (activeContext.current === requestedContext) setBusy(false); }
  };
  return <AppShell pageTitle="Ferramentas de validação">
    <main style={{ padding: 32, maxWidth: 1000, margin: 'auto' }}>
      <Link to="/agendamentos">Voltar à Agenda</Link>
      <h1>Cenários WhatsApp</h1>
      {!authorization.isAdministrator ? <p>Acesso restrito ao administrador.</p> : <>
        <p>Configure o resultado da próxima tentativa antes de confirmar um novo envio na Agenda.</p>
        <button type="button" disabled={busy} onClick={() => command({ action: 'next_outcome', outcome: 'accepted' })}>Próxima tentativa: enviada</button>{' '}
        <button type="button" disabled={busy} onClick={() => command({ action: 'next_outcome', outcome: 'failed' })}>Próxima tentativa: falha</button>{' '}
        <button type="button" disabled={busy} onClick={() => command({ action: 'next_outcome', outcome: 'unknown' })}>Próxima tentativa: resultado incerto</button>
        <p>Para resposta obsoleta, remarque o atendimento na Agenda depois de enviar e use o lembrete anterior abaixo.</p>
        {result && <p role="status">{result}</p>}
        <button type="button" disabled={busy} onClick={() => load()}>Atualizar lista</button>
        {items.map((item) => <section key={item.id} style={{ padding: '20px 0', borderBottom: '1px solid #ddd' }}>
          <strong>Atendimento #{item.session_id}</strong><p>{whatsappLabels[item.status]} · {whatsappLabels[item.confirmation]}</p>
          {['accepted', 'delivered', 'delivery_failed'].includes(item.status) && <>
            {[
              ['delivered', 'Entrega'], ['failed', 'Falha de entrega'], ['confirm', 'Confirmar presença'],
              ['unavailable', 'Não poderei ir'], ['stop', 'Interromper mensagens'], ['free_text', 'Texto livre'],
            ].map(([kind, label]) => <button key={kind} type="button" disabled={busy}
              onClick={() => command({ action: 'event', id: item.id, kind })}>{label}</button>)}
          </>}
        </section>)}
      </>}
    </main>
  </AppShell>;
}
