/* eslint-disable react/no-array-index-key -- The technical endpoint omits stable IDs; append order distinguishes equal events. */
import React, { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import api from '../../services/axios';
import { GhostButton } from '../../components/AppButton';
import { formatAgendaDate, formatAgendaTime } from '../../utils/agendaDateTime';

const labels = {
  delivered: 'Entrega', failed: 'Falha de entrega', confirm: 'Confirmação de presença',
  unavailable: 'Não poderá ir', stop: 'Interrupção de mensagens', free_text: 'Texto livre não processado',
  accepted: 'Mensagem aceita', read: 'Leitura',
};
const dispositions = {
  obsolete: 'Resposta desatualizada, sem alterar a confirmação vigente',
  conflict: 'Conflito, acompanhamento necessário',
  ignored: 'Sem alteração na confirmação',
};

// Domain detail composes existing controls; no parallel drawer or raw payload.
export default function WhatsAppReminderHistory({ id, authorizationContext }) {
  const [open, setOpen] = useState(false);
  const [events, setEvents] = useState(null);
  const [error, setError] = useState(false);
  const [reload, setReload] = useState(0);
  useEffect(() => {
    setEvents(null); setError(false);
    if (!open) return undefined;
    let live = true;
    api.get('/whatsapp/reminder-history', { params: { id } }).then(({ data }) => {
      if (live) setEvents(Array.isArray(data) ? data : []);
    }).catch(() => { if (live) setError(true); });
    return () => { live = false; };
  }, [open, id, authorizationContext, reload]);
  return <details onToggle={(e) => setOpen(e.currentTarget.open)}>
    <summary role="button" tabIndex={0}>Eventos do lembrete</summary>
    {open && <>
      {!events && !error && <p role="status">Carregando histórico…</p>}
      {error && <><p role="alert">Não foi possível carregar o histórico.</p><GhostButton type="button" onClick={() => setReload((value) => value + 1)}>Atualizar histórico</GhostButton></>}
      {events?.length === 0 && <p>Nenhum evento recebido.</p>}
      {/* Technical history exposes no stable event ID; its fixed append order distinguishes legitimate equal events. */}
      {events?.map((event, index) => <p key={`${event.received_at}-${index}`}>
        {labels[event.kind] || 'Evento do lembrete'} · {formatAgendaDate(event.occurred_at || event.received_at)} às {formatAgendaTime(event.occurred_at || event.received_at)}
        {dispositions[event.disposition] ? ` · ${dispositions[event.disposition]}` : ''}
      </p>)}
    </>}
  </details>;
}
WhatsAppReminderHistory.propTypes = {
  id: PropTypes.string.isRequired,
  authorizationContext: PropTypes.shape({}),
};
WhatsAppReminderHistory.defaultProps = { authorizationContext: null };
