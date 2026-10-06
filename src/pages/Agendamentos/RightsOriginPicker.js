import React from "react";
import PropTypes from "prop-types";
import { GhostButton } from "../../components/AppButton";
import { FieldHint } from "../../components/AppForm";
import CancelAvailableRights from "./CancelAvailableRights";

export default function RightsOriginPicker({ rights, origin, selectedId, onSelect, canShare, onShare, canCancel, Option }) {
  return <div style={{ display: "grid", gap: 10 }}>
    {rights.status === "loading" && <FieldHint role="status">Consultando sessões disponíveis...</FieldHint>}
    {rights.status === "error" && <div role="alert"><FieldHint>Não foi possível consultar as sessões disponíveis.</FieldHint>{" "}
      <GhostButton type="button" onClick={rights.refresh}>Tentar novamente</GhostButton></div>}
    {rights.status === "ready" && <>
      {!rights.options.length && <FieldHint>Nenhuma sessão disponível. Este atendimento será lançado como novo.</FieldHint>}
      <strong>Origem do atendimento</strong>
      {rights.options.map((pkg) => <div key={pkg.id}><Option htmlFor={`own-right-origin-${pkg.id}`}>
        <input id={`own-right-origin-${pkg.id}`} type="radio" name="attendance-origin" checked={origin === "own" && String(selectedId) === String(pkg.id)}
          onChange={() => onSelect(pkg)}/>{" "}{pkg.service.name} - {pkg.free_rights} {pkg.free_rights === 1 ? "sessão disponível" : "sessões disponíveis"}
        <small> · {Number(pkg.quantity) === 1 ? "Avulsa" : `Pacote de ${pkg.quantity}`}</small>
      </Option>{canCancel && <CancelAvailableRights packageId={pkg.id} onCompleted={() => { onSelect(undefined); rights.refresh(); }}/>}</div>)}
      {canShare && <Option htmlFor="right-origin-shared"><input id="right-origin-shared" type="radio" name="attendance-origin"
        checked={origin === "shared"} onChange={onShare}/>{" "}Usar pacote de outro paciente</Option>}
      <Option htmlFor="own-right-origin-new"><input id="own-right-origin-new" type="radio" name="attendance-origin" checked={origin === "new"}
        onChange={() => onSelect(null)}/>{" "}Novo lançamento</Option>
    </>}
  </div>;
}
RightsOriginPicker.propTypes = {
  rights: PropTypes.shape({ status: PropTypes.string, options: PropTypes.arrayOf(PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  })), refresh: PropTypes.func }).isRequired,
  origin: PropTypes.string.isRequired,
  selectedId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  onSelect: PropTypes.func.isRequired, canShare: PropTypes.bool.isRequired,
  onShare: PropTypes.func.isRequired,
  Option: PropTypes.elementType,
  canCancel: PropTypes.bool,
};
RightsOriginPicker.defaultProps = { selectedId: "", canCancel: false, Option: "label" };
