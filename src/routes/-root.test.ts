import { QueryClient } from "@tanstack/react-query";
import { asTypedQueryClient } from "tanstack-query-typed";
import { describe, expect, it, vi } from "vitest";
import { loadedResources } from "#/i18n/i18n";
import { AppError } from "#/lib/errors";
import { getCurrentUser } from "#/server/api/auth/auth.functions";
import { aUser } from "#/test/fixtures";
import { Route } from "./__root";

vi.mock("#/server/api/auth/auth.functions", () => ({
	getCurrentUser: vi.fn(),
}));
vi.mock("#/server/functions/preferences", () => ({
	getThemePreference: async () => "dark",
	getLocaleHints: async () => ({ cookieLocale: "it" }),
}));
vi.mock("#/styles.css?url", () => ({ default: "/styles.css" }));

type Hook = (args: unknown) => Promise<Record<string, unknown>>;

describe("root route when the user lookup fails (Appwrite down)", () => {
	const beforeLoad = Route.options.beforeLoad as unknown as Hook;
	const head = Route.options.head as unknown as Hook;

	it("rethrows the failure for RouteError, with the fallback language loaded for the shell", async () => {
		const outage = new AppError("UNKNOWN");
		vi.mocked(getCurrentUser).mockRejectedValue(outage);
		const queryClient = asTypedQueryClient(new QueryClient());

		await expect(beforeLoad({ context: { queryClient } })).rejects.toBe(outage);
		// The shell renders synchronously in the default language.
		expect(loadedResources("en")).toBeDefined();
	});

	it("builds the head from the default language when the root has no locale", async () => {
		const result = await head({ match: { context: {} } });
		expect(result.meta).toContainEqual({ title: "My App" });
	});
});

describe("root route theme (R39: the account's preference wins)", () => {
	const beforeLoad = Route.options.beforeLoad as unknown as Hook;

	async function themeFor(prefs: Record<string, unknown>) {
		vi.mocked(getCurrentUser).mockResolvedValue(aUser({ prefs } as never));
		const queryClient = asTypedQueryClient(new QueryClient());
		return (await beforeLoad({ context: { queryClient } })).theme;
	}

	it("uses the signed-in user's theme over this browser's cookie", async () => {
		expect(await themeFor({ theme: "light" })).toBe("light");
	});

	it("falls back to the cookie when the account has no theme", async () => {
		expect(await themeFor({})).toBe("dark");
	});
});
