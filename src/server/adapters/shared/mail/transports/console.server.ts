import type { MailTransport } from "../mail";

/** Prints each email to the server log, for development: nothing is sent. */
export function createConsoleTransport(): MailTransport {
	return {
		send: async ({ to, subject, text }) => {
			console.info(`[mail] to ${to}: ${subject}\n${text}`);
		},
	};
}
