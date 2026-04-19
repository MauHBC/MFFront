/**
 * Template oficial — Módulo sem Sidebar (Shell 1)
 *
 * Este arquivo é um modelo estrutural, não uma tela funcional.
 * Copie-o como ponto de partida para qualquer novo módulo CRUD
 * administrativo simples (sem navegação lateral).
 *
 * Referência de implementação real: src/pages/Planos/index.js
 *
 * Regra: novo módulo nasce deste template,
 * não de uma cópia de Planos, Agendamentos ou qualquer outra página.
 */

import React, { useState, useCallback } from "react";
import { FaPlus, FaTimes } from "react-icons/fa";

// Shell 1 — layout de página
import { PageWrapper, PageContent } from "../components/AppLayout";

// Estrutura do módulo
import {
  ModuleHeader,
  ModuleTitle,
  ModuleSubtitle,
  ModuleActions,
  ModuleTabs,
  ModuleTabButton,
  ModuleBody,
  ModulePanel,
} from "../components/AppModuleShell";

// Toolbar
import { AppToolbar, AppToolbarLeft, AppToolbarRight } from "../components/AppToolbar";

// Tabela
import { TableWrap, DataTable, TH, TD } from "../components/AppTable";

// Botões
import {
  PrimaryButton,
  GhostButton,
  RowActionButton,
  DangerButton,
} from "../components/AppButton";

// Status
import { StatusPill } from "../components/AppStatus";

// Formulário
import { Field, FieldHint } from "../components/AppForm";

// Drawer lateral de CRUD
import {
  AppDrawer,
  DrawerBackdrop,
  DrawerHeader,
  DrawerTitle,
  DrawerCloseBtn,
  DrawerBody,
  DrawerFooter,
} from "../components/AppDrawer";

import styled from "styled-components";

// ---------------------------------------------------------------------------
// Styled-components locais — apenas o que não existe nos compartilhados.
// Cada definição local deve ter um comentário justificando sua existência.
// ---------------------------------------------------------------------------

// Submit do drawer — padding de formulário diverge do PrimaryButton padrão.
const SaveBtn = styled(PrimaryButton)`
  padding: 9px 22px;
  font-size: 0.9rem;
`;

// ---------------------------------------------------------------------------
// Constantes de abas — defina as abas do seu módulo aqui.
// Se o módulo não tiver abas, remova ModuleTabs e TABS.
// ---------------------------------------------------------------------------
const TABS = {
  ALL:    "all",
  ACTIVE: "active",
};

// ---------------------------------------------------------------------------
// Componente principal
// ---------------------------------------------------------------------------
export default function StandardModuleTemplate() {
  // Aba ativa (remover se não houver abas)
  const [activeTab, setActiveTab] = useState(TABS.ALL);

  // Drawer de CRUD
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [editingId,    setEditingId]    = useState(null);

  // Filtro da toolbar
  const [statusFilter, setStatusFilter] = useState("all");

  // Handlers do drawer
  const openNew = useCallback(() => {
    setEditingId(null);
    setIsDrawerOpen(true);
  }, []);

  const openEdit = useCallback((id) => {
    setEditingId(id);
    setIsDrawerOpen(true);
  }, []);

  const closeDrawer = useCallback(() => {
    setIsDrawerOpen(false);
    setEditingId(null);
  }, []);

  const handleSubmit = useCallback((e) => {
    e.preventDefault();
    // TODO: chamar serviço de criação/edição
    closeDrawer();
  }, [closeDrawer]);

  // ---------------------------------------------------------------------------
  // JSX principal — composição canônica do Shell 1
  // ---------------------------------------------------------------------------
  return (
    // [1] Wrapper externo — fundo, min-height, offset da navbar
    <PageWrapper>

      {/* [2] Container centralizado com max-width e padding padrão */}
      <PageContent>

        {/* [3] Cabeçalho do módulo */}
        <ModuleHeader>
          <ModuleTitle>Nome do módulo</ModuleTitle>
          <ModuleSubtitle>Descrição breve do que este módulo gerencia.</ModuleSubtitle>

          {/* ModuleActions: opcional — para ações globais no cabeçalho */}
          <ModuleActions>
            <PrimaryButton type="button" onClick={openNew}>
              <FaPlus /> Nova entrada
            </PrimaryButton>
          </ModuleActions>
        </ModuleHeader>

        {/* [4] Abas — remover este bloco se o módulo não tiver abas */}
        <ModuleTabs>
          <ModuleTabButton
            type="button"
            $active={activeTab === TABS.ALL}
            onClick={() => setActiveTab(TABS.ALL)}
          >
            Todos
          </ModuleTabButton>
          <ModuleTabButton
            type="button"
            $active={activeTab === TABS.ACTIVE}
            onClick={() => setActiveTab(TABS.ACTIVE)}
          >
            Ativos
          </ModuleTabButton>
        </ModuleTabs>

        {/* [5] Corpo do módulo — conteúdo da aba ativa */}
        <ModuleBody>

          {/* ModulePanel: opcional — para destaque visual de resumo/métricas */}
          <ModulePanel>
            Conteúdo em destaque (métricas, avisos). Remova se não precisar.
          </ModulePanel>

          {/* [6] Toolbar: filtros à esquerda + ação primária à direita */}
          <AppToolbar>
            <AppToolbarLeft>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                aria-label="Filtrar por status"
              >
                <option value="all">Todos os status</option>
                <option value="active">Ativo</option>
                <option value="canceled">Cancelado</option>
              </select>
            </AppToolbarLeft>
            <AppToolbarRight>
              <PrimaryButton type="button" onClick={openNew}>
                <FaPlus /> Novo
              </PrimaryButton>
            </AppToolbarRight>
          </AppToolbar>

          {/* [7] Tabela administrativa */}
          <TableWrap>
            <DataTable>
              <thead>
                <tr>
                  <TH>Nome</TH>
                  <TH>Descrição</TH>
                  <TH>Status</TH>
                  <TH>Ações</TH>
                </tr>
              </thead>
              <tbody>
                {/* Exemplo de linha — substituir por .map() sobre os dados reais */}
                <tr>
                  <TD><strong>Registro exemplo</strong></TD>
                  <TD>Descrição do registro</TD>
                  <TD>
                    <StatusPill $tone="active">Ativo</StatusPill>
                  </TD>
                  <TD>
                    <RowActionButton type="button" onClick={() => openEdit(1)}>
                      Editar
                    </RowActionButton>
                    <DangerButton type="button">
                      Excluir
                    </DangerButton>
                  </TD>
                </tr>
              </tbody>
            </DataTable>
          </TableWrap>

        </ModuleBody>
      </PageContent>

      {/* [8] Drawer lateral de CRUD — sempre no DOM, visibilidade por $open */}
      <AppDrawer $open={isDrawerOpen}>
        <DrawerHeader>
          <DrawerTitle>
            {editingId ? "Editar registro" : "Novo registro"}
          </DrawerTitle>
          <DrawerCloseBtn type="button" onClick={closeDrawer}>
            <FaTimes />
          </DrawerCloseBtn>
        </DrawerHeader>

        <DrawerBody>
          <form onSubmit={handleSubmit}>
            <Field>
              Nome *
              <input name="name" placeholder="Ex: Nome do registro" required />
            </Field>
            <Field>
              Descrição
              <textarea name="description" rows={3} placeholder="Opcional..." />
              <FieldHint>Máximo 500 caracteres.</FieldHint>
            </Field>
            {/* DrawerFooter dentro do form quando submit é via botão de formulário */}
            <DrawerFooter>
              <GhostButton type="button" onClick={closeDrawer}>
                Cancelar
              </GhostButton>
              <SaveBtn type="submit">
                Salvar
              </SaveBtn>
            </DrawerFooter>
          </form>
        </DrawerBody>
      </AppDrawer>
      {isDrawerOpen && <DrawerBackdrop onClick={closeDrawer} />}

    </PageWrapper>
  );
}
