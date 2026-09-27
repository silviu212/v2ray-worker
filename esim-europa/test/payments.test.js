'use strict';

const test = require('node:test');
const assert = require('node:assert');
const payments = require('../lib/payments');

test('Stripe primește eticheta site-ului pe sesiune și pe plată', async () => {
  process.env.STRIPE_SECRET_KEY = 'sk_test_fals';
  const realFetch = global.fetch;
  let sent;
  global.fetch = async (url, init) => {
    sent = { url, params: new URLSearchParams(init.body) };
    return { ok: true, json: async () => ({ id: 'cs_test_1', url: 'https://checkout.stripe.test/1' }) };
  };
  try {
    const order = { id: 'ES-ABCD1234', token: 't', site: 'prieten', email: 'a@b.ro', amountBani: 14900 };
    const plan = { id: 'eu-50gb-31z', name: 'Europa 50', dataGb: 50, days: 31 };
    const res = await payments.createPayment(order, plan, 'https://exemplu.ro');
    assert.strictEqual(res.sessionId, 'cs_test_1');
    assert.strictEqual(sent.url, 'https://api.stripe.com/v1/checkout/sessions');
    assert.strictEqual(sent.params.get('metadata[site]'), 'prieten');
    assert.strictEqual(sent.params.get('metadata[order_id]'), 'ES-ABCD1234');
    assert.strictEqual(sent.params.get('payment_intent_data[metadata][site]'), 'prieten');
    assert.strictEqual(sent.params.get('client_reference_id'), 'ES-ABCD1234');
  } finally {
    global.fetch = realFetch;
    delete process.env.STRIPE_SECRET_KEY;
  }
});
