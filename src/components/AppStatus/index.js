import styled from "styled-components";

/**
 * Badges e pills de status para módulos administrativos do app.
 *
 * Padrão de referência: Planos (ActivePill + StatusBadge).
 *
 * StatusPill  — badge de status com variante por $tone
 * InfoPill    — badge informativo (azul esverdeado sutil)
 * NeutralPill — badge neutro/cinza
 *
 * Uso:
 *   <StatusPill $tone="active">Ativo</StatusPill>
 *   <StatusPill $tone="paused">Pausado</StatusPill>
 *   <StatusPill $tone="canceled">Cancelado</StatusPill>
 *   <StatusPill $tone="inactive">Inativo</StatusPill>  // → cinza (mesmo que canceled)
 *
 * $tone values:
 *   "active"                → verde  (#3d5230 / rgba(106,121,92,0.12))
 *   "paused"                → âmbar  (#7a5a1a / rgba(214,170,104,0.18))
 *   "canceled" | "inactive" | default → cinza (#999 / rgba(180,180,180,0.14))
 */

const pillBase = `
  display: inline-block;
  padding: 3px 10px;
  border-radius: 20px;
  font-size: 0.77rem;
  font-weight: 700;
`;

export const StatusPill = styled.span`
  ${pillBase}
  background: ${(p) => {
    if (p.$tone === "active") return "rgba(106, 121, 92, 0.12)";
    if (p.$tone === "paused") return "rgba(214, 170, 104, 0.18)";
    return "rgba(180, 180, 180, 0.14)";
  }};
  color: ${(p) => {
    if (p.$tone === "active") return "#3d5230";
    if (p.$tone === "paused") return "#7a5a1a";
    return "#999";
  }};
`;

/** Badge informativo — para notas, avisos, contexto. */
export const InfoPill = styled.span`
  ${pillBase}
  background: rgba(90, 120, 160, 0.12);
  color: #3a5a8a;
`;

/** Badge neutro/cinza — para estados indefinidos ou secundários. */
export const NeutralPill = styled.span`
  ${pillBase}
  background: rgba(180, 180, 180, 0.14);
  color: #999;
`;
