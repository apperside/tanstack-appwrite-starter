import { type Account, Client, type TablesDB, type Users } from "node-appwrite";
import { type Mock, vi } from "vitest";
import type {
	AppClient,
	AppPrefs,
	AppUser,
	Locale,
	ThemePreference,
} from "#/lib/appwrite/app-models";
import { AdminTables, AppTables } from "#/lib/appwrite/app-tables";
import { AppError } from "#/lib/errors";
import { appLink } from "#/server/app-link";
import type {
	PreferenceCookies,
	ServerContext,
	SessionCookie,
} from "#/server/context";
import { aSession } from "./fixtures";

// biome-ignore lint/suspicious/noExplicitAny: matches Vitest's own `Procedure` constraint.
type AnyFn = (...args: any[]) => any;

type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;

/**
 * The SDK declares most methods twice: the object form first, then a deprecated
 * positional form. Vitest would type a mock by the last overload, so pick the
 * first one. Single-signature methods (e.g. generic `get<P>()`) are kept as is.
 */
type ObjectForm<F> = F extends {
	(...args: infer A1): infer R1;
	(...args: infer A2): unknown;
}
	? Same<A1, A2> extends true
		? F
		: (...args: A1) => R1
	: F;

/** One `vi.fn` per listed method, typed against the SDK's object-form signature. */
type Fake<T, K extends keyof T> = {
	[P in K]: T[P] extends AnyFn ? Mock<ObjectForm<T[P]>> : never;
};

const ACCOUNT_METHODS = [
	"get",
	"create",
	"createEmailPasswordSession",
	"createAnonymousSession",
	"getSession",
	"deleteSession",
	"deleteSessions",
	"listSessions",
	"getPrefs",
	"updatePrefs",
	"updateName",
	"updateEmail",
	"updatePassword",
	"createRecovery",
	"updateRecovery",
	"createVerification",
	"updateVerification",
] as const satisfies readonly (keyof Account)[];

// node-appwrite has no `Account.createJWT`; JWTs are minted with `users.createJWT`.
const USERS_METHODS = [
	"createJWT",
	"get",
	"delete",
	"deleteSession",
] as const satisfies readonly (keyof Users)[];

// Includes every method the typed tables wrappers call.
const TABLES_METHODS = [
	"listRows",
	"getRow",
	"createRow",
	"updateRow",
	"upsertRow",
	"deleteRow",
	"createRows",
	"upsertRows",
	"deleteRows",
] as const satisfies readonly (keyof TablesDB)[];

type FakeAccount = Fake<Account, (typeof ACCOUNT_METHODS)[number]>;
type FakeUsers = Fake<Users, (typeof USERS_METHODS)[number]>;
type FakeTables = Fake<TablesDB, (typeof TABLES_METHODS)[number]>;

/** Unstubbed methods reject with `not stubbed: <service>.<method>`, so a forgotten stub fails loudly. */
function fake<T, K extends keyof T & string>(
	service: string,
	methods: readonly K[],
): Fake<T, K> {
	const entries = methods.map((method) => [
		method,
		vi.fn(() => Promise.reject(new Error(`not stubbed: ${service}.${method}`))),
	]);
	return Object.fromEntries(entries) as Fake<T, K>;
}

const fakeAccount = () =>
	fake<Account, (typeof ACCOUNT_METHODS)[number]>("account", ACCOUNT_METHODS);
const fakeUsers = () =>
	fake<Users, (typeof USERS_METHODS)[number]>("users", USERS_METHODS);
const fakeTables = () =>
	fake<TablesDB, (typeof TABLES_METHODS)[number]>("tables", TABLES_METHODS);

const TEST_DATABASE_ID = "test-db";

/*
 * The fakes cover only the methods the app calls, so they are cast to the SDK
 * classes here, once. Each method is still typed against the SDK signature.
 */
function userClient(
	account: FakeAccount,
	tables: FakeTables,
): AppClient<"server"> {
	const db = tables as unknown as TablesDB;
	return {
		client: new Client(),
		account: account as unknown as Account,
		tables: Object.assign(db, { typed: new AppTables(db, TEST_DATABASE_ID) }),
	};
}

function adminClient(
	account: FakeAccount,
	users: FakeUsers,
	tables: FakeTables,
): AppClient<"admin"> {
	const db = tables as unknown as TablesDB;
	return {
		client: new Client(),
		account: account as unknown as Account,
		users: users as unknown as Users,
		tables: Object.assign(db, { typed: new AdminTables(db, TEST_DATABASE_ID) }),
	};
}

/** An in-memory session cookie; `value` holds the stored secret. */
class FakeSessionCookie implements SessionCookie {
	value: string | undefined;

	read() {
		return this.value;
	}

	write(session: { secret: string }) {
		this.value = session.secret;
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

export type TestContextOptions = {
	/** The signed-in user; `null` (default) means signed out. */
	user?: AppUser | null;
	/**
	 * The session cookie's secret. Defaults to `aSession().secret` when a user is
	 * signed in, since a signed-in request always carries it; `null` means no cookie.
	 */
	sessionSecret?: string | null;
	/** The browser's language and theme (`ServerContext.browserPrefs`). */
	browserPrefs?: Pick<AppPrefs, "locale" | "theme">;
	clientIp?: string;
	userAgent?: string;
	/** `APP_URL`, which `appLink` builds on. */
	appUrl?: string;
};

/**
 * A `ServerContext` over typed fakes, plus handles to stub and assert on them:
 * `userAccount.get.mockResolvedValue(aUser())`.
 */
export function createTestContext({
	user = null,
	sessionSecret = user ? aSession().secret : null,
	browserPrefs = { locale: "en", theme: "system" },
	clientIp = "203.0.113.1",
	userAgent = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Firefox/140.0",
	appUrl = "http://app.test",
}: TestContextOptions = {}) {
	const userAccount = fakeAccount();
	const userTables = fakeTables();
	const adminAccount = fakeAccount();
	const anonymousAccount = fakeAccount();
	const adminUsers = fakeUsers();
	const adminTables = fakeTables();
	const sessionCookie = new FakeSessionCookie();
	sessionCookie.value = sessionSecret ?? undefined;
	const preferenceCookies = new FakePreferenceCookies();
	const rateLimit = vi.fn<ServerContext["rateLimit"]>();

	const userAppClient = userClient(userAccount, userTables);
	const admin = adminClient(adminAccount, adminUsers, adminTables);
	const anonymous = userClient(anonymousAccount, fakeTables());

	const forSession = vi.fn<ServerContext["appwrite"]["forSession"]>(
		() => userAppClient,
	);

	const context: ServerContext = {
		appwrite: {
			forSession,
			user: () => {
				// Like the real context: whether there is a session cookie decides, not the user.
				if (!sessionCookie.read()) throw new AppError("UNAUTHENTICATED");
				return userAppClient;
			},
			admin: () => admin,
			anonymous: () => anonymous,
		},
		getUser: async () => user,
		sessionCookie,
		preferenceCookies,
		browserPrefs,
		clientIp,
		userAgent,
		appLink: (path) => appLink(appUrl, path),
		rateLimit,
	};

	return {
		context,
		userAccount,
		userTables,
		adminAccount,
		adminUsers,
		adminTables,
		anonymousAccount,
		sessionCookie,
		preferenceCookies,
		rateLimit,
		forSession,
	};
}
