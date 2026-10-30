import { randomUUID } from "node:crypto";
import type { AdminAuth, AuthService, SessionAuth } from "#/core/auth/ports";
import type {
	AuthSession,
	DeviceSession,
	EmailLinkParams,
	User,
} from "#/core/auth/types";
import type { RequestInfo } from "#/core/backend";
import { type AppPrefs, DEFAULT_PREFS } from "#/core/prefs";
import { AppError } from "#/lib/errors";
import type { EmailPurpose, SendEmail } from "../shared/mail/mail";
import {
	hashPassword,
	LOW_SCRYPT,
	verifyPassword,
} from "../shared/passwords.server";
import { linkTo, newToken } from "../shared/tokens.server";
import { RECOVERY_TTL, SESSION_TTL, VERIFICATION_TTL } from "../shared/ttl";
import { describeUserAgent } from "../shared/user-agent";

type StoredUser = {
	id: string;
	/** Empty for a guest. */
	email: string;
	name: string;
	passwordHash: string | null;
	emailVerified: boolean;
	prefs: Partial<AppPrefs>;
	createdAt: string;
};

type StoredSession = {
	id: string;
	userId: string;
	token: string;
	createdAt: string;
	expiresAt: number;
	userAgent: string | undefined;
};

type LinkPurpose = EmailPurpose;

type StoredLink = {
	purpose: LinkPurpose;
	userId: string;
	/** The address it was sent to: a verification link is void once the email changes. */
	email: string;
	expiresAt: number;
};

export type MemoryAuthOptions = {
	now: () => number;
	/** Receives every email. */
	sendEmail: SendEmail;
};

/** The memory backend is for development and tests: hash cheaply. */
const hash = (password: string) => hashPassword(password, LOW_SCRYPT);

/**
 * The auth ports in process memory: every user, session and emailed link
 * lives in this object and is gone on restart. One store serves every request
 * (`forRequest`), as a database would.
 */
export function createMemoryAuth({ now, sendEmail }: MemoryAuthOptions) {
	const users = new Map<string, StoredUser>();
	const sessions = new Map<string, StoredSession>();
	const links = new Map<string, StoredLink>();

	const isoNow = () => new Date(now()).toISOString();

	function toUser(user: StoredUser): User {
		return {
			id: user.id,
			email: user.email,
			name: user.name,
			emailVerified: user.emailVerified,
			isGuest: user.email === "",
			prefs: structuredClone(user.prefs),
			createdAt: user.createdAt,
		};
	}

	function findByEmail(email: string): StoredUser | undefined {
		const wanted = email.toLowerCase();
		for (const user of users.values()) {
			if (user.email !== "" && user.email.toLowerCase() === wanted) return user;
		}
		return undefined;
	}

	function assertEmailFree(email: string, exceptUserId?: string) {
		const owner = findByEmail(email);
		if (owner && owner.id !== exceptUserId) throw new AppError("EMAIL_TAKEN");
	}

	function createSession(
		userId: string,
		userAgent: string | undefined,
	): AuthSession {
		const session: StoredSession = {
			id: randomUUID(),
			userId,
			token: newToken(),
			createdAt: isoNow(),
			expiresAt: now() + SESSION_TTL,
			userAgent,
		};
		sessions.set(session.token, session);
		return toAuthSession(session);
	}

	function toAuthSession(session: StoredSession): AuthSession {
		return {
			id: session.id,
			userId: session.userId,
			token: session.token,
			expiresAt: new Date(session.expiresAt).toISOString(),
		};
	}

	async function sendLink(
		user: StoredUser,
		purpose: LinkPurpose,
		redirectUrl: string,
	) {
		const token = newToken();
		const ttl = purpose === "recovery" ? RECOVERY_TTL : VERIFICATION_TTL;
		links.set(token, {
			purpose,
			userId: user.id,
			email: user.email,
			expiresAt: now() + ttl,
		});
		await sendEmail({
			to: user.email,
			purpose,
			url: linkTo(redirectUrl, { token }),
			locale: user.prefs.locale ?? DEFAULT_PREFS.locale,
		});
	}

	/** Consumes a link: valid once, before it expires. */
	function useLink(link: EmailLinkParams, purpose: LinkPurpose): StoredUser {
		const stored = link.token ? links.get(link.token) : undefined;
		const user = stored && users.get(stored.userId);
		if (
			!stored ||
			!user ||
			stored.purpose !== purpose ||
			stored.expiresAt <= now() ||
			stored.email !== user.email
		) {
			throw new AppError("INVALID_TOKEN");
		}
		links.delete(link.token as string);
		return user;
	}

	function dropUserState(userId: string) {
		for (const [token, session] of sessions) {
			if (session.userId === userId) sessions.delete(token);
		}
		for (const [token, link] of links) {
			if (link.userId === userId) links.delete(token);
		}
	}

	function forSession(token: string): SessionAuth {
		/** The live session and its user; `UNAUTHENTICATED` otherwise. */
		function current(): { session: StoredSession; user: StoredUser } {
			const session = sessions.get(token);
			if (session && session.expiresAt <= now()) sessions.delete(token);
			const user = session && users.get(session.userId);
			if (!session || session.expiresAt <= now() || !user) {
				throw new AppError("UNAUTHENTICATED");
			}
			return { session, user };
		}

		function registered(): StoredUser {
			const { user } = current();
			if (user.email === "") throw new AppError("FORBIDDEN");
			return user;
		}

		return {
			getUser: async () => toUser(current().user),
			signOut: async () => {
				current();
				sessions.delete(token);
			},
			signOutEverywhere: async () => {
				const { user } = current();
				for (const [key, session] of sessions) {
					if (session.userId === user.id) sessions.delete(key);
				}
			},
			listSessions: async () => {
				const { user } = current();
				return [...sessions.values()]
					.filter((s) => s.userId === user.id && s.expiresAt > now())
					.map(
						(s): DeviceSession => ({
							id: s.id,
							current: s.token === token,
							...describeUserAgent(s.userAgent),
							createdAt: s.createdAt,
						}),
					);
			},
			updateName: async (name) => {
				current().user.name = name;
			},
			// Like Appwrite: a guest sets its first password here, anyone else
			// confirms the current one.
			updateEmail: async ({ email, password }) => {
				const { user } = current();
				if (
					user.passwordHash &&
					!(await verifyPassword(password, user.passwordHash))
				) {
					throw new AppError("INVALID_CREDENTIALS");
				}
				assertEmailFree(email, user.id);
				user.email = email;
				user.emailVerified = false;
				user.passwordHash ??= await hash(password);
			},
			updatePassword: async ({ password, oldPassword }) => {
				const user = registered();
				if (!(await verifyPassword(oldPassword, user.passwordHash))) {
					throw new AppError("INVALID_CREDENTIALS");
				}
				user.passwordHash = await hash(password);
				for (const [key, session] of sessions) {
					if (session.userId === user.id && key !== token) sessions.delete(key);
				}
			},
			sendVerification: async ({ redirectUrl }) => {
				await sendLink(registered(), "verification", redirectUrl);
			},
			updatePrefs: async (patch) => {
				const { user } = current();
				user.prefs = { ...user.prefs, ...patch };
				return structuredClone(user.prefs);
			},
			// The account changes in place, so its session simply carries on.
			upgradeGuest: async ({ name, email, password }) => {
				const { session, user } = current();
				if (user.email !== "") throw new AppError("FORBIDDEN");
				assertEmailFree(email);
				Object.assign(user, {
					name,
					email,
					emailVerified: false,
					passwordHash: await hash(password),
				});
				return toAuthSession(session);
			},
		};
	}

	const admin: AdminAuth = {
		deleteUser: async (userId) => {
			if (!users.delete(userId)) throw new AppError("NOT_FOUND");
			dropUserState(userId);
		},
		deleteSession: async ({ userId, sessionId }) => {
			for (const [token, session] of sessions) {
				if (session.id === sessionId && session.userId === userId) {
					sessions.delete(token);
					return;
				}
			}
			throw new AppError("NOT_FOUND");
		},
	};

	/** The auth ports for one request; all requests share the store. */
	function forRequest({ userAgent }: RequestInfo): AuthService {
		function createUser(fields: Partial<StoredUser>): StoredUser {
			const user: StoredUser = {
				id: randomUUID(),
				email: "",
				name: "",
				passwordHash: null,
				emailVerified: false,
				prefs: {},
				createdAt: isoNow(),
				...fields,
			};
			users.set(user.id, user);
			return user;
		}

		return {
			signUp: async ({ name, email, password }) => {
				assertEmailFree(email);
				const user = createUser({
					name,
					email,
					passwordHash: await hash(password),
				});
				return createSession(user.id, userAgent);
			},
			signIn: async ({ email, password }) => {
				const user = findByEmail(email);
				if (!user || !(await verifyPassword(password, user.passwordHash))) {
					throw new AppError("INVALID_CREDENTIALS");
				}
				return createSession(user.id, userAgent);
			},
			startGuest: async () => createSession(createUser({}).id, userAgent),
			requestPasswordReset: async ({ email, redirectUrl }) => {
				const user = findByEmail(email);
				if (!user) throw new AppError("NOT_FOUND");
				await sendLink(user, "recovery", redirectUrl);
			},
			resetPassword: async ({ link, password }) => {
				const user = useLink(link, "recovery");
				user.passwordHash = await hash(password);
				for (const [key, session] of sessions) {
					if (session.userId === user.id) sessions.delete(key);
				}
			},
			confirmVerification: async (link) => {
				useLink(link, "verification").emailVerified = true;
			},
			session: forSession,
			admin,
		};
	}

	return { forRequest };
}
