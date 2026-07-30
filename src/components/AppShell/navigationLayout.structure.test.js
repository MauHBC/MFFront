import fs from "fs";
import path from "path";

const componentSource = fs.readFileSync(path.join(__dirname, "index.js"), "utf8");
const stylesSource = fs.readFileSync(path.join(__dirname, "styled.js"), "utf8");

describe("AppShell navigation layout", () => {
  it("usa a mesma apresentação estrutural para links diretos e expansíveis", () => {
    expect(componentSource).toMatch(
      /<NavigationModuleButton[\s\S]*?<NavigationItemPresentation[\s\S]*?icon=\{Icon\}[\s\S]*?label=\{item\.label\}/,
    );
    expect(componentSource).toMatch(
      /<NavigationLink[\s\S]*?<NavigationItemPresentation[\s\S]*?icon=\{Icon\}[\s\S]*?label=\{item\.label\}/,
    );
    expect(componentSource).toMatch(
      /function NavigationItemPresentation[\s\S]*?<NavigationItemContent[\s\S]*?<NavigationIcon[\s\S]*?<NavigationText[\s\S]*?<NavigationItemTrailing/,
    );
  });

  it("mantém o eixo calculado dos ícones em 38px nos dois estados", () => {
    const navigationPadding = 12;
    const itemPadding = 12;
    const iconColumn = 28;
    const expandedAxis = navigationPadding + itemPadding + (iconColumn / 2);
    const collapsedAxis = navigationPadding + itemPadding + (iconColumn / 2);

    expect(expandedAxis).toBe(38);
    expect(collapsedAxis).toBe(expandedAxis);
    expect(stylesSource).toMatch(
      /--navigation-inline-padding: \$\{spacing\.md\};[\s\S]*--navigation-item-inline-padding: \$\{spacing\.md\};[\s\S]*--navigation-icon-column: 28px;/,
    );
    expect(stylesSource).toMatch(
      /const navigationItemStyles = css`[\s\S]*padding: \$\{spacing\.sm\} var\(--navigation-item-inline-padding\);/,
    );
    expect(stylesSource).not.toMatch(
      /navigationItemStyles[\s\S]*padding:[^;]*\$expanded/,
    );
  });

  it("preserva a faixa vertical do título ao recolher a sidebar", () => {
    expect(stylesSource).toMatch(
      /export const NavigationLabel = styled\.p`[\s\S]*visibility: \$\{\(p\) => \(p\.\$expanded \? "visible" : "hidden"\)\};/,
    );
    expect(stylesSource).not.toMatch(
      /export const NavigationLabel = styled\.p`[^`]*display: \$\{\(p\) => \(p\.\$expanded \? "block" : "none"\)\};/,
    );
    expect(stylesSource).toMatch(
      /export const NavigationLabel = styled\.p`[\s\S]*@media \(max-width: \$\{layout\.sidebarBreakpoint\}\)[\s\S]*visibility: visible;/,
    );
    expect(stylesSource).toMatch(
      /export const NavigationLabel = styled\.p`[\s\S]*font-size: \$\{\(p\) => \(p\.\$expanded \? "0\.7rem" : "0"\)\};[\s\S]*overflow: hidden;/,
    );
  });

  it("isola ícone, texto e seta em colunas determinísticas", () => {
    expect(stylesSource).toMatch(
      /export const NavigationItemContent = styled\.span`[\s\S]*display: grid;[\s\S]*var\(--navigation-icon-column\) minmax\(0, 1fr\) var\(--navigation-action-column\)[\s\S]*align-items: center;/,
    );
    expect(stylesSource).toMatch(
      /export const NavigationItemTrailing = styled\.span`[\s\S]*width: var\(--navigation-action-column\);[\s\S]*align-items: center;[\s\S]*justify-content: center;/,
    );
    expect(stylesSource).not.toMatch(
      /export const NavigationChevron = styled\.span`[^`]*margin-left: auto;/,
    );
  });

  it("alinha o texto de links e botões na mesma coordenada inicial", () => {
    expect(stylesSource).toMatch(
      /const navigationItemStyles = css`[\s\S]*padding: \$\{spacing\.sm\} var\(--navigation-item-inline-padding\);[\s\S]*text-align: left;/,
    );
    expect(stylesSource).toMatch(
      /export const NavigationLink = styled\.a`\s*\$\{navigationItemStyles\}/,
    );
    expect(stylesSource).toMatch(
      /export const NavigationModuleButton = styled\.button`\s*\$\{navigationItemStyles\}/,
    );
    expect(stylesSource).toMatch(
      /export const NavigationText = styled\.span`[\s\S]*justify-self: start;/,
    );
  });

  it("remove texto e seta do fluxo compacto e restaura as colunas no drawer", () => {
    expect(stylesSource).toMatch(
      /NavigationItemContent[\s\S]*: "var\(--navigation-icon-column\)"[\s\S]*@media \(max-width: \$\{layout\.sidebarBreakpoint\}\)[\s\S]*grid-template-columns:[\s\S]*var\(--navigation-action-column\)/,
    );
    expect(stylesSource).toMatch(
      /NavigationItemTrailing[\s\S]*display: \$\{\(p\) => \(p\.\$expanded \? "inline-flex" : "none"\)\};[\s\S]*@media \(max-width: \$\{layout\.sidebarBreakpoint\}\)[\s\S]*display: inline-flex;/,
    );
  });

  it("orienta o chevron para a direita fechado e para baixo aberto", () => {
    expect(stylesSource).toMatch(
      /export const NavigationChevron = styled\.span`[\s\S]*transform: rotate\(\$\{\(p\) => \(p\.\$open \? "0deg" : "-90deg"\)\}\);/,
    );
    expect(stylesSource).toMatch(
      /export const NavigationChevron = styled\.span`[\s\S]*@media \(prefers-reduced-motion: reduce\)[\s\S]*transition: none;/,
    );
  });

  it("agrupa subitens em uma superfície contínua e centraliza seu grid", () => {
    expect(stylesSource).toMatch(
      /export const SubnavigationList = styled\.ul`[\s\S]*margin: 0 0 \$\{spacing\.xs\};[\s\S]*border-left: 3px solid var\(--navigation-submenu-indicator\);[\s\S]*border-radius: 0;[\s\S]*background: var\(--navigation-submenu-surface\);/,
    );
    expect(stylesSource).not.toMatch(
      /export const SubnavigationList = styled\.ul`[\s\S]*&::before/,
    );
    expect(stylesSource).toMatch(
      /export const SubnavigationLink = styled\.a`[\s\S]*min-height: 42px;[\s\S]*display: grid;[\s\S]*grid-template-columns: minmax\(0, 1fr\) auto;[\s\S]*align-items: center;[\s\S]*padding: \$\{spacing\.sm\} \$\{spacing\.md\};[\s\S]*line-height: 1\.25;/,
    );
    expect(stylesSource).toMatch(
      /export const SubnavigationLink = styled\.a`[\s\S]*border: 0;[\s\S]*border-radius: 0;/,
    );
  });

  it("diferencia módulo aberto sem reintroduzir marcador no destino direto", () => {
    expect(componentSource).toMatch(
      /<NavigationModuleButton[\s\S]*?\$active=\{active\}[\s\S]*?\$open=\{isOpen\}/,
    );
    expect(stylesSource).toMatch(
      /export const NavigationModuleButton = styled\.button`[\s\S]*p\.\$open \|\| p\.\$active \? "var\(--navigation-module-open-surface\)" : "transparent"/,
    );
    expect(stylesSource).not.toMatch(
      /export const NavigationLink = styled\.a`[\s\S]*&::before/,
    );
  });

  it("alinha o cabeçalho da sidebar e a topbar clara pela altura semântica", () => {
    expect(stylesSource).toMatch(
      /export const TenantArea = styled\.div`[\s\S]*height: \$\{layout\.appHeaderHeight\};[\s\S]*min-height: \$\{layout\.appHeaderHeight\};/,
    );
    expect(stylesSource).toMatch(
      /export const Header = styled\.header`[\s\S]*height: \$\{layout\.appHeaderHeight\};[\s\S]*background: \$\{colors\.surface\};[\s\S]*border-bottom: 1px solid \$\{colors\.borderSubtle\};/,
    );
  });

  it("mantém o contexto da página em uma linha com truncamento seguro", () => {
    expect(stylesSource).toMatch(
      /export const HeaderTitle = styled\.div`[\s\S]*display: flex;[\s\S]*overflow: hidden;[\s\S]*white-space: nowrap;/,
    );
    expect(stylesSource).toMatch(
      /strong \{[\s\S]*min-width: 0;[\s\S]*text-overflow: ellipsis;[\s\S]*white-space: nowrap;/,
    );
  });

  it("remove a causa estrutural do overflow horizontal no modo compacto", () => {
    expect(stylesSource).toMatch(
      /export const Sidebar = styled\.aside`[\s\S]*border-right: 0;[\s\S]*&::after \{[\s\S]*width: 1px;[\s\S]*background: \$\{colors\.appChromeBorder\};/,
    );
    expect(stylesSource).toMatch(
      /export const Navigation = styled\.nav`[\s\S]*overflow-x: clip;[\s\S]*overflow-y: auto;/,
    );
  });
});
