import styled from "styled-components";
import { colors, layout, spacing } from "../../styles/tokens";

/**
 * Shell de layout para páginas administrativas do sistema.
 *
 * PageWrapper ocupa toda a viewport, aplica o offset da navbar fixa e o
 * background padrão do app. PageContent centraliza o conteúdo com largura e
 * padding consistentes entre módulos.
 */

export const PageWrapper = styled.div`
  min-height: 100vh;
  background: ${(p) => p.$background || colors.appBackground};
  padding-top: ${(p) => p.$paddingTop || "90px"};
  padding-bottom: ${(p) => p.$paddingBottom || "0"};
`;

export const PageContent = styled.main`
  max-width: ${(p) => p.$maxWidth || layout.pageMaxWidth};
  margin: 0 auto;
  padding: ${(p) => p.$paddingTop || spacing.pageTop}
    ${(p) => p.$paddingX || spacing.pageX}
    ${(p) => p.$paddingBottom || spacing.pageBottom};

  @media (max-width: ${(p) => p.$mobileBreakpoint || layout.mobileBreakpoint}) {
    padding: ${(p) => p.$mobilePaddingTop || spacing.pageMobileTop}
      ${(p) => p.$mobilePaddingX || spacing.pageMobileX}
      ${(p) => p.$mobilePaddingBottom || spacing.pageMobileBottom};
  }
`;
