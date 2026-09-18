/* eslint-disable react/prop-types */
import React from "react";

export default function ClinicExpenseSettlementFields({ ui, form, onChange, requiresAdjustment }) {
  const { Field, Label, Input, TextArea } = ui;
  if (!requiresAdjustment) return null;
  return (
    <>
      <p>O valor pago é diferente do valor da despesa. Pagamento parcial não é suportado.</p>
      <Field>
        <Label>
          <Input
            type="checkbox"
            name="adjusted_final_confirmed"
            checked={Boolean(form.adjusted_final_confirmed)}
            onChange={onChange}
            style={{ width: "auto", marginRight: "8px" }}
          />
          Este valor quita integralmente a despesa.
        </Label>
      </Field>
      <Field>
        <Label htmlFor="clinic-expense-settlement-reason">Motivo da quitação com valor diferente</Label>
        <TextArea
          id="clinic-expense-settlement-reason"
          name="settlement_reason"
          rows="2"
          value={form.settlement_reason || ""}
          onChange={onChange}
        />
      </Field>
    </>
  );
}
