import { appQueryOptions } from "tanstack-query-typed";
import { getCurrentUser } from "./auth.functions";

declare module "tanstack-query-typed" {
	interface AppQueriesRegistry {
		currentUser: { response: Awaited<ReturnType<typeof getCurrentUser>> };
	}
}

/**
 * The signed-in user (or `null`). Prefetched in the root route, read by
 * components through the root context (`useCurrentUser`).
 * Nothing observes this query and its SSR-hydrated entry has no queryFn, so
 * neither `invalidateQueries` nor `refetchQueries` would refresh it: auth
 * changes go through `useAuthMutation`, which `fetchQuery`s it and then
 * `router.invalidate()`s.
 */
export const currentUserQuery = appQueryOptions(["currentUser"], {
	queryFn: () => getCurrentUser(),
	staleTime: Number.POSITIVE_INFINITY,
});
