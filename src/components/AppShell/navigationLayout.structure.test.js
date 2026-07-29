import fs from "fs";
import path from "path";

const componentSource = fs.readFileSync(path.join(__dirname, "index.js"), "utf8");
const stylesSource = fs.readFileSync(path.join(__dirname, "styled.js"), "utf8");

describe("AppShell navigation layout", () => {
  it("usa o mesmo contêiner estrutural para ícones diretos e expansíveis", () => {
    expect(componentSource).toMatch(
      /<NavigationModuleButton[\s\S]*?<NavigationIcon aria-hidden="true">\s*<Icon \/>\s*<\/NavigationIcon>[\s\S]*?<NavigationText/,
    );
    expect(componentSource).toMatch(
      /<NavigationLink[\s\S]*?<NavigationIcon aria-hidden="true">\s*<Icon \/>\s*<\/NavigationIcon>[\s\S]*?<NavigationText/,
    );
  });

  it("mantém padding, eixo dos ícones e coluna dos textos invariáveis", () => {
    expect(stylesSource).toMatch(
      /const navigationItemStyles = css`[\s\S]*justify-content: flex-start;[\s\S]*gap: \$\{spacing\.md\};[\s\S]*padding: \$\{spacing\.sm\};/,
    );
    expect(stylesSource).toMatch(
      /export const NavigationIcon = styled\.span`[\s\S]*width: 28px;[\s\S]*flex: 0 0 28px;[\s\S]*align-items: center;[\s\S]*justify-content: center;/,
    );
    expect(stylesSource).not.toMatch(
      /justify-content: \$\{\(p\) => \(p\.\$expanded \? "flex-start" : "center"\)\}/,
    );
    expect(stylesSource).not.toMatch(
      /padding: \$\{spacing\.sm\} \$\{\(p\) => \(p\.\$expanded/,
    );
  });

  it("centraliza verticalmente texto, ícone e seta do Financeiro", () => {
    expect(stylesSource).toMatch(
      /const navigationItemStyles = css`[\s\S]*display: flex;[\s\S]*align-items: center;/,
    );
    expect(stylesSource).toMatch(
      /export const NavigationChevron = styled\.span`[\s\S]*display: \$\{\(p\) => \(p\.\$expanded \? "inline-flex" : "none"\)\};[\s\S]*align-items: center;[\s\S]*justify-content: center;/,
    );
  });
});
