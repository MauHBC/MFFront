import fs from "fs";
import path from "path";

const readSource = (fileName) => fs.readFileSync(path.join(__dirname, fileName), "utf8");

describe("contenção responsiva da área Equipe", () => {
  it("permite que a página e o grid encolham até o viewport", () => {
    const source = readSource("index.js");

    expect(source).toContain("grid-template-columns: minmax(0, 1fr);");
    expect(source).toMatch(/const Page = styled\.div`[\s\S]*?max-width: 100%;[\s\S]*?min-width: 0;/);
    expect(source).toMatch(/const Sections = styled\.div`[\s\S]*?> \* \{[\s\S]*?min-width: 0;/);
  });

  it("mantém a tabela larga e contém sua rolagem no wrapper", () => {
    const source = readSource("TeamAuditHistory.js");

    expect(source).toMatch(/const AuditPanel = styled\(ModulePanel\)`[\s\S]*?max-width: 100%;[\s\S]*?min-width: 0;/);
    expect(source).toMatch(/const TableWrap = styled\.div`[\s\S]*?max-width: 100%;[\s\S]*?overflow-x: auto;/);
    expect(source).toMatch(/const Table = styled\.table`[\s\S]*?min-width: 850px;/);
  });
});
