import fs from "fs";
import path from "path";

const documentsSource = fs.readFileSync(
  path.join(__dirname, "DocumentsSection.js"),
  "utf8",
);
const settingsSource = fs.readFileSync(
  path.join(__dirname, "..", "SettingsDocuments", "index.js"),
  "utf8",
);
const routesSource = fs.readFileSync(
  path.join(__dirname, "..", "..", "routes", "index.js"),
  "utf8",
);

describe("Documentos: estrutura de rotas e responsividade", () => {
  it("protege a área de modelos pelo administrador e settings/manage", () => {
    expect(routesSource).toMatch(
      /path="\/configuracoes\/documentos"[\s\S]*?administratorOnly[\s\S]*?requiredModule="settings"[\s\S]*?minimumAccessLevel="manage"/,
    );
    expect(routesSource).toMatch(
      /path="\/configuracoes"[\s\S]*?component=\{SettingsRedirect\}/,
    );
  });

  it("troca tabelas por cards no mobile sem depender de rolagem horizontal", () => {
    expect(documentsSource).toMatch(
      /const HistoryTableWrap = styled\.div`[\s\S]*?@media \(max-width: 760px\)[\s\S]*?display: none;/,
    );
    expect(documentsSource).toMatch(
      /const HistoryCards = styled\.div`[\s\S]*?display: none;[\s\S]*?@media \(max-width: 760px\)[\s\S]*?display: grid;/,
    );
    expect(settingsSource).toMatch(
      /const DesktopTableWrap = styled\(TableWrap\)`[\s\S]*?@media \(max-width: 760px\)[\s\S]*?display: none;/,
    );
    expect(settingsSource).toMatch(
      /const MobileList = styled\.div`[\s\S]*?display: none;[\s\S]*?@media \(max-width: 760px\)[\s\S]*?display: grid;/,
    );
  });

  it("mantém o fluxo documental isolado de Agenda e clinic_id", () => {
    expect(documentsSource).not.toMatch(/\/sessions|agendamentos|clinic_id/i);
  });
});
