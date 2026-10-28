import type {
	AppClient,
	AppPrefs,
	AppUser,
	Locale,
	ThemePreference,
} from "#/lib/appwrite/app-models";

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
	write(session: { secret: string; expire: string }): void;
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
	appwrite: {
		/** Acts as the signed-in user. Throws `AppError("UNAUTHENTICATED")` without a session. */
		user(): AppClient<"server">;
		/** Acts as the holder of `secret`, e.g. a session created during this request. */
		forSession(secret: string): AppClient<"server">;
		/** Acts with the API key, bypassing permissions; forwards `userAgent` (sessions it creates show the visitor's browser). */
		admin(): AppClient<"admin">;
		/** Acts as nobody (no key, no session), where Appwrite refuses an API key. */
		anonymous(): AppClient<"server">;
	};
	/** The signed-in user, or `null`. Memoized per request. */
	getUser(): Promise<AppUser | null>;
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
