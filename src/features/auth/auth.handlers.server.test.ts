import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_PREFS } from "#/lib/appwrite/app-models";
import { AppError } from "#/lib/errors";
import type { ServerContext } from "#/server/context";
import { serverHooks } from "#/server/server-hooks.server";
import { appwriteError } from "#/test/appwrite-error";
import { aGuest, aGuestSession, aJwt, aSession, aUser } from "#/test/fixtures";
import { createTestContext } from "#/test/test-context";
import { throughMiddleware } from "#/test/through-middleware";
import {
	confirmVerificationHandler,
	getCurrentUserHandler,
	issueBrowserJwtHandler,
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

describe("getCurrentUserHandler", () => {
	it("returns null when signed out", async () => {
		const { context } = createTestContext({ user: null });
		await expect(getCurrentUserHandler({ context })).resolves.toBeNull();
	});

	it("returns the signed-in user", async () => {
		const user = aUser();
		const { context } = createTestContext({ user });
		await expect(getCurrentUserHandler({ context })).resolves.toEqual(user);
	});
});

describe("issueBrowserJwtHandler", () => {
	it("mints a JWT for the user and current session", async () => {
		const { context, userAccount, adminUsers } = createTestContext({
			user: aUser({ $id: "u-9" }),
		});
		userAccount.getSession.mockResolvedValue(aSession({ $id: "s-9" }));
		adminUsers.createJWT.mockResolvedValue(aJwt());

		const result = await issueBrowserJwtHandler({ context });

		expect(result).toEqual({ jwt: aJwt().jwt });
		expect(userAccount.getSession).toHaveBeenCalledWith({
			sessionId: "current",
		});
		expect(adminUsers.createJWT).toHaveBeenCalledWith({
			userId: "u-9",
			sessionId: "s-9",
		});
	});

	it("rejects with UNAUTHENTICATED without touching admin when signed out", async () => {
		const { context, adminUsers } = createTestContext({ user: null });
		await expect(
			throughMiddleware(issueBrowserJwtHandler({ context })),
		).rejects.toEqual(new AppError("UNAUTHENTICATED"));
		expect(adminUsers.createJWT).not.toHaveBeenCalled();
	});
});

const credentials = { email: "ann@example.com", password: "password1" };

describe("signInHandler", () => {
	it("writes the session cookie and returns the user", async () => {
		const user = aUser();
		const { context, adminAccount, userAccount, sessionCookie, forSession } =
			createTestContext();
		adminAccount.createEmailPasswordSession.mockResolvedValue(aSession());
		userAccount.get.mockResolvedValue(user);

		await expect(signInHandler({ data: credentials, context })).resolves.toBe(
			user,
		);

		expect(adminAccount.createEmailPasswordSession).toHaveBeenCalledWith(
			credentials,
		);
		expect(sessionCookie.value).toBe(aSession().secret);
		expect(forSession).toHaveBeenCalledWith(aSession().secret);
	});

	it("rate-limits by ip and by ip plus email", async () => {
		const { context, adminAccount, userAccount, rateLimit } = createTestContext(
			{ clientIp: "198.51.100.7" },
		);
		adminAccount.createEmailPasswordSession.mockResolvedValue(aSession());
		userAccount.get.mockResolvedValue(aUser());
		await signInHandler({ data: credentials, context });
		expect(rateLimit).toHaveBeenNthCalledWith(1, "signIn", "198.51.100.7");
		expect(rateLimit).toHaveBeenNthCalledWith(
			2,
			"signInEmail",
			"198.51.100.7|ann@example.com",
		);
	});

	it("maps invalid credentials and leaves the cookie untouched", async () => {
		const { context, adminAccount, sessionCookie } = createTestContext();
		adminAccount.createEmailPasswordSession.mockRejectedValue(
			appwriteError("user_invalid_credentials", 401),
		);
		await expect(
			throughMiddleware(signInHandler({ data: credentials, context })),
		).rejects.toEqual(new AppError("INVALID_CREDENTIALS"));
		expect(sessionCookie.value).toBeUndefined();
	});

	it("never calls Appwrite when rate limited", async () => {
		const { context, adminAccount, rateLimit } = createTestContext();
		rateLimit.mockImplementation(() => {
			throw new AppError("RATE_LIMITED");
		});
		await expect(
			throughMiddleware(signInHandler({ data: credentials, context })),
		).rejects.toEqual(new AppError("RATE_LIMITED"));
		expect(adminAccount.createEmailPasswordSession).not.toHaveBeenCalled();
	});
});

describe("signUpHandler", () => {
	const data = { name: "Ann", ...credentials };

	function arrange() {
		const test = createTestContext();
		test.adminAccount.create.mockResolvedValue(aUser());
		test.adminAccount.createEmailPasswordSession.mockResolvedValue(aSession());
		test.userAccount.updatePrefs.mockResolvedValue(aUser());
		test.userAccount.get.mockResolvedValue(aUser());
		test.userAccount.createVerification.mockResolvedValue({} as never);
		return test;
	}

	it("creates the account, signs in, sets default prefs and sends the verification email", async () => {
		const { context, adminAccount, userAccount, sessionCookie, rateLimit } =
			arrange();

		await expect(signUpHandler({ data, context })).resolves.toEqual(aUser());

		expect(rateLimit).toHaveBeenCalledWith("signUp", "203.0.113.1");
		expect(adminAccount.create).toHaveBeenCalledWith({
			userId: expect.any(String),
			...data,
		});
		expect(sessionCookie.value).toBe(aSession().secret);
		expect(userAccount.updatePrefs).toHaveBeenCalledWith({
			prefs: DEFAULT_PREFS,
		});
		expect(userAccount.createVerification).toHaveBeenCalledWith({
			url: "http://app.test/verify-email",
		});
	});

	it("maps an existing account to EMAIL_TAKEN", async () => {
		const { context, adminAccount, sessionCookie } = arrange();
		adminAccount.create.mockRejectedValue(
			appwriteError("user_already_exists", 409),
		);
		await expect(
			throughMiddleware(signUpHandler({ data, context })),
		).rejects.toEqual(new AppError("EMAIL_TAKEN"));
		expect(sessionCookie.value).toBeUndefined();
	});

	it("still resolves the user when saving the default prefs fails", async () => {
		const { context, userAccount } = arrange();
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		userAccount.updatePrefs.mockRejectedValue(new Error("boom"));
		await expect(signUpHandler({ data, context })).resolves.toEqual(aUser());
		expect(warn).toHaveBeenCalled();
		warn.mockRestore();
	});

	it("still resolves the user when the verification email fails", async () => {
		const { context, userAccount } = arrange();
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		userAccount.createVerification.mockRejectedValue(new Error("smtp down"));
		await expect(signUpHandler({ data, context })).resolves.toEqual(aUser());
		expect(warn).toHaveBeenCalled();
		warn.mockRestore();
	});

	it("never calls Appwrite when rate limited", async () => {
		const { context, adminAccount, rateLimit } = arrange();
		rateLimit.mockImplementation(() => {
			throw new AppError("RATE_LIMITED");
		});
		await expect(
			throughMiddleware(signUpHandler({ data, context })),
		).rejects.toEqual(new AppError("RATE_LIMITED"));
		expect(adminAccount.create).not.toHaveBeenCalled();
	});
});

describe("signOutHandler", () => {
	it("forgets the dismissed guest banner", async () => {
		const { context, userAccount, preferenceCookies } = createTestContext({
			user: aGuest(),
		});
		userAccount.deleteSession.mockResolvedValue({} as never);
		await signOutHandler({ context });
		expect(preferenceCookies.guestBannerCleared).toBe(true);
	});

	it("deletes the current session and clears the cookie", async () => {
		const { context, userAccount, sessionCookie } = createTestContext({
			user: aUser(),
		});
		userAccount.deleteSession.mockResolvedValue({} as never);
		await signOutHandler({ context });
		expect(userAccount.deleteSession).toHaveBeenCalledWith({
			sessionId: "current",
		});
		expect(sessionCookie.value).toBeUndefined();
	});

	it("clears the cookie even when Appwrite rejects", async () => {
		const { context, userAccount, sessionCookie } = createTestContext({
			user: aUser(),
		});
		userAccount.deleteSession.mockRejectedValue(new Error("boom"));
		await signOutHandler({ context });
		expect(sessionCookie.value).toBeUndefined();
	});

	it("clears the cookie when there is no session to delete", async () => {
		const { context, sessionCookie } = createTestContext({
			user: null,
			sessionSecret: "stale",
		});
		await signOutHandler({ context });
		expect(sessionCookie.value).toBeUndefined();
	});
});

describe("signOutEverywhereHandler", () => {
	it("forgets the dismissed guest banner", async () => {
		const { context, userAccount, preferenceCookies } = createTestContext({
			user: aUser(),
		});
		userAccount.deleteSessions.mockResolvedValue({} as never);
		await signOutEverywhereHandler({ context });
		expect(preferenceCookies.guestBannerCleared).toBe(true);
	});

	it("deletes every session and clears the cookie", async () => {
		const { context, userAccount, sessionCookie } = createTestContext({
			user: aUser(),
		});
		userAccount.deleteSessions.mockResolvedValue({} as never);
		await signOutEverywhereHandler({ context });
		expect(userAccount.deleteSessions).toHaveBeenCalledOnce();
		expect(sessionCookie.value).toBeUndefined();
	});

	it("clears the cookie and resolves when the session already expired", async () => {
		const { context, userAccount, sessionCookie } = createTestContext({
			user: aUser(),
		});
		userAccount.deleteSessions.mockRejectedValue(
			appwriteError("user_unauthorized", 401),
		);
		await expect(
			signOutEverywhereHandler({ context }),
		).resolves.toBeUndefined();
		expect(sessionCookie.value).toBeUndefined();
	});

	it("keeps the cookie and rethrows other errors", async () => {
		const { context, userAccount, sessionCookie } = createTestContext({
			user: aUser(),
		});
		userAccount.deleteSessions.mockRejectedValue(new Error("boom"));
		await expect(
			throughMiddleware(signOutEverywhereHandler({ context })),
		).rejects.toEqual(new AppError("UNKNOWN"));
		expect(sessionCookie.value).toBe(aSession().secret);
	});

	it("resolves when there is no session at all", async () => {
		const { context } = createTestContext({ user: null });
		await expect(
			signOutEverywhereHandler({ context }),
		).resolves.toBeUndefined();
	});
});

describe("startGuestSessionHandler", () => {
	function arrange() {
		const test = createTestContext();
		test.adminAccount.createAnonymousSession.mockResolvedValue(
			aGuestSession({ secret: "guest-secret" }),
		);
		test.userAccount.updatePrefs.mockResolvedValue(aGuest());
		test.userAccount.get.mockResolvedValue(aGuest());
		return test;
	}

	it("rate-limits, writes the cookie, saves default prefs and returns the guest", async () => {
		const { context, sessionCookie, userAccount, forSession, rateLimit } =
			arrange();

		await expect(startGuestSessionHandler({ context })).resolves.toEqual(
			aGuest(),
		);

		expect(rateLimit).toHaveBeenCalledWith("guest", "203.0.113.1");
		expect(sessionCookie.value).toBe("guest-secret");
		expect(forSession).toHaveBeenCalledWith("guest-secret");
		expect(userAccount.updatePrefs).toHaveBeenCalledWith({
			prefs: DEFAULT_PREFS,
		});
	});

	it("shows a new guest the banner, even if a previous guest dismissed it", async () => {
		const { context, preferenceCookies } = arrange();
		await startGuestSessionHandler({ context });
		expect(preferenceCookies.guestBannerCleared).toBe(true);
	});

	it("never calls Appwrite when rate limited", async () => {
		const { context, adminAccount, rateLimit } = arrange();
		rateLimit.mockImplementation(() => {
			throw new AppError("RATE_LIMITED");
		});
		await expect(
			throughMiddleware(startGuestSessionHandler({ context })),
		).rejects.toEqual(new AppError("RATE_LIMITED"));
		expect(adminAccount.createAnonymousSession).not.toHaveBeenCalled();
	});

	it("leaves the cookie untouched when the session cannot be created", async () => {
		const { context, adminAccount, sessionCookie } = arrange();
		adminAccount.createAnonymousSession.mockRejectedValue(new Error("down"));
		await expect(
			throughMiddleware(startGuestSessionHandler({ context })),
		).rejects.toEqual(new AppError("UNKNOWN"));
		expect(sessionCookie.value).toBeUndefined();
	});

	it("still resolves the guest when saving the default prefs fails", async () => {
		const { context, userAccount } = arrange();
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		userAccount.updatePrefs.mockRejectedValue(new Error("boom"));
		await expect(startGuestSessionHandler({ context })).resolves.toEqual(
			aGuest(),
		);
		expect(warn).toHaveBeenCalled();
		warn.mockRestore();
	});
});

describe("upgradeGuestHandler", () => {
	const data = { name: "Ann", ...credentials };

	function arrange() {
		const guest = aGuest();
		const test = createTestContext({
			user: guest,
			sessionSecret: "guest-secret",
		});
		test.userAccount.updateEmail.mockResolvedValue(guest);
		test.userAccount.updateName.mockResolvedValue(guest);
		test.userAccount.deleteSession.mockResolvedValue({} as never);
		test.userAccount.createVerification.mockResolvedValue({} as never);
		test.adminAccount.createEmailPasswordSession.mockResolvedValue(
			aSession({ secret: "new-secret", userId: guest.$id }),
		);
		test.userAccount.get.mockResolvedValue({
			...guest,
			email: data.email,
			name: data.name,
		});
		const cookieWrite = vi.spyOn(test.sessionCookie, "write");
		return { ...test, guest, cookieWrite };
	}

	it("converts the guest in place, then creates the new session, writes the cookie and drops the old session, in that order", async () => {
		const {
			context,
			userAccount,
			adminAccount,
			sessionCookie,
			guest,
			cookieWrite,
		} = arrange();

		const user = await upgradeGuestHandler({ data, context });

		expect(user.$id).toBe(guest.$id);
		expect(user.email).toBe(data.email);
		expect(userAccount.updateEmail).toHaveBeenCalledWith({
			email: data.email,
			password: data.password,
		});
		expect(userAccount.updateName).toHaveBeenCalledWith({ name: data.name });
		expect(adminAccount.createEmailPasswordSession).toHaveBeenCalledWith(
			credentials,
		);
		expect(userAccount.deleteSession).toHaveBeenCalledWith({
			sessionId: "current",
		});
		expect(userAccount.createVerification).toHaveBeenCalledWith({
			url: "http://app.test/verify-email",
		});
		expect(sessionCookie.value).toBe("new-secret");
		const order = [
			userAccount.updateEmail.mock.invocationCallOrder[0],
			userAccount.updateName.mock.invocationCallOrder[0],
			adminAccount.createEmailPasswordSession.mock.invocationCallOrder[0],
			cookieWrite.mock.invocationCallOrder[0],
			userAccount.deleteSession.mock.invocationCallOrder[0],
		];
		expect(order).toEqual([...order].sort((a, b) => (a ?? 0) - (b ?? 0)));
		expect(new Set(order).size).toBe(5);
	});

	it("keeps the guest cookie when the new session cannot be created", async () => {
		const { context, adminAccount, userAccount, sessionCookie } = arrange();
		adminAccount.createEmailPasswordSession.mockRejectedValue(
			new Error("down"),
		);
		await expect(
			throughMiddleware(upgradeGuestHandler({ data, context })),
		).rejects.toEqual(new AppError("UNKNOWN"));
		expect(sessionCookie.value).toBe("guest-secret");
		expect(userAccount.deleteSession).not.toHaveBeenCalled();
	});

	it("still upgrades when saving the name, dropping the old session or sending the email fails", async () => {
		const { context, userAccount, sessionCookie } = arrange();
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		userAccount.updateName.mockRejectedValue(new Error("a"));
		userAccount.deleteSession.mockRejectedValue(new Error("b"));
		userAccount.createVerification.mockRejectedValue(new Error("c"));
		await expect(upgradeGuestHandler({ data, context })).resolves.toMatchObject(
			{ email: data.email },
		);
		expect(warn).toHaveBeenCalledTimes(3);
		expect(sessionCookie.value).toBe("new-secret");
		warn.mockRestore();
	});

	it("rejects FORBIDDEN for a non-guest without touching Appwrite", async () => {
		const { context, userAccount } = createTestContext({ user: aUser() });
		await expect(
			throughMiddleware(upgradeGuestHandler({ data, context })),
		).rejects.toEqual(new AppError("FORBIDDEN"));
		expect(userAccount.updateEmail).not.toHaveBeenCalled();
	});

	it("rejects UNAUTHENTICATED when signed out", async () => {
		const { context } = createTestContext({ user: null });
		await expect(
			throughMiddleware(upgradeGuestHandler({ data, context })),
		).rejects.toEqual(new AppError("UNAUTHENTICATED"));
	});

	it("propagates EMAIL_TAKEN and keeps the guest cookie", async () => {
		const { context, userAccount, sessionCookie } = arrange();
		userAccount.updateEmail.mockRejectedValue(
			appwriteError("user_already_exists", 409),
		);
		await expect(
			throughMiddleware(upgradeGuestHandler({ data, context })),
		).rejects.toEqual(new AppError("EMAIL_TAKEN"));
		expect(userAccount.updateName).not.toHaveBeenCalled();
		expect(sessionCookie.value).toBe("guest-secret");
	});

	it("rate-limits like sign-up before any Appwrite call", async () => {
		const { context, userAccount, rateLimit } = arrange();
		rateLimit.mockImplementation(() => {
			throw new AppError("RATE_LIMITED");
		});
		await expect(
			throughMiddleware(upgradeGuestHandler({ data, context })),
		).rejects.toEqual(new AppError("RATE_LIMITED"));
		expect(rateLimit).toHaveBeenCalledWith("signUp", "203.0.113.1");
		expect(userAccount.updateEmail).not.toHaveBeenCalled();
	});
});

describe("signInAndMergeGuestHandler", () => {
	function arrange() {
		const guest = aGuest();
		const test = createTestContext({
			user: guest,
			sessionSecret: "guest-secret",
		});
		test.adminAccount.createEmailPasswordSession.mockResolvedValue(
			aSession({ secret: "new-secret", userId: "user-7" }),
		);
		test.adminUsers.delete.mockResolvedValue({} as never);
		test.userAccount.get.mockResolvedValue(aUser({ $id: "user-7" }));
		const onGuestMerge = vi
			.spyOn(serverHooks, "onGuestMerge")
			.mockResolvedValue(undefined);
		return { ...test, guest, onGuestMerge };
	}

	afterEach(() => vi.restoreAllMocks());

	it("validates credentials, runs the hook, deletes the guest, then swaps the cookie", async () => {
		const { context, adminUsers, adminAccount, sessionCookie, onGuestMerge } =
			arrange();

		const user = await signInAndMergeGuestHandler({
			data: credentials,
			context,
		});

		expect(user.$id).toBe("user-7");
		expect(onGuestMerge).toHaveBeenCalledWith({
			guestUserId: "guest-1",
			userId: "user-7",
			admin: context.appwrite.admin(),
		});
		expect(adminUsers.delete).toHaveBeenCalledWith({ userId: "guest-1" });
		const order = [
			adminAccount.createEmailPasswordSession.mock.invocationCallOrder[0],
			onGuestMerge.mock.invocationCallOrder[0],
			adminUsers.delete.mock.invocationCallOrder[0],
		];
		expect(order).toEqual([...order].sort((a, b) => (a ?? 0) - (b ?? 0)));
		expect(sessionCookie.value).toBe("new-secret");
	});

	it("rejects INVALID_CREDENTIALS without running the hook or deleting the guest", async () => {
		const { context, adminAccount, adminUsers, onGuestMerge, sessionCookie } =
			arrange();
		adminAccount.createEmailPasswordSession.mockRejectedValue(
			appwriteError("user_invalid_credentials", 401),
		);
		await expect(
			throughMiddleware(
				signInAndMergeGuestHandler({ data: credentials, context }),
			),
		).rejects.toEqual(new AppError("INVALID_CREDENTIALS"));
		expect(onGuestMerge).not.toHaveBeenCalled();
		expect(adminUsers.delete).not.toHaveBeenCalled();
		expect(sessionCookie.value).toBe("guest-secret");
	});

	it("keeps the guest and the cookie, and deletes the unused session, when the hook rejects", async () => {
		const { context, adminUsers, onGuestMerge, sessionCookie } = arrange();
		adminUsers.deleteSession.mockResolvedValue({} as never);
		onGuestMerge.mockRejectedValue(new Error("merge failed"));
		await expect(
			throughMiddleware(
				signInAndMergeGuestHandler({ data: credentials, context }),
			),
		).rejects.toEqual(new AppError("UNKNOWN"));
		expect(adminUsers.delete).not.toHaveBeenCalled();
		expect(adminUsers.deleteSession).toHaveBeenCalledWith({
			userId: "user-7",
			sessionId: aSession().$id,
		});
		expect(sessionCookie.value).toBe("guest-secret");
	});

	it("deletes the unused session when deleting the guest fails, and still reports the original error", async () => {
		const { context, adminUsers, sessionCookie } = arrange();
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		adminUsers.delete.mockRejectedValue(new Error("delete failed"));
		adminUsers.deleteSession.mockRejectedValue(new Error("cleanup failed"));
		await expect(
			throughMiddleware(
				signInAndMergeGuestHandler({ data: credentials, context }),
			),
		).rejects.toEqual(new AppError("UNKNOWN"));
		expect(adminUsers.deleteSession).toHaveBeenCalledOnce();
		expect(warn).toHaveBeenCalled();
		expect(sessionCookie.value).toBe("guest-secret");
		warn.mockRestore();
	});

	it("rejects FORBIDDEN for a non-guest and UNAUTHENTICATED when signed out", async () => {
		const signedIn = createTestContext({ user: aUser() });
		await expect(
			throughMiddleware(
				signInAndMergeGuestHandler({
					data: credentials,
					context: signedIn.context,
				}),
			),
		).rejects.toEqual(new AppError("FORBIDDEN"));
		expect(
			signedIn.adminAccount.createEmailPasswordSession,
		).not.toHaveBeenCalled();

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

	it("rate-limits like sign-in before any Appwrite call", async () => {
		const { context, adminAccount, rateLimit } = arrange();
		rateLimit.mockImplementation(() => {
			throw new AppError("RATE_LIMITED");
		});
		await expect(
			throughMiddleware(
				signInAndMergeGuestHandler({ data: credentials, context }),
			),
		).rejects.toEqual(new AppError("RATE_LIMITED"));
		expect(adminAccount.createEmailPasswordSession).not.toHaveBeenCalled();
	});
});

describe("requestPasswordResetHandler", () => {
	it("rate-limits by ip, then by ip and email, then creates a recovery to /reset-password", async () => {
		const { context, adminAccount, rateLimit } = createTestContext();
		adminAccount.createRecovery.mockResolvedValue({} as never);

		await expect(
			requestPasswordResetHandler({ data: { email: "a@b.test" }, context }),
		).resolves.toEqual({ ok: true });

		expect(rateLimit).toHaveBeenNthCalledWith(
			1,
			"passwordResetIp",
			"203.0.113.1",
		);
		expect(rateLimit).toHaveBeenNthCalledWith(
			2,
			"passwordReset",
			"203.0.113.1|a@b.test",
		);
		expect(adminAccount.createRecovery).toHaveBeenCalledWith({
			email: "a@b.test",
			url: "http://app.test/reset-password",
		});
	});

	it("keeps a sub-path of APP_URL in the link", async () => {
		const { context, adminAccount } = createTestContext({
			appUrl: "https://example.test/app",
		});
		adminAccount.createRecovery.mockResolvedValue({} as never);
		await requestPasswordResetHandler({ data: { email: "a@b.test" }, context });
		expect(adminAccount.createRecovery).toHaveBeenCalledWith({
			email: "a@b.test",
			url: "https://example.test/app/reset-password",
		});
	});

	it("does not reveal unknown emails", async () => {
		const { context, adminAccount } = createTestContext();
		adminAccount.createRecovery.mockRejectedValue(
			appwriteError("user_not_found", 404),
		);
		await expect(
			requestPasswordResetHandler({ data: { email: "x@b.test" }, context }),
		).resolves.toEqual({ ok: true });
	});

	it("still answers ok when sending fails for an existing email, and logs it", async () => {
		const log = vi.spyOn(console, "error").mockImplementation(() => {});
		const { context, adminAccount } = createTestContext();
		const failure = appwriteError("general_smtp_disabled", 503);
		adminAccount.createRecovery.mockRejectedValue(failure);
		await expect(
			requestPasswordResetHandler({ data: { email: "a@b.test" }, context }),
		).resolves.toEqual({ ok: true });
		expect(log).toHaveBeenCalledWith(expect.any(String), failure);
		log.mockRestore();
	});

	it("surfaces Appwrite's own rate limit", async () => {
		const { context, adminAccount } = createTestContext();
		adminAccount.createRecovery.mockRejectedValue(
			appwriteError("general_rate_limit_exceeded", 429),
		);
		await expect(
			throughMiddleware(
				requestPasswordResetHandler({ data: { email: "a@b.test" }, context }),
			),
		).rejects.toEqual(new AppError("RATE_LIMITED"));
	});

	it("does not call Appwrite when rate limited", async () => {
		const { context, adminAccount, rateLimit } = createTestContext();
		rateLimit.mockImplementation(() => {
			throw new AppError("RATE_LIMITED");
		});
		await expect(
			throughMiddleware(
				requestPasswordResetHandler({ data: { email: "a@b.test" }, context }),
			),
		).rejects.toEqual(new AppError("RATE_LIMITED"));
		expect(adminAccount.createRecovery).not.toHaveBeenCalled();
	});
});

describe("resetPasswordHandler", () => {
	const data = { userId: "u1", secret: "sec", password: "new-password" };

	it("completes the recovery with the admin client", async () => {
		const { context, adminAccount } = createTestContext();
		adminAccount.updateRecovery.mockResolvedValue({} as never);
		await expect(resetPasswordHandler({ data, context })).resolves.toEqual({
			ok: true,
		});
		expect(adminAccount.updateRecovery).toHaveBeenCalledWith(data);
	});

	it("maps an expired or invalid link to INVALID_TOKEN", async () => {
		const { context, adminAccount } = createTestContext();
		adminAccount.updateRecovery.mockRejectedValue(
			appwriteError("user_invalid_token", 401),
		);
		await expect(
			throughMiddleware(resetPasswordHandler({ data, context })),
		).rejects.toEqual(new AppError("INVALID_TOKEN"));
	});
});

describe("sendVerificationHandler", () => {
	it("sends the verification email linking to /verify-email", async () => {
		const { context, userAccount } = createTestContext({ user: aUser() });
		userAccount.createVerification.mockResolvedValue({} as never);
		await expect(sendVerificationHandler({ context })).resolves.toEqual({
			ok: true,
		});
		expect(userAccount.createVerification).toHaveBeenCalledWith({
			url: "http://app.test/verify-email",
		});
	});

	it("is FORBIDDEN for a guest", async () => {
		const { context, userAccount } = createTestContext({ user: aGuest() });
		await expect(
			throughMiddleware(sendVerificationHandler({ context })),
		).rejects.toEqual(new AppError("FORBIDDEN"));
		expect(userAccount.createVerification).not.toHaveBeenCalled();
	});

	it("is UNAUTHENTICATED when signed out", async () => {
		const { context } = createTestContext({ user: null });
		await expect(
			throughMiddleware(sendVerificationHandler({ context })),
		).rejects.toEqual(new AppError("UNAUTHENTICATED"));
	});

	it("maps Appwrite failures", async () => {
		const { context, userAccount } = createTestContext({ user: aUser() });
		userAccount.createVerification.mockRejectedValue(
			appwriteError("general_rate_limit_exceeded", 429),
		);
		await expect(
			throughMiddleware(sendVerificationHandler({ context })),
		).rejects.toEqual(new AppError("RATE_LIMITED"));
	});
});

describe("confirmVerificationHandler", () => {
	const data = { userId: "u1", secret: "sec" };

	it("confirms as nobody: Appwrite refuses an API key here, and the link may be opened signed out", async () => {
		const { context, anonymousAccount, adminAccount } = createTestContext({
			user: null,
		});
		anonymousAccount.updateVerification.mockResolvedValue({} as never);
		await expect(
			confirmVerificationHandler({ data, context }),
		).resolves.toEqual({ ok: true });
		expect(anonymousAccount.updateVerification).toHaveBeenCalledWith(data);
		expect(adminAccount.updateVerification).not.toHaveBeenCalled();
	});

	it("maps an invalid link to INVALID_TOKEN", async () => {
		const { context, anonymousAccount } = createTestContext();
		anonymousAccount.updateVerification.mockRejectedValue(
			appwriteError("user_invalid_token", 401),
		);
		await expect(
			throughMiddleware(confirmVerificationHandler({ data, context })),
		).rejects.toEqual(new AppError("INVALID_TOKEN"));
	});

	it("maps a link for an unknown user to NOT_FOUND", async () => {
		const { context, anonymousAccount } = createTestContext();
		anonymousAccount.updateVerification.mockRejectedValue(
			appwriteError("user_not_found", 404),
		);
		await expect(
			throughMiddleware(confirmVerificationHandler({ data, context })),
		).rejects.toEqual(new AppError("NOT_FOUND"));
	});
});

describe("preferences of a new or signed-in user (R39)", () => {
	const browsing = { locale: "it", theme: "dark" } as const;
	const stored = { ...DEFAULT_PREFS, locale: "it", theme: "light" } as const;

	/** Every Appwrite call the five sign-in paths make, answering `user`. */
	function arrange(user = aUser({ prefs: { ...stored } })) {
		const test = createTestContext({
			user: aGuest(),
			sessionSecret: "guest-secret",
			browserPrefs: browsing,
		});
		test.adminAccount.create.mockResolvedValue(user);
		test.adminAccount.createEmailPasswordSession.mockResolvedValue(aSession());
		test.adminAccount.createAnonymousSession.mockResolvedValue(aGuestSession());
		test.adminUsers.delete.mockResolvedValue({} as never);
		test.userAccount.updatePrefs.mockResolvedValue(user);
		test.userAccount.updateEmail.mockResolvedValue(user);
		test.userAccount.updateName.mockResolvedValue(user);
		test.userAccount.deleteSession.mockResolvedValue({} as never);
		test.userAccount.createVerification.mockResolvedValue({} as never);
		test.userAccount.get.mockResolvedValue(user);
		vi.spyOn(serverHooks, "onGuestMerge").mockResolvedValue(undefined);
		return test;
	}

	afterEach(() => vi.restoreAllMocks());

	const signUpData = { name: "Ann", ...credentials };
	const paths = {
		signIn: (context: ServerContext) =>
			signInHandler({ data: credentials, context }),
		signUp: (context: ServerContext) =>
			signUpHandler({ data: signUpData, context }),
		startGuest: (context: ServerContext) =>
			startGuestSessionHandler({ context }),
		upgrade: (context: ServerContext) =>
			upgradeGuestHandler({ data: signUpData, context }),
		merge: (context: ServerContext) =>
			signInAndMergeGuestHandler({ data: credentials, context }),
	};

	it.each(
		Object.entries(paths),
	)("%s writes both preference cookies from the account", async (_, run) => {
		const { context, preferenceCookies } = arrange();
		await run(context);
		expect(preferenceCookies.locale).toBe("it");
		expect(preferenceCookies.theme).toBe("light");
	});

	it.each(
		Object.entries(paths),
	)("%s keeps the browser's cookies when the account has no preference", async (_, run) => {
		const { context, preferenceCookies } = arrange(
			aUser({ prefs: {} as never }),
		);
		await run(context);
		expect(preferenceCookies.locale).toBeUndefined();
		expect(preferenceCookies.theme).toBeUndefined();
	});

	it.each([
		["signUp", paths.signUp],
		["startGuest", paths.startGuest],
	])("%s seeds the account with the language and theme being browsed", async (_, run) => {
		const { context, userAccount } = arrange();
		await run(context);
		expect(userAccount.updatePrefs).toHaveBeenCalledWith({
			prefs: { onboardingCompleted: false, locale: "it", theme: "dark" },
		});
	});
});
