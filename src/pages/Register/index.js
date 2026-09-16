import React from "react";
import PropTypes from "prop-types";
import { Link } from "react-router-dom";
import { useAuthorization } from "../../contexts/AuthorizationContext";
import { Container } from "../../styles/GlobalStyles";
import LegacyAccountForm from "./LegacyAccountForm";

export default function Register({ history }) {
  const authorization = useAuthorization();
  // MyRoute keeps authentication/administratorOnly; never mount legacy effects
  // before the current session's official authorization has resolved.
  if (authorization.status !== "ready" || !authorization.isAdministrator) return null;

  const source = authorization.context?.authorization_source;
  if (source === "membership") {
    return (
      <Container>
        <h1>Editar minha conta</h1>
        <p>A edição da conta não está disponível nesta versão.</p>
        <p>Para redefinir sua senha, use a recuperação por e-mail.</p>
        <Link to="/recuperar-senha">Recuperar senha</Link>
        <Link to="/menu">Voltar ao início</Link>
      </Container>
    );
  }

  // The current legacy context omits authorization_source. Only that resolved
  // contract (or explicit legacy) may mount the existing self-account form.
  if (authorization.context && (source === undefined || source === "legacy")) {
    return <LegacyAccountForm history={history} />;
  }
  return <div role="alert">Não foi possível validar seu acesso.</div>;
}

Register.propTypes = {
  history: PropTypes.shape({ push: PropTypes.func.isRequired }),
};

Register.defaultProps = { history: undefined };
