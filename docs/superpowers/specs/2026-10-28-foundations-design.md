# Foundations: TanStack Start + Appwrite boilerplate — Design

**Date:** 2026-10-28
**Status:** Draft, awaiting review
**Scope:** Sub-project 1 of 2. Sub-project 2 (the task manager from `CLAUDE_CODE_DOCS.md`) gets its own spec, built on top of this one.

## 1. Goal

A reusable, production-grade starting point for apps built on **TanStack Start + Appwrite**. It gives every future app authentication, account management and an app shell, so the next app starts from its own features, not from plumbing.

Success means:

- Everything in §8 (acceptance criteria) passes via `pnpm verify`.
- The boilerplate contains no task-manager code. A new app is created by copying it and adding a feature folder.

### Reused, not reinvented

| Source | What we take |
|---|---|
| Polybank `docs/appwrite-wrapper.md` + `packages/shared/src/libs/appwrite/*` | `AppTables` typed wrapper, `patchAppwritePayload`, `AppClient` shape (`tables.typed`), admin bulk tables, the payload tests |
| Polybank `apps/frontend/src/services/auth-service.ts`, `context/auth-context.tsx` | Auth flows (signup, login, logout, guest, guest upgrade, guest merge), prefs handling, JWT refresh logic from `api.ts` |
| Reperio `src/components/ui/*` | shadcn/ui components (only those used) |
| This starter | TanStack Start, Router + Query SSR integration, TanStack Form, Tailwind v4, Biome, theme init script |
| `tanstack-query-typed` (≥ 0.2.0) | Typed query/mutation registry, `appQueryOptions`, `useSuspenseQuery`, `TypedQueryClient` |

## 2. Decisions

| # | Decision | Why |
|---|---|---|
| D1 | **Session in an httpOnly cookie on the app domain**, created server-side. The browser SDK uses a short-lived JWT issued by the server. | Real SSR auth (guards run on the server, no flash of the wrong page). Avoids third-party-cookie problems, since Appwrite runs on another domain. |
| D2 | **Server-first data access.** Pages read and write through TanStack Start server functions calling Appwrite as the user. The browser `appClient` is used only for realtime and trivial UI-state writes. | Data in the first paint, business rules in one trusted place, and the API key never leaves the server. |
| D3 | **TanStack Query everywhere, through `tanstack-query-typed`.** Each query is defined once with `appQueryOptions`, prefetched in route loaders (`ensureQueryData`) and read with `useSuspenseQuery`. | One definition per query (DRY), SSR hydration with no second fetch, typed keys and cache. |
| D4 | **Start middleware instead of tsyringe + AsyncLocalStorage.** `authMiddleware` builds the same `AppClient` objects and passes them in the typed server-function `context`. | Same API shape as Polybank, without a DI container or hidden globals. Calling it outside a request is a compile error. |
| D5 | **Feature folders, single repo.** | Polybank's `shared` package becomes `src/lib/appwrite/`. There's no second consumer to justify a monorepo. |
| D6 | **TanStack Form + zod.** Form and server function share one schema. | Native to the stack. Validation is defined once and enforced on both sides. |
| D7 | **i18next, en + it, language resolved on the server.** | No hydration mismatch, and typed keys. |
| D8 | **Self-hosted Node (Nitro node-server preset) + Dockerfile.** | Runs next to the self-hosted Appwrite. Allows a single-instance in-memory rate limiter. |
| D9 | **Unit tests only for now, with typed fakes for Appwrite.** Integration and e2e tests come later. | Fast, deterministic and backend-free. Fakes are typed from the SDK, so they break at compile time when Appwrite's API changes. |
| D10 | **No CI and no git remote for now.** Quality gates run locally via `pnpm verify` and lefthook hooks. | The repo is local only. The same script plugs into CI later. |

## 3. Architecture

```
src/
  config/
    env.ts                    # zod-validated env, split into public (VITE_*) and server-only
  lib/
    appwrite/
      models.gen.ts           # generated from the LIVE schema (pnpm appwrite:types)
      app-models.ts           # App* types, AppTablesTypeMap, APP_TABLES
      app-tables.ts           # AppTables + AdminTables (bulk ops)
      payload.ts              # patchAppwritePayload / patchAppwriteResponseObject
      permissions.ts          # ownerPermissions(userId)
      browser-client.ts       # appClient (JWT-authenticated, lazy)
      server-client.server.ts # createUserClient(sessionSecret), createAdminClient()
    errors.ts                 # toAppError(unknown) -> { code, i18nKey }
    query-client.ts           # QueryClient defaults + asTypedQueryClient
  server/
    auth-middleware.server.ts # cookie -> context.appwrite.{user(), admin()}, context.user
    session-cookie.server.ts  # set/read/clear the session cookie (one place)
    rate-limit.server.ts      # in-memory limiter for auth endpoints
  features/
    auth/                     # login, signup, guest, recovery, verification
      auth.functions.ts       # server functions
      auth.queries.ts         # appQueryOptions (currentUser) + registry entries
      auth.schemas.ts         # zod schemas shared by forms and server functions
      components/             # LoginForm, SignupForm, ...
    account/                  # profile, password, email, sessions, preferences
    onboarding/               # generic onboarding hook + placeholder page
  components/
    ui/                       # shadcn/ui (copied from Reperio, used components only)
    form/                     # useAppForm + TextField, PasswordField, SubmitButton
    layout/                   # AppShell, AuthLayout, GuestBanner, UserMenu
  i18n/
    i18n.ts                   # init, server-side language resolution
    locales/{en,it}/*.json    # one namespace per feature
  routes/
    __root.tsx                # html shell, theme, lang, currentUser prefetch
    _public/                  # AuthLayout: login, signup, forgot/reset password
    _authed/
      route.tsx               # guard 1: signed in
      verify-email.tsx        # reachable before verification
      onboarding.tsx          # reachable before onboarding
      _app/
        route.tsx             # guards 2-3: email verified*, onboarding done; renders AppShell
        index.tsx             # home placeholder
        settings/             # profile, security, preferences tabs
```

Rules:
- Files ending in `.server.ts` are server-only. Start's import protection breaks the build if browser code imports them. `APPWRITE_API_KEY` is read only there.
- A feature never imports from another feature's internals. Shared code lives in `lib/`, `components/` or `server/`.
- Starter demo code (`demo.*`, `Header`, `Footer`, demo store, `work-scheduler.ts`) is removed. `work-scheduler.ts` is kept outside the app (`docs/reference/`) until sub-project 2.

## 4. Appwrite layer

### 4.1 Wrapper

Port of Polybank's wrapper with the same public API (`tables.typed.getRow/listRows/listAllRows/createRow/updateRow/upsertRow/deleteRow`, admin `bulkCreateRows/bulkUpsertRows/deleteRows`). Differences:

- `listAllRows` paginates with `Query.cursorAfter` in pages of `MAX_PAGE_SIZE`, not with offset and a 10 000 limit (that limit came from Polybank's custom Appwrite build). `MAX_PAGE_SIZE` is set to the largest `Query.limit` the instance accepts, measured against it during implementation.
- No `CustomSqlClient`. It requires the custom build.
- Admin bulk writes stamp rows with `ownerPermissions(userId)`, the same helper `createRow` callers use. All tables have row security enabled.
- The user id for admin bulk writes comes from `context.user`, not from a global request store.

### 4.2 Types

`pnpm appwrite:types` (`appwrite-cli` as a devDependency) generates `models.gen.ts` from the live schema. The live schema is the source of truth: the current `appwrite.json` has drifted from it. `app-models.ts` derives `App*` types (`AppDocument<T>`, as in Polybank) and registers each table in `AppTablesTypeMap` and `APP_TABLES`.

### 4.3 Clients

```ts
type AppClient<'server' | 'admin'> = { client, account, tables: TablesDB & { typed }, users? }
```

- `createUserClient(sessionSecret)`: `node-appwrite` client with `setSession(secret)`. Built per request and never cached across requests.
- `createAdminClient()`: `node-appwrite` client with `setKey(APPWRITE_API_KEY)`. Also exposes `users`.
- `appClient` (browser): the `appwrite` SDK with the same `tables.typed`. It's authenticated lazily with a JWT from `issueBrowserJwt()`, refreshed after 10 minutes, with a single in-flight refresh and one retry on 401 (Polybank's `api.ts` logic). It's never created for anonymous visitors.

## 5. Session and auth flows

### 5.1 Session

```
login:    browser --signIn()--> server --admin.account.createEmailPasswordSession--> Appwrite
                                   '-- Set-Cookie: <name>=<secret>; HttpOnly; Secure; SameSite=Lax; Path=/; Expires=<session.expire>
request:  cookie --> authMiddleware --> createUserClient(secret) --> context.appwrite.user()
```

- Only the admin client receives the session `secret`, so session creation (login, signup, guest) runs with it, and the secret is stored in the cookie. `session-cookie.server.ts` is the only module that knows the cookie's name and attributes.
- `authMiddleware` exposes `context.appwrite.user()`, `context.appwrite.admin()` and `context.user` (`Models.User` + typed prefs, or `null`).
- **Current user:** `__root.tsx` `beforeLoad` runs `queryClient.ensureQueryData(currentUserQuery)`. On the server that's one `account.get()` per SSR request. On the client it's cached with `staleTime: Infinity` and invalidated only by auth mutations, so navigation never waits on it.
- **An invalid or expired session** clears the cookie and is treated as signed out. It never shows as an error page.

### 5.2 Guards (`beforeLoad`, run on server and client)

1. `_authed/route.tsx`: no user → redirect to `/login?redirect=<current>`.
2. `_authed/_app/route.tsx`: `REQUIRE_EMAIL_VERIFICATION` is on and the email isn't verified (guests excluded) → `/verify-email`.
3. `_authed/_app/route.tsx`: `prefs.onboardingCompleted !== true` → `/onboarding`.

`/verify-email` and `/onboarding` redirect to `/` once their condition is met.

`_public` routes redirect an already signed-in user to `/`.

### 5.3 Flows

| Flow | Server function(s) | Appwrite calls |
|---|---|---|
| Sign up | `signUp` | `account.create` → `createEmailPasswordSession` → set default prefs → `createVerification(/verify-email)` |
| Log in | `signIn` | `createEmailPasswordSession` (admin) |
| Log out | `signOut` | `account.deleteSession('current')` + clear the cookie |
| Guest | `startGuestSession` | `createAnonymousSession` (admin) |
| Guest → new account | `upgradeGuest` | `updateEmail` + `updatePassword` + `updateName` on the guest session. Same `userId`, so no data migration. |
| Guest → existing account | `signInAndMergeGuest` | sign in, then the app-provided `onGuestMerge(guestUserId, userId, adminClient)`, then delete the guest user |
| Forgot password | `requestPasswordReset` | `createRecovery(email, /reset-password)`. Always answers "if the email exists, we sent a link" (no account enumeration). |
| Reset password | `resetPassword` | `updateRecovery(userId, secret, password)` |
| Verify email | `sendVerification`, `confirmVerification` | `createVerification`, `updateVerification` |
| Change password | `changePassword` | `updatePassword(new, old)` |
| Change email / name | `changeEmail`, `changeName` | `updateEmail(email, password)`, `updateName` |
| Sessions | `listSessions`, `signOutEverywhere` | `listSessions`, `deleteSessions` + clear the cookie |
| Preferences | `updatePreferences` | read fresh prefs, merge, `updatePrefs` (Polybank's approach, which avoids overwriting with stale data) |
| Onboarding | `completeOnboarding` | `updatePrefs({ onboardingCompleted: true })` |

`onGuestMerge` is an extension point: the boilerplate defines its type and calls it, and each app registers its own implementation (the default does nothing). The task manager will use it to move projects and tasks.

Typed prefs: `{ onboardingCompleted: boolean; locale: 'en' | 'it'; theme: 'light' | 'dark' | 'system' }`. Apps extend them through declaration merging.

### 5.4 Security

- **Rate limiting.** Calls made with the API key bypass Appwrite's rate limits, so `signIn`, `signUp`, `startGuestSession` and `requestPasswordReset` go through `rate-limit.server.ts`: a sliding window per IP and per IP + email, with limits as named constants. On limit it returns `RATE_LIMITED` with the retry time.
- Every server function validates its input with the same zod schema the form uses.
- Errors go through `toAppError()`. The client only ever sees a stable code and an i18n key, never raw Appwrite messages or stack traces.
- `redirect` query params are accepted only if they're same-origin relative paths (no open redirect).
- Cookie: `HttpOnly`, `Secure` (except on localhost), `SameSite=Lax`.

## 6. UI

### 6.1 Design system

- Tailwind v4 `@theme` tokens: semantic OKLCH colors (`background`, `foreground`, `primary`, `muted`, `accent`, `destructive`, `border`, `ring`) for light and dark, all AA contrast; radius; a 4px spacing scale. No raw color values in components.
- shadcn/ui (new-york), copied from Reperio, only the components used. Icons: `lucide-react`.
- Font: self-hosted Inter Variable, latin subset, preloaded, `font-display: swap`.
- Theme: light / dark / system, stored in a cookie and in prefs. The starter's inline init script runs before first paint, so there's no flash.
- Motion: 150–200 ms, functional only, off under `prefers-reduced-motion`.

### 6.2 Layouts

| Width | AppShell |
|---|---|
| ≥ 1024 | Persistent 260px sidebar, collapsible to a 64px icon rail (state remembered) |
| 768–1023 | Icon rail by default; the full sidebar opens as an overlay |
| < 768 | Compact header + Sheet drawer for navigation, user menu on the avatar, safe-area insets |

Built on shadcn `Sidebar`. `AuthLayout` centers a `max-w-sm` card on larger screens and is full-bleed on mobile. Guests see a dismissible `GuestBanner` with a "save your account" action.

### 6.3 Pages

`/login`, `/signup`, `/forgot-password`, `/reset-password`, `/verify-email`, `/onboarding` (placeholder: name + finish), `/` (home placeholder), and `/settings` with three tabs:
- **Profile:** name, email.
- **Security:** password, active sessions, sign out everywhere.
- **Preferences:** language, theme.

### 6.4 Forms

`useAppForm` (TanStack Form `createFormHook`) with pre-bound `TextField`, `PasswordField` (show/hide, strength meter on new passwords) and `SubmitButton` (pending and disabled state). Validation runs on blur, then on change once a field has an error. Fields use the correct `autocomplete` values (`email`, `current-password`, `new-password`). Server errors map onto the form through `toAppError`.

### 6.5 States and feedback

- Skeletons sized like the final content (no layout shift).
- Optimistic mutations where they apply.
- sonner toasts for outcomes.
- Default route `errorComponent` with a retry, and a `notFoundComponent`.

### 6.6 i18n

- i18next + react-i18next, `en` and `it`, one namespace per feature.
- Language order: `prefs.locale` → cookie → `Accept-Language` → `en`. Resolved on the server and rendered into `<html lang>`.
- Only the active language is loaded. Keys are typed, so a missing key is a compile error.

## 7. Data fetching conventions

```ts
// features/<x>/<x>.queries.ts: the single definition
export const currentUserQuery = appQueryOptions(['currentUser'], {
  queryFn: () => getCurrentUser(),
  staleTime: Infinity,
});

// route loader
loader: ({ context }) => context.queryClient.ensureQueryData(currentUserQuery),

// component
const { data: user } = useSuspenseQuery(currentUserQuery);
```

- Each registry entry's `response` is derived from its server function: `Awaited<ReturnType<typeof fn>>`. The server function is the single source of truth.
- The router context `queryClient` is a `TypedQueryClient` (`asTypedQueryClient`).
- Mutations are defined with `appMutationOptions` when they carry optimistic logic, and invalidate by query name.
- `defaultPreload: 'intent'` prefetches route data when the pointer hovers a link.

## 8. Acceptance criteria

| Area | Criterion | Verified by |
|---|---|---|
| Speed | Lighthouse mobile ≥ 95 on every category; LCP < 1.5 s; CLS < 0.05 (throttled 4G) | Lighthouse CI (local) on the production build |
| Bundle | Initial JS ≤ 120 KB gzip on public and auth pages | `size-limit` |
| Feel | Route data prefetched on intent; no spinner where a skeleton fits; optimistic mutations | Review + UI tests on optimistic updates |
| Responsive | Every page correct at 375 / 768 / 1024 / 1440, light and dark; no horizontal scroll; touch targets ≥ 44px | Browser screenshots at each breakpoint, reviewed during implementation (automated baselines arrive with e2e) |
| A11y | Zero serious or critical violations; full keyboard use; visible focus | `vitest-axe` on every page-level component, plus keyboard-only review |
| Code | TS strict, no `any`, Biome clean, no unused files, exports or deps | `tsc`, Biome (`noExplicitAny` = error), knip |
| Tests | Coverage ≥ 90% lines/branches on `lib/`, `server/`, `features/**/*.functions.ts`; ≥ 80% on components | Vitest coverage thresholds |
| i18n | No hard-coded UI strings; en and it complete | Typed keys + a key-parity check |

## 9. Testing

All tests are **unit tests with Appwrite faked**: no network, no backend, no test project. Integration and e2e tests against a real Appwrite come in a later phase.

### 9.1 One seam

Server functions receive Appwrite through `context` (§5.1), never through imports. Each server function is therefore an exported **handler** plus its wiring:

```ts
export const signInHandler = async ({ data, context }: HandlerArgs<SignInInput>) => { /* ... */ };

export const signIn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .validator(signInSchema)
  .handler(signInHandler);
```

Tests call the handler directly with a fake context. Module mocking (`vi.mock`) is allowed in exactly two places:
- `session-cookie.server.ts`, whose cookie writes go through Start's request APIs;
- `*.functions.ts` modules, when a UI test needs to replace server functions.

### 9.2 Layers

| Layer | Scope | How |
|---|---|---|
| **Pure logic** | `patchAppwritePayload` (Polybank tests ported), `toAppError`, rate limiter, redirect sanitizer, env schema, zod schemas, guard decisions (`resolveGuardRedirect(user, config)` is a pure function) | Plain tests, no doubles |
| **Server handlers** | Every server function: which Appwrite calls are made with which payload, which cookie is set or cleared, what is returned, how Appwrite errors map to `AppError` | `createTestContext()` fake context |
| **Browser client** | JWT refresh after 10 min, single in-flight refresh, retry once on 401 | Fake timers + fake `Account` |
| **UI** | Forms (blur validation, pending state, translated server errors), guard redirects, AppShell behavior per breakpoint, optimistic updates and rollback | Testing Library (jsdom), `vitest-axe` |

### 9.3 Keeping fakes honest

- **Typed fakes.** `createTestContext({ user?, prefs? })` builds `context.appwrite.user()` and `admin()` from `vi.fn()`s typed against the real SDK classes (`Pick<Account, 'createEmailPasswordSession' | ...>`). An SDK signature change breaks compilation.
- **Typed fixtures.** One builder per shape, shared by all tests: `aUser()`, `aSession()`, `aRow(table, overrides)`. They return `Models.User`, `Models.Session` and the generated row types, with sensible defaults and overrides.
- **Real errors.** `appwriteError(type)` constructs a genuine `AppwriteException` with the right `type` and `code` for that error.
- **Assert behavior, not wiring.** Tests check outputs, cookies and outgoing payloads, never internal call order.

### 9.4 Known gaps until e2e

Fakes can't prove Appwrite behaves as assumed: row permissions, guest upgrade keeping the same user id, real emails. Before closing each phase, a **manual smoke checklist** is run against the real instance: sign up, log in/out, guest → upgrade, guest → merge, forgot/reset password, verify email, change password/email, sign out everywhere.

### 9.5 Local quality gates

- `pnpm verify`: `typecheck → biome check → knip → test (with coverage thresholds) → build → size-limit → lighthouse (public pages)`. This is what a future CI will run.
- lefthook: pre-commit runs Biome on staged files; pre-push runs typecheck + tests.
- **Definition of Done (per feature):** `pnpm verify` green, screenshots reviewed at all 4 breakpoints, no new strings outside i18n, no duplicated logic.

## 10. Configuration and deploy

- `.env.local` (gitignored): `VITE_APPWRITE_ENDPOINT`, `VITE_APPWRITE_PROJECT_ID`, `VITE_APPWRITE_DATABASE_ID`, `APPWRITE_API_KEY`, `APP_URL`, `REQUIRE_EMAIL_VERIFICATION` (default `false`: verification is offered but not enforced).
- `.env.example` (committed): every key, no values.
- `Dockerfile` (multi-stage, Node 24, Nitro node-server output) + `docker-compose.yml` for the app only, since Appwrite is already self-hosted.

## 11. Prerequisites (before implementation)

1. `tanstack-query-typed@0.2.0` is published: it's staged on npm and awaiting maintainer approval.
2. SMTP is configured on the Appwrite instance for the recovery and verification emails (needed only for the manual smoke checklist).

## 12. Out of scope

- The task manager: tree, scheduler, availability, Gantt (sub-project 2).
- OAuth providers, MFA, teams and invitations, account deletion.
- Integration and e2e tests, automated screenshot baselines, a test inbox (later phase).
- CI and a git remote.
- Multi-instance deploy (it would need a shared store for the rate limiter).
