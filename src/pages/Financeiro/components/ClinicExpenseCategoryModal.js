/* eslint-disable react/prop-types */
import React from "react";
import { FaTimes } from "react-icons/fa";

export default function ClinicExpenseCategoryModal({
  ui,
  form,
  editingId,
  isSaving,
  onChange,
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
    ModalActions,
    SecondaryButton,
    PrimaryButton,
    Backdrop,
    backdropHasInput,
  } = ui;

  return (
    <>
      <ModalOverlay>
        <ModalCard>
          <ModalHeader>
            <div>
              <ModalTitle>{editingId ? "Editar categoria" : "Nova categoria"}</ModalTitle>
              <ModalSubtitle>Organize os tipos de despesas usados pela clínica.</ModalSubtitle>
            </div>
            <IconButton type="button" onClick={onClose} disabled={isSaving}>
              <FaTimes />
            </IconButton>
          </ModalHeader>
          <ModalBody>
            <Field>
              <Label htmlFor="clinic-expense-category-name">Nome da categoria</Label>
              <Input
                id="clinic-expense-category-name"
                name="name"
                value={form.name}
                onChange={onChange}
                placeholder="Ex: Contabilidade"
              />
            </Field>
          </ModalBody>
          <ModalActions>
            <SecondaryButton type="button" onClick={onClose} disabled={isSaving}>
              Cancelar
            </SecondaryButton>
            <PrimaryButton type="button" onClick={onSave} disabled={isSaving}>
              {isSaving ? "Salvando..." : "Salvar categoria"}
            </PrimaryButton>
          </ModalActions>
        </ModalCard>
      </ModalOverlay>
      <Backdrop onClick={onClose} $hasInput={backdropHasInput} />
    </>
  );
}

