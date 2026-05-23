import styled from "styled-components";
import { alpha, colors, fontSizes, radii } from "../../styles/tokens";

/**
 * Tabela padrão para módulos administrativos do app.
 */

export const TableWrap = styled.div`
  overflow-x: auto;
  border-radius: ${radii.lg};
  border: 1px solid ${alpha.brand014};
  background: ${colors.white};
`;

export const DataTable = styled.table`
  width: 100%;
  border-collapse: collapse;
  font-size: ${fontSizes.compact};
`;

export const TH = styled.th`
  text-align: left;
  padding: 12px 14px;
  font-size: ${fontSizes.tiny};
  font-weight: 700;
  color: ${colors.brand};
  text-transform: uppercase;
  letter-spacing: 0.05em;
  border-bottom: 1px solid ${alpha.brand012};
  white-space: nowrap;
  background: ${colors.tableHeaderBackground};
`;

export const TD = styled.td`
  padding: 12px 14px;
  color: ${colors.ink};
  border-bottom: 1px solid ${alpha.brand007};
  vertical-align: middle;

  strong {
    font-weight: 700;
  }

  tr:last-child & {
    border-bottom: none;
  }
`;
