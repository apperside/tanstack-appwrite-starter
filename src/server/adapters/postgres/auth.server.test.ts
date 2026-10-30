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
});
