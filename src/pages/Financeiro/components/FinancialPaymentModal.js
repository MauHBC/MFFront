import React from "react";
import { FaTimes } from "react-icons/fa";
import PropTypes from "prop-types";
import styled from "styled-components";

import { PrimaryButton as SharedPrimaryButton } from "../../../components/AppButton";

export default function FinancialPaymentModal({
  flow,
  formatCurrency,
  paymentMethods,
  onRequestClose,
}) {
  if (!flow.isOpen) return null;

  const { context, form, preview } = flow;
  const selecting = flow.selectionFlow && flow.step === 1;
  const balanceLabel = preview.creditAfterCents > 0 ? "Saldo em credito" : "Valor pendente";
  const dateLabel = (value) => String(value || "").slice(0, 10).split("-").reverse().join("/");

  return (
    <>
      <ModalOverlay>
        <ModalCard role="dialog" aria-modal="true" aria-label={selecting ? "Selecionar cobranças" : "Registrar recebimento"}>
          <ModalHeader>
            <div>
              <ModalTitle>{selecting ? "Selecionar cobranças" : "Registrar recebimento"}</ModalTitle>
            </div>
            <IconButton type="button" onClick={flow.close}>
              <FaTimes />
            </IconButton>
          </ModalHeader>
          <ModalBody>
            {selecting ? (
              <>
                <FixedPatientDisplay>{context?.patientName}</FixedPatientDisplay>
                <p>Período: {context?.scopedPayment?.periodLabel || "Selecionado"}</p>
                <SelectionList>
                  {flow.groups.map((group) => (
                    <SelectionRow key={group.key}>
                      <input type="checkbox" checked={flow.selectedKeys.includes(group.key)}
                        onChange={() => flow.toggleSelection(group.key)} />
                      <span>{group.label}<small>{dateLabel(group.referenceDate)}</small></span>
                      <strong>{formatCurrency(group.entries.reduce((sum, entry) => sum + entry.openCents, 0))}</strong>
                    </SelectionRow>
                  ))}
                  {!flow.groups.length && <p>Nenhuma cobrança com saldo neste período.</p>}
                </SelectionList>
                <PaymentPreviewRow><span>Total selecionado</span><strong>{formatCurrency(preview.baseCents)}</strong></PaymentPreviewRow>
                {flow.creditOnly && flow.selectionReady && <p>Avançar sem selecionar cobranças, o valor ficará como crédito do paciente.</p>}
                {!flow.selectionReady && <p role="alert">Não foi possível carregar as cobranças. Atualize os dados antes de continuar.</p>}
              </>
            ) : <>
            <FormGrid>
              <Field>
                <Label>Paciente</Label>
                <FixedPatientDisplay title={context?.patientName}>
                  {context?.patientName}
                </FixedPatientDisplay>
              </Field>
              <Field>
                <Label htmlFor="payment-amount">Valor recebido</Label>
                <CurrencyInputGroup>
                  <CurrencyPrefix>R$</CurrencyPrefix>
                  <CurrencyInput
                    id="payment-amount"
                    name="amount"
                    value={form.amount}
                    onChange={flow.handleChange}
                    onBlur={flow.handleCurrencyBlur}
                    inputMode="decimal"
                    placeholder="0,00"
                  />
                </CurrencyInputGroup>
              </Field>
              <Field>
                <Label htmlFor="payment-date">Data do recebimento</Label>
                <Input
                  id="payment-date"
                  type="date"
                  name="paid_at"
                  value={String(form.paid_at || "").slice(0, 10)}
                  onChange={flow.handleChange}
                />
              </Field>
              <Field>
                <Label htmlFor="payment-method">Forma de pagamento</Label>
                <Select
                  id="payment-method"
                  name="payment_method_id"
                  value={form.payment_method_id}
                  onChange={flow.handleChange}
                >
                  <option value="">Selecione</option>
                  {paymentMethods.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </Select>
              </Field>
              {!flow.creditOnly && <Field>
                <Label htmlFor="payment-discount">Desconto</Label>
                <CurrencyInputGroup>
                  <CurrencyPrefix>R$</CurrencyPrefix>
                  <CurrencyInput
                    id="payment-discount"
                    name="discount"
                    value={form.discount}
                    onChange={flow.handleChange}
                    onBlur={flow.handleCurrencyBlur}
                    onFocus={(event) => {
                      if (/^0*(?:,0*)?$/.test(event.target.value.replace(/\./g, ""))) event.target.select();
                    }}
                    inputMode="decimal"
                    placeholder="0,00"
                  />
                </CurrencyInputGroup>
              </Field>}
            </FormGrid>
            {preview.discountCents > preview.baseCents && <p role="alert">O desconto não pode ultrapassar {formatCurrency(preview.baseCents)}.</p>}
            {flow.selectionStale && <p role="alert">As cobranças mudaram. Atualize os dados da página e reabra o recebimento para revisar os saldos atuais.</p>}
            <PaymentPreviewBox>
              <PaymentPreviewTitle>Resumo da operacao</PaymentPreviewTitle>
              {!flow.creditOnly && <>
              <PaymentPreviewRow>
                <span>Valor original</span>
                <strong>{formatCurrency(preview.baseCents || 0)}</strong>
              </PaymentPreviewRow>
              {preview.discountCents > 0 && (
                <PaymentPreviewRow>
                  <span>Desconto</span>
                  <strong>- {formatCurrency(preview.discountCents)}</strong>
                </PaymentPreviewRow>
              )}
              <PaymentPreviewDivider />
              <PaymentPreviewRow $total>
                <span>Total final</span>
                <strong>{formatCurrency(preview.finalChargedCents || 0)}</strong>
              </PaymentPreviewRow>
              </>}
              <PaymentPreviewRow>
                <span>Valor recebido</span>
                <strong>{formatCurrency(preview.receivedCents)}</strong>
              </PaymentPreviewRow>
              <PaymentPreviewRow $balance={preview.openAfterCents > 0 || preview.creditAfterCents > 0}>
                <span>{flow.creditOnly ? "Ficará como crédito" : balanceLabel}</span>
                <strong>
                  {formatCurrency(
                    preview.creditAfterCents > 0
                      ? preview.creditAfterCents
                      : preview.openAfterCents,
                  )}
                </strong>
              </PaymentPreviewRow>
            </PaymentPreviewBox>
            <Field>
              <Label htmlFor="payment-note">Observações</Label>
              <TextArea
                id="payment-note"
                name="note"
                rows="2"
                value={form.note}
                onChange={flow.handleChange}
              />
            </Field>
            </>}
          </ModalBody>
          <ModalActions>
            <SecondaryButton type="button" onClick={flow.close} disabled={flow.isSaving}>
              Cancelar
            </SecondaryButton>
            {flow.selectionFlow && !selecting && <SecondaryButton type="button" onClick={flow.back} disabled={flow.isSaving}>Voltar</SecondaryButton>}
            {selecting ? <PrimaryButton type="button" onClick={flow.advance} disabled={!flow.selectionReady || flow.selectionStale}>Avançar</PrimaryButton> :
            <PrimaryButton type="button" onClick={flow.save} disabled={flow.isSaving || flow.selectionStale || preview.discountCents > preview.baseCents}>
              {flow.isSaving ? <ButtonSpinner /> : "Confirmar recebimento"}
            </PrimaryButton>}
          </ModalActions>
        </ModalCard>
      </ModalOverlay>
      <Backdrop onClick={() => onRequestClose(flow.close, flow.hasInput)} />
    </>
  );
}

FinancialPaymentModal.propTypes = {
  flow: PropTypes.shape({
    selectionFlow: PropTypes.bool,
    selectionReady: PropTypes.bool,
    creditOnly: PropTypes.bool,
    selectionStale: PropTypes.bool,
    step: PropTypes.number,
    groups: PropTypes.arrayOf(PropTypes.shape({
      key: PropTypes.string, label: PropTypes.string, referenceDate: PropTypes.string,
      entries: PropTypes.arrayOf(PropTypes.shape({ openCents: PropTypes.number })),
    })),
    selectedKeys: PropTypes.arrayOf(PropTypes.string),
    toggleSelection: PropTypes.func,
    advance: PropTypes.func,
    back: PropTypes.func,
    close: PropTypes.func.isRequired,
    context: PropTypes.shape({ patientName: PropTypes.string,
      scopedPayment: PropTypes.shape({ periodLabel: PropTypes.string }) }),
    form: PropTypes.shape({
      amount: PropTypes.string,
      discount: PropTypes.string,
      note: PropTypes.string,
      paid_at: PropTypes.string,
      payment_method_id: PropTypes.string,
    }).isRequired,
    handleChange: PropTypes.func.isRequired,
    handleCurrencyBlur: PropTypes.func.isRequired,
    hasInput: PropTypes.bool.isRequired,
    isOpen: PropTypes.bool.isRequired,
    isSaving: PropTypes.bool.isRequired,
    preview: PropTypes.shape({
      baseCents: PropTypes.number,
      creditAfterCents: PropTypes.number,
      discountCents: PropTypes.number,
      finalChargedCents: PropTypes.number,
      openAfterCents: PropTypes.number,
      receivedCents: PropTypes.number,
    }).isRequired,
    save: PropTypes.func.isRequired,
  }).isRequired,
  formatCurrency: PropTypes.func.isRequired,
  onRequestClose: PropTypes.func.isRequired,
  paymentMethods: PropTypes.arrayOf(PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
    name: PropTypes.string.isRequired,
  })).isRequired,
};

const SelectionList = styled.div`display: grid; gap: 10px; margin: 16px 0;`;
const SelectionRow = styled.label`
  display: flex; align-items: center; gap: 12px; padding: 12px; border: 1px solid #d9dedb; border-radius: 8px;
  span { flex: 1; } small { display: block; color: #59665e; margin-top: 4px; }
`;

const ModalOverlay = styled.div`
  position: fixed;
  inset: 0;
  display: flex;
  justify-content: center;
  align-items: flex-start;
  padding: max(14px, env(safe-area-inset-top)) 16px 14px;
  overflow-y: auto;
  z-index: 2000;
`;

const ModalCard = styled.div`
  width: min(720px, calc(100vw - 32px));
  max-height: calc(100dvh - 28px);
  background: #fff;
  border-radius: 20px;
  padding: 24px;
  box-shadow: 0 18px 45px rgba(0, 0, 0, 0.15);
  z-index: 2001;
  display: flex;
  flex-direction: column;
  overflow: hidden;

  @media (max-width: 760px) {
    width: 100%;
    max-height: calc(100dvh - 16px);
    border-radius: 14px;
    padding: 16px;
  }
`;

const ModalHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
  margin-bottom: 20px;
`;

const ModalTitle = styled.h3`
  margin: 0;
  font-size: 20px;
`;

const IconButton = styled.button`
  border: none;
  background: transparent;
  font-size: 18px;
  color: #4a4a4a;
`;

const ModalBody = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  padding-right: 4px;
  margin-right: -4px;
`;

const FormGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 16px;
`;

const Field = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
`;

const Label = styled.label`
  font-weight: 600;
  color: #4a4a4a;
`;

const Input = styled.input`
  padding: 10px 12px;
  border-radius: 10px;
  border: 1px solid rgba(0, 0, 0, 0.15);
`;

const Select = styled.select`
  padding: 10px 12px;
  border-radius: 10px;
  border: 1px solid rgba(0, 0, 0, 0.15);
  background: #fff;
`;

const FixedPatientDisplay = styled.div`
  width: 100%;
  min-height: 44px;
  display: flex;
  align-items: center;
  padding: 10px 0;
  color: #1f2933;
  font-weight: 700;
  line-height: 1.35;
  white-space: normal;
  word-break: normal;
`;

const CurrencyInputGroup = styled.div`
  display: flex;
  align-items: center;
  border: 1px solid rgba(0, 0, 0, 0.15);
  border-radius: 10px;
  background: #fff;
  overflow: hidden;
`;

const CurrencyPrefix = styled.span`
  padding: 0 10px;
  font-weight: 700;
  color: #4a4a4a;
  border-right: 1px solid rgba(0, 0, 0, 0.1);
  background: #f7f7f7;
  min-height: 42px;
  display: inline-flex;
  align-items: center;
`;

const CurrencyInput = styled(Input)`
  border: none;
  border-radius: 0;
  flex: 1;
  min-width: 0;

  &:focus {
    outline: none;
  }
`;

const PaymentPreviewBox = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 14px 16px;
  border-radius: 12px;
  border: 1px solid rgba(106, 121, 92, 0.25);
  background: rgba(106, 121, 92, 0.08);
`;

const PaymentPreviewTitle = styled.h4`
  margin: 0;
  font-size: 14px;
  color: #2f3b26;
  text-transform: uppercase;
  letter-spacing: 0.04em;
`;

const PaymentPreviewRow = styled.div`
  display: flex;
  justify-content: space-between;
  gap: 10px;
  align-items: baseline;
  font-size: ${({ $total }) => ($total ? "15px" : "14px")};
  font-weight: ${({ $total }) => ($total ? 700 : 400)};
  color: #2f2f2f;

  strong {
    font-size: ${({ $total }) => ($total ? "18px" : "14px")};
    color: ${({ $balance }) => ($balance ? "#7a3f14" : "#2f2f2f")};
    white-space: nowrap;
  }
`;

const PaymentPreviewDivider = styled.div`
  height: 1px;
  background: rgba(47, 59, 38, 0.14);
  margin: 2px 0;
`;

const TextArea = styled.textarea`
  padding: 10px 12px;
  border-radius: 10px;
  border: 1px solid rgba(0, 0, 0, 0.15);
`;

const ModalActions = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 14px;
  padding-top: 12px;
  border-top: 1px solid rgba(0, 0, 0, 0.08);
  flex-shrink: 0;
`;

const PrimaryButton = styled(SharedPrimaryButton)`
  gap: 8px;
  border-radius: 12px;
  padding: 10px 16px;
  font-size: inherit;
  white-space: normal;
  transition: background 0.15s ease, transform 0.15s ease;

  &:hover:not(:disabled) {
    background: #5a684e;
  }

  &:disabled {
    opacity: 0.7;
  }
`;

const SecondaryButton = styled.button`
  background: #f2f2f2;
  color: #333;
  border: 1px solid rgba(0, 0, 0, 0.1);
  padding: 10px 16px;
  border-radius: 12px;
  font-weight: 700;
  cursor: pointer;
  transition: background 0.15s ease, border-color 0.15s ease;

  &:hover {
    background: #e6e6e6;
    border-color: rgba(0, 0, 0, 0.2);
  }

  &:disabled {
    opacity: 0.7;
    cursor: not-allowed;
  }
`;

const ButtonSpinner = styled.span`
  width: 16px;
  height: 16px;
  border-radius: 999px;
  border: 2px solid rgba(255, 255, 255, 0.35);
  border-top-color: #fff;
  animation: spin 0.8s linear infinite;

  @keyframes spin {
    to { transform: rotate(360deg); }
  }
`;

const Backdrop = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.35);
  z-index: 1990;
`;
