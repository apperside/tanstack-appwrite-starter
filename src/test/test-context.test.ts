import { describe, expect, it } from "vitest";
import { AppError } from "#/lib/errors";
import { aGuest, aGuestSession, aJwt, aSession, aUser } from "./fixtures";
import { createTestContext } from "./test-context";

describe("createTestContext", () => {
	it("resolves getUser() to the given user", async () => {
		const user = aUser();
		const { context } = createTestContext({ user });
		await expect(context.getUser()).resolves.toBe(user);
	});

	it("is signed out by default and user() throws UNAUTHENTICATED", async () => {
		const { context } = createTestContext();
		await expect(context.getUser()).resolves.toBeNull();
		expect(() => context.appwrite.user()).toThrow(
			new AppError("UNAUTHENTICATED"),
		);
	});

	it("throws UNAUTHENTICATED from user() when user is null", () => {
		const { context } = createTestContext({ user: null });
		expect(() => context.appwrite.user()).toThrow(AppError);
	});

	it("exposes the fakes behind the context's clients", async () => {
		const { context, userAccount, adminAccount, adminUsers, userTables } =
			createTestContext({ user: aUser() });
		adminUsers.createJWT.mockResolvedValue(aJwt());

		expect(context.appwrite.user().account).toBe(userAccount);
		expect(context.appwrite.admin().account).toBe(adminAccount);
		expect(context.appwrite.admin().users).toBe(adminUsers);
		expect(context.appwrite.user().tables.listRows).toBe(userTables.listRows);
		await expect(
			context.appwrite.admin().users.createJWT({ userId: "user-1" }),
		).resolves.toEqual(aJwt());
	});

	it("forSession returns the user fakes, even when signed out", () => {
		const { context, userAccount, forSession } = createTestContext();
		expect(context.appwrite.forSession("s").account).toBe(userAccount);
		expect(forSession).toHaveBeenCalledWith("s");
	});

	it("routes typed tables through the fake tables", async () => {
		const { context, userTables } = createTestContext({ user: aUser() });
		userTables.deleteRow.mockResolvedValue({});
		await context.appwrite.user().tables.typed.deleteRow("todos", "t1");
		expect(userTables.deleteRow).toHaveBeenCalledWith(
			expect.objectContaining({ tableId: "todos", rowId: "t1" }),
		);
	});

	it("rejects loudly when a fake is not stubbed", async () => {
		const { context } = createTestContext({ user: aUser() });
		await expect(context.appwrite.user().account.get()).rejects.toThrow(
			"not stubbed: account.get",
		);
		await expect(
			context.appwrite.admin().users.delete({ userId: "u" }),
		).rejects.toThrow("not stubbed: users.delete");
	});

	it("seeds the session cookie for a signed-in user", () => {
		expect(createTestContext({ user: aUser() }).sessionCookie.value).toBe(
			aSession().secret,
		);
		expect(createTestContext().sessionCookie.value).toBeUndefined();
	});

	it("lets sessionSecret override the seeded cookie", () => {
		const custom = createTestContext({ user: aUser(), sessionSecret: "s2" });
		expect(custom.context.sessionCookie.read()).toBe("s2");
		const none = createTestContext({ user: aUser(), sessionSecret: null });
		expect(none.context.sessionCookie.read()).toBeUndefined();
	});

	it("types fakes by the SDK's object-form overload", async () => {
		const { context, adminAccount, userAccount } = createTestContext();
		adminAccount.createEmailPasswordSession.mockImplementation(
			async ({ email }) => aSession({ providerUid: email }),
		);
		const positionalForm = async (email: string) =>
			aSession({ providerUid: email });
		// @ts-expect-error the deprecated positional form is not the mock's signature
		adminAccount.createEmailPasswordSession.mockImplementation(positionalForm);
		// @ts-expect-error resolves to a Session, not a Jwt
		adminAccount.createEmailPasswordSession.mockResolvedValue(aJwt());
		// Single-signature generic methods keep their SDK type.
		userAccount.get.mockResolvedValue(aUser());
		// @ts-expect-error resolves to a User
		userAccount.get.mockResolvedValue({ foo: 1 });

		adminAccount.createEmailPasswordSession.mockResolvedValue(aSession());
		await context.appwrite.admin().account.createEmailPasswordSession({
			email: "a@b.test",
			password: "pw",
		});
		const [params] = adminAccount.createEmailPasswordSession.mock.calls[0];
		expect(params.email).toBe("a@b.test");
		// @ts-expect-error the recorded argument is the params object
		const positional: string = params;
		expect(positional).toEqual(expect.any(Object));
	});

	it("keeps the session cookie in memory", () => {
		const { context, sessionCookie } = createTestContext();
		expect(context.sessionCookie.read()).toBeUndefined();

		const session = aSession();
		context.sessionCookie.write(session);
		expect(sessionCookie.value).toBe(session.secret);
		expect(context.sessionCookie.read()).toBe(session.secret);

		context.sessionCookie.clear();
		expect(sessionCookie.value).toBeUndefined();
	});

	it("keeps the preference cookies in memory", () => {
		const { context, preferenceCookies } = createTestContext();
		context.preferenceCookies.writeLocale("it");
		context.preferenceCookies.writeTheme("dark");
		expect(preferenceCookies.locale).toBe("it");
		expect(preferenceCookies.theme).toBe("dark");
	});

	it("exposes rateLimit as a spy that allows by default", () => {
		const { context, rateLimit } = createTestContext();
		context.rateLimit("signIn", "1.2.3.4");
		expect(rateLimit).toHaveBeenCalledWith("signIn", "1.2.3.4");
	});
});

describe("fixtures", () => {
	it("builds deterministic, overridable objects", () => {
		expect(aUser()).toEqual(aUser());
		expect(aUser({ name: "Ada" }).name).toBe("Ada");
		expect(aGuest().email).toBe("");
		expect(aGuest().$id).not.toBe(aUser().$id);
	});

	it("builds an anonymous guest session", () => {
		expect(aGuestSession()).toMatchObject({
			provider: "anonymous",
			providerUid: "",
			factors: [],
		});
		expect(aGuestSession().secret).not.toBe("");
	});

	it("builds a session expiring one year after creation", () => {
		const session = aSession();
		expect(session.secret).not.toBe("");
		const days =
			(Date.parse(session.expire) - Date.parse(session.$createdAt)) /
			86_400_000;
		expect(days).toBe(365);
	});
});
