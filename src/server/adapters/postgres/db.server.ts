import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

/** A Drizzle database: postgres.js in production, PGlite in tests. */
export type PostgresDb = PgDatabase<PgQueryResultHKT, typeof schema>;

/**
 * @public Used by the backend wiring (a later task).
 * Connects to the server at `url`; end `sql` to close the pool.
 */
export function connectPostgres(url: string): {
	db: PostgresDb;
	sql: postgres.Sql;
} {
	const sql = postgres(url);
	return { db: drizzle(sql, { schema }), sql };
}
