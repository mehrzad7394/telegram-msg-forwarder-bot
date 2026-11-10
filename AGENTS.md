# AGENTS.md — Relay Console

This file is the entry point for AI agents and humans working on this repo.
It records **what has been built**, **why the non-obvious choices were made**,
**where everything lives**, and **how to keep the installer, docs, and code
consistent** when changing any of them.

Read this before touching `install.sh`, `README.md`, or the deployment sections
of the docs.

---

## 1. What this project is

**Relay Console** — a Telegram message forwarding management panel.

- Receives messages from a source Telegram channel.
- Applies user-configured filters.
- Forwards matching messages to a destination channel.
- Provides a web admin panel to manage channels, filters, users, and the queue.

Monorepo layout:

| Path | Role | Tech |
|---|---|---|
| `client/` | Admin panel (English + Persian via `next-intl`) | Next.js App Router, TypeScript, Tailwind, Server Actions |
| `server/` | REST API + Telegram bot + message processing | NestJS, Bull (Redis), Mongoose (MongoDB) |
| `shared/` | Request/response types, roles, filter ops | TypeScript, built to `dist/` and imported by both apps |

Default languages: English (default, no prefix) and Persian (`/fa` prefix).
Auth: JWT, HttpOnly cookie on the Next.js side, forwarded to NestJS.

---

## 2. Deployment architecture (production)

The project is deployed as **four isolated processes** on a single Ubuntu host:

```
                    ┌──────────────────────────────────────┐
   Browser ────────▶│ Next.js   relay-client  :3000        │  PM2
   (public)         │  (public port, bound 0.0.0.0)        │
                    └────────────────┬─────────────────────┘
                                     │ server-side fetch
                                     ▼
                    ┌──────────────────────────────────────┐
                    │ NestJS    relay-server  :3001        │  PM2
                    │  (localhost only, bound 127.0.0.1)   │
                    └───────┬───────────────────┬──────────┘
                            │                   │
                            ▼                   ▼
                    ┌───────────────┐   ┌───────────────┐
                    │ relay-mongo   │   │ relay-redis   │  Docker
                    │ mongo:7.0     │   │ redis:7-alpine│
                    │ :27017 local  │   │ :6379 local   │
                    │ vol: relay-   │   │ vol: relay-   │
                    │      mongo-   │   │      redis-   │
                    │      data     │   │      data     │
                    └───────────────┘   └───────────────┘
```

**Key invariants:**

1. **Port 3001 is never exposed publicly.** Only Next.js calls it (`BACKEND_API_URL=http://127.0.0.1:3001/api`). Any change that exposes 3001 is wrong.
2. **Ports 27017 and 6379 are bound to `127.0.0.1` only** — the Docker `-p` argument is `127.0.0.1:27017:27017`, not `27017:27017`. Preserve this.
3. **PM2 process names are `relay-server` and `relay-client`.** The installer only removes those two when it re-runs, so the names are a co-existence contract with other PM2 workloads on the same host.
4. **Docker names are namespaced** — `relay-mongo`, `relay-redis`, `relay-mongo-data`, `relay-redis-data`. Never use bare `mongo`/`redis` as a container or volume name in the installer; it would conflict with other Docker workloads.
5. **`SITE_URL` is baked into the Next.js build.** Changing it later requires a client rebuild (`pnpm --filter client build && pm2 restart relay-client`). This is documented in README; don't forget it when changing deployment defaults.

---

## 3. The installer — `install.sh`

`install.sh` is the single supported deployment path for the app. It must:

- Be **idempotent** — a re-run without `--fresh` must rebuild/refresh the app without destroying data.
- Be **safe on shared servers** — never touch resources it doesn't own.
- Be **honest** — `exit 1` on any failure; never log a warning and continue past a broken database or failed admin setup.
- Work on **Ubuntu 22.04, 24.04, and 26.04+**.

### Flags

| Flag | Effect | Safety |
|---|---|---|
| `--repo <url>` | Repo to clone (skips prompt) | — |
| `--dir <path>` | Install directory | Default `/opt/relay-console` |
| `--port <n>` | Public frontend port | Default `3000` |
| `--fresh` | Stops PM2, wipes `--dir` | **Keeps** Mongo/Redis data volumes |
| `--wipe-data` | Also deletes Mongo/Redis volumes | **Destructive** — only meaningful with `--fresh` |

### What the installer does, in order

1. Base packages (`curl git build-essential …`)
2. **Swap** — only if RAM < 2 GB and no swap exists. Prevents OOM during `pnpm install`.
3. Node.js 22 (NodeSource)
4. pnpm 10 (via corepack)
5. Docker (`apt install docker.io` if missing)
6. **Removes leftover native `mongodb-org` and `redis-server`** from previous failed runs — important because early installer versions used native packages.
7. **Starts `relay-mongo` (Docker `mongo:7.0`)** and polls `db.adminCommand({ping:1})` until it responds (30s timeout, then `die`).
8. **Starts `relay-redis` (Docker `redis:7-alpine`)** and polls `redis-cli ping` until `PONG` (20s timeout, then `die`).
9. Clones/updates the repo to `--dir`.
10. Writes `server/.env` and `client/.env.local` using **env-key auto-detection** (see §5).
11. `pnpm install --frozen-lockfile --child-concurrency=1 --network-concurrency=1` with `NODE_OPTIONS=--max-old-space-size=1536`.
12. `pnpm --filter @repo/shared build`
13. `pnpm --filter server setup-admin` — **hard-fails** on error.
14. `pnpm build`
15. PM2 start, save, `pm2 startup`
16. Open chosen port on `ufw`/`firewalld` if active.
17. Health-check backend `/api/health` and frontend `/login`; **exit 1 if either fails**.

### Why each non-obvious choice exists

**MongoDB runs in Docker, image pinned to `mongo:7.0`**
MongoDB 8.0 through 8.0.30 refuse to start on Linux kernels **6.19 through
7.0.13** with the message "MongoDB cannot start: Linux kernel versions 6.19 and
newer has a known incompatibility" (JIRA [SERVER‑121912](https://jira.mongodb.org/browse/SERVER-121912)).
Ubuntu **26.04** ships with a kernel in that range. The 7.0.x series has no
such guard and works. **Do not bump this image to 8.x without checking the
running kernel first** — the exact failure is:

```
F CONTROL [main] MongoDB cannot start: Linux kernel versions 6.19 and newer has a known incompatibility with this version of MongoDB
```

If a future point release of 8.0 (>= 8.0.35 per MongoDB's fix) is confirmed
compatible with Ubuntu 26 kernels, update `MONGO_IMAGE` and remove this note.
Until then, `mongo:7.0` is a stability requirement, not a preference.

**Redis runs in Docker, image `redis:7-alpine`, AOF enabled**
There is no kernel issue with native Redis, but Docker keeps the deployment
uniform (one `docker ps` to see everything, one volume policy, one upgrade
path). `--appendonly yes` is required so Bull queue jobs survive container
restarts — do not remove it.

**Both DB containers bind to `127.0.0.1` only**
`-p 127.0.0.1:27017:27017`, not `-p 27017:27017`. This is a security
invariant, not a convenience.

**`pnpm install` uses `--child-concurrency=1 --network-concurrency=1`**
Next.js ships ~150 MB of native binaries (`@next/swc-*`, `@img/sharp-*`) that
pnpm's default parallel unpacking tries to expand simultaneously. On a 1 GB VPS
the OOM killer terminates `pnpm install` (the log shows `Killed`, exit 137).
Serialising the unpacking plus `NODE_OPTIONS=--max-old-space-size=1536` keeps
peak RSS below the physical+swap ceiling. **If you remove these flags, test
on a 1 GB server first.**

**Swap is created conditionally**
Only if `swapon --show` is empty AND RAM < 2 GB. If the host already has swap,
it is left alone. Do not make swap creation unconditional — that would
overwrite existing swap configurations on shared servers.

**`setup-admin` failure is fatal**
Earlier installer versions logged a warning and continued when `setup-admin`
failed. That produced an app that builds and runs but no one can log in.
The current installer aborts. Preserve this behaviour.

**Port pre-flight**
Before starting the DB containers, the installer warns if `27017` or `6379`
are already bound by non-Docker processes. It does not abort — the user may
intentionally be reusing an external database. Warnings are the correct
behaviour here.

**PM2 safety**
`pm2 delete all` removes **every** PM2 process the current user owns. The
installer does this because on a dedicated server it's the cleanest reset, and
because the only apps it ever creates are `relay-server` and `relay-client`.
If the installer is ever refactored for shared-server safety, change this to
`pm2 delete relay-server relay-client` and document the change in the README
"Running Alongside Other Apps" section.

---

## 4. Documentation — `README.md`

Structure (top to bottom):

1. Project overview
2. Project structure table
3. Local development
4. **Production Install**
   - TL;DR one-liner
   - Automated install (what it provisions, flags, prompts, post-install)
   - Manual install (numbered steps, 1–16 + optional Nginx)
   - Running alongside other apps (ports, PM2, containers, swap)
   - Reusing an existing MongoDB or Redis
   - Reinstalling / updating
   - Changing the public URL or port
   - Optional Nginx + HTTPS
   - Useful commands
5. Troubleshooting
6. Development guidelines (permissions, roles, security)
7. API coverage table

**When changing the installer:**
- Update the "What it installs" table in README if you add/remove a component.
- Update the "Installer flags" table if you add a flag.
- Update the "Prompt values" table if you add/change a prompt.
- Update the Manual Install steps in the matching place — the two paths must
  produce identical results. If they diverge, that's a bug.
- Update "Running Alongside Other Apps" if you add a port, container name,
  or volume name.

---

## 5. Environment file handling

`server/.env.example` and `client/.env.local.example` are the **source of truth**
for variable names. The installer's `find_env_key` function reads them to
discover what the current project actually expects. This is deliberate — if the
env variable naming changes in `server/.env.example`, the installer adapts
without modification.

`find_env_key` semantics:

```bash
find_env_key <file> <regex> <fallback>
```

- Case-insensitive match on `^[A-Z0-9_]*<regex>[A-Z0-9_]*=`
- Returns the matched key name from the file, or `<fallback>`

Regexes used:

| Logical purpose | Pattern | Fallback |
|---|---|---|
| Mongo URI | `MONGO_URI` | `MONGO_URI` |
| Redis URL (combined) | `REDIS_URL` | *(empty)* |
| Redis host (split) | `REDIS_HOST` | *(empty)* |
| Redis port (split) | `REDIS_PORT` | *(empty)* |
| Telegram bot token | `BOT_TOKEN` | `BOT_TOKEN` |
| JWT secret | `JWT_SECRET` | `JWT_SECRET` |
| Admin Telegram ID | `ADMIN[A-Z0-9_]*ID` | `ADMIN_TELEGRAM_ID` |
| Admin initial password | `ADMIN[A-Z0-9_]*PASS` | `ADMIN_PASSWORD` |

**Important:** the regexes for admin keys are anchored on `ADMIN` to avoid
matching unrelated keys like `TELEGRAM_API_ID`. Any future change to admin
env variable naming must keep `ADMIN` in the name OR this table must be
updated.

If Redis uses a single `REDIS_URL`, the installer writes only that. If it uses
`REDIS_HOST` + `REDIS_PORT`, the installer parses the user-supplied
`redis://…` URL into host and port and writes both. Both styles are supported
because the project historically has had both.

---

## 6. Common failure modes (already handled)

These are the failures that were discovered during the initial production
rollout. They are handled by the installer. If any reappears, something
regressed.

| Failure | Root cause | Current handling |
|---|---|---|
| `E: The repository '… resolute/mongodb-org/7.0' does not have a Release file` | Native MongoDB repo has no Ubuntu 26 (`resolute`) variant | Installer no longer installs native MongoDB — always Docker |
| `mongod … cannot start: Linux kernel versions 6.19 and newer has a known incompatibility` | Kernel 6.19–7.0.13 + MongoDB 8.0 ≤ 8.0.30 | Docker image pinned to `mongo:7.0` |
| `pnpm install` prints `Killed` | OOM on 1 GB VPS during concurrent unpacking of Next.js binaries | Swap + `--child-concurrency=1 --network-concurrency=1` + `NODE_OPTIONS=--max-old-space-size=1536` |
| `setup-admin` → `ECONNREFUSED 127.0.0.1:27017` | MongoDB not actually up when setup-admin runs | Installer polls `db.adminCommand({ping:1})` before proceeding |
| Backend restarts forever after install | `.env` has wrong key name (e.g. `MONGODB_URI` vs `MONGO_URI`) | Env-key auto-detection (§5) prevents this if `.env.example` is correct |
| Browser shows "site can't be reached" | Cloud provider firewall blocking chosen port | Installer opens `ufw`/`firewalld`; README says "open the cloud provider rule" |

---

## 7. When making changes — checklist

**Changing the installer (`install.sh`):**

- [ ] Re-run the checklist in §3 "Why each non-obvious choice exists" — do any of those invariants break?
- [ ] Update README §4 (What it installs / Flags / Prompts) if applicable
- [ ] Update README Manual Install to match if the automated path changed
- [ ] If you add a container or volume, add it to §2 "Key invariants" and to README "Running Alongside Other Apps"
- [ ] If you add a port, add it to the Ports table in README

**Changing env variable names in `server/.env.example` or `client/.env.local.example`:**

- [ ] Check `find_env_key` regexes in §5 — do they still match?
- [ ] Update the fallback in `install.sh` if the pattern can't match the new name
- [ ] Update the "Prompt values" table in README if visible to users

**Changing the Next.js build (e.g. `SITE_URL` handling):**

- [ ] Verify README "Changing the Public URL or Port After Install" is still accurate
- [ ] Verify the installer's prompt wording still describes the consequence correctly

**Adding a new service (e.g. a search index):**

- [ ] Add its Docker container to `install.sh` (with a `relay-*` name)
- [ ] Add it to §2 diagram and invariants
- [ ] Add its port to README Ports table
- [ ] Add it to "What it installs" table
- [ ] Add its container name to `--wipe-data` cleanup
- [ ] Add health check to the installer's wait loop

**Changing the port numbers (`3000` / `3001` / `27017` / `6379`):**

- [ ] Update `install.sh` variables `CLIENT_PORT`, `BACKEND_PORT`, `MONGO_IMAGE`/`redis` port bindings
- [ ] Update `ecosystem.config.js` template inside `install.sh`
- [ ] Update README all occurrences — ports appear in §3 (ports table), §4 (post-install), §4 (verification), Troubleshooting
- [ ] Update §2 diagram in this file

---

## 8. Non-goals

Things deliberately not done, so future contributors don't "fix" them:

- **No `docker-compose.yml`.** The installer manages containers directly.
  Compose would be a fair choice, but adding it now would mean rewriting the
  installer and the docs for no functional gain.
- **No native MongoDB/Redis in the installer.** See §3 for why. Manual install
  documents native packages as an alternative, but the automated path uses
  Docker unconditionally.
- **No `.env` secrets committed.** `server/.env` and `client/.env.local` are
  git-ignored. The examples are the canonical reference. Never commit real
  tokens.
- **No public-facing port on the backend.** The app's security model assumes
  only Next.js is reachable from the internet.
- **No Nginx by default.** The installer offers it as an optional prompt at the
  end; the default is direct IP:port access.
- **No automatic domain/certificate handling.** `certbot` is offered when
  Nginx is selected, but it requires a real domain that resolves to the server
  — the installer can't supply one.

---

## 9. Where to look first when something breaks

In order:

1. `pm2 logs relay-server --lines 80` — most backend failures end up here
2. `docker ps` — are `relay-mongo` and `relay-redis` both `Up`?
3. `docker logs relay-mongo --tail 40` / `docker logs relay-redis --tail 40`
4. `cat /opt/relay-console/server/.env` — does it have the keys the server expects?
5. `curl -v http://127.0.0.1:3001/api/health` — backend alive locally?
6. `curl -v http://127.0.0.1:3000/login` — frontend alive locally?
7. If local works but external doesn't: cloud provider firewall, then `ufw status verbose`, then `ss -ltnp`

Every one of these is documented in README Troubleshooting. If you add a new
failure mode to the docs, add it to both this list and README Troubleshooting.

---

## 10. Repo conventions

- **No `--force` pushes to `main`.** The installer's `git reset --hard @{upstream}`
  relies on clean fast-forward pulls for existing installs.
- **`install.sh` must remain a single file** — no sourcing helper scripts. Users
  download it with `curl -o` and run it from `/tmp`.
- **`install.sh` must not require any file from the repo to exist before
  cloning** — it clones the repo, then reads `.env.example` from it.
- **README and `install.sh` are coupled.** A change to one that contradicts the
  other is a bug in both.

---

## 11. Versioning

The installer is versioned implicitly by the `main` branch. There are no
release tags required for the installer to work — `raw.githubusercontent.com/…/main/install.sh`
always serves the current version.

GitHub Releases are recommended for tracking deployable states (see README for
the process), but are **not** required for installation. The one-liner always
pulls from `main`.

If a change to the installer would break existing installs (e.g. renaming a
container), the old installer must be preserved for users to migrate from —
at minimum, keep a note in the release description of what to run to migrate.