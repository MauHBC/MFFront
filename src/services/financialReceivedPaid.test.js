import api from "./axios";
import {
  getReceivedPaid,
  getDistributionConfiguration,
  saveDistributionConfiguration,
} from "./financialReceivedPaid";

jest.mock("./axios", () => ({
  __esModule: true,
  default: { get: jest.fn(), put: jest.fn() },
}));
beforeEach(() => jest.clearAllMocks());

test("consulta o ano realizado sem mês ou clínica enviados pelo cliente", () => {
  const { signal } = new AbortController();
  getReceivedPaid("2026", signal);
  expect(api.get).toHaveBeenCalledWith("/financial-received-paid", {
    params: { year: "2026" },
    signal,
  });
});
test("consulta configuração pelo contexto autenticado", () => {
  getDistributionConfiguration();
  expect(api.get).toHaveBeenCalledWith(
    "/financial-distribution/configuration",
    { signal: undefined },
  );
});
test("salva por um único PUT com revisão e identidades preservadas", () => {
  const command = {
    expected_revision: 3,
    apply: "next_month",
    participants: [
      { participant_id: "existing", name: "Empresa", percentage: "100" },
    ],
  };
  saveDistributionConfiguration(command);
  expect(api.put).toHaveBeenCalledWith(
    "/financial-distribution/configuration",
    command,
  );
});
