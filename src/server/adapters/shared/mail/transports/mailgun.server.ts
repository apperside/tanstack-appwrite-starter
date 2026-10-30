import { z } from "zod/mini";
import { parseOrThrow } from "#/config/env";
import type { MailTransport } from "../mail";

const API_BASE = {
	us: "https://api.mailgun.net",
	eu: "https://api.eu.mailgun.net",
} as const;

const schema = z.object({
	MAILGUN_API_KEY: z.string().check(z.minLength(1)),
	MAILGUN_DOMAIN: z.string().check(z.minLength(1)),
	MAILGUN_REGION: z._default(z.enum(["us", "eu"]), "us"),
});

export function parseMailgunEnv(raw: Record<string, unknown>) {
	return parseOrThrow(schema, raw, "Mailgun");
}

let cached: ReturnType<typeof parseMailgunEnv> | undefined;

/** Server-only. Parses `process.env` once, on first call. */
export function mailgunEnv() {
	cached ??= parseMailgunEnv(process.env);
	return cached;
}

/** Sends each email through the Mailgun HTTP API. */
export function createMailgunTransport(
	env = mailgunEnv(),
	fetchImpl: typeof fetch = fetch,
): MailTransport {
	const url = `${API_BASE[env.MAILGUN_REGION]}/v3/${env.MAILGUN_DOMAIN}/messages`;
	const authorization = `Basic ${btoa(`api:${env.MAILGUN_API_KEY}`)}`;
	return {
		send: async ({ from, to, subject, text, html }) => {
			const response = await fetchImpl(url, {
				method: "POST",
				headers: { Authorization: authorization },
				body: new URLSearchParams({ from, to, subject, text, html }),
			});
			if (!response.ok) {
				throw new Error(`Mailgun responded with HTTP ${response.status}`);
			}
		},
	};
}
