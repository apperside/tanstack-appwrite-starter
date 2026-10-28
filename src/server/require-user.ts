import type { AppUser } from "#/lib/appwrite/app-models";
import { AppError } from "#/lib/errors";
import { isGuest } from "#/lib/guards";
import type { ServerContext } from "./context";

/** The signed-in user (a guest too). A stale cookie is cleared by `getUser`, which then reports no user. */
export async function requireUser({
	getUser,
}: Pick<ServerContext, "getUser">): Promise<AppUser> {
	const user = await getUser();
	if (!user) throw new AppError("UNAUTHENTICATED");
	return user;
}

/** The signed-in, non-guest user: guests have no email or password. */
export async function requireRegisteredUser(
	context: Pick<ServerContext, "getUser">,
): Promise<AppUser> {
	const user = await requireUser(context);
	if (isGuest(user)) throw new AppError("FORBIDDEN");
	return user;
}
