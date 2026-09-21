import React, { useEffect, useLayoutEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useDispatch } from "react-redux";
import { FiEye, FiEyeOff } from "react-icons/fi";
import PublicAuthShell from "../../components/PublicAuthShell";
import { Field, Form, LoadingStatus, PasswordControl, SubmitButton } from "../../components/PublicAuthShell/controls";
import {
  completeCredentialAction,
  inspectCredentialAction,
} from "../../services/credentialLifecycle";
import * as authActions from "../../store/modules/auth/actions";
import { ActionRow, Help, Message, StandaloneAction } from "./styled";

const readTokenFromFragment = () => {
  const params = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  return params.get("token") || "";
};

const passwordMessage = (code) => ({
  PASSWORD_TOO_SHORT: "A senha deve ter pelo menos 8 caracteres.",
  PASSWORD_TOO_LONG: "A senha deve ter no máximo 128 caracteres.",
  PASSWORD_COMMON_OR_COMPROMISED: "Escolha uma senha menos comum.",
  PASSWORD_CONFIRMATION_MISMATCH: "As senhas devem ser iguais.",
}[code] || "Não foi possível criar a senha. Verifique os dados e tente novamente.");

export default function CredentialAction() {
  const dispatch = useDispatch();
  const [token] = useState(readTokenFromFragment);
  const [state, setState] = useState("loading");
  const [purpose, setPurpose] = useState(null);
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [error, setError] = useState("");
  const [verificationAttempt, setVerificationAttempt] = useState(0);

  useLayoutEffect(() => {
    window.history.replaceState(
      window.history.state,
      document.title,
      `${window.location.pathname}${window.location.search}`,
    );
  }, []);

  useEffect(() => {
    let active = true;
    inspectCredentialAction(token)
      .then(({ data }) => {
        if (active) {
          setPurpose(data.purpose);
          setState("ready");
        }
      })
      .catch((requestError) => {
        if (!active) return;
        const status = requestError?.response?.status;
        setState(status === 404 ? "invalid" : "transient");
      });
    return () => { active = false; };
  }, [token, verificationAttempt]);

  const submit = async (event) => {
    event.preventDefault();
    if (state === "submitting") return;
    setError("");
    if (Array.from(password).length < 8 || Array.from(password).length > 128) {
      setError("A senha deve ter entre 8 e 128 caracteres.");
      return;
    }
    if (password !== confirmation) {
      setError("As senhas devem ser iguais.");
      return;
    }
    setState("submitting");
    try {
      await completeCredentialAction({ token, password, passwordConfirmation: confirmation });
      dispatch(authActions.loginFailure());
      setState("completed");
      setPassword("");
      setConfirmation("");
    } catch (requestError) {
      const code = requestError?.response?.data?.error;
      if (code === "CREDENTIAL_ACTION_INVALID") setState("invalid");
      else {
        const status = requestError?.response?.status;
        setError(!status || status >= 500 || status === 429
          ? "Não foi possível concluir agora. Tente novamente em instantes."
          : passwordMessage(code));
        setState("ready");
      }
    }
  };

  const title = {
    loading: "Verificando link",
    invalid: "Link inválido ou expirado",
    transient: "Não foi possível verificar o link",
    completed: purpose === "first_access" ? "Senha criada" : "Senha alterada",
  }[state] || (purpose === "first_access" ? "Crie sua senha" : "Defina uma nova senha");

  const description = {
    loading: "Aguarde um instante.",
    invalid: "Solicite um novo link para continuar.",
    transient: "Confira sua conexão e tente novamente.",
  }[state];
  const submitLabel = purpose === "first_access" ? "Criar senha" : "Salvar nova senha";

  return (
    <PublicAuthShell title={title} description={description}>
        {state === "loading" && <LoadingStatus role="status">Verificando link...</LoadingStatus>}
        {state === "invalid" && (
          <ActionRow><Link to="/recuperar-senha">Solicitar novo link</Link></ActionRow>
        )}
        {state === "transient" && (
          <StandaloneAction>
            <SubmitButton
              type="button"
              onClick={() => {
                setState("loading");
                setVerificationAttempt((current) => current + 1);
              }}
            >
              Tentar novamente
            </SubmitButton>
          </StandaloneAction>
        )}
        {state === "completed" && (
          <>
            <Message role="status">{purpose === "first_access"
              ? "Sua senha foi definida. Faça login para continuar."
              : "Sua senha foi atualizada. Faça login para continuar."}</Message>
            <ActionRow><Link to="/login">Ir para o login</Link></ActionRow>
          </>
        )}
        {(state === "ready" || state === "submitting") && (
            <Form onSubmit={submit} noValidate aria-busy={state === "submitting"}>
              <Field>
                <PasswordControl>
                  <label htmlFor="new-password">Nova senha
                    <input id="new-password" type={showPassword ? "text" : "password"} autoComplete="new-password" value={password} disabled={state === "submitting"} aria-describedby="password-help" onChange={(event) => setPassword(event.target.value)} />
                  </label>
                  <button type="button" aria-label={showPassword ? "Ocultar nova senha" : "Mostrar nova senha"} aria-pressed={showPassword} disabled={state === "submitting"} onClick={() => setShowPassword((current) => !current)}>
                    {showPassword ? <FiEyeOff aria-hidden="true" /> : <FiEye aria-hidden="true" />}
                  </button>
                </PasswordControl>
                <Help id="password-help">Mínimo de 8 caracteres</Help>
              </Field>
              <Field>
                <PasswordControl>
                  <label htmlFor="confirm-password">Confirmar senha
                    <input id="confirm-password" type={showConfirmation ? "text" : "password"} autoComplete="new-password" value={confirmation} disabled={state === "submitting"} onChange={(event) => setConfirmation(event.target.value)} />
                  </label>
                  <button type="button" aria-label={showConfirmation ? "Ocultar confirmação de senha" : "Mostrar confirmação de senha"} aria-pressed={showConfirmation} disabled={state === "submitting"} onClick={() => setShowConfirmation((current) => !current)}>
                    {showConfirmation ? <FiEyeOff aria-hidden="true" /> : <FiEye aria-hidden="true" />}
                  </button>
                </PasswordControl>
              </Field>
              {error && <Message $error role="alert">{error}</Message>}
              <SubmitButton type="submit" disabled={state === "submitting"}>
                {state === "submitting" ? "Salvando..." : submitLabel}
              </SubmitButton>
              {state === "submitting" && <LoadingStatus role="status">Salvando senha...</LoadingStatus>}
            </Form>
        )}
    </PublicAuthShell>
  );
}
