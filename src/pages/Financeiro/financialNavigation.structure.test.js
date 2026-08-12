import fs from "fs";
import path from "path";

const source = fs.readFileSync(path.join(__dirname, "index.js"), "utf8");
const routesSource = fs.readFileSync(path.join(__dirname, "../../routes/index.js"), "utf8");

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

  it("protege Configurações com nível manage e capacidade finance.configure", () => {
    const settingsRouteStart = routesSource.indexOf('"/financeiro/configuracoes"');
    const settingsRoute = routesSource.slice(settingsRouteStart, settingsRouteStart + 650);

    expect(settingsRouteStart).toBeGreaterThanOrEqual(0);
    expect(settingsRoute).toContain('minimumAccessLevel="manage"');
    expect(settingsRoute).toContain('requiredCapability="finance.configure"');
    expect(settingsRoute).toContain('requiredModule="finance"');
  });

  it("preserva Recebimentos dedicado como desabilitado intencional", () => {
    expect(source).toContain("Mantemos a view antiga disponivel no codigo");
    expect(source).toContain("const SHOW_DEDICATED_PAYMENTS_VIEW = false;");
    expect(source).toContain("SHOW_DEDICATED_PAYMENTS_VIEW && receitasView === \"recebimentos\"");
    expect(source).toContain("const renderPayments = () => (");
  });
});
