import styled from "styled-components";

/**
 * Shell visual dos módulos administrativos do app.
 *
 * Padrão de referência: Planos / Agendamentos.
 *
 * Hierarquia de uso:
 *
 *   <ModuleHeader>
 *     <ModuleTitle>Título da página</ModuleTitle>
 *     [<ModuleSubtitle>Descrição opcional</ModuleSubtitle>]
 *   </ModuleHeader>
 *
 *   [<ModuleActions>
 *     <button>...</button>
 *   </ModuleActions>]
 *
 *   <ModuleTabs>
 *     <ModuleTabButton $active={...} type="button" onClick={...}>Aba</ModuleTabButton>
 *   </ModuleTabs>
 *
 *   <ModuleBody>
 *     [<ModulePanel>...</ModulePanel>]
 *     ...conteúdo da aba...
 *   </ModuleBody>
 */

/** Cabeçalho da página — margem inferior padrão antes das abas/conteúdo. */
export const ModuleHeader = styled.div`
  margin-bottom: 24px;
`;

/** Título principal da página (h1). */
export const ModuleTitle = styled.h1`
  font-size: 2.5rem;
  font-weight: 800;
  color: #1b1b1b;
  margin: 0;

  @media (max-width: 859px) {
    font-size: 1.875rem;
  }
`;

/** Subtítulo / descrição opcional abaixo do título. */
export const ModuleSubtitle = styled.p`
  font-size: 0.938rem;
  color: #6a795c;
  margin: 6px 0 0;

  @media (max-width: 859px) {
    font-size: 0.813rem;
  }
`;

/** Faixa de ações do cabeçalho (botões, filtros globais). */
export const ModuleActions = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  margin-top: 12px;
`;

/** Barra de abas — usa padrão border-bottom linear. */
export const ModuleTabs = styled.div`
  display: flex;
  border-bottom: 2px solid rgba(106, 121, 92, 0.14);
  margin-bottom: 24px;
  gap: 0;
`;

/**
 * Botão de aba.
 * Props:
 *   $active  {boolean}  indica aba selecionada
 */
export const ModuleTabButton = styled.button`
  padding: 10px 22px;
  font-size: 0.9rem;
  font-weight: 700;
  color: ${(p) => (p.$active ? "#3d5230" : "#6a795c")};
  border: none;
  border-bottom: 2px solid ${(p) => (p.$active ? "#6a795c" : "transparent")};
  background: transparent;
  cursor: pointer;
  margin-bottom: -2px;
  transition: color 0.15s;

  &:hover {
    color: #3d5230;
  }
`;

/** Área de conteúdo da aba/seção ativa. */
export const ModuleBody = styled.div``;

/**
 * Painel em card — para conteúdo que precisa de destaque visual
 * (borda, fundo branco, border-radius). Uso opcional dentro de ModuleBody.
 */
export const ModulePanel = styled.div`
  background: #fff;
  border: 1px solid rgba(106, 121, 92, 0.14);
  border-radius: 12px;
  padding: 20px 24px;
`;
