import React, { useLayoutEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useSelector } from "react-redux";
import axios from "../../services/axios";
import { useCommercial } from "../../contexts/CommercialContext";
import { selfServiceError } from "./shared";
import "./selfService.css";

export default function Confirmation() {
  const logged = useSelector((state) => state.auth.isLoggedIn);
  const { refresh } = useCommercial();
  const [token] = useState(() => new URLSearchParams(window.location.hash.slice(1)).get("token") || "");
  const [state, setState] = useState(token ? "ready" : "invalid");
  const [error, setError] = useState("");
  const [email, setEmail] = useState("");
  useLayoutEffect(() => {
    window.history.replaceState(window.history.state, document.title, window.location.pathname);
  }, []);
  const confirm = async () => {
    if (state === "busy") return;
    setState("busy"); setError("");
    try {
      await axios.post(logged ? "/commercial/confirmations" : "/public/self-service/confirmations", { token });
      setState("done"); refresh();
      window.dispatchEvent(new Event("motria:clinic-memberships-changed"));
    } catch (requestError) {
      const code = requestError?.response?.data?.error;
      setState(({ CONFIRMATION_LINK_EXPIRED: "expired", CONFIRMATION_LINK_INVALID: "invalid",
        CANONICAL_AUTHENTICATION_REQUIRED: "login", SELF_SERVICE_LEGAL_NOT_APPROVED: "blocked",
        SELF_SERVICE_MEMBERSHIP_AUTHENTICATION_REQUIRED: "blocked" })[code] || "retry");
      let message = "";
      if (["SELF_SERVICE_LEGAL_NOT_APPROVED", "SELF_SERVICE_MEMBERSHIP_AUTHENTICATION_REQUIRED"].includes(code)) {
        message = selfServiceError(requestError);
      } else if (requestError?.response?.status === 429) {
        message = "Muitas tentativas. Aguarde antes de tentar novamente.";
      }
      setError(message);
    }
  };
  const resend = async (event) => {
    event.preventDefault(); setError("");
    try {
      await axios.post("/public/self-service/resend", { email });
      setError("Se houver um cadastro apto, enviaremos um novo link. Confira seu e-mail.");
    } catch (_) { setError("Não foi possível enviar agora. Tente novamente em alguns minutos."); }
  };
  return <main className="motria-onboarding">
    <h1>{({ done: "Sua Agenda está pronta", expired: "Este link expirou", invalid: "Link inválido", login: "Entre na sua conta", retry: "Ainda estamos preparando sua Agenda", blocked: "Cadastro em revisão" })[state] || "Confirme seu e-mail"}</h1>
    {error && <p role="alert">{error}</p>}
    {["ready", "busy", "retry"].includes(state) && <>
      <p>{state === "retry" ? "Seus dados foram recebidos e você não precisa refazer o cadastro. Tente novamente em alguns minutos. Se o problema continuar, fale com suporte@motria.com.br." : "Ao confirmar, criaremos sua Agenda e iniciaremos seu teste gratuito de 10 dias quando ela estiver pronta."}</p>
      <button type="button" disabled={state === "busy"} onClick={confirm}>{state === "busy" ? "Preparando sua Agenda…" : ({ retry: "Tentar novamente" })[state] || "Confirmar e criar minha Agenda"}</button>
    </>}
    {state === "done" && <p>Seu teste começou. {logged ? <Link to="/menu">Acesse suas Agendas e selecione a nova Agenda</Link> : <Link to="/login">Entre para começar</Link>}.</p>}
    {state === "login" && <p>Este cadastro está vinculado a uma conta autenticada. <Link to="/login">Entre nessa conta</Link> e abra novamente o link recebido por e-mail para continuar.</p>}
    {state === "blocked" && <p><Link to="/cadastro">Voltar ao cadastro</Link></p>}
    {["expired", "invalid"].includes(state) && <form onSubmit={resend}>
      <label htmlFor="resend-email">E-mail do cadastro<input id="resend-email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></label>
      <button type="submit">Solicitar novo link</button>
    </form>}
  </main>;
}
