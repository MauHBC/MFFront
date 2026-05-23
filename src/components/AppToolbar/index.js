import styled from "styled-components";
import { alpha, colors, fontSizes, radii } from "../../styles/tokens";

export const AppToolbar = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;
  flex-wrap: wrap;
`;

export const AppToolbarLeft = styled.div`
  display: flex;
  gap: 10px;
  flex-wrap: wrap;

  select {
    border: 1px solid ${alpha.brand025};
    border-radius: ${radii.sm};
    padding: 8px 12px;
    font-size: ${fontSizes.compact};
    color: ${colors.ink};
    background: ${colors.white};
    cursor: pointer;
  }
`;

export const AppToolbarRight = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
`;

export const AppToolbarSpacer = styled.div`
  flex: 1;
`;
