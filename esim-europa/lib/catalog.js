'use strict';

// Catalogul de pachete. Prețurile sunt în bani (1 leu = 100 bani) ca să evităm
// erorile de rotunjire cu numere zecimale.
//
// ATENȚIE: singurul pachet confirmat public pe esimeuropa.ro (conform rezultatelor
// de căutare) este 50 GB / 31 zile / 149 lei cu 120 minute internaționale și
// 1000 SMS. Celelalte pachete sunt EXEMPLE — înlocuiește-le cu ofertele și
// prețurile furnizorului tău de eSIM înainte de lansare.
const PLANS = [
  { id: 'eu-10gb-15z', name: 'Vacanță', dataGb: 10, days: 15, minutes: 60, sms: 100, priceBani: 7900, example: true },
  { id: 'eu-50gb-31z', name: 'Europa 50', dataGb: 50, days: 31, minutes: 120, sms: 1000, priceBani: 14900, popular: true, example: false },
  { id: 'eu-100gb-31z', name: 'Europa 100', dataGb: 100, days: 31, minutes: 120, sms: 1000, priceBani: 21900, example: true }
];

// Țări acoperite — listă configurabilă. Acoperirea reală depinde de contractul
// cu furnizorul (operatorul) de eSIM; verifică lista lor înainte de publicare.
const COUNTRIES = [
  'Austria', 'Belgia', 'Bulgaria', 'Cehia', 'Cipru', 'Croația', 'Danemarca',
  'Elveția', 'Estonia', 'Finlanda', 'Franța', 'Germania', 'Grecia', 'Irlanda',
  'Islanda', 'Italia', 'Letonia', 'Liechtenstein', 'Lituania', 'Luxemburg',
  'Malta', 'Marea Britanie', 'Norvegia', 'Olanda', 'Polonia', 'Portugalia',
  'România', 'Slovacia', 'Slovenia', 'Spania', 'Suedia', 'Ungaria'
];

function findPlan(id) {
  return PLANS.find((p) => p.id === id) || null;
}

function formatLei(bani) {
  return (bani / 100).toFixed(2).replace('.', ',').replace(/,00$/, '') + ' lei';
}

module.exports = { PLANS, COUNTRIES, findPlan, formatLei };
