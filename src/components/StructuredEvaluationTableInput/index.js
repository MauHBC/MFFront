import React, { useRef } from "react";
import PropTypes from "prop-types";
import { Field } from "../AppForm";
import { GhostButton } from "../AppButton";
import { DataTable, TableWrap, TH, TD } from "../AppTable";

// Composition of existing fields/table/actions; the Backend owns completeness.
export default function StructuredEvaluationTableInput({ block, value, onChange }) {
  const columns = Array.isArray(block.config?.columns) ? block.config.columns : [];
  const rows = Array.isArray(value) ? value : [];
  const rowKeys = useRef([]);
  const nextKey = useRef(0);
  while (rowKeys.current.length < rows.length) {
    rowKeys.current.push(`row-${nextKey.current}`);
    nextKey.current += 1;
  }
  const removeRow = (index) => {
    rowKeys.current.splice(index, 1);
    onChange(rows.filter((_, i) => i !== index));
  };
  const maximum = Number(block.config?.maxLines);
  const canAdd = !(maximum > 0) || rows.length < maximum;
  const changeCell = (index, columnId, next) => onChange(rows.map((row, i) => (
    i === index ? { ...row, [columnId]: next } : row
  )));
  return (
    <div>
      <TableWrap>
        <DataTable aria-label={block.label}>
          <thead><tr>{columns.map((column) => <TH key={column.id} scope="col">{column.label}</TH>)}<TH scope="col">Ações</TH></tr></thead>
          <tbody>{rows.map((row, index) => (
            <tr key={rowKeys.current[index]}>
              {columns.map((column) => (
                <TD key={column.id}>
                  <Field>
                    <span>{column.label} — linha {index + 1}</span>
                    <input type="text" value={row?.[column.id] ?? ""} onChange={(event) => changeCell(index, column.id, event.target.value)} />
                  </Field>
                </TD>
              ))}
              <TD><GhostButton type="button" aria-label={`Remover linha ${index + 1} de ${block.label}`} onClick={() => removeRow(index)}>Remover</GhostButton></TD>
            </tr>
          ))}</tbody>
        </DataTable>
      </TableWrap>
      <GhostButton type="button" disabled={!columns.length || !canAdd} onClick={() => onChange([...rows, {}])}>Adicionar linha em {block.label}</GhostButton>
    </div>
  );
}

StructuredEvaluationTableInput.propTypes = {
  block: PropTypes.shape({
    label: PropTypes.string.isRequired,
    config: PropTypes.shape({
      columns: PropTypes.arrayOf(PropTypes.shape({
        id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
        label: PropTypes.string.isRequired,
      })),
      maxLines: PropTypes.number,
    }),
  }).isRequired,
  value: PropTypes.arrayOf(PropTypes.objectOf(PropTypes.oneOfType([PropTypes.string, PropTypes.number, PropTypes.bool]))),
  onChange: PropTypes.func.isRequired,
};
StructuredEvaluationTableInput.defaultProps = { value: undefined };
