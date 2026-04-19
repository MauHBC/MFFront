import styled from "styled-components";

/**
 * Sidebar lateral colapsável para módulos administrativos com navegação lateral.
 *
 * Padrão de referência: Financeiro.
 * Depende de: AppSidebarShell (CSS vars --topbar-height, --sidebar-width).
 *
 * Hierarquia de uso:
 *
 *   <AppSidebar $collapsed={...} $mobileOpen={...}>
 *     <AppSidebarHeader>
 *       <AppSidebarSectionTitle $collapsed={...}>Menu</AppSidebarSectionTitle>
 *       <AppSidebarToggle type="button" onClick={...} aria-label={...}>
 *         {icon}
 *       </AppSidebarToggle>
 *     </AppSidebarHeader>
 *
 *     <AppSidebarSection>
 *       <AppSidebarSectionTitle $collapsed={...}>Seção</AppSidebarSectionTitle>
 *       <AppSidebarButton $active={...} $collapsed={...} onClick={...}>
 *         <AppSidebarIcon $active={...}>{icon}</AppSidebarIcon>
 *         <AppSidebarLabel $collapsed={...}>Rótulo</AppSidebarLabel>
 *       </AppSidebarButton>
 *     </AppSidebarSection>
 *   </AppSidebar>
 *
 *   {isMobile && isSidebarOpen && <AppSidebarOverlay onClick={closeSidebar} />}
 */

/** Sidebar fixa à esquerda — colapsável no desktop, slide no mobile. */
export const AppSidebar = styled.aside`
  background: #fff;
  border-radius: 0 18px 18px 0;
  padding: 18px 16px;
  box-shadow: 6px 0 18px rgba(0, 0, 0, 0.04);
  display: flex;
  flex-direction: column;
  gap: 18px;
  height: calc(100vh - var(--topbar-height));
  position: fixed;
  top: var(--topbar-height);
  left: 0;
  border-right: 1px solid rgba(0, 0, 0, 0.06);
  transition: width 0.2s ease, padding 0.2s ease;
  width: var(--sidebar-width);
  z-index: 60;

  @media (max-width: 960px) {
    position: fixed;
    left: 0;
    top: var(--topbar-height);
    height: calc(100vh - var(--topbar-height));
    width: min(280px, 84vw);
    transform: translateX(${(p) => (p.$mobileOpen ? "0" : "-100%")});
    transition: transform 0.25s ease;
    z-index: 70;
    border-radius: 0 18px 18px 0;
    box-shadow: 12px 0 28px rgba(0, 0, 0, 0.18);
    border-right: none;
  }
`;

/** Linha de topo da sidebar — título "Menu" + botão de colapso. */
export const AppSidebarHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;

  @media (max-width: 960px) {
    width: 100%;
  }
`;

/** Label de seção / título do menu — oculto quando colapsado. */
export const AppSidebarSectionTitle = styled.span`
  font-size: 12px;
  color: #8a8a8a;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  font-weight: 700;
  display: ${(p) => (p.$collapsed ? "none" : "block")};

  @media (max-width: 960px) {
    width: 100%;
    display: block;
  }
`;

/** Botão de colapso/expansão da sidebar. */
export const AppSidebarToggle = styled.button`
  border: 1px solid rgba(0, 0, 0, 0.1);
  background: #fff;
  color: #42523a;
  width: 36px;
  height: 36px;
  border-radius: 10px;
  display: inline-flex;
  align-items: center;
  justify-content: center;

  @media (max-width: 960px) {
    margin-left: auto;
  }
`;

/** Grupo de itens de uma seção da sidebar. */
export const AppSidebarSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
`;

/** Item de navegação da sidebar. */
export const AppSidebarButton = styled.button`
  border: 1px solid ${(p) => (p.$active ? "#6a795c" : "rgba(0, 0, 0, 0.1)")};
  background: ${(p) => (p.$active ? "#6a795c" : "#fff")};
  color: ${(p) => (p.$active ? "#fff" : "#2b2b2b")};
  padding: 10px 14px;
  border-radius: 12px;
  font-weight: 700;
  text-align: left;
  width: 100%;
  display: flex;
  align-items: center;
  gap: 10px;
  justify-content: ${(p) => (p.$collapsed ? "center" : "flex-start")};

  @media (max-width: 960px) {
    width: 100%;
    justify-content: flex-start;
  }
`;

/** Ícone do item de navegação. */
export const AppSidebarIcon = styled.span`
  display: inline-flex;
  align-items: center;
  font-size: 16px;
  color: ${(p) => (p.$active ? "#fff" : "#6a795c")};
`;

/** Rótulo do item de navegação — oculto quando colapsado. */
export const AppSidebarLabel = styled.span`
  display: ${(p) => (p.$collapsed ? "none" : "inline")};

  @media (max-width: 960px) {
    display: inline;
  }
`;

/** Overlay escuro para fechar a sidebar no mobile. */
export const AppSidebarOverlay = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.35);
  z-index: 40;
`;
