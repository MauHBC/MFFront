import React from "react";
import PropTypes from "prop-types";
import { GhostButton } from "../../components/AppButton";
import { FieldHint } from "../../components/AppForm";
import { colors, spacing } from "../../styles/tokens";

export default function RightsOriginPicker({ rights, origin, selectedId, onSelect, canShare, onShare, onReplacement, replacementId, replacementLabel, Option }) {
  return <fieldset style={{ display: "grid", gap: spacing.sm, border: 0, padding: 0, margin: 0, minWidth: 0 }}>
    {rights.status === "ready" && <legend style={{ padding: 0, marginBottom: spacing.md, fontWeight: 800 }}>Como deseja continuar?</legend>}
    {rights.status === "loading" && <FieldHint role="status">Consultando sessões disponíveis...</FieldHint>}
    {rights.status === "error" && <div role="alert"><FieldHint>Não foi possível consultar as sessões disponíveis.</FieldHint>{" "}
      <GhostButton type="button" onClick={rights.refresh}>Tentar novamente</GhostButton></div>}
    {rights.status === "ready" && <>
      {!rights.options.length && !rights.replacements?.length && <FieldHint>Nenhuma sessão disponível. Este atendimento será lançado como novo.</FieldHint>}
      {rights.options.map((pkg) => {
        const quantity = Number(pkg.quantity);
        const hasTotal = Number.isSafeInteger(quantity) && quantity > 0;
        const serviceIdentity = pkg.service.id ?? pkg.service.name;
        const needsIdentity = rights.options.some((other) => other !== pkg
          && (other.service.id ?? other.service.name) === serviceIdentity);
        return <Option key={pkg.id} htmlFor={`own-right-origin-${pkg.id}`} style={{ width: "100%", alignItems: "flex-start" }}>
          <input id={`own-right-origin-${pkg.id}`} type="radio" name="attendance-origin"
            checked={origin === "own" && String(selectedId) === String(pkg.id)} onChange={() => onSelect(pkg)}/>
          <span style={{ display: "grid", gap: 2, minWidth: 0, overflowWrap: "anywhere" }}>
            <span>{pkg.service.name}{hasTotal && ` · ${quantity} ${quantity === 1 ? "sessão" : "sessões"}`}</span>
            <small style={{ color: colors.textSecondary, fontWeight: 500 }}>{pkg.free_rights} {Number(pkg.free_rights) === 1 ? "não agendada" : "não agendadas"}{needsIdentity && ` · #${pkg.id}`}</small>
          </span>
        </Option>;
      })}
      {(rights.replacements || []).map((credit) => <Option key={`replacement-${credit.id}`} htmlFor={`replacement-origin-${credit.id}`} style={{ width: "100%", alignItems: "flex-start" }}>
        <input id={`replacement-origin-${credit.id}`} type="radio" name="attendance-origin"
          checked={origin === "replacement" && String(replacementId) === String(credit.id)}
          onChange={() => onReplacement(credit)}/><span style={{ minWidth: 0, overflowWrap: "anywhere" }}>Reposição: {replacementLabel(credit)}</span>
      </Option>)}
      {canShare && <Option htmlFor="right-origin-shared"><input id="right-origin-shared" type="radio" name="attendance-origin"
        checked={origin === "shared"} onChange={onShare}/>{" "}Usar pacote de outro paciente</Option>}
      <Option htmlFor="own-right-origin-new"><input id="own-right-origin-new" type="radio" name="attendance-origin" checked={origin === "new"}
        onChange={() => onSelect(null)}/>{" "}Registrar novas sessões</Option>
    </>}
  </fieldset>;
}
RightsOriginPicker.propTypes = {
  rights: PropTypes.shape({ status: PropTypes.string, options: PropTypes.arrayOf(PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  })), replacements: PropTypes.arrayOf(PropTypes.shape({ id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]) })), refresh: PropTypes.func }).isRequired,
  origin: PropTypes.string.isRequired,
  selectedId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  onSelect: PropTypes.func.isRequired, canShare: PropTypes.bool.isRequired,
  onShare: PropTypes.func.isRequired,
  Option: PropTypes.elementType,
  replacementId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  onReplacement: PropTypes.func,
  replacementLabel: PropTypes.func,
};
RightsOriginPicker.defaultProps = { selectedId: "", Option: "label", replacementId: "", onReplacement: () => {},
  replacementLabel: (credit) => credit.source_service_name || "Atendimento - reposição pendente" };
