import { Link } from "react-router-dom";
import styled from "styled-components";
import { alpha, colors, fontSizes, radii } from "../../styles/tokens";

/**
 * Botões padrão para módulos administrativos do app.
 *
 * Padrão de referência: Planos.
 *
 * Hierarquia:
 *   PrimaryButton - ação primária (CTA toolbar, botão com ícone)
 *   GhostButton - ação secundária/cancelar
 *   LinkGhostButton - ação secundária em formato link neutro
 *   RowActionButton - ação em linha de tabela
 *   DangerButton - ação destrutiva em linha de tabela
 *
 * Nota: botões de submit em formulário (drawer footer) podem usar
 * styled(PrimaryButton) com padding e font-size ajustados ao contexto de forma.
 */

export const PrimaryButton = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: ${colors.brand};
  color: ${colors.white};
  border: none;
  border-radius: ${radii.sm};
  padding: 9px 16px;
  font-size: ${fontSizes.compact};
  font-weight: 700;
  cursor: pointer;
  white-space: nowrap;
  transition: background 0.15s;

  &:hover:not(:disabled) {
    background: ${colors.brandDark};
  }

  &:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }
`;

export const GhostButton = styled.button`
  background: transparent;
  color: ${colors.brand};
  border: 1px solid ${alpha.brand028};
  border-radius: ${radii.sm};
  padding: 9px 18px;
  font-size: ${fontSizes.body};
  font-weight: 600;
  cursor: pointer;
  transition: background 0.12s;

  &:hover {
    background: ${alpha.brand006};
  }
`;

export const LinkGhostButton = styled(Link)`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 10px 18px;
  border-radius: ${radii.md};
  background: ${colors.white};
  color: ${colors.brand};
  text-decoration: none;
  font-weight: 600;
  border: 1px solid ${alpha.brand030};
`;

export const RowActionButton = styled.button`
  padding: 5px 12px;
  border: 1px solid ${alpha.brand028};
  border-radius: ${radii.xs};
  background: ${colors.white};
  color: ${colors.brandDark};
  font-size: ${fontSizes.small};
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  transition: background 0.12s;

  &:hover {
    background: ${alpha.brand008};
  }
`;

export const DangerButton = styled(RowActionButton)`
  border-color: ${colors.dangerBorder};
  color: ${colors.dangerText};

  &:hover {
    background: ${colors.dangerBackgroundHover};
  }
`;
