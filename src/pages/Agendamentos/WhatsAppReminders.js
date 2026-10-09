import React, { useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import styled from 'styled-components';
import api from '../../services/axios';
import { useAuthorization } from '../../contexts/AuthorizationContext';
import { formatAgendaDate, formatAgendaTime } from '../../utils/agendaDateTime';
import { DrawerBackdrop, UnsavedChangesDialog, useDrawerInteraction } from '../../components/AppDrawer';
import { GhostButton as Button, PrimaryButton, RowActionButton } from '../../components/AppButton';
import { Field, FieldHint } from '../../components/AppForm';
import { TableWrap, DataTable, TH, TD } from '../../components/AppTable';
import { alpha, colors, fontSizes, radii } from '../../styles/tokens';
import { AgendaDrawerShell, DrawerActions } from './agendaDrawerComponents';

const PanelContent = styled.div`
  color: ${colors.ink}; font-size: ${fontSizes.body};
  h3 { font-size: ${fontSizes.body}; margin-top: 16px; }
  .message { padding: 14px; background: ${alpha.brand006}; border-radius: ${radii.sm}; margin: 12px 0; }
  .error { color: ${colors.dangerText}; }
  .muted { color: ${colors.softText}; font-size: ${fontSizes.small}; }
  .item { padding: 14px 0; border-bottom: 1px solid ${alpha.brand014}; }
  label[for="whatsapp-explicit-contact"] { display: flex; align-items: flex-start; gap: 8px; }
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
  if (authorization.status !== 'ready' || authorization.canAccessModule?.('whatsapp') !== true || authorization.canAccessModule?.('schedule') !== true) return null;
  return <AuthorizedWhatsAppReminders sessions={sessions} getPatientName={getPatientName} autoOpen={autoOpen} authorization={authorization} />;
}

function AuthorizedWhatsAppReminders({ sessions, getPatientName, autoOpen, authorization }) {
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
  const [closeIntent, setCloseIntent] = useState(null);
  const drawerRef = useRef(null);
  const clearGrant = () => { setGrant(null); setExplicit(false); setProof(''); };
  const closeDrawer = () => {
    setOpen(false); setSelection([]); setReview(null); clearGrant(); setCloseIntent(null);
  };
  const requestClose = () => {
    if (busy) { setNotice('Aguarde a conclusão da operação antes de fechar.'); return; }
    if (selection.length || review || (grant && (explicit || proof))) setCloseIntent('drawer');
    else closeDrawer();
  };
  const requestGrantClose = () => {
    if (busy) return;
    if (explicit || proof) setCloseIntent('grant'); else clearGrant();
  };
  const discardChanges = () => {
    if (busy) return;
    if (closeIntent === 'grant') { clearGrant(); setCloseIntent(null); }
    else closeDrawer();
  };
  useDrawerInteraction({ open, drawerRef, onRequestClose: requestClose,
    confirmationOpen: Boolean(closeIntent), onKeepEditing: () => setCloseIntent(null) });
  const displayName = (session) => getPatientName?.(session) || nameFor(session);
  const canView = authorization.canAccessModule?.('whatsapp') === true && authorization.canAccessModule?.('schedule') === true;
  const canManage = canView && authorization.canAccessModule?.('whatsapp', 'manage') === true && authorization.canAccessModule?.('schedule', 'manage') === true;
  useEffect(() => {
    setSettings(null); setOpen(false); setSelection([]); setReview(null); setItems([]); setContacts([]); setGrant(null); setExplicit(false); setProof(''); setCloseIntent(null); setBusy(false); setError(''); setNotice('');
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
    {open && <>
      <AgendaDrawerShell open compact drawerRef={drawerRef} dialogLabel="Lembretes WhatsApp"
        title={review ? 'Revisar lembretes' : 'Lembretes WhatsApp'} closeLabel="Fechar lembretes WhatsApp" closeDisabled={busy} onClose={requestClose}>
        <PanelContent>
      {settings.simulation && <FieldHint role="status">Simulação — nenhuma mensagem será enviada.</FieldHint>}
      {error && <p className="error" role="alert">{error}</p>}
      {notice && <p role="status">{notice}</p>}
      {grant && <div className="message">
        <h3>Autorização de contato</h3>
        <p>{displayName(grant.session)}</p>
        <label htmlFor="whatsapp-explicit-contact"><input id="whatsapp-explicit-contact" type="checkbox" checked={explicit} onChange={(e) => setExplicit(e.target.checked)} />
          Registrei autorização explícita para enviar lembretes ao telefone atual deste paciente.</label>
        <Field htmlFor="whatsapp-authorization-proof">Referência da autorização <input id="whatsapp-authorization-proof" value={proof} onChange={(e) => setProof(e.target.value)} maxLength={100} /></Field>
        {grant.contact_blocked && <p>O recebimento foi interrompido. Esta ação registra uma nova autorização e reativa o contato para este paciente.</p>}
        <Button type="button" disabled={busy} onClick={requestGrantClose}>Voltar</Button>{' '}
        <PrimaryButton type="button" disabled={busy || !explicit || !/^[a-zA-Z0-9:_-]{3,100}$/.test(proof)}
          onClick={() => command('/whatsapp/contact-authorizations', { patient_id: grant.patient_id,
            explicit_authorization: true, proof_reference: proof, reactivate: grant.contact_blocked }, clearGrant)}>Registrar autorização</PrimaryButton>
      </div>}
      {review ? <>
        {review.items.map((item) => <div className="message" key={item.id}>
          <strong>{item.patient_name}</strong><p>{item.phone} · {formatAgendaDateTime(item.starts_at)}</p>
          <p>{item.text}</p><p className="muted">Confirmar presença · Não poderei ir</p>
        </div>)}
        <DrawerActions $wrap>
          <Button type="button" disabled={busy} onClick={() => setReview(null)}>Voltar à seleção</Button>
          <PrimaryButton type="button" disabled={busy}
            onClick={() => command('/whatsapp/confirm', { review_id: review.review_id }, () => {
              setReview(null); setSelection([]); setNotice('Lembretes adicionados à fila de envio.');
            })}>Confirmar envio de {review.items.length} lembrete(s)</PrimaryButton>
        </DrawerActions>
      </> : <>
        <h3>Selecionar atendimentos</h3>
        {!eligible.length && <p>Não há atendimentos futuros nesta visualização. Navegue na Agenda para outro período.</p>}
        <TableWrap><DataTable><thead><tr><TH aria-label="Selecionar" /><TH>Paciente</TH><TH>Atendimento</TH></tr></thead>
          <tbody>{eligible.map((s) => <tr key={s.id}>
            <TD><input type="checkbox" disabled={!canManage || busy} checked={selection.includes(s.id)}
              aria-label={`Selecionar ${displayName(s)}`}
              onChange={(e) => setSelection(e.target.checked ? [...selection, s.id] : selection.filter((id) => id !== s.id))} /></TD>
            <TD>{displayName(s)}
              {contacts.find((c) => c.session_id === s.id)?.authorized === false && <p className="muted">Contato não autorizado</p>}
              {settings.can_authorize_contact && contacts.find((c) => c.session_id === s.id)?.authorized === false && <RowActionButton type="button" disabled={busy}
                onClick={() => { setGrant({ ...contacts.find((c) => c.session_id === s.id), session: s }); setExplicit(false); setProof(''); }}>Autorizar contato</RowActionButton>}
            </TD><TD>{formatAgendaDateTime(s.starts_at)}</TD>
          </tr>)}</tbody></DataTable></TableWrap>
        {canManage && <DrawerActions $wrap><PrimaryButton type="button" disabled={busy || !selection.length}
          onClick={() => command('/whatsapp/reviews', { session_ids: selection }, setReview)}>Revisar envio de {selection.length || ''} lembrete(s)</PrimaryButton></DrawerActions>}
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
    </PanelContent></AgendaDrawerShell>
      <DrawerBackdrop data-testid="whatsapp-drawer-backdrop" onClick={requestClose} />
      <UnsavedChangesDialog open={Boolean(closeIntent)} onKeepEditing={() => setCloseIntent(null)} onDiscard={discardChanges} />
    </>}
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
AuthorizedWhatsAppReminders.propTypes = {
  ...WhatsAppReminders.propTypes,
  authorization: PropTypes.shape({
    context: PropTypes.shape({}),
    status: PropTypes.string,
    canAccessModule: PropTypes.func,
    isAdministrator: PropTypes.bool,
  }).isRequired,
};
AuthorizedWhatsAppReminders.defaultProps = WhatsAppReminders.defaultProps;
