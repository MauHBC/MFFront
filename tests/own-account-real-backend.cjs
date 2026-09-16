// Reuses MFBackend's disposable orchestrator; its exclusive temporary entrypoint
// is removed in finally. No manual server or persistent DB is used.
// node tests/own-account-real-backend.cjs --backend /absolute/path/to/MFBackend
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { spawn } = require('node:child_process');

const launch = async (root) => {
  const resolvedRoot = fs.realpathSync(root);
  const runner = 'src/tests/ownAccountContainmentDatabaseRunner.js';
  const entrypoint = path.join(resolvedRoot, runner);
  const orchestrator = path.join(resolvedRoot, 'scripts/run-disposable-mariadb-test.js');
  assert.ok(fs.existsSync(orchestrator), 'existing Backend disposable orchestrator required');
  // wx refuses to overwrite any parallel work, even an existing test entrypoint.
  fs.writeFileSync(entrypoint, `require(${JSON.stringify(__filename)});\n`, { flag: 'wx' });
  try {
    process.exitCode = await new Promise((resolve, reject) => {
      const child = spawn(process.execPath, [orchestrator, runner], { cwd: resolvedRoot, stdio: 'inherit' });
      child.once('error', reject);
      child.once('exit', (code) => resolve(code === null ? 1 : code));
    });
  } finally {
    fs.unlinkSync(entrypoint);
  }
};

const runFixture = () => {
const backendRoot = process.cwd();
const frontendRoot = path.resolve(__dirname, '..');
// Cross-repository fixture intentionally loads the real Backend, not API mocks.
// eslint-disable-next-line import/no-dynamic-require, global-require
const backend = (file) => require(path.join(backendRoot, 'src', file));
backend('config/disposableDatabaseSafety').assertDisposableDatabaseTarget();
assert.equal(process.env.MOTRIA_EMAIL_NETWORK_DISABLED, 'true');
assert.equal(process.env.RESEND_API_KEY || '', '');
process.env.NODE_ENV = 'test';
process.env.CLINICAL_AUTH_MODE = 'membership';
process.env.REQUEST_DELAY_MS = '0';
process.env.CORS_ALLOWED_ORIGINS = 'http://localhost';
['TOKEN_SECRET', 'PLATFORM_TOKEN_SECRET', 'CREDENTIAL_LINK_SECRET'].forEach((key) => {
  process.env[key] = crypto.randomBytes(48).toString('hex');
});
process.env.TOKEN_EXPIRATION = '10m';
process.env.PLATFORM_TOKEN_EXPIRATION = '10m';
process.env.CREDENTIAL_PUBLIC_URL = 'https://app.motria.com.br';
backend('database');
const Clinic = backend('models/Clinic').default;
const TeamPerson = backend('models/TeamPerson').default;
const User = backend('models/User').default;
const UserClinicMembership = backend('models/UserClinicMembership').default;
const MembershipProfileAssignment = backend('models/MembershipProfileAssignment').default;
const EmailOutboxMessage = backend('models/EmailOutboxMessage').default;
const ClinicalCredentialAction = backend('models/ClinicalCredentialAction').default;
const { ensureNativeProfiles } = backend('services/TeamAuthorizationService');
const { initializeJwtRuntimeConfiguration } = backend('config/jwt');
const { issueClinicalTokenV2 } = backend('services/JwtTokenService');

const main = async () => {
  let server;
  const observed = [];
  const db = User.sequelize;
  db.options.logging = false;
  try {
    initializeJwtRuntimeConfiguration(process.env);
    const clinic = await Clinic.create({ name: 'Own account isolated HTTP', country_code: 'BR', is_active: true });
    const profiles = await db.transaction((transaction) => ensureNativeProfiles({ clinicId: clinic.id, transaction }));
    const createIdentity = async (label, nativeType) => {
      const person = await TeamPerson.create({ clinic_id: clinic.id, name: label, is_active: true });
      const user = await User.create({
        clinic_id: clinic.id, person_id: person.id, name: label,
        email: `${crypto.randomUUID()}@example.test`, number: 123456789,
        password: crypto.randomBytes(32).toString('base64url'), is_active: true, auth_version: 3,
      });
      const membership = await UserClinicMembership.create({
        clinic_id: clinic.id, person_id: person.id, user_id: user.id, is_active: true, access_version: 4,
      });
      await MembershipProfileAssignment.create({
        clinic_id: clinic.id, membership_id: membership.id,
        profile_id: profiles.find((profile) => profile.native_type === nativeType).id,
        assigned_by_membership_id: membership.id,
      });
      return {
        isLoggedIn: true,
        token: issueClinicalTokenV2({ sub: user.id, membership_id: membership.id, clinic_id: clinic.id, auth_version: 3, access_version: 4 }),
        user: { id: user.id, name: user.name, email: user.email, group_ids: [] },
      };
    };
    const administrator = await createIdentity('Administrator HTTP', 'administrator');
    const nonAdministrator = await createIdentity('Non administrator HTTP', 'professional');
    const app = backend('app').default;
    // Observe requests without replacing the real application's handlers/guards.
    server = http.createServer((req, res) => {
      observed.push({ method: req.method, path: req.url });
      app(req, res);
    });
    await new Promise((resolve) => { server.listen(0, '127.0.0.1', resolve); });
    const baseURL = `http://127.0.0.1:${server.address().port}/api`;
    const messagesBefore = await EmailOutboxMessage.count();
    const actionsBefore = await ClinicalCredentialAction.count();
    const exitCode = await new Promise((resolve, reject) => {
      const child = spawn(process.execPath, [
        path.join(frontendRoot, 'node_modules/react-scripts/scripts/test.js'),
        '--watchAll=false', '--runInBand', '--silent', '--runTestsByPath',
        'src/routes/ownAccountContainment.http.integration.test.js',
      ], {
        cwd: frontendRoot,
        env: { ...process.env, CI: 'true', MOTRIA_ACCOUNT_REAL_BACKEND: JSON.stringify({ baseURL, administrator, nonAdministrator }) },
        stdio: 'inherit',
      });
      child.once('error', reject);
      child.once('exit', (code) => resolve(code));
    });
    assert.equal(exitCode, 0, 'Frontend real-Backend component/route gate failed');
    assert.equal(observed.filter((req) => /^\/api\/users\/?$/.test(req.path)).length, 0);
    assert.equal(await EmailOutboxMessage.count(), messagesBefore + 1, 'one queued intent, not delivery');
    assert.equal(await ClinicalCredentialAction.count(), actionsBefore + 1);
    assert.equal((await User.findByPk(administrator.user.id)).auth_version, 3, 'request must not revoke session');
    assert.equal(observed.filter((req) => req.method === 'POST' && req.path === '/api/public/credential-recovery-requests').length, 1);
    console.log('OK - real Backend + disposable MariaDB: admin notice, non-admin guard, authenticated recovery 202, session retained, zero /users, one queued intent; no email dispatch');
  } finally {
    if (server) await new Promise((resolve) => { server.close(resolve); });
    await db.close();
  }
};

main().catch((error) => { console.error(error.message); process.exitCode = 1; });
};

if (process.argv[2] === '--backend') {
  launch(process.argv[3]).catch((error) => { console.error(error.message); process.exitCode = 1; });
} else {
  runFixture();
}
