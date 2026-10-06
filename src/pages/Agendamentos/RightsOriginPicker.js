import React, { useEffect, useState } from "react";
import PropTypes from "prop-types";
import axios from "../../services/axios";
import CancelAvailableRights from "./CancelAvailableRights";

export default function RightsOriginPicker({ patientId, selectedId, onSelect, canShare, sharing, onShare, canCancel }) {
  const [state, setState] = useState({ status: "idle", options: [] });
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    let cancelled = false;
    if (!patientId) { setState({ status: "idle", options: [] }); return undefined; }
    setState({ status: "loading", options: [] });
    axios.get(`/patients/${patientId}/available-rights`).then((response) => {
      if (!cancelled) setState({ status: "ready", options: Array.isArray(response.data) ? response.data : [] });
    }).catch(() => { if (!cancelled) setState({ status: "error", options: [] }); });
    return () => { cancelled = true; };
  }, [patientId, refresh]);
  return <div style={{ display: "grid", gap: 10 }}>
    {state.status === "loading" && <small>Consultando sessões disponíveis...</small>}
    {state.status === "error" && <small>Não foi possível consultar as sessões disponíveis. <button type="button" onClick={() => setRefresh((value) => value + 1)}>Tentar novamente</button></small>}
    {state.status === "ready" && (state.options.length ? <>
      <strong>Origem do atendimento</strong>
      {state.options.map((pkg) => <div key={pkg.id}><label htmlFor={`own-right-origin-${pkg.id}`}>
        <input id={`own-right-origin-${pkg.id}`} type="radio" name="own-right-origin" checked={String(selectedId) === String(pkg.id)}
          onChange={() => onSelect(pkg)}/>{" "}{pkg.service.name} — {pkg.free_rights} {pkg.free_rights === 1 ? "sessão disponível" : "sessões disponíveis"}
        <small> · {Number(pkg.quantity) === 1 ? "Avulsa" : `Pacote de ${pkg.quantity}`}</small>
      </label>{canCancel && <CancelAvailableRights packageId={pkg.id} onCompleted={() => { onSelect(null); setRefresh((value) => value + 1); }}/>}</div>)}
      <label htmlFor="own-right-origin-new"><input id="own-right-origin-new" type="radio" name="own-right-origin" checked={!selectedId && !sharing} onChange={() => onSelect(null)}/>{" "}Novo lançamento</label>
    </> : <small>Nenhuma sessão disponível. Este atendimento será lançado como novo.</small>)}
    {canShare && <label htmlFor="right-origin-shared"><input id="right-origin-shared" type="checkbox" disabled={!patientId} checked={sharing} onChange={(event) => onShare(event.target.checked)}/>{" "}Usar pacote de outro paciente</label>}
  </div>;
}
RightsOriginPicker.propTypes = {
  patientId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  selectedId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  onSelect: PropTypes.func.isRequired, canShare: PropTypes.bool.isRequired,
  sharing: PropTypes.bool.isRequired, onShare: PropTypes.func.isRequired,
  canCancel: PropTypes.bool,
};
RightsOriginPicker.defaultProps = { patientId: "", selectedId: "", canCancel: false };
