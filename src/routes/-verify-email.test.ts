import { describe, expect, it, vi } from "vitest";
import { redirectOf } from "#/test/before-load";
import { Route } from "./verify-email";

vi.mock("#/server/api/auth/auth.functions", async (importOriginal) => ({
	...(await importOriginal<
		typeof import("#/server/api/auth/auth.functions")
	>()),
}));

describe("/verify-email guard", () => {
	it("on entry without a link, sends a signed-out visitor to sign in", async () => {
		expect(await redirectOf(Route, { context: { user: null } })).toMatchObject({
			href: "/login?redirect=%2Fverify-email",
		});
	});

	it("never bounces the page it shows once the link leaves the URL", async () => {
		expect(
			await redirectOf(Route, { context: { user: null }, cause: "stay" }),
		).toBeNull();
	});
});
