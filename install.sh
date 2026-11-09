#!/usr/bin/env bash
# Relay Console – Ubuntu auto-install (22.04 / 24.04 / 26.04+)
# MongoDB and Redis both run in Docker with persistent volumes.
#
# Usage:
#   sudo bash install.sh [--repo URL] [--dir DIR] [--port PORT]
#                        [--fresh] [--wipe-data]
#
#   --fresh       stop services, wipe /opt/relay-console, keep data volumes
#   --wipe-data   also delete the MongoDB and Redis data volumes (destructive)
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
FRESH=0
WIPE_DATA=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --repo)      REPO_URL="$2";    shift 2 ;;
    --dir)       INSTALL_DIR="$2"; shift 2 ;;
    --port)      CLIENT_PORT="$2"; shift 2 ;;
    --fresh)     FRESH=1; shift ;;
    --wipe-data) WIPE_DATA=1; shift ;;
    -h|--help)
      grep '^#' "$0" | sed 's/^# \{0,1\}//'
      exit 0 ;;
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
log "OS: $PRETTY_NAME ($(uname -m))"
[[ "${ID:-}" == "ubuntu" ]] || warn "Tuned for Ubuntu; continuing on ${PRETTY_NAME}."

# ────────── fresh mode ──────────
if [[ $FRESH -eq 1 ]]; then
  warn "Fresh mode: stopping services and wiping previous install"
  pm2 delete all >/dev/null 2>&1 || true
  pm2 kill       >/dev/null 2>&1 || true
  rm -rf "$INSTALL_DIR"
  if [[ $WIPE_DATA -eq 1 ]]; then
    warn "Also wiping MongoDB and Redis data volumes (destructive)"
    docker rm -f relay-mongo relay-redis >/dev/null 2>&1 || true
    docker volume rm relay-mongo-data relay-redis-data >/dev/null 2>&1 || true
  else
    docker stop relay-mongo relay-redis >/dev/null 2>&1 || true
  fi
fi

# ────────── repository URL ──────────
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
  cur_major=$(node -v | sed 's/^v//' | cut -d. -f1)
  [[ "$cur_major" -ge 22 ]] && { need_node=0; log "Node.js $(node -v) already present"; }
fi
if [[ $need_node -eq 1 ]]; then
  log "Installing Node.js 22…"
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y -qq nodejs
fi

# ────────── pnpm 10 ──────────
log "Enabling corepack / pnpm 10…"
corepack enable
corepack prepare pnpm@10 --activate >/dev/null 2>&1 || \
  npm install -g pnpm@10 >/dev/null
pnpm -v >/dev/null || die "pnpm install failed"

# ────────── Docker ──────────
if ! command -v docker >/dev/null; then
  log "Installing Docker…"
  apt-get install -y -qq docker.io
fi
systemctl enable --now docker >/dev/null
docker info >/dev/null 2>&1 || die "Docker daemon not reachable"

# ────────── clean up leftover native MongoDB / Redis ──────────
if dpkg -l 2>/dev/null | grep -qE '^ii\s+mongodb-org' || \
   compgen -G "/etc/apt/sources.list.d/mongodb-org-*.list" >/dev/null; then
  warn "Removing leftover native MongoDB install from earlier runs"
  systemctl disable --now mongod 2>/dev/null || true
  apt-get purge -y -qq \
    mongodb-org mongodb-org-* mongodb-org-server mongodb-org-mongos \
    mongodb-org-shell mongodb-org-tools mongodb-org-database \
    mongodb-org-database-tools-extra 2>/dev/null || true
  rm -f /etc/apt/sources.list.d/mongodb-org-*.list
fi
if dpkg -l 2>/dev/null | grep -qE '^ii\s+redis-server'; then
  warn "Removing leftover native Redis install from earlier runs"
  systemctl disable --now redis-server 2>/dev/null || true
  apt-get purge -y -qq redis-server redis-tools 2>/dev/null || true
fi

# Free ports 27017 / 6379 in case anything else is listening
if ss -ltn '( sport = :27017 )' 2>/dev/null | grep -q 27017; then
  warn "Port 27017 already in use by a non-Docker process — investigate if MongoDB fails to start"
fi
if ss -ltn '( sport = :6379 )' 2>/dev/null | grep -q 6379; then
  warn "Port 6379 already in use by a non-Docker process — investigate if Redis fails to start"
fi

# ────────── MongoDB via Docker (7.0 — kernel-7.x safe) ──────────
MONGO_IMAGE="mongo:7.0"
MONGO_CONTAINER="relay-mongo"
MONGO_VOLUME="relay-mongo-data"

ensure_mongo() {
  if docker ps -a --format '{{.Names}}' | grep -qx "$MONGO_CONTAINER"; then
    local current
    current=$(docker inspect --format='{{.Config.Image}}' "$MONGO_CONTAINER" 2>/dev/null || echo "")
    if [[ "$current" != "$MONGO_IMAGE" ]]; then
      log "Replacing MongoDB container (${current:-unknown} → $MONGO_IMAGE)"
      docker rm -f "$MONGO_CONTAINER" >/dev/null 2>&1 || true
    fi
  fi

  if ! docker ps --format '{{.Names}}' | grep -qx "$MONGO_CONTAINER"; then
    log "Starting MongoDB ($MONGO_IMAGE) in Docker…"
    docker run -d \
      --name "$MONGO_CONTAINER" \
      --restart unless-stopped \
      -p 127.0.0.1:27017:27017 \
      -v "${MONGO_VOLUME}:/data/db" \
      "$MONGO_IMAGE" >/dev/null
  else
    log "MongoDB container already running"
  fi

  log "Waiting for MongoDB to accept connections…"
  for _ in {1..30}; do
    docker exec "$MONGO_CONTAINER" mongosh --quiet --eval 'db.adminCommand({ping:1})' >/dev/null 2>&1 && {
      log "MongoDB ready on 127.0.0.1:27017"
      return 0
    }
    sleep 1
  done

  err "MongoDB did not become ready in 30s. Last 40 log lines:"
  docker logs --tail 40 "$MONGO_CONTAINER" >&2 || true
  die "MongoDB failed to start."
}

# ────────── Redis via Docker ──────────
REDIS_IMAGE="redis:7-alpine"
REDIS_CONTAINER="relay-redis"
REDIS_VOLUME="relay-redis-data"

ensure_redis() {
  if docker ps -a --format '{{.Names}}' | grep -qx "$REDIS_CONTAINER"; then
    local current
    current=$(docker inspect --format='{{.Config.Image}}' "$REDIS_CONTAINER" 2>/dev/null || echo "")
    if [[ "$current" != "$REDIS_IMAGE" ]]; then
      log "Replacing Redis container (${current:-unknown} → $REDIS_IMAGE)"
      docker rm -f "$REDIS_CONTAINER" >/dev/null 2>&1 || true
    fi
  fi

  if ! docker ps --format '{{.Names}}' | grep -qx "$REDIS_CONTAINER"; then
    log "Starting Redis ($REDIS_IMAGE) in Docker…"
    docker run -d \
      --name "$REDIS_CONTAINER" \
      --restart unless-stopped \
      -p 127.0.0.1:6379:6379 \
      -v "${REDIS_VOLUME}:/data" \
      "$REDIS_IMAGE" \
      redis-server --appendonly yes >/dev/null
  else
    log "Redis container already running"
  fi

  log "Waiting for Redis to answer PING…"
  for _ in {1..20}; do
    docker exec "$REDIS_CONTAINER" redis-cli ping 2>/dev/null | grep -q PONG && {
      log "Redis ready on 127.0.0.1:6379"
      return 0
    }
    sleep 1
  done

  err "Redis did not respond in 20s. Last 40 log lines:"
  docker logs --tail 40 "$REDIS_CONTAINER" >&2 || true
  die "Redis failed to start."
}

ensure_mongo
ensure_redis

# ────────── Clone repo ──────────
if [[ -d "$INSTALL_DIR/.git" ]]; then
  log "Updating existing checkout at $INSTALL_DIR…"
  git -C "$INSTALL_DIR" fetch --all --prune
  git -C "$INSTALL_DIR" reset --hard "@{upstream}" 2>/dev/null || \
    git -C "$INSTALL_DIR" pull --ff-only
else
  log "Cloning $REPO_URL → $INSTALL_DIR"
  mkdir -p "$(dirname "$INSTALL_DIR")"
  git clone "$REPO_URL" "$INSTALL_DIR"
fi
cd "$INSTALL_DIR"

[[ -f server/.env.example ]]       || die "Missing server/.env.example in repo"
[[ -f client/.env.local.example ]] || die "Missing client/.env.local.example in repo"
[[ -f package.json ]]              || die "Missing root package.json"

# ────────── env-key auto-detect ──────────
find_env_key() {
  local file="$1" regex="$2" fallback="$3" found
  [[ -f "$file" ]] || { echo "$fallback"; return; }
  found=$(grep -iE "^[A-Z0-9_]*${regex}[A-Z0-9_]*=" "$file" \
          | head -1 | cut -d= -f1) || true
  echo "${found:-$fallback}"
}

MONGO_KEY=$(find_env_key server/.env.example 'MONGO_URI'        'MONGO_URI')
REDIS_URL_KEY=$(find_env_key server/.env.example 'REDIS_URL'    '')
REDIS_HOST_KEY=$(find_env_key server/.env.example 'REDIS_HOST'  '')
REDIS_PORT_KEY=$(find_env_key server/.env.example 'REDIS_PORT'  '')
BOT_KEY=$(find_env_key server/.env.example 'BOT_TOKEN'          'BOT_TOKEN')
JWT_KEY=$(find_env_key server/.env.example 'JWT_SECRET'         'JWT_SECRET')
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

SITE_URL_DEFAULT="http://${SERVER_IP}:${CLIENT_PORT}"
BACKEND_API_URL_DEFAULT="http://127.0.0.1:${BACKEND_PORT}/api"

echo
info "Application environment"
MONGO_URI=$(ask "MongoDB URI" "mongodb://127.0.0.1:27017/relay-console")
REDIS_URL=$(ask "Redis URL"   "redis://127.0.0.1:6379")
BOT_TOKEN=$(ask "Telegram bot token")
[[ -n "$BOT_TOKEN" ]] || die "Bot token is required"
JWT_SECRET=$(ask "JWT secret (blank = generate random)")
if [[ -z "$JWT_SECRET" ]]; then
  JWT_SECRET=$(openssl rand -hex 32)
  log "Generated JWT secret"
fi
ADMIN_TG_ID=$(ask "Initial admin Telegram user ID")
[[ "$ADMIN_TG_ID" =~ ^[0-9]+$ ]] || die "Admin Telegram ID must be numeric"
ADMIN_PASSWORD=$(ask_secret "Initial admin password (min 8 chars)")
[[ ${#ADMIN_PASSWORD} -ge 8 ]] || die "Admin password too short"
SITE_URL=$(ask "Public site URL (canonical / OG tags)" "$SITE_URL_DEFAULT")
BACKEND_API_URL=$(ask "Server-side backend API URL (localhost is correct)" "$BACKEND_API_URL_DEFAULT")

# ────────── write .env files ──────────
set_env() {
  local file="$1" key="$2" value="$3"
  [[ -f "$file" ]] || touch "$file"
  if grep -q "^${key}=" "$file"; then
    local esc; esc=$(printf '%s' "$value" | sed -e 's/[\/&|]/\\&/g')
    sed -i "s|^${key}=.*|${key}=${esc}|" "$file"
  else
    echo "${key}=${value}" >> "$file"
  fi
}

cp -n server/.env.example        server/.env        2>/dev/null || true
cp -n client/.env.local.example  client/.env.local  2>/dev/null || true

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

set_env client/.env.local "SITE_URL"        "$SITE_URL"
set_env client/.env.local "BACKEND_API_URL" "$BACKEND_API_URL"

log "Env written:"
echo "    server/.env        → $MONGO_KEY, Redis, $BOT_KEY, $JWT_KEY, $ADMIN_ID_KEY, $ADMIN_PASS_KEY"
echo "    client/.env.local  → SITE_URL=$SITE_URL"
echo "                         BACKEND_API_URL=$BACKEND_API_URL"

# ────────── install + build ──────────
log "pnpm install"
if ! pnpm install --frozen-lockfile; then
  warn "Frozen lockfile failed — retrying without --frozen-lockfile"
  pnpm install
fi

log "Build @repo/shared"
pnpm --filter @repo/shared build

log "Setup admin (requires MongoDB — confirmed running above)"
pnpm --filter server setup-admin \
  || die "setup-admin failed. Check server/.env and 'docker logs relay-mongo'."

log "Build all"
pnpm build

# ────────── PM2 ──────────
if ! command -v pm2 >/dev/null; then
  log "Installing PM2"
  npm install -g pm2 >/dev/null
fi

SERVER_ENTRY="dist/main.js"
[[ -f "server/$SERVER_ENTRY" ]] || SERVER_ENTRY="dist/src/main.js"
[[ -f "server/$SERVER_ENTRY" ]] || SERVER_ENTRY=$(cd server && find dist -type f -name main.js | head -1)
[[ -n "$SERVER_ENTRY" && -f "server/$SERVER_ENTRY" ]] \
  || die "Cannot find NestJS entrypoint under server/dist/"

cat > ecosystem.config.js <<EOF
module.exports = {
  apps: [
    {
      name: 'relay-server',
      cwd: '${INSTALL_DIR}/server',
      script: '${SERVER_ENTRY}',
      env: { NODE_ENV: 'production', PORT: ${BACKEND_PORT} },
      max_restarts: 20,
      restart_delay: 3000,
    },
    {
      name: 'relay-client',
      cwd: '${INSTALL_DIR}/client',
      script: 'node_modules/next/dist/bin/next',
      args: 'start -H 0.0.0.0 -p ${CLIENT_PORT}',
      env: { NODE_ENV: 'production' },
      max_restarts: 20,
      restart_delay: 3000,
    },
  ],
};
EOF

pm2 delete all >/dev/null 2>&1 || true
pm2 start ecosystem.config.js >/dev/null
pm2 save       >/dev/null
pm2 startup systemd -u root --hp /root | tail -1 | bash >/dev/null 2>&1 || \
  warn "pm2 startup failed — run 'pm2 startup' manually to enable boot autostart"

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

# ────────── health check ──────────
echo
info "Waiting for services to come up…"
backend_ok=0; frontend_ok=0
for _ in {1..20}; do
  curl -sf "http://127.0.0.1:${BACKEND_PORT}/api/health" -o /dev/null && { backend_ok=1; break; }
  sleep 1
done
for _ in {1..20}; do
  curl -sf "http://127.0.0.1:${CLIENT_PORT}/login" -o /dev/null && { frontend_ok=1; break; }
  sleep 1
done

if [[ $backend_ok -eq 1 ]];  then log "Backend  OK  (127.0.0.1:${BACKEND_PORT}/api/health)"; else
  err "Backend health check failed — run: pm2 logs relay-server --lines 80"; fi
if [[ $frontend_ok -eq 1 ]]; then log "Frontend OK  (127.0.0.1:${CLIENT_PORT}/login)"; else
  err "Frontend health check failed — run: pm2 logs relay-client --lines 80"; fi

# ────────── final summary ──────────
echo
echo -e "${GREEN}════════════════ Installation complete ════════════════${NC}"
echo " Install dir   : $INSTALL_DIR"
echo " Frontend      : http://${SERVER_IP}:${CLIENT_PORT}/login"
echo " Persian login : http://${SERVER_IP}:${CLIENT_PORT}/fa/login"
echo " Admin user    : admin"
echo " Admin pass    : (the one you entered)"
echo
echo " Containers:"
echo "   relay-mongo   ${MONGO_IMAGE}     volume: ${MONGO_VOLUME}   → 127.0.0.1:27017"
echo "   relay-redis   ${REDIS_IMAGE}     volume: ${REDIS_VOLUME}   → 127.0.0.1:6379"
echo
echo " Manage:"
echo "   pm2 status"
echo "   pm2 logs relay-server"
echo "   pm2 restart all"
echo "   docker ps"
echo "   docker logs relay-mongo / relay-redis"
echo
echo " DB shells:"
echo "   docker exec -it relay-mongo mongosh relay-console"
echo "   docker exec -it relay-redis redis-cli"
echo
echo " Env files:"
echo "   $INSTALL_DIR/server/.env"
echo "   $INSTALL_DIR/client/.env.local"
echo
echo " If the URL above does not load from another machine:"
echo "   • Add inbound TCP ${CLIENT_PORT} in your cloud provider's firewall"
echo "   • Check 'ufw status verbose' shows ${CLIENT_PORT}/tcp ALLOW"
echo -e "${GREEN}═════════════════════════════════════════════════════${NC}"

if [[ $backend_ok -ne 1 || $frontend_ok -ne 1 ]]; then
  exit 1
fi