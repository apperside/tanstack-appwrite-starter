import { type Account, Client, type TablesDB, type Users } from "node-appwrite";
import { type Mock, vi } from "vitest";
import type { AppClient } from "#/adapters/appwrite/app-models";
import { AdminTables, AppTables } from "#/adapters/appwrite/app-tables";

/*
 * Typed fakes of the Appwrite SDK services, for the Appwrite adapter's tests.
 * Every other test runs on the memory backend (`createTestContext`).
 */

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
function fakeUserClient(
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

function fakeAdminClient(
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

/**
 * The Appwrite clients of one request, over fresh fakes:
 * `user` answers every `forSession` call, `anonymous` the anonymous client.
 */
export function fakeAppwriteClients() {
	const userAccount = fakeAccount();
	const userTables = fakeTables();
	const adminAccount = fakeAccount();
	const adminUsers = fakeUsers();
	const adminTables = fakeTables();
	const anonymousAccount = fakeAccount();
	const user = fakeUserClient(userAccount, userTables);
	const admin = fakeAdminClient(adminAccount, adminUsers, adminTables);
	const anonymous = fakeUserClient(anonymousAccount, fakeTables());
	const clients = {
		admin: vi.fn(() => admin),
		anonymous: vi.fn(() => anonymous),
		forSession: vi.fn((_secret: string) => user),
	};
	return {
		clients,
		userAccount,
		userTables,
		adminAccount,
		adminUsers,
		adminTables,
		anonymousAccount,
	};
}
