import fs from "fs";
import path from "path";

const source = fs.readFileSync(path.join(__dirname, "index.js"), "utf8");
const routesSource = fs.readFileSync(path.join(__dirname, "../../routes/index.js"), "utf8");
const shellSource = fs.readFileSync(path.join(__dirname, "../../components/AppShell/styled.js"), "utf8");
const styledBlock = (name, stylesSource = source) => {
  const start = stylesSource.indexOf(`const ${name} = styled`);
  expect(start).toBeGreaterThanOrEqual(0);
  return stylesSource.slice(start, stylesSource.indexOf("`;", start));
};

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

describe("Financeiro - estrutura de rolagem do modal Detalhes, sem validação visual", () => {
  it("limita o modal ao viewport e concentra a rolagem vertical no corpo, sem altura fixa para listas pequenas", () => {
    const overlay = styledBlock("RevenueChargeDetailOverlay");
    const card = styledBlock("RevenueChargeDetailCard");
    const baseCard = styledBlock("ModalCard");
    const body = styledBlock("RevenueChargeDetailBody");
    const sessions = styledBlock("RevenueChargeDetailSessionsTable");
    expect(overlay).toContain("overflow: hidden;");
    expect(card).toContain("max-width: 100%;");
    expect(card).toContain("max-height: calc(100dvh");
    expect(card).toContain("var(--charge-dialog-top)");
    expect(card).toContain("var(--charge-dialog-bottom)");
    expect(card).toContain("@media (max-height: 480px)");
    expect(baseCard).toContain("display: flex;");
    expect(baseCard).toContain("flex-direction: column;");
    expect(baseCard).toContain("overflow: hidden;");
    expect(body).toContain("min-height: 0;");
    expect(body).toContain("display: block;");
    expect(body).toContain("overflow-x: auto;");
    expect(body).toContain("overflow-y: auto;");
    expect(body).toContain("overscroll-behavior-y: contain;");
    expect(styledBlock("ModalBody")).toContain("flex: 1 1 auto;");
    expect(source).not.toContain("RevenueChargeDetailSessionsScroll");
    [card, baseCard, body, sessions].forEach((styles) => {
      expect(styles).not.toMatch(/(?:^|\n)\s*height\s*:/);
    });
    expect(sessions).not.toMatch(/max-height|overflow(?:-[xy])?\s*:|font-size/);
    expect(body).not.toContain("font-size");
  });

  it("fixa o único cabeçalho de sessões no corpo rolável, com fundo opaco e sem wrapper intermediário", () => {
    const sessions = styledBlock("RevenueChargeDetailSessionsTable");
    expect(sessions).toContain("styled(SimpleTable)");
    expect(sessions).toContain("min-width: 420px;");
    expect(sessions).toContain("border-collapse: separate;");
    expect(sessions).toContain("border-spacing: 0;");
    expect(sessions).toMatch(/thead th\s*\{\s*position: sticky;\s*top: 0;\s*z-index: 1;/);
    expect(sessions).toMatch(/background: \$\{ATTENDANCE_UI\.colors\.surfaceMuted\};/);
    const start = source.indexOf("<RevenueChargeDetailBody");
    const bodyMarkup = source.slice(start, source.indexOf("</RevenueChargeDetailBody>", start));
    expect(bodyMarkup.match(/<RevenueChargeDetailSessionsTable>/g)).toHaveLength(1);
    expect(bodyMarkup).not.toMatch(/<TableScroll|<AttendanceTableScroll|<RevenueChargeDetailSessionsScroll/);
    expect(bodyMarkup).toContain('<th scope="col">Data</th>');
    expect(bodyMarkup).toContain('<th scope="col">Profissional</th>');
    expect(bodyMarkup).toContain('<th scope="col">Status</th>');
  });

  it("mantém título/X e rodapé fora da região rolável e paciente sem destaque forte", () => {
    const start = source.indexOf("<RevenueChargeDetailOverlay>");
    const markup = source.slice(start, source.indexOf("</RevenueChargeDetailOverlay>", start));
    expect(start).toBeGreaterThanOrEqual(0);
    expect(markup).toContain('role="dialog" aria-modal="true"');
    expect(markup).toContain('role="region" aria-label="Conteúdo dos detalhes" tabIndex={0}');
    expect(markup.indexOf("</RevenueChargeDetailHeader>"))
      .toBeLessThan(markup.indexOf("<RevenueChargeDetailBody"));
    expect(markup.indexOf("</RevenueChargeDetailBody>"))
      .toBeLessThan(markup.indexOf("<ModalActions>"));
    expect(styledBlock("RevenueChargeDetailHeader")).toContain("flex-shrink: 0;");
    expect(styledBlock("ModalActions")).toContain("flex-shrink: 0;");
    expect(styledBlock("RevenueChargeDetailPatient")).toContain("font.weight.regular");
    expect(markup).not.toContain("<strong>");
    expect(markup).not.toMatch(/AttendancePackageFinance|Financeiro da cobrança|Distribuição das/);
  });
});

describe("Financeiro - título existente com competência sticky, sem validação visual", () => {
  it("fixa somente as linhas existentes no card de resultados, sem competência separada nem novo seletor", () => {
    const card = styledBlock("AttendanceResultsCard");
    expect(card).toContain("[data-revenue-results-heading]");
    expect(card).toContain("position: sticky;");
    expect(card).toMatch(/top: \$\{layout\.appHeaderHeight\};/);
    expect(card).toContain("z-index: 1;");
    expect(card).toMatch(/background: \$\{ATTENDANCE_UI\.colors\.surface\};/);
    expect(card).toContain("overflow-wrap: anywhere;");
    expect(card).toContain("styled(AttendanceCard)");
    expect(card).toContain("isolation: isolate;");
    expect(source).not.toContain("AttendanceResultsPeriod");
    expect(source).not.toContain('aria-label="Competência dos resultados"');
    expect(source.match(/<[^>]+data-revenue-results-heading[^>]*>/g)).toHaveLength(2);
    expect(source).toContain("<AttendanceDetailHeader data-revenue-results-heading>");
    expect(source).toContain("<AttendancePatientDetailTopline data-revenue-results-heading>");
    expect(source).toContain("{attendanceDetailPatientSummary.patientName}{periodSuffix}");
    expect(styledBlock("AttendanceDetailHeader")).not.toContain("position: sticky;");
    expect(styledBlock("AttendancePatientDetailTopline")).not.toContain("position: sticky;");
    const start = source.indexOf("<AttendanceResultsCard>");
    const markup = source.slice(start, source.indexOf("</AttendanceResultsCard>", start));
    expect(markup).toContain("attendanceContent");
    expect(markup).toContain("isAttendanceInitialLoading");
    expect(markup).not.toMatch(/<AttendancePeriodMonthInput|<AttendancePeriodYearSelect|<select|<input/);
  });

  it("mantém os ancestrais da competência sem overflow que capture ou recorte o sticky da página", () => {
    const ancestors = ["AttendanceResultsCard", "AttendanceCard", "AttendanceSectionSurface",
      "Section", "FinanceContent", "FinancePage"].map((name) => styledBlock(name));
    ancestors.push(...["Shell", "ContentColumn", "Main"].map((name) => styledBlock(name, shellSource)));
    ancestors.forEach((styles) => {
      expect(styles).not.toMatch(/(?:^|\n)\s*overflow(?:-[xy])?\s*:\s*(?:auto|scroll|hidden|clip)/);
      expect(styles).not.toMatch(/(?:^|\n)\s*(?:transform|filter|contain)\s*:/);
    });
  });
});
