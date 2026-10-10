import React from "react";
import "@testing-library/jest-dom";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { Router } from "react-router-dom";
import { createMemoryHistory } from "history";
import useClinicalRecordNavigationGuard from "./useClinicalRecordNavigationGuard";
import ClinicalRecordNavigationConfirmation from "../components/ClinicalRecordNavigationConfirmation";
import { getClinicalRecordUserConfirmation } from "../services/clinicalRecordNavigationConfirmation";

jest.mock("react-toastify", () => ({ toast: { info: jest.fn() } }));

function Record({ dirty = false, saving = false, onDiscard = () => {} }) {
  const { markSaved, confirmDiscard } = useClinicalRecordNavigationGuard({ dirty, saving });
  return <><button type="button" onClick={markSaved}>Saved</button><button type="button" onClick={() => confirmDiscard(onDiscard)}>Cancel editing</button></>;
}

const mount = (props) => {
  const history = createMemoryHistory({ initialEntries: ["/patient", "/evaluation"], initialIndex: 1, getUserConfirmation: getClinicalRecordUserConfirmation });
  const tree = (values) => <Router history={history}><Record {...values} /><ClinicalRecordNavigationConfirmation /></Router>;
  const view = render(tree(props));
  return { history, view, update: (values) => view.rerender(tree(values)) };
};
const keep = () => fireEvent.click(screen.getByRole("button", { name: "Continuar editando" }));
const discard = () => fireEvent.click(screen.getByRole("button", { name: "Descartar alterações" }));

describe("clinical record navigation with the standard system dialog", () => {
  let nativeConfirm;
  beforeEach(() => { nativeConfirm = jest.spyOn(window, "confirm").mockReturnValue(false); });
  afterEach(() => { expect(nativeConfirm).not.toHaveBeenCalled(); nativeConfirm.mockRestore(); });

  it("allows a clean contextual return", () => {
    const { history } = mount({});
    act(() => history.push("/patient"));
    expect(history.location.pathname).toBe("/patient");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
  it("keeps a dirty draft when browser Back is cancelled, then permits discard", () => {
    const { history } = mount({ dirty: true });
    act(() => history.goBack());
    expect(screen.getByRole("dialog", { name: "Alterações não salvas" })).toBeInTheDocument();
    keep();
    expect(history.location.pathname).toBe("/evaluation");
    act(() => history.goBack());
    discard();
    expect(history.location.pathname).toBe("/patient");
    expect(history.action).toBe("POP");
  });
  it.each(["push", "replace"])("keeps and confirms a %s with its original location state", (action) => {
    const { history } = mount({ dirty: true });
    act(() => history[action]("/patient?case=11", { clinicalReturnFocus: true }));
    keep();
    expect(history.location.pathname).toBe("/evaluation");
    act(() => history[action]("/patient?case=11", { clinicalReturnFocus: true }));
    discard();
    expect(history.location.pathname).toBe("/patient");
    expect(history.location.search).toBe("?case=11");
    expect(history.location.state.clinicalReturnFocus).toBe(true);
    expect(history.action).toBe(action.toUpperCase());
  });
  it("focuses keep-editing, traps Tab and restores focus on Escape", () => {
    const { history } = mount({ dirty: true });
    const origin = screen.getByRole("button", { name: "Saved" });
    origin.focus();
    act(() => history.push("/patient"));
    expect(screen.getByRole("button", { name: "Continuar editando" })).toHaveFocus();
    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(screen.getByRole("button", { name: "Descartar alterações" })).toHaveFocus();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(screen.getByRole("button", { name: "Continuar editando" })).toHaveFocus();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(history.location.pathname).toBe("/evaluation");
    expect(origin).toHaveFocus();
  });
  it("blocks leaving during save without asking to discard", () => {
    const { history } = mount({ dirty: true, saving: true });
    act(() => history.goBack());
    expect(history.location.pathname).toBe("/evaluation");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
  it("rechecks saving before accepting an already open confirmation", () => {
    const { history, update } = mount({ dirty: true });
    act(() => history.push("/patient"));
    update({ dirty: true, saving: true });
    discard();
    expect(history.location.pathname).toBe("/evaluation");
  });
  it("allows redirect immediately after successful save", () => {
    const { history } = mount({ dirty: true, saving: true });
    fireEvent.click(screen.getByText("Saved"));
    act(() => history.push("/patient"));
    expect(history.location.pathname).toBe("/patient");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
  it("uses the same modal for cancelling editing without navigating", () => {
    const onDiscard = jest.fn();
    const { history } = mount({ dirty: true, onDiscard });
    fireEvent.click(screen.getByText("Cancel editing"));
    keep();
    expect(onDiscard).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText("Cancel editing"));
    discard();
    expect(onDiscard).toHaveBeenCalledTimes(1);
    expect(history.location.pathname).toBe("/evaluation");
  });
  it("protects unload and removes its blocker on unmount", () => {
    const { history, view } = mount({ dirty: true });
    const event = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    act(() => history.push("/patient"));
    view.unmount();
    act(() => history.push("/patient"));
    expect(history.location.pathname).toBe("/patient");
  });
});
