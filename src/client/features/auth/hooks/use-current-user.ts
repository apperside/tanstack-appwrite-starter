import { useRouteContext } from "@tanstack/react-router";

/**
 * The signed-in user exactly as the route guards saw it (the root context), or
 * `null`. `useAuthMutation` refreshes it after every auth change.
 */
export function useCurrentUser() {
	return useRouteContext({
		from: "__root__",
		select: (context) => context.user,
	});
}
