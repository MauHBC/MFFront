import api from "./axios";

export const requestCredentialRecovery = (email) =>
  api.post("/public/credential-recovery-requests", { email });

export const inspectCredentialAction = (token) =>
  api.post("/public/credential-actions/inspect", { token });

export const completeCredentialAction = ({ token, password, passwordConfirmation }) =>
  api.post("/public/credential-actions/complete", {
    token,
    password,
    password_confirmation: passwordConfirmation,
  });

export default {
  completeCredentialAction,
  inspectCredentialAction,
  requestCredentialRecovery,
};
