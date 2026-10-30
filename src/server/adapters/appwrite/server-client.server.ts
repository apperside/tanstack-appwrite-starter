import { Account, Client, TablesDB, Users } from "node-appwrite";
import type { AppClient } from "./app-models";
import { AdminTables, AppTables } from "./app-tables";
import { appwritePublicEnv, appwriteServerEnv } from "./env";

function baseClient(): Client {
	const env = appwritePublicEnv();
	return new Client().setEndpoint(env.ENDPOINT).setProject(env.PROJECT_ID);
}

/** Acts as the signed-in user. Builds a new client per call; never share one across requests. */
export function createUserClient(sessionSecret: string): AppClient<"server"> {
	const client = baseClient().setSession(sessionSecret);
	const tables = new TablesDB(client);
	const typed = new AppTables(tables, appwritePublicEnv().DATABASE_ID);
	return {
		client,
		account: new Account(client),
		tables: Object.assign(tables, { typed }),
	};
}

/**
 * Acts as nobody: neither key nor session. For the endpoints Appwrite opens to
 * anyone holding a secret but refuses an API key, e.g. confirming an email link.
 */
export function createAnonymousClient(): AppClient<"server"> {
	const client = baseClient();
	const tables = new TablesDB(client);
	const typed = new AppTables(tables, appwritePublicEnv().DATABASE_ID);
	return {
		client,
		account: new Account(client),
		tables: Object.assign(tables, { typed }),
	};
}

/**
 * Acts with the API key, bypassing permissions. Builds a new client per call.
 * `forwardedUserAgent` is the visitor's: sessions this client creates record
 * their browser and OS, not the server's HTTP library.
 */
export function createAdminClient({
	forwardedUserAgent,
}: {
	forwardedUserAgent?: string;
} = {}): AppClient<"admin"> {
	const client = baseClient().setKey(appwriteServerEnv().APPWRITE_API_KEY);
	if (forwardedUserAgent) client.setForwardedUserAgent(forwardedUserAgent);
	const tables = new TablesDB(client);
	const typed = new AdminTables(tables, appwritePublicEnv().DATABASE_ID);
	return {
		client,
		account: new Account(client),
		users: new Users(client),
		tables: Object.assign(tables, { typed }),
	};
}
