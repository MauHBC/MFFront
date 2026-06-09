/* eslint-disable react/prop-types */
import React from "react";
import { FaTimes } from "react-icons/fa";

export default function ClinicExpensePaymentModal({
  ui,
  form,
  isSaving,
  isEditing,
  onChange,
  onAmountBlur,
  onClose,
  onSave,
}) {
  const {
    ModalOverlay,
    ModalCard,
    ModalHeader,
    ModalTitle,
    ModalSubtitle,
    IconButton,
    ModalBody,
    Field,
    Label,
    Input,
    TextArea,
    ModalActions,
    SecondaryButton,
    PrimaryButton,
    Backdrop,
  } = ui;

  return (
    <>
      <ModalOverlay>
        <ModalCard>
          <ModalHeader>
            <div>
              <ModalTitle>Marcar como pago</ModalTitle>
              {isEditing ? <ModalSubtitle>Atualize os dados do pagamento.</ModalSubtitle> : null}
            </div>
            <IconButton type="button" onClick={onClose} disabled={isSaving}>
              <FaTimes />
            </IconButton>
          </ModalHeader>
          <ModalBody>
            <Field>
              <Label htmlFor="clinic-expense-payment-date">Data do pagamento</Label>
              <Input
                id="clinic-expense-payment-date"
                type="date"
                name="paid_at"
                value={form.paid_at}
                onChange={onChange}
              />
            </Field>
            <Field>
              <Label htmlFor="clinic-expense-payment-amount">Valor pago</Label>
              <Input
                id="clinic-expense-payment-amount"
                name="paid_amount"
                value={form.paid_amount}
                onChange={onChange}
                onBlur={onAmountBlur}
                placeholder="R$ 0,00"
              />
            </Field>
            <Field>
              <Label htmlFor="clinic-expense-payment-notes">Observação</Label>
              <TextArea
                id="clinic-expense-payment-notes"
                name="payment_notes"
                rows="3"
                value={form.payment_notes}
                onChange={onChange}
                placeholder="informações adicionais"
              />
            </Field>
          </ModalBody>
          <ModalActions>
            <SecondaryButton type="button" onClick={onClose} disabled={isSaving}>
              Cancelar
            </SecondaryButton>
            <PrimaryButton type="button" onClick={onSave} disabled={isSaving}>
              {isSaving ? "Salvando..." : "Confirmar pagamento"}
            </PrimaryButton>
          </ModalActions>
        </ModalCard>
      </ModalOverlay>
      <Backdrop onClick={onClose} />
    </>
  );
}
