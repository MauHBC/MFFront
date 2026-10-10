import React, { useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import styled from 'styled-components';
import api from '../../services/axios';
import { useAuthorization } from '../../contexts/AuthorizationContext';
import { formatAgendaDate, formatAgendaDateInput, formatAgendaTime } from '../../utils/agendaDateTime';
import { addCivilDays, normalizeCivilDate } from '../../utils/canonicalDateTime';
import { DrawerBackdrop, UnsavedChangesDialog, useDrawerInteraction } from '../../components/AppDrawer';
import { GhostButton as Button, PrimaryButton, RowActionButton } from '../../components/AppButton';
import { Field, FieldHint } from '../../components/AppForm';
import { TableWrap, DataTable, TH, TD } from '../../components/AppTable';
import { AppToolbar, AppToolbarRight } from '../../components/AppToolbar';
import { alpha, colors, fontSizes, radii } from '../../styles/tokens';
import { AgendaDrawerShell, DrawerActions } from './agendaDrawerComponents';
import WhatsAppReminderHistory from './WhatsAppReminderHistory';
import WhatsAppSimulationControls from './WhatsAppSimulationControls';
import { isLocalWhatsAppSimulation } from '../../config/whatsappSimulation';

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

// Each reminder is a distinct send, while confirmation belongs to the session.
// Group only by session ID; names, phones and times do not identify an appointment.
export const groupRemindersBySession = (items) => {
  const groups = new Map();
  const seen = new Set();
  items.forEach((item) => {
    if (!item.id || !item.session_id || seen.has(item.id)) return;
    seen.add(item.id);
    const key = String(item.session_id);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  });
  return Array.from(groups, ([sessionId, history]) => {
    history.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0) || String(b.id).localeCompare(String(a.id)));
    return { sessionId, history, current: history.find((item) => !item.obsolete) || history[0] };
  });
};

export default function WhatsAppReminders({ sessions, selectedDate, getPatientName, autoOpen }) {
  const authorization = useAuthorization();
  if (authorization.status !== 'ready' || authorization.canAccessModule?.('whatsapp') !== true || authorization.canAccessModule?.('schedule') !== true) return null;
  return <AuthorizedWhatsAppReminders sessions={sessions} selectedDate={selectedDate} getPatientName={getPatientName} autoOpen={autoOpen} authorization={authorization} />;
}

function AuthorizedWhatsAppReminders({ sessions, selectedDate, getPatientName, autoOpen, authorization }) {
  const authorizationContext = authorization.context;
  const activeContext = useRef(authorizationContext);
  activeContext.current = authorizationContext;
  const [settings, setSettings] = useState(null);
  const [open, setOpen] = useState(false);
  const [selection, setSelection] = useState([]);
  const [review, setReview] = useState(null);
  const [items, setItems] = useState([]);
  const initialDate = normalizeCivilDate(selectedDate) || formatAgendaDateInput(sessions[0]?.starts_at) || formatAgendaDateInput(new Date());
  const initialDateRef = useRef(initialDate);
  initialDateRef.current = initialDate;
  const [date, setDate] = useState(initialDate);
  const [daySessions, setDaySessions] = useState([]);
  const [loadedDate, setLoadedDate] = useState('');
  const [loadError, setLoadError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [contacts, setContacts] = useState([]);
  const [grant, setGrant] = useState(null);
  const [explicit, setExplicit] = useState(false);
  const [proof, setProof] = useState('');
  const [closeIntent, setCloseIntent] = useState(null);
  const drawerRef = useRef(null);
  const requestVersion = useRef(0);
  const inFlight = useRef(null);
  const commandInFlight = useRef(false);
  const pendingDate = useRef(null);
  const clearGrant = () => { setGrant(null); setExplicit(false); setProof(''); };
  const closeDrawer = () => {
    requestVersion.current += 1;
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
  const changeDate = (value) => {
    if (!normalizeCivilDate(value)) return;
    requestVersion.current += 1;
    setDate(value); setDaySessions([]); setItems([]); setContacts([]); setLoadedDate('');
    setSelection([]); setReview(null); clearGrant(); setNotice(''); setError(''); setLoadError(false);
  };
  const discardChanges = () => {
    if (busy) return;
    if (closeIntent === 'date') { changeDate(pendingDate.current); setCloseIntent(null); }
    else if (closeIntent === 'grant') { clearGrant(); setCloseIntent(null); }
    else closeDrawer();
  };
  const requestDate = (value) => {
    if (busy || commandInFlight.current || value === date || !normalizeCivilDate(value)) return;
    if (selection.length || review || (grant && (explicit || proof))) { pendingDate.current = value; setCloseIntent('date'); }
    else changeDate(value);
  };
  const openDrawer = () => {
    if (open) return;
    changeDate(initialDate); setOpen(true); setReview(null); setError('');
  };
  useDrawerInteraction({ open, drawerRef, onRequestClose: requestClose,
    confirmationOpen: Boolean(closeIntent), onKeepEditing: () => setCloseIntent(null) });
  const displayName = (session) => getPatientName?.(session) || nameFor(session);
  const canView = authorization.canAccessModule?.('whatsapp') === true && authorization.canAccessModule?.('schedule') === true;
  const canManage = canView && authorization.canAccessModule?.('whatsapp', 'manage') === true && authorization.canAccessModule?.('schedule', 'manage') === true;
  useEffect(() => {
    requestVersion.current += 1;
    setSettings(null); setOpen(false); setSelection([]); setReview(null); setItems([]); setContacts([]); setDaySessions([]); setLoadedDate(''); setGrant(null); setExplicit(false); setProof(''); setCloseIntent(null); setBusy(false); commandInFlight.current = false; setError(''); setNotice('');
    if (authorization.status !== 'ready' || !canView) return undefined;
    let live = true;
    Promise.resolve().then(() => api.get('/whatsapp/settings')).then(({ data }) => {
      if (live) { setSettings({ ...data, authorizationContext }); if (autoOpen && data.enabled) { setDate(initialDateRef.current); setOpen(true); } }
    }).catch(() => {});
    return () => { live = false; };
  }, [authorization.status, authorizationContext, canView, autoOpen]);
  const reload = () => {
    const version = requestVersion.current;
    if (inFlight.current?.version === version) return inFlight.current.promise;
    const requestedContext = authorizationContext;
    const isCurrent = () => requestVersion.current === version && activeContext.current === requestedContext;
    const promise = (async () => {
      try {
        const { data: rows } = await api.get('/sessions', { params: { from: date, to: addCivilDays(date, 1) } });
        if (!isCurrent()) return;
        const currentSessions = Array.from(new Map((Array.isArray(rows) ? rows : [])
          .filter((session) => formatAgendaDateInput(session.starts_at) === date)
          .map((session) => [String(session.id), session])).values());
        const ids = currentSessions.map((s) => s.id).slice(0, 1000);
        const results = ids.length ? await Promise.all([
          api.get('/whatsapp/reminders', { params: { session_ids: ids.join(',') } }),
          api.get('/whatsapp/contact-authorizations', { params: { session_ids: ids.slice(0, 250).join(',') } }),
        ]) : [{ data: [] }, { data: [] }];
        if (!isCurrent()) return;
        const allowed = new Set(ids.map(String));
        setDaySessions(currentSessions);
        setItems(Array.isArray(results[0].data) ? results[0].data.filter((item) => allowed.has(String(item.session_id))) : []);
        setContacts(Array.isArray(results[1].data) ? results[1].data.filter((item) => allowed.has(String(item.session_id))) : []);
        setLoadedDate(date); setLoadError(false);
        setSelection((current) => current.filter((id) => allowed.has(String(id))));
      } catch {
        if (isCurrent()) setLoadError(true);
      } finally { if (inFlight.current?.version === version) inFlight.current = null; }
    })();
    inFlight.current = { version, promise };
    return promise;
  };
  useEffect(() => {
    if (!open) return undefined;
    requestVersion.current += 1;
    reload();
    const timer = setInterval(() => reload(), 3000);
    return () => { clearInterval(timer); requestVersion.current += 1; };
  }, [open, date, authorizationContext]); // eslint-disable-line react-hooks/exhaustive-deps
  const command = async (path, body, after) => {
    if (commandInFlight.current || busy) return;
    commandInFlight.current = true;
    const version = requestVersion.current;
    const requestedContext = authorizationContext;
    setBusy(true); setError(''); setNotice('');
    try {
      const { data } = await api.post(path, body);
      if (activeContext.current !== requestedContext || requestVersion.current !== version) return;
      after?.(data);
      if (inFlight.current?.version === version) await inFlight.current.promise;
      if (requestVersion.current === version) await reload();
    } catch (e) {
      if (activeContext.current === requestedContext && requestVersion.current === version) setError(errors[e.response?.data?.error] || 'Não foi possível concluir. Revise os dados e tente novamente.');
    } finally { if (activeContext.current === requestedContext) { setBusy(false); commandInFlight.current = false; } }
  };
  if (!canView || !settings?.enabled || settings.authorizationContext !== authorizationContext || authorization.status !== 'ready') return null;
  const eligible = daySessions.filter((s) => s.status === 'scheduled' && new Date(s.starts_at).getTime() > Date.now());
  const groups = groupRemindersBySession(items);
  const loading = loadedDate !== date && !loadError;
  const canSimulate = isLocalWhatsAppSimulation() && settings.simulation === true && authorization.isAdministrator === true && canManage;
  return <>
    <Button type="button" onClick={openDrawer}>Lembretes WhatsApp</Button>
    {open && <>
      <AgendaDrawerShell open compact drawerRef={drawerRef} dialogLabel="Lembretes WhatsApp"
        title={review ? 'Revisar lembretes' : 'Lembretes WhatsApp'} closeLabel="Fechar lembretes WhatsApp" closeDisabled={busy} onClose={requestClose}>
        <PanelContent>
      {settings.simulation && <FieldHint role="status">Simulação — nenhuma mensagem será enviada.</FieldHint>}
      {error && <p className="error" role="alert">{error}</p>}
      {notice && <p role="status">{notice}</p>}
      <AppToolbar><Field htmlFor="whatsapp-date">Data dos atendimentos
        <input id="whatsapp-date" type="date" value={date} disabled={busy} onChange={(e) => requestDate(e.target.value)} />
      </Field>
      <AppToolbarRight>
        <Button type="button" disabled={busy} onClick={() => requestDate(formatAgendaDateInput(new Date()))}>Hoje</Button>
        <Button type="button" disabled={busy} onClick={() => requestDate(addCivilDays(formatAgendaDateInput(new Date()), 1))}>Amanhã</Button>
      </AppToolbarRight></AppToolbar>
      {loading && <p role="status">Carregando lembretes de {formatAgendaDate(date)}…</p>}
      {loadError && <><p role="alert">Não foi possível atualizar os lembretes desta data.</p><Button type="button" onClick={reload}>Tentar novamente</Button></>}
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
        {!loading && !loadError && !eligible.length && <p>Não há atendimentos futuros em {formatAgendaDate(date)}.</p>}
        <TableWrap><DataTable><thead><tr><TH aria-label="Selecionar" /><TH>Paciente</TH><TH>Atendimento</TH></tr></thead>
          <tbody>{eligible.map((s) => <tr key={s.id}>
            <TD><input type="checkbox" disabled={!canManage || busy || loadError} checked={selection.includes(s.id)}
              aria-label={`Selecionar ${displayName(s)}`}
              onChange={(e) => setSelection((current) => e.target.checked ? [...new Set([...current, s.id])] : current.filter((id) => id !== s.id))} /></TD>
            <TD>{displayName(s)}
              {contacts.find((c) => c.session_id === s.id)?.authorized === false && <p className="muted">Contato não autorizado</p>}
              {settings.can_authorize_contact && contacts.find((c) => c.session_id === s.id)?.authorized === false && <RowActionButton type="button" disabled={busy}
                onClick={() => { setGrant({ ...contacts.find((c) => c.session_id === s.id), session: s }); setExplicit(false); setProof(''); }}>Autorizar contato</RowActionButton>}
            </TD><TD>{formatAgendaDateTime(s.starts_at)}</TD>
          </tr>)}</tbody></DataTable></TableWrap>
        {canManage && <DrawerActions $wrap><PrimaryButton type="button" disabled={busy || loading || loadError || !selection.length}
          onClick={() => command('/whatsapp/reviews', { session_ids: selection }, setReview)}>Revisar envio de {selection.length || ''} lembrete(s)</PrimaryButton></DrawerActions>}
        <h3>Acompanhamento</h3>
        {!loading && !loadError && !items.length && <p>Nenhum lembrete enviado em {formatAgendaDate(date)}.</p>}
        {groups.map(({ sessionId, history, current: item }) => {
          const session = daySessions.find((s) => String(s.id) === sessionId);
          return <div className="item" key={sessionId} data-testid={`whatsapp-session-${sessionId}`}>
            <strong>{session ? displayName(session) : `Atendimento #${item.session_id}`}</strong>
            <p>{session && formatAgendaDateTime(session.starts_at)}</p>
            <p>{whatsappLabels[item.status]} · {whatsappLabels[item.confirmation]}</p>
            {item.follow_up && <p className="muted">Acompanhamento humano necessário.</p>}
            {item.status === 'failed' && canManage && <Button type="button" disabled={busy}
              onClick={() => command('/whatsapp/reminders/retry', { id: item.id })}>Solicitar nova tentativa</Button>}
            <details><summary role="button" tabIndex={0}>Histórico de {history.length} lembrete(s)</summary>
              {history.map((entry, index) => <div key={entry.id}>
                <p>Lembrete {history.length - index}{entry.created_at ? ` · ${formatAgendaDateTime(entry.created_at)}` : ''}</p>
                <p>{whatsappLabels[entry.status]} · {entry.attempts || 0} tentativa(s)</p>
                {entry.obsolete && <p className="muted">Lembrete desatualizado</p>}
                <WhatsAppReminderHistory id={entry.id} authorizationContext={authorizationContext} />
                {canSimulate && ['accepted', 'delivered', 'delivery_failed'].includes(entry.status)
                  && <WhatsAppSimulationControls id={entry.id} busy={busy} onCommand={command} />}
              </div>)}
            </details>
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
  selectedDate: PropTypes.string,
  autoOpen: PropTypes.bool,
};
WhatsAppReminders.defaultProps = { getPatientName: null, selectedDate: null, autoOpen: false };
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
