import styled from "styled-components";
import { alpha, colors, radii, shadows } from "../../styles/tokens";

export const InteractiveListRowSurface = styled.div`
  background: ${colors.surface};
  border: 1px solid ${alpha.brand014};
  border-radius: ${radii.lg};
  color: inherit;
  cursor: ${(props) => (props.$clickable ? "pointer" : "default")};
  text-decoration: none;
  transition: background-color 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease;

  &:hover,
  &:focus-within {
    background: ${alpha.brand012};
    border-color: rgba(106, 121, 92, 0.42);
    box-shadow: ${shadows.elevated};
    color: inherit;
    text-decoration: none;
  }

  &:focus-visible {
    outline: 3px solid ${alpha.brand028};
    outline-offset: 2px;
  }
`;
