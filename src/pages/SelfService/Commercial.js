import React, { useState } from "react";
import { Link } from "react-router-dom";
import AppShell from "../../components/AppShell";
import axios from "../../services/axios";
import { useCommercial } from "../../contexts/CommercialContext";
import { trialDate } from "./shared";
import "./selfService.css";

export default function Commercial() {
  const { data } = useCommercial();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [confirmDeletion, setConfirmDeletion] = useState(false);
  const exportData = async () => {
    setBusy(true); setMessage("");
    try {
      const { data: exported } = await axios.post("/commercial/export", {});
      const url = URL.createObjectURL(new Blob([JSON.stringify(exported, null, 2)], { type: "application/json" }));
      const link = document.createElement("a");
      link.href = url; link.download = `motria-agenda-${exported.clinic_id}.json`;
      document.body.appendChild(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setMessage("Exportação concluída. Guarde o arquivo em local seguro.");
    } catch (_) { setMessage("Não foi possível exportar agora. Tente novamente ou fale com o suporte."); }
    finally { setBusy(false); }
  };
  const requestAction = async (action) => {
    setBusy(true); setMessage("");
    try {
      const response = await axios.post("/commercial/data-requests", { action });
      setMessage(response.data.message); setConfirmDeletion(false);
    } catch (_) { setMessage("Não foi possível registrar agora. Tente novamente ou fale com o suporte."); }
    finally { setBusy(false); }
  };
  const title = !data?.managed ? "Situação da Agenda" : ({ trial_active: "Seu teste gratuito",
    inconsistent: "Não foi possível validar o acesso" })[data.state] || "Seu teste gratuito terminou";
  return <AppShell pageTitle="Situação comercial"><main className="motria-onboarding">
    <h1>{title}</h1>
    {!data?.managed ? <p>Esta Agenda mantém suas condições atuais de acesso.</p> : <>
      <p>Fim do teste: <strong>{trialDate(data.ends_at, data.timezone)}</strong> ({data.timezone}).</p>
      {data.state === "trial_active" ? <p>Você pode usar a Agenda durante o teste. <Link to="/menu">Continuar na Agenda</Link>.</p>
        : <p>O acesso operacional está encerrado. Sua conta continua disponível e você pode trocar de Agenda pelo seletor acima.</p>}
      <p>A assinatura e a reativação ainda não estão disponíveis nesta etapa. Nenhuma cobrança automática será feita.</p>
      {data.owner ? <>
        <p>A janela para exportação e solicitação de exclusão termina em {trialDate(data.retention_ends_at, data.timezone)}.</p>
        {data.data_actions_available ? <>
          <p><button type="button" disabled={busy} onClick={exportData}>Exportar dados da Agenda</button></p>
          <p><button type="button" disabled={busy} onClick={() => requestAction("reactivation_interest")}>Registrar interesse em reativação futura</button></p>
          {!confirmDeletion ? <button type="button" disabled={busy} onClick={() => setConfirmDeletion(true)}>Solicitar exclusão dos dados</button> : <div>
            <p>A solicitação será registrada para análise. Nenhum dado será excluído automaticamente.</p>
            <button type="button" disabled={busy} onClick={() => requestAction("deletion")}>Confirmar solicitação de exclusão</button>{" "}
            <button type="button" onClick={() => setConfirmDeletion(false)}>Cancelar</button>
          </div>}
        </> : <p>A janela de ações de dados pelo sistema terminou. Fale com o suporte para analisar sua solicitação.</p>}
      </> : <p>Somente o titular responsável pode solicitar ações comerciais e de dados desta Agenda.</p>}
    </>}
    {busy && <p role="status">Processando…</p>}
    {message && <p role="status">{message}</p>}
    <p><a href="mailto:suporte@motria.com.br">suporte@motria.com.br</a></p>
  </main></AppShell>;
}
