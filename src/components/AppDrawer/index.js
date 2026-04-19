import styled from "styled-components";

/**
 * Drawer lateral padronizado para o app admin.
 *
 * Padrão de referência: Agendamentos / Planos.
 *
 * Uso:
 *   <AppDrawer $open={isOpen}>
 *     <DrawerHeader>...</DrawerHeader>
 *     <DrawerBody>...</DrawerBody>
 *     <DrawerFooter>...</DrawerFooter>
 *   </AppDrawer>
 *   {isOpen && <DrawerBackdrop onClick={onClose} />}
 *
 * Props:
 *   $open  {boolean}  controla visibilidade via transform (drawer sempre no DOM)
 */

export const AppDrawer = styled.aside`
  position: fixed;
  top: 80px;
  right: 0;
  width: 440px;
  max-width: 90vw;
  height: calc(100vh - 80px);
  background: #fff;
  box-shadow: -12px 0 24px rgba(0, 0, 0, 0.12);
  transform: ${(props) => (props.$open ? "translateX(0)" : "translateX(100%)")};
  transition: transform 0.3s ease;
  z-index: 20;
  display: flex;
  flex-direction: column;
`;

export const DrawerBackdrop = styled.div`
  position: fixed;
  top: 80px;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.2);
  z-index: 10;
`;

export const DrawerHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 18px 20px 16px;
  border-bottom: 1px solid rgba(106, 121, 92, 0.12);
  flex-shrink: 0;
`;

export const DrawerTitle = styled.h2`
  font-size: 1rem;
  font-weight: 800;
  color: #1b1b1b;
  margin: 0;
`;

export const DrawerCloseBtn = styled.button`
  background: none;
  border: none;
  color: #aaa;
  cursor: pointer;
  padding: 4px;
  font-size: 1rem;
  display: flex;
  align-items: center;
  transition: color 0.12s;

  &:hover {
    color: #1b1b1b;
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
  border-top: 1px solid rgba(106, 121, 92, 0.1);
`;
