import React from "react";
import "@testing-library/jest-dom";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { Route, Router } from "react-router-dom";
import { createMemoryHistory } from "history";
import PatientEvaluationNew from ".";
import ClinicalRecordNavigationConfirmation from "../../components/ClinicalRecordNavigationConfirmation";
import { getClinicalRecordUserConfirmation } from "../../services/clinicalRecordNavigationConfirmation";
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
  const history = createMemoryHistory({ initialEntries: ["/pacientes/101", "/pacientes/101/avaliacoes/nova?case=11"], initialIndex: 1, getUserConfirmation: getClinicalRecordUserConfirmation });
  render(<Router history={history}><Route path="/pacientes/:id/avaliacoes/nova"><PatientEvaluationNew /></Route><ClinicalRecordNavigationConfirmation /></Router>);
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
    sessionStorage.clear();
    confirm = jest.spyOn(window, "confirm").mockReturnValue(false);
    listPatientClinicalCases.mockResolvedValue({ data: [{ id: 11, status: "active", title: "Caso sintético" }] });
    getClinicalSigningIdentity.mockResolvedValue({ eligible_to_sign: false });
    axios.get.mockImplementation((url) => Promise.resolve({ data: url === "/form-templates"
      ? [{ id: 9, code: "simple", title: "Registro simples", is_active: true }] : definition }));
    axios.post.mockRejectedValue(new Error("Synthetic failure"));
  });
  afterEach(() => { expect(confirm).not.toHaveBeenCalled(); confirm.mockRestore(); });
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
    fireEvent.click(screen.getByRole("button", { name: "Continuar editando" }));
    fireEvent.click(screen.getByRole("button", { name: "Voltar", exact: true }));
    fireEvent.click(screen.getByRole("button", { name: "Descartar alterações" }));
    expect(history.location.pathname).toBe("/pacientes/101");
  });
  it("protects browser Back", async () => {
    const history = renderPage();
    await edit();
    act(() => history.goBack());
    expect(history.location.pathname).toBe("/pacientes/101/avaliacoes/nova");
  });
  it("warns before closing or reloading an unsaved editor", async () => {
    renderPage();
    await edit();
    const close = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(close);
    expect(close.defaultPrevented).toBe(true);
    expect(axios.post).not.toHaveBeenCalled();
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
    expect(screen.getByRole("dialog", { name: "Alterações não salvas" })).toBeInTheDocument();
  });
  it("saves one aggregate on repeated clicks and retries the same timeout attempt", async () => {
    const history = renderPage();
    const field = await edit();
    const save = screen.getByRole("button", { name: "Salvar rascunho" });
    fireEvent.click(save);
    fireEvent.click(save);
    await screen.findByRole("alert");
    expect(axios.post).toHaveBeenCalledTimes(1);
    expect(field).toHaveValue("Conteúdo exclusivamente sintético");
    const first = axios.post.mock.calls[0];
    expect(first[0]).toBe("/evaluations/structured");
    expect(first[1].forms[0].answers).toHaveLength(1);
    await waitFor(() => expect(save).toBeEnabled());
    axios.post.mockResolvedValueOnce({ data: { id: 31, version: 1, clinical_state: "draft" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar rascunho" }));
    await waitFor(() => expect(history.location.pathname).toBe("/pacientes/101"));
    expect(axios.post).toHaveBeenCalledTimes(2);
    expect(axios.post.mock.calls[1]).toEqual(first);
    expect(sessionStorage.getItem("motria:structured-evaluation:new:101")).toBeNull();
  });
  it("recovers the confirmed draft after reload without creating another evaluation", async () => {
    sessionStorage.setItem("motria:structured-evaluation:new:101", "fictional-pending-01");
    const previousGet = axios.get.getMockImplementation();
    axios.get.mockImplementation((url) => url === "/evaluations?patient_id=101"
      ? Promise.resolve({ data: [{ id: 31, structured_save_key: "fictional-pending-01", clinical_state: "draft" }] })
      : previousGet(url));
    renderPage();
    expect(await screen.findByRole("link", { name: "Abrir registro salvo" })).toHaveAttribute("href", "/pacientes/101/avaliacoes/31");
    expect(axios.post).not.toHaveBeenCalled();
  });
  it("keeps the saved draft visible when signature fails and never reports completion", async () => {
    getClinicalSigningIdentity.mockResolvedValue({ eligible_to_sign: true });
    axios.post.mockResolvedValueOnce({ data: { id: 31, version: 1, clinical_state: "draft" } });
    renderPage();
    const field = await edit();
    const signButton = screen.getByRole("button", { name: "Salvar e assinar" });
    const submitEvent = new Event("submit", { bubbles: true, cancelable: true });
    Object.defineProperty(submitEvent, "submitter", { value: signButton });
    fireEvent(document.getElementById(signButton.getAttribute("form")), submitEvent);
    const dialog = await screen.findByRole("dialog", { name: "Salvar e assinar?" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Salvar e assinar" }));
    expect(await screen.findByRole("link", { name: "Abrir registro salvo" })).toHaveAttribute("href", "/pacientes/101/avaliacoes/31");
    expect(field).toHaveValue("Conteúdo exclusivamente sintético");
    expect(screen.getByRole("button", { name: "Salvar rascunho" })).toBeDisabled();
    expect(axios.post).toHaveBeenCalledTimes(2);
    expect(axios.post.mock.calls[0][0]).toBe("/evaluations/structured");
    expect(axios.post.mock.calls[1][0]).toBe("/clinical-records/evaluation/31/finalize");
    expect(sessionStorage.getItem("motria:structured-evaluation:new:101")).toBeTruthy();
  });
  it("sends numeric option IDs, zero, false and matrix data together", async () => {
    const complex = { templateId: 9, sections: [{ id: "synthetic", title: "Sintético", blocks: [
      { id: "zero", type: "number", label: "Número", config: { questionId: 20 } },
      { id: "bool", type: "yesno", label: "Booleano", config: { questionId: 21 } },
      { id: "multi", type: "multi_select", label: "Seleção", config: { questionId: 22, options: [{ id: "30", label: "Opção sintética" }] } },
      { id: "matrix", type: "matrix", label: "Matriz", config: { questionId: 23, choiceKey: "loss", boolKey: "pain", rows: [{ id: "row_a", label: "Linha sintética" }], choices: [{ value: "none", label: "Nenhuma" }] } },
      { id: "table", type: "table", label: "Tabela", config: { questionId: 24, columns: [{ id: "column_a", label: "Coluna sintética" }], maxLines: 2 } },
    ] }] };
    const previousGet = axios.get.getMockImplementation();
    axios.get.mockImplementation((url) => url.endsWith("/definition") ? Promise.resolve({ data: complex }) : previousGet(url));
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Registro simples" }));
    fireEvent.change(await screen.findByLabelText("Número"), { target: { value: "0" } });
    fireEvent.change(screen.getByLabelText("Booleano"), { target: { value: "no" } });
    fireEvent.click(screen.getByLabelText("Opção sintética"));
    fireEvent.click(screen.getByLabelText("Linha sintética Nenhuma"));
    fireEvent.click(screen.getByRole("button", { name: "Adicionar linha em Tabela" }));
    expect(axios.post).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText("Coluna sintética — linha 1"), { target: { value: "Célula sintética" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar rascunho" }));
    await screen.findByRole("alert");
    expect(axios.post.mock.calls[0][1].forms[0].answers).toEqual([
      { form_question_id: 20, value_number: 0 },
      { form_question_id: 21, value_bool: false },
      { form_question_id: 22, value_json: [30] },
      { form_question_id: 23, value_json: { row_a: { loss: "none" } } },
      { form_question_id: 24, value_json: [{ column_a: "Célula sintética" }] },
    ]);
  });
});
