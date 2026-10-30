import path from "node:path";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import type postgres from "postgres";
import type { PostgresDb } from "./db.server";

/** Held while migrating, so instances starting together migrate one at a time. */
const MIGRATION_LOCK_KEY = 7_204_818_113_005n;

// postgres.js takes no bigint parameter; the server casts the text.
const LOCK_PARAM = String(MIGRATION_LOCK_KEY);

/** Applies pending migrations, holding an advisory lock for the duration. */
export async function migratePostgres(
	sql: postgres.Sql,
	db: PostgresDb,
): Promise<void> {
	// The lock belongs to one connection, so lock and unlock on a reserved one.
	const connection = await sql.reserve();
	try {
		await connection`select pg_advisory_lock(${LOCK_PARAM}::bigint)`;
		await migrate(db as Parameters<typeof migrate>[0], {
			migrationsFolder: path.resolve(
				process.cwd(),
				"src/server/adapters/postgres/migrations",
			),
		});
	} finally {
		await connection`select pg_advisory_unlock(${LOCK_PARAM}::bigint)`;
		connection.release();
	}
}
