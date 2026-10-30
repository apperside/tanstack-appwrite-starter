import nodemailer from "nodemailer";
import { z } from "zod/mini";
import { parseOrThrow } from "#/config/env";
import type { MailTransport } from "../mail";

const schema = z.object({
	SMTP_HOST: z.string().check(z.minLength(1)),
	SMTP_PORT: z.coerce.number().check(z.int(), z.positive()),
	SMTP_USER: z.optional(z.string().check(z.minLength(1))),
	SMTP_PASS: z.optional(z.string().check(z.minLength(1))),
	SMTP_SECURE: z.optional(z.enum(["true", "false"])),
});

/** `SMTP_SECURE` defaults to true only on the implicit-TLS port, 465. */
export function parseSmtpEnv(raw: Record<string, unknown>) {
	const env = parseOrThrow(schema, raw, "SMTP");
	return {
		...env,
		SMTP_SECURE: env.SMTP_SECURE
			? env.SMTP_SECURE === "true"
			: env.SMTP_PORT === 465,
	};
}

let cached: ReturnType<typeof parseSmtpEnv> | undefined;

/** Server-only. Parses `process.env` once, on first call. */
export function smtpEnv() {
	cached ??= parseSmtpEnv(process.env);
	return cached;
}

/** Sends each email through an SMTP server. */
export function createSmtpTransport(
	env = smtpEnv(),
	create = nodemailer.createTransport,
): MailTransport {
	const transporter = create({
		host: env.SMTP_HOST,
		port: env.SMTP_PORT,
		secure: env.SMTP_SECURE,
		...(env.SMTP_USER && env.SMTP_PASS
			? { auth: { user: env.SMTP_USER, pass: env.SMTP_PASS } }
			: {}),
	});
	return {
		send: async ({ from, to, subject, text, html }) => {
			await transporter.sendMail({ from, to, subject, text, html });
		},
	};
}
