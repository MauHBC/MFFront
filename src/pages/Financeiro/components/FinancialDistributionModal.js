/* eslint-disable react/prop-types */
import React, { useEffect, useRef, useState } from "react";
import styled from "styled-components";
import { FaTimes } from "react-icons/fa";
import { colors } from "../../../styles/tokens";
import {
  buildDistributionCommand,
  validateDistributionParticipants,
} from "../helpers/distributionConfiguration";

export default function FinancialDistributionModal({
  ui,
  configuration,
  saving,
  error,
  onClose,
  onSave,
}) {
  const {
    ModalOverlay,
    ModalCard,
    ModalHeader,
    ModalTitle,
    ModalBody,
    ModalActions,
    Field,
    Label,
    Input,
    IconButton,
    PrimaryButton,
    SecondaryButton,
  } = ui;
  const sequence = useRef(0);
  const card = useRef(null);
  const [participants, setParticipants] = useState(() => {
    const existing = configuration.pending_rule || configuration.current_rule;
    return existing
      ? existing.participants.map((item, index) => ({
          row_id: `existing-${index}`,
          participant_id: item.participant_id,
          name: item.name,
          percentage: item.percentage,
        }))
      : [{ row_id: "first", name: "", percentage: "100" }];
  });
  const [apply, setApply] = useState(
    configuration.pending_rule ? "next_month" : "current_month",
  );
  const validation = validateDistributionParticipants(participants);
  useEffect(() => {
    const previousFocus = document.activeElement;
    card.current?.querySelector("input")?.focus();
    return () => {
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, []);
  const change = (rowId, field, value) =>
    setParticipants((previous) =>
      previous.map((item) =>
        item.row_id === rowId ? { ...item, [field]: value } : item,
      ),
    );
  const handleKeyDown = (event) => {
    if (event.key === "Escape" && !saving) {
      event.preventDefault();
      onClose();
    }
    if (event.key !== "Tab") return;
    const targets = [
      ...card.current.querySelectorAll(
        "button:not(:disabled), input:not(:disabled)",
      ),
    ];
    if (!targets.length) {
      event.preventDefault();
      card.current.focus();
      return;
    }
    const first = targets[0];
    const last = targets[targets.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  };
  return (
    <ModalOverlay style={{ background: "rgba(0, 0, 0, 0.28)" }}>
      <ModalCard
        ref={card}
        role="dialog"
        aria-modal="true"
        aria-labelledby="distribution-modal-title"
        tabIndex={-1}
        onKeyDown={handleKeyDown}
      >
        <ModalHeader>
          <ModalTitle id="distribution-modal-title">
            Configurar distribuição
          </ModalTitle>
          <IconButton
            type="button"
            aria-label="Fechar configuração"
            onClick={onClose}
            disabled={saving}
          >
            <FaTimes />
          </IconButton>
        </ModalHeader>
        <ModalBody>
          {!configuration.configured ? (
            <p>
              A primeira regra também será aplicada aos meses anteriores
              disponíveis.
            </p>
          ) : null}
          {configuration.pending_rule ? (
            <PendingNotice>
              <strong>
                Alteração programada para{" "}
                {configuration.pending_rule.effective_month
                  .split("-")
                  .reverse()
                  .join("/")}
              </strong>
              <ul>
                {configuration.pending_rule.participants.map((item) => (
                  <li key={item.participant_id}>
                    {item.name}: {item.percentage.replace(".", ",")}%
                  </li>
                ))}
              </ul>
              <p>
                Uma nova configuração substituirá esta alteração. Aplicar neste
                mês também cancela a programada.
              </p>
            </PendingNotice>
          ) : null}
          {participants.map((item, index) => (
            <ParticipantRow key={item.row_id}>
              <Field>
                <Label htmlFor={`distribution-name-${item.row_id}`}>
                  Participante {index + 1}
                </Label>
                <Input
                  id={`distribution-name-${item.row_id}`}
                  value={item.name}
                  maxLength={160}
                  disabled={saving}
                  onChange={(event) =>
                    change(item.row_id, "name", event.target.value)
                  }
                />
              </Field>
              <Field>
                <Label htmlFor={`distribution-percentage-${item.row_id}`}>
                  Percentual {index + 1} (%)
                </Label>
                <Input
                  id={`distribution-percentage-${item.row_id}`}
                  inputMode="decimal"
                  value={item.percentage}
                  disabled={saving}
                  onChange={(event) =>
                    change(item.row_id, "percentage", event.target.value)
                  }
                />
              </Field>
              <SecondaryButton
                type="button"
                aria-label={`Remover participante ${index + 1}`}
                disabled={saving}
                onClick={() =>
                  setParticipants((previous) =>
                    previous.filter((row) => row.row_id !== item.row_id),
                  )
                }
              >
                Remover
              </SecondaryButton>
            </ParticipantRow>
          ))}
          <SecondaryButton
            type="button"
            disabled={saving}
            onClick={() => {
              sequence.current += 1;
              setParticipants((previous) => [
                ...previous,
                { row_id: `new-${sequence.current}`, name: "", percentage: "" },
              ]);
            }}
          >
            Adicionar participante
          </SecondaryButton>
          <p aria-live="polite">
            Total percentual:{" "}
            {(validation.total / 100).toFixed(2).replace(".", ",")}%
          </p>
          {validation.error ? <p>{validation.error}</p> : null}
          {configuration.configured ? (
            <ApplicationChoice>
              <legend>Quando aplicar?</legend>
              <label htmlFor="distribution-apply-current">
                <input
                  id="distribution-apply-current"
                  type="radio"
                  name="distribution-application"
                  checked={apply === "current_month"}
                  disabled={saving}
                  onChange={() => setApply("current_month")}
                />{" "}
                Aplicar neste mês
              </label>
              <label htmlFor="distribution-apply-next">
                <input
                  id="distribution-apply-next"
                  type="radio"
                  name="distribution-application"
                  checked={apply === "next_month"}
                  disabled={saving}
                  onChange={() => setApply("next_month")}
                />{" "}
                Aplicar no próximo mês
              </label>
            </ApplicationChoice>
          ) : null}
          {error ? <p role="alert">{error}</p> : null}
        </ModalBody>
        <ModalActions>
          <SecondaryButton type="button" onClick={onClose} disabled={saving}>
            Cancelar
          </SecondaryButton>
          <PrimaryButton
            type="button"
            disabled={!validation.valid || saving}
            onClick={() =>
              onSave(
                buildDistributionCommand(configuration, participants, apply),
              )
            }
          >
            {saving ? "Salvando..." : "Salvar distribuição"}
          </PrimaryButton>
        </ModalActions>
      </ModalCard>
    </ModalOverlay>
  );
}

const ParticipantRow = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1fr) 130px auto;
  align-items: end;
  gap: 12px;
  @media (max-width: 600px) {
    grid-template-columns: minmax(0, 1fr) 100px;
    button {
      grid-column: 1 / -1;
      justify-self: end;
    }
  }
`;
const ApplicationChoice = styled.fieldset`
  border: 1px solid ${colors.borderSubtle};
  border-radius: 12px;
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  padding: 12px;
  label {
    display: flex;
    align-items: center;
    gap: 6px;
  }
`;
const PendingNotice = styled.div`
  padding: 12px 16px;
  background: ${colors.surfaceSecondary};
  border: 1px solid ${colors.borderSubtle};
  border-radius: 12px;
  p {
    margin-bottom: 0;
  }
`;
