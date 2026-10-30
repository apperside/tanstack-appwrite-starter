import { appQueryOptions } from "tanstack-query-typed";
import { api } from "#/server/api/api";

declare module "tanstack-query-typed" {
	interface AppQueriesRegistry {
		sessions: {
			response: Awaited<ReturnType<typeof api.account.listSessions>>;
		};
	}
}

/** The signed-in user's sessions, current first: the security settings. */
export const sessionsQuery = appQueryOptions(["sessions"], {
	queryFn: () => api.account.listSessions(),
});
