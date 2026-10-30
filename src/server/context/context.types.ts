import type { AuthService, SessionAuth } from "#/core/auth/ports";
import type { AuthSession, User } from "#/core/auth/types";
import type { AppData } from "#/core/backend";
import type { AppPrefs, Locale, ThemePreference } from "#/core/prefs";

/** Rate-limited actions; each has its own window and limit. */
export type RateLimitBucket =
	| "signIn"
	| "signInEmail"
	| "signUp"
	| "guest"
	| "passwordReset"
	| "passwordResetIp";

/** The session cookie of the current request. Only `session-cookie.server.ts` knows its name and attributes. */
export type SessionCookie = {
	read(): string | undefined;
	write(session: Pick<AuthSession, "token" | "expiresAt">): void;
	clear(): void;
};

/**
 * The UI-preference cookies of the current request. Only `preference-cookies.server.ts`
 * knows their attributes; the client reads them (they are not httpOnly), so the theme
 * cookie's name lives in `#/lib/theme`.
 */
export type PreferenceCookies = {
	writeLocale(locale: Locale): void;
	writeTheme(theme: ThemePreference): void;
	/** Shows the guest banner again: a new guest must not inherit a dismissal. */
	clearGuestBannerDismissed(): void;
};

/** Everything a server-function handler may touch. Built per request by the auth middleware. */
export type ServerContext = {
	/** The backend's auth operations, for this request. */
	auth: AuthService;
	/** Acts as the request's session. Throws `AppError("UNAUTHENTICATED")` without a session cookie. */
	session(): SessionAuth;
	/** The backend's repositories. They check ownership, not the session: pass the user's id. */
	data: AppData;
	/** The signed-in user, or `null`. Memoized per request. */
	getUser(): Promise<User | null>;
	sessionCookie: SessionCookie;
	preferenceCookies: PreferenceCookies;
	/**
	 * The language and theme this browser is using before any account says
	 * otherwise: the `locale` cookie, then `Accept-Language`, then the default;
	 * the `theme` cookie, else `system`. A new account or guest starts with them.
	 */
	browserPrefs: Pick<AppPrefs, "locale" | "theme">;
	clientIp: string;
	/** The request's `User-Agent` header, if any. */
	userAgent: string | undefined;
	/** An absolute link to `path` under `APP_URL` (keeping its sub-path), for emails. */
	appLink(path: string): string;
	/** Throws `AppError("RATE_LIMITED")` once `key` exceeds the bucket's limit. */
	rateLimit(bucket: RateLimitBucket, key: string): void;
};

/**
 * The single argument of every server-function handler.
 */
export type HandlerArgs<TInput> = { data: TInput; context: ServerContext };

/** What a handler with nothing else to report resolves to. */
export type Ok = { ok: true };
