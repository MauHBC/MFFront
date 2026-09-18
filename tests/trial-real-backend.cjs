// Compiled UI, real HTTP Backend and disposable MariaDB; loopback only, no email.
/* eslint-env node */
/* eslint-disable global-require, import/no-dynamic-require, no-restricted-syntax, no-await-in-loop */
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { spawn } = require('node:child_process');

function runtime() {
  // Test runtime supplied through NODE_PATH, separate from application dependencies.
  // eslint-disable-next-line import/no-unresolved
  const { chromium } = require('playwright');
  const executablePath = process.env.MOTRIA_TEST_BROWSER_EXECUTABLE_PATH || chromium.executablePath();
  assert.ok(fs.existsSync(executablePath), 'Provide an installed isolated browser executable');
  return { chromium, executablePath };
}
async function launch(backendRoot) {
  runtime();
  assert.ok(fs.existsSync(path.join(__dirname, '../build/index.html')), 'Build Frontend first');
  const runner = 'src/tests/trialBrowserHttpDatabaseRunner.js';
  const wrapper = path.join(backendRoot, runner);
  fs.writeFileSync(wrapper, `require(${JSON.stringify(__filename)});\n`, { flag: 'wx' });
  try {
    process.exitCode = await new Promise((resolve, reject) => {
      const child = spawn(process.execPath, ['scripts/run-disposable-mariadb-test.js', runner], {
        cwd: backendRoot, stdio: 'inherit', env: { ...process.env, MOTRIA_TRIAL_BROWSER_FIXTURE: '1' },
      });
      child.once('error', reject);
      child.once('exit', (code) => resolve(code ?? 1));
    });
  } finally { fs.unlinkSync(wrapper); }
}
async function fixture() {
  const backend = (file) => require(path.join(process.cwd(), 'src', file));
  backend('config/disposableDatabaseSafety').assertDisposableDatabaseTarget();
  assert.equal(process.env.MOTRIA_EMAIL_NETWORK_DISABLED, 'true');
  assert.equal(process.env.RESEND_API_KEY || '', '');
  Object.assign(process.env, {
    NODE_ENV: 'test', CLINICAL_AUTH_MODE: 'membership', REQUEST_DELAY_MS: '0',
    CREDENTIAL_PUBLIC_URL: 'https://app.motria.com.br',
    TOKEN_EXPIRATION: '30m', PLATFORM_TOKEN_EXPIRATION: '30m',
  });
  for (const key of ['TOKEN_SECRET', 'PLATFORM_TOKEN_SECRET', 'CREDENTIAL_LINK_SECRET']) {
    process.env[key] = crypto.randomBytes(48).toString('hex');
  }
  backend('database');
  const app = backend('app').default;
  const Clinic = backend('models/Clinic').default;
  const Registration = backend('models/SelfServiceRegistration').default;
  const { createSelfServiceToken } = backend('services/SelfServiceConfirmationTokenService');
  const build = path.resolve(__dirname, '../build');
  const { chromium, executablePath } = runtime();
  let server;
  let browser;
  try {
    server = http.createServer((req, res) => {
      if (req.url.startsWith('/api/')) { app(req, res); return; }
      const pathname = decodeURIComponent(new URL(req.url, 'http://127.0.0.1').pathname);
      let file = path.resolve(build, `.${pathname}`);
      if (!file.startsWith(`${build}${path.sep}`)) { res.writeHead(404).end(); return; }
      if (!fs.existsSync(file) || !fs.statSync(file).isFile()) file = path.join(build, 'index.html');
      const types = { '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml' };
      res.setHeader('Content-Type', types[path.extname(file)] || 'text/html');
      fs.createReadStream(file).pipe(res);
    });
    await new Promise((resolve) => { server.listen(0, '127.0.0.1', resolve); });
    const origin = `http://127.0.0.1:${server.address().port}`;
    browser = await chromium.launch({ headless: true, executablePath });
    const context = await browser.newContext({ viewport: { width: 375, height: 812 }, serviceWorkers: 'block' });
    await context.route('**/*', (route) => {
      if (new URL(route.request().url()).origin === origin) return route.continue();
      return route.abort(); // No DNS or network for any other origin/redirect.
    });
    const page = await context.newPage();
    page.setDefaultTimeout(15000);
    const before = await Clinic.count();
    await page.goto(`${origin}/cadastro`);
    await page.getByRole('heading', { name: 'Crie sua Agenda Motria' }).waitFor();
    const checkbox = page.getByRole('checkbox');
    assert.equal(await checkbox.isChecked(), false);
    assert.equal(await page.locator('input:not([type=checkbox])').count(), 3);
    const email = `${crypto.randomUUID()}@example.test`;
    await page.getByLabel('Nome', { exact: true }).fill('Titular Mobile Sintético');
    await page.getByLabel('E-mail', { exact: true }).fill(email);
    await page.getByLabel(/^Senha/).fill(`Trial-${crypto.randomBytes(15).toString('hex')}!aA1`);
    await page.getByRole('button', { name: 'Confirmar e-mail para criar Agenda' }).click();
    await page.getByRole('alert').filter({ hasText: 'Confirme a leitura' }).waitFor();
    assert.equal(await Registration.count(), 0);
    await checkbox.focus();
    await page.keyboard.press('Space');
    assert.equal(await checkbox.isChecked(), true);
    await page.getByRole('button', { name: 'Confirmar e-mail para criar Agenda' }).click();
    await page.getByRole('heading', { name: 'Confira seu e-mail' }).waitFor();
    assert.equal(await Clinic.count(), before, 'No Agenda before email proof');
    const pending = await Registration.findOne({ where: { email } });
    assert.ok(pending?.password_hash.startsWith('$argon2id$'));
    const token = createSelfServiceToken(pending.action_id);
    await page.goto(`${origin}/confirmar-email#token=${token}`);
    await page.getByRole('heading', { name: 'Confirme seu e-mail' }).waitFor();
    assert.equal(new URL(page.url()).hash, '');
    assert.equal(await Clinic.count(), before, 'GET/scanner cannot provision');
    await page.getByRole('button', { name: 'Confirmar e criar minha Agenda' }).click();
    await page.getByRole('heading', { name: 'Sua Agenda está pronta' }).waitFor();
    assert.equal(await Clinic.count(), before + 1);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
    console.log(`PASS Chromium ${browser.version()}: compiled UI, 375px, keyboard/legal gate, real HTTP signup, proof-before-tenant, memory-only fragment, explicit confirmation, no horizontal overflow. No external email/network.`);
  } finally {
    if (browser) await browser.close();
    if (server) await new Promise((resolve) => { server.close(resolve); });
    await Clinic.sequelize.close();
  }
}
const main = process.env.MOTRIA_TRIAL_BROWSER_FIXTURE === '1'
  ? fixture() : launch(fs.realpathSync(process.argv[2] || path.resolve(__dirname, '../../MFBackend')));
main.catch((error) => { console.error(error); process.exitCode = 1; });
