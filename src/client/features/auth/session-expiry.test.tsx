import {
	createMemoryHistory,
	createRootRouteWithContext,
	createRoute,
	createRouter,
	redirect,
} from "@tanstack/react-router";
import { describe, expect, it, vi } from "vitest";
import type { User } from "#/core/auth/types";
import { AppError } from "#/lib/errors";
import { resolveGuardRedirect } from "#/lib/guards";
import { createQueryClient } from "#/lib/query-client";
import { aUser } from "#/test/fixtures";
import { currentUserQuery } from "./auth.queries";
import { forgetExpiredSession } from "./session-expiry";

vi.mock("#/server/api/auth/auth.functions", () => ({
	getCurrentUser: vi.fn(),
}));

/**
 * The app's wiring in miniature: the root reads the cached user, `/settings`
 * is guarded like `_authed` and its loader fails as a revoked session does.
 */
function setup(user: User | null) {
	const queryClient = createQueryClient({
		onUnauthenticated: () => forgetExpiredSession({ queryClient, router }),
	});
	queryClient.setQueryData(currentUserQuery.queryKey, user);
	const loader = vi.fn(() =>
		queryClient.fetchQuery({
			queryKey: ["sessions"],
			queryFn: () => Promise.reject(new AppError("UNAUTHENTICATED")),
		}),
	);
	const rootRoute = createRootRouteWithContext()({
		beforeLoad: async () => ({
			user: await queryClient.ensureQueryData(currentUserQuery),
		}),
	});
	const settings = createRoute({
		getParentRoute: () => rootRoute,
		path: "/settings",
		beforeLoad: ({ context, location }) => {
			const href = resolveGuardRedirect({
				zone: "authed",
				user: context.user,
				requireEmailVerification: false,
				location: location.href,
			});
			if (href) throw redirect({ href });
		},
		loader,
	});
	const login = createRoute({
		getParentRoute: () => rootRoute,
		path: "/login",
	});
	const router = createRouter({
		routeTree: rootRoute.addChildren([settings, login]),
		history: createMemoryHistory({ initialEntries: ["/settings"] }),
	});
	return { queryClient, router, loader };
}

describe("forgetExpiredSession", () => {
	it("sends a user whose session ended elsewhere to sign in, back to where they were", async () => {
		const { queryClient, router } = setup(aUser());

		await router.load();

		await vi.waitFor(() =>
			expect(router.state.location.pathname).toBe("/login"),
		);
		expect(router.state.location.search).toEqual({ redirect: "/settings" });
		expect(queryClient.getQueryData(currentUserQuery.queryKey)).toBeNull();
	});

	it("does nothing once nobody is signed in, so a failing page cannot loop", async () => {
		const { queryClient } = setup(null);
		const router = { invalidate: vi.fn(), isServer: false };

		forgetExpiredSession({ queryClient, router });

		expect(router.invalidate).not.toHaveBeenCalled();
	});

	it("leaves the server's render alone", () => {
		const { queryClient } = setup(aUser());
		const router = { invalidate: vi.fn(), isServer: true };

		forgetExpiredSession({ queryClient, router });

		expect(router.invalidate).not.toHaveBeenCalled();
		expect(queryClient.getQueryData(currentUserQuery.queryKey)).toEqual(
			aUser(),
		);
	});
});
