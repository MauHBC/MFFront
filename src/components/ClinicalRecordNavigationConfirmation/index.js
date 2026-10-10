import React, { useEffect, useRef, useState } from "react";
import { UnsavedChangesDialog } from "../AppDrawer";
import {
  registerClinicalRecordDiscardDialog,
  settleClinicalRecordDiscard,
} from "../../services/clinicalRecordNavigationConfirmation";

// Reuse the system's discard dialog; this bridge owns only clinical requests.
export default function ClinicalRecordNavigationConfirmation() {
  const [open, setOpen] = useState(false);
  const root = useRef(null);
  const returnFocus = useRef(null);

  useEffect(() => registerClinicalRecordDiscardDialog((nextOpen) => {
    if (nextOpen) returnFocus.current = document.activeElement;
    setOpen(nextOpen);
  }), []);

  useEffect(() => {
    if (!open) return undefined;
    const buttons = () => [...(root.current?.querySelectorAll("button:not(:disabled)") || [])];
    const keepEditing = () => buttons()[0]?.focus();
    keepEditing();
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        settleClinicalRecordDiscard(false);
      } else if (event.key === "Tab") {
        const controls = buttons();
        const current = controls.indexOf(document.activeElement);
        let next = (current + 1) % controls.length;
        if (event.shiftKey) next = current <= 0 ? controls.length - 1 : current - 1;
        event.preventDefault();
        controls[next]?.focus();
      }
    };
    const handleFocus = (event) => {
      if (root.current && !root.current.contains(event.target)) keepEditing();
    };
    document.addEventListener("keydown", handleKeyDown, true);
    document.addEventListener("focusin", handleFocus);
    return () => {
      document.removeEventListener("keydown", handleKeyDown, true);
      document.removeEventListener("focusin", handleFocus);
      if (returnFocus.current?.isConnected) returnFocus.current.focus();
    };
  }, [open]);

  return (
    <div ref={root}>
      <UnsavedChangesDialog
        open={open}
        onKeepEditing={() => settleClinicalRecordDiscard(false)}
        onDiscard={() => settleClinicalRecordDiscard(true)}
      />
    </div>
  );
}
