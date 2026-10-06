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
      {rights.options.map((pkg) => {
        const quantity = Number(pkg.quantity);
        const hasTotal = Number.isSafeInteger(quantity) && quantity > 0;
        const serviceIdentity = pkg.service.id ?? pkg.service.name;
        const needsIdentity = rights.options.some((other) => other !== pkg
          && (other.service.id ?? other.service.name) === serviceIdentity);
        return <Option key={pkg.id} htmlFor={`own-right-origin-${pkg.id}`} style={{ width: "100%", alignItems: "flex-start" }}>
          <input id={`own-right-origin-${pkg.id}`} type="radio" name="attendance-origin"
            checked={origin === "own" && String(selectedId) === String(pkg.id)} onChange={() => onSelect(pkg)}/>
          <span style={{ display: "grid", gap: 2, minWidth: 0 }}>
            <span>{pkg.service.name}{hasTotal && ` · ${quantity} ${quantity === 1 ? "sessão" : "sessões"}`}</span>
            <small>{pkg.free_rights} {Number(pkg.free_rights) === 1 ? "não agendada" : "não agendadas"}{needsIdentity && ` · #${pkg.id}`}</small>
          </span>
        </Option>;
      })}
      {canShare && <Option htmlFor="right-origin-shared"><input id="right-origin-shared" type="radio" name="attendance-origin"
        checked={origin === "shared"} onChange={onShare}/>{" "}Usar pacote de outro paciente</Option>}
      <Option htmlFor="own-right-origin-new"><input id="own-right-origin-new" type="radio" name="attendance-origin" checked={origin === "new"}
        onChange={() => onSelect(null)}/>{" "}Registrar novas sessões</Option>
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
