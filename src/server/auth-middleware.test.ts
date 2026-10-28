import { notFound, redirect } from "@tanstack/react-router";
import { getRequestHeader, getRequestIP } from "@tanstack/react-start/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AppClient } from "#/lib/appwrite/app-models";
import { AppError } from "#/lib/errors";
import { appwriteError } from "#/test/appwrite-error";
import { aSession, aUser } from "#/test/fixtures";
import { authMiddleware } from "./auth-middleware";
import { buildServerContext } from "./auth-middleware.server";
import type { SessionCookie } from "./context";

let hops = 0;
vi.mock("@tanstack/react-start/server", () => ({
	getRequestIP: vi.fn(),
	getRequestHeader: vi.fn(),
}));
vi.mock("#/config/env", () => ({
	serverEnv: () => ({ TRUSTED_PROXY_HOPS: hops, APP_URL: "https://app.test" }),
}));
vi.mock("./session-cookie.server", () => ({
	requestSessionCookie: () => ({ read: () => "secret" }),
}));
vi.mock("./preference-cookies.server", () => ({
	requestPreferenceCookies: () => ({}),
	readLocaleHints: () => ({ acceptLanguage: "it-IT,it;q=0.9" }),
	readThemeCookie: () => "dark",
}));
vi.mock("#/lib/appwrite/server-client.server", () => ({
	createUserClient: vi.fn(),
	createAdminClient: vi.fn(),
	createAnonymousClient: vi.fn(),
}));

const USER_AGENT = "Mozilla/5.0 (Macintosh) Firefox/140.0";

function setup(secret: string | null = aSession().secret) {
	let value: string | undefined = secret ?? undefined;
	const sessionCookie: SessionCookie = {
		read: () => value,
		write: (session) => {
			value = session.secret;
		},
		clear: vi.fn(() => {
			value = undefined;
		}),
	};
	const get = vi.fn();
	const userClient = { account: { get } } as unknown as AppClient<"server">;
	const createUserClient = vi.fn(() => userClient);
	const createAdminClient = vi.fn(() => ({}) as AppClient<"admin">);
	const createAnonymousClient = vi.fn(() => ({}) as AppClient<"server">);
	const rateLimit = vi.fn();
	const deps: Parameters<typeof buildServerContext>[0] = {
		sessionCookie,
		preferenceCookies: {
			writeLocale: vi.fn(),
			writeTheme: vi.fn(),
			clearGuestBannerDismissed: vi.fn(),
		},
		browserPrefs: { locale: "en", theme: "system" },
		clientIp: "203.0.113.9",
		userAgent: USER_AGENT,
		appUrl: "https://app.test",
		createUserClient,
		createAdminClient,
		createAnonymousClient,
		rateLimit,
	};
	const context = buildServerContext(deps);
	return {
		context,
		deps,
		get,
		sessionCookie,
		createUserClient,
		createAdminClient,
		createAnonymousClient,
		rateLimit,
	};
}

describe("buildServerContext", () => {
	it("builds an anonymous client without reading the session", () => {
		const { context, createAnonymousClient, createUserClient } = setup();
		const client = context.appwrite.anonymous();
		expect(client).toBe(createAnonymousClient.mock.results[0]?.value);
		expect(createUserClient).not.toHaveBeenCalled();
	});

	it("exposes the request's ip, cookie and rate limiter", () => {
		const { context, sessionCookie, rateLimit } = setup();
		expect(context.clientIp).toBe("203.0.113.9");
		expect(context.sessionCookie).toBe(sessionCookie);
		context.rateLimit("signIn", "k");
		expect(rateLimit).toHaveBeenCalledWith("signIn", "k");
	});

	it("builds app links under APP_URL, keeping its sub-path", () => {
		const { context, deps } = setup();
		expect(context.appLink("/verify-email")).toBe(
			"https://app.test/verify-email",
		);
		const nested = buildServerContext({
			...deps,
			appUrl: "https://example.test/app/",
		});
		expect(nested.appLink("/reset-password")).toBe(
			"https://example.test/app/reset-password",
		);
		const bare = buildServerContext({
			...deps,
			appUrl: "https://example.test/app",
		});
		expect(bare.appLink("verify-email")).toBe(
			"https://example.test/app/verify-email",
		);
	});

	it("resolves null without calling Appwrite when there is no cookie", async () => {
		const { context, get, createUserClient } = setup(null);
		await expect(context.getUser()).resolves.toBeNull();
		expect(createUserClient).not.toHaveBeenCalled();
		expect(get).not.toHaveBeenCalled();
	});

	it("loads the user once even when awaited twice", async () => {
		const { context, get, createUserClient } = setup();
		get.mockResolvedValue(aUser());
		const [a, b] = await Promise.all([context.getUser(), context.getUser()]);
		await context.getUser();
		expect(a).toEqual(aUser());
		expect(b).toBe(a);
		expect(get).toHaveBeenCalledTimes(1);
		expect(createUserClient).toHaveBeenCalledWith(aSession().secret);
	});

	it.each([
		"user_session_not_found",
		"user_unauthorized",
	])("resolves null and clears the cookie on %s", async (type) => {
		const { context, get, sessionCookie } = setup();
		get.mockRejectedValue(appwriteError(type, 401));
		await expect(context.getUser()).resolves.toBeNull();
		expect(sessionCookie.clear).toHaveBeenCalledTimes(1);
		expect(sessionCookie.read()).toBeUndefined();
	});

	it("treats the session as gone for the rest of the request", async () => {
		const { context, get, sessionCookie } = setup();
		get.mockRejectedValue(appwriteError("user_session_not_found", 401));
		await context.getUser();
		expect(() => context.appwrite.user()).toThrow("UNAUTHENTICATED");
		// Even if the cookie store still returns the stale value.
		vi.spyOn(sessionCookie, "read").mockReturnValue("stale");
		expect(() => context.appwrite.user()).toThrow("UNAUTHENTICATED");
		await expect(context.getUser()).resolves.toBeNull();
		expect(get).toHaveBeenCalledTimes(1);
	});

	it("rejects with an AppError on other failures and keeps the cookie", async () => {
		const { context, get, sessionCookie } = setup();
		get.mockRejectedValue(appwriteError("general_server_error", 500));
		const failure = await context.getUser().catch((e: unknown) => e);
		expect(failure).toBeInstanceOf(AppError);
		expect((failure as AppError).code).toBe("UNKNOWN");
		expect(sessionCookie.clear).not.toHaveBeenCalled();
	});

	it("appwrite.user() throws UNAUTHENTICATED without a cookie", () => {
		const { context } = setup(null);
		expect(() => context.appwrite.user()).toThrow(AppError);
		expect(() => context.appwrite.user()).toThrow("UNAUTHENTICATED");
	});

	it("appwrite.user() reuses one client per request", () => {
		const { context, createUserClient } = setup();
		expect(context.appwrite.user()).toBe(context.appwrite.user());
		expect(createUserClient).toHaveBeenCalledTimes(1);
	});

	it("forSession builds a client for the given secret, even without a cookie", () => {
		const { context, createUserClient } = setup(null);
		expect(context.appwrite.forSession("new-secret")).toBeDefined();
		expect(createUserClient).toHaveBeenCalledWith("new-secret");
	});

	it("builds the admin client lazily, once", () => {
		const { context, createAdminClient } = setup();
		expect(createAdminClient).not.toHaveBeenCalled();
		expect(context.appwrite.admin()).toBe(context.appwrite.admin());
		expect(createAdminClient).toHaveBeenCalledTimes(1);
	});

	it("gives the admin client (which creates sessions) the request's user agent", () => {
		const { context, createAdminClient } = setup();
		context.appwrite.admin();
		expect(createAdminClient).toHaveBeenCalledWith({
			forwardedUserAgent: USER_AGENT,
		});
		expect(context.userAgent).toBe(USER_AGENT);
	});
});

describe("authMiddleware", () => {
	async function contextFor(headers: { ip?: string; xff?: string }) {
		vi.mocked(getRequestIP).mockReturnValue(headers.ip);
		vi.mocked(getRequestHeader).mockReturnValue(headers.xff);
		const next = vi.fn();
		// biome-ignore lint/suspicious/noExplicitAny: invoking the middleware body directly.
		await (authMiddleware.options.server as any)({ next });
		return next.mock.calls[0][0].context;
	}

	it("uses the socket address and ignores a spoofed X-Forwarded-For", async () => {
		hops = 0;
		const context = await contextFor({ ip: "198.51.100.4", xff: "6.6.6.6" });
		expect(context.clientIp).toBe("198.51.100.4");
		expect(getRequestIP).toHaveBeenCalledWith();
	});

	it("honours the configured number of trusted proxy hops", async () => {
		hops = 1;
		const context = await contextFor({
			ip: "10.0.0.1",
			xff: "6.6.6.6, 203.0.113.7",
		});
		expect(context.clientIp).toBe("203.0.113.7");
	});

	it("carries the language and theme this browser is using (R39)", async () => {
		const context = await contextFor({});
		expect(context.browserPrefs).toEqual({ locale: "it", theme: "dark" });
	});

	it("falls back to `unknown` when no address is available", async () => {
		hops = 0;
		expect((await contextFor({})).clientIp).toBe("unknown");
	});
});

describe("authMiddleware error normalization", () => {
	const serverFnMeta = {
		id: "fn-1",
		name: "listSessions",
		filename: "src/features/account/account.functions.ts",
	};

	/** Runs the middleware around a handler that throws `error`; resolves to what the client gets. */
	async function failWith(error: unknown) {
		const next = vi.fn(() => Promise.reject(error));
		// biome-ignore lint/suspicious/noExplicitAny: invoking the middleware body directly.
		const run = (authMiddleware.options.server as any)({ next, serverFnMeta });
		return run.then(
			() => {
				throw new Error("expected the middleware to reject");
			},
			(thrown: unknown) => thrown,
		);
	}

	afterEach(() => vi.restoreAllMocks());

	it("maps a raw Appwrite error to its stable code, without logging it", async () => {
		const log = vi.spyOn(console, "error").mockImplementation(() => {});
		const thrown = await failWith(
			appwriteError("user_invalid_credentials", 401),
		);
		expect(thrown).toEqual(new AppError("INVALID_CREDENTIALS"));
		expect(log).not.toHaveBeenCalled();
	});

	it("passes an AppError through untouched", async () => {
		const error = new AppError("FORBIDDEN");
		expect(await failWith(error)).toBe(error);
	});

	it("logs the original of an unmapped error with the function's name, and sends UNKNOWN", async () => {
		const log = vi.spyOn(console, "error").mockImplementation(() => {});
		const original = appwriteError("general_server_error", 500);
		const thrown = await failWith(original);
		expect(thrown).toEqual(new AppError("UNKNOWN"));
		expect(log).toHaveBeenCalledWith(
			expect.stringContaining("listSessions"),
			original,
		);
	});

	it("lets router redirects and not-founds through", async () => {
		const toLogin = redirect({ to: "/login" });
		const missing = notFound();
		expect(await failWith(toLogin)).toBe(toLogin);
		expect(await failWith(missing)).toBe(missing);
	});
});
