import React from "react";
import "@testing-library/jest-dom";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { Router, Route } from "react-router-dom";
import { createMemoryHistory } from "history";
import { toast } from "react-toastify";

import PatientEvaluationDetails from ".";
import axios from "../../services/axios";
import { useAuthorization } from "../../contexts/AuthorizationContext";
import {
  addSignedClinicalAddendum,
  finalizeClinicalRecord,
  getClinicalSigningIdentity,
} from "../../services/clinicalRecords";

jest.mock("../../services/axios", () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn(), put: jest.fn(), delete: jest.fn() },
}));
jest.mock("../../contexts/AuthorizationContext", () => ({ useAuthorization: jest.fn() }));
jest.mock("../../services/clinicalRecords", () => ({
  addSignedClinicalAddendum: jest.fn(),
  finalizeClinicalRecord: jest.fn(),
  getClinicalSigningIdentity: jest.fn(),
}));
jest.mock("react-toastify", () => ({
  toast: { error: jest.fn(), success: jest.fn() },
}));

const definition = {
  templateId: 9,
  sections: [{
    id: "subjective",
    title: "Subjetivo",
    blocks: [{
      id: "complaint",
      type: "textarea",
      label: "Queixa",
      config: { questionId: 91 },
    }],
  }],
};
const identity = {
  eligible_to_sign: true,
  name: "Dra. Beatriz",
  registration_region: "15",
  registration_number: "12345-F",
};

const response = (data) => Promise.resolve({ data });

const LEVELS = { none: 0, view: 1, edit: 2, manage: 3 };

function authorize({
  clinicalLevel = "view",
  capabilities = ["clinical_records.read"],
} = {}) {
  useAuthorization.mockReturnValue({
    canAccessModule: jest.fn((moduleKey, minimum = "view") => (
      moduleKey === "clinical_records"
      && LEVELS[clinicalLevel] >= LEVELS[minimum]
    )),
    hasCapability: jest.fn((capability) => capabilities.includes(capability)),
  });
}

function configureEvaluation({ clinicalState, eligible = true }) {
  getClinicalSigningIdentity.mockResolvedValue({ ...identity, eligible_to_sign: eligible });
  axios.get.mockImplementation((url) => {
    if (url === "/evaluations/31") {
      return response({
        id: 31,
        patient_id: 101,
        record_type: "evaluation",
        clinical_state: clinicalState,
        version: clinicalState === "finalized" ? 4 : 2,
        created_at: "2026-08-10T13:35:00.000Z",
        PatientClinicalCase: { id: 11, title: "Lombar" },
        clinical_revisions: [],
      });
    }
    if (url === "/form-instances?evaluation_id=31") {
      return response([{ id: 81, evaluation_id: 31, form_template_id: 9 }]);
    }
    if (url === "/form-templates/9") return response({ id: 9, title: "Avaliação lombar" });
    if (url === "/form-templates/9/definition") return response(definition);
    if (url === "/form-answers?form_instance_id=81") return response([]);
    throw new Error(`Unexpected GET ${url}`);
  });
  axios.put.mockResolvedValue(response({ id: 31, version: 3, clinical_state: "draft" }));
  axios.delete.mockResolvedValue({ status: 204 });
  axios.post.mockResolvedValue(response({ id: 100 }));
  finalizeClinicalRecord.mockResolvedValue({ id: 31, version: 3, clinical_state: "finalized" });
  addSignedClinicalAddendum.mockResolvedValue({ id: 90 });
}

function renderDetails() {
  const history = createMemoryHistory({ initialEntries: ["/pacientes/101/avaliacoes/31"] });
  return render(
    <Router history={history}>
      <Route path="/pacientes/:id/avaliacoes/:evaluationId">
        <PatientEvaluationDetails />
      </Route>
    </Router>,
  );
}

async function waitForEvaluation() {
  expect(await screen.findByRole("heading", { name: "Avaliação lombar" })).toBeInTheDocument();
  await waitFor(() => expect(screen.queryByText("Carregando avaliação...")).not.toBeInTheDocument());
}

describe("PatientEvaluationDetails permission characterization", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    authorize();
  });

  test("draft read-only route preserves reading and hides edit, persistence and signature", async () => {
    configureEvaluation({ clinicalState: "draft", eligible: true });
    renderDetails();
    await waitForEvaluation();

    expect(screen.getByText("Queixa")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Editar rascunho" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Salvar rascunho" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Salvar e assinar" })).not.toBeInTheDocument();
    expect(getClinicalSigningIdentity).not.toHaveBeenCalled();
  });

  test("finalized read-only route hides addendum even with eligible identity", async () => {
    configureEvaluation({ clinicalState: "finalized", eligible: true });
    renderDetails();
    await waitForEvaluation();

    expect(screen.queryByRole("button", { name: "Adicionar adendo" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Salvar adendo" })).not.toBeInTheDocument();
  });

  test("edit + write keeps draft actions but hides signature without finalize", async () => {
    authorize({
      clinicalLevel: "edit",
      capabilities: ["clinical_records.read", "clinical_records.write"],
    });
    configureEvaluation({ clinicalState: "draft", eligible: true });
    renderDetails();
    await waitForEvaluation();

    fireEvent.click(screen.getByRole("button", { name: "Editar rascunho" }));
    expect(screen.getByRole("button", { name: "Salvar rascunho" })).toBeEnabled();
    expect(screen.queryByRole("button", { name: "Salvar e assinar" })).not.toBeInTheDocument();
    expect(getClinicalSigningIdentity).not.toHaveBeenCalled();
  });

  test.each([
    [false, true],
    [true, false],
  ])("finalize-authorized UI still conditions signature on eligible identity=%s", async (
    eligible,
    disabled,
  ) => {
    authorize({
      clinicalLevel: "edit",
      capabilities: [
        "clinical_records.read",
        "clinical_records.write",
        "clinical_records.finalize",
      ],
    });
    configureEvaluation({ clinicalState: "draft", eligible });
    renderDetails();
    await waitForEvaluation();

    expect(screen.getByRole("button", { name: "Salvar e assinar" }))
      .toHaveProperty("disabled", disabled);
  });

  test("addendum preserves the original-signer contract as a backend denial", async () => {
    authorize({
      clinicalLevel: "edit",
      capabilities: [
        "clinical_records.read",
        "clinical_records.write",
        "clinical_records.finalize",
      ],
    });
    configureEvaluation({ clinicalState: "finalized", eligible: true });
    const denial = new Error("SIGNED_RECORD_AUTHOR_REQUIRED");
    denial.response = { status: 403, data: { error: "SIGNED_RECORD_AUTHOR_REQUIRED" } };
    addSignedClinicalAddendum.mockRejectedValueOnce(denial);
    renderDetails();
    await waitForEvaluation();

    fireEvent.click(screen.getByRole("button", { name: "Adicionar adendo" }));
    fireEvent.change(screen.getByLabelText("Motivo"), {
      target: { value: "Complemento clínico" },
    });
    fireEvent.change(screen.getByLabelText("Conteúdo"), {
      target: { value: "Orientação complementar" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Salvar adendo" }));

    await waitFor(() => expect(addSignedClinicalAddendum).toHaveBeenCalledWith(
      "evaluation",
      "31",
      expect.objectContaining({ version: 4 }),
    ));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(
      "SIGNED_RECORD_AUTHOR_REQUIRED",
    ));
  });

  test("authorized finalization uses confirmation and the saved record version", async () => {
    authorize({
      clinicalLevel: "edit",
      capabilities: [
        "clinical_records.read",
        "clinical_records.write",
        "clinical_records.finalize",
      ],
    });
    configureEvaluation({ clinicalState: "draft", eligible: true });
    renderDetails();
    await waitForEvaluation();
    fireEvent.click(screen.getByRole("button", { name: "Editar rascunho" }));
    fireEvent.click(screen.getByRole("button", { name: "Salvar e assinar" }));

    const dialog = await screen.findByRole("dialog", { name: "Salvar e assinar?" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Salvar e assinar" }));
    await waitFor(() => expect(finalizeClinicalRecord).toHaveBeenCalledWith(
      "evaluation",
      "31",
      3,
    ));
  });
});
