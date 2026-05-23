import styled from "styled-components";
import { alpha, colors, fontSizes, radii } from "../../styles/tokens";

/**
 * Componentes estruturais de formulário para módulos administrativos.
 */

export const Field = styled.label`
  display: flex;
  flex-direction: column;
  gap: 5px;
  font-size: ${fontSizes.compact};
  color: ${colors.ink};
  margin-bottom: 14px;

  input,
  select,
  textarea {
    border: 1px solid ${alpha.brand022};
    border-radius: ${radii.sm};
    padding: 9px 11px;
    font-size: ${fontSizes.body};
    color: ${colors.ink};
    background: ${colors.white};

    &:disabled {
      background: ${colors.fieldDisabledBackground};
      color: ${colors.mutedText};
    }
  }

  textarea {
    resize: vertical;
  }
`;

export const FieldHint = styled.span`
  font-size: 0.74rem;
  color: ${colors.softText};
`;
