import { describe, expect, it, vi } from "vitest";
import { DEFAULT_PREFS } from "#/lib/appwrite/app-models";
import { AppError } from "#/lib/errors";
import { appwriteError } from "#/test/appwrite-error";
import { aGuest, aSession, aUser } from "#/test/fixtures";
import { createTestContext } from "#/test/test-context";
import { throughMiddleware } from "#/test/through-middleware";
import {
	changeEmailHandler,
	changeNameHandler,
	changePasswordHandler,
	listSessionsHandler,
	updatePreferencesHandler,
} from "./account.handlers.server";

describe("listSessionsHandler", () => {
	it("maps session fields and puts the current session first, then newest", async () => {
		const { context, userAccount } = createTestContext({ user: aUser() });
		userAccount.listSessions.mockResolvedValue({
			total: 3,
			sessions: [
				aSession({ $id: "old", current: false, $createdAt: "2026-01-01" }),
				aSession({
					$id: "cur",
					current: true,
					$createdAt: "2025-06-01",
					clientName: "Firefox",
					osName: "macOS",
					deviceName: "desktop",
					countryName: "Italy",
				}),
				aSession({ $id: "new", current: false, $createdAt: "2026-03-01" }),
			],
		});

		const result = await listSessionsHandler({ context });

		expect(result.map((s) => s.id)).toEqual(["cur", "new", "old"]);
		expect(result[0]).toEqual({
			id: "cur",
			current: true,
			clientName: "Firefox",
			osName: "macOS",
			deviceName: "desktop",
			createdAt: "2025-06-01",
		});
	});

	it("rejects UNAUTHENTICATED without calling Appwrite when signed out", async () => {
		const { context, userAccount } = createTestContext({
			user: null,
			sessionSecret: "stale",
		});
		await expect(
			throughMiddleware(listSessionsHandler({ context })),
		).rejects.toEqual(new AppError("UNAUTHENTICATED"));
		expect(userAccount.listSessions).not.toHaveBeenCalled();
	});
});

describe("changePasswordHandler", () => {
	const data = { currentPassword: "old-pass", newPassword: "new-password" };

	it("updates the password with the old one", async () => {
		const { context, userAccount } = createTestContext({ user: aUser() });
		userAccount.updatePassword.mockResolvedValue({} as never);
		await expect(changePasswordHandler({ data, context })).resolves.toEqual({
			ok: true,
		});
		expect(userAccount.updatePassword).toHaveBeenCalledWith({
			password: "new-password",
			oldPassword: "old-pass",
		});
	});

	it("maps a wrong current password to INVALID_CREDENTIALS", async () => {
		const { context, userAccount } = createTestContext({ user: aUser() });
		userAccount.updatePassword.mockRejectedValue(
			appwriteError("user_invalid_credentials", 401),
		);
		await expect(
			throughMiddleware(changePasswordHandler({ data, context })),
		).rejects.toEqual(new AppError("INVALID_CREDENTIALS"));
	});

	it("is FORBIDDEN for a guest", async () => {
		const { context, userAccount } = createTestContext({ user: aGuest() });
		await expect(
			throughMiddleware(changePasswordHandler({ data, context })),
		).rejects.toEqual(new AppError("FORBIDDEN"));
		expect(userAccount.updatePassword).not.toHaveBeenCalled();
	});

	it("is UNAUTHENTICATED when signed out", async () => {
		const { context } = createTestContext({ user: null });
		await expect(
			throughMiddleware(changePasswordHandler({ data, context })),
		).rejects.toEqual(new AppError("UNAUTHENTICATED"));
	});
});

describe("changeEmailHandler", () => {
	const data = { email: "new@b.test", password: "pw-12345" };

	it("updates the email, then sends a verification email", async () => {
		const { context, userAccount } = createTestContext({ user: aUser() });
		userAccount.updateEmail.mockResolvedValue({} as never);
		userAccount.createVerification.mockResolvedValue({} as never);
		await expect(changeEmailHandler({ data, context })).resolves.toEqual({
			ok: true,
		});
		expect(userAccount.updateEmail).toHaveBeenCalledWith(data);
		expect(userAccount.createVerification).toHaveBeenCalledWith({
			url: "http://app.test/verify-email",
		});
	});

	it("still succeeds when the verification email fails", async () => {
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		const { context, userAccount } = createTestContext({ user: aUser() });
		userAccount.updateEmail.mockResolvedValue({} as never);
		userAccount.createVerification.mockRejectedValue(new Error("smtp"));
		await expect(changeEmailHandler({ data, context })).resolves.toEqual({
			ok: true,
		});
		expect(warn).toHaveBeenCalled();
		warn.mockRestore();
	});

	it("maps a taken email and does not send verification", async () => {
		const { context, userAccount } = createTestContext({ user: aUser() });
		userAccount.updateEmail.mockRejectedValue(
			appwriteError("user_email_already_exists", 409),
		);
		await expect(
			throughMiddleware(changeEmailHandler({ data, context })),
		).rejects.toEqual(new AppError("EMAIL_TAKEN"));
		expect(userAccount.createVerification).not.toHaveBeenCalled();
	});

	it("is FORBIDDEN for a guest", async () => {
		const { context, userAccount } = createTestContext({ user: aGuest() });
		await expect(
			throughMiddleware(changeEmailHandler({ data, context })),
		).rejects.toEqual(new AppError("FORBIDDEN"));
		expect(userAccount.updateEmail).not.toHaveBeenCalled();
	});

	it("is UNAUTHENTICATED when signed out", async () => {
		const { context } = createTestContext({ user: null });
		await expect(
			throughMiddleware(changeEmailHandler({ data, context })),
		).rejects.toEqual(new AppError("UNAUTHENTICATED"));
	});
});

describe("changeNameHandler", () => {
	it("updates the name", async () => {
		const { context, userAccount } = createTestContext({ user: aUser() });
		userAccount.updateName.mockResolvedValue({} as never);
		await expect(
			changeNameHandler({ data: { name: "Ann" }, context }),
		).resolves.toEqual({ ok: true });
		expect(userAccount.updateName).toHaveBeenCalledWith({ name: "Ann" });
	});

	it("is UNAUTHENTICATED when signed out", async () => {
		const { context } = createTestContext({ user: null });
		await expect(
			throughMiddleware(changeNameHandler({ data: { name: "Ann" }, context })),
		).rejects.toEqual(new AppError("UNAUTHENTICATED"));
	});

	it("maps Appwrite failures", async () => {
		const { context, userAccount } = createTestContext({ user: aUser() });
		userAccount.updateName.mockRejectedValue(new TypeError("fetch failed"));
		await expect(
			throughMiddleware(changeNameHandler({ data: { name: "Ann" }, context })),
		).rejects.toEqual(new AppError("NETWORK"));
	});
});

describe("updatePreferencesHandler", () => {
	it("merges into the fresh prefs, not the context user's", async () => {
		const { context, userAccount } = createTestContext({
			user: aUser({ prefs: { ...DEFAULT_PREFS, locale: "en" } }),
		});
		userAccount.getPrefs.mockResolvedValue({
			locale: "it",
			theme: "light",
			onboardingCompleted: true,
			extra: "kept",
		});
		userAccount.updatePrefs.mockResolvedValue({} as never);

		const result = await updatePreferencesHandler({
			data: { theme: "dark" },
			context,
		});

		const merged = {
			locale: "it",
			theme: "dark",
			onboardingCompleted: true,
			extra: "kept",
		};
		expect(userAccount.updatePrefs).toHaveBeenCalledWith({ prefs: merged });
		expect(result).toEqual(merged);
	});

	it("never stamps defaults over prefs that were not saved (R39)", async () => {
		const { context, userAccount } = createTestContext({ user: aUser() });
		userAccount.getPrefs.mockResolvedValue({});
		userAccount.updatePrefs.mockResolvedValue({} as never);
		await expect(
			updatePreferencesHandler({
				data: { onboardingCompleted: true },
				context,
			}),
		).resolves.toEqual({ onboardingCompleted: true });
		// A missing locale must stay missing: readers fall back to the browser's.
		expect(userAccount.updatePrefs).toHaveBeenCalledWith({
			prefs: { onboardingCompleted: true },
		});
	});

	it("writes the theme cookie when the theme changes", async () => {
		const { context, userAccount, preferenceCookies } = createTestContext({
			user: aUser(),
		});
		userAccount.getPrefs.mockResolvedValue({ ...DEFAULT_PREFS });
		userAccount.updatePrefs.mockResolvedValue({} as never);
		await updatePreferencesHandler({ data: { theme: "dark" }, context });
		expect(preferenceCookies.theme).toBe("dark");
		expect(preferenceCookies.locale).toBeUndefined();
	});

	it("writes the locale cookie when the locale changes", async () => {
		const { context, userAccount, preferenceCookies } = createTestContext({
			user: aUser(),
		});
		userAccount.getPrefs.mockResolvedValue({ ...DEFAULT_PREFS });
		userAccount.updatePrefs.mockResolvedValue({} as never);
		await updatePreferencesHandler({ data: { locale: "it" }, context });
		expect(preferenceCookies.locale).toBe("it");
		expect(preferenceCookies.theme).toBeUndefined();
	});

	it("writes no cookie and no prefs when saving fails", async () => {
		const { context, userAccount, preferenceCookies } = createTestContext({
			user: aUser(),
		});
		userAccount.getPrefs.mockResolvedValue({ ...DEFAULT_PREFS });
		userAccount.updatePrefs.mockRejectedValue(new TypeError("fetch failed"));
		await expect(
			throughMiddleware(
				updatePreferencesHandler({ data: { theme: "dark" }, context }),
			),
		).rejects.toEqual(new AppError("NETWORK"));
		expect(preferenceCookies.theme).toBeUndefined();
	});

	it("allows guests", async () => {
		const { context, userAccount } = createTestContext({ user: aGuest() });
		userAccount.getPrefs.mockResolvedValue({ ...DEFAULT_PREFS });
		userAccount.updatePrefs.mockResolvedValue({} as never);
		await expect(
			updatePreferencesHandler({ data: { locale: "it" }, context }),
		).resolves.toMatchObject({ locale: "it" });
	});

	it("is UNAUTHENTICATED when signed out", async () => {
		const { context, userAccount } = createTestContext({ user: null });
		await expect(
			throughMiddleware(updatePreferencesHandler({ data: {}, context })),
		).rejects.toEqual(new AppError("UNAUTHENTICATED"));
		expect(userAccount.getPrefs).not.toHaveBeenCalled();
	});
});
