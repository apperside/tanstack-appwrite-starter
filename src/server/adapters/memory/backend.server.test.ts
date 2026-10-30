import { describe, expect, it, vi } from "vitest";
import { describeAuthContract } from "#/core/auth/auth.contract";
import { describeTodosContract } from "#/core/data/todos.contract";
import type { SentEmail } from "./auth.server";
import { createMemoryBackend } from "./backend.server";

function harness() {
	const emails: SentEmail[] = [];
	const backend = createMemoryBackend({ sendEmail: (e) => emails.push(e) });
	return {
		backend,
		auth: backend.auth({ userAgent: undefined }),
		lastLink: async (email: string, purpose: SentEmail["purpose"]) => {
			const sent = [...emails]
				.reverse()
				.find((e) => e.to === email && e.purpose === purpose);
			if (!sent) throw new Error(`no ${purpose} email to ${email}`);
			return Object.fromEntries(new URL(sent.url).searchParams);
		},
	};
}

describeAuthContract("memory", harness);
describeTodosContract("memory", () => createMemoryBackend().data.todos);

describe("memory backend", () => {
	const ann = { name: "Ann", email: "ann@example.test", password: "password1" };

	it("shares one store between requests", async () => {
		const backend = createMemoryBackend({ sendEmail: () => {} });
		const { token } = await backend.auth({ userAgent: undefined }).signUp(ann);
		await expect(
			backend.auth({ userAgent: undefined }).session(token).getUser(),
		).resolves.toMatchObject({ email: ann.email });
	});

	it("emails links to the given page, the credential in a `token` param", async () => {
		const { auth, lastLink } = harness();
		await auth.signUp(ann);
		await auth.requestPasswordReset({
			email: ann.email,
			redirectUrl: "https://app.test/base/reset-password?keep=1",
		});
		const link = await lastLink(ann.email, "recovery");
		expect(Object.keys(link).sort()).toEqual(["keep", "token"]);
	});

	it("logs emails by default", async () => {
		const info = vi.spyOn(console, "info").mockImplementation(() => {});
		const auth = createMemoryBackend().auth({ userAgent: undefined });
		await auth.signUp(ann);
		await auth.requestPasswordReset({
			email: ann.email,
			redirectUrl: "https://app.test/reset-password",
		});
		expect(info).toHaveBeenCalledWith(
			expect.stringContaining("recovery email to ann@example.test"),
		);
		info.mockRestore();
	});

	it("expires sessions and links on its clock", async () => {
		let now = Date.parse("2026-01-01T00:00:00Z");
		const emails: SentEmail[] = [];
		const auth = createMemoryBackend({
			now: () => now,
			sendEmail: (e) => emails.push(e),
		}).auth({ userAgent: undefined });
		const { token } = await auth.signUp(ann);
		await auth.requestPasswordReset({
			email: ann.email,
			redirectUrl: "https://app.test/reset-password",
		});
		const link = Object.fromEntries(new URL(emails[0]?.url ?? "").searchParams);
		now += 2 * 60 * 60_000; // recovery links live an hour
		await expect(
			auth.resetPassword({ link, password: "password9" }),
		).rejects.toMatchObject({ code: "INVALID_TOKEN" });
		now += 366 * 24 * 60 * 60_000; // sessions live a year
		await expect(auth.session(token).getUser()).rejects.toMatchObject({
			code: "UNAUTHENTICATED",
		});
	});

	it("voids a verification link once the email changes", async () => {
		const { auth, lastLink } = harness();
		const { token } = await auth.signUp(ann);
		await auth
			.session(token)
			.sendVerification({ redirectUrl: "https://app.test/verify-email" });
		const link = await lastLink(ann.email, "verification");
		await auth
			.session(token)
			.updateEmail({ email: "new@example.test", password: ann.password });
		await expect(auth.confirmVerification(link)).rejects.toMatchObject({
			code: "INVALID_TOKEN",
		});
	});

	it("lets only a guest upgrade, and only a registered user verify", async () => {
		const { auth } = harness();
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
	});

	it("reports deleting what does not exist as NOT_FOUND", async () => {
		const { auth } = harness();
		await expect(auth.admin.deleteUser("nobody")).rejects.toMatchObject({
			code: "NOT_FOUND",
		});
		await expect(
			auth.admin.deleteSession({ userId: "nobody", sessionId: "none" }),
		).rejects.toMatchObject({ code: "NOT_FOUND" });
	});
});
