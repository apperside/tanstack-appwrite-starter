import { AppError } from "#/lib/errors";
import type { MAIL_PROVIDERS } from "./env";
import { mailEnv } from "./env";
import type { MailTransport, SendEmail } from "./mail";
import { renderAuthEmail } from "./render";

type MailProvider = (typeof MAIL_PROVIDERS)[number];

/** Renders each email and hands it to `transport`, sent from `from`. */
export function createMailer({
	transport,
	from,
	provider,
}: {
	transport: MailTransport;
	from: string;
	provider: MailProvider;
}): SendEmail {
	return async (email) => {
		try {
			await transport.send({ ...renderAuthEmail(email), from });
		} catch (cause) {
			// The provider's error may carry credentials: log only its name.
			console.error(`[mail] sending through ${provider} failed`);
			throw new AppError("UNKNOWN", { cause });
		}
	};
}

/** Loads one transport, so a deployment only imports the provider it uses. */
export async function loadTransport(
	provider: MailProvider,
): Promise<MailTransport> {
	switch (provider) {
		case "console":
			return (
				await import("./transports/console.server")
			).createConsoleTransport();
		case "smtp":
			throw new Error("not implemented");
		case "mailgun":
			throw new Error("not implemented");
	}
}

let mailer: Promise<SendEmail> | undefined;

/**
 * The process-wide mailer. Env and transport load on the first send, so a
 * backend that never emails needs no mail configuration.
 */
export function getSendEmail(): SendEmail {
	return async (email) => {
		mailer ??= (async () => {
			const { MAIL_PROVIDER, MAIL_FROM } = mailEnv();
			return createMailer({
				transport: await loadTransport(MAIL_PROVIDER),
				from: MAIL_FROM,
				provider: MAIL_PROVIDER,
			});
		})();
		return (await mailer)(email);
	};
}
