import { Link } from "react-router-dom";
import styled from "styled-components";

/**
 * Botões padrão para módulos administrativos do app.
 *
 * Padrão de referência: Planos.
 *
 * Hierarquia:
 *   PrimaryButton  — ação primária (CTA toolbar, botão com ícone)
 *   GhostButton    — ação secundária/cancelar
 *   LinkGhostButton — ação secundária em formato link neutro
 *   RowActionButton — ação em linha de tabela
 *   DangerButton   — ação destrutiva em linha de tabela (extends RowActionButton)
 *
 * Nota: botões de submit em formulário (drawer footer) podem usar
 * styled(PrimaryButton) com padding e font-size ajustados ao contexto de forma.
 */

/** Botão de ação primária — verde sólido, suporta ícone + texto. */
export const PrimaryButton = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: #6a795c;
  color: #fff;
  border: none;
  border-radius: 8px;
  padding: 9px 16px;
  font-size: 0.88rem;
  font-weight: 700;
  cursor: pointer;
  white-space: nowrap;
  transition: background 0.15s;

  &:hover:not(:disabled) {
    background: #3d5230;
  }

  &:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }
`;

/** Botão fantasma — borda sutil, fundo transparente, para cancelar/ação secundária. */
export const GhostButton = styled.button`
  background: transparent;
  color: #6a795c;
  border: 1px solid rgba(106, 121, 92, 0.28);
  border-radius: 8px;
  padding: 9px 18px;
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.12s;

  &:hover {
    background: rgba(106, 121, 92, 0.06);
  }
`;

/** Link fantasma neutro — usado para "voltar" e ações secundárias de header sem CTA positivo. */
export const LinkGhostButton = styled(Link)`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 10px 18px;
  border-radius: 10px;
  background: #fff;
  color: #6a795c;
  text-decoration: none;
  font-weight: 600;
  border: 1px solid rgba(106, 121, 92, 0.3);
`;

/** Botão de ação em linha de tabela — neutro, compacto. */
export const RowActionButton = styled.button`
  padding: 5px 12px;
  border: 1px solid rgba(106, 121, 92, 0.28);
  border-radius: 6px;
  background: #fff;
  color: #3d5230;
  font-size: 0.81rem;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  transition: background 0.12s;

  &:hover {
    background: rgba(106, 121, 92, 0.08);
  }
`;

/** Botão de ação destrutiva em linha de tabela — extends RowActionButton com cores de perigo. */
export const DangerButton = styled(RowActionButton)`
  border-color: rgba(180, 60, 60, 0.28);
  color: #992222;

  &:hover {
    background: rgba(200, 70, 70, 0.07);
  }
`;
