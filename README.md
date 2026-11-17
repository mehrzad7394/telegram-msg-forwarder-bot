# Relay Console

**A self-hosted Telegram message relay with an admin panel.**

Relay Console listens to Telegram source channels (or direct messages to a bot),
cleans and rewrites each post with configurable filters, queues it in Redis, and
publishes the result to a single destination channel. Everything is managed from
a bilingual (English / Persian) web console — no code changes, no redeploys.

<p>
  <img alt="Next.js" src="https://img.shields.io/badge/Next.js-15-black?logo=next.js">
  <img alt="NestJS" src="https://img.shields.io/badge/NestJS-11-e0234e?logo=nestjs">
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-5-3178c6?logo=typescript&logoColor=white">
  <img alt="MongoDB" src="https://img.shields.io/badge/MongoDB-7-47a248?logo=mongodb&logoColor=white">
  <img alt="Redis" src="https://img.shields.io/badge/Redis-7-dc382d?logo=redis&logoColor=white">
  <img alt="Docker" src="https://img.shields.io/badge/Docker-ready-2496ed?logo=docker&logoColor=white">
</p>

---

## Table of contents

- [What it does](#what-it-does)
- [Features](#features)
- [How a message flows](#how-a-message-flows)
- [Architecture](#architecture)
- [Repository layout](#repository-layout)
- [Local development](#local-development)
- [First-run walkthrough](#first-run-walkthrough)
- [Filter actions](#filter-actions)
- [Global settings](#global-settings)
- [Environment variables](#environment-variables)
- [HTTP API](#http-api)
- [Production install](#production-install)
- [Running alongside other apps](#running-alongside-other-apps)
- [Backup and restore filters](#backup-and-restore-filters)
- [Reusing an existing MongoDB or Redis](#reusing-an-existing-mongodb-or-redis)
- [Reinstalling and updating](#reinstalling-and-updating)
- [Changing the public URL or port](#changing-the-public-url-or-port)
- [Optional Nginx and HTTPS](#optional-nginx-and-https)
- [Useful commands](#useful-commands)
- [Troubleshooting](#troubleshooting)
- [Security notes](#security-notes)
- [Documentation for contributors and AI agents](#documentation-for-contributors-and-ai-agents)

---

## What it does

You run a Telegram channel and want to republish content from other channels
(or from messages people send to a bot) with your own rules applied. Relay
Console gives you:

1. **Ingestion** — a Telegram bot (`Telegraf`) receives text messages, and an
   optional user-client listener (`teleproto`, MTProto) watches the Telegram
   channels that account has joined.
2. **Transformation** — every incoming text is passed through enabled filters
   and global rules (strip links, strip mentions, remove/replace words or lines,
   regex rewrites, prepend/append text, or drop the message entirely).
3. **Delivery** — the result is written to MongoDB as a queue record and pushed
   to a Bull/Redis queue. A worker sends it to the single active destination
   channel, with retries and Telegram rate-limit back-off.
4. **Administration** — a Next.js panel manages destination channels, source
   channels, filters, users, the queue, and the listening schedule.

The panel is admin-only, English + Persian, and never speaks to the browser
directly: the Next.js server holds the JWT in an HttpOnly cookie and proxies
requests to a private NestJS API.

## Features

- **One active destination at a time** — selecting a destination automatically
  deactivates the others (enforced by a partial unique Mongo index).
- **Many source channels** — enable/disable individually or all at once.
- **Bot-based ingestion** — any authorized user can send text to the bot; admins
  can register a destination channel by forwarding a post from it.
- **Telethon-style channel listening** — optional MTProto user client listens to
  joined channels, filtered by an active-source list and a daily time window.
- **Eight filter actions** — remove/replace words or lines, regex replace,
  prepend/append text, ignore message.
- **Global cleanup rules** — drop lines containing URLs or @mentions.
- **Scheduled listening** — start/end time in one of 20 IANA time zones,
  including windows that cross midnight.
- **Durable queue** — messages survive restarts (Redis AOF), retry 3× with
  back-off, and honour Telegram's `retry_after` on HTTP 429.
- **Full audit trail** — original and processed text, sender, status, timestamps,
  and delivery errors are stored in MongoDB and visible in the panel.
- **Bilingual UI** — English (default) and Persian (`/fa`), RTL-aware, with
  per-page metadata, canonical URLs, and OG/Twitter cards.
- **Hardened defaults** — HttpOnly/SameSite cookie, `noindex` headers, backend
  bound to localhost, security headers, Zod + class-validator on both ends.

## How a message flows

```text
  Telegram channel  ──┐
  (source channels)   │  MTProto user client (teleproto)
                      │  · active-source allow-list
                      │  · listening time window
                      ▼
                 ┌───────────────────────────────┐
  Telegram bot ─ │  NestJS  relay-server :3001   │
  (direct text)  │                               │
                 │  1. active-user check         │
                 │  2. MessageProcessor:         │
                 │     ignore? → drop            │
                 │     global URL/mention strip  │
                 │     apply active filters      │
                 │  3. persist + enqueue         │
                 └───────────────┬───────────────┘
                                 │ Mongo insert + Bull job
                                 ▼
                 ┌───────────────────────────────┐
                 │  Bull queue  "messageQueue"   │
                 │  delay 2s · 3 attempts · 5s   │
                 └───────────────┬───────────────┘
                                 │ QueueProcessor
                                 ▼
                 ┌───────────────────────────────┐
                 │ TelegramService.sendToChannel │──▶ destination channel
                 │ 429 → Redis cooldown key      │    (single active channel)
                 └───────────────────────────────┘
```

A message is dropped (not queued) when: the sender is unknown or inactive (bot
path), the source channel is not active or the current time is outside the
listening window (listener path), an `IGNORE_MESSAGE` filter matches, or there
is no text to forward.

> **Text only.** Media captions are not forwarded. Channel posts with only
> media are skipped; bot messages must contain text.

## Architecture

```text
                    ┌──────────────────────────────────────┐
   Browser ──────── │ Next.js   relay-client  :3000        │  PM2
   (public)         │  Server Components + Server Actions  │
                    └────────────────┬─────────────────────┘
                                     │ server-side fetch (Bearer JWT)
                                     ▼
                    ┌──────────────────────────────────────┐
                    │ NestJS    relay-server  :3001        │  PM2
                    │  (localhost only)                    │
                    └───────┬───────────────────┬──────────┘
                            │                   │
                            ▼                   ▼
                    ┌───────────────┐   ┌───────────────┐
                    │ relay-mongo   │   │ relay-redis   │  Docker
                    │ mongo:7.0     │   │ redis:7-alpine│
                    │ :27017 local  │   │ :6379 local   │
                    └───────────────┘   └───────────────┘
                            ▲                   ▲
                            │                   │
                    Telegram Bot API      MTProto (teleproto)
                    (Telegraf, outbound)  (user client, inbound listener)
```

| Layer | Technology | Responsibility |
|---|---|---|
| Frontend | Next.js 15 App Router, React 19, Tailwind 4, `next-intl` | Admin UI, auth cookie, server-side API calls |
| Backend | NestJS 11, Passport JWT, Swagger | REST API, filters, queue orchestration, bot |
| Shared | TypeScript + Zod | Types, enums, filter helpers, validation schemas |
| Data | MongoDB 7 (Docker) | Users, channels, sources, filters, settings, message history |
| Queue | Redis 7 + Bull (Docker) | Job queue, retries, rate-limit cooldown |
| Bot | Telegraf 4.14 | Commands and direct-message ingestion |
| Listener | `teleproto` (MTProto) | Reads posts from joined source channels |

## Repository layout

```text
.
├── client/                     Next.js admin panel
│   ├── messages/{en,fa}.json   UI translations
│   ├── public/                 Logo, social card, touch icon
│   └── src/
│       ├── app/[locale]/       Routes (login, panel, error, 404)
│       ├── components/         Shell, forms, tables, UI primitives
│       ├── i18n/               next-intl routing/navigation helpers
│       ├── lib/                api client, server actions, queries, session
│       └── middleware.ts       Locale routing
├── server/                     NestJS API + bot
│   ├── src/
│   │   ├── auth/               Login, JWT, roles guard
│   │   ├── users/              User CRUD
│   │   ├── channels/           Destination channels
│   │   ├── sourceChannels/     Source channels
│   │   ├── filters/            Filter CRUD + in-memory cache
│   │   ├── queue/              Bull producer/consumer + message processor
│   │   ├── setting/            Global settings
│   │   ├── telegram/           Telegraf bot and delivery
│   │   ├── teleproto/          MTProto listener (optional)
│   │   ├── schemas/            Mongoose schemas
│   │   └── scripts/            setup-admin, login-teleproto
│   └── .env.example
├── shared/                     Types and helpers imported by both apps
├── install.sh                  Ubuntu production installer (single file)
├── AGENTS.md                   Deployment invariants for maintainers
├── AI_CONTEXT.md               Full project context for AI agents
├── turbo.json                  Task graph
└── pnpm-workspace.yaml         Workspace + approved build scripts
```

## Local development

### Prerequisites

- Node.js **22+**
- pnpm **10** (`corepack enable && corepack prepare pnpm@10 --activate`)
- MongoDB **7** and Redis **7** — Docker is the simplest route
- A Telegram bot token from [@BotFather](https://t.me/BotFather)

### 1. Install dependencies

```sh
corepack enable
pnpm install
```

### 2. Start MongoDB and Redis

```sh
docker run -d --name relay-mongo \
  -p 127.0.0.1:27017:27017 \
  -v relay-mongo-data:/data/db \
  mongo:7.0

docker run -d --name relay-redis \
  -p 127.0.0.1:6379:6379 \
  -v relay-redis-data:/data \
  redis:7-alpine redis-server --appendonly yes
```

Any local MongoDB/Redis works — just point the env vars at it.

### 3. Configure environment files

```sh
cp server/.env.example        server/.env
cp client/.env.local.example  client/.env.local
```

Minimum for `server/.env`:

```dotenv
PORT=3001
FRONTEND_URL=http://localhost:3000
MONGO_URI=mongodb://127.0.0.1:27017/relay-console
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
JWT_SECRET=<32+ random characters>
BOT_TOKEN=<token from @BotFather>
ADMIN_TELEGRAM_ID=<your numeric Telegram id>
ADMIN_INITIAL_PASSWORD=<at least 8 characters>
```

`client/.env.local`:

```dotenv
BACKEND_API_URL=http://127.0.0.1:3001/api
SITE_URL=http://localhost:3000
```

See [Environment variables](#environment-variables) for the optional keys.

### 4. Build the shared package

`server/` and `client/` import the compiled `shared/dist`, so it must exist
before anything else runs:

```sh
pnpm --filter @repo/shared build
```

`pnpm dev` and `pnpm build` do this automatically via Turbo's `^build` dependency.

### 5. Create the initial administrator

```sh
pnpm --filter server setup-admin
# → Admin user created successfully!
```

The script is idempotent: if an admin with that Telegram ID already exists it
exits cleanly. If MongoDB is unreachable you will see
`ECONNREFUSED 127.0.0.1:27017`.

### 6. Run everything

```sh
pnpm dev
```

| URL | What |
|---|---|
| http://localhost:3000 | Panel (English) |
| http://localhost:3000/fa | Panel (Persian) |
| http://localhost:3000/login | Sign in |
| http://localhost:3001/api/health | Backend health |
| http://localhost:3001/api/docs | Swagger UI |

Sign in as `admin` with `ADMIN_INITIAL_PASSWORD`.

### Root scripts

| Command | Effect |
|---|---|
| `pnpm dev` | Turbo watch: shared build, NestJS watch, Next dev |
| `pnpm build` | Build shared → server → client |
| `pnpm start` | Start built workspaces |
| `pnpm lint` | Lint every workspace |
| `pnpm test` | Jest (server only today) |
| `pnpm bootstrap` | `pnpm install && pnpm build` |

## First-run walkthrough

1. **Sign in** at `/login` as `admin`. Change the password on **Settings**.
2. **Add the destination channel** — **Channels → Add channel**. Enter the
   numeric channel ID (`-100…`), a display name, and tick *bot is channel
   admin*. Creating a channel makes it the active destination; adding another
   deactivates the previous one. The bot must be an administrator in that
   channel or delivery will fail.
3. **Add source channels** (optional) — **Source channels → Add channel**.
   These only matter when the MTProto listener is enabled: posts from channels
   not in the active list are ignored.
4. **Create filters** — **Filters → New filter**. Filters are applied in the
   order they are stored; `IGNORE_MESSAGE` rules are evaluated first.
5. **Configure global settings** — **Settings**: strip URL lines, strip
   @mention lines, listening window and time zone.
6. **Verify the pipeline** — send text to your bot (the sender's Telegram ID
   must belong to an active user) and watch **Message queue**. Each row keeps
   the original text, processed text, status, and any delivery error.

### Registering a destination through the bot (admin)

1. Add the bot as an administrator of the destination channel.
2. In a private chat with the bot: `/newchannel`.
3. Forward any post from the destination channel to the bot.

The bot reads the channel ID from the forward, verifies its own admin status,
and saves the channel as active.

### Enabling the channel listener

The listener is a **user** client (MTProto), separate from the bot. It requires
API credentials and a saved session:

1. Create an app at <https://my.telegram.org> → *API development tools* to get
   `api_id` and `api_hash`.
2. Generate a session string:

   ```sh
   pnpm --filter server login-teleproto
   ```

   Enter the phone number, the login code, and the 2FA password if set. Copy the
   printed `StringSession`.
3. Put all three values in `server/.env`:

   ```dotenv
   TELEGRAM_API_ID=123456
   TELEGRAM_API_HASH=0123456789abcdef0123456789abcdef
   TELEGRAM_SESSION=1BVtsOK...
   ```

4. Restart the backend. Logs show
   `Teleproto listener started, waiting for channel posts...`.

If any of the three keys is missing, the listener is disabled and the rest of
the app keeps working. The user account must already be a member of the source
channels.

## Filter actions

Filters are evaluated in this order for every message:

1. **Ignore rules** — all active `IGNORE_MESSAGE` filters run against the
   original text. The first match drops the message.
2. **Global rules** — `removeMention`, then `removeURL` (each removes the whole
   line containing a match).
3. **All other active filters**, in stored order.

| Action | Uses pattern | Requires replacement | Behaviour |
|---|---|---|---|
| `REMOVE_WORD` | yes | no | Deletes every occurrence (case-insensitive). |
| `REPLACE_WORD` | yes | yes | Replaces every occurrence (case-insensitive). |
| `REMOVE_LINE` | yes | no | Removes entire lines matching the pattern. |
| `REPLACE_LINE` | yes | yes | Replaces matching lines with the replacement text. |
| `REGEX_REPLACE` | yes (always regex) | yes | Global, case-insensitive regex substitution. |
| `PREPEND_TEXT` | no | yes (or pattern) | Adds text plus a newline at the top. |
| `APPEND_TEXT` | no | yes (or pattern) | Adds a newline plus text at the bottom. |
| `IGNORE_MESSAGE` | yes | no | Drops the whole message. |

`isRegex` controls whether `REMOVE_WORD`, `REPLACE_WORD`, `REMOVE_LINE`,
`REPLACE_LINE`, and `IGNORE_MESSAGE` treat the pattern as a regular expression.
When `isRegex` is false the pattern is escaped literally. `REGEX_REPLACE` always
compiles the pattern as a regex. An invalid regex never breaks the pipeline: the
filter is skipped, the error is logged, and the text continues unchanged.

### Examples

| Goal | Action | Pattern | Replacement |
|---|---|---|---|
| Remove a promo phrase | `REMOVE_WORD` | `Join our channel` | — |
| Replace a brand name | `REPLACE_WORD` | `OldBrand` | `NewBrand` |
| Drop lines mentioning a competitor | `IGNORE_MESSAGE` | `competitor(s)?` | — |
| Delete trailing ad lines | `REMOVE_LINE` | `^(Ads?|Sponsored):` | — |
| Normalise whitespace | `REGEX_REPLACE` | `\s{2,}` | ` ` |
| Add a signature | `APPEND_TEXT` | — | `Follow us for more` |
| Prepend a source credit | `PREPEND_TEXT` | — | `via @source` |

## Global settings

| Setting | Type | Default | Effect |
|---|---|---|---|
| `removeMention` | boolean | off | Drops every line containing `@username`. |
| `removeURL` | boolean | off | Drops every line containing `http://` or `https://`. |
| `listeningStartTime` | `HH:mm` | `08:30` | Start of the daily listening window. |
| `listeningEndTime` | `HH:mm` | `22:00` | End of the window (exclusive). |
| `timeZone` | IANA name | `Asia/Tehran` | Time zone used to evaluate the window. |

Times are compared as `HH:mm` strings in the chosen zone. If the start is later
than the end, the window crosses midnight (e.g. `22:00 → 06:00`). The window
only affects the **channel listener** — direct messages to the bot are always
processed. Choices are limited to the `TIMEZONES` list in
`shared/src/types/types.ts`.

## Environment variables

### `server/.env`

| Key | Required | Example | Notes |
|---|---|---|---|
| `PORT` | no | `3001` | NestJS listening port. |
| `FRONTEND_URL` | no | `http://localhost:3000` | CORS origin. |
| `MONGO_URI` | **yes** | `mongodb://127.0.0.1:27017/relay-console` | Database connection string. |
| `REDIS_HOST` | **yes** | `127.0.0.1` | Bull connection host. |
| `REDIS_PORT` | **yes** | `6379` | Bull connection port. |
| `JWT_SECRET` | **yes** | `openssl rand -hex 32` | Server refuses to start without it. |
| `BOT_TOKEN` | **yes** | `123456:ABC…` | Bot refuses to start without it. |
| `ADMIN_TELEGRAM_ID` | for setup | `123456789` | Used by `setup-admin`. |
| `ADMIN_INITIAL_PASSWORD` | for setup | `change-me-now` | 8–72 bytes; stored bcrypt-hashed. |
| `TELEGRAM_API_ID` | optional | `123456` | Enables the MTProto listener when all three are set. |
| `TELEGRAM_API_HASH` | optional | `0123abcd…` | From <https://my.telegram.org>. |
| `TELEGRAM_SESSION` | optional | `1BVtsOK…` | Generated by `login-teleproto`. |

> Only `REDIS_HOST` + `REDIS_PORT` are read by the running app. `REDIS_URL` is
> used by an unused BullMQ helper (`server/src/bull/bull.provider.ts`) and is
> **not** a substitute for the split keys.

### `client/.env.local`

| Key | Required | Example | Notes |
|---|---|---|---|
| `BACKEND_API_URL` | **yes** | `http://127.0.0.1:3001/api` | Server-side only. Never expose 3001 publicly. |
| `SITE_URL` | **yes** | `http://localhost:3000` | Canonical URLs, OG tags. **Baked into the build** — rebuild after changing. |

## HTTP API

Base path: `/api`. Interactive docs: `/api/docs`.
Every authenticated route expects `Authorization: Bearer <jwt>`.
Successful responses are `{ "success": true, "data": … }` unless noted.

| Method | Path | Access | Purpose |
|---|---|---|---|
| `GET` | `/` | public | Greeting string used as a liveness probe. |
| `GET` | `/health` | public | `{status, timestamp, service}`. |
| `POST` | `/auth/login` | public | `{username, password}` → `{access_token, user}`. |
| `GET` | `/auth/profile` | admin | Current user. |
| `POST` | `/auth/setup-password` | admin | `{password}` — set/replace admin password. |
| `POST` | `/auth/logout` | admin | Stateless acknowledgement. |
| `GET` | `/users` | admin | List users. |
| `GET` | `/users/stats` | admin | `{total, active, admins}`. |
| `GET` | `/users/:id` | admin | One user. |
| `POST` | `/users` | admin | Create a user. |
| `PUT` | `/users/:id` | admin | Update username/role/active. |
| `DELETE` | `/users/:id` | admin | Delete a user. |
| `PUT` | `/users/:id/activate` \| `/deactivate` | admin | Toggle access. |
| `PUT` | `/users/:id/promote` \| `/demote` | admin | Change role. |
| `GET` | `/channels` | admin | Destination channels. |
| `GET` | `/channels/active` | admin | The single active destination. |
| `GET` | `/channels/stats` | admin | `{total, active, withAdmin}`. |
| `GET` | `/channels/:id` | admin | One channel. |
| `POST` | `/channels` | admin | Upsert and activate. |
| `PUT` | `/channels/:id` | admin | Rename / admin flag / active. |
| `PUT` | `/channels/:id/set-active` | admin | Make this the destination. |
| `DELETE` | `/channels/:id` | admin | Delete. |
| `GET` | `/sourceChannels` | admin | All source channels. |
| `GET` | `/sourceChannels/active` | admin | Active channel IDs (cached). |
| `GET` | `/sourceChannels/stats` | admin | `{total, active}`. |
| `GET` | `/sourceChannels/:id` | admin | One source. |
| `POST` | `/sourceChannels` | admin | Create. |
| `PUT` | `/sourceChannels/:id` | admin | Update. |
| `PUT` | `/sourceChannels/:id/activate` \| `/deactivate` | admin | Toggle one. |
| `POST` | `/sourceChannels/activate-all` | admin | Enable all. |
| `POST` | `/sourceChannels/deactivate` | admin | Disable all. |
| `DELETE` | `/sourceChannels/:id` | admin | Delete. |
| `GET` | `/filters` | admin | All filters. |
| `GET` | `/filters/active` | admin | Cached active filters. |
| `GET` | `/filters/:id` | admin | One filter. |
| `POST` | `/filters` | admin | Create. |
| `PUT` | `/filters/:id` | admin | Update. |
| `PUT` | `/filters/:id/activate` \| `/deactivate` | admin | Toggle. |
| `DELETE` | `/filters/:id` | admin | Delete. |
| `GET` | `/setting` | admin | Global settings document. |
| `PUT` | `/setting` | admin | Upsert settings (returns the document directly). |
| `GET` | `/queue/stats` | admin | `{waiting, active, failed, delayed}`. |
| `GET` | `/queue/messages?limit=N` | admin | Recent history (default 50). |
| `POST` | `/queue/cleanup` | admin | `{days}`; `0` purges everything. |

## Production install

Two supported paths — pick one:

- **Automated** — one command. Installs everything and configures it.
- **Manual** — step by step, for servers where the automated script doesn't apply
  (non-Ubuntu distros, existing infrastructure, restricted environments).

Both produce an identical result: MongoDB and Redis in Docker containers, the
backend and frontend running under PM2, reachable at
`http://<server-ip>:<port>`.

**Requirements** — Ubuntu 22.04 / 24.04 / 26.04 (x86_64 or arm64), root access,
public IP, and a Telegram bot token from [@BotFather](https://t.me/BotFather).

### Automated install

One command on a **fresh** Ubuntu server as **root**:

```sh
curl -fsSL -o /tmp/relay-install.sh \
  https://raw.githubusercontent.com/mehrzad7394/telegram-msg-forwarder-bot/main/install.sh \
  && sudo bash /tmp/relay-install.sh \
       --repo https://github.com/mehrzad7394/telegram-msg-forwarder-bot.git
```

It prompts for the values below, then runs for about 3–5 minutes.

#### What it installs

| Component | Method | Default endpoint |
|---|---|---|
| Node.js 22 | NodeSource APT repo | system-wide |
| pnpm 10 | Corepack | system-wide |
| Docker | `apt install docker.io` if missing | systemd daemon |
| MongoDB | Docker container `relay-mongo`, image `mongo:7.0`, volume `relay-mongo-data` | `127.0.0.1:27017` |
| Redis | Docker container `relay-redis`, image `redis:7-alpine`, volume `relay-redis-data`, AOF enabled | `127.0.0.1:6379` |
| Backend | PM2 app `relay-server` (NestJS) | `127.0.0.1:3001` |
| Frontend | PM2 app `relay-client` (Next.js) | `0.0.0.0:3000` |
| Swap | 2 GB `/swapfile` if RAM < 2 GB and no swap present | `/swapfile` |

#### Flags

| Flag | Effect |
|---|---|
| `--repo <url>` | Repository to clone (skips the prompt) |
| `--dir <path>` | Install location (default `/opt/relay-console`) |
| `--port <n>` | Public frontend port (default `3000`) |
| `--fresh` | Stop PM2, wipe `--dir`, keep Mongo/Redis data volumes |
| `--wipe-data` | Also delete `relay-mongo-data` and `relay-redis-data` |

#### Prompt values

| Prompt | Notes |
|---|---|
| Public frontend port | Default `3000`. Change if something else uses it. |
| MongoDB URI | Default `mongodb://127.0.0.1:27017/relay-console`. |
| Redis URL | Default `redis://127.0.0.1:6379`. Parsed into `REDIS_HOST`/`REDIS_PORT`. |
| Telegram bot token | Required. |
| JWT secret | Leave blank to auto-generate a 32-byte random hex. |
| Admin Telegram user ID | Numeric ID of the initial administrator. |
| Admin password | Minimum 8 characters, maximum 72 bytes. |
| Public site URL | Default `http://<detected-public-ip>:<port>`. Baked into the client build. |
| Server-side backend API URL | Default `http://127.0.0.1:3001/api`. Never expose 3001 publicly. |
| Channel listening | Optional `api_id`, `api_hash`, `StringSession`. Skippable; re-run to enable later. |

#### After the installer finishes

Open the panel at `http://<server-ip>:<port>/login` (English) or
`/fa/login` (Persian) and log in as **admin** with the password you set.

You **must** add an inbound **TCP <port>** rule in your cloud provider's
firewall console (AWS Security Groups, Hetzner Firewalls, DigitalOcean Cloud
Firewalls, Azure NSGs, Oracle Security Lists). The installer opens
`ufw`/`firewalld` on the host, but cannot change provider-side rules.

### Manual install

Follow this if you'd rather inspect every step, or if you're on a distro where
the installer doesn't apply. All commands assume **root** (prefix `sudo` for a
non-root user; skip `pm2 startup` in that case).

#### 1. Base packages

```sh
apt-get update
apt-get install -y curl wget git ca-certificates gnupg lsb-release \
                   build-essential unzip jq openssl
```

#### 2. Swap (only if RAM < 2 GB and no swap present)

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

#### 3. Node.js 22

```sh
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt-get install -y nodejs
node -v                              # → v22.x or newer
```

#### 4. pnpm 10

```sh
corepack enable
corepack prepare pnpm@10 --activate
pnpm -v                              # → 10.x
```

#### 5. Docker (for MongoDB and Redis)

```sh
apt-get install -y docker.io
systemctl enable --now docker
docker info                          # should show server information
```

Skip this if you plan to reuse an external MongoDB or Redis.

#### 6. MongoDB

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
> on Linux kernels 6.19–7.0.13 ([SERVER-121912](https://jira.mongodb.org/browse/SERVER-121912)).
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

#### 7. Redis

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

#### 8. Clone the repository

```sh
git clone https://github.com/mehrzad7394/telegram-msg-forwarder-bot.git /opt/relay-console
cd /opt/relay-console
cp server/.env.example        server/.env
cp client/.env.local.example  client/.env.local
```

#### 9. Configure the environment

Edit **`/opt/relay-console/server/.env`** and set at minimum:

| Key | Example |
|---|---|
| `MONGO_URI` | `mongodb://127.0.0.1:27017/relay-console` |
| `REDIS_HOST` | `127.0.0.1` |
| `REDIS_PORT` | `6379` |
| `BOT_TOKEN` | the token from @BotFather |
| `JWT_SECRET` | 32+ random chars (`openssl rand -hex 32`) |
| `ADMIN_TELEGRAM_ID` | your numeric Telegram user ID |
| `ADMIN_INITIAL_PASSWORD` | ≥ 8 characters |

Key names must match what the project reads — check `server/.env.example` for the
exact spellings.

Edit **`/opt/relay-console/client/.env.local`**:

| Key | Example |
|---|---|
| `SITE_URL` | `http://<server-ip>:3000` (or `https://panel.example.com` with Nginx) |
| `BACKEND_API_URL` | `http://127.0.0.1:3001/api` |

`SITE_URL` is baked into the build. Changing it later requires a client rebuild
(see [Changing the public URL or port](#changing-the-public-url-or-port)).

#### 10. Install dependencies

```sh
cd /opt/relay-console
export NODE_OPTIONS="--max-old-space-size=1536"
pnpm install --frozen-lockfile \
     --child-concurrency=1 --network-concurrency=1
```

The concurrency flags prevent OOM on 1 GB servers. If the lockfile is out of
date, run without `--frozen-lockfile`.

#### 11. Build the shared package

```sh
pnpm --filter @repo/shared build
```

`shared/` must be built first — `server/` and `client/` import from its `dist/`.

#### 12. Create the initial administrator

```sh
pnpm --filter server setup-admin
```

Expected: `Admin user created successfully!`. Uses `ADMIN_TELEGRAM_ID` and
`ADMIN_INITIAL_PASSWORD` from `server/.env`.

If you see `ECONNREFUSED 127.0.0.1:27017`, MongoDB isn't running — go back to
step 6.

#### 13. Build all workspaces

```sh
pnpm build
```

#### 14. Start under PM2

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
`script` field. Confirm with `find server/dist -name main.js`. The installer
detects this automatically.

#### 15. Open the firewall

Host firewall (if `ufw` is active):

```sh
ufw allow 3000/tcp
```

Cloud provider firewall — add **inbound TCP 3000** (or your chosen port) in the
provider's web console. Without this, the panel won't be reachable from outside
even though it runs.

#### 16. Verify

```sh
curl -s -o /dev/null -w "backend  : %{http_code}\n" http://127.0.0.1:3001/api/health
curl -s -o /dev/null -w "frontend : %{http_code}\n" http://127.0.0.1:3000/login
```

Both should return `200`. Open `http://<server-ip>:3000/login` and log in as
**admin** with the password from step 9.

## Running alongside other apps

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
  Docker containers and reuse the existing services (see
  [Reusing an existing MongoDB or Redis](#reusing-an-existing-mongodb-or-redis)).

### PM2 process names

The installer registers exactly two PM2 apps: `relay-server` and `relay-client`.

- If PM2 is empty or only manages `relay-*` apps, the installer runs
  `pm2 delete all` for a clean reset.
- If **other** PM2 apps exist, it lists them, asks for confirmation, and then
  deletes **only** `relay-server` and `relay-client`. Other apps are left
  running.

This behaviour is implemented in `install.sh` (§ "don't blindly delete other
apps' PM2 processes"); keep the README and the script in sync if it changes.

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

## Backup and restore filters

`mongodump`/`mongorestore` are already inside the `relay-mongo` container.

**Backup** to a single file on the host:

```sh
docker exec relay-mongo mongodump --db=relay-console --collection=filters \
  --archive=/tmp/filters.archive --gzip \
  && docker cp relay-mongo:/tmp/filters.archive /root/filters-$(date +%F).archive \
  && docker exec relay-mongo rm -f /tmp/filters.archive
```

**Restore** (replaces the collection):

```sh
docker cp /root/filters-<date>.archive relay-mongo:/tmp/filters.archive
docker exec relay-mongo mongorestore --archive=/tmp/filters.archive --gzip --drop
docker exec relay-mongo rm -f /tmp/filters.archive
```

**Whole database** — drop `--collection=filters` from the `mongodump` command.

## Reusing an existing MongoDB or Redis

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

**Option B — skip the Docker containers entirely.** Comment out the two calls
`ensure_mongo` and `ensure_redis` in `install.sh` before running, and provide
the URIs at the prompts.

> The app passes only host and port to Bull, so a Redis instance that requires
> a password or a non-zero database index needs a code change in
> `server/src/app.module.ts` (connection options) rather than an env change.

## Reinstalling and updating

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

`server/.env` and `client/.env.local` are git-ignored and survive the reset.

## Changing the public URL or port

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

## Optional Nginx and HTTPS

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

## Useful commands

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

## Troubleshooting

| Symptom | Check |
|---|---|
| `pnpm install` is `Killed` | Out of RAM. `swapon --show`. Re-run `install.sh` — it auto-creates swap if missing. |
| `ECONNREFUSED 127.0.0.1:27017` | `docker ps` — is `relay-mongo` `Up`? `docker logs relay-mongo`. |
| `ECONNREFUSED 127.0.0.1:6379` | `docker ps` — is `relay-redis` `Up`? `docker logs relay-redis`. |
| Backend restarts forever | `pm2 logs relay-server --lines 80`. Usually a wrong `.env` value. Missing `JWT_SECRET` or `BOT_TOKEN` throws at boot. |
| Login says "invalid credentials" | `docker exec -it relay-mongo mongosh relay-console --eval 'db.users.countDocuments()'` should be ≥ 1. If 0, re-run `pnpm --filter server setup-admin`. |
| Browser can't reach `http://IP:PORT` | Cloud provider firewall rule for `TCP <PORT>`. `sudo ufw status verbose`. `sudo ss -ltnp \| grep <PORT>`. |
| MongoDB container exits immediately on Ubuntu 26 | Confirm image tag: `docker inspect relay-mongo --format '{{.Config.Image}}'` should print `mongo:7.0`. If it's `mongo:8.*`, replace it: `docker rm -f relay-mongo && docker run -d --name relay-mongo --restart unless-stopped -p 127.0.0.1:27017:27017 -v relay-mongo-data:/data/db mongo:7.0`. |
| Installer says "Port 3000 already in use" | Something else owns the port. Re-run with `--port 3005` (or any free port). |
| `setup-admin` fails with "Admin user already exists" | The admin was created in a previous run. It's fine — log in with the existing credentials. |
| Messages stay `queued` forever | `pm2 logs relay-server` — is the Redis queue consumer running? Check `docker exec relay-redis redis-cli ping`. |
| Message status `failed` with "not admin" | The bot is not an administrator of the active destination channel. Fix permissions, tick *bot is channel admin* in the panel. |
| Telegram 429 / "cooling down" | Expected. The worker waits out `retry_after` and retries the job. Reduce traffic if persistent. |
| Filters edited but messages unchanged | Filters are cached in memory. Any panel save reloads them; otherwise send `/refresh` to the bot (admin). |
| Channel listener does nothing | `TELEGRAM_API_ID` / `API_HASH` / `SESSION` missing → logs "Listener disabled". Also check source channels are active and the current time is inside the listening window. |
| `pnpm --filter server setup-admin` cannot find `@repo/shared` | Build shared first: `pnpm --filter @repo/shared build`. |

## Security notes

- The backend listens on `127.0.0.1:3001` in production and is never exposed.
  Only the Next.js server calls it.
- The JWT lives in an HttpOnly, SameSite=Lax cookie (`relay_session`), 24-hour
  expiry; `Secure` is set when the origin or `SITE_URL` is HTTPS.
- Every panel route requires an **active admin**; the backend enforces
  `JwtAuthGuard` + `RolesGuard` independently.
- Passwords are bcrypt-hashed (cost 10) and limited to 72 bytes.
- The panel sends `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`,
  `Referrer-Policy: no-referrer`, and `X-Robots-Tag: noindex, nofollow`.
- MongoDB and Redis bind to localhost only.
- Never commit `server/.env` or `client/.env.local`. `BOT_TOKEN`,
  `JWT_SECRET`, and `TELEGRAM_SESSION` grant full control of the bot/account.

## Documentation for contributors and AI agents

| File | Audience | Contents |
|---|---|---|
| `README.md` | GitHub visitors, operators | This file: features, setup, deployment, ops |
| `AGENTS.md` | Maintainers | Deployment invariants, installer rationale, change checklists |
| `AI_CONTEXT.md` | AI assistants | Complete project map: flows, schemas, endpoints, gotchas, recipes |

Read `AGENTS.md` before changing `install.sh` or anything that touches
deployment. Read `AI_CONTEXT.md` before changing application code.

## License

No `LICENSE` file is included in this repository. Unless the repository owner
adds one, treat the code as all rights reserved.
