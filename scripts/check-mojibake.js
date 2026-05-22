const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();
const SKIP_DIRS = new Set([".git", "build", "coverage", "node_modules"]);
const TEXT_EXTENSIONS = new Set([
  ".css",
  ".editorconfig",
  ".html",
  ".js",
  ".json",
  ".jsx",
  ".md",
  ".mjs",
  ".ts",
  ".tsx",
  ".txt",
]);
const MOJIBAKE_PATTERN = /[\u00c3\u00c2\ufffd]|\u00e2\u20ac/u;

function shouldScan(filePath) {
  const basename = path.basename(filePath);
  const extension = path.extname(filePath);
  return TEXT_EXTENSIONS.has(extension) || basename === ".env.example";
}

function walk(directory, files = []) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) {
        walk(path.join(directory, entry.name), files);
      }
      continue;
    }

    const filePath = path.join(directory, entry.name);
    if (shouldScan(filePath)) files.push(filePath);
  }

  return files;
}

const findings = [];

for (const filePath of walk(ROOT)) {
  const content = fs.readFileSync(filePath, "utf8");
  const lines = content.split(/\r?\n/);
  lines.forEach((line, index) => {
    if (MOJIBAKE_PATTERN.test(line)) {
      findings.push({
        file: path.relative(ROOT, filePath),
        line: index + 1,
        text: line.trim(),
      });
    }
  });
}

if (findings.length > 0) {
  console.error("Mojibake suspeito encontrado:");
  findings.forEach((finding) => {
    console.error(`${finding.file}:${finding.line}: ${finding.text}`);
  });
  process.exit(1);
}

console.log("Nenhum mojibake suspeito encontrado.");
