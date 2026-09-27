'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const QRCode = require('qrcode');

const { PLANS, COUNTRIES, findPlan, formatLei } = require('./lib/catalog');
const { OrderStore } = require('./lib/store');
const { provisionEsim } = require('./lib/provider');
const { sendMail } = require('./lib/mailer');
const payments = require('./lib/payments');

const PUBLIC_DIR = path.join(__dirname, 'public');
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon'
};
const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,255}\.[a-z]{2,}$/i;

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

function sendJson(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
}

async function readJson(req) {
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 10_000) throw Object.assign(new Error('Cerere prea mare'), { status: 413 });
    chunks.push(chunk);
  }
  try {
    return chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {};
  } catch {
    throw Object.assign(new Error('JSON invalid'), { status: 400 });
  }
}

function safeEqual(a, b) {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

function createApp(options = {}) {
  const dataDir = options.dataDir || process.env.DATA_DIR || path.join(__dirname, 'data');
  const store = new OrderStore(path.join(dataDir, 'orders.json'));
  const outbox = path.join(dataDir, 'outbox');
  const adminToken = options.adminToken || process.env.ADMIN_TOKEN || '';
  const whatsapp = (process.env.WHATSAPP_NUMBER || '').replace(/\D/g, '');
  // Eticheta site-ului: se pune pe fiecare comandă, plată și eSIM, ca vânzările
  // a două site-uri care folosesc aceleași conturi să poată fi despărțite.
  const siteId = options.siteId || process.env.SITE_ID || 'site1';
  if (!/^[a-z0-9-]{1,32}$/.test(siteId)) throw new Error('SITE_ID poate conține doar litere mici, cifre și cratimă (max. 32)');

  // Vederea publică a unei comenzi: fără token-ul de acces și fără date interne.
  async function publicOrder(order) {
    const plan = findPlan(order.planId);
    const view = {
      id: order.id,
      status: order.status,
      email: order.email,
      amount: formatLei(order.amountBani),
      createdAt: order.createdAt,
      plan: plan && { id: plan.id, name: plan.name, dataGb: plan.dataGb, days: plan.days, minutes: plan.minutes, sms: plan.sms }
    };
    if (order.status === 'delivered' && order.esim) {
      view.esim = {
        iccid: order.esim.iccid,
        smdp: order.esim.smdp,
        activationCode: order.esim.activationCode,
        lpa: order.esim.lpa,
        test: order.esim.test,
        qr: await QRCode.toDataURL(order.esim.lpa, { margin: 1, width: 280 })
      };
    }
    return view;
  }

  async function emailEsim(order, baseUrl) {
    const plan = findPlan(order.planId);
    const link = `${baseUrl}/comanda.html?order=${order.id}&token=${order.token}`;
    const qr = await QRCode.toDataURL(order.esim.lpa, { margin: 1, width: 280 });
    await sendMail(outbox, {
      to: order.email,
      subject: `eSIM-ul tău ${plan.name} (${plan.dataGb} GB / ${plan.days} zile) - comanda ${order.id}`,
      html: `<h1>Mulțumim, ${escapeHtml(order.name)}!</h1>
<p>Scanează codul QR din Setări &rarr; Celular/Date mobile &rarr; Adaugă eSIM.</p>
<p><img src="${qr}" alt="Cod QR eSIM" width="280" height="280"></p>
<p>Instalare manuală: SM-DP+ <b>${escapeHtml(order.esim.smdp)}</b>, cod activare <b>${escapeHtml(order.esim.activationCode)}</b></p>
<p>Instrucțiuni complete și codul QR: <a href="${link}">${link}</a></p>`
    });
  }

  // Livrarea eSIM-ului după plată. Idempotentă: o comandă livrată nu mai este
  // procesată a doua oară (ex. dacă pagina de confirmare este reîncărcată).
  const inFlight = new Map();
  function fulfill(order, baseUrl) {
    if (order.status === 'delivered') return Promise.resolve(order);
    if (inFlight.has(order.id)) return inFlight.get(order.id);
    const job = (async () => {
      const plan = findPlan(order.planId);
      store.update(order.id, { status: 'paid', paidAt: new Date().toISOString() });
      const esim = await provisionEsim(plan, { site: order.site, orderId: order.id });
      const done = store.update(order.id, { status: 'delivered', esim, deliveredAt: new Date().toISOString() });
      await emailEsim(done, baseUrl);
      return done;
    })().finally(() => inFlight.delete(order.id));
    inFlight.set(order.id, job);
    return job;
  }

  function orderFromRequest(id, token) {
    const order = store.get(id);
    if (!order || !token || !safeEqual(order.token, token)) {
      throw Object.assign(new Error('Comanda nu a fost găsită'), { status: 404 });
    }
    return order;
  }

  async function api(req, res, url, baseUrl) {
    const parts = url.pathname.split('/').filter(Boolean); // ['api', ...]

    if (req.method === 'GET' && url.pathname === '/api/config') {
      return sendJson(res, 200, { paymentMode: payments.mode(), whatsapp });
    }
    if (req.method === 'GET' && url.pathname === '/api/plans') {
      return sendJson(res, 200, PLANS.map((p) => ({ ...p, price: formatLei(p.priceBani) })));
    }
    if (req.method === 'GET' && url.pathname === '/api/countries') {
      return sendJson(res, 200, COUNTRIES);
    }

    if (req.method === 'POST' && url.pathname === '/api/orders') {
      const body = await readJson(req);
      const plan = findPlan(body.planId);
      const email = String(body.email || '').trim().toLowerCase();
      const name = String(body.name || '').trim().slice(0, 100);
      const errors = {};
      if (!plan) errors.planId = 'Pachet inexistent';
      if (!EMAIL_RE.test(email)) errors.email = 'Adresa de email nu este validă';
      if (!name) errors.name = 'Completează numele';
      if (body.acceptTerms !== true) errors.acceptTerms = 'Trebuie să accepți termenii și condițiile';
      if (Object.keys(errors).length) return sendJson(res, 422, { error: 'Date invalide', fields: errors });

      const order = store.create({
        id: 'ES-' + crypto.randomBytes(4).toString('hex').toUpperCase(),
        token: crypto.randomBytes(16).toString('hex'),
        site: siteId,
        planId: plan.id,
        amountBani: plan.priceBani,
        email,
        name,
        status: 'pending',
        createdAt: new Date().toISOString()
      });
      const payment = await payments.createPayment(order, plan, baseUrl);
      store.update(order.id, { payment: { provider: payment.provider, sessionId: payment.sessionId } });
      return sendJson(res, 201, { orderId: order.id, token: order.token, paymentUrl: payment.url });
    }

    // /api/orders/:id[/action]
    if (parts[1] === 'orders' && parts[2]) {
      const id = parts[2];
      const action = parts[3];

      if (req.method === 'GET' && !action) {
        let order = orderFromRequest(id, url.searchParams.get('token'));
        if (order.status === 'pending' && order.payment && order.payment.provider !== 'mock' && (await payments.isPaid(order))) {
          order = await fulfill(order, baseUrl);
        }
        return sendJson(res, 200, await publicOrder(order));
      }

      if (req.method === 'POST' && action === 'mock-pay') {
        if (payments.mode() !== 'mock') return sendJson(res, 403, { error: 'Plata simulată este dezactivată' });
        const body = await readJson(req);
        const order = orderFromRequest(id, body.token);
        if (body.outcome === 'fail') {
          if (order.status === 'pending') store.update(id, { status: 'failed' });
          return sendJson(res, 200, await publicOrder(store.get(id)));
        }
        if (order.status === 'failed') store.update(id, { status: 'pending' });
        return sendJson(res, 200, await publicOrder(await fulfill(store.get(id), baseUrl)));
      }

      if (req.method === 'POST' && action === 'resend') {
        const body = await readJson(req);
        const order = orderFromRequest(id, body.token);
        if (order.status !== 'delivered') return sendJson(res, 409, { error: 'eSIM-ul nu a fost încă livrat' });
        const last = order.lastResendAt ? Date.parse(order.lastResendAt) : 0;
        if (Date.now() - last < 60_000) return sendJson(res, 429, { error: 'Așteaptă un minut înainte de a retrimite emailul' });
        store.update(id, { lastResendAt: new Date().toISOString() });
        await emailEsim(order, baseUrl);
        return sendJson(res, 200, { ok: true });
      }
    }

    if (req.method === 'GET' && url.pathname === '/api/admin/orders') {
      const auth = req.headers.authorization || '';
      if (!adminToken || !safeEqual(auth, `Bearer ${adminToken}`)) return sendJson(res, 401, { error: 'Neautorizat' });
      return sendJson(res, 200, store.list().map((o) => ({
        id: o.id, site: o.site, email: o.email, name: o.name, planId: o.planId, amount: formatLei(o.amountBani),
        status: o.status, createdAt: o.createdAt, iccid: o.esim && o.esim.iccid
      })));
    }

    return sendJson(res, 404, { error: 'Rută inexistentă' });
  }

  function serveStatic(req, res, url) {
    let rel = decodeURIComponent(url.pathname);
    if (rel.endsWith('/')) rel += 'index.html';
    const file = path.normalize(path.join(PUBLIC_DIR, rel));
    if (!file.startsWith(PUBLIC_DIR + path.sep)) {
      res.writeHead(403);
      return res.end();
    }
    fs.readFile(file, (err, data) => {
      if (err) {
        res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
        return res.end('<h1>404</h1><p>Pagina nu există. <a href="/">Înapoi acasă</a></p>');
      }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
      res.end(data);
    });
  }

  return http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    const baseUrl = process.env.PUBLIC_URL || `http://${req.headers.host}`;
    try {
      if (url.pathname.startsWith('/api/')) return await api(req, res, url, baseUrl);
      if (req.method !== 'GET' && req.method !== 'HEAD') return sendJson(res, 405, { error: 'Metodă nepermisă' });
      return serveStatic(req, res, url);
    } catch (err) {
      if (!err.status) console.error(err);
      return sendJson(res, err.status || 500, { error: err.status ? err.message : 'Eroare internă' });
    }
  });
}

if (require.main === module) {
  const port = Number(process.env.PORT) || 3000;
  createApp().listen(port, () => {
    console.log(`MovSIM MVP pornit pe http://localhost:${port} (site: ${process.env.SITE_ID || 'site1'}, plăți: ${payments.mode()})`);
  });
}

module.exports = { createApp };
