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
  const User = backend('models/User').default;
  const Person = backend('models/TeamPerson').default;
  const Membership = backend('models/UserClinicMembership').default;
  const Assignment = backend('models/MembershipProfileAssignment').default;
  const { ensureNativeProfiles } = backend('services/TeamAuthorizationService');
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
    const existingPassword = `Local-${crypto.randomBytes(15).toString('hex')}!aA1`;
    const existingEmail = `${crypto.randomUUID()}@example.test`;
    const oldMemberships = [];
    let existingUser;
    for (let index = 0; index < 2; index += 1) {
      const clinic = await Clinic.create({ name: `Agenda anterior ${index + 1}` });
      const person = await Person.create({ clinic_id: clinic.id, name: 'Titular existente sintético', is_active: true });
      if (!existingUser) existingUser = await User.create({ clinic_id: clinic.id, person_id: person.id, name: person.name, email: existingEmail, password: existingPassword, number: '123456', is_active: true, auth_version: 1 });
      const member = await Membership.create({ clinic_id: clinic.id, person_id: person.id, user_id: existingUser.id, is_active: true, access_version: 1, last_used_at: index === 1 ? new Date() : null });
      const profiles = await ensureNativeProfiles({ clinicId: clinic.id });
      await Assignment.create({ clinic_id: clinic.id, membership_id: member.id, profile_id: profiles.find((profile) => profile.native_type === 'administrator').id });
      oldMemberships.push(member);
    }
    const existingHash = existingUser.password_hash;
    const before = await Clinic.count();
    await page.goto(`${origin}/cadastro`);
    await page.getByRole('heading', { name: 'Crie sua Agenda Motria' }).waitFor();
    const checkbox = page.getByRole('checkbox');
    assert.equal(await checkbox.isChecked(), false);
    assert.equal(await page.locator('input:not([type=checkbox])').count(), 3);
    const email = `${crypto.randomUUID()}@example.test`;
    await page.getByLabel('Nome', { exact: true }).fill('Titular Mobile Sintético');
    await page.getByLabel('E-mail', { exact: true }).fill(email);
    const signupPassword = `Trial-${crypto.randomBytes(15).toString('hex')}!aA1`;
    await page.getByLabel(/^Senha/).fill(signupPassword);
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
    await page.getByRole('link', { name: 'Entre para começar' }).click();
    await page.getByPlaceholder('Seu e-mail').fill(email);
    await page.getByPlaceholder('Sua senha').fill(signupPassword);
    await page.getByRole('button', { name: 'Entrar', exact: true }).click();
    await page.getByLabel('Cidade', { exact: true }).waitFor({ state: 'visible' });
    await page.locator('#trial-state').waitFor({ state: 'visible' });
    await page.locator('#trial-care').waitFor({ state: 'visible' });
    await page.getByRole('button', { name: 'Preencher depois' }).click();
    assert.equal(await page.getByLabel('Cidade', { exact: true }).isVisible(), false);

    const existingContext = await browser.newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers: 'block' });
    await existingContext.route('**/*', (route) => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
    const journey = await existingContext.newPage();
    journey.setDefaultTimeout(15000);
    await journey.goto(`${origin}/cadastro`);
    await journey.getByLabel('Nome', { exact: true }).fill('Solicitação pública sintética');
    await journey.getByLabel('E-mail', { exact: true }).fill(existingEmail);
    await journey.getByLabel(/^Senha/).fill(`Unused-${crypto.randomBytes(15).toString('hex')}!aA1`);
    await journey.getByRole('checkbox').check();
    await journey.getByRole('button', { name: 'Confirmar e-mail para criar Agenda' }).click();
    await journey.getByRole('heading', { name: 'Confira seu e-mail' }).waitFor();
    assert.equal(await Registration.count({ where: { email: existingEmail } }), 0, 'Public response does not create/reveal existing identity registration');
    await journey.getByRole('link', { name: 'Entrar na minha conta' }).click();
    assert.equal(new URL(journey.url()).pathname, '/login');
    await journey.getByPlaceholder('Seu e-mail').fill(existingEmail);
    await journey.getByPlaceholder('Sua senha').fill(existingPassword);
    await journey.getByRole('button', { name: 'Entrar', exact: true }).click();
    await journey.getByRole('heading', { name: 'Crie sua Agenda Motria' }).waitFor();
    assert.equal(new URL(journey.url()).pathname, '/cadastro', 'Canonical real login automatically resumes onboarding');
    await journey.waitForFunction((value) => document.querySelector('#signup-email')?.value === value, existingEmail);
    assert.equal(await journey.getByLabel('E-mail', { exact: true }).getAttribute('readonly'), '');
    assert.equal(await journey.locator('input[type=password]').count(), 0);
    await journey.getByRole('checkbox').check();
    await journey.getByRole('button', { name: 'Confirmar e-mail para criar Agenda' }).click();
    await journey.getByRole('heading', { name: 'Confira seu e-mail' }).waitFor();
    const existingPending = await Registration.findOne({ where: { email: existingEmail } });
    assert.equal(existingPending.authenticated_user_id, existingUser.id);
    await journey.goto(`${origin}/confirmar-email#token=${createSelfServiceToken(existingPending.action_id)}`);
    await journey.getByRole('heading', { name: 'Confirme seu e-mail' }).waitFor();
    await journey.getByRole('button', { name: 'Confirmar e criar minha Agenda' }).click();
    await journey.getByRole('heading', { name: 'Sua Agenda está pronta' }).waitFor();
    await existingUser.reload();
    assert.equal(existingUser.password_hash, existingHash);
    assert.equal(await Membership.count({ where: { user_id: existingUser.id } }), 3);
    for (const member of oldMemberships) {
      await member.reload(); assert.equal(member.is_active, true); assert.equal(member.access_version, 1);
    }
    const sessionAfter = await journey.evaluate(async () => {
      const persisted = JSON.parse(JSON.parse(localStorage.getItem('persist:CONSUMO-API:v2')).auth);
      return fetch('/api/clinic-session', { headers: { Authorization: `Bearer ${persisted.token}` } }).then((response) => response.json());
    });
    assert.equal(sessionAfter.active_membership_id, oldMemberships[1].id, 'Onboarding preserves the selected old clinic');
    assert.equal(await Clinic.count(), before + 2);
    await journey.goto(`${origin}/cadastro`);
    await journey.getByRole('checkbox').check();
    await journey.getByRole('button', { name: 'Confirmar e-mail para criar Agenda' }).click();
    await journey.getByRole('alert').waitFor();
    assert.equal(await Membership.count({ where: { user_id: existingUser.id } }), 3, 'One self-service consumption');
    console.log('PASS real compiled existing-identity journey: public neutral response -> Entrar -> canonical login -> automatic safe cadastro return -> authenticated proof -> new empty Agenda; two previous clinics, password, active selection and memberships preserved; second creation refused. First access fields visibly presented and deferrable.');
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
