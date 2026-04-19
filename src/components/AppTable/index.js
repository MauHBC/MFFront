import styled from "styled-components";

/**
 * Tabela padrão para módulos administrativos do app.
 *
 * Padrão de referência: Planos.
 *
 * Hierarquia de uso:
 *
 *   <TableWrap>
 *     <DataTable>
 *       <thead>
 *         <tr><TH>Coluna</TH></tr>
 *       </thead>
 *       <tbody>
 *         <tr><TD>Valor</TD></tr>
 *       </tbody>
 *     </DataTable>
 *   </TableWrap>
 */

/** Container externo — scroll horizontal, card com borda e fundo branco. */
export const TableWrap = styled.div`
  overflow-x: auto;
  border-radius: 12px;
  border: 1px solid rgba(106, 121, 92, 0.14);
  background: #fff;
`;

/** Elemento <table> — largura total, sem bordas colapsadas. */
export const DataTable = styled.table`
  width: 100%;
  border-collapse: collapse;
  font-size: 0.88rem;
`;

/** Célula de cabeçalho <th>. */
export const TH = styled.th`
  text-align: left;
  padding: 12px 14px;
  font-size: 0.76rem;
  font-weight: 700;
  color: #6a795c;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  border-bottom: 1px solid rgba(106, 121, 92, 0.12);
  white-space: nowrap;
  background: #fafbf8;
`;

/** Célula de dado <td>. */
export const TD = styled.td`
  padding: 12px 14px;
  color: #1b1b1b;
  border-bottom: 1px solid rgba(106, 121, 92, 0.07);
  vertical-align: middle;

  strong {
    font-weight: 700;
  }

  tr:last-child & {
    border-bottom: none;
  }
`;
