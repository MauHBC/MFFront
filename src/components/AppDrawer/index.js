import styled from "styled-components";
import { alpha, colors, layout } from "../../styles/tokens";

/**
 * Drawer lateral padronizado para o app admin.
 */

export const AppDrawer = styled.aside`
  position: fixed;
  top: ${layout.topbarHeight};
  right: 0;
  width: 440px;
  max-width: 90vw;
  height: calc(100vh - ${layout.topbarHeight});
  background: ${colors.white};
  box-shadow: -12px 0 24px ${alpha.drawerShadow};
  transform: ${(props) => (props.$open ? "translateX(0)" : "translateX(100%)")};
  transition: transform 0.3s ease;
  z-index: 20;
  display: flex;
  flex-direction: column;
`;

export const DrawerBackdrop = styled.div`
  position: fixed;
  top: ${layout.topbarHeight};
  left: 0;
  right: 0;
  bottom: 0;
  background: ${alpha.overlay};
  z-index: 10;
`;

export const DrawerHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 18px 20px 16px;
  border-bottom: 1px solid ${alpha.brand012};
  flex-shrink: 0;
`;

export const DrawerTitle = styled.h2`
  font-size: 1rem;
  font-weight: 800;
  color: ${colors.ink};
  margin: 0;
`;

export const DrawerCloseBtn = styled.button`
  background: none;
  border: none;
  color: ${colors.softText};
  cursor: pointer;
  padding: 4px;
  font-size: 1rem;
  display: flex;
  align-items: center;
  transition: color 0.12s;

  &:hover {
    color: ${colors.ink};
  }
`;

export const DrawerBody = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 20px;
`;

export const DrawerFooter = styled.div`
  display: flex;
  gap: 10px;
  justify-content: flex-end;
  margin-top: 24px;
  padding-top: 16px;
  border-top: 1px solid ${alpha.brand010};
`;
