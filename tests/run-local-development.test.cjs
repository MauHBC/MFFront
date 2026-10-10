const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');

const {
  LOCAL_DEFAULTS,
  LOCAL_STACK_PROFILES,
  PERSISTED_LOCAL_STACK_SLOT,
  buildChildEnvironment,
  proxyTargetForEnvironment,
} = require('../scripts/run-local-development.cjs');
const setupProxy = require('../src/setupProxy');

const repositoryRoot = path.resolve(__dirname, '..');

function makeTemporaryRepository() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'motria-frontend-local-'));
}

test('reports preview uses its own closed loopback slot and rejects endpoint overrides', () => {
  const child = buildChildEnvironment(repositoryRoot, { MOTRIA_LOCAL_STACK_SLOT: 'reports-preview' });
  assert.equal(child.PORT, '3040');
  assert.equal(child.REACT_APP_API_BASE_URL, 'http://127.0.0.1:3046/api');
  assert.equal(proxyTargetForEnvironment(child), 'http://127.0.0.1:3046');
  assert.throws(() => buildChildEnvironment(repositoryRoot, {
    MOTRIA_LOCAL_STACK_SLOT: 'reports-preview', PORT: '3030',
  }), /PORT/);
  assert.throws(() => buildChildEnvironment(repositoryRoot, {
    MOTRIA_LOCAL_STACK_SLOT: 'reports-preview', REACT_APP_API_BASE_URL: 'https://external.example.test/api',
  }), /REACT_APP_API_BASE_URL/);
});

test('applies the versioned localhost contract to a new worktree', () => {
  const temporaryRepository = makeTemporaryRepository();
  try {
    const child = buildChildEnvironment(temporaryRepository, {});
    assert.deepEqual(child, LOCAL_DEFAULTS);
  } finally {
    fs.rmSync(temporaryRepository, { recursive: true, force: true });
  }
});

test('selects the closed combined validation slot without accepting direct endpoint overrides', () => {
  const temporaryRepository = makeTemporaryRepository();
  const environment = {
    MOTRIA_LOCAL_STACK_SLOT: 'combined-validation',
    BROWSER: 'none',
  };
  try {
    fs.writeFileSync(
      path.join(temporaryRepository, '.env.development'),
      'HOST=127.0.0.1\nPORT=3000\nHTTPS=false\nREACT_APP_API_BASE_URL=http://localhost:3006/api\n',
      'utf8',
    );
    const child = buildChildEnvironment(temporaryRepository, environment);
    assert.deepEqual(child, {
      ...environment,
      ...LOCAL_STACK_PROFILES['combined-validation'],
    });
    assert.equal(proxyTargetForEnvironment(environment), 'http://127.0.0.1:3016');
    assert.equal(
      setupProxy.proxyTargetForEnvironment(environment),
      'http://127.0.0.1:3016',
    );
    assert.throws(
      () => buildChildEnvironment(temporaryRepository, { PORT: '3010' }),
      /LOCAL_ENVIRONMENT_CONFLICT:process:PORT/,
    );
    assert.throws(
      () => buildChildEnvironment(temporaryRepository, {
        ...environment,
        REACT_APP_API_BASE_URL: 'https://api.example.invalid/api',
      }),
      /LOCAL_ENVIRONMENT_CONFLICT:process:REACT_APP_API_BASE_URL/,
    );
  } finally {
    fs.rmSync(temporaryRepository, { recursive: true, force: true });
  }
});

test('persists the closed validation profile in this worktree for daily npm run dev', () => {
  const temporaryRepository = makeTemporaryRepository();
  try {
    fs.writeFileSync(
      path.join(temporaryRepository, '.env.local'),
      `MOTRIA_LOCAL_STACK_SLOT=${PERSISTED_LOCAL_STACK_SLOT}\n`,
      'utf8',
    );
    fs.writeFileSync(
      path.join(temporaryRepository, '.env.development'),
      'HOST=127.0.0.1\nPORT=3000\nHTTPS=false\nREACT_APP_API_BASE_URL=http://localhost:3006/api\n',
      'utf8',
    );

    const child = buildChildEnvironment(temporaryRepository, { BROWSER: 'none' });

    assert.deepEqual(child, {
      BROWSER: 'none',
      ...LOCAL_STACK_PROFILES[PERSISTED_LOCAL_STACK_SLOT],
      MOTRIA_LOCAL_STACK_SLOT: PERSISTED_LOCAL_STACK_SLOT,
    });
    assert.equal(proxyTargetForEnvironment(child), 'http://127.0.0.1:3006');
    assert.equal(setupProxy.proxyTargetForEnvironment(child), 'http://127.0.0.1:3006');
  } finally {
    fs.rmSync(temporaryRepository, { recursive: true, force: true });
  }
});

test('keeps persistent validation closed to its versioned local endpoints', () => {
  const temporaryRepository = makeTemporaryRepository();
  const profile = { MOTRIA_LOCAL_STACK_SLOT: PERSISTED_LOCAL_STACK_SLOT };
  try {
    assert.throws(
      () => buildChildEnvironment(temporaryRepository, {
        ...profile,
        REACT_APP_API_BASE_URL: 'https://api.example.invalid/api',
      }),
      /LOCAL_ENVIRONMENT_CONFLICT:process:REACT_APP_API_BASE_URL/,
    );
    assert.throws(
      () => buildChildEnvironment(temporaryRepository, { ...profile, PORT: '3010' }),
      /LOCAL_ENVIRONMENT_CONFLICT:process:PORT/,
    );
  } finally {
    fs.rmSync(temporaryRepository, { recursive: true, force: true });
  }
});

test('persists financeiro estorno only at its closed isolated endpoints', () => {
  const temporaryRepository = makeTemporaryRepository();
  try {
    fs.writeFileSync(path.join(temporaryRepository, '.env.local'), 'MOTRIA_LOCAL_STACK_SLOT=financeiro-estorno\n', 'utf8');
    const child = buildChildEnvironment(temporaryRepository, {});
    assert.equal(child.PORT, '3020');
    assert.equal(proxyTargetForEnvironment(child), 'http://127.0.0.1:3026');
    assert.equal(setupProxy.proxyTargetForEnvironment(child), 'http://127.0.0.1:3026');
    assert.throws(() => buildChildEnvironment(temporaryRepository, { PORT: '3000' }), /LOCAL_ENVIRONMENT_CONFLICT/);
  } finally {
    fs.rmSync(temporaryRepository, { recursive: true, force: true });
  }
});

test('rejects unknown or persisted local stack slots', () => {
  const temporaryRepository = makeTemporaryRepository();
  try {
    assert.throws(
      () => buildChildEnvironment(temporaryRepository, { MOTRIA_LOCAL_STACK_SLOT: 'other' }),
      /LOCAL_STACK_SLOT_INVALID:other/,
    );
    fs.writeFileSync(
      path.join(temporaryRepository, '.env.local'),
      'MOTRIA_LOCAL_STACK_SLOT=combined-validation\n',
      'utf8',
    );
    assert.throws(
      () => buildChildEnvironment(temporaryRepository, {}),
      /LOCAL_STACK_SLOT_FILE_FORBIDDEN:.env.local/,
    );
  } finally {
    fs.rmSync(temporaryRepository, { recursive: true, force: true });
  }
});

test('rejects conflicting process and worktree-local profile selections', () => {
  const temporaryRepository = makeTemporaryRepository();
  try {
    fs.writeFileSync(
      path.join(temporaryRepository, '.env.local'),
      `MOTRIA_LOCAL_STACK_SLOT=${PERSISTED_LOCAL_STACK_SLOT}\n`,
      'utf8',
    );
    assert.throws(
      () => buildChildEnvironment(temporaryRepository, {
        MOTRIA_LOCAL_STACK_SLOT: 'combined-validation',
      }),
      /LOCAL_STACK_SLOT_CONFLICT:process:.env.local/,
    );
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
test('preserved WhatsApp has its own closed slot without replacing the previous preview', () => {
  const result = buildChildEnvironment(repositoryRoot, { MOTRIA_LOCAL_STACK_SLOT: 'whatsapp-preserved' });
  assert.equal(result.PORT, '3060');
  assert.equal(result.REACT_APP_API_BASE_URL, 'http://127.0.0.1:3066/api');
  assert.equal(buildChildEnvironment(repositoryRoot, { MOTRIA_LOCAL_STACK_SLOT: 'whatsapp-pilot' }).PORT, '3050');
});


test('keeps clinical export preview bound to its exclusive local endpoints', () => {
  const repository = makeTemporaryRepository();
  try {
    const environment = { MOTRIA_LOCAL_STACK_SLOT: 'clinical-export' };
    const child = buildChildEnvironment(repository, environment);
    assert.equal(child.PORT, '3030');
    assert.equal(child.HOST, '127.0.0.1');
    assert.equal(child.REACT_APP_API_BASE_URL, 'http://127.0.0.1:3036/api');
    assert.equal(setupProxy.proxyTargetForEnvironment(environment), 'http://127.0.0.1:3036');
    assert.throws(() => buildChildEnvironment(repository, { ...environment, PORT: '3010' }));
  } finally {
    fs.rmSync(repository, { recursive: true, force: true });
  }
});

test('clinical preview serves SPA routes without masking API or missing assets', () => {
  for (const pathname of ['/', '/login', '/pacientes/1', '/pacientes/1/avaliacoes/2?x=1']) {
    const req = { method: 'GET', url: pathname, headers: {} }; let called = false;
    setupProxy.clinicalPreviewFallback(req, {}, () => { called = true; });
    assert.equal(req.headers.accept, 'text/html'); assert.equal(called, true);
  }
  for (const pathname of ['/missing.js', '/static/missing', '/unknown']) {
    const req = { method: 'GET', url: pathname, headers: { accept: 'text/html' } };
    setupProxy.clinicalPreviewFallback(req, {}, () => {});
    assert.equal(req.headers.accept, 'application/octet-stream');
  }
  const req = { method: 'GET', url: '/api/missing', headers: { accept: 'application/json' } };
  setupProxy.clinicalPreviewFallback(req, {}, () => {});
  assert.equal(req.headers.accept, 'application/json');
});

