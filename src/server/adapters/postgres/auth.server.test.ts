import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { describeAuthContract } from "#/core/auth/auth.contract";
import { createTestDb } from "#/test/pglite";
import type { AuthEmail } from "../shared/mail/mail";
import { LOW_SCRYPT } from "../shared/passwords.server";
import { hashToken } from "../shared/tokens.server";
import { createPostgresAuth } from "./auth.server";

let testDb: Awaited<ReturnType<typeof createTestDb>>;

beforeAll(async () => {
	testDb = await createTestDb();
});

afterAll(async () => {
	await testDb.client.close();
});

async function harness(
	now: () => number = Date.now,
	userAgent: string | undefined = undefined,
) {
	await testDb.reset();
	const emails: AuthEmail[] = [];
	const auth = createPostgresAuth({
		db: testDb.db,
		now,
		passwordCost: LOW_SCRYPT,
		sendEmail: async (email) => {
			emails.push(email);
		},
	}).forRequest({ userAgent });
	return {
		auth,
		emails,
		lastLink: async (email: string, purpose: AuthEmail["purpose"]) => {
			const sent = [...emails]
				.reverse()
				.find((e) => e.to === email && e.purpose === purpose);
			if (!sent) throw new Error(`no ${purpose} email to ${email}`);
			return Object.fromEntries(new URL(sent.url).searchParams);
		},
	};
}

describeAuthContract("postgres", () => harness());

const ann = { name: "Ann", email: "ann@example.test", password: "password1" };

describe("postgres auth", () => {
	it("stores no session token in clear", async () => {
		const { auth } = await harness();
		const session = await auth.signUp(ann);
		const { rows } = await testDb.client.query<{ token_hash: string }>(
			"select token_hash from sessions",
		);
		expect(rows).toEqual([{ token_hash: hashToken(session.token) }]);
		expect(rows[0]?.token_hash).not.toBe(session.token);
	});

	it("matches emails case-insensitively", async () => {
		const { auth } = await harness();
		await auth.signUp({ ...ann, email: "Ann@Example.test" });
		await expect(
			auth.signIn({ email: "ann@example.test", password: ann.password }),
		).resolves.toBeTruthy();
		await expect(
			auth.signUp({ ...ann, email: "ANN@example.test" }),
		).rejects.toMatchObject({ code: "EMAIL_TAKEN" });
	});

	it("stores a guest's email as null and reports it as empty", async () => {
		const { auth } = await harness();
		const guest = await auth.startGuest();
		const { rows } = await testDb.client.query<{ email: string | null }>(
			"select email from users",
		);
		expect(rows).toEqual([{ email: null }]);
		expect((await auth.session(guest.token).getUser()).email).toBe("");
	});

	it("expires sessions on its clock and deletes them", async () => {
		let now = Date.parse("2026-01-01T00:00:00Z");
		const { auth } = await harness(() => now);
		const { token } = await auth.signUp(ann);
		now += 366 * 24 * 60 * 60_000;
		await expect(auth.session(token).getUser()).rejects.toMatchObject({
			code: "UNAUTHENTICATED",
		});
		const { rows } = await testDb.client.query("select 1 from sessions");
		expect(rows).toHaveLength(0);
	});

	it("merges concurrent preference patches", async () => {
		const { auth } = await harness();
		const { token } = await auth.signUp(ann);
		const session = auth.session(token);
		await Promise.all([
			session.updatePrefs({ locale: "it" }),
			session.updatePrefs({ theme: "dark" }),
		]);
		expect((await session.getUser()).prefs).toEqual({
			locale: "it",
			theme: "dark",
		});
	});

	it("resolves concurrent sign-ups to one email as one EMAIL_TAKEN", async () => {
		const { auth } = await harness();
		const results = await Promise.allSettled([
			auth.signUp(ann),
			auth.signUp({ ...ann, name: "Other" }),
		]);
		expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
		const rejected = results.filter((r) => r.status === "rejected");
		expect(rejected).toHaveLength(1);
		expect(rejected[0]?.reason).toMatchObject({ code: "EMAIL_TAKEN" });
	});

	it("records the session's user agent", async () => {
		const { auth } = await harness(
			Date.now,
			"Mozilla/5.0 (X11; Linux x86_64; rv:125.0) Gecko/20100101 Firefox/125.0",
		);
		const { token } = await auth.signUp(ann);
		const [session] = await auth.session(token).listSessions();
		expect(session?.clientName).toBe("Firefox");
	});

	it("rejects a registered user without a password hash", async () => {
		const { auth } = await harness();
		await auth.signUp(ann);
		await testDb.client.exec("update users set password_hash = null");
		for (const password of ["dummy password", ann.password]) {
			await expect(
				auth.signIn({ email: ann.email, password }),
			).rejects.toMatchObject({ code: "INVALID_CREDENTIALS" });
		}
	});

	it("stores no link token in clear", async () => {
		const { auth, lastLink } = await harness();
		const { token } = await auth.signUp(ann);
		await auth
			.session(token)
			.sendVerification({ redirectUrl: "https://app.test/verify-email" });
		const link = await lastLink(ann.email, "verification");
		const { rows } = await testDb.client.query<{ token_hash: string }>(
			"select token_hash from email_links",
		);
		expect(rows).toEqual([{ token_hash: hashToken(link.token as string) }]);
	});

	it("voids a verification link once the email changes", async () => {
		const { auth, lastLink } = await harness();
		const { token } = await auth.signUp(ann);
		const session = auth.session(token);
		await session.sendVerification({
			redirectUrl: "https://app.test/verify-email",
		});
		const link = await lastLink(ann.email, "verification");
		await session.updateEmail({
			email: "new@example.test",
			password: ann.password,
		});
		await expect(auth.confirmVerification(link)).rejects.toMatchObject({
			code: "INVALID_TOKEN",
		});
	});

	it("lets one of two concurrent consumers use a link", async () => {
		const { auth, lastLink } = await harness();
		const { token } = await auth.signUp(ann);
		await auth
			.session(token)
			.sendVerification({ redirectUrl: "https://app.test/verify-email" });
		const link = await lastLink(ann.email, "verification");
		const results = await Promise.allSettled([
			auth.confirmVerification(link),
			auth.confirmVerification(link),
		]);
		expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
		const rejected = results.filter((r) => r.status === "rejected");
		expect(rejected[0]?.reason).toMatchObject({ code: "INVALID_TOKEN" });
	});

	it("expires recovery links after an hour", async () => {
		let now = Date.parse("2026-01-01T00:00:00Z");
		const { auth, lastLink } = await harness(() => now);
		await auth.signUp(ann);
		await auth.requestPasswordReset({
			email: ann.email,
			redirectUrl: "https://app.test/reset-password",
		});
		const link = await lastLink(ann.email, "recovery");
		now += 61 * 60_000;
		await expect(
			auth.resetPassword({ link, password: "newpassword1" }),
		).rejects.toMatchObject({ code: "INVALID_TOKEN" });
	});

	it("gives a guest its first password through updateEmail", async () => {
		const { auth } = await harness();
		const guest = await auth.startGuest();
		await auth.session(guest.token).updateEmail({
			email: ann.email,
			password: ann.password,
		});
		const signedIn = await auth.signIn({
			email: ann.email,
			password: ann.password,
		});
		expect(signedIn.userId).toBe(guest.userId);
		expect((await auth.session(guest.token).getUser()).isGuest).toBe(false);
	});

	it("keeps the guest intact when the upgrade email is taken", async () => {
		const { auth } = await harness();
		await auth.signUp(ann);
		const guest = await auth.startGuest();
		await expect(
			auth.session(guest.token).upgradeGuest(ann),
		).rejects.toMatchObject({ code: "EMAIL_TAKEN" });
		const { rows } = await testDb.client.query(
			"select email, password_hash from users where email is null",
		);
		expect(rows).toEqual([{ email: null, password_hash: null }]);
	});

	it("lets only a guest upgrade, and only a registered user verify or change password", async () => {
		const { auth } = await harness();
		const user = await auth.signUp(ann);
		await expect(
			auth
				.session(user.token)
				.upgradeGuest({ ...ann, email: "x@example.test" }),
		).rejects.toMatchObject({ code: "FORBIDDEN" });
		const guest = await auth.startGuest();
		await expect(
			auth
				.session(guest.token)
				.sendVerification({ redirectUrl: "https://app.test/verify-email" }),
		).rejects.toMatchObject({ code: "FORBIDDEN" });
		await expect(
			auth
				.session(guest.token)
				.updatePassword({ password: "newpassword1", oldPassword: "x" }),
		).rejects.toMatchObject({ code: "FORBIDDEN" });
	});

	it("emails the link in the user's locale", async () => {
		const { auth, emails } = await harness();
		const { token } = await auth.signUp(ann);
		const session = auth.session(token);
		await session.updatePrefs({ locale: "it" });
		await session.sendVerification({
			redirectUrl: "https://app.test/verify-email",
		});
		expect(emails.at(-1)?.locale).toBe("it");
	});

	it("rejects updateEmail for a registered user without a password hash", async () => {
		const { auth } = await harness();
		const { token } = await auth.signUp(ann);
		await testDb.client.exec("update users set password_hash = null");
		await expect(
			auth
				.session(token)
				.updateEmail({ email: "new@example.test", password: "anything1" }),
		).rejects.toMatchObject({ code: "INVALID_CREDENTIALS" });
	});
});
