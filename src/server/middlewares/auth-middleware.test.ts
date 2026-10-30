import { notFound, redirect } from "@tanstack/react-router";
import { getRequestHeader, getRequestIP } from "@tanstack/react-start/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AuthService, SessionAuth } from "#/core/auth/ports";
import type { Backend } from "#/core/backend";
import { AppError } from "#/lib/errors";
import type { SessionCookie } from "#/server/context/context.types";
import { aSession, aUser } from "#/test/fixtures";
import { buildServerContext } from "../context/context.server";
import { authMiddleware } from "./auth-middleware";

let hops = 0;
vi.mock("@tanstack/react-start/server", () => ({
	getRequestIP: vi.fn(),
	getRequestHeader: vi.fn(),
}));
vi.mock("#/config/env", () => ({
	serverEnv: () => ({ TRUSTED_PROXY_HOPS: hops, APP_URL: "https://app.test" }),
}));
vi.mock("#/server/cookies/session-cookie.server", () => ({
	requestSessionCookie: () => ({ read: () => "secret" }),
}));
vi.mock("#/server/cookies/preference-cookies.server", () => ({
	requestPreferenceCookies: () => ({}),
	readLocaleHints: () => ({ acceptLanguage: "it-IT,it;q=0.9" }),
	requestCookieHeader: () => "theme=dark",
}));
const backendAuth = vi.hoisted(() => vi.fn());
vi.mock("#/server/backend.server", () => ({
	getBackend: async () => ({ auth: backendAuth, data: {} }),
}));

const USER_AGENT = "Mozilla/5.0 (Macintosh) Firefox/140.0";

function setup(secret: string | null = aSession().token) {
	let value: string | undefined = secret ?? undefined;
	const sessionCookie: SessionCookie = {
		read: () => value,
		write: (session) => {
			value = session.token;
		},
		clear: vi.fn(() => {
			value = undefined;
		}),
	};
	const get = vi.fn<SessionAuth["getUser"]>();
	const session = vi.fn(
		(_token: string) => ({ getUser: get }) as unknown as SessionAuth,
	);
	const auth = { session } as unknown as AuthService;
	const backend: Backend = {
		auth: vi.fn(() => auth),
		data: {} as Backend["data"],
	};
	const rateLimit = vi.fn();
	const deps: Parameters<typeof buildServerContext>[0] = {
		backend,
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
		rateLimit,
	};
	const context = buildServerContext(deps);
	return {
		context,
		deps,
		backend,
		auth,
		session,
		get,
		sessionCookie,
		rateLimit,
	};
}

describe("buildServerContext", () => {
	it("gives the backend the request's user agent (sessions it creates name the browser)", () => {
		const { context, backend, auth } = setup();
		expect(backend.auth).toHaveBeenCalledWith({ userAgent: USER_AGENT });
		expect(context.auth).toBe(auth);
		expect(context.data).toBe(backend.data);
		expect(context.userAgent).toBe(USER_AGENT);
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

	it("resolves null without calling the backend when there is no cookie", async () => {
		const { context, get, session } = setup(null);
		await expect(context.getUser()).resolves.toBeNull();
		expect(session).not.toHaveBeenCalled();
		expect(get).not.toHaveBeenCalled();
	});

	it("loads the user once even when awaited twice", async () => {
		const { context, get, session } = setup();
		get.mockResolvedValue(aUser());
		const [a, b] = await Promise.all([context.getUser(), context.getUser()]);
		await context.getUser();
		expect(a).toEqual(aUser());
		expect(b).toBe(a);
		expect(get).toHaveBeenCalledTimes(1);
		expect(session).toHaveBeenCalledWith(aSession().token);
	});

	it("resolves null and clears the cookie when the session ended", async () => {
		const { context, get, sessionCookie } = setup();
		get.mockRejectedValue(new AppError("UNAUTHENTICATED"));
		await expect(context.getUser()).resolves.toBeNull();
		expect(sessionCookie.clear).toHaveBeenCalledTimes(1);
		expect(sessionCookie.read()).toBeUndefined();
	});

	it("treats the session as gone for the rest of the request", async () => {
		const { context, get, sessionCookie } = setup();
		get.mockRejectedValue(new AppError("UNAUTHENTICATED"));
		await context.getUser();
		expect(() => context.session()).toThrow("UNAUTHENTICATED");
		// Even if the cookie store still returns the stale value.
		vi.spyOn(sessionCookie, "read").mockReturnValue("stale");
		expect(() => context.session()).toThrow("UNAUTHENTICATED");
		await expect(context.getUser()).resolves.toBeNull();
		expect(get).toHaveBeenCalledTimes(1);
	});

	it("rejects with an AppError on other failures and keeps the cookie", async () => {
		const { context, get, sessionCookie } = setup();
		get.mockRejectedValue(new Error("down"));
		const failure = await context.getUser().catch((e: unknown) => e);
		expect(failure).toBeInstanceOf(AppError);
		expect((failure as AppError).code).toBe("UNKNOWN");
		expect(sessionCookie.clear).not.toHaveBeenCalled();
	});

	it("session() throws UNAUTHENTICATED without a cookie", () => {
		const { context } = setup(null);
		expect(() => context.session()).toThrow(AppError);
		expect(() => context.session()).toThrow("UNAUTHENTICATED");
	});

	it("session() acts as the cookie's session", () => {
		const { context, session } = setup();
		context.session();
		expect(session).toHaveBeenCalledWith(aSession().token);
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

	it("builds the context on the backend in use", async () => {
		backendAuth.mockReturnValue({});
		await contextFor({});
		expect(backendAuth).toHaveBeenCalled();
	});

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

	it("maps a serialized code to its AppError, without logging it", async () => {
		const log = vi.spyOn(console, "error").mockImplementation(() => {});
		const thrown = await failWith(new Error("INVALID_CREDENTIALS"));
		expect(thrown).toEqual(new AppError("INVALID_CREDENTIALS"));
		expect(log).not.toHaveBeenCalled();
	});

	it("passes an AppError through untouched", async () => {
		const error = new AppError("FORBIDDEN");
		expect(await failWith(error)).toBe(error);
	});

	it("logs the original of an unmapped error with the function's name, and sends UNKNOWN", async () => {
		const log = vi.spyOn(console, "error").mockImplementation(() => {});
		const original = new Error("boom");
		const thrown = await failWith(original);
		expect(thrown).toEqual(new AppError("UNKNOWN"));
		expect(log).toHaveBeenCalledWith(
			expect.stringContaining("listSessions"),
			original,
		);
	});

	it("logs an adapter's vendor error, kept as the cause of its UNKNOWN", async () => {
		const log = vi.spyOn(console, "error").mockImplementation(() => {});
		const vendor = new Error("vendor 500");
		await failWith(new AppError("UNKNOWN", { cause: vendor }));
		expect(log).toHaveBeenCalledWith(expect.any(String), vendor);
	});

	it("lets router redirects and not-founds through", async () => {
		const toLogin = redirect({ to: "/login" });
		const missing = notFound();
		expect(await failWith(toLogin)).toBe(toLogin);
		expect(await failWith(missing)).toBe(missing);
	});
});
