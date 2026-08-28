import { validateAccountAccessForm } from "./AccountAccessDrawer";

const values = (password, passwordConfirmation = password) => ({
  email: "usuario@example.test",
  password,
  passwordConfirmation,
  confirmed: true,
});

describe("política de senha na gestão de acessos", () => {
  it("recusa sete caracteres e aceita oito sem exigir composição", () => {
    expect(validateAccountAccessForm("create", values("sete777")).password).toBe(
      "A senha deve ter entre 8 e 128 caracteres.",
    );
    expect(validateAccountAccessForm("create", values("oitoletr"))).toEqual({});
  });

  it("aceita até 128 caracteres sem truncar e recusa acima do limite", () => {
    expect(validateAccountAccessForm("reset", values("a".repeat(128)))).toEqual({});
    expect(validateAccountAccessForm("reset", values("a".repeat(129))).password).toBe(
      "A senha deve ter entre 8 e 128 caracteres.",
    );
  });
});
