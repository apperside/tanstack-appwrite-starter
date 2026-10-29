# TanStack Start + Appwrite Starter

A production-grade starting point for full-stack React apps on **[TanStack Start](https://tanstack.com/start)** and **[Appwrite](https://appwrite.io)**.

The official TanStack Start starter gives you routing, SSR and a demo page. This repo continues from there: authentication with server-side sessions, account management, a responsive app shell, i18n, a design system, an accessible form kit and a typed Appwrite data layer. It also ships with tests, performance budgets and a Docker image, so your first commit can be a feature of your own app.

> Built for self-hosted Appwrite (TablesDB API). It also works with Appwrite Cloud.
> The app talks to its backend only through small, typed ports, so Appwrite is one adapter among others: an in-memory backend ships too, and more can be plugged in. See [Backends](#backends).

---

## Contents

- [Features](#features)
- [What this adds to the TanStack Start starter](#what-this-adds-to-the-tanstack-start-starter)
- [Problems already solved for you](#problems-already-solved-for-you)
- [Quick start](#quick-start)
- [Configuration](#configuration)
- [Scripts](#scripts)
- [Project structure](#project-structure)
- [How it works](#how-it-works)
- [Backends](#backends)
- [Building your app on it](#building-your-app-on-it)
- [Testing](#testing)
- [Deployment](#deployment)
- [Performance budgets](#performance-budgets)
- [Known limitations](#known-limitations)
- [Contributing](#contributing)
- [License](#license)

---

## Features

**Authentication**
- Email + password sign-up and sign-in, sign-out, and **sign out everywhere**.
- **Guest mode.** Visitors can try the app without an account, then either:
  - **upgrade**: the guest adds an email and password, keeping the same user id and all its data;
  - **merge**: the guest signs in to an existing account, and a hook moves their data over.
- **Password recovery** and **email verification**. Verification can be enforced or just offered.
- Generic **onboarding** step that apps extend with their own steps.
- Route guards run on the server, so a signed-out user never sees a protected page flash.

**Account**
- **Profile:** name and email (changing the email requires the current password).
- **Security:** change password, list active sessions with the real browser and OS, sign out everywhere.
- **Preferences:** language and theme. Changes apply instantly with no reload, are saved to the account, and follow the user to other devices.

**UI**
- **Responsive app shell:** full sidebar on desktop, icon rail on tablet, drawer on mobile, all with safe-area insets. Layout is driven by CSS only, so there's no layout shift on load.
- **Light / dark / system** theme with no flash on first paint.
- Design tokens in OKLCH. Every text and focus-indicator pair is measured against WCAG contrast thresholds, and the ratios are recorded next to the tokens.
- [shadcn/ui](https://ui.shadcn.com) components (Radix), sonner toasts, lucide icons.
- **Accessible form kit** on TanStack Form:
  - validation on blur;
  - server errors mapped onto the right field;
  - password strength meter;
  - a submit button that can't double-submit.
- 44px touch targets on touch devices, reduced-motion support, a skip link, landmarks, and axe checks in tests.

**Internationalization**
- English and Italian out of the box, with **typed translation keys**: a missing key fails the build.
- Language is resolved on the server, from the account preference, then a cookie, then `Accept-Language`. Only the active language ships to the browser.

**Data**
- A typed Appwrite **TablesDB** wrapper: table name → row type inference, cursor pagination, bulk operations, owner permissions.
- Types are generated from your `appwrite.json` schema, with enums that work at runtime.
- Server-first data access with TanStack Query: data is prefetched in route loaders and present in the first paint.

**Engineering**
- TypeScript strict, Biome, knip (no unused files, exports or deps).
- ~600 unit and component tests with coverage thresholds.
- JS bundle and Lighthouse budgets enforced on the production build.
- A single `pnpm verify` runs every gate; git hooks run the fast ones.
- Multi-stage Docker image (Node 24, non-root) and docker-compose.

---

## What this adds to the TanStack Start starter

| Area | TanStack Start starter | This repo |
|---|---|---|
| Auth | — | SSR cookie sessions, guest/upgrade/merge, recovery, verification, onboarding, server-side route guards |
| Backend | — | Backend-neutral ports with Appwrite and in-memory adapters, contract tests; typed TablesDB wrapper and generated types for Appwrite |
| Data fetching | TanStack Query + SSR integration | One typed definition per query ([`tanstack-query-typed`](https://github.com/apperside/tanstack-query-typed)), loader prefetch, typed cache |
| Account | — | Profile, password, email, sessions, preferences |
| UI | Demo pages, basic Tailwind | Design system, responsive app shell, shadcn/ui kit, error / not-found / loading states |
| Forms | TanStack Form demo | Accessible form kit with server-error mapping |
| i18n | — | i18next, server-resolved locale, typed keys, en + it |
| Theme | Client-side toggle | Light/dark/system resolved on the server and saved to the account |
| Security | — | Rate limiting, trusted-proxy client IP, open-redirect protection, no account enumeration, API key never reaches the browser |
| Errors | — | One error model with stable codes and translated messages; unexpected errors logged on the server |
| Testing | — | Vitest + Testing Library + axe, handler tests on the memory backend, adapter contract suites, typed Appwrite fakes, coverage thresholds |
| Quality gates | — | Biome, knip, lefthook, bundle budget, Lighthouse CI, `pnpm verify` |
| Performance | — | Gzipped HTML, pre-compressed assets, code-split heavy pieces, translations inlined in the SSR payload |
| Deploy | — | Dockerfile, docker-compose, reverse-proxy guidance |

---

## Problems already solved for you

Building on TanStack Start and Appwrite brings up a set of non-obvious problems. These are handled, and each one has a test where it can be tested.

**Sessions and auth**
- **Third-party cookies.** Appwrite usually runs on another domain, so a browser-held Appwrite session breaks under Safari/ITP. Here the server creates the session and stores it in an **httpOnly cookie on your app's domain**. The browser only gets a short-lived JWT, and only if it needs realtime.
- **A session revoked elsewhere.** After "sign out everywhere" on another device or a password change, the app treats the next unauthorized response as "signed out", clears the cookie and sends the user to login. You never land on an error page with a Retry that can't work.
- **Guest upgrade order.** The new session is created before the guest session is deleted, so the user is never left without a session if a step fails.
- **Guest merge order.** Credentials are checked before anything is destroyed. Your merge hook runs while the guest still exists, and the new session is cleaned up if the hook fails.

**Security**
- **Rate limits bypassed by the API key.** Calls made with an Appwrite API key skip Appwrite's own rate limits, so sign-in, sign-up, guest and password reset have their own limiter, per IP and per IP + email.
- **Spoofable client IP.** `X-Forwarded-For` is only trusted for the number of proxies you configure (`TRUSTED_PROXY_HOPS`), so a forged header can't dodge the limits.
- **Open redirects.** `?redirect=//evil.com`, encoded variants, backslashes and `javascript:` all resolve to `/`.
- **Account enumeration.** Password reset answers the same way whether or not the email exists, including when the email can't be sent.
- **Secrets in the browser bundle.** Server-only code lives in `*.server.ts` files that TanStack Start refuses to bundle for the browser, and handlers are loaded through a dynamic import. The Node Appwrite SDK and the API key never reach the client bundle; this was checked by grepping the built bundle.

**Appwrite quirks**
- **Email verification refuses an API key.** Appwrite rejects `updateVerification` called with an API key, so it's confirmed with a credential-less client.
- **Every session shows the server's browser.** Sessions created server-side would otherwise show the server's user agent and location. The visitor's user agent is forwarded, and location is hidden because it would be the server's.
- **Enums with no runtime value.** The Appwrite CLI generates enums in a `.d.ts`, where they have no runtime value. The generated file is emitted as `.ts`, and row types accept both enum members and string literals.

**Rendering and hydration**
- **Theme, language, sidebar state and guest-banner dismissal** are all read from cookies on the server, so the first paint is right and nothing shifts or flashes.
- **i18n isolation.** One i18next instance per request on the server, so concurrent requests in different languages never mix.
- **New accounts keep their browsing language.** A new account or guest starts in the language and theme it was browsing in, and the account's preference wins on any new device.

**Errors**
- **One error model.** Every server failure becomes one of a few stable codes with a translated message.
- **Unexpected errors are logged** on the server with the function name, never shown raw to the user.

---

## Quick start

### Prerequisites

- **Node 24** and **pnpm**: the version is pinned in `package.json`, so `corepack enable` picks it up.
- An **Appwrite** instance (self-hosted 1.8+ / 2.x, or Cloud) with the TablesDB API.

### 1. Set up Appwrite

In the Appwrite console:

1. **Create a project.**
2. **Create a database** with id `app` (or change the id in `appwrite.json`). The tables come from the repo's `appwrite.json` in step 2 below; see [Data model](#data-model).
3. **Create an API key** with these scopes:
   - **Auth:** users read/write and sessions write;
   - **Databases:** read/write on tables and rows.

   This key stays on the server.
4. **Add a Web platform** with your app's hostname (`localhost` for development). The browser SDK needs it for realtime.
5. **Configure SMTP** (Settings → SMTP), or password recovery and email verification will fail with `SMTP Disabled`. Everything else works without it.

### 2. Run the app

```bash
git clone git@github.com:apperside/tanstack-appwrite-starter.git my-app
cd my-app
corepack enable
pnpm install
cp .env.example .env.local      # fill it in — never commit it
pnpm exec appwrite login        # once, for the CLI
# set "projectId" in appwrite.json, and VITE_APPWRITE_DATABASE_ID=app in .env.local
pnpm appwrite:push              # create the example tables in your project
pnpm appwrite:types             # generate types from appwrite.json
pnpm dev                        # http://localhost:3000
```

Open `http://localhost:3000`. You'll be redirected to `/login`; sign up, or continue as a guest.

**No Appwrite yet?** Run on the in-memory backend instead: `BACKEND=memory APP_URL=http://localhost:3000 pnpm dev`. Accounts live in the server process (gone on restart), and emailed links are printed to the server log.

---

## Configuration

All configuration lives in `.env.local`, validated at startup. A missing or invalid value fails fast with an error that names it.

| Variable | Scope | Description |
|---|---|---|
| `BACKEND` | server | The backend adapter: `appwrite` (default) or `memory` |
| `VITE_REQUIRE_EMAIL_VERIFICATION` | public | `true` keeps unverified users on `/verify-email` until they verify. Default `false`: verification is offered but not enforced |
| `APP_URL` | server | Public URL of the app, sub-path included. Recovery and verification links point here, and browsers without `Sec-Fetch-Site` may call server functions only from its origin (CSRF check) |
| `TRUSTED_PROXY_HOPS` | server | Number of reverse proxies in front of the app that append to `X-Forwarded-For`. Default `0` uses the socket address |

Each backend adapter validates its own variables, the first time it is used, so a backend you don't use needs none of them. For `BACKEND=appwrite`:

| Variable | Scope | Description |
|---|---|---|
| `VITE_APPWRITE_ENDPOINT` | public | Appwrite endpoint, e.g. `https://appwrite.example.com/v1` |
| `VITE_APPWRITE_PROJECT_ID` | public | Project id |
| `VITE_APPWRITE_DATABASE_ID` | public | Database id |
| `APPWRITE_API_KEY` | server | API key. Read only by server-only modules |

`VITE_*` values are inlined into the bundle at **build** time. The rest are read at **runtime** and never reach the browser.

---

## Scripts

| Command | What it does |
|---|---|
| `pnpm dev` | Dev server on `:3000` |
| `pnpm build` / `pnpm preview` | Production build into `.output/` / serve it |
| `pnpm test` / `pnpm test:watch` | Vitest with coverage thresholds / watch mode |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm lint` | Biome (lint + format check) |
| `pnpm knip` | Unused files, exports and dependencies |
| `pnpm check:js` | JS budget per public page (production build) |
| `pnpm lighthouse` | Lighthouse CI against the production build |
| `pnpm verify` | **All of the above, in order.** This is the definition of "green" |
| `pnpm appwrite:types` | Generate types from the local `appwrite.json` |
| `pnpm appwrite:pull` | Sync `appwrite.json` from your live project |
| `pnpm appwrite:push` | Create or update the tables in your project from `appwrite.json` |
| `pnpm generate-routes` | Regenerate the route tree (dev and build also do this) |

Git hooks ([lefthook](https://github.com/evilmartians/lefthook)): pre-commit formats and lints staged files, and pre-push runs typecheck and tests.

---

## Project structure

```
src/
  routes/                 File-based routes
    _public/              Login, signup, forgot password (signed-out zone)
    _authed/              Signed-in zone: onboarding
      _app/               App zone (shell): home, settings/*
    reset-password.tsx    Email-link pages work signed in or out
    verify-email.tsx
  features/               One folder per feature
    auth/                 Platform feature: sessions, guest, recovery, verification
    account/              Profile, security, sessions, preferences
    onboarding/
  core/                   The backend-neutral model: no vendor imports
    auth/                 User and session types, the auth ports, their contract tests
    data/                 One repository port per table, pagination, contract tests
    backend.ts            The `Backend` interface an adapter implements
    prefs.ts              Account preferences
  adapters/               One folder per backend, each implementing `Backend`
    appwrite/             Account/Users/TablesDB adapter, clients, generated types, realtime
    memory/               In-process backend for development, demos and tests
  server/                 Middleware, cookies, rate limiter, requireUser, hooks
    backend.server.ts     Picks the adapter named by `BACKEND`
  lib/                    Pure logic: guards, errors, redirect, theme, query client
  components/
    ui/                   shadcn/ui components
    form/                 Form kit (useAppForm, fields, errors)
    layout/               App shell, sidebar, auth layout, error states
  i18n/                   i18next setup, locale resolution, en/it JSON
  test/                   Test kit: fake server context, fixtures, render helpers
  config/env.ts           Validated environment
docs/
  smoke-checklist.md      Manual checks against a real Appwrite instance
```

---

## How it works

In short:

- **Sessions.**
  - Sign-in runs in a server function. The server asks the backend for a session and stores its token in an httpOnly, `SameSite=Lax` cookie.
  - On every request, `authMiddleware` turns that cookie into a per-request context:
    - `context.auth`: the backend's auth operations (sign in, sign up, links, admin);
    - `context.session()`: acts as the cookie's session (name, email, password, prefs, sign-out);
    - `context.data`: the repositories;
    - `context.getUser()`, memoized for the request.
- **Server-first data.** Pages read and write through TanStack Start server functions, which call the backend only through `context`. With Appwrite, the browser talks to it directly only for realtime, using a short-lived JWT.
- **Queries.** Each query is defined once with `appQueryOptions`, prefetched in the route loader with `ensureQueryData` and read with `useSuspenseQuery`, so data is part of the server-rendered HTML.
- **Guards.** `beforeLoad` on the route zones calls one pure function, `resolveGuardRedirect`, on both server and client:
  - signed out → `/login`;
  - email unverified (if required) → `/verify-email`;
  - onboarding not done → `/onboarding`.
- **Errors.** Handlers just throw. The middleware turns every failure into an `AppError` with a stable code and a translation key, lets router redirects through, and logs anything unexpected.
- **Preferences.** A signed-in user's language and theme are stored with their account (Appwrite: account prefs). Cookies are only a cache so the first paint is right, and only the server writes them.

---

## Backends

The app never imports a vendor SDK outside `src/adapters/`. Everything it needs from a backend is a port in `src/core/`:

- **`AuthService` / `SessionAuth` / `AdminAuth`** (`src/core/auth/ports.ts`): sign-up, sign-in, guests and their upgrade, sessions, email and password changes, emailed links, preferences, and deleting users or sessions. Each method documents the `AppError` codes it may reject with.
- **Repositories** (`src/core/data/`): one per table, e.g. `TodoRepository`. They take the owner's id and check ownership themselves, so they don't depend on a backend's permission model.
- **`Backend`** (`src/core/backend.ts`) bundles them: `auth(request)` per request, `data` for the process.

The surface started from what Appwrite can do, and grows when a feature needs more. Three rules keep it portable:

- **Types are the app's.** `User`, `AuthSession`, `DeviceSession` and `Todo` are mapped from the vendor's shapes inside the adapter; `$id`, `Models.User` and friends never leave it.
- **Ports describe outcomes, not vendor steps.** Upgrading a guest is one method, because Appwrite does it with two sessions while the memory backend keeps one. Policy that doesn't depend on the vendor (rate limits, cookies, hooks, not revealing whether an email exists) stays in the handlers.
- **Adapters reject only with `AppError` codes.** The Appwrite adapter translates its exceptions (`translateErrors`), keeping the original as the error's `cause` for the logs.

Emailed links are opaque: the backend appends its credential to the URL it is given (Appwrite adds `userId` and `secret`, the memory backend adds `token`), `/verify-email` and `/reset-password` pass every query parameter back untouched, and the adapter reads its own.

**Shipped adapters**

| `BACKEND` | What it is |
|---|---|
| `appwrite` | Account, Users and TablesDB APIs, with the API key on the server. Realtime in the browser through `withBrowserClient` (Appwrite only) |
| `memory` | Everything in the server process: no service to run, nothing survives a restart, one store per server instance. Emails go to the server log. For development, demos, end-to-end runs and the test suite |

**Adding a backend**

1. Create `src/adapters/<name>/` with a `createXBackend(): Backend` that implements the ports (start from `src/adapters/memory/`, the smallest complete one).
2. Run the contract suites against it, the same way `src/adapters/memory/backend.server.test.ts` does: `describeAuthContract("<name>", ...)` and `describeTodosContract("<name>", ...)`. They pin the behavior every adapter must share.
3. Add the name to `BACKENDS` in `src/config/env.ts` and a case in `src/server/backend.server.ts`. Each adapter is imported on demand, so a server only loads the one it runs.

---

## Building your app on it

### Conventions

- **Server-only code** lives in `*.server.ts`; the build fails if browser code imports it.
  - **Server functions** (`<feature>.functions.ts`) are thin `createServerFn` definitions that **dynamically import** their handler, so handler code never ships to the browser.
  - **Handlers** (`<feature>.handlers.server.ts`) hold the logic and get the backend only from `context` (`context.auth`, `context.session()`, `context.data`), never from imports. That keeps them backend-neutral and trivially testable.
- **Features are self-contained.** `auth` is the one platform feature others may import (its hooks, queries, schemas and server functions). Server logic that several features need lives in `src/server`.
- **One definition per query** with `appQueryOptions`, registered in the typed query registry.
- **Mutations:**
  - anything that changes who is signed in, or their account, uses `useAuthMutation`, which refreshes the user and re-runs the guards;
  - theme and language use `usePreference`;
  - everything else uses `useMutation` and invalidates the affected queries.
- **No hard-coded UI strings.** Everything goes through i18n with typed keys, and a parity test keeps the languages in step.
- **Design tokens only.** Never raw colours. A new colour is a token in `src/styles.css`, defined for light and dark, with its contrast recorded.

### Adding a feature

Example: a `notes` feature.

1. **Repository.** Describe the table in `src/core/data/notes.ts` (`Note` type and `NoteRepository` port, scoped by owner like `TodoRepository`), add a contract suite next to it, and add it to `AppData` in `src/core/backend.ts`. Then implement it in each adapter:
   - **Appwrite:** add the table to `appwrite.json` with row security on (or create it in the console and run `pnpm appwrite:pull`), run `pnpm appwrite:push` and `pnpm appwrite:types`, register it in `src/adapters/appwrite/app-models.ts` (`App*` type, `AppTablesTypeMap`, `APP_TABLES`), and write `notes.server.ts` like `todos.server.ts`.
   - **Memory:** write `notes.server.ts` like `src/adapters/memory/todos.server.ts`.
2. **Feature folder** `src/features/notes/`:
   - `notes.schemas.ts`: zod schemas shared by the form and the server function.
   - `notes.handlers.server.ts`: handlers that start with `const user = await requireUser(context)` and use `context.data.notes` with `user.id`.
   - `notes.handlers.server.test.ts`: tests with `createTestContext()`.
   - `notes.functions.ts`: one `createServerFn(...).middleware([authMiddleware]).validator(schema)` per handler, dynamically importing the handler.
   - `notes.queries.ts`: `appQueryOptions` plus the registry entries.
   - `components/`: the page, with `useSuspenseQuery` and `useAppForm`.
3. **Strings:** `src/i18n/locales/{en,it}/notes.json`.
4. **Route:** `src/routes/_authed/_app/notes.tsx`, with a loader that calls `ensureQueryData` and a skeleton `pendingComponent`. Add it to `src/components/layout/app-navigation.ts`.
5. Run **`pnpm verify`**.

### Guest merge hook

When a guest signs in to an existing account, the starter calls `serverHooks.onGuestMerge` in `src/server/server-hooks.server.ts`, then deletes the guest user. Move the guest's data there, through the repositories, so the hook works on any backend. The default moves the example table:

```ts
export const serverHooks = {
  async onGuestMerge({ guestUserId, userId, data }) {
    await data.todos.transferOwnership(guestUserId, userId);
    // await data.notes.transferOwnership(guestUserId, userId);
  },
};
```

The hook must be **idempotent**: if it throws, the guest is kept and the user can retry. A guest who *upgrades* keeps the same user id, so no hook runs.

### Data model

With Appwrite, `appwrite.json` is the schema. The repo ships a minimal `todos` table (title, completed, priority, due date, owner) as an example, in a database with id `app`.

1. Set `projectId` in `appwrite.json` (it ships with the placeholder `your-project-id`).
2. `pnpm appwrite:push` creates the tables in your project.
3. `pnpm appwrite:types` generates `src/adapters/appwrite/generated/appwrite.ts` from the local file.

Replace `todos` with your own tables in `appwrite.json` and run `pnpm appwrite:types` again. If you edit the schema in the console instead, `pnpm appwrite:pull` syncs the file.

---

## Testing

```bash
pnpm test          # unit + component tests with coverage
pnpm test:watch
pnpm verify        # everything, including the production build and budgets
```

- **Server handlers** are tested with `createTestContext()`: the real request context over a fresh **memory backend**, so a test signs up, emails a link and follows it for real (`seedUser()`, `seedGuest()`, `lastLink("recovery")`). Every port method is a spy that calls through, to assert on calls or make one fail (`session.updatePrefs.mockRejectedValueOnce(...)`).
- **Adapters** run the shared **contract suites** (`describeAuthContract`, `describeTodosContract`). The Appwrite adapter is also tested against SDK fakes **typed against the real SDK** (`src/test/appwrite-fakes.ts`), so a signature change in the SDK breaks the tests at compile time; errors are genuine `AppwriteException`s (`appwriteError("user_invalid_credentials")`).
- **Components** are tested with Testing Library through `renderWithProviders()` (i18n + Query), and every page-level test runs an **axe** accessibility check.
- **Coverage thresholds:** ≥ 90% on server, core and logic code, ≥ 85% branches on adapters, ≥ 80% on components.
- **What fakes can't prove** (real permissions, real emails) is covered by the [smoke checklist](docs/smoke-checklist.md), which you run against a real Appwrite instance.

---

## Deployment

```bash
docker compose --env-file .env.local up --build    # app on :3000
```

- `--env-file` is required: the `VITE_*` values become build arguments. Server secrets are read at runtime from `env_file` and never enter the image.
- The compose file runs only the app; Appwrite runs separately.
- **Behind a reverse proxy** (TLS, a domain):
  - set `TRUSTED_PROXY_HOPS` to the number of proxies that append to `X-Forwarded-For`, usually `1`, otherwise rate limiting sees the proxy's IP for everyone;
  - set `APP_URL` to the public URL.
- Without Docker: `pnpm build && node .output/server/index.mjs`, with the environment set.

---

## Performance budgets

`pnpm verify` fails if the production build breaks these:

- **≤ 200 KB gzip** of JavaScript per public page (`pnpm check:js`);
- **Lighthouse mobile ≥ 0.95** in every category, with **LCP ≤ 2.5 s** and **CLS ≤ 0.05** (`pnpm lighthouse`, median of 5 runs).

Current numbers: about 187 KB per public page, performance 0.98, accessibility / best practices / SEO 1.0, CLS 0.

The stack alone (React, TanStack Router/Start/Query, i18next) is about 134 KB gzip before any app code, which sets the floor. The biggest lever left is swapping `react-dom` for `preact/compat` (roughly −50 KB). The budgets act as regression guards: raise them only with a reason.

---

## Known limitations

- **Single instance.** The rate limiter is in memory. Running several instances would need a shared store, such as Redis.
- **No end-to-end tests yet.** Everything is unit- and component-tested with typed fakes. Flows that need a real backend are in the manual smoke checklist.
- **No CI pipeline yet.** `pnpm verify` is the command a CI job would run.
- **Two languages.** Adding one means adding a locale folder and registering it.
- **Sessions show no location.** Sessions are created server-side, so Appwrite only sees the server's IP; location is hidden rather than shown wrong.
- **Permission errors and expired sessions look alike.** Appwrite reports both a permission denial and an expired session as unauthorized. Before your feature writes to tables, make sure a forbidden write isn't treated as "signed out".

---

## Contributing

Issues and pull requests are welcome.

1. Fork and create a branch.
2. Follow the [conventions](#conventions). A new feature comes with handler tests and an axe check on its page.
3. Run **`pnpm verify`**: it must be green, budgets included.
4. Open a PR describing what changed and why.

---

## License

See [LICENSE](LICENSE).
