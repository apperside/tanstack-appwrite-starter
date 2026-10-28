# Foundations (TanStack Start + Appwrite boilerplate) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the TanStack Start starter into a reusable, production-grade boilerplate with Appwrite auth (signup, login, guest, recovery, verification), account settings, a responsive app shell, i18n and local quality gates.

**Architecture:** Appwrite is called **only from TanStack Start server functions**, through per-request clients that `authMiddleware` puts in the server-function `context`. The session secret lives in an httpOnly cookie on the app domain. Pages prefetch data in route loaders with `tanstack-query-typed` definitions and read it with `useSuspenseQuery`. Every server function is an exported, unit-tested **handler** plus its wiring.

**Tech Stack:** TanStack Start 1.169 / Router / Query 5, `tanstack-query-typed@0.2.0`, `node-appwrite@31.0.0`, `appwrite@29.1.0`, `appwrite-cli@28.9.0` (dev), zod 4, TanStack Form, Tailwind v4, shadcn/ui (from Reperio), i18next, Vitest + Testing Library + vitest-axe, Biome, knip, lefthook, size budget script, Lighthouse CI, Docker.

**Spec:** `docs/superpowers/specs/2026-10-28-foundations-design.md`
**Task breakdown (scheduler CSV):** `docs/tasks/2026-10-28-foundations.csv`. Each task below lists the CSV ids it covers.

## Prerequisites

- `tanstack-query-typed@0.2.0` must be **approved on npm** (it's staged, id `d856d355-ebff-4891-930f-4e2466219ce6`) before Task 4.
- `.env.local` exists with the real values (§10 of the spec). The API key is never committed.
- SMTP configured on the Appwrite instance (needed only for the manual smoke checklist in Task 34).

## Global Constraints

- TypeScript strict; **no `any`** (Biome `noExplicitAny` = error); Biome clean; knip clean.
- Package manager **pnpm**; exact versions pinned for `appwrite`, `node-appwrite`, `appwrite-cli`, `tanstack-query-typed`.
- `APPWRITE_API_KEY` is read **only** in `*.server.ts` files.
- Appwrite is never called from route components or loaders directly: only from server-function handlers (and `withBrowserClient` for realtime/trivial UI state).
- Every user-visible string goes through i18next (`en` and `it`, keys typed). No hard-coded UI copy.
- No raw color values in components; only design tokens.
- Breakpoints: **375 / 768 / 1024 / 1440**. Touch targets ≥ **44px**. No horizontal scroll.
- Budgets: Lighthouse mobile ≥ **95** in every category, LCP < **1.5 s**, CLS < **0.05**, initial JS ≤ **120 KB gzip** on public/auth pages.
- Coverage: ≥ **90%** lines/branches on `src/lib/**`, `src/server/**`, `src/features/**/*.functions.ts`; ≥ **80%** on components.
- Session cookie: `HttpOnly`, `Secure` (unless `APP_URL` is `http://localhost…`), `SameSite=Lax`, `Path=/`, `Expires` = the session's `expire`.
- Passwords: min **8**, max **256** characters.
- `REQUIRE_EMAIL_VERIFICATION` defaults to `false`.
- Commits: conventional commits, one per task (or per step where stated), ending with the session's attribution lines.

## Deviations from the spec (decided while planning)

1. **The session cookie and rate limiter are injected through `context`** (`context.sessionCookie`, `context.rateLimit`) instead of module-mocking `session-cookie.server.ts`. Tests need no `vi.mock` for handlers at all, which is stricter than the spec's §9.1 allowance.
2. **`context.getUser()` is lazy and memoized per request** instead of an eager `context.user`. Server functions that don't need the user don't pay for an `account.get()`.
3. **`/verify-email` and `/reset-password` are top-level routes** that use `AuthLayout`, not part of `_public`/`_authed`. Email links must work whether you're signed in or not. `_authed` therefore holds only `onboarding` and `_app`.
4. **The env var is `VITE_REQUIRE_EMAIL_VERIFICATION`** (public). Route guards run on the client too, and the value isn't secret.
5. **Generated types live in `src/lib/appwrite/generated/`** (whatever file name the CLI emits) instead of `models.gen.ts`.

## Review Focus

1. **A session that's expired or was revoked elsewhere** (e.g. "sign out everywhere" on another device). The next request must be treated as signed out: cookie cleared, redirect to `/login`, never an error page. Pinned in Task 11.
2. **Redirect param abuse**: `//evil.com`, `/\evil.com`, `https://evil.com`, `%2F%2Fevil.com`, `javascript:alert(1)` all resolve to `/`, while `/settings/security?tab=1` survives intact. Pinned in Task 12.
3. **Guests on email-only actions.** A guest calling `changePassword`, `changeEmail` or `sendVerification` gets `FORBIDDEN`, and the UI offers "save your account" instead of those forms. Pinned in Tasks 21 and 31.
4. **Double submit.** Double-clicking "Sign in" or "Create account" sends exactly one request, because the button is disabled while the mutation is pending. Pinned in Task 25.
5. **Expired, reused or malformed email links** (`/reset-password` or `/verify-email` with a missing or invalid `userId`/`secret`). The page shows a clear message and a "send a new link" action instead of crashing or showing a generic error. Pinned in Task 29.

---

## File map

```
src/
  config/env.ts                       # T3  zod env (public + server)
  lib/
    appwrite/
      generated/                      # T5  CLI output (do not edit)
      app-models.ts                   # T5  App* types, AppTablesTypeMap, APP_TABLES, AppPrefs, AppUser
      payload.ts (+ .test.ts)         # T6
      permissions.ts (+ .test.ts)     # T7
      app-tables.ts (+ .test.ts)      # T7  AppTables, AdminTables, MAX_PAGE_SIZE
      server-client.server.ts         # T8
      browser-client.ts (+ .test.ts)  # T15
      jwt-session.ts (+ .test.ts)     # T15
    errors.ts (+ .test.ts)            # T9  AppError, AppErrorCode, toAppError
    redirect.ts (+ .test.ts)          # T12 sanitizeRedirect
    query-client.ts                   # T4
    guards.ts (+ .test.ts)            # T14 resolveGuardRedirect
    password-strength.ts (+ .test.ts) # T25
  server/
    context.ts                        # T10 ServerContext, HandlerArgs
    session-cookie.server.ts          # T10
    rate-limit.server.ts (+ .test.ts) # T12
    auth-middleware.server.ts (+test) # T11
    server-hooks.server.ts            # T19 onGuestMerge (app extension point)
  features/
    auth/   auth.schemas.ts  auth.functions.ts (+ .test.ts)  auth.queries.ts  use-auth-mutation.ts  components/
    account/ account.schemas.ts account.functions.ts (+ .test.ts) account.queries.ts components/
    onboarding/ onboarding.functions.ts (+ .test.ts) components/
  components/ ui/ (T23)  form/ (T25)  layout/ (T26, T27)
  i18n/ i18n.ts  locale.ts (+ .test.ts)  locales/{en,it}/{common,auth,account,errors}.json  (T24)
  test/ setup.ts  appwrite-error.ts  fixtures.ts  test-context.ts  render.tsx   (T2, T9, T10, T25)
  routes/
    __root.tsx                        # T13, T22, T24, T26
    _public/route.tsx login.tsx signup.tsx forgot-password.tsx            # T26, T28, T29
    reset-password.tsx  verify-email.tsx                                  # T29
    _authed/route.tsx  onboarding.tsx                                     # T14, T30
    _authed/_app/route.tsx  index.tsx                                     # T14, T27
    _authed/_app/settings/route.tsx index.tsx profile.tsx security.tsx preferences.tsx  # T31
scripts/check-initial-js.ts           # T33
docs/reference/work-scheduler.ts      # T1
docs/smoke-checklist.md               # T34
Dockerfile  docker-compose.yml  .dockerignore                             # T32
.env.example  knip.json  lefthook.yml  lighthouserc.json  vitest.config.ts
```

---

## Feature: Project setup and tooling

### Task 1: Remove starter demo code (CSV 3)

**Files:**
- Delete: `src/components/{Header,Footer,demo.FormComponents}.tsx`, `src/hooks/demo.*`, `src/lib/demo-store*.ts*`, `src/routes/demo/`, `src/routes/about.tsx`
- Move: `src/lib/work-scheduler.ts` → `docs/reference/work-scheduler.ts`
- Modify: `src/routes/__root.tsx` (drop Header/Footer/StoreDevtools; render devtools only when `import.meta.env.DEV`), `src/routes/index.tsx` (temporary "Hello" placeholder, replaced in T27)

**Interfaces:** Produces a starter with no demo code. `docs/reference/` is outside `tsconfig` `include`.

- [ ] **Step 1:** Delete and move the files. Remove the demo store deps (`@tanstack/store`, `@tanstack/react-store`) if nothing else imports them.
- [ ] **Step 2:** Run `pnpm generate-routes && pnpm build`. Expected: build succeeds, and `src/routeTree.gen.ts` has no `/demo` or `/about` routes.
- [ ] **Step 3:** Commit `chore: remove starter demo code; park work-scheduler in docs/reference`.

### Task 2: Test and lint tooling (CSV 5, 6)

**Files:**
- Create: `vitest.config.ts`, `src/test/setup.ts`, `knip.json`, `lefthook.yml`, `src/lib/smoke.test.ts` (deleted in Step 6)
- Modify: `package.json` (scripts, devDeps), `biome.json` (`suspicious.noExplicitAny: "error"`)

**Interfaces:** Produces the scripts `typecheck` (`tsc --noEmit`), `lint` (`biome check .`), `knip`, `test` (`vitest run --coverage`), `test:watch`, and `verify` (in this task: `typecheck && lint && knip && test && build`; extended in T33).

- [ ] **Step 1:** Add devDeps: `vitest`, `@vitest/coverage-v8`, `jsdom`, `@testing-library/react`, `@testing-library/user-event`, `@testing-library/jest-dom`, `vitest-axe`, `knip`, `lefthook`.
- [ ] **Step 2:** `vitest.config.ts`: a separate config, **not** the Start Vite config. It uses `@vitejs/plugin-react` + `resolve.tsconfigPaths`. Two projects: `node` for `src/**/*.test.ts` and `jsdom` for `src/**/*.test.tsx`, both with `setupFiles: ['src/test/setup.ts']`. Coverage thresholds come from Global Constraints (per glob). `setup.ts` imports `@testing-library/jest-dom/vitest` and `vitest-axe/extend-expect`.
- [ ] **Step 3:** Write `src/lib/smoke.test.ts` with `expect(1 + 1).toBe(2)`. Run `pnpm test`. Expected: 1 passed.
- [ ] **Step 4:** `knip.json`: entries `src/router.tsx`, `src/routes/**/*.tsx`, `vite.config.ts`, `vitest.config.ts`, `scripts/*.ts`; ignore `src/lib/appwrite/generated/**` and `src/routeTree.gen.ts`. `lefthook.yml`: pre-commit `biome check --write --staged --no-errors-on-unmatched` (stage fixed files), pre-push `pnpm typecheck && pnpm test`. Run `pnpm lefthook install`.
- [ ] **Step 5:** Run `pnpm verify`. Expected: all green. Fix anything the starter code trips on.
- [ ] **Step 6:** Delete `smoke.test.ts` and commit `chore: vitest, knip, lefthook and verify script`.

### Task 3: Validated environment (CSV 4)

**Files:** Create `src/config/env.ts`, `src/config/env.test.ts`, `.env.example`.

**Interfaces:**
- Produces `publicEnv: { APPWRITE_ENDPOINT: string; APPWRITE_PROJECT_ID: string; APPWRITE_DATABASE_ID: string; REQUIRE_EMAIL_VERIFICATION: boolean }`, read from `import.meta.env.VITE_*`.
- Produces `serverEnv(): { APPWRITE_API_KEY: string; APP_URL: string }`. It's lazy, parses `process.env` once, and is only imported by `*.server.ts`.
- Produces `parsePublicEnv(raw: Record<string, unknown>)` and `parseServerEnv(raw)`, exported for tests.

- [ ] **Step 1: Failing tests**:
  - `parsePublicEnv` rejects a missing endpoint, with an error naming `VITE_APPWRITE_ENDPOINT`;
  - it coerces `VITE_REQUIRE_EMAIL_VERIFICATION` `'true'`/`'false'`/absent to `true`/`false`/`false`;
  - `parseServerEnv` rejects a non-URL `APP_URL`.
- [ ] **Step 2:** Run `pnpm vitest run src/config`. Expected: FAIL (module missing).
- [ ] **Step 3:** Implement with zod (`z.url()` for URLs, `z.stringbool().default(false)` for the flag). `.env.example` lists every key with no values.
- [ ] **Step 4:** Run the tests. Expected: PASS. Commit `feat(config): zod-validated environment`.

### Task 4: Typed query client (CSV 8)

**Files:** Create `src/lib/query-client.ts`. Modify `src/router.tsx`, `src/integrations/tanstack-query/root-provider.tsx`, `src/routes/__root.tsx` (context type), `package.json`.

**Interfaces:**
- Produces `createQueryClient(): QueryClient` with defaults `staleTime: 30_000` and `retry: (count, error) => count < 2 && toAppError(error).code === 'NETWORK'`. (`toAppError` arrives in T9; until then use `retry: 1` and replace it in T9.)
- Produces a router context `{ queryClient: TypedQueryClient }` (via `asTypedQueryClient`). `setupRouterSsrQueryIntegration` receives the raw client.

- [ ] **Step 1:** `pnpm add tanstack-query-typed@0.2.0 appwrite@29.1.0 node-appwrite@31.0.0` and `pnpm add -D appwrite-cli@28.9.0`.
- [ ] **Step 2:** Wire `createQueryClient` into the router. Set `MyRouterContext.queryClient: TypedQueryClient` and keep `defaultPreload: 'intent'`.
- [ ] **Step 3:** Run `pnpm typecheck && pnpm build`. Expected: green. Commit `feat: typed query client in router context`.

## Feature: Appwrite layer

### Task 5: Generated types and app models (CSV 10)

**Files:** Create `src/lib/appwrite/generated/*` (CLI output) and `src/lib/appwrite/app-models.ts`. Modify `package.json` (script `appwrite:types`).

**Interfaces:**
- Produces `AppDocument<T>` (Polybank's definition: omits Appwrite metadata, `$id` optional), `AppTablesTypeMap` (table id → `App*` row type for all 8 tables in the live `taskmanager` db), and `APP_TABLES` (`as const` map of the same ids).
- Produces `AppPrefs`, an **interface** so apps can extend it by declaration merging: `{ onboardingCompleted: boolean; locale: Locale; theme: ThemePreference }`, with `Locale = 'en' | 'it'` and `ThemePreference = 'light' | 'dark' | 'system'`.
- Produces `DEFAULT_PREFS: AppPrefs` = `{ onboardingCompleted: false, locale: 'en', theme: 'system' }` and `AppUser = Models.User<AppPrefs & Models.Preferences>`.

- [ ] **Step 1:** Script `appwrite:types` = `appwrite pull tables --all && appwrite types --language ts src/lib/appwrite/generated`. The CLI must be authenticated once, non-interactively, with `appwrite client --endpoint … --project-id … --key …` (values from `.env.local`; this is a local CLI config and is not committed). Run it. Expected: `appwrite.json` is refreshed from the live schema and the generated file(s) appear.
- [ ] **Step 2:** Write `app-models.ts`. Run `pnpm typecheck`. Expected: green.
- [ ] **Step 3:** Commit `feat(appwrite): generated schema types and app models` (including the refreshed `appwrite.json`).

### Task 6: Payload helpers (CSV 11)

**Files:** Create `src/lib/appwrite/payload.ts` and `payload.test.ts`. Port `aw-wrapper-utils.ts` and its test (`aw-wrapper-utils.test.ts`) from Polybank.

**Interfaces:** Produces `patchAppwritePayload<T extends object>(obj: T): T` and `patchAppwriteResponseObject<T extends object[]>(rows: T): T`. Same behavior as Polybank: strip metadata keys, `undefined`→`null`, recurse into plain objects, never mutate the input.

- [ ] **Step 1:** Port the Polybank test file unchanged apart from imports and run it. Expected: FAIL (module missing).
- [ ] **Step 2:** Port the implementation as named exports (no default-export object). Run the test. Expected: PASS. Commit `feat(appwrite): payload helpers (ported from Polybank)`.

### Task 7: Typed tables wrapper (CSV 12, 13)

**Files:** Create `src/lib/appwrite/permissions.ts`, `app-tables.ts`, and tests for each.

**Interfaces:**
- Produces `ownerPermissions(userId: string): string[]`, which returns `[read, update, delete]` for `Role.user(userId)`.
- Produces `class AppTables`, the Polybank API with positional args, binding `databaseId`:
  - `getRow(tableId, rowId, queries?)`
  - `listRows(tableId, queries?) → { rows, total }`
  - `listAllRows(tableId, queries?) → rows[]`
  - `createRow(tableId, rowId, row, permissions?, transactionId?)`
  - `updateRow(...)`, `upsertRow(...)` with the same args
  - `deleteRow(tableId, rowId, transactionId?)`

  Write methods pass the payload through `patchAppwritePayload`. The constructor takes `TablesDB` (either SDK; typed as the `node-appwrite` one, as in Polybank) plus `databaseId`.
- Produces `class AdminTables extends AppTables` with `bulkCreateRows(tableId, rows, ownerId, transactionId?)`, `bulkUpsertRows(tableId, rows, ownerId, transactionId?)` and `deleteRows(tableId, queries, transactionId?)`. Bulk writes stamp `ownerPermissions(ownerId)`. **The owner is an explicit parameter**, not read from global request state. Failures are collected in `{ success, errors, rows }`.
- Produces `MAX_PAGE_SIZE`, a constant measured in Step 1.

- [ ] **Step 1: Measure.** With a throwaway script using the admin key, call `listRows` on `tasks` with `Query.limit(n)` for n = 5000, 1000, 500, 100. Set `MAX_PAGE_SIZE` to the largest accepted value and note the result in a one-line comment.
- [ ] **Step 2: Failing tests** (TablesDB faked with typed `vi.fn`s):
  - `listAllRows` requests `Query.limit(MAX_PAGE_SIZE)` and then `Query.cursorAfter(lastId)` until a short page arrives, and concatenates in order;
  - `createRow` sends a patched payload (no `$createdAt`; `undefined`→`null`);
  - `bulkUpsertRows` with 2 rows for owner `u1` sends rows whose `$permissions` equal `ownerPermissions('u1')`;
  - a rejected batch ends up in `errors` and doesn't throw.
- [ ] **Step 3:** Implement. Run the tests. Expected: PASS. Commit `feat(appwrite): typed tables wrapper with cursor pagination`.

### Task 8: Server clients (CSV 14)

**Files:** Create `src/lib/appwrite/server-client.server.ts`. Modify `src/lib/appwrite/app-models.ts` (export `AppClient`).

**Interfaces:**
- Produces `type AppClient<K extends 'server' | 'admin'> = { client: Client; account: Account; tables: TablesDB & { typed: K extends 'admin' ? AdminTables : AppTables } } & (K extends 'admin' ? { users: Users } : {})`. Types come from `node-appwrite`.
- Produces `createUserClient(sessionSecret: string): AppClient<'server'>` (uses `setSession`) and `createAdminClient(): AppClient<'admin'>` (uses `setKey(serverEnv().APPWRITE_API_KEY)`). Both are new on every call.

- [ ] **Step 1:** Implement them. They're thin wiring, covered through T11's middleware tests. Run `pnpm typecheck`. Expected: green.
- [ ] **Step 2:** Commit `feat(appwrite): per-request user and admin clients`.

### Task 9: Error model (CSV 15)

**Files:** Create `src/lib/errors.ts`, `src/lib/errors.test.ts` and `src/test/appwrite-error.ts`. Modify `src/lib/query-client.ts` (retry policy from T4).

**Interfaces:**
- Produces `AppErrorCode = 'INVALID_CREDENTIALS' | 'EMAIL_TAKEN' | 'WEAK_PASSWORD' | 'INVALID_TOKEN' | 'UNAUTHENTICATED' | 'FORBIDDEN' | 'RATE_LIMITED' | 'NOT_FOUND' | 'NETWORK' | 'UNKNOWN'`.
- Produces `class AppError extends Error`, constructed with `(code: AppErrorCode)`. Its `message` **is the code**, so the code survives server-function serialization. `i18nKey` is `` `errors:${code}` ``.
- Produces `toAppError(error: unknown): AppError`. It's idempotent, recognizes an `Error` whose `message` is a known code (the client side of a server fn), and maps `AppwriteException.type` like this:
  - `user_invalid_credentials`, `user_password_mismatch` → `INVALID_CREDENTIALS`
  - `user_already_exists`, `user_email_already_exists` → `EMAIL_TAKEN`
  - `password_recently_used`, `password_personal_data`, `user_password_recently_used`, `user_password_personal_data` → `WEAK_PASSWORD`
  - `user_invalid_token` → `INVALID_TOKEN`
  - `user_unauthorized`, `general_unauthorized_scope`, `user_session_not_found`, `user_jwt_invalid` → `UNAUTHENTICATED`
  - `general_rate_limit_exceeded` → `RATE_LIMITED`
  - `row_not_found`, `document_not_found`, `user_not_found` → `NOT_FOUND`

  A `TypeError` from `fetch` maps to `NETWORK`. Anything else maps to `UNKNOWN`.
- Produces `appwriteError(type: string, code?: number): AppwriteException`, the test helper. It builds a **real** `AppwriteException`.

- [ ] **Step 1:** Check each `type` string above against Appwrite's error list (`appwrite/app/config/errors.php` on the 1.8/2.x branch matching the instance, version 2.6.1). Fix any names that don't exist.
- [ ] **Step 2: Failing tests:** one `it.each` row per mapping above; an `Error('RATE_LIMITED')` maps back to `RATE_LIMITED`; `toAppError(new AppError('FORBIDDEN'))` returns the same instance; `new TypeError('Failed to fetch')` maps to `NETWORK`; a plain object maps to `UNKNOWN`.
- [ ] **Step 3:** Implement and switch the query client to the retry policy from T4. Run the tests. Expected: PASS. Commit `feat: AppError model and Appwrite error mapping`.

## Feature: Session and server infrastructure

### Task 10: Server context, session cookie, test kit (CSV 16, 18)

**Files:** Create `src/server/context.ts`, `src/server/session-cookie.server.ts`, `src/test/fixtures.ts`, `src/test/test-context.ts`, `src/test/test-context.test.ts`.

**Interfaces:**
- Produces this context type:
  ```ts
  type ServerContext = {
    appwrite: { user(): AppClient<'server'>; admin(): AppClient<'admin'> }; // user() throws AppError('UNAUTHENTICATED') without a session
    getUser(): Promise<AppUser | null>;                                     // memoized per request
    sessionCookie: SessionCookie;
    clientIp: string;
    rateLimit(bucket: RateLimitBucket, key: string): void;                  // throws AppError('RATE_LIMITED')
  };
  type HandlerArgs<TInput> = { data: TInput; context: ServerContext };
  ```
- Produces `SessionCookie = { read(): string | undefined; write(session: { secret: string; expire: string }): void; clear(): void }` and `requestSessionCookie(): SessionCookie`, the real implementation over `getCookie` / `setCookie` / `deleteCookie` from `@tanstack/react-start/server`. The cookie name is the constant `SESSION_COOKIE = 'app_session'`, with attributes from Global Constraints.
- `RateLimitBucket` is defined in T12. Declare it here as an import of a type-only stub, or define the union here and have T12 import it.
- Produces the fixtures `aUser(overrides?)`, `aGuest(overrides?)` (empty email), `aSession(overrides?)` (with `secret` and `expire` one year ahead) and `aJwt()`. They return `AppUser` / `Models.Session` / `Models.Jwt`.
- Produces `createTestContext(options?: { user?: AppUser | null })`. It returns a `ServerContext` whose `appwrite.user().account`, `appwrite.admin().account`, `.users` and `.tables` are objects of `vi.fn<Account['method']>()` (typed against `node-appwrite` classes, not loosely typed), plus fakes `sessionCookie` (in-memory, with `.value` for assertions) and `rateLimit` (`vi.fn`). It also returns `{ userAccount, adminAccount, adminUsers }` handles, so tests stub `mockResolvedValue` directly.

- [ ] **Step 1: Failing tests** (`test-context.test.ts`): `createTestContext({ user: aUser() }).getUser()` resolves to that user; with `user: null`, `appwrite.user()` throws `AppError('UNAUTHENTICATED')`; `sessionCookie.write(aSession())` sets `.value` and `clear()` resets it.
- [ ] **Step 2:** Implement the context types, the cookie module and the test kit. Run the tests. Expected: PASS.
- [ ] **Step 3:** Commit `feat(server): server context, session cookie and typed test kit`.

### Task 11: Auth middleware (CSV 19)

**Files:** Create `src/server/auth-middleware.server.ts` and `auth-middleware.test.ts`.

**Interfaces:**
- Consumes `createUserClient`, `createAdminClient`, `requestSessionCookie`, `createRateLimiter` (T12; until T12 lands, wire a no-op `rateLimit`).
- Produces `buildServerContext(deps: { sessionCookie: SessionCookie; clientIp: string; createUserClient; createAdminClient; rateLimit }): ServerContext`. This is the pure builder, and it's what the tests exercise.
- Produces `authMiddleware = createMiddleware({ type: 'function' }).server(({ next }) => next({ context: buildServerContext({ … real deps, clientIp: getRequestIP({ xForwardedFor: true }) ?? 'unknown' }) }))`.

- [ ] **Step 1: Failing tests** for `buildServerContext`:
  - with no cookie, `getUser()` resolves `null` **without calling Appwrite**;
  - with a cookie, `getUser()` calls `account.get` once even if awaited twice (memoized);
  - **(Review Focus 1)** when `account.get` rejects with `appwriteError('user_session_not_found', 401)` or `user_unauthorized`, `getUser()` resolves `null` **and** the session cookie is cleared;
  - any other rejection is rethrown as an `AppError`;
  - `appwrite.user()` without a cookie throws `UNAUTHENTICATED`.
- [ ] **Step 2:** Implement. Run the tests. Expected: PASS. Commit `feat(server): auth middleware with lazy, memoized user`.

### Task 12: Rate limiter and redirect sanitizer (CSV 20, 21)

**Files:** Create `src/server/rate-limit.server.ts`, `rate-limit.test.ts`, `src/lib/redirect.ts`, `redirect.test.ts`.

**Interfaces:**
- Produces `createRateLimiter({ limit, windowMs, now = Date.now }): { hit(key: string): { allowed: boolean; retryAfterMs: number } }`. It's a sliding window that prunes expired timestamps on every hit.
- Produces `RateLimitBucket = 'signIn' | 'signInEmail' | 'signUp' | 'guest' | 'passwordReset'` and `AUTH_RATE_LIMITS: Record<RateLimitBucket, { limit: number; windowMs: number }>`:
  - `signIn` 20 per 15 min (per IP)
  - `signInEmail` 5 per 15 min (per IP + email)
  - `signUp` 5 per hour (per IP)
  - `guest` 10 per hour (per IP)
  - `passwordReset` 5 per hour (per IP + email)
- Produces `rateLimit(bucket, key): void`, which throws `new AppError('RATE_LIMITED')`. One module-level limiter per bucket. This gets wired into `buildServerContext`.
- Produces `sanitizeRedirect(value: unknown): string`.

- [ ] **Step 1: Failing tests:**
  - **limiter** (with an injected `now`): 5 hits are allowed and the 6th isn't, with `retryAfterMs` > 0; after the window passes it's allowed again; keys are independent.
  - **sanitizer (Review Focus 2):** `'/settings/security?tab=1'` is kept as-is; each of `'//evil.com'`, `'/\\evil.com'`, `'https://evil.com'`, `'%2F%2Fevil.com'`, `'javascript:alert(1)'`, `''`, `undefined` and `42` becomes `'/'`.
- [ ] **Step 2:** Implement. The sanitizer decodes once, requires a leading `/`, and rejects a second character of `/` or `\`. Wire `rateLimit` into the middleware. Run the tests. Expected: PASS.
- [ ] **Step 3:** Commit `feat(server): auth rate limiter and redirect sanitizer`.

### Task 13: Current user query and root prefetch (CSV 22)

**Files:** Create `src/features/auth/auth.functions.ts`, `auth.functions.test.ts`, `auth.queries.ts`. Modify `src/routes/__root.tsx`.

**Interfaces:**
- Produces `getCurrentUserHandler({ context }) → Promise<AppUser | null>` and `getCurrentUser = createServerFn({ method: 'GET' }).middleware([authMiddleware]).handler(getCurrentUserHandler)`.
- Produces `issueBrowserJwtHandler({ context }) → Promise<{ jwt: string }>` (via `account.createJWT()`) and `issueBrowserJwt`.
- Produces `currentUserQuery = appQueryOptions(['currentUser'], { queryFn: () => getCurrentUser(), staleTime: Infinity })`. The registry entry is `currentUser: { response: Awaited<ReturnType<typeof getCurrentUser>> }`, in `auth.queries.ts`.
- `__root.tsx` `beforeLoad`: `const user = await context.queryClient.ensureQueryData(currentUserQuery); return { user }`. The root route context gains `user: AppUser | null`.

- [ ] **Step 1: Failing tests:** `getCurrentUserHandler` returns `null` for `createTestContext({ user: null })` and the user otherwise; `issueBrowserJwtHandler` returns `{ jwt }` from `userAccount.createJWT`.
- [ ] **Step 2:** Implement, then run the tests. Expected: PASS. Run `pnpm dev`, open `/` without a cookie, and check the SSR HTML includes the dehydrated `currentUser: null` (no client refetch in the Network tab).
- [ ] **Step 3:** Commit `feat(auth): current user query prefetched in root`.

### Task 14: Route guards (CSV 23)

**Files:** Create `src/lib/guards.ts`, `guards.test.ts`, `src/routes/_authed/route.tsx`, `src/routes/_authed/_app/route.tsx`, `src/routes/_public/route.tsx` (an `<Outlet/>` for now; AuthLayout comes in T26). Move the temporary index from `src/routes/index.tsx` to `src/routes/_authed/_app/index.tsx`.

**Interfaces:**
- Produces `type GuardZone = 'public' | 'authed' | 'app' | 'onboarding'`.
- Produces `resolveGuardRedirect(input: { zone: GuardZone; user: AppUser | null; requireEmailVerification: boolean; location: string }): string | null`. Rules:
  - `public` with a user → `'/'`;
  - `authed`/`app`/`onboarding` without a user → `` `/login?redirect=${encodeURIComponent(location)}` ``;
  - `app` with `requireEmailVerification`, a non-guest user and `!user.emailVerification` → `'/verify-email'`;
  - `app` with `!prefs.onboardingCompleted` → `'/onboarding'`;
  - `onboarding` with onboarding completed → `'/'`;
  - otherwise `null`.
- Produces `isGuest(user: AppUser): boolean`, which is `user.email === ''`.
- The layout routes call it in `beforeLoad` with `context.user` and `publicEnv.REQUIRE_EMAIL_VERIFICATION`, and `throw redirect({ href })` when the result isn't null.

- [ ] **Step 1: Failing tests:** one `it.each` row per rule, plus: a guest with verification required isn't sent to `/verify-email`; the email check comes before the onboarding check.
- [ ] **Step 2:** Implement the function and the layout routes. Run the tests. Expected: PASS. Run `pnpm dev`: `/` with no cookie redirects to `/login?redirect=%2F`.
- [ ] **Step 3:** Commit `feat(routing): pure route guards and layout zones`.

### Task 15: Browser client (CSV 24)

**Files:** Create `src/lib/appwrite/jwt-session.ts`, `jwt-session.test.ts`, `browser-client.ts`, `browser-client.test.ts`.

**Interfaces:**
- Produces `createJwtSession({ issueJwt: () => Promise<string>; maxAgeMs = 10 * 60_000; now = Date.now }): { getJwt(): Promise<string>; invalidate(): void }`.
- Produces `withBrowserClient<T>(run: (client: { client: Client; account: Account; tables: TablesDB & { typed: AppTables } }) => Promise<T>): Promise<T>`. On the first call it creates the `appwrite` SDK client and sets the JWT from `issueBrowserJwt()`. When `run` rejects with an `AppwriteException` with `code === 401`, it invalidates, sets a fresh JWT and retries **once**. Nothing is created at import time.

- [ ] **Step 1: Failing tests:**
  - **jwt-session:** two concurrent `getJwt()` calls invoke `issueJwt` once; after `maxAgeMs` it's issued again; `invalidate()` forces a new issue.
  - **browser-client** (with `issueBrowserJwt` passed as an injectable dependency): a 401 from `run` triggers exactly one retry with a new JWT; a second 401 is rethrown as `AppError('UNAUTHENTICATED')`.
- [ ] **Step 2:** Implement, then run the tests. Expected: PASS. Commit `feat(appwrite): lazy JWT-authenticated browser client`.

## Feature: Auth server functions

All handlers live in `src/features/auth/auth.functions.ts`. Schemas live in `auth.schemas.ts` and are reused by forms. Every server function is `createServerFn({ method: 'POST' }).middleware([authMiddleware]).validator(schema).handler(handler)`. Tests use `createTestContext` only.

### Task 16: Sign up and sign in (CSV 26)

**Interfaces:**
- Produces the schemas `emailSchema` (trimmed, lower-cased, `z.email()`), `passwordSchema` (8–256), `nameSchema` (trimmed, 1–128), `signInSchema { email, password }` and `signUpSchema { name, email, password }`.
- Produces `signInHandler({ data, context }) → Promise<AppUser>`. It calls `rateLimit('signIn', ip)` and `rateLimit('signInEmail', ip + email)`, then `admin.account.createEmailPasswordSession({ email, password })`, `sessionCookie.write(session)`, and returns the user read with `createUserClient(session.secret).account.get()`.
- Produces `signUpHandler({ data, context }) → Promise<AppUser>`. It calls `rateLimit('signUp', ip)`, then `admin.account.create({ userId: ID.unique(), email, password, name })`, then creates the session and writes the cookie as above. On the user client it calls `account.updatePrefs({ prefs: DEFAULT_PREFS })` and `account.createVerification({ url: APP_URL + '/verify-email' })`. A failed verification email is logged and does **not** fail signup.

- [ ] **Step 1: Failing tests:**
  - **sign in:** valid credentials write the cookie with `aSession().secret` and return the user; `appwriteError('user_invalid_credentials', 401)` rejects with `AppError` `INVALID_CREDENTIALS` and leaves the cookie untouched; when `rateLimit` throws, Appwrite is never called.
  - **sign up:** prefs equal `DEFAULT_PREFS`; the verification URL ends with `/verify-email`; `user_already_exists` maps to `EMAIL_TAKEN`; a rejected `createVerification` still resolves the user.
- [ ] **Step 2:** Implement, then run the tests. Expected: PASS. Commit `feat(auth): sign up and sign in`.

### Task 17: Sign out, sign out everywhere, sessions (CSV 27, part of 33)

**Interfaces:**
- Produces `signOutHandler`: user `account.deleteSession({ sessionId: 'current' })`, then `sessionCookie.clear()`, always clearing the cookie even if Appwrite rejects.
- Produces `signOutEverywhereHandler`: `account.deleteSessions()`, then clear the cookie.
- Produces `listSessionsHandler → Promise<SessionInfo[]>` in `src/features/account/account.functions.ts`, with `SessionInfo = { id; current; clientName; osName; deviceName; countryName; createdAt }`, sorted current first and then newest.
- Produces `sessionsQuery = appQueryOptions(['sessions'], …)`.

- [ ] **Step 1: Failing tests:** sign-out clears the cookie even when `deleteSession` rejects; sign out everywhere calls `deleteSessions` and clears the cookie; `listSessions` maps fields and puts the current session first.
- [ ] **Step 2:** Implement, then run the tests. Expected: PASS. Commit `feat(auth): sign out, sign out everywhere, list sessions`.

### Task 18: Guest session and upgrade (CSV 28)

**Interfaces:**
- Produces `startGuestSessionHandler`: `rateLimit('guest', ip)`, then admin `account.createAnonymousSession()`, write the cookie, set `DEFAULT_PREFS`, and return the user.
- Produces `upgradeGuestHandler(signUpSchema)`. It requires `isGuest(user)` (otherwise `FORBIDDEN`). Then: user client `account.updateEmail({ email, password })` and `account.updateName({ name })`; `deleteSession('current')`; admin `createEmailPasswordSession`; write the new cookie. It returns the user, **whose `$id` equals the guest's id**.

- [ ] **Step 1: Failing tests:** guest start writes the cookie and prefs; upgrade on a non-guest rejects `FORBIDDEN`; upgrade calls `updateEmail` before `updateName`, swaps the cookie to the new session secret, and returns the same `$id`; `EMAIL_TAKEN` propagates.
- [ ] **Step 2:** Implement, then run the tests. Expected: PASS. Commit `feat(auth): guest sessions and guest upgrade`.

### Task 19: Guest merge into an existing account (CSV 29)

**Files:** Also create `src/server/server-hooks.server.ts`.

**Interfaces:**
- Produces `serverHooks: { onGuestMerge(args: { guestUserId: string; userId: string; admin: AppClient<'admin'> }): Promise<void> }`, a plain exported object whose default `onGuestMerge` does nothing. Apps replace the implementation in this file.
- Produces `signInAndMergeGuestHandler(signInSchema)`. It requires a guest (otherwise `FORBIDDEN`). The order is fixed: create the email session (admin, so credentials are validated **before** anything is destroyed); `serverHooks.onGuestMerge(...)`; admin `users.delete({ userId: guestUserId })`; write the new cookie; return the user.

- [ ] **Step 1: Failing tests:** wrong credentials reject `INVALID_CREDENTIALS`, and neither the hook nor `users.delete` is called; on success the hook receives both ids **before** `users.delete`; if the hook rejects, the guest isn't deleted and the error propagates (as `UNKNOWN`) with the cookie unchanged.
- [ ] **Step 2:** Implement, then run the tests. Expected: PASS. Commit `feat(auth): sign in and merge guest data`.

### Task 20: Password reset and email verification (CSV 30, 31)

**Interfaces:**
- Produces `requestPasswordResetHandler({ email })`: `rateLimit('passwordReset', ip + email)`, then admin `account.createRecovery({ email, url: APP_URL + '/reset-password' })`. It **always resolves `{ ok: true }`**: `NOT_FOUND` is swallowed so accounts can't be enumerated, and other errors are rethrown.
- Produces `resetPasswordHandler({ userId, secret, password })`: admin `account.updateRecovery(...)`. Expired or invalid → `INVALID_TOKEN`.
- Produces `sendVerificationHandler`: a guest → `FORBIDDEN`; otherwise user client `account.createVerification({ url: APP_URL + '/verify-email' })`.
- Produces `confirmVerificationHandler({ userId, secret })`: admin `account.updateVerification(...)`, with an invalid link → `INVALID_TOKEN`. Afterwards the client invalidates `currentUser`.
- Produces the schemas `requestResetSchema`, `resetPasswordSchema`, `confirmVerificationSchema` (`userId`/`secret` non-empty strings).

- [ ] **Step 1: Failing tests:** an unknown email still resolves `{ ok: true }`; the recovery URL ends with `/reset-password`; `user_invalid_token` maps to `INVALID_TOKEN` in both confirm handlers; a guest calling `sendVerification` is `FORBIDDEN` (Review Focus 3); empty `userId`/`secret` fail schema validation.
- [ ] **Step 2:** Implement, then run the tests. Expected: PASS. Commit `feat(auth): password recovery and email verification`.

### Task 21: Account handlers and onboarding (CSV 32, 33)

**Files:** `src/features/account/account.functions.ts`, `account.schemas.ts`, `account.functions.test.ts`, `src/features/onboarding/onboarding.functions.ts` (+ test).

**Interfaces:**
- Produces `changePasswordHandler({ currentPassword, newPassword })` → `account.updatePassword({ password: newPassword, oldPassword: currentPassword })`. Guest → `FORBIDDEN`.
- Produces `changeEmailHandler({ email, password })` → `account.updateEmail(...)`, then `createVerification`. Guest → `FORBIDDEN`.
- Produces `changeNameHandler({ name })` → `account.updateName(...)`.
- Produces `updatePreferencesHandler(Partial<AppPrefs>)` → read `getPrefs()` fresh, merge, `updatePrefs`, then return the merged prefs. When `locale` or `theme` is present it also writes the `locale` / `theme` cookies (1 year, `SameSite=Lax`, **not** httpOnly, so the theme script can read them). The cookies are written through a `context`-injected `preferenceCookies` added to `ServerContext` and `createTestContext`.
- Produces `completeOnboardingHandler({ name? })` → optionally `updateName`, then `updatePreferences({ onboardingCompleted: true })`.

- [ ] **Step 1: Failing tests:** a wrong current password maps to `INVALID_CREDENTIALS`; a guest is `FORBIDDEN` on password and email changes (Review Focus 3); a preferences update merges with the **fresh** prefs (stub `getPrefs` with a value that differs from `context` user prefs and assert the merged payload); a theme change writes the `theme` cookie; `completeOnboarding` sets `onboardingCompleted: true`.
- [ ] **Step 2:** Implement, then run the tests. Expected: PASS. Commit `feat(account): profile, security, preferences and onboarding handlers`.

## Feature: Design system and app shell

### Task 22: Tokens, font and theme (CSV 35, 37)

**Files:** Modify `src/styles.css` and `src/routes/__root.tsx`. Create `src/lib/theme.ts` and `theme.test.ts`.

**Interfaces:**
- Produces Tailwind v4 `@theme` semantic tokens in OKLCH: `--color-{background,foreground,card,card-foreground,popover,popover-foreground,primary,primary-foreground,secondary,secondary-foreground,muted,muted-foreground,accent,accent-foreground,destructive,destructive-foreground,border,input,ring,sidebar,sidebar-foreground,sidebar-accent,sidebar-border}`, `--radius` (0.625rem), a light theme in `:root` and a dark one in `.dark`. These are the token names shadcn components expect.
- Produces font `@fontsource-variable/inter` (latin), with `font-display: swap` and a `<link rel="preload">` for the latin woff2 in `head()`.
- Produces `themeInitScript(cookieName = 'theme'): string`, which replaces the starter's script and reads the cookie instead of localStorage, and `resolveTheme(pref: ThemePreference, prefersDark: boolean): 'light' | 'dark'`.

- [ ] **Step 1: Failing tests:** `resolveTheme('system', true) === 'dark'`, `resolveTheme('light', true) === 'light'`; the script string contains no `localStorage`.
- [ ] **Step 2:** Implement. Check token contrast with a quick check (e.g. `apca-w3` or WebAIM). Every foreground/background pair must reach WCAG AA (4.5:1 for text). Record the measured ratios in a comment block above the tokens.
- [ ] **Step 3:** Run `pnpm dev` and toggle the `theme` cookie by hand to `dark` / `light` / unset. There's no flash on reload in any of the three. Commit `feat(ui): design tokens, Inter and no-flash theme`.

### Task 23: shadcn/ui components (CSV 36)

**Files:** Create `src/components/ui/{button,input,label,card,alert,alert-dialog,avatar,dropdown-menu,separator,sheet,sidebar,skeleton,sonner,tabs,tooltip}.tsx`, `src/hooks/use-mobile.ts`, `src/lib/cn.ts`.

**Interfaces:** Produces the shadcn components with their standard exports, `cn(...classes)` (clsx + tailwind-merge), and `useIsMobile()` with a 768 breakpoint.

- [ ] **Step 1:** Copy the files from `/Users/simone/dev/reperio/src/components/ui/`. Rewrite their imports to the `#/` alias. Install exactly the Radix/`class-variance-authority`/`clsx`/`tailwind-merge`/`sonner`/`lucide-react` packages they import, and nothing else.
- [ ] **Step 2:** Run `pnpm typecheck && pnpm knip`. Expected: green. Any component knip reports as unused gets removed. Commit `feat(ui): shadcn components from Reperio`.

### Task 24: i18n (CSV 42, 43)

**Files:** Create `src/i18n/i18n.ts`, `locale.ts`, `locale.test.ts`, `parity.test.ts`, `locales/{en,it}/{common,auth,account,errors}.json`, `src/i18n/i18next.d.ts`. Modify `src/routes/__root.tsx`.

**Interfaces:**
- Produces `resolveLocale({ prefsLocale?, cookieLocale?, acceptLanguage? }): Locale`. Order: prefs → cookie → the best `Accept-Language` match by q-weight → `'en'`. Invalid values are skipped.
- Produces `getRequestLocale = createServerFn({ method: 'GET' }).middleware([authMiddleware]).handler(…)`, which combines `getUser()` prefs, the `locale` cookie and the `accept-language` header.
- Produces `loadI18n(locale: Locale): Promise<i18n>`, which dynamic-imports **only** that locale's namespaces and creates an instance per request on the server (no shared global instance on the server).
- `__root.tsx` `beforeLoad` adds `locale`, `head()`/shell sets `<html lang={locale}>`, and `I18nextProvider` wraps the app.
- Types: `CustomTypeOptions.resources` = typeof en resources, so `t('auth:login.title')` type-checks.

- [ ] **Step 1: Failing tests:**
  - `resolveLocale`: prefs `it` wins over cookie `en`; with no prefs, cookie `it` wins over `Accept-Language: en`; `'fr-FR,it;q=0.8,en;q=0.5'` gives `'it'`; a garbage cookie `'xx'` falls back through to `'en'`.
  - `parity.test.ts`: the flattened key sets of `en` and `it` are equal for every namespace.
- [ ] **Step 2:** Implement. Seed `errors.json` with one key per `AppErrorCode` and `common.json` with app name, actions and states. Run the tests. Expected: PASS.
- [ ] **Step 3:** Run `pnpm dev` with the browser language set to Italian and no cookie. The page renders `lang="it"` from SSR, with no hydration warning in the console. Commit `feat(i18n): server-resolved locale, typed keys, en/it`.

### Task 25: Form kit (CSV 45, 46)

**Files:** Create `src/components/form/{form-kit.ts,text-field.tsx,password-field.tsx,submit-button.tsx,form-error.tsx}`, `src/lib/password-strength.ts`, tests for each, and `src/test/render.tsx`. Delete `src/hooks/demo.*` leftovers if any remain.

**Interfaces:**
- Produces `useAppForm`, created with TanStack Form `createFormHook`. `fieldComponents: { TextField, PasswordField }`, `formComponents: { SubmitButton, FormError }`.
- `TextField` props are `{ label: string; type?: 'text' | 'email'; autoComplete: string; description?: string }`. The label and error are wired through `aria-describedby` and `aria-invalid`. Errors are shown only once the field is touched (validation `onBlur`, then `onChange` after the first error).
- `PasswordField` props are `{ label; autoComplete: 'current-password' | 'new-password'; showStrength?: boolean }`, with a show/hide toggle that has an `aria-label`.
- `SubmitButton` reads `form.state.isSubmitting`. It's disabled and shows a spinner while submitting, and has a minimum height of 44px.
- `FormError` renders the form-level `onSubmit` error as `t(toAppError(err).i18nKey)` in an `Alert`.
- Produces `withServerErrors(form, error, fieldForCode?: Partial<Record<AppErrorCode, string>>)`, which maps an `AppError` to a field error (e.g. `EMAIL_TAKEN` → `email`) or to the form error.
- Produces `scorePassword(pw: string): 0 | 1 | 2 | 3 | 4`. Length ≥ 8 gives 1, ≥ 12 gives +1, each of mixed case / digit / symbol gives +1, capped at 4.
- Produces `renderWithProviders(ui, { locale = 'en' })` in `src/test/render.tsx` (i18n + QueryClient).

- [ ] **Step 1: Failing tests** (using a tiny test form with `email` + `password` fields):
  - an invalid email shows its error only after blur;
  - **(Review Focus 4)** double-clicking submit calls `onSubmit` once, and the button is disabled while the promise is pending;
  - `withServerErrors` with `EMAIL_TAKEN` puts the translated message on `email`;
  - the password toggle switches `type` between `password` and `text`;
  - `axe(container)` has no violations;
  - `scorePassword`: `'abcdefgh'`→1, `'Abcdefgh1!'`→4 (capped), `''`→0.
- [ ] **Step 2:** Implement, then run the tests. Expected: PASS. Commit `feat(forms): accessible form kit on TanStack Form`.

### Task 26: Auth layout, guest banner, feedback states (CSV 39, 40)

**Files:** Create `src/components/layout/{auth-layout,guest-banner,route-error,not-found}.tsx` with tests, and `src/features/auth/use-auth-mutation.ts` with a test. Modify `src/routes/_public/route.tsx`, `src/router.tsx` (`defaultErrorComponent`, `defaultNotFoundComponent`) and `__root.tsx` (`<Toaster/>`).

**Interfaces:**
- Produces `AuthLayout({ title, subtitle?, children, footer? })`: a centered card `max-w-sm` from ≥ 640px and full-bleed below.
- Produces `GuestBanner()`: rendered when `isGuest(user)`. It's dismissible for the session (state in `sessionStorage`, read in an effect, so there's no SSR mismatch) and its CTA links to `/signup?upgrade=1`.
- Produces `RouteError({ error, reset })`, which shows `t(toAppError(error).i18nKey)` and a "Try again" button calling `router.invalidate()`.
- Produces `useAuthMutation(definition)`: `useMutation` from `tanstack-query-typed`. On success it invalidates `['currentUser']`, `await router.invalidate()`, then calls the caller's `onSuccess`. This is the one place auth state gets refreshed.
- Produces `PageSkeleton({ variant: 'form' | 'list' | 'card' })`, which matches the final layouts' dimensions. It's registered as the router's `defaultPendingComponent` with `defaultPendingMs: 300` and `defaultPendingMinMs: 200`, so fast navigations never flash a skeleton.

- [ ] **Step 1: Failing tests:** `RouteError` renders the translated `NETWORK` message and retry calls `invalidate`; `GuestBanner` hides after dismissal; `useAuthMutation` invalidates `currentUser` once per success.
- [ ] **Step 2:** Implement, then run the tests. Expected: PASS. Commit `feat(ui): auth layout, guest banner, error and not-found states`.

### Task 27: Responsive app shell, user menu, home (CSV 38, 56)

**Files:** Create `src/components/layout/{app-shell,app-sidebar,user-menu,mobile-header}.tsx` and `app-shell.test.tsx`. Modify `src/routes/_authed/_app/route.tsx` and `index.tsx`.

**Interfaces:**
- Produces `AppShell({ children })`, built on shadcn `SidebarProvider` / `Sidebar collapsible="icon"`. Sidebar state is `'auto' | 'expanded' | 'collapsed'`, read on the server from the `sidebar_state` cookie and passed in from the `_app` loader:
  - **`auto`:** CSS media queries alone decide, so there's no layout shift: icon rail (64px) at 768–1023 and full width (260px) at ≥ 1024.
  - An explicit toggle writes `expanded`/`collapsed` to the cookie, which overrides the media queries.
  - Below 768 the sidebar is a `Sheet` opened from `MobileHeader`, with `env(safe-area-inset-*)` padding.
- Produces `appNavigation: { to: string; labelKey: string; icon: LucideIcon }[]`, the single nav config (Home, Settings) shared by the sidebar and the mobile sheet.
- Produces `UserMenu`: an avatar (initials) with a dropdown containing name/email (or "Guest"), Settings, Theme submenu and Sign out. Sign out runs `useAuthMutation(signOut)` and then navigates to `/login`.
- Home: a welcome card with `t('common:home.welcome', { name })`.

- [ ] **Step 1: Failing tests:**
  - `useIsMobile` true → nav renders inside a dialog (Sheet) after opening the menu button;
  - `appNavigation` items all render with translated labels;
  - Sign out calls the mutation once;
  - `axe` is clean.
- [ ] **Step 2:** Implement, then run the tests. Expected: PASS.
- [ ] **Step 3:** Run `pnpm dev`, signed in (create a user via the signup page once T28 exists, or test this step after T28). Take screenshots at 375 / 768 / 1024 / 1440 in light and dark. No overflow, the rail shows at 768, the full sidebar at 1440, and toggling persists across reloads with no shift. Commit `feat(ui): responsive app shell, user menu and home`.

## Feature: Pages

Each page is a route file plus a component in `src/features/<x>/components/`. It uses `useAppForm` + `useAuthMutation` + the schema from `*.schemas.ts`, and is tested with `renderWithProviders`, with the feature's `*.functions.ts` replaced via `vi.mock` (the second place the spec allows it). Each test file includes `axe`.

### Task 28: Login and signup (CSV 48, 49)

**Interfaces:**
- `/login` (`_public/login.tsx`, search `{ redirect?: string }`): `LoginForm` → `signIn` → `navigate({ href: sanitizeRedirect(redirect) })`. It has links to `/signup` and `/forgot-password` and a "Continue as guest" button (`startGuestSession` → `/onboarding`).
- `/signup` (search `{ upgrade?: '1' }`): `SignupForm` → `signUp` → `/onboarding`. With `upgrade=1` **and** a guest user it calls `upgradeGuest` instead and goes to `/`, and its secondary action is "I already have an account" → login form in merge mode (`signInAndMergeGuest`).
- Field mapping: `EMAIL_TAKEN` → `email`, `WEAK_PASSWORD` → `password`, `INVALID_CREDENTIALS` → form error.

- [ ] **Step 1: Failing tests:** a successful login navigates to the sanitized redirect (`'//evil.com'` → `/`); `INVALID_CREDENTIALS` shows the form error; signup with `upgrade=1` as a guest calls `upgradeGuest` and not `signUp`; signup shows a strength meter on the password field.
- [ ] **Step 2:** Implement, then run the tests. Expected: PASS. Commit `feat(auth): login and signup pages`.

### Task 29: Forgot, reset and verify pages (CSV 50, 51)

**Interfaces:**
- `/forgot-password`: an email form → `requestPasswordReset`. It **always** shows the same confirmation copy afterwards.
- `/reset-password` (top-level, search `{ userId?: string; secret?: string }`): if either is missing, it shows the "invalid link" state with a link to `/forgot-password`. Otherwise it shows the new-password form with strength meter → `resetPassword` → toast + `/login`. `INVALID_TOKEN` switches to the "invalid link" state.
- `/verify-email` (top-level, search `{ userId?; secret? }`): with params, it auto-confirms once on mount (`confirmVerification`) → success state → link to `/`. `INVALID_TOKEN` gives the invalid state with "send a new link", which needs a signed-in user (otherwise it goes to `/login?redirect=/verify-email`). Without params and signed in, it shows a "check your inbox" state with a resend button (`sendVerification`). Without params and signed out, it redirects to `/login`.

- [ ] **Step 1: Failing tests (Review Focus 5):** `/reset-password` with no `secret` renders the invalid-link state without calling `resetPassword`; `resetPassword` rejecting `INVALID_TOKEN` renders the invalid state; `/verify-email` with params calls `confirmVerification` exactly once even under React StrictMode double-mount; the forgot-password confirmation copy is identical for success and for an `{ ok: true }` response for an unknown email.
- [ ] **Step 2:** Implement, then run the tests. Expected: PASS. Commit `feat(auth): forgot, reset and verify email pages`.

### Task 30: Onboarding (CSV 52)

**Interfaces:** `/onboarding` (`_authed/onboarding.tsx`) uses `AuthLayout`: a name field prefilled from the user (empty for guests) and a "Get started" button → `completeOnboarding` → `/`. Its file header documents that apps add their own steps here.

- [ ] **Step 1: Failing test:** submitting calls `completeOnboarding({ name })` and navigates to `/`.
- [ ] **Step 2:** Implement, then run the test. Expected: PASS. Commit `feat(onboarding): generic onboarding page`.

### Task 31: Settings (CSV 53, 54, 55)

**Interfaces:**
- `/settings` (`_authed/_app/settings/route.tsx`): tabs implemented as **links to child routes**, so they're deep-linkable. `index.tsx` redirects to `/settings/profile`.
- **Profile:** name form (`changeName`) and email form (`changeEmail`, needs the current password).
- **Security:** password form (`changePassword`), a sessions list (`useSuspenseQuery(sessionsQuery)`, current one badged) and "Sign out everywhere" behind an `AlertDialog` → `/login`.
- **Preferences:** language (`en`/`it`) and theme (light/dark/system) as radio groups. They save immediately with an optimistic update of `currentUser` prefs (rolled back on error) and, for language, `i18n.changeLanguage`.
- **Guests (Review Focus 3):** Profile and Security show a `SaveAccountCard` (CTA `/signup?upgrade=1`) **instead of** the email and password forms.

- [ ] **Step 1: Failing tests:** a guest sees `SaveAccountCard` and no password field; "Sign out everywhere" requires confirmation before calling the mutation; changing the theme updates the cache immediately and rolls back when the mutation rejects; the sessions list marks the current session.
- [ ] **Step 2:** Implement, then run the tests. Expected: PASS. Commit `feat(account): settings profile, security and preferences`.

## Feature: Release readiness

### Task 32: Docker (CSV 58)

**Files:** Create `Dockerfile`, `.dockerignore`, `docker-compose.yml`. Modify `vite.config.ts` (Nitro preset `node-server` explicitly).

**Interfaces:** A multi-stage `node:24-alpine` image (corepack pnpm → `pnpm install --frozen-lockfile` → `pnpm build` → runtime stage with `.output` only), running `node .output/server/index.mjs` on port 3000 as the non-root `node` user. Compose builds the image and reads `env_file: .env.local`.

- [ ] **Step 1:** Run `docker compose up --build`, then `curl -sI localhost:3000/login`. Expected: `200` and `content-type: text/html`.
- [ ] **Step 2:** Commit `build: Docker image and compose for self-hosting`.

### Task 33: Budgets and the full verify script (CSV 7, 60)

**Files:** Create `scripts/check-initial-js.ts` and `lighthouserc.json`. Modify `package.json`.

**Interfaces:**
- `pnpm check:js`: start `vite preview` (or the built server). For `/login`, `/signup` and `/forgot-password`, fetch the HTML, collect every `<script src>` and `<link rel="modulepreload">` same-origin asset, gzip each, and sum. Fail if any page exceeds **120 KB**, printing a per-file table.
- `pnpm lighthouse`: `@lhci/cli autorun` on the same 3 URLs, mobile preset. Assertions: categories ≥ 0.95, `largest-contentful-paint` ≤ 1500, `cumulative-layout-shift` ≤ 0.05.
- `verify` = `typecheck && lint && knip && test && build && check:js && lighthouse`.

- [ ] **Step 1:** Run `pnpm verify`. Expected: green. If a budget fails, fix the cause (lazy-load, drop a dependency, split a chunk) rather than raising the budget.
- [ ] **Step 2:** Commit `build: bundle and Lighthouse budgets in verify`.

### Task 34: Responsive review, smoke checklist, README (CSV 59, 61, 62)

**Files:** Create `docs/smoke-checklist.md`. Replace `README.md`.

- [ ] **Step 1:** Run `pnpm dev`. For every page (login, signup, forgot, reset invalid state, verify states, onboarding, home, settings × 3, guest banner), take browser screenshots at 375 / 768 / 1024 / 1440, light and dark. Fix every overflow, misalignment, touch target under 44px or contrast issue found. Put the screenshot set in the final report to the user (not in git).
- [ ] **Step 2:** Write `docs/smoke-checklist.md`, one checkbox line per flow from spec §9.4. Run it against the real Appwrite instance and record the date and the result of each line.
- [ ] **Step 3:** Write `README.md`: what the boilerplate gives you, setup (`.env.local`, `appwrite:types`), scripts, architecture in 10 lines (with links to the spec), how to add a feature (folder + schemas + functions + queries + route) and how to plug in `onGuestMerge`.
- [ ] **Step 4:** Run `pnpm verify`. Expected: green. Commit `docs: smoke checklist and boilerplate README`.
