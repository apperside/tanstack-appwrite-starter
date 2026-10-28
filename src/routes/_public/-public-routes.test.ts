import { describe, expect, it, vi } from "vitest";
import { redirectOf } from "#/test/before-load";
import { aGuest, aUser } from "#/test/fixtures";
import { Route as LoginRoute } from "./login";
import { Route as PublicRoute } from "./route";
import { Route as SignupRoute } from "./signup";

vi.mock("#/features/auth/auth.functions", () => ({}));

describe("/_public guard", () => {
	it("sends a signed-in user straight to a sanitized `redirect`", async () => {
		expect(
			await redirectOf(PublicRoute, {
				context: { user: aUser() },
				location: {
					href: "/login?redirect=%2Fsettings",
					search: { redirect: "/settings" },
				},
			}),
		).toMatchObject({ href: "/settings" });
	});

	it("sends a signed-in user home for an off-site `redirect` (Review Focus 2)", async () => {
		expect(
			await redirectOf(PublicRoute, {
				context: { user: aUser() },
				location: { href: "/login", search: { redirect: "//evil.com" } },
			}),
		).toMatchObject({ href: "/" });
	});

	it("lets a guest and a signed-out visitor in", async () => {
		for (const user of [aGuest(), null]) {
			expect(
				await redirectOf(PublicRoute, {
					context: { user },
					location: { href: "/login", search: {} },
				}),
			).toBeNull();
		}
	});
});

describe("/login", () => {
	it("puts a guest in merge mode, keeping the other params", async () => {
		expect(
			await redirectOf(LoginRoute, {
				context: { user: aGuest() },
				search: { redirect: "/settings" },
			}),
		).toMatchObject({
			to: "/login",
			search: { redirect: "/settings", merge: 1 },
		});
	});

	it("leaves a guest already in merge mode, and everyone else, alone", async () => {
		expect(
			await redirectOf(LoginRoute, {
				context: { user: aGuest() },
				search: { merge: 1 },
			}),
		).toBeNull();
		expect(
			await redirectOf(LoginRoute, { context: { user: null } }),
		).toBeNull();
	});
});

describe("/signup", () => {
	it("puts a guest in upgrade mode", async () => {
		expect(
			await redirectOf(SignupRoute, { context: { user: aGuest() } }),
		).toMatchObject({ to: "/signup", search: { upgrade: 1 } });
	});

	it("leaves a guest already upgrading, and everyone else, alone", async () => {
		expect(
			await redirectOf(SignupRoute, {
				context: { user: aGuest() },
				search: { upgrade: 1 },
			}),
		).toBeNull();
		expect(
			await redirectOf(SignupRoute, { context: { user: null } }),
		).toBeNull();
	});
});
