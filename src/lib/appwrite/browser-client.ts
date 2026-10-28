import { Account, Client, TablesDB } from "appwrite";
import type { TablesDB as ServerTablesDB } from "node-appwrite";
import { publicEnv } from "#/config/env";
import { issueBrowserJwt } from "#/features/auth/auth.functions";
import { toAppError } from "#/lib/errors";
import { AppTables } from "./app-tables";
import { createJwtSession } from "./jwt-session";

type BrowserClient = {
	client: Client;
	account: Account;
	tables: TablesDB & { typed: AppTables };
};

function createBrowserHandles(): BrowserClient {
	const client = new Client()
		.setEndpoint(publicEnv.APPWRITE_ENDPOINT)
		.setProject(publicEnv.APPWRITE_PROJECT_ID);
	const tables = new TablesDB(client);
	// AppTables is typed against node-appwrite's TablesDB; the browser SDK's has the same object-form methods.
	const typed = new AppTables(
		tables as unknown as ServerTablesDB,
		publicEnv.APPWRITE_DATABASE_ID,
	);
	return {
		client,
		account: new Account(client),
		tables: Object.assign(tables, { typed }),
	};
}

/**
 * Builds the runner behind `withBrowserClient`. The SDK client is created on the
 * first call and re-authenticated with a cached JWT before every run.
 */
export function createBrowserRunner(deps: { issueJwt: () => Promise<string> }) {
	const session = createJwtSession(deps);
	let handles: BrowserClient | undefined;

	async function attempt<T>(
		run: (client: BrowserClient) => Promise<T>,
	): Promise<T> {
		handles ??= createBrowserHandles();
		handles.client.setJWT(await session.getJwt());
		return run(handles);
	}

	return async function withClient<T>(
		run: (client: BrowserClient) => Promise<T>,
	): Promise<T> {
		try {
			return await attempt(run);
		} catch (error) {
			if (toAppError(error).code !== "UNAUTHENTICATED") throw error;
			// The JWT expired or its session ended: renew once, then give up.
			session.invalidate();
			try {
				return await attempt(run);
			} catch (retryError) {
				const appError = toAppError(retryError);
				throw appError.code === "UNAUTHENTICATED" ? appError : retryError;
			}
		}
	};
}

let runner: ReturnType<typeof createBrowserRunner> | undefined;

/** Runs `run` with the JWT-authenticated browser SDK, retrying once on a 401. */
export function withBrowserClient<T>(
	run: (client: BrowserClient) => Promise<T>,
): Promise<T> {
	if (import.meta.env.SSR) {
		// A module-level runner would share one request's JWT with every later SSR request.
		throw new Error("withBrowserClient is browser-only");
	}
	runner ??= createBrowserRunner({
		issueJwt: async () => (await issueBrowserJwt()).jwt,
	});
	return runner(run);
}
