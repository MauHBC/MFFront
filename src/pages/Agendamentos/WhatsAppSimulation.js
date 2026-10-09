import React, { useEffect, useState } from "react";
import styled from "styled-components";

const Shell = styled.main`
  max-width: 1100px; margin: 40px auto; padding: 24px;
  color: #233746; font-family: Inter, sans-serif;
  h1 { font-size: 28px; margin-bottom: 6px; }
  h2 { font-size: 19px; }
  button { padding: 9px 14px; margin: 4px; border-radius: 7px;
    background: #fff; color: #254a55; border: 1px solid #ccdce0; cursor: pointer; }
  button:disabled { opacity: .45; cursor: default; }
  button.primary { background: #237a78; color: white; border-color: #237a78; }
  table { width: 100%; border-collapse: collapse; }
  td, th { padding: 12px 8px; text-align: left; border-bottom: 1px solid #e5ecee; }
  section { background: white; border: 1px solid #dde6e8; border-radius: 12px;
    padding: 20px; margin-top: 20px; }
  .notice { padding: 14px; background: #e8f4ee; border-radius: 8px; }
  .error { color: #9b3030; }
  .status { font-size: 13px; padding: 5px 8px; border-radius: 6px; background: #eef3f5; }
  .review { border: 2px solid #237a78; }
  @media(max-width: 700px) { margin: 10px; padding: 8px; table { font-size: 13px; } }
`;
const labels = {
  queued: "Na fila", accepted: "Aceito (simulado)", delivered: "Entregue (simulado)",
  failed: "Falhou", unknown: "Resultado desconhecido — não reenviar", obsolete: "Desatualizado",
  pending: "Sem resposta", confirm: "Presença confirmada", unavailable: "Não poderá ir — acompanhar",
  conflict: "Respostas conflitantes — acompanhar", blocked_limit: "Bloqueado: limite diário",
  blocked_shutdown: "Bloqueado: desligamento", blocked_consent: "Bloqueado: autorização revogada",
};
const errors = {
  WHATSAPP_CONTACT_NOT_AUTHORIZED: "Contato sem autorização explícita ou com mensagens interrompidas.",
  WHATSAPP_REVIEW_STALE: "O atendimento mudou. Faça uma nova revisão antes de confirmar.",
  WHATSAPP_RETRY_BLOCKED: "Este resultado não permite nova tentativa.",
};
export default function WhatsAppSimulation() {
  const [data, setData] = useState(null);
  const [selected, setSelected] = useState([]);
  const [review, setReview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const base = "http://127.0.0.1:3056/api/whatsapp/simulation";
  async function load() {
    const response = await fetch(base);
    if (!response.ok) throw new Error("Prévia indisponível");
    setData(await response.json());
  }
  useEffect(() => { load().catch(() => setError("Inicie o Backend descartável da prévia.")); }, []);
  async function command(body) {
    setBusy(true); setError("");
    try {
      const response = await fetch(base, { method: "POST",
        headers: { "Content-Type": "application/json", "X-Simulation-CSRF": data.csrf },
        body: JSON.stringify(body) });
      const result = await response.json();
      if (!response.ok) throw new Error(errors[result.error] || "Não foi possível concluir esta simulação.");
      if (body.action === "review") setReview(result);
      if (body.action === "confirm") { setReview(null); setSelected([]); }
      await load();
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }
  return (
    <Shell>
      <p>Motria · Agenda · Piloto local</p>
      <h1>Lembretes e confirmações</h1>
      <p className="notice"><strong>Simulação — nenhuma mensagem será enviada</strong><br />
        Todos os pacientes, contatos e autorizações desta prévia são fictícios.</p>
      {error && <p role="alert" className="error">{error}</p>}
      {data && <>
        <section>
          <h2>Atendimentos</h2>
          <p>Clínica Fictícia · Administrador fictício · Um telefone compartilhado entre dois pacientes</p>
          <table><thead><tr><th>Selecionar</th><th>Paciente</th><th>Horário</th><th>Ação de simulação</th></tr></thead>
            <tbody>{data.appointments.map((a) => <tr key={a.id}>
              <td><input type="checkbox" aria-label={`Selecionar ${a.name}`} checked={selected.includes(a.id)}
                onChange={(e) => setSelected(e.target.checked ? [...selected, a.id] : selected.filter((id) => id !== a.id))} /></td>
              <td>{a.name}</td><td>{new Date(a.startsAt).toLocaleString("pt-BR")}</td>
              <td><button type="button" disabled={busy} onClick={() => command({ action: "reschedule", id: a.id })}>Simular remarcação</button></td>
            </tr>)}</tbody></table>
          <button type="button" className="primary" disabled={busy || !selected.length}
            onClick={() => command({ action: "review", ids: selected })}>Revisar {selected.length || ""} lembrete(s)</button>
        </section>
        {review && <section className="review" aria-label="Revisão de lembretes">
          <h2>Revise antes de confirmar</h2>
          {review.items.map((item) => <p key={item.sessionId}>{item.text}</p>)}
          <p>Confirmar criará itens na fila. O processamento será simulado sob comando.</p>
          <button type="button" disabled={busy} onClick={() => setReview(null)}>Voltar</button>
          <button type="button" className="primary" disabled={busy} onClick={() => command({ action: "confirm", token: review.token })}>Confirmar fila simulada</button>
        </section>}
        <section>
          <h2>Acompanhamento por lembrete</h2>
          {!data.items.length && <p>Nenhum lembrete na fila.</p>}
          {data.items.map((item) => <section key={item.id}>
            <strong>Atendimento #{item.sessionId}</strong> · <span className="status">{labels[item.status]}</span>
            <p>{labels[item.confirmation]} · {item.attempts} tentativa(s){item.needsFollowUp ? " · Acompanhamento humano necessário" : ""}</p>
            {["queued", "failed"].includes(item.status) && <>
              <button type="button" disabled={busy} onClick={() => command({ action: "dispatch", id: item.id, outcome: "accepted" })}>Simular aceitação</button>
              <button type="button" disabled={busy} onClick={() => command({ action: "dispatch", id: item.id, outcome: "failed" })}>Simular falha</button>
              <button type="button" disabled={busy} onClick={() => command({ action: "dispatch", id: item.id, outcome: "unknown" })}>Simular resultado desconhecido</button>
            </>}
            {["accepted", "delivered"].includes(item.status) && <>
              <button type="button" disabled={busy} onClick={() => command({ action: "event", id: item.id, kind: "delivered" })}>Simular entrega</button>
              <button type="button" disabled={busy} onClick={() => command({ action: "event", id: item.id, kind: "confirm" })}>Confirmar presença</button>
              <button type="button" disabled={busy} onClick={() => command({ action: "event", id: item.id, kind: "unavailable" })}>Não poderei ir</button>
              <button type="button" disabled={busy} onClick={() => command({ action: "event", id: item.id, kind: "stop" })}>Interromper mensagens</button>
            </>}
          </section>)}
          <p>Respostas não alteram status da sessão, pacote, crédito, plano ou financeiro.</p>
        </section>
        <section><h2>Controles do piloto</h2>
          <p>{data.control.attempts}/10 tentativas globais hoje · {data.control.enabled ? "Simulação habilitada" : "Desligada"}
            · Contato {data.control.contactAuthorized ? "autorizado" : "bloqueado"}</p>
          <button type="button" disabled={busy} onClick={() => command({ action: "shutdown", enabled: !data.control.enabled })}>
            {data.control.enabled ? "Desligar tentativas" : "Habilitar simulação"}</button>
          <button type="button" disabled={busy || data.control.contactAuthorized} onClick={() => command({ action: "authorize" })}>Registrar nova autorização fictícia</button>
          <p>O limite controla tentativas do Motria. Não é um teto absoluto de cobrança da Meta.</p>
        </section>
      </>}
    </Shell>
  );
}
