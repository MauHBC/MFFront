import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useSelector } from "react-redux";
import axios from "../../services/axios";
import { useCommercial } from "../../contexts/CommercialContext";
import { selfServiceError } from "./shared";
import "./selfService.css";

export default function Signup() {
  const logged = useSelector((state) => state.auth.isLoggedIn);
  const { data: commercial } = useCommercial();
  const [legal, setLegal] = useState(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    axios.get("/public/self-service/metadata").then(({ data }) => { if (active) setLegal(data); })
      .catch(() => { if (active) setError("Não foi possível carregar os documentos. Tente novamente."); });
    return () => { active = false; };
  }, [attempt]);
  useEffect(() => {
    if (logged && commercial?.identity) {
      setName(commercial.identity.name);
      setEmail(commercial.identity.email);
    }
  }, [commercial, logged]);
  const submit = async (event) => {
    event.preventDefault();
    if (busy || !legal) return;
    if (!accepted) { setError("Confirme a leitura e o aceite dos documentos para continuar."); return; }
    setBusy(true); setError("");
    try {
      await axios.post(logged ? "/commercial/registrations" : "/public/self-service/registrations", {
        name, email, ...(logged ? {} : { password }), legal_accepted: accepted,
        terms_version: legal.terms_version, privacy_version: legal.privacy_version,
      });
      setPassword(""); setSent(true);
    } catch (requestError) { setError(selfServiceError(requestError)); }
    finally { setBusy(false); }
  };
  const resend = async () => {
    setBusy(true); setError("");
    try { await axios.post("/public/self-service/resend", { email }); }
    catch (requestError) { setError(selfServiceError(requestError)); }
    finally { setBusy(false); }
  };
  return <main className="motria-onboarding">
    <h1>{sent ? "Confira seu e-mail" : "Crie sua Agenda Motria"}</h1>
    {error && <p role="alert">{error}</p>}
    {!legal && !error && <p role="status">Carregando os documentos…</p>}
    {!legal && error && <button type="button" onClick={() => { setError(""); setAttempt(attempt + 1); }}>Tentar novamente</button>}
    {sent ? <>
      <p>Se o cadastro estiver apto, você receberá um link válido por 24 horas. Seu teste gratuito de 10 dias começa somente quando sua Agenda estiver pronta.</p>
      <p>Se já possui uma conta, entre nela para criar sua Agenda. Confira também a pasta de spam.</p>
      <button type="button" disabled={busy} onClick={resend}>{busy ? "Enviando…" : "Solicitar novo link"}</button>
    </> : <>
      <p>Confirme seu e-mail e receba uma Agenda vazia para começar com seus próprios dados. Não é necessário cartão.</p>
      {logged && <p>Usaremos sua conta autenticada. Sua senha e seus vínculos existentes serão preservados.</p>}
      {legal && !legal.legal_ready && <p role="status">Ambiente de revisão técnica: os documentos legais ainda aguardam aprovação para abertura comercial.</p>}
      <form onSubmit={submit} aria-busy={busy}>
        <label htmlFor="signup-name">Nome<input id="signup-name" autoComplete="name" required minLength={3} maxLength={100} value={name} readOnly={logged} onChange={(e) => setName(e.target.value)} /></label>
        <label htmlFor="signup-email">E-mail<input id="signup-email" type="email" autoComplete="email" required maxLength={255} value={email} readOnly={logged} onChange={(e) => setEmail(e.target.value)} /></label>
        {!logged && <label htmlFor="signup-password">Senha<input id="signup-password" type="password" autoComplete="new-password" required minLength={8} maxLength={128} value={password} onChange={(e) => setPassword(e.target.value)} /><small>Entre 8 e 128 caracteres. Escolha uma senha que não seja comum.</small></label>}
        <label className="legal-check" htmlFor="signup-legal"><input id="signup-legal" type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} /><span>Li e aceito os <a href={legal?.terms_url || "/termos"} target="_blank" rel="noopener noreferrer">Termos de Uso</a> e declaro que li a <a href={legal?.privacy_url || "/privacidade"} target="_blank" rel="noopener noreferrer">Política de Privacidade</a>.</span></label>
        <button type="submit" disabled={busy || !legal || (logged && !commercial?.identity)}>{busy ? "Enviando…" : "Confirmar e-mail para criar Agenda"}</button>
      </form>
    </>}
    <p><Link to="/login">Entrar na minha conta</Link></p>
  </main>;
}
