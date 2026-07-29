import fs from "fs";
import path from "path";

const source = fs.readFileSync(path.join(__dirname, "index.js"), "utf8");

describe("Financeiro - navegação por rota", () => {
  it("remove a antiga navegação principal e mantém somente as tabs de Configurações", () => {
    expect(source).not.toContain("FinanceSectionNavigation");
    expect(source).not.toContain("FinanceSectionButton");
    expect(source).toContain("<SettingsTabs");
    expect(source).toContain("Configurações financeiras");
  });

  it("usa tabs textuais sublinhadas, sem cápsula ou fundo pesado", () => {
    const start = source.indexOf("const SettingsTab = styled.a`");
    const end = source.indexOf("`;", start);
    const styles = source.slice(start, end);

    expect(start).toBeGreaterThanOrEqual(0);
    expect(styles).toContain("background: transparent;");
    expect(styles).toContain('content: "";');
    expect(styles).toContain("height: 3px;");
    expect(styles).toContain("font-weight:");
    expect(styles).not.toContain("border-radius");
  });

  it("deriva as quatro páginas e as duas tabs de Configurações do pathname", () => {
    expect(source).toContain('pathname === "/financeiro/receitas"');
    expect(source).toContain('pathname === "/financeiro/despesas"');
    expect(source).toContain('pathname === "/financeiro/configuracoes"');
    expect(source).toContain('pathname === "/financeiro/configuracoes/formas-pagamento"');
    expect(source).toContain('pathname === "/financeiro/configuracoes/categorias-despesas"');
  });
});
