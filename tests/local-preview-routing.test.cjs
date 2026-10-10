const assert = require('node:assert/strict');
const test = require('node:test');
const express = require('express');
const historyFallback = require('connect-history-api-fallback');
const { localPreviewRouting } = require('../scripts/lib/local-preview-routing.cjs');

['whatsapp-pilot', 'whatsapp-preserved'].forEach((slot) => {
test(`preview ${slot} serves direct app GET/HEAD while keeping API and asset errors`, async () => {
  const app = express();
  app.use(localPreviewRouting({ NODE_ENV: 'development', MOTRIA_LOCAL_STACK_SLOT: slot }));
  app.get('/api/missing', (_req, res) => res.status(404).json({ error: 'NOT_FOUND' }));
  app.get('/static/existing.js', (_req, res) => res.type('js').send('console.log("fixture")'));
  app.use(historyFallback({ disableDotRule: true }));
  app.get('/index.html', (_req, res) => res.type('html').send('<div id="root"></div>'));
  const server = await new Promise((resolve) => {
    const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
  });
  try {
    const base = `http://127.0.0.1:${server.address().port}`;
    await Promise.all(['', '*/*', 'application/json', 'text/html'].map(async (accept) => {
      await Promise.all(['/', '/login', '/menu', '/agendamentos', '/agendamentos?view=week', '/whatsapp-cenarios', '/relatorios', '/pacientes/1', '/configuracoes/documentos'].map(async (pathname) => {
        const response = await fetch(base + pathname, { headers: { Accept: accept } });
        assert.equal(response.status, 200, `${pathname  }: ${  accept}`);
        assert.match(await response.text(), /id="root"/);
      }));
      await Promise.all(['/api/missing', '/static/missing.js', '/missing.svg', '/assets/missing'].map(async (pathname) => {
        const response = await fetch(base + pathname, { headers: { Accept: accept } });
        assert.equal(response.status, 404, `${pathname  }: ${  accept}`);
        assert.doesNotMatch(await response.text(), /id="root"/);
      }));
      const asset = await fetch(`${base  }/static/existing.js`, { headers: { Accept: accept } });
      assert.equal(asset.status, 200); assert.match(await asset.text(), /console.log/);
    }));
    assert.equal((await fetch(`${base}/agendamentos`, { method: 'HEAD', headers: { Accept: '' } })).status, 200);
    assert.equal((await fetch(`${base}/agendamentos`, { method: 'POST' })).status, 404);
  } finally { await new Promise((resolve) => { server.close(resolve); }); }
});

});

test('preview routing never changes another slot or production', () => {
  [
    { NODE_ENV: 'production', MOTRIA_LOCAL_STACK_SLOT: 'whatsapp-pilot' },
    { NODE_ENV: 'development', MOTRIA_LOCAL_STACK_SLOT: 'combined-validation' },
    { NODE_ENV: 'development' },
  ].forEach((environment) => {
    const req = { method: 'GET', url: '/agendamentos', headers: { accept: '' } };
    localPreviewRouting(environment)(req, {}, () => {});
    assert.deepEqual(req, { method: 'GET', url: '/agendamentos', headers: { accept: '' } });
  });
});
