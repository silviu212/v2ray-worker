'use strict';

const fs = require('node:fs');
const path = require('node:path');

// Trimiterea emailurilor. În MVP scriem emailul ca fișier HTML în data/outbox/
// ca să poată fi verificat; în producție înlocuiește cu un serviciu SMTP/API
// (ex. Amazon SES, Postmark, Brevo).
async function sendMail(outboxDir, { to, subject, html }) {
  fs.mkdirSync(outboxDir, { recursive: true });
  const file = path.join(outboxDir, `${Date.now()}-${to.replace(/[^a-z0-9@._-]/gi, '_')}.html`);
  fs.writeFileSync(file, `<!-- To: ${to} -->\n<!-- Subject: ${subject} -->\n${html}`);
  console.log(`[mail] ${subject} -> ${to} (${file})`);
  return { file };
}

module.exports = { sendMail };
