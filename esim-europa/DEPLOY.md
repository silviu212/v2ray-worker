# Instalare pe VPS

Ghid pentru un VPS cu **Ubuntu 24.04**, un domeniu propriu și acces `root`/`sudo` prin SSH.
Rezultat: site-ul rulează ca serviciu (pornește singur după restart), cu HTTPS automat prin Caddy.

```
Internet ──443──> Caddy (HTTPS) ──> 127.0.0.1:3001  movsim@silviu
                                └─> 127.0.0.1:3002  movsim@prieten   (opțional)
```

> **Important:** fără `STRIPE_SECRET_KEY` plata este **simulată**, iar furnizorul eSIM și emailurile
> sunt tot simulate (vezi README). Poți urca site-ul ca să-l vezi online, dar nu îl folosi pentru
> vânzări reale până nu sunt conectate plata, furnizorul și emailul.

## 1. Domeniul

La firma de la care ai cumpărat domeniul, pune o înregistrare DNS de tip **A** pentru
`exemplu-silviu.ro` (și `www`) către IP-ul VPS-ului. Propagarea poate dura de la minute la ore.

## 2. Pregătirea serverului

Conectează-te: `ssh root@IP_VPS`, apoi:

```bash
apt update && apt upgrade -y

# Firewall: doar SSH și web
ufw allow OpenSSH
ufw allow 80
ufw allow 443
ufw enable

# Node.js 22 LTS (NodeSource) – instrucțiuni oficiale: https://github.com/nodesource/distributions
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt install -y nodejs git
node --version        # trebuie să afișeze v22.x

# Caddy – urmează pașii pentru Debian/Ubuntu de pe https://caddyserver.com/docs/install
```

## 3. Codul aplicației

```bash
useradd --system --home /opt/movsim --shell /usr/sbin/nologin movsim
git clone https://github.com/silviu212/v2ray-worker.git /opt/movsim
cd /opt/movsim && git checkout claude/esim-europa-mvp-46osf1
cd esim-europa && npm install --omit=dev
```

Dacă repository-ul e privat, `git clone` îți cere autentificare: folosește un
[token GitHub](https://github.com/settings/tokens) sau o cheie SSH de tip „deploy key” doar cu drept de citire.

## 4. Configurarea site-ului

```bash
mkdir -p /etc/movsim
cp /opt/movsim/esim-europa/deploy/site.env.example /etc/movsim/silviu.env
chmod 600 /etc/movsim/silviu.env
openssl rand -hex 24          # copiază rezultatul la ADMIN_TOKEN
nano /etc/movsim/silviu.env   # completează SITE_ID, PORT, PUBLIC_URL, ADMIN_TOKEN
```

## 5. Pornirea serviciului

```bash
cp /opt/movsim/esim-europa/deploy/movsim@.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now movsim@silviu
systemctl status movsim@silviu        # trebuie să apară „active (running)”
curl -s http://127.0.0.1:3001/api/plans | head -c 200   # test local
```

## 6. HTTPS cu Caddy

```bash
cp /opt/movsim/esim-europa/deploy/Caddyfile.example /etc/caddy/Caddyfile
nano /etc/caddy/Caddyfile      # pune domeniul tău; șterge blocul prietenului dacă nu e pe acest VPS
caddy validate --config /etc/caddy/Caddyfile
systemctl reload caddy
```

Deschide `https://exemplu-silviu.ro`. Certificatul HTTPS apare automat, după ce DNS-ul
de la pasul 1 indică spre VPS.

## Al doilea site (prietenul) pe același VPS

```bash
cp /opt/movsim/esim-europa/deploy/site.env.example /etc/movsim/prieten.env
chmod 600 /etc/movsim/prieten.env
nano /etc/movsim/prieten.env   # SITE_ID=prieten, PORT=3002, domeniul lui, alt ADMIN_TOKEN
systemctl enable --now movsim@prieten
systemctl reload caddy
```

Fiecare site are propriile comenzi în `/var/lib/movsim/<site>/` și propria parolă de admin.

## Întreținere

| Ce | Comandă |
|---|---|
| Actualizare cod | `cd /opt/movsim && git pull && cd esim-europa && npm install --omit=dev && systemctl restart movsim@silviu` |
| Jurnal (loguri) | `journalctl -u movsim@silviu -f` |
| Backup comenzi | copiază zilnic `/var/lib/movsim/` în altă parte (alt server / stocare) |
| Actualizări de securitate | `apt update && apt upgrade -y` periodic |
