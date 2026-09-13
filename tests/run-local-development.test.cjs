const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');

const {
  LOCAL_DEFAULTS,
  buildChildEnvironment,
} = require('../scripts/run-local-development.cjs');

const repositoryRoot = path.resolve(__dirname, '..');

function makeTemporaryRepository() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'motria-frontend-local-'));
}

test('applies the versioned localhost contract to a new worktree', () => {
  const temporaryRepository = makeTemporaryRepository();
  try {
    const child = buildChildEnvironment(temporaryRepository, {});
    assert.deepEqual(child, LOCAL_DEFAULTS);
  } finally {
    fs.rmSync(temporaryRepository, { recursive: true, force: true });
  }
});

test('rejects remote API and incompatible process configuration', () => {
  const temporaryRepository = makeTemporaryRepository();
  try {
    [
      ['REACT_APP_API_BASE_URL', 'https://api.example.invalid/api'],
      ['HOST', '0.0.0.0'],
      ['PORT', '8080'],
      ['HTTPS', 'true'],
      ['NODE_ENV', 'production'],
      ['react_app_api_base_url', 'https://api.example.invalid/api', 'REACT_APP_API_BASE_URL'],
    ].forEach(([key, value, expectedKey = key]) => {
      assert.throws(
        () => buildChildEnvironment(temporaryRepository, { [key]: value }),
        new RegExp(`LOCAL_ENVIRONMENT_CONFLICT:process:${expectedKey}`),
      );
    });
  } finally {
    fs.rmSync(temporaryRepository, { recursive: true, force: true });
  }
});

test('rejects a remote override in an ignored env file', () => {
  const temporaryRepository = makeTemporaryRepository();
  try {
    fs.writeFileSync(
      path.join(temporaryRepository, '.env.local'),
      'REACT_APP_API_BASE_URL=https://api.example.invalid/api\n',
      'utf8',
    );
    assert.throws(
      () => buildChildEnvironment(temporaryRepository, {}),
      /LOCAL_ENVIRONMENT_CONFLICT:.env.local:REACT_APP_API_BASE_URL/,
    );
  } finally {
    fs.rmSync(temporaryRepository, { recursive: true, force: true });
  }
});

test('rejects development server endpoints supplied outside the local contract', () => {
  const temporaryRepository = makeTemporaryRepository();
  try {
    assert.throws(
      () => buildChildEnvironment(temporaryRepository, { WDS_SOCKET_HOST: 'remote.example.invalid' }),
      /LOCAL_ENVIRONMENT_KEY_FORBIDDEN:process:WDS_SOCKET_HOST/,
    );
  } finally {
    fs.rmSync(temporaryRepository, { recursive: true, force: true });
  }
});

test('npm run dev exposes a non-starting validation contract', () => {
  assert.ok(process.env.npm_execpath, 'npm_execpath deve existir quando a suite roda via npm');
  const result = spawnSync(process.execPath, [
    process.env.npm_execpath, 'run', 'dev', '--', '--check',
  ], {
    cwd: repositoryRoot,
    env: process.env,
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  assert.match(result.stdout, /Ambiente local do Frontend validado/);
});
