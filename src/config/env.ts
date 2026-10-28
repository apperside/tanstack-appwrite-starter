// zod/mini: `publicEnv` is parsed in the browser too.
import { z } from "zod/mini";

/** Reads an empty string as an unset variable. */
function emptyAsUnset<T extends z.ZodMiniType>(schema: T) {
	return z.pipe(
		z.transform((value: unknown) => (value === "" ? undefined : value)),
		schema,
	);
}

const publicSchema = z.object({
	VITE_APPWRITE_ENDPOINT: z.url(),
	VITE_APPWRITE_PROJECT_ID: z.string().check(z.minLength(1)),
	VITE_APPWRITE_DATABASE_ID: z.string().check(z.minLength(1)),
	// Empty string (e.g. a copied .env.example) counts as unset.
	VITE_REQUIRE_EMAIL_VERIFICATION: emptyAsUnset(
		z._default(z.stringbool(), false),
	),
});

const serverSchema = z.object({
	APPWRITE_API_KEY: z.string().check(z.minLength(1)),
	APP_URL: z.url(),
	// Empty string counts as unset.
	TRUSTED_PROXY_HOPS: emptyAsUnset(
		z._default(z.coerce.number().check(z.int(), z.nonnegative()), 0),
	),
});

/** zod/mini ships no message locale, so its messages are a generic "Invalid input". */
function describeIssue(issue: z.core.$ZodIssue): string {
	switch (issue.code) {
		case "invalid_type":
			return `expected ${issue.expected}`;
		case "invalid_format":
			return `invalid ${issue.format}`;
		case "too_small":
			return `must be at least ${issue.minimum}`;
		default:
			return issue.code.replaceAll("_", " ");
	}
}

/** Throws an error naming every missing or invalid variable. */
function parseOrThrow<T extends z.ZodMiniType>(
	schema: T,
	raw: Record<string, unknown>,
	label: string,
): z.output<T> {
	const result = schema.safeParse(raw);
	if (result.success) return result.data;
	const details = result.error.issues
		.map((issue) => `${issue.path.join(".")}: ${describeIssue(issue)}`)
		.join("; ");
	throw new Error(`Invalid ${label} environment: ${details}`);
}

export function parsePublicEnv(raw: Record<string, unknown>) {
	const env = parseOrThrow(publicSchema, raw, "public");
	return {
		APPWRITE_ENDPOINT: env.VITE_APPWRITE_ENDPOINT,
		APPWRITE_PROJECT_ID: env.VITE_APPWRITE_PROJECT_ID,
		APPWRITE_DATABASE_ID: env.VITE_APPWRITE_DATABASE_ID,
		REQUIRE_EMAIL_VERIFICATION: env.VITE_REQUIRE_EMAIL_VERIFICATION,
	};
}

export function parseServerEnv(raw: Record<string, unknown>) {
	return parseOrThrow(serverSchema, raw, "server");
}

/**
 * Safe for browser and server code. Fails at import if misconfigured.
 */
export const publicEnv = parsePublicEnv(import.meta.env);

let cachedServerEnv: ReturnType<typeof parseServerEnv> | undefined;

/**
 * Server-only (`*.server.ts`). Parses `process.env` once, on first call.
 */
export function serverEnv() {
	cachedServerEnv ??= parseServerEnv(process.env);
	return cachedServerEnv;
}
