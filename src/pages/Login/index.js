import React, { useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { toast } from "react-toastify";
import { isEmail } from "validator";
import { useDispatch, useSelector } from "react-redux";
import { FiEye, FiEyeOff } from "react-icons/fi";

import { Container } from "../../styles/GlobalStyles";
import {
  Field,
  FieldError,
  Form,
  LegacyForm,
  LoadingStatus,
  PasswordControl,
  SubmitButton,
} from "./styled";
import * as actions from "../../store/modules/auth/actions";

import Loading from "../../components/Loading";
import PublicAuthShell from "../../components/PublicAuthShell";
import { useIsLoggedIn } from "../../hooks/useIsLoggedIn";
import history from "../../services/history";
import loginReturnPath from "../../services/loginReturnPath";
import productIdentity from "../../config/productIdentity";
import { usePublicClinicContext } from "../../contexts/PublicClinicContext";
import TenantLoading from "../../components/TenantLoading";

export default function Login() {
  const dispatch = useDispatch();
  const location = useLocation();
  const returnTo = loginReturnPath(location.state?.returnTo);
  const isLoggedIn = useIsLoggedIn();
  const isLoading = useSelector((state) => state.auth.isLoading);
  const { publicClinic, displayName, loaded, loading, logoSrc } = usePublicClinicContext();
  const brandLoading = loading || !loaded;
  const isTenantBranded = Boolean(publicClinic?.has_public_tenant);
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);
  const [errors, setErrors] = React.useState({});

  useEffect(() => {
    if (isLoggedIn) {
      history.replace(returnTo);
    }
  }, [isLoggedIn, returnTo]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (isLoading) return;

    let formErrors = false;
    const nextErrors = {};

    if (!isEmail(email)) {
      formErrors = true;
      nextErrors.email = "Informe um e-mail válido.";
      toast.error("Email inválido");
    }

    if (!password) {
      formErrors = true;
      nextErrors.password = "Informe sua senha.";
      toast.error("Senha inválida");
    }

    setErrors(nextErrors);
    if (!formErrors) {
      dispatch(actions.loginRequest({ email, password, redirectTo: returnTo }));
    }
  }

  function handleEmailChange(event) {
    setEmail(event.target.value);
    setErrors((current) => ({ ...current, email: undefined }));
  }

  function handlePasswordChange(event) {
    setPassword(event.target.value);
    setErrors((current) => ({ ...current, password: undefined }));
  }

  function handlePasswordVisibility() {
    setShowPassword((current) => !current);
  }

  if (isTenantBranded) {
    return (
      <Container style={{ marginTop: "180px" }}>
        <Loading isLoading={isLoading} />
        {brandLoading ? <TenantLoading compact /> : (
          <>
            {logoSrc && <img src={logoSrc} alt={displayName} style={{ maxHeight: "72px", objectFit: "contain" }} />}
            <h1>{displayName}</h1>
            <p>{productIdentity.subtitle}</p>
          </>
        )}
        {/* The handler deliberately stays in Login; the styled form owns only presentation. */}
        {/* eslint-disable-next-line react/jsx-no-bind */}
        <LegacyForm onSubmit={handleSubmit}>
          <input type="email" id="email" name="email" value={email} onChange={handleEmailChange} placeholder="Seu e-mail" />
          <input type="password" id="password" name="password" value={password} autoComplete="current-password" onChange={handlePasswordChange} placeholder="Sua senha" />
          <button type="submit">Entrar</button>
          <Link to="/recuperar-senha">Esqueci minha senha</Link>
        </LegacyForm>
      </Container>
    );
  }

  return (
    <PublicAuthShell
      title="Entrar na sua conta"
      description="Acesse sua Agenda Motria."
    >
      {/* eslint-disable-next-line react/jsx-no-bind */}
      <Form onSubmit={handleSubmit} noValidate aria-busy={isLoading}>
        <Field>
          <label htmlFor="login-email">E-mail
            <input
              type="email"
              id="login-email"
              name="email"
              value={email}
              onChange={handleEmailChange}
              autoComplete="username"
              inputMode="email"
              placeholder="seu@email.com"
              aria-invalid={Boolean(errors.email)}
              aria-describedby={errors.email ? "login-email-error" : undefined}
            />
          </label>
          {errors.email && <FieldError id="login-email-error" role="alert">{errors.email}</FieldError>}
        </Field>
        <Field>
          <PasswordControl>
            <label htmlFor="login-password">Senha
              <input
                type={showPassword ? "text" : "password"}
                id="login-password"
                name="password"
                value={password}
                onChange={handlePasswordChange}
                autoComplete="current-password"
                placeholder="Sua senha"
                aria-invalid={Boolean(errors.password)}
                aria-describedby={errors.password ? "login-password-error" : undefined}
              />
            </label>
            <button
              type="button"
              aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
              aria-pressed={showPassword}
              onClick={handlePasswordVisibility}
            >
              {showPassword ? <FiEyeOff aria-hidden="true" /> : <FiEye aria-hidden="true" />}
            </button>
          </PasswordControl>
          {errors.password && <FieldError id="login-password-error" role="alert">{errors.password}</FieldError>}
        </Field>
        <SubmitButton type="submit" disabled={isLoading}>
          {isLoading ? "Entrando..." : "Entrar"}
        </SubmitButton>
        {isLoading && <LoadingStatus role="status" aria-live="polite">Validando seu acesso...</LoadingStatus>}
      </Form>
    </PublicAuthShell>
  );
}
