'use strict';

// Plăți. Implicit rulează în modul "mock" (fără bani reali): cumpărătorul este
// trimis la o pagină de plată simulată. Dacă setezi STRIPE_SECRET_KEY se
// folosește Stripe Checkout (card, Apple Pay, Google Pay), cu verificarea
// plății făcută pe server prin API-ul Stripe.
const STRIPE_API = 'https://api.stripe.com/v1';

function mode() {
  return process.env.STRIPE_SECRET_KEY ? 'stripe' : 'mock';
}

async function stripeRequest(method, endpoint, params) {
  const res = await fetch(STRIPE_API + endpoint, {
    method,
    headers: {
      Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: params ? new URLSearchParams(params).toString() : undefined
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`Stripe ${res.status}: ${body.error && body.error.message}`);
  return body;
}

async function createPayment(order, plan, baseUrl) {
  if (mode() === 'mock') {
    return { provider: 'mock', url: `/plata.html?order=${order.id}&token=${order.token}` };
  }
  const back = `${baseUrl}/comanda.html?order=${order.id}&token=${order.token}`;
  const session = await stripeRequest('POST', '/checkout/sessions', {
    mode: 'payment',
    customer_email: order.email,
    client_reference_id: order.id,
    success_url: back,
    cancel_url: `${baseUrl}/checkout.html?plan=${plan.id}`,
    'line_items[0][quantity]': '1',
    'line_items[0][price_data][currency]': 'ron',
    'line_items[0][price_data][unit_amount]': String(order.amountBani),
    'line_items[0][price_data][product_data][name]': `eSIM ${plan.name} - ${plan.dataGb} GB / ${plan.days} zile`
  });
  return { provider: 'stripe', url: session.url, sessionId: session.id };
}

// Întoarce true doar dacă furnizorul de plăți confirmă că plata a fost încasată.
async function isPaid(order) {
  if (order.payment && order.payment.provider === 'stripe') {
    const session = await stripeRequest('GET', `/checkout/sessions/${encodeURIComponent(order.payment.sessionId)}`);
    return session.payment_status === 'paid';
  }
  return false;
}

module.exports = { mode, createPayment, isPaid };
