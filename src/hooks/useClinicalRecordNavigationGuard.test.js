import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { Router } from "react-router-dom";
import { createMemoryHistory } from "history";
import useClinicalRecordNavigationGuard from "./useClinicalRecordNavigationGuard";

jest.mock("react-toastify", () => ({ toast: { info: jest.fn() } }));

function Record({ dirty = false, saving = false }) {
  const saved = useClinicalRecordNavigationGuard({ dirty, saving });
  return <button type="button" onClick={saved}>Saved</button>;
}

describe("clinical record navigation", () => {
  let confirm;
  beforeEach(() => { confirm = jest.spyOn(window, "confirm").mockReturnValue(false); });
  afterEach(() => { confirm.mockRestore(); });
  const mount = (props) => {
    const history = createMemoryHistory({ initialEntries: ["/patient", "/evaluation"], initialIndex: 1 });
    const view = render(<Router history={history}><Record {...props} /></Router>);
    return { history, view };
  };
  it("allows a clean contextual return", () => {
    const { history } = mount({});
    act(() => history.push("/patient"));
    expect(history.location.pathname).toBe("/patient");
    expect(confirm).not.toHaveBeenCalled();
  });
  it("keeps a dirty draft when browser Back is cancelled", () => {
    const { history } = mount({ dirty: true });
    act(() => history.goBack());
    expect(history.location.pathname).toBe("/evaluation");
    expect(confirm).toHaveBeenCalledTimes(1);
  });
  it("allows explicit discard", () => {
    confirm.mockReturnValue(true);
    const { history } = mount({ dirty: true });
    act(() => history.push("/patient"));
    expect(history.location.pathname).toBe("/patient");
  });
  it("blocks leaving during save even when discard is confirmed", () => {
    confirm.mockReturnValue(true);
    const { history } = mount({ dirty: true, saving: true });
    act(() => history.push("/patient"));
    expect(history.location.pathname).toBe("/evaluation");
    expect(confirm).not.toHaveBeenCalled();
  });
  it("allows redirect immediately after successful save", () => {
    const { history } = mount({ dirty: true, saving: true });
    fireEvent.click(screen.getByText("Saved"));
    act(() => history.push("/patient"));
    expect(history.location.pathname).toBe("/patient");
    expect(confirm).not.toHaveBeenCalled();
  });
  it("protects unload and removes its blocker on unmount", () => {
    const { history, view } = mount({ dirty: true });
    const event = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    view.unmount();
    act(() => history.push("/patient"));
    expect(history.location.pathname).toBe("/patient");
  });
});
