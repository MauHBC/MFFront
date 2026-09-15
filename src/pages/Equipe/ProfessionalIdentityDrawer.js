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
  pending: "Dados profissionais aguardando conferência",
  verified: "Dados profissionais conferidos",
});

const normalizedIdentityValues = (values) => ({
  profession: (values.profession || "").trim().toLowerCase(),
  registrationRegion: (values.registrationRegion || "")
    .trim().replace(/^CREFITO[-\s]*/i, "").toUpperCase(),
  registrationNumber: (values.registrationNumber || "").trim().toUpperCase(),
});

const identityValuesChanged = (values, initialValues) => (
  JSON.stringify(normalizedIdentityValues(values))
  !== JSON.stringify(normalizedIdentityValues(initialValues))
);

export const validateProfessionalIdentity = (values, requiresEmail = false) => {
  const errors = {};
  if (requiresEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((values.email || "").trim())) {
    errors.email = "Informe um e-mail válido para o acesso profissional.";
  }
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
  const requiresAccess = !person.account;
  const verified = identity.verificationStatus === "verified";
  const initialValues = {
    email: person.account?.login || person.email || "",
    profession: identity.profession || "physiotherapist",
    registrationRegion: identity.registrationRegion || "",
    registrationNumber: identity.registrationNumber || "",
  };
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState({});
  const [submittingAction, setSubmittingAction] = useState(null);
  const [apiError, setApiError] = useState("");
  const [verificationConfirmed, setVerificationConfirmed] = useState(false);
  const submittingRef = useRef(false);
  const submitting = Boolean(submittingAction);
  const hasChanges = identityValuesChanged(values, initialValues);
  const accessEmailChanged = requiresAccess
    && values.email.trim().toLowerCase() !== initialValues.email.trim().toLowerCase();
  const requiresVerification = !verified || hasChanges;
  const statusLabel = verified && hasChanges
    ? "Dados profissionais aguardando conferência"
    : STATUS_LABELS[identity.verificationStatus]
      || "Dados profissionais aguardando conferência";
  const hasAction = requiresActivation
    || hasChanges
    || accessEmailChanged
    || (requiresVerification && verificationConfirmed);

  const update = (field, value) => {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
    setApiError("");
    setVerificationConfirmed(false);
  };

  const submit = async () => {
    if (submittingRef.current) return;
    if (!hasAction) return;
    const action = verificationConfirmed ? "verify" : "save_pending";
    const validationErrors = validateProfessionalIdentity(values, requiresAccess);
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
        ...(requiresAccess ? { email: values.email.trim() } : {}),
        profession: values.profession,
        registrationRegion: values.registrationRegion.trim(),
        registrationNumber: values.registrationNumber.trim(),
      });
      await onSaved(savedPerson);
      if (action === "verify") {
        toast.success("Dados profissionais conferidos com sucesso.");
      } else if (creating) {
        toast.success("Profissional cadastrado. Os dados aguardam conferência.");
      } else if (verified && !hasChanges) {
        toast.success("Dados profissionais salvos com a conferência preservada.");
      } else {
        toast.success("Dados profissionais salvos aguardando conferência.");
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
          {requiresAccess && (
            <>
              <FieldLabel htmlFor="professional-access-email">E-mail de acesso</FieldLabel>
              <FieldInput
                id="professional-access-email"
                type="email"
                value={values.email}
                onChange={(event) => update("email", event.target.value)}
                disabled={submitting}
                aria-invalid={Boolean(errors.email)}
              />
              {errors.email && <FieldError>{errors.email}</FieldError>}
            </>
          )}
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
            fica registrada na auditoria e não realiza consulta automática ao conselho
            profissional.
          </Notice>
          {requiresAccess && (
            <Notice>
              Ao salvar, o perfil Profissional será atribuído. Se ainda não tiver senha,
              a própria pessoa poderá criá-la no primeiro acesso.
            </Notice>
          )}
          {requiresVerification && (
            <CheckboxLabel>
              <input
                type="checkbox"
                checked={verificationConfirmed}
                onChange={(event) => {
                  setVerificationConfirmed(event.target.checked);
                  setApiError("");
                }}
                disabled={submitting}
              />
              Conferi os dados profissionais
            </CheckboxLabel>
          )}
          {hasChanges && !verificationConfirmed && (
            <Notice role="status">
              Os dados alterados serão salvos aguardando conferência.
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
            <PrimaryButton
              type="button"
              onClick={submit}
              disabled={submitting || !hasAction}
            >
              {submitting ? "Salvando..." : "Salvar"}
            </PrimaryButton>
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
    email: PropTypes.string,
    account: PropTypes.shape({ login: PropTypes.string }),
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

const CheckboxLabel = styled.label`
  display: flex;
  align-items: flex-start;
  gap: 10px;
  margin-top: 18px;
  color: ${colors.text};
  line-height: 1.4;
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
