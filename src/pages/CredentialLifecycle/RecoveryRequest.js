import React, { useState } from "react";
import { isEmail } from "validator";
import { Link } from "react-router-dom";
import { requestCredentialRecovery } from "../../services/credentialLifecycle";
import { BackLink, Card, Form, Message, Page } from "./styled";

const GENERIC_SUCCESS = "Se a conta estiver apta, enviaremos um link para o e-mail informado.";

export default function RecoveryRequest() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const submit = async (event) => {
    event.preventDefault();
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
    <Page>
      <Card>
        <h1>Recuperar senha</h1>
        <p>Informe seu e-mail de acesso ao Motria.</p>
        {message ? <Message role="status">{message}</Message> : (
          <Form onSubmit={submit}>
            <label htmlFor="recovery-email">
              E-mail
              <input
                id="recovery-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </label>
            {error && <Message $error role="alert">{error}</Message>}
            <button type="submit" disabled={submitting}>
              {submitting ? "Enviando..." : "Enviar link"}
            </button>
          </Form>
        )}
        <BackLink as={Link} to="/login/">Voltar para o login</BackLink>
      </Card>
    </Page>
  );
}
