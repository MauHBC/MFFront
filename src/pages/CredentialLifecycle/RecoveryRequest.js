import React, { useState } from "react";
import { isEmail } from "validator";
import { Link } from "react-router-dom";
import PublicAuthShell from "../../components/PublicAuthShell";
import { Field, Form, SubmitButton, LoadingStatus } from "../../components/PublicAuthShell/controls";
import { requestCredentialRecovery } from "../../services/credentialLifecycle";
import { ActionRow, Message } from "./styled";

const GENERIC_SUCCESS = "Se a conta estiver apta, enviaremos um link para o e-mail informado.";

export default function RecoveryRequest() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const submit = async (event) => {
    event.preventDefault();
    if (submitting) return;
    setError("");
    if (!isEmail(email)) {
      setError("Informe um e-mail válido.");
      return;
    }
    setSubmitting(true);
    try {
      await requestCredentialRecovery(email);
      setMessage(GENERIC_SUCCESS);
    } catch {
      setError("Não foi possível solicitar o link agora. Tente novamente mais tarde.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <PublicAuthShell
      title="Recuperar senha"
      description="Informe seu e-mail para receber o link de recuperação."
    >
      {message ? <Message role="status">{message}</Message> : (
        <Form onSubmit={submit} noValidate aria-busy={submitting}>
          <Field>
            <label htmlFor="recovery-email">E-mail
              <input
                id="recovery-email"
                type="email"
                autoComplete="email"
                inputMode="email"
                placeholder="seu@email.com"
                value={email}
                disabled={submitting}
                aria-invalid={Boolean(error)}
                aria-describedby={error ? "recovery-error" : undefined}
                onChange={(event) => setEmail(event.target.value)}
              />
            </label>
          </Field>
          {error && <Message $error id="recovery-error" role="alert">{error}</Message>}
          <SubmitButton type="submit" disabled={submitting}>
            {submitting ? "Enviando..." : "Enviar link"}
          </SubmitButton>
          {submitting && <LoadingStatus role="status">Enviando solicitação...</LoadingStatus>}
        </Form>
      )}
      <ActionRow><Link to="/login">Voltar para o login</Link></ActionRow>
    </PublicAuthShell>
  );
}
