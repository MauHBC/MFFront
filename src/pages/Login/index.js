import React, { useEffect } from "react";
import { toast } from "react-toastify";
import { isEmail } from "validator";
import { useDispatch, useSelector } from "react-redux";

import { Container } from "../../styles/GlobalStyles";
import { Form } from "./styled";
import * as actions from "../../store/modules/auth/actions";

import Loading from "../../components/Loading";
import { useIsLoggedIn } from "../../hooks/useIsLoggedIn";
import history from "../../services/history";

export default function Login() {
  const dispatch = useDispatch();
  const isLoggedIn = useIsLoggedIn();
  const isLoading = useSelector((state) => state.auth.isLoading);
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");

  useEffect(() => {
    if (isLoggedIn) {
      history.push("/menu");
    }
  }, [isLoggedIn]);

  async function handleSubmit(e) {
    e.preventDefault();

    let formErrors = false;

    if (!isEmail(email)) {
      formErrors = true;
      toast.error("Email inválido");
    }

    if (password.length < 6 || password.length > 50) {
      formErrors = true;
      toast.error("Senha inválida");
    }

    if (!formErrors) {
      dispatch(actions.loginRequest({ email, password, redirectTo: "/menu" }));
    }
  }

  return (
    <Container style={{ marginTop: "180px" }}>
      <Loading isLoading={isLoading} />

      <h1>Login</h1>

      <Form onSubmit={(e) => handleSubmit(e)}>
        <input
          type="email"
          id="email"
          name="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Seu e-mail"
        />
        <input
          type="password"
          id="password"
          name="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Sua senha"
        />
        <button type="submit">Entrar</button>
      </Form>
    </Container>
  );
}