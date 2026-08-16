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

  it("mantém a folha editável dentro da largura disponível no desktop e mobile", () => {
    expect(settingsSource).toMatch(
      /const VisualEditorDrawer = styled\(AppDrawer\)`[\s\S]*?width: min\(760px, 96vw\);[\s\S]*?@media \(max-width: 760px\)[\s\S]*?width: 100%;[\s\S]*?max-width: 100vw;/,
    );
    expect(settingsSource).toMatch(
      /const DocumentCanvas = styled\.div`[\s\S]*?min-width: 0;[\s\S]*?overflow-x: hidden;/,
    );
    expect(settingsSource).toMatch(
      /const DocumentSheet = styled\.section`[\s\S]*?box-sizing: border-box;[\s\S]*?width: 100%;[\s\S]*?min-width: 0;/,
    );
    expect(settingsSource).toMatch(
      /const DocumentBodyEditor = styled\.div`[\s\S]*?min-width: 0;[\s\S]*?border: 1px solid \$\{alpha\.brand014\};/,
    );
    expect(settingsSource).toMatch(
      /const DocumentBodyTextarea = styled\.textarea`[\s\S]*?box-sizing: border-box;[\s\S]*?width: 100%;[\s\S]*?min-width: 0;/,
    );
  });

  it("dimensiona o campo de data dentro da largura útil do modal", () => {
    expect(documentsSource).toMatch(
      /const FlowField = styled\.label`[\s\S]*?min-width: 0;[\s\S]*?box-sizing: border-box;[\s\S]*?width: 100%;[\s\S]*?max-width: 100%;/,
    );
    expect(documentsSource).toMatch(
      /const SearchSection = styled\.div`[\s\S]*?box-sizing: border-box;[\s\S]*?width: 100%;[\s\S]*?min-width: 0;/,
    );
    expect(documentsSource).toMatch(
      /const DateSearch = styled\.div`[\s\S]*?box-sizing: border-box;[\s\S]*?width: 100%;[\s\S]*?min-width: 0;/,
    );
    expect(documentsSource).not.toMatch(/overflow-x:\s*hidden/);
  });

  it("apresenta o preview em uma folha responsiva próxima ao documento", () => {
    expect(documentsSource).toMatch(
      /const PreviewDocumentSheet = styled\.section`[\s\S]*?box-sizing: border-box;[\s\S]*?max-width: 640px;[\s\S]*?min-width: 0;[\s\S]*?font-family: Arial, Helvetica, sans-serif;/,
    );
    expect(documentsSource).toMatch(
      /const PreviewTextArea = styled\.textarea`[\s\S]*?box-sizing: border-box;[\s\S]*?width: 100%;[\s\S]*?min-width: 0;[\s\S]*?text-align: justify;/,
    );
  });

  it("mantém o fluxo documental isolado de Agenda e clinic_id", () => {
    expect(documentsSource).not.toMatch(/\/sessions|agendamentos|clinic_id/i);
  });
});
