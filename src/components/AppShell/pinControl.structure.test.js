import fs from "fs";
import path from "path";

const componentSource = fs.readFileSync(path.join(__dirname, "index.js"), "utf8");
const stylesSource = fs.readFileSync(path.join(__dirname, "styled.js"), "utf8");

describe("AppShell - estrutura do controle da sidebar", () => {
  it("mantém a seta na área da clínica e remove o botão grande de fixação", () => {
    const tenantArea = componentSource.slice(
      componentSource.indexOf("<TenantArea"),
      componentSource.indexOf("</TenantArea>"),
    );

    expect(tenantArea).toContain("<SidebarToggleButton");
    expect(tenantArea).toContain("<FaChevron");
    expect(tenantArea).not.toContain("<FaThumbtack");
    expect(tenantArea).toContain('className="app-shell-desktop-only"');
    expect(componentSource).not.toContain("<SidebarFooter");
    expect(componentSource).not.toContain("Fixar aberta");
    expect(componentSource).not.toContain("app-shell-pin-button");
  });

  it("aparece somente quando expandida no desktop e permanece ausente no drawer móvel", () => {
    const start = stylesSource.indexOf("export const SidebarToggleButton");
    const end = stylesSource.indexOf("export const CloseNavigationButton", start);
    const toggleStyles = stylesSource.slice(start, end);

    expect(toggleStyles).toContain("position: absolute;");
    expect(toggleStyles).toContain("right: -11px;");
    expect(toggleStyles).toContain("width: 22px;");
    expect(toggleStyles).toMatch(/display:\s*\$\{\(p\).*?"inline-flex".*?"none".*?\};/);
    expect(toggleStyles).toContain("@media (max-width:");
    expect(toggleStyles).toContain("layout.sidebarBreakpoint");
    expect(toggleStyles).toContain("display: none;");
    expect(toggleStyles).toContain("@media (prefers-reduced-motion: reduce)");
    expect(toggleStyles).toContain("transition: none;");
    expect(componentSource).toContain(
      "button:not([disabled]):not(.app-shell-desktop-only)",
    );
  });
});
