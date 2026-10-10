import {
  cancelClinicalRecordDiscard,
  createClinicalRecordDiscardPrompt,
  getClinicalRecordUserConfirmation,
  registerClinicalRecordDiscardDialog,
  requestClinicalRecordDiscard,
  settleClinicalRecordDiscard,
} from "./clinicalRecordNavigationConfirmation";

const owner = Symbol("synthetic-record");
describe("clinical confirmation scope and compatibility", () => {
  let nativeConfirm;
  let unregister;
  beforeEach(() => { nativeConfirm = jest.spyOn(window, "confirm").mockReturnValue(false); });
  afterEach(() => { unregister?.(); unregister = null; cancelClinicalRecordDiscard(owner); nativeConfirm.mockRestore(); });
  it.each([false, true])("preserves other modules' native confirmation result %s", (accepted) => {
    nativeConfirm.mockReturnValue(accepted);
    const callback = jest.fn();
    getClinicalRecordUserConfirmation("Existing module confirmation", callback);
    expect(nativeConfirm).toHaveBeenCalledWith("Existing module confirmation");
    expect(callback).toHaveBeenCalledWith(accepted);
  });
  it("fails closed if the clinical modal is not mounted", () => {
    const callback = jest.fn();
    getClinicalRecordUserConfirmation(createClinicalRecordDiscardPrompt(owner, () => true), callback);
    expect(callback).toHaveBeenCalledWith(false);
    expect(nativeConfirm).not.toHaveBeenCalled();
  });
  it("settles the registered prompt once and rejects replay", () => {
    const handler = jest.fn();
    unregister = registerClinicalRecordDiscardDialog(handler);
    const callback = jest.fn();
    const message = createClinicalRecordDiscardPrompt(owner, () => true);
    getClinicalRecordUserConfirmation(message, callback);
    expect(handler).toHaveBeenCalledWith(true);
    expect(callback).not.toHaveBeenCalled();
    settleClinicalRecordDiscard(true);
    settleClinicalRecordDiscard(true);
    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith(true);
    const replay = jest.fn();
    getClinicalRecordUserConfirmation(message, replay);
    expect(replay).toHaveBeenCalledWith(false);
  });
  it("rejects overlapping requests without replacing the pending decision", () => {
    unregister = registerClinicalRecordDiscardDialog(jest.fn());
    const first = jest.fn();
    const second = jest.fn();
    requestClinicalRecordDiscard(owner, first, () => true);
    requestClinicalRecordDiscard(Symbol("other-record"), second, () => true);
    expect(second).toHaveBeenCalledWith(false);
    expect(first).not.toHaveBeenCalled();
    settleClinicalRecordDiscard(true);
    expect(first).toHaveBeenCalledWith(true);
  });
  it("cancels pending confirmation when its record unmounts", () => {
    unregister = registerClinicalRecordDiscardDialog(jest.fn());
    const callback = jest.fn();
    requestClinicalRecordDiscard(owner, callback, () => true);
    cancelClinicalRecordDiscard(owner);
    settleClinicalRecordDiscard(true);
    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith(false);
  });
});
