import styled from "styled-components";

/**
 * Tokens e componentes compartilhados para status de sessão (agendamentos).
 *
 * Padrão de referência: Agendamentos — visualização dia (DayActionButton).
 *
 * Exporta:
 *   SESSION_STATUS_COLORS  — tokens de cor por status (para reutilização em styled-components)
 *   sessionStatusColors(s) — helper de lookup com fallback para "scheduled"
 *   SessionStatusPill      — badge compacto inline (apenas exibição, sem interação)
 *   SessionStatusButton    — botão de ação com cores vivas por status (interativo)
 *
 * Props comuns:
 *   $status  — "scheduled" | "done" | "no_show" | "canceled"
 *   $active  — boolean — indica o status atualmente selecionado (SessionStatusButton)
 */

export const SESSION_STATUS_COLORS = {
  scheduled: {
    border: "rgba(106, 121, 92, 0.24)",
    bgInactive: "#fff",
    bgActive: "#6a795c",
    textInactive: "#516046",
    textActive: "#fff",
    pillBg: "rgba(106, 121, 92, 0.12)",
    pillText: "#516046",
  },
  done: {
    border: "rgba(94, 135, 90, 0.32)",
    bgInactive: "rgba(94, 135, 90, 0.12)",
    bgActive: "#2f5a33",
    textInactive: "#2f5a33",
    textActive: "#fff",
    pillBg: "rgba(47, 90, 51, 0.12)",
    pillText: "#2f5a33",
  },
  no_show: {
    border: "rgba(214, 170, 104, 0.34)",
    bgInactive: "rgba(214, 170, 104, 0.14)",
    bgActive: "#8a5718",
    textInactive: "#8a5718",
    textActive: "#fff",
    pillBg: "rgba(138, 87, 24, 0.12)",
    pillText: "#8a5718",
  },
  canceled: {
    border: "rgba(199, 102, 102, 0.3)",
    bgInactive: "rgba(199, 102, 102, 0.11)",
    bgActive: "#7b3a3a",
    textInactive: "#7b3a3a",
    textActive: "#fff",
    pillBg: "rgba(123, 58, 58, 0.12)",
    pillText: "#7b3a3a",
  },
};

/** Retorna os tokens de cor do status, com fallback para "scheduled". */
export const sessionStatusColors = (status) =>
  SESSION_STATUS_COLORS[status] || SESSION_STATUS_COLORS.scheduled;

/** Badge compacto para exibição de status (sem interação). */
export const SessionStatusPill = styled.span`
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 0.68rem;
  font-weight: 700;
  background: ${(p) => sessionStatusColors(p.$status).bgActive};
  color: ${(p) => sessionStatusColors(p.$status).textActive};
`;

/** Botão de ação com cores vivas por status — padrão da visualização dia. */
export const SessionStatusButton = styled.button`
  border: 1px solid ${(p) => sessionStatusColors(p.$status).border};
  background: ${(p) =>
    p.$active
      ? sessionStatusColors(p.$status).bgActive
      : sessionStatusColors(p.$status).bgInactive};
  color: ${(p) =>
    p.$active
      ? sessionStatusColors(p.$status).textActive
      : sessionStatusColors(p.$status).textInactive};
  padding: 7px 10px;
  border-radius: 9px;
  font-weight: 700;
  font-size: 0.82rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: transform 120ms ease, box-shadow 120ms ease, filter 120ms ease;

  &:hover {
    transform: translateY(-1px);
    box-shadow: 0 8px 18px rgba(42, 52, 35, 0.08);
    filter: brightness(0.98);
  }
`;
