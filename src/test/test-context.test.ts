import { describe, expect, it } from "vitest";
import { AppError } from "#/lib/errors";
import { createTestContext } from "./test-context";

describe("createTestContext", () => {
	it("is signed out by default", async () => {
		const { context } = createTestContext();
		await expect(context.getUser()).resolves.toBeNull();
		expect(() => context.session()).toThrow(new AppError("UNAUTHENTICATED"));
	});

	it("seeds a verified, signed-in user without touching the spies or the outbox", async () => {
		const test = createTestContext();
		const { user, session } = await test.seedUser({ name: "Ann" });
		expect(user).toMatchObject({ name: "Ann", emailVerified: true });
		expect(test.sessionCookie.value).toBe(session.token);
		await expect(test.context.getUser()).resolves.toEqual(user);
		expect(test.auth.signUp).not.toHaveBeenCalled();
		expect(test.emails).toEqual([]);
	});

	it("seeds without signing in, unverified, with given prefs", async () => {
		const test = createTestContext();
		const { user } = await test.seedUser({
			verified: false,
			signIn: false,
			prefs: { locale: "it" },
		});
		expect(user).toMatchObject({
			emailVerified: false,
			prefs: { locale: "it" },
		});
		expect(test.sessionCookie.value).toBeUndefined();
	});

	it("seeds a guest", async () => {
		const test = createTestContext();
		const { user } = await test.seedGuest();
		expect(user.isGuest).toBe(true);
		await expect(test.context.getUser()).resolves.toEqual(user);
	});

	it("spies on the ports while calling through", async () => {
		const test = createTestContext();
		const { session } = await test.seedUser();
		await test.context.session().updateName("Ann");
		expect(test.session.updateName).toHaveBeenCalledWith(session.token, "Ann");
		await expect(test.context.session().getUser()).resolves.toMatchObject({
			name: "Ann",
		});
		test.session.updateName.mockRejectedValueOnce(new AppError("NETWORK"));
		await expect(test.context.session().updateName("x")).rejects.toEqual(
			new AppError("NETWORK"),
		);
	});

	it("reads emailed links, and says when none was sent", async () => {
		const test = createTestContext();
		await test.seedUser({ signIn: false });
		expect(() => test.lastLink("recovery")).toThrow("no recovery email");
		await test.context.auth.requestPasswordReset({
			email: "user@example.test",
			redirectUrl: "http://app.test/reset-password",
		});
		expect(test.lastLink("recovery")).toEqual({ token: expect.any(String) });
	});
});
