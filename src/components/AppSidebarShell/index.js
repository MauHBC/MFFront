import styled from "styled-components";

/**
 * Shell de layout para módulos com sidebar lateral colapsável.
 *
 * Padrão de referência: Financeiro.
 *
 * Uso:
 *   <SidebarShellWrapper $collapsed={isSidebarCollapsed}>
 *     <SidebarShellLayout $collapsed={isSidebarCollapsed}>
 *       <AppSidebar .../>
 *       <SidebarMainArea>
 *         {conteúdo da seção ativa}
 *       </SidebarMainArea>
 *     </SidebarShellLayout>
 *     {overlay}
 *     {modais}
 *   </SidebarShellWrapper>
 *
 * Constantes internas (não exportadas):
 *   TOPBAR_HEIGHT          = 80px
 *   SIDEBAR_WIDTH          = 240px
 *   SIDEBAR_COLLAPSED_WIDTH = 86px
 *
 * Props:
 *   SidebarShellWrapper  $collapsed {boolean}
 *   SidebarShellLayout   $collapsed {boolean}
 */

/** Wrapper externo da página — define CSS vars de topbar e sidebar. */
export const SidebarShellWrapper = styled.div`
  min-height: 100vh;
  background: #f6f7f2;
  --topbar-height: 80px;
  --sidebar-width: ${(p) => (p.$collapsed ? "86px" : "240px")};
  padding-top: var(--topbar-height);
`;

/** Flex container que posiciona sidebar + área principal lado a lado. */
export const SidebarShellLayout = styled.div`
  display: flex;
  align-items: stretch;
  width: 100%;
  min-height: calc(100vh - var(--topbar-height));
  box-sizing: border-box;
  padding-left: var(--sidebar-width);

  @media (max-width: 960px) {
    flex-direction: column;
    padding-left: 0;
  }
`;

/** Área de conteúdo principal — ocupa o espaço restante após a sidebar. */
export const SidebarMainArea = styled.div`
  display: flex;
  flex-direction: column;
  gap: 24px;
  flex: 1;
  padding: 24px 32px 64px;
  min-width: 0;

  @media (max-width: 960px) {
    padding: 24px 20px 64px;
  }
`;
