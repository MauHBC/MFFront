/* eslint-disable react/prop-types */
import React from "react";
import { FaTimes } from "react-icons/fa";

export default function ClinicExpenseModal({
  ui,
  clinicExpenseForm,
  clinicExpenseCategories,
  editingClinicExpenseId,
  isClinicExpenseSaving,
  closeClinicExpenseModal,
  handleClinicExpenseChange,
  handleClinicExpenseAmountBlur,
  handleClinicExpensePaidAmountBlur,
  handleSaveClinicExpense,
}) {
  const {
    ModalOverlay,
    ModalCard,
    ModalHeader,
    ModalTitle,
    IconButton,
    ModalBody,
    Field,
    Label,
    Input,
    Select,
    FormGrid,
    TextArea,
    ModalActions,
    SecondaryButton,
    PrimaryButton,
    Backdrop,
    backdropHasInput,
    MutedText,
  } = ui;
  const isEditing = Boolean(editingClinicExpenseId);
  const isRecurring = clinicExpenseForm.recurrence_type === "monthly";
  const activeCategories = (clinicExpenseCategories || []).filter((category) => category.active);
  const currentCategory = (clinicExpenseCategories || []).find(
    (category) => String(category.id) === String(clinicExpenseForm.category_id || ""),
  );
  const categoryOptions = currentCategory && !currentCategory.active
    ? [currentCategory, ...activeCategories]
    : activeCategories;

  return (
    <>
      <ModalOverlay>
        <ModalCard>
          <ModalHeader>
            <div>
              <ModalTitle>{editingClinicExpenseId ? "Editar despesa" : "Nova despesa"}</ModalTitle>
            </div>
            <IconButton type="button" onClick={closeClinicExpenseModal} disabled={isClinicExpenseSaving}>
              <FaTimes />
            </IconButton>
          </ModalHeader>
          <ModalBody>
            <Field>
              <Label htmlFor="clinic-expense-description">Nome da despesa</Label>
              <Input
                id="clinic-expense-description"
                name="description"
                value={clinicExpenseForm.description}
                onChange={handleClinicExpenseChange}
                placeholder="Ex: Aluguel da clínica"
              />
            </Field>
            {isEditing && isRecurring ? (
              <MutedText>
                Esta despesa faz parte de uma recorrência mensal. Nesta versão, a edição altera apenas este mês.
              </MutedText>
            ) : null}
            <FormGrid>
              <Field>
                <Label htmlFor="clinic-expense-category">Categoria</Label>
                <Select
                  id="clinic-expense-category"
                  name="category_id"
                  value={clinicExpenseForm.category_id}
                  onChange={handleClinicExpenseChange}
                >
                  <option value="">Selecione</option>
                  {categoryOptions.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}{category.active ? "" : " (inativa)"}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field>
                <Label htmlFor="clinic-expense-amount">Valor</Label>
                <Input
                  id="clinic-expense-amount"
                  name="amount"
                  value={clinicExpenseForm.amount}
                  onChange={handleClinicExpenseChange}
                  onBlur={handleClinicExpenseAmountBlur}
                  placeholder="R$ 0,00"
                />
              </Field>
              <Field>
                <Label htmlFor="clinic-expense-due-date">Vencimento</Label>
                <Input
                  id="clinic-expense-due-date"
                  type="date"
                  name="due_date"
                  value={clinicExpenseForm.due_date}
                  onChange={handleClinicExpenseChange}
                />
              </Field>
              <Field>
                <Label htmlFor="clinic-expense-status">Já foi paga?</Label>
                <Select
                  id="clinic-expense-status"
                  name="status"
                  value={clinicExpenseForm.status}
                  onChange={handleClinicExpenseChange}
                >
                  <option value="open">Não</option>
                  <option value="paid">Sim</option>
                </Select>
              </Field>
            </FormGrid>
            {clinicExpenseForm.status === "paid" ? (
              <FormGrid>
                <Field>
                  <Label htmlFor="clinic-expense-paid-at">Data do pagamento</Label>
                  <Input
                    id="clinic-expense-paid-at"
                    type="date"
                    name="paid_at"
                    value={String(clinicExpenseForm.paid_at || "").slice(0, 10)}
                    onChange={handleClinicExpenseChange}
                  />
                </Field>
                <Field>
                  <Label htmlFor="clinic-expense-paid-amount">Valor pago</Label>
                  <Input
                    id="clinic-expense-paid-amount"
                    name="paid_amount"
                    value={clinicExpenseForm.paid_amount}
                    onChange={handleClinicExpenseChange}
                    onBlur={handleClinicExpensePaidAmountBlur}
                    placeholder="R$ 0,00"
                  />
                </Field>
                <Field>
                  <Label htmlFor="clinic-expense-payment-notes">Observação</Label>
                  <TextArea
                    id="clinic-expense-payment-notes"
                    name="payment_notes"
                    rows="3"
                    value={clinicExpenseForm.payment_notes}
                    onChange={handleClinicExpenseChange}
                  />
                </Field>
              </FormGrid>
            ) : null}
            {!isEditing ? (
              <Field>
                <Label htmlFor="clinic-expense-recurrence">Essa despesa se repete?</Label>
                <Select
                  id="clinic-expense-recurrence"
                  name="recurrence_type"
                  value={clinicExpenseForm.recurrence_type}
                  onChange={handleClinicExpenseChange}
                >
                  <option value="none">Não</option>
                  <option value="monthly">Sim, todos os meses</option>
                </Select>
                {isRecurring ? (
                  <MutedText>Serão criadas 12 despesas mensais, incluindo este mês.</MutedText>
                ) : null}
              </Field>
            ) : null}
            <Field>
              <Label htmlFor="clinic-expense-notes">Observações</Label>
              <TextArea
                id="clinic-expense-notes"
                name="notes"
                rows="3"
                value={clinicExpenseForm.notes}
                onChange={handleClinicExpenseChange}
                placeholder="Informações adicionais sobre essa despesa"
              />
            </Field>
          </ModalBody>
          <ModalActions>
            <SecondaryButton type="button" onClick={closeClinicExpenseModal} disabled={isClinicExpenseSaving}>
              Cancelar
            </SecondaryButton>
            <PrimaryButton type="button" onClick={handleSaveClinicExpense} disabled={isClinicExpenseSaving}>
              {isClinicExpenseSaving ? "Salvando..." : "Salvar despesa"}
            </PrimaryButton>
          </ModalActions>
        </ModalCard>
      </ModalOverlay>
      <Backdrop onClick={closeClinicExpenseModal} $hasInput={backdropHasInput} />
    </>
  );
}
