import api from "./axios";
import { deleteClinicExpense } from "./financial";

jest.mock("./axios", () => ({ __esModule: true, default: { delete: jest.fn() } }));

beforeEach(() => jest.clearAllMocks());

it("preserva o contrato individual sem escopo", () => {
  deleteClinicExpense(12);
  expect(api.delete).toHaveBeenCalledWith("/clinic-expenses/12");
});

it("envia explicitamente a intenção de excluir esta e futuras", () => {
  deleteClinicExpense(12, "this_and_future");
  expect(api.delete).toHaveBeenCalledWith("/clinic-expenses/12", {
    params: { scope: "this_and_future" },
  });
});
