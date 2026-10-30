import type { Backend } from "#/core/backend";
import type { SendEmail } from "../shared/mail/mail";
import { getSendEmail } from "../shared/mail/mailer.server";
import { OWASP_SCRYPT, type ScryptCost } from "../shared/passwords.server";
import { createPostgresAuth } from "./auth.server";
import { connectPostgres, type PostgresDb } from "./db.server";
import { postgresEnv } from "./env";
import { migratePostgres } from "./migrate.server";
import { createPostgresTodos } from "./todos.server";

export type PostgresBackendOptions = {
	db: PostgresDb;
	/** Injectable clock, for tests. */
	now?: () => number;
	/** Receives every email; the default is the env-configured mailer. */
	sendEmail?: SendEmail;
	/** The scrypt cost new password hashes use; tests lower it. */
	passwordCost?: ScryptCost;
};

/** The Postgres backend: auth and todos in one database. */
export function createPostgresBackend({
	db,
	now = Date.now,
	sendEmail = getSendEmail(),
	passwordCost = OWASP_SCRYPT,
}: PostgresBackendOptions): Backend {
	const auth = createPostgresAuth({ db, now, sendEmail, passwordCost });
	return {
		auth: auth.forRequest,
		data: { todos: createPostgresTodos({ db, now }) },
	};
}

/**
 * Connects to `DATABASE_URL`, applies pending migrations, then builds the
 * backend. The connection is closed again if either step fails.
 */
export async function createPostgresBackendFromEnv(): Promise<Backend> {
	const { db, sql } = connectPostgres(postgresEnv().DATABASE_URL);
	try {
		await migratePostgres(sql, db);
		return createPostgresBackend({ db });
	} catch (error) {
		await sql.end().catch(() => {});
		throw error;
	}
}
