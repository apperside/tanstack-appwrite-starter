import { beforeEach, describe, expect, it } from "vitest";
import { AppError, type AppErrorCode } from "#/lib/errors";
import type { AuthService } from "./ports";
import type { EmailLinkParams } from "./types";

/** What the contract needs from an adapter under test. */
export type AuthContractHarness = {
	/** The auth ports of a fresh, empty backend. */
	auth: AuthService;
	/** The parameters of the last link emailed to `email` for `purpose`. */
	lastLink(
		email: string,
		purpose: "verification" | "recovery",
	): Promise<EmailLinkParams>;
};

const REDIRECT = "http://app.test/landing";
const ann = { name: "Ann", email: "ann@example.test", password: "password1" };
const bob = { name: "Bob", email: "bob@example.test", password: "password2" };

const rejection = (code: AppErrorCode) => new AppError(code);

/**
 * The behavior every `AuthService` adapter shares. Run it from the adapter's
 * own test file: `describeAuthContract("memory", () => ({ auth, lastLink }))`.
 */
export function describeAuthContract(
	name: string,
	setup: () => AuthContractHarness | Promise<AuthContractHarness>,
) {
	describe(`auth contract: ${name}`, () => {
		let auth: AuthService;
		let lastLink: AuthContractHarness["lastLink"];

		beforeEach(async () => {
			({ auth, lastLink } = await setup());
		});

		describe("sign-up and sign-in", () => {
			it("signs up an unverified, registered account", async () => {
				const session = await auth.signUp(ann);
				const user = await auth.session(session.token).getUser();
				expect(user).toMatchObject({
					id: session.userId,
					name: ann.name,
					email: ann.email,
					emailVerified: false,
					isGuest: false,
				});
				expect(Date.parse(session.expiresAt)).toBeGreaterThan(Date.now());
			});

			it("refuses an email that already has an account", async () => {
				await auth.signUp(ann);
				await expect(auth.signUp({ ...ann, name: "Other" })).rejects.toEqual(
					rejection("EMAIL_TAKEN"),
				);
			});

			it("signs in with the right password, into a new session", async () => {
				const first = await auth.signUp(ann);
				const second = await auth.signIn(ann);
				expect(second.userId).toBe(first.userId);
				expect(second.token).not.toBe(first.token);
				await expect(
					auth.session(second.token).getUser(),
				).resolves.toMatchObject({ id: first.userId });
			});

			it("refuses a wrong password or an unknown email alike", async () => {
				await auth.signUp(ann);
				await expect(
					auth.signIn({ ...ann, password: "wrong-password" }),
				).rejects.toEqual(rejection("INVALID_CREDENTIALS"));
				await expect(auth.signIn(bob)).rejects.toEqual(
					rejection("INVALID_CREDENTIALS"),
				);
			});
		});

		describe("sessions", () => {
			it("does not know a made-up token", async () => {
				await expect(auth.session("made-up").getUser()).rejects.toEqual(
					rejection("UNAUTHENTICATED"),
				);
			});

			it("signs out one session only", async () => {
				const first = await auth.signUp(ann);
				const second = await auth.signIn(ann);
				await auth.session(first.token).signOut();
				await expect(auth.session(first.token).getUser()).rejects.toEqual(
					rejection("UNAUTHENTICATED"),
				);
				await expect(
					auth.session(second.token).getUser(),
				).resolves.toBeTruthy();
			});

			it("signs out everywhere", async () => {
				const first = await auth.signUp(ann);
				const second = await auth.signIn(ann);
				await auth.session(first.token).signOutEverywhere();
				for (const token of [first.token, second.token]) {
					await expect(auth.session(token).getUser()).rejects.toEqual(
						rejection("UNAUTHENTICATED"),
					);
				}
			});

			it("lists the account's sessions, marking the current one", async () => {
				const first = await auth.signUp(ann);
				const second = await auth.signIn(ann);
				await auth.signUp(bob);
				const sessions = await auth.session(second.token).listSessions();
				expect(sessions.map((s) => s.id).sort()).toEqual(
					[first.id, second.id].sort(),
				);
				expect(sessions.filter((s) => s.current).map((s) => s.id)).toEqual([
					second.id,
				]);
			});
		});

		describe("account", () => {
			it("changes the name", async () => {
				const { token } = await auth.signUp(ann);
				await auth.session(token).updateName("Annie");
				await expect(auth.session(token).getUser()).resolves.toMatchObject({
					name: "Annie",
				});
			});

			it("changes the email with the password, leaving it unverified", async () => {
				const { token } = await auth.signUp(ann);
				await auth
					.session(token)
					.updateEmail({ email: "new@example.test", password: ann.password });
				await expect(auth.session(token).getUser()).resolves.toMatchObject({
					email: "new@example.test",
					emailVerified: false,
				});
				await expect(
					auth.signIn({ email: "new@example.test", password: ann.password }),
				).resolves.toBeTruthy();
			});

			it("refuses an email change with a wrong password or a taken email", async () => {
				const { token } = await auth.signUp(ann);
				await auth.signUp(bob);
				await expect(
					auth
						.session(token)
						.updateEmail({ email: "new@example.test", password: "wrong-pass" }),
				).rejects.toEqual(rejection("INVALID_CREDENTIALS"));
				await expect(
					auth
						.session(token)
						.updateEmail({ email: bob.email, password: ann.password }),
				).rejects.toEqual(rejection("EMAIL_TAKEN"));
			});

			it("changes the password only with the current one", async () => {
				const { token } = await auth.signUp(ann);
				await expect(
					auth
						.session(token)
						.updatePassword({ password: "new-password", oldPassword: "wrong" }),
				).rejects.toEqual(rejection("INVALID_CREDENTIALS"));
				await auth.session(token).updatePassword({
					password: "new-password",
					oldPassword: ann.password,
				});
				await expect(auth.signIn(ann)).rejects.toEqual(
					rejection("INVALID_CREDENTIALS"),
				);
				await expect(
					auth.signIn({ email: ann.email, password: "new-password" }),
				).resolves.toBeTruthy();
			});

			it("ends the other sessions when the password changes", async () => {
				const first = await auth.signUp(ann);
				const second = await auth.signIn(ann);
				const other = await auth.signUp(bob);
				await auth.session(second.token).updatePassword({
					password: "new-password",
					oldPassword: ann.password,
				});
				await expect(auth.session(first.token).getUser()).rejects.toEqual(
					rejection("UNAUTHENTICATED"),
				);
				for (const token of [second.token, other.token]) {
					await expect(auth.session(token).getUser()).resolves.toBeTruthy();
				}
			});

			it("merges preference patches", async () => {
				const { token } = await auth.signUp(ann);
				await auth.session(token).updatePrefs({ locale: "it", theme: "dark" });
				await expect(
					auth.session(token).updatePrefs({ theme: "light" }),
				).resolves.toEqual({ locale: "it", theme: "light" });
				await expect(auth.session(token).getUser()).resolves.toMatchObject({
					prefs: { locale: "it", theme: "light" },
				});
			});
		});

		describe("emailed links", () => {
			it("verifies the email once per link", async () => {
				const { token } = await auth.signUp(ann);
				await auth.session(token).sendVerification({ redirectUrl: REDIRECT });
				const link = await lastLink(ann.email, "verification");
				await auth.confirmVerification(link);
				await expect(auth.session(token).getUser()).resolves.toMatchObject({
					emailVerified: true,
				});
				await expect(auth.confirmVerification(link)).rejects.toEqual(
					rejection("INVALID_TOKEN"),
				);
			});

			it("resets the password once per link", async () => {
				await auth.signUp(ann);
				await auth.requestPasswordReset({
					email: ann.email,
					redirectUrl: REDIRECT,
				});
				const link = await lastLink(ann.email, "recovery");
				await auth.resetPassword({ link, password: "reset-password" });
				await expect(
					auth.signIn({ email: ann.email, password: "reset-password" }),
				).resolves.toBeTruthy();
				await expect(
					auth.resetPassword({ link, password: "again-password" }),
				).rejects.toEqual(rejection("INVALID_TOKEN"));
			});

			it("ends every session of the account on a reset", async () => {
				const { token } = await auth.signUp(ann);
				const other = await auth.signUp(bob);
				await auth.requestPasswordReset({
					email: ann.email,
					redirectUrl: REDIRECT,
				});
				const link = await lastLink(ann.email, "recovery");
				await auth.resetPassword({ link, password: "reset-password" });
				await expect(auth.session(token).getUser()).rejects.toEqual(
					rejection("UNAUTHENTICATED"),
				);
				await expect(auth.session(other.token).getUser()).resolves.toBeTruthy();
			});

			it("rejects a malformed link", async () => {
				await expect(auth.confirmVerification({})).rejects.toEqual(
					rejection("INVALID_TOKEN"),
				);
				await expect(
					auth.resetPassword({ link: { junk: "x" }, password: "password9" }),
				).rejects.toEqual(rejection("INVALID_TOKEN"));
			});

			it("reports an email with no account as NOT_FOUND", async () => {
				await expect(
					auth.requestPasswordReset({
						email: "nobody@example.test",
						redirectUrl: REDIRECT,
					}),
				).rejects.toEqual(rejection("NOT_FOUND"));
			});
		});

		describe("guests", () => {
			it("starts a guest: no email, unverified", async () => {
				const { token, userId } = await auth.startGuest();
				await expect(auth.session(token).getUser()).resolves.toMatchObject({
					id: userId,
					email: "",
					isGuest: true,
					emailVerified: false,
				});
			});

			it("upgrades a guest in place, into a working session", async () => {
				const guest = await auth.startGuest();
				const upgraded = await auth.session(guest.token).upgradeGuest(ann);
				expect(upgraded.userId).toBe(guest.userId);
				await expect(
					auth.session(upgraded.token).getUser(),
				).resolves.toMatchObject({
					id: guest.userId,
					name: ann.name,
					email: ann.email,
					isGuest: false,
					emailVerified: false,
				});
				await expect(auth.signIn(ann)).resolves.toMatchObject({
					userId: guest.userId,
				});
			});

			it("refuses to upgrade a guest to a taken email", async () => {
				await auth.signUp(ann);
				const guest = await auth.startGuest();
				await expect(
					auth.session(guest.token).upgradeGuest({ ...ann, name: "Other" }),
				).rejects.toEqual(rejection("EMAIL_TAKEN"));
				await expect(
					auth.session(guest.token).getUser(),
				).resolves.toMatchObject({ isGuest: true });
			});
		});

		describe("admin", () => {
			it("deletes an account and its sessions", async () => {
				const { token, userId } = await auth.signUp(ann);
				await auth.admin.deleteUser(userId);
				await expect(auth.session(token).getUser()).rejects.toEqual(
					rejection("UNAUTHENTICATED"),
				);
				await expect(auth.signIn(ann)).rejects.toEqual(
					rejection("INVALID_CREDENTIALS"),
				);
			});

			it("deletes one session", async () => {
				const first = await auth.signUp(ann);
				const second = await auth.signIn(ann);
				await auth.admin.deleteSession({
					userId: second.userId,
					sessionId: second.id,
				});
				await expect(auth.session(second.token).getUser()).rejects.toEqual(
					rejection("UNAUTHENTICATED"),
				);
				await expect(auth.session(first.token).getUser()).resolves.toBeTruthy();
			});
		});
	});
}
