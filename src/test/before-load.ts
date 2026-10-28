import { isRedirect } from "@tanstack/react-router";
import type { AppUser } from "#/lib/appwrite/app-models";

type BeforeLoadArgs = {
	context: { user: AppUser | null };
	search?: Record<string, unknown>;
	location?: { href: string; search: Record<string, unknown> };
	cause?: "enter" | "stay" | "preload";
};

/**
 * Runs a real route's `beforeLoad` with just what the guards read; resolves to
 * the options of the redirect it throws, or `null` when it lets the page load.
 */
export async function redirectOf(
	route: { options: { beforeLoad?: unknown } },
	{ context, search = {}, location, cause = "enter" }: BeforeLoadArgs,
) {
	const beforeLoad = route.options.beforeLoad as (args: unknown) => unknown;
	try {
		await beforeLoad({
			context,
			search,
			cause,
			location: location ?? { href: "/", search },
		});
		return null;
	} catch (error) {
		if (isRedirect(error)) return error.options;
		throw error;
	}
}
