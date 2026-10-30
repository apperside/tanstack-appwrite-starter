import type { QueryClient } from "@tanstack/react-query";
import { currentUserQuery } from "./auth.queries";

type Deps = {
	queryClient: QueryClient;
	router: { invalidate(): Promise<unknown> | unknown; isServer: boolean };
};

/**
 * The server said the session is gone (`UNAUTHENTICATED`) while the client
 * still holds a user: forget the user and re-run the guards, which send the
 * visitor to `/login?redirect=…`. Without it `currentUserQuery` (never stale)
 * would keep serving the old user, and a retry could never succeed.
 * Once nobody is signed in it does nothing, so a page that keeps failing
 * cannot loop; on the server the request's own guards already decided.
 */
export function forgetExpiredSession({ queryClient, router }: Deps): void {
	if (router.isServer) return;
	if (!queryClient.getQueryData(currentUserQuery.queryKey)) return;
	queryClient.setQueryData(currentUserQuery.queryKey, null);
	void router.invalidate();
}
