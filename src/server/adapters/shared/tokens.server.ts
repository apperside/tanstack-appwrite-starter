import { createHash, randomBytes } from "node:crypto";
import type { EmailLinkParams } from "#/core/auth/types";

/** A random 256-bit token, url-safe. */
export const newToken = () => randomBytes(32).toString("base64url");

/** What a backend stores in place of a token: its SHA-256, url-safe. */
export const hashToken = (token: string) =>
	createHash("sha256").update(token).digest("base64url");

/** `redirectUrl` with `params` added to its query. */
export function linkTo(redirectUrl: string, params: EmailLinkParams): string {
	const url = new URL(redirectUrl);
	for (const [key, value] of Object.entries(params)) {
		url.searchParams.set(key, value);
	}
	return url.toString();
}
