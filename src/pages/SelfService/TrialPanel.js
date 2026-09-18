import React, { useState } from "react";
import { Link } from "react-router-dom";
import axios from "../../services/axios";
import { useCommercial } from "../../contexts/CommercialContext";
import { trialDate } from "./shared";
import "./selfService.css";

export function TrialIndicator() {
  const { data } = useCommercial();
  if (!data?.managed || data.state !== "trial_active") return null;
  return <Link className="trial-indicator" data-urgent={data.remaining_days <= 3} to="/situacao-comercial">
    Teste: {data.remaining_days} {data.remaining_days === 1 ? "dia restante" : "dias restantes"} · até {trialDate(data.ends_at, data.timezone)}
  </Link>;
}
export default function TrialPanel() {
  const { data, refresh } = useCommercial();
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [care, setCare] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [deferred, setDeferred] = useState(false);
  if (!data?.managed || data.state !== "trial_active") return null;
  const submit = async (event) => {
    event.preventDefault(); setBusy(true); setError("");
    try {
      await axios.post("/commercial/orientation", { city, state, performs_care: care === "yes" });
      await refresh();
    } catch (_) { setError("Não foi possível salvar. Confira a cidade e a UF e tente novamente."); }
    finally { setBusy(false); }
  };
  const { milestones } = data;
  return <>
    {milestones && milestones.completed < 3 && <details className="trial-panel" open>
      <summary>Comece por aqui · {milestones.completed}/3</summary>
      <ul>
        <li><span aria-label={milestones.services ? "Concluído" : "Pendente"}>{milestones.services ? "✓" : "○"}</span><Link to="/planos?tab=services">Criar primeiro serviço</Link></li>
        <li><span aria-label={milestones.patients ? "Concluído" : "Pendente"}>{milestones.patients ? "✓" : "○"}</span><Link to="/pacientes/novo">Cadastrar primeiro paciente</Link></li>
        <li><span aria-label={milestones.sessions ? "Concluído" : "Pendente"}>{milestones.sessions ? "✓" : "○"}</span><Link to="/agendamentos">Criar primeiro agendamento</Link></li>
      </ul>
    </details>}
    {data.owner && !data.orientation.completed && <details className="trial-panel" open={!deferred}>
      <summary>Complete as informações iniciais da Agenda</summary>
      <p>Você pode continuar usando a Agenda enquanto preenche estas informações. Sua resposta sobre atendimentos não altera o acesso durante o teste.</p>
      <form className="motria-onboarding" onSubmit={submit} aria-busy={busy}>
        <label htmlFor="trial-city">Cidade<input id="trial-city" required minLength={2} maxLength={120} value={city} onChange={(e) => setCity(e.target.value)} /></label>
        <label htmlFor="trial-state">UF<select id="trial-state" required value={state} onChange={(e) => setState(e.target.value)}><option value="">Selecione</option>{"AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO".split(" ").map((uf) => <option key={uf} value={uf}>{uf}</option>)}</select></label>
        <label htmlFor="trial-care">Você realiza atendimentos?<select id="trial-care" required value={care} onChange={(e) => setCare(e.target.value)}><option value="">Selecione</option><option value="yes">Sim</option><option value="no">Não</option></select></label>
        {error && <p role="alert">{error}</p>}
        <button type="submit" disabled={busy}>{busy ? "Salvando…" : "Salvar informações"}</button>
        <button type="button" disabled={busy} onClick={() => setDeferred(true)}>Preencher depois</button>
      </form>
    </details>}
  </>;
}
