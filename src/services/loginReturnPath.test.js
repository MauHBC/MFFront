/* eslint-env jest */
import loginReturnPath from "./loginReturnPath";

test("login can resume only the explicitly supported internal journey", () => {
  expect(loginReturnPath("/cadastro")).toBe("/cadastro");
  [undefined, "", "/menu", "https://evil.example/cadastro", "//evil.example", "/%2fcadastro", "/cadastro?next=https://evil.example"].forEach((value) => {
    expect(loginReturnPath(value)).toBe("/menu");
  });
});
