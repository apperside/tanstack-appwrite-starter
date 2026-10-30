import { ID, type Models } from "node-appwrite";
import type { AdminAuth, AuthService, SessionAuth } from "#/core/auth/ports";
import type {
	AuthSession,
	DeviceSession,
	EmailLinkParams,
	User,
} from "#/core/auth/types";
import type { AppPrefs } from "#/core/prefs";
import { AppError } from "#/lib/errors";
import type { AppClient } from "./app-models";
import { translateErrors } from "./errors";

/** The Appwrite clients of one request. */
export type AppwriteClients = {
	/** Acts with the API key; forwards the visitor's user agent. */
	admin(): AppClient<"admin">;
	/** Acts as nobody, where Appwrite refuses an API key. */
	anonymous(): AppClient<"server">;
	/** Acts as the holder of a session secret. */
	forSession(secret: string): AppClient<"server">;
};

type AppwriteUser = Models.User<Models.Preferences>;

/** An anonymous Appwrite account has no email. */
function toUser(user: AppwriteUser): User {
	return {
		id: user.$id,
		email: user.email,
		name: user.name,
		emailVerified: user.emailVerification,
		isGuest: user.email === "",
		prefs: user.prefs as Partial<AppPrefs>,
		createdAt: user.$createdAt,
	};
}

function toAuthSession(session: Models.Session): AuthSession {
	return {
		id: session.$id,
		userId: session.userId,
		token: session.secret,
		expiresAt: session.expire,
	};
}

function toDeviceSession(session: Models.Session): DeviceSession {
	return {
		id: session.$id,
		current: session.current,
		clientName: session.clientName,
		osName: session.osName,
		deviceName: session.deviceName,
		createdAt: session.$createdAt,
	};
}

/** Appwrite appends `userId` and `secret` to the link's URL. */
function parseLink(link: EmailLinkParams): { userId: string; secret: string } {
	const { userId, secret } = link;
	if (!userId || !secret) throw new AppError("INVALID_TOKEN");
	return { userId, secret };
}

/** The auth ports over the Appwrite Account and Users APIs, for one request. */
export function createAppwriteAuth(clients: AppwriteClients): AuthService {
	let adminClient: AppClient<"admin"> | undefined;
	const admin = () => {
		adminClient ??= clients.admin();
		return adminClient;
	};

	function session(token: string): SessionAuth {
		const { account } = clients.forSession(token);
		return translateErrors<SessionAuth>({
			getUser: async () => toUser(await account.get()),
			signOut: async () => {
				await account.deleteSession({ sessionId: "current" });
			},
			signOutEverywhere: async () => {
				await account.deleteSessions();
			},
			listSessions: async () =>
				(await account.listSessions()).sessions.map(toDeviceSession),
			updateName: async (name) => {
				await account.updateName({ name });
			},
			updateEmail: async (input) => {
				await account.updateEmail(input);
			},
			// Appwrite keeps the other sessions alive unless the project opts in.
			updatePassword: async (input) => {
				await account.updatePassword(input);
				const { sessions } = await account.listSessions();
				for (const session of sessions) {
					if (!session.current) {
						await account.deleteSession({ sessionId: session.$id });
					}
				}
			},
			sendVerification: async ({ redirectUrl }) => {
				await account.createVerification({ url: redirectUrl });
			},
			// Appwrite replaces the whole object: read it fresh and merge.
			updatePrefs: async (patch) => {
				const stored = await account.getPrefs<Partial<AppPrefs>>();
				const merged = { ...stored, ...patch };
				await account.updatePrefs({ prefs: merged });
				return merged;
			},
			/*
			 * `updateEmail` on an anonymous account converts it in place (same id).
			 * Its session keeps the anonymous provider, so it is swapped for an
			 * email session; the new one exists before the old one is dropped.
			 */
			upgradeGuest: async ({ name, email, password }) => {
				await account.updateEmail({ email, password });
				try {
					await account.updateName({ name });
				} catch (error) {
					// The email is already converted; the name can be set again later.
					console.warn("Could not save the name", error);
				}
				const created = await admin().account.createEmailPasswordSession({
					email,
					password,
				});
				try {
					await account.deleteSession({ sessionId: "current" });
				} catch (error) {
					// The guest session expires on its own.
					console.warn("Could not delete the guest session", error);
				}
				return toAuthSession(created);
			},
		});
	}

	const adminAuth = translateErrors<AdminAuth>({
		deleteUser: async (userId) => {
			await admin().users.delete({ userId });
		},
		deleteSession: async (input) => {
			await admin().users.deleteSession(input);
		},
	});

	return {
		...translateErrors<Omit<AuthService, "session" | "admin">>({
			signUp: async (input) => {
				const { account } = admin();
				await account.create({ userId: ID.unique(), ...input });
				return toAuthSession(
					await account.createEmailPasswordSession({
						email: input.email,
						password: input.password,
					}),
				);
			},
			signIn: async (input) =>
				toAuthSession(await admin().account.createEmailPasswordSession(input)),
			startGuest: async () =>
				toAuthSession(await admin().account.createAnonymousSession()),
			requestPasswordReset: async (input) => {
				await admin().account.createRecovery({
					email: input.email,
					url: input.redirectUrl,
				});
			},
			resetPassword: async (input) => {
				const { userId, secret } = parseLink(input.link);
				await admin().account.updateRecovery({
					userId,
					secret,
					password: input.password,
				});
				await admin().users.deleteSessions({ userId });
			},
			// As nobody: the link may be opened signed out, and Appwrite refuses
			// this call with an API key (`general_unauthorized_scope`).
			confirmVerification: async (link) => {
				await clients.anonymous().account.updateVerification(parseLink(link));
			},
		}),
		session,
		admin: adminAuth,
	};
}
