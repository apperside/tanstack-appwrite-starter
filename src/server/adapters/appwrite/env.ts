// zod/mini: the public part is parsed in the browser too (the realtime client).
import { z } from "zod/mini";
import { parseOrThrow } from "#/config/env";

const publicSchema = z.object({
	VITE_APPWRITE_ENDPOINT: z.url(),
	VITE_APPWRITE_PROJECT_ID: z.string().check(z.minLength(1)),
	VITE_APPWRITE_DATABASE_ID: z.string().check(z.minLength(1)),
});

const serverSchema = z.object({
	APPWRITE_API_KEY: z.string().check(z.minLength(1)),
});

export function parseAppwritePublicEnv(raw: Record<string, unknown>) {
	const env = parseOrThrow(publicSchema, raw, "Appwrite public");
	return {
		ENDPOINT: env.VITE_APPWRITE_ENDPOINT,
		PROJECT_ID: env.VITE_APPWRITE_PROJECT_ID,
		DATABASE_ID: env.VITE_APPWRITE_DATABASE_ID,
	};
}

export function parseAppwriteServerEnv(raw: Record<string, unknown>) {
	return parseOrThrow(serverSchema, raw, "Appwrite server");
}

let cachedPublic: ReturnType<typeof parseAppwritePublicEnv> | undefined;
let cachedServer: ReturnType<typeof parseAppwriteServerEnv> | undefined;

/**
 * Browser and server. Parsed on first use, so another backend needs none of
 * these variables.
 */
export function appwritePublicEnv() {
	cachedPublic ??= parseAppwritePublicEnv(import.meta.env);
	return cachedPublic;
}

/** Server-only. Parses `process.env` once, on first call. */
export function appwriteServerEnv() {
	cachedServer ??= parseAppwriteServerEnv(process.env);
	return cachedServer;
}
