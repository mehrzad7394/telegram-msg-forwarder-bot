## Production Install

Two supported paths — pick one:

- **Automated** — one command. Installs everything and configures it.
- **Manual** — step by step, for servers where the automated script doesn't apply
  (non‑Ubuntu distros, existing infrastructure, restricted environments).

Both produce an identical result: MongoDB and Redis in Docker containers, the
backend and frontend running under PM2, reachable at `http://<server-ip>:<port>`.

**Requirements** — Ubuntu 22.04 / 24.04 / 26.04 (x86_64 or arm64), root access,
public IP, and a Telegram bot token from [@BotFather](https://t.me/BotFather).

---

## Automated Install

One command on a **fresh** Ubuntu server as **root**:

```sh
curl -fsSL -o /tmp/relay-install.sh \
  https://raw.githubusercontent.com/mehrzad7394/telegram-msg-forwarder-bot/main/install.sh \
  && sudo bash /tmp/relay-install.sh \
       --repo https://github.com/mehrzad7394/telegram-msg-forwarder-bot.git
```

It will prompt for the values below, then run for about 3–5 minutes.

### What it installs

| Component | Method | Default endpoint |
|---|---|---|
| Node.js 22 | NodeSource APT repo | system‑wide |
| pnpm 10 | Corepack | system‑wide |
| Docker | `apt install docker.io` if missing | systemd daemon |
| MongoDB | Docker container `relay-mongo`, image `mongo:7.0`, volume `relay-mongo-data` | `127.0.0.1:27017` |
| Redis | Docker container `relay-redis`, image `redis:7-alpine`, volume `relay-redis-data`, AOF enabled | `127.0.0.1:6379` |
| Backend | PM2 app `relay-server` (NestJS) | `127.0.0.1:3001` |
| Frontend | PM2 app `relay-client` (Next.js) | `0.0.0.0:3000` |
| Swap | 2 GB `/swapfile` if RAM < 2 GB and no swap present | `/swapfile` |

### Flags

| Flag | Effect |
|---|---|
| `--repo <url>` | Repository to clone (skips the prompt) |
| `--dir <path>` | Install location (default `/opt/relay-console`) |
| `--port <n>` | Public frontend port (default `3000`) |
| `--fresh` | Stop PM2, wipe `--dir`, keep Mongo/Redis data volumes |
| `--wipe-data` | Also delete `relay-mongo-data` and `relay-redis-data` |

### Prompt values

| Prompt | Notes |
|---|---|
| Public frontend port | Default `3000`. Change if something else uses it. |
| MongoDB URI | Default `mongodb://127.0.0.1:27017/relay-console`. Change the DB name only if you want a non-default one. |
| Redis URL | Default `redis://127.0.0.1:6379`. Must match whatever Redis you point at. |
| Telegram bot token | Required. |
| JWT secret | Leave blank to auto‑generate a 32‑byte random hex. |
| Admin Telegram user ID | Numeric Telegram user ID of the initial administrator. |
| Admin password | Minimum 8 characters. |
| Public site URL | Default `http://<detected-public-ip>:<port>`. Baked into the client build (canonical URLs, OG tags, Twitter Cards). Changing it later requires a client rebuild. |
| Server-side backend API URL | Default `http://127.0.0.1:3001/api`. Only the Next.js server calls this. Do not expose 3001 publicly. |

### After the installer finishes

Open the panel at `http://<server-ip>:<port>/login` (English) or
`/fa/login` (Persian) and log in as **admin** with the password you set.

You **must** add an inbound **TCP <port>** rule in your cloud provider's
firewall console (AWS Security Groups, Hetzner Firewalls, DigitalOcean Cloud
Firewalls, Azure NSGs, Oracle Security Lists). The installer opens
`ufw`/`firewalld` on the host, but cannot change provider‑side rules.

---

## Manual Install

Follow this if you'd rather inspect every step, or if you're on a distro where
the installer doesn't apply. All commands assume **root** (prefix `sudo` for a
non‑root user; skip `pm2 startup` in that case).

### 1. Base packages

```sh
apt-get update
apt-get install -y curl wget git ca-certificates gnupg lsb-release \
                   build-essential unzip jq openssl
```

### 2. Swap (only if RAM < 2 GB and no swap present)

```sh
swapon --show                        # if empty, create swap
fallocate -l 2G /swapfile            # or: dd if=/dev/zero of=/swapfile bs=1M count=2048
chmod 600 /swapfile
mkswap /swapfile
swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab
sysctl -w vm.swappiness=10
```

Without swap, `pnpm install` and `pnpm build` may be killed by the OOM killer on
1 GB servers.

### 3. Node.js 22

```sh
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt-get install -y nodejs
node -v                              # → v22.x or newer
```

### 4. pnpm 10

```sh
corepack enable
corepack prepare pnpm@10 --activate
pnpm -v                              # → 10.x
```

### 5. Docker (for MongoDB and Redis)

```sh
apt-get install -y docker.io
systemctl enable --now docker
docker info                          # should show server information
```

Skip this if you plan to reuse an external MongoDB or Redis.

### 6. MongoDB

**Recommended: Docker.** The `mongo:7.0` image is the safe choice on Ubuntu 26.04.

```sh
docker run -d \
  --name relay-mongo \
  --restart unless-stopped \
  -p 127.0.0.1:27017:27017 \
  -v relay-mongo-data:/data/db \
  mongo:7.0

sleep 5
docker exec relay-mongo mongosh --quiet --eval 'db.adminCommand({ping:1})'
# → { ok: 1 }
```

> **Why `mongo:7.0` and not 8.x?** MongoDB 8.0 through 8.0.30 refuse to start
> on Linux kernels 6.19–7.0.13 ([SERVER‑121912](https://jira.mongodb.org/browse/SERVER-121912)).
> Ubuntu 26.04 ships a kernel in that range. MongoDB 7.0.x has no such guard and
> is fully compatible with this application.

**Alternative: native package** (Ubuntu 22.04 / 24.04 only — no Ubuntu 26 repo yet):

```sh
CODENAME=$(lsb_release -cs)          # jammy | noble
curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc \
  | gpg --dearmor -o /usr/share/keyrings/mongodb-server-7.0.gpg
echo "deb [ signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] \
https://repo.mongodb.org/apt/ubuntu ${CODENAME}/mongodb-org/7.0 multiverse" \
  > /etc/apt/sources.list.d/mongodb-org-7.0.list
apt-get update
apt-get install -y mongodb-org
systemctl enable --now mongod
mongosh --quiet --eval 'db.adminCommand({ping:1})'
```

**Reusing an existing MongoDB** — skip this step and note its URI for step 9.

### 7. Redis

**Recommended: Docker.**

```sh
docker run -d \
  --name relay-redis \
  --restart unless-stopped \
  -p 127.0.0.1:6379:6379 \
  -v relay-redis-data:/data \
  redis:7-alpine \
  redis-server --appendonly yes

sleep 3
docker exec relay-redis redis-cli ping
# → PONG
```

**Alternative: native package.**

```sh
apt-get install -y redis-server
systemctl enable --now redis-server
redis-cli ping
```

**Reusing an existing Redis** — skip this step and note its URL for step 9.

### 8. Clone the repository

```sh
git clone https://github.com/mehrzad7394/telegram-msg-forwarder-bot.git /opt/relay-console
cd /opt/relay-console
cp server/.env.example        server/.env
cp client/.env.local.example  client/.env.local
```

### 9. Configure the environment

Edit **`/opt/relay-console/server/.env`** and set at minimum:

| Key | Example |
|---|---|
| `MONGO_URI` | `mongodb://127.0.0.1:27017/relay-console` |
| `REDIS_URL` (or `REDIS_HOST` + `REDIS_PORT`) | `redis://127.0.0.1:6379` |
| `BOT_TOKEN` | the token from @BotFather |
| `JWT_SECRET` | 32+ random chars (`openssl rand -hex 32`) |
| `ADMIN_TELEGRAM_ID` | your numeric Telegram user ID |
| `ADMIN_INITIAL_PASSWORD` (or `ADMIN_PASSWORD`) | ≥ 8 characters |

Key names must match what the project reads — check `server/.env.example` for the
exact spellings.

Edit **`/opt/relay-console/client/.env.local`**:

| Key | Example |
|---|---|
| `SITE_URL` | `http://<server-ip>:3000` (or `https://panel.example.com` with Nginx) |
| `BACKEND_API_URL` | `http://127.0.0.1:3001/api` |

`SITE_URL` is baked into the build. Changing it later requires a client rebuild
(see *Changing the Public URL* below).

### 10. Install dependencies

```sh
cd /opt/relay-console
export NODE_OPTIONS="--max-old-space-size=1536"
pnpm install --frozen-lockfile \
     --child-concurrency=1 --network-concurrency=1
```

The concurrency flags prevent OOM on 1 GB servers. If the lockfile is out of
date, run without `--frozen-lockfile`.

### 11. Build the shared package

```sh
pnpm --filter @repo/shared build
```

`shared/` must be built first — `server/` and `client/` import from its `dist/`.

### 12. Create the initial administrator

```sh
pnpm --filter server setup-admin
```

Expected: `Admin user created: admin`. Uses `ADMIN_TELEGRAM_ID` and the admin
password from `server/.env`.

If you see `ECONNREFUSED 127.0.0.1:27017`, MongoDB isn't running — go back to
step 6.

### 13. Build all workspaces

```sh
pnpm build
```

### 14. Start under PM2

```sh
npm install -g pm2

cat > /opt/relay-console/ecosystem.config.js <<'EOF'
module.exports = {
  apps: [
    {
      name: 'relay-server',
      cwd: '/opt/relay-console/server',
      script: 'dist/main.js',
      env: { NODE_ENV: 'production', PORT: 3001 },
      max_restarts: 20,
      restart_delay: 3000,
    },
    {
      name: 'relay-client',
      cwd: '/opt/relay-console/client',
      script: 'node_modules/next/dist/bin/next',
      args: 'start -H 0.0.0.0 -p 3000',
      env: { NODE_ENV: 'production' },
      max_restarts: 20,
      restart_delay: 3000,
    },
  ],
};
EOF

cd /opt/relay-console
pm2 start ecosystem.config.js
pm2 save
pm2 startup systemd -u root --hp /root     # once; skip if already configured
```

If NestJS emits to `dist/src/main.js` instead of `dist/main.js`, adjust the
`script` field. Confirm with `find server/dist -name main.js`.

### 15. Open the firewall

Host firewall (if `ufw` is active):

```sh
ufw allow 3000/tcp
```

Cloud provider firewall — add **inbound TCP 3000** (or your chosen port) in the
provider's web console. Without this, the panel won't be reachable from outside
even though it runs.

### 16. Verify

```sh
curl -s -o /dev/null -w "backend  : %{http_code}\n" http://127.0.0.1:3001/api/health
curl -s -o /dev/null -w "frontend : %{http_code}\n" http://127.0.0.1:3000/login
```

Both should return `200`. Open `http://<server-ip>:3000/login` and log in as
**admin** with the password from step 9.

---

## Running Alongside Other Apps

Before installing on a shared server, verify the resources this project needs.

### Ports

| Port | Used by | Configurable? |
|---|---|---|
| **3000** | Next.js frontend (public) | Yes — `--port` flag or the prompt |
| **3001** | NestJS backend (localhost only) | Yes — edit `PORT` in `server/.env` and `ecosystem.config.js` |
| **27017** | MongoDB container (localhost only) | Fixed at `127.0.0.1:27017` |
| **6379** | Redis container (localhost only) | Fixed at `127.0.0.1:6379` |

Check first:

```sh
sudo ss -ltnp | grep -E ':3000|:3001|:27017|:6379'
```

If a port is already bound:

- **3000 in use** → pass `--port 3005` (or any free port) to the installer, or
  answer the prompt differently.
- **3001 in use** → change `PORT` in `server/.env` and `ecosystem.config.js`,
  update `BACKEND_API_URL` in `client/.env.local`, rebuild the client, and
  `pm2 restart all`.
- **27017 or 6379 in use** → the server already runs MongoDB/Redis. Skip the
  Docker containers and reuse the existing services (see *Reusing an Existing
  MongoDB or Redis* below).

### PM2 process names

The installer registers exactly two PM2 apps: `relay-server` and `relay-client`.
Before starting them it runs `pm2 delete all`, which removes **every** PM2
process owned by the current user — including other apps.

If the server already uses PM2:

- use a dedicated server, **or**
- comment out the `pm2 delete all` line in `install.sh`, **or**
- rename existing apps first (`pm2 delete <old>`), install, then recreate them
  (`pm2 start … --name <old>`) afterwards.

### Docker containers and volumes

Names are namespaced:

```sh
docker ps -a --format '{{.Names}}' | grep -E '^relay-'
docker volume ls | grep relay-
```

The installer replaces a container only if its image differs from the expected
one (`mongo:7.0` / `redis:7-alpine`). It will not touch other containers or
volumes.

### Swap

Swap is created **only** if there is no swap on the system and RAM < 2 GB. On
servers that already have swap, the installer leaves it alone. To skip swap
creation entirely, comment out the block starting
`# ────────── swap (low-memory servers) ──────────` in `install.sh`.

---

## Reusing an Existing MongoDB or Redis

**Option A — run the installer, then remove its containers.** Answer the URI
prompts with the existing service addresses:

```text
MongoDB URI:  mongodb://user:pass@127.0.0.1:27017/relay-console?authSource=admin
Redis URL:    redis://:password@127.0.0.1:6379/2
```

Then clean up:

```sh
docker rm -f relay-mongo relay-redis
docker volume rm relay-mongo-data relay-redis-data
```

**Option B — skip the Docker containers entirely.** Comment out the two lines
`ensure_mongo` and `ensure_redis` in `install.sh` before running, and provide
the URIs at the prompts.

---

## Reinstalling / Updating

**Update code + rebuild, keep everything else** (no `--fresh`):

```sh
curl -fsSL -o /tmp/relay-install.sh \
  https://raw.githubusercontent.com/mehrzad7394/telegram-msg-forwarder-bot/main/install.sh \
  && sudo bash /tmp/relay-install.sh \
       --repo https://github.com/mehrzad7394/telegram-msg-forwarder-bot.git
```

`.env` files, containers, and data volumes are preserved.

**Wipe code and env files, keep databases:**

```sh
sudo bash /tmp/relay-install.sh --repo <url> --fresh
```

**Wipe everything, including databases (destructive):**

```sh
sudo bash /tmp/relay-install.sh --repo <url> --fresh --wipe-data
```

For the manual install, updating means:

```sh
cd /opt/relay-console
git fetch --all --prune
git reset --hard origin/main

export NODE_OPTIONS="--max-old-space-size=1536"
pnpm install --frozen-lockfile --child-concurrency=1 --network-concurrency=1
pnpm --filter @repo/shared build
pnpm build
pm2 restart all
```

`server/.env` and `client/.env.local` are git‑ignored and survive the reset.

---

## Changing the Public URL or Port After Install

1. Edit `client/.env.local` — update `SITE_URL`.
2. If the frontend port changes, edit `ecosystem.config.js`
   (`args: 'start -H 0.0.0.0 -p <newport>'`) and the backend `PORT` in
   `server/.env`.
3. Rebuild the client (`SITE_URL` is baked into the build):
   ```sh
   cd /opt/relay-console
   pnpm --filter client build
   pm2 restart all
   ```
4. Open the new port in your cloud firewall.

---

## Optional: Nginx + HTTPS

Only needed for a domain, port 80/443, or HTTPS. Skip for direct IP:port access.

```sh
apt-get install -y nginx

cat > /etc/nginx/sites-available/relay-console <<'EOF'
server {
    listen 80;
    server_name panel.example.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
EOF

ln -sf /etc/nginx/sites-available/relay-console /etc/nginx/sites-enabled/relay-console
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx
```

For HTTPS:

```sh
apt-get install -y certbot python3-certbot-nginx
certbot --nginx -d panel.example.com
```

**After enabling HTTPS**, update `SITE_URL` and rebuild the client:

```sh
cd /opt/relay-console
sed -i 's|^SITE_URL=.*|SITE_URL=https://panel.example.com|' client/.env.local
pnpm --filter client build
pm2 restart relay-client
```

Finally, **close port 3000** in your cloud firewall so the panel can only be
reached through Nginx (80/443).

---

## Useful Commands

```sh
# App
pm2 status
pm2 logs relay-server
pm2 logs relay-client
pm2 restart all

# Containers
docker ps
docker logs relay-mongo
docker logs relay-redis
docker exec -it relay-mongo mongosh relay-console
docker exec -it relay-redis redis-cli

# Environment
cat /opt/relay-console/server/.env
cat /opt/relay-console/client/.env.local
```

---

## Troubleshooting

| Symptom | Check |
|---|---|
| `pnpm install` is `Killed` | Out of RAM. `swapon --show`. Re‑run `install.sh` — it auto‑creates swap if missing. |
| `ECONNREFUSED 127.0.0.1:27017` | `docker ps` — is `relay-mongo` `Up`? `docker logs relay-mongo`. |
| `ECONNREFUSED 127.0.0.1:6379` | `docker ps` — is `relay-redis` `Up`? `docker logs relay-redis`. |
| Backend restarts forever | `pm2 logs relay-server --lines 80`. Usually a wrong `.env` value. |
| Login says "invalid credentials" | `docker exec -it relay-mongo mongosh relay-console --eval 'db.users.countDocuments()'` should be ≥ 1. If 0, re‑run `pnpm --filter server setup-admin`. |
| Browser can't reach `http://IP:PORT` | Cloud provider firewall rule for `TCP <PORT>`. `sudo ufw status verbose`. `sudo ss -ltnp \| grep <PORT>`. |
| MongoDB container exits immediately on Ubuntu 26 | Confirm image tag: `docker inspect relay-mongo --format '{{.Config.Image}}'` should print `mongo:7.0`. If it's `mongo:8.*`, replace it: `docker rm -f relay-mongo && docker run -d --name relay-mongo --restart unless-stopped -p 127.0.0.1:27017:27017 -v relay-mongo-data:/data/db mongo:7.0`. |
| Installer says "Port 3000 already in use" | Something else owns the port. Re‑run with `--port 3005` (or any free port). |
| `setup-admin` fails with "Admin user already exists" | The admin was created in a previous run. It's fine — log in with the existing credentials. |