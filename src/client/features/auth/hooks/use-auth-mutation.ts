import { useRouter } from "@tanstack/react-router";
import {
	type AppMutationDefinition,
	type AppMutationsRegistry,
	useMutation,
	useQueryClient,
} from "tanstack-query-typed";
import type { User } from "#/core/auth/types";
import { currentUserQuery } from "../auth.queries";

/**
 * A mutation definition for `useAuthMutation`. `nextUser` is who is signed in
 * once it succeeds, when the mutation already knows (`null` after signing out,
 * or the user it returns), which saves re-reading the user from the server.
 */
export type AuthMutationDefinition<
	K extends keyof AppMutationsRegistry,
	TData,
	TError = Error,
	TContext = unknown,
> = AppMutationDefinition<K, TData, TError, TContext> & {
	nextUser?: User | null | ((data: TData) => User | null);
};

/**
 * `useMutation` for anything that changes who is signed in (or their account).
 * The one place auth state is refreshed: on success it puts the new user in
 * the cache, re-runs the route guards on that user, and only then calls the
 * definition's `onSuccess` (so a caller's navigation lands on fresh guards).
 */
export function useAuthMutation<
	K extends keyof AppMutationsRegistry,
	TData,
	TError,
	TContext,
>({
	nextUser,
	...definition
}: AuthMutationDefinition<K, TData, TError, TContext>) {
	const queryClient = useQueryClient();
	const router = useRouter();

	/** The user after the mutation, or `undefined` if it could not be read. */
	async function readNextUser(data: TData): Promise<User | null | undefined> {
		if (typeof nextUser === "function") return nextUser(data);
		if (nextUser !== undefined) return nextUser;
		try {
			// Not `refetchQueries`: an entry hydrated from SSR carries no queryFn,
			// so a refetch would silently keep the old user.
			return await queryClient.fetchQuery({
				...currentUserQuery,
				staleTime: 0,
			});
		} catch {
			return undefined;
		}
	}

	return useMutation({
		...definition,
		onSuccess: async (...args) => {
			const previous = queryClient.getQueryData(currentUserQuery.queryKey);
			const next = await readNextUser(args[0]);
			if (next === undefined) {
				// The mutation succeeded but the user could not be re-read: drop the
				// cache (the account may have changed) and let the root guard's
				// `ensureQueryData` fetch the user again.
				queryClient.removeQueries();
			} else {
				queryClient.setQueryData(currentUserQuery.queryKey, next);
				if (previous?.id !== next?.id) {
					// Another account's data must never outlive the switch.
					queryClient.removeQueries({
						predicate: (query) => query.queryKey[0] !== "currentUser",
					});
				}
			}
			await router.invalidate();
			await definition.onSuccess?.(...args);
		},
	});
}
