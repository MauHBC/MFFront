import api from "./axios";
import {
  completeCredentialAction,
  inspectCredentialAction,
  requestCredentialRecovery,
} from "./credentialLifecycle";

jest.mock("./axios", () => ({
  post: jest.fn(),
}));

beforeEach(() => {
  api.post.mockReset();
  api.post.mockResolvedValue({ data: {} });
});

test("usa somente os contratos públicos de credencial", async () => {
  await requestCredentialRecovery(" Pessoa@Example.Test ");
  await inspectCredentialAction("selector.proof");
  await completeCredentialAction({
    token: "selector.proof",
    password: "nova senha segura",
    passwordConfirmation: "nova senha segura",
  });

  expect(api.post.mock.calls).toEqual([
    ["/public/credential-recovery-requests", { email: " Pessoa@Example.Test " }],
    ["/public/credential-actions/inspect", { token: "selector.proof" }],
    ["/public/credential-actions/complete", {
      token: "selector.proof",
      password: "nova senha segura",
      password_confirmation: "nova senha segura",
    }],
  ]);
});
