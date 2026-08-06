import React, { useRef, useState } from "react";
import PropTypes from "prop-types";
import styled from "styled-components";
import { FaTimes } from "react-icons/fa";
import { toast } from "react-toastify";
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

const normalizedIdentityValues = (values) => ({
  profession: values.profession || "",
  registrationRegion: (values.registrationRegion || "").trim(),
  registrationNumber: (values.registrationNumber || "").trim().toUpperCase(),
});

const identityValuesChanged = (values, initialValues) => (
  JSON.stringify(normalizedIdentityValues(values))
  !== JSON.stringify(normalizedIdentityValues(initialValues))
);

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
  const initialValues = {
    profession: identity.profession || "physiotherapist",
    registrationRegion: identity.registrationRegion || "",
    registrationNumber: identity.registrationNumber || "",
  };
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState({});
  const [submittingAction, setSubmittingAction] = useState(null);
  const [apiError, setApiError] = useState("");
  const submittingRef = useRef(false);
  const submitting = Boolean(submittingAction);
  const hasChanges = identityValuesChanged(values, initialValues);
  const requiresVerification = !verified || hasChanges;
  const statusLabel = verified && hasChanges
    ? "Alterações ainda não verificadas"
    : STATUS_LABELS[identity.verificationStatus] || "Pendente";

  const update = (field, value) => {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
    setApiError("");
  };

  const submit = async (action) => {
    if (submittingRef.current) return;
    const validationErrors = validateProfessionalIdentity(values);
    if (Object.keys(validationErrors).length) {
      setErrors(validationErrors);
      return;
    }
    submittingRef.current = true;
    setSubmittingAction(action);
    setApiError("");
    let succeeded = false;
    try {
      const savedPerson = await saveTeamProfessionalIdentity(person.id, {
        action,
        activate: requiresActivation,
        profession: values.profession,
        registrationRegion: values.registrationRegion.trim(),
        registrationNumber: values.registrationNumber.trim(),
      });
      await onSaved(savedPerson);
      if (action === "verify") {
        toast.success("Dados profissionais verificados com sucesso.");
      } else if (creating) {
        toast.success("Profissional cadastrado. A verificação permanece pendente.");
      } else if (verified) {
        toast.success("Dados profissionais salvos e verificação definida como pendente.");
      } else {
        toast.success("Dados profissionais salvos como pendentes.");
      }
      succeeded = true;
    } catch (error) {
      const duplicate = error?.response?.data?.error
        === "PROFESSIONAL_REGISTRATION_ALREADY_EXISTS";
      setApiError(duplicate
        ? "Este registro profissional já está cadastrado para outra pessoa da clínica."
        : getUserFacingApiError(error, "Não foi possível salvar os dados profissionais."));
    } finally {
      submittingRef.current = false;
      if (!succeeded) setSubmittingAction(null);
    }
    if (succeeded) onClose();
  };

  const close = () => {
    if (!submitting) onClose();
  };

  let activationButtonLabel = creating
    ? "Cadastrar profissional"
    : "Reativar profissional";
  if (submitting) activationButtonLabel = "Salvando...";
  let pendingButtonLabel = verified ? "Salvar e tornar pendente" : "Salvar como pendente";
  if (submittingAction === "save_pending") pendingButtonLabel = "Salvando...";

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
            <strong>{statusLabel}</strong>
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
          {verified && hasChanges && (
            <Notice role="status">
              Os dados modificados ainda não estão verificados. Confirme a verificação
              para validar os novos dados ou salve como pendente.
            </Notice>
          )}
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
                  {pendingButtonLabel}
                </GhostButton>
                {requiresVerification && (
                  <PrimaryButton
                    type="button"
                    onClick={() => submit("verify")}
                    disabled={submitting}
                  >
                    {submittingAction === "verify"
                      ? "Confirmando..."
                      : "Confirmar verificação"}
                  </PrimaryButton>
                )}
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
