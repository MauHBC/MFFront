import React, { useEffect, useRef } from "react";
import PropTypes from "prop-types";
import styled from "styled-components";

export const CLINICAL_SIGNATURE_WARNING =
  "Após assinar, este registro não poderá ser editado. Correções futuras deverão ser feitas por adendo.";

export default function ClinicalSignatureConfirmModal({
  open,
  loading = false,
  error = "",
  onCancel,
  onConfirm,
}) {
  const cancelButtonRef = useRef(null);
  const invokingRef = useRef(false);

  useEffect(() => {
    if (!open) {
      invokingRef.current = false;
      return undefined;
    }
    cancelButtonRef.current?.focus();
    const handleKeyDown = (event) => {
      if (event.key === "Escape" && !loading) onCancel();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [loading, onCancel, open]);

  if (!open) return null;

  const confirmOnce = async () => {
    if (loading || invokingRef.current) return;
    invokingRef.current = true;
    try {
      await onConfirm();
    } finally {
      invokingRef.current = false;
    }
  };

  const cancel = () => {
    if (!loading) onCancel();
  };

  return (
    <Overlay
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) cancel();
      }}
    >
      <Card
        role="dialog"
        aria-modal="true"
        aria-labelledby="clinical-signature-confirm-title"
        aria-describedby="clinical-signature-confirm-description"
      >
        <Header>
          <Title id="clinical-signature-confirm-title">Salvar e assinar?</Title>
        </Header>
        <Body>
          <Warning id="clinical-signature-confirm-description">
            {CLINICAL_SIGNATURE_WARNING}
          </Warning>
          {error && <ErrorMessage role="alert">{error}</ErrorMessage>}
        </Body>
        <Footer>
          <SecondaryButton
            ref={cancelButtonRef}
            type="button"
            onClick={cancel}
            disabled={loading}
          >
            Cancelar
          </SecondaryButton>
          <PrimaryButton type="button" onClick={confirmOnce} disabled={loading}>
            {loading ? "Salvando e assinando..." : "Salvar e assinar"}
          </PrimaryButton>
        </Footer>
      </Card>
    </Overlay>
  );
}

ClinicalSignatureConfirmModal.propTypes = {
  open: PropTypes.bool.isRequired,
  loading: PropTypes.bool.isRequired,
  error: PropTypes.string.isRequired,
  onCancel: PropTypes.func.isRequired,
  onConfirm: PropTypes.func.isRequired,
};

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  z-index: 1400;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  background: rgba(27, 27, 27, 0.42);
`;

const Card = styled.div`
  width: min(520px, 100%);
  overflow: hidden;
  border: 1px solid rgba(106, 121, 92, 0.18);
  border-radius: 16px;
  background: #fff;
  box-shadow: 0 24px 70px rgba(0, 0, 0, 0.22);
`;

const Header = styled.div`
  padding: 18px 18px 12px;
  border-bottom: 1px solid rgba(106, 121, 92, 0.12);
`;

const Title = styled.h2`
  margin: 0;
  color: #1b1b1b;
  font-size: 1.25rem;
`;

const Body = styled.div`
  display: grid;
  gap: 12px;
  padding: 18px;
`;

const Warning = styled.p`
  margin: 0;
  color: #45513f;
  line-height: 1.55;
`;

const ErrorMessage = styled.div`
  padding: 11px 12px;
  border: 1px solid rgba(180, 63, 63, 0.28);
  border-radius: 10px;
  background: #fff3f3;
  color: #8b2424;
  font-size: 0.9rem;
  line-height: 1.45;
`;

const Footer = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 14px 18px 18px;
  border-top: 1px solid rgba(106, 121, 92, 0.12);
`;

const Button = styled.button`
  min-height: 40px;
  padding: 0 16px;
  border-radius: 10px;
  font-weight: 800;
  cursor: pointer;

  &:disabled {
    cursor: not-allowed;
    opacity: 0.65;
  }

  &:focus-visible {
    outline: 3px solid rgba(106, 121, 92, 0.22);
    outline-offset: 2px;
  }
`;

const SecondaryButton = styled(Button)`
  border: 1px solid rgba(106, 121, 92, 0.24);
  background: #fff;
  color: #55644c;
`;

const PrimaryButton = styled(Button)`
  border: 1px solid #55644c;
  background: #55644c;
  color: #fff;
`;
