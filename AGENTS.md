# Relay Console agent guide

## Project structure

- `client/` contains the Next.js 15 App Router console, Tailwind CSS, TypeScript, and next-intl.
- `server/` contains the NestJS API and Telegram bot. MongoDB stores application data and Bull uses Redis for the message queue.
- `shared/` is the `@repo/shared` workspace package. Its public exports contain the API request and response types, roles, and filter logic used by both applications.
- `README.md` documents local setup and maps each console feature to the 37 REST endpoints.

## Editing the console

- Pages are under `client/src/app/[locale]/`. The `(panel)` group is the authenticated console. Reuse the components in `client/src/components/`.
- English is the default at unprefixed URLs such as `/login` and `/queue`. Persian uses `/fa/login` and `/fa/queue`. The locale layout sets the document language and text direction. The URL determines the language.
- Add each new user-facing string to both `client/messages/en.json` and `client/messages/fa.json` with the same key and ICU argument names. Use `getTranslations` in async Server Components and Server Actions, and `useTranslations` in synchronous components. Use the next-intl formatter for displayed numbers and dates.
- Use the navigation exports in `client/src/i18n/navigation.ts` for internal links. Use `getPathname` for native links, GET form destinations, and locale-aware revalidation paths. Server redirects go through `redirectInLocale`. The language switch retains the current path and query string.
- Use `pageMetadata` for localized titles, descriptions, canonical URLs, and language alternates. Keep the admin console's no-index settings. Use CSS logical properties for layout and verify left-to-right and right-to-left rendering.
- Keep API reads in `client/src/lib/queries.ts`, mutations in `client/src/lib/actions.ts`, and HTTP calls in the server-only `client/src/lib/api.ts`. Keep the bearer token in the existing HttpOnly session cookie flow. Keep internal API paths and request field names independent of locale.
- Check the corresponding Nest controller and DTO before changing a request or response. Share contract changes through `@repo/shared` and verify both consumers.

## Build and verify

Use Node.js 22 or newer and the pnpm version specified in the root `package.json`.

```sh
pnpm install --frozen-lockfile
pnpm build
pnpm --filter client lint
pnpm --filter client typecheck
pnpm --filter server test --runInBand
```

For local integration, copy the environment examples and configure MongoDB, Redis, and the Telegram credentials per `README.md`. Use `pnpm dev` and open `http://localhost:3000/login`. The API prefix is `/api` and the Swagger UI is at `http://localhost:3001/api/docs`. Keep credentials and generated build outputs out of source archives and commits.

After changing routing or a form, check direct access in both locales, unauthenticated redirects, the language switch on a detail page and on `/queue?limit=2`, and at least one successful and one rejected Server Action. Use an isolated database and bot fixture for write tests.
