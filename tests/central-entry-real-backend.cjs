// Uses the existing disposable MariaDB orchestrator and a compiled Frontend.
// An exclusive loopback proxy serves LOCAL Nginx, including every redirect hop;
// unknown origins are refused without resolving DNS or opening remote sockets.
/* eslint-env node */
// Serialized browser/fixture steps, and imports from the explicitly selected
// Backend worktree after its disposable environment is established.
/* eslint-disable no-restricted-syntax, no-await-in-loop, global-require, import/no-dynamic-require */
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { spawn } = require('node:child_process');

function browserRuntime() {
  // Supplied by the existing test runtime through NODE_PATH, not the app bundle.
  // eslint-disable-next-line import/no-unresolved
  const { chromium } = require('playwright');
  const executablePath = process.env.MOTRIA_TEST_BROWSER_EXECUTABLE_PATH || chromium.executablePath();
  assert.ok(fs.existsSync(executablePath), 'provide an installed Chromium with MOTRIA_TEST_BROWSER_EXECUTABLE_PATH');
  return { chromium, executablePath };
}

async function launch(root) {
  browserRuntime(); // Fail before creating disposable resources if unavailable.
  const backendRoot = fs.realpathSync(root);
  const runner = 'src/tests/centralEntryRoutingDatabaseRunner.js';
  const entry = path.join(backendRoot, runner);
  assert.ok(fs.existsSync(path.join(backendRoot, 'scripts/run-disposable-mariadb-test.js')));
  fs.writeFileSync(entry, `require(${JSON.stringify(__filename)});\n`, { flag: 'wx' });
  try {
    process.exitCode = await new Promise((resolve, reject) => {
      const child = spawn(process.execPath, ['scripts/run-disposable-mariadb-test.js', runner], {
        cwd: backendRoot, stdio: 'inherit', env: { ...process.env, MOTRIA_TEST_MARIADB_IMAGE: 'mariadb:11.4' },
      });
      child.once('error', reject);
      child.once('exit', (code) => resolve(code ?? 1));
    });
  } finally { fs.unlinkSync(entry); }
}

async function fixture() {
  const backendRoot = process.cwd();
  const backend = (file) => require(path.join(backendRoot, 'src', file));
  backend('config/disposableDatabaseSafety').assertDisposableDatabaseTarget();
  assert.equal(process.env.MOTRIA_EMAIL_NETWORK_DISABLED, 'true');
  assert.equal(process.env.RESEND_API_KEY || '', '');
  Object.assign(process.env, {
    NODE_ENV: 'test', CLINICAL_AUTH_MODE: 'membership', REQUEST_DELAY_MS: '0',
    CREDENTIAL_PUBLIC_URL: 'https://app.motria.com.br',
    CORS_ALLOWED_ORIGINS: 'https://app.motria.com.br',
    TOKEN_EXPIRATION: '10m', PLATFORM_TOKEN_EXPIRATION: '10m',
  });
  for (const key of ['TOKEN_SECRET', 'PLATFORM_TOKEN_SECRET', 'CREDENTIAL_LINK_SECRET']) {
    process.env[key] = crypto.randomBytes(48).toString('hex');
  }
  backend('database');
  const model = (name) => backend(`models/${name}`).default;
  const Clinic = model('Clinic');
  const User = model('User');
  const Membership = model('UserClinicMembership');
  const db = User.sequelize;
  db.options.logging = false;
  const { ensureNativeProfiles } = backend('services/TeamAuthorizationService');
  const nginx = require(path.join(backendRoot, 'scripts/test-central-entry-nginx.cjs'));
  const { chromium, executablePath } = browserRuntime();
  const observed = [];
  let api;
  let server;
  let browser;
  let proxy;
  let scenario = 'setup';
  let scenarios = 0;
  const check = async (name, run) => {
    scenario = name;
    await run();
    scenarios += 1;
    console.log(`OK browser/real API: ${name}`);
  };
  try {
    const [[version]] = await db.query('SELECT VERSION() AS version');
    assert.match(version.version, /^11\.4\./);
    console.log(`MariaDB ${version.version}; synthetic data; email network disabled`);
    const clinics = [];
    const domains = [[nginx.hosts[0], nginx.hosts[1]], [nginx.hosts[2], nginx.hosts[3]],
      [nginx.hosts[4]], [nginx.hosts[5]]];
    for (let index = 0; index < domains.length; index += 1) {
      const clinic = await Clinic.create({ name: `Fixture Clinic ${index}`, country_code: 'BR', is_active: true });
      clinics.push(clinic);
      await model('ClinicBranding').create({ clinic_id: clinic.id, public_name: `Fixture Clinic ${index}` });
      for (const domain of domains[index]) {
        await model('ClinicDomain').create({ clinic_id: clinic.id, domain,
          is_primary: domain === domains[index][0], is_active: true, verification_status: 'verified' });
      }
      if (index < 2) {
        await model('ClinicPublicProfile').create({ clinic_id: clinic.id, is_published: true,
          hero_title: `Published fixture ${index}`, primary_action_label: 'Contato preservado',
          primary_action_url: '/#contact' });
      }
    }
    const password = crypto.randomBytes(32).toString('base64url');
    const person = await model('TeamPerson').create({ clinic_id: clinics[0].id, name: 'Synthetic Operator', is_active: true });
    const user = await User.create({ clinic_id: clinics[0].id, person_id: person.id,
      name: 'Synthetic Operator', email: `${crypto.randomUUID()}@example.test`,
      password, number: 123456789, is_active: true, auth_version: 2 });
    const memberships = [];
    for (let index = 0; index < 2; index += 1) {
      const clinic = clinics[index];
      const memberPerson = index === 0 ? person : await model('TeamPerson').create({
        clinic_id: clinic.id, name: 'Synthetic Operator', is_active: true,
      });
      const membership = await Membership.create({ clinic_id: clinic.id, user_id: user.id,
        person_id: memberPerson.id, is_active: true, access_version: 3,
        last_used_at: index === 1 ? new Date() : null });
      memberships.push(membership);
      const profiles = await db.transaction((transaction) => ensureNativeProfiles({ clinicId: clinic.id, transaction }));
      await model('MembershipProfileAssignment').create({ clinic_id: clinic.id, membership_id: membership.id,
        profile_id: profiles.find((p) => p.native_type === 'administrator').id,
        assigned_by_membership_id: membership.id });
    }
    const token = () => crypto.randomBytes(32).toString('base64url');
    const invite = token();
    const expiredInvite = token();
    for (const [secret, expired] of [[invite, false], [expiredInvite, true]]) {
      await model('PatientInvite').create({ clinic_id: clinics[0].id, created_by_membership_id: memberships[0].id,
        secret_digest: crypto.createHash('sha256').update(secret).digest('hex'),
        expires_at: new Date(Date.now() + (expired ? -60000 : 600000)) });
    }
    const preview = token();
    await model('ClinicLandingPreviewToken').create({
      clinic_id: clinics[2].id, revision: 1, token_hash: crypto.createHash('sha256').update(preview).digest('hex'),
      snapshot_json: { hero: { title: 'Synthetic preview only' } },
      expires_at: new Date(Date.now() + 600000), created_by_platform_admin_id: user.id,
    });
    const credentials = [];
    for (const expired of [false, true]) {
      const action = await model('ClinicalCredentialAction').create({ id: crypto.randomUUID(),
        user_id: user.id, clinic_id: clinics[0].id, membership_id: memberships[0].id,
        purpose: 'password_reset', auth_version_at_issue: 2, access_version_at_issue: 3,
        expires_at: new Date(Date.now() + (expired ? -60000 : 600000)) });
      credentials.push(backend('services/CredentialActionTokenService').createCredentialActionToken(action.id));
    }
    const app = backend('app').default;
    api = http.createServer((req, res) => {
      // Never collect bodies/headers/secrets. Special bearer path is redacted.
      observed.push({ host: req.headers.host, method: req.method,
        path: req.url.replace(/(patient-invites|patient-intake)\/[^?]+/, '$1/<synthetic>') });
      app(req, res);
    });
    await new Promise((resolve) => { api.listen(0, '127.0.0.1', resolve); });
    server = await nginx.start({ frontendRoot: path.resolve(__dirname, '..'), apiPort: api.address().port });
    await nginx.matrix(server);
    proxy = await nginx.browserProxy(server);
    browser = await chromium.launch({ headless: true, executablePath,
      proxy: { server: proxy.url }, args: ['--proxy-bypass-list=<-loopback>'] });
    console.log(`Chromium ${browser.version()}; compiled Frontend through disposable Nginx`);
    // Ignore certificate errors only inside this isolated browser: the proxy
    // generates disposable TLS and has no route to production, even on redirect.
    const context = await browser.newContext({ serviceWorkers: 'block', ignoreHTTPSErrors: true });
    const page = await context.newPage();
    page.setDefaultTimeout(15000);
    const central = 'https://app.motria.com.br';
    const goto = async (url) => page.goto(url, { waitUntil: 'domcontentloaded' });
    await check('browser proxy refuses unknown origins without external connections', async () => {
      const blocked = await context.newPage();
      try {
        await assert.rejects(blocked.goto('https://outside.invalid/'), /ERR_TUNNEL_CONNECTION_FAILED/);
      } finally { await blocked.close(); }
    });
    await check('seven hosts / aliases: sites stay public, forwarding roots enter central login', async () => {
      for (const host of nginx.hosts.slice(0, 4)) {
        await goto(`https://${host}/`);
        const link = page.getByRole('link', { name: 'Entrar no sistema' });
        await link.waitFor();
        assert.equal(await link.getAttribute('href'), `${central}/login#`);
        assert.equal(new URL(page.url()).hostname, host);
        await page.getByRole('link', { name: 'Contato preservado' }).first().waitFor();
        await goto(`https://${host}/politica/`);
        assert.equal(new URL(page.url()).hostname, host);
      }
      for (const host of nginx.hosts.slice(4)) {
        await goto(`https://${host}/?clinic_id=999#synthetic-secret`);
        await page.waitForURL((url) => url.hostname === 'app.motria.com.br'
          && url.pathname === '/login' && url.hash === '' && url.search === '');
        await page.locator('input[name=email]').waitFor();
      }
      await goto(central);
      await page.waitForURL(`${central}/login`);
    });
    await check('browser RFC fragment inheritance, HTTP to HTTPS, IDs and filters discarded', async () => {
      for (const host of nginx.hosts) {
        await goto(`http://${host}/pacientes/123?clinic_id=999&returnTo=evil#token=synthetic`);
        await page.waitForURL((url) => url.hostname === 'app.motria.com.br' && url.pathname === '/login');
        assert.equal(new URL(page.url()).hash, '');
        assert.equal(new URL(page.url()).search, '');
      }
    });
    await check('React-only navigation blocks old modules before their HTTP loads', async () => {
      await goto(`https://${nginx.hosts[0]}/politica`);
      await page.locator('body').getByText('Política', { exact: false }).first().waitFor();
      const before = observed.length;
      // Same History API used by React Router; this is a real Chromium popstate.
      await page.evaluate(() => {
        window.history.pushState({}, '', '/pacientes/123?clinic_id=999#token=synthetic');
        window.dispatchEvent(new PopStateEvent('popstate'));
      });
      await page.waitForURL((url) => url.hostname === 'app.motria.com.br');
      assert.equal(observed.slice(before).some((r) => r.host === nginx.hosts[0]
        && /\/api\/(patients|clinic-context|me|sessions)/.test(r.path)), false);
    });
    await check('preview fragment retained in forwarding root; valid/invalid checked by real Backend', async () => {
      const host = nginx.hosts[4];
      await goto(`https://${host}/#landing_preview=${preview}&clinic_id=${clinics[2].id}`);
      await page.getByText('Synthetic preview only', { exact: true }).first().waitFor();
      assert.equal(new URL(page.url()).hostname, host);
      assert.ok(new URL(page.url()).hash.includes('landing_preview='));
      const before = observed.length;
      const invalidResponse = page.waitForResponse((res) => res.url().includes('/public/landing-preview/') && res.status() === 404);
      await goto(`https://${host}/#landing_preview=invalid&clinic_id=${clinics[2].id}`);
      await invalidResponse;
      assert.equal(new URL(page.url()).hostname, host);
      assert.equal(await page.getByText('Synthetic preview only', { exact: true }).count(), 0);
      assert.equal(observed.slice(before).some((r) => r.path === '/api/clinic-context'), false);
    });
    await check('patient invitation valid/expired stays on original host', async () => {
      for (const [secret, valid] of [[invite, true], [expiredInvite, false]]) {
        const response = page.waitForResponse((res) => res.url().includes('/public/patient-invites/')
          && res.status() === (valid ? 200 : 404));
        await goto(`https://${nginx.hosts[5]}/cadastro/paciente/${secret}`);
        await response;
        if (valid) await page.locator('form').waitFor();
        else await page.getByText('Convite indisponível', { exact: false }).waitFor();
        assert.equal(new URL(page.url()).hostname, nginx.hosts[5]);
      }
    });
    await check('credential valid/expired stays on origin and removes its own fragment only', async () => {
      for (const [secret, valid] of [[credentials[0], true], [credentials[1], false]]) {
        await goto(`https://${nginx.hosts[4]}/credencial#token=${secret}`);
        await page.getByRole('heading', { name: valid ? 'Defina uma nova senha' : 'Link inválido ou expirado' }).waitFor();
        assert.equal(new URL(page.url()).hostname, nginx.hosts[4]);
        assert.equal(new URL(page.url()).hash, '');
      }
    });
    await check('real login without public tenant; Backend preference wins over old hostname', async () => {
      await goto(`${central}/`);
      await page.locator('input[name=email]').fill(user.email);
      await page.locator('input[name=password]').fill(password);
      const response = page.waitForResponse((res) => /\/api\/tokens\/?$/.test(new URL(res.url()).pathname));
      await page.getByRole('button', { name: 'Entrar', exact: true }).click();
      const payload = await (await response).json();
      assert.equal(payload.user.clinic_id, clinics[1].id);
      assert.equal(payload.user.membership_id, memberships[1].id);
      await page.waitForURL(`${central}/menu`);
      const clinicSelect = page.getByLabel('Clínica ativa', { exact: true });
      await clinicSelect.waitFor({ state: 'attached' });
      assert.equal(await clinicSelect.inputValue(), String(memberships[1].id));
      const beforeBookmark = observed.length;
      await goto(`https://${nginx.hosts[0]}/pacientes/123?clinic_id=${clinics[0].id}#token=old`);
      await page.waitForURL(`${central}/menu`);
      assert.equal(observed.slice(beforeBookmark).some((r) => /\/api\/patients\/123(?:[/?]|$)/.test(r.path)), false);
      assert.equal(await page.evaluate(() => {
        const saved = JSON.parse(localStorage.getItem('persist:CONSUMO-API:v2'));
        return JSON.parse(saved.auth).user.clinic_id;
      }), clinics[1].id);
      const storage = await context.storageState();
      storage.origins.filter((origin) => origin.origin !== central).forEach((origin) => {
        const persisted = origin.localStorage.find((item) => item.name === 'persist:CONSUMO-API:v2');
        if (persisted) assert.equal(JSON.parse(JSON.parse(persisted.value).auth).isLoggedIn, false);
      });
      await goto(central);
      await page.waitForURL(`${central}/menu`);
    });
    await check('authenticated recovery stays accessible; opening does not reset or log out', async () => {
      const versionBefore = (await User.findByPk(user.id)).auth_version;
      await goto(`${central}/recuperar-senha`);
      await page.locator('input[type=email]').waitFor();
      assert.equal((await User.findByPk(user.id)).auth_version, versionBefore);
      await goto(central);
      await page.waitForURL(`${central}/menu`);
    });
    await check('invalidated central session cannot enter menu based on stored state', async () => {
      await user.update({ auth_version: 3 });
      const denied = page.waitForResponse((res) => res.url().includes('/api/clinic-context') && res.status() === 401);
      await goto(central);
      await denied;
      await page.waitForURL(`${central}/login`);
      await page.locator('input[name=email]').waitFor();
    });
    assert.equal(await model('EmailOutboxMessage').count(), 0, 'no email request or dispatch');
    console.log(`OK ${scenarios} browser scenarios; real login/tenant selection/invites/credential/preview APIs, zero email intents`);
  } catch (error) {
    console.error(`FAILED central-entry scenario: ${scenario}; ${error.name}; ${String(error.message).replace(/https?:\/\/\S+/g, '<test-url>').slice(0, 900)}`);
    process.exitCode = 1;
  } finally {
    if (browser) await browser.close();
    if (proxy) await proxy.cleanup();
    if (server) await server.cleanup();
    if (api) await new Promise((resolve) => { api.close(resolve); });
    await db.close();
  }
}
if (process.argv[2] === '--backend') {
  launch(process.argv[3]).catch((error) => { console.error(error.message); process.exitCode = 1; });
} else {
  fixture().catch((error) => { console.error(error.message); process.exitCode = 1; });
}
