import React, { useState } from "react";
import { toast } from "react-toastify";
import { isEmail } from "validator";
import { useSelector, useDispatch } from "react-redux";
import PropTypes from "prop-types";

import { Container } from "../../styles/GlobalStyles";
import { Form } from "./styled";
import Loading from "../../components/Loading";
import * as actions from "../../store/modules/auth/actions";
import { deactivateOwnAccount, updateOwnAccount } from "../../services/account";

export default function Register(props) {
  // const stateauth = useSelector((state) => console.log(state.auth));
  const dispatch = useDispatch();
  const id = useSelector((state) => state.auth.user.id);
  const nomeStored = useSelector((state) => state.auth.user.name);
  const emailStored = useSelector((state) => state.auth.user.email);
  const isLoading = useSelector((state) => state.auth.user.isLoading);
  const { history } = props;

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [deactivationPassword, setDeactivationPassword] = useState("");
  const [confirmingDeactivation, setConfirmingDeactivation] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  React.useEffect(() => {
    if (!id) return;

    setName(nomeStored);
    setEmail(emailStored);
  }, [id, nomeStored, emailStored]);

  async function handleSubmit(e) {
    e.preventDefault();

    let formErrors = false;

    if (name.length < 3 || name.length > 255) {
      formErrors = true;
      toast.error("Nome deve ter entre 3 e 255 caracteres");
    }

    if (!isEmail(email)) {
      formErrors = true;
      toast.error("Email inválido");
    }

    const passwordLength = Array.from(password).length;
    if ((!id || password) && (passwordLength < 8 || passwordLength > 128)) {
      formErrors = true;
      toast.error("A senha deve ter entre 8 e 128 caracteres.");
    }

    const emailChanged = Boolean(id)
      && email.trim().toLowerCase() !== String(emailStored || "").trim().toLowerCase();
    const sensitive = Boolean(id) && (emailChanged || Boolean(password));

    if (sensitive && !currentPassword) {
      formErrors = true;
      toast.error("Informe sua senha atual para confirmar esta alteração.");
    }

    if (formErrors) return;

    if (!id) {
      dispatch(actions.registerRequest({ name, email, password, id, history }));
      return;
    }

    setSubmitting(true);
    try {
      await updateOwnAccount({ name, email, password, currentPassword });
      setCurrentPassword("");
      setPassword("");
      if (sensitive) {
        toast.success("Alteração concluída. Entre novamente com seus dados atualizados.");
        dispatch(actions.loginFailure());
        history.push("/login");
        return;
      }
      dispatch(actions.registerUpdatedSuccess({ name, email }));
      toast.success("Conta alterada com sucesso!");
    } catch (error) {
      setCurrentPassword("");
      const status = error?.response?.status;
      const code = error?.response?.data?.error;
      if (status === 401) {
        toast.error("Você precisa fazer login novamente.");
        dispatch(actions.loginFailure());
        history.push("/login");
      } else if (status === 403 && code === "ACCOUNT_REAUTHENTICATION_FAILED") {
        toast.error("Não foi possível confirmar sua identidade.");
      } else if (status === 409) {
        toast.error("Não foi possível usar esse e-mail.");
      } else if (code === "PASSWORD_COMMON_OR_COMPROMISED") {
        toast.error("Escolha uma senha menos comum e que não esteja comprometida.");
      } else if (["INVALID_PASSWORD", "PASSWORD_TOO_SHORT", "PASSWORD_TOO_LONG"].includes(code)) {
        toast.error("A senha deve ter entre 8 e 128 caracteres.");
      } else {
        toast.error("Não foi possível alterar sua conta.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeactivate() {
    if (!deactivationPassword) {
      toast.error("Informe sua senha atual para confirmar a desativação.");
      return;
    }
    setSubmitting(true);
    try {
      await deactivateOwnAccount(deactivationPassword);
      setDeactivationPassword("");
      toast.success("Conta desativada com segurança.");
      dispatch(actions.loginFailure());
      history.push("/login");
    } catch (error) {
      setDeactivationPassword("");
      const status = error?.response?.status;
      const code = error?.response?.data?.error;
      if (status === 401) {
        toast.error("Você precisa fazer login novamente.");
        dispatch(actions.loginFailure());
        history.push("/login");
      } else if (status === 403 && code === "ACCOUNT_REAUTHENTICATION_FAILED") {
        toast.error("Não foi possível confirmar sua identidade.");
      } else {
        toast.error("Não foi possível desativar sua conta.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  const emailChanged = Boolean(id)
    && email.trim().toLowerCase() !== String(emailStored || "").trim().toLowerCase();
  const requiresCurrentPassword = Boolean(id) && (emailChanged || Boolean(password));

  return (
    <Container>
      <Loading isLoading={isLoading || submitting} />

      <h1>{id ? "Editar minha conta" : "Crie sua conta"}</h1>

      <Form onSubmit={(e) => handleSubmit(e, name)}>
        <label htmlFor="name">
          Nome:
          <input
            id="name"
            autoComplete="off"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Seu nome"
          />
        </label>

        <label htmlFor="email">
          E-mail:
          <input
            id="email"
            autoComplete="off"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Seu e-mail"
          />
        </label>

        <label htmlFor="password">
          {id ? "Nova senha (opcional):" : "Senha:"}
          <input
            id="password"
            autoComplete="new-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={id ? "Preencha somente para trocar" : "Sua senha"}
          />
        </label>
        {requiresCurrentPassword && (
          <label htmlFor="current-password">
            Senha atual para confirmar:
            <input
              id="current-password"
              autoComplete="current-password"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Sua senha atual"
            />
          </label>
        )}
        <button type="submit" disabled={submitting}>{id ? "Salvar" : "Criar conta"}</button>
      </Form>

      {id && (
        <section aria-labelledby="deactivate-account-title">
          <h2 id="deactivate-account-title">Desativar minha conta</h2>
          <p>Esta ação encerra o acesso da conta e exige sua senha atual.</p>
          {!confirmingDeactivation ? (
            <button type="button" onClick={() => setConfirmingDeactivation(true)}>
              Desativar minha conta
            </button>
          ) : (
            <Form as="div">
              <label htmlFor="deactivation-current-password">
                Senha atual para confirmar:
                <input
                  id="deactivation-current-password"
                  autoComplete="current-password"
                  type="password"
                  value={deactivationPassword}
                  onChange={(e) => setDeactivationPassword(e.target.value)}
                  placeholder="Sua senha atual"
                />
              </label>
              <button type="button" disabled={submitting} onClick={handleDeactivate}>
                Confirmar desativação
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={() => {
                  setDeactivationPassword("");
                  setConfirmingDeactivation(false);
                }}
              >
                Cancelar
              </button>
            </Form>
          )}
        </section>
      )}
    </Container>
  );
}

Register.propTypes = {
  history: PropTypes.shape({
    push: PropTypes.func.isRequired,
  }).isRequired,
};
