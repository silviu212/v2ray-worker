# Instalare pe VPS

Două variante. **A (Docker)** este cea recomandată: totul pornește cu o singură comandă.
**B (fără Docker)** folosește Node.js și Caddy instalate direct pe server.

> **Important:** fără `STRIPE_SECRET_KEY` plata este **simulată**, iar furnizorul eSIM și emailurile
> sunt tot simulate (vezi README). Poți urca site-ul ca să-l vezi online, dar nu îl folosi pentru
> vânzări reale până nu sunt conectate plata, furnizorul și emailul.

# Varianta A: Docker

```
Internet ──80/443──> container caddy (HTTPS) ──> container silviu  (SITE_ID=silviu)
                                             └─> container prieten (SITE_ID=prieten, opțional)
```

Fișiere: `Dockerfile`, `docker-compose.yml`, `deploy/Caddyfile.docker`, `env/*.env.example`.

## A1. Domeniul

Înregistrare DNS de tip **A** pentru domeniul tău (și `www`) către IP-ul VPS-ului.

## A2. Docker pe VPS

Conectează-te cu `ssh root@IP_VPS` și instalează Docker Engine după ghidul oficial pentru Ubuntu:
https://docs.docker.com/engine/install/ubuntu/ (include și `docker compose`). Apoi:

```bash
ufw allow OpenSSH && ufw allow 80 && ufw allow 443 && ufw enable
docker --version && docker compose version
```

> Atenție: porturile publicate de Docker ocolesc regulile `ufw`. De aceea în `docker-compose.yml`
> doar Caddy are porturi publicate (80/443); containerele site-urilor nu sunt expuse direct.

## A3. Codul și configurarea

```bash
git clone https://github.com/silviu212/v2ray-worker.git /opt/movsim
cd /opt/movsim && git checkout claude/esim-europa-mvp-46osf1
cd esim-europa

cp env/silviu.env.example env/silviu.env
chmod 600 env/silviu.env
nano env/silviu.env                   # SITE_ID, PUBLIC_URL, (mai târziu) STRIPE_SECRET_KEY

nano deploy/Caddyfile.docker          # pune domeniul tău; șterge blocul prietenului dacă nu e aici
```

Dacă repository-ul e privat, `git clone` cere autentificare: folosește un
[token GitHub](https://github.com/settings/tokens) sau o „deploy key” doar cu drept de citire.

## A4. Pornire

```bash
docker compose up -d --build          # doar site-ul tău + Caddy
docker compose ps                     # silviu trebuie să fie „healthy”
```

Cu site-ul prietenului pe același VPS:

```bash
cp env/prieten.env.example env/prieten.env && chmod 600 env/prieten.env
nano env/prieten.env                  # SITE_ID=prieten, domeniul lui
docker compose --profile prieten up -d --build
```

Deschide `https://domeniul-tau.ro`; certificatul HTTPS apare automat după ce DNS-ul indică spre VPS.

## A5. Întreținere (Docker)

| Ce | Comandă (în `/opt/movsim/esim-europa`) |
|---|---|
| Actualizare cod | `git pull && docker compose up -d --build` (adaugă `--profile prieten` dacă îl folosești) |
| Loguri | `docker compose logs -f silviu` |
| Oprire | `docker compose down` (datele rămân în volume) |
| Comenzile unui site | `docker compose exec silviu cat /data/orders.json` |
| Backup | `docker run --rm -v esim-europa_silviu-data:/d -v $PWD:/b alpine tar czf /b/backup-silviu.tgz -C /d .` |

Volumele se numesc `<folder>_silviu-data`, `<folder>_prieten-data`; lista exactă: `docker volume ls`.
**Nu rula `docker compose down -v`**: `-v` șterge volumele, adică toate comenzile.

# Varianta B: fără Docker (systemd)

Ghid pentru un VPS cu **Ubuntu 24.04**, un domeniu propriu și acces `root`/`sudo` prin SSH.
Rezultat: site-ul rulează ca serviciu (pornește singur după restart), cu HTTPS automat prin Caddy.

```
Internet ──443──> Caddy (HTTPS) ──> 127.0.0.1:3001  movsim@silviu
                                └─> 127.0.0.1:3002  movsim@prieten   (opțional)
```

## B1. Domeniul

La firma de la care ai cumpărat domeniul, pune o înregistrare DNS de tip **A** pentru
`exemplu-silviu.ro` (și `www`) către IP-ul VPS-ului. Propagarea poate dura de la minute la ore.

## B2. Pregătirea serverului

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

## B3. Codul aplicației

```bash
useradd --system --home /opt/movsim --shell /usr/sbin/nologin movsim
git clone https://github.com/silviu212/v2ray-worker.git /opt/movsim
cd /opt/movsim && git checkout claude/esim-europa-mvp-46osf1
cd esim-europa && npm install --omit=dev
```

Dacă repository-ul e privat, `git clone` îți cere autentificare: folosește un
[token GitHub](https://github.com/settings/tokens) sau o cheie SSH de tip „deploy key” doar cu drept de citire.

## B4. Configurarea site-ului

```bash
mkdir -p /etc/movsim
cp /opt/movsim/esim-europa/deploy/site.env.example /etc/movsim/silviu.env
chmod 600 /etc/movsim/silviu.env
nano /etc/movsim/silviu.env   # completează SITE_ID, PORT, PUBLIC_URL
```

## B5. Pornirea serviciului

```bash
cp /opt/movsim/esim-europa/deploy/movsim@.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now movsim@silviu
systemctl status movsim@silviu        # trebuie să apară „active (running)”
curl -s http://127.0.0.1:3001/api/plans | head -c 200   # test local
```

## B6. HTTPS cu Caddy

```bash
cp /opt/movsim/esim-europa/deploy/Caddyfile.example /etc/caddy/Caddyfile
nano /etc/caddy/Caddyfile      # pune domeniul tău; șterge blocul prietenului dacă nu e pe acest VPS
caddy validate --config /etc/caddy/Caddyfile
systemctl reload caddy
```

Deschide `https://exemplu-silviu.ro`. Certificatul HTTPS apare automat, după ce DNS-ul
de la pasul 1 indică spre VPS.

## B7. Al doilea site (prietenul) pe același VPS

```bash
cp /opt/movsim/esim-europa/deploy/site.env.example /etc/movsim/prieten.env
chmod 600 /etc/movsim/prieten.env
nano /etc/movsim/prieten.env   # SITE_ID=prieten, PORT=3002, domeniul lui
systemctl enable --now movsim@prieten
systemctl reload caddy
```

Fiecare site are propriile comenzi în `/var/lib/movsim/<site>/orders.json`.

## B8. Întreținere

| Ce | Comandă |
|---|---|
| Actualizare cod | `cd /opt/movsim && git pull && cd esim-europa && npm install --omit=dev && systemctl restart movsim@silviu` |
| Jurnal (loguri) | `journalctl -u movsim@silviu -f` |
| Backup comenzi | copiază zilnic `/var/lib/movsim/` în altă parte (alt server / stocare) |
| Actualizări de securitate | `apt update && apt upgrade -y` periodic |
