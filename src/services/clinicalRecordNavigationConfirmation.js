// Only registered clinical discard prompts use the shared modal.
// Other history confirmations keep the browser's existing behavior.
const PREFIX = 'motria:clinical-record-discard:';
const prompts = new Map();
let sequence = 0;
let showDialog = null;
let pending = null;

export function settleClinicalRecordDiscard(accepted) {
  if (!pending) return;
  const request = pending;
  pending = null;
  showDialog?.(false);
  request.callback(Boolean(accepted && request.canDiscard()));
}

export function registerClinicalRecordDiscardDialog(handler) {
  showDialog = handler;
  return () => {
    if (showDialog !== handler) return;
    showDialog = null;
    settleClinicalRecordDiscard(false);
  };
}

export function requestClinicalRecordDiscard(owner, callback, canDiscard) {
  if (!showDialog || pending) {
    callback(false);
    return;
  }
  pending = { owner, callback, canDiscard };
  showDialog(true);
}

export function cancelClinicalRecordDiscard(owner) {
  [...prompts.entries()].forEach(([message, request]) => {
    if (request.owner === owner) prompts.delete(message);
  });
  if (pending?.owner === owner) settleClinicalRecordDiscard(false);
}

export function createClinicalRecordDiscardPrompt(owner, canDiscard) {
  sequence += 1;
  const message = `${PREFIX}${sequence}`;
  prompts.set(message, { owner, canDiscard });
  return message;
}

export function getClinicalRecordUserConfirmation(message, callback) {
  if (message.startsWith(PREFIX)) {
    const request = prompts.get(message);
    prompts.delete(message);
    if (!request) {
      callback(false);
      return;
    }
    requestClinicalRecordDiscard(request.owner, callback, request.canDiscard);
    return;
  }
  // Compatibility with prompts outside the clinical record navigation guard.
  // eslint-disable-next-line no-alert
  callback(window.confirm(message));
}
