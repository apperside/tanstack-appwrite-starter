import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_PREFS } from "#/core/prefs";
import { AppError } from "#/lib/errors";
import { appwriteError } from "#/test/appwrite-error";
import { fakeAppwriteClients } from "#/test/appwrite-fakes";
import {
	anAppwriteGuestSession,
	anAppwriteSession,
	anAppwriteUser,
} from "#/test/appwrite-fixtures";
import { createAppwriteAuth } from "./auth.server";

function setup() {
	const fakes = fakeAppwriteClients();
	return { ...fakes, auth: createAppwriteAuth(fakes.clients) };
}

const credentials = { email: "ann@example.test", password: "password1" };
const link = { userId: "u1", secret: "sec" };

afterEach(() => vi.restoreAllMocks());

describe("createAppwriteAuth: mapping", () => {
	it("maps the account to a User; an account without email is a guest", async () => {
		const { auth, userAccount } = setup();
		userAccount.get.mockResolvedValueOnce(
			anAppwriteUser({ $id: "u-9", emailVerification: false }),
		);
		await expect(auth.session("secret").getUser()).resolves.toEqual({
			id: "u-9",
			email: "user@example.test",
			name: "Test User",
			emailVerified: false,
			isGuest: false,
			prefs: DEFAULT_PREFS,
			createdAt: anAppwriteUser().$createdAt,
		});
		userAccount.get.mockResolvedValueOnce(anAppwriteUser({ email: "" }));
		await expect(auth.session("secret").getUser()).resolves.toMatchObject({
			isGuest: true,
		});
	});

	it("maps a created session, its secret being the token", async () => {
		const { auth, adminAccount } = setup();
		adminAccount.createEmailPasswordSession.mockResolvedValue(
			anAppwriteSession({ $id: "s-1", userId: "u-1", secret: "tok" }),
		);
		await expect(auth.signIn(credentials)).resolves.toEqual({
			id: "s-1",
			userId: "u-1",
			token: "tok",
			expiresAt: anAppwriteSession().expire,
		});
	});

	it("translates Appwrite errors, keeping the original as the cause", async () => {
		const { auth, adminAccount } = setup();
		const original = appwriteError("user_invalid_credentials", 401);
		adminAccount.createEmailPasswordSession.mockRejectedValue(original);
		const error = await auth.signIn(credentials).catch((e: unknown) => e);
		expect(error).toEqual(new AppError("INVALID_CREDENTIALS"));
		expect((error as AppError).cause).toBe(original);
	});
});

describe("createAppwriteAuth: service", () => {
	it("signs up with a unique id, then signs in", async () => {
		const { auth, adminAccount } = setup();
		adminAccount.create.mockResolvedValue(anAppwriteUser());
		adminAccount.createEmailPasswordSession.mockResolvedValue(
			anAppwriteSession(),
		);
		await auth.signUp({ name: "Ann", ...credentials });
		expect(adminAccount.create).toHaveBeenCalledWith({
			userId: expect.any(String),
			name: "Ann",
			...credentials,
		});
		expect(adminAccount.createEmailPasswordSession).toHaveBeenCalledWith(
			credentials,
		);
	});

	it("builds one admin client per request, lazily", async () => {
		const { auth, clients, adminAccount } = setup();
		expect(clients.admin).not.toHaveBeenCalled();
		adminAccount.createAnonymousSession.mockResolvedValue(
			anAppwriteGuestSession(),
		);
		await auth.startGuest();
		await auth.startGuest();
		expect(clients.admin).toHaveBeenCalledOnce();
	});

	it("sends recovery with the redirect URL and completes it from the link", async () => {
		const { auth, adminAccount, adminUsers } = setup();
		adminAccount.createRecovery.mockResolvedValue({} as never);
		adminAccount.updateRecovery.mockResolvedValue({} as never);
		adminUsers.deleteSessions.mockResolvedValue({} as never);
		await auth.requestPasswordReset({
			email: "a@b.test",
			redirectUrl: "http://app.test/reset-password",
		});
		expect(adminAccount.createRecovery).toHaveBeenCalledWith({
			email: "a@b.test",
			url: "http://app.test/reset-password",
		});
		await auth.resetPassword({ link, password: "new-password" });
		expect(adminAccount.updateRecovery).toHaveBeenCalledWith({
			...link,
			password: "new-password",
		});
		expect(adminUsers.deleteSessions).toHaveBeenCalledWith({ userId: "u1" });
		expect(
			adminUsers.deleteSessions.mock.invocationCallOrder[0],
		).toBeGreaterThan(
			adminAccount.updateRecovery.mock.invocationCallOrder[0] as number,
		);
	});

	it("keeps the sessions when the recovery link is refused", async () => {
		const { auth, adminAccount, adminUsers } = setup();
		adminAccount.updateRecovery.mockRejectedValue(
			appwriteError("user_invalid_token"),
		);
		await expect(
			auth.resetPassword({ link, password: "new-password" }),
		).rejects.toEqual(new AppError("INVALID_TOKEN"));
		expect(adminUsers.deleteSessions).not.toHaveBeenCalled();
	});

	it("confirms a verification as nobody: Appwrite refuses an API key here", async () => {
		const { auth, anonymousAccount, adminAccount } = setup();
		anonymousAccount.updateVerification.mockResolvedValue({} as never);
		await auth.confirmVerification({ ...link, extra: "ignored" });
		expect(anonymousAccount.updateVerification).toHaveBeenCalledWith(link);
		expect(adminAccount.updateVerification).not.toHaveBeenCalled();
	});

	it("rejects a link without userId and secret as INVALID_TOKEN, calling nothing", async () => {
		const { auth, anonymousAccount, adminAccount } = setup();
		await expect(
			auth.confirmVerification({ token: "memory-style" }),
		).rejects.toEqual(new AppError("INVALID_TOKEN"));
		await expect(
			auth.resetPassword({ link: { userId: "u1" }, password: "password9" }),
		).rejects.toEqual(new AppError("INVALID_TOKEN"));
		expect(anonymousAccount.updateVerification).not.toHaveBeenCalled();
		expect(adminAccount.updateRecovery).not.toHaveBeenCalled();
	});

	it("deletes users and sessions with the Users API", async () => {
		const { auth, adminUsers } = setup();
		adminUsers.delete.mockResolvedValue({} as never);
		adminUsers.deleteSession.mockResolvedValue({} as never);
		await auth.admin.deleteUser("u1");
		await auth.admin.deleteSession({ userId: "u1", sessionId: "s1" });
		expect(adminUsers.delete).toHaveBeenCalledWith({ userId: "u1" });
		expect(adminUsers.deleteSession).toHaveBeenCalledWith({
			userId: "u1",
			sessionId: "s1",
		});
	});
});

describe("createAppwriteAuth: session", () => {
	it("acts with the session's secret", async () => {
		const { auth, clients, userAccount } = setup();
		userAccount.deleteSession.mockResolvedValue({} as never);
		await auth.session("secret-1").signOut();
		expect(clients.forSession).toHaveBeenCalledWith("secret-1");
		expect(userAccount.deleteSession).toHaveBeenCalledWith({
			sessionId: "current",
		});
	});

	it("maps the session list", async () => {
		const { auth, userAccount } = setup();
		userAccount.listSessions.mockResolvedValue({
			total: 1,
			sessions: [
				anAppwriteSession({
					$id: "s1",
					clientName: "Firefox",
					osName: "Mac",
					deviceName: "desktop",
				}),
			],
		});
		await expect(auth.session("s").listSessions()).resolves.toEqual([
			{
				id: "s1",
				current: true,
				clientName: "Firefox",
				osName: "Mac",
				deviceName: "desktop",
				createdAt: anAppwriteSession().$createdAt,
			},
		]);
	});

	it("passes account changes through", async () => {
		const { auth, userAccount } = setup();
		for (const method of [
			"deleteSessions",
			"updateName",
			"updateEmail",
			"updatePassword",
			"createVerification",
		] as const) {
			userAccount[method].mockResolvedValue({} as never);
		}
		userAccount.listSessions.mockResolvedValue({ total: 0, sessions: [] });
		const session = auth.session("s");
		await session.signOutEverywhere();
		await session.updateName("Ann");
		await session.updateEmail(credentials);
		await session.updatePassword({ password: "p2", oldPassword: "p1" });
		await session.sendVerification({ redirectUrl: "http://app.test/v" });
		expect(userAccount.deleteSessions).toHaveBeenCalledOnce();
		expect(userAccount.updateName).toHaveBeenCalledWith({ name: "Ann" });
		expect(userAccount.updateEmail).toHaveBeenCalledWith(credentials);
		expect(userAccount.updatePassword).toHaveBeenCalledWith({
			password: "p2",
			oldPassword: "p1",
		});
		expect(userAccount.createVerification).toHaveBeenCalledWith({
			url: "http://app.test/v",
		});
	});

	it("ends the other sessions after changing the password", async () => {
		const { auth, userAccount } = setup();
		userAccount.updatePassword.mockResolvedValue({} as never);
		userAccount.deleteSession.mockResolvedValue({} as never);
		userAccount.listSessions.mockResolvedValue({
			total: 3,
			sessions: [
				anAppwriteSession({ $id: "cur", current: true }),
				anAppwriteSession({ $id: "a", current: false }),
				anAppwriteSession({ $id: "b", current: false }),
			],
		});
		await auth
			.session("s")
			.updatePassword({ password: "p2", oldPassword: "p1" });
		expect(userAccount.deleteSession.mock.calls).toEqual([
			[{ sessionId: "a" }],
			[{ sessionId: "b" }],
		]);
	});

	it("keeps every session when the password change is refused", async () => {
		const { auth, userAccount } = setup();
		userAccount.updatePassword.mockRejectedValue(
			appwriteError("user_invalid_credentials"),
		);
		await expect(
			auth.session("s").updatePassword({ password: "p2", oldPassword: "x" }),
		).rejects.toEqual(new AppError("INVALID_CREDENTIALS"));
		expect(userAccount.listSessions).not.toHaveBeenCalled();
		expect(userAccount.deleteSession).not.toHaveBeenCalled();
	});

	it("merges a prefs patch into the stored prefs, read fresh (Appwrite replaces the whole object)", async () => {
		const { auth, userAccount } = setup();
		userAccount.getPrefs.mockResolvedValue({ locale: "it", theme: "dark" });
		userAccount.updatePrefs.mockResolvedValue({} as never);
		await expect(
			auth.session("s").updatePrefs({ theme: "light" }),
		).resolves.toEqual({ locale: "it", theme: "light" });
		expect(userAccount.updatePrefs).toHaveBeenCalledWith({
			prefs: { locale: "it", theme: "light" },
		});
	});
});

describe("createAppwriteAuth: upgradeGuest", () => {
	const data = { name: "Ann", ...credentials };

	function arrange() {
		const test = setup();
		test.userAccount.updateEmail.mockResolvedValue({} as never);
		test.userAccount.updateName.mockResolvedValue({} as never);
		test.userAccount.deleteSession.mockResolvedValue({} as never);
		test.adminAccount.createEmailPasswordSession.mockResolvedValue(
			anAppwriteSession({ secret: "new-secret", userId: "guest-1" }),
		);
		return test;
	}

	it("converts the guest in place, then creates the email session before dropping the guest's", async () => {
		const { auth, userAccount, adminAccount } = arrange();
		await expect(
			auth.session("guest-secret").upgradeGuest(data),
		).resolves.toMatchObject({ token: "new-secret", userId: "guest-1" });
		expect(userAccount.updateEmail).toHaveBeenCalledWith(credentials);
		expect(userAccount.updateName).toHaveBeenCalledWith({ name: "Ann" });
		expect(adminAccount.createEmailPasswordSession).toHaveBeenCalledWith(
			credentials,
		);
		expect(userAccount.deleteSession).toHaveBeenCalledWith({
			sessionId: "current",
		});
		const order = [
			userAccount.updateEmail.mock.invocationCallOrder[0],
			userAccount.updateName.mock.invocationCallOrder[0],
			adminAccount.createEmailPasswordSession.mock.invocationCallOrder[0],
			userAccount.deleteSession.mock.invocationCallOrder[0],
		];
		expect(order).toEqual([...order].sort((a, b) => (a ?? 0) - (b ?? 0)));
	});

	it("keeps the guest session when the new one cannot be created", async () => {
		const { auth, userAccount, adminAccount } = arrange();
		adminAccount.createEmailPasswordSession.mockRejectedValue(
			new Error("down"),
		);
		await expect(
			auth.session("guest-secret").upgradeGuest(data),
		).rejects.toThrow("down");
		expect(userAccount.deleteSession).not.toHaveBeenCalled();
	});

	it("still upgrades when saving the name or dropping the guest session fails", async () => {
		const { auth, userAccount } = arrange();
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		userAccount.updateName.mockRejectedValue(new Error("a"));
		userAccount.deleteSession.mockRejectedValue(new Error("b"));
		await expect(
			auth.session("guest-secret").upgradeGuest(data),
		).resolves.toMatchObject({ token: "new-secret" });
		expect(warn).toHaveBeenCalledTimes(2);
	});

	it("stops at a taken email", async () => {
		const { auth, userAccount } = arrange();
		userAccount.updateEmail.mockRejectedValue(
			appwriteError("user_already_exists", 409),
		);
		await expect(
			auth.session("guest-secret").upgradeGuest(data),
		).rejects.toEqual(new AppError("EMAIL_TAKEN"));
		expect(userAccount.updateName).not.toHaveBeenCalled();
	});
});
