import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_PREFS } from "#/core/prefs";
import { AppError } from "#/lib/errors";
import type { ServerContext } from "#/server/context/context.types";
import { serverHooks } from "#/server/server-hooks.server";
import { createTestContext } from "#/test/test-context";
import { throughMiddleware } from "#/test/through-middleware";
import {
	confirmVerificationHandler,
	getCurrentUserHandler,
	requestPasswordResetHandler,
	resetPasswordHandler,
	sendVerificationHandler,
	signInAndMergeGuestHandler,
	signInHandler,
	signOutEverywhereHandler,
	signOutHandler,
	signUpHandler,
	startGuestSessionHandler,
	upgradeGuestHandler,
} from "./auth.handlers.server";

const credentials = { email: "ann@example.test", password: "password1" };
const signUpData = { name: "Ann", ...credentials };

const rateLimited = () => {
	throw new AppError("RATE_LIMITED");
};

afterEach(() => vi.restoreAllMocks());

describe("getCurrentUserHandler", () => {
	it("returns null when signed out", async () => {
		const { context } = createTestContext();
		await expect(getCurrentUserHandler({ context })).resolves.toBeNull();
	});

	it("returns the signed-in user", async () => {
		const test = createTestContext();
		const { user } = await test.seedUser();
		await expect(
			getCurrentUserHandler({ context: test.context }),
		).resolves.toEqual(user);
	});
});

describe("signInHandler", () => {
	it("writes the session cookie and returns the user", async () => {
		const test = createTestContext();
		const { user } = await test.seedUser({ ...credentials, signIn: false });
		await expect(
			signInHandler({ data: credentials, context: test.context }),
		).resolves.toEqual(user);
		expect(test.auth.signIn).toHaveBeenCalledWith(credentials);
		const session = await test.auth.signIn.mock.results[0]?.value;
		expect(test.sessionCookie.value).toBe(session.token);
	});

	it("rate-limits by ip and by ip plus email", async () => {
		const test = createTestContext({ clientIp: "198.51.100.7" });
		await test.seedUser({ ...credentials, signIn: false });
		await signInHandler({ data: credentials, context: test.context });
		expect(test.rateLimit).toHaveBeenNthCalledWith(1, "signIn", "198.51.100.7");
		expect(test.rateLimit).toHaveBeenNthCalledWith(
			2,
			"signInEmail",
			"198.51.100.7|ann@example.test",
		);
	});

	it("rejects invalid credentials and leaves the cookie untouched", async () => {
		const test = createTestContext();
		await test.seedUser({ ...credentials, signIn: false });
		await expect(
			throughMiddleware(
				signInHandler({
					data: { ...credentials, password: "wrong-password" },
					context: test.context,
				}),
			),
		).rejects.toEqual(new AppError("INVALID_CREDENTIALS"));
		expect(test.sessionCookie.value).toBeUndefined();
	});

	it("never calls the backend when rate limited", async () => {
		const test = createTestContext();
		test.rateLimit.mockImplementation(rateLimited);
		await expect(
			throughMiddleware(
				signInHandler({ data: credentials, context: test.context }),
			),
		).rejects.toEqual(new AppError("RATE_LIMITED"));
		expect(test.auth.signIn).not.toHaveBeenCalled();
	});
});

describe("signUpHandler", () => {
	it("creates the account, signs in, sets default prefs and sends the verification email", async () => {
		const test = createTestContext();
		const user = await signUpHandler({
			data: signUpData,
			context: test.context,
		});

		expect(user).toMatchObject({
			name: "Ann",
			email: credentials.email,
			emailVerified: false,
			prefs: DEFAULT_PREFS,
		});
		expect(test.rateLimit).toHaveBeenCalledWith("signUp", "203.0.113.1");
		expect(test.auth.signUp).toHaveBeenCalledWith(signUpData);
		await expect(test.context.getUser()).resolves.toEqual(user);
		expect(test.emails).toEqual([
			expect.objectContaining({
				to: credentials.email,
				purpose: "verification",
				url: expect.stringMatching(/^http:\/\/app\.test\/verify-email\?/),
			}),
		]);
	});

	it("rejects an existing account as EMAIL_TAKEN", async () => {
		const test = createTestContext();
		await test.seedUser({ ...credentials, signIn: false });
		await expect(
			throughMiddleware(
				signUpHandler({ data: signUpData, context: test.context }),
			),
		).rejects.toEqual(new AppError("EMAIL_TAKEN"));
		expect(test.sessionCookie.value).toBeUndefined();
	});

	it("still resolves the user when saving the default prefs fails", async () => {
		const test = createTestContext();
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		test.session.updatePrefs.mockRejectedValueOnce(new Error("boom"));
		await expect(
			signUpHandler({ data: signUpData, context: test.context }),
		).resolves.toMatchObject({ email: credentials.email, prefs: {} });
		expect(warn).toHaveBeenCalled();
	});

	it("still resolves the user when the verification email fails", async () => {
		const test = createTestContext();
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		test.session.sendVerification.mockRejectedValueOnce(new Error("smtp"));
		await expect(
			signUpHandler({ data: signUpData, context: test.context }),
		).resolves.toMatchObject({ email: credentials.email });
		expect(warn).toHaveBeenCalled();
	});

	it("never calls the backend when rate limited", async () => {
		const test = createTestContext();
		test.rateLimit.mockImplementation(rateLimited);
		await expect(
			throughMiddleware(
				signUpHandler({ data: signUpData, context: test.context }),
			),
		).rejects.toEqual(new AppError("RATE_LIMITED"));
		expect(test.auth.signUp).not.toHaveBeenCalled();
	});
});

describe("signOutHandler", () => {
	it("forgets the dismissed guest banner", async () => {
		const test = createTestContext();
		await test.seedGuest();
		await signOutHandler({ context: test.context });
		expect(test.preferenceCookies.guestBannerCleared).toBe(true);
	});

	it("ends the current session and clears the cookie", async () => {
		const test = createTestContext();
		const { session } = await test.seedUser();
		await signOutHandler({ context: test.context });
		expect(test.session.signOut).toHaveBeenCalledWith(session.token);
		expect(test.sessionCookie.value).toBeUndefined();
		await expect(
			test.backend
				.auth({ userAgent: undefined })
				.session(session.token)
				.getUser(),
		).rejects.toEqual(new AppError("UNAUTHENTICATED"));
	});

	it("clears the cookie even when the backend rejects", async () => {
		const test = createTestContext();
		await test.seedUser();
		vi.spyOn(console, "warn").mockImplementation(() => {});
		test.session.signOut.mockRejectedValueOnce(new Error("boom"));
		await signOutHandler({ context: test.context });
		expect(test.sessionCookie.value).toBeUndefined();
	});

	it("clears the cookie when there is no session to end", async () => {
		const test = createTestContext();
		vi.spyOn(console, "warn").mockImplementation(() => {});
		test.sessionCookie.value = "stale";
		await signOutHandler({ context: test.context });
		expect(test.sessionCookie.value).toBeUndefined();
	});
});

describe("signOutEverywhereHandler", () => {
	it("ends every session, clears the cookie and forgets the guest banner", async () => {
		const test = createTestContext();
		const { session } = await test.seedUser(credentials);
		const other = await test.backend
			.auth({ userAgent: undefined })
			.signIn(credentials);
		await signOutEverywhereHandler({ context: test.context });
		expect(test.session.signOutEverywhere).toHaveBeenCalledWith(session.token);
		expect(test.sessionCookie.value).toBeUndefined();
		expect(test.preferenceCookies.guestBannerCleared).toBe(true);
		await expect(
			test.backend
				.auth({ userAgent: undefined })
				.session(other.token)
				.getUser(),
		).rejects.toEqual(new AppError("UNAUTHENTICATED"));
	});

	it("clears the cookie and resolves when the session already ended", async () => {
		const test = createTestContext();
		test.sessionCookie.value = "stale";
		await expect(
			signOutEverywhereHandler({ context: test.context }),
		).resolves.toBeUndefined();
		expect(test.sessionCookie.value).toBeUndefined();
	});

	it("keeps the cookie and rethrows other errors", async () => {
		const test = createTestContext();
		const { session } = await test.seedUser();
		test.session.signOutEverywhere.mockRejectedValueOnce(new Error("boom"));
		await expect(
			throughMiddleware(signOutEverywhereHandler({ context: test.context })),
		).rejects.toEqual(new AppError("UNKNOWN"));
		expect(test.sessionCookie.value).toBe(session.token);
	});

	it("resolves when there is no session at all", async () => {
		const { context } = createTestContext();
		await expect(
			signOutEverywhereHandler({ context }),
		).resolves.toBeUndefined();
	});
});

describe("startGuestSessionHandler", () => {
	it("rate-limits, writes the cookie, saves default prefs and returns the guest", async () => {
		const test = createTestContext();
		const guest = await startGuestSessionHandler({ context: test.context });
		expect(guest).toMatchObject({ isGuest: true, prefs: DEFAULT_PREFS });
		expect(test.rateLimit).toHaveBeenCalledWith("guest", "203.0.113.1");
		await expect(test.context.getUser()).resolves.toEqual(guest);
	});

	it("shows a new guest the banner, even if a previous guest dismissed it", async () => {
		const test = createTestContext();
		await startGuestSessionHandler({ context: test.context });
		expect(test.preferenceCookies.guestBannerCleared).toBe(true);
	});

	it("never calls the backend when rate limited", async () => {
		const test = createTestContext();
		test.rateLimit.mockImplementation(rateLimited);
		await expect(
			throughMiddleware(startGuestSessionHandler({ context: test.context })),
		).rejects.toEqual(new AppError("RATE_LIMITED"));
		expect(test.auth.startGuest).not.toHaveBeenCalled();
	});

	it("leaves the cookie untouched when the session cannot be created", async () => {
		const test = createTestContext();
		test.auth.startGuest.mockRejectedValueOnce(new Error("down"));
		await expect(
			throughMiddleware(startGuestSessionHandler({ context: test.context })),
		).rejects.toEqual(new AppError("UNKNOWN"));
		expect(test.sessionCookie.value).toBeUndefined();
	});

	it("still resolves the guest when saving the default prefs fails", async () => {
		const test = createTestContext();
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		test.session.updatePrefs.mockRejectedValueOnce(new Error("boom"));
		await expect(
			startGuestSessionHandler({ context: test.context }),
		).resolves.toMatchObject({ isGuest: true });
		expect(warn).toHaveBeenCalled();
	});
});

describe("upgradeGuestHandler", () => {
	it("converts the guest in place, keeps the session the backend returns and sends the verification email", async () => {
		const test = createTestContext();
		const { user: guest } = await test.seedGuest();
		const user = await upgradeGuestHandler({
			data: signUpData,
			context: test.context,
		});
		expect(user).toMatchObject({
			id: guest.id,
			email: credentials.email,
			name: "Ann",
			isGuest: false,
		});
		const kept = await test.session.upgradeGuest.mock.results[0]?.value;
		expect(test.sessionCookie.value).toBe(kept.token);
		expect(test.emails).toEqual([
			expect.objectContaining({ purpose: "verification" }),
		]);
	});

	it("writes the cookie of a new session when the backend swaps it", async () => {
		const test = createTestContext();
		await test.seedGuest();
		const swapped = await test.backend
			.auth({ userAgent: undefined })
			.signUp({ ...signUpData, email: "other@example.test" });
		test.session.upgradeGuest.mockResolvedValueOnce(swapped);
		await upgradeGuestHandler({ data: signUpData, context: test.context });
		expect(test.sessionCookie.value).toBe(swapped.token);
	});

	it("keeps the guest cookie when the upgrade fails", async () => {
		const test = createTestContext();
		const { session } = await test.seedGuest();
		await test.seedUser({ ...credentials, signIn: false });
		test.sessionCookie.value = session.token;
		await expect(
			throughMiddleware(
				upgradeGuestHandler({ data: signUpData, context: test.context }),
			),
		).rejects.toEqual(new AppError("EMAIL_TAKEN"));
		expect(test.sessionCookie.value).toBe(session.token);
	});

	it("still upgrades when the verification email fails", async () => {
		const test = createTestContext();
		await test.seedGuest();
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		test.session.sendVerification.mockRejectedValueOnce(new Error("smtp"));
		await expect(
			upgradeGuestHandler({ data: signUpData, context: test.context }),
		).resolves.toMatchObject({ email: credentials.email });
		expect(warn).toHaveBeenCalledOnce();
	});

	it("rejects FORBIDDEN for a non-guest without touching the backend", async () => {
		const test = createTestContext();
		await test.seedUser();
		await expect(
			throughMiddleware(
				upgradeGuestHandler({ data: signUpData, context: test.context }),
			),
		).rejects.toEqual(new AppError("FORBIDDEN"));
		expect(test.session.upgradeGuest).not.toHaveBeenCalled();
	});

	it("rejects UNAUTHENTICATED when signed out", async () => {
		const { context } = createTestContext();
		await expect(
			throughMiddleware(upgradeGuestHandler({ data: signUpData, context })),
		).rejects.toEqual(new AppError("UNAUTHENTICATED"));
	});

	it("rate-limits like sign-up before any backend call", async () => {
		const test = createTestContext();
		await test.seedGuest();
		test.rateLimit.mockImplementation(rateLimited);
		await expect(
			throughMiddleware(
				upgradeGuestHandler({ data: signUpData, context: test.context }),
			),
		).rejects.toEqual(new AppError("RATE_LIMITED"));
		expect(test.rateLimit).toHaveBeenCalledWith("signUp", "203.0.113.1");
		expect(test.session.upgradeGuest).not.toHaveBeenCalled();
	});
});

describe("signInAndMergeGuestHandler", () => {
	async function arrange() {
		const test = createTestContext();
		const { user } = await test.seedUser({ ...credentials, signIn: false });
		const { user: guest, session: guestSession } = await test.seedGuest();
		const onGuestMerge = vi.spyOn(serverHooks, "onGuestMerge");
		return { ...test, user, guest, guestSession, onGuestMerge };
	}

	it("validates credentials, runs the hook, deletes the guest, then swaps the cookie", async () => {
		const test = await arrange();
		await test.context.data.todos.create(test.guest.id, { title: "mine" });

		const user = await signInAndMergeGuestHandler({
			data: credentials,
			context: test.context,
		});

		expect(user.id).toBe(test.user.id);
		expect(test.onGuestMerge).toHaveBeenCalledWith({
			guestUserId: test.guest.id,
			userId: test.user.id,
			data: test.context.data,
		});
		expect(test.admin.deleteUser).toHaveBeenCalledWith(test.guest.id);
		const order = [
			test.auth.signIn.mock.invocationCallOrder[0],
			test.onGuestMerge.mock.invocationCallOrder[0],
			test.admin.deleteUser.mock.invocationCallOrder[0],
		];
		expect(order).toEqual([...order].sort((a, b) => (a ?? 0) - (b ?? 0)));
		expect(test.sessionCookie.value).not.toBe(test.guestSession.token);
		await expect(test.context.getUser()).resolves.toBeTruthy();
		// The default hook moves the example table's rows.
		const { items } = await test.context.data.todos.list(test.user.id);
		expect(items.map((todo) => todo.title)).toEqual(["mine"]);
	});

	it("rejects INVALID_CREDENTIALS without running the hook or deleting the guest", async () => {
		const test = await arrange();
		await expect(
			throughMiddleware(
				signInAndMergeGuestHandler({
					data: { ...credentials, password: "wrong-password" },
					context: test.context,
				}),
			),
		).rejects.toEqual(new AppError("INVALID_CREDENTIALS"));
		expect(test.onGuestMerge).not.toHaveBeenCalled();
		expect(test.admin.deleteUser).not.toHaveBeenCalled();
		expect(test.sessionCookie.value).toBe(test.guestSession.token);
	});

	it("keeps the guest and the cookie, and deletes the unused session, when the hook rejects", async () => {
		const test = await arrange();
		test.onGuestMerge.mockRejectedValueOnce(new Error("merge failed"));
		await expect(
			throughMiddleware(
				signInAndMergeGuestHandler({
					data: credentials,
					context: test.context,
				}),
			),
		).rejects.toEqual(new AppError("UNKNOWN"));
		expect(test.admin.deleteUser).not.toHaveBeenCalled();
		const created = await test.auth.signIn.mock.results[0]?.value;
		expect(test.admin.deleteSession).toHaveBeenCalledWith({
			userId: test.user.id,
			sessionId: created.id,
		});
		expect(test.sessionCookie.value).toBe(test.guestSession.token);
	});

	it("deletes the unused session when deleting the guest fails, and still reports the original error", async () => {
		const test = await arrange();
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		test.admin.deleteUser.mockRejectedValueOnce(new Error("delete failed"));
		test.admin.deleteSession.mockRejectedValueOnce(new Error("cleanup"));
		await expect(
			throughMiddleware(
				signInAndMergeGuestHandler({
					data: credentials,
					context: test.context,
				}),
			),
		).rejects.toEqual(new AppError("UNKNOWN"));
		expect(test.admin.deleteSession).toHaveBeenCalledOnce();
		expect(warn).toHaveBeenCalled();
		expect(test.sessionCookie.value).toBe(test.guestSession.token);
	});

	it("rejects FORBIDDEN for a non-guest and UNAUTHENTICATED when signed out", async () => {
		const signedIn = createTestContext();
		await signedIn.seedUser();
		await expect(
			throughMiddleware(
				signInAndMergeGuestHandler({
					data: credentials,
					context: signedIn.context,
				}),
			),
		).rejects.toEqual(new AppError("FORBIDDEN"));
		expect(signedIn.auth.signIn).not.toHaveBeenCalled();

		const signedOut = createTestContext();
		await expect(
			throughMiddleware(
				signInAndMergeGuestHandler({
					data: credentials,
					context: signedOut.context,
				}),
			),
		).rejects.toEqual(new AppError("UNAUTHENTICATED"));
	});

	it("rate-limits like sign-in before any backend call", async () => {
		const test = await arrange();
		test.rateLimit.mockImplementation(rateLimited);
		await expect(
			throughMiddleware(
				signInAndMergeGuestHandler({
					data: credentials,
					context: test.context,
				}),
			),
		).rejects.toEqual(new AppError("RATE_LIMITED"));
		expect(test.auth.signIn).not.toHaveBeenCalled();
	});
});

describe("requestPasswordResetHandler", () => {
	it("rate-limits by ip, then by ip and email, then emails a link to /reset-password", async () => {
		const test = createTestContext();
		await test.seedUser({ ...credentials, signIn: false });

		await expect(
			requestPasswordResetHandler({
				data: { email: credentials.email },
				context: test.context,
			}),
		).resolves.toEqual({ ok: true });

		expect(test.rateLimit).toHaveBeenNthCalledWith(
			1,
			"passwordResetIp",
			"203.0.113.1",
		);
		expect(test.rateLimit).toHaveBeenNthCalledWith(
			2,
			"passwordReset",
			`203.0.113.1|${credentials.email}`,
		);
		expect(test.auth.requestPasswordReset).toHaveBeenCalledWith({
			email: credentials.email,
			redirectUrl: "http://app.test/reset-password",
		});
		expect(test.emails).toHaveLength(1);
	});

	it("keeps a sub-path of APP_URL in the link", async () => {
		const test = createTestContext({ appUrl: "https://example.test/app" });
		await requestPasswordResetHandler({
			data: { email: "a@b.test" },
			context: test.context,
		});
		expect(test.auth.requestPasswordReset).toHaveBeenCalledWith({
			email: "a@b.test",
			redirectUrl: "https://example.test/app/reset-password",
		});
	});

	it("does not reveal unknown emails", async () => {
		const test = createTestContext();
		await expect(
			requestPasswordResetHandler({
				data: { email: "nobody@b.test" },
				context: test.context,
			}),
		).resolves.toEqual({ ok: true });
		expect(test.emails).toEqual([]);
	});

	it("still answers ok when sending fails for an existing email, and logs it", async () => {
		const log = vi.spyOn(console, "error").mockImplementation(() => {});
		const test = createTestContext();
		const failure = new AppError("UNKNOWN");
		test.auth.requestPasswordReset.mockRejectedValueOnce(failure);
		await expect(
			requestPasswordResetHandler({
				data: { email: "a@b.test" },
				context: test.context,
			}),
		).resolves.toEqual({ ok: true });
		expect(log).toHaveBeenCalledWith(expect.any(String), failure);
	});

	it("surfaces the backend's own rate limit", async () => {
		const test = createTestContext();
		test.auth.requestPasswordReset.mockRejectedValueOnce(
			new AppError("RATE_LIMITED"),
		);
		await expect(
			throughMiddleware(
				requestPasswordResetHandler({
					data: { email: "a@b.test" },
					context: test.context,
				}),
			),
		).rejects.toEqual(new AppError("RATE_LIMITED"));
	});

	it("does not call the backend when rate limited", async () => {
		const test = createTestContext();
		test.rateLimit.mockImplementation(rateLimited);
		await expect(
			throughMiddleware(
				requestPasswordResetHandler({
					data: { email: "a@b.test" },
					context: test.context,
				}),
			),
		).rejects.toEqual(new AppError("RATE_LIMITED"));
		expect(test.auth.requestPasswordReset).not.toHaveBeenCalled();
	});
});

describe("resetPasswordHandler", () => {
	it("sets the new password from the emailed link", async () => {
		const test = createTestContext();
		await test.seedUser({ ...credentials, signIn: false });
		await requestPasswordResetHandler({
			data: { email: credentials.email },
			context: test.context,
		});
		const link = test.lastLink("recovery");
		await expect(
			resetPasswordHandler({
				data: { link, password: "new-password" },
				context: test.context,
			}),
		).resolves.toEqual({ ok: true });
		await expect(
			signInHandler({
				data: { ...credentials, password: "new-password" },
				context: test.context,
			}),
		).resolves.toMatchObject({ email: credentials.email });
	});

	it("rejects an expired or invalid link as INVALID_TOKEN", async () => {
		const { context } = createTestContext();
		await expect(
			throughMiddleware(
				resetPasswordHandler({
					data: { link: { token: "made-up" }, password: "new-password" },
					context,
				}),
			),
		).rejects.toEqual(new AppError("INVALID_TOKEN"));
	});
});

describe("sendVerificationHandler", () => {
	it("emails a verification link to /verify-email", async () => {
		const test = createTestContext();
		await test.seedUser({ verified: false });
		await expect(
			sendVerificationHandler({ context: test.context }),
		).resolves.toEqual({ ok: true });
		expect(test.emails).toEqual([
			expect.objectContaining({
				purpose: "verification",
				url: expect.stringMatching(/^http:\/\/app\.test\/verify-email\?/),
			}),
		]);
	});

	it("is FORBIDDEN for a guest", async () => {
		const test = createTestContext();
		await test.seedGuest();
		await expect(
			throughMiddleware(sendVerificationHandler({ context: test.context })),
		).rejects.toEqual(new AppError("FORBIDDEN"));
		expect(test.session.sendVerification).not.toHaveBeenCalled();
	});

	it("is UNAUTHENTICATED when signed out", async () => {
		const { context } = createTestContext();
		await expect(
			throughMiddleware(sendVerificationHandler({ context })),
		).rejects.toEqual(new AppError("UNAUTHENTICATED"));
	});

	it("surfaces backend failures", async () => {
		const test = createTestContext();
		await test.seedUser({ verified: false });
		test.session.sendVerification.mockRejectedValueOnce(
			new AppError("RATE_LIMITED"),
		);
		await expect(
			throughMiddleware(sendVerificationHandler({ context: test.context })),
		).rejects.toEqual(new AppError("RATE_LIMITED"));
	});
});

describe("confirmVerificationHandler", () => {
	it("confirms the email from its link, signed out too", async () => {
		const test = createTestContext();
		const { session } = await test.seedUser({ verified: false });
		await sendVerificationHandler({ context: test.context });
		const link = test.lastLink("verification");
		test.sessionCookie.value = undefined;
		await expect(
			confirmVerificationHandler({ data: { link }, context: test.context }),
		).resolves.toEqual({ ok: true });
		expect(test.auth.confirmVerification).toHaveBeenCalledWith(link);
		await expect(
			test.backend
				.auth({ userAgent: undefined })
				.session(session.token)
				.getUser(),
		).resolves.toMatchObject({ emailVerified: true });
	});

	it("rejects an invalid link as INVALID_TOKEN", async () => {
		const { context } = createTestContext();
		await expect(
			throughMiddleware(
				confirmVerificationHandler({
					data: { link: { token: "made-up" } },
					context,
				}),
			),
		).rejects.toEqual(new AppError("INVALID_TOKEN"));
	});
});

describe("preferences of a new or signed-in user (R39)", () => {
	const browsing = { locale: "it", theme: "dark" } as const;
	const stored = { ...DEFAULT_PREFS, locale: "it", theme: "light" } as const;

	/** A guest signed in, and Ann's account with `prefs`, for the five sign-in paths. */
	async function arrange(prefs: Partial<typeof stored> = stored) {
		const test = createTestContext({ browserPrefs: browsing });
		await test.seedUser({ ...credentials, prefs, signIn: false });
		await test.seedGuest({ prefs });
		vi.spyOn(serverHooks, "onGuestMerge").mockResolvedValue(undefined);
		return test;
	}

	const paths = {
		signIn: (context: ServerContext) =>
			signInHandler({ data: credentials, context }),
		signUp: (context: ServerContext) =>
			signUpHandler({
				data: { ...signUpData, email: "new@example.test" },
				context,
			}),
		startGuest: (context: ServerContext) =>
			startGuestSessionHandler({ context }),
		upgrade: (context: ServerContext) =>
			upgradeGuestHandler({
				data: { ...signUpData, email: "new@example.test" },
				context,
			}),
		merge: (context: ServerContext) =>
			signInAndMergeGuestHandler({ data: credentials, context }),
	};

	it.each(
		Object.entries(paths),
	)("%s writes both preference cookies from the account", async (name, run) => {
		const test = await arrange();
		// New accounts start with the browser's; make them hold the stored ones.
		if (name === "signUp" || name === "startGuest") {
			test.session.updatePrefs.mockImplementationOnce(async (token: string) =>
				test.backend
					.auth({ userAgent: undefined })
					.session(token)
					.updatePrefs(stored),
			);
		}
		await run(test.context);
		expect(test.preferenceCookies.locale).toBe("it");
		expect(test.preferenceCookies.theme).toBe("light");
	});

	it.each(
		Object.entries(paths),
	)("%s keeps the browser's cookies when the account has no preference", async (name, run) => {
		const test = await arrange({});
		if (name === "signUp" || name === "startGuest") {
			test.session.updatePrefs.mockResolvedValueOnce({});
		}
		await run(test.context);
		expect(test.preferenceCookies.locale).toBeUndefined();
		expect(test.preferenceCookies.theme).toBeUndefined();
	});

	it.each([
		["signUp", paths.signUp],
		["startGuest", paths.startGuest],
	])("%s seeds the account with the language and theme being browsed", async (_, run) => {
		const test = await arrange();
		const user = await run(test.context);
		expect(test.session.updatePrefs).toHaveBeenCalledWith(expect.any(String), {
			onboardingCompleted: false,
			locale: "it",
			theme: "dark",
		});
		expect(user.prefs).toEqual({
			onboardingCompleted: false,
			locale: "it",
			theme: "dark",
		});
	});
});
