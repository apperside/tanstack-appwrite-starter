import { type Mock, vi } from "vitest";
import type { AdminAuth, AuthService, SessionAuth } from "#/core/auth/ports";
import type { AuthSession, EmailLinkParams, User } from "#/core/auth/types";
import {
	type AppPrefs,
	DEFAULT_PREFS,
	type Locale,
	type ThemePreference,
} from "#/core/prefs";
import { createMemoryBackend } from "#/server/adapters/memory/backend.server";
import type { AuthEmail } from "#/server/adapters/shared/mail/mail";
import { buildServerContext } from "#/server/context/context.server";
import type {
	PreferenceCookies,
	ServerContext,
	SessionCookie,
} from "#/server/context/context.types";

/** An in-memory session cookie; `value` holds the stored token. */
class FakeSessionCookie implements SessionCookie {
	value: string | undefined;

	read() {
		return this.value;
	}

	write(session: Pick<AuthSession, "token">) {
		this.value = session.token;
	}

	clear() {
		this.value = undefined;
	}
}

/**
 * In-memory preference cookies; `locale` / `theme` hold the last written value,
 * `guestBannerCleared` whether the guest banner's dismissal was deleted.
 */
class FakePreferenceCookies implements PreferenceCookies {
	locale: Locale | undefined;
	theme: ThemePreference | undefined;
	guestBannerCleared = false;

	clearGuestBannerDismissed() {
		this.guestBannerCleared = true;
	}

	writeLocale(locale: Locale) {
		this.locale = locale;
	}

	writeTheme(theme: ThemePreference) {
		this.theme = theme;
	}
}

// biome-ignore lint/suspicious/noExplicitAny: any method's parameters.
type AnyFn = (...args: any[]) => any;

type Spies<T> = { [K in keyof T]: T[K] extends AnyFn ? Mock<T[K]> : never };

/** A session method's spy: the session's token comes first. */
type SessionSpies = {
	[K in keyof SessionAuth]: Mock<
		(
			token: string,
			...args: Parameters<SessionAuth[K]>
		) => ReturnType<SessionAuth[K]>
	>;
};

const SERVICE_METHODS = [
	"signUp",
	"signIn",
	"startGuest",
	"requestPasswordReset",
	"resetPassword",
	"confirmVerification",
] as const satisfies readonly (keyof AuthService)[];

const SESSION_METHODS = [
	"getUser",
	"signOut",
	"signOutEverywhere",
	"listSessions",
	"updateName",
	"updateEmail",
	"updatePassword",
	"sendVerification",
	"updatePrefs",
	"upgradeGuest",
] as const satisfies readonly (keyof SessionAuth)[];

const ADMIN_METHODS = [
	"deleteUser",
	"deleteSession",
] as const satisfies readonly (keyof AdminAuth)[];

function spyOn<T extends object>(
	target: T,
	methods: readonly (keyof T & string)[],
): Spies<T> {
	return Object.fromEntries(
		methods.map((method) => [
			method,
			vi.fn((...args: unknown[]) => (target[method] as AnyFn)(...args)),
		]),
	) as Spies<T>;
}

/**
 * The auth ports of `real`, every method a spy that calls through: assert on
 * calls, or make one fail (`session.updatePrefs.mockRejectedValueOnce(...)`).
 */
function spyAuth(real: AuthService) {
	const service = spyOn(real, SERVICE_METHODS);
	const admin = spyOn(real.admin, ADMIN_METHODS);
	const session = Object.fromEntries(
		SESSION_METHODS.map((method) => [
			method,
			vi.fn((token: string, ...args: unknown[]) =>
				(real.session(token)[method] as AnyFn)(...args),
			),
		]),
	) as SessionSpies;
	const auth: AuthService = {
		...service,
		admin,
		session: (token) =>
			Object.fromEntries(
				SESSION_METHODS.map((method) => [
					method,
					(...args: unknown[]) => (session[method] as AnyFn)(token, ...args),
				]),
			) as unknown as SessionAuth,
	};
	return { auth, service, session, admin };
}

/** The parameters of an emailed link (what the page's search would hold). */
function linkParams(url: string): EmailLinkParams {
	return Object.fromEntries(new URL(url).searchParams);
}

export type TestContextOptions = {
	/** The browser's language and theme (`ServerContext.browserPrefs`). */
	browserPrefs?: Pick<AppPrefs, "locale" | "theme">;
	clientIp?: string;
	userAgent?: string;
	/** `APP_URL`, which `appLink` builds on. */
	appUrl?: string;
};

type SeedOptions = {
	email?: string;
	password?: string;
	name?: string;
	/** Default `true`. */
	verified?: boolean;
	/** Default `DEFAULT_PREFS`. */
	prefs?: Partial<AppPrefs>;
	/** Puts the session in the request's cookie. Default `true`. */
	signIn?: boolean;
};

/**
 * A `ServerContext` exactly as the auth middleware builds it, over a fresh
 * memory backend. The handles stub and assert on it: `auth`, `session` and
 * `admin` spy on every port method; `seedUser` / `seedGuest` create accounts
 * without touching the spies; `emails` collects what was sent.
 */
export function createTestContext({
	browserPrefs = { locale: "en", theme: "system" },
	clientIp = "203.0.113.1",
	userAgent = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Firefox/140.0",
	appUrl = "http://app.test",
}: TestContextOptions = {}) {
	const emails: AuthEmail[] = [];
	const backend = createMemoryBackend({
		sendEmail: async (email) => {
			emails.push(email);
		},
	});
	const real = backend.auth({ userAgent });
	const spies = spyAuth(real);
	const sessionCookie = new FakeSessionCookie();
	const preferenceCookies = new FakePreferenceCookies();
	const rateLimit = vi.fn<ServerContext["rateLimit"]>();

	const context = buildServerContext({
		backend: { auth: () => spies.auth, data: backend.data },
		sessionCookie,
		preferenceCookies,
		browserPrefs,
		clientIp,
		userAgent,
		appUrl,
		rateLimit,
	});

	/** The last emailed link's parameters, for `purpose`. */
	function lastLink(purpose: AuthEmail["purpose"]): EmailLinkParams {
		const email = [...emails]
			.reverse()
			.find((sent) => sent.purpose === purpose);
		if (!email) throw new Error(`no ${purpose} email was sent`);
		return linkParams(email.url);
	}

	/** Finishes a seeded account: its session in the cookie, nothing in `emails`. */
	async function seeded(session: AuthSession, signIn: boolean) {
		emails.length = 0;
		if (signIn) sessionCookie.value = session.token;
		const user: User = await real.session(session.token).getUser();
		return { user, session };
	}

	return {
		context,
		backend,
		auth: spies.service,
		session: spies.session,
		admin: spies.admin,
		emails,
		lastLink,
		sessionCookie,
		preferenceCookies,
		rateLimit,
		/** A registered account, straight in the store. */
		async seedUser({
			email = "user@example.test",
			password = "password1",
			name = "Test User",
			verified = true,
			prefs = DEFAULT_PREFS,
			signIn = true,
		}: SeedOptions = {}) {
			const session = await real.signUp({ email, password, name });
			const account = real.session(session.token);
			await account.updatePrefs(prefs);
			if (verified) {
				await account.sendVerification({ redirectUrl: `${appUrl}/verify` });
				await real.confirmVerification(lastLink("verification"));
			}
			return seeded(session, signIn);
		},
		/** A guest account, straight in the store. */
		async seedGuest({
			prefs = DEFAULT_PREFS,
			signIn = true,
		}: Pick<SeedOptions, "prefs" | "signIn"> = {}) {
			const session = await real.startGuest();
			await real.session(session.token).updatePrefs(prefs);
			return seeded(session, signIn);
		},
	};
}
