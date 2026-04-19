import styled from "styled-components";

/**
 * Shell de layout para páginas administrativas do sistema.
 *
 * PageWrapper  — ocupa toda a viewport, aplica o offset da navbar (80px fixo)
 *                e o background padrão do app.
 * PageContent  — container centralizado com largura máxima e padding padrão.
 *
 * Padrão de referência: Planos (defaults).
 *
 * Props opcionais:
 *
 *   PageWrapper:
 *     $paddingTop    {string}  default: "90px"
 *     $paddingBottom {string}  default: "0"
 *     $background    {string}  default: "#f7f8f4"
 *
 *   PageContent:
 *     $maxWidth            {string}  default: "1200px"
 *     $paddingX            {string}  default: "24px"
 *     $paddingTop          {string}  default: "32px"
 *     $paddingBottom       {string}  default: "48px"
 *     $mobileBreakpoint    {string}  default: "768px"
 *     $mobilePaddingX      {string}  default: "16px"
 *     $mobilePaddingTop    {string}  default: "20px"
 *     $mobilePaddingBottom {string}  default: "32px"
 */

export const PageWrapper = styled.div`
  min-height: 100vh;
  background: ${(p) => p.$background || "#f7f8f4"};
  padding-top: ${(p) => p.$paddingTop || "90px"};
  padding-bottom: ${(p) => p.$paddingBottom || "0"};
`;

export const PageContent = styled.main`
  max-width: ${(p) => p.$maxWidth || "1200px"};
  margin: 0 auto;
  padding: ${(p) => p.$paddingTop || "32px"} ${(p) => p.$paddingX || "24px"}
    ${(p) => p.$paddingBottom || "48px"};

  @media (max-width: ${(p) => p.$mobileBreakpoint || "768px"}) {
    padding: ${(p) => p.$mobilePaddingTop || "20px"}
      ${(p) => p.$mobilePaddingX || "16px"}
      ${(p) => p.$mobilePaddingBottom || "32px"};
  }
`;
