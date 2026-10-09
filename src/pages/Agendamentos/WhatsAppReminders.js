import React, { useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import styled from 'styled-components';
import api from '../../services/axios';
import { useAuthorization } from '../../contexts/AuthorizationContext';
import { formatAgendaDate, formatAgendaTime } from '../../utils/agendaDateTime';

const Button = styled.button`
  border: 1px solid #cddadf; border-radius: 8px; background: #fff; color: #245d65;
  padding: 10px 14px; font: inherit; cursor: pointer;
  &:disabled { opacity: .5; cursor: default; }
`;
const Backdrop = styled.div`
  position: fixed; inset: 0; background: #16323c66; z-index: 1600;
  display: flex; justify-content: flex-end;
`;
const Panel = styled.section`
  background: white; width: min(680px, 100%); height: 100%; overflow: auto;
  padding: 28px; box-shadow: -8px 0 30px #16323c22; color: #263e49;
  header { display: flex; align-items: center; justify-content: space-between; }
  h2 { font-size: 22px; margin: 0; }
  h3 { font-size: 17px; margin-top: 24px; }
  table { border-collapse: collapse; width: 100%; margin: 18px 0; }
  td, th { padding: 12px 8px; border-bottom: 1px solid #e3e9ec; text-align: left; }
  .message { padding: 16px; background: #f1f7f7; border-radius: 8px; margin: 12px 0; }
  .actions { display: flex; gap: 10px; margin-top: 24px; }
  .primary { background: #237a78; border-color: #237a78; color: white; }
  .error { color: #9b3030; }
  .muted { color: #657e88; font-size: 13px; }
  .item { padding: 14px 0; border-bottom: 1px solid #e3e9ec; }
`;
export const whatsappLabels = {
  queued: 'Aguardando envio', attempting: 'Enviando', accepted: 'Enviado', delivered: 'Entregue',
  failed: 'Não enviado', delivery_failed: 'Falha de entrega', unknown: 'Resultado incerto — acompanhamento necessário',
  obsolete: 'Lembrete desatualizado', blocked_shutdown: 'Envio interrompido', blocked_limit: 'Limite diário atingido',
  blocked_module: 'WhatsApp desabilitado para este prestador',
  blocked_access: 'Acesso alterado', blocked_configuration: 'Envio indisponível', blocked_consent: 'Contato não autorizado',
  pending: 'Sem resposta', confirm: 'Presença confirmada', unavailable: 'Não poderá ir — acompanhar',
  conflict: 'Respostas conflitantes — acompanhar',
};
const errors = {
  WHATSAPP_CONTACT_NOT_AUTHORIZED: 'Um dos contatos não tem autorização válida. Revise a autorização antes de enviar.',
  WHATSAPP_REVIEW_STALE: 'Um atendimento mudou após a revisão. Volte e revise novamente.',
  WHATSAPP_REVIEW_EXPIRED: 'A revisão expirou. Volte e revise novamente.',
  WHATSAPP_SESSION_INELIGIBLE: 'Selecione apenas atendimentos agendados que ainda não começaram.',
  WHATSAPP_RETRY_BLOCKED: 'Este lembrete exige acompanhamento; uma nova tentativa está bloqueada.',
};
const nameFor = (s) => s.Patient?.full_name || s.patient?.full_name || s.patient_name || `Paciente #${s.patient_id}`;
const formatAgendaDateTime = (value) => `${formatAgendaDate(value)} às ${formatAgendaTime(value)}`;

export default function WhatsAppReminders({ sessions, getPatientName, autoOpen }) {
  const authorization = useAuthorization();
  const authorizationContext = authorization.context;
  const activeContext = useRef(authorizationContext);
  activeContext.current = authorizationContext;
  const [settings, setSettings] = useState(null);
  const [open, setOpen] = useState(false);
  const [selection, setSelection] = useState([]);
  const [review, setReview] = useState(null);
  const [items, setItems] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [contacts, setContacts] = useState([]);
  const [grant, setGrant] = useState(null);
  const [explicit, setExplicit] = useState(false);
  const [proof, setProof] = useState('');
  const displayName = (session) => getPatientName?.(session) || nameFor(session);
  const canView = authorization.canAccessModule?.('whatsapp') === true && authorization.canAccessModule?.('schedule') === true;
  const canManage = canView && authorization.canAccessModule?.('whatsapp', 'manage') === true && authorization.canAccessModule?.('schedule', 'manage') === true;
  useEffect(() => {
    setSettings(null); setOpen(false); setSelection([]); setReview(null); setItems([]); setContacts([]); setGrant(null); setBusy(false); setError(''); setNotice('');
    if (authorization.status !== 'ready' || !canView) return undefined;
    let live = true;
    Promise.resolve().then(() => api.get('/whatsapp/settings')).then(({ data }) => {
      if (live) { setSettings({ ...data, authorizationContext }); if (autoOpen && data.enabled) setOpen(true); }
    }).catch(() => {});
    return () => { live = false; };
  }, [authorization.status, authorizationContext, canView, autoOpen]);
  const reload = async () => {
    const requestedContext = authorizationContext;
    const ids = sessions.map((s) => s.id).slice(0, 1000);
    if (!ids.length) { setItems([]); return; }
    const { data } = await api.get('/whatsapp/reminders', { params: { session_ids: ids.join(',') } });
    if (activeContext.current !== requestedContext) return;
    setItems(Array.isArray(data) ? data : []);
    const { data: contactData } = await api.get('/whatsapp/contact-authorizations', { params: { session_ids: ids.slice(0, 250).join(',') } });
    if (activeContext.current === requestedContext) setContacts(Array.isArray(contactData) ? contactData : []);
  };
  useEffect(() => {
    if (!open) return undefined;
    reload().catch(() => {});
    const timer = setInterval(() => reload().catch(() => {}), 3000);
    return () => clearInterval(timer);
  }, [open, sessions]); // eslint-disable-line react-hooks/exhaustive-deps
  async function command(path, body, after) {
    const requestedContext = authorizationContext;
    setBusy(true); setError(''); setNotice('');
    try {
      const { data } = await api.post(path, body);
      if (activeContext.current !== requestedContext) return;
      after?.(data); await reload();
    } catch (e) {
      if (activeContext.current === requestedContext) setError(errors[e.response?.data?.error] || 'Não foi possível concluir. Revise os dados e tente novamente.');
    } finally { if (activeContext.current === requestedContext) setBusy(false); }
  }
  if (!canView || !settings?.enabled || settings.authorizationContext !== authorizationContext || authorization.status !== 'ready') return null;
  const eligible = sessions.filter((s) => s.status === 'scheduled' && new Date(s.starts_at).getTime() > Date.now());
  return <>
    <Button type="button" onClick={() => { setOpen(true); setReview(null); setError(''); }}>Lembretes WhatsApp</Button>
    {open && <Backdrop><Panel role="dialog" aria-modal="true" aria-label="Lembretes WhatsApp">
      <header><h2>{review ? 'Revisar lembretes' : 'Lembretes WhatsApp'}</h2>
        <Button type="button" disabled={busy} onClick={() => setOpen(false)}>Voltar à Agenda</Button></header>
      <p>Envie lembretes dos atendimentos selecionados e acompanhe a resposta de cada paciente.</p>
      {error && <p className="error" role="alert">{error}</p>}
      {notice && <p role="status">{notice}</p>}
      {grant && <div className="message">
        <h3>Autorização de contato</h3>
        <p>{displayName(grant.session)}</p>
        <label htmlFor="whatsapp-explicit-contact"><input id="whatsapp-explicit-contact" type="checkbox" checked={explicit} onChange={(e) => setExplicit(e.target.checked)} />
          Registrei autorização explícita para enviar lembretes ao telefone atual deste paciente.</label>
        <p><label htmlFor="whatsapp-authorization-proof">Referência da autorização <input id="whatsapp-authorization-proof" value={proof} onChange={(e) => setProof(e.target.value)} maxLength={100} /></label></p>
        {grant.contact_blocked && <p>O recebimento foi interrompido. Esta ação registra uma nova autorização e reativa o contato para este paciente.</p>}
        <Button type="button" onClick={() => setGrant(null)}>Voltar</Button>{' '}
        <Button className="primary" type="button" disabled={busy || !explicit || !/^[a-zA-Z0-9:_-]{3,100}$/.test(proof)}
          onClick={() => command('/whatsapp/contact-authorizations', { patient_id: grant.patient_id,
            explicit_authorization: true, proof_reference: proof, reactivate: grant.contact_blocked }, () => setGrant(null))}>Registrar autorização</Button>
      </div>}
      {review ? <>
        {review.items.map((item) => <div className="message" key={item.id}>
          <strong>{item.patient_name}</strong><p>{item.phone} · {formatAgendaDateTime(item.starts_at)}</p>
          <p>{item.text}</p><p className="muted">Confirmar presença · Não poderei ir</p>
        </div>)}
        <div className="actions">
          <Button type="button" disabled={busy} onClick={() => setReview(null)}>Voltar à seleção</Button>
          <Button className="primary" type="button" disabled={busy}
            onClick={() => command('/whatsapp/confirm', { review_id: review.review_id }, () => {
              setReview(null); setSelection([]); setNotice('Lembretes adicionados à fila de envio.');
            })}>Confirmar envio de {review.items.length} lembrete(s)</Button>
        </div>
      </> : <>
        <h3>Selecionar atendimentos</h3>
        {!eligible.length && <p>Não há atendimentos futuros nesta visualização. Navegue na Agenda para outro período.</p>}
        <table><thead><tr><th aria-label="Selecionar" /><th>Paciente</th><th>Atendimento</th></tr></thead>
          <tbody>{eligible.map((s) => <tr key={s.id}>
            <td><input type="checkbox" disabled={!canManage || busy} checked={selection.includes(s.id)}
              aria-label={`Selecionar ${displayName(s)}`}
              onChange={(e) => setSelection(e.target.checked ? [...selection, s.id] : selection.filter((id) => id !== s.id))} /></td>
            <td>{displayName(s)}
              {contacts.find((c) => c.session_id === s.id)?.authorized === false && <p className="muted">Contato não autorizado</p>}
              {settings.can_authorize_contact && contacts.find((c) => c.session_id === s.id)?.authorized === false && <Button type="button"
                onClick={() => { setGrant({ ...contacts.find((c) => c.session_id === s.id), session: s }); setExplicit(false); setProof(''); }}>Autorizar contato</Button>}
            </td><td>{formatAgendaDateTime(s.starts_at)}</td>
          </tr>)}</tbody></table>
        {canManage && <Button className="primary" type="button" disabled={busy || !selection.length}
          onClick={() => command('/whatsapp/reviews', { session_ids: selection }, setReview)}>Revisar envio de {selection.length || ''} lembrete(s)</Button>}
        <h3>Acompanhamento</h3>
        {!items.length && <p>Nenhum lembrete enviado neste período.</p>}
        {items.map((item) => {
          const session = sessions.find((s) => s.id === item.session_id);
          return <div className="item" key={item.id}>
            <strong>{session ? displayName(session) : `Atendimento #${item.session_id}`}</strong>
            <p>{session && formatAgendaDateTime(session.starts_at)}</p>
            <p>{whatsappLabels[item.status]} · {whatsappLabels[item.confirmation]}</p>
            {item.follow_up && <p className="muted">Acompanhamento humano necessário.</p>}
            {item.status === 'failed' && canManage && <Button type="button" disabled={busy}
              onClick={() => command('/whatsapp/reminders/retry', { id: item.id })}>Solicitar nova tentativa</Button>}
          </div>;
        })}
      </>}
    </Panel></Backdrop>}
  </>;
}
WhatsAppReminders.propTypes = {
  sessions: PropTypes.arrayOf(PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
    patient_id: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    starts_at: PropTypes.string, status: PropTypes.string,
  })).isRequired,
  getPatientName: PropTypes.func,
  autoOpen: PropTypes.bool,
};
WhatsAppReminders.defaultProps = { getPatientName: null, autoOpen: false };
