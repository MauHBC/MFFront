import fs from "fs";
import path from "path";

const componentSource = fs.readFileSync(path.join(__dirname, "index.js"), "utf8");
const stylesSource = fs.readFileSync(path.join(__dirname, "styled.js"), "utf8");

describe("AppShell - estrutura do controle de fixação", () => {
  it("mantém o botão no cabeçalho e remove o controle textual do rodapé", () => {
    const tenantArea = componentSource.slice(
      componentSource.indexOf("<TenantArea"),
      componentSource.indexOf("</TenantArea>"),
    );

    expect(tenantArea).toContain("<SidebarPinButton");
    expect(tenantArea).toContain("<FaThumbtack");
    expect(tenantArea).toContain('className="app-shell-desktop-only"');
    expect(componentSource).not.toContain("<SidebarFooter");
    expect(componentSource).not.toContain("Fixar aberta");
    expect(componentSource).not.toContain("app-shell-pin-button");
  });

  it("aparece somente quando expandida no desktop e permanece ausente no drawer móvel", () => {
    const start = stylesSource.indexOf("export const SidebarPinButton");
    const end = stylesSource.indexOf("export const CloseNavigationButton", start);
    const pinStyles = stylesSource.slice(start, end);

    expect(pinStyles).toMatch(/display:\s*\$\{\(p\).*?"inline-flex".*?"none".*?\};/);
    expect(pinStyles).toContain("@media (max-width:");
    expect(pinStyles).toContain("layout.sidebarBreakpoint");
    expect(pinStyles).toContain("display: none;");
    expect(pinStyles).toContain("@media (prefers-reduced-motion: reduce)");
    expect(pinStyles).toContain("transition: none;");
    expect(componentSource).toContain(
      "button:not([disabled]):not(.app-shell-desktop-only)",
    );
  });
});
