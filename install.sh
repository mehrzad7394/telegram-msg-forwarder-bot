#!/usr/bin/env bash
# Relay Console – Ubuntu auto-install (IP:port mode)
# Usage: sudo bash install.sh [--repo <git-url>] [--dir <install-dir>] [--port <frontend-port>]
set -euo pipefail

# ────────── styling ──────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; BOLD='\033[1m'; NC='\033[0m'
log()  { echo -e "${GREEN}[+]${NC} $*"; }
warn() { echo -e "${YELLOW}[!]${NC} $*"; }
err()  { echo -e "${RED}[x]${NC} $*" >&2; }
info() { echo -e "${BLUE}[*]${NC} $*"; }
die()  { err "$*"; exit 1; }

# ────────── prompt helpers ──────────
ask() {
  local prompt="$1" default="${2:-}" answer
  if [[ -n "$default" ]]; then
    read -rp "$prompt [$default]: " answer
    printf '%s' "${answer:-$default}"
  else
    read -rp "$prompt: " answer
    printf '%s' "$answer"
  fi
}
ask_secret() {
  local prompt="$1" answer
  read -rsp "$prompt: " answer
  echo >&2
  printf '%s' "$answer"
}
confirm() {
  local prompt="$1" answer
  read -rp "$prompt (y/N): " answer
  [[ "$answer" =~ ^[Yy] ]]
}

detect_public_ip() {
  local ip=""
  ip=$(curl -4 -fsSL --max-time 5 https://api.ipify.org 2>/dev/null || true)
  [[ -z "$ip" ]] && ip=$(curl -4 -fsSL --max-time 5 https://ifconfig.me 2>/dev/null || true)
  [[ -z "$ip" ]] && ip=$(hostname -I | awk '{print $1}')
  echo "${ip:-127.0.0.1}"
}

# ────────── root & args ──────────
[[ $EUID -eq 0 ]] || die "Run as root: sudo bash $0"

INSTALL_DIR="/opt/relay-console"
REPO_URL=""
CLIENT_PORT="3000"
BACKEND_PORT="3001"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --repo) REPO_URL="$2"; shift 2 ;;
    --dir)  INSTALL_DIR="$2"; shift 2 ;;
    --port) CLIENT_PORT="$2"; shift 2 ;;
    -h|--help) grep '^#' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) die "Unknown arg: $1" ;;
  esac
done

echo
echo -e "${BOLD}══════════════════════════════════════════${NC}"
echo -e "${BOLD}   Relay Console — Auto Installer${NC}"
echo -e "${BOLD}══════════════════════════════════════════${NC}"
echo

# ────────── OS detection ──────────
. /etc/os-release
[[ "${ID:-}" == "ubuntu" ]] || warn "Untested on ${PRETTY_NAME}. Continuing anyway."
log "OS: $PRETTY_NAME ($(uname -m))"

# ────────── repository ──────────
if [[ -z "$REPO_URL" ]]; then
  REPO_URL=$(ask "GitHub repository URL (https://github.com/user/repo.git)")
fi
[[ -n "$REPO_URL" ]] || die "Repository URL required"

# ────────── base packages ──────────
log "Installing base packages…"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq \
  curl wget git ca-certificates gnupg lsb-release \
  build-essential unzip jq openssl

# ────────── Node.js 22 ──────────
need_node=1
if command -v node >/dev/null; then
  cur=$(node -v | sed 's/^v//;s/\..*//')
  [[ "$cur" -ge 22 ]] && need_node=0
fi
if [[ $need_node -eq 1 ]]; then
  log "Installing Node.js 22…"
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y -qq nodejs
else
  log "Node.js $(node -v) already present"
fi

# ────────── pnpm 10 ──────────
log "Enabling corepack / pnpm 10…"
corepack enable
corepack prepare pnpm@10 --activate >/dev/null 2>&1 || \
  npm install -g pnpm@10 >/dev/null
pnpm -v >/dev/null || die "pnpm install failed"

# ────────── MongoDB 7.0 ──────────
if ! command -v mongod >/dev/null; then
  log "Installing MongoDB 7.0…"
  curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc \
    | gpg --dearmor -o /usr/share/keyrings/mongodb-server-7.0.gpg
  CODENAME=$(lsb_release -cs)
  echo "deb [ signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] \
https://repo.mongodb.org/apt/ubuntu ${CODENAME}/mongodb-org/7.0 multiverse" \
    > /etc/apt/sources.list.d/mongodb-org-7.0.list
  apt-get update -qq
  apt-get install -y -qq mongodb-org
fi
systemctl enable --now mongod
log "MongoDB active: $(systemctl is-active mongod)"

# ────────── Redis ──────────
if ! command -v redis-server >/dev/null; then
  log "Installing Redis…"
  apt-get install -y -qq redis-server
fi
systemctl enable --now redis-server
log "Redis active: $(systemctl is-active redis-server)"

# ────────── Clone repo ──────────
if [[ -d "$INSTALL_DIR/.git" ]]; then
  log "Updating existing checkout at $INSTALL_DIR…"
  git -C "$INSTALL_DIR" pull --ff-only
else
  log "Cloning $REPO_URL → $INSTALL_DIR"
  mkdir -p "$(dirname "$INSTALL_DIR")"
  git clone "$REPO_URL" "$INSTALL_DIR"
fi
cd "$INSTALL_DIR"
[[ -f server/.env.example ]]         || die "Missing server/.env.example in repo"
[[ -f client/.env.local.example ]]   || die "Missing client/.env.local.example in repo"
[[ -f package.json ]]                || die "Missing root package.json"

# ────────── env-key auto-detect ──────────
find_env_key() {
  local file="$1" regex="$2" fallback="$3" found
  [[ -f "$file" ]] || { echo "$fallback"; return; }
  found=$(grep -iE "^[A-Z0-9_]*${regex}[A-Z0-9_]*=" "$file" \
          | head -1 | cut -d= -f1) || true
  echo "${found:-$fallback}"
}

MONGO_KEY=$(find_env_key server/.env.example 'MONGO_URI'  'MONGO_URI')
REDIS_URL_KEY=$(find_env_key server/.env.example 'REDIS_URL' '')
REDIS_HOST_KEY=$(find_env_key server/.env.example 'REDIS_HOST' '')
REDIS_PORT_KEY=$(find_env_key server/.env.example 'REDIS_PORT' '')
BOT_KEY=$(find_env_key server/.env.example 'BOT_TOKEN'   'BOT_TOKEN')
JWT_KEY=$(find_env_key server/.env.example 'JWT_SECRET'  'JWT_SECRET')
ADMIN_ID_KEY=$(find_env_key server/.env.example 'ADMIN[A-Z0-9_]*ID'   'ADMIN_TELEGRAM_ID')
ADMIN_PASS_KEY=$(find_env_key server/.env.example 'ADMIN[A-Z0-9_]*PASS' 'ADMIN_PASSWORD')

# ────────── interactive config ──────────
echo
info "Network configuration"
SERVER_IP=$(detect_public_ip)
log "Detected public IP: $SERVER_IP"

CLIENT_PORT=$(ask "Frontend port (public)" "$CLIENT_PORT")
[[ "$CLIENT_PORT" =~ ^[0-9]+$ ]] && (( CLIENT_PORT >= 1 && CLIENT_PORT <= 65535 )) \
  || die "Invalid port: $CLIENT_PORT"

BACKEND_API_URL_DEFAULT="http://127.0.0.1:${BACKEND_PORT}/api"
SITE_URL_DEFAULT="http://${SERVER_IP}:${CLIENT_PORT}"

echo
info "Application environment"
MONGO_URI=$(ask "MongoDB URI" "mongodb://127.0.0.1:27017/relay-console")
REDIS_URL=$(ask "Redis URL" "redis://127.0.0.1:6379")
BOT_TOKEN=$(ask "Telegram bot token")
[[ -n "$BOT_TOKEN" ]] || die "Bot token is required"
JWT_SECRET=$(ask "JWT secret (blank = generate random)")
[[ -z "$JWT_SECRET" ]] && JWT_SECRET=$(openssl rand -hex 32) && log "Generated JWT secret"
ADMIN_TG_ID=$(ask "Initial admin Telegram user ID")
[[ "$ADMIN_TG_ID" =~ ^[0-9]+$ ]] || die "Admin Telegram ID must be numeric"
ADMIN_PASSWORD=$(ask_secret "Initial admin password (min 8 chars)")
[[ ${#ADMIN_PASSWORD} -ge 8 ]] || die "Admin password too short"
SITE_URL=$(ask "Public site URL (used for canonical/OG tags)" "$SITE_URL_DEFAULT")
BACKEND_API_URL=$(ask "Server-side backend API URL (localhost is correct)" "$BACKEND_API_URL_DEFAULT")

# ────────── write .env files ──────────
set_env() {
  local file="$1" key="$2" value="$3"
  [[ -f "$file" ]] || touch "$file"
  if grep -q "^${key}=" "$file"; then
    # use a safer sed delimiter and escape anything risky in the value
    local esc; esc=$(printf '%s' "$value" | sed -e 's/[\/&|]/\\&/g')
    sed -i "s|^${key}=.*|${key}=${esc}|" "$file"
  else
    echo "${key}=${value}" >> "$file"
  fi
}

cp -n server/.env.example server/.env 2>/dev/null || true
cp -n client/.env.local.example client/.env.local 2>/dev/null || true

set_env server/.env "$MONGO_KEY" "$MONGO_URI"
if [[ -n "$REDIS_URL_KEY" ]]; then
  set_env server/.env "$REDIS_URL_KEY" "$REDIS_URL"
elif [[ -n "$REDIS_HOST_KEY" ]]; then
  rh=$(echo "$REDIS_URL" | sed -E 's|redis://([^:/]+).*|\1|')
  rp=$(echo "$REDIS_URL" | sed -E 's|redis://[^:]+:([0-9]+).*|\1|')
  set_env server/.env "$REDIS_HOST_KEY" "$rh"
  set_env server/.env "${REDIS_PORT_KEY:-REDIS_PORT}" "${rp:-6379}"
fi
set_env server/.env "$BOT_KEY"        "$BOT_TOKEN"
set_env server/.env "$JWT_KEY"        "$JWT_SECRET"
set_env server/.env "$ADMIN_ID_KEY"   "$ADMIN_TG_ID"
set_env server/.env "$ADMIN_PASS_KEY" "$ADMIN_PASSWORD"

set_env client/.env.local "SITE_URL"         "$SITE_URL"
set_env client/.env.local "BACKEND_API_URL"  "$BACKEND_API_URL"

log "Env written:"
echo "    server/.env      → $MONGO_KEY / Redis / $BOT_KEY / $JWT_KEY / $ADMIN_ID_KEY / $ADMIN_PASS_KEY"
echo "    client/.env.local → SITE_URL=$SITE_URL"
echo "                        BACKEND_API_URL=$BACKEND_API_URL"

# ────────── install + build ──────────
log "pnpm install"
if ! pnpm install --frozen-lockfile; then
  warn "Frozen lockfile install failed — retrying without --frozen-lockfile"
  pnpm install
fi

log "Build @repo/shared"
pnpm --filter @repo/shared build

log "Setup admin"
if ! pnpm --filter server setup-admin; then
  warn "setup-admin exited non-zero. Re-run manually if needed:"
  warn "  cd $INSTALL_DIR && pnpm --filter server setup-admin"
fi

log "Build all"
pnpm build

# ────────── PM2 ──────────
if ! command -v pm2 >/dev/null; then
  log "Installing PM2"
  npm install -g pm2
fi

SERVER_ENTRY="dist/main.js"
[[ -f "server/$SERVER_ENTRY" ]] || SERVER_ENTRY="dist/src/main.js"
[[ -f "server/$SERVER_ENTRY" ]] || SERVER_ENTRY=$(cd server && find dist -type f -name main.js | head -1)

cat > ecosystem.config.js <<EOF
module.exports = {
  apps: [
    {
      name: 'relay-server',
      cwd: '${INSTALL_DIR}/server',
      script: '${SERVER_ENTRY}',
      env: { NODE_ENV: 'production', PORT: ${BACKEND_PORT} },
    },
    {
      name: 'relay-client',
      cwd: '${INSTALL_DIR}/client',
      script: 'node_modules/next/dist/bin/next',
      args: 'start -H 0.0.0.0 -p ${CLIENT_PORT}',
      env: { NODE_ENV: 'production' },
    },
  ],
};
EOF

pm2 delete all >/dev/null 2>&1 || true
pm2 start ecosystem.config.js
pm2 save
pm2 startup systemd -u root --hp /root | tail -1 | bash || warn "pm2 startup install failed (run 'pm2 startup' manually)"

# ────────── firewall ──────────
if command -v ufw >/dev/null 2>&1 && ufw status 2>/dev/null | grep -q "Status: active"; then
  log "Opening ufw port ${CLIENT_PORT}/tcp"
  ufw allow "${CLIENT_PORT}/tcp" >/dev/null 2>&1 || warn "Could not open ufw port"
fi
if command -v firewall-cmd >/dev/null 2>&1 && systemctl is-active --quiet firewalld; then
  log "Opening firewalld port ${CLIENT_PORT}/tcp"
  firewall-cmd --permanent --add-port="${CLIENT_PORT}/tcp" >/dev/null 2>&1 || true
  firewall-cmd --reload >/dev/null 2>&1 || true
fi

# ────────── optional Nginx (default NO) ──────────
echo
warn "Nginx is optional. Skip it if you want direct http://IP:PORT access."
if confirm "Configure Nginx reverse proxy (domain + port 80/443)?"; then
  DOMAIN=$(ask "Domain (e.g. panel.example.com)")
  command -v nginx >/dev/null || apt-get install -y -qq nginx

  cat > /etc/nginx/sites-available/relay-console <<NGINX
server {
    listen 80;
    server_name ${DOMAIN};
    client_max_body_size 20M;

    location / {
        proxy_pass http://127.0.0.1:${CLIENT_PORT};
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
NGINX

  ln -sf /etc/nginx/sites-available/relay-console /etc/nginx/sites-enabled/relay-console
  rm -f /etc/nginx/sites-enabled/default
  nginx -t && systemctl reload nginx
  log "Nginx configured for $DOMAIN"

  if confirm "Obtain Let's Encrypt certificate?"; then
    apt-get install -y -qq certbot python3-certbot-nginx
    certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos \
      -m "admin@$DOMAIN" || warn "Certbot failed – run manually later"
    warn "If you now serve via HTTPS, update client/.env.local SITE_URL, then:"
    warn "  cd $INSTALL_DIR && pnpm --filter client build && pm2 restart relay-client"
  fi
fi

# ────────── health check ──────────
echo
info "Waiting for services to come up…"
for i in {1..15}; do
  curl -sf "http://127.0.0.1:${BACKEND_PORT}/api/health" -o /dev/null && break
  sleep 1
done
if curl -sf "http://127.0.0.1:${BACKEND_PORT}/api/health" -o /dev/null; then
  log "Backend OK  (127.0.0.1:${BACKEND_PORT}/api/health)"
else
  warn "Backend health check failed — see: pm2 logs relay-server"
fi
if curl -sf "http://127.0.0.1:${CLIENT_PORT}/login" -o /dev/null; then
  log "Frontend OK (127.0.0.1:${CLIENT_PORT}/login)"
else
  warn "Frontend health check failed — see: pm2 logs relay-client"
fi

# ────────── final summary ──────────
echo
echo -e "${GREEN}════════════════ Installation complete ════════════════${NC}"
echo " Install dir   : $INSTALL_DIR"
echo " Frontend      : http://${SERVER_IP}:${CLIENT_PORT}/login"
echo " Persian login : http://${SERVER_IP}:${CLIENT_PORT}/fa/login"
echo " Swagger       : http://127.0.0.1:${BACKEND_PORT}/api/docs (localhost only by default)"
echo " Admin user    : admin"
echo " Admin pass    : (the one you entered)"
echo
echo " Manage:  pm2 status | pm2 logs relay-server | pm2 restart all"
echo " Env:     $INSTALL_DIR/server/.env  &  $INSTALL_DIR/client/.env.local"
echo
echo " If the URL above does not load from another machine, check:"
echo "   • Cloud provider firewall / security group allows TCP ${CLIENT_PORT}"
echo "   • Your router/NAT port-forward (if applicable)"
echo "   • 'ufw status' shows ${CLIENT_PORT}/tcp ALLOW"
echo -e "${GREEN}═════════════════════════════════════════════════════${NC}"