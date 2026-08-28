import React from "react";
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
import { colors } from "../../styles/tokens";

const MODE_COPY = {
  create: {
    title: "Criar acesso",
    submit: "Criar acesso",
    pending: "Criando...",
    notice: "A conta será criada ativa. Nenhum perfil ou permissão será atribuído automaticamente.",
  },
  reset: {
    title: "Redefinir senha",
    submit: "Redefinir senha",
    pending: "Redefinindo...",
    notice: "A senha anterior e todas as sessões emitidas anteriormente deixarão de ser válidas.",
  },
  block: {
    title: "Bloquear acesso",
    submit: "Bloquear acesso",
    pending: "Bloqueando...",
    notice: "A conta deixará de autenticar e as sessões anteriores serão invalidadas. A pessoa e seus perfis serão preservados.",
  },
  unblock: {
    title: "Desbloquear acesso",
    submit: "Desbloquear acesso",
    pending: "Desbloqueando...",
    notice: "A conta voltará a autenticar com a senha atual. Perfis e permissões existentes permanecerão inalterados.",
  },
};

export function validateAccountAccessForm(mode, values) {
  const errors = {};
  if (mode === "create") {
    const email = values.email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 255) {
      errors.email = "Informe um e-mail de login válido.";
    }
  }
  if (mode === "create" || mode === "reset") {
    const passwordLength = Array.from(values.password).length;
    if (passwordLength < 8 || passwordLength > 128) {
      errors.password = "A senha deve ter entre 8 e 128 caracteres.";
    }
    if (values.passwordConfirmation !== values.password) {
      errors.passwordConfirmation = "As senhas precisam ser iguais.";
    }
  }
  if (mode !== "create" && values.confirmed !== true) {
    errors.confirmed = "Confirme a operação para continuar.";
  }
  return errors;
}

export default function AccountAccessDrawer({ editor, onChange, onClose, onSubmit }) {
  const copy = MODE_COPY[editor.mode];
  const showPassword = editor.mode === "create" || editor.mode === "reset";
  return (
    <>
      <DrawerBackdrop onClick={onClose} />
      <AppDrawer $open role="dialog" aria-modal="true" aria-labelledby="account-access-title">
        <DrawerHeader>
          <DrawerTitle id="account-access-title">{copy.title}</DrawerTitle>
          <DrawerCloseBtn type="button" aria-label="Fechar gestão de acesso" onClick={onClose} disabled={editor.submitting}>
            <FaTimes />
          </DrawerCloseBtn>
        </DrawerHeader>
        <DrawerBody>
          <Form onSubmit={onSubmit} noValidate>
            <PersonSummary>
              <small>Integrante</small>
              <strong>{editor.person.name}</strong>
              {editor.person.account?.login && <span>{editor.person.account.login}</span>}
            </PersonSummary>
            {editor.mode === "create" && (
              <FieldGroup>
                <FieldLabel htmlFor="team-account-email">E-mail de login</FieldLabel>
                <FieldInput
                  autoFocus
                  id="team-account-email"
                  type="email"
                  autoComplete="off"
                  value={editor.values.email}
                  onChange={(event) => onChange("email", event.target.value)}
                  aria-invalid={Boolean(editor.errors.email)}
                  disabled={editor.submitting}
                />
                {editor.errors.email && <FieldError>{editor.errors.email}</FieldError>}
              </FieldGroup>
            )}
            {showPassword && (
              <>
                <FieldGroup>
                  <FieldLabel htmlFor="team-account-password">{editor.mode === "create" ? "Senha inicial" : "Nova senha"}</FieldLabel>
                  <FieldInput
                    id="team-account-password"
                    type="password"
                    autoComplete="new-password"
                    value={editor.values.password}
                    onChange={(event) => onChange("password", event.target.value)}
                    aria-invalid={Boolean(editor.errors.password)}
                    disabled={editor.submitting}
                  />
                  {editor.errors.password && <FieldError>{editor.errors.password}</FieldError>}
                </FieldGroup>
                <FieldGroup>
                  <FieldLabel htmlFor="team-account-password-confirmation">Confirmar senha</FieldLabel>
                  <FieldInput
                    id="team-account-password-confirmation"
                    type="password"
                    autoComplete="new-password"
                    value={editor.values.passwordConfirmation}
                    onChange={(event) => onChange("passwordConfirmation", event.target.value)}
                    aria-invalid={Boolean(editor.errors.passwordConfirmation)}
                    disabled={editor.submitting}
                  />
                  {editor.errors.passwordConfirmation && <FieldError>{editor.errors.passwordConfirmation}</FieldError>}
                </FieldGroup>
              </>
            )}
            <Notice>{copy.notice}</Notice>
            {editor.mode !== "create" && (
              <>
                <ConfirmLabel>
                  <input
                    type="checkbox"
                    checked={editor.values.confirmed}
                    onChange={(event) => onChange("confirmed", event.target.checked)}
                    disabled={editor.submitting}
                  />
                  Confirmo esta operação para {editor.person.name}.
                </ConfirmLabel>
                {editor.errors.confirmed && <FieldError>{editor.errors.confirmed}</FieldError>}
              </>
            )}
            {editor.apiError && <FormError role="alert">{editor.apiError}</FormError>}
            <DrawerFooter>
              <GhostButton type="button" onClick={onClose} disabled={editor.submitting}>Cancelar</GhostButton>
              <PrimaryButton type="submit" disabled={editor.submitting}>
                {editor.submitting ? copy.pending : copy.submit}
              </PrimaryButton>
            </DrawerFooter>
          </Form>
        </DrawerBody>
      </AppDrawer>
    </>
  );
}

AccountAccessDrawer.propTypes = {
  editor: PropTypes.shape({
    mode: PropTypes.oneOf(["create", "reset", "block", "unblock"]).isRequired,
    person: PropTypes.shape({
      name: PropTypes.string.isRequired,
      account: PropTypes.shape({ login: PropTypes.string }),
    }).isRequired,
    values: PropTypes.shape({
      email: PropTypes.string,
      password: PropTypes.string,
      passwordConfirmation: PropTypes.string,
      confirmed: PropTypes.bool,
    }).isRequired,
    errors: PropTypes.shape({
      email: PropTypes.string,
      password: PropTypes.string,
      passwordConfirmation: PropTypes.string,
      confirmed: PropTypes.string,
    }).isRequired,
    apiError: PropTypes.string.isRequired,
    submitting: PropTypes.bool.isRequired,
  }).isRequired,
  onChange: PropTypes.func.isRequired,
  onClose: PropTypes.func.isRequired,
  onSubmit: PropTypes.func.isRequired,
};

const fieldCss = `min-height: 42px; border: 1px solid #d9ded5; border-radius: 8px; background: #fff; color: #263124; padding: 9px 12px; font: inherit;`;
const Form = styled.form`display: grid; gap: 18px;`;
const PersonSummary = styled.div`display: grid; gap: 4px; padding-bottom: 14px; border-bottom: 1px solid #e8ebe5; small, span { color: ${colors.softText}; }`;
const FieldGroup = styled.div`display: grid; gap: 6px;`;
const FieldLabel = styled.label`color: ${colors.ink}; font-size: 0.88rem; font-weight: 700;`;
const FieldInput = styled.input`${fieldCss} &[aria-invalid="true"] { border-color: #b5473c; } &:focus-visible { outline: 3px solid rgba(106, 121, 92, 0.24); outline-offset: 1px; }`;
const FieldError = styled.small`color: #9f342b;`;
const Notice = styled.p`margin: 0; padding: 12px; border-radius: 8px; background: #f6f8f4; color: ${colors.softText}; font-size: 0.86rem; line-height: 1.45;`;
const ConfirmLabel = styled.label`display: flex; gap: 9px; align-items: flex-start; color: ${colors.ink}; font-size: 0.9rem; line-height: 1.4; cursor: pointer; input { margin-top: 3px; }`;
const FormError = styled.p`margin: 0; color: #9f342b; font-size: 0.88rem; font-weight: 700;`;
