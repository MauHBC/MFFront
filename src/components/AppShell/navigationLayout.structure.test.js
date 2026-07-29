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

  it("remove texto e seta do fluxo compacto e restaura as colunas no drawer", () => {
    expect(stylesSource).toMatch(
      /NavigationItemContent[\s\S]*: "var\(--navigation-icon-column\)"[\s\S]*@media \(max-width: \$\{layout\.sidebarBreakpoint\}\)[\s\S]*grid-template-columns:[\s\S]*var\(--navigation-action-column\)/,
    );
    expect(stylesSource).toMatch(
      /NavigationItemTrailing[\s\S]*display: \$\{\(p\) => \(p\.\$expanded \? "inline-flex" : "none"\)\};[\s\S]*@media \(max-width: \$\{layout\.sidebarBreakpoint\}\)[\s\S]*display: inline-flex;/,
    );
  });
});
