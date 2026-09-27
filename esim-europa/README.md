# MovSIM – MVP magazin eSIM Europa

Magazin online minimal pentru eSIM-uri de călătorie în Europa, inspirat de fluxul de pe esimeuropa.ro, cu temă mov închis.
„MovSIM” este un nume provizoriu (nu folosi numele sau marca altei firme); îl schimbi în `public/*.html` și `public/layout.js`.

Flux:
alegi pachetul → plătești în lei → primești codul QR pe email și pe pagina comenzii.

## Pornire

```bash
cd esim-europa
npm install
npm start          # http://localhost:3000
npm test           # teste API (node:test)
```

## Ce conține

| Pagină | Ce face |
| --- | --- |
| `/` | Hero, pachete (butoane „Cumpără”), „Cum funcționează”, căutare țări, verificare compatibilitate telefon, FAQ, buton WhatsApp flotant, meniu mobil |
| `/checkout.html?plan=…` | Alegere/schimbare pachet, email, nume, confirmare compatibilitate, acceptare termeni, validare, buton „Plătește X lei” |
| `/plata.html` | Plată **simulată** (reușită / refuzată) – doar în modul demo |
| `/comanda.html?order=…&token=…` | Cod QR, instalare manuală (SM-DP+ + cod activare, butoane „Copiază”), instrucțiuni iPhone/Android, „Retrimite emailul”, stări: în așteptare / refuzată / livrată |
| `/termeni.html`, `/confidentialitate.html` | Șabloane – trebuie completate de un jurist |

API: `GET /api/plans`, `GET /api/countries`, `GET /api/config`, `POST /api/orders`,
`GET /api/orders/:id?token=`, `POST /api/orders/:id/mock-pay`, `POST /api/orders/:id/resend`.

Cu Docker:

```bash
cp env/silviu.env.example env/silviu.env   # completează
docker compose up -d --build               # site + Caddy (HTTPS)
```

Instalare pe un VPS (Docker sau direct, HTTPS automat): vezi [DEPLOY.md](DEPLOY.md).

## Configurare (variabile de mediu)

| Variabilă | Rol |
| --- | --- |
| `PORT` | portul serverului (implicit 3000) |
| `HOST` | adresa pe care ascultă serverul (implicit `0.0.0.0`; pe VPS `127.0.0.1`) |
| `SITE_ID` | eticheta site-ului (ex. `silviu`, `prieten`): litere mici, cifre, cratimă |
| `PUBLIC_URL` | adresa publică, folosită în linkurile din email și în Stripe |
| `WHATSAPP_NUMBER` | numărul pentru butonul WhatsApp, format internațional fără `+` (fără el, butonul nu apare) |
| `STRIPE_SECRET_KEY` | dacă este setată, plata trece prin Stripe Checkout în loc de simulare |
| `ESIM_SMDP_ADDRESS` | adresa SM-DP+ folosită de profilul de test |
| `DATA_DIR` | unde se salvează comenzile (`orders.json`) și emailurile (`outbox/`) |

## Ce este simulat și trebuie înlocuit înainte de lansare

1. **Furnizorul eSIM** (`lib/provider.js`) – generează un profil de test, nu un eSIM real. Trebuie conectat la API-ul unui furnizor/agregator eSIM.
2. **Emailul** (`lib/mailer.js`) – scrie emailurile în `data/outbox/`. Trebuie conectat la un serviciu SMTP/API.
3. **Plata** – modul Stripe (`lib/payments.js`) este scris, dar **nu a fost testat cu un cont Stripe real**; verifică-l în modul test Stripe. Pentru producție adaugă și webhook-ul `checkout.session.completed`, ca livrarea să nu depindă de revenirea clientului pe site.
4. **Prețurile** (`lib/catalog.js`) – doar pachetul 50 GB / 31 zile / 149 lei (120 min, 1000 SMS) provine din informațiile publice despre esimeuropa.ro; restul sunt exemple (marcate „exemplu” pe site).
5. **Lista de țări** – trebuie aliniată cu acoperirea furnizorului.
6. **Stocarea** – un fișier JSON; pentru trafic real folosește o bază de date.
7. **Facturare** (e-Factura/SmartBill etc.), datele firmei, termenii legali și GDPR.

## Două site-uri pe aceleași conturi (plăți + furnizor eSIM)

Fiecare site rulează cu propriul `SITE_ID`. Eticheta ajunge automat:

- pe comandă (câmpul `site` din `orders.json`, în `DATA_DIR`);
- la Stripe, în `metadata[site]` și `metadata[order_id]`, atât pe sesiunea de checkout cât și pe plată (PaymentIntent). În panoul Stripe poți filtra/exporta plățile după aceste câmpuri;
- la furnizorul eSIM, ca referință `site:comandă` (`lib/provider.js`). La integrarea cu furnizorul real, trimite-o în câmpul de referință al comenzii, dacă API-ul lor are unul, sau folosește chei API separate pe site.

Verificare lunară, pentru fiecare site: plăți încasate cu eticheta lui (Stripe) = eSIM-uri emise cu eticheta lui (furnizor). Un eSIM fără plată corespunzătoare trebuie investigat.
