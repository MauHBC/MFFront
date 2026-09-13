const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const LOCAL_DEFAULTS = Object.freeze({
  NODE_ENV: 'development',
  HOST: '127.0.0.1',
  PORT: '3000',
  HTTPS: 'false',
  REACT_APP_API_BASE_URL: 'http://localhost:3006/api',
});
const ENV_FILES = Object.freeze([
  '.env',
  '.env.local',
  '.env.development',
  '.env.development.local',
]);
const FORBIDDEN_LOCAL_KEYS = new Set([
  'PUBLIC_URL',
  'WDS_SOCKET_HOST',
  'WDS_SOCKET_PORT',
  'WDS_SOCKET_PATH',
]);

class LocalDevelopmentError extends Error {
  constructor(code) {
    super(code);
    this.name = 'LocalDevelopmentError';
    this.code = code;
  }
}

const fail = (code) => { throw new LocalDevelopmentError(code); };

function decodeValue(rawValue, sourceLabel) {
  const value = String(rawValue).trim();
  if (!value) return '';
  if (value.startsWith('"')) {
    try {
      const decoded = JSON.parse(value);
      if (typeof decoded !== 'string') fail(`INVALID_ENV_VALUE:${sourceLabel}`);
      return decoded;
    } catch (error) {
      if (error instanceof LocalDevelopmentError) throw error;
      fail(`INVALID_ENV_VALUE:${sourceLabel}`);
    }
  }
  if (value.startsWith("'") && value.endsWith("'")) return value.slice(1, -1);
  return value.replace(/\s+#.*$/, '').trim();
}

function parseEnv(content, sourceLabel) {
  const values = {};
  String(content).split(/\r?\n/).forEach((line, index) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const match = /^([A-Za-z_][A-Za-z0-9_]*)\s*=(.*)$/.exec(line);
    if (!match) fail(`INVALID_ENV_LINE:${sourceLabel}:${index + 1}`);
    const [, key, rawValue] = match;
    if (Object.prototype.hasOwnProperty.call(values, key)) {
      fail(`DUPLICATE_ENV_KEY:${sourceLabel}:${key}`);
    }
    values[key] = decodeValue(rawValue, `${sourceLabel}:${key}`);
  });
  return values;
}

function environmentValue(values, key, sourceLabel) {
  const matches = Object.keys(values)
    .filter((candidate) => candidate.toUpperCase() === key.toUpperCase());
  if (matches.length > 1) fail(`LOCAL_ENVIRONMENT_DUPLICATE_KEY:${sourceLabel}:${key}`);
  return matches.length === 1 ? values[matches[0]] : undefined;
}

function validateValues(values, sourceLabel) {
  Object.entries(LOCAL_DEFAULTS).forEach(([key, expected]) => {
    const actual = environmentValue(values, key, sourceLabel);
    if (actual !== undefined && actual !== expected) {
      fail(`LOCAL_ENVIRONMENT_CONFLICT:${sourceLabel}:${key}`);
    }
  });
  FORBIDDEN_LOCAL_KEYS.forEach((key) => {
    if (environmentValue(values, key, sourceLabel)) {
      fail(`LOCAL_ENVIRONMENT_KEY_FORBIDDEN:${sourceLabel}:${key}`);
    }
  });
}

function validateLocalEnvironment(repositoryRoot, environment = process.env) {
  validateValues(environment, 'process');
  ENV_FILES.forEach((filename) => {
    const filePath = path.join(repositoryRoot, filename);
    if (!fs.existsSync(filePath)) return;
    const stat = fs.lstatSync(filePath);
    if (!stat.isFile() || stat.isSymbolicLink()) {
      fail(`LOCAL_ENVIRONMENT_FILE_INVALID:${filename}`);
    }
    validateValues(parseEnv(fs.readFileSync(filePath, 'utf8'), filename), filename);
  });
}

function buildChildEnvironment(repositoryRoot, environment = process.env) {
  validateLocalEnvironment(repositoryRoot, environment);
  const childEnvironment = { ...environment };
  const protectedKeys = new Set([...Object.keys(LOCAL_DEFAULTS), ...FORBIDDEN_LOCAL_KEYS]);
  Object.keys(childEnvironment).forEach((key) => {
    if (protectedKeys.has(key.toUpperCase())) delete childEnvironment[key];
  });
  Object.assign(childEnvironment, LOCAL_DEFAULTS);
  return childEnvironment;
}

function parseArguments(argv) {
  if (argv.length === 0) return { checkOnly: false };
  if (argv.length === 1 && argv[0] === '--check') return { checkOnly: true };
  return fail('LOCAL_DEVELOPMENT_ARGUMENT_INVALID');
}

function runCli() {
  try {
    const repositoryRoot = path.resolve(__dirname, '..');
    const { checkOnly } = parseArguments(process.argv.slice(2));
    const childEnvironment = buildChildEnvironment(repositoryRoot);
    if (checkOnly) {
      process.stdout.write('Ambiente local do Frontend validado.\n');
      return;
    }
    const startScript = require.resolve('react-scripts/scripts/start');
    const result = spawnSync(process.execPath, [startScript], {
      cwd: repositoryRoot,
      env: childEnvironment,
      stdio: 'inherit',
      windowsHide: true,
    });
    if (result.error) throw result.error;
    process.exitCode = result.status === null ? 1 : result.status;
  } catch (error) {
    const code = error instanceof LocalDevelopmentError
      ? error.code
      : 'LOCAL_DEVELOPMENT_START_FAILED';
    process.stderr.write(`Inicializacao local recusada: ${code}\n`);
    process.exitCode = 1;
  }
}

if (require.main === module) runCli();

module.exports = {
  LOCAL_DEFAULTS,
  LocalDevelopmentError,
  buildChildEnvironment,
  parseEnv,
  validateLocalEnvironment,
};
