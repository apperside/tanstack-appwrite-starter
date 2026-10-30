import { describe, expect, it } from "vitest";
import { aGuest, aUser } from "#/test/fixtures";
import {
	type GuardZone,
	isGuest,
	resolveGuardRedirect,
	resolveVerifyEmailRedirect,
} from "./guards";

const onboarded = { onboardingCompleted: true } as const;
const notOnboarded = { onboardingCompleted: false } as const;

function user(prefs: typeof onboarded | typeof notOnboarded, verified = true) {
	return aUser({
		emailVerified: verified,
		prefs: { ...aUser().prefs, ...prefs },
	});
}

describe("isGuest", () => {
	it("is true only for an account without email", () => {
		expect(isGuest(aGuest())).toBe(true);
		expect(isGuest(aUser())).toBe(false);
	});
});

describe("resolveGuardRedirect", () => {
	const cases: {
		name: string;
		zone: GuardZone;
		user: ReturnType<typeof aUser> | null;
		requireEmailVerification?: boolean;
		location?: string;
		redirect?: unknown;
		expected: string | null;
	}[] = [
		{
			name: "public with a user",
			zone: "public",
			user: user(onboarded),
			expected: "/",
		},
		{
			// Straight to the page `/login?redirect=` asked for: no hop via `/`.
			name: "public with a user and a redirect",
			zone: "public",
			user: user(onboarded),
			redirect: "/settings?tab=1",
			expected: "/settings?tab=1",
		},
		{
			name: "public with a user and an off-site redirect (Review Focus 2)",
			zone: "public",
			user: user(onboarded),
			redirect: "//evil.com",
			expected: "/",
		},
		{
			name: "public without a user ignores the redirect",
			zone: "public",
			user: null,
			redirect: "/settings",
			expected: null,
		},
		{
			// Guests save their account on public pages (signup?upgrade, login?merge).
			name: "public with a guest",
			zone: "public",
			user: aGuest(),
			expected: null,
		},
		{
			name: "public without a user",
			zone: "public",
			user: null,
			expected: null,
		},
		{
			name: "authed without a user",
			zone: "authed",
			user: null,
			location: "/tasks?x=1",
			expected: "/login?redirect=%2Ftasks%3Fx%3D1",
		},
		{
			name: "app without a user",
			zone: "app",
			user: null,
			location: "/",
			expected: "/login?redirect=%2F",
		},
		{
			name: "onboarding without a user",
			zone: "onboarding",
			user: null,
			location: "/onboarding",
			expected: "/login?redirect=%2Fonboarding",
		},
		{
			name: "authed with a user",
			zone: "authed",
			user: user(notOnboarded),
			expected: null,
		},
		{
			name: "app, unverified, verification required",
			zone: "app",
			user: user(onboarded, false),
			requireEmailVerification: true,
			expected: "/verify-email",
		},
		{
			name: "app, unverified, verification not required",
			zone: "app",
			user: user(onboarded, false),
			expected: null,
		},
		{
			name: "app, guest, verification required",
			zone: "app",
			user: aGuest({ prefs: { ...aUser().prefs, onboardingCompleted: true } }),
			requireEmailVerification: true,
			expected: null,
		},
		{
			name: "app, not onboarded",
			zone: "app",
			user: user(notOnboarded),
			expected: "/onboarding",
		},
		{
			name: "app, email check before onboarding",
			zone: "app",
			user: user(notOnboarded, false),
			requireEmailVerification: true,
			expected: "/verify-email",
		},
		{
			name: "app, verified and onboarded",
			zone: "app",
			user: user(onboarded),
			requireEmailVerification: true,
			expected: null,
		},
		{
			name: "onboarding, already onboarded",
			zone: "onboarding",
			user: user(onboarded),
			expected: "/",
		},
		{
			name: "onboarding, not onboarded",
			zone: "onboarding",
			user: user(notOnboarded),
			expected: null,
		},
	];

	it.each(cases)("$name", ({
		zone,
		user,
		requireEmailVerification = false,
		location = "/",
		redirect,
		expected,
	}) => {
		expect(
			resolveGuardRedirect({
				zone,
				user,
				requireEmailVerification,
				location,
				redirect,
			}),
		).toBe(expected);
	});
});

describe("resolveVerifyEmailRedirect", () => {
	it("lets an email link through whoever is signed in (or nobody)", () => {
		for (const current of [null, aGuest(), aUser(), user(onboarded, false)]) {
			expect(resolveVerifyEmailRedirect({ user: current, hasLink: true })).toBe(
				null,
			);
		}
	});

	it("without a link, needs a signed-in user to resend to", () => {
		expect(resolveVerifyEmailRedirect({ user: null, hasLink: false })).toBe(
			"/login?redirect=%2Fverify-email",
		);
	});

	it("without a link, shows the inbox state to an unverified user", () => {
		expect(
			resolveVerifyEmailRedirect({
				user: user(onboarded, false),
				hasLink: false,
			}),
		).toBe(null);
	});

	it("without a link, sends home whoever has nothing to verify (no loop: home never sends them back)", () => {
		expect(resolveVerifyEmailRedirect({ user: aUser(), hasLink: false })).toBe(
			"/",
		);
		expect(resolveVerifyEmailRedirect({ user: aGuest(), hasLink: false })).toBe(
			"/",
		);
	});
});
