'use strict';

const crypto = require('node:crypto');

// Furnizorul de eSIM. În MVP generăm un profil de test; în producție aici se
// apelează API-ul unui furnizor (ex. un agregator eSIM) care întoarce adresa
// SM-DP+ și codul de activare. Formatul standard pentru QR este
// "LPA:1$<adresa SM-DP+>$<cod de activare>" (GSMA SGP.22).
async function provisionEsim(plan) {
  const smdp = process.env.ESIM_SMDP_ADDRESS || 'smdp.test.example';
  const activationCode = crypto.randomBytes(10).toString('hex').toUpperCase();
  const iccid = '8940' + Array.from({ length: 15 }, () => crypto.randomInt(10)).join('');
  return {
    iccid,
    smdp,
    activationCode,
    lpa: `LPA:1$${smdp}$${activationCode}`,
    planId: plan.id,
    test: true
  };
}

module.exports = { provisionEsim };
