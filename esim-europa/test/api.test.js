'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createApp } = require('../server');

let server;
let base;
let dataDir;

test.before(async () => {
  delete process.env.STRIPE_SECRET_KEY;
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'esim-'));
  server = createApp({ dataDir, adminToken: 'secret', siteId: 'silviu' });
  await new Promise((r) => server.listen(0, r));
  base = `http://127.0.0.1:${server.address().port}`;
});
test.after(() => server.close());

const post = (p, body) => fetch(base + p, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

test('listează pachetele cu preț în lei', async () => {
  const plans = await (await fetch(base + '/api/plans')).json();
  const popular = plans.find((p) => p.popular);
  assert.strictEqual(popular.id, 'eu-50gb-31z');
  assert.strictEqual(popular.price, '149 lei');
});

test('respinge datele invalide la comandă', async () => {
  const res = await post('/api/orders', { planId: 'nu-exista', email: 'gresit', name: '', acceptTerms: false });
  assert.strictEqual(res.status, 422);
  const body = await res.json();
  assert.deepStrictEqual(Object.keys(body.fields).sort(), ['acceptTerms', 'email', 'name', 'planId']);
});

test('flux complet: comandă -> plată simulată -> eSIM livrat + email', async () => {
  const res = await post('/api/orders', { planId: 'eu-50gb-31z', email: 'Ana@Example.com', name: 'Ana Pop', acceptTerms: true });
  assert.strictEqual(res.status, 201);
  const { orderId, token, paymentUrl } = await res.json();
  assert.match(paymentUrl, /^\/plata\.html\?order=ES-/);

  const pending = await (await fetch(`${base}/api/orders/${orderId}?token=${token}`)).json();
  assert.strictEqual(pending.status, 'pending');
  assert.strictEqual(pending.esim, undefined);

  const paid = await (await post(`/api/orders/${orderId}/mock-pay`, { token, outcome: 'success' })).json();
  assert.strictEqual(paid.status, 'delivered');
  assert.strictEqual(paid.email, 'ana@example.com');
  assert.match(paid.esim.lpa, /^LPA:1\$[^$]+\$[0-9A-F]{20}$/);
  assert.match(paid.esim.qr, /^data:image\/png;base64,/);
  assert.match(paid.esim.iccid, /^\d{19}$/);
  const stored = JSON.parse(fs.readFileSync(path.join(dataDir, 'orders.json'), 'utf8'))[orderId];
  assert.strictEqual(stored.site, 'silviu');
  assert.strictEqual(stored.esim.reference, `silviu:${orderId}`);

  // O a doua plată nu generează un alt eSIM.
  const again = await (await post(`/api/orders/${orderId}/mock-pay`, { token, outcome: 'success' })).json();
  assert.strictEqual(again.esim.iccid, paid.esim.iccid);

  const mails = fs.readdirSync(path.join(dataDir, 'outbox'));
  assert.strictEqual(mails.length, 1);

  const resend = await post(`/api/orders/${orderId}/resend`, { token });
  assert.strictEqual(resend.status, 200);
  const tooSoon = await post(`/api/orders/${orderId}/resend`, { token });
  assert.strictEqual(tooSoon.status, 429);
});

test('plata refuzată marchează comanda ca eșuată', async () => {
  const { orderId, token } = await (await post('/api/orders', { planId: 'eu-10gb-15z', email: 'a@b.ro', name: 'X', acceptTerms: true })).json();
  const o = await (await post(`/api/orders/${orderId}/mock-pay`, { token, outcome: 'fail' })).json();
  assert.strictEqual(o.status, 'failed');
});

test('comanda nu poate fi citită fără token corect', async () => {
  const { orderId } = await (await post('/api/orders', { planId: 'eu-10gb-15z', email: 'a@b.ro', name: 'X', acceptTerms: true })).json();
  assert.strictEqual((await fetch(`${base}/api/orders/${orderId}?token=gresit`)).status, 404);
  assert.strictEqual((await fetch(`${base}/api/orders/${orderId}`)).status, 404);
});

test('admin cere token', async () => {
  assert.strictEqual((await fetch(base + '/api/admin/orders')).status, 401);
  const res = await fetch(base + '/api/admin/orders', { headers: { Authorization: 'Bearer secret' } });
  assert.strictEqual(res.status, 200);
  const rows = await res.json();
  assert.ok(rows.length >= 3);
  assert.ok(rows.every((r) => r.site === 'silviu'));
});

test('servește paginile și blochează path traversal', async () => {
  assert.strictEqual((await fetch(base + '/')).status, 200);
  assert.strictEqual((await fetch(base + '/checkout.html')).status, 200);
  assert.notStrictEqual((await fetch(base + '/..%2fserver.js')).status, 200);
  assert.strictEqual((await fetch(base + '/nu-exista.html')).status, 404);
});

test('SITE_ID invalid oprește pornirea', () => {
  assert.throws(() => createApp({ dataDir, siteId: 'Site Silviu!' }), /SITE_ID/);
});
