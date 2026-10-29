import type { Backend } from "#/core/backend";
import { createAppwriteAuth } from "./auth.server";
import {
	createAdminClient,
	createAnonymousClient,
	createUserClient,
} from "./server-client.server";
import { createAppwriteTodos } from "./todos.server";

/** The Appwrite backend: auth on the Account/Users APIs, data on TablesDB. */
export function createAppwriteBackend(): Backend {
	return {
		auth: ({ userAgent }) =>
			createAppwriteAuth({
				admin: () => createAdminClient({ forwardedUserAgent: userAgent }),
				anonymous: createAnonymousClient,
				forSession: createUserClient,
			}),
		data: {
			todos: createAppwriteTodos(() => createAdminClient().tables.typed),
		},
	};
}
