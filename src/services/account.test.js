import axios from "./axios";
import { deactivateOwnAccount, updateOwnAccount } from "./account";

jest.mock("./axios", () => ({
  put: jest.fn(),
  delete: jest.fn(),
}));

describe("serviço da própria conta", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("envia a senha atual somente no contrato protegido do backend", async () => {
    axios.put.mockResolvedValue({ data: {} });

    await updateOwnAccount({
      name: "Maurício",
      email: "usuario@example.test",
      password: "Senha-nova-123!",
      currentPassword: "Senha-atual-123!",
    });

    expect(axios.put).toHaveBeenCalledWith("/users", {
      name: "Maurício",
      email: "usuario@example.test",
      password: "Senha-nova-123!",
      current_password: "Senha-atual-123!",
    });
  });

  it("envia a reautenticação no corpo da autodesativação", async () => {
    axios.delete.mockResolvedValue({ data: {} });

    await deactivateOwnAccount("Senha-atual-123!");

    expect(axios.delete).toHaveBeenCalledWith("/users", {
      data: { current_password: "Senha-atual-123!" },
    });
  });
});
