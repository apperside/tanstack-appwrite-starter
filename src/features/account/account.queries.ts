import { appQueryOptions } from "tanstack-query-typed";
import { listSessions } from "./account.functions";

declare module "tanstack-query-typed" {
	interface AppQueriesRegistry {
		sessions: { response: Awaited<ReturnType<typeof listSessions>> };
	}
}

/** The signed-in user's sessions, current first: the security settings. */
export const sessionsQuery = appQueryOptions(["sessions"], {
	queryFn: () => listSessions(),
});
