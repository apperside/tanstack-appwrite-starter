import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import type { PostgresDb } from "#/server/adapters/postgres/db.server";
import * as schema from "#/server/adapters/postgres/schema";

/** An in-memory Postgres with the app's migrations applied. */
export async function createTestDb(): Promise<{
	db: PostgresDb;
	/** Empties every table and restarts the identity counters. */
	reset(): Promise<void>;
	client: PGlite;
}> {
	const client = new PGlite();
	const db = drizzle(client, { schema });
	await migrate(db, {
		migrationsFolder: "src/server/adapters/postgres/migrations",
	});
	return {
		db,
		client,
		reset: async () => {
			await client.exec(
				"TRUNCATE users, sessions, email_links, todos RESTART IDENTITY CASCADE",
			);
		},
	};
}
