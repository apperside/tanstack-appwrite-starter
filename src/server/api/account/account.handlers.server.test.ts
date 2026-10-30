import { describe, expect, it, vi } from "vitest";
import type { DeviceSession } from "#/core/auth/types";
import { DEFAULT_PREFS } from "#/core/prefs";
import { AppError } from "#/lib/errors";
import { createTestContext } from "#/test/test-context";
import { throughMiddleware } from "#/test/through-middleware";
import {
	changeEmailHandler,
	changeNameHandler,
	changePasswordHandler,
	listSessionsHandler,
	updatePreferencesHandler,
} from "./account.handlers.server";

const password = "password1";

function aDeviceSession(overrides: Partial<DeviceSession>): DeviceSession {
	return {
		id: "s",
		current: false,
		clientName: "",
		osName: "",
		deviceName: "",
		createdAt: "2026-01-01",
		...overrides,
	};
}

describe("listSessionsHandler", () => {
	it("puts the current session first, then newest", async () => {
		const test = createTestContext();
		await test.seedUser();
		test.session.listSessions.mockResolvedValueOnce([
			aDeviceSession({ id: "old", createdAt: "2026-01-01" }),
			aDeviceSession({ id: "cur", current: true, createdAt: "2025-06-01" }),
			aDeviceSession({ id: "new", createdAt: "2026-03-01" }),
		]);
		const result = await listSessionsHandler({ context: test.context });
		expect(result.map((s) => s.id)).toEqual(["cur", "new", "old"]);
	});

	it("lists the account's sessions from the backend", async () => {
		const test = createTestContext();
		const { session } = await test.seedUser();
		await expect(
			listSessionsHandler({ context: test.context }),
		).resolves.toEqual([
			expect.objectContaining({ id: session.id, current: true }),
		]);
	});

	it("rejects UNAUTHENTICATED without calling the backend when signed out", async () => {
		const test = createTestContext();
		test.sessionCookie.value = "stale";
		await expect(
			throughMiddleware(listSessionsHandler({ context: test.context })),
		).rejects.toEqual(new AppError("UNAUTHENTICATED"));
		expect(test.session.listSessions).not.toHaveBeenCalled();
	});
});

describe("changePasswordHandler", () => {
	const data = { currentPassword: password, newPassword: "new-password" };

	it("updates the password with the current one", async () => {
		const test = createTestContext();
		const { session } = await test.seedUser({ password });
		await expect(
			changePasswordHandler({ data, context: test.context }),
		).resolves.toEqual({ ok: true });
		expect(test.session.updatePassword).toHaveBeenCalledWith(session.token, {
			password: "new-password",
			oldPassword: password,
		});
	});

	it("rejects a wrong current password as INVALID_CREDENTIALS", async () => {
		const test = createTestContext();
		await test.seedUser({ password });
		await expect(
			throughMiddleware(
				changePasswordHandler({
					data: { ...data, currentPassword: "wrong-password" },
					context: test.context,
				}),
			),
		).rejects.toEqual(new AppError("INVALID_CREDENTIALS"));
	});

	it("is FORBIDDEN for a guest", async () => {
		const test = createTestContext();
		await test.seedGuest();
		await expect(
			throughMiddleware(changePasswordHandler({ data, context: test.context })),
		).rejects.toEqual(new AppError("FORBIDDEN"));
		expect(test.session.updatePassword).not.toHaveBeenCalled();
	});

	it("is UNAUTHENTICATED when signed out", async () => {
		const { context } = createTestContext();
		await expect(
			throughMiddleware(changePasswordHandler({ data, context })),
		).rejects.toEqual(new AppError("UNAUTHENTICATED"));
	});
});

describe("changeEmailHandler", () => {
	const data = { email: "new@b.test", password };

	it("updates the email, then sends a verification email", async () => {
		const test = createTestContext();
		await test.seedUser({ password });
		await expect(
			changeEmailHandler({ data, context: test.context }),
		).resolves.toEqual({ ok: true });
		await expect(test.context.session().getUser()).resolves.toMatchObject({
			email: "new@b.test",
			emailVerified: false,
		});
		expect(test.emails).toEqual([
			expect.objectContaining({
				to: "new@b.test",
				purpose: "verification",
				url: expect.stringMatching(/^http:\/\/app\.test\/verify-email\?/),
			}),
		]);
	});

	it("still succeeds when the verification email fails", async () => {
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		const test = createTestContext();
		await test.seedUser({ password });
		test.session.sendVerification.mockRejectedValueOnce(new Error("smtp"));
		await expect(
			changeEmailHandler({ data, context: test.context }),
		).resolves.toEqual({ ok: true });
		expect(warn).toHaveBeenCalled();
		warn.mockRestore();
	});

	it("rejects a taken email and does not send verification", async () => {
		const test = createTestContext();
		await test.seedUser({ email: data.email, signIn: false });
		await test.seedUser({ password });
		await expect(
			throughMiddleware(changeEmailHandler({ data, context: test.context })),
		).rejects.toEqual(new AppError("EMAIL_TAKEN"));
		expect(test.session.sendVerification).not.toHaveBeenCalled();
	});

	it("is FORBIDDEN for a guest", async () => {
		const test = createTestContext();
		await test.seedGuest();
		await expect(
			throughMiddleware(changeEmailHandler({ data, context: test.context })),
		).rejects.toEqual(new AppError("FORBIDDEN"));
		expect(test.session.updateEmail).not.toHaveBeenCalled();
	});

	it("is UNAUTHENTICATED when signed out", async () => {
		const { context } = createTestContext();
		await expect(
			throughMiddleware(changeEmailHandler({ data, context })),
		).rejects.toEqual(new AppError("UNAUTHENTICATED"));
	});
});

describe("changeNameHandler", () => {
	it("updates the name", async () => {
		const test = createTestContext();
		await test.seedUser();
		await expect(
			changeNameHandler({ data: { name: "Ann" }, context: test.context }),
		).resolves.toEqual({ ok: true });
		await expect(test.context.session().getUser()).resolves.toMatchObject({
			name: "Ann",
		});
	});

	it("is UNAUTHENTICATED when signed out", async () => {
		const { context } = createTestContext();
		await expect(
			throughMiddleware(changeNameHandler({ data: { name: "Ann" }, context })),
		).rejects.toEqual(new AppError("UNAUTHENTICATED"));
	});

	it("surfaces backend failures", async () => {
		const test = createTestContext();
		await test.seedUser();
		test.session.updateName.mockRejectedValueOnce(
			new TypeError("fetch failed"),
		);
		await expect(
			throughMiddleware(
				changeNameHandler({ data: { name: "Ann" }, context: test.context }),
			),
		).rejects.toEqual(new AppError("NETWORK"));
	});
});

describe("updatePreferencesHandler", () => {
	it("merges into the stored prefs, not the context user's", async () => {
		const test = createTestContext();
		const { session } = await test.seedUser({
			prefs: { locale: "it", theme: "light", onboardingCompleted: true },
		});
		await test.context.getUser();
		// Changed elsewhere after this request read the user.
		await test.backend
			.auth({ userAgent: undefined })
			.session(session.token)
			.updatePrefs({ locale: "en" });

		const result = await updatePreferencesHandler({
			data: { theme: "dark" },
			context: test.context,
		});

		expect(result).toEqual({
			locale: "en",
			theme: "dark",
			onboardingCompleted: true,
		});
	});

	it("never stamps defaults over prefs that were not saved (R39)", async () => {
		const test = createTestContext();
		await test.seedUser({ prefs: {} });
		// A missing locale must stay missing: readers fall back to the browser's.
		await expect(
			updatePreferencesHandler({
				data: { onboardingCompleted: true },
				context: test.context,
			}),
		).resolves.toEqual({ onboardingCompleted: true });
	});

	it("writes the theme cookie when the theme changes", async () => {
		const test = createTestContext();
		await test.seedUser();
		await updatePreferencesHandler({
			data: { theme: "dark" },
			context: test.context,
		});
		expect(test.preferenceCookies.theme).toBe("dark");
		expect(test.preferenceCookies.locale).toBeUndefined();
	});

	it("writes the locale cookie when the locale changes", async () => {
		const test = createTestContext();
		await test.seedUser();
		await updatePreferencesHandler({
			data: { locale: "it" },
			context: test.context,
		});
		expect(test.preferenceCookies.locale).toBe("it");
		expect(test.preferenceCookies.theme).toBeUndefined();
	});

	it("writes no cookie when saving fails", async () => {
		const test = createTestContext();
		await test.seedUser();
		test.session.updatePrefs.mockRejectedValueOnce(
			new TypeError("fetch failed"),
		);
		await expect(
			throughMiddleware(
				updatePreferencesHandler({
					data: { theme: "dark" },
					context: test.context,
				}),
			),
		).rejects.toEqual(new AppError("NETWORK"));
		expect(test.preferenceCookies.theme).toBeUndefined();
	});

	it("allows guests", async () => {
		const test = createTestContext();
		await test.seedGuest();
		await expect(
			updatePreferencesHandler({
				data: { locale: "it" },
				context: test.context,
			}),
		).resolves.toEqual({ ...DEFAULT_PREFS, locale: "it" });
	});

	it("is UNAUTHENTICATED when signed out", async () => {
		const test = createTestContext();
		await expect(
			throughMiddleware(
				updatePreferencesHandler({ data: {}, context: test.context }),
			),
		).rejects.toEqual(new AppError("UNAUTHENTICATED"));
		expect(test.session.updatePrefs).not.toHaveBeenCalled();
	});
});
