const CHANNEL_NAME = "motria:clinic-session:v1";
const STORAGE_KEY = "motria:clinic-session-sync:v1";
const senderId = `${Date.now()}:${Math.random().toString(36).slice(2)}`;
const listeners = new Set();
const latestMessages = new Map();
let transportStarted = false;
let channel = null;

export function getClinicSessionRevision(payload) {
  const revision = Number(payload?.clinic_session?.session_revision);
  return Number.isSafeInteger(revision) && revision > 0 ? revision : null;
}

export function createClinicSessionOrder() {
  const revisions = new Map();
  const current = (userId) => revisions.get(Number(userId)) || 0;
  const isNewer = (payload, expectedUserId) => {
    const userId = Number(payload?.user?.id);
    const revision = getClinicSessionRevision(payload);
    return Number.isSafeInteger(userId)
      && userId > 0
      && userId === Number(expectedUserId)
      && revision !== null
      && revision > current(userId);
  };
  return Object.freeze({
    current,
    isNewer,
    claim(payload, expectedUserId) {
      if (!isNewer(payload, expectedUserId)) return false;
      revisions.set(Number(expectedUserId), getClinicSessionRevision(payload));
      return true;
    },
    seed(userId, revisionValue) {
      const normalizedUserId = Number(userId);
      const revision = Number(revisionValue);
      if (
        Number.isSafeInteger(normalizedUserId)
        && normalizedUserId > 0
        && Number.isSafeInteger(revision)
        && revision > current(normalizedUserId)
      ) revisions.set(normalizedUserId, revision);
    },
    reset() {
      revisions.clear();
    },
  });
}

export const clinicSessionOrder = createClinicSessionOrder();

function validMessage(message) {
  const payload = message?.payload;
  const userId = Number(payload?.user?.id);
  const membershipId = Number(payload?.user?.membership_id);
  const clinicId = Number(payload?.user?.clinic_id);
  const session = payload?.clinic_session;
  return message?.version === 1
    && message?.type === "session-replaced"
    && message?.senderId !== senderId
    && typeof payload?.token === "string"
    && payload.token.length > 0
    && Number.isSafeInteger(userId)
    && userId > 0
    && Number.isSafeInteger(membershipId)
    && membershipId > 0
    && Number.isSafeInteger(clinicId)
    && clinicId > 0
    && getClinicSessionRevision(payload) !== null
    && session?.authorization_source === "membership"
    && Number(session.active_membership_id) === membershipId
    && Number(session.active_clinic_id) === clinicId
    && Array.isArray(session.clinics)
    && session.clinics.some((clinic) => (
      Number(clinic?.membership_id) === membershipId
      && Number(clinic?.clinic_id) === clinicId
    ));
}

const receive = (message) => {
  if (!validMessage(message)) return;
  const { payload } = message;
  const userId = Number(payload.user.id);
  const revision = getClinicSessionRevision(payload);
  const previousRevision = getClinicSessionRevision(latestMessages.get(userId)) || 0;
  if (revision <= previousRevision) return;
  latestMessages.set(userId, payload);
  listeners.forEach(({ listener, expectedUserId }) => {
    if (expectedUserId === null || expectedUserId === userId) listener(payload);
  });
};

const handleStorage = (event) => {
  if (event.key !== STORAGE_KEY || !event.newValue) return;
  try {
    receive(JSON.parse(event.newValue));
  } catch {
    // Mensagens inválidas nunca alteram a sessão local.
  }
};

const ensureTransport = () => {
  if (transportStarted) return;
  transportStarted = true;
  if (typeof window.BroadcastChannel === "function") {
    channel = new window.BroadcastChannel(CHANNEL_NAME);
    channel.addEventListener("message", (event) => receive(event.data));
  } else {
    window.addEventListener("storage", handleStorage);
  }
};

export function publishClinicSession(payload) {
  const message = {
    version: 1,
    type: "session-replaced",
    senderId,
    sentAt: Date.now(),
    payload,
  };
  if (typeof window.BroadcastChannel === "function") {
    const publisher = new window.BroadcastChannel(CHANNEL_NAME);
    publisher.postMessage(message);
    publisher.close();
    return;
  }
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(message));
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // A aba corrente já concluiu a troca; sincronização é best effort sem storage.
  }
}

export function subscribeToClinicSession(listener, expectedUserIdValue = null) {
  ensureTransport();
  const expectedUserId = Number(expectedUserIdValue);
  const subscription = {
    listener,
    expectedUserId: Number.isSafeInteger(expectedUserId) && expectedUserId > 0
      ? expectedUserId
      : null,
  };
  listeners.add(subscription);
  if (subscription.expectedUserId !== null) {
    const latest = latestMessages.get(subscription.expectedUserId);
    if (latest) listener(latest);
  }
  return () => {
    listeners.delete(subscription);
  };
}
