import React, { useState } from "react";
import PropTypes from "prop-types";
import styled from "styled-components";
import { FaTimes } from "react-icons/fa";
import {
  AppDrawer,
  DrawerBackdrop,
  DrawerBody,
  DrawerCloseBtn,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "../../components/AppDrawer";
import { GhostButton, PrimaryButton } from "../../components/AppButton";
import { getUserFacingApiError } from "../../services/axios";
import { saveTeamProfessionalIdentity } from "../../services/team";
import { colors } from "../../styles/tokens";

const STATUS_LABELS = Object.freeze({
  pending: "Pendente",
  verified: "Verificado",
});

export const validateProfessionalIdentity = (values) => {
  const errors = {};
  if (values.profession !== "physiotherapist") {
    errors.profession = "Selecione uma profissão válida.";
  }
  if (!/^[0-9]{1,2}$/.test(values.registrationRegion.trim())) {
    errors.registrationRegion = "Informe a região do CREFITO com um ou dois dígitos.";
  }
  if (!/^[0-9A-Za-z./-]{2,40}$/.test(values.registrationNumber.trim())) {
    errors.registrationNumber = "Informe um número de CREFITO válido.";
  }
  return errors;
};

export default function ProfessionalIdentityDrawer({ person, onClose, onSaved }) {
  const identity = person.professionalIdentity || {};
  const requiresActivation = !person.isProfessional || person.professionalActive !== true;
  const creating = !person.isProfessional;
  const verified = identity.verificationStatus === "verified";
  const [values, setValues] = useState({
    profession: identity.profession || "physiotherapist",
    registrationRegion: identity.registrationRegion || "",
    registrationNumber: identity.registrationNumber || "",
  });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [apiError, setApiError] = useState("");

  const update = (field, value) => {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
    setApiError("");
  };

  const submit = async (action) => {
    if (submitting) return;
    const validationErrors = validateProfessionalIdentity(values);
    if (Object.keys(validationErrors).length) {
      setErrors(validationErrors);
      return;
    }
    setSubmitting(true);
    setApiError("");
    try {
      await saveTeamProfessionalIdentity(person.id, {
        action,
        activate: requiresActivation,
        profession: values.profession,
        registrationRegion: values.registrationRegion.trim(),
        registrationNumber: values.registrationNumber.trim(),
      });
      await onSaved();
      onClose();
    } catch (error) {
      const duplicate = error?.response?.data?.error
        === "PROFESSIONAL_REGISTRATION_ALREADY_EXISTS";
      setApiError(duplicate
        ? "Este registro profissional já está cadastrado para outra pessoa da clínica."
        : getUserFacingApiError(error, "Não foi possível salvar os dados profissionais."));
    } finally {
      setSubmitting(false);
    }
  };

  const close = () => {
    if (!submitting) onClose();
  };

  let activationButtonLabel = creating
    ? "Cadastrar profissional"
    : "Reativar profissional";
  if (submitting) activationButtonLabel = "Salvando...";

  return (
    <>
      <DrawerBackdrop onClick={close} />
      <AppDrawer
        $open
        role="dialog"
        aria-modal="true"
        aria-labelledby="professional-identity-title"
      >
        <DrawerHeader>
          <DrawerTitle id="professional-identity-title">
            {creating ? "Cadastrar como profissional" : "Dados profissionais"}
          </DrawerTitle>
          <DrawerCloseBtn type="button" onClick={close} aria-label="Fechar" disabled={submitting}>
            <FaTimes />
          </DrawerCloseBtn>
        </DrawerHeader>
        <DrawerBody>
          <StatusText>
            {person.name} · situação:{" "}
            <strong>{STATUS_LABELS[identity.verificationStatus] || "Pendente"}</strong>
          </StatusText>
          <FieldLabel htmlFor="professional-profession">Profissão</FieldLabel>
          <FieldSelect
            id="professional-profession"
            value={values.profession}
            onChange={(event) => update("profession", event.target.value)}
            disabled={submitting}
            aria-invalid={Boolean(errors.profession)}
          >
            <option value="physiotherapist">Fisioterapeuta</option>
          </FieldSelect>
          {errors.profession && <FieldError>{errors.profession}</FieldError>}

          <FieldLabel htmlFor="professional-crefito-region">Região do CREFITO</FieldLabel>
          <FieldInput
            id="professional-crefito-region"
            value={values.registrationRegion}
            onChange={(event) => update("registrationRegion", event.target.value)}
            placeholder="Ex.: 15"
            disabled={submitting}
            aria-invalid={Boolean(errors.registrationRegion)}
          />
          {errors.registrationRegion && <FieldError>{errors.registrationRegion}</FieldError>}

          <FieldLabel htmlFor="professional-crefito-number">Número do CREFITO</FieldLabel>
          <FieldInput
            id="professional-crefito-number"
            value={values.registrationNumber}
            onChange={(event) => update("registrationNumber", event.target.value)}
            placeholder="Ex.: 12345-F"
            disabled={submitting}
            aria-invalid={Boolean(errors.registrationNumber)}
          />
          {errors.registrationNumber && <FieldError>{errors.registrationNumber}</FieldError>}

          <Notice>
            Preencher estes dados não os torna verificados. A confirmação administrativa
            fica registrada na auditoria e não concede perfil ou permissão.
          </Notice>
          {requiresActivation && (
            <Notice>
              Ao salvar, a atuação profissional será {creating ? "criada" : "reativada"}
              {" "}na mesma operação.
            </Notice>
          )}
          {apiError && <ErrorText role="alert">{apiError}</ErrorText>}
          <DrawerFooter>
            <GhostButton type="button" onClick={close} disabled={submitting}>Cancelar</GhostButton>
            {requiresActivation ? (
              <PrimaryButton
                type="button"
                onClick={() => submit("save_pending")}
                disabled={submitting}
              >
                {activationButtonLabel}
              </PrimaryButton>
            ) : (
              <>
                <GhostButton
                  type="button"
                  onClick={() => submit("save_pending")}
                  disabled={submitting}
                >
                  {verified ? "Salvar e tornar pendente" : "Salvar como pendente"}
                </GhostButton>
                <PrimaryButton
                  type="button"
                  onClick={() => submit("verify")}
                  disabled={submitting}
                >
                  Confirmar verificação
                </PrimaryButton>
              </>
            )}
          </DrawerFooter>
        </DrawerBody>
      </AppDrawer>
    </>
  );
}

ProfessionalIdentityDrawer.propTypes = {
  person: PropTypes.shape({
    id: PropTypes.number.isRequired,
    name: PropTypes.string.isRequired,
    isProfessional: PropTypes.bool,
    professionalActive: PropTypes.bool,
    professionalIdentity: PropTypes.shape({
      profession: PropTypes.string,
      registrationRegion: PropTypes.string,
      registrationNumber: PropTypes.string,
      verificationStatus: PropTypes.string,
    }),
  }).isRequired,
  onClose: PropTypes.func.isRequired,
  onSaved: PropTypes.func.isRequired,
};

const FieldLabel = styled.label`
  display: block;
  margin: 18px 0 6px;
  font-weight: 700;
`;

const FieldInput = styled.input`
  width: 100%;
  min-height: 46px;
  padding: 10px 14px;
  border: 1px solid ${colors.border};
  border-radius: 12px;
  background: ${colors.surface};
`;

const FieldSelect = styled.select`
  width: 100%;
  min-height: 46px;
  padding: 10px 14px;
  border: 1px solid ${colors.border};
  border-radius: 12px;
  background: ${colors.surface};
`;

const StatusText = styled.p`
  margin: 8px 0 16px;
`;

const Notice = styled.p`
  margin: 18px 0 0;
  color: ${colors.textMuted};
  line-height: 1.5;
`;

const FieldError = styled.p`
  margin: 6px 0 0;
  color: ${colors.danger};
  font-size: 0.85rem;
`;

const ErrorText = styled.p`
  margin: 16px 0 0;
  color: ${colors.danger};
  font-weight: 700;
`;
