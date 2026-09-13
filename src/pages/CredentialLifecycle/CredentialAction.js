import React, { useEffect, useLayoutEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useDispatch } from "react-redux";
import {
  completeCredentialAction,
  inspectCredentialAction,
} from "../../services/credentialLifecycle";
import * as authActions from "../../store/modules/auth/actions";
import { BackLink, Card, Form, Message, Page } from "./styled";

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

  return (
    <Page>
      <Card>
        {state === "loading" && <><h1>Verificando link</h1><p>Aguarde um instante.</p></>}
        {state === "invalid" && (
          <>
            <h1>Link inválido ou expirado</h1>
            <p>Solicite um novo link para continuar.</p>
            <BackLink as={Link} to="/recuperar-senha">Solicitar novo link</BackLink>
          </>
        )}
        {state === "transient" && (
          <>
            <h1>Não foi possível verificar o link</h1>
            <p>Confira sua conexão e tente novamente.</p>
            <button
              type="button"
              onClick={() => {
                setState("loading");
                setVerificationAttempt((current) => current + 1);
              }}
            >
              Tentar novamente
            </button>
          </>
        )}
        {state === "completed" && (
          <>
            <h1>Senha criada</h1>
            <Message role="status">Sua senha foi definida. Faça login para continuar.</Message>
            <BackLink as={Link} to="/login/">Ir para o login</BackLink>
          </>
        )}
        {(state === "ready" || state === "submitting") && (
          <>
            <h1>{purpose === "first_access" ? "Crie sua senha" : "Defina uma nova senha"}</h1>
            <p>Use de 8 a 128 caracteres. A senha é única para todas as suas clínicas.</p>
            <Form onSubmit={submit}>
              <label htmlFor="new-password">Nova senha
                <input id="new-password" type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} />
              </label>
              <label htmlFor="confirm-password">Confirmar senha
                <input id="confirm-password" type="password" autoComplete="new-password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} />
              </label>
              {error && <Message $error role="alert">{error}</Message>}
              <button type="submit" disabled={state === "submitting"}>
                {state === "submitting" ? "Salvando..." : "Criar senha"}
              </button>
            </Form>
          </>
        )}
      </Card>
    </Page>
  );
}
