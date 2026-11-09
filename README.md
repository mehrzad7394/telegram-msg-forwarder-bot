# Relay Console

Telegram message forwarding management panel. The frontend is located in the `client` directory and supports English and Persian through `next-intl`. English is the default language, while Persian pages use the `/fa` route prefix.

## Project Structure

| Path | Description |
| --- | --- |
| `client/` | Next.js App Router frontend, TypeScript, Tailwind CSS, and Server Actions |
| `server/` | NestJS REST API, Telegram message processing, MongoDB, and Bull/Redis |
| `shared/` | API request and response types, roles, filter operations, and shared utilities |

## Local Development

Requirements:
- Node.js 22 or later
- pnpm 10
- MongoDB
- Redis
- Telegram bot token

The required pnpm version is specified in `packageManager`.

```sh
pnpm install --frozen-lockfile
cp server/.env.example server/.env
cp client/.env.local.example client/.env.local
```

Configure the following values in `server/.env`:

- `MONGO_URI`
- Redis connection settings
- `BOT_TOKEN`
- `JWT_SECRET`
- Initial administrator's Telegram ID
- A strong initial password

The initial administrator username is `admin`.

Run the following commands:

```sh
pnpm --filter @repo/shared build
pnpm --filter server setup-admin
pnpm dev
```

The management panel is available at:

- Frontend: [http://localhost:3000/login](http://localhost:3000/login)
- Swagger documentation: [http://localhost:3001/api/docs](http://localhost:3001/api/docs)

For separate deployment or execution, configure `BACKEND_API_URL` with the `/api` prefix and set `SITE_URL` to the actual public URL. Both variables are server-side environment variables.

`SITE_URL` must be available during the build process to ensure that canonical URLs, Open Graph metadata, and Twitter Cards use the correct public address.

## Build and Production

```sh
pnpm build
pnpm --filter client lint
pnpm --filter client typecheck
```

After building, start the applications in separate terminals:

```sh
pnpm --filter server start:prod
pnpm --filter client start
```

## Interface Languages and Development Guidelines

- English login page: `/login`
- Persian login page: `/fa/login`
- Changing the language preserves the current page and its query parameters.
- Translation files are located at:
  - `client/messages/en.json`
  - `client/messages/fa.json`

Development guidelines, project architecture, and testing instructions are documented in [AGENTS.md](AGENTS.md).

## API Coverage

All API routes are accessed through the `/api` prefix.

- Read operations are defined in `client/src/lib/queries.ts`.
- Write operations are defined in `client/src/lib/actions.ts`.
- All API requests are executed on the Next.js server.
- Sessions are stored in HttpOnly cookies.
- JWT authentication tokens are forwarded from the Next.js server to NestJS.

### API Endpoints

| Panel Section | Method and Routes |
| --- | --- |
| Overview | `GET /`, `GET /health` |
| Authentication and Admin Account | `POST /auth/login`, `GET /auth/profile`, `POST /auth/setup-password`, `POST /auth/logout` |
| Channels | `GET /channels`, `GET /channels/active`, `GET /channels/stats`, `GET /channels/:id`, `POST /channels`, `PUT /channels/:id`, `DELETE /channels/:id`, `PUT /channels/:id/set-active` |
| Filters | `GET /filters`, `GET /filters/active`, `GET /filters/:id`, `POST /filters`, `PUT /filters/:id`, `DELETE /filters/:id`, `PUT /filters/:id/activate`, `PUT /filters/:id/deactivate` |
| Users | `GET /users`, `GET /users/stats`, `GET /users/:id`, `POST /users`, `PUT /users/:id`, `DELETE /users/:id`, `PUT /users/:id/activate`, `PUT /users/:id/deactivate`, `PUT /users/:id/promote`, `PUT /users/:id/demote` |
| Message Queue | `GET /queue/stats`, `GET /queue/messages?limit=50`, `POST /queue/cleanup` |
| Processing Settings | `GET /setting`, `PUT /setting` |

### Important Implementation Details

- Creating a channel in the backend automatically sets that channel as the active destination.
- Queue cleanup removes old records with `sent` or `failed` statuses from MongoDB message history.
- Queue statistics reflect the status of Bull jobs stored in Redis.
- Having the administrator role alone is not sufficient to access the panel. The administrator account must also have a password.
- The password setup endpoint is intended for authenticated administrator accounts.

## Security and Search Engine Visibility

The management panel is private and configured to prevent search engine indexing through:

- `robots` metadata
- The `X-Robots-Tag` HTTP header
- `robots.txt`