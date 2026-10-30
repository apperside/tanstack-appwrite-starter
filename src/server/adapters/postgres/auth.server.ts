import { randomUUID } from "node:crypto";
import { and, eq, lte, ne, sql } from "drizzle-orm";
import type { AdminAuth, AuthService, SessionAuth } from "#/core/auth/ports";
import type {
	AuthSession,
	DeviceSession,
	EmailLinkParams,
	User,
} from "#/core/auth/types";
import type { RequestInfo } from "#/core/backend";
import { DEFAULT_PREFS } from "#/core/prefs";
import { AppError } from "#/lib/errors";
import type { EmailPurpose, SendEmail } from "../shared/mail/mail";
import {
	hashPassword,
	type ScryptCost,
	verifyPassword,
} from "../shared/passwords.server";
import { hashToken, linkTo, newToken } from "../shared/tokens.server";
import { RECOVERY_TTL, SESSION_TTL, VERIFICATION_TTL } from "../shared/ttl";
import { describeUserAgent } from "../shared/user-agent";
import type { PostgresDb } from "./db.server";
import { translateErrors } from "./errors";
import { emailLinks, sessions, users } from "./schema";

export type PostgresAuthOptions = {
	db: PostgresDb;
	now: () => number;
	/** Receives every email. */
	sendEmail: SendEmail;
	/** The scrypt cost new password hashes use. */
	passwordCost: ScryptCost;
};

type UserRow = typeof users.$inferSelect;
type Tx = Parameters<Parameters<PostgresDb["transaction"]>[0]>[0];

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const byEmail = (email: string) => sql`lower(${users.email}) = lower(${email})`;

function toUser(row: UserRow): User {
	return {
		id: row.id,
		email: row.email ?? "",
		name: row.name,
		emailVerified: row.emailVerified,
		isGuest: row.email === null,
		prefs: row.prefs,
		createdAt: row.createdAt.toISOString(),
	};
}

/**
 * The auth ports over Postgres: users, sessions and emailed links live in
 * the database, so they survive restarts and are shared between instances.
 * One store serves every request (`forRequest`).
 */
export function createPostgresAuth({
	db,
	now,
	sendEmail,
	passwordCost,
}: PostgresAuthOptions) {
	const hash = (password: string) => hashPassword(password, passwordCost);
	// Verified against when the email is unknown, so timing does not tell.
	const dummyHash = hash("dummy password");

	/**
	 * Opens a session for `userId`, dropping the user's expired ones. Run it in
	 * the transaction that created the user, or alone for an existing one.
	 */
	async function openSession(
		tx: Tx,
		userId: string,
		userAgent: string | undefined,
	): Promise<AuthSession> {
		const token = newToken();
		const createdAt = now();
		const expiresAt = new Date(createdAt + SESSION_TTL);
		const id = randomUUID();
		await tx
			.delete(sessions)
			.where(
				and(
					eq(sessions.userId, userId),
					lte(sessions.expiresAt, new Date(createdAt)),
				),
			);
		await tx.insert(sessions).values({
			id,
			userId,
			tokenHash: hashToken(token),
			userAgent: userAgent ?? null,
			createdAt: new Date(createdAt),
			expiresAt,
		});
		return { id, userId, token, expiresAt: expiresAt.toISOString() };
	}

	function createUser(tx: Tx, fields: Partial<UserRow>) {
		const row = {
			id: randomUUID(),
			createdAt: new Date(now()),
			...fields,
		};
		return tx.insert(users).values(row).returning({ id: users.id });
	}

	/** Stores a link for `user` (hashed) and emails it. */
	async function sendLink(
		user: UserRow,
		purpose: EmailPurpose,
		redirectUrl: string,
	) {
		const token = newToken();
		const ttl = purpose === "recovery" ? RECOVERY_TTL : VERIFICATION_TTL;
		const email = user.email as string;
		await db.insert(emailLinks).values({
			tokenHash: hashToken(token),
			purpose,
			userId: user.id,
			email,
			expiresAt: new Date(now() + ttl),
		});
		await sendEmail({
			to: email,
			purpose,
			url: linkTo(redirectUrl, { token }),
			locale: user.prefs.locale ?? DEFAULT_PREFS.locale,
		});
	}

	/**
	 * Consumes a link, valid once and before it expires, and returns its user.
	 * One `delete … returning`, so concurrent consumers cannot both win.
	 */
	async function useLink(
		tx: Tx,
		link: EmailLinkParams,
		purpose: EmailPurpose,
	): Promise<UserRow> {
		if (!link.token) throw new AppError("INVALID_TOKEN");
		const [stored] = await tx
			.delete(emailLinks)
			.where(
				and(
					eq(emailLinks.tokenHash, hashToken(link.token)),
					eq(emailLinks.purpose, purpose),
				),
			)
			.returning();
		const [user] = stored
			? await tx.select().from(users).where(eq(users.id, stored.userId))
			: [];
		if (
			!stored ||
			!user ||
			stored.expiresAt.getTime() <= now() ||
			stored.email !== user.email
		) {
			throw new AppError("INVALID_TOKEN");
		}
		return user;
	}

	function forSession(token: string): SessionAuth {
		const tokenHash = hashToken(token);

		/** The live session and its user; `UNAUTHENTICATED` otherwise. */
		async function current() {
			const [found] = await db
				.select({ session: sessions, user: users })
				.from(sessions)
				.innerJoin(users, eq(sessions.userId, users.id))
				.where(eq(sessions.tokenHash, tokenHash));
			if (found && found.session.expiresAt.getTime() <= now()) {
				await db.delete(sessions).where(eq(sessions.id, found.session.id));
			} else if (found) {
				return found;
			}
			throw new AppError("UNAUTHENTICATED");
		}

		/** `current()`, for a registered user only (`FORBIDDEN` for a guest). */
		async function registered() {
			const found = await current();
			if (found.user.email === null) throw new AppError("FORBIDDEN");
			return found;
		}

		return translateErrors<SessionAuth>({
			getUser: async () => toUser((await current()).user),
			signOut: async () => {
				await current();
				await db.delete(sessions).where(eq(sessions.tokenHash, tokenHash));
			},
			signOutEverywhere: async () => {
				const { user } = await current();
				await db.delete(sessions).where(eq(sessions.userId, user.id));
			},
			listSessions: async () => {
				const { user } = await current();
				const rows = await db
					.select()
					.from(sessions)
					.where(eq(sessions.userId, user.id));
				return rows
					.filter((s) => s.expiresAt.getTime() > now())
					.map(
						(s): DeviceSession => ({
							id: s.id,
							current: s.tokenHash === tokenHash,
							...describeUserAgent(s.userAgent ?? undefined),
							createdAt: s.createdAt.toISOString(),
						}),
					);
			},
			updateName: async (name) => {
				const { user } = await current();
				await db.update(users).set({ name }).where(eq(users.id, user.id));
			},
			// One statement, so concurrent patches both land.
			updatePrefs: async (patch) => {
				const { user } = await current();
				const [row] = await db
					.update(users)
					.set({
						prefs: sql`${users.prefs} || ${JSON.stringify(patch)}::jsonb`,
					})
					.where(eq(users.id, user.id))
					.returning({ prefs: users.prefs });
				return row?.prefs ?? {};
			},
			// Like Appwrite: a guest sets its first password here, anyone else
			// confirms the current one.
			updateEmail: async ({ email, password }) => {
				const { user } = await current();
				const isGuest = user.email === null;
				if (!isGuest && !(await verifyPassword(password, user.passwordHash))) {
					throw new AppError("INVALID_CREDENTIALS");
				}
				const newHash = isGuest ? await hash(password) : null;
				await db.transaction(async (tx) => {
					await tx
						.update(users)
						.set({
							email,
							emailVerified: false,
							passwordHash: sql`coalesce(${users.passwordHash}, ${newHash})`,
						})
						.where(eq(users.id, user.id));
					await tx
						.delete(emailLinks)
						.where(
							and(
								eq(emailLinks.userId, user.id),
								eq(emailLinks.purpose, "verification"),
							),
						);
				});
			},
			updatePassword: async ({ password, oldPassword }) => {
				const { session, user } = await registered();
				if (!(await verifyPassword(oldPassword, user.passwordHash))) {
					throw new AppError("INVALID_CREDENTIALS");
				}
				const passwordHash = await hash(password);
				await db.transaction(async (tx) => {
					await tx
						.update(users)
						.set({ passwordHash })
						.where(eq(users.id, user.id));
					await tx
						.delete(sessions)
						.where(
							and(eq(sessions.userId, user.id), ne(sessions.id, session.id)),
						);
				});
			},
			sendVerification: async ({ redirectUrl }) => {
				const { user } = await registered();
				await sendLink(user, "verification", redirectUrl);
			},
			// The account changes in place, so its session simply carries on.
			upgradeGuest: async ({ name, email, password }) => {
				const { session, user } = await current();
				if (user.email !== null) throw new AppError("FORBIDDEN");
				const passwordHash = await hash(password);
				await db
					.update(users)
					.set({ name, email, emailVerified: false, passwordHash })
					.where(eq(users.id, user.id));
				return {
					id: session.id,
					userId: user.id,
					token,
					expiresAt: session.expiresAt.toISOString(),
				};
			},
		});
	}

	const admin = translateErrors<AdminAuth>({
		deleteUser: async (userId) => {
			// The id column is a uuid: anything else cannot name a user.
			const deleted = UUID.test(userId)
				? await db
						.delete(users)
						.where(eq(users.id, userId))
						.returning({ id: users.id })
				: [];
			if (deleted.length === 0) throw new AppError("NOT_FOUND");
		},
		deleteSession: async ({ userId, sessionId }) => {
			const deleted =
				UUID.test(userId) && UUID.test(sessionId)
					? await db
							.delete(sessions)
							.where(
								and(eq(sessions.id, sessionId), eq(sessions.userId, userId)),
							)
							.returning({ id: sessions.id })
					: [];
			if (deleted.length === 0) throw new AppError("NOT_FOUND");
		},
	});

	/** The auth ports for one request; all requests share the database. */
	function forRequest({ userAgent }: RequestInfo): AuthService {
		const service = translateErrors<Omit<AuthService, "session" | "admin">>({
			signUp: async ({ name, email, password }) => {
				const passwordHash = await hash(password);
				return db.transaction(async (tx) => {
					const [user] = await createUser(tx, { name, email, passwordHash });
					return openSession(tx, user?.id as string, userAgent);
				});
			},
			signIn: async ({ email, password }) => {
				const [user] = await db.select().from(users).where(byEmail(email));
				const valid = await verifyPassword(
					password,
					user ? user.passwordHash : await dummyHash,
				);
				if (!user || !valid) throw new AppError("INVALID_CREDENTIALS");
				return db.transaction((tx) => openSession(tx, user.id, userAgent));
			},
			startGuest: () =>
				db.transaction(async (tx) => {
					const [user] = await createUser(tx, {});
					return openSession(tx, user?.id as string, userAgent);
				}),
			requestPasswordReset: async ({ email, redirectUrl }) => {
				const [user] = await db.select().from(users).where(byEmail(email));
				if (!user) throw new AppError("NOT_FOUND");
				await sendLink(user, "recovery", redirectUrl);
			},
			resetPassword: async ({ link, password }) => {
				const passwordHash = await hash(password);
				await db.transaction(async (tx) => {
					const user = await useLink(tx, link, "recovery");
					await tx
						.update(users)
						.set({ passwordHash })
						.where(eq(users.id, user.id));
					await tx.delete(sessions).where(eq(sessions.userId, user.id));
				});
			},
			confirmVerification: async (link) => {
				await db.transaction(async (tx) => {
					const user = await useLink(tx, link, "verification");
					await tx
						.update(users)
						.set({ emailVerified: true })
						.where(eq(users.id, user.id));
				});
			},
		});
		// `session` is not async: its methods are wrapped instead.
		return { ...service, session: forSession, admin };
	}

	return { forRequest };
}
