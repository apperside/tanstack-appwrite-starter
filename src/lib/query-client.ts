import { MutationCache, QueryCache, QueryClient } from "@tanstack/react-query";
import { toAppError } from "./errors";

type QueryClientOptions = {
	/**
	 * Called whenever a query or mutation fails with `UNAUTHENTICATED`: the
	 * session ended behind the client's back (signed out everywhere, password
	 * changed elsewhere, expired). The router wires it to `forgetExpiredSession`.
	 */
	onUnauthenticated?: () => void;
};

/** The only place QueryClient defaults are set. */
export function createQueryClient({
	onUnauthenticated,
}: QueryClientOptions = {}): QueryClient {
	const onError = (error: unknown) => {
		if (toAppError(error).code === "UNAUTHENTICATED") onUnauthenticated?.();
	};
	return new QueryClient({
		queryCache: new QueryCache({ onError }),
		mutationCache: new MutationCache({ onError }),
		defaultOptions: {
			queries: {
				staleTime: 30_000,
				// Only transient network failures are worth retrying.
				retry: (failureCount, error) =>
					failureCount < 2 && toAppError(error).code === "NETWORK",
			},
		},
	});
}
