import { randomUUID } from "node:crypto";
import { and, eq, lte, sql } from "drizzle-orm";
import type { AdminAuth, AuthService, SessionAuth } from "#/core/auth/ports";
import type { AuthSession, DeviceSession, User } from "#/core/auth/types";
import type { RequestInfo } from "#/core/backend";
import { AppError } from "#/lib/errors";
import type { SendEmail } from "../shared/mail/mail";
import {
	hashPassword,
	type ScryptCost,
	verifyPassword,
} from "../shared/passwords.server";
import { hashToken, newToken } from "../shared/tokens.server";
import { SESSION_TTL } from "../shared/ttl";
import { describeUserAgent } from "../shared/user-agent";
import type { PostgresDb } from "./db.server";
import { translateErrors } from "./errors";
import { sessions, users } from "./schema";

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

const notImplemented = async () => {
	throw new Error("not implemented");
};

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
			updateEmail: notImplemented,
			updatePassword: notImplemented,
			sendVerification: notImplemented,
			upgradeGuest: notImplemented,
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
					user?.passwordHash ?? (await dummyHash),
				);
				if (!user || !valid) throw new AppError("INVALID_CREDENTIALS");
				return db.transaction((tx) => openSession(tx, user.id, userAgent));
			},
			startGuest: () =>
				db.transaction(async (tx) => {
					const [user] = await createUser(tx, {});
					return openSession(tx, user?.id as string, userAgent);
				}),
			requestPasswordReset: notImplemented,
			resetPassword: notImplemented,
			confirmVerification: notImplemented,
		});
		// `session` is not async: its methods are wrapped instead.
		return { ...service, session: forSession, admin };
	}

	return { forRequest };
}
