/**
 * Template oficial — Módulo com Sidebar (Shell 2)
 *
 * Este arquivo é um modelo estrutural, não uma tela funcional.
 * Copie-o como ponto de partida para qualquer novo módulo que
 * precise de navegação lateral colapsável.
 *
 * Referência de implementação real: src/pages/Financeiro/index.js
 *
 * Regra: novo módulo com sidebar nasce deste template,
 * não de uma cópia do Financeiro.
 */

import React, { useState, useCallback } from "react";
import { FaBars, FaTimes, FaHome, FaList } from "react-icons/fa";

// Shell 2 — layout com sidebar
import {
  SidebarShellWrapper,
  SidebarShellLayout,
  SidebarMainArea,
} from "../components/AppSidebarShell";
import {
  AppSidebar,
  AppSidebarHeader,
  AppSidebarSectionTitle,
  AppSidebarToggle,
  AppSidebarSection,
  AppSidebarButton,
  AppSidebarIcon,
  AppSidebarLabel,
  AppSidebarOverlay,
} from "../components/AppSidebar";

// Conteúdo interno — mesmos componentes do Shell 1
import { PageContent } from "../components/AppLayout";
import {
  ModuleHeader,
  ModuleTitle,
  ModuleSubtitle,
  ModuleActions,
  ModuleBody,
  ModulePanel,
} from "../components/AppModuleShell";
import { AppToolbar, AppToolbarLeft, AppToolbarRight } from "../components/AppToolbar";
import { TableWrap, DataTable, TH, TD } from "../components/AppTable";
import {
  PrimaryButton,
  GhostButton,
  RowActionButton,
  DangerButton,
} from "../components/AppButton";
import { StatusPill } from "../components/AppStatus";
import { Field, FieldHint } from "../components/AppForm";
import {
  AppDrawer,
  DrawerBackdrop,
  DrawerHeader,
  DrawerTitle,
  DrawerCloseBtn,
  DrawerBody,
  DrawerFooter,
} from "../components/AppDrawer";

// ---------------------------------------------------------------------------
// Constantes de navegação — defina as seções do seu módulo aqui
// ---------------------------------------------------------------------------
const SECTIONS = {
  OVERVIEW: "overview",
  LIST:     "list",
};

// ---------------------------------------------------------------------------
// Componente principal
// ---------------------------------------------------------------------------
export default function SidebarModuleTemplate() {
  // Estado da sidebar
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen]           = useState(false); // mobile
  const isMobile = window.innerWidth <= 960; // substitua por hook useMediaQuery se disponível

  // Seção ativa
  const [activeSection, setActiveSection] = useState(SECTIONS.OVERVIEW);

  // Drawer de CRUD
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Handlers da sidebar
  const handleSidebarToggle = useCallback(() => {
    if (isMobile) {
      setIsSidebarOpen(false);
    } else {
      setIsSidebarCollapsed((c) => !c);
    }
  }, [isMobile]);

  const openSidebar  = useCallback(() => setIsSidebarOpen(true),  []);
  const closeSidebar = useCallback(() => setIsSidebarOpen(false), []);

  // Ícone do botão de colapso
  const sidebarToggleIcon  = isMobile || isSidebarOpen ? <FaTimes /> : (isSidebarCollapsed ? <FaBars /> : <FaTimes />);
  const sidebarToggleLabel = isSidebarCollapsed ? "Expandir menu" : "Recolher menu";

  // Handlers do drawer
  const openDrawer  = useCallback(() => setIsDrawerOpen(true),  []);
  const closeDrawer = useCallback(() => setIsDrawerOpen(false), []);

  // ---------------------------------------------------------------------------
  // Render das seções
  // ---------------------------------------------------------------------------
  const renderContent = () => {
    if (activeSection === SECTIONS.OVERVIEW) {
      return (
        <>
          {/* Cabeçalho da seção */}
          <ModuleHeader>
            <ModuleTitle>Visão geral</ModuleTitle>
            <ModuleSubtitle>Resumo do módulo.</ModuleSubtitle>
            <ModuleActions>
              {/* Ações globais do cabeçalho — opcional */}
              <PrimaryButton type="button" onClick={openDrawer}>
                Nova entrada
              </PrimaryButton>
            </ModuleActions>
          </ModuleHeader>

          <ModuleBody>
            {/* Card de destaque — opcional */}
            <ModulePanel>
              Conteúdo em destaque vai aqui.
            </ModulePanel>
          </ModuleBody>
        </>
      );
    }

    if (activeSection === SECTIONS.LIST) {
      return (
        <>
          <ModuleHeader>
            <ModuleTitle>Lista</ModuleTitle>
            <ModuleSubtitle>Gerencie os registros.</ModuleSubtitle>
          </ModuleHeader>

          <ModuleBody>
            {/* Toolbar de filtros + ação primária */}
            <AppToolbar>
              <AppToolbarLeft>
                <select aria-label="Filtrar por status">
                  <option value="">Todos os status</option>
                  <option value="active">Ativo</option>
                  <option value="canceled">Cancelado</option>
                </select>
              </AppToolbarLeft>
              <AppToolbarRight>
                <PrimaryButton type="button" onClick={openDrawer}>
                  Novo registro
                </PrimaryButton>
              </AppToolbarRight>
            </AppToolbar>

            {/* Tabela administrativa */}
            <TableWrap>
              <DataTable>
                <thead>
                  <tr>
                    <TH>Nome</TH>
                    <TH>Status</TH>
                    <TH>Ações</TH>
                  </tr>
                </thead>
                <tbody>
                  {/* Exemplo de linha */}
                  <tr>
                    <TD>Registro de exemplo</TD>
                    <TD>
                      <StatusPill $tone="active">Ativo</StatusPill>
                    </TD>
                    <TD>
                      <RowActionButton type="button">Editar</RowActionButton>
                      <DangerButton type="button">Excluir</DangerButton>
                    </TD>
                  </tr>
                </tbody>
              </DataTable>
            </TableWrap>
          </ModuleBody>
        </>
      );
    }

    return null;
  };

  // ---------------------------------------------------------------------------
  // JSX principal — composição canônica do Shell 2
  // ---------------------------------------------------------------------------
  return (
    // [1] Wrapper externo — define CSS vars de topbar e sidebar
    <SidebarShellWrapper $collapsed={isSidebarCollapsed}>

      {/* [2] Flex container: sidebar fixa + área de conteúdo */}
      <SidebarShellLayout $collapsed={isSidebarCollapsed}>

        {/* [3] Sidebar lateral colapsável */}
        <AppSidebar $collapsed={isSidebarCollapsed} $mobileOpen={isSidebarOpen}>

          {/* Cabeçalho da sidebar: label "Menu" + botão de colapso */}
          <AppSidebarHeader>
            <AppSidebarSectionTitle $collapsed={isSidebarCollapsed}>
              Menu
            </AppSidebarSectionTitle>
            <AppSidebarToggle
              type="button"
              onClick={handleSidebarToggle}
              aria-label={sidebarToggleLabel}
            >
              {sidebarToggleIcon}
            </AppSidebarToggle>
          </AppSidebarHeader>

          {/* Seção de navegação — repita para cada grupo de itens */}
          <AppSidebarSection>
            <AppSidebarSectionTitle $collapsed={isSidebarCollapsed}>
              Principal
            </AppSidebarSectionTitle>

            <AppSidebarButton
              type="button"
              $active={activeSection === SECTIONS.OVERVIEW}
              $collapsed={isSidebarCollapsed}
              onClick={() => setActiveSection(SECTIONS.OVERVIEW)}
              title="Visão geral"
            >
              <AppSidebarIcon $active={activeSection === SECTIONS.OVERVIEW}>
                <FaHome />
              </AppSidebarIcon>
              <AppSidebarLabel $collapsed={isSidebarCollapsed}>
                Visão geral
              </AppSidebarLabel>
            </AppSidebarButton>

            <AppSidebarButton
              type="button"
              $active={activeSection === SECTIONS.LIST}
              $collapsed={isSidebarCollapsed}
              onClick={() => setActiveSection(SECTIONS.LIST)}
              title="Lista"
            >
              <AppSidebarIcon $active={activeSection === SECTIONS.LIST}>
                <FaList />
              </AppSidebarIcon>
              <AppSidebarLabel $collapsed={isSidebarCollapsed}>
                Lista
              </AppSidebarLabel>
            </AppSidebarButton>
          </AppSidebarSection>

        </AppSidebar>

        {/* [4] Área de conteúdo principal */}
        <SidebarMainArea>
          {/*
            PageContent é opcional aqui: use se quiser centralizar o
            conteúdo com max-width. Omita se o conteúdo deve preencher
            toda a largura disponível (padrão do Financeiro).
          */}
          <PageContent $maxWidth="1200px" $paddingTop="0" $paddingBottom="0">
            {renderContent()}
          </PageContent>
        </SidebarMainArea>

      </SidebarShellLayout>

      {/* [5] Overlay mobile — renderizado fora do Layout para cobrir tudo */}
      {isMobile && isSidebarOpen && (
        <AppSidebarOverlay onClick={closeSidebar} />
      )}

      {/* [6] Drawer lateral de CRUD — fora do Layout, fixo na viewport */}
      <AppDrawer $open={isDrawerOpen}>
        <DrawerHeader>
          <DrawerTitle>Novo registro</DrawerTitle>
          <DrawerCloseBtn type="button" onClick={closeDrawer}>
            <FaTimes />
          </DrawerCloseBtn>
        </DrawerHeader>
        <DrawerBody>
          <form>
            <Field>
              Nome *
              <input name="name" placeholder="Ex: Nome do registro" />
            </Field>
            <Field>
              Descrição
              <textarea name="description" rows={3} placeholder="Opcional..." />
              <FieldHint>Máximo 500 caracteres.</FieldHint>
            </Field>
          </form>
        </DrawerBody>
        <DrawerFooter>
          <GhostButton type="button" onClick={closeDrawer}>
            Cancelar
          </GhostButton>
          <PrimaryButton type="submit">
            Salvar
          </PrimaryButton>
        </DrawerFooter>
      </AppDrawer>
      {isDrawerOpen && <DrawerBackdrop onClick={closeDrawer} />}

    </SidebarShellWrapper>
  );
}
