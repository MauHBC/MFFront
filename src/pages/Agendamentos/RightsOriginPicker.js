import React from "react";
import PropTypes from "prop-types";
import { GhostButton } from "../../components/AppButton";
import { FieldHint } from "../../components/AppForm";

export default function RightsOriginPicker({ rights, origin, selectedId, onSelect, canShare, onShare, Option }) {
  return <div style={{ display: "grid", gap: 10 }}>
    {rights.status === "loading" && <FieldHint role="status">Consultando sessões disponíveis...</FieldHint>}
    {rights.status === "error" && <div role="alert"><FieldHint>Não foi possível consultar as sessões disponíveis.</FieldHint>{" "}
      <GhostButton type="button" onClick={rights.refresh}>Tentar novamente</GhostButton></div>}
    {rights.status === "ready" && <>
      {!rights.options.length && <FieldHint>Nenhuma sessão disponível. Este atendimento será lançado como novo.</FieldHint>}
      <strong>Como deseja continuar?</strong>
      <FieldHint>Use uma sessão disponível, utilize o pacote de outro paciente ou faça um novo lançamento.</FieldHint>
      {rights.options.map((pkg) => <div key={pkg.id}><Option htmlFor={`own-right-origin-${pkg.id}`}>
        <input id={`own-right-origin-${pkg.id}`} type="radio" name="attendance-origin" checked={origin === "own" && String(selectedId) === String(pkg.id)}
          onChange={() => onSelect(pkg)}/>{" "}Usar sessão disponível — {pkg.service.name} - {pkg.free_rights} {pkg.free_rights === 1 ? "sessão disponível" : "sessões disponíveis"}
        <small> · {Number(pkg.quantity) === 1 ? "Avulsa" : `Pacote de ${pkg.quantity}`}{rights.options.length > 1 && ` · #${pkg.id}`}</small>
      </Option></div>)}
      {canShare && <Option htmlFor="right-origin-shared"><input id="right-origin-shared" type="radio" name="attendance-origin"
        checked={origin === "shared"} onChange={onShare}/>{" "}Usar pacote de outro paciente</Option>}
      <Option htmlFor="own-right-origin-new"><input id="own-right-origin-new" type="radio" name="attendance-origin" checked={origin === "new"}
        onChange={() => onSelect(null)}/>{" "}Fazer novo lançamento</Option>
      <FieldHint>Comprar sessões para agendar agora ou depois</FieldHint>
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
};
RightsOriginPicker.defaultProps = { selectedId: "", Option: "label" };
