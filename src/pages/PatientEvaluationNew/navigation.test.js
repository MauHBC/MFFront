import React from "react";
import "@testing-library/jest-dom";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Route, Router } from "react-router-dom";
import { createMemoryHistory } from "history";
import PatientEvaluationNew from ".";
import axios from "../../services/axios";
import { listPatientClinicalCases } from "../../services/patientClinicalCases";
import { getClinicalSigningIdentity } from "../../services/clinicalRecords";

jest.mock("../../services/axios", () => ({ __esModule: true, default: { get: jest.fn(), post: jest.fn() } }));
jest.mock("../../services/patientClinicalCases", () => ({ listPatientClinicalCases: jest.fn() }));
jest.mock("../../services/clinicalRecords", () => ({ getClinicalSigningIdentity: jest.fn(), finalizeClinicalRecord: jest.fn() }));
jest.mock("react-toastify", () => ({ toast: { error: jest.fn(), success: jest.fn(), info: jest.fn() } }));

const definition = {
  templateId: 9,
  sections: [{ id: "conclusion", title: "Conclusão", blocks: [{
    id: "conclusion_summary", type: "textarea", label: "Resumo clínico", config: { questionId: 19 },
  }] }],
};
const renderPage = () => {
  const history = createMemoryHistory({ initialEntries: ["/pacientes/101", "/pacientes/101/avaliacoes/nova?case=11"], initialIndex: 1 });
  render(<Router history={history}><Route path="/pacientes/:id/avaliacoes/nova"><PatientEvaluationNew /></Route></Router>);
  return history;
};
const edit = async () => {
  fireEvent.click(await screen.findByRole("button", { name: "Registro simples" }));
  const field = await screen.findByLabelText("Resumo clínico");
  fireEvent.change(field, { target: { value: "Conteúdo exclusivamente sintético" } });
  return field;
};

describe("new evaluation contextual return", () => {
  let confirm;
  beforeEach(() => {
    jest.clearAllMocks();
    confirm = jest.spyOn(window, "confirm").mockReturnValue(false);
    listPatientClinicalCases.mockResolvedValue({ data: [{ id: 11, status: "active", title: "Caso sintético" }] });
    getClinicalSigningIdentity.mockResolvedValue({ eligible_to_sign: false });
    axios.get.mockImplementation((url) => Promise.resolve({ data: url === "/form-templates"
      ? [{ id: 9, code: "simple", title: "Registro simples", is_active: true }] : definition }));
    axios.post.mockRejectedValue(new Error("Synthetic failure"));
  });
  afterEach(() => { confirm.mockRestore(); });
  it("offers return before a template is selected", async () => {
    const history = renderPage();
    await screen.findByRole("button", { name: "Registro simples" });
    fireEvent.click(screen.getByRole("button", { name: "Voltar", exact: true }));
    expect(history.location.pathname).toBe("/pacientes/101");
    expect(history.location.state.clinicalReturnFocus).toBe(true);
    expect(confirm).not.toHaveBeenCalled();
  });
  it("keeps the response when return is cancelled, and allows explicit discard", async () => {
    const history = renderPage();
    const field = await edit();
    fireEvent.click(screen.getByRole("button", { name: "Voltar", exact: true }));
    expect(history.location.pathname).toBe("/pacientes/101/avaliacoes/nova");
    expect(field).toHaveValue("Conteúdo exclusivamente sintético");
    confirm.mockReturnValue(true);
    fireEvent.click(screen.getByRole("button", { name: "Voltar", exact: true }));
    expect(history.location.pathname).toBe("/pacientes/101");
  });
  it("protects browser Back", async () => {
    const history = renderPage();
    await edit();
    act(() => history.goBack());
    expect(history.location.pathname).toBe("/pacientes/101/avaliacoes/nova");
  });
  it("preserves dirty protection after a failed save", async () => {
    const history = renderPage();
    const field = await edit();
    fireEvent.click(screen.getByRole("button", { name: "Salvar rascunho" }));
    await waitFor(() => expect(axios.post).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByRole("button", { name: "Voltar", exact: true })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "Voltar", exact: true }));
    expect(history.location.pathname).toBe("/pacientes/101/avaliacoes/nova");
    expect(field).toHaveValue("Conteúdo exclusivamente sintético");
    expect(confirm).toHaveBeenCalled();
  });
});
