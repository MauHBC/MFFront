import fs from "fs";
import path from "path";

const shellSource = fs.readFileSync(
  path.join(__dirname, "../../components/AppShell/index.js"),
  "utf8",
);
const shellStyles = fs.readFileSync(
  path.join(__dirname, "../../components/AppShell/styled.js"),
  "utf8",
);
const financeSource = fs.readFileSync(path.join(__dirname, "index.js"), "utf8");

describe("Financeiro - badge de despesas da clínica", () => {
  it("mantém o contador associado ao submenu de despesas sem nova chamada de API", () => {
    expect(financeSource).toContain('key: "financial-expenses"');
    expect(financeSource).toContain("formatExpenseAlertCount(clinicExpenseAlertsCount)");
    expect(shellSource).toContain("navigationBadges[child.key]");
    expect(shellSource).toContain("<SubnavigationBadge");
  });

  it("preserva formato, cor e dimensões compactas no novo submenu", () => {
    expect(shellStyles).toMatch(/export const SubnavigationBadge = styled\.span`[\s\S]*min-width: 20px;/);
    expect(shellStyles).toMatch(/export const SubnavigationBadge = styled\.span`[\s\S]*border-radius: \$\{radii\.pill\};/);
    expect(shellStyles).toMatch(/export const SubnavigationBadge = styled\.span`[\s\S]*background: \$\{colors\.danger\};/);
    expect(shellStyles).toMatch(/export const SubnavigationBadge = styled\.span`[\s\S]*display: inline-flex;/);
  });

  it("não recoloca a navegação horizontal principal removida", () => {
    expect(financeSource).not.toContain("FinanceSectionNavigation");
    expect(financeSource).not.toContain("FinanceSectionButton");
    expect(financeSource).not.toContain("SidebarAlertBadge");
  });
});
