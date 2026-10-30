import { z } from "zod/mini";
import { parseOrThrow } from "#/config/env";

/** The mail transports a deployment can pick with `MAIL_PROVIDER`. */
export const MAIL_PROVIDERS = ["console", "smtp", "mailgun"] as const;

const schema = z
	.object({
		MAIL_PROVIDER: z._default(z.enum(MAIL_PROVIDERS), "console"),
		MAIL_FROM: z._default(z.string(), ""),
	})
	.check(
		z.refine((env) => env.MAIL_PROVIDER === "console" || env.MAIL_FROM !== "", {
			error: "required unless MAIL_PROVIDER is console",
			path: ["MAIL_FROM"],
		}),
	);

export function parseMailEnv(raw: Record<string, unknown>) {
	return parseOrThrow(schema, raw, "mail");
}

let cached: ReturnType<typeof parseMailEnv> | undefined;

/** Server-only. Parses `process.env` once, on first call. */
export function mailEnv() {
	cached ??= parseMailEnv(process.env);
	return cached;
}
