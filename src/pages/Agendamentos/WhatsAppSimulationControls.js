import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { Field } from '../../components/AppForm';
import { GhostButton } from '../../components/AppButton';

export default function WhatsAppSimulationControls({ id, busy, onCommand }) {
  const [kind, setKind] = useState('delivered');
  return <details><summary>Simular resposta</summary>
    <Field htmlFor={`simulation-${id}`}>Evento
      <select id={`simulation-${id}`} value={kind} disabled={busy} onChange={(e) => setKind(e.target.value)}>
        <option value="delivered">Entrega</option>
        <option value="failed">Falha de entrega</option>
        <option value="confirm">Confirmar presença</option>
        <option value="unavailable">Não poderei ir</option>
        <option value="free_text">Texto livre</option>
        <option value="stop">Interromper mensagens</option>
      </select>
    </Field>
    <GhostButton type="button" disabled={busy} onClick={() => onCommand('/whatsapp/simulation', { action: 'event', id, kind })}>Aplicar simulação</GhostButton>
  </details>;
}
WhatsAppSimulationControls.propTypes = { id: PropTypes.string.isRequired, busy: PropTypes.bool.isRequired, onCommand: PropTypes.func.isRequired };
