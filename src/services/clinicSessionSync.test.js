import {
  createClinicSessionOrder,
  subscribeToClinicSession,
} from "./clinicSessionSync";

const payload = {
  token: "token-sul",
  user: { id: 7, clinic_id: 2, membership_id: 20 },
  clinic_session: {
    authorization_source: "membership",
    session_revision: 101,
    active_membership_id: 20,
    active_clinic_id: 2,
    clinics: [{ membership_id: 20, clinic_id: 2, clinic_name: "Sul" }],
  },
};

const dispatchSyncMessage = (message) => window.dispatchEvent(new StorageEvent("storage", {
  key: "motria:clinic-session-sync:v1",
  newValue: JSON.stringify(message),
}));

describe("clinicSessionSync", () => {
  const NativeBroadcastChannel = window.BroadcastChannel;

  beforeEach(() => {
    window.BroadcastChannel = undefined;
  });

  afterAll(() => {
    window.BroadcastChannel = NativeBroadcastChannel;
  });

  it("aceita somente uma substituição membership internamente coerente", () => {
    const listener = jest.fn();
    const unsubscribe = subscribeToClinicSession(listener);

    dispatchSyncMessage({
      version: 1,
      type: "session-replaced",
      senderId: "outra-aba",
      payload,
    });
    dispatchSyncMessage({
      version: 1,
      type: "session-replaced",
      senderId: "outra-aba",
      payload: {
        ...payload,
        clinic_session: { ...payload.clinic_session, active_clinic_id: 999 },
      },
    });

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith(payload);
    unsubscribe();
  });

  it("preserva o evento mais novo durante a remontagem do assinante", () => {
    const firstListener = jest.fn();
    const unsubscribe = subscribeToClinicSession(firstListener, 7);
    unsubscribe();
    const newerPayload = {
      ...payload,
      token: "token-norte-novo",
      user: { ...payload.user, clinic_id: 1, membership_id: 10 },
      clinic_session: {
        ...payload.clinic_session,
        session_revision: 102,
        active_membership_id: 10,
        active_clinic_id: 1,
        clinics: [{ membership_id: 10, clinic_id: 1, clinic_name: "Norte" }],
      },
    };
    dispatchSyncMessage({
      version: 1,
      type: "session-replaced",
      senderId: "outra-aba",
      payload: newerPayload,
    });

    const remountedListener = jest.fn();
    const unsubscribeRemounted = subscribeToClinicSession(remountedListener, 7);
    expect(remountedListener).toHaveBeenCalledTimes(1);
    expect(remountedListener).toHaveBeenCalledWith(newerPayload);

    dispatchSyncMessage({
      version: 1,
      type: "session-replaced",
      senderId: "outra-aba",
      payload,
    });
    expect(remountedListener).toHaveBeenCalledTimes(1);
    unsubscribeRemounted();
  });

  it("faz abas convergirem para a maior revisão independentemente da ordem de chegada", () => {
    const older = payload;
    const newer = {
      ...payload,
      token: "token-norte-novo",
      user: { ...payload.user, clinic_id: 1, membership_id: 10 },
      clinic_session: {
        ...payload.clinic_session,
        session_revision: 102,
        active_membership_id: 10,
        active_clinic_id: 1,
        clinics: [
          ...payload.clinic_session.clinics,
          { membership_id: 10, clinic_id: 1, clinic_name: "Norte" },
        ],
      },
    };
    const firstTab = createClinicSessionOrder();
    const secondTab = createClinicSessionOrder();

    expect(firstTab.claim(older, 7)).toBe(true);
    expect(firstTab.claim(newer, 7)).toBe(true);
    expect(secondTab.claim(newer, 7)).toBe(true);
    expect(secondTab.claim(older, 7)).toBe(false);
    expect(firstTab.current(7)).toBe(102);
    expect(secondTab.current(7)).toBe(102);
  });

  it("nunca aceita revisão de outra identidade", () => {
    const order = createClinicSessionOrder();
    expect(order.claim(payload, 99)).toBe(false);
    expect(order.current(7)).toBe(0);
  });
});
