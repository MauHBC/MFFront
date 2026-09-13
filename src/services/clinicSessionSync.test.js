import { subscribeToClinicSession } from "./clinicSessionSync";

const payload = {
  token: "token-sul",
  user: { id: 7, clinic_id: 2, membership_id: 20 },
  clinic_session: {
    authorization_source: "membership",
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
});
