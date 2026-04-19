import styled from "styled-components";

/**
 * Componentes estruturais de formulário para módulos administrativos.
 *
 * Padrão de referência: Planos.
 *
 * Hierarquia de uso:
 *
 *   <Field>
 *     Rótulo do campo *
 *     <input name="..." value={...} onChange={...} />
 *     <FieldHint>Texto auxiliar abaixo do campo.</FieldHint>
 *   </Field>
 *
 * Field é um <label> que envolve rótulo + elemento nativo (input/select/textarea).
 * Os elementos nativos são estilizados via seletores CSS dentro de Field.
 * Não há componentes Input/Select/TextArea separados — use os elementos HTML nativos.
 *
 * FieldHint — texto auxiliar/dica abaixo do campo.
 */

/**
 * Wrapper de campo de formulário — <label> com rótulo + elemento nativo.
 * Estiliza input, select e textarea filhos via seletores CSS.
 */
export const Field = styled.label`
  display: flex;
  flex-direction: column;
  gap: 5px;
  font-size: 0.88rem;
  color: #1b1b1b;
  margin-bottom: 14px;

  input,
  select,
  textarea {
    border: 1px solid rgba(106, 121, 92, 0.22);
    border-radius: 8px;
    padding: 9px 11px;
    font-size: 0.9rem;
    color: #1b1b1b;
    background: #fff;

    &:disabled {
      background: #f4f5f2;
      color: #888;
    }
  }

  textarea {
    resize: vertical;
  }
`;

/** Texto auxiliar abaixo de um campo — dica, formato aceito, etc. */
export const FieldHint = styled.span`
  font-size: 0.74rem;
  color: #aaa;
`;
