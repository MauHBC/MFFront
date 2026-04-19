import styled from "styled-components";

/**
 * Toolbar de linha de ações para módulos administrativos.
 *
 * Padrão de referência: Planos.
 *
 * Hierarquia de uso:
 *
 *   <AppToolbar>
 *     <AppToolbarLeft>
 *       <select>...</select>
 *     </AppToolbarLeft>
 *     <button>Ação primária</button>
 *   </AppToolbar>
 *
 * Para toolbars com dois lados explícitos:
 *
 *   <AppToolbar>
 *     <AppToolbarLeft>...</AppToolbarLeft>
 *     <AppToolbarRight>...</AppToolbarRight>
 *   </AppToolbar>
 *
 * AppToolbarSpacer empurra conteúdo para direita quando não há AppToolbarRight.
 */

/** Linha principal da toolbar — distribui left/right com espaçamento padrão. */
export const AppToolbar = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;
  flex-wrap: wrap;
`;

/**
 * Lado esquerdo da toolbar — filtros, selects e campos de busca.
 * Inclui estilo padrão para elementos <select> filhos.
 */
export const AppToolbarLeft = styled.div`
  display: flex;
  gap: 10px;
  flex-wrap: wrap;

  select {
    border: 1px solid rgba(106, 121, 92, 0.25);
    border-radius: 8px;
    padding: 8px 12px;
    font-size: 0.88rem;
    color: #1b1b1b;
    background: #fff;
    cursor: pointer;
  }
`;

/** Lado direito da toolbar — botões de ação primária. */
export const AppToolbarRight = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
`;

/** Espaçador flexível — empurra conteúdo seguinte para a direita. */
export const AppToolbarSpacer = styled.div`
  flex: 1;
`;
