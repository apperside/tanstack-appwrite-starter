import { serverEnv } from "#/config/env";
import type { HandlerArgs } from "#/server/context/context.types";
import { requireUser } from "#/server/require-user";
import type { AppClient } from "./app-models";
import { fromAppwriteError } from "./errors";
import { createAdminClient, createUserClient } from "./server-client.server";

type RealtimeClients = {
	forSession(secret: string): AppClient<"server">;
	admin(): AppClient<"admin">;
};

const defaultClients: RealtimeClients = {
	forSession: createUserClient,
	admin: () => createAdminClient(),
};

/**
 * A short-lived JWT for the Appwrite browser SDK (realtime), bound to the
 * current session. Appwrite-only: the browser talks to Appwrite directly.
 */
export async function issueBrowserJwtHandler(
	{ context }: Pick<HandlerArgs<undefined>, "context">,
	clients: RealtimeClients = defaultClients,
): Promise<{ jwt: string }> {
	if (serverEnv().BACKEND !== "appwrite") {
		throw new Error("issueBrowserJwt needs BACKEND=appwrite");
	}
	const user = await requireUser(context);
	// requireUser found a user, so the request carries a session cookie.
	const secret = context.sessionCookie.read() as string;
	try {
		const session = await clients
			.forSession(secret)
			.account.getSession({ sessionId: "current" });
		const { jwt } = await clients
			.admin()
			.users.createJWT({ userId: user.id, sessionId: session.$id });
		return { jwt };
	} catch (error) {
		throw fromAppwriteError(error);
	}
}
