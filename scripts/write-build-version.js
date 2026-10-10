const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const TARGETS = new Set(["public", "build"]);
const target = process.argv[2] || "public";
const simulationPreview = process.env.REACT_APP_WHATSAPP_SIMULATION_PREVIEW === "true";
if (simulationPreview && process.env.BUILD_PATH !== "build-whatsapp-preview") {
  throw new Error("Simulation tools require the isolated local preview build path");
}
const outputTarget = target === "build" && simulationPreview ? "build-whatsapp-preview" : target;

if (!TARGETS.has(target)) {
  throw new Error(`Invalid app version target: ${target}`);
}

function readGitCommit() {
  try {
    return execSync("git rev-parse --short=12 HEAD", {
      cwd: path.resolve(__dirname, ".."),
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch (error) {
    return "unknown";
  }
}

const generatedAt = new Date().toISOString();
const commit = readGitCommit();
const version = process.env.npm_package_version || "0.0.0";
const buildId = `${version}-${commit}-${generatedAt}`;

const payload = {
  simulationOnly: simulationPreview,
  buildId,
  version,
  commit,
  generatedAt,
};

if (target === "build") {
  const manifestPath = path.resolve(
    __dirname,
    "..",
    outputTarget,
    "asset-manifest.json",
  );

  if (fs.existsSync(manifestPath)) {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    payload.assets = {
      mainJs: manifest.files?.["main.js"] || "",
      mainCss: manifest.files?.["main.css"] || "",
    };
  }
}

const targetPath = path.resolve(
  __dirname,
  "..",
  outputTarget,
  "app-version.json",
);

fs.writeFileSync(`${targetPath}.tmp`, `${JSON.stringify(payload, null, 2)}\n`);
fs.renameSync(`${targetPath}.tmp`, targetPath);

console.log(`Wrote ${target}/app-version.json (${buildId})`);
