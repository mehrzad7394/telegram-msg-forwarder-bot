# AI_CONTEXT.md — Relay Console project context

> **Purpose of this file:** give an AI assistant (or a new maintainer) a complete
> mental model of this repository without scanning every file. It is a map, not
> a tutorial. User-facing setup lives in `README.md`; deployment invariants live
> in `AGENTS.md`.
>
> **Status:** generated from a full source read on 2026-11-17. If code and this
> file disagree, trust the code and update this file.

---

## 1. What this project is

**Relay Console** is a self-hosted Telegram message relay with a web admin panel.

- Inbound: text messages arrive either from a **Telegraf bot** (users DM the bot)
  or from an **MTProto user client** (`teleproto`) listening to Telegram channels.
- Processing: global cleanup rules + ordered user-defined filters rewrite the
  text, or drop the message.
- Outbound: the processed text is persisted to MongoDB, queued in Redis via
  Bull, and sent to **one active destination channel** by the queue worker.
- Control plane: a Next.js admin panel (English/Persian) talks to a private
  NestJS API using a JWT stored in an HttpOnly cookie.

It is not a general-purpose bot framework. It has exactly one destination
channel at a time, forwards text only, and is designed to run as four processes
on one Ubuntu host.

---

## 2. Golden rules (do not break)

1. `relay-client` (Next.js, port 3000) is the only public process.
   `relay-server` (NestJS, port 3001) binds localhost and is called only by the
   Next.js server.
2. MongoDB and Redis bind to `127.0.0.1` only, inside Docker, with the names
   `relay-mongo`, `relay-redis`, `relay-mongo-data`, `relay-redis-data`.
3. `shared/` must be built (`dist/`) before `server/` or `client/` can run or
   type-check. Turbo encodes this with `dependsOn: ["^build"]`.
4. The panel is admin-only. `getSession()` rejects non-admin or inactive users
   even if the JWT is valid.
5. `SITE_URL` is baked into the Next.js build. Changing it requires
   `pnpm --filter client build` (and a restart).
6. Only one destination channel may be `isActive: true` — enforced by a partial
   unique Mongo index, not just by application logic.
7. `install.sh` must stay a single self-contained file, idempotent, and safe on
   shared servers. Read `AGENTS.md` §3 before editing it.

---

## 3. Runtime topology

```text
Browser
  │  HTTP (cookie: relay_session)
  ▼
Next.js :3000  ── server-side fetch (Bearer JWT) ──▶  NestJS :3001
                                                         │
                             ┌───────────────────────────┼───────────────────────┐
                             ▼                           ▼                       ▼
                       MongoDB :27017             Redis :6379            Telegram Bot API
                     (state + history)         (Bull messageQueue)       (send / receive)
```

Telegraf (bot) and the `teleproto` MTProto client both run **inside** the
NestJS process; they are not separate services.

Processes in production (PM2 + Docker):

| Name | Type | Port | Notes |
|---|---|---|---|
| `relay-client` | PM2 / Next.js | `0.0.0.0:3000` | public |
| `relay-server` | PM2 / NestJS | `127.0.0.1:3001` | `globalPrefix('api')` |
| `relay-mongo` | Docker `mongo:7.0` | `127.0.0.1:27017` | volume `relay-mongo-data` |
| `relay-redis` | Docker `redis:7-alpine` | `127.0.0.1:6379` | AOF, volume `relay-redis-data` |

---

## 4. End-to-end flows

### 4.1 Bot ingestion (Telegraf)

`server/src/telegram/telegram.service.ts`

1. `TelegramModule.onModuleInit` → `initializeBot()`:
   - `FiltersService.loadFilters()`, `SettingService.loadSettings()`
   - emits `telegram.bot.ready` (the MTProto module waits for this)
   - registers bot commands and handlers, then `launchBot()`.
2. User sends text → `handleMessage`:
   - sender must exist in `users` and be `isActive` (`getActiveUser`).
   - if the user is in `usersWaitingForChannel` (set by `/newchannel`), the
     message is treated as a forwarded-channel registration instead.
   - otherwise `handleUserMessage` → active destination required, bot must be
     admin → `MessageProcessorService.processMessage` → `QueueService.addToQueue`.
3. Admin registers a destination via `/newchannel` + forwarding a channel post:
   `handleForwardedChannelMessage` reads `forward_origin.chat.id`, verifies the
   bot's admin status, then `ChannelsService.createOrUpdate` (which activates it).

Bot commands: `/start`, `/channel`, `/newchannel` (admin), `/refresh` (admin),
`/help`, `/stop` (admin; deactivates all channels and clears caches).
Inline callbacks map to the same handlers (`CMD_CHANNEL`, etc.).

### 4.2 Channel listening (MTProto / `teleproto`)

`server/src/teleproto/teleproto.module.ts`, `teleproto.listner.service.ts`

- `TELEPROTO_CLIENT` provider: returns `null` unless `TELEGRAM_SESSION`,
  `TELEGRAM_API_ID`, and `TELEGRAM_API_HASH` are all set. A missing config is
  **not** an error — the listener is simply disabled.
- On every `NewMessage` event:
  1. `event.isChannel`, message exists, has text or media;
  2. `peerId.className === 'PeerChannel'`;
  3. resolve marked channel ID via `client.getPeerId(peerId, true)`;
  4. `isListeningTime(settings)` must be true (time-zone aware HH:mm window);
  5. channel ID must be in `SourceChannelsService.getActiveChannels()` (cached);
  6. hands text to `TelegramService.handleListnerMessage` → same processor and
     queue as the bot.
- Media-only posts carry `message: ''` and are dropped by
  `handleListnerMessage` (`if (!payload.message) return`). **Text only.**

### 4.3 Processing and delivery

`queue/message-processor.service.ts` → `queue/queue.service.ts` →
`queue/queue.processor.ts`

1. `processMessage(text)`:
   - all active `IGNORE_MESSAGE` filters first (match against original text);
     return `null` = drop.
   - `settings.removeMention` → drop lines containing `@word`.
   - `settings.removeURL` → drop lines containing `http(s)://`.
   - remaining filters applied in the order returned by
     `FiltersService.getActiveFilters()` (Mongo natural order; effectively
     creation order — no explicit sort).
2. `addToQueue`: insert a `queuedmessages` document with status `queued`, then
   `messageQueue.add('processMessage', {queuedMessageId, processedMessage},
   {delay: 2000, attempts: 3, backoff: 5000})`.
3. `QueueProcessor.processMessageJob`:
   - if a Redis cooldown key `telegram:cooldown:until` is set, sleep until it
     expires;
   - `TelegramService.sendToChannel` → `bot.telegram.sendMessage(activeChannelId)`;
   - success → document status `sent`, `sentAt = now`;
   - HTTP 429 → write cooldown key with `PX = retry_after * 1000`, set document
     status back to `queued` with an error note, rethrow so Bull retries;
   - other errors → status `failed` with the error message, rethrow.
4. `@OnQueueCompleted` logs and also attempts an incorrect
   `findByIdAndDelete(job.id)` (see §14); `@OnQueueFailed` logs.

### 4.4 Auth flow

- `POST /api/auth/login` uses `LocalStrategy` → `AuthService.validateUser`:
  only users with `role = admin`, `isActive = true`, and a `passwordHash`.
- JWT payload: `{ telegramId, username, sub: user._id, role }`, 24h expiry,
  signed with `JWT_SECRET`.
- `JwtStrategy.validate` re-loads the user by `telegramId` and rejects if
  missing, inactive, or `_id !== payload.sub`.
- The Next.js `login` server action stores the token in the `relay_session`
  cookie (HttpOnly, SameSite=Lax, Secure when HTTPS, 24h) and verifies the
  profile is an active admin before setting it.
- `getSession()` calls `/auth/profile`; only active admins pass.

### 4.5 Caches and invalidation

Four in-memory caches exist in the NestJS process:

| Cache | Owner | Loaded | Invalidated by |
|---|---|---|---|
| Active filters | `FiltersService.activeFilters` | startup; filter create (only if the new filter is active), update, delete, activate/deactivate | those same methods; `/refresh`; `/stop` |
| Global settings | `SettingService.settings` | startup, `upsert` | `upsert`; `/refresh`; `/stop` |
| Active destination | `ChannelsService.activeChannel` | startup, `createOrUpdate`, `update`, `delete`, `updateBotAdminStatus`, `deactivateAll` | those same methods |
| Active source IDs | `SourceChannelsService.activeChannels` | startup, every source CRUD/activate/deactivate/activate-all/deactivate-all | those methods |

There is no cross-process invalidation. If you run multiple backend replicas,
caches diverge — the project assumes a single `relay-server` process.

---

## 5. Data model (MongoDB)

Mongoose schemas live in `server/src/schemas/`; all use `{ timestamps: true }`
unless noted. Collections are named after the model (e.g. `users`,
`channels`, `sourcechannels`, `filters`, `queuedmessages`, `settings`).

### User (`users`)

| Field | Type | Rules |
|---|---|---|
| `telegramId` | string | required, unique |
| `username` | string | required, unique; defaults to `telegramId` on create |
| `role` | `'admin' \| 'user'` | required, default `user` |
| `isActive` | boolean | default `true` |
| `passwordHash` | string | `select: false`; bcrypt; only admins that log in have one |
| `createdAt`/`updatedAt` | Date | timestamps |

### Channel — destination (`channels`)

| Field | Type | Rules |
|---|---|---|
| `channelId` | string | required, unique (e.g. `-1002590125715`) |
| `channelName` | string | required |
| `botIsAdmin` | boolean | default `false` |
| `isActive` | boolean | default `false`; **partial unique index on `true`** |
| `createdAt`/`updatedAt` | Date | timestamps |

`ChannelsService.createOrUpdate` deactivates other active channels, upserts this
one with `isActive: true`, and retries up to 3× on duplicate-key `11000`.

### SourceChannel (`sourceChannels`)

| Field | Type | Rules |
|---|---|---|
| `channelId` | string | required, unique |
| `channelName` | string | required, unique, `length: 50` (Mongoose `length` is not a real validator here, but the option is present) |
| `isActive` | boolean | default `false` |
| timestamps | Date | |

### Filter (`filters`)

| Field | Type | Rules |
|---|---|---|
| `name` | string | required |
| `pattern` | string | required unless action is `PREPEND_TEXT` / `APPEND_TEXT` (custom required fn) |
| `action` | enum `FilterActions` | required |
| `replacement` | string | optional at DB level; required by DTO for replace/prepend/append actions |
| `isRegex` | boolean | default `false` |
| `isActive` | boolean | default `true` |
| timestamps | Date | |

### QueuedMessage (`queuedmessages`)

| Field | Type | Rules |
|---|---|---|
| `originalMessage` | string | required |
| `processedMessage` | string | required |
| `userId` | ObjectId ref `User` | optional (null for channel-listener messages) |
| `status` | `'queued' \| 'processing' \| 'sent' \| 'failed'` | default `queued` |
| `sentAt` | Date | set on success |
| `error` | string | last delivery error |
| timestamps | Date | `createdAt` used for cleanup |

Note: `processing` exists in the enum but is never written. There is no TTL
index; history grows until `POST /api/queue/cleanup` is called.

### Setting (`settings`)

Single document, `key: 'global'` (unique, immutable, default `global`):

| Field | Type | Default |
|---|---|---|
| `removeMention` | boolean | undefined/false |
| `removeURL` | boolean | undefined/false |
| `listeningStartTime` | string `HH:mm` | `08:30` |
| `listeningEndTime` | string `HH:mm` | `22:00` |
| `timeZone` | IANA string | `Asia/Tehran` |

---

## 6. Backend file map (NestJS)

| Path | Responsibility |
|---|---|
| `src/main.ts` | Bootstrap: CORS `FRONTEND_URL`, global `ValidationPipe` (whitelist+transform, flattened messages), global prefix `api`, Swagger at `/api/docs`, listen on `PORT` (3001). |
| `src/app.module.ts` | Wires `ConfigModule` (global), `MongooseModule.forRoot(MONGO_URI)`, `BullModule.forRoot` using `REDIS_HOST`/`REDIS_PORT`, all feature modules. |
| `src/app.controller.ts` | `GET /api` greeting text, `GET /api/health`. |
| `src/auth/*` | Local + JWT strategies, `JwtAuthGuard`, `RolesGuard`, `@Roles()` decorator, login/profile/setup-password/logout. |
| `src/users/*` | Admin-only user CRUD + activate/deactivate/promote/demote + stats. |
| `src/channels/*` | Destination channel CRUD, active channel, stats, `set-active`. |
| `src/sourceChannels/*` | Source channel CRUD, active list (cached IDs), stats, bulk activate/deactivate. |
| `src/filters/*` | Filter CRUD, active list cache, activate/deactivate. |
| `src/setting/*` | Read/upsert global settings cache. |
| `src/queue/message-processor.service.ts` | Pure text-transformation engine (no I/O beyond caches). |
| `src/queue/queue.service.ts` | Persist + enqueue, Bull stats, history query, cleanup. |
| `src/queue/queue.processor.ts` | Bull consumer, Telegram delivery, 429 cooldown, status updates. |
| `src/queue/queue.controller.ts` | `/queue/stats`, `/queue/messages`, `/queue/cleanup`. |
| `src/telegram/*` | Telegraf provider, commands, admin verification, message ingestion, `sendToChannel`. |
| `src/teleproto/*` | MTProto client provider + new-message listener. |
| `src/schemas/*` | Mongoose models. |
| `src/scripts/setup-admin.ts` | Standalone script: creates the initial admin with bcrypt hash. |
| `src/scripts/login-teleproto.ts` | Interactive MTProto login; prints a `StringSession`. |
| `src/bull/bull.provider.ts` | **Unused** BullMQ queue factory (see §14). |
| `src/types/types.ts` | Re-exports shared enums/types + `RelayChannelPostPayload`. |
| `test-token.ts` | Scratch file, not wired into any script. |

---

## 7. Filter engine — exact semantics

Implemented in `server/src/queue/message-processor.service.ts`.

Evaluation order per message:

```text
for filter where action == IGNORE_MESSAGE:
    if pattern matches original text  → return null      (message dropped)
if settings.removeMention: drop lines matching /@[a-zA-Z0-9_]+/
if settings.removeURL:     drop lines matching /https?:\/\/[^\s]+/
for filter where action != IGNORE_MESSAGE (in stored order):
    text = applyFilter(text)
```

Action semantics:

| Action | Implementation | Regex flags |
|---|---|---|
| `REMOVE_WORD` | `text.replace(pattern, '')` | `gi`, literal-escaped unless `isRegex` |
| `REPLACE_WORD` | `text.replace(pattern, replacement ?? '')` | `gi` |
| `REMOVE_LINE` | split on `\n`, keep lines that do not match | `i` |
| `REPLACE_LINE` | split on `\n`, replace matching lines with `replacement ?? ''` | `i` |
| `REGEX_REPLACE` | `text.replace(pattern, replacement ?? '')` — always compiled as regex | `gi` |
| `PREPEND_TEXT` | `prefix + '\n' + text`, prefix = `replacement \|\| pattern \|\| ''` | n/a |
| `APPEND_TEXT` | `text + '\n' + suffix`, suffix = `replacement \|\| pattern \|\| ''` | n/a |
| `IGNORE_MESSAGE` | drop entire message when pattern matches anywhere | `i`, literal unless `isRegex` |

- A thrown regex (invalid pattern) is caught per filter: the error is logged and
  the text is returned unchanged. Invalid ignore regexes return `false`.
- `usesFilterPattern(action)` is false for prepend/append; those do not need a
  pattern. `requiresFilterReplacement(action)` is true for
  replace/regex/prepend/append.

`FilterActions` values are **lowercase** (`remove_word`, `replace_word`, …).
They are defined in `shared/src/types/types.ts` and exported from the package
root. Do not confuse them with the dead legacy files listed in §14.

---

## 8. Queue semantics

- Bull queue name: `messageQueue`; job name: `processMessage`.
- Job data: `{ queuedMessageId, processedMessage }`.
- Options: `delay: 2000` (spacing), `attempts: 3`, `backoff: 5000`.
- Concurrency: default (Bull/`@nestjs/bull` default, 1 unless configured). The
  limiter block in `queue.module.ts` is commented out.
- Redis cooldown key: `telegram:cooldown:until` (epoch ms, `PX` TTL). Set only
  on Telegram HTTP 429. Jobs sleep synchronously (`setTimeout`) before sending if
  a cooldown is active.
- Stats endpoint counts Bull jobs in `waiting`, `active`, `failed`, `delayed`.
- `cleanupOldMessages(days)`:
  - `days = 0`: `queue.empty()` + `clean(0, 'failed'|'completed')` + delete all
    Mongo history; returns the number of drained jobs.
  - `days > 0`: delete Mongo history older than the cutoff. Bull jobs are not
    touched.
- Status lifecycle in Mongo: `queued` → `sent` or `failed`; on 429 it goes back
  to `queued`.

---

## 9. Auth, roles, and access control

- Roles: `admin`, `user` (shared constant `Roles` and enum `UserRoles`).
- Backend guards: `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles(UserRoles.ADMIN)`
  on every controller except `auth/login` and the two public app routes.
- A `user`-role account can use the bot (if active) but cannot enter the panel or
  call admin endpoints.
- The bot independently checks `getActiveUser(telegramId)`; `user`-role accounts
  can send messages to the bot and receive `/channel` and `/help`; admin-only
  commands are `/newchannel`, `/refresh`, `/stop`.
- Password constraints: the installer prompts for at least 8 characters, but
  `setup-admin` and the panel's change-password action enforce only a 72-byte
  maximum (bcrypt's limit). Do not assume a server-side minimum length.

---

## 10. HTTP API surface

Base: `http://127.0.0.1:3001/api` (all routes below are prefixed with `/api`).
Auth: `Authorization: Bearer <jwt>`. Success envelope: `{ success: true, data }`
(exceptions noted).

| Method + path | Guard | Notes |
|---|---|---|
| `GET /api` | public | returns greeting string as `text/plain` |
| `GET /api/health` | public | `{status:'ok',timestamp,service}` |
| `POST /api/auth/login` | public | body `{username,password}` → `{access_token,user}` |
| `GET /api/auth/profile` | admin | `{success,data:{id,telegramId,username,role,isActive}}` |
| `POST /api/auth/setup-password` | admin | `{password}` |
| `POST /api/auth/logout` | admin | stateless |
| `GET /api/users`, `/users/stats`, `/users/:id` | admin | |
| `POST /api/users` | admin | body `{telegramId,username?,role,isActive?}` |
| `PUT /api/users/:id` | admin | body `{username?,role?,isActive?}` |
| `DELETE /api/users/:id` | admin | |
| `PUT /api/users/:id/activate`, `/deactivate`, `/promote`, `/demote` | admin | |
| `GET /api/channels`, `/channels/active`, `/channels/stats`, `/channels/:id` | admin | |
| `POST /api/channels` | admin | upserts and **activates** the channel |
| `PUT /api/channels/:id` | admin | rename / `botIsAdmin` / `isActive` |
| `PUT /api/channels/:id/set-active` | admin | re-upserts as active |
| `DELETE /api/channels/:id` | admin | |
| `GET /api/sourceChannels`, `/active`, `/stats`, `/:id` | admin | `/active` returns cached channel ID strings |
| `POST /api/sourceChannels` | admin | |
| `PUT /api/sourceChannels/:id` | admin | |
| `PUT /api/sourceChannels/:id/activate`, `/deactivate` | admin | |
| `POST /api/sourceChannels/activate-all`, `/deactivate` | admin | bulk |
| `DELETE /api/sourceChannels/:id` | admin | |
| `GET /api/filters`, `/filters/active`, `/filters/:id` | admin | `/active` returns cached documents |
| `POST /api/filters` | admin | |
| `PUT /api/filters/:id` | admin | |
| `PUT /api/filters/:id/activate`, `/deactivate` | admin | |
| `DELETE /api/filters/:id` | admin | |
| `GET /api/setting` | admin | `{success,data}` (may be `null`) |
| `PUT /api/setting` | admin | **returns the raw document**, no envelope |
| `GET /api/queue/stats` | admin | `{waiting,active,failed,delayed}` |
| `GET /api/queue/messages?limit=N` | admin | newest first, default 50 |
| `POST /api/queue/cleanup` | admin | `{days}`; `0` purges everything |

Swagger: `http://127.0.0.1:3001/api/docs` (Bearer scheme name
`access-token`). DTOs use `class-validator` + Swagger decorators.

---

## 11. Frontend architecture (Next.js)

### Rendering model

- App Router, **all panel pages are dynamic** (`export const dynamic =
  "force-dynamic"` in `app/[locale]/layout.tsx`).
- Pages are server components; they call `@/lib/queries` which uses
  `@/lib/api` (`server-only` fetch to `BACKEND_API_URL`, `cache: "no-store"`,
  10 s timeout, `redirect: "error"`).
- Mutations are **server actions** in `src/lib/actions.ts` (`"use server"`),
  invoked by client components (`ActionForm`, `EntityButtons`).
- Errors are surfaced as `ActionResult` objects; auth errors redirect to
  `/login` in the current locale.

### Auth and locale plumbing

| File | Role |
|---|---|
| `src/lib/api.ts` | `request<T>`, `readData<T>`, `ApiError`, `sessionCookie = "relay_session"`, `entityPath`, 24h token handling |
| `src/lib/session.ts` | cached `getSession()` and `requireSession()`; rejects non-admin |
| `src/lib/actions.ts` | login/logout, password setup, CRUD for users/channels/sources/filters, settings, queue cleanup, entity commands |
| `src/lib/queries.ts` | read helpers for every endpoint used by pages |
| `src/i18n/routing.ts` | locales `en`, `fa`; default `en`; `localePrefix: 'as-needed'`; no detection, no cookie |
| `src/i18n/navigation.ts` | locale-aware `Link`, `getPathname`, `usePathname` |
| `src/i18n/redirect.ts` | `redirectInLocale` |
| `src/middleware.ts` | next-intl middleware; excludes `api`, `_next`, `_vercel`, files with a dot |
| `src/lib/metadata.ts` | canonical/alternate URLs, OG/Twitter cards; reads `SITE_URL` |
| `src/lib/labels.ts` | maps `FilterActions` → translation keys |

### Routes

```text
/[locale]/login                 sign in
/[locale]                       dashboard (overview)
/[locale]/channels              destination list
/[locale]/channels/[id]         "new" = create, otherwise edit/manage
/[locale]/sourceChannels        source list (bulk activate/deactivate)
/[locale]/sourceChannels/[id]   "new" = create, otherwise edit/manage
/[locale]/filters               filter list
/[locale]/filters/[id]          "new" = create, otherwise edit/manage
/[locale]/queue                 Bull stats + history + cleanup
/[locale]/users                 user list
/[locale]/users/[id]            "new" = create, otherwise edit/manage
/[locale]/settings              global settings + change password
/[locale]/[...rest]             404 within locale
```

`/[locale]/(panel)/layout.tsx` calls `getProfile()` (which calls
`requireSession()`) and wraps children in `Shell` (sidebar, topbar, language
switch, logout).

### UI conventions

- Tailwind 4 via `@tailwindcss/postcss`; global classes in `src/app/globals.css`.
- Icons from `lucide-react`; font from `@fontsource-variable/vazirmatn`.
- Persian is RTL (`<html dir="rtl">`), all dates/numbers go through
  `next-intl` formatters. Fixed time zone in `i18n/request.ts`:
  `Asia/Tehran`.
- Every page defines `generateMetadata` via `pageMetadata(...)`.
- Translations: `client/messages/en.json` and `fa.json` — **both must be
  updated** when adding a key (type `Messages` is derived from `en.json`).

---

## 12. `shared/` package

`@repo/shared` is compiled with `tsc` to `dist/` and imported by both apps
(`transpilePackages: ['@repo/shared']` on the client).

Exports (`shared/src/index.ts`):

- `types/types.ts` — `User`, `Filter`, `Channel`, `SourceChannel`, `QueuedMessage`,
  `JWTPayload`, `UserProfile`, enums `UserRoles`, `FilterActions`, `TIMEZONES`,
  `TimeZone`.
- `schemas/*.schema.ts` — Zod schemas (`FilterSchema`, `UserProfileSchema`,
  `QueuedMessageSchema`). `FilterSchema` is used by the filter server action.
- `constants/roles.ts` — `Roles` object (`admin`, `user`).
- `types/api.ts` — API input/update/record types, stats types, `ApiData`,
  `ApiSuccess`, `HealthStatus`, `QueueCleanupInput`, `SettingsInput`.
- `utils/filterUtils.ts` — `requiresFilterReplacement`, `usesFilterPattern`.
- `utils/functions.ts` — `isListeningTime(settings)`.
- `utils/stringUtils.ts` — `escapeRegExp`.

`shared/src/types/index.ts` only re-exports `./types` and `./api`.

---

## 13. Environment variables

### Server (`server/.env`)

| Key | Used by | Notes |
|---|---|---|
| `PORT` | `main.ts` | default 3001 |
| `FRONTEND_URL` | CORS | default `http://localhost:3000` |
| `MONGO_URI` | `app.module.ts` | default `mongodb://localhost:27017/telegram-bot` |
| `REDIS_HOST` / `REDIS_PORT` | `BullModule.forRoot` | defaults `localhost` / `6379` |
| `JWT_SECRET` | `JwtModule`, `JwtStrategy` | **required** — throws at startup |
| `BOT_TOKEN` | `TelegramConfig` | **required** — throws at startup |
| `ADMIN_TELEGRAM_ID` | `setup-admin` | numeric |
| `ADMIN_INITIAL_PASSWORD` | `setup-admin` | non-empty, ≤ 72 bytes; the installer prompts for ≥ 8 characters |
| `TELEGRAM_API_ID` | `TeleprotoModule` | optional; all three TG keys or listener disabled |
| `TELEGRAM_API_HASH` | `TeleprotoModule` | optional |
| `TELEGRAM_SESSION` | `TeleprotoModule` | optional; `StringSession` from `login-teleproto` |

`server/.env.example` is the canonical key list read by `install.sh`
(`find_env_key`). See `AGENTS.md` §5 before renaming anything.

### Client (`client/.env.local`)

| Key | Used by | Notes |
|---|---|---|
| `BACKEND_API_URL` | `src/lib/api.ts` | default `http://127.0.0.1:3001/api` |
| `SITE_URL` | `metadata.ts`, `secureCookie()` | build-time; listed in `turbo.json` build env |

`turbo.json` passes only: `BACKEND_API_URL`, `SITE_URL`, `MONGO_URI`,
`REDIS_HOST`, `REDIS_PORT`, `BOT_TOKEN`, `JWT_SECRET`, `FRONTEND_URL`, `PORT`
to dev/start tasks. Adding a new env var consumed at build time requires a
`turbo.json` update.

---

## 14. Known quirks, inconsistencies, and latent bugs

Read this before "fixing" something that looks wrong.

1. **Duplicate, dead shared files.** `shared/src/types/filter.ts`,
   `shared/src/types/message.ts`, `shared/src/types/user.ts`, and
   `shared/src/constants/filters.ts` are **not exported** from the package root.
   They contain an uppercase `FilterActions` enum (`REMOVE_WORD`) and duplicate
   interfaces. The live enum is the lowercase one in `types/types.ts`. Do not
   import the dead files; consider deleting them only as a deliberate cleanup.
2. **`REDIS_URL` is not used at runtime.** The app uses `@nestjs/bull` with
   `REDIS_HOST`/`REDIS_PORT`. `server/src/bull/bull.provider.ts` builds a
   BullMQ queue from `REDIS_URL` but is never imported. The installer prompts
   for a "Redis URL" and then parses it into host/port, which is why the prompt
   exists.
3. **Queue completion cleanup is broken.** `QueueProcessor.onCompleted` calls
   `findByIdAndDelete(job.id)`; `job.id` is a Bull counter, not the Mongo
   `queuedMessageId`, so it deletes the wrong/nonexistent document (and may throw
   a cast error). The real status update happens in `processMessageJob`.
4. **History rows are never auto-pruned.** No TTL index; cleanup is manual via
   the panel or `POST /api/queue/cleanup`.
5. **`QueueStats.completed` is declared but never returned** by
   `getQueueStats()`. The UI only reads `waiting`, `active`, `failed`, `delayed`.
6. **Case-inconsistent client path.** `getSourceChannelStats()` calls
   `/SourceChannels/stats` (capital S). Express routing is case-insensitive by
   default, so it works, but new code should use `/sourceChannels/stats`.
7. **`GET /api/setting` vs `PUT /api/setting` shapes differ.** GET wraps in
   `{success,data}`; PUT returns the raw document.
8. **`processing` status is dead** in the `QueuedMessage` enum.
9. **Listener removal mismatch.** `TeleprotoListenerService.initializeListner`
   registers an arrow wrapper around `this.handler`, but `destroyListner` removes
   `this.handler` itself. Shutdown still calls `client.disconnect()`, so this is
   mostly harmless.
10. **`SourceChannel.channelName` is unique.** Two source channels cannot share a
    display name even with different IDs.
11. **`channelName` `length: 50`** is a Mongoose option on a String path and does
    not enforce a max length.
12. **pnpm version mismatch.** Root `package.json` declares
    `packageManager: "pnpm@12.18.0"`, while `install.sh` installs pnpm 10 via
    corepack. With corepack enabled, pnpm may auto-download 12.18.0. Keep this in
    mind before blaming lockfile errors.
13. **`docker-compose.yml` exists but is empty.** Compose is a documented
    non-goal (`AGENTS.md` §8); the installer manages containers directly.
14. **No `LICENSE` file.** Root `package.json` says ISC; `server` says
    UNLICENSED. Treat licensing as unresolved.
15. **Testing is minimal.** Only `server/src/app.controller.spec.ts` and the
    default e2e spec exist. The client has no test script. `pnpm test` runs Turbo
    `test` (server only).
16. **`server/test-token.ts` and `tree.js`** are local scratch utilities, not
    part of the build.

---

## 15. Commands

| Command | What it does |
|---|---|
| `pnpm install` | Install all workspaces |
| `pnpm dev` | Turbo watch (shared build → server watch + Next dev) |
| `pnpm build` | Turbo build all workspaces |
| `pnpm start` | Start built apps |
| `pnpm lint` | ESLint across workspaces |
| `pnpm test` | Jest (server) |
| `pnpm --filter @repo/shared build` | Compile shared types/helpers to `dist/` |
| `pnpm --filter server dev` | NestJS watch only |
| `pnpm --filter server setup-admin` | Create the initial admin from `.env` |
| `pnpm --filter server login-teleproto` | Interactive MTProto login → session string |
| `pnpm --filter client dev` | Next.js dev only |
| `pnpm --filter client build` | Production client build (needs `SITE_URL`) |
| `pnpm --filter client typecheck` | `tsc --noEmit` |

Health checks: `GET /api/health`, frontend `/login`.

---

## 16. Change recipes

### Add a new entity / API resource

1. `server/src/schemas/<name>.schema.ts` (Mongoose).
2. `server/src/<name>/` module + service + controller + `dto/`.
3. Register the module in `app.module.ts`.
4. Add record/input/update types to `shared/src/types/api.ts` and the base
   interface to `shared/src/types/types.ts`; rebuild shared.
5. Add read helpers to `client/src/lib/queries.ts` and server actions to
   `client/src/lib/actions.ts`.
6. Add routes under `client/src/app/[locale]/(panel)/<name>/` and a nav entry in
   `client/src/components/shell.tsx`.
7. Add translation keys to **both** `messages/en.json` and `messages/fa.json`.

### Add a filter action

1. Add the value to `FilterActions` in `shared/src/types/types.ts`.
2. Update `shared/src/utils/filterUtils.ts` (replacement/pattern rules).
3. Add the branch in `MessageProcessorService.applyFilter` (and, if it can drop,
   the ignore pass in `processMessage`).
4. Update the Mongoose enum (automatic via `FilterActions`) and the DTO if the
   validation differs.
5. Add the label mapping in `client/src/lib/labels.ts`, the form UI in
   `client/src/components/entity-forms.tsx`, and both translation files.

### Add or rename an environment variable

1. `server/.env.example` or `client/.env.local.example` (canonical list).
2. `AGENTS.md` §5 table / `install.sh` `find_env_key` fallback if deployment
   related.
3. `turbo.json` `env`/`passThroughEnv` if it is consumed at build or dev time.
4. `README.md` environment tables and the installer prompt section.

### Add a panel page

1. Create `client/src/app/[locale]/(panel)/<route>/page.tsx`.
2. Add `generateMetadata` via `pageMetadata`.
3. Fetch through `@/lib/queries`; the panel layout already enforces auth.
4. Add the nav item in `shell.tsx` and translations in both locales.

### Change ports or container names

Follow the checklist in `AGENTS.md` §7 — it lists every place
(`install.sh`, `ecosystem.config.js`, README, `AGENTS.md` §2).

---

## 17. Deployment summary

- `install.sh` is the supported path. It installs Node 22, pnpm 10, Docker,
  starts `relay-mongo`/`relay-redis`, writes `.env` files, installs, builds,
  creates the admin, starts PM2, opens the host firewall, health-checks, and
  exits non-zero on failure.
- `mongo:7.0` is pinned for a reason (kernel 6.19–7.0.13 incompatibility in
  MongoDB 8.0 ≤ 8.0.30). Do not bump without checking the kernel.
- PM2 behavior in the current script: if other PM2 apps exist, it lists them,
  asks for confirmation, and deletes **only** `relay-server`/`relay-client`;
  otherwise it runs `pm2 delete all`.
- Data volumes survive `--fresh`; `--wipe-data` removes them.
- Full operational detail, backups, Nginx, reuse of external databases, and
  troubleshooting live in `README.md`; installer rationale lives in `AGENTS.md`.

---

## 18. Debug map

| Symptom | First place to look |
|---|---|
| Backend crashes on boot | `server/.env` (`JWT_SECRET`, `BOT_TOKEN` are fatal) |
| Bot silent | `telegram.service.ts` `getActiveUser` / active channel / `botIsAdmin` |
| Channel listener silent | `TELEGRAM_*` keys, `isListeningTime`, active source list |
| Messages stuck in queue | Redis `PING`, `pm2 logs relay-server`, Bull cooldown key |
| Delivery failing | active destination `botIsAdmin`, `queuedmessages.error` |
| Panel login loop | cookie `relay_session`, `BACKEND_API_URL`, user role/active |
| Filters not applied | filter `isActive`, in-memory cache, `/refresh` |
| Wrong dates/times | `TIMEZONES`, `i18n/request.ts` fixed `Asia/Tehran` |
| 404 on a valid page | locale prefix (`/fa`) and `i18n/routing.ts` |
| Build cannot resolve `@repo/shared` | run `pnpm --filter @repo/shared build` |

---

## 19. Glossary

| Term | Meaning here |
|---|---|
| **Destination channel** | The single channel (`channels` collection, `isActive: true`) that receives forwarded posts. |
| **Source channel** | A channel the MTProto user account listens to (`sourceChannels`). |
| **Filters** | Ordered text transformations in the `filters` collection. |
| **Settings** | One global document controlling mention/URL stripping and the listening window. |
| **Listener** | The `teleproto` MTProto client that reads channel posts (distinct from the bot). |
| **Queue** | Bull queue `messageQueue` backed by Redis, plus the Mongo history collection. |
| **Panel / console** | The Next.js admin UI. |
