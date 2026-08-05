import api from "./axios";
import {
  addSignedClinicalAddendum,
  finalizeClinicalRecord,
  getClinicalSigningIdentity,
} from "./clinicalRecords";

jest.mock("./axios", () => ({
  get: jest.fn(),
  post: jest.fn(),
}));

describe("clinical record signing service", () => {
  beforeEach(() => {
    api.get.mockReset();
    api.post.mockReset();
    api.get.mockResolvedValue({ data: {} });
    api.post.mockResolvedValue({ data: {} });
  });

  it("consulta a identidade sem enviar dados controlados pelo navegador", async () => {
    await getClinicalSigningIdentity();
    expect(api.get).toHaveBeenCalledWith("/clinical-records/signing-identity");
  });

  it("finaliza enviando somente versão e chave idempotente", async () => {
    await finalizeClinicalRecord("evaluation", 41, 3);
    expect(api.post).toHaveBeenCalledWith(
      "/clinical-records/evaluation/41/finalize",
      { version: 3 },
      { headers: { "Idempotency-Key": expect.stringMatching(/^finalize-/) } },
    );
    expect(JSON.stringify(api.post.mock.calls)).not.toMatch(/signed_at|digest|signer|clinic_id/);
  });

  it("cria adendo explícito sem sobrescrever o registro original", async () => {
    await addSignedClinicalAddendum("evaluation", 41, {
      version: 3,
      reason: "Complementação posterior",
      content: { text: "Informação complementar" },
    });
    expect(api.post).toHaveBeenCalledWith(
      "/clinical-records/evaluation/41/revisions",
      {
        type: "addendum",
        version: 3,
        reason: "Complementação posterior",
        content: { text: "Informação complementar" },
      },
      { headers: { "Idempotency-Key": expect.stringMatching(/^addendum-/) } },
    );
  });
});
