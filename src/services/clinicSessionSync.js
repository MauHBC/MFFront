const CHANNEL_NAME = "motria:clinic-session:v1";
const STORAGE_KEY = "motria:clinic-session-sync:v1";
const senderId = `${Date.now()}:${Math.random().toString(36).slice(2)}`;

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
    && session?.authorization_source === "membership"
    && Number(session.active_membership_id) === membershipId
    && Number(session.active_clinic_id) === clinicId
    && Array.isArray(session.clinics)
    && session.clinics.some((clinic) => (
      Number(clinic?.membership_id) === membershipId
      && Number(clinic?.clinic_id) === clinicId
    ));
}

export function publishClinicSession(payload) {
  const message = {
    version: 1,
    type: "session-replaced",
    senderId,
    sentAt: Date.now(),
    payload,
  };
  if (typeof window.BroadcastChannel === "function") {
    const channel = new window.BroadcastChannel(CHANNEL_NAME);
    channel.postMessage(message);
    channel.close();
    return;
  }
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(message));
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // A aba corrente já concluiu a troca; sincronização é best effort sem storage.
  }
}

export function subscribeToClinicSession(listener) {
  let channel = null;
  const receive = (message) => {
    if (validMessage(message)) listener(message.payload);
  };
  const handleStorage = (event) => {
    if (event.key !== STORAGE_KEY || !event.newValue) return;
    try {
      receive(JSON.parse(event.newValue));
    } catch {
      // Mensagens inválidas nunca alteram a sessão local.
    }
  };
  if (typeof window.BroadcastChannel === "function") {
    channel = new window.BroadcastChannel(CHANNEL_NAME);
    channel.addEventListener("message", (event) => receive(event.data));
  } else {
    window.addEventListener("storage", handleStorage);
  }
  return () => {
    channel?.close();
    window.removeEventListener("storage", handleStorage);
  };
}
