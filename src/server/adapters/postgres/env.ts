import { z } from "zod/mini";
import { parseOrThrow } from "#/config/env";

const schema = z.object({
	DATABASE_URL: z.url(),
});

export function parsePostgresEnv(raw: Record<string, unknown>) {
	return parseOrThrow(schema, raw, "Postgres");
}

let cached: ReturnType<typeof parsePostgresEnv> | undefined;

/**
 * Server-only. Parses `process.env` once, on first call. */
export function postgresEnv() {
	cached ??= parsePostgresEnv(process.env);
	return cached;
}
